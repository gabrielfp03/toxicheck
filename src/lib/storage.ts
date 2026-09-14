/**
 * Historial local.
 *
 * Todo se guarda en `localStorage` del propio usuario: no hay cuentas, no hay
 * base de datos, no hay coste y no hay datos personales viajando a ningún
 * sitio. Es la contrapartida coherente con la filosofía del proyecto.
 *
 * Todas las funciones son seguras en SSR (devuelven valores vacíos si no hay
 * `window`) y toleran un `localStorage` lleno o bloqueado.
 */

import type { Product } from "@/types/product";
import type { ScoreResult } from "@/types/score";

const KEY = "toxicheck:history:v1";

/** Clave de cuando la app se llamaba Toxify. Se migra una sola vez. */
const LEGACY_KEY = "toxify:history:v1";

const MAX_ENTRIES = 100;

export interface HistoryEntry {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  score: number;
  color: ScoreResult["color"];
  label: ScoreResult["label"];
  hex: string;
  algorithmVersion: string;
  scannedAt: number;
}

const isBrowser = () => typeof window !== "undefined";

function read(): HistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    /*
     * Migración del rebautizo Toxify → Toxicheck: si todavía existe el
     * historial con la clave antigua y aún no hay nada con la nueva, lo
     * movemos. Así nadie pierde sus escaneos por un cambio de nombre.
     */
    let raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        window.localStorage.setItem(KEY, legacy);
        window.localStorage.removeItem(LEGACY_KEY);
        raw = legacy;
      }
    }

    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Cuota agotada o modo privado: el historial es un extra, no rompemos nada.
  }
}

/* -------------------------------------------------------------------------- */
/*  Store observable                                                          */
/* -------------------------------------------------------------------------- */

/*
 * `useSyncExternalStore` exige que `getSnapshot` devuelva SIEMPRE la misma
 * referencia mientras los datos no cambien; si no, React entra en un bucle de
 * renders. Por eso cacheamos el array y sólo lo sustituimos al escribir.
 */
const EMPTY: HistoryEntry[] = [];
let snapshot: HistoryEntry[] | null = null;
const listeners = new Set<() => void>();

function commit(entries: HistoryEntry[]): void {
  snapshot = entries;
  listeners.forEach((l) => l());
}

/** Suscripción para `useSyncExternalStore`. */
export function subscribeToHistory(listener: () => void): () => void {
  listeners.add(listener);

  // Otra pestaña puede haber escaneado algo: `storage` nos avisa.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      listener();
    }
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

/** Historial completo, del más reciente al más antiguo. Referencia estable. */
export function getHistory(): HistoryEntry[] {
  if (!isBrowser()) return EMPTY;
  snapshot ??= read();
  return snapshot;
}

/** Snapshot para el render en servidor: siempre vacío. */
export function getHistoryServerSnapshot(): HistoryEntry[] {
  return EMPTY;
}

/**
 * Añade un escaneo al historial. Si el producto ya estaba, lo mueve arriba
 * y actualiza la nota (puede haber cambiado la versión del algoritmo).
 */
export function addToHistory(product: Product, result: ScoreResult): HistoryEntry[] {
  if (!product.barcode) return read();

  const entry: HistoryEntry = {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    imageUrl: product.imageUrl,
    score: result.score,
    color: result.color,
    label: result.label,
    hex: result.hex,
    algorithmVersion: result.algorithmVersion,
    scannedAt: Date.now(),
  };

  const next = [entry, ...read().filter((e) => e.barcode !== entry.barcode)].slice(
    0,
    MAX_ENTRIES,
  );

  write(next);
  commit(next);
  return next;
}

export function removeFromHistory(barcode: string): HistoryEntry[] {
  const next = read().filter((e) => e.barcode !== barcode);
  write(next);
  commit(next);
  return next;
}

export function clearHistory(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignorado */
  }
  commit(EMPTY);
}

/** Estadísticas rápidas para la pantalla de historial. */
export function getHistoryStats(entries: HistoryEntry[] = read()) {
  if (entries.length === 0) {
    return { total: 0, average: 0, green: 0, orange: 0, red: 0 };
  }

  const total = entries.length;
  const sum = entries.reduce((acc, e) => acc + e.score, 0);

  return {
    total,
    average: Math.round((sum / total) * 10) / 10,
    green: entries.filter((e) => e.color === "green").length,
    orange: entries.filter((e) => e.color === "orange").length,
    red: entries.filter((e) => e.color === "red").length,
  };
}
