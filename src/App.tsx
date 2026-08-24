import { useMemo, useState } from 'react';
import { calculateMealTargets, createEmptyTiming, timingTotals } from '@/domain/timing';

export function App() {
  const [carbs, setCarbs] = useState(300);
  const [protein, setProtein] = useState(180);
  const [fat, setFat] = useState(60);
  const [timing] = useState(() => createEmptyTiming('OMOGENEO - 5 PASTI', 5));

  const kcal = carbs * 4 + protein * 4 + fat * 9;
  const totals = timingTotals(timing);
  const mealTargets = useMemo(
    () => calculateMealTargets({ carbs, protein, fat }, timing),
    [carbs, protein, fat, timing],
  );

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">BUILDER NUTRITION</p>
        <h1>Menu automatici locali</h1>
        <p className="muted">Nessun login. I dati resteranno sul dispositivo.</p>
      </header>

      <section className="card">
        <h2>Target giornaliero</h2>
        <div className="macro-grid">
          <label>Carboidrati <input type="number" value={carbs} min="0" onChange={(e) => setCarbs(Number(e.target.value))} /> g</label>
          <label>Proteine <input type="number" value={protein} min="0" onChange={(e) => setProtein(Number(e.target.value))} /> g</label>
          <label>Grassi <input type="number" value={fat} min="0" onChange={(e) => setFat(Number(e.target.value))} /> g</label>
        </div>
        <strong>{kcal.toFixed(0)} kcal</strong>
      </section>

      <section className="card">
        <h2>Timing</h2>
        <p>{timing.name}</p>
        <p className="muted">Totali: C {totals.carbs.toFixed(0)}% · P {totals.protein.toFixed(0)}% · F {totals.fat.toFixed(0)}%</p>
        <div className="meal-list">
          {mealTargets.map((meal, index) => (
            <article key={index} className="meal-row">
              <strong>{meal.name}</strong>
              <span>C {meal.carbs.toFixed(1)} g</span>
              <span>P {meal.protein.toFixed(1)} g</span>
              <span>F {meal.fat.toFixed(1)} g</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card pending">
        <h2>Nutrition Engine V2</h2>
        <p>Il prossimo collegamento sarà: timing → alimenti → generazione → bilanciamento → menu locale.</p>
      </section>
    </main>
  );
}
