import { describe, expect, it } from 'vitest';
import {
  applyCompletionPlan,
  buildSingleMealTiming,
  buildSmartCompletionContext,
  completionNeeded,
} from '@/domain/smartCompletion';
import type { GeneratedMenu, LocalFood, ManualMeal, TimingTemplate } from '@/types/nutrition';

const food: LocalFood = {
  id: 'test-food', name: 'Test food', category: 'mixed',
  carbs: 100, protein: 30, fat: 10,
  suitable: ['breakfast', 'lunch'], source: 'manual',
};

const timing: TimingTemplate = {
  id: 'two-meals', name: 'Two meals', dayKind: 'all', builtIn: false,
  meals: [
    { id: 'm1', name: 'Colazione', carbsPercent: 50, proteinPercent: 50, fatPercent: 50, workoutTiming: 'none' },
    { id: 'm2', name: 'Pranzo', carbsPercent: 50, proteinPercent: 50, fatPercent: 50, workoutTiming: 'pre' },
  ],
};
describe('smart completion', () => {
  it('derives residual macros from the original target without mutating it', () => {
    const target = { carbs: 300, protein: 180, fat: 60 };
    const original = structuredClone(target);
    const manualMeals: ManualMeal[] = [
      { id: 'd1', name: 'Colazione', items: [{ id: 'i1', food, grams: 100 }] },
      { id: 'd2', name: 'Pranzo', items: [] },
    ];

    const context = buildSmartCompletionContext(target, timing, manualMeals);
    expect(target).toEqual(original);
    expect(context.manualActual).toEqual({ carbs: 100, protein: 30, fat: 10 });
    expect(context.residualTarget).toEqual({ carbs: 200, protein: 150, fat: 50 });
    expect(completionNeeded(context.residualTarget)).toBe(true);

    const c = context.residualTiming.meals.reduce((sum, meal) => sum + meal.carbsPercent, 0);
    const p = context.residualTiming.meals.reduce((sum, meal) => sum + meal.proteinPercent, 0);
    const f = context.residualTiming.meals.reduce((sum, meal) => sum + meal.fatPercent, 0);
    expect(c).toBeCloseTo(100, 6);
    expect(p).toBeCloseTo(100, 6);
    expect(f).toBeCloseTo(100, 6);
  });
  it('preserves manual foods when an automatic completion is applied', () => {
    const manualMeals: ManualMeal[] = [
      { id: 'd1', name: 'Colazione', items: [{ id: 'i1', food, grams: 50 }] },
      { id: 'd2', name: 'Pranzo', items: [] },
    ];
    const plan: GeneratedMenu = {
      id: 'plan', macroProfileId: 'local', timingTemplateId: 'two-meals',
      createdAt: new Date().toISOString(), engineVersion: 'nutrition-engine-v2',
      status: 'balanced', tolerancePercent: 5, generationMode: 'full_pool',
      target: { carbs: 50, protein: 15, fat: 5 },
      actual: { carbs: 50, protein: 15, fat: 5 },
      targetKcal: 305, actualKcal: 305,
      residuals: { carbs: 0, protein: 0, fat: 0 },
      meals: [
        { name: 'Colazione', workoutTiming: 'none', target: { carbs: 0, protein: 0, fat: 0 }, actual: { carbs: 0, protein: 0, fat: 0 }, withinTolerance: true, foods: [] },
        { name: 'Pranzo', workoutTiming: 'pre', target: { carbs: 50, protein: 15, fat: 5 }, actual: { carbs: 50, protein: 15, fat: 5 }, withinTolerance: true, foods: [{ foodId: food.id, grams: 50, name: food.name, carbs: 50, protein: 15, fat: 5, kcal: 305, source: 'manual' }] },
      ],
    };

    const result = applyCompletionPlan(manualMeals, plan, [food]);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].id).toBe('i1');
    expect(result[1].items).toHaveLength(1);
    expect(result[1].items[0].food.id).toBe(food.id);
  });

  it('builds a one-meal timing without changing the source timing', () => {
    const original = structuredClone(timing);
    const single = buildSingleMealTiming(timing, 1);
    expect(timing).toEqual(original);
    expect(single.meals).toHaveLength(1);
    expect(single.meals[0].name).toBe('Pranzo');
    expect(single.meals[0].workoutTiming).toBe('pre');
    expect(single.meals[0].carbsPercent).toBe(100);
    expect(single.meals[0].proteinPercent).toBe(100);
    expect(single.meals[0].fatPercent).toBe(100);
  });
});
