export type DayKind = 'workout' | 'off' | 'recovery';
export type MealWorkoutTiming = 'pre' | 'post' | 'none';
export type MealTag = 'breakfast' | 'snack' | 'lunch' | 'dinner' | 'prenanna';
export type FoodCategory = 'carb' | 'protein' | 'fat' | 'mixed';

export interface MacroTarget {
  carbs: number;
  protein: number;
  fat: number;
}

export interface MacroProfile extends MacroTarget {
  id: string;
  name: string;
  dayKind: DayKind;
  kcal: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimingMeal {
  id: string;
  name: string;
  carbsPercent: number;
  proteinPercent: number;
  fatPercent: number;
  workoutTiming: MealWorkoutTiming;
}

export interface TimingTemplate {
  id: string;
  name: string;
  description?: string;
  dayKind: DayKind | 'all';
  meals: TimingMeal[];
  builtIn: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalFood {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  category: FoodCategory;
  subcategory?: string;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  simpleSugars?: number;
  sodium?: number;
  grammiMin?: number;
  grammiMax?: number;
  mainSourceThreshold?: number;
  suitable: MealTag[];
  source: 'builder' | 'manual' | 'barcode' | 'external';
  glycemicIndex?: 'low' | 'medium' | 'high';
  digestibility?: 'easy' | 'medium' | 'heavy';
  digestibilityScore?: number;
  satietyScore?: number;
  hasOmega3?: boolean;
  omega3?: boolean;
  maxDailyOccurrences?: number;
  tags?: string[];
}

export interface GeneratedFoodPortion {
  foodId: string;
  grams: number;
  name: string;
  carbs: number;
  protein: number;
  fat: number;
  kcal: number;
  source: LocalFood['source'];
}

export interface GeneratedMeal {
  name: string;
  workoutTiming: MealWorkoutTiming;
  target: MacroTarget;
  actual: MacroTarget;
  withinTolerance: boolean;
  foods: GeneratedFoodPortion[];
}

export interface GeneratedMenu {
  id: string;
  macroProfileId: string;
  timingTemplateId: string;
  createdAt: string;
  engineVersion: 'nutrition-engine-v2';
  status: 'exact' | 'balanced' | 'best_feasible';
  tolerancePercent: number;
  generationMode: 'full_pool' | 'selected_foods';
  selectedFoodIds?: string[];
  meals: GeneratedMeal[];
  target: MacroTarget;
  actual: MacroTarget;
  targetKcal: number;
  actualKcal: number;
  residuals: MacroTarget;
}

export interface ManualFoodItem {
  id: string;
  food: LocalFood;
  grams: number;
}

export interface ManualMeal {
  id: string;
  name: string;
  items: ManualFoodItem[];
}

export interface SavedManualMenu {
  id: string;
  createdAt: string;
  timingTemplateId: string;
  target: MacroTarget;
  actual: MacroTarget;
  targetKcal: number;
  actualKcal: number;
  meals: ManualMeal[];
}

export interface NutritionAppSnapshot {
  customTimings: TimingTemplate[];
  customFoods: LocalFood[];
  savedMenus: GeneratedMenu[];
  savedManualMenus?: SavedManualMenu[];
  foodOverrides?: Record<string, LocalFood>;
  deletedFoodIds?: string[];
  manualMeals?: ManualMeal[];
  lastTarget?: MacroTarget;
  lastTimingId?: string;
  lastMenuMode?: 'automatic' | 'manual';
  selectedFoodIds?: string[];
}
