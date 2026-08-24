import type { MacroTarget } from '@/types/nutrition';

export type BiologicalSex = 'male' | 'female';
export type BmrFormula = 'mifflin' | 'katch';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type NutritionGoal = 'cut' | 'maintain' | 'gain';

export interface UserNutritionProfile {
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number;
  averageSteps: number;
  workoutsPerWeek: number;
  activityLevel: ActivityLevel;
  formula: BmrFormula;
  goal: NutritionGoal;
  adjustmentPct: number;
  proteinPerKg: number;
  fatPerKg: number;
}

export interface ProfileCalculation {
  age: number;
  bmr: number;
  activityFactor: number;
  tdee: number;
  targetKcal: number;
  macros: MacroTarget;
  formulaUsed: BmrFormula;
  adjustmentPct: number;
}
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const DEFAULT_PROFILE: UserNutritionProfile = {
  firstName: '', lastName: '', birthDate: '', sex: 'male',
  heightCm: 175, weightKg: 75, averageSteps: 7000, workoutsPerWeek: 3,
  activityLevel: 'moderate', formula: 'mifflin', goal: 'maintain', adjustmentPct: 0,
  proteinPerKg: 2, fatPerKg: 0.8,
};

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const round1 = (value: number) => Math.round(value * 10) / 10;
export function ageFromBirthDate(birthDate: string, reference = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 0;
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = reference.getFullYear() - year;
  const beforeBirthday = reference.getMonth() + 1 < month ||
    (reference.getMonth() + 1 === month && reference.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age > 0 && age < 130 ? age : 0;
}

export function inferActivityLevel(steps: number, workouts: number): ActivityLevel {
  const s = finite(steps);
  const w = finite(workouts);
  if (s >= 12000 || (s >= 9000 && w >= 5)) return 'very_active';
  if (s >= 9000 || (s >= 7000 && w >= 4)) return 'active';
  if (s >= 6000 || w >= 3) return 'moderate';
  if (s >= 3500 || w >= 1) return 'light';
  return 'sedentary';
}
export function mifflinStJeor(profile: UserNutritionProfile, age: number): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age;
  return base + (profile.sex === 'male' ? 5 : -161);
}

export function katchMcArdle(profile: UserNutritionProfile): number {
  const bf = finite(profile.bodyFatPct || 0);
  if (bf <= 0 || bf >= 70) return 0;
  const leanMassKg = profile.weightKg * (1 - bf / 100);
  return 370 + 21.6 * leanMassKg;
}

export function normalizedGoalAdjustment(profile: UserNutritionProfile): number {
  if (profile.goal === 'maintain') return 0;
  const raw = Math.abs(finite(profile.adjustmentPct));
  if (profile.goal === 'cut') return -Math.min(30, Math.max(5, raw || 15));
  return Math.min(20, Math.max(2, raw || 10));
}

export function calculateProfile(profile: UserNutritionProfile, reference = new Date()): ProfileCalculation | null {
  const age = ageFromBirthDate(profile.birthDate, reference);
  if (!age || profile.weightKg <= 0 || profile.heightCm <= 0) return null;
  const katch = profile.formula === 'katch' ? katchMcArdle(profile) : 0;
  const formulaUsed: BmrFormula = katch > 0 ? 'katch' : 'mifflin';
  const bmr = formulaUsed === 'katch' ? katch : mifflinStJeor(profile, age);
  const activityFactor = ACTIVITY_FACTORS[profile.activityLevel];
  const tdee = bmr * activityFactor;
  const adjustmentPct = normalizedGoalAdjustment(profile);
  const targetKcal = tdee * (1 + adjustmentPct / 100);
  const protein = Math.max(0, profile.weightKg * Math.max(0, profile.proteinPerKg));
  const fat = Math.max(0, profile.weightKg * Math.max(0, profile.fatPerKg));
  const remainingKcal = targetKcal - protein * 4 - fat * 9;
  const carbs = Math.max(0, remainingKcal / 4);
  return {
    age,
    bmr: round1(bmr),
    activityFactor,
    tdee: round1(tdee),
    targetKcal: round1(targetKcal),
    macros: { carbs: round1(carbs), protein: round1(protein), fat: round1(fat) },
    formulaUsed,
    adjustmentPct,
  };
}

export function validateProfile(profile: UserNutritionProfile, reference = new Date()): string[] {
  const errors: string[] = [];
  const age = ageFromBirthDate(profile.birthDate, reference);
  if (!age) errors.push('Inserisci una data di nascita valida.');
  if (profile.heightCm < 120 || profile.heightCm > 230) errors.push('Controlla l’altezza inserita.');
  if (profile.weightKg < 35 || profile.weightKg > 300) errors.push('Controlla il peso inserito.');
  if (profile.formula === 'katch' && (!profile.bodyFatPct || profile.bodyFatPct <= 2 || profile.bodyFatPct >= 70)) errors.push('Per Katch-McArdle serve una percentuale di grasso valida.');
  if (profile.proteinPerKg < 0.5 || profile.proteinPerKg > 4) errors.push('Controlla i grammi di proteine per kg.');
  if (profile.fatPerKg < 0.3 || profile.fatPerKg > 2) errors.push('Controlla i grammi di grassi per kg.');
  const calculation = calculateProfile(profile, reference);
  if (calculation && calculation.targetKcal < calculation.macros.protein * 4 + calculation.macros.fat * 9) errors.push('Il target calorico è troppo basso per i vincoli proteine/grassi scelti.');
  return errors;
}
