import { AppModal } from '@/components/AppModal';
import type { LocalFood } from '@/types/nutrition';

type Props = {
  open: boolean;
  title: string;
  eyebrow: string;
  foods: LocalFood[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onOpenFood: (food: LocalFood) => void;
  selectedIds?: string[];
  onToggleSelected?: (foodId: string) => void;
};

const macros = (food: LocalFood) => `${food.carbs.toFixed(1)}C · ${food.protein.toFixed(1)}P · ${food.fat.toFixed(1)}F`;

export function FoodLibrarySearchModal({ open, title, eyebrow, foods, query, onQueryChange, onClose, onOpenFood, selectedIds, onToggleSelected }: Props) {
  const selectionMode = !!selectedIds && !!onToggleSelected;
  return (
    <AppModal open={open} fullscreen title={title} eyebrow={eyebrow} onClose={onClose}
      footer={selectionMode ? <div className="modal-actions"><button className="secondary" onClick={onClose}>Annulla</button><button className="primary" onClick={onClose}>Fatto · {selectedIds.length}</button></div> : undefined}>
      <div className="search-modal-sticky">
        <div className="search-shell modal-search"><span className="search-icon">⌕</span><input autoFocus inputMode="search" placeholder="Cerca alimento, marca o barcode..." value={query} onChange={(e) => onQueryChange(e.target.value)} /></div>
        {selectionMode && <div className="search-selection-summary"><span>{selectedIds.length} selezionati</span>{selectedIds.length > 0 && <button className="text-button" onClick={() => selectedIds.forEach((id) => onToggleSelected(id))}>Deseleziona tutti</button>}</div>}
      </div>
      <div className="search-result-list">
        {foods.map((food) => {
          const checked = selectionMode && selectedIds.includes(food.id);
          return <div className={`search-result-row ${checked ? 'selected' : ''}`} key={food.id}>
            {selectionMode && <button className={`selection-dot ${checked ? 'active' : ''}`} aria-label={checked ? 'Deseleziona' : 'Seleziona'} onClick={() => onToggleSelected(food.id)}>{checked ? '✓' : ''}</button>}
            <button className="search-result-main" onClick={() => selectionMode ? onToggleSelected(food.id) : onOpenFood(food)}>
              <span className="food-avatar small">{food.name.slice(0, 1).toUpperCase()}</span><span><strong>{food.name}</strong><small>{macros(food)}{food.brand ? ` · ${food.brand}` : ''}</small></span>
            </button>
            <button className="search-result-info" aria-label="Dettagli alimento" onClick={() => onOpenFood(food)}>›</button>
          </div>;
        })}
      </div>
    </AppModal>
  );
}
