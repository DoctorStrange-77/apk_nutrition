import { describe, expect, it } from 'vitest';
import {
  buildPackageAwareShoppingList,
  consumePantryForMenu,
  pantryAvailableFoods,
  rankFoodsForRetailer,
} from '@/domain/intelligence/pantry';
import type { GeneratedMenu, LocalFood, PantryItem } from '@/types/nutrition';

const foods: LocalFood[] = [
  { id:'rice', name:'Riso basmati', brand:'Generic', category:'carb', carbs:78, protein:7, fat:1, suitable:['lunch'], source:'core' },
  { id:'skyr-lidl', name:'Skyr naturale', brand:'Milbona', category:'protein', carbs:4, protein:11, fat:0.2, suitable:['snack'], source:'external', tags:['lidl'] },
  { id:'chicken', name:'Petto di pollo', category:'protein', carbs:0, protein:23, fat:2, suitable:['lunch'], source:'core' },
];

const menu: GeneratedMenu = {
  id:'m', macroProfileId:'p', timingTemplateId:'t', createdAt:'2026-09-08',
  engineVersion:'nutrition-engine-v2', status:'balanced', tolerancePercent:5, generationMode:'full_pool',
  target:{carbs:100,protein:100,fat:20}, actual:{carbs:100,protein:100,fat:20},
  targetKcal:980, actualKcal:980, residuals:{carbs:0,protein:0,fat:0},
  meals:[
    { name:'Pranzo', workoutTiming:'none', target:{carbs:60,protein:40,fat:10}, actual:{carbs:60,protein:40,fat:10}, withinTolerance:true,
      foods:[
        {foodId:'rice',grams:120,name:'Riso basmati',carbs:50,protein:8,fat:1,kcal:241,source:'core'},
        {foodId:'chicken',grams:200,name:'Petto di pollo',carbs:0,protein:46,fat:4,kcal:220,source:'core'},
      ]},
    { name:'Snack', workoutTiming:'none', target:{carbs:20,protein:20,fat:2}, actual:{carbs:20,protein:20,fat:2}, withinTolerance:true,
      foods:[{foodId:'skyr-lidl',grams:300,name:'Skyr naturale',carbs:12,protein:33,fat:0.6,kcal:185,source:'external'}]},
  ],
};

describe('pantry and zero waste intelligence', () => {
  it('returns only foods that are actually available in pantry-first mode', () => {
    const pantry: PantryItem[] = [
      {foodId:'rice',gramsAvailable:500,updatedAt:'2026-09-08'},
      {foodId:'missing',gramsAvailable:100,updatedAt:'2026-09-08'},
      {foodId:'chicken',gramsAvailable:0,updatedAt:'2026-09-08'},
    ];
    expect(pantryAvailableFoods(pantry, foods).map((food) => food.id)).toEqual(['rice']);
  });
  it('subtracts consumed quantities without going below zero', () => {
    const pantry: PantryItem[] = [
      {foodId:'rice',gramsAvailable:150,updatedAt:'2026-09-08'},
      {foodId:'chicken',gramsAvailable:120,updatedAt:'2026-09-08'},
    ];
    const next = consumePantryForMenu(pantry, menu);
    expect(next.find((item) => item.foodId === 'rice')?.gramsAvailable).toBe(30);
    expect(next.find((item) => item.foodId === 'chicken')?.gramsAvailable).toBe(0);
  });

  it('rounds shopping quantities to package sizes and uses pantry stock first', () => {
    const pantry: PantryItem[] = [
      {foodId:'rice',gramsAvailable:50,packageGrams:500,packagePrice:2.5,retailer:'Coop',updatedAt:'2026-09-08'},
      {foodId:'chicken',gramsAvailable:0,packageGrams:400,packagePrice:5,updatedAt:'2026-09-08'},
    ];
    const list = buildPackageAwareShoppingList(menu, pantry);
    const rice = list.find((item) => item.foodId === 'rice')!;
    const chicken = list.find((item) => item.foodId === 'chicken')!;
    expect(rice.gramsToBuy).toBe(70);
    expect(rice.packagesToBuy).toBe(1);
    expect(rice.estimatedCost).toBe(2.5);
    expect(chicken.packagesToBuy).toBe(1);
  });

  it('prioritizes retailer-tagged foods but never removes the others as if stock were known', () => {
    const ranked = rankFoodsForRetailer(foods, 'Lidl');
    expect(ranked[0].id).toBe('skyr-lidl');
    expect(ranked.slice(1).map((food) => food.id)).toEqual(['rice', 'chicken']);
    expect(ranked).toHaveLength(foods.length);
    expect(ranked.map((food) => food.id).sort()).toEqual(foods.map((food) => food.id).sort());
  });
});
