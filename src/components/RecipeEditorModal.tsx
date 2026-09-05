import { AppModal } from '@/components/AppModal';
import { kcalFromMacros } from '@/domain/manualMenu';
import { recipeTotals, recipeWeight } from '@/domain/recipes';
import type { Recipe } from '@/types/nutrition';

type Props = {
  recipe: Recipe | null;
  onChange: (recipe: Recipe) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (index: number) => void;
  onUpdateIngredientGrams: (index: number, grams: number) => void;
};

const safe = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function RecipeEditorModal(props: Props) {
  const { recipe, onChange, onClose, onSave, onDelete, onAddIngredient, onRemoveIngredient, onUpdateIngredientGrams } = props;
  const totals = recipe ? recipeTotals(recipe) : { carbs: 0, protein: 0, fat: 0 };
  const rawWeight = recipe ? recipeWeight(recipe.ingredients) : 0;
  const finalWeight = Math.max(1, recipe?.cookedWeightGrams || rawWeight || 1);
  const per100 = {
    carbs: totals.carbs / finalWeight * 100,
    protein: totals.protein / finalWeight * 100,
    fat: totals.fat / finalWeight * 100,
  };
  const footer = recipe ? <div className="modal-actions">
    {onDelete && <button className="danger" onClick={onDelete}>Elimina</button>}
    <button className="primary" onClick={onSave}>Salva ricetta</button>
  </div> : null;

  return <AppModal open={!!recipe} fullscreen title={recipe?.name || 'Nuova ricetta'} eyebrow="RICETTA PREMIUM" onClose={onClose} footer={footer}>
    {recipe && <>
      <div className="nutrition-preview modal-nutrition">
        <span><small>CARB /100g</small><strong>{per100.carbs.toFixed(1)} g</strong></span>
        <span><small>PRO /100g</small><strong>{per100.protein.toFixed(1)} g</strong></span>
        <span><small>FAT /100g</small><strong>{per100.fat.toFixed(1)} g</strong></span>
        <span><small>KCAL /100g</small><strong>{kcalFromMacros(per100).toFixed(0)}</strong></span>
      </div>
      <div className="form-grid detail-grid modal-form recipe-main-form">
        <label>Nome ricetta<input value={recipe.name} onChange={(e) => onChange({ ...recipe, name: e.target.value })} /></label>
        <label>Peso finale preparazione g<input type="number" min="1" value={recipe.cookedWeightGrams || ''} onChange={(e) => onChange({ ...recipe, cookedWeightGrams: safe(e.target.value) })} /></label>
        <label>Nome porzione<input value={recipe.servingName} onChange={(e) => onChange({ ...recipe, servingName: e.target.value })} /></label>
        <label>Grammi per porzione<input type="number" min="1" value={recipe.servingGrams} onChange={(e) => onChange({ ...recipe, servingGrams: safe(e.target.value) })} /></label>
      </div>
      <section className="recipe-ingredients">
        <div className="row-between">
          <div><p className="eyebrow red">INGREDIENTI</p><h3>{recipe.ingredients.length} alimenti · {rawWeight.toFixed(0)} g crudi</h3></div>
          <button className="secondary" onClick={onAddIngredient}>+ Ingrediente</button>
        </div>
        {!recipe.ingredients.length && <p className="empty-meal">Nessun ingrediente inserito.</p>}
        {recipe.ingredients.map((item, index) => <div className="recipe-ingredient-row" key={item.id}>
          <div>
            <strong>{item.food.name}</strong>
            <small>{item.food.carbs.toFixed(1)}C · {item.food.protein.toFixed(1)}P · {item.food.fat.toFixed(1)}F /100g</small>
          </div>
          <label className="grams-field"><input type="number" min="0" value={item.grams} onChange={(e) => onUpdateIngredientGrams(index, safe(e.target.value))} /><span>g</span></label>
          <button className="icon-danger" aria-label="Rimuovi ingrediente" onClick={() => onRemoveIngredient(index)}>×</button>
        </div>)}
      </section>
      <div className="recipe-info-card">
        <strong>Come viene usata</strong>
        <p>La ricetta viene salvata come alimento locale. Il diario usa la porzione impostata; il Nutrition Engine puo usarla nel pool automatico in grammi come qualsiasi altro alimento.</p>
      </div>
    </>}
  </AppModal>;
}
