import { describe, expect, it } from 'vitest';
import {
  buildOpenFoodFactsSearchUrl,
  normalizeOpenFoodFactsProduct,
} from '@/services/openFoodFactsService';

describe('Open Food Facts service', () => {
  it('normalizes an OFF product into a Smart Nutrition food', () => {
    const food = normalizeOpenFoodFactsProduct({
      code: '1234567890123',
      product_name_it: 'Yogurt greco',
      brands: 'Marca Test',
      nutriments: {
        carbohydrates_100g: 4,
        proteins_100g: 10,
        fat_100g: 0.2,
        fiber_100g: 0,
      },
    });

    expect(food?.id).toBe('off-1234567890123');
    expect(food?.source).toBe('external');
    expect(food?.dataSource).toBe('Open Food Facts');
    expect(food?.carbs).toBe(4);
    expect(food?.protein).toBe(10);
    expect(food?.fat).toBe(0.2);
  });

  it('accepts Search-a-licious brand arrays', () => {
    const food = normalizeOpenFoodFactsProduct({
      code: '20692285',
      product_name_it: 'Skyr Natural',
      brands: ['Milbona'] as unknown as string,
      nutriments: { carbohydrates_100g: 4, proteins_100g: 11, fat_100g: 0.2 },
    });
    expect(food?.brand).toBe('Milbona');
  });

  it('rejects products without the three core macronutrients', () => {
    const food = normalizeOpenFoodFactsProduct({
      code: '1234567890123',
      product_name: 'Incomplete',
      nutriments: { proteins_100g: 10, fat_100g: 2 },
    });
    expect(food).toBeNull();
  });

  it('builds a Search-a-licious query without search-as-you-type noise', () => {
    const url = buildOpenFoodFactsSearchUrl('yogurt greco', 20);
    expect(url.origin).toBe('https://search.openfoodfacts.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('yogurt greco');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('langs')).toContain('it');
    expect(url.searchParams.get('fields')).toContain('nutriments');
  });
});
