"use client";

import Link from "next/link";
import { clearHistory, getHistoryStats } from "@/lib/storage";
import { useHistory } from "@/hooks/useHistory";

export default function HistoryPage() {
  // Lee localStorage sin `useEffect`: React gestiona la hidratación.
  const entries = useHistory();
  const stats = getHistoryStats(entries);

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Historial</h1>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="text-sm underline"
            style={{ color: "var(--muted)" }}
          >
            Borrar
          </button>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="space-y-4 pt-10 text-center">
          <p style={{ color: "var(--muted)" }}>
            Todavía no has escaneado nada. Tu historial se guarda sólo en este
            dispositivo.
          </p>
          <Link
            href="/scan"
            className="inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white"
          >
            Escanear el primero
          </Link>
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-4 gap-2 rounded-2xl border p-4 text-center"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <Stat value={stats.total} label="Escaneos" />
            <Stat value={stats.average.toFixed(1)} label="Media" />
            <Stat value={stats.green} label="Buenos" />
            <Stat value={stats.red} label="Malos" />
          </div>

          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.barcode}>
                <Link
                  href={`/product?code=${entry.barcode}`}
                  className="flex items-center gap-3 rounded-2xl border p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
                    style={{ backgroundColor: entry.hex }}
                  >
                    {entry.score.toFixed(1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {entry.name}
                    </span>
                    <span
                      className="block truncate text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      {entry.brand ?? entry.barcode}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </p>
    </div>
  );
}
