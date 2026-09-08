import { calculateKcal, generateNutritionMenu } from '@/engine/nutritionEngine';
import { deriveTrainingAwareTiming, filterFoodsForEmergency } from '@/domain/intelligence/trainingAware';
import type {
  EmergencyMode, GeneratedMenu, LocalFood, MacroTarget, TimingMeal, TimingTemplate, TrainingContext,
} from '@/types/nutrition';

const zero: MacroTarget = { carbs:0, protein:0, fat:0 };
const add = (a:MacroTarget,b:MacroTarget):MacroTarget => ({ carbs:a.carbs+b.carbs, protein:a.protein+b.protein, fat:a.fat+b.fat });
const subtractClamp = (a:MacroTarget,b:MacroTarget):MacroTarget => ({
  carbs:Math.max(0,a.carbs-b.carbs), protein:Math.max(0,a.protein-b.protein), fat:Math.max(0,a.fat-b.fat),
});
const residual = (target:MacroTarget,actual:MacroTarget):MacroTarget => ({
  carbs:target.carbs-actual.carbs, protein:target.protein-actual.protein, fat:target.fat-actual.fat,
});

const normalizeRemainingTiming = (timing:TimingTemplate, remainingIndexes:number[]):TimingTemplate => {
  const selected = remainingIndexes.map((index) => timing.meals[index]).filter(Boolean);
  const sums = selected.reduce((acc, meal) => ({
    carbs:acc.carbs+meal.carbsPercent,
    protein:acc.protein+meal.proteinPercent,
    fat:acc.fat+meal.fatPercent,
  }), zero);

  const normalize = (meal:TimingMeal):TimingMeal => ({
    ...meal,
    carbsPercent:sums.carbs > 0 ? meal.carbsPercent / sums.carbs * 100 : 100 / Math.max(1,selected.length),
    proteinPercent:sums.protein > 0 ? meal.proteinPercent / sums.protein * 100 : 100 / Math.max(1,selected.length),
    fatPercent:sums.fat > 0 ? meal.fatPercent / sums.fat * 100 : 100 / Math.max(1,selected.length),
  });
  return { ...timing, id:timing.id + '-autopilot', name:timing.name + ' · Autopilot', meals:selected.map(normalize) };
};
export interface RebalanceRemainingDayOptions {
  menu: GeneratedMenu;
  completedMealIndexes: number[];
  actualCompletedMacros: MacroTarget;
  timing: TimingTemplate;
  foods: LocalFood[];
  target: MacroTarget;
  emergencyMode?: EmergencyMode;
  trainingContext?: TrainingContext | null;
  attemptSeed?: number;
}

export function rebalanceRemainingDay(options:RebalanceRemainingDayOptions):GeneratedMenu {
  const completed = new Set(options.completedMealIndexes);
  const remainingIndexes = options.menu.meals.map((_,index)=>index).filter((index)=>!completed.has(index));
  const completedMacros = { ...options.actualCompletedMacros };
  const remainingTarget = subtractClamp(options.target, completedMacros);

  if (!remainingIndexes.length) {
    return {
      ...options.menu,
      id:'autopilot-' + Date.now(),
      lockedMealIndexes:[...completed],
      target:{...options.target},
      actual:completedMacros,
      targetKcal:calculateKcal(options.target),
      actualKcal:calculateKcal(completedMacros),
      residuals:residual(options.target,completedMacros),
    };
  }

  let remainingTiming = normalizeRemainingTiming(options.timing, remainingIndexes);
  if (options.trainingContext) remainingTiming = deriveTrainingAwareTiming(remainingTiming, options.trainingContext);
  const availableFoods = filterFoodsForEmergency(options.foods, options.emergencyMode || 'none');
  const regenerated = generateNutritionMenu({
    target:remainingTarget,
    timing:remainingTiming,
    foods:availableFoods,
    attemptSeed:options.attemptSeed || 0,
    dayKind:remainingTiming.dayKind === 'all' ? (options.trainingContext?.isTrainingDay ? 'workout' : 'off') : remainingTiming.dayKind,
  });

  let generatedCursor = 0;
  const meals = options.menu.meals.map((meal,index) => {
    if (completed.has(index)) return meal;
    const next = regenerated.meals[generatedCursor];
    generatedCursor += 1;
    return next || meal;
  });
  const actual = add(completedMacros, regenerated.actual);

  return {
    ...options.menu,
    id:'autopilot-' + Date.now(),
    createdAt:new Date().toISOString(),
    status:regenerated.status,
    lockedMealIndexes:[...completed],
    meals,
    target:{...options.target},
    actual,
    targetKcal:calculateKcal(options.target),
    actualKcal:calculateKcal(actual),
    residuals:residual(options.target,actual),
  };
}
