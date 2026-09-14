import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Se genera en el build como `/sitemap.xml` estático. Antes daba 404.
 *
 * Sólo las cuatro pantallas con contenido propio. `/product` queda fuera por
 * lo mismo que en el robots.txt: es una plantilla, no una página.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/scan`, lastModified, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/ocr`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/history`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
