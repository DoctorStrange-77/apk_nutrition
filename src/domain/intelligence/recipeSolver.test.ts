import { describe, expect, it } from 'vitest';
import { solveRecipeToTarget } from '@/domain/intelligence/recipeSolver';
import type { LocalFood, Recipe } from '@/types/nutrition';

const oats: LocalFood = {
  id:'oats', name:'Avena', category:'carb',
  carbs:60, protein:13, fat:7, grammiMin:20, grammiMax:150,
  suitable:['breakfast'], source:'core',
};
const yogurt: LocalFood = {
  id:'yogurt', name:'Yogurt greco', category:'protein',
  carbs:4, protein:10, fat:0, grammiMin:50, grammiMax:350,
  suitable:['breakfast'], source:'core',
};
const peanut: LocalFood = {
  id:'peanut', name:'Crema arachidi', category:'fat',
  carbs:20, protein:25, fat:50, grammiMin:5, grammiMax:50,
  suitable:['breakfast'], source:'core',
};

const recipe: Recipe = {
  id:'pancake', name:'Pancake',
  ingredients:[
    {id:'i1',food:oats,grams:80},
    {id:'i2',food:yogurt,grams:150},
    {id:'i3',food:peanut,grams:15},
  ],
  cookedWeightGrams:230,
  servingName:'Pancake',
  servingGrams:230,
  createdAt:'2026-09-08',
  updatedAt:'2026-09-08',
};

describe('recipe macro solver', () => {
  it('optimizes ingredient grams toward a feasible macro target without mutating the source', () => {
    const original = structuredClone(recipe);
    const solved = solveRecipeToTarget(recipe, { carbs:45, protein:35, fat:10 });

    expect(recipe).toEqual(original);
    expect(Math.abs(solved.residuals.carbs)).toBeLessThanOrEqual(3);
    expect(Math.abs(solved.residuals.protein)).toBeLessThanOrEqual(3);
    expect(Math.abs(solved.residuals.fat)).toBeLessThanOrEqual(1.5);
    expect(['solved','best_feasible']).toContain(solved.status);
  });

  it('respects practical ingredient min/max bounds', () => {
    const solved = solveRecipeToTarget(recipe, { carbs:45, protein:35, fat:10 });
    for (const ingredient of solved.recipe.ingredients) {
      expect(ingredient.grams).toBeGreaterThanOrEqual(ingredient.food.grammiMin || 0);
      expect(ingredient.grams).toBeLessThanOrEqual(ingredient.food.grammiMax || 1000);
    }
  });

  it('returns best_feasible for an impossible target instead of creating absurd grams', () => {
    const solved = solveRecipeToTarget(recipe, { carbs:500, protein:500, fat:200 });
    expect(solved.status).toBe('best_feasible');
    expect(solved.recipe.ingredients.every((ingredient) => ingredient.grams <= (ingredient.food.grammiMax || 1000))).toBe(true);
  });
});
