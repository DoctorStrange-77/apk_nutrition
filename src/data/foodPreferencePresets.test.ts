import { describe, expect, it } from 'vitest';
import { APP_CORE_FOODS } from '@/data/appCoreFoods';
import { BUILT_IN_TIMINGS } from '@/data/builtInTimings';
import { generateNutritionMenu } from '@/engine/nutritionEngine';
import {
  FOOD_PREFERENCE_PRESETS,
  filterFoodsByPreferencePreset,
} from '@/data/foodPreferencePresets';

const corpus = (foods: typeof APP_CORE_FOODS) =>
  foods.map((food) => `${food.id} ${food.name} ${food.brand || ''}`.toLowerCase()).join(' ');

describe('food preference presets', () => {
  it('keeps Core completo unchanged', () => {
    expect(filterFoodsByPreferencePreset(APP_CORE_FOODS, 'all')).toHaveLength(APP_CORE_FOODS.length);
  });

  it('keeps Bodybuilding essential and compact', () => {
    const foods = filterFoodsByPreferencePreset(APP_CORE_FOODS, 'bodybuilding');
    expect(foods.length).toBeGreaterThanOrEqual(55);
    expect(foods.length).toBeLessThanOrEqual(80);

    const counts = foods.reduce<Record<string, number>>((acc, food) => {
      acc[food.category] = (acc[food.category] || 0) + 1;
      return acc;
    }, {});
    expect(counts.carb).toBeGreaterThanOrEqual(12);
    expect(counts.protein).toBeGreaterThanOrEqual(20);
    expect(counts.fat).toBeGreaterThanOrEqual(5);
  });

  it('Bodybuilding contains staple foods and only a limited branded section', () => {
    const foods = filterFoodsByPreferencePreset(APP_CORE_FOODS, 'bodybuilding');
    const text = corpus(foods);
    for (const term of ['riso', 'avena', 'pollo', 'tacchino', 'salmone', 'albume', 'skyr', 'olio', 'mandorle']) {
      expect(text).toContain(term);
    }
    const branded = foods.filter((food) => food.dataSource === 'Open Food Facts');
    expect(branded.length).toBeLessThanOrEqual(14);
  });

  it('Vegetarian and Vegan exclude animal categories correctly', () => {
    const vegetarian = corpus(filterFoodsByPreferencePreset(APP_CORE_FOODS, 'vegetarian'));
    const vegan = corpus(filterFoodsByPreferencePreset(APP_CORE_FOODS, 'vegan'));

    for (const term of ['petto di pollo', 'manzo magro', 'merluzzo', 'tonno al naturale', 'salmone']) {
      expect(vegetarian).not.toContain(term);
      expect(vegan).not.toContain(term);
    }
    for (const term of ['uovo', 'albume', 'yogurt', 'skyr', 'whey', 'latte']) {
      expect(vegan).not.toContain(term);
    }
    for (const term of ['tofu', 'seitan', 'lenticchie', 'ceci']) {
      expect(vegan).toContain(term);
    }
  });

  it('exposes the selected practical presets and no pescetarian preset', () => {
    const ids = FOOD_PREFERENCE_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual(expect.arrayContaining([
      'all','bodybuilding','high_protein','mediterranean','vegetarian','vegan','whole_foods','quick_meals',
    ]));
    expect(ids).not.toContain('pescetarian');
  });

  it('all practical presets can generate a real menu', () => {
    const timing = BUILT_IN_TIMINGS.find((item) => item.id === 'rest-5-balanced');
    expect(timing).toBeTruthy();

    const cases = [
      ['bodybuilding', { carbs: 200, protein: 200, fat: 40 }],
      ['high_protein', { carbs: 200, protein: 180, fat: 50 }],
      ['mediterranean', { carbs: 220, protein: 150, fat: 60 }],
      ['vegetarian', { carbs: 220, protein: 140, fat: 60 }],
      ['vegan', { carbs: 240, protein: 120, fat: 65 }],
      ['whole_foods', { carbs: 220, protein: 150, fat: 60 }],
      ['quick_meals', { carbs: 190, protein: 150, fat: 55 }],
    ] as const;

    for (const [presetId, target] of cases) {
      const foods = filterFoodsByPreferencePreset(APP_CORE_FOODS, presetId);
      expect(foods.length, presetId).toBeGreaterThanOrEqual(25);
      const menu = generateNutritionMenu({ target, timing: timing!, foods, dayKind: 'off' });
      expect(menu.meals.length, presetId).toBe(5);
      expect(menu.meals.every((meal) => meal.foods.length > 0), presetId).toBe(true);
    }
  });
});
