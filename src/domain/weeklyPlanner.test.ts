import { describe, expect, it } from 'vitest';
import type { GeneratedMenu, MacroTarget, WeeklyPlanResult } from '@/types/nutrition';
import {
  buildShoppingList,
  copyDayToAll,
  createWeeklyPlannerConfig,
  shiftDateKey,
  weekStartMonday,
} from './weeklyPlanner';

const target: MacroTarget = { carbs: 300, protein: 180, fat: 60 };

describe('weekly planner', () => {
  it('resolves Monday and seven consecutive dates', () => {
    expect(weekStartMonday('2026-08-24')).toBe('2026-08-24');
    expect(weekStartMonday('2026-08-30')).toBe('2026-08-24');
    const config = createWeeklyPlannerConfig('2026-08-26', target, 'omogeneo');
    expect(config.days).toHaveLength(7);
    expect(config.days[0].date).toBe('2026-08-24');
    expect(config.days[6].date).toBe('2026-08-30');
  });
  it('copies a day profile to the full week without changing dates', () => {
    const config = createWeeklyPlannerConfig('2026-08-24', target, 'omogeneo');
    config.days[2].target = { carbs: 400, protein: 190, fat: 50 };
    config.days[2].timingTemplateId = 'custom-high';
    const copied = copyDayToAll(config, 2);
    expect(copied.days.every((day) => day.target.carbs === 400)).toBe(true);
    expect(copied.days.every((day) => day.timingTemplateId === 'custom-high')).toBe(true);
    expect(copied.days.map((day) => day.date)).toEqual(config.days.map((day) => day.date));
  });

  it('aggregates equal foods into a shopping list', () => {
    const fakeMenu = (grams: number): GeneratedMenu => ({
      id: `m-${grams}`, macroProfileId: 'x', timingTemplateId: 't', createdAt: '',
      engineVersion: 'nutrition-engine-v2', status: 'exact', tolerancePercent: 5,
      generationMode: 'full_pool', meals: [{ name: 'Pasto', workoutTiming: 'none', target,
        actual: target, withinTolerance: true, foods: [{ foodId: 'rice', grams, name: 'Riso',
          carbs: 80, protein: 7, fat: 1, kcal: 357, source: 'builder' }] }],
      target, actual: target, targetKcal: 2460, actualKcal: 2460,
      residuals: { carbs: 0, protein: 0, fat: 0 },
    });
    const result: WeeklyPlanResult = {
      id: 'week', weekStart: '2026-08-24', createdAt: '',
      days: [
        { date: '2026-08-24', target, timingTemplateId: 't', menu: fakeMenu(100) },
        { date: '2026-08-25', target, timingTemplateId: 't', menu: fakeMenu(150) },
      ],
    };
    const list = buildShoppingList(result);
    expect(list).toHaveLength(1);
    expect(list[0].grams).toBe(250);
    expect(list[0].occurrences).toBe(2);
  });
});
