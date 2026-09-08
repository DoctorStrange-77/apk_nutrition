import { describe, expect, it } from 'vitest';
import { APP_CORE_FOODS } from '@/data/appCoreFoods';
import { BUILT_IN_TIMINGS } from '@/data/builtInTimings';
import { generateNutritionMenu } from '@/engine/nutritionEngine';
import { rebalanceRemainingDay } from '@/domain/intelligence/autopilot';
import { deriveTrainingAwareTiming, filterFoodsForEmergency } from '@/domain/intelligence/trainingAware';

describe('Smart Autopilot', () => {
  const timing = BUILT_IN_TIMINGS.find((item) => item.id === 'rest-5-balanced')!;

  it('preserves completed meals and regenerates only the remaining day', () => {
    const target = { carbs: 200, protein: 180, fat: 50 };
    const original = generateNutritionMenu({ target, timing, foods: APP_CORE_FOODS, dayKind:'off' });
    const completed = [0, 1];
    const actualCompleted = original.meals.slice(0, 2).reduce((sum, meal) => ({
      carbs: sum.carbs + meal.actual.carbs,
      protein: sum.protein + meal.actual.protein,
      fat: sum.fat + meal.actual.fat + 4,
    }), { carbs:0, protein:0, fat:0 });

    const next = rebalanceRemainingDay({
      menu: original,
      completedMealIndexes: completed,
      actualCompletedMacros: actualCompleted,
      timing,
      foods: APP_CORE_FOODS,
      target,
    });

    expect(next.meals).toHaveLength(5);
    expect(next.meals[0]).toEqual(original.meals[0]);
    expect(next.meals[1]).toEqual(original.meals[1]);
    expect(next.actual.fat).toBeLessThanOrEqual(target.fat + 8);
    expect(next.target).toEqual(target);
  });
  it('adds pre/post workout context while preserving timing percentages', () => {
    const adapted = deriveTrainingAwareTiming(timing, {
      isTrainingDay:true, startTime:'18:00', durationMinutes:90,
      sessionType:'lower', intensity:'high',
    });
    expect(adapted.meals.some((meal) => meal.workoutTiming === 'pre')).toBe(true);
    expect(adapted.meals.some((meal) => meal.workoutTiming === 'post')).toBe(true);
    const carbs = adapted.meals.reduce((sum, meal) => sum + meal.carbsPercent, 0);
    const protein = adapted.meals.reduce((sum, meal) => sum + meal.proteinPercent, 0);
    const fat = adapted.meals.reduce((sum, meal) => sum + meal.fatPercent, 0);
    expect(carbs).toBeCloseTo(100, 5);
    expect(protein).toBeCloseTo(100, 5);
    expect(fat).toBeCloseTo(100, 5);
  });

  it('uses practical foods in low-time/outside modes without restricting skipped-meal mode', () => {
    const all = APP_CORE_FOODS.slice(0, 80);
    expect(filterFoodsForEmergency(all, 'skipped_meal')).toHaveLength(all.length);
    const quick = filterFoodsForEmergency(APP_CORE_FOODS, 'low_time');
    const outside = filterFoodsForEmergency(APP_CORE_FOODS, 'outside_home');
    expect(quick.length).toBeGreaterThan(10);
    expect(outside.length).toBeGreaterThan(10);
    expect(quick.length).toBeLessThan(APP_CORE_FOODS.length);
  });
});
