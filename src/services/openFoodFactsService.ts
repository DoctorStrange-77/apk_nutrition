import type { LocalFood } from '@/types/nutrition';

interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  product_name_it?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

interface OpenFoodFactsResponse {
  status?: number;
  status_verbose?: string;
  product?: OpenFoodFactsProduct;
}

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const LOOKUP_TIMEOUT_MS = 10_000;

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

export async function lookupOpenFoodFacts(barcode: string): Promise<LocalFood | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const fields = 'code,product_name,product_name_it,generic_name,brands,nutriments';
    const response = await fetch(`${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json?fields=${fields}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`OPEN_FOOD_FACTS_HTTP_${response.status}`);

    const payload = await response.json() as OpenFoodFactsResponse;
    if (payload.status !== 1 || !payload.product) return null;

    const product = payload.product;
    const nutriments = product.nutriments || {};
    const carbs = asNumber(nutriments.carbohydrates_100g, nutriments.carbohydrates);
    const protein = asNumber(nutriments.proteins_100g, nutriments.proteins);
    const fat = asNumber(nutriments.fat_100g, nutriments.fat);

    if (carbs === null || protein === null || fat === null) {
      throw new Error('OPEN_FOOD_FACTS_NUTRIMENTS_MISSING');
    }

    const name = product.product_name_it?.trim()
      || product.product_name?.trim()
      || product.generic_name?.trim()
      || `Prodotto ${barcode}`;

    const fiber = asNumber(nutriments.fiber_100g, nutriments.fiber);

    return {
      id: `off-${barcode}`,
      name,
      brand: product.brands?.trim() || undefined,
      barcode,
      category: inferCategory(carbs, protein, fat),
      carbs,
      protein,
      fat,
      fiber: fiber ?? undefined,
      suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
      source: 'external',
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OPEN_FOOD_FACTS_TIMEOUT');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
