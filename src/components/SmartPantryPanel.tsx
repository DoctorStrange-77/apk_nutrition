import { useMemo, useState } from 'react';
import type { LocalFood, PantryItem } from '@/types/nutrition';

type Props = {
  foods: LocalFood[];
  items: PantryItem[];
  onChange: (items: PantryItem[]) => void;
};

const safe = (value:string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function SmartPantryPanel({ foods, items, onChange }:Props) {
  const [query, setQuery] = useState('');
  const foodById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const existingIds = useMemo(() => new Set(items.map((item) => item.foodId)), [items]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return foods
      .filter((food) => !existingIds.has(food.id))
      .filter((food) => `${food.name} ${food.brand || ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [foods, existingIds, query]);

  const addFood = (food:LocalFood) => {
    onChange([
      ...items,
      {
        foodId:food.id,
        gramsAvailable:food.servingGrams || 0,
        packageGrams:food.servingGrams,
        updatedAt:new Date().toISOString(),
      },
    ]);
    setQuery('');
  };

  const update = (foodId:string, patch:Partial<PantryItem>) => {
    onChange(items.map((item) => item.foodId === foodId
      ? { ...item, ...patch, updatedAt:new Date().toISOString() }
      : item));
  };

  return <section className="smart-pantry-panel">
    <div className="smart-section-head">
      <div><p className="eyebrow red">COSA HO IN CASA</p><h3>Dispensa Smart</h3></div>
      <span className="smart-count">{items.length}</span>
    </div>
    <div className="smart-pantry-search">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca alimento da aggiungere..."
      />
      {suggestions.length > 0 && <div className="smart-pantry-suggestions">
        {suggestions.map((food) => <button type="button" key={food.id} onClick={() => addFood(food)}>
          <span><strong>{food.name}</strong><small>{food.brand || food.category}</small></span><b>+</b>
        </button>)}
      </div>}
    </div>
    {!items.length && <p className="smart-empty">Aggiungi gli alimenti realmente disponibili: Smart Nutrition potrà privilegiarli e ridurre gli acquisti inutili.</p>}
    <div className="smart-pantry-list">
      {items.map((item) => {
        const food = foodById.get(item.foodId);
        if (!food) return null;
        return <article className="smart-pantry-item" key={item.foodId}>
          <div className="smart-pantry-title">
            <span><strong>{food.name}</strong><small>{food.brand || food.category}</small></span>
            <button type="button" className="icon-danger" onClick={() => onChange(items.filter((entry) => entry.foodId !== item.foodId))}>×</button>
          </div>
          <div className="smart-pantry-grid">
            <label>Disponibili<input type="number" min="0" value={item.gramsAvailable} onChange={(event) => update(item.foodId, { gramsAvailable:safe(event.target.value) })} /><span>g</span></label>
            <label>Confezione<input type="number" min="0" value={item.packageGrams || ''} onChange={(event) => update(item.foodId, { packageGrams:safe(event.target.value) || undefined })} /><span>g</span></label>
            <label>Prezzo<input type="number" min="0" step="0.01" value={item.packagePrice || ''} onChange={(event) => update(item.foodId, { packagePrice:safe(event.target.value) || undefined })} /><span>€</span></label>
            <label>Negozio<input value={item.retailer || ''} onChange={(event) => update(item.foodId, { retailer:event.target.value })} placeholder="es. Lidl" /></label>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
