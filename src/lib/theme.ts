/**
 * Lógica del tema, sin React.
 *
 * Se separa del componente porque el mismo código tiene que poder ejecutarse
 * en dos sitios: en el script bloqueante que corre ANTES del primer pintado
 * (para que no haya destello blanco al abrir en modo oscuro) y en el selector
 * de la interfaz.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "toxicheck:theme";

export const THEMES: readonly Theme[] = ["light", "dark", "system"];

export const THEME_LABEL: Record<Theme, string> = {
  light: "Claro",
  dark: "Oscuro",
  system: "Sistema",
};

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Lee la preferencia guardada. `"system"` si no hay nada o falla el acceso. */
export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

/**
 * Aplica el tema al elemento raíz.
 *
 * `"system"` BORRA el atributo en lugar de escribir un valor: así el CSS cae
 * en la rama de `prefers-color-scheme` y el tema sigue al sistema operativo
 * aunque el usuario lo cambie con la app abierta.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/* -------------------------------------------------------------------------- */
/*  Store observable                                                          */
/* -------------------------------------------------------------------------- */

/*
 * El tema es estado externo (vive en localStorage y en el atributo del DOM),
 * así que se lee con `useSyncExternalStore` en lugar de con un `useEffect`
 * que haga `setState`. React se encarga de la hidratación y no hay render en
 * cascada. Cacheamos el valor para no tocar localStorage en cada render.
 */
let cached: Theme | null = null;
const listeners = new Set<() => void>();

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);

  // Otra pestaña puede haber cambiado el tema.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      cached = null;
      applyTheme(getThemeSnapshot());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot para el cliente. Devuelve una cadena, así que comparar es trivial. */
export function getThemeSnapshot(): Theme {
  cached ??= readStoredTheme();
  return cached;
}

/**
 * Snapshot para el servidor. Siempre `"system"`: en el HTML estático no
 * sabemos qué eligió el usuario, y el script del `<head>` ya se ha ocupado de
 * pintar los colores correctos antes de que React hidrate.
 */
export function getThemeServerSnapshot(): Theme {
  return "system";
}

/** Guarda la preferencia, la aplica al DOM y avisa a los suscriptores. */
export function setTheme(theme: Theme): void {
  cached = theme;
  applyTheme(theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Modo privado o cuota llena: el tema no se recuerda, pero sí se aplica.
  }

  listeners.forEach((l) => l());
}

/**
 * Script que se inyecta en el `<head>` y se ejecuta de forma síncrona antes
 * de pintar nada. Sin esto, abrir la app en modo oscuro produce un destello
 * blanco de un fotograma que se ve muchísimo en móvil.
 *
 * Va como cadena porque tiene que viajar dentro de un `<script>` en línea.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`.trim();
