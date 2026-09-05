import type { MacroTarget } from '@/types/nutrition';

type Props = {
  target: MacroTarget;
  consumed: MacroTarget;
  residual: MacroTarget;
  hasEntries: boolean;
  onComplete: () => void;
  onOpenDiary: () => void;
};

const macroText = (m: MacroTarget) =>
  `${m.carbs.toFixed(0)}C · ${m.protein.toFixed(0)}P · ${m.fat.toFixed(0)}F`;

export function SmartDayCard({ target, consumed, residual, hasEntries, onComplete, onOpenDiary }: Props) {
  return (
    <section className="card smart-day-card">
      <div className="smart-day-head">
        <div><p className="eyebrow red">SMART DAY</p><h2>Completa automaticamente</h2></div>
        <span className={hasEntries ? 'smart-day-badge live' : 'smart-day-badge'}>{hasEntries ? 'IN CORSO' : 'PRONTO'}</span>
      </div>
      <p className="smart-day-copy">Il motore parte sempre dai tuoi macro e dal timing. Se hai già mangiato qualcosa, genera solo ciò che manca.</p>
      <div className="smart-day-stats">
        <div><small>Target</small><strong>{macroText(target)}</strong></div>
        <div><small>Già inserito</small><strong>{macroText(consumed)}</strong></div>
        <div className="residual"><small>Da completare</small><strong>{macroText(residual)}</strong></div>
      </div>
      <div className="smart-day-actions">
        <button className="primary smart-day-primary" onClick={onComplete}>Completa automaticamente</button>
        <button className="secondary" onClick={onOpenDiary}>{hasEntries ? 'Apri diario' : 'Inserisci alimenti'}</button>
      </div>
    </section>
  );
}
