import { pantryAvailableFoods, rankFoodsForRetailer } from '@/domain/intelligence/pantry';
import { deriveTrainingAwareTiming, filterFoodsForEmergency } from '@/domain/intelligence/trainingAware';
import type {
  LocalFood,
  PantryItem,
  SmartNutritionSettings,
  TimingTemplate,
  TrainingContext,
} from '@/types/nutrition';

const stableBoost = (foods:LocalFood[], boostedIds:Set<string>):LocalFood[] =>
  foods
    .map((food,index) => ({ food,index,boosted:boostedIds.has(food.id) ? 1 : 0 }))
    .sort((a,b) => (b.boosted - a.boosted) || (a.index - b.index))
    .map((entry) => entry.food);

export function buildSmartFoodPool(
  foods:LocalFood[],
  settings:SmartNutritionSettings,
  pantry:PantryItem[],
):LocalFood[] {
  let result = settings.retailer.trim()
    ? rankFoodsForRetailer(foods, settings.retailer)
    : [...foods];

  if ((settings.pantryFirst || settings.zeroWaste) && pantry.length) {
    const pantryIds = new Set(pantryAvailableFoods(pantry, result).map((food) => food.id));
    result = stableBoost(result, pantryIds);
  }

  return filterFoodsForEmergency(result, settings.emergencyMode);
}

export function resolveSmartTiming(
  timing:TimingTemplate,
  settings:SmartNutritionSettings,
  trainingContext?:TrainingContext | null,
):TimingTemplate {
  if (!settings.trainingAware || !trainingContext) return timing;
  return deriveTrainingAwareTiming(timing, trainingContext);
}
