import { describe, expect, it } from "vitest";
import type { OffProduct } from "@/types/product";
import { normalizeOffProduct } from "@/lib/openfoodfacts";
import { calculateScore } from "@/utils/calculator";

/**
 * Respuesta representativa de `/api/v2/product/...`, con las rarezas reales
 * de Open Food Facts: `nova_group` como string, sodio en gramos, aditivos con
 * prefijo de idioma y nombre del producto sólo en el campo genérico.
 */
const RAW: OffProduct = {
  code: "3017620422003",
  product_name: "Nutella",
  brands: "Ferrero, Nutella",
  quantity: "400 g",
  image_front_url: "https://images.openfoodfacts.org/images/products/front.jpg",
  ingredients_text_es:
    "Azúcar, aceite de palma, avellanas 13%, leche desnatada en polvo 8,7%, cacao desgrasado 7,4%, emulgente: lecitinas (soja), aroma: vainillina.",
  additives_tags: ["en:e322", "en:e322i"],
  categories_tags: ["en:spreads", "en:sweet-spreads", "en:hazelnut-spreads"],
  nova_group: "4",
  nutriscore_grade: "e",
  nutriments: {
    "energy-kcal_100g": 539,
    "fat_100g": 30.9,
    "saturated-fat_100g": 10.6,
    "carbohydrates_100g": 57.5,
    "sugars_100g": 56.3,
    "fiber_100g": 3.4,
    "proteins_100g": 6.3,
    "salt_100g": 0.107,
    "fruits-vegetables-nuts-estimate-from-ingredients_100g": 13,
  },
};

describe("normalizeOffProduct", () => {
  const product = normalizeOffProduct(RAW);

  it("se queda con la primera marca", () => {
    expect(product.brand).toBe("Ferrero");
  });

  it("convierte kcal a kJ cuando no viene la energía en kJ", () => {
    // 539 kcal × 4,184 ≈ 2255 kJ
    expect(product.nutrients.energyKj).toBeGreaterThan(2200);
    expect(product.nutrients.energyKj).toBeLessThan(2300);
  });

  it("deriva el sodio en mg a partir de la sal en g", () => {
    // 0,107 g de sal ÷ 2,5 × 1000 ≈ 42,8 mg de sodio
    expect(product.nutrients.sodiumMg).toBeCloseTo(42.8, 1);
  });

  it("normaliza los tags de aditivos quitando el prefijo de idioma", () => {
    expect(product.additiveCodes).toContain("E322");
    expect(product.additiveCodes.every((c) => c.startsWith("E"))).toBe(true);
  });

  it("acepta nova_group como cadena", () => {
    expect(product.novaGroup).toBe(4);
  });

  it("detecta que no es una bebida", () => {
    expect(product.isBeverage).toBe(false);
    expect(product.isWater).toBe(false);
  });

  it("identifica el azúcar como el principal problema", () => {
    const result = calculateScore(product);

    expect(result.confidence).toBe("high");
    expect(result.reasons.some((r) => r.label.startsWith("Azúcares"))).toBe(true);
    expect(result.blocks.find((b) => b.id === "processing")?.subScore).toBe(0);
  });

  /**
   * Caso testigo del suelo estructural del modelo lineal: este producto tiene
   * 56 g de azúcar por 100 g, grasa de palma y NOVA 4, pero como su único
   * aditivo es lecitina (sin riesgo) el bloque de aditivos —que pesa el 50 %—
   * le regala 5 puntos fijos. La nota no puede bajar de ahí, así que jamás
   * entrará en la banda roja.
   */
  it("con agregación lineal se queda en naranja pese al azúcar", () => {
    const result = calculateScore(product, { aggregation: "linear" });

    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.color).toBe("orange");
  });

  it("con agregación geométrica sí entra en la banda roja", () => {
    const result = calculateScore(product, { aggregation: "geometric" });

    expect(result.score).toBeLessThan(5);
    expect(result.color).toBe("red");
  });
});

describe("normalizeOffProduct · datos incompletos", () => {
  it("no rompe con un producto casi vacío", () => {
    const product = normalizeOffProduct({ code: "123" });

    expect(product.name).toBe("Producto sin nombre");
    expect(product.additiveCodes).toEqual([]);
    expect(product.nutrients.sugars).toBeNull();

    const result = calculateScore(product);
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.confidence).toBe("low");
  });
});
