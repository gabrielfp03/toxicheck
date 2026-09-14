"use client";

import { useCallback, useState } from "react";
import { OcrScanner, type OcrResult } from "@/components/OcrScanner";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import type { Product } from "@/types/product";
import type { ScoreResult } from "@/types/score";
import { calculateScore } from "@/utils/calculator";

/** Construye un `Product` sintético a partir de lo que ha leído el OCR. */
function productFromOcr(ocr: OcrResult): Product {
  return {
    barcode: null,
    name: "Producto fotografiado",
    brand: null,
    quantity: null,
    imageUrl: null,
    ingredientsText: ocr.text,
    additiveCodes: ocr.codes,
    // Una foto de la etiqueta no permite clasificar el grado de procesamiento.
    novaGroup: null,
    nutriScoreGrade: null,
    // El OCR no da nutrientes: el bloque nutricional quedará excluido y los
    // pesos se renormalizarán solos.
    nutrients: {
      energyKj: null,
      sugars: null,
      saturatedFat: null,
      sodiumMg: null,
      fiber: null,
      proteins: null,
      fruitsVegetablesNuts: null,
    },
    isBeverage: false,
    isWater: false,
    source: "ocr",
    fetchedAt: Date.now(),
  };
}

export default function OcrPage() {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  const handleResult = useCallback((ocr: OcrResult) => {
    setCodes(ocr.codes);
    setResult(calculateScore(productFromOcr(ocr)));
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="text-xl font-bold">Analizar etiqueta</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Para productos sin código de barras o que no están en Open Food Facts.
          Fotografía la lista de ingredientes: detectamos los números E y
          puntuamos sólo el bloque de aditivos.
        </p>
      </header>

      <OcrScanner onResult={handleResult} />

      {result && (
        <div className="space-y-5">
          <div className="flex flex-col items-center">
            <ScoreGauge result={result} />
          </div>

          <p
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            {codes.length === 0
              ? "No hemos encontrado ningún número E en la foto. Puede que la etiqueta los escriba por su nombre o que la imagen no sea legible."
              : `Detectados ${codes.length} aditivo(s): ${codes.join(", ")}.`}
          </p>

          <ScoreBreakdown result={result} />
        </div>
      )}
    </div>
  );
}
