import {
  calculatePortionMacros,
  getPortionStep,
  isRealisticMealCombination,
  quantizeFoodPortion,
} from '@/engine/nutritionEngine';
import type {
  GeneratedFoodAlternative,
  GeneratedFoodPortion,
  GeneratedMeal,
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  TimingTemplate,
} from '@/types/nutrition';

const MACROS: Array<keyof MacroTarget> = ['carbs', 'protein', 'fat'];
const ZERO: MacroTarget = { carbs: 0, protein: 0, fat: 0 };

const add = (a: MacroTarget, b: MacroTarget): MacroTarget => ({
  carbs: a.carbs + b.carbs,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
});

const subtractPositive = (a: MacroTarget, b: MacroTarget): MacroTarget => ({
  carbs: Math.max(0, a.carbs - b.carbs),
  protein: Math.max(0, a.protein - b.protein),
  fat: Math.max(0, a.fat - b.fat),
});

const macroLoss = (actual: MacroTarget, target: MacroTarget): number =>
  MACROS.reduce((sum, key) => {
    const scale = Math.max(5, Math.abs(target[key]));
    return sum + Math.abs(actual[key] - target[key]) / scale;
  }, 0) / MACROS.length;

const withinTolerance = (actual: MacroTarget, target: MacroTarget, tolerancePercent: number): boolean => {
  const ratio = Math.min(0.2, Math.max(0.05, tolerancePercent / 100));
  return MACROS.every((key) => {
    if (target[key] <= 0.0001) return Math.abs(actual[key]) <= 0.05;
    return Math.abs(actual[key] - target[key]) / Math.abs(target[key]) <= ratio + 1e-9;
  });
};

const sumMeals = (meals: GeneratedMeal[]): MacroTarget =>
  meals.reduce((sum, meal) => add(sum, meal.actual), { ...ZERO });

const portionFromFood = (food: LocalFood, grams: number): GeneratedFoodPortion => {
  const macros = calculatePortionMacros(food, grams);
  return {
    foodId: food.id,
    name: food.name,
    grams,
    carbs: macros.carbs,
    protein: macros.protein,
    fat: macros.fat,
    kcal: macros.carbs * 4 + macros.protein * 4 + macros.fat * 9,
    source: food.source,
  };
};

export function recalculateGeneratedMenu(menu: GeneratedMenu, meals: GeneratedMeal[]): GeneratedMenu {
  const actual = sumMeals(meals);
  const residuals: MacroTarget = {
    carbs: menu.target.carbs - actual.carbs,
    protein: menu.target.protein - actual.protein,
    fat: menu.target.fat - actual.fat,
  };
  const exact = Math.abs(residuals.carbs) <= 1
    && Math.abs(residuals.protein) <= 1
    && Math.abs(residuals.fat) <= 0.5
    && meals.every((meal) => meal.withinTolerance);
  const valid = withinTolerance(actual, menu.target, menu.tolerancePercent)
    && meals.every((meal) => meal.withinTolerance);
  return {
    ...menu,
    id: `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    meals,
    actual,
    actualKcal: actual.carbs * 4 + actual.protein * 4 + actual.fat * 9,
    residuals,
    status: exact ? 'exact' : valid ? 'balanced' : 'best_feasible',
  };
}

export interface FoodReplacementSuggestion {
  food: LocalFood;
  grams: number;
  macros: MacroTarget;
  delta: MacroTarget;
  score: number;
}

const clampCandidateGrams = (food: LocalFood, grams: number): number => {
  const step = getPortionStep(food);
  const min = Math.max(step, food.grammiMin || step);
  const max = food.grammiMax && food.grammiMax > 0 ? food.grammiMax : 500;
  return quantizeFoodPortion(food, Math.min(max, Math.max(min, grams)));
};

const idealReplacementGrams = (food: LocalFood, target: MacroTarget): number => {
  const density: MacroTarget = {
    carbs: food.carbs / 100,
    protein: food.protein / 100,
    fat: food.fat / 100,
  };
  let numerator = 0;
  let denominator = 0;
  for (const key of MACROS) {
    const scale = Math.max(5, Math.abs(target[key]));
    const weight = 1 / (scale * scale);
    numerator += density[key] * target[key] * weight;
    denominator += density[key] * density[key] * weight;
  }
  const raw = denominator > 1e-12 ? numerator / denominator : 100;
  return clampCandidateGrams(food, raw);
};

export function suggestEquivalentFoods(
  original: GeneratedFoodPortion,
  originalFood: LocalFood | undefined,
  foods: LocalFood[],
  limit = 12,
): FoodReplacementSuggestion[] {
  const target: MacroTarget = {
    carbs: original.carbs,
    protein: original.protein,
    fat: original.fat,
  };
  return foods
    .filter((food) => food.id !== original.foodId && (food.carbs > 0 || food.protein > 0 || food.fat > 0))
    .map((food) => {
      const grams = idealReplacementGrams(food, target);
      const macros = calculatePortionMacros(food, grams);
      const categoryPenalty = originalFood && food.category !== originalFood.category ? 0.18 : 0;
      const sizePenalty = original.grams > 0 && grams > 0
        ? Math.min(0.2, Math.abs(Math.log(grams / original.grams)) * 0.025)
        : 0;
      const score = macroLoss(macros, target) + categoryPenalty + sizePenalty;
      return {
        food,
        grams,
        macros,
        delta: {
          carbs: macros.carbs - target.carbs,
          protein: macros.protein - target.protein,
          fat: macros.fat - target.fat,
        },
        score,
      };
    })
    .filter((entry) => entry.grams > 0)
    .sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit);
}

type RuntimePortion = { food: LocalFood; grams: number };

const runtimeMacros = (portions: RuntimePortion[]): MacroTarget =>
  portions.reduce((sum, portion) => add(sum, calculatePortionMacros(portion.food, portion.grams)), { ...ZERO });

const inferMealTag = (name: string, index: number): LocalFood['suitable'][number] => {
  const normalized = name.toLowerCase();
  if (normalized.includes('colaz')) return 'breakfast';
  if (normalized.includes('pranzo')) return 'lunch';
  if (normalized.includes('cena')) return 'dinner';
  if (normalized.includes('prenanna') || normalized.includes('pre nanna')) return 'prenanna';
  const defaults: LocalFood['suitable'][number][] = ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'prenanna'];
  return defaults[index] || 'snack';
};

const rebuildAlternatives = (
  portion: GeneratedFoodPortion,
  food: LocalFood,
  mealFoods: LocalFood[],
  foods: LocalFood[],
  mealName: string,
  mealIndex: number,
  workoutTiming: GeneratedMeal['workoutTiming'],
): GeneratedFoodAlternative[] => {
  const tag = inferMealTag(mealName, mealIndex);
  return suggestEquivalentFoods(portion, food, foods, 24)
    .filter((entry) => entry.food.suitable.includes(tag))
    .filter((entry) => isRealisticMealCombination([
      ...mealFoods.filter((item) => item.id !== food.id),
      entry.food,
    ], workoutTiming))
    .slice(0, 4)
    .map((entry) => ({
      foodId: entry.food.id,
      name: entry.food.name,
      grams: entry.grams,
      ...entry.macros,
      kcal: entry.macros.carbs * 4 + entry.macros.protein * 4 + entry.macros.fat * 9,
      source: entry.food.source,
    }));
};

const optimizeMealPortions = (input: RuntimePortion[], target: MacroTarget): RuntimePortion[] => {
  let best = input.map((entry) => ({ ...entry, grams: clampCandidateGrams(entry.food, entry.grams) }));
  let bestLoss = macroLoss(runtimeMacros(best), target);
  for (let pass = 0; pass < 80; pass += 1) {
    let improved = false;
    for (let index = 0; index < best.length; index += 1) {
      const step = getPortionStep(best[index].food);
      for (const delta of [step, -step]) {
        const candidate = best.map((entry) => ({ ...entry }));
        const next = clampCandidateGrams(candidate[index].food, candidate[index].grams + delta);
        if (next <= 0 || next === candidate[index].grams) continue;
        candidate[index].grams = next;
        const loss = macroLoss(runtimeMacros(candidate), target);
        if (loss < bestLoss - 1e-6) {
          best = candidate;
          bestLoss = loss;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
};

export function replaceFoodSmart(
  menu: GeneratedMenu,
  mealIndex: number,
  foodIndex: number,
  replacementFood: LocalFood,
  foods: LocalFood[],
): GeneratedMenu {
  const meal = menu.meals[mealIndex];
  const original = meal?.foods[foodIndex];
  if (!meal || !original) throw new Error('FOOD_PORTION_NOT_FOUND');
  const byId = new Map(foods.map((food) => [food.id, food]));
  const originalFood = byId.get(original.foodId);
  const suggestion = suggestEquivalentFoods(original, originalFood, [replacementFood], 1)[0];
  if (!suggestion) throw new Error('NO_REPLACEMENT_AVAILABLE');

  const runtime: RuntimePortion[] = meal.foods.map((portion, index) => {
    if (index === foodIndex) return { food: replacementFood, grams: suggestion.grams };
    const food = byId.get(portion.foodId);
    if (!food) throw new Error(`FOOD_NOT_FOUND:${portion.foodId}`);
    return { food, grams: portion.grams };
  });
  const optimized = optimizeMealPortions(runtime, meal.target);
  const actual = runtimeMacros(optimized);
  const optimizedFoods = optimized.map((entry) => entry.food);
  const nextFoods = optimized.map((entry) => {
    const portion = portionFromFood(entry.food, entry.grams);
    return {
      ...portion,
      alternatives: rebuildAlternatives(
        portion,
        entry.food,
        optimizedFoods,
        foods,
        meal.name,
        mealIndex,
        meal.workoutTiming,
      ),
    };
  });
  const nextMeal: GeneratedMeal = {
    ...meal,
    foods: nextFoods,
    actual,
    withinTolerance: withinTolerance(actual, meal.target, menu.tolerancePercent),
  };
  const meals = menu.meals.map((entry, index) => index === mealIndex ? nextMeal : entry);
  return recalculateGeneratedMenu(menu, meals);
}

export interface LockedRegenerationContext {
  unlockedIndexes: number[];
  residualTarget: MacroTarget;
  residualTiming: TimingTemplate;
}

const normalizedWeights = (weights: number[], residual: number): number[] => {
  if (residual <= 0.0001) return weights.map(() => 0);
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0.0001) return weights.map(() => 100 / Math.max(1, weights.length));
  return weights.map((value) => (Math.max(0, value) / total) * 100);
};

export function buildLockedRegenerationContext(
  menu: GeneratedMenu,
  timing: TimingTemplate,
): LockedRegenerationContext {
  const locked = new Set(menu.lockedMealIndexes || []);
  const unlockedIndexes = menu.meals.map((_, index) => index).filter((index) => !locked.has(index));
  if (!unlockedIndexes.length) throw new Error('ALL_MEALS_LOCKED');
  const lockedActual = menu.meals.reduce((sum, meal, index) => locked.has(index) ? add(sum, meal.actual) : sum, { ...ZERO });
  const residualTarget = subtractPositive(menu.target, lockedActual);
  if (MACROS.every((key) => residualTarget[key] <= 0.0001)) throw new Error('LOCKED_MEALS_COVER_TARGET');

  const weights = {
    carbs: normalizedWeights(unlockedIndexes.map((index) => menu.meals[index].target.carbs), residualTarget.carbs),
    protein: normalizedWeights(unlockedIndexes.map((index) => menu.meals[index].target.protein), residualTarget.protein),
    fat: normalizedWeights(unlockedIndexes.map((index) => menu.meals[index].target.fat), residualTarget.fat),
  };
  const residualTiming: TimingTemplate = {
    ...timing,
    id: `${timing.id}-unlocked-regeneration`,
    name: `${timing.name} · NON BLOCCATI`,
    builtIn: false,
    meals: unlockedIndexes.map((sourceIndex, position) => {
      const source = timing.meals[sourceIndex];
      return {
        ...source,
        id: `${source?.id || `meal-${sourceIndex}`}-unlocked`,
        name: menu.meals[sourceIndex].name,
        workoutTiming: menu.meals[sourceIndex].workoutTiming,
        carbsPercent: weights.carbs[position],
        proteinPercent: weights.protein[position],
        fatPercent: weights.fat[position],
      };
    }),
  };
  return { unlockedIndexes, residualTarget, residualTiming };
}

export function mergeUnlockedRegeneration(
  original: GeneratedMenu,
  regenerated: GeneratedMenu,
  unlockedIndexes: number[],
): GeneratedMenu {
  const replacementByIndex = new Map(unlockedIndexes.map((index, position) => [index, regenerated.meals[position]]));
  const meals = original.meals.map((meal, index) => {
    const replacement = replacementByIndex.get(index);
    return replacement
      ? { ...replacement, name: meal.name, workoutTiming: meal.workoutTiming }
      : meal;
  });
  return {
    ...recalculateGeneratedMenu(original, meals),
    lockedMealIndexes: [...(original.lockedMealIndexes || [])],
  };
}

export function toggleMealLock(menu: GeneratedMenu, mealIndex: number): GeneratedMenu {
  const current = new Set(menu.lockedMealIndexes || []);
  if (current.has(mealIndex)) current.delete(mealIndex);
  else current.add(mealIndex);
  return { ...menu, lockedMealIndexes: [...current].sort((a, b) => a - b) };
}
