import { describe, expect, it } from 'vitest';
import { isRealisticMealCombination } from '@/engine/nutritionEngine';
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
