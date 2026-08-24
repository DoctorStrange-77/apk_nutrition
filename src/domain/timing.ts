import type { MacroTarget, TimingMeal, TimingTemplate } from '@/types/nutrition';

export interface EngineTimingRow {
  cPerc: number;
  pPerc: number;
  fPerc: number;
}

export interface MealMacroTarget extends MacroTarget {
  name: string;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export const normalizeTimingMeal = (meal: TimingMeal): TimingMeal => ({
  ...meal,
  carbsPercent: clampPercent(meal.carbsPercent),
  proteinPercent: clampPercent(meal.proteinPercent),
  fatPercent: clampPercent(meal.fatPercent),
});

export const timingTotals = (template: TimingTemplate) => template.meals.reduce(
  (totals, meal) => ({
    carbs: totals.carbs + clampPercent(meal.carbsPercent),
    protein: totals.protein + clampPercent(meal.proteinPercent),
    fat: totals.fat + clampPercent(meal.fatPercent),
  }),
  { carbs: 0, protein: 0, fat: 0 },
);

export const validateTimingTemplate = (template: TimingTemplate) => {
  if (!template.name.trim()) return { valid: false, reason: 'TIMING_NAME_REQUIRED' as const };
  if (template.meals.length < 1 || template.meals.length > 6) return { valid: false, reason: 'INVALID_MEAL_COUNT' as const };
  const totals = timingTotals(template);
  const epsilon = 0.001;
  const valid = Math.abs(totals.carbs - 100) <= epsilon
    && Math.abs(totals.protein - 100) <= epsilon
    && Math.abs(totals.fat - 100) <= epsilon;
  return valid
    ? { valid: true as const, totals }
    : { valid: false as const, reason: 'TIMING_TOTALS_MUST_BE_100' as const, totals };
};

export const toEngineTimingRows = (template: TimingTemplate): EngineTimingRow[] => {
  const validation = validateTimingTemplate(template);
  if (!validation.valid) throw new Error(validation.reason);
  const rows = template.meals.map((meal) => ({
    cPerc: clampPercent(meal.carbsPercent) / 100,
    pPerc: clampPercent(meal.proteinPercent) / 100,
    fPerc: clampPercent(meal.fatPercent) / 100,
  }));
  while (rows.length < 6) rows.push({ cPerc: 0, pPerc: 0, fPerc: 0 });
  return rows.slice(0, 6);
};

export const calculateMealTargets = (
  daily: MacroTarget,
  template: TimingTemplate,
): MealMacroTarget[] => {
  const validation = validateTimingTemplate(template);
  if (!validation.valid) throw new Error(validation.reason);
  return template.meals.map((meal) => ({
    name: meal.name,
    carbs: daily.carbs * clampPercent(meal.carbsPercent) / 100,
    protein: daily.protein * clampPercent(meal.proteinPercent) / 100,
    fat: daily.fat * clampPercent(meal.fatPercent) / 100,
  }));
};

export const createEmptyTiming = (name = 'Nuovo timing', mealsCount = 5): TimingTemplate => {
  const safeCount = Math.max(1, Math.min(6, Math.round(mealsCount)));
  const equal = 100 / safeCount;
  return {
    id: `timing-${Date.now()}`,
    name,
    dayKind: 'all',
    builtIn: false,
    meals: Array.from({ length: safeCount }, (_, index) => ({
      id: `meal-${index + 1}`,
      name: `Pasto ${index + 1}`,
      carbsPercent: equal,
      proteinPercent: equal,
      fatPercent: equal,
      workoutTiming: 'none',
    })),
  };
};
