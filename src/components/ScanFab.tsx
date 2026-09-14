"use client";

/**
 * Botón flotante de escaneo.
 *
 * Escanear es la acción que el usuario repite decenas de veces; merece estar
 * siempre a un pulgar de distancia, no escondida en una pestaña. Se coloca
 * justo por encima de la barra de pestañas y respeta el área segura del
 * iPhone.
 */

import Link from "next/link";
import { ScanIcon } from "@/components/icons";

export function ScanFab() {
  return (
    <Link
      href="/scan"
      aria-label="Escanear un código de barras"
      className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand"
      style={{
        bottom: "calc(4.75rem + env(safe-area-inset-bottom))",
        boxShadow: "var(--shadow-fab)",
      }}
    >
      <ScanIcon size={26} strokeWidth={2} />
    </Link>
  );
}
