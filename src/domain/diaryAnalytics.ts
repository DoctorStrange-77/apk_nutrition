import { shiftDateKey } from '@/domain/diary';
import { dayMacroAdherence } from '@/domain/progressAnalytics';
import { kcalFromMacros, macrosForManualMeal } from '@/domain/manualMenu';
import type { DiaryDay, DiaryMealFeedback } from '@/types/nutrition';

export interface DiarySeriesPoint {
  date: string;
  weightKg: number | null;
  weightAverage7Kg: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  stressLevel: number | null;
  energyLevel: number | null;
  hungerEvening: number | null;
  bloatingLevel: number | null;
  adherencePct: number | null;
}

export interface DiarySummary {
  loggedRecoveryDays: number;
  averageSleepHours: number | null;
  averageSleepQuality: number | null;
  averageStress: number | null;
  averageEnergy: number | null;
  averageEveningHunger: number | null;
  averageBloating: number | null;
  digestiveIssueFrequencyPct: number | null;
  averageAdherencePct: number | null;
}
export interface BristolDistributionItem {
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  count: number;
  percentage: number;
}

export type SmartDiaryInsightKind =
  | 'food_digestive_association'
  | 'weight_trend'
  | 'evening_hunger'
  | 'preworkout_digestive_association'
  | 'recovery_signal';

export interface SmartDiaryInsight {
  id: string;
  kind: SmartDiaryInsightKind;
  title: string;
  detail: string;
  sampleSize: number;
}

const average = (values:number[]):number | null =>
  values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null;

const validNumber = (value:unknown):value is number =>
  typeof value === 'number' && Number.isFinite(value);
const dateKeys = (endDate:string, windowDays:number):string[] => {
  const safeWindow = Math.max(1, Math.min(90, Math.floor(windowDays || 1)));
  return Array.from({length:safeWindow},(_,index) =>
    shiftDateKey(endDate, index - safeWindow + 1));
};

const recoveryDays = (
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays:number,
):DiaryDay[] => dateKeys(endDate,windowDays)
  .map((date)=>diaryDays[date])
  .filter((day):day is DiaryDay => !!day?.recovery);

const issueOnDay = (day:DiaryDay):boolean => {
  const recovery=day.recovery;
  if(!recovery) return false;
  return recovery.digestionQuality === 'heavy'
    || (recovery.bloatingLevel ?? 0) >= 5
    || !!recovery.reflux
    || !!recovery.abdominalDiscomfort;
};
export function buildDiarySeries(
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays=14,
):DiarySeriesPoint[] {
  const keys=dateKeys(endDate,windowDays);
  return keys.map((date,index)=>{
    const day=diaryDays[date];
    const recovery=day?.recovery;
    const rollingStart=Math.max(0,index-6);
    const weights=keys.slice(rollingStart,index+1)
      .map((key)=>diaryDays[key]?.recovery?.morningWeightKg)
      .filter(validNumber);
    return {
      date,
      weightKg:validNumber(recovery?.morningWeightKg) ? recovery!.morningWeightKg! : null,
      weightAverage7Kg:average(weights),
      sleepHours:validNumber(recovery?.sleepHours) ? recovery!.sleepHours! : null,
      sleepQuality:validNumber(recovery?.sleepQuality) ? recovery!.sleepQuality! : null,
      stressLevel:validNumber(recovery?.stressLevel) ? recovery!.stressLevel! : null,
      energyLevel:validNumber(recovery?.energyLevel) ? recovery!.energyLevel! : null,
      hungerEvening:validNumber(recovery?.hungerEvening) ? recovery!.hungerEvening! : null,
      bloatingLevel:validNumber(recovery?.bloatingLevel) ? recovery!.bloatingLevel! : null,
      adherencePct:day ? dayMacroAdherence(day) : null,
    };
  });
}
export function buildDiarySummary(
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays=7,
):DiarySummary {
  const days=recoveryDays(diaryDays,endDate,windowDays);
  const pick=(selector:(day:DiaryDay)=>number | undefined)=>
    days.map(selector).filter(validNumber);
  const adherence=dateKeys(endDate,windowDays)
    .map((key)=>diaryDays[key] ? dayMacroAdherence(diaryDays[key]) : null)
    .filter((value):value is number => value != null);
  const issueCount=days.filter(issueOnDay).length;
  return {
    loggedRecoveryDays:days.length,
    averageSleepHours:average(pick((day)=>day.recovery?.sleepHours)),
    averageSleepQuality:average(pick((day)=>day.recovery?.sleepQuality)),
    averageStress:average(pick((day)=>day.recovery?.stressLevel)),
    averageEnergy:average(pick((day)=>day.recovery?.energyLevel)),
    averageEveningHunger:average(pick((day)=>day.recovery?.hungerEvening)),
    averageBloating:average(pick((day)=>day.recovery?.bloatingLevel)),
    digestiveIssueFrequencyPct:days.length ? issueCount/days.length*100 : null,
    averageAdherencePct:average(adherence),
  };
}
export function buildBristolDistribution(
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays=30,
):BristolDistributionItem[] {
  const counts=[0,0,0,0,0,0,0];
  for(const day of recoveryDays(diaryDays,endDate,windowDays)){
    for(const movement of day.recovery?.bowelMovements || []){
      if(movement.bristolType >= 1 && movement.bristolType <= 7){
        counts[movement.bristolType-1]+=1;
      }
    }
  }
  const total=counts.reduce((sum,count)=>sum+count,0);
  return counts.map((count,index)=>({
    type:(index+1) as BristolDistributionItem['type'],
    count,
    percentage:total ? count/total*100 : 0,
  }));
}
const mealFeedbackIssue = (feedback:DiaryMealFeedback | undefined):boolean =>
  !!feedback && (
    feedback.digestionQuality === 'heavy'
    || (feedback.bloatingLevel ?? 0) >= 5
    || !!feedback.reflux
    || !!feedback.sleepiness
    || !!feedback.brainFog
  );

const foodDigestiveInsights = (
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays:number,
):SmartDiaryInsight[] => {
  const associations=new Map<string,{name:string;exposures:number;issues:number}>();
  for(const key of dateKeys(endDate,windowDays)){
    const day=diaryDays[key];
    if(!day?.mealFeedback) continue;
    for(const [mealId,feedback] of Object.entries(day.mealFeedback)){
      const meal=day.meals.find((item)=>item.id===mealId);
      if(!meal?.items.length) continue;
      const issue=mealFeedbackIssue(feedback);
      const uniqueFoods=new Map(meal.items.map((item)=>[item.food.id,item.food.name]));
      for(const [foodId,name] of uniqueFoods){
        const current=associations.get(foodId) || {name,exposures:0,issues:0};
        current.exposures+=1;
        if(issue) current.issues+=1;
        associations.set(foodId,current);
      }
    }
  }
  return [...associations.entries()]
    .filter(([,item])=>item.exposures>=3 && item.issues/item.exposures>=0.6)
    .sort((a,b)=>(b[1].issues/b[1].exposures)-(a[1].issues/a[1].exposures))
    .slice(0,3)
    .map(([foodId,item])=>({
      id:'food-digestive-'+foodId,
      kind:'food_digestive_association' as const,
      title:'Associazione digestiva ricorrente',
      detail:`${item.name} è stato associato a segnali digestivi in ${item.issues}/${item.exposures} pasti registrati.`,
      sampleSize:item.exposures,
    }));
};
const eveningHungerInsight = (
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays:number,
):SmartDiaryInsight | null => {
  const samples:{hunger:number;lateShare:number}[]=[];
  for(const key of dateKeys(endDate,windowDays)){
    const day=diaryDays[key];
    const hunger=day?.recovery?.hungerEvening;
    if(!day || !validNumber(hunger) || !day.meals.some((meal)=>meal.items.length)) continue;
    const mealKcal=day.meals.map((meal)=>kcalFromMacros(macrosForManualMeal(meal)));
    const total=mealKcal.reduce((sum,value)=>sum+value,0);
    if(total<=0) continue;
    const late=mealKcal.slice(-Math.min(2,mealKcal.length)).reduce((sum,value)=>sum+value,0);
    samples.push({hunger,lateShare:late/total*100});
  }
  const high=samples.filter((sample)=>sample.hunger>=7);
  if(high.length<3) return null;
  const avgHunger=average(high.map((sample)=>sample.hunger))!;
  const avgLate=average(high.map((sample)=>sample.lateShare))!;
  return {
    id:'evening-hunger',
    kind:'evening_hunger',
    title:'Fame serale ricorrente',
    detail:`In ${high.length} giorni con fame serale alta (media ${avgHunger.toFixed(1)}/10), gli ultimi due pasti hanno rappresentato in media il ${avgLate.toFixed(0)}% dell’energia registrata.`,
    sampleSize:high.length,
  };
};
const preworkoutInsight = (
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays:number,
):SmartDiaryInsight | null => {
  let highFatObservations=0;
  let highFatIssues=0;
  for(const key of dateKeys(endDate,windowDays)){
    const day=diaryDays[key];
    if(!day?.generatedMenu) continue;
    day.generatedMenu.meals.forEach((generated,index)=>{
      if(generated.workoutTiming!=='pre') return;
      const actualMeal=day.meals[index];
      if(!actualMeal?.items.length) return;
      const fat=macrosForManualMeal(actualMeal).fat;
      if(fat<15) return;
      highFatObservations+=1;
      if(mealFeedbackIssue(day.mealFeedback?.[actualMeal.id])) highFatIssues+=1;
    });
  }
  if(highFatObservations<3 || highFatIssues/highFatObservations<0.6) return null;
  return {
    id:'preworkout-fat-digestion',
    kind:'preworkout_digestive_association',
    title:'Segnale digestivo pre-workout',
    detail:`Nei pasti pre-workout registrati con almeno 15 g di grassi, segnali digestivi sono stati osservati in ${highFatIssues}/${highFatObservations} occasioni.`,
    sampleSize:highFatObservations,
  };
};
const weightTrendInsight = (
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays:number,
):SmartDiaryInsight | null => {
  const weights=buildDiarySeries(diaryDays,endDate,windowDays)
    .filter((point)=>point.weightKg!=null);
  if(weights.length<6) return null;
  const first=average(weights.slice(0,3).map((point)=>point.weightKg!))!;
  const last=average(weights.slice(-3).map((point)=>point.weightKg!))!;
  const delta=last-first;
  if(Math.abs(delta)<0.2) return null;
  return {
    id:'weight-trend',
    kind:'weight_trend',
    title:'Trend del peso',
    detail:`La media delle ultime 3 pesate è ${Math.abs(delta).toFixed(2)} kg ${delta<0?'più bassa':'più alta'} rispetto alle prime 3 del periodo osservato.`,
    sampleSize:weights.length,
  };
};

const recoveryInsight = (
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays:number,
):SmartDiaryInsight | null => {
  const summary=buildDiarySummary(diaryDays,endDate,windowDays);
  if(summary.loggedRecoveryDays<4) return null;
  if(summary.averageSleepHours!=null && summary.averageSleepHours<6.5
    && summary.averageEnergy!=null && summary.averageEnergy<=5.5){
    return {
      id:'sleep-energy-signal',
      kind:'recovery_signal',
      title:'Recovery da osservare',
      detail:`Su ${summary.loggedRecoveryDays} giorni registrati, sonno medio ${summary.averageSleepHours.toFixed(1)} h ed energia media ${summary.averageEnergy.toFixed(1)}/10 sono comparsi insieme.`,
      sampleSize:summary.loggedRecoveryDays,
    };
  }
  return null;
};
export function buildSmartDiaryInsights(
  diaryDays:Record<string,DiaryDay>,
  endDate:string,
  windowDays=30,
):SmartDiaryInsight[] {
  const insights:SmartDiaryInsight[]=[
    ...foodDigestiveInsights(diaryDays,endDate,windowDays),
  ];
  const optional=[
    eveningHungerInsight(diaryDays,endDate,windowDays),
    preworkoutInsight(diaryDays,endDate,windowDays),
    weightTrendInsight(diaryDays,endDate,windowDays),
    recoveryInsight(diaryDays,endDate,Math.min(windowDays,14)),
  ];
  for(const insight of optional){
    if(insight) insights.push(insight);
  }
  return insights;
}
