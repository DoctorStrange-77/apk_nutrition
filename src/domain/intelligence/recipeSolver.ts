import { recipeTotals, recipeWeight } from '@/domain/recipes';
import type { MacroTarget, Recipe, RecipeIngredient } from '@/types/nutrition';

export interface RecipeSolverResult {
  recipe: Recipe;
  actual: MacroTarget;
  residuals: MacroTarget;
  status: 'solved' | 'best_feasible';
}

const clamp = (value:number, min:number, max:number) => Math.max(min, Math.min(max, value));

const bounds = (ingredient:RecipeIngredient) => {
  const min = ingredient.food.grammiMin != null
    ? Math.max(0, ingredient.food.grammiMin)
    : Math.min(5, Math.max(0, ingredient.grams));
  const fallbackMax = Math.max(250, ingredient.grams * 3, min + 100);
  const max = ingredient.food.grammiMax != null
    ? Math.max(min, ingredient.food.grammiMax)
    : fallbackMax;
  return { min, max };
};

const residualsFor = (actual:MacroTarget, target:MacroTarget):MacroTarget => ({
  carbs:target.carbs - actual.carbs,
  protein:target.protein - actual.protein,
  fat:target.fat - actual.fat,
});

const loss = (actual:MacroTarget, target:MacroTarget):number => {
  const scale = {
    carbs:Math.max(10, target.carbs),
    protein:Math.max(10, target.protein),
    fat:Math.max(5, target.fat),
  };
  const c = (actual.carbs - target.carbs) / scale.carbs;
  const p = (actual.protein - target.protein) / scale.protein;
  const f = (actual.fat - target.fat) / scale.fat;
  return c * c + p * p + f * f;
};

const solvedEnough = (residuals:MacroTarget) =>
  Math.abs(residuals.carbs) <= 3
  && Math.abs(residuals.protein) <= 3
  && Math.abs(residuals.fat) <= 1.5;

export function solveRecipeToTarget(recipe:Recipe, target:MacroTarget):RecipeSolverResult {
  const originalRawWeight = Math.max(1, recipeWeight(recipe.ingredients));
  const cookedRatio = recipe.cookedWeightGrams > 0
    ? recipe.cookedWeightGrams / originalRawWeight
    : 1;
  let best:Recipe = structuredClone(recipe);

  best.ingredients = best.ingredients.map((ingredient) => {
    const limit = bounds(ingredient);
    return { ...ingredient, grams:clamp(ingredient.grams, limit.min, limit.max) };
  });

  let bestActual = recipeTotals(best);
  let bestLoss = loss(bestActual, target);
  const steps = [25, 10, 5, 2, 1];

  for (const step of steps) {
    let improved = true;
    let passes = 0;
    while (improved && passes < 80) {
      improved = false;
      passes += 1;
      for (let index = 0; index < best.ingredients.length; index += 1) {
        const ingredient = best.ingredients[index];
        const limit = bounds(ingredient);
        for (const delta of [step, -step]) {
          const nextGrams = clamp(ingredient.grams + delta, limit.min, limit.max);
          if (Math.abs(nextGrams - ingredient.grams) < 0.0001) continue;
          const candidate = structuredClone(best);
          candidate.ingredients[index].grams = Math.round(nextGrams * 10) / 10;
          const actual = recipeTotals(candidate);
          const candidateLoss = loss(actual, target);
          if (candidateLoss < bestLoss - 1e-9) {
            best = candidate;
            bestActual = actual;
            bestLoss = candidateLoss;
            improved = true;
            break;
          }
        }
      }
    }
  }

  const newRawWeight = Math.max(1, recipeWeight(best.ingredients));
  best.cookedWeightGrams = Math.round(newRawWeight * cookedRatio * 10) / 10;
  if (best.servingGrams > best.cookedWeightGrams) best.servingGrams = best.cookedWeightGrams;
  best.updatedAt = new Date().toISOString();

  bestActual = recipeTotals(best);
  const residuals = residualsFor(bestActual, target);
  return {
    recipe:best,
    actual:bestActual,
    residuals,
    status:solvedEnough(residuals) ? 'solved' : 'best_feasible',
  };
}
