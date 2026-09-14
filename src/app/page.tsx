"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LabelIcon, ScanIcon } from "@/components/icons";
import { isValidBarcode } from "@/lib/openfoodfacts";
import { WEIGHTS } from "@/utils/calculator";

const pct = (w: number) => Math.round(w * 100);

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
    <div className="space-y-7 pb-10">
      <header className="pt-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Analiza lo que comes
        </h1>
        <p className="muted mx-auto mt-2 max-w-sm text-balance">
          Escanea un alimento y descubre qué lleva de verdad. Nota de 0 a 10 con
          el porqué desglosado. Gratis, ilimitado y sin cuentas.
        </p>
      </header>

      <div className="grid gap-3">
        <Link
          href="/scan"
          className="btn-primary flex items-center justify-center gap-3 px-6 py-5 text-lg"
        >
          <ScanIcon size={24} strokeWidth={2} />
          Escanear código de barras
        </Link>
        <Link
          href="/ocr"
          className="btn-ghost flex items-center justify-center gap-3 px-6 py-4"
        >
          <LabelIcon size={20} />
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
            className="bg-surface-2 border-line flex-1 rounded-xl border px-4 py-3"
          />
          <button type="submit" className="btn-ghost px-5">
            Ir
          </button>
        </div>
        {error && (
          <p className="text-sm" style={{ color: "var(--score-red)" }}>
            {error}
          </p>
        )}
      </form>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Cómo se calcula la nota</h2>

        <ul className="space-y-3 text-sm">
          <Criterion weight={pct(WEIGHTS.additives)} name="Aditivos">
            El apartado con más peso. Cada número E resta según su nivel de
            riesgo, con las clasificaciones de la EFSA y la IARC.
          </Criterion>
          <Criterion weight={pct(WEIGHTS.nutrition)} name="Nutrición">
            Nutri-Score recalculado: azúcares, grasas saturadas, sodio y
            energía frente a fibra, proteína y fruta.
          </Criterion>
          <Criterion weight={pct(WEIGHTS.processing)} name="Procesamiento">
            Escala NOVA. Si un producto no tiene este dato, el apartado se
            excluye y no le afecta en absoluto.
          </Criterion>
        </ul>

        <div className="border-line flex items-center gap-2 border-t pt-4 text-xs">
          <Band color="var(--score-red)" text="0 – 4,9" />
          <Band color="var(--score-orange)" text="5 – 7,5" />
          <Band color="var(--score-green)" text="7,6 – 10" />
        </div>
      </section>

      <p className="muted text-center text-xs text-balance">
        Datos de Open Food Facts (ODbL). Todo el cálculo ocurre en tu móvil: no
        enviamos nada a ningún servidor. Esto no es consejo médico.
      </p>
    </div>
  );
}

/**
 * El distintivo de peso va en color de marca, no en los colores de la nota:
 * usar el rojo para "Aditivos" daría a entender que ese apartado es malo en
 * sí mismo, cuando lo que indica es cuánto pesa en el cálculo.
 */
function Criterion({
  weight,
  name,
  children,
}: {
  weight: number;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-px w-12 shrink-0 self-start rounded-md py-1 text-center text-xs font-bold tabular-nums"
        style={{ background: "var(--brand-soft)", color: "var(--brand-strong)" }}
      >
        {weight} %
      </span>
      <span>
        <strong className="font-semibold">{name}.</strong>{" "}
        <span className="muted">{children}</span>
      </span>
    </li>
  );
}

function Band({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex flex-1 items-center gap-1.5">
      <span
        className="h-2.5 flex-1 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="muted tabular-nums">{text}</span>
    </span>
  );
}
