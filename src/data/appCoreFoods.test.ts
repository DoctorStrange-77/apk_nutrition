import { describe, expect, it } from 'vitest';
import { APP_CORE_FOODS, CORE_LIBRARY_VERSION } from '@/data/appCoreFoods';

describe('App Nutrition core food library', () => {
  it('contains a compact but sufficiently broad sports-food pool', () => {
    expect(APP_CORE_FOODS.length).toBeGreaterThanOrEqual(70);
    expect(APP_CORE_FOODS.length).toBeLessThanOrEqual(120);

    const counts = APP_CORE_FOODS.reduce<Record<string, number>>((acc, food) => {
      acc[food.category] = (acc[food.category] || 0) + 1;
      return acc;
    }, {});

    expect(counts.carb).toBeGreaterThanOrEqual(22);
    expect(counts.protein).toBeGreaterThanOrEqual(20);
    expect(counts.fat).toBeGreaterThanOrEqual(10);
    expect(counts.mixed).toBeGreaterThanOrEqual(8);
  });

  it('contains only curated core foods with valid provenance and macros', () => {
    expect(CORE_LIBRARY_VERSION).toMatch(/^core-\d{4}\.\d{2}$/);
    const ids = new Set<string>();

    for (const food of APP_CORE_FOODS) {
      expect(ids.has(food.id)).toBe(false);
      ids.add(food.id);
      expect(food.source).toBe('core');
      expect(food.dataSource).toBe('App Nutrition Core');
      expect(food.sourceReference).toContain('CREA');
      expect(food.sourceReference).toContain('USDA');
      for (const value of [food.carbs, food.protein, food.fat]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(food.suitable.length).toBeGreaterThan(0);
    }
  });

  it('does not embed branded commercial products in the generator core', () => {
    const commercialTerms = [
      'mulino bianco', 'fage', 'danone', 'lidl', 'eurospin', 'hero', 'hipro',
    ];
    const corpus = APP_CORE_FOODS
      .map((food) => `${food.name} ${food.brand || ''}`.toLowerCase())
      .join(' ');

    for (const term of commercialTerms) expect(corpus).not.toContain(term);
    expect(APP_CORE_FOODS.every((food) => !food.barcode)).toBe(true);
  });
});
