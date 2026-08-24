import { useEffect, useMemo, useState } from 'react';
import {
  ACTIVITY_FACTORS,
  DEFAULT_PROFILE,
  calculateProfile,
  inferActivityLevel,
  validateProfile,
  type ActivityLevel,
  type NutritionGoal,
  type UserNutritionProfile,
} from '@/domain/profileTdee';
import { kcalFromMacros } from '@/domain/manualMenu';
import { getLocalValue, setLocalValue } from '@/storage/localDatabase';
import type { MacroTarget } from '@/types/nutrition';

const PROFILE_KEY = 'nutrition-profile-v1';

type Props = {
  currentTarget: MacroTarget;
  onApplyTarget: (target: MacroTarget) => void;
};

const activityLabels: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario', light: 'Leggero', moderate: 'Moderato',
  active: 'Attivo', very_active: 'Molto attivo',
};
const goalLabels: Record<NutritionGoal, string> = {
  cut: 'Dimagrimento', maintain: 'Mantenimento', gain: 'Aumento massa',
};

const safe = (value: string, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function ProfilePanel({ currentTarget, onApplyTarget }: Props) {
  const [profile, setProfile] = useState<UserNutritionProfile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const saved = await getLocalValue<UserNutritionProfile>(PROFILE_KEY, DEFAULT_PROFILE);
      setProfile({ ...DEFAULT_PROFILE, ...saved });
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void setLocalValue(PROFILE_KEY, profile);
  }, [loaded, profile]);

  const calculation = useMemo(() => calculateProfile(profile), [profile]);
  const errors = useMemo(() => validateProfile(profile), [profile]);
  const suggestedActivity = inferActivityLevel(profile.averageSteps, profile.workoutsPerWeek);

  const setGoal = (goal: NutritionGoal) => {
    const adjustmentPct = goal === 'cut' ? 15 : goal === 'gain' ? 10 : 0;
    setProfile((current) => ({ ...current, goal, adjustmentPct }));
  };

  const applyTarget = () => {
    if (!calculation || errors.length) return;
    onApplyTarget(calculation.macros);
    setMessage(`Target applicato: ${calculation.macros.carbs.toFixed(0)}C · ${calculation.macros.protein.toFixed(0)}P · ${calculation.macros.fat.toFixed(0)}F.`);
  };

  return <>
    <section className="card profile-hero">
      <div className="row-between"><div><p className="eyebrow red">PROFILO</p><h2>Dati e metabolismo</h2></div><span className="profile-badge">TDEE</span></div>
      <p className="muted">Il profilo genera un punto di partenza. Nessun target viene modificato senza conferma.</p>
    </section>

    <section className="card profile-data-card">
      <div className="row-between"><div><p className="eyebrow red">ANAGRAFICA</p><h2>Dati personali</h2></div>{calculation && <strong>{calculation.age} anni</strong>}</div>
      <div className="profile-form-grid">
        <label>Nome<input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></label>
        <label>Cognome<input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} /></label>
        <label>Data di nascita<input type="date" value={profile.birthDate} onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })} /></label>
        <label>Altezza cm<input type="number" min="120" max="230" value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: safe(e.target.value) })} /></label>
        <label>Peso kg<input type="number" min="35" max="300" step="0.1" value={profile.weightKg} onChange={(e) => setProfile({ ...profile, weightKg: safe(e.target.value) })} /></label>
        <label>Body fat % <small>opzionale</small><input type="number" min="0" max="70" step="0.1" value={profile.bodyFatPct ?? ''} onChange={(e) => setProfile({ ...profile, bodyFatPct: e.target.value ? safe(e.target.value) : undefined })} /></label>
      </div>
      <div className="profile-segment two">
        <button className={profile.sex === 'male' ? 'active' : ''} onClick={() => setProfile({ ...profile, sex: 'male' })}>Uomo</button>
        <button className={profile.sex === 'female' ? 'active' : ''} onClick={() => setProfile({ ...profile, sex: 'female' })}>Donna</button>
      </div>
    </section>

    <section className="card profile-activity-card">
      <div><p className="eyebrow red">ATTIVITÀ</p><h2>Movimento quotidiano</h2></div>
      <div className="profile-form-grid">
        <label>Passi medi / giorno<input type="number" min="0" step="500" value={profile.averageSteps} onChange={(e) => setProfile({ ...profile, averageSteps: safe(e.target.value) })} /></label>
        <label>Allenamenti / settimana<input type="number" min="0" max="14" step="1" value={profile.workoutsPerWeek} onChange={(e) => setProfile({ ...profile, workoutsPerWeek: safe(e.target.value) })} /></label>
      </div>
      <div className="profile-activity-head"><span>Livello attività</span><button className="secondary small" onClick={() => setProfile({ ...profile, activityLevel: suggestedActivity })}>Usa stima: {activityLabels[suggestedActivity]}</button></div>
      <div className="profile-activity-grid">
        {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((level) => <button key={level} className={profile.activityLevel === level ? 'active' : ''} onClick={() => setProfile({ ...profile, activityLevel: level })}><strong>{activityLabels[level]}</strong><small>× {ACTIVITY_FACTORS[level]}</small></button>)}
      </div>
    </section>

    <section className="card profile-formula-card">
      <div><p className="eyebrow red">METABOLISMO</p><h2>Formula BMR</h2></div>
      <div className="profile-segment two">
        <button className={profile.formula === 'mifflin' ? 'active' : ''} onClick={() => setProfile({ ...profile, formula: 'mifflin' })}>Mifflin-St Jeor<small>Default</small></button>
        <button className={profile.formula === 'katch' ? 'active' : ''} onClick={() => setProfile({ ...profile, formula: 'katch' })}>Katch-McArdle<small>Richiede BF</small></button>
      </div>
    </section>

    <section className="card profile-goal-card">
      <div><p className="eyebrow red">OBIETTIVO</p><h2>Direzione calorica</h2></div>
      <div className="profile-goal-grid">
        {(['cut','maintain','gain'] as NutritionGoal[]).map((goal) => <button key={goal} className={profile.goal === goal ? 'active' : ''} onClick={() => setGoal(goal)}>{goalLabels[goal]}</button>)}
      </div>
      {profile.goal !== 'maintain' && <div className="profile-adjustment">
        <span>{profile.goal === 'cut' ? 'Deficit' : 'Surplus'}</span>
        <div className="profile-adjustment-presets">
          {(profile.goal === 'cut' ? [10,15,20] : [5,10,15]).map((value) => <button key={value} className={profile.adjustmentPct === value ? 'active' : ''} onClick={() => setProfile({ ...profile, adjustmentPct: value })}>{profile.goal === 'cut' ? '-' : '+'}{value}%</button>)}
        </div>
        <label>Personalizzato<input type="number" min="2" max="30" step="1" value={profile.adjustmentPct} onChange={(e) => setProfile({ ...profile, adjustmentPct: Math.abs(safe(e.target.value)) })} /><b>%</b></label>
      </div>}
    </section>

    <section className="card profile-macro-card">
      <div><p className="eyebrow red">MACRO</p><h2>Distribuzione proposta</h2></div>
      <div className="profile-form-grid two-only">
        <label>Proteine g/kg<input type="number" min="0.5" max="4" step="0.1" value={profile.proteinPerKg} onChange={(e) => setProfile({ ...profile, proteinPerKg: safe(e.target.value) })} /></label>
        <label>Grassi g/kg<input type="number" min="0.3" max="2" step="0.1" value={profile.fatPerKg} onChange={(e) => setProfile({ ...profile, fatPerKg: safe(e.target.value) })} /></label>
      </div>
      <p className="muted">I carboidrati occupano automaticamente le calorie residue dopo proteine e grassi.</p>
    </section>

    <section className="card profile-result-card">
      <div className="row-between"><div><p className="eyebrow red">RISULTATO</p><h2>TDEE e target</h2></div>{calculation && <span className="profile-badge">{calculation.formulaUsed === 'katch' ? 'KATCH' : 'MIFFLIN'}</span>}</div>
      {calculation ? <>
        <div className="profile-kpi-grid">
          <div><small>BMR</small><strong>{calculation.bmr.toFixed(0)}</strong><span>kcal</span></div>
          <div><small>FATTORE</small><strong>× {calculation.activityFactor}</strong><span>{activityLabels[profile.activityLevel]}</span></div>
          <div><small>TDEE</small><strong>{calculation.tdee.toFixed(0)}</strong><span>kcal</span></div>
          <div><small>TARGET</small><strong>{calculation.targetKcal.toFixed(0)}</strong><span>{calculation.adjustmentPct > 0 ? '+' : ''}{calculation.adjustmentPct}%</span></div>
        </div>
        <div className="profile-target-compare">
          <div><small>TARGET ATTUALE</small><strong>{currentTarget.carbs.toFixed(0)}C · {currentTarget.protein.toFixed(0)}P · {currentTarget.fat.toFixed(0)}F</strong><span>{kcalFromMacros(currentTarget).toFixed(0)} kcal</span></div>
          <b>→</b>
          <div><small>PROPOSTO</small><strong>{calculation.macros.carbs.toFixed(0)}C · {calculation.macros.protein.toFixed(0)}P · {calculation.macros.fat.toFixed(0)}F</strong><span>{kcalFromMacros(calculation.macros).toFixed(0)} kcal</span></div>
        </div>
      </> : <div className="profile-empty">Completa data di nascita, altezza e peso per calcolare il TDEE.</div>}

      {!!errors.length && <div className="profile-errors">{errors.map((error) => <span key={error}>{error}</span>)}</div>}
      {message && <div className="status profile-message">{message}</div>}
      <button className="primary profile-apply" disabled={!calculation || !!errors.length} onClick={applyTarget}>Conferma e applica target</button>
      <p className="profile-disclaimer">Il TDEE è una stima iniziale. I dati reali di peso e aderenza della sezione Progressi possono essere usati per rivalutarlo nel tempo.</p>
    </section>
  </>;
}
