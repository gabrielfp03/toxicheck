/**
 * Cliente de Open Food Facts.
 *
 * Tres decisiones importantes:
 *
 *  1. **Se llama desde el navegador**, no desde el servidor. Open Food Facts
 *     permite CORS, así que no necesitamos una API route intermedia: cero
 *     invocaciones serverless, cero coste, escalado infinito.
 *
 *  2. **Pedimos sólo los campos que usamos** (`?fields=...`). La respuesta
 *     completa de un producto puede superar los 100 KB; así baja a ~2 KB.
 *     En móvil con datos esto se nota.
 *
 *  3. **Toda la normalización vive aquí.** El resto de la app no sabe que
 *     Open Food Facts existe.
 */

import type {
  NovaGroup,
  Nutrients,
  OffApiResponse,
  OffProduct,
  Product,
} from "@/types/product";
import { normalizeAdditiveCode } from "@/utils/additives";
import { parseNovaGroup } from "@/utils/nova";

const API_BASE = "https://world.openfoodfacts.org/api/v2";

/**
 * Open Food Facts pide una User-Agent identificativa. En el navegador la
 * cabecera `User-Agent` es de sólo lectura, así que enviamos el identificador
 * como parámetro de consulta, que es la alternativa que ellos documentan.
 */
const APP_IDENTIFIER = "Toxicheck/1.0 (https://toxicheck.net)";

const FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "generic_name",
  "brands",
  "quantity",
  "image_front_url",
  "image_url",
  "ingredients_text",
  "ingredients_text_es",
  "additives_tags",
  "categories_tags",
  "nova_group",
  "nutriscore_grade",
  "nutriments",
  "allergens_tags",
  "labels_tags",
].join(",");

/** Error tipado para poder distinguir "no existe" de "no hay red". */
export class ProductNotFoundError extends Error {
  constructor(public readonly barcode: string) {
    super(`El producto ${barcode} no está en Open Food Facts.`);
    this.name = "ProductNotFoundError";
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "NetworkError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Validación de códigos de barras                                           */
/* -------------------------------------------------------------------------- */

/**
 * Comprueba el dígito de control de un EAN-8, EAN-13 o UPC-A.
 * Filtra lecturas erróneas del escáner antes de gastar una petición de red.
 */
export function isValidBarcode(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;

  const digits = [...code].map(Number);
  const check = digits.pop();
  if (check === undefined) return false;

  // De derecha a izquierda: 3, 1, 3, 1...
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === check;
}

/* -------------------------------------------------------------------------- */
/*  Normalización                                                             */
/* -------------------------------------------------------------------------- */

/** `1 kcal = 4.184 kJ` */
const KCAL_TO_KJ = 4.184;

const num = (v: number | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function normalizeNutrients(off: OffProduct): Nutrients {
  const n = off.nutriments ?? {};

  const energyKj =
    num(n["energy-kj_100g"]) ??
    (num(n["energy-kcal_100g"]) !== null
      ? Math.round(n["energy-kcal_100g"]! * KCAL_TO_KJ)
      : null);

  // OFF da el sodio en gramos. El Nutri-Score trabaja en miligramos.
  const sodiumG = num(n["sodium_100g"]);
  const saltG = num(n["salt_100g"]);
  const sodiumMg =
    sodiumG !== null
      ? sodiumG * 1000
      : saltG !== null
        ? (saltG / 2.5) * 1000 // 1 g de sal ≈ 400 mg de sodio
        : null;

  return {
    energyKj,
    sugars: num(n["sugars_100g"]),
    saturatedFat: num(n["saturated-fat_100g"]),
    sodiumMg,
    fiber: num(n["fiber_100g"]),
    proteins: num(n["proteins_100g"]),
    fruitsVegetablesNuts:
      num(n["fruits-vegetables-nuts_100g"]) ??
      num(n["fruits-vegetables-nuts-estimate-from-ingredients_100g"]),
  };
}

const BEVERAGE_TAGS = [
  "en:beverages",
  "en:non-alcoholic-beverages",
  "en:sodas",
  "en:waters",
  "en:fruit-juices",
  "en:iced-teas",
  "en:energy-drinks",
];

const WATER_TAGS = ["en:waters", "en:spring-waters", "en:mineral-waters"];

/**
 * Convierte la respuesta cruda de Open Food Facts en nuestro `Product`.
 * Es la única función del proyecto que conoce el formato del tercero.
 */
export function normalizeOffProduct(off: OffProduct): Product {
  const categories = off.categories_tags ?? [];

  const additiveCodes = (off.additives_tags ?? [])
    .map(normalizeAdditiveCode)
    .filter((c): c is string => c !== null);

  const ingredientsText =
    off.ingredients_text_es?.trim() || off.ingredients_text?.trim() || null;

  // Si OFF no trae NOVA, se queda en null a propósito: el bloque de
  // procesamiento se excluirá del cálculo en lugar de penalizar a ciegas.
  const novaGroup: NovaGroup | null = parseNovaGroup(off.nova_group);

  const grade = off.nutriscore_grade?.toLowerCase();
  const nutriScoreGrade =
    grade === "a" || grade === "b" || grade === "c" || grade === "d" || grade === "e"
      ? grade
      : null;

  return {
    barcode: off.code ?? null,
    name:
      off.product_name_es?.trim() ||
      off.product_name?.trim() ||
      off.generic_name?.trim() ||
      "Producto sin nombre",
    brand: off.brands?.split(",")[0]?.trim() || null,
    quantity: off.quantity?.trim() || null,
    imageUrl: off.image_front_url || off.image_url || null,
    ingredientsText,
    additiveCodes,
    novaGroup,
    nutriScoreGrade,
    nutrients: normalizeNutrients(off),
    isBeverage: categories.some((t) => BEVERAGE_TAGS.includes(t)),
    isWater: categories.some((t) => WATER_TAGS.includes(t)),
    source: "openfoodfacts",
    fetchedAt: Date.now(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Fetch                                                                     */
/* -------------------------------------------------------------------------- */

/** Caché en memoria: evita repetir la petición al volver atrás en la app. */
const memoryCache = new Map<string, Product>();

/** Vaciar la caché (útil en tests y al cambiar de versión del algoritmo). */
export function clearProductCache(): void {
  memoryCache.clear();
}

export interface FetchOptions {
  signal?: AbortSignal;
  /** Milisegundos antes de abortar. Por defecto 8000. */
  timeoutMs?: number;
  /** Saltarse la caché en memoria. */
  force?: boolean;
}

/**
 * Descarga un producto por código de barras y lo devuelve ya normalizado.
 *
 * @throws {ProductNotFoundError} si el código no está en la base de datos.
 * @throws {NetworkError} si falla la red o el servidor responde con error.
 *
 * @example
 * ```ts
 * const product = await fetchProductByBarcode("3017620422003");
 * const score = calculateScore(product);
 * ```
 */
export async function fetchProductByBarcode(
  barcode: string,
  options: FetchOptions = {},
): Promise<Product> {
  const clean = barcode.trim();

  if (!options.force) {
    const cached = memoryCache.get(clean);
    if (cached) return cached;
  }

  const { timeoutMs = 8000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Encadenamos la señal externa con la del timeout.
  options.signal?.addEventListener("abort", () => controller.abort(), {
    once: true,
  });

  const url =
    `${API_BASE}/product/${encodeURIComponent(clean)}` +
    `?fields=${FIELDS}&app_name=${encodeURIComponent(APP_IDENTIFIER)}`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) throw new ProductNotFoundError(clean);
    if (!res.ok) throw new NetworkError(`Open Food Facts respondió ${res.status}`);

    const data = (await res.json()) as OffApiResponse;

    if (data.status !== 1 || !data.product) {
      throw new ProductNotFoundError(clean);
    }

    const product = normalizeOffProduct(data.product);
    memoryCache.set(clean, product);
    return product;
  } catch (error) {
    if (error instanceof ProductNotFoundError || error instanceof NetworkError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new NetworkError("La petición ha tardado demasiado.", error);
    }
    throw new NetworkError("No se ha podido conectar con Open Food Facts.", error);
  } finally {
    clearTimeout(timer);
  }
}

/** Enlace público a la ficha del producto, para dar atribución a OFF. */
export function offProductUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/product/${barcode}`;
}
