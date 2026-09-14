"use client";

/**
 * Barra superior fija con la marca y el selector de tema.
 *
 * Va en color de marca y ocupa todo el ancho, como en las apps de escaneo al
 * uso: da a la PWA instalada un remate propio donde el navegador ya no pinta
 * su barra de direcciones.
 */

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-20 shadow-sm">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <LeafMark />
          Toxicheck
        </Link>

        <ThemeToggle compact />
      </div>
    </header>
  );
}

/** Marca gráfica propia: una hoja dentro del marco de un escáner. */
function LeafMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8V5.2A2.2 2.2 0 0 1 5.2 3H8M16 3h2.8A2.2 2.2 0 0 1 21 5.2V8M21 16v2.8a2.2 2.2 0 0 1-2.2 2.2H16M8 21H5.2A2.2 2.2 0 0 1 3 18.8V16" />
      <path d="M8.5 15.5c0-3 2.4-5.2 6.5-5.5-.3 4.1-2.5 6.5-5.5 6.5" />
      <path d="M8 17c1.2-1.6 2.6-2.8 4.2-3.6" />
    </svg>
  );
}
