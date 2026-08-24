import { useEffect, useMemo, useState } from 'react';
import { BUILDER_FOODS } from '@/data/builderFoods';
import { BUILT_IN_TIMINGS } from '@/data/builtInTimings';
import {
  calculateMealTargets,
  createEmptyTiming,
  timingTotals,
  validateTimingTemplate,
} from '@/domain/timing';
import { generateNutritionMenu } from '@/engine/nutritionEngine';
import { getLocalValue, initLocalDatabase, setLocalValue } from '@/storage/localDatabase';
import { scanProductBarcode } from '@/services/barcodeService';
import { lookupOpenFoodFacts } from '@/services/openFoodFactsService';
import type {
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  NutritionAppSnapshot,
  TimingMeal,
  TimingTemplate,
} from '@/types/nutrition';

type Tab = 'menu' | 'timing' | 'foods' | 'saved';

const DEFAULT_TARGET: MacroTarget = { carbs: 300, protein: 180, fat: 60 };
const EMPTY_SNAPSHOT: NutritionAppSnapshot = { customTimings: [], customFoods: [], savedMenus: [] };

const safeNumber = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const cloneTimingForEdit = (timing: TimingTemplate): TimingTemplate => ({
  ...timing,
  id: `timing-${Date.now()}`,
  name: `${timing.name} - COPIA`,
  builtIn: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  meals: timing.meals.map((meal, index) => ({ ...meal, id: `meal-${Date.now()}-${index}` })),
});

const foodMacros = (food: LocalFood) => `${food.carbs.toFixed(1)}C · ${food.protein.toFixed(1)}P · ${food.fat.toFixed(1)}F`;

export function App() {
  const [tab, setTab] = useState<Tab>('menu');
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<MacroTarget>(DEFAULT_TARGET);
  const [customTimings, setCustomTimings] = useState<TimingTemplate[]>([]);
  const [customFoods, setCustomFoods] = useState<LocalFood[]>([]);
  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [activeTimingId, setActiveTimingId] = useState('omogeneo');
  const [menu, setMenu] = useState<GeneratedMenu | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);
  const [status, setStatus] = useState('');
  const [foodSearch, setFoodSearch] = useState('');
  const [editingTiming, setEditingTiming] = useState<TimingTemplate | null>(null);
  const [manualFood, setManualFood] = useState({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });

  const timings = useMemo(() => [...BUILT_IN_TIMINGS, ...customTimings], [customTimings]);
  const foods = useMemo(() => [...BUILDER_FOODS, ...customFoods], [customFoods]);
  const activeTiming = timings.find((timing) => timing.id === activeTimingId) || timings[0];
  const kcal = target.carbs * 4 + target.protein * 4 + target.fat * 9;
  const mealTargets = activeTiming ? calculateMealTargets(target, activeTiming) : [];
  const filteredFoods = foods.filter((food) => {
    const query = foodSearch.trim().toLowerCase();
    return !query || `${food.name} ${food.brand || ''} ${food.subcategory || ''}`.toLowerCase().includes(query);
  });

  useEffect(() => {
    void (async () => {
      try {
        await initLocalDatabase();
        const snapshot = await getLocalValue<NutritionAppSnapshot>('snapshot', EMPTY_SNAPSHOT);
        setCustomTimings(snapshot.customTimings || []);
        setCustomFoods(snapshot.customFoods || []);
        setSavedMenus(snapshot.savedMenus || []);
        setTarget(snapshot.lastTarget || DEFAULT_TARGET);
        setActiveTimingId(snapshot.lastTimingId || 'omogeneo');
        setSelectedFoodIds(snapshot.selectedFoodIds || []);
      } catch (error) {
        setStatus(`Archivio locale: ${String(error)}`);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const snapshot: NutritionAppSnapshot = {
      customTimings,
      customFoods,
      savedMenus,
      lastTarget: target,
      lastTimingId: activeTimingId,
      selectedFoodIds,
    };
    void setLocalValue('snapshot', snapshot).catch((error) => setStatus(`Salvataggio locale: ${String(error)}`));
  }, [ready, customTimings, customFoods, savedMenus, target, activeTimingId, selectedFoodIds]);

  const generate = (regenerate = false) => {
    if (!activeTiming) return;
    try {
      const nextSeed = regenerate ? attemptSeed + 1 : attemptSeed;
      const result = generateNutritionMenu({
        target,
        timing: activeTiming,
        foods,
        selectedFoodIds: selectedFoodIds.length ? selectedFoodIds : undefined,
        attemptSeed: nextSeed,
        dayKind: activeTiming.dayKind === 'all' ? 'workout' : activeTiming.dayKind,
      });
      setAttemptSeed(nextSeed);
      setMenu(result);
      setStatus(result.status === 'best_feasible'
        ? 'Generata la migliore soluzione possibile con gli alimenti disponibili.'
        : 'Menu generato e validato.');
    } catch (error) {
      setStatus(`Generazione non riuscita: ${String(error)}`);
    }
  };

  const saveCurrentMenu = () => {
    if (!menu) return;
    setSavedMenus((current) => [menu, ...current.filter((entry) => entry.id !== menu.id)].slice(0, 100));
    setStatus('Menu salvato sul dispositivo.');
  };

  const updateEditingMeal = (index: number, patch: Partial<TimingMeal>) => {
    setEditingTiming((current) => current ? {
      ...current,
      meals: current.meals.map((meal, mealIndex) => mealIndex === index ? { ...meal, ...patch } : meal),
      updatedAt: new Date().toISOString(),
    } : current);
  };

  const resizeTiming = (count: number) => {
    setEditingTiming((current) => {
      if (!current) return current;
      const nextCount = Math.max(1, Math.min(6, count));
      const meals = [...current.meals];
      while (meals.length < nextCount) {
        meals.push({
          id: `meal-${Date.now()}-${meals.length}`,
          name: `Pasto ${meals.length + 1}`,
          carbsPercent: 0,
          proteinPercent: 0,
          fatPercent: 0,
          workoutTiming: 'none',
        });
      }
      return { ...current, meals: meals.slice(0, nextCount), updatedAt: new Date().toISOString() };
    });
  };

  const distributeEqually = () => {
    setEditingTiming((current) => {
      if (!current || !current.meals.length) return current;
      const equal = 100 / current.meals.length;
      return {
        ...current,
        meals: current.meals.map((meal) => ({ ...meal, carbsPercent: equal, proteinPercent: equal, fatPercent: equal })),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const saveTiming = () => {
    if (!editingTiming) return;
    const validation = validateTimingTemplate(editingTiming);
    if (!validation.valid) {
      setStatus('Timing non valido: carboidrati, proteine e grassi devono totalizzare 100%.');
      return;
    }
    setCustomTimings((current) => [editingTiming, ...current.filter((timing) => timing.id !== editingTiming.id)]);
    setActiveTimingId(editingTiming.id);
    setEditingTiming(null);
    setStatus('Timing salvato localmente.');
  };

  const addManualFood = () => {
    if (!manualFood.name.trim()) {
      setStatus('Inserisci il nome dell’alimento.');
      return;
    }
    const id = `food-${Date.now()}`;
    const energies = {
      carb: manualFood.carbs * 4,
      protein: manualFood.protein * 4,
      fat: manualFood.fat * 9,
    };
    const total = energies.carb + energies.protein + energies.fat;
    const category: LocalFood['category'] = total > 0 && Object.values(energies).filter((value) => value / total >= 0.2).length < 2
      ? (energies.protein >= energies.carb && energies.protein >= energies.fat ? 'protein' : energies.fat >= energies.carb ? 'fat' : 'carb')
      : 'mixed';
    const food: LocalFood = {
      id,
      name: manualFood.name.trim(),
      barcode: manualFood.barcode.trim() || undefined,
      carbs: manualFood.carbs,
      protein: manualFood.protein,
      fat: manualFood.fat,
      category,
      suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
      source: manualFood.barcode ? 'barcode' : 'manual',
    };
    setCustomFoods((current) => [food, ...current]);
    setManualFood({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });
    setStatus('Alimento aggiunto al database locale.');
  };

  const scanBarcode = async () => {
    try {
      setStatus('Apertura scannerâ€¦');
      const barcode = await scanProductBarcode();
      const localFood = foods.find((food) => food.barcode === barcode);
      if (localFood) {
        setFoodSearch(localFood.name);
        setStatus(`Trovato nel database locale: ${localFood.name}`);
        return;
      }

      setStatus(`Barcode ${barcode} letto. Ricerca su Open Food Factsâ€¦`);
      try {
        const externalFood = await lookupOpenFoodFacts(barcode);
        if (externalFood) {
          setCustomFoods((current) => [externalFood, ...current.filter((food) => food.barcode !== barcode)]);
          setFoodSearch(externalFood.name);
          setManualFood({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });
          setStatus(`Trovato online e salvato sul dispositivo: ${externalFood.name}${externalFood.brand ? ` Â· ${externalFood.brand}` : ''}`);
          return;
        }

        setManualFood((current) => ({ ...current, barcode }));
        setStatus(`Barcode ${barcode} non trovato su Open Food Facts. Puoi inserirlo manualmente una sola volta.`);
      } catch (lookupError) {
        setManualFood((current) => ({ ...current, barcode }));
        const lookupText = String(lookupError);
        setStatus(lookupText.includes('OPEN_FOOD_FACTS_TIMEOUT') || lookupText.includes('Failed to fetch')
          ? `Barcode ${barcode} letto, ma la ricerca online non Ã¨ disponibile. Riprova con connessione internet oppure inseriscilo manualmente.`
          : `Barcode ${barcode} letto. Open Food Facts: ${lookupText}`);
      }
    } catch (error) {
      const text = String(error);
      setStatus(text.includes('SCANNER_MODULE_INSTALLING')
        ? 'Modulo scanner Android in installazione. Riprova tra poco.'
        : `Scanner: ${text}`);
    }
  };

  if (!ready) return <main className="app-shell"><p>Inizializzazione archivio locale…</p></main>;

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">BUILDER NUTRITION</p>
          <h1>Nutrition Engine V2</h1>
          <p className="muted">Macro, timing, alimenti e menu salvati sul dispositivo. Nessun login.</p>
        </div>
        <div className="kcal-badge">{kcal.toFixed(0)} kcal</div>
      </header>

      <nav className="tabs">
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>Menu</button>
        <button className={tab === 'timing' ? 'active' : ''} onClick={() => setTab('timing')}>Timing</button>
        <button className={tab === 'foods' ? 'active' : ''} onClick={() => setTab('foods')}>Alimenti</button>
        <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>Salvati</button>
      </nav>

      {status && <div className="status" role="status">{status}</div>}

      {tab === 'menu' && <>
        <section className="card">
          <h2>Target giornaliero</h2>
          <div className="macro-grid">
            <label>Carboidrati<input type="number" min="0" value={target.carbs} onChange={(e) => setTarget({ ...target, carbs: safeNumber(e.target.value) })} /><span>g</span></label>
            <label>Proteine<input type="number" min="0" value={target.protein} onChange={(e) => setTarget({ ...target, protein: safeNumber(e.target.value) })} /><span>g</span></label>
            <label>Grassi<input type="number" min="0" value={target.fat} onChange={(e) => setTarget({ ...target, fat: safeNumber(e.target.value) })} /><span>g</span></label>
          </div>
        </section>

        <section className="card">
          <div className="row-between"><h2>Timing</h2><button className="ghost" onClick={() => setTab('timing')}>Gestisci</button></div>
          <select value={activeTimingId} onChange={(e) => setActiveTimingId(e.target.value)}>
            {timings.map((timing) => <option key={timing.id} value={timing.id}>{timing.name}</option>)}
          </select>
          <div className="meal-targets">
            {mealTargets.map((meal, index) => <div className="target-chip" key={`${activeTimingId}-${index}`}>
              <strong>{meal.name}</strong><span>{meal.carbs.toFixed(0)}C · {meal.protein.toFixed(0)}P · {meal.fat.toFixed(0)}F</span>
            </div>)}
          </div>
        </section>

        <section className="card">
          <div className="row-between"><h2>Pool alimenti</h2><button className="ghost" onClick={() => setTab('foods')}>Scegli</button></div>
          <p className="muted">{selectedFoodIds.length ? `${selectedFoodIds.length} alimenti selezionati: il motore userà solo questi.` : `Pool completo: ${foods.length} alimenti disponibili.`}</p>
          {selectedFoodIds.length > 0 && <button className="text-button" onClick={() => setSelectedFoodIds([])}>Usa tutto il database</button>}
        </section>

        <div className="actions">
          <button className="primary" onClick={() => generate(false)}>Genera menu</button>
          <button onClick={() => generate(true)} disabled={!menu}>Rigenera</button>
        </div>

        {menu && <section className="card result-card">
          <div className="row-between">
            <div><p className="eyebrow">{menu.status.toUpperCase()}</p><h2>Menu generato</h2></div>
            <button onClick={saveCurrentMenu}>Salva</button>
          </div>
          <div className="result-summary">
            <span>Target {menu.target.carbs.toFixed(1)}C / {menu.target.protein.toFixed(1)}P / {menu.target.fat.toFixed(1)}F</span>
            <span>Reale {menu.actual.carbs.toFixed(1)}C / {menu.actual.protein.toFixed(1)}P / {menu.actual.fat.toFixed(1)}F</span>
            <span>Tolleranza {menu.tolerancePercent}%</span>
          </div>
          {menu.meals.map((meal, index) => <article className="generated-meal" key={`${menu.id}-${index}`}>
            <div className="row-between"><strong>{meal.name}</strong><span className={meal.withinTolerance ? 'ok' : 'warn'}>{meal.workoutTiming !== 'none' ? meal.workoutTiming.toUpperCase() : ''}</span></div>
            <small>Target {meal.target.carbs.toFixed(1)}C · {meal.target.protein.toFixed(1)}P · {meal.target.fat.toFixed(1)}F</small>
            {meal.foods.map((food) => <div className="food-line" key={`${meal.name}-${food.foodId}`}><span>{food.name}</span><strong>{food.grams} g</strong></div>)}
            <small>Reale {meal.actual.carbs.toFixed(1)}C · {meal.actual.protein.toFixed(1)}P · {meal.actual.fat.toFixed(1)}F</small>
          </article>)}
        </section>}
      </>}

      {tab === 'timing' && <>
        <section className="card">
          <div className="row-between"><h2>Gestione timing</h2><button className="primary small" onClick={() => setEditingTiming(createEmptyTiming('Nuovo timing', 5))}>Nuovo</button></div>
          <p className="muted">I timing Builder sono preinstallati. Duplicali per modificarli oppure creane uno da zero.</p>
          <div className="timing-list">
            {timings.map((timing) => <div className="list-row" key={timing.id}>
              <button className="list-main" onClick={() => setActiveTimingId(timing.id)}><strong>{timing.name}</strong><span>{timing.meals.length} pasti · {timing.dayKind}</span></button>
              <button onClick={() => setEditingTiming(timing.builtIn ? cloneTimingForEdit(timing) : structuredClone(timing))}>{timing.builtIn ? 'Duplica' : 'Modifica'}</button>
              {!timing.builtIn && <button className="danger" onClick={() => setCustomTimings((current) => current.filter((item) => item.id !== timing.id))}>Elimina</button>}
            </div>)}
          </div>
        </section>

        {editingTiming && <section className="card editor-card">
          <div className="row-between"><h2>Editor timing</h2><button className="ghost" onClick={() => setEditingTiming(null)}>Chiudi</button></div>
          <label>Nome<input value={editingTiming.name} onChange={(e) => setEditingTiming({ ...editingTiming, name: e.target.value })} /></label>
          <div className="inline-fields"><label>Pasti<input type="number" min="1" max="6" value={editingTiming.meals.length} onChange={(e) => resizeTiming(Number(e.target.value))} /></label><button onClick={distributeEqually}>Distribuisci 100% uguale</button></div>
          <div className="timing-editor-head"><span>Pasto</span><span>C%</span><span>P%</span><span>F%</span><span>WO</span></div>
          {editingTiming.meals.map((meal, index) => <div className="timing-editor-row" key={meal.id}>
            <input value={meal.name} onChange={(e) => updateEditingMeal(index, { name: e.target.value })} />
            <input type="number" step="0.5" value={meal.carbsPercent} onChange={(e) => updateEditingMeal(index, { carbsPercent: safeNumber(e.target.value) })} />
            <input type="number" step="0.5" value={meal.proteinPercent} onChange={(e) => updateEditingMeal(index, { proteinPercent: safeNumber(e.target.value) })} />
            <input type="number" step="0.5" value={meal.fatPercent} onChange={(e) => updateEditingMeal(index, { fatPercent: safeNumber(e.target.value) })} />
            <select value={meal.workoutTiming} onChange={(e) => updateEditingMeal(index, { workoutTiming: e.target.value as TimingMeal['workoutTiming'] })}><option value="none">—</option><option value="pre">PRE</option><option value="post">POST</option></select>
          </div>)}
          <div className="totals">{(() => { const totals = timingTotals(editingTiming); return <>Totali: C {totals.carbs.toFixed(1)}% · P {totals.protein.toFixed(1)}% · F {totals.fat.toFixed(1)}%</>; })()}</div>
          <button className="primary" onClick={saveTiming}>Salva timing</button>
        </section>}
      </>}

      {tab === 'foods' && <>
        <section className="card">
          <div className="row-between"><h2>Database alimenti</h2><button onClick={() => void scanBarcode()}>Scansiona barcode</button></div>
          <input className="search" placeholder="Cerca alimento…" value={foodSearch} onChange={(e) => setFoodSearch(e.target.value)} />
          <div className="food-toolbar"><span>{selectedFoodIds.length} selezionati</span>{selectedFoodIds.length > 0 && <button className="text-button" onClick={() => setSelectedFoodIds([])}>Deseleziona tutti</button>}</div>
          <div className="food-list">
            {filteredFoods.slice(0, 120).map((food) => <label className="food-choice" key={food.id}>
              <input type="checkbox" checked={selectedFoodIds.includes(food.id)} onChange={() => setSelectedFoodIds((current) => current.includes(food.id) ? current.filter((id) => id !== food.id) : [...current, food.id])} />
              <span><strong>{food.name}</strong><small>{foodMacros(food)} · {food.source}</small></span>
            </label>)}
          </div>
        </section>

        <section className="card">
          <h2>Aggiungi alimento</h2>
          <div className="form-grid">
            <label>Nome<input value={manualFood.name} onChange={(e) => setManualFood({ ...manualFood, name: e.target.value })} /></label>
            <label>Barcode<input value={manualFood.barcode} onChange={(e) => setManualFood({ ...manualFood, barcode: e.target.value })} /></label>
            <label>Carboidrati /100g<input type="number" value={manualFood.carbs} onChange={(e) => setManualFood({ ...manualFood, carbs: safeNumber(e.target.value) })} /></label>
            <label>Proteine /100g<input type="number" value={manualFood.protein} onChange={(e) => setManualFood({ ...manualFood, protein: safeNumber(e.target.value) })} /></label>
            <label>Grassi /100g<input type="number" value={manualFood.fat} onChange={(e) => setManualFood({ ...manualFood, fat: safeNumber(e.target.value) })} /></label>
          </div>
          <button className="primary" onClick={addManualFood}>Salva alimento</button>
        </section>
      </>}

      {tab === 'saved' && <section className="card">
        <h2>Menu salvati</h2>
        {!savedMenus.length && <p className="muted">Nessun menu salvato.</p>}
        {savedMenus.map((saved) => <div className="saved-row" key={saved.id}>
          <button className="list-main" onClick={() => { setMenu(saved); setActiveTimingId(saved.timingTemplateId); setTab('menu'); }}><strong>{new Date(saved.createdAt).toLocaleString()}</strong><span>{saved.status} · {saved.targetKcal.toFixed(0)} kcal</span></button>
          <button className="danger" onClick={() => setSavedMenus((current) => current.filter((entry) => entry.id !== saved.id))}>Elimina</button>
        </div>)}
      </section>}
    </main>
  );
}
