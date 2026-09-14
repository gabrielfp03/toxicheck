"use client";

import { useSyncExternalStore } from "react";
import {
  getHistory,
  getHistoryServerSnapshot,
  subscribeToHistory,
  type HistoryEntry,
} from "@/lib/storage";

/**
 * Historial reactivo.
 *
 * `useSyncExternalStore` es la forma correcta de leer un almacén externo como
 * `localStorage`: React se encarga de la hidratación (usa el snapshot vacío en
 * el servidor) y de re-renderizar cuando cambia, sin `useEffect` ni banderas
 * de `mounted`. Además se sincroniza entre pestañas gracias al evento
 * `storage`.
 */
export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(
    subscribeToHistory,
    getHistory,
    getHistoryServerSnapshot,
  );
}
