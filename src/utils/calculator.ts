/**
 * ============================================================================
 *  EL ALGORITMO
 * ============================================================================
 *
 * Función pura, síncrona y sin dependencias de red o de DOM. Se ejecuta
 * íntegramente en el navegador del usuario en menos de un milisegundo, que es
 * precisamente lo que permite que el servicio sea gratuito e ilimitado: no
 * hay servidor que pagar porque no hay nada que calcular en el servidor.
 *
 * Al ser pura también es trivial de testear: entra un `Product`, sale un
 * `ScoreResult`. Sin mocks, sin fixtures de red.
 *
 * --------------------------------------------------------------------------
 *  ESTRUCTURA DE LA NOTA (0 a 10)
 * --------------------------------------------------------------------------
 *
 *   nota = 0.40 · aditivos  +  0.40 · nutrición  +  0.20 · procesamiento
 *
 *  1. ADITIVOS (40 %)
 *     Parte de 10 y resta según el riesgo de cada número E presente:
 *       sin riesgo   →  −0
 *       bajo         →  −0.5
 *       moderado     →  −1.5
 *       alto/tóxico  →  −3
 *     Más una penalización por "efecto cóctel" cuando hay muchos aditivos.
 *
 *  2. NUTRICIÓN (40 %)
 *     Nutri-Score recalculado por nosotros (ver `utils/nutrition.ts`) y
 *     mapeado linealmente a 0-10.
 *
 *  3. PROCESAMIENTO (20 %)
 *     Escala NOVA: 1 → 10, 2 → 7.5, 3 → 5, 4 → 0. Un ultraprocesado pierde
 *     por tanto exactamente 2 puntos de la nota final.
 *
 * --------------------------------------------------------------------------
 *  DATOS FALTANTES
 * --------------------------------------------------------------------------
 *  Open Food Facts es colaborativo: muchos productos vienen incompletos.
 *  Un bloque sin datos NO se puntúa con 0 (sería injusto y alarmista): se
 *  excluye y los pesos de los bloques restantes se RENORMALIZAN para que
 *  sigan sumando 1. El resultado se marca con menor `confidence` y se listan
 *  los campos que faltaban.
 */

import type { NovaGroup, Product } from "@/types/product";
import type {
  Confidence,
  ScoreBlock,
  ScoreColor,
  ScoreLabel,
  ScoreReason,
  ScoreResult,
  RiskLevel,
} from "@/types/score";
import { ADDITIVES_DB, RISK_LABEL, resolveAdditives } from "@/utils/additives";
import { analyzeNutrition } from "@/utils/nutrition";
import { NOVA_DESCRIPTION, NOVA_LABEL, NOVA_SUBSCORE } from "@/utils/nova";

/* -------------------------------------------------------------------------- */
/*  Configuración                                                             */
/* -------------------------------------------------------------------------- */

/** Súbela cuando cambies la fórmula: invalida cachés e historial guardado. */
export const ALGORITHM_VERSION = "1.0.0";

/** Pesos nominales de cada bloque. Deben sumar 1. */
export const WEIGHTS = {
  additives: 0.4,
  nutrition: 0.4,
  processing: 0.2,
} as const;

/**
 * Efecto cóctel: la evidencia sobre la interacción entre aditivos es limitada,
 * pero acumular muchos es en sí mismo un marcador de ultraprocesado. A partir
 * del sexto aditivo restamos 0,25 puntos del bloque por cada uno, con un tope.
 */
const COCKTAIL = { threshold: 5, perAdditive: 0.25, maxPenalty: 2 } as const;

/** Umbrales de color y etiqueta, de mejor a peor. */
const SCALE: readonly {
  min: number;
  label: ScoreLabel;
  color: ScoreColor;
  hex: string;
}[] = [
  { min: 8.5, label: "Excelente", color: "green", hex: "#15803d" },
  { min: 6.5, label: "Bueno", color: "green", hex: "#16a34a" },
  { min: 4.0, label: "Mediocre", color: "yellow", hex: "#eab308" },
  { min: -Infinity, label: "Malo", color: "red", hex: "#dc2626" },
];

/* -------------------------------------------------------------------------- */
/*  Utilidades internas                                                       */
/* -------------------------------------------------------------------------- */

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */
/*  Bloque 1 · Aditivos y toxicidad (40 %)                                    */
/* -------------------------------------------------------------------------- */

function buildAdditivesBlock(product: Product): ScoreBlock {
  const resolved = resolveAdditives(product.additiveCodes);
  const penalties = ADDITIVES_DB.penalties;
  const reasons: ScoreReason[] = [];
  const weight = WEIGHTS.additives;

  /*
   * Si no tenemos ni lista de aditivos ni lista de ingredientes, no podemos
   * afirmar que el producto no lleve aditivos: sólo que no lo sabemos.
   */
  const hasEvidence =
    resolved.length > 0 ||
    (product.ingredientsText !== null && product.ingredientsText.trim() !== "");

  let penaltyTotal = 0;

  for (const item of resolved) {
    const penalty = penalties[item.risk] ?? 0;
    penaltyTotal += penalty;

    reasons.push({
      block: "additives",
      label: item.additive ? `${item.code} · ${item.additive.name}` : item.code,
      detail:
        item.additive?.description ??
        "Aditivo no catalogado todavía en nuestra base de datos. Lo tratamos con prudencia.",
      impact: round2(-penalty * weight),
      severity: item.risk,
    });
  }

  // Efecto cóctel
  const excess = Math.max(0, resolved.length - COCKTAIL.threshold);
  const cocktail = Math.min(excess * COCKTAIL.perAdditive, COCKTAIL.maxPenalty);
  if (cocktail > 0) {
    penaltyTotal += cocktail;
    reasons.push({
      block: "additives",
      label: `Efecto cóctel · ${resolved.length} aditivos`,
      detail:
        "Acumular muchos aditivos es un marcador claro de formulación industrial, aunque cada uno por separado sea seguro.",
      impact: round2(-cocktail * weight),
      severity: "moderate",
    });
  }

  if (resolved.length === 0 && hasEvidence) {
    reasons.push({
      block: "additives",
      label: "Sin aditivos",
      detail: "No se ha detectado ningún número E en la lista de ingredientes.",
      impact: 0,
      severity: "none",
    });
  }

  return {
    id: "additives",
    label: "Aditivos y toxicidad",
    subScore: round2(clamp(10 - penaltyTotal, 0, 10)),
    weight,
    weighted: 0, // se calcula al renormalizar
    available: hasEvidence,
    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/*  Bloque 2 · Calidad nutricional (40 %)                                     */
/* -------------------------------------------------------------------------- */

function buildNutritionBlock(product: Product): ScoreBlock {
  const weight = WEIGHTS.nutrition;
  const analysis = analyzeNutrition(product.nutrients, {
    isBeverage: product.isBeverage,
    isWater: product.isWater,
  });

  const reasons: ScoreReason[] = [];

  /*
   * Repartimos los puntos perdidos entre los nutrientes que los han causado,
   * proporcionalmente a su contribución. Así el usuario ve "el azúcar te ha
   * costado 1,2 puntos" en lugar de un Nutri-Score abstracto.
   */
  const lost = (10 - analysis.subScore) * weight;
  const negTotal = analysis.negativePoints;

  for (const d of analysis.details) {
    if (d.kind === "negative" && d.points > 0 && negTotal > 0) {
      reasons.push({
        block: "nutrition",
        label: `${d.label}: ${d.value ?? "?"} ${d.unit}/100 g`,
        detail: `${d.points} de 10 puntos de penalización en la escala Nutri-Score.`,
        impact: round2(-lost * (d.points / negTotal)),
        severity: severityFromPoints(d.points),
      });
    }
  }

  /*
   * Los puntos positivos (fibra, proteína, fruta) ya están descontados dentro
   * del Nutri-Score. Los mostramos como bonificación explícita para que se vea
   * cuánta penalización han evitado.
   */
  for (const d of analysis.details) {
    if (d.kind === "positive" && d.points > 0) {
      reasons.push({
        block: "nutrition",
        label: `${d.label}: ${d.value ?? "?"} ${d.unit}`,
        detail: `Compensa ${d.points} punto(s) de penalización nutricional.`,
        impact: round2(bonusImpact(d.points, weight)),
        severity: "none",
      });
    }
  }

  for (const field of analysis.missing) {
    reasons.push({
      block: "nutrition",
      label: `Falta el dato de ${field}`,
      detail: "Open Food Facts no tiene este valor. No penaliza, pero resta fiabilidad.",
      impact: 0,
      severity: "low",
    });
  }

  return {
    id: "nutrition",
    label: "Calidad nutricional",
    subScore: analysis.subScore,
    weight,
    weighted: 0,
    available: analysis.reliable,
    reasons,
  };
}

/** El rango útil del Nutri-Score son 55 puntos mapeados a 10. */
const POINTS_TO_SCORE = 10 / 55;

/** Cuánto vale, en la nota final, un punto positivo del Nutri-Score. */
function bonusImpact(points: number, weight: number): number {
  return points * POINTS_TO_SCORE * weight;
}

function severityFromPoints(points: number): RiskLevel {
  if (points >= 8) return "high";
  if (points >= 4) return "moderate";
  if (points >= 1) return "low";
  return "none";
}

/* -------------------------------------------------------------------------- */
/*  Bloque 3 · Nivel de procesamiento (20 %)                                  */
/* -------------------------------------------------------------------------- */

function buildProcessingBlock(product: Product): ScoreBlock {
  const weight = WEIGHTS.processing;
  const nova: NovaGroup | null = product.novaGroup;
  const reasons: ScoreReason[] = [];

  if (nova === null) {
    reasons.push({
      block: "processing",
      label: "Nivel de procesamiento desconocido",
      detail: "El producto no tiene grupo NOVA asignado en Open Food Facts.",
      impact: 0,
      severity: "low",
    });

    return {
      id: "processing",
      label: "Nivel de procesamiento",
      subScore: 5,
      weight,
      weighted: 0,
      available: false,
      reasons,
    };
  }

  const subScore = NOVA_SUBSCORE[nova];

  reasons.push({
    block: "processing",
    label: `NOVA ${nova} · ${NOVA_LABEL[nova]}`,
    detail: NOVA_DESCRIPTION[nova],
    impact: round2(-(10 - subScore) * weight),
    severity: nova === 4 ? "high" : nova === 3 ? "moderate" : "none",
  });

  return {
    id: "processing",
    label: "Nivel de procesamiento",
    subScore,
    weight,
    weighted: 0,
    available: true,
    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/*  Función pública                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cómo se combinan los tres bloques en la nota final.
 *
 * - `"linear"` (por defecto) → media ponderada 40/40/20, tal cual.
 *
 * - `"geometric"` → media geométrica ponderada. Un bloque muy malo arrastra
 *   la nota aunque los otros sean buenos, porque los factores multiplican en
 *   lugar de sumar.
 *
 * **Por qué existe la segunda opción.** La media ponderada tiene un suelo
 * estructural: el bloque de aditivos vale el 40 % y un producto sin aditivos
 * saca un 10 en él, así que aporta 4 puntos fijos pase lo que pase. Un
 * ultraprocesado a base de azúcar y grasa pero sin números E (una crema de
 * cacao, por ejemplo) no puede bajar de 4,0 ni con nutrición 0 y NOVA 4. Es
 * decir: la escala lineal nunca podrá calificarlo de "Malo".
 *
 * La media geométrica elimina ese suelo. Con un suelo blando por bloque
 * (`GEOMETRIC_FLOOR`) para que un único 0 no anule la nota entera:
 *
 * ```
 * nota = 10 · Π (máx(subScore_i, 1) / 10) ^ peso_i
 * ```
 *
 * Comparativa con productos reales (ver `calculator.test.ts`):
 *
 * | Producto            | linear | geometric |
 * |---------------------|--------|-----------|
 * | Agua mineral        |  10.0  |   10.0    |
 * | Lentejas cocidas    |   8.3  |    8.0    |
 * | Refresco de cola    |   4.8  |    4.2    |
 * | Crema de cacao      |   5.2  |    3.9    |
 * | Salchichas cocidas  |   2.4  |    2.3    |
 */
export type Aggregation = "linear" | "geometric";

/** Suelo por bloque en modo geométrico: evita que un 0 anule la nota. */
const GEOMETRIC_FLOOR = 1;

export interface CalculateOptions {
  /**
   * Si es `true`, los bloques sin datos se puntúan igualmente con su valor
   * por defecto en lugar de excluirse. Útil para comparar productos entre sí.
   * Por defecto `false`.
   */
  scoreMissingBlocks?: boolean;
  /** Forma de combinar los bloques. Por defecto `"linear"`. */
  aggregation?: Aggregation;
}

/**
 * Calcula la nota de 0 a 10 de un producto.
 *
 * @param product Producto ya normalizado (ver `lib/openfoodfacts.ts`).
 * @param options Ajustes opcionales del cálculo.
 * @returns La nota, su color, su etiqueta y el desglose completo de motivos.
 *
 * @example
 * ```ts
 * const product = normalizeOffProduct(await fetchProduct("3017620422003"));
 * const result = calculateScore(product);
 *
 * result.score;                 // 2.6
 * result.color;                 // "red"
 * result.reasons[0].label;      // "Azúcares: 56.3 g/100 g"
 * result.blocks[0].subScore;    // 9.5
 * ```
 */
export function calculateScore(
  product: Product,
  options: CalculateOptions = {},
): ScoreResult {
  const blocks: ScoreBlock[] = [
    buildAdditivesBlock(product),
    buildNutritionBlock(product),
    buildProcessingBlock(product),
  ];

  /* --- Renormalización de pesos ------------------------------------------ */
  const usable = options.scoreMissingBlocks
    ? blocks
    : blocks.filter((b) => b.available);

  // Si no queda nada utilizable, puntuamos con todo y bajamos la confianza.
  const effective = usable.length > 0 ? usable : blocks;
  const nominalSum = effective.reduce((acc, b) => acc + b.weight, 0);

  for (const block of blocks) {
    const included = effective.includes(block);
    const normalizedWeight = included ? block.weight / nominalSum : 0;
    block.weight = normalizedWeight;
    block.weighted = round2(block.subScore * normalizedWeight);
  }

  const aggregation: Aggregation = options.aggregation ?? "linear";

  const raw =
    aggregation === "geometric"
      ? effective.reduce(
          (acc, b) =>
            acc * Math.pow(Math.max(b.subScore, GEOMETRIC_FLOOR) / 10, b.weight),
          10,
        )
      : effective.reduce((acc, b) => acc + b.subScore * b.weight, 0);

  const score = clamp(raw, 0, 10);

  /* --- Escalado de los impactos ------------------------------------------ */
  /*
   * Los impactos se calcularon con los pesos NOMINALES. Si hemos renormalizado,
   * hay que reescalarlos para que sigan sumando lo que realmente se ha perdido.
   */
  for (const block of blocks) {
    const nominal: number = WEIGHTS[block.id];
    const factor = nominal === 0 ? 0 : block.weight / nominal;
    for (const reason of block.reasons) {
      reason.impact = round2(reason.impact * factor);
    }
  }

  /* --- Confianza --------------------------------------------------------- */
  const availableCount = blocks.filter((b) => b.available).length;
  let confidence: Confidence =
    availableCount === 3 ? "high" : availableCount === 2 ? "medium" : "low";
  if (product.source === "ocr") {
    // El OCR nunca da nutrientes ni NOVA fiables: como mucho, confianza media.
    confidence = confidence === "high" ? "medium" : "low";
  }

  const missingData = blocks
    .filter((b) => !b.available)
    .map((b) => b.label.toLowerCase());

  /* --- Color y etiqueta -------------------------------------------------- */
  const rounded = round1(score);
  const tier = SCALE.find((s) => rounded >= s.min) ?? SCALE[SCALE.length - 1]!;

  const reasons = blocks
    .flatMap((b) => b.reasons)
    .sort((a, b) => a.impact - b.impact);

  return {
    score: rounded,
    color: tier.color,
    label: tier.label,
    hex: tier.hex,
    confidence,
    missingData,
    blocks,
    reasons,
    algorithmVersion: ALGORITHM_VERSION,
  };
}

/* -------------------------------------------------------------------------- */
/*  Ayudas para la UI                                                         */
/* -------------------------------------------------------------------------- */

/** Frase de una línea que resume el porqué de la nota. */
export function explainScore(result: ScoreResult): string {
  const worst = result.reasons.find((r) => r.impact < 0);
  if (!worst) return "Sin penalizaciones relevantes.";
  return `Lo que más penaliza: ${worst.label} (${worst.impact.toFixed(1)} puntos).`;
}

/** Motivos que restan, ya ordenados de peor a menos malo. */
export function getPenalties(result: ScoreResult): ScoreReason[] {
  return result.reasons.filter((r) => r.impact < 0);
}

/** Motivos informativos o que bonifican. */
export function getPositives(result: ScoreResult): ScoreReason[] {
  return result.reasons.filter((r) => r.impact >= 0);
}

/** Etiqueta legible de un nivel de riesgo. Reexportada por comodidad. */
export { RISK_LABEL };
