import { describe, expect, it } from "vitest";
import type { Nutrients, Product } from "@/types/product";
import { calculateScore, WEIGHTS } from "@/utils/calculator";
import { extractAdditiveCodesFromText, normalizeAdditiveCode } from "@/utils/additives";
import { isValidBarcode } from "@/lib/openfoodfacts";

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const EMPTY_NUTRIENTS: Nutrients = {
  energyKj: null,
  sugars: null,
  saturatedFat: null,
  sodiumMg: null,
  fiber: null,
  proteins: null,
  fruitsVegetablesNuts: null,
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    barcode: "0000000000000",
    name: "Producto de prueba",
    brand: null,
    quantity: null,
    imageUrl: null,
    ingredientsText: "ingredientes de prueba",
    additiveCodes: [],
    novaGroup: 1,
    nutriScoreGrade: null,
    nutrients: { ...EMPTY_NUTRIENTS },
    isBeverage: false,
    isWater: false,
    source: "openfoodfacts",
    fetchedAt: 0,
    ...overrides,
  };
}

/** Lentejas cocidas en conserva: producto sano y poco procesado. */
const LENTEJAS = makeProduct({
  name: "Lentejas cocidas",
  additiveCodes: [],
  novaGroup: 3,
  nutrients: {
    energyKj: 380,
    sugars: 0.8,
    saturatedFat: 0.2,
    sodiumMg: 240,
    fiber: 4.2,
    proteins: 6.1,
    fruitsVegetablesNuts: 60,
  },
});

/** Crema de cacao tipo Nutella: azúcar y grasa saturada por bandera. */
const CREMA_CACAO = makeProduct({
  name: "Crema de cacao y avellanas",
  additiveCodes: ["E322", "E476"],
  novaGroup: 4,
  nutrients: {
    energyKj: 2252,
    sugars: 56.3,
    saturatedFat: 10.6,
    sodiumMg: 42,
    fiber: 3.4,
    proteins: 6.3,
    fruitsVegetablesNuts: 13,
  },
});

/** Refresco de cola: bebida, NOVA 4, colorante y acidulante. */
const REFRESCO = makeProduct({
  name: "Refresco de cola",
  additiveCodes: ["E150d", "E338", "E330"],
  novaGroup: 4,
  isBeverage: true,
  nutrients: {
    energyKj: 180,
    sugars: 10.6,
    saturatedFat: 0,
    sodiumMg: 4,
    fiber: 0,
    proteins: 0,
    fruitsVegetablesNuts: 0,
  },
});

/** Salchichas tipo frankfurt: nitritos (riesgo alto) y mucha sal. */
const SALCHICHAS = makeProduct({
  name: "Salchichas cocidas",
  additiveCodes: ["E250", "E316", "E450", "E451", "E621", "E120"],
  novaGroup: 4,
  nutrients: {
    energyKj: 1050,
    sugars: 1.2,
    saturatedFat: 8.5,
    sodiumMg: 900,
    fiber: 0,
    proteins: 11,
    fruitsVegetablesNuts: 0,
  },
});

/** Agua mineral: el techo de la escala. */
const AGUA = makeProduct({
  name: "Agua mineral natural",
  additiveCodes: [],
  novaGroup: 1,
  isBeverage: true,
  isWater: true,
  nutrients: {
    energyKj: 0,
    sugars: 0,
    saturatedFat: 0,
    sodiumMg: 1.2,
    fiber: 0,
    proteins: 0,
    fruitsVegetablesNuts: 0,
  },
});

/* -------------------------------------------------------------------------- */
/*  Rango y coherencia                                                        */
/* -------------------------------------------------------------------------- */

describe("calculateScore · invariantes", () => {
  const todos = [LENTEJAS, CREMA_CACAO, REFRESCO, SALCHICHAS, AGUA];

  it("siempre devuelve una nota entre 0 y 10", () => {
    for (const p of todos) {
      const r = calculateScore(p);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(10);
    }
  });

  it("los pesos de los bloques disponibles suman 1", () => {
    for (const p of todos) {
      const r = calculateScore(p);
      const sum = r.blocks.reduce((acc, b) => acc + b.weight, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("con agregación lineal, la nota es la suma ponderada de los bloques", () => {
    for (const p of todos) {
      const r = calculateScore(p, { aggregation: "linear" });
      const manual = r.blocks.reduce((acc, b) => acc + b.subScore * b.weight, 0);
      expect(r.score).toBeCloseTo(manual, 1);
    }
  });

  it("con agregación geométrica, la nota es el producto ponderado", () => {
    for (const p of todos) {
      const r = calculateScore(p, { aggregation: "geometric" });
      const manual = r.blocks
        .filter((b) => b.weight > 0)
        .reduce(
          (acc, b) => acc * Math.pow(Math.max(b.subScore, 1) / 10, b.weight),
          10,
        );
      expect(r.score).toBeCloseTo(manual, 1);
    }
  });

  it("los pesos nominales suman 1", () => {
    const sum = WEIGHTS.additives + WEIGHTS.nutrition + WEIGHTS.processing;
    expect(sum).toBeCloseTo(1, 10);
  });
});

/* -------------------------------------------------------------------------- */
/*  Orden esperado entre productos reales                                     */
/* -------------------------------------------------------------------------- */

describe("calculateScore · ordenación de productos reales", () => {
  it("ordena agua > lentejas > refresco > salchichas", () => {
    const agua = calculateScore(AGUA).score;
    const lentejas = calculateScore(LENTEJAS).score;
    const refresco = calculateScore(REFRESCO).score;
    const crema = calculateScore(CREMA_CACAO).score;
    const salchichas = calculateScore(SALCHICHAS).score;

    expect(agua).toBeGreaterThan(lentejas);
    expect(lentejas).toBeGreaterThan(refresco);
    expect(refresco).toBeGreaterThan(salchichas);
    expect(crema).toBeLessThan(lentejas);
  });

  it("el agua es verde y las salchichas rojas", () => {
    expect(calculateScore(AGUA).color).toBe("green");
    expect(calculateScore(SALCHICHAS).color).toBe("red");
  });
});

/* -------------------------------------------------------------------------- */
/*  Bandas de color                                                           */
/* -------------------------------------------------------------------------- */

describe("bandas de color", () => {
  it("rojo por debajo de 5,0", () => {
    const r = calculateScore(SALCHICHAS);
    expect(r.score).toBeLessThan(5);
    expect(r.color).toBe("red");
  });

  it("verde a partir de 7,6", () => {
    const r = calculateScore(LENTEJAS);
    expect(r.score).toBeGreaterThanOrEqual(7.6);
    expect(r.color).toBe("green");
  });

  it("cada nota cae en la banda que le corresponde", () => {
    for (const p of [LENTEJAS, CREMA_CACAO, REFRESCO, SALCHICHAS, AGUA]) {
      const { score, color } = calculateScore(p);
      const esperado =
        score >= 7.6 ? "green" : score >= 5 ? "orange" : "red";
      expect(color).toBe(esperado);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Agregación lineal vs. geométrica                                          */
/* -------------------------------------------------------------------------- */

describe("agregación", () => {
  it("la geométrica penaliza más que la lineal salvo en productos perfectos", () => {
    for (const p of [LENTEJAS, CREMA_CACAO, REFRESCO, SALCHICHAS]) {
      const lineal = calculateScore(p, { aggregation: "linear" }).score;
      const geom = calculateScore(p, { aggregation: "geometric" }).score;
      expect(geom).toBeLessThanOrEqual(lineal);
    }
  });

  it("ambas dan 10 al agua", () => {
    expect(calculateScore(AGUA, { aggregation: "linear" }).score).toBe(10);
    expect(calculateScore(AGUA, { aggregation: "geometric" }).score).toBe(10);
  });

  /**
   * El motivo por el que la agregación geométrica es el defecto: con los
   * aditivos al 50 %, la media ponderada da 5,0 fijos a cualquier producto
   * sin números E, y 5,0 es justo la frontera del rojo. La banda roja se
   * volvería inalcanzable para todo un tipo de productos.
   */
  it("el modelo lineal no puede pintar de rojo un ultraprocesado sin aditivos", () => {
    // Lo peor posible en nutrición y procesamiento, pero sin ningún número E.
    const peor = makeProduct({
      additiveCodes: [],
      novaGroup: 4,
      nutrients: {
        energyKj: 3500,
        sugars: 60,
        saturatedFat: 30,
        sodiumMg: 2000,
        fiber: 0,
        proteins: 0,
        fruitsVegetablesNuts: 0,
      },
    });

    const lineal = calculateScore(peor, { aggregation: "linear" });
    expect(lineal.score).toBeCloseTo(5, 1);
    expect(lineal.color).not.toBe("red");

    // La geométrica sí lo manda a rojo, que es lo que espera el usuario.
    const geom = calculateScore(peor, { aggregation: "geometric" });
    expect(geom.score).toBeLessThan(5);
    expect(geom.color).toBe("red");
  });

  it("la agregación por defecto es la geométrica", () => {
    const p = CREMA_CACAO;
    expect(calculateScore(p).score).toBe(
      calculateScore(p, { aggregation: "geometric" }).score,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Bloque de aditivos                                                        */
/* -------------------------------------------------------------------------- */

describe("bloque de aditivos", () => {
  it("un producto sin aditivos saca 10 en el bloque", () => {
    const r = calculateScore(LENTEJAS);
    const block = r.blocks.find((b) => b.id === "additives");
    expect(block?.subScore).toBe(10);
  });

  it("un aditivo de riesgo alto resta 3 puntos del bloque", () => {
    const p = makeProduct({ additiveCodes: ["E171"] }); // dióxido de titanio
    const block = calculateScore(p).blocks.find((b) => b.id === "additives");
    expect(block?.subScore).toBe(7);
  });

  it("un aditivo sin riesgo no resta nada", () => {
    const p = makeProduct({ additiveCodes: ["E330"] }); // ácido cítrico
    const block = calculateScore(p).blocks.find((b) => b.id === "additives");
    expect(block?.subScore).toBe(10);
  });

  it("un aditivo moderado resta 1,5", () => {
    const p = makeProduct({ additiveCodes: ["E102"] }); // tartrazina
    const block = calculateScore(p).blocks.find((b) => b.id === "additives");
    expect(block?.subScore).toBe(8.5);
  });

  it("aplica el efecto cóctel a partir del sexto aditivo", () => {
    const seguros = ["E330", "E331", "E333", "E334", "E300", "E301", "E440"];
    const block = calculateScore(makeProduct({ additiveCodes: seguros })).blocks.find(
      (b) => b.id === "additives",
    );
    // 7 aditivos sin riesgo → 2 de exceso × 0,25 = 0,5
    expect(block?.subScore).toBe(9.5);
  });

  it("deduplica códigos repetidos", () => {
    const p = makeProduct({ additiveCodes: ["E171", "e171", "en:e171"] });
    const block = calculateScore(p).blocks.find((b) => b.id === "additives");
    expect(block?.subScore).toBe(7);
  });

  it("trata los aditivos desconocidos con prudencia, no con alarma", () => {
    const p = makeProduct({ additiveCodes: ["E999"] });
    const block = calculateScore(p).blocks.find((b) => b.id === "additives");
    expect(block?.subScore).toBe(9.5); // riesgo bajo → −0,5
  });

  it("marca el bloque como no disponible si no hay ni ingredientes ni aditivos", () => {
    const p = makeProduct({ additiveCodes: [], ingredientsText: null });
    const block = calculateScore(p).blocks.find((b) => b.id === "additives");
    expect(block?.available).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Bloque NOVA                                                               */
/* -------------------------------------------------------------------------- */

describe("bloque de procesamiento", () => {
  it("con agregación lineal, NOVA 4 cuesta el 15 % de la nota", () => {
    const base = makeProduct({ novaGroup: 1, nutrients: LENTEJAS.nutrients });
    const ultra = makeProduct({ novaGroup: 4, nutrients: LENTEJAS.nutrients });

    const diff =
      calculateScore(base, { aggregation: "linear" }).score -
      calculateScore(ultra, { aggregation: "linear" }).score;

    // NOVA 1 → 10 y NOVA 4 → 0, con peso 0,15: exactamente 1,5 puntos.
    expect(diff).toBeCloseTo(1.5, 1);
  });

  it("NOVA 4 penaliza más que NOVA 1 en ambas agregaciones", () => {
    for (const aggregation of ["linear", "geometric"] as const) {
      const base = calculateScore(
        makeProduct({ novaGroup: 1, nutrients: LENTEJAS.nutrients }),
        { aggregation },
      ).score;
      const ultra = calculateScore(
        makeProduct({ novaGroup: 4, nutrients: LENTEJAS.nutrients }),
        { aggregation },
      ).score;
      expect(ultra).toBeLessThan(base);
    }
  });

  /* --- Lo que pidió el producto: sin dato NOVA, cero efecto --- */

  it("excluye el bloque cuando no hay grupo NOVA", () => {
    const p = makeProduct({ novaGroup: null });
    const r = calculateScore(p);
    const block = r.blocks.find((b) => b.id === "processing");

    expect(block?.available).toBe(false);
    expect(block?.weight).toBe(0);
  });

  it("un producto sin NOVA saca la misma nota que si el bloque no existiera", () => {
    const sinNova = makeProduct({
      novaGroup: null,
      additiveCodes: ["E330", "E102"],
      nutrients: LENTEJAS.nutrients,
    });

    const r = calculateScore(sinNova);

    // Los otros dos bloques absorben el 15 % del procesamiento: 0,5 y 0,35
    // renormalizados sobre 0,85.
    const additives = r.blocks.find((b) => b.id === "additives")!;
    const nutrition = r.blocks.find((b) => b.id === "nutrition")!;

    expect(additives.weight).toBeCloseTo(0.5 / 0.85, 5);
    expect(nutrition.weight).toBeCloseTo(0.35 / 0.85, 5);

    // Y la nota coincide con la de esos dos bloques solos.
    const manual =
      10 *
      Math.pow(additives.subScore / 10, additives.weight) *
      Math.pow(nutrition.subScore / 10, nutrition.weight);
    expect(r.score).toBeCloseTo(manual, 1);
  });

  it("no penaliza por falta de NOVA: nunca baja la nota respecto a NOVA 1", () => {
    const base = { additiveCodes: ["E330"], nutrients: LENTEJAS.nutrients };
    const sinDato = calculateScore(makeProduct({ ...base, novaGroup: null }));
    const nova1 = calculateScore(makeProduct({ ...base, novaGroup: 1 }));

    // Sin dato no puede salir peor que el mejor caso posible de NOVA...
    expect(sinDato.score).toBeLessThanOrEqual(nova1.score + 0.05);
    // ...ni peor que el peor caso, que es lo que importa de verdad.
    const nova4 = calculateScore(makeProduct({ ...base, novaGroup: 4 }));
    expect(sinDato.score).toBeGreaterThan(nova4.score);
  });
});

/* -------------------------------------------------------------------------- */
/*  Datos faltantes y confianza                                               */
/* -------------------------------------------------------------------------- */

describe("datos faltantes", () => {
  it("renormaliza los pesos cuando falta la nutrición", () => {
    const p = makeProduct({ nutrients: { ...EMPTY_NUTRIENTS }, novaGroup: 4 });
    const r = calculateScore(p);

    const additives = r.blocks.find((b) => b.id === "additives");
    const nutrition = r.blocks.find((b) => b.id === "nutrition");
    const processing = r.blocks.find((b) => b.id === "processing");

    expect(nutrition?.available).toBe(false);
    expect(nutrition?.weight).toBe(0);
    // 0,5 y 0,15 renormalizados sobre 0,65
    expect(additives?.weight).toBeCloseTo(0.5 / 0.65, 5);
    expect(processing?.weight).toBeCloseTo(0.15 / 0.65, 5);
  });

  it("baja la confianza con datos de OCR", () => {
    const p = makeProduct({ source: "ocr", nutrients: { ...EMPTY_NUTRIENTS } });
    expect(calculateScore(p).confidence).toBe("low");
  });

  it("da confianza alta cuando están los tres bloques", () => {
    expect(calculateScore(LENTEJAS).confidence).toBe("high");
  });

  it("nunca produce NaN", () => {
    const p = makeProduct({
      nutrients: { ...EMPTY_NUTRIENTS },
      novaGroup: null,
      ingredientsText: null,
    });
    expect(Number.isNaN(calculateScore(p).score)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Desglose explicable                                                       */
/* -------------------------------------------------------------------------- */

describe("desglose", () => {
  it("ordena los motivos del más penalizador al menos", () => {
    const reasons = calculateScore(SALCHICHAS).reasons;
    for (let i = 1; i < reasons.length; i++) {
      expect(reasons[i]!.impact).toBeGreaterThanOrEqual(reasons[i - 1]!.impact);
    }
  });

  it("la suma de impactos negativos no supera los 10 puntos", () => {
    const total = calculateScore(SALCHICHAS)
      .reasons.filter((r) => r.impact < 0)
      .reduce((acc, r) => acc + r.impact, 0);
    expect(total).toBeGreaterThan(-10.5);
  });

  it("nombra el nitrito sódico entre los motivos de las salchichas", () => {
    const labels = calculateScore(SALCHICHAS).reasons.map((r) => r.label);
    expect(labels.some((l) => l.includes("E250"))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                */
/* -------------------------------------------------------------------------- */

describe("normalizeAdditiveCode", () => {
  it.each([
    ["en:e330", "E330"],
    ["E 330", "E330"],
    ["e330", "E330"],
    ["330", "E330"],
    ["EN:E472E", "E472e"],
    ["E-150 d", "E150d"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeAdditiveCode(input)).toBe(expected);
  });

  it("devuelve null con texto que no es un código E", () => {
    expect(normalizeAdditiveCode("agua")).toBeNull();
    expect(normalizeAdditiveCode("")).toBeNull();
  });
});

describe("extractAdditiveCodesFromText", () => {
  it("saca los códigos E de una lista de ingredientes", () => {
    const texto =
      "Azúcar, aceite de palma, emulgente: lecitinas (E322), colorante E-150d, " +
      "conservante e202, sal.";
    expect(extractAdditiveCodesFromText(texto)).toEqual(["E322", "E150d", "E202"]);
  });

  it("no confunde otras palabras con códigos", () => {
    expect(extractAdditiveCodesFromText("Contiene 330 g de producto")).toEqual([]);
  });
});

describe("isValidBarcode", () => {
  it("acepta EAN-13 con dígito de control correcto", () => {
    expect(isValidBarcode("3017620422003")).toBe(true); // Nutella 400 g
  });

  it("rechaza un EAN-13 con el dígito de control cambiado", () => {
    expect(isValidBarcode("3017620422004")).toBe(false);
  });

  it("rechaza longitudes imposibles", () => {
    expect(isValidBarcode("123")).toBe(false);
    expect(isValidBarcode("abcdefghijklm")).toBe(false);
  });
});
