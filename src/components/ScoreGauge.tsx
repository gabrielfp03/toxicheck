"use client";

/**
 * Medidor circular de la nota. SVG puro: sin librerías de gráficos, sin
 * canvas, escalable y accesible.
 */

import type { ScoreResult } from "@/types/score";

export interface ScoreGaugeProps {
  result: Pick<ScoreResult, "score" | "label" | "hex">;
  size?: number;
  /** Muestra la etiqueta textual bajo el número. */
  showLabel?: boolean;
}

export function ScoreGauge({ result, size = 180, showLabel = true }: ScoreGaugeProps) {
  const stroke = size * 0.09;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (result.score / 10) * circumference;

  return (
    <div
      className="inline-flex flex-col items-center"
      role="img"
      aria-label={`Puntuación ${result.score} sobre 10: ${result.label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Pista */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200 dark:text-slate-700"
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
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.3}
          fontWeight={700}
          fill={result.hex}
        >
          {result.score.toFixed(1)}
        </text>
        <text
          x="50%"
          y="68%"
          textAnchor="middle"
          fontSize={size * 0.09}
          fill="currentColor"
          className="text-slate-500"
        >
          / 10
        </text>
      </svg>

      {showLabel && (
        <span
          className="mt-1 rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: result.hex }}
        >
          {result.label}
        </span>
      )}
    </div>
  );
}
