"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/scan", label: "Escanear" },
  { href: "/ocr", label: "Etiqueta" },
  { href: "/history", label: "Historial" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 grid grid-cols-4 border-t backdrop-blur"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
      aria-label="Navegación principal"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`py-3 text-center text-xs font-medium ${
              active ? "text-brand-600" : ""
            }`}
            style={active ? undefined : { color: "var(--muted)" }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
