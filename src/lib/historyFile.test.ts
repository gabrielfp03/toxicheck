import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/lib/storage";
import {
  InvalidHistoryFileError,
  buildExport,
  exportFileName,
  mergeHistories,
  parseHistoryFile,
  sanitizeEntry,
} from "@/lib/historyFile";

const MAX = 100;

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    barcode: "3017620422003",
    name: "Nutella",
    brand: "Ferrero",
    imageUrl: "https://images.openfoodfacts.org/x.jpg",
    score: 4.7,
    color: "red",
    label: "Malo",
    hex: "#dc2626",
    algorithmVersion: "2.0.0",
    scannedAt: 1_000,
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/*  Ciclo completo                                                            */
/* -------------------------------------------------------------------------- */

describe("exportar e importar", () => {
  it("lo que se exporta se vuelve a leer idéntico", () => {
    const original = [entry(), entry({ barcode: "5449000000996", name: "Cola" })];
    const text = JSON.stringify(buildExport(original));

    const { entries, invalid } = parseHistoryFile(text);

    expect(invalid).toBe(0);
    expect(entries).toEqual(original);
  });

  it("el envoltorio lleva la aplicación, la versión y la fecha", () => {
    const dump = buildExport([entry()]);
    expect(dump.app).toBe("toxicheck");
    expect(dump.exportVersion).toBe(1);
    expect(() => new Date(dump.exportedAt).toISOString()).not.toThrow();
  });

  it("el nombre del fichero lleva la fecha", () => {
    expect(exportFileName(new Date("2026-09-14T10:00:00Z"))).toBe(
      "toxicheck-historial-2026-09-14.json",
    );
  });

  it("acepta también una lista pelada, sin envoltorio", () => {
    const { entries } = parseHistoryFile(JSON.stringify([entry()]));
    expect(entries).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Ficheros hostiles o rotos                                                 */
/* -------------------------------------------------------------------------- */

describe("validación del fichero", () => {
  it("rechaza lo que no es JSON", () => {
    expect(() => parseHistoryFile("esto no es json")).toThrow(
      InvalidHistoryFileError,
    );
  });

  it("rechaza un JSON que no tiene forma de historial", () => {
    expect(() => parseHistoryFile('{"hola":"mundo"}')).toThrow(
      InvalidHistoryFileError,
    );
  });

  it("rechaza un fichero sin ninguna entrada aprovechable", () => {
    expect(() => parseHistoryFile('{"entries":[{"barcode":"x"}]}')).toThrow(
      InvalidHistoryFileError,
    );
  });

  it("descarta las entradas malas y conserva las buenas", () => {
    const text = JSON.stringify({
      entries: [entry(), { barcode: "no-es-un-codigo" }, null, 42],
    });

    const { entries, invalid } = parseHistoryFile(text);
    expect(entries).toHaveLength(1);
    expect(invalid).toBe(3);
  });

  /*
   * El fichero lo aporta el usuario y puede venir de cualquier sitio. Estas
   * tres son las que de verdad importan: la imagen se pinta en un `<img src>`
   * y la nota se muestra como dato de salud.
   */
  it("descarta imágenes que no sean https", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://sin-cifrar.example/x.jpg",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "vbscript:msgbox",
    ]) {
      const saneado = sanitizeEntry(entry({ imageUrl: url }));
      expect(saneado?.imageUrl).toBeNull();
    }
  });

  it("mantiene las imágenes https legítimas", () => {
    const saneado = sanitizeEntry(entry());
    expect(saneado?.imageUrl).toBe("https://images.openfoodfacts.org/x.jpg");
  });

  it("rechaza notas fuera del rango 0-10", () => {
    expect(sanitizeEntry(entry({ score: 99 }))).toBeNull();
    expect(sanitizeEntry(entry({ score: -1 }))).toBeNull();
    expect(sanitizeEntry(entry({ score: Number.NaN }))).toBeNull();
  });

  it("rechaza colores inventados y hex mal formados", () => {
    expect(sanitizeEntry(entry({ color: "morado" as never }))).toBeNull();
    expect(sanitizeEntry(entry({ hex: "rojo" }))).toBeNull();
    expect(sanitizeEntry(entry({ hex: "#fff" }))).toBeNull();
  });

  it("rechaza códigos de barras que no son números", () => {
    expect(sanitizeEntry(entry({ barcode: "../../etc/passwd" }))).toBeNull();
    expect(sanitizeEntry(entry({ barcode: "" }))).toBeNull();
  });

  it("recorta nombres desmesurados en lugar de descartarlos", () => {
    const saneado = sanitizeEntry(entry({ name: "A".repeat(5000) }));
    expect(saneado?.name).toHaveLength(200);
  });
});

/* -------------------------------------------------------------------------- */
/*  Fusión                                                                    */
/* -------------------------------------------------------------------------- */

describe("fusión de historiales", () => {
  it("añade los productos que no estaban", () => {
    const actual = [entry()];
    const nuevo = [entry({ barcode: "5449000000996", name: "Cola" })];

    const { merged, added, updated } = mergeHistories(actual, nuevo, MAX);

    expect(added).toBe(1);
    expect(updated).toBe(0);
    expect(merged).toHaveLength(2);
  });

  it("ante un duplicado se queda con el escaneo más reciente", () => {
    const viejo = entry({ score: 4.7, scannedAt: 1_000 });
    const nuevo = entry({ score: 3.2, scannedAt: 9_000 });

    const { merged, updated } = mergeHistories([viejo], [nuevo], MAX);

    expect(updated).toBe(1);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.score).toBe(3.2);
  });

  it("no pisa una entrada más nueva con una más vieja", () => {
    const nuevo = entry({ score: 3.2, scannedAt: 9_000 });
    const viejo = entry({ score: 4.7, scannedAt: 1_000 });

    const { merged, updated } = mergeHistories([nuevo], [viejo], MAX);

    expect(updated).toBe(0);
    expect(merged[0]!.score).toBe(3.2);
  });

  it("importar nunca borra lo que ya había", () => {
    const actual = [
      entry({ barcode: "1111111111116" }),
      entry({ barcode: "2222222222226" }),
    ];

    const { merged } = mergeHistories(actual, [], MAX);
    expect(merged).toHaveLength(2);
  });

  it("ordena de más reciente a más antiguo", () => {
    const { merged } = mergeHistories(
      [entry({ barcode: "1111111111116", scannedAt: 100 })],
      [entry({ barcode: "2222222222226", scannedAt: 500 })],
      MAX,
    );
    expect(merged[0]!.barcode).toBe("2222222222226");
  });

  it("respeta el tope de entradas quedándose con las más recientes", () => {
    const muchas = Array.from({ length: 150 }, (_, i) =>
      entry({ barcode: String(1_000_000_000_000 + i), scannedAt: i }),
    );

    const { merged } = mergeHistories([], muchas, MAX);

    expect(merged).toHaveLength(MAX);
    expect(merged[0]!.scannedAt).toBe(149);
  });
});
