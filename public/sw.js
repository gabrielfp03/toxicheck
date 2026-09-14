/* eslint-disable no-undef */
/**
 * Service worker de Toxify.
 *
 * Escrito a mano en lugar de usar next-pwa / Serwist: son ~40 líneas, no
 * añaden dependencias y así se ve exactamente qué se cachea. Tres estrategias:
 *
 *  1. App shell → cache-first. La app abre offline.
 *  2. Navegaciones → network-first con fallback al shell (SPA offline).
 *  3. API de Open Food Facts → stale-while-revalidate: si ya escaneaste ese
 *     producto, la ficha aparece al instante y se refresca en segundo plano.
 */

const VERSION = "toxify-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;

const SHELL = ["/", "/scan", "/ocr", "/history", "/product", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // --- Open Food Facts: stale-while-revalidate ---
  if (url.hostname.endsWith("openfoodfacts.org")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // --- Navegaciones: network-first ---
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(request)) ??
          (await caches.match("/")) ??
          Response.error(),
      ),
    );
    return;
  }

  // --- Estáticos: cache-first ---
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith("/_next/")) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
