/**
 * Exportación e importación del historial como fichero JSON.
 *
 * Sirve para dos cosas que hoy no se pueden hacer:
 *
 *   1. **Copia de seguridad.** Safari borra el almacenamiento de las webs que
 *      no se abren en una semana. Sin cuentas, un fichero exportado es la
 *      única red de seguridad real que tiene el usuario.
 *   2. **Mudanza.** Pasar el historial a otro móvil o al portátil.
 *
 * Todo lo de este fichero es **puro**: valida, fusiona y devuelve, pero no
 * toca `localStorage` ni el DOM. Así se puede testear sin simular un
 * navegador, y la parte que sí toca el almacenamiento vive en `storage.ts`.
 *
 * Nota de seguridad: el fichero que importa el usuario es **contenido no
 * confiable**. Puede venir de cualquier sitio y estar manipulado. Por eso no
 * se confía en su forma, se valida campo por campo y se descarta lo que no
 * encaje, en lugar de aceptarlo y esperar que la interfaz aguante.
 */

import type { HistoryEntry } from "@/lib/storage";

/** Sube este número si cambia la forma del fichero. */
export const HISTORY_EXPORT_VERSION = 1;

export interface HistoryExport {
  app: "toxicheck";
  exportVersion: number;
  exportedAt: string;
  entries: HistoryEntry[];
}

/** Resultado de una importación, para poder contárselo al usuario. */
export interface ImportOutcome {
  /** Productos que no estaban y se han añadido. */
  added: number;
  /** Productos que ya estaban y tenían un escaneo más reciente en el fichero. */
  updated: number;
  /** Entradas descartadas por estar mal formadas. */
  invalid: number;
  /** Total del historial después de fusionar. */
  total: number;
}

export class InvalidHistoryFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHistoryFileError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Validación                                                                */
/* -------------------------------------------------------------------------- */

const COLORS = new Set(["green", "orange", "red"]);
const HEX = /^#[0-9a-f]{6}$/i;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): v is string => typeof v === "string";

/**
 * Sólo aceptamos URLs `https:` para la imagen.
 *
 * La foto del historial se pinta con `<img src>`, así que un fichero
 * manipulado podría colar aquí una URL que filtre la visita a un tercero, o
 * peor. Restringirlo a https corta el problema de raíz y no quita nada: las
 * imágenes de Open Food Facts ya vienen así.
 */
function safeImageUrl(value: unknown): string | null {
  if (!str(value) || value === "") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** Devuelve la entrada saneada, o `null` si no hay forma de salvarla. */
export function sanitizeEntry(raw: unknown): HistoryEntry | null {
  if (!isObject(raw)) return null;

  const { barcode, name, brand, imageUrl, score, color, label, hex } = raw;

  if (!str(barcode) || !/^\d{6,14}$/.test(barcode)) return null;
  if (!str(name) || name.trim() === "") return null;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score < 0 || score > 10) return null;
  if (!str(color) || !COLORS.has(color)) return null;
  if (!str(hex) || !HEX.test(hex)) return null;

  const scannedAt =
    typeof raw.scannedAt === "number" && Number.isFinite(raw.scannedAt)
      ? raw.scannedAt
      : 0;

  return {
    barcode,
    // Recortamos por si el fichero trae un nombre absurdamente largo.
    name: name.trim().slice(0, 200),
    brand: str(brand) && brand.trim() !== "" ? brand.trim().slice(0, 120) : null,
    imageUrl: safeImageUrl(imageUrl),
    score: Math.round(score * 10) / 10,
    color: color as HistoryEntry["color"],
    label: str(label) ? (label as HistoryEntry["label"]) : "Mediocre",
    hex,
    algorithmVersion: str(raw.algorithmVersion) ? raw.algorithmVersion : "desconocida",
    scannedAt,
  };
}

/**
 * Convierte el texto de un fichero en una lista de entradas válidas.
 *
 * @throws {InvalidHistoryFileError} si no es JSON, o si no parece un export
 *   de Toxicheck, o si no contiene ninguna entrada aprovechable.
 */
export function parseHistoryFile(text: string): {
  entries: HistoryEntry[];
  invalid: number;
} {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidHistoryFileError(
      "El fichero no es un JSON válido. ¿Seguro que es el que exportaste?",
    );
  }

  // Aceptamos tanto el envoltorio completo como una lista pelada, por si
  // alguien edita el fichero a mano y se queda sólo con el array.
  const rawEntries = Array.isArray(data)
    ? data
    : isObject(data) && Array.isArray(data.entries)
      ? data.entries
      : null;

  if (rawEntries === null) {
    throw new InvalidHistoryFileError(
      "El fichero no tiene el formato de un historial de Toxicheck.",
    );
  }

  const entries: HistoryEntry[] = [];
  let invalid = 0;

  for (const raw of rawEntries) {
    const entry = sanitizeEntry(raw);
    if (entry) entries.push(entry);
    else invalid += 1;
  }

  if (entries.length === 0) {
    throw new InvalidHistoryFileError(
      "El fichero no contiene ningún producto que se pueda importar.",
    );
  }

  return { entries, invalid };
}

/* -------------------------------------------------------------------------- */
/*  Fusión                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fusiona el historial actual con el importado.
 *
 * Regla: un producto es el mismo si coincide el código de barras. Ante un
 * duplicado gana **el escaneo más reciente**, porque su nota se calculó con
 * una versión del algoritmo igual o más nueva.
 *
 * Nunca borra nada de lo que ya había: importar sólo puede añadir.
 */
export function mergeHistories(
  current: readonly HistoryEntry[],
  incoming: readonly HistoryEntry[],
  maxEntries: number,
): { merged: HistoryEntry[]; added: number; updated: number } {
  const byBarcode = new Map<string, HistoryEntry>();
  for (const entry of current) byBarcode.set(entry.barcode, entry);

  let added = 0;
  let updated = 0;

  for (const entry of incoming) {
    const existing = byBarcode.get(entry.barcode);

    if (!existing) {
      byBarcode.set(entry.barcode, entry);
      added += 1;
      continue;
    }

    if (entry.scannedAt > existing.scannedAt) {
      byBarcode.set(entry.barcode, entry);
      updated += 1;
    }
  }

  const merged = [...byBarcode.values()]
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, maxEntries);

  return { merged, added, updated };
}

/* -------------------------------------------------------------------------- */
/*  Fichero                                                                   */
/* -------------------------------------------------------------------------- */

export function buildExport(entries: readonly HistoryEntry[]): HistoryExport {
  return {
    app: "toxicheck",
    exportVersion: HISTORY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    entries: [...entries],
  };
}

/** `toxicheck-historial-2026-09-14.json` */
export function exportFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `toxicheck-historial-${iso}.json`;
}
