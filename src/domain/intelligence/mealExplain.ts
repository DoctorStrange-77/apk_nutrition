import type { GeneratedMeal, MealArchitectureId } from '@/types/nutrition';

const architectureLabel: Record<MealArchitectureId, string> = {
  breakfast_bowl:'bowl da colazione', yogurt_bowl:'bowl proteica', rice_plate:'piatto riso + proteine',
  pasta_plate:'piatto pasta + proteine', sandwich:'panino', wrap:'wrap', shake:'shake',
  snack:'spuntino', savory_plate:'piatto salato completo', mixed:'pasto misto',
};

export function explainGeneratedMeal(meal: GeneratedMeal): string[] {
  const reasons: string[] = [];
  if (meal.architecture) reasons.push('Struttura: ' + architectureLabel[meal.architecture] + '.');
  if (meal.workoutTiming === 'pre') reasons.push('Distribuzione pensata per il pre-workout.');
  if (meal.workoutTiming === 'post') reasons.push('Distribuzione pensata per il post-workout.');
  for (const portion of meal.foods.slice(0, 4)) {
    const role = portion.carbs >= portion.protein && portion.carbs >= portion.fat
      ? 'carboidrati' : portion.protein >= portion.fat ? 'proteine' : 'grassi';
    reasons.push(portion.name + ': fonte principale di ' + role + ' del pasto.');
  }
  return reasons;
}
