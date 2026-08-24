import { AppModal } from '@/components/AppModal';
import { kcalFromMacros } from '@/domain/manualMenu';
import type { FoodCategory, LocalFood } from '@/types/nutrition';

type Props = {
  food: LocalFood | null;
  onChange: (food: LocalFood) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const safeNumber = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function FoodEditorModal({ food, onChange, onClose, onSave, onDelete }: Props) {
  return (
    <AppModal
      open={!!food}
      title={food?.name || 'Alimento'}
      eyebrow="SCHEDA ALIMENTO"
      onClose={onClose}
      wide
      footer={food ? <div className="modal-actions"><button className="danger" onClick={onDelete}>Elimina</button><button className="primary" onClick={onSave}>Salva modifiche</button></div> : null}
    >
      {food && <>
        <div className="food-hero">
          <div className="food-hero-icon">{food.name.slice(0, 1).toUpperCase()}</div>
          <div><strong>{food.brand || 'Alimento personale'}</strong><span>{food.source}{food.barcode ? ` · ${food.barcode}` : ''}</span></div>
        </div>
        <div className="nutrition-preview modal-nutrition">
          <span><small>CARB</small><strong>{food.carbs.toFixed(1)} g</strong></span>
          <span><small>PRO</small><strong>{food.protein.toFixed(1)} g</strong></span>
          <span><small>FAT</small><strong>{food.fat.toFixed(1)} g</strong></span>
          <span><small>KCAL</small><strong>{kcalFromMacros(food).toFixed(0)}</strong></span>
        </div>
        <div className="form-grid detail-grid modal-form">
          <label>Nome<input value={food.name} onChange={(e) => onChange({ ...food, name: e.target.value })} /></label>
          <label>Marca<input value={food.brand || ''} onChange={(e) => onChange({ ...food, brand: e.target.value })} /></label>
          <label>Barcode<input value={food.barcode || ''} onChange={(e) => onChange({ ...food, barcode: e.target.value })} /></label>
          <label>Categoria<select value={food.category} onChange={(e) => onChange({ ...food, category: e.target.value as FoodCategory })}><option value="carb">Carboidrati</option><option value="protein">Proteine</option><option value="fat">Grassi</option><option value="mixed">Misto</option></select></label>
          <label>Carboidrati /100g<input type="number" step="0.1" value={food.carbs} onChange={(e) => onChange({ ...food, carbs: safeNumber(e.target.value) })} /></label>
          <label>Proteine /100g<input type="number" step="0.1" value={food.protein} onChange={(e) => onChange({ ...food, protein: safeNumber(e.target.value) })} /></label>
          <label>Grassi /100g<input type="number" step="0.1" value={food.fat} onChange={(e) => onChange({ ...food, fat: safeNumber(e.target.value) })} /></label>
          <label>Fibre /100g<input type="number" step="0.1" value={food.fiber ?? 0} onChange={(e) => onChange({ ...food, fiber: safeNumber(e.target.value) })} /></label>
          <label>Porzione minima g<input type="number" value={food.grammiMin ?? 0} onChange={(e) => onChange({ ...food, grammiMin: safeNumber(e.target.value) })} /></label>
          <label>Porzione massima g<input type="number" value={food.grammiMax ?? 0} onChange={(e) => onChange({ ...food, grammiMax: safeNumber(e.target.value) })} /></label>
        </div>
      </>}
    </AppModal>
  );
}
