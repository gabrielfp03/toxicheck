"use client";

/**
 * Hook que une las tres piezas: descarga el producto, lo puntúa y lo guarda
 * en el historial. Toda la lógica de estado de la pantalla de resultado vive
 * aquí para que el componente sea sólo presentación.
 *
 * Detalle de diseño: `loading` no se guarda en el estado, se DERIVA ("no hay
 * resultado todavía para este código de barras"). Así el efecto no hace
 * ningún `setState` síncrono y evitamos renders en cascada.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/types/product";
import type { ScoreResult } from "@/types/score";
import { ProductNotFoundError, fetchProductByBarcode } from "@/lib/openfoodfacts";
import { addToHistory } from "@/lib/storage";
import { calculateScore } from "@/utils/calculator";

export type ProductState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not-found"; barcode: string }
  | { status: "error"; message: string }
  | { status: "ready"; product: Product; result: ScoreResult };

/** Resultado terminal ya resuelto, atado al código que lo originó. */
type Resolved = {
  barcode: string;
  state: Extract<ProductState, { status: "not-found" | "error" | "ready" }>;
};

const IDLE: ProductState = { status: "idle" };
const LOADING: ProductState = { status: "loading" };

export function useProductScore(barcode: string | null) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const state: ProductState = !barcode
    ? IDLE
    : resolved?.barcode === barcode
      ? resolved.state
      : LOADING;

  const load = useCallback(async (code: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const product = await fetchProductByBarcode(code, {
        signal: controller.signal,
      });
      const result = calculateScore(product);

      addToHistory(product, result);
      setResolved({ barcode: code, state: { status: "ready", product, result } });
    } catch (error) {
      if (controller.signal.aborted) return;

      if (error instanceof ProductNotFoundError) {
        setResolved({
          barcode: code,
          state: { status: "not-found", barcode: code },
        });
        return;
      }

      setResolved({
        barcode: code,
        state: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Ha ocurrido un error inesperado.",
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!barcode) return;
    /*
     * La regla no distingue entre un `setState` síncrono y uno que ocurre
     * después de un `await`. Aquí `load` sólo escribe estado cuando la
     * petición ya ha terminado, que es el patrón canónico de sincronización
     * con un sistema externo (la API de Open Food Facts). No hay render en
     * cascada: el estado "loading" se deriva, no se escribe.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(barcode);
    return () => abortRef.current?.abort();
  }, [barcode, load]);

  const retry = useCallback(() => {
    if (!barcode) return;
    setResolved(null); // vuelve a "loading" de forma derivada
    void load(barcode);
  }, [barcode, load]);

  return { state, retry };
}
