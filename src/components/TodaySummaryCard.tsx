import { CalorieRing, MacroSplitDonut } from '@/components/NutritionCharts';
import type { MacroTarget } from '@/types/nutrition';

type Props = {
  target: MacroTarget;
  consumed: MacroTarget;
  onOpenGenerator: () => void;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function TodaySummaryCard({ target, consumed, onOpenGenerator }: Props) {
  const rows = [
    ['carb', 'Carboidrati', consumed.carbs, target.carbs],
    ['protein', 'Proteine', consumed.protein, target.protein],
    ['fat', 'Grassi', consumed.fat, target.fat],
  ] as const;

  return <section className="today-summary-card">
    <div className="today-chart-grid">
      <CalorieRing target={target} actual={consumed} />
      <MacroSplitDonut actual={consumed} />
    </div>
    <div className="today-macro-progress">
      {rows.map(([key, label, actual, goal]) => {
        const percent = goal > 0 ? clamp(actual / goal * 100) : 0;
        return <div className="today-macro-row" key={key}>
          <div><strong>{label}</strong><span>{actual.toFixed(1)} / {goal.toFixed(0)} g</span></div>
          <div className="today-progress-track"><i className={key} style={{ width: `${percent}%` }} /></div>
        </div>;
      })}
    </div>
    <button className="primary today-generator-cta" onClick={onOpenGenerator}>Crea menu automatico</button>
  </section>;
}
