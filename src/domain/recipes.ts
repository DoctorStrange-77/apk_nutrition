import type {
  LocalFood,
  MacroTarget,
  ManualFoodItem,
  ManualMeal,
  Recipe,
  RecipeIngredient,
  SavedMealTemplate,
} from '@/types/nutrition';

const ZERO: MacroTarget = { carbs: 0, protein: 0, fat: 0 };

const add = (a: MacroTarget, b: MacroTarget): MacroTarget => ({
  carbs: a.carbs + b.carbs,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
});

const macrosForFood = (food: LocalFood, grams: number): MacroTarget => ({
  carbs: food.carbs * grams / 100,
  protein: food.protein * grams / 100,
  fat: food.fat * grams / 100,
});

export const recipeWeight = (ingredients: RecipeIngredient[]): number =>
  ingredients.reduce((sum, item) => sum + Math.max(0, item.grams), 0);

export function recipeTotals(recipe: Pick<Recipe, 'ingredients'>): MacroTarget {
  return recipe.ingredients.reduce((sum, item) => add(sum, macrosForFood(item.food, item.grams)), { ...ZERO });
}

export function recipeFiber(recipe: Pick<Recipe, 'ingredients'>): number {
  return recipe.ingredients.reduce((sum, item) => sum + (item.food.fiber || 0) * item.grams / 100, 0);
}

function classify(macros: MacroTarget): LocalFood['category'] {
  const energy = { carb: macros.carbs * 4, protein: macros.protein * 4, fat: macros.fat * 9 };
  const total = energy.carb + energy.protein + energy.fat;
  if (!total) return 'mixed';
  const relevant = Object.values(energy).filter((value) => value / total >= 0.2).length;
  if (relevant >= 2) return 'mixed';
  if (energy.protein >= energy.carb && energy.protein >= energy.fat) return 'protein';
  if (energy.fat >= energy.carb) return 'fat';
  return 'carb';
}

export function validateRecipe(recipe: Recipe): string[] {
  const errors: string[] = [];
  if (!recipe.name.trim()) errors.push('Inserisci il nome della ricetta.');
  if (!recipe.ingredients.length) errors.push('Aggiungi almeno un ingrediente.');
  if (recipe.ingredients.some((item) => item.grams <= 0)) errors.push('Le grammature devono essere maggiori di zero.');
  const rawWeight = recipeWeight(recipe.ingredients);
  if (recipe.cookedWeightGrams <= 0) errors.push('Inserisci il peso finale della preparazione.');
  if (recipe.cookedWeightGrams > rawWeight * 5) errors.push('Il peso finale sembra anomalo rispetto agli ingredienti.');
  if (recipe.servingGrams <= 0) errors.push('Inserisci una porzione valida.');
  if (recipe.cookedWeightGrams > 0 && recipe.servingGrams > recipe.cookedWeightGrams) errors.push('La porzione non puo superare il peso finale.');
  return errors;
}

export function recipeToLocalFood(recipe: Recipe): LocalFood {
  const totals = recipeTotals(recipe);
  const weight = Math.max(1, recipe.cookedWeightGrams || recipeWeight(recipe.ingredients));
  const per100 = {
    carbs: totals.carbs / weight * 100,
    protein: totals.protein / weight * 100,
    fat: totals.fat / weight * 100,
  };
  return {
    id: `recipe-food:${recipe.id}`,
    name: recipe.name,
    category: classify(per100),
    carbs: per100.carbs,
    protein: per100.protein,
    fat: per100.fat,
    fiber: recipeFiber(recipe) / weight * 100,
    suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
    source: 'recipe',
    recipeId: recipe.id,
    servingName: recipe.servingName || 'Porzione',
    servingGrams: recipe.servingGrams || 100,
    tags: ['ricetta'],
  };
}

export function createSavedMealTemplate(name: string, meal: ManualMeal): SavedMealTemplate {
  return {
    id: `saved-meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || meal.name,
    createdAt: new Date().toISOString(),
    items: meal.items.map((item) => ({ ...structuredClone(item), id: `saved-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })),
  };
}

export function appendSavedMeal(targetMeal: ManualMeal, saved: SavedMealTemplate): ManualMeal {
  const additions: ManualFoodItem[] = saved.items.map((item, index) => ({
    ...structuredClone(item),
    id: `manual-item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  }));
  return { ...targetMeal, items: [...targetMeal.items, ...additions] };
}

export function savedMealMacros(saved: SavedMealTemplate): MacroTarget {
  return saved.items.reduce((sum, item) => add(sum, macrosForFood(item.food, item.grams)), { ...ZERO });
}

export function createEmptyRecipe(): Recipe {
  const now = new Date().toISOString();
  return {
    id: `recipe-${Date.now()}`,
    name: '',
    ingredients: [],
    cookedWeightGrams: 0,
    servingName: 'Porzione',
    servingGrams: 100,
    createdAt: now,
    updatedAt: now,
  };
}
