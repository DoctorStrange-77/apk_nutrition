import type { LocalFood } from '@/types/nutrition';

export type FoodConfidenceLabel = 'alta' | 'media' | 'bassa';

export interface FoodDataConfidence {
  score: number;
  label: FoodConfidenceLabel;
  reasons: string[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const sourceBase = (food: LocalFood): number => {
  if (food.dataSource === 'Smart Nutrition Core' || food.source === 'core') return 94;
  if (food.dataSource === 'Open Food Facts' || food.source === 'external') return 76;
  if (food.dataSource === 'Recipe' || food.source === 'recipe') return 82;
  return 52;
};

export function scoreFoodDataConfidence(food: LocalFood): FoodDataConfidence {
  const reasons: string[] = [];
  let score = sourceBase(food);
  if (food.sourceReference) score += 3;
  else if (food.source === 'external' || food.source === 'core') {
    score -= 8;
    reasons.push('Riferimento della fonte non disponibile.');
  }

  if (food.barcode && food.dataSource === 'Open Food Facts') score += 4;
  if (food.fiber != null) score += 2;

  const macros = [food.carbs, food.protein, food.fat];
  if (macros.some((value) => !Number.isFinite(value) || value < 0)) {
    score -= 55;
    reasons.push('Uno o più macronutrienti non sono validi.');
  }

  const totalGrams = Math.max(0, food.carbs) + Math.max(0, food.protein) + Math.max(0, food.fat);
  if (totalGrams > 115) {
    score -= Math.min(65, 25 + (totalGrams - 115) * 0.5);
    reasons.push('Somma dei macronutrienti per 100 g poco plausibile.');
  }
  if (food.carbs > 100 || food.protein > 100 || food.fat > 100) {
    score -= 35;
    reasons.push('Valore per 100 g oltre il limite fisico atteso.');
  }

  score = clamp(score);
  const label: FoodConfidenceLabel = score >= 80 ? 'alta' : score >= 55 ? 'media' : 'bassa';
  if (!reasons.length) {
    reasons.push(label === 'alta' ? 'Dati strutturati e fonte coerente.' : 'Dati utilizzabili con verifica consigliata.');
  }
  return { score, label, reasons };
}
