import type { FoodPortionUnit, LocalFood, ManualFoodItem, NutritionWeightBasis } from '@/types/nutrition';

export const GRAMS_MODE = 'grams';
export const RAW_MODE = 'raw';
export const COOKED_MODE = 'cooked';
export const UNIT_PREFIX = 'unit:';

export interface QuantityOption {
  value: string;
  label: string;
  subtitle?: string;
}

const finitePositive = (value: number | undefined): number =>
  Number.isFinite(value) && (value || 0) > 0 ? value as number : 0;

export function getFoodPortionUnits(food: LocalFood): FoodPortionUnit[] {
  const units: FoodPortionUnit[] = [];
  if (food.servingName && finitePositive(food.servingGrams)) {
    units.push({ id: 'legacy-serving', name: food.servingName, grams: food.servingGrams as number });
  }
  for (const unit of food.portionUnits || []) {
    const name = unit.name?.trim();
    const grams = finitePositive(unit.grams);
    if (!name || !grams) continue;
    if (units.some((item) => item.name.toLowerCase() === name.toLowerCase() && Math.abs(item.grams - grams) < 0.001)) continue;
    units.push({ id: unit.id || `unit-${units.length + 1}`, name, grams });
  }
  return units;
}

export function hasRawCookedConversion(food: LocalFood): boolean {
  return !!food.nutritionWeightBasis && finitePositive(food.cookedWeightFactor) > 0;
}

export function quantityOptions(food: LocalFood): QuantityOption[] {
  const options: QuantityOption[] = [];
  if (hasRawCookedConversion(food)) {
    const basis = food.nutritionWeightBasis as NutritionWeightBasis;
    options.push({ value: basis, label: basis === 'raw' ? 'g crudi' : 'g cotti', subtitle: 'Peso di riferimento nutrizionale' });
    options.push({ value: basis === 'raw' ? COOKED_MODE : RAW_MODE, label: basis === 'raw' ? 'g cotti' : 'g crudi', subtitle: 'Conversione automatica' });
  } else {
    options.push({ value: GRAMS_MODE, label: 'g' });
  }
  for (const unit of getFoodPortionUnits(food)) {
    options.push({ value: `${UNIT_PREFIX}${unit.id}`, label: unit.name, subtitle: `${unit.grams} g` });
  }
  return options;
}

export function defaultQuantityMode(food: LocalFood): string {
  const units = getFoodPortionUnits(food);
  if (units.length) return `${UNIT_PREFIX}${units[0].id}`;
  if (hasRawCookedConversion(food)) return food.nutritionWeightBasis as NutritionWeightBasis;
  return GRAMS_MODE;
}

function unitForMode(food: LocalFood, mode: string): FoodPortionUnit | undefined {
  if (!mode.startsWith(UNIT_PREFIX)) return undefined;
  const id = mode.slice(UNIT_PREFIX.length);
  return getFoodPortionUnits(food).find((unit) => unit.id === id);
}

export function gramsFromQuantity(food: LocalFood, mode: string, quantity: number): number {
  const amount = Math.max(0, Number(quantity) || 0);
  const unit = unitForMode(food, mode);
  if (unit) return amount * unit.grams;

  if (!hasRawCookedConversion(food)) return amount;
  const factor = finitePositive(food.cookedWeightFactor) || 1;
  const basis = food.nutritionWeightBasis as NutritionWeightBasis;
  if (mode === basis) return amount;
  if (basis === 'raw' && mode === COOKED_MODE) return amount / factor;
  if (basis === 'cooked' && mode === RAW_MODE) return amount * factor;
  return amount;
}

export function quantityFromGrams(food: LocalFood, mode: string, grams: number): number {
  const baseGrams = Math.max(0, Number(grams) || 0);
  const unit = unitForMode(food, mode);
  if (unit) return baseGrams / unit.grams;

  if (!hasRawCookedConversion(food)) return baseGrams;
  const factor = finitePositive(food.cookedWeightFactor) || 1;
  const basis = food.nutritionWeightBasis as NutritionWeightBasis;
  if (mode === basis) return baseGrams;
  if (basis === 'raw' && mode === COOKED_MODE) return baseGrams * factor;
  if (basis === 'cooked' && mode === RAW_MODE) return baseGrams / factor;
  return baseGrams;
}

export function modeLabel(food: LocalFood, mode?: string): string {
  const active = mode || defaultQuantityMode(food);
  return quantityOptions(food).find((option) => option.value === active)?.label || 'g';
}

export function manualItemQuantity(item: ManualFoodItem): number {
  return quantityFromGrams(item.food, item.quantityMode || defaultQuantityMode(item.food), item.grams);
}

export function setManualItemQuantity(item: ManualFoodItem, quantity: number): ManualFoodItem {
  const mode = item.quantityMode || defaultQuantityMode(item.food);
  return { ...item, quantityMode: mode, grams: gramsFromQuantity(item.food, mode, quantity) };
}

export function switchManualItemMode(item: ManualFoodItem, nextMode: string): ManualFoodItem {
  return { ...item, quantityMode: nextMode };
}

export function cookedFromRaw(rawGrams: number, cookedWeightFactor: number): number {
  return Math.max(0, rawGrams) * Math.max(0, cookedWeightFactor);
}

export function rawFromCooked(cookedGrams: number, cookedWeightFactor: number): number {
  const factor = Math.max(0, cookedWeightFactor);
  return factor > 0 ? Math.max(0, cookedGrams) / factor : 0;
}
