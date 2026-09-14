"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import type { ScoreResult } from "@/types/score";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { ExternalIcon, ScanIcon } from "@/components/icons";
import { explainScore } from "@/utils/calculator";
import { offProductUrl } from "@/lib/openfoodfacts";

export interface ProductViewProps {
  product: Product;
  result: ScoreResult;
}

export function ProductView({ product, result }: ProductViewProps) {
  return (
    <article className="space-y-5 pb-10">
      <header className="card flex items-center gap-4 p-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="product-img h-20 w-20 shrink-0 rounded-xl"
          />
        ) : (
          <div className="product-img h-20 w-20 shrink-0 rounded-xl" />
        )}

        <div className="min-w-0">
          <h1 className="text-lg leading-tight font-bold text-balance">
            {product.name}
          </h1>
          {(product.brand || product.quantity) && (
            <p className="muted mt-0.5 text-sm">
              {[product.brand, product.quantity].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-col items-center gap-3 text-center">
        <ScoreGauge result={result} />
        <p className="muted max-w-sm text-sm text-balance">
          {explainScore(result)}
        </p>
      </div>

      <ScoreBreakdown result={result} />

      {product.ingredientsText && (
        <section className="card p-4">
          <h3 className="font-semibold">Ingredientes</h3>
          <p className="muted mt-2 text-sm leading-relaxed">
            {product.ingredientsText}
          </p>
        </section>
      )}

      <footer className="space-y-4 text-center">
        <Link
          href="/scan"
          className="btn-primary flex items-center justify-center gap-2.5 px-6 py-4"
        >
          <ScanIcon size={20} strokeWidth={2} />
          Escanear otro producto
        </Link>

        {product.barcode && (
          <a
            href={offProductUrl(product.barcode)}
            target="_blank"
            rel="noreferrer noopener"
            className="muted inline-flex items-center gap-1.5 text-sm underline"
          >
            Ver la ficha original en Open Food Facts
            <ExternalIcon size={14} />
          </a>
        )}
      </footer>
    </article>
  );
}
