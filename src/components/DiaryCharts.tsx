import type { BristolDistributionItem, DiarySeriesPoint } from '@/domain/diaryAnalytics';

const dateShort=(date:string)=>new Date(`${date}T12:00:00`)
  .toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'});

const pathFor=(
  points:DiarySeriesPoint[],
  selector:(point:DiarySeriesPoint)=>number|null,
  minValue:number,
  maxValue:number,
)=>{
  const values=points
    .map((point,index)=>({index,value:selector(point)}))
    .filter((item):item is {index:number;value:number}=>item.value!=null);
  if(values.length<2) return '';
  const range=Math.max(0.0001,maxValue-minValue);
  return values.map((item,position)=>{
    const x=points.length<=1?50:item.index/(points.length-1)*100;
    const y=88-(item.value-minValue)/range*70;
    return `${position===0?'M':'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
};

function EmptyChart({text}:{text:string}){
  return <div className="diary-chart-empty">{text}</div>;
}
export function DiaryWeightChart({series}:{series:DiarySeriesPoint[]}){
  const weights=series.flatMap((point)=>[
    point.weightKg,
    point.weightAverage7Kg,
  ]).filter((value):value is number=>value!=null);
  if(weights.length<2) return <EmptyChart text="Servono almeno 2 pesate nel periodo." />;
  const min=Math.min(...weights)-0.3;
  const max=Math.max(...weights)+0.3;
  const rawPath=pathFor(series,(point)=>point.weightKg,min,max);
  const avgPath=pathFor(series,(point)=>point.weightAverage7Kg,min,max);
  return <div className="diary-chart-card">
    <div className="diary-chart-head">
      <span><small>PESO</small><strong>Trend + media mobile 7 giorni</strong></span>
      <span className="diary-chart-key"><i className="raw"/>Peso <i className="avg"/>Media 7 gg</span>
    </div>
    <svg className="diary-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Trend del peso">
      <line x1="0" y1="18" x2="100" y2="18" className="grid"/>
      <line x1="0" y1="53" x2="100" y2="53" className="grid"/>
      <line x1="0" y1="88" x2="100" y2="88" className="grid"/>
      {avgPath && <path d={avgPath} className="average"/>}
      {rawPath && <path d={rawPath} className="raw"/>}
    </svg>
    <div className="diary-chart-dates"><span>{dateShort(series[0].date)}</span><span>{dateShort(series[series.length-1].date)}</span></div>
  </div>;
}
export function DiaryRecoveryChart({series}:{series:DiarySeriesPoint[]}){
  const hasData=series.some((point)=>
    point.sleepQuality!=null || point.stressLevel!=null || point.energyLevel!=null);
  if(!hasData) return <EmptyChart text="Nessun dato recovery nel periodo." />;
  return <div className="diary-chart-card">
    <div className="diary-chart-head">
      <span><small>RECOVERY</small><strong>Sonno, stress ed energia</strong></span>
      <span className="diary-chart-key compact">
        <i className="sleep"/>Sonno <i className="stress"/>Stress <i className="energy"/>Energia
      </span>
    </div>
    <svg className="diary-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Recovery giornaliera">
      <line x1="0" y1="18" x2="100" y2="18" className="grid"/>
      <line x1="0" y1="53" x2="100" y2="53" className="grid"/>
      <line x1="0" y1="88" x2="100" y2="88" className="grid"/>
      <path d={pathFor(series,(point)=>point.sleepQuality,1,10)} className="sleep"/>
      <path d={pathFor(series,(point)=>point.stressLevel,1,10)} className="stress"/>
      <path d={pathFor(series,(point)=>point.energyLevel,1,10)} className="energy"/>
    </svg>
    <div className="diary-chart-dates"><span>{dateShort(series[0].date)}</span><span>{dateShort(series[series.length-1].date)}</span></div>
  </div>;
}
function MiniBars(props:{
  title:string;
  label:string;
  series:DiarySeriesPoint[];
  selector:(point:DiarySeriesPoint)=>number|null;
  max:number;
  suffix?:string;
}){
  const {title,label,series,selector,max,suffix=''}=props;
  const values=series.map(selector);
  if(!values.some((value)=>value!=null)) return <EmptyChart text={`Nessun dato ${label.toLowerCase()} nel periodo.`}/>;
  return <div className="diary-mini-chart">
    <div><small>{label}</small><strong>{title}</strong></div>
    <div className="diary-mini-bars">
      {series.map((point,index)=>{
        const value=selector(point);
        return <i
          key={point.date}
          className={value==null?'empty':''}
          style={{height:`${value==null?4:Math.max(6,Math.min(100,value/max*100))}%`}}
          title={value==null?dateShort(point.date):`${dateShort(point.date)}: ${value.toFixed(1)}${suffix}`}
        />;
      })}
    </div>
  </div>;
}

export function DiaryBehaviorCharts({series}:{series:DiarySeriesPoint[]}){
  return <div className="diary-behavior-grid">
    <MiniBars title="Fame serale" label="FAME" series={series} selector={(point)=>point.hungerEvening} max={10}/>
    <MiniBars title="Gonfiore" label="DIGESTIONE" series={series} selector={(point)=>point.bloatingLevel} max={10}/>
    <MiniBars title="Aderenza macro" label="ADERENZA" series={series} selector={(point)=>point.adherencePct} max={100} suffix="%"/>
  </div>;
}
export function BristolDistributionChart({items}:{items:BristolDistributionItem[]}){
  const total=items.reduce((sum,item)=>sum+item.count,0);
  if(!total) return <EmptyChart text="Nessuna evacuazione registrata nel periodo." />;
  const max=Math.max(1,...items.map((item)=>item.count));
  return <div className="diary-bristol-chart">
    <div className="diary-chart-head">
      <span><small>ALVO</small><strong>Distribuzione Bristol</strong></span>
      <b>{total} registrazioni</b>
    </div>
    <div className="diary-bristol-bars">
      {items.map((item)=><div key={item.type}>
        <span><i style={{height:`${Math.max(8,item.count/max*100)}%`}}/></span>
        <strong>{item.type}</strong>
        <small>{item.percentage.toFixed(0)}%</small>
      </div>)}
    </div>
  </div>;
}
