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
  return (
    <AppModal open={open} title="Scegli timing" eyebrow="DISTRIBUZIONE PASTI" onClose={onClose}>
      <div className="choice-list">
        {timings.map((timing) => {
          const active = timing.id === activeId;
          return <button key={timing.id} className={`choice-row ${active ? 'active' : ''}`} onClick={() => { onSelect(timing.id); onClose(); }}>
            <span><strong>{timing.name}</strong><small>{timing.meals.length} pasti · {timing.dayKind}</small></span>
            <b>{active ? '✓' : '›'}</b>
          </button>;
        })}
      </div>
    </AppModal>
  );
}
