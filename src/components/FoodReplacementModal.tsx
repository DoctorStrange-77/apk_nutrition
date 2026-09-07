import { AppModal } from '@/components/AppModal';
import type { FoodReplacementSuggestion } from '@/domain/smartEditing';
import type { GeneratedFoodPortion } from '@/types/nutrition';

type Props = {
  open: boolean;
  original: GeneratedFoodPortion | null;
  suggestions: FoodReplacementSuggestion[];
  onClose: () => void;
  onSelect: (suggestion: FoodReplacementSuggestion) => void;
};

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

export function FoodReplacementModal({ open, original, suggestions, onClose, onSelect }: Props) {
  if (!original) return null;
  return (
    <AppModal
      open={open}
      title="Sostituisci alimento"
      eyebrow="SMART EQUIVALENT"
      onClose={onClose}
      fullscreen
    >
      <div className="replacement-original">
        <small>ALIMENTO ATTUALE</small>
        <div><strong>{original.name}</strong><b>{original.grams} g</b></div>
        <span>{original.carbs.toFixed(1)}C · {original.protein.toFixed(1)}P · {original.fat.toFixed(1)}F</span>
      </div>

      <div className="replacement-intro">
        <strong>Alternative calcolate dal motore</strong>
        <p>Le proposte sono ordinate per somiglianza nutrizionale. Dopo la scelta, App Nutrition riottimizza le grammature del pasto per restare il più vicino possibile al target.</p>
      </div>

      <div className="replacement-list">
        {suggestions.map((entry, index) => (
          <button
            className="replacement-row"
            key={entry.food.id}
            type="button"
            onClick={() => onSelect(entry)}
          >
            <span className="replacement-rank">{index + 1}</span>
            <span className="replacement-main">
              <strong>{entry.food.name}</strong>
              <small>{entry.food.brand || entry.food.subcategory || entry.food.category}</small>
              <em>{entry.macros.carbs.toFixed(1)}C · {entry.macros.protein.toFixed(1)}P · {entry.macros.fat.toFixed(1)}F</em>
            </span>
            <span className="replacement-side">
              <b>{entry.grams} g</b>
              <small>{signed(entry.delta.carbs)}C · {signed(entry.delta.protein)}P · {signed(entry.delta.fat)}F</small>
            </span>
          </button>
        ))}
        {!suggestions.length && <p className="empty-meal">Nessuna alternativa compatibile disponibile nel pool alimenti.</p>}
      </div>
    </AppModal>
  );
}
