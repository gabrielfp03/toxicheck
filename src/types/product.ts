/**
 * Tipos de producto.
 *
 * Separamos deliberadamente dos capas:
 *
 *  1. `OffProduct`  → la forma CRUDA que devuelve Open Food Facts. Es un JSON
 *     enorme, inconsistente y con campos opcionales por todas partes. Lo
 *     tipamos parcialmente (sólo lo que consumimos) y siempre como opcional.
 *
 *  2. `Product`     → nuestro modelo normalizado. Todo lo que entra al
 *     algoritmo pasa por aquí. Así el calculador nunca depende del formato de
 *     un tercero y podemos añadir otras fuentes (OCR, entrada manual, otra
 *     base de datos) sin tocar una línea del scoring.
 */

/* -------------------------------------------------------------------------- */
/*  1. Capa cruda: Open Food Facts                                            */
/* -------------------------------------------------------------------------- */

/** Nutrientes por 100 g / 100 ml tal y como los publica Open Food Facts. */
export interface OffNutriments {
  /** Energía en kJ por 100 g. */
  "energy-kj_100g"?: number;
  /** Energía en kcal por 100 g. */
  "energy-kcal_100g"?: number;
  "fat_100g"?: number;
  "saturated-fat_100g"?: number;
  "carbohydrates_100g"?: number;
  "sugars_100g"?: number;
  "fiber_100g"?: number;
  "proteins_100g"?: number;
  /** Sal en gramos por 100 g. */
  "salt_100g"?: number;
  /** Sodio en gramos por 100 g (ojo: gramos, no miligramos). */
  "sodium_100g"?: number;
  "fruits-vegetables-nuts-estimate-from-ingredients_100g"?: number;
  "fruits-vegetables-nuts_100g"?: number;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  image_front_url?: string;
  image_url?: string;
  ingredients_text?: string;
  ingredients_text_es?: string;
  /** Tags de aditivos: `["en:e330", "en:e471", ...]` */
  additives_tags?: string[];
  categories_tags?: string[];
  /** Grupo NOVA: 1 a 4. A veces llega como string. */
  nova_group?: number | string;
  nutriscore_grade?: string;
  nutriments?: OffNutriments;
  allergens_tags?: string[];
  labels_tags?: string[];
}

/** Envoltorio de la respuesta de `/api/v2/product/{barcode}`. */
export interface OffApiResponse {
  status: 0 | 1;
  status_verbose?: string;
  code?: string;
  product?: OffProduct;
}

/* -------------------------------------------------------------------------- */
/*  2. Capa normalizada: lo que consume el algoritmo                          */
/* -------------------------------------------------------------------------- */

/** Todos los valores son por 100 g / 100 ml. `null` = dato no disponible. */
export interface Nutrients {
  /** Energía en kJ. Si OFF sólo da kcal, la convertimos (1 kcal = 4.184 kJ). */
  energyKj: number | null;
  sugars: number | null;
  saturatedFat: number | null;
  /** Sodio en MILIGRAMOS por 100 g (Nutri-Score trabaja en mg). */
  sodiumMg: number | null;
  fiber: number | null;
  proteins: number | null;
  /** Porcentaje estimado de fruta, verdura, legumbre y frutos secos (0-100). */
  fruitsVegetablesNuts: number | null;
}

/** Grupo NOVA de procesamiento. `null` cuando la fuente no lo informa. */
export type NovaGroup = 1 | 2 | 3 | 4;

/** De dónde salieron los datos. Afecta a la confianza del resultado. */
export type ProductSource = "openfoodfacts" | "ocr" | "manual";

export interface Product {
  /** EAN-13 / EAN-8 / UPC-A. Para OCR o entrada manual puede ser `null`. */
  barcode: string | null;
  name: string;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  /**
   * Códigos E normalizados EN MAYÚSCULAS y sin espacios: `["E330", "E471"]`.
   * La normalización vive en `lib/openfoodfacts.ts` y `utils/additives.ts`.
   */
  additiveCodes: string[];
  novaGroup: NovaGroup | null;
  /** Letra Nutri-Score oficial de OFF, si existe. Sólo informativa. */
  nutriScoreGrade: "a" | "b" | "c" | "d" | "e" | null;
  nutrients: Nutrients;
  /** `true` si es bebida: Nutri-Score usa otra tabla de umbrales. */
  isBeverage: boolean;
  /** `true` si es agua embotellada (caso especial del Nutri-Score). */
  isWater: boolean;
  source: ProductSource;
  fetchedAt: number;
}
