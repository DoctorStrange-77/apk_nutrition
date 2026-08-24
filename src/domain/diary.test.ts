import { describe, expect, it } from 'vitest';
import { copyDiaryDay, copyMealIntoDay, localDateKey, makeDiaryDay, shiftDateKey } from '@/domain/diary';
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
