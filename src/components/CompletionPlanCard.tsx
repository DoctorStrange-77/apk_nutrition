import type { GeneratedMenu } from '@/types/nutrition';

type Props = {
  plan: GeneratedMenu | null;
  onApply: () => void;
  onRegenerate: () => void;
  onDiscard: () => void;
};

export function CompletionPlanCard({ plan, onApply, onRegenerate, onDiscard }: Props) {
  if (!plan) return null;
  return (
    <section className="card completion-plan-card">
      <div className="row-between">
        <div><p className="eyebrow red">PIANO AUTOMATICO</p><h2>Completamento pronto</h2></div>
        <span className={`completion-status ${plan.status}`}>{plan.status}</span>
      </div>
      <p className="muted">Generato dai macro residui e dal timing attivo. Gli alimenti già inseriti restano invariati.</p>
      <div className="result-summary">
        <span>Residuo {plan.target.carbs.toFixed(1)}C / {plan.target.protein.toFixed(1)}P / {plan.target.fat.toFixed(1)}F</span>
        <span>Generato {plan.actual.carbs.toFixed(1)}C / {plan.actual.protein.toFixed(1)}P / {plan.actual.fat.toFixed(1)}F</span>
      </div>
      <div className="completion-meals">
        {plan.meals.map((meal, index) => meal.foods.length ? (
          <article key={`completion-${index}`}>
            <strong>{meal.name}</strong>
            {meal.foods.map((portion) => <div className="food-line" key={`${meal.name}-${portion.foodId}`}><span>{portion.name}</span><b>{portion.grams} g</b></div>)}
          </article>
        ) : null)}
      </div>
      <div className="completion-actions">
        <button className="primary" onClick={onApply}>Applica al diario</button>
        <button className="secondary" onClick={onRegenerate}>Rigenera</button>
        <button className="ghost" onClick={onDiscard}>Scarta</button>
      </div>
    </section>
  );
}
