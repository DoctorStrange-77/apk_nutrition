import { AppModal } from '@/components/AppModal';
import type { CustomFoodPreferencePreset, LocalFood } from '@/types/nutrition';

type Props = {
  preset: CustomFoodPreferencePreset | null;
  foods: LocalFood[];
  isExisting: boolean;
  onChange: (preset: CustomFoodPreferencePreset) => void;
  onClose: () => void;
  onChooseFoods: () => void;
  onRemoveFood: (foodId: string) => void;
  onSave: () => void;
  onDelete?: () => void;
};

const macroRole = (food: LocalFood) => {
  if (food.category !== 'mixed') return food.category;
  const energy = { carb: food.carbs * 4, protein: food.protein * 4, fat: food.fat * 9 };
  if (energy.protein >= energy.carb && energy.protein >= energy.fat) return 'protein';
  if (energy.fat >= energy.carb && energy.fat >= energy.protein) return 'fat';
  return 'carb';
};

export function CustomFoodPreferenceModal({
  preset,
  foods,
  isExisting,
  onChange,
  onClose,
  onChooseFoods,
  onRemoveFood,
  onSave,
  onDelete,
}: Props) {
  if (!preset) return null;

  const selected = foods.filter((food) => preset.foodIds.includes(food.id));
  const counts = selected.reduce((acc, food) => {
    acc[macroRole(food)] += 1;
    return acc;
  }, { carb: 0, protein: 0, fat: 0 });

  return <AppModal
    open
    wide
    title={isExisting ? 'Modifica preferenza' : 'Nuova preferenza'}
    eyebrow="PREFERENZA PERSONALIZZATA"
    onClose={onClose}
    footer={<div className="modal-actions">
      {isExisting && onDelete && <button className="danger" onClick={onDelete}>Elimina</button>}
      <button className="secondary" onClick={onClose}>Annulla</button>
      <button className="primary" onClick={onSave}>Salva preferenza</button>
    </div>}
  >
    <div className="custom-pref-form">
      <label>
        <span>Nome</span>
        <input
          autoFocus
          maxLength={40}
          value={preset.name}
          placeholder="Es. I miei alimenti gara"
          onChange={(event) => onChange({ ...preset, name: event.target.value })}
        />
      </label>
      <label>
        <span>Descrizione <small>opzionale</small></span>
        <textarea
          rows={3}
          maxLength={180}
          value={preset.description || ''}
          placeholder="Quando vuoi usare questa preferenza..."
          onChange={(event) => onChange({ ...preset, description: event.target.value })}
        />
      </label>

      <div className="custom-pref-food-head">
        <div>
          <small>ALIMENTI INCLUSI</small>
          <strong>{selected.length}</strong>
        </div>
        <button className="primary small" onClick={onChooseFoods}>Scegli alimenti</button>
      </div>

      <div className="custom-pref-role-grid">
        <span><small>Carboidrati</small><strong>{counts.carb}</strong></span>
        <span><small>Proteine</small><strong>{counts.protein}</strong></span>
        <span><small>Grassi</small><strong>{counts.fat}</strong></span>
      </div>

      {selected.length > 0 ? <div className="custom-pref-selected">
        {selected.slice(0, 24).map((food) => <div key={food.id}>
          <span><strong>{food.name}</strong><small>{food.brand || food.subcategory || food.category}</small></span>
          <button aria-label={`Rimuovi ${food.name}`} onClick={() => onRemoveFood(food.id)}>×</button>
        </div>)}
        {selected.length > 24 && <p className="muted">+ altri {selected.length - 24} alimenti selezionati.</p>}
      </div> : <div className="custom-pref-empty">
        <strong>Nessun alimento selezionato</strong>
        <p>Scegli almeno una fonte di carboidrati, una proteica e una di grassi.</p>
      </div>}
    </div>
  </AppModal>;
}
