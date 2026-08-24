import type { MealWorkoutTiming, TimingMeal, TimingTemplate } from '@/types/nutrition';

export const DEFAULT_BUILT_IN_TIMING_ID = 'rest-5-balanced';

const LEGACY_TIMING_MAP: Record<string, string> = {
  omogeneo: 'rest-5-balanced',
  'off-donna-cut': 'rest-5-balanced',
  'off-uomo-cut': 'rest-5-balanced',
  'off-donna-cut-4-pasti': 'rest-4-balanced',
  'wo-matt-no-colazione-cut': 'train-morning-fasted-4',
  'wo-matt-no-colazione-cut-4-pasti': 'train-morning-fasted-4',
  'wo-matt-post-colazione-cut': 'train-morning-after-breakfast-5',
  'wo-matt-1-spuntino-cut': 'train-late-morning-5',
  'wo-post-pranzo-cut': 'train-early-afternoon-5',
  'wo-pom-2-spuntino-cut': 'train-late-afternoon-5',
};

export const migrateBuiltInTimingId = (id?: string) =>
  id ? (LEGACY_TIMING_MAP[id] || id) : DEFAULT_BUILT_IN_TIMING_ID;

const workoutTimingFromName = (name: string): MealWorkoutTiming => {
  const value = name.toUpperCase();
  if (value.includes('PRE WO')) return 'pre';
  if (value.includes('POST WO')) return 'post';
  return 'none';
};
const make = (
  id: string,
  name: string,
  description: string,
  dayKind: TimingTemplate['dayKind'],
  rows: Array<[string, number, number, number]>,
): TimingTemplate => ({
  id,
  name,
  description,
  dayKind,
  builtIn: true,
  meals: rows.map(([mealName, c, p, f], index): TimingMeal => ({
    id: `${id}-meal-${index + 1}`,
    name: mealName,
    carbsPercent: c,
    proteinPercent: p,
    fatPercent: f,
    workoutTiming: workoutTimingFromName(mealName),
  })),
});

/**
 * Preset operativi: il target calorico e i macro sono definiti a monte.
 * Qui viene stabilita soltanto la distribuzione dei macro nei pasti.
 */
export const BUILT_IN_TIMINGS: TimingTemplate[] = [
  make(
    'rest-5-balanced',
    'Riposo - 5 pasti - Bilanciato',
    'Giorno senza allenamento: proteine regolari e carboidrati distribuiti soprattutto nei pasti principali.',
    'off',
    [
      ['Colazione', 20, 20, 20],
      ['Spuntino mattina', 10, 20, 20],
      ['Pranzo', 30, 20, 20],
      ['Spuntino pomeriggio', 10, 20, 20],
      ['Cena', 30, 20, 20],
    ],
  ),
  make(
    'rest-4-balanced',
    'Riposo - 4 pasti - Bilanciato',
    'Giorno senza allenamento su quattro pasti, con proteine distribuite uniformemente.',
    'off',
    [
      ['Colazione', 25, 25, 25],
      ['Pranzo', 30, 25, 25],
      ['Spuntino', 15, 25, 25],
      ['Cena', 30, 25, 25],
    ],
  ),
  make(
    'train-morning-fasted-4',
    'Workout mattina - Digiuno - 4 pasti',
    'Allenamento al mattino senza pasto pre: maggiore quota glucidica nel primo pasto post workout.',
    'workout',
    [
      ['Colazione - POST WO', 35, 25, 10],
      ['Pranzo', 30, 25, 25],
      ['Spuntino', 15, 25, 30],
      ['Cena', 20, 25, 35],
    ],
  ),
  make(
    'train-morning-after-breakfast-5',
    'Workout mattina - Dopo colazione - 5 pasti',
    'Allenamento dopo colazione: carboidrati concentrati tra pasto pre e primo pasto post workout.',
    'workout',
    [
      ['Colazione - PRE WO', 30, 20, 10],
      ['Spuntino - POST WO', 25, 20, 5],
      ['Pranzo', 20, 20, 25],
      ['Spuntino pomeriggio', 10, 20, 30],
      ['Cena', 15, 20, 30],
    ],
  ),
  make(
    'train-late-morning-5',
    'Workout tarda mattina - 5 pasti',
    'Allenamento tra spuntino mattutino e pranzo: pre leggero e pranzo come pasto post workout principale.',
    'workout',
    [
      ['Colazione', 15, 20, 25],
      ['Spuntino - PRE WO', 25, 20, 10],
      ['Pranzo - POST WO', 30, 20, 10],
      ['Spuntino pomeriggio', 10, 20, 25],
      ['Cena', 20, 20, 30],
    ],
  ),
  make(
    'train-early-afternoon-5',
    'Workout primo pomeriggio - 5 pasti',
    'Allenamento dopo pranzo: pranzo pre workout e spuntino successivo come principale pasto post workout.',
    'workout',
    [
      ['Colazione', 15, 20, 25],
      ['Spuntino mattina', 10, 20, 25],
      ['Pranzo - PRE WO', 30, 20, 10],
      ['Spuntino - POST WO', 30, 20, 10],
      ['Cena', 15, 20, 30],
    ],
  ),
  make(
    'train-late-afternoon-5',
    'Workout tardo pomeriggio - 5 pasti',
    'Allenamento nel tardo pomeriggio: spuntino pre workout e cena post workout con priorità glucidica.',
    'workout',
    [
      ['Colazione', 10, 20, 30],
      ['Spuntino mattina', 10, 20, 25],
      ['Pranzo', 25, 20, 20],
      ['Spuntino - PRE WO', 25, 20, 10],
      ['Cena - POST WO', 30, 20, 15],
    ],
  ),
  make(
    'train-evening-5',
    'Workout sera - Prima di cena - 5 pasti',
    'Allenamento serale prima di cena: spuntino pre workout e cena post workout con grassi contenuti nel peri-workout.',
    'workout',
    [
      ['Colazione', 10, 20, 25],
      ['Spuntino mattina', 10, 20, 25],
      ['Pranzo', 20, 20, 25],
      ['Spuntino - PRE WO', 30, 20, 10],
      ['Cena - POST WO', 30, 20, 15],
    ],
  ),
  make(
    'train-evening-4',
    'Workout sera - Prima di cena - 4 pasti',
    'Allenamento serale su quattro pasti: spuntino pre workout e cena post workout, con proteine uniformi.',
    'workout',
    [
      ['Colazione', 15, 25, 35],
      ['Pranzo', 25, 25, 30],
      ['Spuntino - PRE WO', 30, 25, 15],
      ['Cena - POST WO', 30, 25, 20],
    ],
  ),
  make(
    'train-late-evening-5',
    'Workout tarda sera - Dopo cena - 5 pasti',
    'Allenamento dopo cena: cena come pasto pre workout e ultimo pasto dedicato al recupero post workout.',
    'workout',
    [
      ['Colazione', 10, 20, 25],
      ['Spuntino mattina', 10, 20, 20],
      ['Pranzo', 20, 20, 25],
      ['Cena - PRE WO', 30, 20, 15],
      ['Pasto serale - POST WO', 30, 20, 15],
    ],
  ),
];
