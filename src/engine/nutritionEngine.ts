import type {
  DayKind,
  GeneratedFoodPortion,
  GeneratedMeal,
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  MealTag,
  MealWorkoutTiming,
  TimingTemplate,
} from '@/types/nutrition';
import { calculateMealTargets } from '@/domain/timing';

export const NUTRITION_ENGINE_VERSION = 'nutrition-engine-v2' as const;
export const DEFAULT_TOLERANCE_LEVELS = [5, 7, 10, 12, 15, 20] as const;
const MACROS: Array<keyof MacroTarget> = ['carbs', 'protein', 'fat'];
const EXACT_DAY_EPSILON: MacroTarget = { carbs: 1, protein: 1, fat: 0.5 };

interface Portion {
  food: LocalFood;
  grams: number;
}

interface MealCandidate {
  portions: Portion[];
  actual: MacroTarget;
  score: number;
  withinTolerance: boolean;
}

interface RuntimeMeal {
  name: string;
  workoutTiming: MealWorkoutTiming;
  target: MacroTarget;
  portions: Portion[];
}

export interface GenerateMenuOptions {
  target: MacroTarget;
  timing: TimingTemplate;
  foods: LocalFood[];
  selectedFoodIds?: string[];
  attemptSeed?: number;
  startTolerancePercent?: number;
  dayKind?: DayKind;
  macroProfileId?: string;
  avoidFoodIds?: string[];
}

const finite = (value: number) => (Number.isFinite(value) ? value : 0);

export const calculateKcal = (macros: MacroTarget): number =>
  finite(macros.carbs) * 4 + finite(macros.protein) * 4 + finite(macros.fat) * 9;

const cloneMacros = (value: MacroTarget): MacroTarget => ({
  carbs: finite(value.carbs),
  protein: finite(value.protein),
  fat: finite(value.fat),
});

const addMacros = (a: MacroTarget, b: MacroTarget): MacroTarget => ({
  carbs: a.carbs + b.carbs,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
});

const subtractMacros = (a: MacroTarget, b: MacroTarget): MacroTarget => ({
  carbs: a.carbs - b.carbs,
  protein: a.protein - b.protein,
  fat: a.fat - b.fat,
});

export const getPortionStep = (food: LocalFood): number => {
  if ((food.fat || 0) >= 60) return 1;
  if ((food.protein || 0) >= 70 || (food.carbs || 0) >= 70) return 5;
  return 5;
};

const portionBounds = (food: LocalFood) => {
  const step = getPortionStep(food);
  const declaredMin = Number.isFinite(food.grammiMin) ? Math.max(0, food.grammiMin || 0) : 0;
  const declaredMax = Number.isFinite(food.grammiMax) && (food.grammiMax || 0) > 0
    ? food.grammiMax as number
    : Number.POSITIVE_INFINITY;
  const min = Math.ceil(declaredMin / step) * step;
  const max = Number.isFinite(declaredMax)
    ? Math.floor(declaredMax / step) * step
    : Number.POSITIVE_INFINITY;
  return { min, max, step, usable: min <= max };
};

export const quantizeFoodPortion = (food: LocalFood, grams: number): number => {
  const safe = Math.max(0, finite(grams));
  if (safe === 0) return 0;
  const { min, max, step, usable } = portionBounds(food);
  if (!usable) return 0;
  const quantized = Math.round(safe / step) * step;
  if (quantized < min) {
    const declaredMin = Math.max(0, food.grammiMin || min);
    return safe >= declaredMin * 0.5 ? min : 0;
  }
  if (quantized > max) return max;
  return quantized;
};

export const calculatePortionMacros = (food: LocalFood, grams: number): MacroTarget => {
  const factor = Math.max(0, grams) / 100;
  return {
    carbs: food.carbs * factor,
    protein: food.protein * factor,
    fat: food.fat * factor,
  };
};

const combinationMacros = (portions: Portion[]): MacroTarget =>
  portions.reduce(
    (sum, portion) => addMacros(sum, calculatePortionMacros(portion.food, portion.grams)),
    { carbs: 0, protein: 0, fat: 0 },
  );

const relativeDeviation = (actual: number, target: number): number => {
  const diff = Math.abs(actual - target);
  if (Math.abs(target) < 0.000001) return diff <= 0.05 ? 0 : 1;
  return diff / Math.abs(target);
};

const macroLoss = (actual: MacroTarget, target: MacroTarget): number =>
  MACROS.reduce((sum, key) => {
    const absolute = Math.abs(actual[key] - target[key]);
    const relative = relativeDeviation(actual[key], target[key]);
    return sum + absolute + relative;
  }, 0) / MACROS.length;

const withinMacroTolerance = (
  actual: MacroTarget,
  target: MacroTarget,
  daily: MacroTarget,
  tolerancePercent: number,
): boolean => {
  const ratio = Math.min(0.2, Math.max(0.05, tolerancePercent / 100));
  return MACROS.every((key) => {
    const expected = target[key];
    const diff = Math.abs(actual[key] - expected);
    if (expected === 0) {
      const dailyTarget = daily[key];
      if (dailyTarget <= 0) return diff <= 0.05;
      const spillRatio = Math.min(ratio * 0.25, 0.05);
      return diff <= dailyTarget * spillRatio + 1e-9;
    }
    return diff / Math.abs(expected) <= ratio + 1e-9;
  });
};

const dayWithinTolerance = (actual: MacroTarget, target: MacroTarget, tolerancePercent: number): boolean => {
  const ratio = Math.min(0.2, Math.max(0.05, tolerancePercent / 100));
  return MACROS.every((key) => {
    if (target[key] === 0) return Math.abs(actual[key]) <= 0.05;
    return Math.abs(actual[key] - target[key]) / Math.abs(target[key]) <= ratio + 1e-9;
  });
};

const dayWithinExactPracticalTarget = (actual: MacroTarget, target: MacroTarget): boolean =>
  MACROS.every((key) => Math.abs(actual[key] - target[key]) <= EXACT_DAY_EPSILON[key]);

const getFoodPrimaryRole = (food: LocalFood): keyof MacroTarget => {
  const energies = {
    carbs: Math.max(0, food.carbs) * 4,
    protein: Math.max(0, food.protein) * 4,
    fat: Math.max(0, food.fat) * 9,
  };
  return MACROS.reduce((best, key) => (energies[key] > energies[best] ? key : best), 'carbs');
};

const mealTagFromIndex = (index: number, name: string): MealTag => {
  const normalized = name.toLowerCase();
  if (normalized.includes('colaz')) return 'breakfast';
  if (normalized.includes('pranzo')) return 'lunch';
  if (normalized.includes('cena')) return 'dinner';
  if (normalized.includes('prenanna') || normalized.includes('pre nanna')) return 'prenanna';
  const defaults: MealTag[] = ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'prenanna'];
  return defaults[index] || 'snack';
};

const rotate = <T,>(items: T[], amount: number): T[] => {
  if (!items.length) return items;
  const shift = ((amount % items.length) + items.length) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
};

const contextPenalty = (
  portions: Portion[],
  workoutTiming: MealWorkoutTiming,
  dayKind: DayKind,
): number => {
  if (!portions.length) return 100;
  let penalty = 0;
  const total = combinationMacros(portions);
  const totalKcal = Math.max(1, calculateKcal(total));
  const fatEnergyRatio = (total.fat * 9) / totalKcal;

  if (workoutTiming === 'pre' || workoutTiming === 'post') {
    if (fatEnergyRatio > 0.22) penalty += (fatEnergyRatio - 0.22) * 30;
    const avgDigestibility = portions.reduce((sum, { food }) => {
      const score = food.digestibilityScore ?? (food.digestibility === 'easy' ? 80 : food.digestibility === 'heavy' ? 45 : 65);
      return sum + score;
    }, 0) / portions.length;
    const desired = workoutTiming === 'pre' ? 70 : 60;
    if (avgDigestibility < desired) penalty += (desired - avgDigestibility) * 0.2;
  }

  if (workoutTiming === 'post') {
    const highGi = portions.filter(({ food }) => food.glycemicIndex === 'high').length;
    if (portions.some(({ food }) => food.glycemicIndex) && highGi === 0) penalty += 2;
  }
  if (dayKind === 'off') {
    const highGi = portions.filter(({ food }) => food.glycemicIndex === 'high').length;
    penalty += highGi * 1.5;
  }
  return penalty;
};

const usagePenalty = (portions: Portion[], usedFoodIds: Set<string>): number =>
  portions.reduce((sum, { food }) => sum + (usedFoodIds.has(food.id) ? 3 : 0), 0);

const scorePortions = (
  portions: Portion[],
  target: MacroTarget,
  workoutTiming: MealWorkoutTiming,
  dayKind: DayKind,
  usedFoodIds: Set<string>,
): number => {
  const actual = combinationMacros(portions);
  const accuracy = macroLoss(actual, target);
  const context = contextPenalty(portions, workoutTiming, dayKind);
  const usage = usagePenalty(portions, usedFoodIds);
  const foodCountPenalty = Math.max(0, portions.filter((p) => p.grams > 0).length - 3) * 0.75;
  // Builder V2 dà priorità alla precisione macro, mantenendo varietà e contesto come tie-breaker.
  return accuracy * 0.72 + context * 0.14 + usage * 0.1 + foodCountPenalty * 0.04;
};

const initialGramsForFood = (food: LocalFood, target: MacroTarget): number => {
  const role = getFoodPrimaryRole(food);
  const density = Math.max(0.0001, food[role]);
  const requested = target[role] > 0 ? (target[role] / density) * 100 : 0;
  const min = food.grammiMin || getPortionStep(food);
  return quantizeFoodPortion(food, Math.max(requested, min));
};

const optimizePortions = (
  input: Portion[],
  target: MacroTarget,
  workoutTiming: MealWorkoutTiming,
  dayKind: DayKind,
  usedFoodIds: Set<string>,
): Portion[] => {
  let best = input.map(({ food, grams }) => ({ food, grams: quantizeFoodPortion(food, grams) }));
  let bestScore = scorePortions(best, target, workoutTiming, dayKind, usedFoodIds);

  for (let iteration = 0; iteration < 90; iteration += 1) {
    let improved = false;
    for (let index = 0; index < best.length; index += 1) {
      const step = getPortionStep(best[index].food);
      for (const delta of [step, -step]) {
        const candidate = best.map((entry, candidateIndex) => {
          if (candidateIndex !== index) return { ...entry };
          return {
            food: entry.food,
            grams: quantizeFoodPortion(entry.food, Math.max(0, entry.grams + delta)),
          };
        });
        const score = scorePortions(candidate, target, workoutTiming, dayKind, usedFoodIds);
        if (score < bestScore - 0.0001) {
          best = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return best.filter(({ grams }) => grams > 0);
};

const foodSuitabilityScore = (food: LocalFood, tag: MealTag, workoutTiming: MealWorkoutTiming): number => {
  let score = food.suitable.includes(tag) ? 0 : 5;
  if ((workoutTiming === 'pre' || workoutTiming === 'post') && food.category === 'fat') score += 2;
  if (workoutTiming === 'post' && food.glycemicIndex === 'high') score -= 1;
  if (food.digestibility === 'heavy' && workoutTiming !== 'none') score += 2;
  return score;
};

const uniqueFoods = (foods: LocalFood[]) => {
  const seen = new Set<string>();
  return foods.filter((food) => {
    if (seen.has(food.id)) return false;
    seen.add(food.id);
    return true;
  });
};

const buildMealCandidate = (
  selectedFoods: LocalFood[],
  target: MacroTarget,
  workoutTiming: MealWorkoutTiming,
  dayKind: DayKind,
  usedFoodIds: Set<string>,
  dailyTarget: MacroTarget,
  tolerancePercent: number,
): MealCandidate => {
  const initial = selectedFoods.map((food) => ({ food, grams: initialGramsForFood(food, target) }));
  const portions = optimizePortions(initial, target, workoutTiming, dayKind, usedFoodIds);
  const actual = combinationMacros(portions);
  return {
    portions,
    actual,
    score: scorePortions(portions, target, workoutTiming, dayKind, usedFoodIds),
    withinTolerance: withinMacroTolerance(actual, target, dailyTarget, tolerancePercent),
  };
};

const generateMeal = ({
  target,
  foods,
  tag,
  workoutTiming,
  dayKind,
  usedFoodIds,
  dailyTarget,
  tolerancePercent,
  attempt,
}: {
  target: MacroTarget;
  foods: LocalFood[];
  tag: MealTag;
  workoutTiming: MealWorkoutTiming;
  dayKind: DayKind;
  usedFoodIds: Set<string>;
  dailyTarget: MacroTarget;
  tolerancePercent: number;
  attempt: number;
}): MealCandidate => {
  const activeTargets = MACROS.some((key) => target[key] > 0.05);
  if (!activeTargets) return { portions: [], actual: { carbs: 0, protein: 0, fat: 0 }, score: 0, withinTolerance: true };

  const suitable = foods.filter((food) => food.suitable.includes(tag));
  const pool = suitable.length >= 3 ? suitable : foods;
  if (!pool.length) return { portions: [], actual: { carbs: 0, protein: 0, fat: 0 }, score: Number.POSITIVE_INFINITY, withinTolerance: false };

  const sorted = [...pool].sort((a, b) => {
    const suitability = foodSuitabilityScore(a, tag, workoutTiming) - foodSuitabilityScore(b, tag, workoutTiming);
    if (suitability !== 0) return suitability;
    const used = Number(usedFoodIds.has(a.id)) - Number(usedFoodIds.has(b.id));
    return used !== 0 ? used : a.name.localeCompare(b.name);
  });

  const byRole = (role: keyof MacroTarget, limit: number) => rotate(
    sorted.filter((food) => getFoodPrimaryRole(food) === role),
    attempt,
  ).slice(0, limit);
  const carbs = byRole('carbs', 6);
  const proteins = byRole('protein', 6);
  const fats = byRole('fat', 5);
  const mixed = rotate(sorted.filter((food) => food.category === 'mixed'), attempt).slice(0, 5);

  const combinations: LocalFood[][] = [];
  for (const carb of carbs) {
    for (const protein of proteins) {
      if (target.fat > 1) {
        for (const fat of fats.slice(0, 4)) combinations.push(uniqueFoods([carb, protein, fat]));
      }
      combinations.push(uniqueFoods([carb, protein]));
    }
  }
  for (const carb of carbs.slice(0, 5)) {
    for (const mix of mixed) combinations.push(uniqueFoods([carb, mix]));
  }
  for (const protein of proteins.slice(0, 5)) {
    for (const fat of fats.slice(0, 5)) combinations.push(uniqueFoods([protein, fat]));
  }
  for (const mix of mixed) {
    combinations.push([mix]);
    for (const fat of fats.slice(0, 3)) combinations.push(uniqueFoods([mix, fat]));
  }

  if (!combinations.length) {
    for (const food of rotate(sorted, attempt).slice(0, 10)) combinations.push([food]);
  }

  const candidates = combinations
    .filter((combo) => combo.length > 0 && combo.length <= 5)
    .map((combo) => buildMealCandidate(combo, target, workoutTiming, dayKind, usedFoodIds, dailyTarget, tolerancePercent))
    .sort((a, b) => {
      if (a.withinTolerance !== b.withinTolerance) return a.withinTolerance ? -1 : 1;
      return a.score - b.score;
    });

  return candidates[0] || {
    portions: [],
    actual: { carbs: 0, protein: 0, fat: 0 },
    score: Number.POSITIVE_INFINITY,
    withinTolerance: false,
  };
};

const runtimeActual = (meals: RuntimeMeal[]): MacroTarget =>
  meals.reduce((sum, meal) => addMacros(sum, combinationMacros(meal.portions)), { carbs: 0, protein: 0, fat: 0 });

const runtimeScore = (
  meals: RuntimeMeal[],
  dailyTarget: MacroTarget,
  tolerancePercent: number,
): number => {
  const dayActual = runtimeActual(meals);
  const dayError = MACROS.reduce((sum, key) => {
    const scale = Math.max(1, Math.abs(dailyTarget[key]));
    return sum + Math.abs(dayActual[key] - dailyTarget[key]) / scale;
  }, 0);
  const mealError = meals.reduce((sum, meal) => {
    const actual = combinationMacros(meal.portions);
    const valid = withinMacroTolerance(actual, meal.target, dailyTarget, tolerancePercent);
    return sum + macroLoss(actual, meal.target) + (valid ? 0 : 5);
  }, 0);
  return dayError * 20 + mealError;
};

const balanceDay = (
  input: RuntimeMeal[],
  dailyTarget: MacroTarget,
  tolerancePercent: number,
): RuntimeMeal[] => {
  let best = input.map((meal) => ({
    ...meal,
    target: cloneMacros(meal.target),
    portions: meal.portions.map((portion) => ({ ...portion })),
  }));
  let bestScore = runtimeScore(best, dailyTarget, tolerancePercent);

  for (let pass = 0; pass < 80; pass += 1) {
    let improved = false;
    for (let mealIndex = 0; mealIndex < best.length; mealIndex += 1) {
      for (let portionIndex = 0; portionIndex < best[mealIndex].portions.length; portionIndex += 1) {
        const portion = best[mealIndex].portions[portionIndex];
        const step = getPortionStep(portion.food);
        for (const delta of [step, -step]) {
          const candidate = best.map((meal) => ({
            ...meal,
            portions: meal.portions.map((entry) => ({ ...entry })),
          }));
          const current = candidate[mealIndex].portions[portionIndex];
          current.grams = quantizeFoodPortion(current.food, Math.max(0, current.grams + delta));
          candidate[mealIndex].portions = candidate[mealIndex].portions.filter(({ grams }) => grams > 0);
          const candidateScore = runtimeScore(candidate, dailyTarget, tolerancePercent);
          if (candidateScore < bestScore - 0.0001) {
            best = candidate;
            bestScore = candidateScore;
            improved = true;
          }
        }
      }
    }
    if (!improved) break;
  }
  return best;
};

const toGeneratedPortion = ({ food, grams }: Portion): GeneratedFoodPortion => {
  const macros = calculatePortionMacros(food, grams);
  return {
    foodId: food.id,
    grams,
    name: food.name,
    ...macros,
    kcal: calculateKcal(macros),
    source: food.source,
  };
};

const buildGeneratedMenu = (
  runtimeMeals: RuntimeMeal[],
  options: GenerateMenuOptions,
  tolerancePercent: number,
): GeneratedMenu => {
  const actual = runtimeActual(runtimeMeals);
  const generatedMeals: GeneratedMeal[] = runtimeMeals.map((meal) => {
    const mealActual = combinationMacros(meal.portions);
    return {
      name: meal.name,
      workoutTiming: meal.workoutTiming,
      target: cloneMacros(meal.target),
      actual: mealActual,
      withinTolerance: withinMacroTolerance(mealActual, meal.target, options.target, tolerancePercent),
      foods: meal.portions.map(toGeneratedPortion),
    };
  });
  const allMealsValid = generatedMeals.every((meal) => meal.withinTolerance);
  const dailyValid = dayWithinTolerance(actual, options.target, tolerancePercent);
  const exact = dayWithinExactPracticalTarget(actual, options.target) && allMealsValid;
  const valid = dailyValid && allMealsValid;
  const status: GeneratedMenu['status'] = exact ? 'exact' : valid ? 'balanced' : 'best_feasible';
  return {
    id: `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    macroProfileId: options.macroProfileId || 'local-current',
    timingTemplateId: options.timing.id,
    createdAt: new Date().toISOString(),
    engineVersion: NUTRITION_ENGINE_VERSION,
    status,
    tolerancePercent,
    generationMode: options.selectedFoodIds?.length ? 'selected_foods' : 'full_pool',
    ...(options.selectedFoodIds?.length ? { selectedFoodIds: [...options.selectedFoodIds] } : {}),
    meals: generatedMeals,
    target: cloneMacros(options.target),
    actual,
    targetKcal: calculateKcal(options.target),
    actualKcal: calculateKcal(actual),
    residuals: subtractMacros(options.target, actual),
  };
};

const qualityScore = (menu: GeneratedMenu): number => {
  const macroError = MACROS.reduce((sum, key) => {
    const scale = Math.max(1, Math.abs(menu.target[key]));
    return sum + Math.abs(menu.residuals[key]) / scale;
  }, 0);
  const invalidMeals = menu.meals.filter((meal) => !meal.withinTolerance).length;
  return invalidMeals * 10 + macroError;
};

export const generateNutritionMenu = (options: GenerateMenuOptions): GeneratedMenu => {
  if (!options.timing.meals.length) throw new Error('TIMING_REQUIRED');
  if (MACROS.every((key) => options.target[key] <= 0)) throw new Error('MACRO_TARGET_REQUIRED');

  const selectedSet = options.selectedFoodIds?.length ? new Set(options.selectedFoodIds) : null;
  const foods = selectedSet ? options.foods.filter((food) => selectedSet.has(food.id)) : options.foods;
  if (!foods.length) throw new Error('NO_FOODS_AVAILABLE');

  const dayKind: DayKind = options.dayKind || (options.timing.dayKind === 'all' ? 'workout' : options.timing.dayKind);
  const targets = calculateMealTargets(options.target, options.timing);
  const startTolerance = Math.min(20, Math.max(5, options.startTolerancePercent || 5));
  const ladder = DEFAULT_TOLERANCE_LEVELS.filter((level) => level >= startTolerance);
  const attemptOffset = Math.max(0, options.attemptSeed || 0);
  let bestFeasible: GeneratedMenu | null = null;

  for (const tolerancePercent of ladder) {
    const validAtLevel: GeneratedMenu[] = [];
    for (let localAttempt = 1; localAttempt <= 8; localAttempt += 1) {
      const usedFoodIds = new Set<string>(options.avoidFoodIds || []);
      const runtimeMeals: RuntimeMeal[] = [];
      for (let mealIndex = 0; mealIndex < targets.length; mealIndex += 1) {
        const target = targets[mealIndex];
        const timingMeal = options.timing.meals[mealIndex];
        const tag = mealTagFromIndex(mealIndex, target.name);
        const candidate = generateMeal({
          target,
          foods,
          tag,
          workoutTiming: timingMeal?.workoutTiming || 'none',
          dayKind,
          usedFoodIds,
          dailyTarget: options.target,
          tolerancePercent,
          attempt: attemptOffset + localAttempt + mealIndex,
        });
        candidate.portions.forEach(({ food }) => usedFoodIds.add(food.id));
        runtimeMeals.push({
          name: target.name,
          workoutTiming: timingMeal?.workoutTiming || 'none',
          target: { carbs: target.carbs, protein: target.protein, fat: target.fat },
          portions: candidate.portions,
        });
      }

      const balanced = balanceDay(runtimeMeals, options.target, tolerancePercent);
      const menu = buildGeneratedMenu(balanced, options, tolerancePercent);
      if (!bestFeasible || qualityScore(menu) < qualityScore(bestFeasible)) bestFeasible = menu;
      if (menu.status !== 'best_feasible') validAtLevel.push(menu);
    }

    if (validAtLevel.length) {
      validAtLevel.sort((a, b) => qualityScore(a) - qualityScore(b));
      return validAtLevel[0];
    }
  }

  if (!bestFeasible) throw new Error('NO_FEASIBLE_MENU');
  return bestFeasible;
};
