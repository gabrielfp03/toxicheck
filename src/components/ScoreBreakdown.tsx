"use client";

/**
 * Desglose completo de la nota: los tres bloques y, dentro de cada uno, los
 * motivos concretos con su impacto en puntos.
 *
 * Es el componente que cumple la promesa del producto: el usuario no recibe
 * un número, recibe un argumento.
 */

import type { RiskLevel, ScoreBlock, ScoreReason, ScoreResult } from "@/types/score";

const SEVERITY_STYLE: Record<RiskLevel, { dot: string; text: string }> = {
  none: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  low: { dot: "bg-lime-500", text: "text-lime-700 dark:text-lime-400" },
  moderate: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  high: { dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
};

function formatImpact(impact: number): string {
  if (impact === 0) return "0";
  return `${impact > 0 ? "+" : ""}${impact.toFixed(2)}`;
}

function ReasonRow({ reason }: { reason: ScoreReason }) {
  const style = SEVERITY_STYLE[reason.severity];

  return (
    <li className="flex gap-3 py-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{reason.label}</p>
        {reason.detail && (
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            {reason.detail}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 font-mono text-sm tabular-nums ${
          reason.impact < 0 ? "text-red-600" : "text-emerald-600"
        }`}
      >
        {formatImpact(reason.impact)}
      </span>
    </li>
  );
}

function BlockCard({ block }: { block: ScoreBlock }) {
  const percent = Math.round(block.weight * 100);

  return (
    <section
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{block.label}</h3>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {block.available ? `${percent} % del total` : "Sin datos"}
        </span>
      </header>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${(block.subScore / 10) * 100}%` }}
          />
        </div>
        <span className="font-mono text-sm tabular-nums">
          {block.subScore.toFixed(1)}/10
        </span>
      </div>

      {block.reasons.length > 0 && (
        <ul className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
          {block.reasons.map((reason, i) => (
            <ReasonRow key={`${reason.label}-${i}`} reason={reason} />
          ))}
        </ul>
      )}
    </section>
  );
}

const CONFIDENCE_TEXT: Record<ScoreResult["confidence"], string> = {
  high: "Datos completos: los tres bloques se han podido evaluar.",
  medium: "Faltan algunos datos. Los pesos se han redistribuido entre los bloques disponibles.",
  low: "Datos escasos. Tómate la nota como orientativa.",
};

export function ScoreBreakdown({ result }: { result: ScoreResult }) {
  return (
    <div className="space-y-4">
      <p
        className="rounded-xl border px-4 py-3 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        {CONFIDENCE_TEXT[result.confidence]}
        {result.missingData.length > 0 && (
          <> Falta: {result.missingData.join(", ")}.</>
        )}
      </p>

      {result.blocks.map((block) => (
        <BlockCard key={block.id} block={block} />
      ))}

      <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
        Algoritmo v{result.algorithmVersion} · cálculo realizado en tu dispositivo
      </p>
    </div>
  );
}
