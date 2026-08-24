export type DayKind = 'workout' | 'off' | 'recovery';
export type MealWorkoutTiming = 'pre' | 'post' | 'none';

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
  category: 'carb' | 'protein' | 'fat' | 'mixed';
  subcategory?: string;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  grammiMin?: number;
  grammiMax?: number;
  suitable: Array<'breakfast' | 'snack' | 'lunch' | 'dinner' | 'prenanna'>;
  source: 'builder' | 'manual' | 'barcode' | 'external';
}

export interface GeneratedFoodPortion {
  foodId: string;
  grams: number;
  name: string;
  carbs: number;
  protein: number;
  fat: number;
}

export interface GeneratedMeal {
  name: string;
  target: MacroTarget;
  foods: GeneratedFoodPortion[];
}

export interface GeneratedMenu {
  id: string;
  macroProfileId: string;
  timingTemplateId: string;
  createdAt: string;
  engineVersion: 'nutrition-engine-v2';
  status: 'exact' | 'balanced' | 'best_feasible';
  meals: GeneratedMeal[];
  target: MacroTarget;
  actual: MacroTarget;
}
