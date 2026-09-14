import type { MetadataRoute } from "next";

/**
 * Manifiesto de la PWA generado por Next en `/manifest.webmanifest`.
 * Tenerlo en TypeScript evita que se desincronice de los metadatos del layout.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toxicheck · Analiza lo que comes",
    short_name: "Toxicheck",
    description:
      "Nota de 0 a 10 de cualquier alimento según sus aditivos, su calidad nutricional y su nivel de procesamiento.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "es",
    categories: ["food", "health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Escanear", url: "/scan" },
      { name: "Historial", url: "/history" },
    ],
  };
}
