import { generateNutritionMenu } from '@/engine/nutritionEngine';
import type {
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  ManualMeal,
  ShoppingListItem,
  TimingTemplate,
  WeeklyDayConfig,
  WeeklyPlanResult,
  WeeklyPlannerConfig,
} from '@/types/nutrition';

const DAY_MS = 86_400_000;
const pad = (value: number) => String(value).padStart(2, '0');

const parseKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const shiftDateKey = (key: string, days: number): string =>
  toKey(new Date(parseKey(key).getTime() + days * DAY_MS));
export const weekStartMonday = (key: string): string => {
  const date = parseKey(key);
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return shiftDateKey(key, delta);
};

export const shiftWeek = (weekStart: string, weeks: number): string =>
  shiftDateKey(weekStart, weeks * 7);

export function createWeeklyPlannerConfig(
  weekStart: string,
  target: MacroTarget,
  timingTemplateId: string,
): WeeklyPlannerConfig {
  const monday = weekStartMonday(weekStart);
  return {
    weekStart: monday,
    days: Array.from({ length: 7 }, (_, index): WeeklyDayConfig => ({
      date: shiftDateKey(monday, index),
      enabled: true,
      target: { ...target },
      timingTemplateId,
    })),
    updatedAt: new Date().toISOString(),
  };
}
export const copyDayToAll = (
  config: WeeklyPlannerConfig,
  sourceIndex: number,
): WeeklyPlannerConfig => {
  const source = config.days[sourceIndex];
  if (!source) return config;
  return {
    ...config,
    days: config.days.map((day) => ({
      ...day,
      enabled: source.enabled,
      target: { ...source.target },
      timingTemplateId: source.timingTemplateId,
    })),
    updatedAt: new Date().toISOString(),
  };
};

export const menuFoodIds = (menu: GeneratedMenu): string[] =>
  [...new Set(menu.meals.flatMap((meal) => meal.foods.map((food) => food.foodId)))];

export const generatedMenuToManualMeals = (
  menu: GeneratedMenu,
  foods: LocalFood[],
): ManualMeal[] => menu.meals.map((meal, mealIndex) => ({
  id: `weekly-meal-${Date.now()}-${mealIndex}`,
  name: meal.name,
  items: meal.foods.map((portion, itemIndex) => ({
    id: `weekly-item-${Date.now()}-${mealIndex}-${itemIndex}`,
    food: structuredClone(
      foods.find((food) => food.id === portion.foodId) || {
        id: portion.foodId,
        name: portion.name,
        category: 'mixed',
        carbs: portion.carbs * 100 / Math.max(1, portion.grams),
        protein: portion.protein * 100 / Math.max(1, portion.grams),
        fat: portion.fat * 100 / Math.max(1, portion.grams),
        suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
        source: portion.source,
      },
    ),
    grams: portion.grams,
  })),
}));

export function buildShoppingList(result: WeeklyPlanResult): ShoppingListItem[] {
  const map = new Map<string, ShoppingListItem>();
  result.days.forEach(({ menu }) => {
    menu.meals.forEach((meal) => meal.foods.forEach((portion) => {
      const current = map.get(portion.foodId);
      if (current) {
        current.grams += portion.grams;
        current.occurrences += 1;
      } else {
        map.set(portion.foodId, {
          foodId: portion.foodId,
          name: portion.name,
          grams: portion.grams,
          occurrences: 1,
          source: portion.source,
        });
      }
    }));
  });
  return [...map.values()]
    .map((item) => ({ ...item, grams: Math.round(item.grams) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type GenerateWeeklyOptions = {
  config: WeeklyPlannerConfig;
  timings: TimingTemplate[];
  foods: LocalFood[];
  selectedFoodIds?: string[];
  rotationWindowDays?: number;
};

export async function generateWeeklyPlan(options: GenerateWeeklyOptions): Promise<WeeklyPlanResult> {
  const generatedDays: WeeklyPlanResult['days'] = [];
  const recentFoodSets: string[][] = [];
  const windowSize = Math.max(0, Math.min(6, options.rotationWindowDays ?? 2));
  for (let index = 0; index < options.config.days.length; index += 1) {
    const day = options.config.days[index];
    if (!day.enabled) continue;
    const timing = options.timings.find((item) => item.id === day.timingTemplateId);
    if (!timing) throw new Error(`TIMING_NOT_FOUND:${day.timingTemplateId}`);
    const avoidFoodIds = [...new Set(recentFoodSets.flat())];
    const menu = generateNutritionMenu({
      target: day.target,
      timing,
      foods: options.foods,
      selectedFoodIds: options.selectedFoodIds?.length ? options.selectedFoodIds : undefined,
      attemptSeed: index * 3,
      dayKind: timing.dayKind === 'all' ? 'workout' : timing.dayKind,
      avoidFoodIds,
    });
    generatedDays.push({
      date: day.date,
      target: { ...day.target },
      timingTemplateId: day.timingTemplateId,
      menu,
    });
    recentFoodSets.push(menuFoodIds(menu));
    while (recentFoodSets.length > windowSize) recentFoodSets.shift();
    await Promise.resolve();
  }
  if (!generatedDays.length) throw new Error('NO_WEEKLY_DAYS_ENABLED');
  return {
    id: `week-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weekStart: options.config.weekStart,
    createdAt: new Date().toISOString(),
    days: generatedDays,
  };
}
