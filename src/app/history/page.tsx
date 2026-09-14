"use client";

/**
 * Historial en rejilla, con la foto de cada producto.
 *
 * Las imágenes se sirven con `<img>` normal y no con `next/image` a
 * propósito: el optimizador de imágenes de Next se ejecuta como función en el
 * servidor y facturaría por cada miniatura. Open Food Facts ya entrega sus
 * fotos desde una CDN, así que las consumimos tal cual, con carga diferida.
 */

import Link from "next/link";
import { useCallback } from "react";
import { HistoryActions } from "@/components/HistoryActions";
import { ScanFab } from "@/components/ScanFab";
import { TrashIcon } from "@/components/icons";
import { clearHistory, getHistoryStats, type HistoryEntry } from "@/lib/storage";
import { useHistory } from "@/hooks/useHistory";

export default function HistoryPage() {
  // Lee localStorage sin `useEffect`: React gestiona la hidratación.
  const entries = useHistory();
  const stats = getHistoryStats(entries);
  const vacio = entries.length === 0;

  const onClear = useCallback(() => {
    if (window.confirm("¿Borrar todo el historial? No se puede deshacer.")) {
      clearHistory();
    }
  }, []);

  return (
    <div className="space-y-5 pb-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Historial</h1>
        {!vacio && (
          <button
            type="button"
            onClick={onClear}
            className="muted flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm"
          >
            <TrashIcon size={16} />
            Borrar
          </button>
        )}
      </header>

      {vacio ? (
        <div className="card px-6 py-10 text-center">
          <p className="muted text-balance">
            Todavía no has escaneado nada. Tu historial se guarda sólo en este
            dispositivo y no sale de él.
          </p>
          <Link href="/scan" className="btn-primary mt-6 inline-block px-6 py-3">
            Escanear el primero
          </Link>
        </div>
      ) : (
        <>
          <div className="card grid grid-cols-4 divide-x divide-[var(--border)] py-3">
            <Stat value={stats.total} label="Escaneos" />
            <Stat value={stats.average.toFixed(1)} label="Media" />
            <Stat value={stats.green} label="Buenos" tone="var(--score-green)" />
            <Stat value={stats.red} label="Malos" tone="var(--score-red)" />
          </div>

          <ul className="grid grid-cols-2 gap-3">
            {entries.map((entry) => (
              <li key={entry.barcode}>
                <ProductCard entry={entry} />
              </li>
            ))}
          </ul>
        </>
      )}

      {/*
        Fuera del condicional a propósito. Si estuviera dentro de cada rama,
        importar con el historial vacío desmontaría este componente al pasar a
        la rama con datos y el mensaje de confirmación desaparecería justo
        cuando el usuario necesita leerlo.
      */}
      <section className={vacio ? "" : "border-line border-t pt-5"}>
        <h2 className="mb-2 text-sm font-semibold">
          {vacio ? "¿Vienes de otro dispositivo?" : "Copia de seguridad"}
        </h2>
        <HistoryActions hasEntries={!vacio} />
      </section>

      <ScanFab />
    </div>
  );
}

function ProductCard({ entry }: { entry: HistoryEntry }) {
  return (
    <Link
      href={`/product?code=${entry.barcode}`}
      className="card flex h-full flex-col overflow-hidden"
    >
      <div className="relative">
        {entry.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="product-img aspect-square w-full"
          />
        ) : (
          <div className="product-img flex aspect-square w-full items-center justify-center">
            <span className="muted text-xs">Sin foto</span>
          </div>
        )}

        {/* La nota, sobre la foto: es lo que el usuario viene a mirar. */}
        <span
          className="absolute top-2 left-2 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white tabular-nums"
          style={{
            backgroundColor: entry.hex,
            boxShadow: "0 2px 8px rgb(0 0 0 / 0.35)",
          }}
        >
          {entry.score.toFixed(1)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="line-clamp-2 text-sm leading-snug font-semibold">
          {entry.name}
        </p>
        <p className="muted truncate text-xs">{entry.brand ?? entry.barcode}</p>
      </div>
    </Link>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="px-1 text-center">
      <p className="text-lg font-bold tabular-nums" style={{ color: tone }}>
        {value}
      </p>
      <p className="muted text-[11px]">{label}</p>
    </div>
  );
}
