import { AppModal } from '@/components/AppModal';
import type { TimingTemplate } from '@/types/nutrition';

type Props = {
  open: boolean;
  timings: TimingTemplate[];
  activeId: string;
  onClose: () => void;
  onSelect: (timingId: string) => void;
};

export function TimingSelectModal({ open, timings, activeId, onClose, onSelect }: Props) {
  return <AppModal open={open} title="Scegli il Timing" eyebrow="PASSO 2 - DISTRIBUZIONE PASTI" onClose={onClose}>
    <p className="choice-help">Scegli lo scenario che assomiglia alla tua giornata. Il Timing distribuisce i macro tra i pasti senza cambiare il target giornaliero.</p>
    <div className="choice-list timing-choice-list">
      {timings.map((timing) => {
        const active = timing.id === activeId;
        const kind = timing.dayKind === 'workout' ? 'Allenamento' : timing.dayKind === 'off' ? 'Riposo' : 'Generale';
        return <button key={timing.id} className={`choice-row timing-choice-row ${active ? 'active' : ''}`} onClick={() => { onSelect(timing.id); onClose(); }}>
          <span><strong>{timing.name}</strong><small>{kind} · {timing.meals.length} pasti</small>{timing.description && <em>{timing.description}</em>}</span>
          <b>{active ? '✓' : '›'}</b>
        </button>;
      })}
    </div>
  </AppModal>;
}
