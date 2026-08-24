import type { DiaryDay, GeneratedMenu, MacroTarget, ManualMeal, TimingTemplate } from '@/types/nutrition';

export const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const dateFromKey = (key: string): Date => new Date(`${key}T12:00:00`);

export const shiftDateKey = (key: string, days: number): string => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

export const isTodayKey = (key: string): boolean => key === localDateKey();

export const formatDiaryDate = (key: string): string => {
  const date = dateFromKey(key);
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
};

export const emptyMealsForTiming = (timing: TimingTemplate): ManualMeal[] =>
  timing.meals.map((meal, index) => ({
    id: `diary-meal-${Date.now()}-${index}`,
    name: meal.name,
    items: [],
  }));

export const makeDiaryDay = (
  date: string,
  target: MacroTarget,
  timingTemplateId: string,
  meals: ManualMeal[],
  generatedMenu: GeneratedMenu | null = null,
): DiaryDay => ({
  date,
  target: { ...target },
  timingTemplateId,
  meals: structuredClone(meals),
  generatedMenu: generatedMenu ? structuredClone(generatedMenu) : null,
  updatedAt: new Date().toISOString(),
});

export const copyDiaryDay = (source: DiaryDay, destinationDate: string): DiaryDay => ({
  ...structuredClone(source),
  date: destinationDate,
  updatedAt: new Date().toISOString(),
});

export const copyMealIntoDay = (
  destination: DiaryDay,
  sourceMeal: ManualMeal,
  mealIndex: number,
): DiaryDay => {
  const meals = structuredClone(destination.meals);
  const normalized = sourceMeal.name.trim().toLowerCase();
  let index = meals.findIndex((meal) => meal.name.trim().toLowerCase() === normalized);
  if (index < 0) index = mealIndex < meals.length ? mealIndex : meals.length;
  if (!meals[index]) {
    meals[index] = { id: `diary-copy-${Date.now()}-${index}`, name: sourceMeal.name, items: [] };
  }
  meals[index] = { ...meals[index], items: structuredClone(sourceMeal.items) };
  return { ...destination, meals, updatedAt: new Date().toISOString() };
};

export const buildCurrentDiaryDay = (
  date: string,
  target: MacroTarget,
  timingTemplateId: string,
  meals: ManualMeal[],
  generatedMenu: GeneratedMenu | null,
): DiaryDay => makeDiaryDay(date, target, timingTemplateId, meals, generatedMenu);
