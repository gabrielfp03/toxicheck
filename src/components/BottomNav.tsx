"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HistoryIcon,
  HomeIcon,
  LabelIcon,
  ScanIcon,
  type IconProps,
} from "@/components/icons";

const ITEMS: readonly {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
}[] = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/scan", label: "Escanear", Icon: ScanIcon },
  { href: "/ocr", label: "Etiqueta", Icon: LabelIcon },
  { href: "/history", label: "Historial", Icon: HistoryIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="tabbar sticky bottom-0 z-20"
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid w-full max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href) ||
                // La ficha de producto pertenece al flujo de escaneo.
                (href === "/scan" && pathname.startsWith("/product"));

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-brand" : "text-muted"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.1 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
