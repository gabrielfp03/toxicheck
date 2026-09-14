import { describe, expect, it } from "vitest";
import { ADDITIVES_DB } from "@/utils/additives";
import type { Additive, EvidenceBody, RiskLevel } from "@/types/score";

/**
 * Validación del diccionario de aditivos.
 *
 * Estos tests no comprueban el código: comprueban **los datos**. Son la única
 * forma de que un diccionario de 122 entradas, que se va a revisar a ratos
 * durante meses, no se degrade en silencio.
 *
 * El test que de verdad importa es el de las evidencias: impide publicar una
 * clasificación de riesgo alto sin una fuente comprobable detrás. Un producto
 * que juzga alimentos no puede permitirse afirmar "esto es peligroso" y no
 * poder decir quién lo dice.
 */

const entradas = Object.entries(ADDITIVES_DB.additives);

const CATEGORIAS = new Set([
  "colorante", "conservante", "antioxidante", "edulcorante", "emulgente",
  "espesante", "estabilizante", "potenciador", "acidulante", "otro",
]);

const RIESGOS = new Set<RiskLevel>(["none", "low", "moderate", "high"]);

const ORGANISMOS = new Set<EvidenceBody>([
  "EFSA", "IARC", "Comisión Europea", "FDA", "JECFA",
]);

/** Dominios que aceptamos como fuente. Un blog no sirve de evidencia. */
const DOMINIOS_FIABLES = [
  "efsa.europa.eu",
  "efsa.onlinelibrary.wiley.com",
  "iarc.who.int",
  "monographs.iarc.who.int",
  "who.int",
  "ncbi.nlm.nih.gov",
  "eur-lex.europa.eu",
  "food.ec.europa.eu",
  "fda.gov",
  "fao.org",
];

/* -------------------------------------------------------------------------- */
/*  Estructura                                                                */
/* -------------------------------------------------------------------------- */

describe("diccionario de aditivos · estructura", () => {
  it("no está vacío", () => {
    expect(entradas.length).toBeGreaterThan(100);
  });

  it("la clave del objeto coincide con el código de la entrada", () => {
    for (const [clave, aditivo] of entradas) {
      expect(aditivo.code).toBe(clave);
    }
  });

  it("todos los códigos tienen la forma canónica E + dígitos + sufijo", () => {
    for (const [clave] of entradas) {
      expect(clave).toMatch(/^E\d{3,4}[a-z]{0,3}$/);
    }
  });

  it("todas las categorías y riesgos son válidos", () => {
    for (const [clave, a] of entradas) {
      expect(CATEGORIAS.has(a.category), `${clave}: ${a.category}`).toBe(true);
      expect(RIESGOS.has(a.risk), `${clave}: ${a.risk}`).toBe(true);
    }
  });

  it("todas las entradas tienen nombre y una descripción con sustancia", () => {
    for (const [clave, a] of entradas) {
      expect(a.name.trim().length, clave).toBeGreaterThan(2);
      expect(a.description.trim().length, clave).toBeGreaterThan(30);
    }
  });

  it("la tabla de penalizaciones cubre los cuatro niveles y es monótona", () => {
    const p = ADDITIVES_DB.penalties;
    expect(p.none).toBe(0);
    expect(p.low).toBeGreaterThan(p.none);
    expect(p.moderate).toBeGreaterThan(p.low);
    expect(p.high).toBeGreaterThan(p.moderate);
  });
});

/* -------------------------------------------------------------------------- */
/*  Evidencias: el test que protege la credibilidad del producto              */
/* -------------------------------------------------------------------------- */

function evidenciasDe(a: Additive) {
  return a.evidence ?? [];
}

describe("diccionario de aditivos · evidencias", () => {
  const altos = entradas.filter(([, a]) => a.risk === "high");

  it("hay al menos un aditivo clasificado como riesgo alto", () => {
    expect(altos.length).toBeGreaterThan(0);
  });

  /*
   * El invariante central. Si alguien sube un aditivo a "riesgo alto" sin
   * citar la fuente, la CI falla y no llega a producción.
   */
  it("todo riesgo alto cita al menos una fuente", () => {
    for (const [clave, a] of altos) {
      expect(evidenciasDe(a).length, `${clave} está en riesgo alto sin evidencia`)
        .toBeGreaterThan(0);
    }
  });

  it("toda evidencia está completa y es verificable", () => {
    for (const [clave, a] of entradas) {
      for (const e of evidenciasDe(a)) {
        expect(ORGANISMOS.has(e.body), `${clave}: organismo "${e.body}"`).toBe(true);
        expect(["dictamen", "clasificacion", "norma"]).toContain(e.type);
        expect(e.year, `${clave}: año`).toBeGreaterThan(1950);
        expect(e.year, `${clave}: año`).toBeLessThanOrEqual(
          new Date().getFullYear(),
        );
        expect(e.finding.trim().length, `${clave}: hallazgo demasiado corto`)
          .toBeGreaterThan(30);
        expect(e.url, `${clave}: la fuente debe ir por https`).toMatch(/^https:\/\//);
      }
    }
  });

  it("las fuentes vienen de organismos oficiales, no de blogs", () => {
    for (const [clave, a] of entradas) {
      for (const e of evidenciasDe(a)) {
        const host = new URL(e.url).hostname.replace(/^www\./, "");
        const fiable = DOMINIOS_FIABLES.some(
          (d) => host === d || host.endsWith("." + d),
        );
        expect(fiable, `${clave}: dominio no reconocido "${host}"`).toBe(true);
      }
    }
  });

  it("toda entrada revisada lleva fecha de revisión", () => {
    for (const [clave, a] of entradas) {
      if (evidenciasDe(a).length > 0) {
        expect(a.reviewedAt, `${clave}: falta reviewedAt`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Cobertura                                                                 */
/* -------------------------------------------------------------------------- */

describe("diccionario de aditivos · cobertura de la revisión", () => {
  /*
   * No falla: informa. La revisión completa es un trabajo de meses y este
   * test es el marcador. Cuando suba la cobertura, se sube el mínimo.
   */
  it("informa de cuántos aditivos están revisados", () => {
    const revisados = entradas.filter(([, a]) => evidenciasDe(a).length > 0);
    const pct = Math.round((revisados.length / entradas.length) * 100);

    // Suelo actual: los de riesgo alto. Súbelo según avance la revisión.
    expect(revisados.length).toBeGreaterThanOrEqual(14);
    expect(pct).toBeGreaterThanOrEqual(11);
  });

  it("el diccionario declara su política de revisión", () => {
    expect(ADDITIVES_DB.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(ADDITIVES_DB.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ADDITIVES_DB.sources.length).toBeGreaterThan(0);
  });
});
