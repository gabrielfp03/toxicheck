"use client";

/**
 * Copia de seguridad del historial: descargar un fichero y volver a cargarlo.
 *
 * Es la red de seguridad mientras no haya cuentas. Safari borra el
 * almacenamiento de las webs que no se abren en una semana, así que sin esto
 * un usuario puede perder meses de escaneos sin haber hecho nada mal.
 */

import { useCallback, useRef, useState } from "react";
import { DownloadIcon, UploadIcon } from "@/components/icons";
import { downloadHistory, importHistoryFromText } from "@/lib/storage";
import { InvalidHistoryFileError } from "@/lib/historyFile";

type Feedback =
  | { kind: "none" }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

export function HistoryActions({ hasEntries }: { hasEntries: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "none" });

  const onImport = useCallback(async (file: File) => {
    setFeedback({ kind: "none" });

    try {
      const text = await file.text();
      const { added, updated, invalid, total } = importHistoryFromText(text);

      const partes: string[] = [];
      if (added > 0) partes.push(`${added} producto(s) nuevo(s)`);
      if (updated > 0) partes.push(`${updated} actualizado(s)`);
      if (partes.length === 0) partes.push("nada nuevo que añadir");
      if (invalid > 0) partes.push(`${invalid} entrada(s) descartada(s)`);

      setFeedback({
        kind: "ok",
        text: `Importado: ${partes.join(", ")}. Ahora tienes ${total} en total.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof InvalidHistoryFileError
            ? error.message
            : "No se ha podido leer el fichero.",
      });
    }
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={downloadHistory}
          disabled={!hasEntries}
          className="btn-ghost flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-45"
        >
          <DownloadIcon size={17} />
          Exportar
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-ghost flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm"
        >
          <UploadIcon size={17} />
          Importar
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImport(file);
          // Permite volver a elegir el mismo fichero dos veces seguidas.
          e.target.value = "";
        }}
      />

      {feedback.kind !== "none" && (
        <p
          role="status"
          className="rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{
            background: "var(--surface-2)",
            color:
              feedback.kind === "error" ? "var(--score-red)" : "var(--fg-soft)",
          }}
        >
          {feedback.text}
        </p>
      )}

      <p className="muted text-xs leading-relaxed">
        El fichero se genera en tu móvil y no pasa por ningún servidor. Guárdalo
        donde quieras: es tu copia de seguridad mientras no haya cuentas.
      </p>
    </div>
  );
}
