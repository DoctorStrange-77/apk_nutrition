import { useEffect, useState } from 'react';
import { AppModal } from '@/components/AppModal';
import { savedMealMacros } from '@/domain/recipes';
import { macrosForManualMeal } from '@/domain/manualMenu';
import type { ManualMeal, SavedMealTemplate } from '@/types/nutrition';

type Props = {
  open: boolean;
  mode: 'save' | 'pick';
  sourceMeal?: ManualMeal | null;
  templates: SavedMealTemplate[];
  onClose: () => void;
  onSave: (name: string) => void;
  onPick: (template: SavedMealTemplate) => void;
  onDelete: (id: string) => void;
};

export function SavedMealModal({ open, mode, sourceMeal, templates, onClose, onSave, onPick, onDelete }: Props) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (open && mode === 'save') setName(sourceMeal?.name || 'Pasto salvato');
  }, [open, mode, sourceMeal?.id]);
  const actual = sourceMeal ? macrosForManualMeal(sourceMeal) : null;
  const title = mode === 'save' ? 'Salva questo pasto' : 'Pasti salvati';
  const eyebrow = mode === 'save' ? 'CREA TEMPLATE' : 'AGGIUNGI RAPIDO';

  return <AppModal open={open} fullscreen={mode === 'pick'} title={title} eyebrow={eyebrow} onClose={onClose}
    footer={mode === 'save' ? <div className="modal-actions"><button className="secondary" onClick={onClose}>Annulla</button><button className="primary" disabled={!sourceMeal?.items.length || !name.trim()} onClick={() => onSave(name)}>Salva pasto</button></div> : undefined}>
    {mode === 'save' ? <div className="save-meal-preview">
      <label>Nome del pasto<input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      {actual && <div className="nutrition-preview modal-nutrition">
        <span><small>CARB</small><strong>{actual.carbs.toFixed(1)} g</strong></span>
        <span><small>PRO</small><strong>{actual.protein.toFixed(1)} g</strong></span>
        <span><small>FAT</small><strong>{actual.fat.toFixed(1)} g</strong></span>
      </div>}
      <p className="muted">Verranno salvati alimenti e grammature attuali. Potrai aggiungerli a qualsiasi pasto con un tap.</p>
    </div> : <div className="saved-meal-picker">
      {!templates.length && <p className="empty-meal">Non hai ancora salvato nessun pasto.</p>}
      {templates.map((template) => {
        const macros = savedMealMacros(template);
        return <div className="saved-meal-row" key={template.id}>
          <button className="saved-meal-main" onClick={() => onPick(template)}>
            <span><strong>{template.name}</strong><small>{template.items.length} alimenti · {macros.carbs.toFixed(1)}C · {macros.protein.toFixed(1)}P · {macros.fat.toFixed(1)}F</small></span>
            <b>+</b>
          </button>
          <button className="icon-danger" aria-label="Elimina pasto salvato" onClick={() => onDelete(template.id)}>×</button>
        </div>;
      })}
    </div>}
  </AppModal>;
}
