import type { LocalFood, MacroTarget, ManualFoodItem, ManualMeal } from '@/types/nutrition';

export const emptyMacros = (): MacroTarget => ({ carbs: 0, protein: 0, fat: 0 });

export const kcalFromMacros = (macros: MacroTarget) => macros.carbs * 4 + macros.protein * 4 + macros.fat * 9;

export function macrosForFood(food: LocalFood, grams: number): MacroTarget {
  const ratio = Math.max(0, Number(grams) || 0) / 100;
  return {
    carbs: food.carbs * ratio,
    protein: food.protein * ratio,
    fat: food.fat * ratio,
  };
}

export function macrosForManualItem(item: ManualFoodItem): MacroTarget {
  return macrosForFood(item.food, item.grams);
}

export function macrosForManualMeal(meal: ManualMeal): MacroTarget {
  return meal.items.reduce((total, item) => {
    const macros = macrosForManualItem(item);
    return {
      carbs: total.carbs + macros.carbs,
      protein: total.protein + macros.protein,
      fat: total.fat + macros.fat,
    };
  }, emptyMacros());
}

export function macrosForManualDay(meals: ManualMeal[]): MacroTarget {
  return meals.reduce((total, meal) => {
    const macros = macrosForManualMeal(meal);
    return {
      carbs: total.carbs + macros.carbs,
      protein: total.protein + macros.protein,
      fat: total.fat + macros.fat,
    };
  }, emptyMacros());
}
