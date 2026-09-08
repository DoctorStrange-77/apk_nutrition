import { useMemo } from 'react';
import { SmartPantryPanel } from '@/components/SmartPantryPanel';
import { buildPackageAwareShoppingList } from '@/domain/intelligence/pantry';
import { macrosForManualMeal } from '@/domain/manualMenu';
import type {
  GeneratedMenu,
  LocalFood,
  MacroTarget,
  ManualMeal,
  PantryItem,
  SmartNutritionSettings,
  TrainingContext,
} from '@/types/nutrition';

type Props = {
  settings: SmartNutritionSettings;
  onSettingsChange: (settings: SmartNutritionSettings) => void;
  trainingContext: TrainingContext | null;
  onTrainingContextChange: (context: TrainingContext) => void;
  pantryItems: PantryItem[];
  onPantryChange: (items: PantryItem[]) => void;
  foods: LocalFood[];
  menu: GeneratedMenu | null;
  manualMeals: ManualMeal[];
  target: MacroTarget;
  onGenerateSmart: () => void;
  onAutopilot: (completedMealIndexes:number[], actualCompletedMacros:MacroTarget) => void;
};

const RETAILERS = ['', 'Lidl', 'Esselunga', 'Coop', 'Conad', 'Eurospin', 'Carrefour', 'MD'];

const add = (a:MacroTarget,b:MacroTarget):MacroTarget => ({
  carbs:a.carbs+b.carbs,
  protein:a.protein+b.protein,
  fat:a.fat+b.fat,
});

export function SmartIntelligencePanel(props:Props) {
  const {
    settings,
    onSettingsChange,
    trainingContext,
    onTrainingContextChange,
    pantryItems,
    onPantryChange,
    foods,
    menu,
    manualMeals,
    target,
    onGenerateSmart,
    onAutopilot,
  } = props;

  const completedMealIndexes = useMemo(
    () => manualMeals.map((meal,index) => meal.items.length ? index : -1).filter((index) => index >= 0),
    [manualMeals],
  );
  const actualCompletedMacros = useMemo(
    () => completedMealIndexes.reduce(
      (sum,index) => add(sum, macrosForManualMeal(manualMeals[index])),
      { carbs:0, protein:0, fat:0 },
    ),
    [completedMealIndexes, manualMeals],
  );
  const packageShopping = useMemo(
    () => menu && settings.packageAwareShopping
      ? buildPackageAwareShoppingList(menu, pantryItems)
      : [],
    [menu, pantryItems, settings.packageAwareShopping],
  );

  const setSetting = <K extends keyof SmartNutritionSettings>(key:K, value:SmartNutritionSettings[K]) =>
    onSettingsChange({ ...settings, [key]:value });

  const ensureTraining = ():TrainingContext => trainingContext || {
    isTrainingDay:true,
    startTime:'18:00',
    durationMinutes:75,
    sessionType:'other',
    intensity:'medium',
  };

  return <div className="smart-intelligence-page">
    <section className="smart-hero card">
      <div className="row-between">
        <div><p className="eyebrow red">SMART NUTRITION INTELLIGENCE</p><h2>Autopilot alimentare</h2></div>
        <span className="smart-engine-badge">INTELLIGENCE 1.0</span>
      </div>
      <p className="muted">Preferenze personali, allenamento, dispensa, emergenze e supermercato diventano criteri reali del generatore, senza cambiare il target macro.</p>
      <div className="smart-hero-kpis">
        <span><small>Target</small><strong>{target.carbs.toFixed(0)}C · {target.protein.toFixed(0)}P · {target.fat.toFixed(0)}F</strong></span>
        <span><small>Dispensa</small><strong>{pantryItems.length} alimenti</strong></span>
        <span><small>Varietà</small><strong>{settings.variety}/100</strong></span>
      </div>
      <button className="primary smart-primary-action" type="button" onClick={onGenerateSmart}>Genera con Smart Intelligence</button>
    </section>

    <section className="card">
      <div className="smart-section-head">
        <div><p className="eyebrow red">SMART AUTOPILOT</p><h3>Ribilancia il resto della giornata</h3></div>
        <span className={completedMealIndexes.length ? 'smart-ready' : 'smart-idle'}>{completedMealIndexes.length} completati</span>
      </div>
      <p className="muted">I pasti con alimenti già registrati nel Diario vengono considerati consumati. Smart Nutrition conserva quelli e rigenera soltanto ciò che resta.</p>
      <div className="smart-autopilot-summary">
        <span><small>Già consumato</small><strong>{actualCompletedMacros.carbs.toFixed(0)}C · {actualCompletedMacros.protein.toFixed(0)}P · {actualCompletedMacros.fat.toFixed(0)}F</strong></span>
        <span><small>Menu corrente</small><strong>{menu ? menu.status : 'Nessun menu'}</strong></span>
      </div>
      <button
        className="secondary smart-autopilot-button"
        type="button"
        disabled={!menu || !completedMealIndexes.length}
        onClick={() => onAutopilot(completedMealIndexes, actualCompletedMacros)}
      >
        Ribilancia pasti rimanenti
      </button>
    </section>

    <section className="card">
      <div className="smart-section-head">
        <div><p className="eyebrow red">TRAINING-AWARE</p><h3>Contesto allenamento di oggi</h3></div>
        <button className={`smart-toggle ${settings.trainingAware ? 'active' : ''}`} type="button" onClick={() => setSetting('trainingAware', !settings.trainingAware)}>
          {settings.trainingAware ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="smart-training-grid">
        <button
          type="button"
          className={`smart-toggle ${trainingContext?.isTrainingDay ? 'active' : ''}`}
          onClick={() => onTrainingContextChange(trainingContext?.isTrainingDay
            ? { isTrainingDay:false, sessionType:'rest' }
            : ensureTraining())}
        >
          {trainingContext?.isTrainingDay ? 'Training day' : 'Rest day'}
        </button>
        {trainingContext?.isTrainingDay && <>
          <label>Ora WO<input type="time" value={trainingContext.startTime || '18:00'} onChange={(event) => onTrainingContextChange({ ...ensureTraining(), startTime:event.target.value })} /></label>
          <label>Durata<input type="number" min="15" step="5" value={trainingContext.durationMinutes || 75} onChange={(event) => onTrainingContextChange({ ...ensureTraining(), durationMinutes:Number(event.target.value) || 75 })} /><span>min</span></label>
          <label>Sessione<select value={trainingContext.sessionType || 'other'} onChange={(event) => onTrainingContextChange({ ...ensureTraining(), sessionType:event.target.value as TrainingContext['sessionType'] })}>
            <option value="upper">Upper</option><option value="lower">Lower</option><option value="full_body">Full body</option><option value="cardio">Cardio</option><option value="other">Altro</option>
          </select></label>
          <label>Intensità<select value={trainingContext.intensity || 'medium'} onChange={(event) => onTrainingContextChange({ ...ensureTraining(), intensity:event.target.value as TrainingContext['intensity'] })}>
            <option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option>
          </select></label>
        </>}
      </div>
    </section>

    <section className="card">
      <div className="smart-section-head"><div><p className="eyebrow red">EMERGENCY MODE</p><h3>Quando la giornata cambia</h3></div></div>
      <div className="smart-emergency-grid">
        {([
          ['none','Normale'],
          ['low_time','Poco tempo'],
          ['outside_home','Fuori casa'],
          ['skipped_meal','Pasto saltato'],
        ] as const).map(([value,label]) => <button
          type="button"
          key={value}
          className={settings.emergencyMode === value ? 'active' : ''}
          onClick={() => setSetting('emergencyMode', value)}
        >{label}</button>)}
      </div>
    </section>

    <section className="card">
      <div className="smart-section-head"><div><p className="eyebrow red">PERSONAL FOOD INTELLIGENCE</p><h3>Varietà e preferenze</h3></div><strong>{settings.variety}/100</strong></div>
      <label className="smart-range">
        <span><small>Stabile</small><small>Molto variabile</small></span>
        <input type="range" min="0" max="100" step="5" value={settings.variety} onChange={(event) => setSetting('variety', Number(event.target.value))} />
      </label>
      <p className="muted">Valori bassi favoriscono gli staple che usi spesso; valori alti aumentano la rotazione senza eliminare gli alimenti preferiti.</p>
    </section>

    <section className="card">
      <div className="smart-section-head"><div><p className="eyebrow red">SUPERMARKET MODE</p><h3>Priorità retailer</h3></div></div>
      <label>Supermercato
        <select value={settings.retailer} onChange={(event) => setSetting('retailer', event.target.value)}>
          {RETAILERS.map((retailer) => <option key={retailer || 'all'} value={retailer}>{retailer || 'Nessuna priorità'}</option>)}
        </select>
      </label>
      <p className="muted">È una priorità basata sui prodotti già conosciuti dal database. Non indica disponibilità o prezzi in tempo reale.</p>
    </section>

    <section className="card">
      <div className="smart-toggle-grid">
        <button type="button" className={`smart-option ${settings.pantryFirst ? 'active' : ''}`} onClick={() => setSetting('pantryFirst', !settings.pantryFirst)}><strong>Dispensa first</strong><small>Priorità a ciò che hai già.</small></button>
        <button type="button" className={`smart-option ${settings.zeroWaste ? 'active' : ''}`} onClick={() => setSetting('zeroWaste', !settings.zeroWaste)}><strong>Zero Waste</strong><small>Riduce acquisti inutili usando la dispensa.</small></button>
        <button type="button" className={`smart-option ${settings.packageAwareShopping ? 'active' : ''}`} onClick={() => setSetting('packageAwareShopping', !settings.packageAwareShopping)}><strong>Confezioni reali</strong><small>Lista spesa arrotondata ai pack.</small></button>
        <button type="button" className={`smart-option ${settings.explanationMode ? 'active' : ''}`} onClick={() => setSetting('explanationMode', !settings.explanationMode)}><strong>Perché questo pasto</strong><small>Mostra la logica delle scelte.</small></button>
        <button type="button" className={`smart-option ${settings.dataConfidence ? 'active' : ''}`} onClick={() => setSetting('dataConfidence', !settings.dataConfidence)}><strong>Data Confidence</strong><small>Affidabilità dei dati alimento.</small></button>
        <button type="button" className={`smart-option ${settings.rawCookedAssist ? 'active' : ''}`} onClick={() => setSetting('rawCookedAssist', !settings.rawCookedAssist)}><strong>Crudo / cotto</strong><small>Assistenza quando il fattore è noto.</small></button>
      </div>
    </section>

    <section className="card">
      <SmartPantryPanel foods={foods} items={pantryItems} onChange={onPantryChange} />
    </section>

    {menu && settings.explanationMode && <section className="card smart-explain-card">
      <div className="smart-section-head"><div><p className="eyebrow red">WHY THIS MEAL</p><h3>Perché il menu è costruito così</h3></div></div>
      <div className="smart-explain-list">
        {menu.meals.map((meal,index) => <article key={`${meal.name}-${index}`}>
          <div><strong>{meal.name}</strong><small>{meal.architecture || 'mixed'} · {meal.workoutTiming === 'none' ? 'standard' : meal.workoutTiming}</small></div>
          {(meal.explanations || []).map((reason,reasonIndex) => <p key={reasonIndex}>{reason}</p>)}
        </article>)}
      </div>
    </section>}

    {menu && settings.packageAwareShopping && <section className="card">
      <div className="smart-section-head"><div><p className="eyebrow red">SMART SHOPPING</p><h3>Acquisti dopo la dispensa</h3></div><span className="smart-count">{packageShopping.length}</span></div>
      {!packageShopping.length && <p className="smart-empty">La dispensa copre gli alimenti del menu oppure non sono state definite confezioni.</p>}
      <div className="smart-shopping-preview">
        {packageShopping.slice(0, 8).map((item) => <div key={item.foodId}>
          <span><strong>{item.name}</strong><small>{item.gramsToBuy.toFixed(0)} g da acquistare{item.retailer ? ` · ${item.retailer}` : ''}</small></span>
          <b>{item.packagesToBuy != null ? `${item.packagesToBuy} pack` : `${item.gramsToBuy.toFixed(0)} g`}</b>
        </div>)}
      </div>
    </section>}
  </div>;
}
