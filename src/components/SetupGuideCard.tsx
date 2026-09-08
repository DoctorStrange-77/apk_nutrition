type Props = {
  targetReady: boolean;
  timingReady: boolean;
  generated: boolean;
  activeTimingName: string;
  onProfile: () => void;
  onManualTarget: () => void;
  onTiming: () => void;
  onGenerate: () => void;
};

const StepState = ({ done }: { done: boolean }) => (
  <span className={`setup-step-state ${done ? 'done' : ''}`}>{done ? '✓' : '•'}</span>
);

export function SetupGuideCard(props: Props) {
  const { targetReady, timingReady, generated, activeTimingName, onProfile, onManualTarget, onTiming, onGenerate } = props;
  const readyToGenerate = targetReady && timingReady;

  return <section className="setup-guide-card">
    <div className="setup-guide-head">
      <div><p className="eyebrow red">PRIMO UTILIZZO</p><h2>Configura Smart Nutrition in 3 passaggi</h2></div>
      <span className="setup-progress-badge">{Number(targetReady) + Number(timingReady) + Number(generated)}/3</span>
    </div>
    <p className="setup-guide-intro">Per creare automaticamente il menu, imposta prima i macronutrienti giornalieri e il timing dei pasti.</p>
    <div className={`setup-step ${targetReady ? 'done' : 'current'}`}>
      <StepState done={targetReady} />
      <div className="setup-step-copy"><strong>1. Imposta i macronutrienti di partenza</strong><span>{targetReady ? 'Target confermato.' : 'Calcolali dal profilo oppure inseriscili manualmente.'}</span></div>
      {!targetReady && <div className="setup-step-actions"><button className="primary small" onClick={onProfile}>Calcola dal profilo</button><button className="secondary small" onClick={onManualTarget}>Inserisci manualmente</button></div>}
    </div>

    <div className={`setup-step ${timingReady ? 'done' : targetReady ? 'current' : 'locked'}`}>
      <StepState done={timingReady} />
      <div className="setup-step-copy"><strong>2. Scegli il timing</strong><span>{timingReady ? activeTimingName : 'Seleziona quando ti alleni e come distribuire i macronutrienti nei pasti.'}</span></div>
      {!timingReady && <button className="secondary small" disabled={!targetReady} onClick={onTiming}>Scegli timing</button>}
    </div>

    <div className={`setup-step ${generated ? 'done' : readyToGenerate ? 'current' : 'locked'}`}>
      <StepState done={generated} />
      <div className="setup-step-copy"><strong>3. Genera il primo menu</strong><span>{generated ? 'Configurazione completata.' : 'Smart Nutrition userà i macronutrienti impostati e il timing scelto per creare automaticamente la giornata.'}</span></div>
      {!generated && <button className="primary small" disabled={!readyToGenerate} onClick={onGenerate}>Crea il mio menu</button>}
    </div>
  </section>;
}
