import { kcalFromMacros, macrosForManualDay } from '@/domain/manualMenu';
import type { DiaryDay, MacroTarget } from '@/types/nutrition';

export type ProgressGoal = 'cut' | 'maintain' | 'gain';

export interface ProgressCheckIn {
  date: string;
  weightKg: number;
  note?: string;
  source?: 'manual' | 'diary';
  createdAt: string;
  updatedAt: string;
}

export interface ProgressSettings {
  goal: ProgressGoal;
  minAdherencePct: number;
  adjustmentPct: number;
}

export interface WeightTrend {
  latestWeightKg: number | null;
  recentAverageKg: number | null;
  previousAverageKg: number | null;
  weeklyChangeKg: number | null;
  weeklyRatePct: number | null;
  recentCount: number;
  previousCount: number;
}

export interface DiaryAdherence {
  adherencePct: number | null;
  loggedDays: number;
  windowDays: number;
}

export type RecommendationKind = 'insufficient' | 'hold' | 'increase' | 'decrease';

export interface TargetRecommendation {
  kind: RecommendationKind;
  title: string;
  reason: string;
  proposedTarget?: MacroTarget;
  deltaKcal?: number;
  weeklyRatePct: number | null;
  adherencePct: number | null;
}

export const DEFAULT_PROGRESS_SETTINGS: ProgressSettings = {
  goal: 'cut',
  minAdherencePct: 85,
  adjustmentPct: 5,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const pad = (value: number) => String(value).padStart(2, '0');

const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toDateKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const shiftProgressDate = (key: string, days: number) => {
  const date = parseDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
};

export const normalizeCheckIns = (entries: ProgressCheckIn[]): ProgressCheckIn[] => {
  const byDate = new Map<string, ProgressCheckIn>();
  entries.forEach((entry) => {
    if (!entry?.date || !Number.isFinite(entry.weightKg) || entry.weightKg <= 0) return;
    const current = byDate.get(entry.date);
    if (!current || entry.updatedAt >= current.updatedAt) byDate.set(entry.date, { ...entry });
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

export const upsertCheckIn = (
  entries: ProgressCheckIn[],
  date: string,
  weightKg: number,
  note = '',
): ProgressCheckIn[] => {
  const now = new Date().toISOString();
  const existing = entries.find((entry) => entry.date === date);
  const next: ProgressCheckIn = {
    date,
    weightKg: Math.round(weightKg * 100) / 100,
    note: note.trim() || undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return normalizeCheckIns([...entries.filter((entry) => entry.date !== date), next]);
};

export const deleteCheckIn = (entries: ProgressCheckIn[], date: string) =>
  entries.filter((entry) => entry.date !== date);

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function calculateWeightTrend(entries: ProgressCheckIn[]): WeightTrend {
  const sorted = normalizeCheckIns(entries);
  if (!sorted.length) {
    return {
      latestWeightKg: null,
      recentAverageKg: null,
      previousAverageKg: null,
      weeklyChangeKg: null,
      weeklyRatePct: null,
      recentCount: 0,
      previousCount: 0,
    };
  }

  const latestDate = sorted[sorted.length - 1].date;
  const recentStart = shiftProgressDate(latestDate, -6);
  const previousStart = shiftProgressDate(latestDate, -13);
  const previousEnd = shiftProgressDate(latestDate, -7);
  const recent = sorted.filter((entry) => entry.date >= recentStart && entry.date <= latestDate);
  const previous = sorted.filter((entry) => entry.date >= previousStart && entry.date <= previousEnd);
  const recentAverageKg = average(recent.map((entry) => entry.weightKg));
  const previousAverageKg = average(previous.map((entry) => entry.weightKg));
  const enough = recent.length >= 3 && previous.length >= 3 && recentAverageKg != null && previousAverageKg != null;
  const weeklyChangeKg = enough ? recentAverageKg - previousAverageKg : null;
  const weeklyRatePct = enough && previousAverageKg > 0 ? (weeklyChangeKg! / previousAverageKg) * 100 : null;

  return {
    latestWeightKg: sorted[sorted.length - 1].weightKg,
    recentAverageKg,
    previousAverageKg,
    weeklyChangeKg,
    weeklyRatePct,
    recentCount: recent.length,
    previousCount: previous.length,
  };
}

const macroScore = (actual: number, target: number) => {
  if (target <= 0) return actual <= 0 ? 100 : 0;
  return clamp(100 - Math.abs(actual - target) / target * 100, 0, 100);
};

export const dayMacroAdherence = (day: DiaryDay): number | null => {
  const hasEntries = day.meals.some((meal) => meal.items.length > 0);
  if (!hasEntries) return null;
  const actual = macrosForManualDay(day.meals);
  return (
    macroScore(actual.carbs, day.target.carbs) +
    macroScore(actual.protein, day.target.protein) +
    macroScore(actual.fat, day.target.fat)
  ) / 3;
};

export function calculateDiaryAdherence(
  diaryDays: Record<string, DiaryDay>,
  endDate: string,
  windowDays = 7,
): DiaryAdherence {
  const scores: number[] = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    const key = shiftProgressDate(endDate, -offset);
    const day = diaryDays[key];
    if (!day) continue;
    const score = dayMacroAdherence(day);
    if (score != null) scores.push(score);
  }
  return {
    adherencePct: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
    loggedDays: scores.length,
    windowDays,
  };
}

export function adjustTargetCalories(target: MacroTarget, percent: number): MacroTarget {
  const currentKcal = kcalFromMacros(target);
  const desiredKcal = Math.max(target.protein * 4, currentKcal * (1 + percent / 100));
  const proteinKcal = target.protein * 4;
  const currentNonProteinKcal = target.carbs * 4 + target.fat * 9;
  const desiredNonProteinKcal = Math.max(0, desiredKcal - proteinKcal);
  if (currentNonProteinKcal <= 0) {
    return { ...target, carbs: Math.round(desiredNonProteinKcal / 4) };
  }
  const scale = desiredNonProteinKcal / currentNonProteinKcal;
  return {
    carbs: Math.max(0, Math.round(target.carbs * scale)),
    protein: Math.max(0, Math.round(target.protein)),
    fat: Math.max(0, Math.round(target.fat * scale)),
  };
}

const recommendationWithChange = (
  kind: 'increase' | 'decrease',
  target: MacroTarget,
  pct: number,
  title: string,
  reason: string,
  weeklyRatePct: number | null,
  adherencePct: number | null,
): TargetRecommendation => {
  const signedPct = kind === 'increase' ? Math.abs(pct) : -Math.abs(pct);
  const proposedTarget = adjustTargetCalories(target, signedPct);
  return {
    kind,
    title,
    reason,
    proposedTarget,
    deltaKcal: Math.round(kcalFromMacros(proposedTarget) - kcalFromMacros(target)),
    weeklyRatePct,
    adherencePct,
  };
};

export function buildTargetRecommendation(
  target: MacroTarget,
  trend: WeightTrend,
  adherence: DiaryAdherence,
  settings: ProgressSettings,
): TargetRecommendation {
  const weeklyRatePct = trend.weeklyRatePct;
  const adherencePct = adherence.adherencePct;
  if (weeklyRatePct == null || trend.recentCount < 3 || trend.previousCount < 3) {
    return {
      kind: 'insufficient',
      title: 'Servono più pesate',
      reason: 'Inserisci almeno 3 pesate nella settimana corrente e 3 nella precedente per valutare il trend.',
      weeklyRatePct,
      adherencePct,
    };
  }
  if (adherence.loggedDays < 4 || adherencePct == null) {
    return {
      kind: 'insufficient',
      title: 'Servono più giorni di diario',
      reason: 'Registra almeno 4 giorni alimentari recenti prima di modificare automaticamente il target.',
      weeklyRatePct,
      adherencePct,
    };
  }
  if (adherencePct < settings.minAdherencePct) {
    return {
      kind: 'hold',
      title: 'Mantieni il target',
      reason: `Aderenza media ${adherencePct.toFixed(0)}%: prima di cambiare i macro conviene aumentare la precisione del diario.`,
      weeklyRatePct,
      adherencePct,
    };
  }

  const adjustment = clamp(settings.adjustmentPct, 2, 7);
  if (settings.goal === 'cut') {
    if (weeklyRatePct > -0.25) {
      return recommendationWithChange('decrease', target, adjustment, 'Riduzione proposta', `Il peso medio sta scendendo meno dello 0,25%/settimana con buona aderenza.`, weeklyRatePct, adherencePct);
    }
    if (weeklyRatePct < -0.9) {
      return recommendationWithChange('increase', target, adjustment, 'Aumento proposto', `Il peso medio sta scendendo oltre lo 0,9%/settimana.`, weeklyRatePct, adherencePct);
    }
  }

  if (settings.goal === 'gain') {
    if (weeklyRatePct < 0.1) {
      return recommendationWithChange('increase', target, adjustment, 'Aumento proposto', `Il peso medio sta salendo meno dello 0,10%/settimana con buona aderenza.`, weeklyRatePct, adherencePct);
    }
    if (weeklyRatePct > 0.5) {
      return recommendationWithChange('decrease', target, adjustment, 'Riduzione proposta', `Il peso medio sta salendo oltre lo 0,50%/settimana.`, weeklyRatePct, adherencePct);
    }
  }

  if (settings.goal === 'maintain') {
    if (weeklyRatePct > 0.3) {
      return recommendationWithChange('decrease', target, Math.min(adjustment, 4), 'Riduzione proposta', `Il peso medio sta salendo oltre lo 0,30%/settimana.`, weeklyRatePct, adherencePct);
    }
    if (weeklyRatePct < -0.3) {
      return recommendationWithChange('increase', target, Math.min(adjustment, 4), 'Aumento proposto', `Il peso medio sta scendendo oltre lo 0,30%/settimana.`, weeklyRatePct, adherencePct);
    }
  }

  return {
    kind: 'hold',
    title: 'Target coerente',
    reason: 'Trend del peso e aderenza sono compatibili con l’obiettivo selezionato. Mantieni i macro attuali.',
    weeklyRatePct,
    adherencePct,
  };
}

export function mergeCheckInsWithDiaryWeights(
  entries: ProgressCheckIn[],
  diaryDays: Record<string, DiaryDay>,
): ProgressCheckIn[] {
  const merged = normalizeCheckIns(
    entries.map((entry) => ({ ...entry, source: entry.source || 'manual' })),
  );
  const byDate = new Map(merged.map((entry) => [entry.date, entry]));

  Object.entries(diaryDays).forEach(([date, day]) => {
    const weight = day?.recovery?.morningWeightKg;
    if (!Number.isFinite(weight) || !weight || weight <= 0 || weight > 400) return;
    const existing = byDate.get(date);
    const timestamp = day.updatedAt || existing?.updatedAt || `${date}T08:00:00.000Z`;
    byDate.set(date, {
      date,
      weightKg: Math.round(weight * 100) / 100,
      note: existing?.note,
      source: 'diary',
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    });
  });

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
