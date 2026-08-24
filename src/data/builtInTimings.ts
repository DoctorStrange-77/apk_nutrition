import type { MealWorkoutTiming, TimingMeal, TimingTemplate } from '@/types/nutrition';

const workoutTimingFromName = (name: string): MealWorkoutTiming => {
  const value = name.toUpperCase();
  if (value.includes('PREWO') || value.includes('PRE WO')) return 'pre';
  if (value.includes('POSTWO') || value.includes('POST WO')) return 'post';
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
  meals: rows
    .filter(([, c, p, f]) => c > 0 || p > 0 || f > 0)
    .map(([mealName, c, p, f], index): TimingMeal => ({
      id: `${id}-meal-${index + 1}`,
      name: mealName,
      carbsPercent: c * 100,
      proteinPercent: p * 100,
      fatPercent: f * 100,
      workoutTiming: workoutTimingFromName(mealName),
    })),
});

/**
 * Port dei timing predefiniti di Builder. Le percentuali sono conservate
 * identiche, ma nell'APK sono esposte come 0-100 e possono essere duplicate
 * e modificate localmente dall'utilizzatore.
 */
export const BUILT_IN_TIMINGS: TimingTemplate[] = [
  make('omogeneo', 'OMOGENEO', 'Distribuzione equilibrata su tutti i pasti', 'all', [
    ['COLAZ.', 0.2, 0.15, 0.2],
    ['SPUNT. MATT.', 0.125, 0.15, 0.25],
    ['PRANZO', 0.275, 0.275, 0.15],
    ['SPUNT. POM.', 0.125, 0.15, 0.25],
    ['CENA', 0.275, 0.275, 0.15],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('off-donna-cut', 'OFF - DONNA - CUT', 'Giorno OFF per donna in definizione', 'off', [
    ['COLAZ.', 0.3, 0.15, 0.15],
    ['SPUNT. MATT.', 0.15, 0.15, 0.2],
    ['PRANZO', 0.4, 0.25, 0.1],
    ['SPUNT. POM.', 0.15, 0.15, 0.2],
    ['CENA', 0, 0.3, 0.35],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('off-uomo-cut', 'OFF - UOMO - CUT', 'Giorno OFF per uomo in definizione', 'off', [
    ['COLAZ.', 0.15, 0.15, 0.2],
    ['SPUNT. MATT.', 0.15, 0.15, 0.2],
    ['PRANZO', 0.35, 0.25, 0.2],
    ['SPUNT. POM.', 0.15, 0.15, 0.2],
    ['CENA', 0.2, 0.3, 0.2],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('wo-matt-no-colazione-cut', 'WO - MATT - NO COLAZIONE - CUT', 'Allenamento mattina senza colazione, definizione', 'workout', [
    ['NO COLAZ.', 0, 0, 0],
    ['SPUNT. POSTWO', 0.3, 0.3, 0],
    ['PRANZO', 0.35, 0.3, 0.1],
    ['SPUNT. POM.', 0.2, 0.2, 0.3],
    ['CENA', 0.15, 0.2, 0.3],
    ['PRENANNA', 0, 0, 0.3],
  ]),
  make('wo-matt-post-colazione-cut', 'WO - MATT - POST COLAZIONE - CUT', 'Allenamento mattina post colazione, definizione', 'workout', [
    ['COLAZ. - PREWO', 0.35, 0.2, 0],
    ['SPUNT. POSTWO', 0.25, 0.2, 0],
    ['PRANZO', 0.2, 0.15, 0.3],
    ['SPUNT. POM.', 0.2, 0.15, 0.35],
    ['CENA', 0, 0.3, 0.35],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('wo-pom-2-spuntino-cut', 'WO - POM - 2° SPUNTINO - CUT', 'Allenamento pomeriggio al 2° spuntino, definizione', 'workout', [
    ['COLAZ.', 0.1, 0.15, 0.35],
    ['SPUNT. MATT.', 0.1, 0.15, 0.35],
    ['PRANZO', 0.1, 0.2, 0.3],
    ['SPUNT. PREWO', 0.35, 0.25, 0],
    ['CENA - POSTWO', 0.35, 0.25, 0],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('wo-post-pranzo-cut', 'WO - POST PRANZO - CUT', 'Allenamento post pranzo, definizione', 'workout', [
    ['COLAZ.', 0.1, 0.15, 0.35],
    ['SPUNT. MATT.', 0.1, 0.15, 0.35],
    ['PRANZO', 0.3, 0.25, 0.1],
    ['SPUNT. POSTWO', 0.35, 0.25, 0],
    ['CENA - POSTWO', 0.15, 0.2, 0.2],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('wo-matt-1-spuntino-cut', 'WO - MATT - 1° SPUNTINO - CUT', 'Allenamento mattina al 1° spuntino, definizione', 'workout', [
    ['COLAZ.', 0.1, 0.15, 0.35],
    ['SPUNT. MATT. PREWO', 0.3, 0.2, 0],
    ['PRANZO - POSTWO', 0.35, 0.25, 0],
    ['SPUNT. POM.', 0.15, 0.2, 0.3],
    ['CENA', 0.1, 0.2, 0.35],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('wo-matt-no-colazione-cut-4-pasti', 'WO - MATT - NO COLAZIONE - CUT - 4 PASTI', 'Allenamento mattina senza colazione, 4 pasti', 'workout', [
    ['NO COLAZ.', 0, 0, 0],
    ['PASTO POST WO', 0.35, 0.25, 0],
    ['2° PASTO', 0.35, 0.25, 0.2],
    ['3° PASTO', 0.15, 0.25, 0.4],
    ['4° PASTO', 0.15, 0.25, 0.4],
    ['6° PASTO', 0, 0, 0],
  ]),
  make('off-donna-cut-4-pasti', 'OFF - DONNA - CUT - 4 PASTI', 'Giorno OFF donna, 4 pasti', 'off', [
    ['1° PASTO', 0.25, 0.25, 0.25],
    ['2° PASTO', 0.25, 0.25, 0.25],
    ['3° PASTO', 0.25, 0.25, 0.25],
    ['4° PASTO', 0.25, 0.25, 0.25],
    ['5° PASTO', 0, 0, 0],
    ['6° PASTO', 0, 0, 0],
  ]),
];
