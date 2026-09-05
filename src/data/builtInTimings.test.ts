import { describe, expect, it } from 'vitest';
import { timingTotals, validateTimingTemplate } from '@/domain/timing';
import {
  BUILT_IN_TIMINGS,
  DEFAULT_BUILT_IN_TIMING_ID,
  migrateBuiltInTimingId,
} from './builtInTimings';

describe('built-in timing library v2', () => {
  it('has a valid default preset', () => {
    expect(BUILT_IN_TIMINGS.some((item) => item.id === DEFAULT_BUILT_IN_TIMING_ID)).toBe(true);
  });

  it('all presets total 100 percent for each macro', () => {
    for (const timing of BUILT_IN_TIMINGS) {
      expect(validateTimingTemplate(timing).valid).toBe(true);
      expect(timingTotals(timing)).toEqual({ carbs: 100, protein: 100, fat: 100 });
    }
  });

  it('uses neutral names independent of sex and cut/gain goals', () => {
    const names = BUILT_IN_TIMINGS.map((item) => item.name.toLowerCase()).join(' ');
    expect(names).not.toContain('uomo');
    expect(names).not.toContain('donna');
    expect(names).not.toContain('cut');
  });
  it('marks pre and post workout meals from preset names', () => {
    const workoutPresets = BUILT_IN_TIMINGS.filter((item) => item.dayKind === 'workout');
    expect(workoutPresets.length).toBeGreaterThan(0);
    for (const timing of workoutPresets) {
      expect(timing.meals.some((meal) => meal.workoutTiming === 'pre' || meal.workoutTiming === 'post')).toBe(true);
    }
  });

  it('migrates legacy Builder timing ids', () => {
    expect(migrateBuiltInTimingId('omogeneo')).toBe('rest-5-balanced');
    expect(migrateBuiltInTimingId('wo-matt-post-colazione-cut')).toBe('train-morning-after-breakfast-5');
    expect(migrateBuiltInTimingId('custom-user-timing')).toBe('custom-user-timing');
  });
});
