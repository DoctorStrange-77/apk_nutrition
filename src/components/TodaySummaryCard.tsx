import { kcalFromMacros } from '@/domain/manualMenu';
import type { MacroTarget } from '@/types/nutrition';

type Props = {
  target: MacroTarget;
  consumed: MacroTarget;
  onOpenGenerator: () => void;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function TodaySummaryCard({ target, consumed, onOpenGenerator }: Props) {
  const targetKcal = kcalFromMacros(target);
  const consumedKcal = kcalFromMacros(consumed);
  const remaining = Math.max(0, targetKcal - consumedKcal);
  const rows = [
    ['Carboidrati', consumed.carbs, target.carbs],
    ['Proteine', consumed.protein, target.protein],
    ['Grassi', consumed.fat, target.fat],
  ] as const;

  return <section className="today-summary-card">
    <div className="today-calorie-hero">
      <span><small>RIMANENTI</small><strong>{remaining.toFixed(0)}</strong><em>kcal</em></span>
      <div className="today-kcal-equation">
        <span><b>{targetKcal.toFixed(0)}</b><small>Obiettivo</small></span>
        <i>−</i>
        <span><b>{consumedKcal.toFixed(0)}</b><small>Consumate</small></span>
        <i>=</i>
        <span className="accent"><b>{remaining.toFixed(0)}</b><small>Residuo</small></span>
      </div>
    </div>
    <div className="today-macro-progress">
      {rows.map(([label, actual, goal]) => {
        const percent = goal > 0 ? clamp(actual / goal * 100) : 0;
        return <div className="today-macro-row" key={label}>
          <div><strong>{label}</strong><span>{actual.toFixed(1)} / {goal.toFixed(0)} g</span></div>
          <div className="today-progress-track"><i style={{ width: `${percent}%` }} /></div>
        </div>;
      })}
    </div>
    <button className="primary today-generator-cta" onClick={onOpenGenerator}>Crea menu automatico</button>
  </section>;
}
