import { describe, expect, it } from 'vitest';
import {
  architectureAllowsCombination,
  classifyAlternativeKind,
  inferMealArchitecture,
} from '@/domain/intelligence/mealArchitecture';
import { explainGeneratedMeal } from '@/domain/intelligence/mealExplain';
import type { GeneratedMeal, LocalFood } from '@/types/nutrition';

const f = (id:string, name:string, category:LocalFood['category'], subcategory=''): LocalFood => ({
  id, name, category, subcategory,
  carbs: category === 'carb' ? 70 : 4,
  protein: category === 'protein' ? 25 : 5,
  fat: category === 'fat' ? 50 : 2,
  suitable:['breakfast','snack','lunch','dinner','prenanna'],
  source:'core',
});

describe('meal architecture intelligence', () => {
  it('recognizes common real meal structures', () => {
    expect(inferMealArchitecture('lunch', 'none', [f('rice','Riso basmati','carb'), f('chicken','Petto di pollo','protein')])).toBe('rice_plate');
    expect(inferMealArchitecture('breakfast', 'none', [f('oats','Fiocchi di avena','carb'), f('skyr','Skyr','protein')])).toBe('breakfast_bowl');
    expect(inferMealArchitecture('snack', 'none', [f('bread','Pane integrale','carb'), f('turkey','Fesa di tacchino','protein')])).toBe('sandwich');
  });

  it('rejects structures inappropriate for the meal context', () => {
    const ricePlate = [f('rice','Riso basmati','carb'), f('chicken','Petto di pollo','protein')];
    expect(architectureAllowsCombination('lunch', 'none', ricePlate)).toBe(true);
    expect(architectureAllowsCombination('breakfast', 'none', ricePlate)).toBe(false);
  });

  it('classifies alternative intent deterministically', () => {
    expect(classifyAlternativeKind(f('skyr','Skyr','protein'), f('hipro','HiPRO drink','protein'))).toBe('fast');
    expect(classifyAlternativeKind(f('rice','Riso basmati','carb'), f('potato','Patate','carb'))).toBe('whole_food');
  });

  it('creates a concise why-this-meal explanation', () => {
    const meal: GeneratedMeal = {
      name:'Pranzo', workoutTiming:'pre',
      target:{carbs:60,protein:40,fat:10}, actual:{carbs:59,protein:41,fat:9},
      withinTolerance:true, architecture:'rice_plate',
      foods:[{foodId:'rice',name:'Riso basmati',grams:80,carbs:60,protein:6,fat:1,kcal:273,source:'core'}],
    };
    const reasons = explainGeneratedMeal(meal);
    expect(reasons.join(' ')).toContain('pre-workout');
    expect(reasons.join(' ')).toContain('Riso basmati');
  });
});
