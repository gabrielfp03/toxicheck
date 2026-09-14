/**
 * Bloque 2 del algoritmo: calidad nutricional.
 *
 * Implementamos el Nutri-Score (algoritmo general 2017, con la tabla
 * alternativa para bebidas) porque es público, auditable y está validado
 * científicamente. Después lo mapeamos a nuestra escala de 0 a 10.
 *
 * Por qué lo recalculamos en lugar de usar la letra que ya trae Open Food
 * Facts: porque necesitamos el DESGLOSE (cuánto penaliza el azúcar, cuánto
 * la sal) para poder explicárselo al usuario. La letra sola no sirve para eso.
 */

import type { Nutrients } from "@/types/product";

/* -------------------------------------------------------------------------- */
/*  Tablas de puntos                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Una tabla es una lista de umbrales ordenados de menor a mayor.
 * El índice del primer umbral que NO se supera es la puntuación.
 */
type ThresholdTable = readonly number[];

/** Puntos negativos: 0-10. Más puntos = peor. */
const NEGATIVE_FOOD = {
  /** kJ / 100 g */
  energy: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  /** g / 100 g */
  sugars: [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45],
  /** g / 100 g */
  saturatedFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  /** mg / 100 g */
  sodiumMg: [90, 180, 270, 360, 450, 540, 630, 720, 810, 900],
} as const satisfies Record<string, ThresholdTable>;

const NEGATIVE_BEVERAGE = {
  energy: [30, 60, 90, 120, 150, 180, 210, 240, 270],
  sugars: [1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5],
  saturatedFat: NEGATIVE_FOOD.saturatedFat,
  sodiumMg: NEGATIVE_FOOD.sodiumMg,
} as const satisfies Record<string, ThresholdTable>;

/** Puntos positivos: restan de la nota Nutri-Score. */
const POSITIVE_FOOD = {
  /** % de fruta, verdura, legumbre y frutos secos → 0, 1, 2, 5 */
  fruitsVegetablesNuts: [40, 60, 80],
  /** g de fibra / 100 g → 0-5 */
  fiber: [0.9, 1.9, 2.8, 3.7, 4.7],
  /** g de proteína / 100 g → 0-5 */
  proteins: [1.6, 3.2, 4.8, 6.4, 8],
} as const satisfies Record<string, ThresholdTable>;

/* -------------------------------------------------------------------------- */
/*  Núcleo                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve cuántos umbrales de la tabla supera el valor.
 * Con `[4.5, 9, 13.5]` un valor de 10 devuelve 2.
 */
function pointsFor(value: number, table: ThresholdTable): number {
  let points = 0;
  for (const threshold of table) {
    if (value > threshold) points += 1;
    else break;
  }
  return points;
}

/** Puntos de fruta/verdura: la escala no es lineal (0, 1, 2, 5 / 0, 2, 4, 10). */
function fruitPoints(percent: number, isBeverage: boolean): number {
  const steps = isBeverage ? [0, 2, 4, 10] : [0, 1, 2, 5];
  const index = pointsFor(percent, POSITIVE_FOOD.fruitsVegetablesNuts);
  return steps[Math.min(index, steps.length - 1)] ?? 0;
}

/** Detalle de un nutriente concreto, para poder explicarlo en la UI. */
export interface NutrientDetail {
  key: keyof Nutrients;
  label: string;
  /** Valor por 100 g. `null` si falta el dato. */
  value: number | null;
  unit: string;
  /** Puntos Nutri-Score aportados (negativos suman, positivos restan). */
  points: number;
  kind: "negative" | "positive";
}

export interface NutritionAnalysis {
  /** Puntuación Nutri-Score bruta. Rango aproximado: -15 (mejor) a 40 (peor). */
  nutriScorePoints: number;
  /** Suma de puntos negativos (energía, azúcar, grasa saturada, sodio). */
  negativePoints: number;
  /** Suma de puntos positivos que finalmente han contado. */
  positivePoints: number;
  /** Letra equivalente calculada por nosotros. */
  grade: "a" | "b" | "c" | "d" | "e";
  /** Nota de 0 a 10 de este bloque. */
  subScore: number;
  details: NutrientDetail[];
  /** Nutrientes que faltaban y hemos tenido que asumir. */
  missing: string[];
  /** `false` si faltan tantos datos que el bloque no es fiable. */
  reliable: boolean;
}

/** Umbrales de letra Nutri-Score (algoritmo 2017). */
function pointsToGrade(points: number, isBeverage: boolean, isWater: boolean) {
  if (isWater) return "a" as const;
  if (isBeverage) {
    if (points <= 1) return "b" as const;
    if (points <= 5) return "c" as const;
    if (points <= 9) return "d" as const;
    return "e" as const;
  }
  if (points <= -1) return "a" as const;
  if (points <= 2) return "b" as const;
  if (points <= 10) return "c" as const;
  if (points <= 18) return "d" as const;
  return "e" as const;
}

/**
 * Mapea la puntuación Nutri-Score a nuestra escala 0-10.
 *
 * Anclamos el rango útil en [-15, 40]:
 *   -15 → 10 (agua, verdura fresca)
 *    40 → 0  (producto máximamente denso en azúcar, grasa y sal)
 *
 * Es una transformación lineal simple y, sobre todo, reversible: dado un
 * `subScore` se puede reconstruir el Nutri-Score, lo que facilita auditar.
 */
export function nutriScoreToSubScore(points: number): number {
  const MIN = -15;
  const MAX = 40;
  const clamped = Math.min(Math.max(points, MIN), MAX);
  return ((MAX - clamped) / (MAX - MIN)) * 10;
}

/**
 * Calcula el bloque nutricional completo.
 *
 * Política ante datos faltantes: un nutriente ausente cuenta **0 puntos**
 * (ni penaliza ni bonifica) y se registra en `missing`. Si falta más de la
 * mitad de los nutrientes negativos, marcamos el bloque como no fiable para
 * que `calculateScore` lo excluya y renormalice los pesos.
 */
export function analyzeNutrition(
  nutrients: Nutrients,
  options: { isBeverage: boolean; isWater: boolean },
): NutritionAnalysis {
  const { isBeverage, isWater } = options;
  const tables = isBeverage ? NEGATIVE_BEVERAGE : NEGATIVE_FOOD;

  const details: NutrientDetail[] = [];
  const missing: string[] = [];

  const negativeSpecs = [
    { key: "energyKj", label: "Energía", unit: "kJ", table: tables.energy },
    { key: "sugars", label: "Azúcares", unit: "g", table: tables.sugars },
    {
      key: "saturatedFat",
      label: "Grasas saturadas",
      unit: "g",
      table: tables.saturatedFat,
    },
    { key: "sodiumMg", label: "Sodio", unit: "mg", table: tables.sodiumMg },
  ] as const;

  let negative = 0;
  let missingNegative = 0;

  for (const { key, label, unit, table } of negativeSpecs) {
    const value = nutrients[key];
    if (value === null || Number.isNaN(value)) {
      missing.push(label.toLowerCase());
      missingNegative += 1;
      details.push({ key, label, unit, value: null, points: 0, kind: "negative" });
      continue;
    }
    const points = pointsFor(value, table);
    negative += points;
    details.push({ key, label, unit, value, points, kind: "negative" });
  }

  // --- Puntos positivos ---
  const fruitsPct = nutrients.fruitsVegetablesNuts ?? 0;
  const fruits = fruitPoints(fruitsPct, isBeverage);
  details.push({
    key: "fruitsVegetablesNuts",
    label: "Fruta, verdura y frutos secos",
    unit: "%",
    value: nutrients.fruitsVegetablesNuts,
    points: fruits,
    kind: "positive",
  });

  const fiberValue = nutrients.fiber;
  const fiber = fiberValue === null ? 0 : pointsFor(fiberValue, POSITIVE_FOOD.fiber);
  details.push({
    key: "fiber",
    label: "Fibra",
    unit: "g",
    value: fiberValue,
    points: fiber,
    kind: "positive",
  });

  const proteinValue = nutrients.proteins;
  const proteins =
    proteinValue === null ? 0 : pointsFor(proteinValue, POSITIVE_FOOD.proteins);
  details.push({
    key: "proteins",
    label: "Proteínas",
    unit: "g",
    value: proteinValue,
    points: proteins,
    kind: "positive",
  });

  /*
   * Regla del Nutri-Score: si los puntos negativos son 11 o más, la proteína
   * NO descuenta, salvo que el producto tenga puntuación máxima de fruta.
   * Evita que embutidos y quesos muy salados se "compren" una buena nota a
   * base de proteína.
   */
  const maxFruitPoints = isBeverage ? 10 : 5;
  const proteinCounts = negative < 11 || fruits === maxFruitPoints;
  const positive = fruits + fiber + (proteinCounts ? proteins : 0);

  const nutriScorePoints = negative - positive;
  const grade = pointsToGrade(nutriScorePoints, isBeverage, isWater);
  const subScore = isWater ? 10 : nutriScoreToSubScore(nutriScorePoints);

  return {
    nutriScorePoints,
    negativePoints: negative,
    positivePoints: positive,
    grade,
    subScore: Math.round(subScore * 100) / 100,
    details,
    missing,
    reliable: missingNegative <= 1,
  };
}
