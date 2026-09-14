/**
 * Bloque 3 del algoritmo: nivel de procesamiento (escala NOVA).
 *
 * NOVA clasifica los alimentos por el GRADO de procesamiento industrial, no
 * por sus nutrientes. Es el complemento natural del Nutri-Score: un refresco
 * "light" puede ser Nutri-Score B y NOVA 4 a la vez, y el usuario merece
 * saberlo.
 *
 * Este bloque pesa un 20 % de la nota final. Con `subScore` 0 para NOVA 4, un
 * ultraprocesado pierde exactamente 2 puntos sobre 10, tal y como define la
 * especificación del producto.
 */

import type { NovaGroup } from "@/types/product";

/** Nota de 0 a 10 del bloque de procesamiento para cada grupo NOVA. */
export const NOVA_SUBSCORE: Record<NovaGroup, number> = {
  1: 10,
  2: 7.5,
  3: 5,
  4: 0,
};

export const NOVA_LABEL: Record<NovaGroup, string> = {
  1: "Alimento sin procesar o mínimamente procesado",
  2: "Ingrediente culinario procesado",
  3: "Alimento procesado",
  4: "Ultraprocesado",
};

export const NOVA_DESCRIPTION: Record<NovaGroup, string> = {
  1: "Producto tal cual sale de la naturaleza o con procesos que no añaden nada (secado, congelado, fermentado).",
  2: "Sustancias extraídas de alimentos y usadas para cocinar: aceite, azúcar, sal, mantequilla.",
  3: "Alimentos del grupo 1 a los que se ha añadido sal, azúcar o aceite: conservas, pan artesano, quesos.",
  4: "Formulación industrial con ingredientes de uso exclusivamente industrial: aditivos cosméticos, aislados de proteína, jarabes. Asociado de forma consistente a peores resultados de salud.",
};

/** Convierte el valor de Open Food Facts (`number | string`) a `NovaGroup`. */
export function parseNovaGroup(value: unknown): NovaGroup | null {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/**
 * Heurística de respaldo cuando Open Food Facts no trae el grupo NOVA.
 *
 * No pretende replicar la clasificación oficial: es un suelo razonable que
 * evita puntuar de más a un producto claramente industrial. Si detecta
 * marcadores de ultraprocesado (aditivos "cosméticos" o ingredientes de uso
 * exclusivamente industrial) devuelve 4; si hay algún aditivo, 3.
 *
 * @param additiveCodes Códigos E normalizados del producto.
 * @param ingredientsText Lista de ingredientes en texto libre, si la hay.
 */
export function estimateNovaGroup(
  additiveCodes: readonly string[],
  ingredientsText: string | null,
): NovaGroup | null {
  /** Aditivos que en la práctica sólo aparecen en formulaciones industriales. */
  const ULTRA_MARKERS = new Set([
    "E102", "E110", "E122", "E124", "E129", "E131", "E133", "E150c", "E150d",
    "E171", "E211", "E250", "E251", "E320", "E321", "E407", "E433", "E466",
    "E471", "E472e", "E476", "E481", "E621", "E627", "E631", "E635",
    "E950", "E951", "E952", "E954", "E955", "E961",
  ]);

  const ULTRA_INGREDIENTS = [
    "jarabe de glucosa",
    "jarabe de fructosa",
    "jarabe de maíz",
    "dextrosa",
    "maltodextrina",
    "proteína de soja",
    "aislado de proteína",
    "aceite de palma",
    "grasa vegetal hidrogenada",
    "aroma idéntico al natural",
    "suero de leche en polvo",
  ];

  const hasUltraAdditive = additiveCodes.some((c) => ULTRA_MARKERS.has(c));
  const text = ingredientsText?.toLowerCase() ?? "";
  const hasUltraIngredient =
    text.length > 0 && ULTRA_INGREDIENTS.some((kw) => text.includes(kw));

  if (hasUltraAdditive || hasUltraIngredient) return 4;
  if (additiveCodes.length > 0) return 3;
  if (text.length === 0) return null; // sin datos: no inventamos
  return null;
}
