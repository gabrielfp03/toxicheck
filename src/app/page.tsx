"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidBarcode } from "@/lib/openfoodfacts";

export default function HomePage() {
  const router = useRouter();
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();

    if (!isValidBarcode(code)) {
      setError("Ese código de barras no parece válido. Revisa los dígitos.");
      return;
    }
    router.push(`/product?code=${code}`);
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="pt-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Toxify</h1>
        <p className="mt-2 text-balance" style={{ color: "var(--muted)" }}>
          Escanea un alimento y descubre qué lleva de verdad. Nota de 0 a 10,
          con el porqué desglosado. Gratis, ilimitado y sin cuentas.
        </p>
      </header>

      <div className="grid gap-3">
        <Link
          href="/scan"
          className="rounded-2xl bg-brand-600 px-6 py-5 text-center text-lg font-semibold text-white"
        >
          Escanear código de barras
        </Link>
        <Link
          href="/ocr"
          className="rounded-2xl border px-6 py-4 text-center font-medium"
          style={{ borderColor: "var(--border)" }}
        >
          Fotografiar la lista de ingredientes
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="barcode" className="text-sm font-medium">
          ¿Prefieres escribirlo?
        </label>
        <div className="flex gap-2">
          <input
            id="barcode"
            inputMode="numeric"
            autoComplete="off"
            placeholder="8410076472151"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            className="flex-1 rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          />
          <button
            type="submit"
            className="rounded-xl border px-4 font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Ir
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Cómo se calcula la nota</h2>
        <ul className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
          <li>
            <strong>40 % · Aditivos.</strong> Cada número E resta según su nivel
            de riesgo, con las clasificaciones de la EFSA y la IARC.
          </li>
          <li>
            <strong>40 % · Nutrición.</strong> Nutri-Score recalculado: azúcares,
            grasas saturadas, sodio y energía frente a fibra, proteína y fruta.
          </li>
          <li>
            <strong>20 % · Procesamiento.</strong> Escala NOVA: un ultraprocesado
            pierde 2 puntos enteros.
          </li>
        </ul>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Datos de Open Food Facts (ODbL). Todo el cálculo ocurre en tu móvil:
          no enviamos nada a ningún servidor. Esto no es consejo médico.
        </p>
      </section>
    </div>
  );
}
