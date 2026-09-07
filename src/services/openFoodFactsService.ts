import type { LocalFood } from '@/types/nutrition';

export interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  product_name_it?: string;
  generic_name?: string;
  brands?: string | string[];
  nutriments?: Record<string, unknown>;
}

interface OpenFoodFactsProductResponse {
  product?: OpenFoodFactsProduct;
}

interface SearchHit {
  _source?: OpenFoodFactsProduct;
  document?: OpenFoodFactsProduct;
  [key: string]: unknown;
}

interface SearchResponse {
  hits?: SearchHit[];
}

const OFF_PRODUCT_BASE_URL = 'https://world.openfoodfacts.org/api/v3/product';
const OFF_SEARCH_BASE_URL = 'https://search.openfoodfacts.org/search';
const LOOKUP_TIMEOUT_MS = 10_000;
const asBrand = (value: OpenFoodFactsProduct['brands']): string | undefined => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(', ') || undefined;
  return value?.trim() || undefined;
};

const asNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const inferCategory = (carbs: number, protein: number, fat: number): LocalFood['category'] => {
  const energy = { carb: carbs * 4, protein: protein * 4, fat: fat * 9 };
  const total = energy.carb + energy.protein + energy.fat;
  if (total <= 0) return 'mixed';

  const relevant = Object.values(energy).filter((value) => value / total >= 0.2).length;
  if (relevant >= 2) return 'mixed';
  if (energy.protein >= energy.carb && energy.protein >= energy.fat) return 'protein';
  if (energy.fat >= energy.carb && energy.fat >= energy.protein) return 'fat';
  return 'carb';
};

export function normalizeOpenFoodFactsProduct(product: OpenFoodFactsProduct): LocalFood | null {
  const barcode = product.code?.trim();
  const nutriments = product.nutriments || {};
  if (!barcode) return null;

  const carbs = asNumber(nutriments.carbohydrates_100g, nutriments.carbohydrates);
  const protein = asNumber(nutriments.proteins_100g, nutriments.proteins);
  const fat = asNumber(nutriments.fat_100g, nutriments.fat);
  if (carbs === null || protein === null || fat === null) return null;

  const name = product.product_name_it?.trim()
    || product.product_name?.trim()
    || product.generic_name?.trim()
    || `Prodotto ${barcode}`;
  const fiber = asNumber(nutriments.fiber_100g, nutriments.fiber);

  return {
    id: `off-${barcode}`,
    name,
    brand: asBrand(product.brands),
    barcode,
    category: inferCategory(carbs, protein, fat),
    carbs,
    protein,
    fat,
    fiber: fiber ?? undefined,
    suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
    source: 'external',
    dataSource: 'Open Food Facts',
    sourceReference: `Open Food Facts barcode ${barcode}`,
    verifiedAt: new Date().toISOString().slice(0, 10),
  };
}

export function buildOpenFoodFactsSearchUrl(query: string, pageSize = 20): URL {
  const url = new URL(OFF_SEARCH_BASE_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('page', '1');
  url.searchParams.set('page_size', String(Math.max(1, Math.min(50, pageSize))));
  url.searchParams.set('langs', 'it,en');
  url.searchParams.set(
    'fields',
    'code,product_name,product_name_it,generic_name,brands,nutriments',
  );
  return url;
}

const extractSearchProduct = (hit: SearchHit): OpenFoodFactsProduct | null => {
  if (hit._source) return hit._source;
  if (hit.document) return hit.document;
  if ('code' in hit || 'product_name' in hit) return hit as OpenFoodFactsProduct;
  return null;
};
export async function searchOpenFoodFacts(query: string, pageSize = 20): Promise<LocalFood[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(buildOpenFoodFactsSearchUrl(normalizedQuery, pageSize), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OPEN_FOOD_FACTS_SEARCH_HTTP_${response.status}`);

    const payload = await response.json() as SearchResponse;
    const results = (payload.hits || [])
      .map(extractSearchProduct)
      .filter((product): product is OpenFoodFactsProduct => !!product)
      .map(normalizeOpenFoodFactsProduct)
      .filter((food): food is LocalFood => !!food);
    return [...new Map(results.map((food) => [food.id, food])).values()];
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
export async function lookupOpenFoodFacts(barcode: string): Promise<LocalFood | null> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const fields = 'code,product_name,product_name_it,generic_name,brands,nutriments';
    const url = `${OFF_PRODUCT_BASE_URL}/${encodeURIComponent(barcode)}?fields=${fields}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`OPEN_FOOD_FACTS_HTTP_${response.status}`);

    const payload = await response.json() as OpenFoodFactsProductResponse;
    return payload.product ? normalizeOpenFoodFactsProduct(payload.product) : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OPEN_FOOD_FACTS_TIMEOUT');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
