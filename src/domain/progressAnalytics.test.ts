import { describe, expect, it } from 'vitest';
import type { DiaryDay, MacroTarget } from '@/types/nutrition';
import {
  adjustTargetCalories,
  buildTargetRecommendation,
  calculateDiaryAdherence,
  calculateWeightTrend,
  type ProgressCheckIn,
} from './progressAnalytics';

const target: MacroTarget = { carbs: 300, protein: 180, fat: 60 };
const entry = (date: string, weightKg: number): ProgressCheckIn => ({
  date, weightKg, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`,
});

const diaryDay = (date: string, actualTarget = target): DiaryDay => ({
  date,
  target,
  timingTemplateId: 'omogeneo',
  meals: [{
    id: `meal-${date}`,
    name: 'Pasto',
    items: [{
      id: `item-${date}`,
      grams: 100,
      food: {
        id: `food-${date}`,
        name: 'Test',
        category: 'mixed',
        carbs: actualTarget.carbs,
        protein: actualTarget.protein,
        fat: actualTarget.fat,
        suitable: ['lunch'],
        source: 'manual',
      },
    }],
  }],
  generatedMenu: null,
  updatedAt: `${date}T20:00:00.000Z`,
});

describe('progress analytics', () => {
  it('calculates two seven-day weight windows', () => {
    const entries = [
      entry('2026-08-11', 82.0), entry('2026-08-13', 81.9), entry('2026-08-17', 81.8),
      entry('2026-08-18', 81.6), entry('2026-08-20', 81.5), entry('2026-08-24', 81.4),
    ];
    const trend = calculateWeightTrend(entries);
    expect(trend.recentCount).toBe(3);
    expect(trend.previousCount).toBe(3);
    expect(trend.weeklyChangeKg).not.toBeNull();
    expect(trend.weeklyRatePct).toBeLessThan(0);
  });

  it('keeps protein fixed when calories are adjusted', () => {
    const reduced = adjustTargetCalories(target, -5);
    const increased = adjustTargetCalories(target, 5);
    expect(reduced.protein).toBe(180);
    expect(increased.protein).toBe(180);
    expect(reduced.carbs).toBeLessThan(target.carbs);
    expect(reduced.fat).toBeLessThan(target.fat);
    expect(increased.carbs).toBeGreaterThan(target.carbs);
  });

  it('calculates adherence only on logged diary days', () => {
    const days: Record<string, DiaryDay> = {
      '2026-08-21': diaryDay('2026-08-21'),
      '2026-08-22': diaryDay('2026-08-22'),
      '2026-08-23': diaryDay('2026-08-23'),
      '2026-08-24': diaryDay('2026-08-24'),
    };
    const adherence = calculateDiaryAdherence(days, '2026-08-24', 7);
    expect(adherence.loggedDays).toBe(4);
    expect(adherence.adherencePct).toBeCloseTo(100, 5);
  });

  it('proposes a reduction during cut only with sufficient adherence', () => {
    const recommendation = buildTargetRecommendation(
      target,
      {
        latestWeightKg: 82,
        recentAverageKg: 82,
        previousAverageKg: 82.05,
        weeklyChangeKg: -0.05,
        weeklyRatePct: -0.06,
        recentCount: 5,
        previousCount: 5,
      },
      { adherencePct: 94, loggedDays: 6, windowDays: 7 },
      { goal: 'cut', minAdherencePct: 85, adjustmentPct: 5 },
    );
    expect(recommendation.kind).toBe('decrease');
    expect(recommendation.proposedTarget?.protein).toBe(target.protein);
  });

  it('does not change macros when adherence is low', () => {
    const recommendation = buildTargetRecommendation(
      target,
      {
        latestWeightKg: 82,
        recentAverageKg: 82,
        previousAverageKg: 82,
        weeklyChangeKg: 0,
        weeklyRatePct: 0,
        recentCount: 5,
        previousCount: 5,
      },
      { adherencePct: 70, loggedDays: 6, windowDays: 7 },
      { goal: 'cut', minAdherencePct: 85, adjustmentPct: 5 },
    );
    expect(recommendation.kind).toBe('hold');
    expect(recommendation.proposedTarget).toBeUndefined();
  });
});
