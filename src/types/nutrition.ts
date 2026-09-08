export type DayKind = 'workout' | 'off' | 'recovery';
export type MealWorkoutTiming = 'pre' | 'post' | 'none';
export type MealTag = 'breakfast' | 'snack' | 'lunch' | 'dinner' | 'prenanna';
export type FoodCategory = 'carb' | 'protein' | 'fat' | 'mixed';
export type FoodPreferencePresetId = 'all' | 'bodybuilding' | 'high_protein' | 'mediterranean' | 'vegetarian' | 'vegan' | 'whole_foods' | 'quick_meals';
export type EmergencyMode = 'none' | 'low_time' | 'outside_home' | 'skipped_meal';
export type MealArchitectureId = 'breakfast_bowl' | 'yogurt_bowl' | 'rice_plate' | 'pasta_plate' | 'sandwich' | 'wrap' | 'shake' | 'snack' | 'savory_plate' | 'mixed';
export type TrainingSessionType = 'upper' | 'lower' | 'full_body' | 'cardio' | 'rest' | 'other';

export interface TrainingContext {
  isTrainingDay: boolean;
  startTime?: string;
  durationMinutes?: number;
  sessionType?: TrainingSessionType;
  intensity?: 'low' | 'medium' | 'high';
}

export interface SmartNutritionSettings {
  variety: number;
  retailer: string;
  pantryFirst: boolean;
  zeroWaste: boolean;
  emergencyMode: EmergencyMode;
  explanationMode: boolean;
  dataConfidence: boolean;
  rawCookedAssist: boolean;
  trainingAware: boolean;
  packageAwareShopping: boolean;
}

export interface PantryItem {
  foodId: string;
  gramsAvailable: number;
  packageGrams?: number;
  packagePrice?: number;
  retailer?: string;
  updatedAt: string;
}

export interface FoodPreferenceSignal {
  foodId: string;
  score: number;
  uses: number;
  favorites: number;
  replaceIn: number;
  replaceOut: number;
  likes: number;
  dislikes: number;
  updatedAt: string;
}

export interface PackageShoppingItem {
  foodId: string;
  name: string;
  gramsNeeded: number;
  gramsFromPantry: number;
  gramsToBuy: number;
  packageGrams?: number;
  packagesToBuy?: number;
  estimatedCost?: number;
  retailer?: string;
}

export interface CustomFoodPreferencePreset {
  id: string;
  name: string;
  description?: string;
  foodIds: string[];
  createdAt: string;
  updatedAt: string;
}

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

export interface FoodPortionUnit {
  id: string;
  name: string;
  grams: number;
}

export type NutritionWeightBasis = 'raw' | 'cooked';

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
  source: 'core' | 'builder' | 'manual' | 'barcode' | 'external' | 'recipe';
  dataSource?: 'Smart Nutrition Core' | 'Open Food Facts' | 'User' | 'Recipe';
  sourceReference?: string;
  verifiedAt?: string;
  servingName?: string;
  servingGrams?: number;
  portionUnits?: FoodPortionUnit[];
  nutritionWeightBasis?: NutritionWeightBasis;
  cookedWeightFactor?: number;
  recipeId?: string;
  glycemicIndex?: 'low' | 'medium' | 'high';
  digestibility?: 'easy' | 'medium' | 'heavy';
  digestibilityScore?: number;
  satietyScore?: number;
  hasOmega3?: boolean;
  omega3?: boolean;
  maxDailyOccurrences?: number;
  tags?: string[];
}

export type SmartAlternativeKind = 'equivalent' | 'easy_digest' | 'fast' | 'no_cook' | 'whole_food';

export interface GeneratedFoodAlternative {
  foodId: string;
  grams: number;
  name: string;
  carbs: number;
  protein: number;
  fat: number;
  kcal: number;
  source: LocalFood['source'];
  kind?: SmartAlternativeKind;
  reason?: string;
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
  alternatives?: GeneratedFoodAlternative[];
}

export interface GeneratedMeal {
  name: string;
  workoutTiming: MealWorkoutTiming;
  architecture?: MealArchitectureId;
  explanations?: string[];
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
  lockedMealIndexes?: number[];
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
  quantityMode?: string;
}

export interface ManualMeal {
  id: string;
  name: string;
  items: ManualFoodItem[];
}

export type DigestionQuality = 'light' | 'normal' | 'heavy';

export interface DiaryBowelMovement {
  id: string;
  bristolType: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  timestamp: string;
  precedingMealIds: string[];
}

export interface DailyRecoveryLog {
  morningWeightKg?: number;
  waterLiters?: number;
  sleepHours?: number;
  sleepQuality?: number;
  stressLevel?: number;
  energyLevel?: number;
  steps?: number;
  hungerMorning?: number;
  hungerAfternoon?: number;
  hungerEvening?: number;
  satietyLevel?: number;
  cravingLevel?: number;
  digestionQuality?: DigestionQuality;
  bloatingLevel?: number;
  reflux?: boolean;
  abdominalDiscomfort?: boolean;
  sleepiness?: boolean;
  brainFog?: boolean;
  bowelMovements?: DiaryBowelMovement[];
  notes?: string;
}

export interface DiaryMealFeedback {
  mealId: string;
  hungerBefore?: number;
  satietyAfter?: number;
  digestionQuality?: DigestionQuality;
  bloatingLevel?: number;
  reflux?: boolean;
  sleepiness?: boolean;
  brainFog?: boolean;
  notes?: string;
}

export interface DiaryDay {
  date: string;
  target: MacroTarget;
  timingTemplateId: string;
  meals: ManualMeal[];
  generatedMenu?: GeneratedMenu | null;
  recovery?: DailyRecoveryLog;
  mealFeedback?: Record<string, DiaryMealFeedback>;
  updatedAt: string;
}

export interface SavedMealTemplate {
  id: string;
  name: string;
  createdAt: string;
  items: ManualFoodItem[];
}

export interface RecipeIngredient {
  id: string;
  food: LocalFood;
  grams: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  cookedWeightGrams: number;
  servingName: string;
  servingGrams: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyDayConfig {
  date: string;
  enabled: boolean;
  target: MacroTarget;
  timingTemplateId: string;
  trainingContext?: TrainingContext;
}

export interface WeeklyPlannerConfig {
  weekStart: string;
  days: WeeklyDayConfig[];
  variety?: number;
  templateReuse?: boolean;
  pantryFirst?: boolean;
  updatedAt: string;
}

export interface WeeklyGeneratedDay {
  date: string;
  target: MacroTarget;
  timingTemplateId: string;
  menu: GeneratedMenu;
}

export interface WeeklyPlanResult {
  id: string;
  weekStart: string;
  createdAt: string;
  days: WeeklyGeneratedDay[];
}

export interface ShoppingListItem {
  foodId: string;
  name: string;
  grams: number;
  occurrences: number;
  source: LocalFood['source'];
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
  foodPreferencePresetId?: FoodPreferencePresetId;
  customFoodPreferences?: CustomFoodPreferencePreset[];
  activeCustomFoodPreferenceId?: string | null;
  diaryDays?: Record<string, DiaryDay>;
  activeDiaryDate?: string;
  favoriteFoodIds?: string[];
  recentFoodIds?: string[];
  savedMealTemplates?: SavedMealTemplate[];
  recipes?: Recipe[];
  smartSettings?: SmartNutritionSettings;
  pantryItems?: PantryItem[];
  foodPreferenceSignals?: FoodPreferenceSignal[];
  dailyTrainingContexts?: Record<string, TrainingContext>;
}
