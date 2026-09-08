import { describe, expect, it } from 'vitest';
import { scoreFoodDataConfidence } from '@/domain/intelligence/dataConfidence';
import type { LocalFood } from '@/types/nutrition';

const food = (patch: Partial<LocalFood>): LocalFood => ({
  id: 'f',
  name: 'Test food',
  category: 'protein',
  carbs: 4,
  protein: 20,
  fat: 2,
  suitable: ['lunch'],
  source: 'manual',
  ...patch,
});

describe('nutrition data confidence', () => {
  it('rates curated Smart Nutrition Core data as high confidence', () => {
    const result = scoreFoodDataConfidence(food({
      source: 'core',
      dataSource: 'Smart Nutrition Core',
      sourceReference: 'CREA/USDA curated reference',
    }));
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.label).toBe('alta');
  });
  it('distinguishes complete OFF records from user-entered foods', () => {
    const off = scoreFoodDataConfidence(food({
      source: 'external',
      dataSource: 'Open Food Facts',
      barcode: '1234567890123',
      sourceReference: 'Open Food Facts barcode 1234567890123',
      fiber: 2,
    }));
    const manual = scoreFoodDataConfidence(food({ source: 'manual', dataSource: 'User' }));
    expect(off.score).toBeGreaterThan(manual.score);
    expect(manual.label).not.toBe('alta');
  });

  it('penalizes invalid or implausible macro records', () => {
    const bad = scoreFoodDataConfidence(food({ carbs: 180, protein: 90, fat: 60 }));
    expect(bad.score).toBeLessThan(50);
    expect(bad.reasons.length).toBeGreaterThan(0);
  });
});
