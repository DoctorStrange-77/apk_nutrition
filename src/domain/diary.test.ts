import { describe, expect, it } from 'vitest';
import { buildCurrentDiaryDay, copyDiaryDay, copyMealIntoDay, localDateKey, makeDiaryDay, shiftDateKey } from '@/domain/diary';
import type { LocalFood, ManualMeal } from '@/types/nutrition';

const food: LocalFood = {
  id: 'food-1', name: 'Riso', category: 'carb', carbs: 80, protein: 7, fat: 1,
  suitable: ['lunch'], source: 'builder',
};

const meals: ManualMeal[] = [
  { id: 'm1', name: 'Colazione', items: [] },
  { id: 'm2', name: 'Pranzo', items: [{ id: 'i1', food, grams: 100 }] },
];

describe('dated diary', () => {
  it('shifts date keys safely across month boundaries', () => {
    expect(shiftDateKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('copies an entire day without mutating the source', () => {
    const source = makeDiaryDay('2026-08-24', { carbs: 300, protein: 180, fat: 60 }, 'omogeneo', meals, null);
    const copied = copyDiaryDay(source, '2026-08-25');
    expect(source.date).toBe('2026-08-24');
    expect(copied.date).toBe('2026-08-25');
    expect(copied.target).toEqual(source.target);
    expect(copied.meals).toEqual(source.meals);
    expect(copied.meals).not.toBe(source.meals);
  });

  it('copies a meal into the matching meal of another day', () => {
    const destination = makeDiaryDay('2026-08-25', { carbs: 250, protein: 180, fat: 70 }, 'omogeneo', [
      { id: 'd1', name: 'Colazione', items: [] },
      { id: 'd2', name: 'Pranzo', items: [] },
    ], null);
    const result = copyMealIntoDay(destination, meals[1], 1);
    expect(result.meals[1].name).toBe('Pranzo');
    expect(result.meals[1].items).toHaveLength(1);
    expect(result.meals[1].items[0].food.name).toBe('Riso');
    expect(destination.meals[1].items).toHaveLength(0);
  });

  it('creates local date keys in YYYY-MM-DD format', () => {
    expect(localDateKey(new Date(2026, 7, 24))).toBe('2026-08-24');
  });
});

describe('nutrition + recovery diary compatibility', () => {
  it('preserves recovery and meal feedback when refreshing the current diary day', () => {
    const existing = makeDiaryDay('2026-09-08', { carbs:200, protein:180, fat:50 }, 'rest-5-balanced', meals, null);
    existing.recovery = {
      morningWeightKg:82.4,
      waterLiters:2.7,
      sleepHours:7.5,
      sleepQuality:8,
      stressLevel:3,
      energyLevel:8,
      steps:9200,
      hungerMorning:3,
      hungerAfternoon:5,
      hungerEvening:7,
      satietyLevel:7,
      cravingLevel:4,
      digestionQuality:'normal',
      bloatingLevel:2,
      reflux:false,
      abdominalDiscomfort:false,
      sleepiness:false,
      brainFog:false,
      bowelMovements:[{
        id:'bm-1',
        bristolType:4,
        timestamp:'2026-09-08T08:00:00.000Z',
        precedingMealIds:['m1'],
      }],
      notes:'Giornata regolare',
    };
    existing.mealFeedback = {
      m2:{
        mealId:'m2',
        hungerBefore:6,
        satietyAfter:8,
        digestionQuality:'light',
        bloatingLevel:1,
        reflux:false,
        sleepiness:false,
        brainFog:false,
        notes:'Ottimo',
      },
    };

    const refreshed = buildCurrentDiaryDay(
      '2026-09-08',
      { carbs:205, protein:180, fat:50 },
      'rest-5-balanced',
      meals,
      null,
      existing,
    );

    expect(refreshed.recovery).toEqual(existing.recovery);
    expect(refreshed.mealFeedback).toEqual(existing.mealFeedback);
    expect(refreshed.target.carbs).toBe(205);
  });

  it('does not copy actual recovery or symptoms when copying a food plan to another date', () => {
    const source = makeDiaryDay('2026-09-08', { carbs:200, protein:180, fat:50 }, 'rest-5-balanced', meals, null);
    source.recovery = {
      morningWeightKg:82.4,
      bowelMovements:[],
    };
    source.mealFeedback = {
      m2:{ mealId:'m2', digestionQuality:'heavy', bloatingLevel:6 },
    };

    const copied = copyDiaryDay(source, '2026-09-09');

    expect(copied.meals).toEqual(source.meals);
    expect(copied.recovery).toBeUndefined();
    expect(copied.mealFeedback).toBeUndefined();
  });
});

describe('nutrition recovery diary editing', () => {
  it('merges recovery fields without dropping previously recorded values', async () => {
    const { updateDiaryRecovery } = await import('@/domain/diary');
    const source = makeDiaryDay('2026-09-08', {carbs:200,protein:180,fat:50}, 'rest', meals, null);
    source.recovery = { sleepHours:7.5, stressLevel:4, bowelMovements:[] };
    const next = updateDiaryRecovery(source, { energyLevel:8, stressLevel:3 });
    expect(next.recovery?.sleepHours).toBe(7.5);
    expect(next.recovery?.stressLevel).toBe(3);
    expect(next.recovery?.energyLevel).toBe(8);
    expect(source.recovery?.energyLevel).toBeUndefined();
  });

  it('upserts feedback for one meal without touching the others', async () => {
    const { upsertDiaryMealFeedback } = await import('@/domain/diary');
    const source = makeDiaryDay('2026-09-08', {carbs:200,protein:180,fat:50}, 'rest', meals, null);
    source.mealFeedback = { m1:{mealId:'m1',hungerBefore:4} };
    const next = upsertDiaryMealFeedback(source, 'm2', { satietyAfter:8, digestionQuality:'light' });
    expect(next.mealFeedback?.m1.hungerBefore).toBe(4);
    expect(next.mealFeedback?.m2).toMatchObject({mealId:'m2',satietyAfter:8,digestionQuality:'light'});
  });

  it('adds and removes a Bristol event without mutating the source', async () => {
    const { addDiaryBowelMovement, removeDiaryBowelMovement } = await import('@/domain/diary');
    const source = makeDiaryDay('2026-09-08', {carbs:200,protein:180,fat:50}, 'rest', meals, null);
    const added = addDiaryBowelMovement(source, {
      id:'bm-new', bristolType:4, timestamp:'2026-09-08T09:00:00Z', precedingMealIds:['m1'],
    });
    expect(added.recovery?.bowelMovements).toHaveLength(1);
    expect(source.recovery).toBeUndefined();
    const removed = removeDiaryBowelMovement(added,'bm-new');
    expect(removed.recovery?.bowelMovements).toHaveLength(0);
  });
});
