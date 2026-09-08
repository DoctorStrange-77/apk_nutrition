import { kcalFromMacros } from '@/domain/manualMenu';
import type { MacroTarget, WeeklyPlanResult } from '@/types/nutrition';

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

type RingProps = {
  target: MacroTarget;
  actual: MacroTarget;
};

export function CalorieRing({ target, actual }: RingProps) {
  const targetKcal = Math.max(1, kcalFromMacros(target));
  const actualKcal = Math.max(0, kcalFromMacros(actual));
  const progress = clamp01(actualKcal / targetKcal);
  const remaining = Math.max(0, targetKcal - actualKcal);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;

  return <div className="calorie-ring-card">
    <div className="calorie-ring-wrap">
      <svg className="calorie-ring" viewBox="0 0 112 112" aria-label="Avanzamento calorie">
        <circle className="calorie-ring-track" cx="56" cy="56" r={radius} />
        <circle
          className="calorie-ring-progress"
          cx="56"
          cy="56"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="calorie-ring-center">
        <strong>{remaining.toFixed(0)}</strong>
        <small>kcal rimaste</small>
      </div>
    </div>
    <div className="calorie-ring-legend">
      <span><small>Obiettivo</small><strong>{targetKcal.toFixed(0)}</strong></span>
      <span><small>Consumate</small><strong>{actualKcal.toFixed(0)}</strong></span>
      <span><small>Avanzamento</small><strong>{Math.round(progress * 100)}%</strong></span>
    </div>
  </div>;
}

export function MacroSplitDonut({ actual }: { actual: MacroTarget }) {
  const carbKcal = Math.max(0, actual.carbs * 4);
  const proteinKcal = Math.max(0, actual.protein * 4);
  const fatKcal = Math.max(0, actual.fat * 9);
  const total = carbKcal + proteinKcal + fatKcal;
  const hasData = total > 0;
  const carbPct = hasData ? carbKcal / total * 100 : 0;
  const proteinPct = hasData ? proteinKcal / total * 100 : 0;
  const fatPct = hasData ? Math.max(0, 100 - carbPct - proteinPct) : 0;
  const gradient = hasData
    ? `conic-gradient(var(--macro-carb) 0 ${carbPct}%, var(--macro-protein) ${carbPct}% ${carbPct + proteinPct}%, var(--macro-fat) ${carbPct + proteinPct}% 100%)`
    : 'conic-gradient(rgba(255,255,255,.08) 0 100%)';

  return <div className="macro-split-card">
    <div className="macro-split-donut" style={{ background: gradient }}>
      <div><strong>{Math.round(total)}</strong><small>kcal</small></div>
    </div>
    <div className="macro-split-legend">
      <span className="carb"><i /> <b>Carboidrati</b><strong>{carbPct.toFixed(0)}%</strong></span>
      <span className="protein"><i /> <b>Proteine</b><strong>{proteinPct.toFixed(0)}%</strong></span>
      <span className="fat"><i /> <b>Grassi</b><strong>{fatPct.toFixed(0)}%</strong></span>
    </div>
  </div>;
}

const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday:'short' }).replace('.', '');

export function WeeklyKcalBars({ result }: { result: WeeklyPlanResult }) {
  const points = result.days.map((day) => {
    const target = Math.max(1, day.menu.targetKcal);
    const actual = Math.max(0, day.menu.actualKcal);
    return { date:day.date, target, actual, ratio:Math.min(1.25, actual / target) };
  });
  const maxKcal = Math.max(1, ...points.flatMap((point) => [point.target, point.actual]));

  return <div className="weekly-chart-card">
    <div className="weekly-chart-head">
      <span><small>ANDAMENTO SETTIMANALE</small><strong>Calorie: target vs reale</strong></span>
      <span className="weekly-chart-key"><i className="target" />Target <i className="actual" />Reale</span>
    </div>
    <div className="weekly-kcal-chart">
      {points.map((point) => <div className="weekly-kcal-column" key={point.date}>
        <div className="weekly-kcal-bars">
          <i className="target" style={{ height:`${Math.max(8, point.target / maxKcal * 100)}%` }} />
          <i className={`actual ${point.ratio > 1.05 ? 'over' : ''}`} style={{ height:`${Math.max(8, point.actual / maxKcal * 100)}%` }} />
        </div>
        <strong>{shortDay(point.date)}</strong>
        <small>{point.actual.toFixed(0)}</small>
      </div>)}
    </div>
  </div>;
}
