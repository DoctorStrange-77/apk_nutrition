import { AppModal } from '@/components/AppModal';
import type { LocalFood } from '@/types/nutrition';

type Props = {
  open: boolean;
  foods: LocalFood[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelect: (food: LocalFood) => void;
};

const foodMacros = (food: LocalFood) => `${food.carbs.toFixed(1)}C · ${food.protein.toFixed(1)}P · ${food.fat.toFixed(1)}F`;

export function FoodPickerModal({ open, foods, query, onQueryChange, onClose, onSelect }: Props) {
  return (
    <AppModal open={open} title="Aggiungi alimento" eyebrow="COMPOSIZIONE MANUALE" onClose={onClose}>
      <div className="search-shell modal-search"><span className="search-icon">⌕</span><input placeholder="Cerca alimento o barcode..." value={query} onChange={(e) => onQueryChange(e.target.value)} autoFocus /></div>
      <div className="picker-list modal-picker-list">{foods.map((food) => <button key={food.id} onClick={() => onSelect(food)}>
        <span className="food-avatar small">{food.name.slice(0, 1).toUpperCase()}</span>
        <span><strong>{food.name}</strong><small>{foodMacros(food)}{food.brand ? ` · ${food.brand}` : ''}</small></span>
        <b>+</b>
      </button>)}</div>
    </AppModal>
  );
}
