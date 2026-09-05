import { calculateMealTargets } from '@/domain/timing';
import { macrosForManualDay, macrosForManualMeal } from '@/domain/manualMenu';
import type {
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  ManualMeal,
  TimingTemplate,
} from '@/types/nutrition';

const MACROS: Array<keyof MacroTarget> = ['carbs', 'protein', 'fat'];
const ZERO: MacroTarget = { carbs: 0, protein: 0, fat: 0 };

const add = (a: MacroTarget, b: MacroTarget): MacroTarget => ({
  carbs: a.carbs + b.carbs,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
});

const subtractPositive = (target: MacroTarget, actual: MacroTarget): MacroTarget => ({
  carbs: Math.max(0, target.carbs - actual.carbs),
  protein: Math.max(0, target.protein - actual.protein),
  fat: Math.max(0, target.fat - actual.fat),
});
const percentageForGaps = (
  gaps: number[],
  fallbackPercentages: number[],
  residual: number,
): number[] => {
  if (residual <= 0.0001) return gaps.map(() => 0);
  const gapTotal = gaps.reduce((sum, value) => sum + value, 0);
  if (gapTotal > 0.0001) return gaps.map((value) => (value / gapTotal) * 100);

  const fallbackTotal = fallbackPercentages.reduce((sum, value) => sum + value, 0);
  if (fallbackTotal > 0.0001) {
    return fallbackPercentages.map((value) => (value / fallbackTotal) * 100);
  }
  return gaps.map(() => 100 / Math.max(1, gaps.length));
};

export interface SmartCompletionContext {
  originalTarget: MacroTarget;
  manualActual: MacroTarget;
  residualTarget: MacroTarget;
  residualTiming: TimingTemplate;
}

export function buildSmartCompletionContext(
  target: MacroTarget,
  timing: TimingTemplate,
  manualMeals: ManualMeal[],
): SmartCompletionContext {
  const mealTargets = calculateMealTargets(target, timing);
  const manualActualByMeal = timing.meals.map((_, index) =>
    manualMeals[index] ? macrosForManualMeal(manualMeals[index]) : { ...ZERO },
  );
  const manualActual = macrosForManualDay(manualMeals);
  const residualTarget = subtractPositive(target, manualActual);

  const gapsByMacro = {
    carbs: mealTargets.map((meal, index) => Math.max(0, meal.carbs - manualActualByMeal[index].carbs)),
    protein: mealTargets.map((meal, index) => Math.max(0, meal.protein - manualActualByMeal[index].protein)),
    fat: mealTargets.map((meal, index) => Math.max(0, meal.fat - manualActualByMeal[index].fat)),
  };

  const percentages = {
    carbs: percentageForGaps(gapsByMacro.carbs, timing.meals.map((meal) => meal.carbsPercent), residualTarget.carbs),
    protein: percentageForGaps(gapsByMacro.protein, timing.meals.map((meal) => meal.proteinPercent), residualTarget.protein),
    fat: percentageForGaps(gapsByMacro.fat, timing.meals.map((meal) => meal.fatPercent), residualTarget.fat),
  };

  const residualTiming: TimingTemplate = {
    ...timing,
    id: `${timing.id}-smart-completion`,
    name: `${timing.name} · COMPLETAMENTO`,
    builtIn: false,
    meals: timing.meals.map((meal, index) => ({
      ...meal,
      id: `${meal.id}-completion`,
      carbsPercent: percentages.carbs[index],
      proteinPercent: percentages.protein[index],
      fatPercent: percentages.fat[index],
    })),
  };
  return {
    originalTarget: { ...target },
    manualActual,
    residualTarget,
    residualTiming,
  };
}

export const completionNeeded = (residual: MacroTarget): boolean =>
  MACROS.some((key) => residual[key] > 0.05);

export function applyCompletionPlan(
  manualMeals: ManualMeal[],
  plan: GeneratedMenu,
  foods: LocalFood[],
): ManualMeal[] {
  const byId = new Map(foods.map((food) => [food.id, food]));
  return manualMeals.map((meal, index) => {
    const generatedMeal = plan.meals[index];
    if (!generatedMeal) return meal;
    const additions = generatedMeal.foods.flatMap((portion) => {
      const food = byId.get(portion.foodId);
      if (!food || portion.grams <= 0) return [];
      return [{
        id: `manual-${Date.now()}-${index}-${portion.foodId}-${Math.random().toString(36).slice(2, 6)}`,
        food: structuredClone(food),
        grams: portion.grams,
      }];
    });
    return { ...meal, items: [...meal.items, ...additions] };
  });
}
export function buildSingleMealTiming(
  timing: TimingTemplate,
  mealIndex: number,
): TimingTemplate {
  const source = timing.meals[mealIndex];
  if (!source) throw new Error('MEAL_NOT_FOUND');
  return {
    ...timing,
    id: `${timing.id}-meal-${mealIndex}-regen`,
    name: `${timing.name} · ${source.name}`,
    builtIn: false,
    meals: [{
      ...source,
      id: `${source.id}-regen`,
      carbsPercent: 100,
      proteinPercent: 100,
      fatPercent: 100,
    }],
  };
}

export function replaceGeneratedMeal(
  menu: GeneratedMenu,
  mealIndex: number,
  replacement: GeneratedMenu,
): GeneratedMenu {
  const nextMeal = replacement.meals[0];
  if (!nextMeal || !menu.meals[mealIndex]) return menu;
  const meals = menu.meals.map((meal, index) => index === mealIndex
    ? { ...nextMeal, name: meal.name, target: { ...meal.target }, workoutTiming: meal.workoutTiming }
    : meal);
  const actual = meals.reduce((sum, meal) => add(sum, meal.actual), { ...ZERO });
  const residuals: MacroTarget = {
    carbs: menu.target.carbs - actual.carbs,
    protein: menu.target.protein - actual.protein,
    fat: menu.target.fat - actual.fat,
  };
  const ratio = Math.min(0.2, Math.max(0.05, menu.tolerancePercent / 100));
  const dayValid = MACROS.every((key) => menu.target[key] === 0
    ? Math.abs(actual[key]) <= 0.05
    : Math.abs(actual[key] - menu.target[key]) / Math.abs(menu.target[key]) <= ratio + 1e-9);
  const exact = Math.abs(residuals.carbs) <= 1
    && Math.abs(residuals.protein) <= 1
    && Math.abs(residuals.fat) <= 0.5
    && meals.every((meal) => meal.withinTolerance);
  const status: GeneratedMenu['status'] = exact
    ? 'exact'
    : dayValid && meals.every((meal) => meal.withinTolerance)
      ? 'balanced'
      : 'best_feasible';

  return {
    ...menu,
    id: `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    meals,
    actual,
    actualKcal: actual.carbs * 4 + actual.protein * 4 + actual.fat * 9,
    residuals,
    status,
  };
}
