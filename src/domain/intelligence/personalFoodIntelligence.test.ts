import { describe, expect, it } from 'vitest';
import {
  preferenceScore,
  rankFoodsByIntelligence,
  updateFoodSignal,
} from '@/domain/intelligence/personalFoodIntelligence';
import type { FoodPreferenceSignal, LocalFood } from '@/types/nutrition';

const food = (id:string): LocalFood => ({
  id,
  name:id,
  category:'carb',
  carbs:50,
  protein:5,
  fat:1,
  suitable:['lunch'],
  source:'core',
});

describe('personal food intelligence', () => {
  it('learns repeated positive and negative replacement signals with bounded scores', () => {
    let signals: FoodPreferenceSignal[] = [];
    for (let i = 0; i < 8; i += 1) signals = updateFoodSignal(signals, 'rice', 'replace_in');
    for (let i = 0; i < 5; i += 1) signals = updateFoodSignal(signals, 'pasta', 'replace_out');
    signals = updateFoodSignal(signals, 'rice', 'favorite');

    expect(preferenceScore('rice', signals)).toBeGreaterThan(0);
    expect(preferenceScore('pasta', signals)).toBeLessThan(0);
    expect(Math.abs(preferenceScore('rice', signals))).toBeLessThanOrEqual(100);
    expect(Math.abs(preferenceScore('pasta', signals))).toBeLessThanOrEqual(100);
  });

  it('prefers learned staples at low variety', () => {
    const foods = [food('rice'), food('pasta'), food('potato')];
    let signals: FoodPreferenceSignal[] = [];
    for (let i = 0; i < 5; i += 1) signals = updateFoodSignal(signals, 'rice', 'use');
    signals = updateFoodSignal(signals, 'rice', 'favorite');

    const ranked = rankFoodsByIntelligence(foods, signals, 10, ['rice']);
    expect(ranked[0].id).toBe('rice');
  });

  it('rotates away from very recent staples at high variety without deleting them', () => {
    const foods = [food('rice'), food('pasta'), food('potato')];
    let signals: FoodPreferenceSignal[] = [];
    for (let i = 0; i < 6; i += 1) signals = updateFoodSignal(signals, 'rice', 'use');

    const ranked = rankFoodsByIntelligence(foods, signals, 100, ['rice', 'pasta']);
    expect(ranked[0].id).toBe('potato');
    expect(ranked.map((item) => item.id).sort()).toEqual(['pasta','potato','rice']);
  });
});
