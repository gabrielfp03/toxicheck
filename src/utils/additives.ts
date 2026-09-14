/**
 * Capa de acceso al diccionario local de aditivos.
 *
 * El JSON se importa estáticamente: Next lo mete en el bundle del cliente y
 * a partir de ahí las búsquedas son O(1) en memoria, sin red y sin servidor.
 * Es la pieza que hace posible el "coste cero" del proyecto.
 */

import raw from "@/data/additives.json";
import type { Additive, AdditivesDatabase, RiskLevel } from "@/types/score";

export const ADDITIVES_DB = raw as unknown as AdditivesDatabase;

/** Orden de gravedad, de menos a más. Útil para ordenar y comparar. */
export const RISK_ORDER: readonly RiskLevel[] = ["none", "low", "moderate", "high"];

/** Etiquetas en castellano para la UI. */
export const RISK_LABEL: Record<RiskLevel, string> = {
  none: "Sin riesgo",
  low: "Riesgo bajo",
  moderate: "Riesgo moderado",
  high: "Riesgo alto",
};

/**
 * Normaliza cualquier forma de escribir un código E a la forma canónica
 * `E` + dígitos + sufijo en minúscula.
 *
 * Acepta: `"en:e330"`, `"E 330"`, `"e330"`, `"330"`, `"E472E"`, `"E160(a)"`.
 * Devuelve `null` si la cadena no parece un número E.
 *
 * @example
 * normalizeAdditiveCode("en:e472e") // → "E472e"
 * normalizeAdditiveCode("E 150 d")  // → "E150d"
 * normalizeAdditiveCode("agua")     // → null
 */
export function normalizeAdditiveCode(input: string): string | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]{2}:/, "") // quita el prefijo de idioma de OFF ("en:")
    .replace(/[\s.\-_()]/g, ""); // quita espacios, guiones y paréntesis

  const match = /^e?(\d{3,4})([a-z]{0,3})$/.exec(cleaned);
  if (!match) return null;

  const [, digits, suffix = ""] = match;
  return `E${digits}${suffix}`;
}

/** Busca un aditivo en el diccionario. `null` si no está catalogado. */
export function findAdditive(code: string): Additive | null {
  const normalized = normalizeAdditiveCode(code);
  if (!normalized) return null;

  const direct = ADDITIVES_DB.additives[normalized];
  if (direct) return direct;

  // Fallback: "E472e" no está pero sí "E472" → usamos la familia.
  const family = /^(E\d{3,4})[a-z]+$/.exec(normalized);
  if (family?.[1]) {
    const parent = ADDITIVES_DB.additives[family[1]];
    if (parent) return parent;
  }

  return null;
}

/** Un aditivo presente en un producto: catalogado o no. */
export interface ResolvedAdditive {
  /** Código tal y como lo mostramos. */
  code: string;
  /** Ficha del diccionario, o `null` si es desconocido para nosotros. */
  additive: Additive | null;
  /** Los desconocidos se tratan como `low` (prudencia sin alarmismo). */
  risk: RiskLevel;
  known: boolean;
}

/** Riesgo asignado a un aditivo que no está en el diccionario. */
export const UNKNOWN_ADDITIVE_RISK: RiskLevel = "low";

/**
 * Resuelve la lista de códigos de un producto contra el diccionario,
 * deduplicando y ordenando de mayor a menor riesgo.
 */
export function resolveAdditives(codes: readonly string[]): ResolvedAdditive[] {
  const seen = new Set<string>();
  const out: ResolvedAdditive[] = [];

  for (const rawCode of codes) {
    const normalized = normalizeAdditiveCode(rawCode);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const additive = findAdditive(normalized);
    out.push({
      code: normalized,
      additive,
      risk: additive?.risk ?? UNKNOWN_ADDITIVE_RISK,
      known: additive !== null,
    });
  }

  return out.sort(
    (a, b) => RISK_ORDER.indexOf(b.risk) - RISK_ORDER.indexOf(a.risk),
  );
}

/**
 * Extrae códigos E de texto libre (lista de ingredientes de la etiqueta).
 * Es lo que alimenta el modo OCR.
 *
 * @example
 * extractAdditiveCodesFromText("Azúcar, E322, colorante E-150d, sal")
 * // → ["E322", "E150d"]
 */
export function extractAdditiveCodesFromText(text: string): string[] {
  const matches = text.matchAll(/\bE[\s.\-]?(\d{3,4})\s?([a-z]{0,3})\b/gi);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const normalized = normalizeAdditiveCode(`E${m[1]}${m[2] ?? ""}`);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }

  return out;
}
