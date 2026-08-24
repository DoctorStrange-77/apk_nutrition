import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  ageFromBirthDate,
  calculateProfile,
  inferActivityLevel,
  katchMcArdle,
  mifflinStJeor,
  normalizedGoalAdjustment,
  validateProfile,
  type UserNutritionProfile,
} from './profileTdee';

const reference = new Date('2026-08-24T12:00:00');
const profile = (): UserNutritionProfile => ({
  ...DEFAULT_PROFILE,
  birthDate: '1990-08-24',
  sex: 'male',
  heightCm: 180,
  weightKg: 80,
  averageSteps: 8000,
  workoutsPerWeek: 4,
  activityLevel: 'moderate',
  goal: 'maintain',
});
describe('profile TDEE', () => {
  it('calculates age from birth date', () => {
    expect(ageFromBirthDate('1990-08-24', reference)).toBe(36);
    expect(ageFromBirthDate('1990-08-25', reference)).toBe(35);
  });

  it('calculates Mifflin-St Jeor BMR', () => {
    expect(mifflinStJeor(profile(), 36)).toBeCloseTo(1750, 0);
  });

  it('uses Katch-McArdle when body fat is available', () => {
    const p = { ...profile(), formula: 'katch' as const, bodyFatPct: 20 };
    expect(katchMcArdle(p)).toBeCloseTo(1752.4, 1);
    expect(calculateProfile(p, reference)?.formulaUsed).toBe('katch');
  });

  it('applies goal adjustment and builds residual carbs', () => {
    const p = { ...profile(), goal: 'cut' as const, adjustmentPct: 15 };
    const result = calculateProfile(p, reference)!;
    expect(normalizedGoalAdjustment(p)).toBe(-15);
    expect(result.targetKcal).toBeLessThan(result.tdee);
    expect(result.macros.protein).toBe(160);
    expect(result.macros.fat).toBe(64);
    expect(result.macros.carbs).toBeGreaterThan(0);
  });

  it('infers an activity class from steps and training frequency', () => {
    expect(inferActivityLevel(2000, 0)).toBe('sedentary');
    expect(inferActivityLevel(7500, 4)).toBe('active');
    expect(inferActivityLevel(13000, 2)).toBe('very_active');
  });

  it('validates missing profile data', () => {
    const invalid = { ...profile(), birthDate: '', heightCm: 0 };
    expect(validateProfile(invalid, reference).length).toBeGreaterThan(0);
  });
});
