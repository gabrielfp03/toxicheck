import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL as SITE } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Toxicheck · Analiza lo que comes",
    template: "%s · Toxicheck",
  },
  description:
    "Escanea cualquier alimento y descubre su nota de 0 a 10 según sus aditivos, su calidad nutricional y su nivel de procesamiento. Gratis, ilimitado y sin cuentas.",
  applicationName: "Toxicheck",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Toxicheck",
  },
  formatDetection: { telephone: false },

  /*
   * `canonical: "./"` se resuelve contra la ruta actual, así que cada página
   * declara la suya sin tener que repetir metadatos en cada fichero (que
   * además no podrían: las páginas son componentes de cliente).
   */
  alternates: { canonical: "./" },

  openGraph: {
    type: "website",
    siteName: "Toxicheck",
    title: "Toxicheck · Analiza lo que comes",
    description:
      "La nota de 0 a 10 de cualquier alimento, con el porqué desglosado. Gratis e ilimitado.",
    url: SITE,
    locale: "es_ES",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Toxicheck · Analiza lo que comes",
      },
    ],
  },

  // Sin esto, compartir el enlace en WhatsApp o X mostraba texto sin imagen.
  twitter: {
    card: "summary_large_image",
    title: "Toxicheck · Analiza lo que comes",
    description:
      "La nota de 0 a 10 de cualquier alimento, con el porqué desglosado.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2e25" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          Se ejecuta antes del primer pintado: sin esto, abrir la app con el
          tema oscuro guardado produce un fotograma en blanco muy visible.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <AppHeader />
        {/*
          El pie va dentro de `main` y no después: así queda por encima de la
          barra de pestañas, que es fija, y se desplaza con el contenido en
          lugar de robarle sitio a la pantalla.
        */}
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-5">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
