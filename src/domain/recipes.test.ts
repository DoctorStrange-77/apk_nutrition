import { describe, expect, it } from 'vitest';
import { appendSavedMeal, createSavedMealTemplate, recipeToLocalFood, recipeTotals, validateRecipe } from '@/domain/recipes';
import type { LocalFood, ManualMeal, Recipe } from '@/types/nutrition';

const oats: LocalFood = { id:'oats', name:'Avena', category:'carb', carbs:60, protein:13, fat:7, fiber:10, suitable:['breakfast'], source:'builder' };
const yogurt: LocalFood = { id:'yogurt', name:'Yogurt', category:'protein', carbs:4, protein:10, fat:0, suitable:['breakfast'], source:'builder' };

const recipe: Recipe = {
  id:'pancake', name:'Pancake proteico',
  ingredients:[
    { id:'i1', food:oats, grams:100 },
    { id:'i2', food:yogurt, grams:200 },
  ],
  cookedWeightGrams:250,
  servingName:'Pancake',
  servingGrams:125,
  createdAt:'2026-08-24T00:00:00.000Z',
  updatedAt:'2026-08-24T00:00:00.000Z',
};

describe('recipes and saved meals', () => {
  it('calculates recipe totals and values per 100g', () => {
    expect(recipeTotals(recipe)).toEqual({ carbs:68, protein:33, fat:7 });
    const food = recipeToLocalFood(recipe);
    expect(food.source).toBe('recipe');
    expect(food.carbs).toBeCloseTo(27.2, 5);
    expect(food.protein).toBeCloseTo(13.2, 5);
    expect(food.fat).toBeCloseTo(2.8, 5);
    expect(food.servingGrams).toBe(125);
  });

  it('validates incomplete recipes', () => {
    const invalid = { ...recipe, name:'', ingredients:[], cookedWeightGrams:0, servingGrams:0 };
    expect(validateRecipe(invalid).length).toBeGreaterThanOrEqual(4);
  });

  it('saves a meal as an immutable reusable template', () => {
    const meal: ManualMeal = { id:'m1', name:'Colazione', items:[{ id:'x', food:oats, grams:80 }] };
    const saved = createSavedMealTemplate('Colazione solita', meal);
    const target: ManualMeal = { id:'m2', name:'Spuntino', items:[] };
    const applied = appendSavedMeal(target, saved);
    expect(applied.items).toHaveLength(1);
    expect(applied.items[0].grams).toBe(80);
    expect(applied.items[0].id).not.toBe(saved.items[0].id);
  });
});
