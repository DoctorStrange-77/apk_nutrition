import type { EmergencyMode, LocalFood, TimingTemplate, TrainingContext } from '@/types/nutrition';

const cloneTiming = (timing: TimingTemplate): TimingTemplate => ({
  ...timing,
  meals: timing.meals.map((meal) => ({ ...meal })),
});

const redistributeCarbs = (timing: TimingTemplate, focusIndexes: number[]) => {
  const meals = timing.meals;
  if (!focusIndexes.length || meals.length < 2) return;
  const focus = new Set(focusIndexes);
  const donors = meals.map((_, index) => index).filter((index) => !focus.has(index));
  if (!donors.length) return;

  let moved = 0;
  for (const index of donors) {
    const available = Math.max(0, meals[index].carbsPercent - 8);
    const take = Math.min(4, available);
    meals[index].carbsPercent -= take;
    moved += take;
  }
  const each = moved / focusIndexes.length;
  for (const index of focusIndexes) meals[index].carbsPercent += each;
};

export function deriveTrainingAwareTiming(
  timing: TimingTemplate,
  context?: TrainingContext | null,
): TimingTemplate {
  const next = cloneTiming(timing);
  if (!context?.isTrainingDay || !next.meals.length) {
    return { ...next, meals: next.meals.map((meal) => ({ ...meal, workoutTiming:'none' })) };
  }

  const hour = Number((context.startTime || '18:00').split(':')[0]);
  const count = next.meals.length;
  let pre = 0;
  if (hour < 12) pre = 0;
  else if (hour < 17) pre = Math.max(0, Math.floor((count - 1) / 2));
  else pre = Math.max(0, count - 2);
  const post = Math.min(count - 1, pre + 1);

  next.meals = next.meals.map((meal, index) => ({
    ...meal,
    workoutTiming: index === pre ? 'pre' : index === post ? 'post' : 'none',
  }));
  redistributeCarbs(next, pre === post ? [pre] : [pre, post]);
  return next;
}
const textOf = (food: LocalFood) =>
  (food.id + ' ' + food.name + ' ' + (food.brand || '') + ' ' + (food.subcategory || '') + ' ' + (food.tags || []).join(' ')).toLowerCase();

const quickTokens = [
  'skyr','yogurt','quark','fiocchi di latte','bresaola','fesa di tacchino','tonno al naturale',
  'pane','gallette','wrap','piadina','banana','mela','frutta','protein pudding','high protein',
  'milk pro','milbona','ehrmann','hipro','yopro','fage','shake','whey','caseina','uova sode',
];
const outsideTokens = [
  'skyr','yogurt','quark','bresaola','fesa di tacchino','tonno al naturale','pane','gallette',
  'wrap','banana','mela','frutta','protein pudding','high protein','milk pro','milbona','ehrmann',
  'hipro','yopro','fage','shake','mandorle','noci','uova sode',
];

export function filterFoodsForEmergency(foods: LocalFood[], mode: EmergencyMode): LocalFood[] {
  if (mode === 'none' || mode === 'skipped_meal') return foods;
  const tokens = mode === 'outside_home' ? outsideTokens : quickTokens;
  const filtered = foods.filter((food) => {
    const text = textOf(food);
    return tokens.some((token) => text.includes(token)) || food.tags?.includes('quick') || food.tags?.includes('no-cook');
  });
  return filtered.length >= 8 ? filtered : foods;
}
