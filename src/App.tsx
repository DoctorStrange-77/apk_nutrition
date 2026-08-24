import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { SmartDayCard } from '@/components/SmartDayCard';
import { CompletionPlanCard } from '@/components/CompletionPlanCard';
import { FoodEditorModal } from '@/components/FoodEditorModal';
import { FoodPickerModal } from '@/components/FoodPickerModal';
import { FoodLibrarySearchModal } from '@/components/FoodLibrarySearchModal';
import { TimingSelectModal } from '@/components/TimingSelectModal';
import { NewFoodModal } from '@/components/NewFoodModal';
import { TimingEditorModal } from '@/components/TimingEditorModal';
import { BUILDER_FOODS } from '@/data/builderFoods';
import { BUILT_IN_TIMINGS } from '@/data/builtInTimings';
import { calculateMealTargets, createEmptyTiming, timingTotals, validateTimingTemplate } from '@/domain/timing';
import { kcalFromMacros, macrosForManualDay, macrosForManualItem, macrosForManualMeal } from '@/domain/manualMenu';
import { applyCompletionPlan, buildSingleMealTiming, buildSmartCompletionContext, completionNeeded, replaceGeneratedMeal } from '@/domain/smartCompletion';
import { generateNutritionMenu } from '@/engine/nutritionEngine';
import { scanProductBarcode } from '@/services/barcodeService';
import { lookupOpenFoodFacts } from '@/services/openFoodFactsService';
import { getLocalValue, initLocalDatabase, setLocalValue } from '@/storage/localDatabase';
import type {
  FoodCategory,
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  ManualMeal,
  NutritionAppSnapshot,
  SavedManualMenu,
  TimingMeal,
  TimingTemplate,
} from '@/types/nutrition';

type Tab = 'menu' | 'timing' | 'foods' | 'saved';
type MenuMode = 'automatic' | 'manual';

const DEFAULT_TARGET: MacroTarget = { carbs: 300, protein: 180, fat: 60 };
const EMPTY_SNAPSHOT: NutritionAppSnapshot = { customTimings: [], customFoods: [], savedMenus: [] };

const safeNumber = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const foodMacros = (food: LocalFood) => `${food.carbs.toFixed(1)}C · ${food.protein.toFixed(1)}P · ${food.fat.toFixed(1)}F`;

const cloneTimingForEdit = (timing: TimingTemplate): TimingTemplate => ({
  ...timing,
  id: `timing-${Date.now()}`,
  name: `${timing.name} - COPIA`,
  builtIn: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  meals: timing.meals.map((meal, index) => ({ ...meal, id: `meal-${Date.now()}-${index}` })),
});

const classifyFood = (carbs: number, protein: number, fat: number): FoodCategory => {
  const energies = { carb: carbs * 4, protein: protein * 4, fat: fat * 9 };
  const total = energies.carb + energies.protein + energies.fat;
  if (!total) return 'mixed';
  const significant = Object.values(energies).filter((value) => value / total >= 0.2).length;
  if (significant >= 2) return 'mixed';
  if (energies.protein >= energies.carb && energies.protein >= energies.fat) return 'protein';
  if (energies.fat >= energies.carb) return 'fat';
  return 'carb';
};

const syncMealsToTiming = (timing: TimingTemplate, current: ManualMeal[]): ManualMeal[] =>
  timing.meals.map((meal, index) => ({
    id: current[index]?.id || `manual-meal-${Date.now()}-${index}`,
    name: meal.name,
    items: current[index]?.items || [],
  }));

export function App() {
  const [tab, setTab] = useState<Tab>('menu');
  const [menuMode, setMenuMode] = useState<MenuMode>('automatic');
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<MacroTarget>(DEFAULT_TARGET);
  const [customTimings, setCustomTimings] = useState<TimingTemplate[]>([]);
  const [customFoods, setCustomFoods] = useState<LocalFood[]>([]);
  const [foodOverrides, setFoodOverrides] = useState<Record<string, LocalFood>>({});
  const [deletedFoodIds, setDeletedFoodIds] = useState<string[]>([]);
  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);
  const [savedManualMenus, setSavedManualMenus] = useState<SavedManualMenu[]>([]);
  const [manualMeals, setManualMeals] = useState<ManualMeal[]>([]);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [activeTimingId, setActiveTimingId] = useState('omogeneo');
  const [menu, setMenu] = useState<GeneratedMenu | null>(null);
  const [completionPlan, setCompletionPlan] = useState<GeneratedMenu | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);
  const [completionSeed, setCompletionSeed] = useState(0);
  const [status, setStatus] = useState('');
  const [foodSearch, setFoodSearch] = useState('');
  const [editingTiming, setEditingTiming] = useState<TimingTemplate | null>(null);
  const [editingFood, setEditingFood] = useState<LocalFood | null>(null);
  const [manualPickerMealId, setManualPickerMealId] = useState<string | null>(null);
  const [manualPickerSearch, setManualPickerSearch] = useState('');
  const [showNewFood, setShowNewFood] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showPoolSearch, setShowPoolSearch] = useState(false);
  const [showTimingSelect, setShowTimingSelect] = useState(false);
  const [manualFood, setManualFood] = useState({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });

  const timings = useMemo(() => [...BUILT_IN_TIMINGS, ...customTimings], [customTimings]);
  const foods = useMemo(() => {
    const base = BUILDER_FOODS.map((food) => foodOverrides[food.id] || food).filter((food) => !deletedFoodIds.includes(food.id));
    const custom = customFoods.filter((food) => !deletedFoodIds.includes(food.id));
    return [...base, ...custom];
  }, [customFoods, foodOverrides, deletedFoodIds]);
  const activeTiming = timings.find((timing) => timing.id === activeTimingId) || timings[0];
  const kcal = kcalFromMacros(target);
  const mealTargets = activeTiming ? calculateMealTargets(target, activeTiming) : [];
  const manualActual = useMemo(() => macrosForManualDay(manualMeals), [manualMeals]);
  const hasManualEntries = useMemo(() => manualMeals.some((meal) => meal.items.length > 0), [manualMeals]);
  const completionContext = useMemo(() => activeTiming ? buildSmartCompletionContext(target, activeTiming, manualMeals) : null, [target, activeTiming, manualMeals]);
  const filteredFoods = useMemo(() => {
    const query = foodSearch.trim().toLowerCase();
    return foods.filter((food) => !query || `${food.name} ${food.brand || ''} ${food.subcategory || ''} ${food.barcode || ''}`.toLowerCase().includes(query));
  }, [foods, foodSearch]);
  const manualPickerFoods = useMemo(() => {
    const query = manualPickerSearch.trim().toLowerCase();
    return foods.filter((food) => !query || `${food.name} ${food.brand || ''} ${food.barcode || ''}`.toLowerCase().includes(query)).slice(0, 40);
  }, [foods, manualPickerSearch]);

  useEffect(() => {
    void (async () => {
      try {
        await initLocalDatabase();
        const snapshot = await getLocalValue<NutritionAppSnapshot>('snapshot', EMPTY_SNAPSHOT);
        setCustomTimings(snapshot.customTimings || []);
        setCustomFoods(snapshot.customFoods || []);
        setFoodOverrides(snapshot.foodOverrides || {});
        setDeletedFoodIds(snapshot.deletedFoodIds || []);
        setSavedMenus(snapshot.savedMenus || []);
        setSavedManualMenus(snapshot.savedManualMenus || []);
        setManualMeals(snapshot.manualMeals || []);
        setTarget(snapshot.lastTarget || DEFAULT_TARGET);
        setActiveTimingId(snapshot.lastTimingId || 'omogeneo');
        setMenuMode(snapshot.lastMenuMode || 'automatic');
        setSelectedFoodIds(snapshot.selectedFoodIds || []);
      } catch (error) {
        setStatus(`Archivio locale: ${String(error)}`);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready || !activeTiming) return;
    setManualMeals((current) => syncMealsToTiming(activeTiming, current));
  }, [ready, activeTimingId, activeTiming?.id]);

  useEffect(() => { setCompletionPlan(null); }, [target, activeTimingId, selectedFoodIds]);

  useEffect(() => {
    if (!ready) return;
    const snapshot: NutritionAppSnapshot = {
      customTimings,
      customFoods,
      foodOverrides,
      deletedFoodIds,
      savedMenus,
      savedManualMenus,
      manualMeals,
      lastTarget: target,
      lastTimingId: activeTimingId,
      lastMenuMode: menuMode,
      selectedFoodIds,
    };
    void setLocalValue('snapshot', snapshot).catch((error) => setStatus(`Salvataggio locale: ${String(error)}`));
  }, [ready, customTimings, customFoods, foodOverrides, deletedFoodIds, savedMenus, savedManualMenus, manualMeals, target, activeTimingId, menuMode, selectedFoodIds]);

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
      setStatus(result.status === 'best_feasible' ? 'Generata la migliore soluzione possibile.' : 'Menu generato e validato.');
    } catch (error) {
      setStatus(`Generazione non riuscita: ${String(error)}`);
    }
  };

  const completeManualDay = (regenerate = false) => {
    if (!activeTiming || !completionContext) return;
    if (!completionNeeded(completionContext.residualTarget)) {
      setCompletionPlan(null);
      setStatus('Il target giornaliero e gia coperto: non ci sono macro da completare.');
      return;
    }
    try {
      const nextSeed = regenerate ? completionSeed + 1 : completionSeed;
      const result = generateNutritionMenu({
        target: completionContext.residualTarget,
        timing: completionContext.residualTiming,
        foods,
        selectedFoodIds: selectedFoodIds.length ? selectedFoodIds : undefined,
        attemptSeed: nextSeed,
        dayKind: activeTiming.dayKind === 'all' ? 'workout' : activeTiming.dayKind,
      });
      setCompletionSeed(nextSeed);
      setCompletionPlan(result);
      setStatus(result.status === 'best_feasible' ? 'Creato il miglior completamento possibile.' : 'Completamento automatico pronto.');
    } catch (error) {
      setStatus(`Completamento non riuscito: ${String(error)}`);
    }
  };

  const saveCurrentMenu = () => {
    if (!menu) return;
    setSavedMenus((current) => [menu, ...current.filter((entry) => entry.id !== menu.id)].slice(0, 100));
    setStatus('Menu automatico salvato sul dispositivo.');
  };

  const applySmartCompletion = () => {
    if (!completionPlan) return;
    setManualMeals((current) => applyCompletionPlan(current, completionPlan, foods));
    setCompletionPlan(null);
    setStatus('Completamento applicato alla giornata manuale.');
  };

  const regenerateSingleMeal = (mealIndex: number) => {
    if (!menu || !activeTiming) return;
    const sourceMeal = menu.meals[mealIndex];
    if (!sourceMeal) return;
    try {
      const singleTiming = buildSingleMealTiming(activeTiming, mealIndex);
      const nextSeed = attemptSeed + 1;
      const replacement = generateNutritionMenu({
        target: sourceMeal.target,
        timing: singleTiming,
        foods,
        selectedFoodIds: selectedFoodIds.length ? selectedFoodIds : undefined,
        attemptSeed: nextSeed,
        dayKind: activeTiming.dayKind === 'all' ? 'workout' : activeTiming.dayKind,
      });
      setAttemptSeed(nextSeed);
      setMenu(replaceGeneratedMeal(menu, mealIndex, replacement));
      setStatus(`Rigenerato solo il pasto: ${sourceMeal.name}. Gli altri pasti sono rimasti invariati.`);
    } catch (error) {
      setStatus(`Rigenerazione pasto non riuscita: ${String(error)}`);
    }
  };

  const saveManualDay = () => {
    if (!manualMeals.some((meal) => meal.items.length)) {
      setStatus('Aggiungi almeno un alimento prima di salvare la giornata.');
      return;
    }
    const actual = macrosForManualDay(manualMeals);
    const saved: SavedManualMenu = {
      id: `manual-menu-${Date.now()}`,
      createdAt: new Date().toISOString(),
      timingTemplateId: activeTimingId,
      target: { ...target },
      actual,
      targetKcal: kcalFromMacros(target),
      actualKcal: kcalFromMacros(actual),
      meals: structuredClone(manualMeals),
    };
    setSavedManualMenus((current) => [saved, ...current].slice(0, 100));
    setStatus('Giornata manuale salvata.');
  };

  const updateEditingMeal = (index: number, patch: Partial<TimingMeal>) => {
    setEditingTiming((current) => current ? { ...current, meals: current.meals.map((meal, mealIndex) => mealIndex === index ? { ...meal, ...patch } : meal), updatedAt: new Date().toISOString() } : current);
  };

  const resizeTiming = (count: number) => {
    setEditingTiming((current) => {
      if (!current) return current;
      const nextCount = Math.max(1, Math.min(6, count));
      const meals = [...current.meals];
      while (meals.length < nextCount) meals.push({ id: `meal-${Date.now()}-${meals.length}`, name: `Pasto ${meals.length + 1}`, carbsPercent: 0, proteinPercent: 0, fatPercent: 0, workoutTiming: 'none' });
      return { ...current, meals: meals.slice(0, nextCount), updatedAt: new Date().toISOString() };
    });
  };

  const distributeEqually = () => {
    setEditingTiming((current) => {
      if (!current || !current.meals.length) return current;
      const equal = 100 / current.meals.length;
      return { ...current, meals: current.meals.map((meal) => ({ ...meal, carbsPercent: equal, proteinPercent: equal, fatPercent: equal })), updatedAt: new Date().toISOString() };
    });
  };

  const saveTiming = () => {
    if (!editingTiming) return;
    const validation = validateTimingTemplate(editingTiming);
    if (!validation.valid) {
      setStatus('Timing non valido: C, P e F devono totalizzare 100%.');
      return;
    }
    setCustomTimings((current) => [editingTiming, ...current.filter((timing) => timing.id !== editingTiming.id)]);
    setActiveTimingId(editingTiming.id);
    setEditingTiming(null);
    setStatus('Timing salvato localmente.');
  };

  const addManualFood = () => {
    if (!manualFood.name.trim()) {
      setStatus('Inserisci il nome dell alimento.');
      return;
    }
    const food: LocalFood = {
      id: `food-${Date.now()}`,
      name: manualFood.name.trim(),
      barcode: manualFood.barcode.trim() || undefined,
      carbs: manualFood.carbs,
      protein: manualFood.protein,
      fat: manualFood.fat,
      category: classifyFood(manualFood.carbs, manualFood.protein, manualFood.fat),
      suitable: ['breakfast', 'snack', 'lunch', 'dinner', 'prenanna'],
      source: manualFood.barcode ? 'barcode' : 'manual',
    };
    setCustomFoods((current) => [food, ...current]);
    setManualFood({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });
    setShowNewFood(false);
    setEditingFood(structuredClone(food));
    setStatus('Alimento aggiunto al database locale.');
  };

  const saveEditingFood = () => {
    if (!editingFood || !editingFood.name.trim()) return;
    const normalized: LocalFood = {
      ...editingFood,
      name: editingFood.name.trim(),
      brand: editingFood.brand?.trim() || undefined,
      barcode: editingFood.barcode?.trim() || undefined,
      carbs: safeNumber(editingFood.carbs),
      protein: safeNumber(editingFood.protein),
      fat: safeNumber(editingFood.fat),
      fiber: editingFood.fiber == null ? undefined : safeNumber(editingFood.fiber),
      grammiMin: editingFood.grammiMin == null ? undefined : safeNumber(editingFood.grammiMin),
      grammiMax: editingFood.grammiMax == null ? undefined : safeNumber(editingFood.grammiMax),
    };
    const isBuilder = BUILDER_FOODS.some((food) => food.id === normalized.id);
    if (isBuilder) {
      setFoodOverrides((current) => ({ ...current, [normalized.id]: normalized }));
      setDeletedFoodIds((current) => current.filter((id) => id !== normalized.id));
    } else {
      setCustomFoods((current) => [normalized, ...current.filter((food) => food.id !== normalized.id)]);
    }
    setEditingFood(null);
    setStatus(`Alimento aggiornato: ${normalized.name}`);
  };

  const deleteEditingFood = () => {
    if (!editingFood) return;
    const id = editingFood.id;
    const isBuilder = BUILDER_FOODS.some((food) => food.id === id);
    if (isBuilder) {
      setDeletedFoodIds((current) => current.includes(id) ? current : [...current, id]);
      setFoodOverrides((current) => { const next = { ...current }; delete next[id]; return next; });
    } else {
      setCustomFoods((current) => current.filter((food) => food.id !== id));
    }
    setSelectedFoodIds((current) => current.filter((foodId) => foodId !== id));
    setEditingFood(null);
    setStatus('Alimento eliminato dal database locale.');
  };

  const scanBarcode = async () => {
    try {
      setStatus('Apertura scanner...');
      const barcode = await scanProductBarcode();
      const localFood = foods.find((food) => food.barcode === barcode);
      if (localFood) {
        setFoodSearch(localFood.name);
        setEditingFood(structuredClone(localFood));
        setStatus(`Trovato nel database locale: ${localFood.name}`);
        return;
      }
      setStatus(`Barcode ${barcode} letto. Ricerca su Open Food Facts...`);
      try {
        const externalFood = await lookupOpenFoodFacts(barcode);
        if (externalFood) {
          setCustomFoods((current) => [externalFood, ...current.filter((food) => food.barcode !== barcode)]);
          setFoodSearch(externalFood.name);
          setEditingFood(structuredClone(externalFood));
          setManualFood({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });
          setStatus(`Trovato online: ${externalFood.name}${externalFood.brand ? ` - ${externalFood.brand}` : ''}. Valori caricati nella scheda.`);
          return;
        }
        setManualFood((current) => ({ ...current, barcode }));
        setShowNewFood(true);
        setStatus(`Barcode ${barcode} non trovato online. Puoi inserirlo manualmente.`);
      } catch (lookupError) {
        setManualFood((current) => ({ ...current, barcode }));
        setShowNewFood(true);
        const lookupText = String(lookupError);
        setStatus(lookupText.includes('OPEN_FOOD_FACTS_TIMEOUT') || lookupText.includes('Failed to fetch') ? `Barcode ${barcode} letto, ma la ricerca online non e disponibile.` : `Open Food Facts: ${lookupText}`);
      }
    } catch (error) {
      const text = String(error);
      setStatus(text.includes('SCANNER_MODULE_INSTALLING') ? 'Modulo scanner Android in installazione. Riprova tra poco.' : `Scanner: ${text}`);
    }
  };

  const addFoodToManualMeal = (mealId: string, food: LocalFood) => {
    setCompletionPlan(null);
    const grams = Math.max(1, food.grammiMin || 100);
    setManualMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, items: [...meal.items, { id: `manual-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, food: structuredClone(food), grams }] } : meal));
    setManualPickerMealId(null);
    setManualPickerSearch('');
  };

  const updateManualItemGrams = (mealId: string, itemId: string, grams: number) => {
    setCompletionPlan(null);
    setManualMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, items: meal.items.map((item) => item.id === itemId ? { ...item, grams: safeNumber(grams) } : item) } : meal));
  };

  const removeManualItem = (mealId: string, itemId: string) => {
    setCompletionPlan(null);
    setManualMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) } : meal));
  };

  const clearManualDay = () => {
    setCompletionPlan(null);
    setManualMeals((current) => current.map((meal) => ({ ...meal, items: [] })));
    setStatus('Giornata manuale azzerata.');
  };

  if (!ready) return <main className="app-shell"><p>Inizializzazione archivio locale...</p></main>;

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">BUILDER NUTRITION</p>
          <h1>Nutrition Engine V2</h1>
          <p className="muted">Macro, timing, alimenti e menu sul dispositivo. Nessun login.</p>
        </div>
        <div className="kcal-badge">{kcal.toFixed(0)}<small>kcal</small></div>
      </header>

      {status && <div className="status" role="status">{status}</div>}

      {tab === 'menu' && <>
        <div className="mode-switch">
          <button className={menuMode === 'automatic' ? 'active' : ''} onClick={() => setMenuMode('automatic')}>Composizione automatica</button>
          <button className={menuMode === 'manual' ? 'active' : ''} onClick={() => setMenuMode('manual')}>Composizione manuale</button>
        </div>

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
          <button className="selector-card" onClick={() => setShowTimingSelect(true)}>
            <span><small>Timing attivo</small><strong>{activeTiming.name}</strong><em>{activeTiming.meals.length} pasti</em></span><b>›</b>
          </button>
          <div className="meal-targets">
            {mealTargets.map((meal, index) => <div className="target-chip" key={`${activeTimingId}-${index}`}><strong>{meal.name}</strong><span>{meal.carbs.toFixed(0)}C · {meal.protein.toFixed(0)}P · {meal.fat.toFixed(0)}F</span></div>)}
          </div>
        </section>

        <SmartDayCard
          target={target}
          consumed={manualActual}
          residual={completionContext?.residualTarget || target}
          hasEntries={hasManualEntries}
          onComplete={() => completeManualDay(false)}
          onOpenDiary={() => setMenuMode('manual')}
        />
        <CompletionPlanCard
          plan={completionPlan}
          onApply={applySmartCompletion}
          onRegenerate={() => completeManualDay(true)}
          onDiscard={() => setCompletionPlan(null)}
        />

        {menuMode === 'automatic' && <>
          <section className="card">
            <div className="row-between"><h2>Pool alimenti</h2><button className="ghost" onClick={() => { setFoodSearch(''); setShowPoolSearch(true); }}>Scegli</button></div>
            <p className="muted">{selectedFoodIds.length ? `${selectedFoodIds.length} alimenti selezionati: il motore usera solo questi.` : `Pool completo: ${foods.length} alimenti disponibili.`}</p>
            {selectedFoodIds.length > 0 && <button className="text-button" onClick={() => setSelectedFoodIds([])}>Usa tutto il database</button>}
          </section>
          <div className="actions"><button className="primary" onClick={() => generate(false)}>Genera menu</button><button className="secondary" onClick={() => generate(true)} disabled={!menu}>Rigenera</button></div>
          {menu && <section className="card result-card">
            <div className="row-between"><div><p className="eyebrow red">{menu.status.toUpperCase()}</p><h2>Menu generato</h2></div><div className="button-group"><button className="secondary" onClick={saveCurrentMenu}>Salva</button><button className="danger" onClick={() => { setMenu(null); setStatus('Menu corrente eliminato.'); }}>Elimina</button></div></div>
            <div className="result-summary"><span>Target {menu.target.carbs.toFixed(1)}C / {menu.target.protein.toFixed(1)}P / {menu.target.fat.toFixed(1)}F</span><span>Reale {menu.actual.carbs.toFixed(1)}C / {menu.actual.protein.toFixed(1)}P / {menu.actual.fat.toFixed(1)}F</span><span>Tolleranza {menu.tolerancePercent}%</span></div>
            {menu.meals.map((meal, index) => <article className="generated-meal" key={`${menu.id}-${index}`}>
              <div className="row-between generated-meal-head"><div className="generated-meal-title"><strong>{meal.name}</strong><span className={meal.withinTolerance ? 'ok' : 'warn'}>{meal.workoutTiming !== 'none' ? meal.workoutTiming.toUpperCase() : ''}</span></div><button className="meal-regen-button" onClick={() => regenerateSingleMeal(index)}>Rigenera pasto</button></div>
              <small>Target {meal.target.carbs.toFixed(1)}C · {meal.target.protein.toFixed(1)}P · {meal.target.fat.toFixed(1)}F</small>
              {meal.foods.map((portion) => <button className="food-line food-link" key={`${meal.name}-${portion.foodId}`} onClick={() => { const food = foods.find((item) => item.id === portion.foodId); if (food) setEditingFood(structuredClone(food)); }}><span>{portion.name}</span><strong>{portion.grams} g</strong></button>)}
              <small>Reale {meal.actual.carbs.toFixed(1)}C · {meal.actual.protein.toFixed(1)}P · {meal.actual.fat.toFixed(1)}F</small>
            </article>)}
          </section>}
        </>}

        {menuMode === 'manual' && <>
          <section className="card manual-summary">
            <div className="row-between"><h2>Giornata manuale</h2><span className="live-badge">LIVE</span></div>
            <div className="macro-progress-grid">
              <div><small>Carboidrati</small><strong>{manualActual.carbs.toFixed(1)} / {target.carbs.toFixed(0)} g</strong></div>
              <div><small>Proteine</small><strong>{manualActual.protein.toFixed(1)} / {target.protein.toFixed(0)} g</strong></div>
              <div><small>Grassi</small><strong>{manualActual.fat.toFixed(1)} / {target.fat.toFixed(0)} g</strong></div>
              <div><small>Calorie</small><strong>{kcalFromMacros(manualActual).toFixed(0)} / {kcal.toFixed(0)}</strong></div>
            </div>
            <div className="button-group manual-actions"><button className="secondary" onClick={saveManualDay}>Salva giornata</button><button className="danger" onClick={clearManualDay}>Azzera</button></div>
          </section>

          {manualMeals.map((meal, mealIndex) => {
            const actual = macrosForManualMeal(meal);
            const mealTarget = mealTargets[mealIndex];
            return <section className="card manual-meal" key={meal.id}>
              <div className="row-between"><div><h2>{meal.name}</h2>{mealTarget && <small className="meal-subtitle">Target {mealTarget.carbs.toFixed(0)}C · {mealTarget.protein.toFixed(0)}P · {mealTarget.fat.toFixed(0)}F</small>}</div><button className="add-food-button" onClick={() => { setManualPickerMealId(meal.id); setManualPickerSearch(''); }}>+ Alimento</button></div>
              {!meal.items.length && <p className="empty-meal">Nessun alimento inserito.</p>}
              {meal.items.map((item) => {
                const itemMacros = macrosForManualItem(item);
                return <div className="manual-item" key={item.id}>
                  <button className="manual-food-name" onClick={() => setEditingFood(structuredClone(item.food))}><strong>{item.food.name}</strong><small>{itemMacros.carbs.toFixed(1)}C · {itemMacros.protein.toFixed(1)}P · {itemMacros.fat.toFixed(1)}F</small></button>
                  <label className="grams-field"><input type="number" min="0" value={item.grams} onChange={(e) => updateManualItemGrams(meal.id, item.id, safeNumber(e.target.value))} /><span>g</span></label>
                  <button className="icon-danger" aria-label="Rimuovi alimento" onClick={() => removeManualItem(meal.id, item.id)}>×</button>
                </div>;
              })}
              <div className="meal-total">Reale {actual.carbs.toFixed(1)}C · {actual.protein.toFixed(1)}P · {actual.fat.toFixed(1)}F</div>
            </section>;
          })}
        </>}
      </>}

      {tab === 'timing' && <>
        <section className="card">
          <div className="row-between"><h2>Gestione timing</h2><button className="primary small" onClick={() => setEditingTiming(createEmptyTiming('Nuovo timing', 5))}>Nuovo</button></div>
          <p className="muted">I timing Builder sono preinstallati. Duplicali per modificarli oppure creane uno da zero.</p>
          <div className="timing-list">{timings.map((timing) => <div className="list-row" key={timing.id}><button className="list-main" onClick={() => setActiveTimingId(timing.id)}><strong>{timing.name}</strong><span>{timing.meals.length} pasti · {timing.dayKind}</span></button><button className="secondary" onClick={() => setEditingTiming(timing.builtIn ? cloneTimingForEdit(timing) : structuredClone(timing))}>{timing.builtIn ? 'Duplica' : 'Modifica'}</button>{!timing.builtIn && <button className="danger" onClick={() => setCustomTimings((current) => current.filter((item) => item.id !== timing.id))}>Elimina</button>}</div>)}</div>
        </section>
      </>}

      {tab === 'foods' && <>
        <section className="card">
          <div className="row-between foods-heading"><div><p className="eyebrow red">LIBRERIA</p><h2>Database alimenti</h2></div><div className="button-group"><button className="secondary" onClick={() => { setFoodSearch(''); setShowFoodSearch(true); }}>Cerca</button><button className="secondary" onClick={() => setShowNewFood(true)}>+ Nuovo</button><button className="primary" onClick={() => void scanBarcode()}>Scansiona</button></div></div>
          <p className="muted">Tocca Cerca per trovare rapidamente un alimento. Tocca una voce per aprire la scheda.</p>
          <div className="food-list browse-food-list">{foods.slice(0, 100).map((food) => <button className="food-browser-row" key={food.id} onClick={() => setEditingFood(structuredClone(food))}><span className="food-avatar small">{food.name.slice(0,1).toUpperCase()}</span><span><strong>{food.name}</strong><small>{foodMacros(food)} · {food.source}{food.brand ? ` · ${food.brand}` : ''}</small></span><b>›</b></button>)}</div>
        </section>

      </>}

      {tab === 'saved' && <section className="card">
        <div className="row-between"><h2>Menu salvati</h2><span className="saved-count">{savedMenus.length + savedManualMenus.length}</span></div>
        {!savedMenus.length && !savedManualMenus.length && <p className="muted">Nessun menu salvato.</p>}
        {!!savedMenus.length && <><h3 className="section-label">AUTOMATICI</h3>{savedMenus.map((saved) => <div className="saved-row" key={saved.id}><button className="list-main" onClick={() => { setMenu(saved); setActiveTimingId(saved.timingTemplateId); setMenuMode('automatic'); setTab('menu'); }}><strong>{new Date(saved.createdAt).toLocaleString()}</strong><span>{saved.status} · {saved.targetKcal.toFixed(0)} kcal</span></button><button className="danger" onClick={() => setSavedMenus((current) => current.filter((entry) => entry.id !== saved.id))}>Elimina</button></div>)}</>}
        {!!savedManualMenus.length && <><h3 className="section-label">MANUALI</h3>{savedManualMenus.map((saved) => <div className="saved-row" key={saved.id}><button className="list-main" onClick={() => { setTarget(saved.target); setManualMeals(structuredClone(saved.meals)); setActiveTimingId(saved.timingTemplateId); setMenuMode('manual'); setTab('menu'); }}><strong>{new Date(saved.createdAt).toLocaleString()}</strong><span>manuale · {saved.actualKcal.toFixed(0)} / {saved.targetKcal.toFixed(0)} kcal</span></button><button className="danger" onClick={() => setSavedManualMenus((current) => current.filter((entry) => entry.id !== saved.id))}>Elimina</button></div>)}</>}
      </section>}

      <FoodEditorModal
        food={editingFood}
        onChange={setEditingFood}
        onClose={() => setEditingFood(null)}
        onSave={saveEditingFood}
        onDelete={deleteEditingFood}
      />
      <TimingEditorModal
        timing={editingTiming}
        onChange={setEditingTiming}
        onClose={() => setEditingTiming(null)}
        onSave={saveTiming}
        onResize={resizeTiming}
        onDistribute={distributeEqually}
        onUpdateMeal={updateEditingMeal}
      />
      <TimingSelectModal open={showTimingSelect} timings={timings} activeId={activeTimingId} onClose={() => setShowTimingSelect(false)} onSelect={setActiveTimingId} />
      <FoodLibrarySearchModal open={showFoodSearch} title="Cerca alimenti" eyebrow="DATABASE ALIMENTI" foods={filteredFoods.slice(0,160)} query={foodSearch} onQueryChange={setFoodSearch} onClose={() => setShowFoodSearch(false)} onOpenFood={(food) => { setShowFoodSearch(false); setEditingFood(structuredClone(food)); }} />
      <FoodLibrarySearchModal open={showPoolSearch} title="Seleziona alimenti" eyebrow="POOL AUTOMATICO" foods={filteredFoods.slice(0,160)} query={foodSearch} onQueryChange={setFoodSearch} onClose={() => setShowPoolSearch(false)} onOpenFood={(food) => { setShowPoolSearch(false); setEditingFood(structuredClone(food)); }} selectedIds={selectedFoodIds} onToggleSelected={(id) => setSelectedFoodIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
      <FoodPickerModal
        open={!!manualPickerMealId}
        foods={manualPickerFoods}
        query={manualPickerSearch}
        onQueryChange={setManualPickerSearch}
        onClose={() => setManualPickerMealId(null)}
        onSelect={(food) => {
          if (manualPickerMealId) addFoodToManualMeal(manualPickerMealId, food);
        }}
      />
      <NewFoodModal
        open={showNewFood}
        value={manualFood}
        onChange={setManualFood}
        onClose={() => setShowNewFood(false)}
        onSave={addManualFood}
      />
      <BottomNav active={tab} onChange={setTab} />

    </main>
  );
}
