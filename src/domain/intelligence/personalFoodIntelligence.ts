import type { FoodPreferenceSignal, LocalFood } from '@/types/nutrition';

export type FoodSignalEvent = 'use' | 'favorite' | 'replace_in' | 'replace_out' | 'like' | 'dislike';

const EVENT_WEIGHT: Record<FoodSignalEvent, number> = {
  use: 2,
  favorite: 8,
  replace_in: 6,
  replace_out: -6,
  like: 10,
  dislike: -12,
};

const clampScore = (value:number) => Math.max(-100, Math.min(100, Math.round(value * 10) / 10));

const emptySignal = (foodId:string): FoodPreferenceSignal => ({
  foodId,
  score:0,
  uses:0,
  favorites:0,
  replaceIn:0,
  replaceOut:0,
  likes:0,
  dislikes:0,
  updatedAt:new Date().toISOString(),
});

export function updateFoodSignal(
  signals: FoodPreferenceSignal[],
  foodId: string,
  event: FoodSignalEvent,
): FoodPreferenceSignal[] {
  const current = signals.find((item) => item.foodId === foodId) || emptySignal(foodId);
  const next: FoodPreferenceSignal = {
    ...current,
    score:clampScore(current.score + EVENT_WEIGHT[event]),
    uses:current.uses + (event === 'use' ? 1 : 0),
    favorites:current.favorites + (event === 'favorite' ? 1 : 0),
    replaceIn:current.replaceIn + (event === 'replace_in' ? 1 : 0),
    replaceOut:current.replaceOut + (event === 'replace_out' ? 1 : 0),
    likes:current.likes + (event === 'like' ? 1 : 0),
    dislikes:current.dislikes + (event === 'dislike' ? 1 : 0),
    updatedAt:new Date().toISOString(),
  };
  return [next, ...signals.filter((item) => item.foodId !== foodId)];
}

export function preferenceScore(foodId:string, signals:FoodPreferenceSignal[]):number {
  return clampScore(signals.find((item) => item.foodId === foodId)?.score || 0);
}

export function rankFoodsByIntelligence(
  foods: LocalFood[],
  signals: FoodPreferenceSignal[],
  variety: number,
  recentFoodIds: string[],
): LocalFood[] {
  const normalizedVariety = Math.max(0, Math.min(100, Number.isFinite(variety) ? variety : 50));
  const recentRank = new Map(recentFoodIds.map((id,index) => [id,index]));
  const preferenceWeight = 1 - normalizedVariety * 0.004;
  const noveltyPenaltyScale = 3 * Math.pow(normalizedVariety / 100, 2);

  return [...foods].sort((a,b) => {
    const score = (food:LocalFood) => {
      const preference = preferenceScore(food.id, signals) * preferenceWeight;
      const recentIndex = recentRank.get(food.id);
      const recentPenalty = recentIndex == null
        ? 0
        : Math.max(3, 10 - Math.min(7, recentIndex)) * noveltyPenaltyScale;
      return preference - recentPenalty;
    };
    const delta = score(b) - score(a);
    return Math.abs(delta) > 0.0001 ? delta : a.name.localeCompare(b.name);
  });
}
