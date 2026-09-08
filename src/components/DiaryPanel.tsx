import { useMemo, useState } from 'react';
import {
  addDiaryBowelMovement,
  formatDiaryDate,
  isTodayKey,
  removeDiaryBowelMovement,
  updateDiaryRecovery,
  upsertDiaryMealFeedback,
} from '@/domain/diary';
import { dayMacroAdherence } from '@/domain/progressAnalytics';
import { kcalFromMacros, macrosForManualDay } from '@/domain/manualMenu';
import type {
  DailyRecoveryLog,
  DiaryBowelMovement,
  DiaryDay,
  DiaryMealFeedback,
  DigestionQuality,
  TrainingContext,
} from '@/types/nutrition';

type Props = {
  date: string;
  day: DiaryDay;
  trainingContext: TrainingContext | null;
  onChangeDay: (day: DiaryDay) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickDate: () => void;
};
const numeric = (value:string, min:number, max:number):number | undefined => {
  if(value.trim()==='') return undefined;
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return undefined;
  return Math.max(min,Math.min(max,parsed));
};

const digestionLabels:Record<DigestionQuality,string>={
  light:'Leggera',
  normal:'Normale',
  heavy:'Pesante',
};

function ScaleField(props:{
  label:string;
  value?:number;
  min?:number;
  max?:number;
  onChange:(value:number)=>void;
}){
  const {label,value,min=1,max=10,onChange}=props;
  const display=value==null?'—':value.toFixed(0);
  return <label className="diary-scale-field">
    <span><small>{label}</small><strong>{display}/{max}</strong></span>
    <input
      type="range"
      min={min}
      max={max}
      step="1"
      value={value ?? Math.round((min+max)/2)}
      onChange={(event)=>onChange(Number(event.target.value))}
    />
  </label>;
}
function DigestionSelector(props:{
  value?:DigestionQuality;
  onChange:(value:DigestionQuality)=>void;
}){
  return <div className="diary-choice-row">
    {(Object.keys(digestionLabels) as DigestionQuality[]).map((value)=>
      <button
        key={value}
        type="button"
        className={props.value===value?'active':''}
        onClick={()=>props.onChange(value)}
      >{digestionLabels[value]}</button>
    )}
  </div>;
}

function SymptomToggle(props:{
  active?:boolean;
  label:string;
  onChange:(value:boolean)=>void;
}){
  return <button
    type="button"
    className={`diary-symptom-toggle ${props.active?'active':''}`}
    onClick={()=>props.onChange(!props.active)}
  >{props.label}</button>;
}

const bristolLabel=(type:number)=>{
  if(type<=2) return 'Tendenza dura';
  if(type<=4) return 'Intermedio';
  return 'Tendenza morbida';
};
export function DiaryPanel({
  date,
  day,
  trainingContext,
  onChangeDay,
  onPrevious,
  onNext,
  onToday,
  onPickDate,
}:Props){
  const recovery=day.recovery || {};
  const actual=useMemo(()=>macrosForManualDay(day.meals),[day.meals]);
  const adherence=dayMacroAdherence(day);
  const [bristolType,setBristolType]=useState<DiaryBowelMovement['bristolType']>(4);
  const [bowelTime,setBowelTime]=useState('08:00');
  const [precedingMealIds,setPrecedingMealIds]=useState<string[]>([]);

  const changeRecovery=(patch:Partial<DailyRecoveryLog>)=>
    onChangeDay(updateDiaryRecovery(day,patch));

  const changeFeedback=(mealId:string,patch:Omit<Partial<DiaryMealFeedback>,'mealId'>)=>
    onChangeDay(upsertDiaryMealFeedback(day,mealId,patch));

  const addBowel=()=>{
    const movement:DiaryBowelMovement={
      id:`bowel-${Date.now()}`,
      bristolType,
      timestamp:`${date}T${bowelTime}:00`,
      precedingMealIds:[...precedingMealIds],
    };
    onChangeDay(addDiaryBowelMovement(day,movement));
    setPrecedingMealIds([]);
  };
  return <div className="nutrition-recovery-diary">
    <section className="card diary-recovery-hero">
      <div className="diary-recovery-date-nav">
        <button type="button" className="date-arrow" onClick={onPrevious}>‹</button>
        <button type="button" className="date-main" onClick={onPickDate}>
          <small>{isTodayKey(date)?'OGGI':'DIARIO'}</small>
          <strong>{formatDiaryDate(date)}</strong>
        </button>
        <button type="button" className="date-arrow" onClick={onNext}>›</button>
      </div>
      <div className="diary-recovery-top-actions">
        {!isTodayKey(date) && <button type="button" className="ghost" onClick={onToday}>Oggi</button>}
        <button type="button" className="secondary" onClick={onPickDate}>Vai a data</button>
      </div>
      <div className="diary-recovery-badges">
        <span className={trainingContext?.isTrainingDay?'training':'rest'}>
          {trainingContext?.isTrainingDay?'TRAINING DAY':'REST DAY'}
        </span>
        <span className="local">LOCAL</span>
      </div>
    </section>

    <section className="card">
      <div className="row-between">
        <div><p className="eyebrow red">NUTRIZIONE REALE</p><h2>Giornata alimentare</h2></div>
        <strong className="diary-adherence-score">{adherence==null?'—':`${adherence.toFixed(0)}%`}</strong>
      </div>
      <div className="diary-nutrition-grid">
        <div><small>CARBOIDRATI</small><strong>{actual.carbs.toFixed(0)} / {day.target.carbs.toFixed(0)} g</strong></div>
        <div><small>PROTEINE</small><strong>{actual.protein.toFixed(0)} / {day.target.protein.toFixed(0)} g</strong></div>
        <div><small>GRASSI</small><strong>{actual.fat.toFixed(0)} / {day.target.fat.toFixed(0)} g</strong></div>
        <div><small>KCAL</small><strong>{kcalFromMacros(actual).toFixed(0)} / {kcalFromMacros(day.target).toFixed(0)}</strong></div>
      </div>
      <p className="muted">{day.meals.reduce((sum,meal)=>sum+meal.items.length,0)} alimenti registrati nei pasti di questa data.</p>
    </section>
    <section className="card">
      <div className="row-between"><div><p className="eyebrow red">RECOVERY</p><h2>Recupero giornaliero</h2></div></div>
      <div className="diary-recovery-input-grid">
        <label>Peso mattutino<input inputMode="decimal" type="number" min="20" max="400" step="0.1" value={recovery.morningWeightKg ?? ''} onChange={(event)=>changeRecovery({morningWeightKg:numeric(event.target.value,20,400)})}/><span>kg</span></label>
        <label>Acqua<input inputMode="decimal" type="number" min="0" max="12" step="0.1" value={recovery.waterLiters ?? ''} onChange={(event)=>changeRecovery({waterLiters:numeric(event.target.value,0,12)})}/><span>L</span></label>
        <label>Passi<input inputMode="numeric" type="number" min="0" max="100000" step="100" value={recovery.steps ?? ''} onChange={(event)=>changeRecovery({steps:numeric(event.target.value,0,100000)})}/></label>
        <label>Ore sonno<input inputMode="decimal" type="number" min="0" max="16" step="0.1" value={recovery.sleepHours ?? ''} onChange={(event)=>changeRecovery({sleepHours:numeric(event.target.value,0,16)})}/><span>h</span></label>
      </div>
      <div className="diary-scale-grid">
        <ScaleField label="QUALITÀ SONNO" value={recovery.sleepQuality} onChange={(value)=>changeRecovery({sleepQuality:value})}/>
        <ScaleField label="STRESS" value={recovery.stressLevel} onChange={(value)=>changeRecovery({stressLevel:value})}/>
        <ScaleField label="ENERGIA" value={recovery.energyLevel} onChange={(value)=>changeRecovery({energyLevel:value})}/>
      </div>
    </section>
    <section className="card">
      <div><p className="eyebrow red">FAME & SAZIETÀ</p><h2>Distribuzione della fame</h2></div>
      <div className="diary-scale-grid">
        <ScaleField label="MATTINO" value={recovery.hungerMorning} onChange={(value)=>changeRecovery({hungerMorning:value})}/>
        <ScaleField label="POMERIGGIO" value={recovery.hungerAfternoon} onChange={(value)=>changeRecovery({hungerAfternoon:value})}/>
        <ScaleField label="SERA" value={recovery.hungerEvening} onChange={(value)=>changeRecovery({hungerEvening:value})}/>
        <ScaleField label="SAZIETÀ GLOBALE" value={recovery.satietyLevel} onChange={(value)=>changeRecovery({satietyLevel:value})}/>
        <ScaleField label="CRAVING" value={recovery.cravingLevel} onChange={(value)=>changeRecovery({cravingLevel:value})}/>
      </div>
    </section>

    <section className="card">
      <div><p className="eyebrow red">DIGESTIONE</p><h2>Feedback gastrointestinale</h2></div>
      <div className="diary-digestion-block">
        <small>PERCEZIONE GENERALE</small>
        <DigestionSelector value={recovery.digestionQuality} onChange={(value)=>changeRecovery({digestionQuality:value})}/>
      </div>
      <ScaleField label="GONFIORE" value={recovery.bloatingLevel} min={0} max={10} onChange={(value)=>changeRecovery({bloatingLevel:value})}/>
      <div className="diary-symptom-grid">
        <SymptomToggle label="Reflusso" active={recovery.reflux} onChange={(value)=>changeRecovery({reflux:value})}/>
        <SymptomToggle label="Fastidio addominale" active={recovery.abdominalDiscomfort} onChange={(value)=>changeRecovery({abdominalDiscomfort:value})}/>
        <SymptomToggle label="Sonnolenza" active={recovery.sleepiness} onChange={(value)=>changeRecovery({sleepiness:value})}/>
        <SymptomToggle label="Brain fog" active={recovery.brainFog} onChange={(value)=>changeRecovery({brainFog:value})}/>
      </div>
    </section>
    <section className="card">
      <div className="row-between"><div><p className="eyebrow red">ALVO</p><h2>Scala Bristol</h2></div><span className="saved-count">{recovery.bowelMovements?.length || 0}</span></div>
      <div className="diary-bristol-selector">
        {([1,2,3,4,5,6,7] as const).map((type)=><button
          type="button"
          key={type}
          className={bristolType===type?'active':''}
          onClick={()=>setBristolType(type)}
        ><strong>{type}</strong><small>{bristolLabel(type)}</small></button>)}
      </div>
      <div className="diary-bowel-create">
        <label>Ora<input type="time" value={bowelTime} onChange={(event)=>setBowelTime(event.target.value)}/></label>
        <div className="diary-bowel-meals">
          <small>PASTI PRECEDENTI</small>
          <div>{day.meals.map((meal)=><button
            type="button"
            key={meal.id}
            className={precedingMealIds.includes(meal.id)?'active':''}
            onClick={()=>setPrecedingMealIds((current)=>current.includes(meal.id)?current.filter((id)=>id!==meal.id):[...current,meal.id])}
          >{meal.name}</button>)}</div>
        </div>
        <button type="button" className="primary" onClick={addBowel}>Registra evacuazione</button>
      </div>
      <div className="diary-bowel-list">
        {(recovery.bowelMovements || []).map((movement)=><div key={movement.id}>
          <span><strong>Bristol {movement.bristolType}</strong><small>{movement.timestamp.slice(11,16)} · {movement.precedingMealIds.length?movement.precedingMealIds.map((id)=>day.meals.find((meal)=>meal.id===id)?.name).filter(Boolean).join(', '):'nessun pasto associato'}</small></span>
          <button type="button" className="danger" onClick={()=>onChangeDay(removeDiaryBowelMovement(day,movement.id))}>Elimina</button>
        </div>)}
      </div>
    </section>
    <section className="card">
      <div><p className="eyebrow red">FEEDBACK PER PASTO</p><h2>Come hai risposto ai pasti</h2><p className="muted">I feedback vengono collegati agli alimenti realmente presenti nel pasto e alimentano gli Smart Insights locali.</p></div>
      <div className="diary-meal-feedback-list">
        {day.meals.map((meal)=>{
          const feedback=day.mealFeedback?.[meal.id] || {mealId:meal.id};
          return <article key={meal.id}>
            <div className="diary-meal-feedback-head">
              <span><strong>{meal.name}</strong><small>{meal.items.length?meal.items.map((item)=>item.food.name).join(' · '):'Nessun alimento registrato'}</small></span>
            </div>
            <div className="diary-scale-grid compact">
              <ScaleField label="FAME PRIMA" value={feedback.hungerBefore} onChange={(value)=>changeFeedback(meal.id,{hungerBefore:value})}/>
              <ScaleField label="SAZIETÀ DOPO" value={feedback.satietyAfter} onChange={(value)=>changeFeedback(meal.id,{satietyAfter:value})}/>
              <ScaleField label="GONFIORE" value={feedback.bloatingLevel} min={0} max={10} onChange={(value)=>changeFeedback(meal.id,{bloatingLevel:value})}/>
            </div>
            <div className="diary-digestion-block compact"><small>DIGESTIONE</small><DigestionSelector value={feedback.digestionQuality} onChange={(value)=>changeFeedback(meal.id,{digestionQuality:value})}/></div>
            <div className="diary-symptom-grid">
              <SymptomToggle label="Reflusso" active={feedback.reflux} onChange={(value)=>changeFeedback(meal.id,{reflux:value})}/>
              <SymptomToggle label="Sonnolenza" active={feedback.sleepiness} onChange={(value)=>changeFeedback(meal.id,{sleepiness:value})}/>
              <SymptomToggle label="Brain fog" active={feedback.brainFog} onChange={(value)=>changeFeedback(meal.id,{brainFog:value})}/>
            </div>
            <textarea rows={2} maxLength={180} placeholder="Nota sul pasto..." value={feedback.notes || ''} onChange={(event)=>changeFeedback(meal.id,{notes:event.target.value})}/>
          </article>;
        })}
      </div>
    </section>

    <section className="card">
      <div><p className="eyebrow red">NOTE</p><h2>Nota giornaliera</h2></div>
      <textarea className="diary-notes" rows={4} maxLength={500} placeholder="Contesto utile della giornata..." value={recovery.notes || ''} onChange={(event)=>changeRecovery({notes:event.target.value})}/>
    </section>
  </div>;
}
