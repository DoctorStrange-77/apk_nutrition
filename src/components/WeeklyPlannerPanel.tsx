import { useEffect, useMemo, useState } from 'react';
import { AppModal } from '@/components/AppModal';
import { ChoicePopup } from '@/components/ChoicePopup';
import { WeeklyKcalBars } from '@/components/NutritionCharts';
import { localDateKey } from '@/domain/diary';
import {
  buildShoppingList,
  copyDayToAll,
  createWeeklyPlannerConfig,
  generateWeeklyPlan,
  shiftDateKey,
  shiftWeek,
  weekStartMonday,
} from '@/domain/weeklyPlanner';
import { kcalFromMacros } from '@/domain/manualMenu';
import { migrateBuiltInTimingId } from '@/data/builtInTimings';
import { getLocalValue, setLocalValue } from '@/storage/localDatabase';
import type {
  LocalFood,
  MacroTarget,
  TimingTemplate,
  WeeklyPlanResult,
  WeeklyPlannerConfig,
} from '@/types/nutrition';

const CONFIG_KEY = 'weekly-planner-config-v1';
const RESULT_KEY = 'weekly-planner-result-v1';
const safe = (value: string | number) => Math.max(0, Number(value) || 0);
type Props = {
  foods: LocalFood[];
  timings: TimingTemplate[];
  defaultTarget: MacroTarget;
  defaultTimingId: string;
  selectedFoodIds: string[];
  onApplyWeek: (result: WeeklyPlanResult) => void;
};

const dateLabel = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('it-IT', {
  weekday: 'short', day: 'numeric', month: 'short',
});

const weekLabel = (weekStart: string) => {
  const end = shiftDateKey(weekStart, 6);
  const startText = new Date(`${weekStart}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const endText = new Date(`${end}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startText} – ${endText}`;
};

export function WeeklyPlannerPanel(props: Props) {
  const { foods, timings, defaultTarget, defaultTimingId, selectedFoodIds, onApplyWeek } = props;
  const initial = useMemo(() => createWeeklyPlannerConfig(localDateKey(), defaultTarget, defaultTimingId), []);
  const [config, setConfig] = useState<WeeklyPlannerConfig>(initial);
  const [result, setResult] = useState<WeeklyPlanResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [timingDayIndex, setTimingDayIndex] = useState<number | null>(null);
  const [detailDate, setDetailDate] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const storedConfig = await getLocalValue<WeeklyPlannerConfig | null>(CONFIG_KEY, null);
      const storedResult = await getLocalValue<WeeklyPlanResult | null>(RESULT_KEY, null);
      const resolveTimingId = (id?: string) => { const migrated = migrateBuiltInTimingId(id); return timings.some((timing) => timing.id === migrated) ? migrated : defaultTimingId; };
      if (storedConfig?.days?.length === 7) setConfig({ ...storedConfig, days: storedConfig.days.map((day) => ({ ...day, timingTemplateId: resolveTimingId(day.timingTemplateId) })) });
      if (storedResult?.days?.length) setResult({ ...storedResult, days: storedResult.days.map((day) => ({ ...day, timingTemplateId: resolveTimingId(day.timingTemplateId), menu: { ...day.menu, timingTemplateId: resolveTimingId(day.menu.timingTemplateId) } })) });
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void setLocalValue(CONFIG_KEY, config);
  }, [loaded, config]);

  useEffect(() => {
    if (!loaded) return;
    void setLocalValue(RESULT_KEY, result);
  }, [loaded, result]);

  const shopping = useMemo(() => result ? buildShoppingList(result) : [], [result]);
  const detailDay = result?.days.find((day) => day.date === detailDate) || null;
  const updateDay = (index: number, patch: Partial<WeeklyPlannerConfig['days'][number]>) => {
    setResult(null);
    setConfig((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => dayIndex === index ? {
        ...day,
        ...patch,
        target: patch.target ? { ...patch.target } : day.target,
      } : day),
      updatedAt: new Date().toISOString(),
    }));
  };

  const moveWeek = (delta: number) => {
    setResult(null);
    setConfig((current) => {
      const nextStart = shiftWeek(current.weekStart, delta);
      return {
        ...current,
        weekStart: nextStart,
        days: current.days.map((day, index) => ({ ...day, date: shiftDateKey(nextStart, index) })),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const resetToCurrentWeek = () => {
    const start = weekStartMonday(localDateKey());
    setConfig(createWeeklyPlannerConfig(start, defaultTarget, defaultTimingId));
    setResult(null);
  };
  const generate = async () => {
    setBusy(true);
    setMessage('Generazione della settimana in corso...');
    try {
      const next = await generateWeeklyPlan({
        config,
        timings,
        foods,
        selectedFoodIds: selectedFoodIds.length ? selectedFoodIds : undefined,
        rotationWindowDays: 2,
      });
      setResult(next);
      setMessage(`${next.days.length} giorni generati. Rotazione alimenti attiva sulle ultime 48 ore.`);
    } catch (error) {
      setMessage(`Generazione settimana non riuscita: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const applyTodayProfileToAll = () => {
    setResult(null);
    setConfig((current) => ({
      ...current,
      days: current.days.map((day) => ({
        ...day,
        enabled: true,
        target: { ...defaultTarget },
        timingTemplateId: defaultTimingId,
      })),
      updatedAt: new Date().toISOString(),
    }));
  };

  if (!loaded) return <section className="card"><p className="muted">Caricamento planner settimanale...</p></section>;
  return <>
    <section className="weekly-hero card">
      <div className="row-between">
        <div><p className="eyebrow red">WEEKLY PLANNER</p><h2>Genera la settimana</h2></div>
        <span className="weekly-engine-badge">ENGINE V2</span>
      </div>
      <p className="muted">Ogni giorno parte sempre dai macronutrienti e dal timing. App Nutrition riduce le ripetizioni recenti senza sacrificare la precisione.</p>
      <div className="weekly-nav">
        <button className="date-arrow" onClick={() => moveWeek(-1)}>‹</button>
        <button className="weekly-range" onClick={resetToCurrentWeek}><small>SETTIMANA</small><strong>{weekLabel(config.weekStart)}</strong></button>
        <button className="date-arrow" onClick={() => moveWeek(1)}>›</button>
      </div>
      <div className="weekly-top-actions">
        <button className="secondary" onClick={applyTodayProfileToAll}>Usa profilo di Oggi su tutti</button>
        <span>{selectedFoodIds.length ? `${selectedFoodIds.length} alimenti nel pool` : `${foods.length} alimenti disponibili`}</span>
      </div>
    </section>

    <div className="weekly-day-list">
      {config.days.map((day, index) => {
        const timing = timings.find((item) => item.id === day.timingTemplateId);
        return <section className={`weekly-day-card ${day.enabled ? '' : 'disabled'}`} key={day.date}>
          <div className="weekly-day-head">
            <button className={`week-day-toggle ${day.enabled ? 'active' : ''}`} onClick={() => updateDay(index, { enabled: !day.enabled })}>{day.enabled ? 'ON' : 'OFF'}</button>
            <div><strong>{dateLabel(day.date)}</strong><small>{kcalFromMacros(day.target).toFixed(0)} kcal</small></div>
            <button className="text-button" onClick={() => setConfig((current) => copyDayToAll(current, index))}>Copia a tutti</button>
          </div>
          <div className="weekly-macro-grid">
            <label>C<input type="number" min="0" value={day.target.carbs} disabled={!day.enabled} onChange={(e) => updateDay(index, { target: { ...day.target, carbs: safe(e.target.value) } })} /><span>g</span></label>
            <label>P<input type="number" min="0" value={day.target.protein} disabled={!day.enabled} onChange={(e) => updateDay(index, { target: { ...day.target, protein: safe(e.target.value) } })} /><span>g</span></label>
            <label>F<input type="number" min="0" value={day.target.fat} disabled={!day.enabled} onChange={(e) => updateDay(index, { target: { ...day.target, fat: safe(e.target.value) } })} /><span>g</span></label>
          </div>
          <button className="weekly-timing-selector" disabled={!day.enabled} onClick={() => setTimingDayIndex(index)}>
            <span><small>TIMING</small><strong>{timing?.name || 'Seleziona timing'}</strong></span><b>›</b>
          </button>
        </section>;
      })}
    </div>

    <div className="weekly-generate-bar">
      <button className="primary" disabled={busy || !config.days.some((day) => day.enabled)} onClick={() => void generate()}>{busy ? 'Generazione...' : result ? 'Rigenera settimana' : 'Genera settimana'}</button>
    </div>
    {message && <div className="status weekly-status">{message}</div>}

    {result && <section className="card weekly-result-card">
      <div className="row-between"><div><p className="eyebrow red">PIANO PRONTO</p><h2>{result.days.length} giorni generati</h2></div><button className="primary small" onClick={() => onApplyWeek(result)}>Porta nel diario</button></div>
      <WeeklyKcalBars result={result} />
      <div className="weekly-result-days">
        {result.days.map((day) => <button className="weekly-result-day" key={day.date} onClick={() => setDetailDate(day.date)}>
          <span><strong>{dateLabel(day.date)}</strong><small>{day.menu.status} · {day.menu.actualKcal.toFixed(0)} kcal</small></span>
          <span className={day.menu.status === 'best_feasible' ? 'warn' : 'ok'}>{day.menu.actual.carbs.toFixed(0)}C · {day.menu.actual.protein.toFixed(0)}P · {day.menu.actual.fat.toFixed(0)}F</span>
          <b>›</b>
        </button>)}
      </div>
      <p className="weekly-apply-note">“Porta nel diario” prepara le date generate come giornate reali e modificabili in Oggi.</p>
    </section>}

    {result && <section className="card weekly-shopping-card">
      <div className="row-between"><div><p className="eyebrow red">LISTA DELLA SPESA</p><h2>{shopping.length} alimenti</h2></div><span className="saved-count">7 gg</span></div>
      <div className="shopping-list">
        {shopping.map((item) => <div className="shopping-row" key={item.foodId}>
          <span><strong>{item.name}</strong><small>{item.occurrences} utilizzi</small></span>
          <b>{item.grams >= 1000 ? `${(item.grams / 1000).toFixed(2)} kg` : `${item.grams} g`}</b>
        </div>)}
      </div>
    </section>}
    <ChoicePopup
      open={timingDayIndex != null}
      title="Timing del giorno"
      choices={timings.map((timing) => ({ value: timing.id, label: timing.name, subtitle: `${timing.meals.length} pasti` }))}
      value={timingDayIndex != null ? config.days[timingDayIndex]?.timingTemplateId || '' : ''}
      onClose={() => setTimingDayIndex(null)}
      onSelect={(value) => {
        if (timingDayIndex != null) updateDay(timingDayIndex, { timingTemplateId: value });
      }}
    />

    <AppModal open={!!detailDay} fullscreen title={detailDay ? dateLabel(detailDay.date) : 'Giorno'} eyebrow="MENU SETTIMANALE" onClose={() => setDetailDate(null)}>
      {detailDay && <>
        <div className="nutrition-preview modal-nutrition">
          <span><small>CARB</small><strong>{detailDay.menu.actual.carbs.toFixed(1)} g</strong></span>
          <span><small>PRO</small><strong>{detailDay.menu.actual.protein.toFixed(1)} g</strong></span>
          <span><small>FAT</small><strong>{detailDay.menu.actual.fat.toFixed(1)} g</strong></span>
          <span><small>KCAL</small><strong>{detailDay.menu.actualKcal.toFixed(0)}</strong></span>
        </div>
        {detailDay.menu.meals.map((meal, index) => <article className="generated-meal" key={`${detailDay.date}-${index}`}>
          <div className="row-between"><strong>{meal.name}</strong><small>{meal.target.carbs.toFixed(0)}C · {meal.target.protein.toFixed(0)}P · {meal.target.fat.toFixed(0)}F</small></div>
          {meal.foods.map((food) => <div className="food-line" key={`${meal.name}-${food.foodId}`}><span>{food.name}</span><strong>{food.grams} g</strong></div>)}
          <small>Reale {meal.actual.carbs.toFixed(1)}C · {meal.actual.protein.toFixed(1)}P · {meal.actual.fat.toFixed(1)}F</small>
        </article>)}
      </>}
    </AppModal>
  </>;
}

