"use client";

/**
 * Selector de tema: claro, oscuro o el del sistema.
 *
 * Se renderiza como un grupo de tres botones de radio accesibles en lugar de
 * un interruptor de dos estados, porque "seguir al sistema" es una opción de
 * pleno derecho y con un toggle binario no hay forma de volver a ella.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  THEMES,
  THEME_LABEL,
  getThemeServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeToTheme,
  type Theme,
} from "@/lib/theme";

function Icon({ theme }: { theme: Theme }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  /*
   * El tema vive fuera de React (localStorage + atributo del DOM), así que se
   * lee con `useSyncExternalStore`: sin `useEffect`, sin banderas de montaje y
   * con la hidratación resuelta por React. El HTML del servidor usa "system";
   * los colores correctos ya los ha pintado el script del `<head>`.
   */
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot,
  );

  const choose = useCallback((next: Theme) => {
    const root = document.documentElement;

    // Sólo animamos el cambio manual, nunca la carga inicial.
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 250);

    setTheme(next);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${
        compact ? "bg-white/15" : "bg-surface-2 border border-line"
      }`}
    >
      {THEMES.map((option) => {
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={THEME_LABEL[option]}
            title={THEME_LABEL[option]}
            onClick={() => choose(option)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              active
                ? compact
                  ? "bg-white/90 text-emerald-800"
                  : "bg-brand text-on-brand"
                : compact
                  ? "text-white/80"
                  : "text-muted"
            }`}
          >
            <Icon theme={option} />
          </button>
        );
      })}
    </div>
  );
}
