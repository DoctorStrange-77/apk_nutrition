import { describe, expect, it } from 'vitest';
import { APP_CORE_FOODS } from '@/data/appCoreFoods';
import {
  createCustomFoodPreference,
  resolveCustomFoodPreferenceFoods,
  validateCustomFoodPreference,
} from '@/domain/customFoodPreferences';

describe('custom food preferences', () => {
  it('creates a stable user preset', () => {
    const preset = createCustomFoodPreference('Gara', ['riso_basmati', 'pollo', 'evoo'], 'Essenziale');
    expect(preset.name).toBe('Gara');
    expect(preset.foodIds).toEqual(['riso_basmati', 'pollo', 'evoo']);
    expect(preset.id).toMatch(/^custom-pref-/);
  });

  it('validates that the preset has usable macro roles', () => {
    const good = createCustomFoodPreference('Completo', ['riso_basmati', 'pollo', 'evoo']);
    expect(validateCustomFoodPreference(good, APP_CORE_FOODS)).toEqual([]);

    const bad = createCustomFoodPreference('Solo carbo', ['riso_basmati', 'avena', 'banana']);
    expect(validateCustomFoodPreference(bad, APP_CORE_FOODS).join(' ')).toContain('proteica');
    expect(validateCustomFoodPreference(bad, APP_CORE_FOODS).join(' ')).toContain('grassi');
  });

  it('resolves only foods still present in the library', () => {
    const preset = createCustomFoodPreference('Test', ['riso_basmati', 'pollo', 'missing-food']);
    const foods = resolveCustomFoodPreferenceFoods(preset, APP_CORE_FOODS);
    expect(foods.map((food) => food.id)).toEqual(expect.arrayContaining(['riso_basmati', 'pollo']));
    expect(foods.some((food) => food.id === 'missing-food')).toBe(false);
  });
});
