"use client";

/**
 * Modo OCR (fase 2): fotografiar la lista de ingredientes de un producto que
 * no está en Open Food Facts o que no tiene código de barras.
 *
 * Tesseract.js corre en un Web Worker dentro del navegador: los ~12 MB del
 * modelo de idioma se descargan UNA vez desde el CDN y quedan en caché. El
 * servidor sigue sin ejecutar nada.
 *
 * Importante: por diseño este modo sólo puede alimentar el bloque de
 * ADITIVOS. Una etiqueta fotografiada no da nutrientes fiables ni grupo NOVA,
 * así que el resultado se marca siempre con confianza reducida.
 */

import { useCallback, useRef, useState } from "react";
import { extractAdditiveCodesFromText } from "@/utils/additives";

export interface OcrResult {
  /** Texto completo reconocido. */
  text: string;
  /** Códigos E normalizados encontrados en ese texto. */
  codes: string[];
}

export interface OcrScannerProps {
  onResult: (result: OcrResult) => void;
}

type Phase = "idle" | "loading" | "recognizing" | "done" | "error";

export function OcrScanner({ onResult }: OcrScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPhase("loading");
      setProgress(0);

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      try {
        // Carga diferida: Tesseract no entra en el bundle inicial.
        const { createWorker } = await import("tesseract.js");

        const worker = await createWorker("spa", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setPhase("recognizing");
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        const { data } = await worker.recognize(file);
        await worker.terminate();

        const text = data.text ?? "";
        const codes = extractAdditiveCodesFromText(text);

        setPhase("done");
        onResult({ text, codes });
      } catch {
        setPhase("error");
        setError("No se ha podido leer la etiqueta. Prueba con más luz y sin reflejos.");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [onResult],
  );

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={phase === "loading" || phase === "recognizing"}
        className="w-full rounded-xl bg-brand-600 px-5 py-4 font-semibold text-white disabled:opacity-50"
      >
        {phase === "idle" || phase === "done" || phase === "error"
          ? "Fotografiar los ingredientes"
          : "Procesando…"}
      </button>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Etiqueta fotografiada"
          className="w-full rounded-xl border"
          style={{ borderColor: "var(--border)" }}
        />
      )}

      {phase === "loading" && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Cargando el modelo de reconocimiento (sólo la primera vez)…
        </p>
      )}

      {phase === "recognizing" && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand-500 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Leyendo la etiqueta… {progress}%
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
