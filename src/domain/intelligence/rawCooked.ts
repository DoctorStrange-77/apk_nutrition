import type { LocalFood, NutritionWeightBasis } from '@/types/nutrition';

export function convertFoodWeight(
  food: LocalFood,
  grams: number,
  from: NutritionWeightBasis,
  to: NutritionWeightBasis,
): number | null {
  const value = Number(grams);
  if (!Number.isFinite(value) || value < 0) return null;
  if (from === to) return value;

  const factor = food.cookedWeightFactor;
  if (!Number.isFinite(factor) || !factor || factor <= 0) return null;

  const converted = from === 'raw' && to === 'cooked'
    ? value * factor
    : value / factor;
  return Math.round(converted * 10) / 10;
}

export function rawCookedLabel(food: LocalFood): string {
  if (!food.nutritionWeightBasis) return 'Peso di riferimento non specificato';
  const basis = food.nutritionWeightBasis === 'raw' ? 'crudo' : 'cotto';
  if (!food.cookedWeightFactor) return 'Valori riferiti al peso ' + basis;
  return 'Valori riferiti al peso ' + basis + ' · conversione crudo/cotto disponibile';
}
