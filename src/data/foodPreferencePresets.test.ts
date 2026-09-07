import { describe, expect, it } from 'vitest';
import { APP_CORE_FOODS } from '@/data/appCoreFoods';
import { BUILT_IN_TIMINGS } from '@/data/builtInTimings';
import { generateNutritionMenu } from '@/engine/nutritionEngine';
import {
  FOOD_PREFERENCE_PRESETS,
  filterFoodsByPreferencePreset,
} from '@/data/foodPreferencePresets';

describe('food preference presets', () => {
  it('keeps the complete core unchanged in the all preset', () => {
    const filtered = filterFoodsByPreferencePreset(APP_CORE_FOODS, 'all');
    expect(filtered).toHaveLength(APP_CORE_FOODS.length);
  });

  it('creates a substantial bodybuilding pool with all macro roles', () => {
    const filtered = filterFoodsByPreferencePreset(APP_CORE_FOODS, 'bodybuilding');
    expect(filtered.length).toBeGreaterThanOrEqual(140);
    expect(filtered.length).toBeLessThan(APP_CORE_FOODS.length);

    const counts = filtered.reduce<Record<string, number>>((acc, food) => {
      acc[food.category] = (acc[food.category] || 0) + 1;
      return acc;
    }, {});
    expect(counts.carb).toBeGreaterThanOrEqual(35);
    expect(counts.protein).toBeGreaterThanOrEqual(45);
    expect(counts.fat).toBeGreaterThanOrEqual(15);
  });
  it('includes common bodybuilding staples and branded protein foods', () => {
    const filtered = filterFoodsByPreferencePreset(APP_CORE_FOODS, 'bodybuilding');
    const corpus = filtered.map((food) => `${food.id} ${food.name} ${food.brand || ''}`.toLowerCase()).join(' ');

    for (const term of ['riso', 'avena', 'pollo', 'tacchino', 'salmone', 'albume', 'yogurt', 'skyr', 'olio', 'mandorle']) {
      expect(corpus).toContain(term);
    }
    for (const brand of ['milbona', 'milk pro', 'ehrmann', 'hipro', 'fage']) {
      expect(corpus).toContain(brand);
    }
  });

  it('generates a real five-meal bodybuilding menu', () => {
    const foods = filterFoodsByPreferencePreset(APP_CORE_FOODS, 'bodybuilding');
    const timing = BUILT_IN_TIMINGS.find((item) => item.id === 'rest-5-balanced');
    expect(timing).toBeTruthy();

    const menu = generateNutritionMenu({
      target: { carbs: 200, protein: 200, fat: 40 },
      timing: timing!,
      foods,
      dayKind: 'off',
    });

    expect(menu.meals).toHaveLength(5);
    expect(menu.actual.protein).toBeGreaterThan(150);
    expect(menu.meals.every((meal) => meal.foods.length > 0)).toBe(true);
  });

  it('exposes the presets required by the UI', () => {
    expect(FOOD_PREFERENCE_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(['all', 'bodybuilding']),
    );
  });
});
