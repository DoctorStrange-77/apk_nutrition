import { AppModal } from '@/components/AppModal';
import type { LocalFood } from '@/types/nutrition';

type Props = {
  open: boolean;
  foods: LocalFood[];
  query: string;
  favoriteIds: string[];
  recentIds: string[];
  onQueryChange: (value: string) => void;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onSelect: (food: LocalFood) => void;
};

const foodMacros = (food: LocalFood) => `${food.carbs.toFixed(1)}C · ${food.protein.toFixed(1)}P · ${food.fat.toFixed(1)}F`;

function FoodRow({ food, favorite, onSelect, onToggleFavorite }: {
  food: LocalFood; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void;
}) {
  return <div className="picker-food-row">
    <button className="picker-food-main" onClick={onSelect}>
      <span className="food-avatar small">{food.name.slice(0, 1).toUpperCase()}</span>
      <span><strong>{food.name}</strong><small>{foodMacros(food)}{food.brand ? ` · ${food.brand}` : ''}</small></span>
      <b>+</b>
    </button>
    <button className={`favorite-toggle ${favorite ? 'active' : ''}`} aria-label={favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'} onClick={onToggleFavorite}>★</button>
  </div>;
}

export function FoodPickerModal({
  open, foods, query, favoriteIds, recentIds,
  onQueryChange, onToggleFavorite, onClose, onSelect,
}: Props) {
  const favoriteSet = new Set(favoriteIds);
  const recentSet = new Set(recentIds);
  const isSearching = !!query.trim();
  const favoriteFoods = isSearching ? [] : foods.filter((food) => favoriteSet.has(food.id));
  const recentFoods = isSearching ? [] : foods.filter((food) => recentSet.has(food.id) && !favoriteSet.has(food.id));
  const otherFoods = isSearching ? foods : foods.filter((food) => !favoriteSet.has(food.id) && !recentSet.has(food.id));
  const renderGroup = (label: string, group: LocalFood[]) => group.length ? <section className="picker-group">
    <div className="picker-group-title">{label}</div>
    <div className="picker-list modal-picker-list">
      {group.map((food) => <FoodRow key={food.id} food={food} favorite={favoriteSet.has(food.id)} onSelect={() => onSelect(food)} onToggleFavorite={() => onToggleFavorite(food.id)} />)}
    </div>
  </section> : null;

  return <AppModal open={open} fullscreen title="Aggiungi alimento" eyebrow="DIARIO PREMIUM" onClose={onClose}>
    <div className="search-modal-sticky">
      <div className="search-shell modal-search">
        <span className="search-icon">⌕</span>
        <input placeholder="Cerca alimento o barcode..." value={query} onChange={(event) => onQueryChange(event.target.value)} autoFocus inputMode="search" />
      </div>
    </div>
    <div className="picker-premium-body">
      {isSearching ? renderGroup('RISULTATI', otherFoods) : <>
        {renderGroup('★ PREFERITI', favoriteFoods)}
        {renderGroup('RECENTI', recentFoods)}
        {renderGroup('TUTTI GLI ALIMENTI', otherFoods)}
      </>}
    </div>
  </AppModal>;
}
