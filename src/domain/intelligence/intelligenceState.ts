import type { SmartNutritionSettings } from '@/types/nutrition';

export const DEFAULT_SMART_NUTRITION_SETTINGS: SmartNutritionSettings = {
  variety: 50,
  retailer: '',
  pantryFirst: false,
  zeroWaste: false,
  emergencyMode: 'none',
  explanationMode: true,
  dataConfidence: true,
  rawCookedAssist: true,
  trainingAware: true,
  packageAwareShopping: true,
};

const clampVariety = (value: number) => Math.min(100, Math.max(0, value));

export const defaultSmartNutritionSettings = (): SmartNutritionSettings => ({
  ...DEFAULT_SMART_NUTRITION_SETTINGS,
});

export const normalizeSmartNutritionSettings = (
  value: Partial<SmartNutritionSettings> | null | undefined,
): SmartNutritionSettings => {
  const variety = value?.variety;

  return {
    ...DEFAULT_SMART_NUTRITION_SETTINGS,
    ...(value || {}),
    variety: clampVariety(typeof variety === 'number' && Number.isFinite(variety) ? variety : DEFAULT_SMART_NUTRITION_SETTINGS.variety),
  };
};
