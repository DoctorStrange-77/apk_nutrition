import { describe, expect, it } from 'vitest';
import { generateNutritionMenu, isRealisticMealCombination } from '@/engine/nutritionEngine';
import { APP_CORE_FOODS } from '@/data/appCoreFoods';
import { BUILT_IN_TIMINGS } from '@/data/builtInTimings';
import type { LocalFood } from '@/types/nutrition';

const food = (id: string, name: string, category: LocalFood['category'], subcategory = ''): LocalFood => ({
  id,
  name,
  category,
  subcategory,
  carbs: category === 'carb' ? 80 : 5,
  protein: category === 'protein' ? 80 : 5,
  fat: category === 'fat' ? 80 : 2,
  suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
  source: 'core',
});

describe('meal realism', () => {
  const dextrose = food('destrosio', 'Destrosio (glucosio) in polvere', 'carb');
  const pea = food('proteine_pisello', 'Proteine di pisello (polvere)', 'protein');
  const riceProtein = food('proteine_riso', 'Proteine di riso (polvere)', 'protein');
  const hummus = food('hummus', 'Hummus di ceci', 'mixed', 'Pasti completi');
  const jam = food('marmellata', 'Marmellata classica', 'carb');
  const soyMilk = food('latte_soia', 'Latte di soia', 'mixed');
  it('rejects the unrealistic powder-heavy meal reported by the user', () => {
    expect(isRealisticMealCombination(
      [dextrose, pea, hummus, riceProtein, soyMilk],
      'pre',
    )).toBe(false);
  });

  it('rejects sweet and savory condiment clashes', () => {
    expect(isRealisticMealCombination([jam, hummus], 'none')).toBe(false);
  });

  it('allows a simple pre-workout shake with one carb powder and one protein powder', () => {
    expect(isRealisticMealCombination([dextrose, pea], 'pre')).toBe(true);
  });

  it('rejects rapid carbohydrate powders away from training', () => {
    expect(isRealisticMealCombination([dextrose, pea], 'none')).toBe(false);
  });
});

describe('automatic menu with alternatives', () => {
  it('generates the 200C/200P/40F five-meal case with 3-5 alternatives per source', () => {
    const timing = BUILT_IN_TIMINGS.find((item) => item.id === 'rest-5-balanced');
    expect(timing).toBeTruthy();

    const menu = generateNutritionMenu({
      target: { carbs: 200, protein: 200, fat: 40 },
      timing: timing!,
      foods: APP_CORE_FOODS,
      dayKind: 'off',
    });

    expect(menu.meals).toHaveLength(5);
    for (const meal of menu.meals) {
      expect(meal.foods.length).toBeGreaterThan(0);
      for (const portion of meal.foods) {
        expect(portion.alternatives?.length).toBeGreaterThanOrEqual(3);
        expect(portion.alternatives?.length).toBeLessThanOrEqual(5);
      }
    }
  });
});
