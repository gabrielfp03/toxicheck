"use client";

/**
 * Desglose completo de la nota: los tres bloques y, dentro de cada uno, los
 * motivos concretos con su impacto en puntos.
 *
 * Es el componente que cumple la promesa del producto: el usuario no recibe
 * un número, recibe un argumento.
 */

import type { RiskLevel, ScoreBlock, ScoreReason, ScoreResult } from "@/types/score";
import { ExternalIcon } from "@/components/icons";

const SEVERITY_COLOR: Record<RiskLevel, string> = {
  none: "var(--score-green)",
  low: "#84cc16",
  moderate: "var(--score-orange)",
  high: "var(--score-red)",
};

function formatImpact(impact: number): string {
  if (impact === 0) return "—";
  return `${impact > 0 ? "+" : "−"}${Math.abs(impact).toFixed(2)}`;
}

function ReasonRow({ reason }: { reason: ScoreReason }) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: SEVERITY_COLOR[reason.severity] }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium">{reason.label}</p>
        {reason.detail && (
          <p className="muted mt-1 text-xs leading-relaxed">{reason.detail}</p>
        )}

        {/*
          Las fuentes, cuando las hay. Una afirmación sobre salud que el
          usuario no puede rastrear hasta su origen no debería estar aquí.
        */}
        {reason.sources && reason.sources.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
            {reason.sources.map((s) => (
              <a
                key={s.url + s.year}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                title={s.finding}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: "var(--surface-2)", color: "var(--muted)" }}
              >
                {s.body} {s.year}
                <ExternalIcon size={11} />
              </a>
            ))}
          </p>
        )}
      </div>
      <span
        className="shrink-0 text-sm font-semibold tabular-nums"
        style={{
          color:
            reason.impact < 0
              ? "var(--score-red)"
              : reason.impact > 0
                ? "var(--score-green)"
                : "var(--muted)",
        }}
      >
        {formatImpact(reason.impact)}
      </span>
    </li>
  );
}

function BlockCard({ block }: { block: ScoreBlock }) {
  const percent = Math.round(block.weight * 100);

  return (
    <section className="card p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{block.label}</h3>
        <span className="muted text-xs">
          {block.available ? `${percent} % de la nota` : "No se tiene en cuenta"}
        </span>
      </header>

      {block.available ? (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(block.subScore / 10) * 100}%`,
                background: "var(--brand)",
              }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {block.subScore.toFixed(1)}
            <span className="muted font-normal">/10</span>
          </span>
        </div>
      ) : null}

      {block.reasons.length > 0 && (
        <ul className="divide-line mt-1 divide-y">
          {block.reasons.map((reason, i) => (
            <ReasonRow key={`${reason.label}-${i}`} reason={reason} />
          ))}
        </ul>
      )}
    </section>
  );
}

const CONFIDENCE_TEXT: Record<ScoreResult["confidence"], string> = {
  high: "Datos completos: se han podido evaluar los tres apartados.",
  medium:
    "Faltan algunos datos. Los apartados sin información se excluyen y su peso se reparte entre los demás.",
  low: "Datos escasos. Tómate la nota como orientativa.",
};

export function ScoreBreakdown({ result }: { result: ScoreResult }) {
  return (
    <div className="space-y-3">
      <p className="card muted px-4 py-3 text-sm">
        {CONFIDENCE_TEXT[result.confidence]}
      </p>

      {result.blocks.map((block) => (
        <BlockCard key={block.id} block={block} />
      ))}

      <p className="muted pt-1 text-center text-xs">
        Algoritmo v{result.algorithmVersion} · calculado en tu dispositivo
      </p>
    </div>
  );
}
