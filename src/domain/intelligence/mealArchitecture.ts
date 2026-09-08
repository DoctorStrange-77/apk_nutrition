import type { LocalFood, MealArchitectureId, MealTag, MealWorkoutTiming } from '@/types/nutrition';

export type SmartAlternativeKind = 'equivalent' | 'easy_digest' | 'fast' | 'no_cook' | 'whole_food';

const foodText = (food: LocalFood) =>
  (food.id + ' ' + food.name + ' ' + (food.brand || '') + ' ' + (food.subcategory || '')).toLowerCase();

const hasAny = (food: LocalFood, tokens: string[]) => {
  const text = foodText(food);
  return tokens.some((token) => text.includes(token));
};

const isPowder = (food: LocalFood) => hasAny(food, ['polvere', 'whey', 'caseina', 'destrosio', 'maltodestr']);
const isReadyProtein = (food: LocalFood) => hasAny(food, ['drink', 'pudding', 'hipro', 'milk pro']);
const isBread = (food: LocalFood) => hasAny(food, ['pane', 'bagel', 'toast']);
const isWrap = (food: LocalFood) => hasAny(food, ['wrap', 'piadina', 'tortilla']);
const isRice = (food: LocalFood) => hasAny(food, ['riso']);
const isPasta = (food: LocalFood) => hasAny(food, ['pasta', 'gnocchi']);
const isBowlCarb = (food: LocalFood) => hasAny(food, ['avena', 'fiocchi', 'cereali', 'granola']);
const isYogurt = (food: LocalFood) => hasAny(food, ['yogurt', 'skyr', 'quark', 'kefir']);

const allowedByTag: Record<MealTag, MealArchitectureId[]> = {
  breakfast: ['breakfast_bowl','yogurt_bowl','sandwich','shake','mixed'],
  snack: ['snack','yogurt_bowl','sandwich','wrap','shake','mixed'],
  lunch: ['rice_plate','pasta_plate','sandwich','wrap','savory_plate','mixed'],
  dinner: ['rice_plate','pasta_plate','wrap','savory_plate','mixed'],
  prenanna: ['yogurt_bowl','snack','shake','mixed'],
};
export function inferMealArchitecture(
  tag: MealTag,
  workoutTiming: MealWorkoutTiming,
  foods: LocalFood[],
): MealArchitectureId {
  if (!foods.length) return 'mixed';
  if (foods.some(isWrap)) return 'wrap';
  if (foods.some(isBread)) return 'sandwich';
  if (foods.some(isRice)) return 'rice_plate';
  if (foods.some(isPasta)) return 'pasta_plate';
  if (foods.some(isPowder)) return 'shake';
  if (tag === 'breakfast' && foods.some(isBowlCarb)) return 'breakfast_bowl';
  if (foods.some(isYogurt)) return 'yogurt_bowl';
  if (tag === 'snack' || tag === 'prenanna') return 'snack';
  if (tag === 'lunch' || tag === 'dinner') return 'savory_plate';
  if (workoutTiming === 'pre' || workoutTiming === 'post') return 'mixed';
  return 'mixed';
}

export function architectureAllowsCombination(
  tag: MealTag,
  workoutTiming: MealWorkoutTiming,
  foods: LocalFood[],
): boolean {
  const architecture = inferMealArchitecture(tag, workoutTiming, foods);
  return allowedByTag[tag].includes(architecture);
}

export function classifyAlternativeKind(original: LocalFood, alternative: LocalFood): SmartAlternativeKind {
  if (alternative.digestibility === 'easy' && original.digestibility !== 'easy') return 'easy_digest';
  if (isReadyProtein(alternative)) return 'fast';
  if (hasAny(alternative, ['pane', 'gallette', 'frutta', 'banana', 'mela']) && !hasAny(alternative, ['cotto', 'crudo'])) return 'no_cook';
  if (alternative.source === 'core' && !isPowder(alternative) && alternative.source !== original.source) return 'whole_food';
  if (alternative.source === 'core' && !isPowder(alternative) && isPowder(original)) return 'whole_food';
  if (alternative.source === 'core' && !isPowder(alternative) && hasAny(alternative, ['patate','riso','avena','frutta'])) return 'whole_food';
  return 'equivalent';
}

export function alternativeKindLabel(kind: SmartAlternativeKind): string {
  return ({ equivalent:'Equivalente', easy_digest:'Più digeribile', fast:'Più veloce', no_cook:'Senza cottura', whole_food:'Whole food' })[kind];
}
