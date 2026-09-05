import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { DiaryDateBar } from '@/components/DiaryDateBar';
import { DateActionModal } from '@/components/DateActionModal';
import { SmartDayCard } from '@/components/SmartDayCard';
import { CompletionPlanCard } from '@/components/CompletionPlanCard';
import { TodaySummaryCard } from '@/components/TodaySummaryCard';
import { SetupGuideCard } from '@/components/SetupGuideCard';
import { FoodReplacementModal } from '@/components/FoodReplacementModal';
import { RecipeEditorModal } from '@/components/RecipeEditorModal';
import { SavedMealModal } from '@/components/SavedMealModal';
import { ChoicePopup } from '@/components/ChoicePopup';
import { WeeklyPlannerPanel } from '@/components/WeeklyPlannerPanel';
import { ProgressPanel } from '@/components/ProgressPanel';
import { ProfilePanel } from '@/components/ProfilePanel';
import { FoodEditorModal } from '@/components/FoodEditorModal';
import { FoodPickerModal } from '@/components/FoodPickerModal';
import { FoodLibrarySearchModal } from '@/components/FoodLibrarySearchModal';
import { TimingSelectModal } from '@/components/TimingSelectModal';
import { NewFoodModal } from '@/components/NewFoodModal';
import { TimingEditorModal } from '@/components/TimingEditorModal';
import { BUILDER_FOODS } from '@/data/builderFoods';
import { BUILT_IN_TIMINGS, DEFAULT_BUILT_IN_TIMING_ID, migrateBuiltInTimingId } from '@/data/builtInTimings';
import { calculateMealTargets, createEmptyTiming, timingTotals, validateTimingTemplate } from '@/domain/timing';
import { kcalFromMacros, macrosForManualDay, macrosForManualItem, macrosForManualMeal } from '@/domain/manualMenu';
import { applyCompletionPlan, buildSingleMealTiming, buildSmartCompletionContext, completionNeeded, replaceGeneratedMeal } from '@/domain/smartCompletion';
import { buildLockedRegenerationContext, mergeUnlockedRegeneration, replaceFoodSmart, suggestEquivalentFoods, toggleMealLock, type FoodReplacementSuggestion } from '@/domain/smartEditing';
import { buildCurrentDiaryDay, copyDiaryDay, copyMealIntoDay, emptyMealsForTiming, localDateKey, makeDiaryDay, shiftDateKey } from '@/domain/diary';
import { appendSavedMeal, createEmptyRecipe, createSavedMealTemplate, recipeToLocalFood, validateRecipe } from '@/domain/recipes';
import { generatedMenuToManualMeals } from '@/domain/weeklyPlanner';
import { defaultQuantityMode, gramsFromQuantity, manualItemQuantity, modeLabel, quantityOptions, setManualItemQuantity, switchManualItemMode } from '@/domain/smartPortions';
import { generateNutritionMenu } from '@/engine/nutritionEngine';
import { scanProductBarcode } from '@/services/barcodeService';
import { lookupOpenFoodFacts } from '@/services/openFoodFactsService';
import { getLocalValue, initLocalDatabase, setLocalValue } from '@/storage/localDatabase';
import type {
  DiaryDay,
  FoodCategory,
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  ManualMeal,
  NutritionAppSnapshot,
  Recipe,
  SavedManualMenu,
  SavedMealTemplate,
  TimingMeal,
  TimingTemplate,
  WeeklyPlanResult,
} from '@/types/nutrition';

type Tab = 'menu' | 'week' | 'progress' | 'profile' | 'timing' | 'foods' | 'saved';
type MenuMode = 'automatic' | 'manual';
type DateModalMode = 'navigate' | 'copy-day' | 'copy-meal';
type SetupProgress = { target: boolean; timing: boolean; generated: boolean };

const SETUP_KEY = 'nutrition-setup-v1';
const EMPTY_SETUP: SetupProgress = { target: false, timing: false, generated: false };

const DEFAULT_TARGET: MacroTarget = { carbs: 0, protein: 0, fat: 0 };
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
  const [menuMode, setMenuMode] = useState<MenuMode>('manual');
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<MacroTarget>(DEFAULT_TARGET);
  const [setupProgress, setSetupProgress] = useState<SetupProgress>(EMPTY_SETUP);
  const [customTimings, setCustomTimings] = useState<TimingTemplate[]>([]);
  const [customFoods, setCustomFoods] = useState<LocalFood[]>([]);
  const [foodOverrides, setFoodOverrides] = useState<Record<string, LocalFood>>({});
  const [deletedFoodIds, setDeletedFoodIds] = useState<string[]>([]);
  const [savedMenus, setSavedMenus] = useState<GeneratedMenu[]>([]);
  const [savedManualMenus, setSavedManualMenus] = useState<SavedManualMenu[]>([]);
  const [manualMeals, setManualMeals] = useState<ManualMeal[]>([]);
  const [diaryDays, setDiaryDays] = useState<Record<string, DiaryDay>>({});
  const [activeDiaryDate, setActiveDiaryDate] = useState(localDateKey());
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [favoriteFoodIds, setFavoriteFoodIds] = useState<string[]>([]);
  const [recentFoodIds, setRecentFoodIds] = useState<string[]>([]);
  const [savedMealTemplates, setSavedMealTemplates] = useState<SavedMealTemplate[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeTimingId, setActiveTimingId] = useState(DEFAULT_BUILT_IN_TIMING_ID);
  const [menu, setMenu] = useState<GeneratedMenu | null>(null);
  const [completionPlan, setCompletionPlan] = useState<GeneratedMenu | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);
  const [completionSeed, setCompletionSeed] = useState(0);
  const [status, setStatus] = useState('');
  const [foodSearch, setFoodSearch] = useState('');
  const [editingTiming, setEditingTiming] = useState<TimingTemplate | null>(null);
  const [editingFood, setEditingFood] = useState<LocalFood | null>(null);
  const [replacementContext, setReplacementContext] = useState<{ mealIndex: number; foodIndex: number } | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [recipePickerSearch, setRecipePickerSearch] = useState('');
  const [savedMealMode, setSavedMealMode] = useState<'save' | 'pick' | null>(null);
  const [savedMealSourceIndex, setSavedMealSourceIndex] = useState<number | null>(null);
  const [savedMealTargetMealId, setSavedMealTargetMealId] = useState<string | null>(null);
  const [quantityPickerContext, setQuantityPickerContext] = useState<{ mealId: string; itemId: string } | null>(null);
  const [manualPickerMealId, setManualPickerMealId] = useState<string | null>(null);
  const [manualPickerSearch, setManualPickerSearch] = useState('');
  const [showNewFood, setShowNewFood] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showPoolSearch, setShowPoolSearch] = useState(false);
  const [showTimingSelect, setShowTimingSelect] = useState(false);
  const [dateModalMode, setDateModalMode] = useState<DateModalMode | null>(null);
  const [copyMealIndex, setCopyMealIndex] = useState<number | null>(null);
  const [manualFood, setManualFood] = useState({ name: '', barcode: '', carbs: 0, protein: 0, fat: 0 });

  const timings = useMemo(() => [...BUILT_IN_TIMINGS, ...customTimings], [customTimings]);
  const foods = useMemo(() => {
    const base = BUILDER_FOODS.map((food) => foodOverrides[food.id] || food).filter((food) => !deletedFoodIds.includes(food.id));
    const custom = customFoods.filter((food) => !deletedFoodIds.includes(food.id));
    const recipeFoods = recipes.map(recipeToLocalFood).filter((food) => !deletedFoodIds.includes(food.id));
    return [...base, ...custom, ...recipeFoods];
  }, [customFoods, foodOverrides, deletedFoodIds, recipes]);
  const activeTiming = timings.find((timing) => timing.id === activeTimingId) || timings[0];
  const kcal = kcalFromMacros(target);
  const mealTargets = activeTiming ? calculateMealTargets(target, activeTiming) : [];
  const manualActual = useMemo(() => macrosForManualDay(manualMeals), [manualMeals]);
  const hasManualEntries = useMemo(() => manualMeals.some((meal) => meal.items.length > 0), [manualMeals]);
  const completionContext = useMemo(() => activeTiming ? buildSmartCompletionContext(target, activeTiming, manualMeals) : null, [target, activeTiming, manualMeals]);
  const replacementOriginal = useMemo(() => replacementContext && menu ? menu.meals[replacementContext.mealIndex]?.foods[replacementContext.foodIndex] || null : null, [replacementContext, menu]);
  const replacementSuggestions = useMemo(() => {
    if (!replacementOriginal) return [];
    const originalFood = foods.find((food) => food.id === replacementOriginal.foodId);
    const pool = selectedFoodIds.length ? foods.filter((food) => selectedFoodIds.includes(food.id)) : foods;
    return suggestEquivalentFoods(replacementOriginal, originalFood, pool, 16);
  }, [replacementOriginal, foods, selectedFoodIds]);
  const filteredFoods = useMemo(() => {
    const query = foodSearch.trim().toLowerCase();
    return foods.filter((food) => !query || `${food.name} ${food.brand || ''} ${food.subcategory || ''} ${food.barcode || ''}`.toLowerCase().includes(query));
  }, [foods, foodSearch]);
  const recipePickerFoods = useMemo(() => {
    const query = recipePickerSearch.trim().toLowerCase();
    return foods.filter((food) => food.source !== 'recipe' && (!query || `${food.name} ${food.brand || ''} ${food.barcode || ''}`.toLowerCase().includes(query))).slice(0, 80);
  }, [foods, recipePickerSearch]);
  const quantityPickerItem = useMemo(() => {
    if (!quantityPickerContext) return null;
    return manualMeals.find((meal) => meal.id === quantityPickerContext.mealId)?.items.find((item) => item.id === quantityPickerContext.itemId) || null;
  }, [manualMeals, quantityPickerContext]);

  const manualPickerFoods = useMemo(() => {
    const query = manualPickerSearch.trim().toLowerCase();
    const filtered = foods.filter((food) => !query || `${food.name} ${food.brand || ''} ${food.barcode || ''}`.toLowerCase().includes(query));
    if (query) return filtered.slice(0, 60);
    const favoriteRank = new Map(favoriteFoodIds.map((id, index) => [id, index]));
    const recentRank = new Map(recentFoodIds.map((id, index) => [id, index]));
    return [...filtered].sort((a, b) => {
      const af = favoriteRank.has(a.id) ? favoriteRank.get(a.id)! : 9999;
      const bf = favoriteRank.has(b.id) ? favoriteRank.get(b.id)! : 9999;
      if (af !== bf) return af - bf;
      const ar = recentRank.has(a.id) ? recentRank.get(a.id)! : 9999;
      const br = recentRank.has(b.id) ? recentRank.get(b.id)! : 9999;
      return ar !== br ? ar - br : a.name.localeCompare(b.name);
    }).slice(0, 60);
  }, [foods, manualPickerSearch, favoriteFoodIds, recentFoodIds]);

  useEffect(() => {
    void (async () => {
      try {
        await initLocalDatabase();
        const snapshot = await getLocalValue<NutritionAppSnapshot>('snapshot', EMPTY_SNAPSHOT);
        const storedSetup = await getLocalValue<SetupProgress | null>(SETUP_KEY, null);
        setCustomTimings(snapshot.customTimings || []);
        setCustomFoods(snapshot.customFoods || []);
        setFoodOverrides(snapshot.foodOverrides || {});
        setDeletedFoodIds(snapshot.deletedFoodIds || []);

        setSavedMealTemplates(snapshot.savedMealTemplates || []);
        setRecipes(snapshot.recipes || []);
        const today = localDateKey();
        const knownTimingIds = new Set([...BUILT_IN_TIMINGS.map((item) => item.id), ...(snapshot.customTimings || []).map((item) => item.id)]);
        const migrateTimingId = (id?: string) => { const migrated = migrateBuiltInTimingId(id); return knownTimingIds.has(migrated) ? migrated : DEFAULT_BUILT_IN_TIMING_ID; };
        const existingDays = Object.fromEntries(Object.entries(snapshot.diaryDays || {}).map(([date, day]) => [date, { ...day, timingTemplateId: migrateTimingId(day.timingTemplateId), generatedMenu: day.generatedMenu ? { ...day.generatedMenu, timingTemplateId: migrateTimingId(day.generatedMenu.timingTemplateId) } : day.generatedMenu }]));
        const migratedSavedMenus = (snapshot.savedMenus || []).map((saved) => ({ ...saved, timingTemplateId: migrateTimingId(saved.timingTemplateId) }));
        const migratedManualMenus = (snapshot.savedManualMenus || []).map((saved) => ({ ...saved, timingTemplateId: migrateTimingId(saved.timingTemplateId) }));
        setSavedMenus(migratedSavedMenus);
        setSavedManualMenus(migratedManualMenus);
        const hasGeneratedBefore = Object.values(existingDays).some((day) => !!day.generatedMenu) || !!migratedSavedMenus.length;
        setSetupProgress(storedSetup || (hasGeneratedBefore ? { target: true, timing: true, generated: true } : EMPTY_SETUP));
        const legacyMeals = snapshot.manualMeals || [];
        const initialTarget = snapshot.lastTarget || DEFAULT_TARGET;
        const initialTimingId = migrateTimingId(snapshot.lastTimingId);
        const initialDay = existingDays[today] || makeDiaryDay(today, initialTarget, initialTimingId, legacyMeals, null);
        setDiaryDays({ ...existingDays, [today]: initialDay });
        setActiveDiaryDate(today);
        setManualMeals(structuredClone(initialDay.meals));
        setTarget({ ...initialDay.target });
        setActiveTimingId(initialDay.timingTemplateId || initialTimingId);
        setMenu(initialDay.generatedMenu ? structuredClone(initialDay.generatedMenu) : null);
        setMenuMode('manual');
        setSelectedFoodIds(snapshot.selectedFoodIds || []);
        setFavoriteFoodIds(snapshot.favoriteFoodIds || []);
        setRecentFoodIds(snapshot.recentFoodIds || []);
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
    void setLocalValue(SETUP_KEY, setupProgress);
  }, [ready, setupProgress]);

  useEffect(() => {
    if (!ready) return;
    const currentDay = buildCurrentDiaryDay(activeDiaryDate, target, activeTimingId, manualMeals, menu);
    const persistedDays = { ...diaryDays, [activeDiaryDate]: currentDay };
    const snapshot: NutritionAppSnapshot = {
      customTimings, customFoods, foodOverrides, deletedFoodIds, savedMenus, savedManualMenus,
      manualMeals, lastTarget: target, lastTimingId: activeTimingId, lastMenuMode: menuMode, selectedFoodIds,
      diaryDays: persistedDays, activeDiaryDate, favoriteFoodIds, recentFoodIds, savedMealTemplates, recipes,
    };
    void setLocalValue('snapshot', snapshot).catch((error) => setStatus(`Salvataggio locale: ${String(error)}`));
  }, [ready, customTimings, customFoods, foodOverrides, deletedFoodIds, savedMenus, savedManualMenus, manualMeals, target, activeTimingId, menuMode, selectedFoodIds, diaryDays, activeDiaryDate, menu, favoriteFoodIds, recentFoodIds, savedMealTemplates, recipes]);

  const currentDiarySnapshot = () =>
    buildCurrentDiaryDay(activeDiaryDate, target, activeTimingId, manualMeals, menu);

  const openDiaryDate = (nextDate: string) => {
    if (!nextDate || nextDate === activeDiaryDate) { setDateModalMode(null); return; }
    const currentDay = currentDiarySnapshot();
    const nextDays = { ...diaryDays, [activeDiaryDate]: currentDay };
    let destination = nextDays[nextDate];
    if (!destination) {
      const timing = timings.find((item) => item.id === activeTimingId) || activeTiming;
      destination = makeDiaryDay(nextDate, target, activeTimingId, timing ? emptyMealsForTiming(timing) : [], null);
      nextDays[nextDate] = destination;
    }
    const nextTimingId = timings.some((item) => item.id === destination.timingTemplateId) ? destination.timingTemplateId : DEFAULT_BUILT_IN_TIMING_ID;
    setDiaryDays(nextDays);
    setActiveDiaryDate(nextDate);
    setTarget({ ...destination.target });
    setActiveTimingId(nextTimingId);
    setManualMeals(structuredClone(destination.meals));
    setMenu(destination.generatedMenu ? structuredClone(destination.generatedMenu) : null);
    setCompletionPlan(null);
    setAttemptSeed(0);
    setDateModalMode(null);
    setStatus(`Diario aperto: ${nextDate}.`);
  };

  const copyActiveDayTo = (destinationDate: string) => {
    if (!destinationDate || destinationDate === activeDiaryDate) {
      setStatus('Scegli una data diversa per copiare la giornata.');
      setDateModalMode(null);
      return;
    }
    const source = currentDiarySnapshot();
    const copied = copyDiaryDay(source, destinationDate);
    setDiaryDays((current) => ({ ...current, [activeDiaryDate]: source, [destinationDate]: copied }));
    setDateModalMode(null);
    setStatus(`Giornata copiata su ${destinationDate}.`);
  };

  const copyActiveMealTo = (destinationDate: string) => {
    if (copyMealIndex == null || !manualMeals[copyMealIndex]) return;
    const sourceDay = currentDiarySnapshot();
    const timing = timings.find((item) => item.id === activeTimingId) || activeTiming;
    const base = destinationDate === activeDiaryDate
      ? sourceDay
      : diaryDays[destinationDate] || makeDiaryDay(destinationDate, target, activeTimingId, timing ? emptyMealsForTiming(timing) : [], null);
    const copied = copyMealIntoDay(base, manualMeals[copyMealIndex], copyMealIndex);
    setDiaryDays((current) => ({ ...current, [activeDiaryDate]: sourceDay, [destinationDate]: copied }));
    if (destinationDate === activeDiaryDate) setManualMeals(structuredClone(copied.meals));
    setCopyMealIndex(null);
    setDateModalMode(null);
    setStatus(`Pasto copiato su ${destinationDate}.`);
  };

  const handleDateAction = (date: string) => {
    if (dateModalMode === 'navigate') openDiaryDate(date);
    else if (dateModalMode === 'copy-day') copyActiveDayTo(date);
    else if (dateModalMode === 'copy-meal') copyActiveMealTo(date);
  };

  const changeStartingMacro = (key: keyof MacroTarget, value: string | number) => {
    setTarget((current) => ({ ...current, [key]: safeNumber(value) }));
    setSetupProgress((current) => ({ ...current, target: false, generated: false }));
  };

  const confirmStartingTarget = () => {
    if (kcalFromMacros(target) <= 0 || target.protein <= 0 || target.fat <= 0) {
      setStatus('Inserisci un target valido: proteine e grassi devono essere maggiori di zero.');
      return;
    }
    setSetupProgress((current) => ({ ...current, target: true, generated: false }));
    setStatus('Macro di partenza confermati. Ora scegli il Timing.');
  };

  const chooseTiming = (id: string) => {
    setActiveTimingId(id);
    setSetupProgress((current) => ({ ...current, timing: true, generated: false }));
  };

  const generate = (regenerate = false) => {
    if (!activeTiming) return;
    if (!setupProgress.target) { setStatus('Prima conferma i macro di partenza.'); return; }
    if (!setupProgress.timing) { setStatus('Prima scegli e conferma il Timing.'); return; }
    try {
      const nextSeed = regenerate ? attemptSeed + 1 : attemptSeed;
      if (regenerate && menu?.lockedMealIndexes?.length) {
        const lockContext = buildLockedRegenerationContext(menu, activeTiming);
        const regenerated = generateNutritionMenu({
          target: lockContext.residualTarget,
          timing: lockContext.residualTiming,
          foods,
          selectedFoodIds: selectedFoodIds.length ? selectedFoodIds : undefined,
          attemptSeed: nextSeed,
          dayKind: activeTiming.dayKind === 'all' ? 'workout' : activeTiming.dayKind,
        });
        const merged = mergeUnlockedRegeneration(menu, regenerated, lockContext.unlockedIndexes);
        setAttemptSeed(nextSeed);
        setMenu(merged);
        setStatus(`Rigenerati ${lockContext.unlockedIndexes.length} pasti. I pasti bloccati sono rimasti invariati.`);
        return;
      }
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
      setSetupProgress((current) => ({ ...current, generated: true }));
      setStatus(result.status === 'best_feasible' ? 'Generata la migliore soluzione possibile.' : 'Menu generato e validato.');
    } catch (error) {
      setStatus(`Generazione non riuscita: ${String(error)}`);
    }
  };

  const completeManualDay = (regenerate = false) => {
    if (!activeTiming || !completionContext) return;
    if (!setupProgress.target) { setStatus('Prima conferma i macro di partenza.'); return; }
    if (!setupProgress.timing) { setStatus('Prima scegli e conferma il Timing.'); return; }
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

  const useGeneratedMenuInDiary = () => {
    if (!menu || !activeTiming) return;
    const empty = emptyMealsForTiming(activeTiming);
    setManualMeals(applyCompletionPlan(empty, menu, foods));
    setMenuMode('manual');
    setCompletionPlan(null);
    setStatus('Menu automatico applicato al diario di oggi.');
  };

  const applySmartCompletion = () => {
    if (!completionPlan) return;
    setManualMeals((current) => applyCompletionPlan(current, completionPlan, foods));
    setCompletionPlan(null);
    setStatus('Completamento applicato alla giornata manuale.');
  };

  const regenerateSingleMeal = (mealIndex: number) => {
    if (!menu || !activeTiming) return;
    if (menu.lockedMealIndexes?.includes(mealIndex)) {
      setStatus('Questo pasto e bloccato. Sbloccalo prima di rigenerarlo.');
      return;
    }
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

  const toggleGeneratedMealLock = (mealIndex: number) => {
    setMenu((current) => current ? toggleMealLock(current, mealIndex) : current);
  };

  const applyFoodReplacement = (suggestion: FoodReplacementSuggestion) => {
    if (!menu || !replacementContext) return;
    try {
      const next = replaceFoodSmart(menu, replacementContext.mealIndex, replacementContext.foodIndex, suggestion.food, foods);
      setMenu(next);
      setRecentFoodIds((current) => [suggestion.food.id, ...current.filter((id) => id !== suggestion.food.id)].slice(0, 30));
      setReplacementContext(null);
      setStatus(`Sostituito con ${suggestion.food.name}. Il pasto e stato riottimizzato sul target.`);
    } catch (error) {
      setStatus(`Sostituzione non riuscita: ${String(error)}`);
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
    setSetupProgress((current) => ({ ...current, timing: true, generated: false }));
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
    if (editingFood.source === 'recipe' && editingFood.recipeId) {
      const recipe = recipes.find((item) => item.id === editingFood.recipeId);
      setEditingFood(null);
      if (recipe) setEditingRecipe(structuredClone(recipe));
      return;
    }
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
    if (editingFood.source === 'recipe' && editingFood.recipeId) {
      const recipe = recipes.find((item) => item.id === editingFood.recipeId);
      setEditingFood(null);
      if (recipe) setEditingRecipe(structuredClone(recipe));
      return;
    }
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

  const openFoodDetail = (food: LocalFood) => {
    if (food.source === 'recipe' && food.recipeId) {
      const recipe = recipes.find((item) => item.id === food.recipeId);
      if (recipe) { setEditingRecipe(structuredClone(recipe)); return; }
    }
    setEditingFood(structuredClone(food));
  };

  const scanBarcode = async () => {
    try {
      setStatus('Apertura scanner...');
      const barcode = await scanProductBarcode();
      const localFood = foods.find((food) => food.barcode === barcode);
      if (localFood) {
        setFoodSearch(localFood.name);
        openFoodDetail(localFood);
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
    setRecentFoodIds((current) => [food.id, ...current.filter((id) => id !== food.id)].slice(0, 30));
    const quantityMode = defaultQuantityMode(food);
    const defaultQuantity = quantityMode.startsWith('unit:') ? 1 : Math.max(1, food.servingGrams || food.grammiMin || 100);
    const grams = gramsFromQuantity(food, quantityMode, defaultQuantity);
    setManualMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, items: [...meal.items, { id: `manual-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, food: structuredClone(food), grams, quantityMode }] } : meal));
    setManualPickerMealId(null);
    setManualPickerSearch('');
  };

  const updateManualItemQuantity = (mealId: string, itemId: string, quantity: number) => {
    setCompletionPlan(null);
    setManualMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, items: meal.items.map((item) => item.id === itemId ? setManualItemQuantity(item, safeNumber(quantity)) : item) } : meal));
  };

  const changeManualItemQuantityMode = (mealId: string, itemId: string, mode: string) => {
    setCompletionPlan(null);
    setManualMeals((current) => current.map((meal) => meal.id === mealId ? { ...meal, items: meal.items.map((item) => item.id === itemId ? switchManualItemMode(item, mode) : item) } : meal));
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


  const applyWeeklyPlanToDiary = (weeklyResult: WeeklyPlanResult) => {
    const nextDays = { ...diaryDays };
    weeklyResult.days.forEach((day) => {
      nextDays[day.date] = makeDiaryDay(
        day.date,
        day.target,
        day.timingTemplateId,
        generatedMenuToManualMeals(day.menu, foods),
        structuredClone(day.menu),
      );
    });
    setDiaryDays(nextDays);
    const activeDay = weeklyResult.days.find((day) => day.date === activeDiaryDate);
    if (activeDay) {
      setTarget({ ...activeDay.target });
      setActiveTimingId(activeDay.timingTemplateId);
      setManualMeals(generatedMenuToManualMeals(activeDay.menu, foods));
      setMenu(structuredClone(activeDay.menu));
      setMenuMode('manual');
    }
    setStatus(`${weeklyResult.days.length} giorni inseriti nel diario. Apri Oggi per modificarli.`);
  };

  const saveMealTemplate = (name: string) => {
    if (savedMealSourceIndex == null || !manualMeals[savedMealSourceIndex]) return;
    const template = createSavedMealTemplate(name, manualMeals[savedMealSourceIndex]);
    setSavedMealTemplates((current) => [template, ...current].slice(0, 100));
    setSavedMealMode(null);
    setSavedMealSourceIndex(null);
    setStatus(`Pasto salvato: ${template.name}.`);
  };

  const addSavedTemplate = (template: SavedMealTemplate) => {
    if (!savedMealTargetMealId) return;
    setManualMeals((current) => current.map((meal) => meal.id === savedMealTargetMealId ? appendSavedMeal(meal, template) : meal));
    setSavedMealMode(null);
    setSavedMealTargetMealId(null);
    setCompletionPlan(null);
    setStatus(`Aggiunto pasto salvato: ${template.name}.`);
  };

  const saveRecipe = () => {
    if (!editingRecipe) return;
    const errors = validateRecipe(editingRecipe);
    if (errors.length) { setStatus(errors[0]); return; }
    const normalized: Recipe = { ...editingRecipe, updatedAt: new Date().toISOString() };
    setRecipes((current) => [normalized, ...current.filter((recipe) => recipe.id !== normalized.id)]);
    setEditingRecipe(null);
    setStatus(`Ricetta salvata: ${normalized.name}. Ora e disponibile anche nel motore automatico.`);
  };

  const deleteRecipe = () => {
    if (!editingRecipe) return;
    const id = editingRecipe.id;
    setRecipes((current) => current.filter((recipe) => recipe.id !== id));
    setSelectedFoodIds((current) => current.filter((foodId) => foodId !== `recipe-food:${id}`));
    setEditingRecipe(null);
    setStatus('Ricetta eliminata.');
  };

  const addRecipeIngredient = (food: LocalFood) => {
    if (!editingRecipe || food.source === 'recipe') return;
    setEditingRecipe({ ...editingRecipe, ingredients: [...editingRecipe.ingredients, { id: `recipe-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, food: structuredClone(food), grams: Math.max(1, food.grammiMin || 100) }] });
    setRecipePickerOpen(false);
    setRecipePickerSearch('');
  };

  if (!ready) return <main className="app-shell"><p>Inizializzazione archivio locale...</p></main>;

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">BUILDER NUTRITION</p>
          <h1>{tab === 'menu' ? 'Oggi' : tab === 'week' ? 'Settimana' : tab === 'progress' ? 'Progressi' : tab === 'profile' ? 'Profilo' : tab === 'timing' ? 'Timing' : tab === 'foods' ? 'Alimenti' : 'Salvati'}</h1>
          <p className="muted">Imposta i macro, scegli il timing e crea automaticamente il tuo menu giornaliero.</p>
        </div>
        <div className="kcal-badge">{kcal.toFixed(0)}<small>kcal</small></div>
      </header>

      {status && <div className="status" role="status">{status}</div>}

      {tab === 'menu' && <>
        {!setupProgress.generated && <SetupGuideCard
          targetReady={setupProgress.target}
          timingReady={setupProgress.timing}
          generated={setupProgress.generated}
          activeTimingName={activeTiming?.name || 'Timing'}
          onProfile={() => setTab('profile')}
          onManualTarget={() => { setMenuMode('automatic'); window.setTimeout(() => document.getElementById('starting-target-card')?.scrollIntoView({ behavior: 'smooth' }), 80); }}
          onTiming={() => { setMenuMode('automatic'); setShowTimingSelect(true); }}
          onGenerate={() => { setMenuMode('automatic'); generate(false); }}
        />}
        <DiaryDateBar
          date={activeDiaryDate}
          onPrevious={() => openDiaryDate(shiftDateKey(activeDiaryDate, -1))}
          onNext={() => openDiaryDate(shiftDateKey(activeDiaryDate, 1))}
          onToday={() => openDiaryDate(localDateKey())}
          onPickDate={() => setDateModalMode('navigate')}
          onCopyDay={() => setDateModalMode('copy-day')}
        />
        <TodaySummaryCard target={target} consumed={manualActual} onOpenGenerator={() => setMenuMode('automatic')} />
        <div className="mode-switch diary-mode-switch">
          <button className={menuMode === 'manual' ? 'active' : ''} onClick={() => setMenuMode('manual')}>Diario</button>
          <button className={menuMode === 'automatic' ? 'active' : ''} onClick={() => setMenuMode('automatic')}>Crea menu</button>
        </div>

        {menuMode === 'automatic' && <>
          <section className="card" id="starting-target-card">
            <div className="row-between"><div><p className="eyebrow red">PASSO 1</p><h2>Macro di partenza</h2></div><span className={`setup-inline-status ${setupProgress.target ? 'done' : ''}`}>{setupProgress.target ? 'Confermati' : 'Da confermare'}</span></div>
            <p className="muted">Inserisci il target giornaliero che Builder deve rispettare. In alternativa puoi calcolarlo dalla sezione Profilo.</p>
            <div className="macro-grid">
              <label>Carboidrati<input type="number" min="0" value={target.carbs} onChange={(e) => changeStartingMacro('carbs', e.target.value)} /><span>g</span></label>
              <label>Proteine<input type="number" min="0" value={target.protein} onChange={(e) => changeStartingMacro('protein', e.target.value)} /><span>g</span></label>
              <label>Grassi<input type="number" min="0" value={target.fat} onChange={(e) => changeStartingMacro('fat', e.target.value)} /><span>g</span></label>
            </div>
            <div className="setup-target-actions"><button className="secondary" onClick={() => setTab('profile')}>Calcola dal Profilo/TDEE</button><button className="primary" onClick={confirmStartingTarget}>Conferma macro</button></div>
          </section>

          <section className="card">
            <div className="row-between"><div><p className="eyebrow red">PASSO 2</p><h2>Timing</h2></div><span className={`setup-inline-status ${setupProgress.timing ? 'done' : ''}`}>{setupProgress.timing ? 'Scelto' : 'Da scegliere'}</span></div><button className="selector-card" onClick={() => setShowTimingSelect(true)}>
              <span><small>Timing attivo</small><strong>{activeTiming.name}</strong><em>{activeTiming.meals.length} pasti</em></span><b>›</b>
            </button>
            <div className="setup-timing-actions"><button className="secondary small" onClick={() => setShowTimingSelect(true)}>Scegli scenario</button><button className="ghost small" onClick={() => setTab('timing')}>Gestisci Timing</button></div>
            <div className="meal-targets">
              {mealTargets.map((meal, index) => <div className="target-chip" key={`${activeTimingId}-${index}`}><strong>{meal.name}</strong><span>{meal.carbs.toFixed(0)}C · {meal.protein.toFixed(0)}P · {meal.fat.toFixed(0)}F</span></div>)}
            </div>
          </section>

          <section className="card">
            <div className="row-between"><h2>Pool alimenti</h2><button className="ghost" onClick={() => { setFoodSearch(''); setShowPoolSearch(true); }}>Scegli</button></div>
            <p className="muted">{selectedFoodIds.length ? `${selectedFoodIds.length} alimenti selezionati: il motore usera solo questi.` : `Pool completo: ${foods.length} alimenti disponibili, incluse le ricette.`}</p>
            {selectedFoodIds.length > 0 && <button className="text-button" onClick={() => setSelectedFoodIds([])}>Usa tutto il database</button>}
          </section>
          <div className="actions"><button className="primary" onClick={() => generate(false)}>Genera menu</button><button className="secondary" onClick={() => generate(true)} disabled={!menu}>{menu?.lockedMealIndexes?.length ? 'Rigenera non bloccati' : 'Rigenera'}</button></div>
          {menu && <section className="card result-card">
            <div className="row-between"><div><p className="eyebrow red">{menu.status.toUpperCase()}</p><h2>Menu generato</h2></div><div className="button-group"><button className="primary" onClick={useGeneratedMenuInDiary}>Usa nel diario</button><button className="secondary" onClick={saveCurrentMenu}>Salva</button><button className="danger" onClick={() => { setMenu(null); setStatus('Menu corrente eliminato.'); }}>Elimina</button></div></div>
            <div className="result-summary"><span>Target {menu.target.carbs.toFixed(1)}C / {menu.target.protein.toFixed(1)}P / {menu.target.fat.toFixed(1)}F</span><span>Reale {menu.actual.carbs.toFixed(1)}C / {menu.actual.protein.toFixed(1)}P / {menu.actual.fat.toFixed(1)}F</span><span>Tolleranza {menu.tolerancePercent}%</span></div>
            {!!menu.lockedMealIndexes?.length && <div className="locked-summary"><span>🔒</span><strong>{menu.lockedMealIndexes.length} {menu.lockedMealIndexes.length === 1 ? 'pasto bloccato' : 'pasti bloccati'}</strong><small>La rigenerazione globale non li modifica.</small></div>}
            {menu.meals.map((meal, index) => <article className={`generated-meal ${menu.lockedMealIndexes?.includes(index) ? 'generated-meal-locked' : ''}`} key={`${menu.id}-${index}`}>
              <div className="row-between generated-meal-head"><div className="generated-meal-title"><strong>{meal.name}</strong><span className={meal.withinTolerance ? 'ok' : 'warn'}>{meal.workoutTiming !== 'none' ? meal.workoutTiming.toUpperCase() : ''}</span></div><div className="generated-meal-actions"><button className={`meal-lock-button ${menu.lockedMealIndexes?.includes(index) ? 'active' : ''}`} onClick={() => toggleGeneratedMealLock(index)}>{menu.lockedMealIndexes?.includes(index) ? '🔒 Bloccato' : '🔓 Blocca'}</button><button className="meal-regen-button" disabled={menu.lockedMealIndexes?.includes(index)} onClick={() => regenerateSingleMeal(index)}>Rigenera pasto</button></div></div>
              <small>Target {meal.target.carbs.toFixed(1)}C · {meal.target.protein.toFixed(1)}P · {meal.target.fat.toFixed(1)}F</small>
              {meal.foods.map((portion, foodIndex) => <div className="smart-food-row" key={`${meal.name}-${portion.foodId}-${foodIndex}`}><button className="food-line food-link smart-food-detail" onClick={() => { const food = foods.find((item) => item.id === portion.foodId); if (food) openFoodDetail(food); }}><span>{portion.name}</span><strong>{portion.grams} g</strong></button><button className="replace-food-button" onClick={() => setReplacementContext({ mealIndex: index, foodIndex })}>Sostituisci</button></div>)}
              <small>Reale {meal.actual.carbs.toFixed(1)}C · {meal.actual.protein.toFixed(1)}P · {meal.actual.fat.toFixed(1)}F</small>
            </article>)}
          </section>}
        </>}

        {menuMode === 'manual' && <>
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
          <section className="diary-toolbar">
            <span><strong>Diario alimentare</strong><small>{manualMeals.reduce((sum, meal) => sum + meal.items.length, 0)} alimenti registrati</small></span>
            <div className="button-group"><button className="secondary" onClick={saveManualDay}>Salva</button><button className="danger" onClick={clearManualDay}>Azzera</button></div>
          </section>

          {manualMeals.map((meal, mealIndex) => {
            const actual = macrosForManualMeal(meal);
            const mealTarget = mealTargets[mealIndex];
            return <section className="card manual-meal diary-meal-card" key={meal.id}>
              <div className="row-between diary-meal-head"><div><h2>{meal.name}</h2><strong className="meal-kcal">{kcalFromMacros(actual).toFixed(0)} kcal</strong>{mealTarget && <small className="meal-subtitle">Target {mealTarget.carbs.toFixed(0)}C · {mealTarget.protein.toFixed(0)}P · {mealTarget.fat.toFixed(0)}F</small>}</div><div className="meal-actions-inline"><button className="meal-copy-button" onClick={() => { setCopyMealIndex(mealIndex); setDateModalMode('copy-meal'); }}>Copia</button><button className="meal-copy-button" disabled={!meal.items.length} onClick={() => { setSavedMealSourceIndex(mealIndex); setSavedMealMode('save'); }}>Salva pasto</button></div></div>
              {!meal.items.length && <p className="empty-meal">Nessun alimento inserito.</p>}
              {meal.items.map((item) => {
                const itemMacros = macrosForManualItem(item);
                const quantity = manualItemQuantity(item);
                const activeMode = item.quantityMode || defaultQuantityMode(item.food);
                return <div className="manual-item smart-quantity-item" key={item.id}>
                  <button className="manual-food-name" onClick={() => openFoodDetail(item.food)}><strong>{item.food.name}</strong><small>{itemMacros.carbs.toFixed(1)}C · {itemMacros.protein.toFixed(1)}P · {itemMacros.fat.toFixed(1)}F · {item.grams.toFixed(1)} g nutrizionali</small></button>
                  <div className="smart-quantity-control"><input type="number" min="0" step={activeMode.startsWith('unit:') ? '0.25' : '1'} value={Number(quantity.toFixed(2))} onChange={(e) => updateManualItemQuantity(meal.id, item.id, safeNumber(e.target.value))} /><button type="button" onClick={() => setQuantityPickerContext({ mealId: meal.id, itemId: item.id })}>{modeLabel(item.food, activeMode)}⌄</button></div>
                  <button className="icon-danger" aria-label="Rimuovi alimento" onClick={() => removeManualItem(meal.id, item.id)}>×</button>
                </div>;
              })}
              <div className="meal-total diary-meal-footer"><span>Reale {actual.carbs.toFixed(1)}C · {actual.protein.toFixed(1)}P · {actual.fat.toFixed(1)}F</span><div><button className="add-food-button" onClick={() => { setSavedMealTargetMealId(meal.id); setSavedMealMode('pick'); }}>Pasti salvati</button><button className="add-food-button" onClick={() => { setManualPickerMealId(meal.id); setManualPickerSearch(''); }}>+ Aggiungi alimento</button></div></div>
            </section>;
          })}
        </>}
      </>}

      {tab === 'week' && <WeeklyPlannerPanel
        foods={foods}
        timings={timings}
        defaultTarget={target}
        defaultTimingId={activeTimingId}
        selectedFoodIds={selectedFoodIds}
        onApplyWeek={applyWeeklyPlanToDiary}
      />}


      {tab === 'progress' && <ProgressPanel
        diaryDays={{ ...diaryDays, [activeDiaryDate]: currentDiarySnapshot() }}
        target={target}
        onApplyTarget={(nextTarget) => {
          setTarget({ ...nextTarget });
          setSetupProgress((current) => ({ ...current, target: true, generated: false }));
          setStatus(`Target aggiornato: ${nextTarget.carbs}C / ${nextTarget.protein}P / ${nextTarget.fat}F.`);
        }}
      />}

      {tab === 'profile' && <ProfilePanel currentTarget={target} onApplyTarget={(nextTarget) => { setTarget({ ...nextTarget }); setSetupProgress((current) => ({ ...current, target: true, generated: false })); setMenuMode('automatic'); setTab('menu'); setStatus(`Macro applicati dal Profilo: ${nextTarget.carbs.toFixed(0)}C / ${nextTarget.protein.toFixed(0)}P / ${nextTarget.fat.toFixed(0)}F. Ora scegli il Timing.`); }} />}

      {tab === 'timing' && <section className="card">
        <div className="row-between"><h2>Gestione timing</h2><button className="primary small" onClick={() => setEditingTiming(createEmptyTiming('Nuovo timing', 5))}>Nuovo</button></div>
        <p className="muted">Scegli lo scenario in base a quando ti alleni e al numero di pasti. Il Timing distribuisce i macro giornalieri: non modifica calorie o obiettivo.</p>
        <div className="timing-list">{timings.map((timing) => <div className="list-row" key={timing.id}><button className="list-main" onClick={() => chooseTiming(timing.id)}><strong>{timing.name}</strong><span>{timing.meals.length} pasti · {timing.dayKind === 'workout' ? 'allenamento' : timing.dayKind === 'off' ? 'riposo' : 'generale'}{timing.description ? ` · ${timing.description}` : ''}</span></button><button className="secondary" onClick={() => setEditingTiming(timing.builtIn ? cloneTimingForEdit(timing) : structuredClone(timing))}>{timing.builtIn ? 'Duplica' : 'Modifica'}</button>{!timing.builtIn && <button className="danger" onClick={() => setCustomTimings((current) => current.filter((item) => item.id !== timing.id))}>Elimina</button>}</div>)}</div>
      </section>}

      {tab === 'foods' && <section className="card">
        <div className="row-between foods-heading"><div><p className="eyebrow red">LIBRERIA</p><h2>Database alimenti</h2></div><div className="button-group"><button className="secondary" onClick={() => { setFoodSearch(''); setShowFoodSearch(true); }}>Cerca</button><button className="secondary" onClick={() => setShowNewFood(true)}>+ Alimento</button><button className="secondary" onClick={() => setEditingRecipe(createEmptyRecipe())}>+ Ricetta</button><button className="primary" onClick={() => void scanBarcode()}>Scansiona</button></div></div>
        <p className="muted">Alimenti Builder, personali, barcode e ricette. Le ricette possono essere usate anche dal generatore automatico.</p>
        <div className="food-list browse-food-list">{foods.slice(0, 100).map((food) => <button className="food-browser-row" key={food.id} onClick={() => openFoodDetail(food)}><span className="food-avatar small">{food.source === 'recipe' ? 'R' : food.name.slice(0,1).toUpperCase()}</span><span><strong>{food.name}</strong><small>{foodMacros(food)} · {food.source}{food.brand ? ` · ${food.brand}` : ''}{food.servingName ? ` · ${food.servingName} ${food.servingGrams}g` : ''}</small></span><b>›</b></button>)}</div>
      </section>}

      {tab === 'saved' && <section className="card saved-hub">
        <div className="row-between"><div><p className="eyebrow red">LIBRERIA PERSONALE</p><h2>Salvati</h2></div><span className="saved-count">{savedMenus.length + savedManualMenus.length + savedMealTemplates.length + recipes.length}</span></div>
        <div className="saved-hub-actions"><button className="primary" onClick={() => setEditingRecipe(createEmptyRecipe())}>+ Nuova ricetta</button></div>
        {!!recipes.length && <><h3 className="section-label">RICETTE</h3>{recipes.map((recipe) => { const food = recipeToLocalFood(recipe); return <div className="saved-row" key={recipe.id}><button className="list-main" onClick={() => setEditingRecipe(structuredClone(recipe))}><strong>{recipe.name}</strong><span>{foodMacros(food)} /100g · {recipe.servingName} {recipe.servingGrams}g</span></button><button className="secondary" onClick={() => setEditingRecipe(structuredClone(recipe))}>Modifica</button></div>; })}</>}
        {!!savedMealTemplates.length && <><h3 className="section-label">PASTI SALVATI</h3>{savedMealTemplates.map((saved) => <div className="saved-row" key={saved.id}><div className="list-main"><strong>{saved.name}</strong><span>{saved.items.length} alimenti</span></div><button className="danger" onClick={() => setSavedMealTemplates((current) => current.filter((entry) => entry.id !== saved.id))}>Elimina</button></div>)}</>}
        {!!savedMenus.length && <><h3 className="section-label">MENU AUTOMATICI</h3>{savedMenus.map((saved) => <div className="saved-row" key={saved.id}><button className="list-main" onClick={() => { setTarget(saved.target); setMenu(saved); setActiveTimingId(saved.timingTemplateId); setMenuMode('automatic'); setTab('menu'); }}><strong>{new Date(saved.createdAt).toLocaleString()}</strong><span>{saved.status} · {saved.targetKcal.toFixed(0)} kcal</span></button><button className="danger" onClick={() => setSavedMenus((current) => current.filter((entry) => entry.id !== saved.id))}>Elimina</button></div>)}</>}
        {!!savedManualMenus.length && <><h3 className="section-label">GIORNATE SALVATE</h3>{savedManualMenus.map((saved) => <div className="saved-row" key={saved.id}><button className="list-main" onClick={() => { setTarget(saved.target); setManualMeals(structuredClone(saved.meals)); setActiveTimingId(saved.timingTemplateId); setMenuMode('manual'); setTab('menu'); }}><strong>{new Date(saved.createdAt).toLocaleString()}</strong><span>{saved.actualKcal.toFixed(0)} / {saved.targetKcal.toFixed(0)} kcal</span></button><button className="danger" onClick={() => setSavedManualMenus((current) => current.filter((entry) => entry.id !== saved.id))}>Elimina</button></div>)}</>}
        {!recipes.length && !savedMealTemplates.length && !savedMenus.length && !savedManualMenus.length && <p className="muted">Non hai ancora salvato ricette, pasti o menu.</p>}
      </section>}

      <DateActionModal open={!!dateModalMode} mode={dateModalMode || 'navigate'} currentDate={activeDiaryDate} onClose={() => { setDateModalMode(null); setCopyMealIndex(null); }} onConfirm={handleDateAction} />
      <FoodReplacementModal open={!!replacementContext} original={replacementOriginal} suggestions={replacementSuggestions} onClose={() => setReplacementContext(null)} onSelect={applyFoodReplacement} />
      <FoodEditorModal food={editingFood} onChange={setEditingFood} onClose={() => setEditingFood(null)} onSave={saveEditingFood} onDelete={deleteEditingFood} />
      <RecipeEditorModal
        recipe={editingRecipe}
        onChange={setEditingRecipe}
        onClose={() => { setEditingRecipe(null); setRecipePickerOpen(false); }}
        onSave={saveRecipe}
        onDelete={editingRecipe && recipes.some((recipe) => recipe.id === editingRecipe.id) ? deleteRecipe : undefined}
        onAddIngredient={() => { setRecipePickerSearch(''); setRecipePickerOpen(true); }}
        onRemoveIngredient={(index) => setEditingRecipe((current) => current ? { ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) } : current)}
        onUpdateIngredientGrams={(index, grams) => setEditingRecipe((current) => current ? { ...current, ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, grams } : item) } : current)}
      />
      <SavedMealModal
        open={!!savedMealMode}
        mode={savedMealMode || 'pick'}
        sourceMeal={savedMealSourceIndex == null ? null : manualMeals[savedMealSourceIndex]}
        templates={savedMealTemplates}
        onClose={() => { setSavedMealMode(null); setSavedMealSourceIndex(null); setSavedMealTargetMealId(null); }}
        onSave={saveMealTemplate}
        onPick={addSavedTemplate}
        onDelete={(id) => setSavedMealTemplates((current) => current.filter((entry) => entry.id !== id))}
      />
      <TimingEditorModal timing={editingTiming} onChange={setEditingTiming} onClose={() => setEditingTiming(null)} onSave={saveTiming} onResize={resizeTiming} onDistribute={distributeEqually} onUpdateMeal={updateEditingMeal} />
      <TimingSelectModal open={showTimingSelect} timings={timings} activeId={activeTimingId} onClose={() => setShowTimingSelect(false)} onSelect={chooseTiming} />
      <FoodLibrarySearchModal open={showFoodSearch} title="Cerca alimenti" eyebrow="DATABASE ALIMENTI" foods={filteredFoods.slice(0,160)} query={foodSearch} onQueryChange={setFoodSearch} onClose={() => setShowFoodSearch(false)} onOpenFood={(food) => { setShowFoodSearch(false); openFoodDetail(food); }} />
      <FoodLibrarySearchModal open={showPoolSearch} title="Seleziona alimenti" eyebrow="POOL AUTOMATICO" foods={filteredFoods.slice(0,160)} query={foodSearch} onQueryChange={setFoodSearch} onClose={() => setShowPoolSearch(false)} onOpenFood={(food) => { setShowPoolSearch(false); openFoodDetail(food); }} selectedIds={selectedFoodIds} onToggleSelected={(id) => setSelectedFoodIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
      <FoodPickerModal open={!!manualPickerMealId} foods={manualPickerFoods} query={manualPickerSearch} onQueryChange={setManualPickerSearch} favoriteIds={favoriteFoodIds} recentIds={recentFoodIds} onToggleFavorite={(id) => setFavoriteFoodIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [id, ...current])} onClose={() => setManualPickerMealId(null)} onSelect={(food) => { if (manualPickerMealId) addFoodToManualMeal(manualPickerMealId, food); }} />
      <FoodPickerModal open={recipePickerOpen} foods={recipePickerFoods} query={recipePickerSearch} onQueryChange={setRecipePickerSearch} favoriteIds={favoriteFoodIds} recentIds={recentFoodIds} onToggleFavorite={(id) => setFavoriteFoodIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [id, ...current])} onClose={() => setRecipePickerOpen(false)} onSelect={addRecipeIngredient} />
      <NewFoodModal open={showNewFood} value={manualFood} onChange={setManualFood} onClose={() => setShowNewFood(false)} onSave={addManualFood} />
      <ChoicePopup open={!!quantityPickerItem} title="Unità quantità" choices={quantityPickerItem ? quantityOptions(quantityPickerItem.food).map((option) => ({ value: option.value, label: option.label, subtitle: option.subtitle })) : []} value={quantityPickerItem?.quantityMode || (quantityPickerItem ? defaultQuantityMode(quantityPickerItem.food) : 'grams')} onClose={() => setQuantityPickerContext(null)} onSelect={(mode) => { if (quantityPickerContext) changeManualItemQuantityMode(quantityPickerContext.mealId, quantityPickerContext.itemId, mode); setQuantityPickerContext(null); }} />
      <BottomNav active={tab} onChange={setTab} />
    </main>
  );
}
