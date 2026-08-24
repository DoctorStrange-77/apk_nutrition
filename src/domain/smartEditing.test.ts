import { describe, expect, it } from 'vitest';
import {
  buildLockedRegenerationContext,
  mergeUnlockedRegeneration,
  suggestEquivalentFoods,
  toggleMealLock,
} from '@/domain/smartEditing';
import type {
  GeneratedMeal,
  GeneratedMenu,
  LocalFood,
  TimingTemplate,
} from '@/types/nutrition';

const carbA: LocalFood = {
  id: 'rice', name: 'Riso', category: 'carb', carbs: 80, protein: 7, fat: 1,
  suitable: ['lunch'], source: 'builder',
};
const carbB: LocalFood = {
  id: 'pasta', name: 'Pasta', category: 'carb', carbs: 75, protein: 12, fat: 2,
  suitable: ['lunch'], source: 'builder',
};
const makeMeal = (name: string, carbs: number, protein: number, fat: number): GeneratedMeal => ({
  name,
  workoutTiming: 'none',
  target: { carbs, protein, fat },
  actual: { carbs, protein, fat },
  withinTolerance: true,
  foods: [{
    foodId: carbA.id, name: carbA.name, grams: 100,
    carbs, protein, fat, kcal: carbs * 4 + protein * 4 + fat * 9,
    source: 'builder',
  }],
});

const timing: TimingTemplate = {
  id: 't', name: 'Timing', dayKind: 'all', builtIn: false,
  meals: [
    { id: 'm1', name: 'Pasto 1', carbsPercent: 50, proteinPercent: 50, fatPercent: 50, workoutTiming: 'none' },
    { id: 'm2', name: 'Pasto 2', carbsPercent: 50, proteinPercent: 50, fatPercent: 50, workoutTiming: 'none' },
  ],
};
const menu: GeneratedMenu = {
  id: 'menu', macroProfileId: 'local', timingTemplateId: 't', createdAt: '2026-08-24T00:00:00.000Z',
  engineVersion: 'nutrition-engine-v2', status: 'exact', tolerancePercent: 5,
  generationMode: 'full_pool',
  meals: [makeMeal('Pasto 1', 50, 30, 10), makeMeal('Pasto 2', 50, 30, 10)],
  target: { carbs: 100, protein: 60, fat: 20 },
  actual: { carbs: 100, protein: 60, fat: 20 },
  targetKcal: 820, actualKcal: 820,
  residuals: { carbs: 0, protein: 0, fat: 0 },
};

describe('smart editing', () => {
  it('toggles a meal lock deterministically', () => {
    const locked = toggleMealLock(menu, 0);
    expect(locked.lockedMealIndexes).toEqual([0]);
    expect(toggleMealLock(locked, 0).lockedMealIndexes).toEqual([]);
  });

  it('regenerates only unlocked meals and preserves the locked one', () => {
    const locked = toggleMealLock(menu, 0);
    const context = buildLockedRegenerationContext(locked, timing);
    expect(context.unlockedIndexes).toEqual([1]);
    expect(context.residualTarget).toEqual({ carbs: 50, protein: 30, fat: 10 });
    const regenerated: GeneratedMenu = {
      ...menu,
      id: 'regen',
      meals: [makeMeal('Pasto 2', 49, 31, 10)],
      target: { ...context.residualTarget },
      actual: { carbs: 49, protein: 31, fat: 10 },
      residuals: { carbs: 1, protein: -1, fat: 0 },
    };
    const merged = mergeUnlockedRegeneration(locked, regenerated, context.unlockedIndexes);
    expect(merged.meals[0]).toEqual(locked.meals[0]);
    expect(merged.meals[1].actual).toEqual({ carbs: 49, protein: 31, fat: 10 });
    expect(merged.lockedMealIndexes).toEqual([0]);
  });

  it('suggests an equivalent food with a practical gram amount', () => {
    const original = menu.meals[0].foods[0];
    const suggestions = suggestEquivalentFoods(original, carbA, [carbA, carbB], 5);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].food.id).toBe('pasta');
    expect(suggestions[0].grams).toBeGreaterThan(0);
    expect(Number.isFinite(suggestions[0].score)).toBe(true);
  });
});
