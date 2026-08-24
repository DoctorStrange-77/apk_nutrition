import { useState } from 'react';
import { AppModal } from '@/components/AppModal';
import { ChoicePopup } from '@/components/ChoicePopup';
import { kcalFromMacros } from '@/domain/manualMenu';
import type { FoodCategory, FoodPortionUnit, LocalFood, NutritionWeightBasis } from '@/types/nutrition';

type Props = { food: LocalFood | null; onChange: (food: LocalFood) => void; onClose: () => void; onSave: () => void; onDelete: () => void };
const safeNumber = (value: string | number) => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; };
const categoryLabel: Record<FoodCategory,string> = { carb:'Carboidrati', protein:'Proteine', fat:'Grassi', mixed:'Misto' };

const practicalUnits = (food: LocalFood): FoodPortionUnit[] => [
  ...(food.servingName && food.servingGrams ? [{ id: 'legacy-serving', name: food.servingName, grams: food.servingGrams }] : []),
  ...(food.portionUnits || []),
].slice(0, 3);

export function FoodEditorModal({ food, onChange, onClose, onSave, onDelete }: Props) {
  const [showCategory, setShowCategory] = useState(false);
  const [showBasis, setShowBasis] = useState(false);
  const setUnit = (index: number, field: 'name' | 'grams', value: string | number) => {
    if (!food) return;
    const units = practicalUnits(food);
    while (units.length <= index) units.push({ id: `custom-${index + 1}`, name: '', grams: 0 });
    units[index] = { ...units[index], [field]: field === 'grams' ? safeNumber(value) : String(value) };
    const valid = units.filter((unit) => unit.name.trim() || unit.grams > 0);
    const [primary, ...extra] = valid;
    onChange({ ...food, servingName: primary?.name || undefined, servingGrams: primary?.grams || undefined, portionUnits: extra.map((unit, i) => ({ ...unit, id: unit.id === 'legacy-serving' ? `custom-${i + 2}` : unit.id })) });
  };  return <>
    <AppModal open={!!food} title={food?.name || 'Alimento'} eyebrow="SCHEDA ALIMENTO" onClose={onClose} wide
      footer={food ? <div className="modal-actions"><button className="danger" onClick={onDelete}>Elimina</button><button className="primary" onClick={onSave}>Salva modifiche</button></div> : null}>
      {food && <>
        <div className="food-hero"><div className="food-hero-icon">{food.name.slice(0,1).toUpperCase()}</div><div><strong>{food.brand || 'Alimento personale'}</strong><span>{food.source}{food.barcode ? ` · ${food.barcode}` : ''}</span></div></div>
        <div className="nutrition-preview modal-nutrition"><span><small>CARB</small><strong>{food.carbs.toFixed(1)} g</strong></span><span><small>PRO</small><strong>{food.protein.toFixed(1)} g</strong></span><span><small>FAT</small><strong>{food.fat.toFixed(1)} g</strong></span><span><small>KCAL</small><strong>{kcalFromMacros(food).toFixed(0)}</strong></span></div>
        <div className="form-grid detail-grid modal-form">
          <label>Nome<input value={food.name} onChange={(e) => onChange({ ...food, name:e.target.value })} /></label>
          <label>Marca<input value={food.brand || ''} onChange={(e) => onChange({ ...food, brand:e.target.value })} /></label>
          <label>Barcode<input value={food.barcode || ''} onChange={(e) => onChange({ ...food, barcode:e.target.value })} /></label>
          <label>Categoria<button type="button" className="selector-field" onClick={() => setShowCategory(true)}><span>{categoryLabel[food.category]}</span><b>›</b></button></label>
          <label>Carboidrati /100g<input type="number" step="0.1" value={food.carbs} onChange={(e) => onChange({ ...food, carbs:safeNumber(e.target.value) })} /></label>
          <label>Proteine /100g<input type="number" step="0.1" value={food.protein} onChange={(e) => onChange({ ...food, protein:safeNumber(e.target.value) })} /></label>
          <label>Grassi /100g<input type="number" step="0.1" value={food.fat} onChange={(e) => onChange({ ...food, fat:safeNumber(e.target.value) })} /></label>
          <label>Fibre /100g<input type="number" step="0.1" value={food.fiber ?? 0} onChange={(e) => onChange({ ...food, fiber:safeNumber(e.target.value) })} /></label>
          <label>Porzione minima g<input type="number" value={food.grammiMin ?? 0} onChange={(e) => onChange({ ...food, grammiMin:safeNumber(e.target.value) })} /></label>
          <label>Porzione massima g<input type="number" value={food.grammiMax ?? 0} onChange={(e) => onChange({ ...food, grammiMax:safeNumber(e.target.value) })} /></label>
        </div>
        <section className="food-portion-editor"><div><p className="eyebrow red">SMART PORTIONS</p><h3>Unità pratiche</h3><p className="muted">Definisci fino a 3 unità: fetta, vasetto, misurino, pezzo...</p></div>
          {[0,1,2].map((index) => { const unit = practicalUnits(food)[index]; return <div className="portion-unit-row" key={index}><input placeholder={`Unità ${index + 1}`} value={unit?.name || ''} onChange={(e) => setUnit(index, 'name', e.target.value)} /><label><input type="number" min="0" step="0.1" value={unit?.grams || 0} onChange={(e) => setUnit(index, 'grams', e.target.value)} /><span>g</span></label></div>; })}
        </section>        <section className="food-portion-editor"><div><p className="eyebrow red">CRUDO / COTTO</p><h3>Conversione peso</h3><p className="muted">Il rapporto indica quanti grammi cotti ottieni da 1 g crudo. Esempio: 2,5 = 100 g crudi → 250 g cotti.</p></div>
          <div className="form-grid detail-grid modal-form">
            <label>Valori nutrizionali riferiti a<button type="button" className="selector-field" onClick={() => setShowBasis(true)}><span>{food.nutritionWeightBasis === 'raw' ? 'Peso crudo' : food.nutritionWeightBasis === 'cooked' ? 'Peso cotto' : 'Nessuna conversione'}</span><b>›</b></button></label>
            <label>Rapporto cotto / crudo<input type="number" min="0" step="0.01" disabled={!food.nutritionWeightBasis} value={food.cookedWeightFactor ?? 0} onChange={(e) => onChange({ ...food, cookedWeightFactor:safeNumber(e.target.value) || undefined })} /></label>
          </div>
        </section>
      </>}
    </AppModal>
    <ChoicePopup open={showCategory && !!food} title="Categoria alimento" value={food?.category || 'mixed'} onClose={() => setShowCategory(false)} onSelect={(value) => food && onChange({ ...food, category:value as FoodCategory })} choices={[{value:'carb',label:'Carboidrati'},{value:'protein',label:'Proteine'},{value:'fat',label:'Grassi'},{value:'mixed',label:'Misto'}]} />
    <ChoicePopup open={showBasis && !!food} title="Riferimento del peso" value={food?.nutritionWeightBasis || 'none'} onClose={() => setShowBasis(false)} onSelect={(value) => food && onChange({ ...food, nutritionWeightBasis:value === 'none' ? undefined : value as NutritionWeightBasis, cookedWeightFactor:value === 'none' ? undefined : food.cookedWeightFactor })} choices={[{value:'none',label:'Nessuna conversione',subtitle:'Usa grammi normali'},{value:'raw',label:'Peso crudo',subtitle:'I valori /100g si riferiscono al crudo'},{value:'cooked',label:'Peso cotto',subtitle:'I valori /100g si riferiscono al cotto'}]} />
  </>;
}
