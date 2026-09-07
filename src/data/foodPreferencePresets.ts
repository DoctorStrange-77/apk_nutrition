import type { FoodPreferencePresetId, LocalFood } from '@/types/nutrition';

export interface FoodPreferencePreset {
  id: FoodPreferencePresetId;
  name: string;
  description: string;
}

export const FOOD_PREFERENCE_PRESETS: FoodPreferencePreset[] = [
  {
    id: 'all',
    name: 'Core completo',
    description: 'Usa tutta la libreria alimentare curata di App Nutrition.',
  },
  {
    id: 'bodybuilding',
    name: 'Bodybuilding',
    description: 'Alimenti pratici e ricorrenti in nutrizione sportiva/bodybuilding.',
  },
];

const textOf = (food: LocalFood): string =>
  `${food.id} ${food.name} ${food.brand || ''} ${food.subcategory || ''}`.toLowerCase();

const BODYBUILDING_CARB_TOKENS = [
  'riso', 'pasta', 'avena', 'patat', 'pane', 'gallette', 'cous cous', 'couscous',
  'farina', 'semolino', 'cereali', 'fiocchi', 'bagel', 'tortilla', 'piadina',
  'polenta', 'gnocchi', 'banana', 'mela', 'pera', 'arancia', 'mandarino', 'kiwi',
  'fragol', 'mirtill', 'lampone', 'more', 'ananas', 'mango', 'papaya', 'uva',
  'pesca', 'albicocc', 'cilieg', 'melone', 'anguria', 'fichi', 'prugne',
  'datteri', 'miele', 'marmellata', 'destrosio', 'maltodestr',
];

const BODYBUILDING_FAT_TOKENS = [
  'olio', 'mandor', 'noci', 'noccio', 'pistac', 'arachid', 'anacard',
  'avocado', 'semi', 'burro di arachidi', 'crema 100%', 'cacao', 'cocco',
];

const BODYBUILDING_MIXED_TOKENS = [
  'uovo', 'albume', 'yogurt', 'skyr', 'quark', 'kefir', 'fiocchi di latte',
  'ricotta', 'mozzarella', 'latte', 'salmone', 'sgombro', 'tonno',
  'legumi', 'ceci', 'lenticchie', 'fagioli', 'soia', 'tofu', 'tempeh', 'seitan',
  'hummus', 'high protein', 'protein pudding', 'protein drink', 'milk pro',
  'milbona', 'ehrmann', 'hipro', 'yopro', 'fage', 'müller', 'granarolo',
];

const includesAny = (text: string, tokens: string[]) => tokens.some((token) => text.includes(token));

export function isBodybuildingFood(food: LocalFood): boolean {
  const text = textOf(food);

  if (food.dataSource === 'Open Food Facts' && food.protein >= 6) return true;
  if (food.category === 'protein') return true;
  if (food.category === 'carb') return includesAny(text, BODYBUILDING_CARB_TOKENS);
  if (food.category === 'fat') return includesAny(text, BODYBUILDING_FAT_TOKENS);
  return includesAny(text, BODYBUILDING_MIXED_TOKENS);
}

export function filterFoodsByPreferencePreset(
  foods: LocalFood[],
  presetId: FoodPreferencePresetId,
): LocalFood[] {
  if (presetId === 'all') return foods;
  if (presetId === 'bodybuilding') return foods.filter(isBodybuildingFood);
  return foods;
}
