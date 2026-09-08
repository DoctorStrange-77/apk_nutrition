import type { CustomFoodPreferencePreset, LocalFood } from '@/types/nutrition';

const uniqueIds = (ids: string[]) => [...new Set(ids.filter(Boolean))];

export function createCustomFoodPreference(
  name = '',
  foodIds: string[] = [],
  description = '',
): CustomFoodPreferencePreset {
  const now = new Date().toISOString();
  return {
    id: `custom-pref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    description: description.trim(),
    foodIds: uniqueIds(foodIds),
    createdAt: now,
    updatedAt: now,
  };
}

export function resolveCustomFoodPreferenceFoods(
  preset: CustomFoodPreferencePreset,
  foods: LocalFood[],
): LocalFood[] {
  const selected = new Set(preset.foodIds);
  return foods.filter((food) => selected.has(food.id));
}

const dominantRole = (food: LocalFood): 'carb' | 'protein' | 'fat' => {
  if (food.category === 'carb' || food.category === 'protein' || food.category === 'fat') return food.category;
  const energy = {
    carb: food.carbs * 4,
    protein: food.protein * 4,
    fat: food.fat * 9,
  };
  if (energy.protein >= energy.carb && energy.protein >= energy.fat) return 'protein';
  if (energy.fat >= energy.carb && energy.fat >= energy.protein) return 'fat';
  return 'carb';
};

const hasCarbRole = (food: LocalFood) => dominantRole(food) === 'carb';
const hasProteinRole = (food: LocalFood) => dominantRole(food) === 'protein';
const hasFatRole = (food: LocalFood) => dominantRole(food) === 'fat';

export function validateCustomFoodPreference(
  preset: CustomFoodPreferencePreset,
  foods: LocalFood[],
): string[] {
  const errors: string[] = [];
  const name = preset.name.trim();
  if (name.length < 2) errors.push('Inserisci un nome di almeno 2 caratteri.');

  const resolved = resolveCustomFoodPreferenceFoods(preset, foods);
  if (resolved.length < 3) errors.push('Seleziona almeno 3 alimenti disponibili.');

  if (!resolved.some(hasCarbRole)) errors.push('Aggiungi almeno una fonte di carboidrati.');
  if (!resolved.some(hasProteinRole)) errors.push('Aggiungi almeno una fonte proteica.');
  if (!resolved.some(hasFatRole)) errors.push('Aggiungi almeno una fonte di grassi.');

  return errors;
}
