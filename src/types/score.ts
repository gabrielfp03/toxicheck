/**
 * Tipos del modelo de puntuación.
 *
 * Regla de oro del proyecto: **el resultado siempre es explicable**. Por eso
 * el algoritmo no devuelve un número, devuelve un número + el camino completo
 * que lo produjo (`ScoreReason[]`). La UI se limita a pintar ese camino.
 */

/* -------------------------------------------------------------------------- */
/*  Aditivos                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Nivel de riesgo de un aditivo.
 *
 * - `none`     → sin riesgo conocido a las dosis autorizadas (p. ej. E330).
 * - `low`      → seguro pero con matices (digestivos, laxantes, debate menor).
 * - `moderate` → evidencia de efectos adversos, controversia científica activa
 *                o restricciones en algunos países (p. ej. E102, E211).
 * - `high`     → riesgo relevante: clasificación IARC, prohibición en la UE u
 *                otra jurisdicción, o reevaluación EFSA desfavorable
 *                (p. ej. E171, E249-E252, E320).
 */
export type RiskLevel = "none" | "low" | "moderate" | "high";

/** Familia funcional del aditivo. Sirve para agrupar en la UI. */
export type AdditiveCategory =
  | "colorante"
  | "conservante"
  | "antioxidante"
  | "edulcorante"
  | "emulgente"
  | "espesante"
  | "estabilizante"
  | "potenciador"
  | "acidulante"
  | "otro";

/** Organismo que respalda una evidencia. */
export type EvidenceBody =
  | "EFSA"
  | "IARC"
  | "Comisión Europea"
  | "FDA"
  | "JECFA";

/**
 * Una evidencia citable detrás de la clasificación de un aditivo.
 *
 * Existe porque el campo `risk` **no es un dato, es una conclusión**. La EFSA
 * no publica "niveles de riesgo": publica dictámenes e ingestas diarias
 * admisibles, y la IARC publica clasificaciones de la solidez de la evidencia.
 * Poner "riesgo alto" sin decir de dónde sale es una opinión disfrazada de
 * dato.
 *
 * Con este campo, cada clasificación grave apunta a algo que cualquiera puede
 * comprobar, y la regla que convierte evidencias en nivel de riesgo está
 * escrita en `docs/REVISION-ADITIVOS.md`.
 */
export interface Evidence {
  body: EvidenceBody;
  /** `dictamen` (EFSA/JECFA), `clasificacion` (IARC) o `norma` (UE/FDA). */
  type: "dictamen" | "clasificacion" | "norma";
  year: number;
  /** Qué dice exactamente la fuente, en una o dos frases. */
  finding: string;
  url: string;
}

/** Una entrada del diccionario local `data/additives.json`. */
export interface Additive {
  /** Código E normalizado en mayúsculas: `"E171"`. */
  code: string;
  name: string;
  category: AdditiveCategory;
  risk: RiskLevel;
  /** Explicación en una o dos frases, en lenguaje llano. */
  description: string;
  /** Origen: natural, sintético o ambos. */
  origin?: "natural" | "sintético" | "mixto";
  /** Ingesta Diaria Admisible fijada por la EFSA, en texto libre. */
  efsaAdi?: string;
  /** Etiquetas útiles: `"prohibido-ue"`, `"iarc-2b"`, `"alergeno"`… */
  flags?: string[];
  /** Enlaces a la fuente (dictámenes EFSA, monografías IARC…). */
  references?: string[];
  /**
   * Fuentes que sostienen la clasificación. Obligatorio para `risk: "high"`:
   * hay un test que falla si falta.
   */
  evidence?: Evidence[];
  /** Fecha ISO de la última revisión contra fuentes primarias. */
  reviewedAt?: string;
}

/** Estructura completa del fichero `additives.json`. */
export interface AdditivesDatabase {
  version: string;
  /** ISO date de la última revisión del diccionario. */
  updatedAt: string;
  sources: string[];
  /** Penalización en puntos que aplica cada nivel de riesgo (sobre 10). */
  penalties: Record<RiskLevel, number>;
  /** Indexado por código E en MAYÚSCULAS. */
  additives: Record<string, Additive>;
}

/* -------------------------------------------------------------------------- */
/*  Resultado del scoring                                                     */
/* -------------------------------------------------------------------------- */

/** Los tres bloques del algoritmo. */
export type ScoreBlockId = "additives" | "nutrition" | "processing";

/** Un motivo concreto que suma o resta. La UI los lista tal cual. */
export interface ScoreReason {
  block: ScoreBlockId;
  /** Texto listo para mostrar: "E171 · Dióxido de titanio". */
  label: string;
  /** Detalle opcional: por qué penaliza. */
  detail?: string;
  /**
   * Impacto en puntos **sobre la nota final de 10**, ya ponderado.
   * Negativo = penaliza, positivo = bonifica, 0 = informativo.
   */
  impact: number;
  severity: RiskLevel;
  /**
   * Fuentes que respaldan este motivo, cuando las hay. Se muestran en la
   * ficha: una afirmación sobre salud que no se puede rastrear hasta su
   * origen no debería estar en pantalla.
   */
  sources?: Evidence[];
}

/** Resultado de uno de los tres bloques. */
export interface ScoreBlock {
  id: ScoreBlockId;
  label: string;
  /** Nota del bloque de 0 a 10, antes de ponderar. */
  subScore: number;
  /** Peso aplicado (0-1). Se renormaliza si falta algún bloque. */
  weight: number;
  /** `subScore * weight`: lo que aporta a la nota final. */
  weighted: number;
  /** `false` si no había datos suficientes y el bloque se ha excluido. */
  available: boolean;
  reasons: ScoreReason[];
}

/**
 * Bandas de color de la nota:
 *   rojo    → 0 a 4,9
 *   naranja → 5,0 a 7,5
 *   verde   → 7,6 a 10
 */
export type ScoreColor = "green" | "orange" | "red";

/** Etiqueta cualitativa de 4 niveles (más granular que el color). */
export type ScoreLabel = "Excelente" | "Bueno" | "Mediocre" | "Malo";

/**
 * Fiabilidad del resultado.
 * - `high`   → los tres bloques con datos.
 * - `medium` → falta un bloque, pesos renormalizados.
 * - `low`    → sólo queda un bloque, o los datos vienen de OCR.
 */
export type Confidence = "high" | "medium" | "low";

export interface ScoreResult {
  /** Nota final de 0 a 10 con un decimal. */
  score: number;
  color: ScoreColor;
  label: ScoreLabel;
  /** Código hex del color, listo para estilos inline o SVG. */
  hex: string;
  confidence: Confidence;
  /** Campos que faltaban, en lenguaje humano. */
  missingData: string[];
  blocks: ScoreBlock[];
  /** Todos los motivos de los tres bloques, ordenados por impacto. */
  reasons: ScoreReason[];
  /** Versión del algoritmo, para poder invalidar cachés e historial. */
  algorithmVersion: string;
}
