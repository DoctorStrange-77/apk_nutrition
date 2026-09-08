import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SMART_NUTRITION_SETTINGS,
  defaultSmartNutritionSettings,
  normalizeSmartNutritionSettings,
} from '@/domain/intelligence/intelligenceState';

describe('Smart Nutrition intelligence state', () => {
  it('returns a safe independent default for legacy snapshots', () => {
    const first = normalizeSmartNutritionSettings(undefined);
    const second = defaultSmartNutritionSettings();

    expect(first).toEqual(DEFAULT_SMART_NUTRITION_SETTINGS);
    expect(second).toEqual(DEFAULT_SMART_NUTRITION_SETTINGS);
    expect(first).not.toBe(DEFAULT_SMART_NUTRITION_SETTINGS);
    expect(second).not.toBe(DEFAULT_SMART_NUTRITION_SETTINGS);
  });

  it('merges partial persisted settings with defaults', () => {
    expect(normalizeSmartNutritionSettings({
      variety: 82,
      retailer: 'Lidl',
      pantryFirst: true,
    })).toMatchObject({
      variety: 82,
      retailer: 'Lidl',
      pantryFirst: true,
      zeroWaste: DEFAULT_SMART_NUTRITION_SETTINGS.zeroWaste,
      emergencyMode: 'none',
      trainingAware: true,
      packageAwareShopping: true,
    });
  });

  it('clamps persisted variety to the supported 0-100 range', () => {
    expect(normalizeSmartNutritionSettings({ variety: -9 }).variety).toBe(0);
    expect(normalizeSmartNutritionSettings({ variety: 145 }).variety).toBe(100);
    expect(normalizeSmartNutritionSettings({ variety: Number.NaN }).variety)
      .toBe(DEFAULT_SMART_NUTRITION_SETTINGS.variety);
  });
});
