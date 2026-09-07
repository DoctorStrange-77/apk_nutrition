import { useEffect, useMemo, useState } from 'react';
import { localDateKey } from '@/domain/diary';
import {
  DEFAULT_PROGRESS_SETTINGS,
  buildTargetRecommendation,
  calculateDiaryAdherence,
  calculateWeightTrend,
  deleteCheckIn,
  normalizeCheckIns,
  upsertCheckIn,
  type ProgressCheckIn,
  type ProgressGoal,
  type ProgressSettings,
} from '@/domain/progressAnalytics';
import { kcalFromMacros } from '@/domain/manualMenu';
import { getLocalValue, setLocalValue } from '@/storage/localDatabase';
import type { DiaryDay, MacroTarget } from '@/types/nutrition';

const CHECKINS_KEY = 'progress-checkins-v1';
const SETTINGS_KEY = 'progress-settings-v1';
const APPLIED_KEY = 'progress-last-applied-date-v1';

const goalLabel: Record<ProgressGoal, string> = {
  cut: 'Cut',
  maintain: 'Mantenimento',
  gain: 'Crescita',
};

const signed = (value: number | null, digits = 2) => {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
};

const dateLabel = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('it-IT', {
  day: '2-digit', month: 'short', year: 'numeric',
});

type Props = {
  diaryDays: Record<string, DiaryDay>;
  target: MacroTarget;
  onApplyTarget: (target: MacroTarget) => void;
};

function WeightSparkline({ entries }: { entries: ProgressCheckIn[] }) {
  const points = useMemo(() => normalizeCheckIns(entries).slice(-14), [entries]);
  if (points.length < 2) return <div className="progress-chart-empty">Aggiungi almeno 2 pesate per vedere il grafico.</div>;
  const values = points.map((entry) => entry.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.4, max - min);
  const coords = points.map((entry, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 88 - ((entry.weightKg - min) / range) * 70;
    return { ...entry, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ');
  return <div className="progress-chart-wrap">
    <svg className="progress-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Andamento del peso">
      <line x1="0" y1="88" x2="100" y2="88" className="progress-chart-grid" />
      <line x1="0" y1="53" x2="100" y2="53" className="progress-chart-grid" />
      <line x1="0" y1="18" x2="100" y2="18" className="progress-chart-grid" />
      <polyline points={polyline} className="progress-chart-line" />
      {coords.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="2.3" className="progress-chart-dot" />)}
    </svg>
    <div className="progress-chart-labels"><span>{dateLabel(points[0].date)}</span><span>{dateLabel(points[points.length - 1].date)}</span></div>
  </div>;
}

export function ProgressPanel({ diaryDays, target, onApplyTarget }: Props) {
  const [entries, setEntries] = useState<ProgressCheckIn[]>([]);
  const [settings, setSettings] = useState<ProgressSettings>(DEFAULT_PROGRESS_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState(localDateKey());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [lastAppliedDate, setLastAppliedDate] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const savedEntries = await getLocalValue<ProgressCheckIn[]>(CHECKINS_KEY, []);
      const savedSettings = await getLocalValue<ProgressSettings>(SETTINGS_KEY, DEFAULT_PROGRESS_SETTINGS);
      const savedAppliedDate = await getLocalValue<string | null>(APPLIED_KEY, null);
      setEntries(normalizeCheckIns(savedEntries));
      setSettings({ ...DEFAULT_PROGRESS_SETTINGS, ...savedSettings });
      setLastAppliedDate(savedAppliedDate);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void setLocalValue(CHECKINS_KEY, entries);
  }, [loaded, entries]);

  useEffect(() => {
    if (!loaded) return;
    void setLocalValue(SETTINGS_KEY, settings);
  }, [loaded, settings]);

  const trend = useMemo(() => calculateWeightTrend(entries), [entries]);
  const analysisDate = entries.length ? entries[entries.length - 1].date : localDateKey();
  const adherence = useMemo(() => calculateDiaryAdherence(diaryDays, analysisDate, 7), [diaryDays, analysisDate]);
  const alreadyAdjusted = lastAppliedDate === analysisDate;
  const recommendation = useMemo(
    () => buildTargetRecommendation(target, trend, adherence, settings),
    [target, trend, adherence, settings],
  );

  const saveCheckIn = () => {
    const parsed = Number(weight.replace(',', '.'));
    if (!date || !Number.isFinite(parsed) || parsed <= 0 || parsed > 400) {
      setMessage('Inserisci una data e un peso valido.');
      return;
    }
    setEntries((current) => upsertCheckIn(current, date, parsed, note));
    setWeight('');
    setNote('');
    setMessage(`Peso salvato per ${dateLabel(date)}.`);
  };

  const changeGoal = (goal: ProgressGoal) => setSettings((current) => ({ ...current, goal }));

  if (!loaded) return <section className="card"><p className="muted">Caricamento progressi...</p></section>;

  return <>
    <section className="progress-hero card">
      <div className="row-between">
        <div><p className="eyebrow red">CHECK-IN ADATTIVO</p><h2>Progressi</h2></div>
        <span className="progress-engine-badge">LOCAL</span>
      </div>
      <p className="muted">Il trend suggerisce eventuali correzioni dei macro, ma nessun target viene modificato senza la tua conferma.</p>
      <div className="progress-goal-switch">
        {(Object.keys(goalLabel) as ProgressGoal[]).map((goal) => <button key={goal} className={settings.goal === goal ? 'active' : ''} onClick={() => changeGoal(goal)}>{goalLabel[goal]}</button>)}
      </div>
    </section>

    <section className="card progress-checkin-card">
      <div className="row-between"><h2>Registra peso</h2><span className="live-badge">CHECK-IN</span></div>
      <div className="progress-entry-grid">
        <label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Peso<input inputMode="decimal" type="number" min="20" max="400" step="0.1" placeholder="kg" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
      </div>
      <label className="progress-note-field">Nota facoltativa<input type="text" maxLength={90} placeholder="es. riposo, viaggio, pasto libero..." value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button className="primary progress-save-button" onClick={saveCheckIn}>Salva check-in</button>
      {message && <div className="status progress-local-status">{message}</div>}
    </section>

    <section className="card progress-kpi-card">
      <div className="row-between"><h2>Trend</h2><small className="muted">ultimi 14 giorni</small></div>
      <div className="progress-kpi-grid">
        <div><small>ULTIMO PESO</small><strong>{trend.latestWeightKg == null ? '—' : `${trend.latestWeightKg.toFixed(1)} kg`}</strong></div>
        <div><small>MEDIA 7 GG</small><strong>{trend.recentAverageKg == null ? '—' : `${trend.recentAverageKg.toFixed(2)} kg`}</strong></div>
        <div><small>VARIAZIONE</small><strong className={trend.weeklyChangeKg != null && trend.weeklyChangeKg > 0 ? 'warn' : 'ok'}>{trend.weeklyChangeKg == null ? '—' : `${signed(trend.weeklyChangeKg)} kg`}</strong></div>
        <div><small>RATE / SETT.</small><strong>{trend.weeklyRatePct == null ? '—' : `${signed(trend.weeklyRatePct)}%`}</strong></div>
      </div>
      <WeightSparkline entries={entries} />
    </section>

    <section className="card progress-adherence-card">
      <div className="row-between"><div><p className="eyebrow red">ADERENZA</p><h2>Diario ultimi 7 giorni</h2></div><strong className="progress-adherence-score">{adherence.adherencePct == null ? '—' : `${adherence.adherencePct.toFixed(0)}%`}</strong></div>
      <div className="progress-bar"><span style={{ width: `${Math.max(0, Math.min(100, adherence.adherencePct || 0))}%` }} /></div>
      <p className="muted">{adherence.loggedDays} giorni registrati su 7. La valutazione usa la precisione su carboidrati, proteine e grassi.</p>
    </section>

    <section className={`card progress-recommendation ${recommendation.kind}`}>
      <div className="row-between"><div><p className="eyebrow red">TARGET ADATTIVO</p><h2>{recommendation.title}</h2></div><span className="progress-recommendation-badge">{recommendation.kind.toUpperCase()}</span></div>
      <p className="progress-recommendation-copy">{recommendation.reason}</p>
      <div className="progress-rule-row"><span>Aderenza minima</span><label><input type="number" min="70" max="100" step="1" value={settings.minAdherencePct} onChange={(event) => setSettings((current) => ({ ...current, minAdherencePct: Math.max(70, Math.min(100, Number(event.target.value) || 85)) }))} /><b>%</b></label></div>
      <div className="progress-rule-row"><span>Passo di modifica</span><label><input type="number" min="2" max="7" step="1" value={settings.adjustmentPct} onChange={(event) => setSettings((current) => ({ ...current, adjustmentPct: Math.max(2, Math.min(7, Number(event.target.value) || 5)) }))} /><b>%</b></label></div>
      {recommendation.proposedTarget && !alreadyAdjusted && <>
        <div className="progress-target-compare">
          <div><small>ATTUALE</small><strong>{target.carbs}C · {target.protein}P · {target.fat}F</strong><span>{kcalFromMacros(target).toFixed(0)} kcal</span></div>
          <b>→</b>
          <div><small>PROPOSTO</small><strong>{recommendation.proposedTarget.carbs}C · {recommendation.proposedTarget.protein}P · {recommendation.proposedTarget.fat}F</strong><span>{kcalFromMacros(recommendation.proposedTarget).toFixed(0)} kcal</span></div>
        </div>
        <button className="primary progress-apply-button" onClick={() => {
          onApplyTarget(recommendation.proposedTarget!);
          setLastAppliedDate(analysisDate);
          void setLocalValue(APPLIED_KEY, analysisDate);
          setMessage('Nuovo target applicato. App Nutrition attenderà un nuovo check-in prima di proporre un’altra correzione.');
        }}>Conferma e applica target</button>
      </>}
      {recommendation.proposedTarget && alreadyAdjusted && <div className="status progress-local-status">Correzione già applicata su questo check-in. Inserisci una nuova pesata prima di rivalutare il target.</div>}
    </section>

    {!!entries.length && <section className="card progress-history-card">
      <div className="row-between"><h2>Storico peso</h2><span className="saved-count">{entries.length}</span></div>
      <div className="progress-history-list">
        {[...entries].reverse().slice(0, 30).map((entry) => <div className="progress-history-row" key={entry.date}>
          <span><strong>{entry.weightKg.toFixed(1)} kg</strong><small>{dateLabel(entry.date)}{entry.note ? ` · ${entry.note}` : ''}</small></span>
          <button className="danger" onClick={() => setEntries((current) => deleteCheckIn(current, entry.date))}>Elimina</button>
        </div>)}
      </div>
    </section>}
  </>;
}
