"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import type { ScoreResult } from "@/types/score";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { explainScore } from "@/utils/calculator";
import { offProductUrl } from "@/lib/openfoodfacts";

export interface ProductViewProps {
  product: Product;
  result: ScoreResult;
}

export function ProductView({ product, result }: ProductViewProps) {
  return (
    <article className="space-y-6">
      <header className="flex items-center gap-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl object-contain"
            style={{ background: "var(--card)" }}
          />
        ) : (
          <div
            className="h-20 w-20 shrink-0 rounded-xl"
            style={{ background: "var(--card)" }}
          />
        )}

        <div className="min-w-0">
          <h1 className="text-lg leading-tight font-bold">{product.name}</h1>
          {product.brand && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {product.brand}
              {product.quantity ? ` · ${product.quantity}` : ""}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-col items-center gap-3 text-center">
        <ScoreGauge result={result} />
        <p className="max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          {explainScore(result)}
        </p>
      </div>

      <ScoreBreakdown result={result} />

      {product.ingredientsText && (
        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h3 className="font-semibold">Ingredientes</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {product.ingredientsText}
          </p>
        </section>
      )}

      <footer className="space-y-3 pb-8 text-center">
        {product.barcode && (
          <a
            href={offProductUrl(product.barcode)}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm underline"
            style={{ color: "var(--muted)" }}
          >
            Ver la ficha original en Open Food Facts
          </a>
        )}
        <div>
          <Link
            href="/scan"
            className="inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white"
          >
            Escanear otro producto
          </Link>
        </div>
      </footer>
    </article>
  );
}
