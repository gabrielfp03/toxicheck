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

/*
 * Nota de diseño: aquí hubo una heurística que ADIVINABA el grupo NOVA a
 * partir de los aditivos cuando Open Food Facts no lo traía. Se ha retirado
 * a propósito.
 *
 * El motivo es que adivinar sólo puede penalizar: la heurística devolvía
 * NOVA 4 en cuanto veía un aditivo "cosmético", de modo que un producto sin
 * datos acababa perdiendo puntos por una suposición nuestra. Ahora, si no
 * hay grupo NOVA, el bloque entero se excluye del cálculo (ver
 * `buildProcessingBlock` en `calculator.ts`) y el 15 % que le corresponde se
 * reparte entre aditivos y nutrición.
 *
 * La regla del proyecto: un dato que no tenemos nunca cuenta como un dato
 * malo.
 */
