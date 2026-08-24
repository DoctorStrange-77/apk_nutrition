import { AppModal } from '@/components/AppModal';
import { timingTotals } from '@/domain/timing';
import type { TimingMeal, TimingTemplate } from '@/types/nutrition';

type Props = {
  timing: TimingTemplate | null;
  onChange: (timing: TimingTemplate) => void;
  onClose: () => void;
  onSave: () => void;
  onResize: (count: number) => void;
  onDistribute: () => void;
  onUpdateMeal: (index: number, patch: Partial<TimingMeal>) => void;
};

const safeNumber = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function TimingEditorModal({ timing, onChange, onClose, onSave, onResize, onDistribute, onUpdateMeal }: Props) {
  const totals = timing ? timingTotals(timing) : null;
  return (
    <AppModal open={!!timing} title={timing?.name || 'Timing'} eyebrow="EDITOR TIMING" onClose={onClose} wide footer={timing ? <div className="modal-actions"><button className="secondary" onClick={onClose}>Annulla</button><button className="primary" onClick={onSave}>Salva timing</button></div> : null}>
      {timing && <>
        <div className="form-grid modal-form timing-modal-form">
          <label>Nome<input value={timing.name} onChange={(e) => onChange({ ...timing, name: e.target.value })} /></label>
          <label>Numero pasti<input type="number" min="1" max="6" value={timing.meals.length} onChange={(e) => onResize(Number(e.target.value))} /></label>
        </div>
        <button className="secondary full-button" onClick={onDistribute}>Distribuisci 100% in modo uniforme</button>
        <div className="timing-modal-list">
          {timing.meals.map((meal, index) => <div className="timing-modal-row" key={meal.id}>
            <div className="timing-modal-title"><span>{index + 1}</span><input value={meal.name} onChange={(e) => onUpdateMeal(index, { name: e.target.value })} /></div>
            <div className="timing-macro-fields">
              <label>C %<input type="number" step="0.5" value={meal.carbsPercent} onChange={(e) => onUpdateMeal(index, { carbsPercent: safeNumber(e.target.value) })} /></label>
              <label>P %<input type="number" step="0.5" value={meal.proteinPercent} onChange={(e) => onUpdateMeal(index, { proteinPercent: safeNumber(e.target.value) })} /></label>
              <label>F %<input type="number" step="0.5" value={meal.fatPercent} onChange={(e) => onUpdateMeal(index, { fatPercent: safeNumber(e.target.value) })} /></label>
              <label>Workout<select value={meal.workoutTiming} onChange={(e) => onUpdateMeal(index, { workoutTiming: e.target.value as TimingMeal['workoutTiming'] })}><option value="none">Nessuno</option><option value="pre">PRE</option><option value="post">POST</option></select></label>
            </div>
          </div>)}
        </div>
        {totals && <div className="totals glass-total">Totali · C {totals.carbs.toFixed(1)}% · P {totals.protein.toFixed(1)}% · F {totals.fat.toFixed(1)}%</div>}
      </>}
    </AppModal>
  );
}
