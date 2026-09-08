import { describe, expect, it } from 'vitest';
import { convertFoodWeight, rawCookedLabel } from '@/domain/intelligence/rawCooked';
import type { LocalFood } from '@/types/nutrition';

const rice: LocalFood = {
  id:'rice', name:'Riso', category:'carb',
  carbs:80, protein:7, fat:1, suitable:['lunch'], source:'core',
  nutritionWeightBasis:'raw', cookedWeightFactor:2.5,
};

describe('raw/cooked intelligence', () => {
  it('converts both directions when a factor is known', () => {
    expect(convertFoodWeight(rice, 100, 'raw', 'cooked')).toBe(250);
    expect(convertFoodWeight(rice, 250, 'cooked', 'raw')).toBe(100);
  });

  it('returns null instead of inventing a conversion factor', () => {
    expect(convertFoodWeight({ ...rice, cookedWeightFactor: undefined }, 100, 'raw', 'cooked')).toBeNull();
  });

  it('keeps same-basis weight unchanged and exposes a readable label', () => {
    expect(convertFoodWeight(rice, 80, 'raw', 'raw')).toBe(80);
    expect(rawCookedLabel(rice)).toContain('crudo');
  });
});
