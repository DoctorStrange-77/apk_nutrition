import type { DailyRecoveryLog, DiaryBowelMovement, DiaryDay, DiaryMealFeedback, GeneratedMenu, MacroTarget, ManualMeal, TimingTemplate } from '@/types/nutrition';

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

export const copyDiaryDay = (source: DiaryDay, destinationDate: string): DiaryDay => {
  const copied = structuredClone(source);
  delete copied.recovery;
  delete copied.mealFeedback;
  return {
    ...copied,
    date: destinationDate,
    updatedAt: new Date().toISOString(),
  };
};

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
  existing?: DiaryDay,
): DiaryDay => {
  const next = makeDiaryDay(date, target, timingTemplateId, meals, generatedMenu);
  if (existing?.recovery) next.recovery = structuredClone(existing.recovery);
  if (existing?.mealFeedback) next.mealFeedback = structuredClone(existing.mealFeedback);
  return next;
};

export const updateDiaryRecovery = (
  day: DiaryDay,
  patch: Partial<DailyRecoveryLog>,
): DiaryDay => {
  const recovery = {
    ...(day.recovery ? structuredClone(day.recovery) : {}),
    ...structuredClone(patch),
  };
  return {
    ...day,
    recovery,
    updatedAt: new Date().toISOString(),
  };
};

export const upsertDiaryMealFeedback = (
  day: DiaryDay,
  mealId: string,
  patch: Omit<Partial<DiaryMealFeedback>, 'mealId'>,
): DiaryDay => {
  const existing = day.mealFeedback?.[mealId];
  return {
    ...day,
    mealFeedback: {
      ...(day.mealFeedback ? structuredClone(day.mealFeedback) : {}),
      [mealId]: {
        ...(existing ? structuredClone(existing) : {}),
        ...structuredClone(patch),
        mealId,
      },
    },
    updatedAt: new Date().toISOString(),
  };
};

export const addDiaryBowelMovement = (
  day: DiaryDay,
  movement: DiaryBowelMovement,
): DiaryDay => {
  const current = day.recovery?.bowelMovements || [];
  return updateDiaryRecovery(day, {
    bowelMovements: [
      ...current.filter((item) => item.id !== movement.id),
      structuredClone(movement),
    ],
  });
};

export const removeDiaryBowelMovement = (
  day: DiaryDay,
  movementId: string,
): DiaryDay => updateDiaryRecovery(day, {
  bowelMovements: (day.recovery?.bowelMovements || [])
    .filter((item) => item.id !== movementId),
});
