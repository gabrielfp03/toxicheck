"use client";

/**
 * Ficha del producto: `/product?code=8410076472151`
 *
 * Por qué un parámetro de consulta y no una ruta dinámica `/product/[barcode]`:
 * una ruta dinámica obliga a Next a marcarla como `ƒ (Dynamic)` y Vercel
 * levanta una función serverless en CADA visita, aunque el componente sea de
 * cliente y no haga nada en el servidor. Con `?code=` la página es HTML
 * estático servido desde la CDN: cero invocaciones, cero coste, y el proyecto
 * puede además exportarse con `output: "export"` a cualquier hosting estático.
 *
 * Todo el trabajo (fetch a Open Food Facts y cálculo de la nota) ocurre en el
 * navegador.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductView } from "@/components/ProductView";
import { useProductScore } from "@/hooks/useProductScore";

function ProductContent() {
  const searchParams = useSearchParams();
  const barcode = searchParams.get("code");
  const { state, retry } = useProductScore(barcode);

  if (!barcode) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <h1 className="text-xl font-bold">Falta el código</h1>
        <p style={{ color: "var(--muted)" }}>
          Esta pantalla necesita un código de barras.
        </p>
        <Link
          href="/scan"
          className="inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white"
        >
          Escanear
        </Link>
      </div>
    );
  }

  if (state.status === "loading" || state.status === "idle") {
    return <Loading />;
  }

  if (state.status === "not-found") {
    return (
      <div className="space-y-4 pt-10 text-center">
        <h1 className="text-xl font-bold">Producto no encontrado</h1>
        <p style={{ color: "var(--muted)" }}>
          El código <strong>{state.barcode}</strong> no está en Open Food Facts.
          Es una base de datos colaborativa: puedes añadirlo tú y ayudar a los
          demás.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={`https://world.openfoodfacts.org/cgi/product.pl?type=add&code=${state.barcode}`}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white"
          >
            Añadir el producto
          </a>
          <Link
            href="/ocr"
            className="rounded-xl border px-6 py-3 font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Analizar la etiqueta con la cámara
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4 pt-10 text-center">
        <h1 className="text-xl font-bold">No hemos podido cargarlo</h1>
        <p style={{ color: "var(--muted)" }}>{state.message}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return <ProductView product={state.product} result={state.result} />;
}

function Loading() {
  return (
    <div className="space-y-4 pt-10 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-brand-600" />
      <p style={{ color: "var(--muted)" }}>Consultando Open Food Facts…</p>
    </div>
  );
}

export default function ProductPage() {
  // `useSearchParams` necesita un límite de Suspense para poder prerenderizar
  // la página como estática.
  return (
    <Suspense fallback={<Loading />}>
      <ProductContent />
    </Suspense>
  );
}
