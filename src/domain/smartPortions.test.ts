import { describe, expect, it } from 'vitest';
import type { LocalFood, ManualFoodItem } from '@/types/nutrition';
import {
  COOKED_MODE,
  defaultQuantityMode,
  gramsFromQuantity,
  manualItemQuantity,
  quantityFromGrams,
  quantityOptions,
  setManualItemQuantity,
  switchManualItemMode,
} from './smartPortions';

const food = (patch: Partial<LocalFood> = {}): LocalFood => ({
  id: 'rice',
  name: 'Riso',
  category: 'carb',
  carbs: 78,
  protein: 7,
  fat: 1,
  suitable: ['lunch', 'dinner'],
  source: 'manual',
  ...patch,
});

describe('smart portions', () => {
  it('converts practical units to the grams used by the engine', () => {
    const f = food({ portionUnits: [{ id: 'cup', name: 'Tazza', grams: 80 }] });
    expect(defaultQuantityMode(f)).toBe('unit:cup');
    expect(gramsFromQuantity(f, 'unit:cup', 1.5)).toBe(120);
    expect(quantityFromGrams(f, 'unit:cup', 120)).toBe(1.5);
  });

  it('keeps legacy serving fields compatible', () => {
    const f = food({ servingName: 'Vasetto', servingGrams: 170 });
    expect(quantityOptions(f).some((option) => option.label === 'Vasetto')).toBe(true);
    expect(gramsFromQuantity(f, 'unit:legacy-serving', 2)).toBe(340);
  });

  it('converts cooked weight into raw reference grams', () => {
    const f = food({ nutritionWeightBasis: 'raw', cookedWeightFactor: 2.5 });
    expect(gramsFromQuantity(f, COOKED_MODE, 250)).toBe(100);
    expect(quantityFromGrams(f, COOKED_MODE, 100)).toBe(250);
  });

  it('switches display mode without changing nutritional grams', () => {
    const f = food({ nutritionWeightBasis: 'raw', cookedWeightFactor: 2.5 });
    const item: ManualFoodItem = { id: 'x', food: f, grams: 100, quantityMode: 'raw' };
    const switched = switchManualItemMode(item, 'cooked');
    expect(switched.grams).toBe(100);
    expect(manualItemQuantity(switched)).toBe(250);
  });

  it('updates internal grams when a practical quantity changes', () => {
    const f = food({ portionUnits: [{ id: 'slice', name: 'Fetta', grams: 30 }] });
    const item: ManualFoodItem = { id: 'x', food: f, grams: 30, quantityMode: 'unit:slice' };
    expect(setManualItemQuantity(item, 2).grams).toBe(60);
  });
});
