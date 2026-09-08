import { describe, expect, it } from 'vitest';
import {
  buildSmartFoodPool,
  resolveSmartTiming,
} from '@/domain/intelligence/smartGeneration';
import { defaultSmartNutritionSettings } from '@/domain/intelligence/intelligenceState';
import type { LocalFood, PantryItem, TimingTemplate, TrainingContext } from '@/types/nutrition';

const food = (id:string, name:string, brand='', tags:string[]=[]):LocalFood => ({
  id, name, brand, tags,
  category:id.includes('rice') ? 'carb' : 'protein',
  carbs:id.includes('rice') ? 75 : 4,
  protein:id.includes('rice') ? 7 : 20,
  fat:2,
  suitable:['breakfast','snack','lunch','dinner','prenanna'],
  source:brand ? 'external' : 'core',
});

describe('smart generation composition', () => {
  it('boosts retailer and pantry foods without disturbing the relative order of other foods', () => {
    const foods = [
      food('preferred-rice','Riso preferito'),
      food('other-protein','Proteina B'),
      food('lidl-protein','High Protein','Milbona',['lidl']),
      food('pantry-protein','Proteina dispensa'),
    ];
    const pantry:PantryItem[] = [
      {foodId:'pantry-protein', gramsAvailable:300, updatedAt:'2026-09-08'},
    ];
    const settings = {
      ...defaultSmartNutritionSettings(),
      retailer:'Lidl',
      pantryFirst:true,
      emergencyMode:'none' as const,
    };

    const pool = buildSmartFoodPool(foods, settings, pantry);
    expect(pool.map((item) => item.id)).toEqual([
      'pantry-protein',
      'lidl-protein',
      'preferred-rice',
      'other-protein',
    ]);
  });

  it('treats zero-waste mode as pantry priority even when pantryFirst is off', () => {
    const foods = [
      food('other-protein','Proteina B'),
      food('pantry-protein','Proteina dispensa'),
    ];
    const pantry:PantryItem[] = [
      {foodId:'pantry-protein', gramsAvailable:200, updatedAt:'2026-09-08'},
    ];
    const settings = {
      ...defaultSmartNutritionSettings(),
      pantryFirst:false,
      zeroWaste:true,
    };
    expect(buildSmartFoodPool(foods, settings, pantry)[0].id).toBe('pantry-protein');
  });

  it('applies training-aware timing only when enabled and context exists', () => {
    const timing:TimingTemplate = {
      id:'rest', name:'Rest', dayKind:'off', builtIn:false,
      meals:[
        {id:'m1',name:'Colazione',carbsPercent:20,proteinPercent:20,fatPercent:20,workoutTiming:'none'},
        {id:'m2',name:'Pranzo',carbsPercent:30,proteinPercent:20,fatPercent:20,workoutTiming:'none'},
        {id:'m3',name:'Spuntino',carbsPercent:20,proteinPercent:20,fatPercent:20,workoutTiming:'none'},
        {id:'m4',name:'Cena',carbsPercent:30,proteinPercent:40,fatPercent:40,workoutTiming:'none'},
      ],
    };
    const context:TrainingContext = {
      isTrainingDay:true, startTime:'18:00', durationMinutes:75, sessionType:'upper', intensity:'high',
    };

    const enabled = resolveSmartTiming(timing, { ...defaultSmartNutritionSettings(), trainingAware:true }, context);
    const disabled = resolveSmartTiming(timing, { ...defaultSmartNutritionSettings(), trainingAware:false }, context);

    expect(enabled.meals.some((meal) => meal.workoutTiming === 'pre')).toBe(true);
    expect(enabled.meals.some((meal) => meal.workoutTiming === 'post')).toBe(true);
    expect(disabled).toEqual(timing);
  });
});
