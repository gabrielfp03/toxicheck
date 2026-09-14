import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const SITE = "https://toxicheck.net";

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
  openGraph: {
    type: "website",
    siteName: "Toxicheck",
    title: "Toxicheck · Analiza lo que comes",
    description:
      "La nota de 0 a 10 de cualquier alimento, con el porqué desglosado. Gratis e ilimitado.",
    url: SITE,
    locale: "es_ES",
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
        <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-5">
          {children}
        </main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
