"use client";

/**
 * Medidor circular de la nota. SVG puro: sin librerías de gráficos, sin
 * canvas, escalable y accesible. Los colores salen de los tokens del tema,
 * salvo el del arco, que es el de la banda en la que cae la nota.
 */

import type { ScoreResult } from "@/types/score";

export interface ScoreGaugeProps {
  result: Pick<ScoreResult, "score" | "label" | "hex">;
  size?: number;
  /** Muestra la etiqueta textual bajo el número. */
  showLabel?: boolean;
}

export function ScoreGauge({ result, size = 190, showLabel = true }: ScoreGaugeProps) {
  const stroke = size * 0.085;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (result.score / 10) * circumference;

  return (
    <div
      className="inline-flex flex-col items-center gap-3"
      role="img"
      aria-label={`Puntuación ${result.score.toFixed(1)} sobre 10: ${result.label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Pista */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        {/* Progreso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={result.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 600ms ease-out" }}
        />
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.3}
          fontWeight={700}
          fill={result.hex}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {result.score.toFixed(1)}
        </text>
        <text
          x="50%"
          y="65%"
          textAnchor="middle"
          fontSize={size * 0.085}
          fontWeight={500}
          fill="var(--muted)"
        >
          sobre 10
        </text>
      </svg>

      {showLabel && (
        <span
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
          style={{ backgroundColor: result.hex }}
        >
          {result.label}
        </span>
      )}
    </div>
  );
}
