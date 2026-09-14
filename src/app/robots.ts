import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Se genera en el build como `/robots.txt` estático. Antes daba 404.
 *
 * `/product` se excluye del rastreo a propósito: sin el parámetro `?code=`
 * no muestra nada, y con él son millones de URLs con el mismo HTML. Dejar que
 * un buscador las recorra no aporta nada y ensucia el índice.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/product"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
