import { describe, expect, it } from 'vitest';
import {
  buildBristolDistribution,
  buildDiarySeries,
  buildDiarySummary,
  buildSmartDiaryInsights,
} from '@/domain/diaryAnalytics';
import { makeDiaryDay } from '@/domain/diary';
import type { DiaryDay, LocalFood, ManualMeal } from '@/types/nutrition';

const rice:LocalFood = {
  id:'rice', name:'Riso basmati', category:'carb',
  carbs:78, protein:7, fat:1, suitable:['lunch','dinner'], source:'core',
};
const chicken:LocalFood = {
  id:'chicken', name:'Petto di pollo', category:'protein',
  carbs:0, protein:23, fat:2, suitable:['lunch','dinner'], source:'core',
};

const day = (date:string, weight:number, sleep:number, stress:number, energy:number, hunger:number):DiaryDay => {
  const meals:ManualMeal[] = [{
    id:'lunch-' + date,
    name:'Pranzo',
    items:[
      {id:'r-' + date, food:rice, grams:100},
      {id:'c-' + date, food:chicken, grams:150},
    ],
  }];
  const result = makeDiaryDay(date, {carbs:80,protein:45,fat:10}, 'rest', meals, null);
  result.recovery = {
    morningWeightKg:weight,
    sleepHours:sleep,
    sleepQuality:7,
    stressLevel:stress,
    energyLevel:energy,
    hungerEvening:hunger,
    bloatingLevel:2,
    bowelMovements:[],
  };
  return result;
};

describe('nutrition + recovery diary analytics', () => {
  it('builds chronological series with a rolling 7-day weight average and macro adherence', () => {
    const days:Record<string,DiaryDay> = {};
    for (let index=0; index<8; index+=1) {
      const date = `2026-09-${String(index+1).padStart(2,'0')}`;
      days[date] = day(date, 80 + index * 0.1, 7, 3, 8, 5);
    }
    const series = buildDiarySeries(days, '2026-09-08', 8);
    expect(series).toHaveLength(8);
    expect(series[7].weightAverage7Kg).toBeCloseTo(80.4, 4);
    expect(series[7].adherencePct).not.toBeNull();
    expect(series[0].date).toBe('2026-09-01');
  });

  it('summarizes recovery averages from only recorded values', () => {
    const days = {
      '2026-09-07':day('2026-09-07',80,6,6,5,8),
      '2026-09-08':day('2026-09-08',79.8,8,2,9,4),
    };
    const summary = buildDiarySummary(days,'2026-09-08',7);
    expect(summary.averageSleepHours).toBe(7);
    expect(summary.averageStress).toBe(4);
    expect(summary.averageEnergy).toBe(7);
    expect(summary.averageEveningHunger).toBe(6);
    expect(summary.loggedRecoveryDays).toBe(2);
  });

  it('builds a Bristol 1-7 distribution', () => {
    const d = day('2026-09-08',80,7,3,8,5);
    d.recovery!.bowelMovements = [
      {id:'b1',bristolType:4,timestamp:'2026-09-08T08:00:00Z',precedingMealIds:[]},
      {id:'b2',bristolType:4,timestamp:'2026-09-08T18:00:00Z',precedingMealIds:[]},
      {id:'b3',bristolType:2,timestamp:'2026-09-08T20:00:00Z',precedingMealIds:[]},
    ];
    const distribution = buildBristolDistribution({'2026-09-08':d},'2026-09-08',7);
    expect(distribution[3].count).toBe(2);
    expect(distribution[1].count).toBe(1);
    expect(distribution.reduce((sum,item)=>sum+item.count,0)).toBe(3);
  });

  it('surfaces repeated food/symptom association only after enough observations', () => {
    const days:Record<string,DiaryDay> = {};
    for (let index=1; index<=4; index+=1) {
      const date = `2026-09-0${index}`;
      const d = day(date,80,7,3,8,5);
      const mealId = d.meals[0].id;
      d.mealFeedback = {
        [mealId]:{
          mealId,
          digestionQuality:index <= 3 ? 'heavy' : 'normal',
          bloatingLevel:index <= 3 ? 7 : 1,
        },
      };
      days[date] = d;
    }
    const insights = buildSmartDiaryInsights(days,'2026-09-04',30);
    const foodInsight = insights.find((item)=>item.kind === 'food_digestive_association');
    expect(foodInsight?.detail).toContain('Riso basmati');
    expect(foodInsight?.detail).toContain('associato');
    expect(foodInsight?.sampleSize).toBe(4);
  });

  it('does not report a food association from only two exposures', () => {
    const days:Record<string,DiaryDay> = {};
    for (let index=1; index<=2; index+=1) {
      const date = `2026-09-0${index}`;
      const d = day(date,80,7,3,8,5);
      const mealId = d.meals[0].id;
      d.mealFeedback = {[mealId]:{mealId,digestionQuality:'heavy',bloatingLevel:8}};
      days[date]=d;
    }
    expect(buildSmartDiaryInsights(days,'2026-09-02',30).some((item)=>item.kind === 'food_digestive_association')).toBe(false);
  });
});

describe('additional Smart Diary insights', () => {
  it('flags recurrent evening hunger only after repeated observations', () => {
    const days:Record<string,DiaryDay> = {};
    for (let index=1; index<=3; index+=1) {
      const date=`2026-09-0${index}`;
      const d=day(date,80,7,3,8,8);
      days[date]=d;
    }
    const insight=buildSmartDiaryInsights(days,'2026-09-03',7)
      .find((item)=>item.kind==='evening_hunger');
    expect(insight?.sampleSize).toBe(3);
    expect(insight?.detail).toContain('fame serale alta');
  });

  it('reports a weight trend only with enough weigh-ins', () => {
    const days:Record<string,DiaryDay> = {};
    for(let index=0;index<6;index+=1){
      const date=`2026-09-${String(index+1).padStart(2,'0')}`;
      days[date]=day(date,80-index*0.2,7,3,8,5);
    }
    const insight=buildSmartDiaryInsights(days,'2026-09-06',7)
      .find((item)=>item.kind==='weight_trend');
    expect(insight?.sampleSize).toBe(6);
    expect(insight?.detail).toContain('più bassa');
  });

  it('reports a combined low-sleep low-energy recovery signal after four days', () => {
    const days:Record<string,DiaryDay> = {};
    for(let index=1;index<=4;index+=1){
      const date=`2026-09-0${index}`;
      days[date]=day(date,80,6,5,5,5);
    }
    const insight=buildSmartDiaryInsights(days,'2026-09-04',7)
      .find((item)=>item.kind==='recovery_signal');
    expect(insight?.sampleSize).toBe(4);
    expect(insight?.detail).toContain('sonno medio');
  });
});
