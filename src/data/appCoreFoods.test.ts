import { describe, expect, it } from 'vitest';
import { APP_CORE_FOODS, CORE_LIBRARY_VERSION } from '@/data/appCoreFoods';

describe('Smart Nutrition core food library', () => {
  it('contains a compact but sufficiently broad sports-food pool', () => {
    expect(APP_CORE_FOODS.length).toBeGreaterThanOrEqual(250);
    expect(APP_CORE_FOODS.length).toBeLessThanOrEqual(320);

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
      expect(['Smart Nutrition Core', 'Open Food Facts']).toContain(food.dataSource);
      if (food.dataSource === 'Open Food Facts') {
        expect(food.barcode).toBeTruthy();
        expect(food.brand).toBeTruthy();
        expect(food.sourceReference).toContain('Open Food Facts');
      } else {
        expect(food.sourceReference).toContain('CREA');
        expect(food.sourceReference).toContain('USDA');
      }
      for (const value of [food.carbs, food.protein, food.fat]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(food.suitable.length).toBeGreaterThan(0);
    }
  });

  it('includes a curated branded high-protein supermarket section', () => {
    const branded = APP_CORE_FOODS.filter((food) => food.dataSource === 'Open Food Facts');
    expect(branded.length).toBeGreaterThanOrEqual(25);

    const brands = branded.map((food) => food.brand?.toLowerCase() || '').join(' ');
    for (const required of ['milbona', 'milk pro', 'müller', 'ehrmann', 'danone', 'fage']) {
      expect(brands).toContain(required);
    }

    for (const food of branded) {
      expect(food.protein).toBeGreaterThanOrEqual(6);
      expect(food.barcode).toBeTruthy();
      expect(food.sourceReference).toContain(food.barcode!);
    }
  });
});
