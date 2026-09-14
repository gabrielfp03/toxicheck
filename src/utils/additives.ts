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

/** Familia de un código: `"E322i"` → `"E322"`. `null` si no tiene sufijo. */
function familyOf(code: string): string | null {
  return /^(E\d{3,4})[a-z]+$/.exec(code)?.[1] ?? null;
}

/**
 * Resuelve la lista de códigos de un producto contra el diccionario,
 * deduplicando y ordenando de mayor a menor riesgo.
 *
 * --------------------------------------------------------------------------
 *  El problema que resuelve la deduplicación
 * --------------------------------------------------------------------------
 *
 * Open Food Facts devuelve a la vez la familia y la subvariante. La Nutella,
 * por ejemplo, trae `["en:e322", "en:e322i"]`: son **el mismo emulgente**,
 * etiquetado dos veces con distinto nivel de detalle.
 *
 * Tratarlos como dos aditivos distintos tenía dos consecuencias, y la segunda
 * es un error de cálculo, no un problema estético:
 *
 *   1. La ficha listaba dos veces la misma entrada del diccionario.
 *   2. **La penalización se aplicaba dos veces.** Un producto con `E450` y
 *      `E450i` (difosfatos, riesgo moderado) perdía −3 en vez de −1,5, y cada
 *      duplicado engordaba además el contador del efecto cóctel.
 *
 * La regla, en dos pasos:
 *
 *   - Si una familia tiene alguna subvariante **catalogada aparte**, la
 *     familia desnuda sobra: `E150` + `E150d` → nos quedamos con `E150d`.
 *     Esto importa porque las subvariantes no son intercambiables: `E150a`
 *     (caramelo natural) no tiene riesgo y `E150d` (caramelo sulfito amónico)
 *     sí.
 *   - Después se deduplica por la **entrada del diccionario** a la que apunta
 *     cada código, no por el código en sí. `E322` y `E322i` acaban en la misma
 *     ficha, así que cuentan una sola vez.
 */
export function resolveAdditives(codes: readonly string[]): ResolvedAdditive[] {
  /* --- 1. Normalizar y quitar basura ------------------------------------ */
  const normalized: string[] = [];
  const presentes = new Set<string>();

  for (const rawCode of codes) {
    const code = normalizeAdditiveCode(rawCode);
    if (!code || presentes.has(code)) continue;
    presentes.add(code);
    normalized.push(code);
  }

  /* --- 2. Familias que tienen una subvariante catalogada aparte ---------- */
  const familiasConVarianteEspecifica = new Set<string>();
  for (const code of normalized) {
    const family = familyOf(code);
    if (family && ADDITIVES_DB.additives[code]) {
      familiasConVarianteEspecifica.add(family);
    }
  }

  /* --- 3. Resolver deduplicando por ficha -------------------------------- */
  const porFicha = new Set<string>();
  const out: ResolvedAdditive[] = [];

  for (const code of normalized) {
    // La familia desnuda sobra si hay una subvariante más específica.
    if (!familyOf(code) && familiasConVarianteEspecifica.has(code)) continue;

    const additive = findAdditive(code);

    /*
     * Clave de deduplicación: la ficha a la que apunta el código. Si no
     * apunta a ninguna (aditivo desconocido), usamos su familia, y si
     * tampoco la tiene, el propio código.
     */
    const clave = additive?.code ?? familyOf(code) ?? code;
    if (porFicha.has(clave)) continue;
    porFicha.add(clave);

    out.push({
      // Mostramos el código del diccionario cuando lo hay, para que la ficha
      // y la etiqueta coincidan.
      code: additive?.code ?? code,
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
