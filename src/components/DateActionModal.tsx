import { useEffect, useState } from 'react';
import { AppModal } from '@/components/AppModal';
import { localDateKey, shiftDateKey } from '@/domain/diary';

type Mode = 'navigate' | 'copy-day' | 'copy-meal';

type Props = {
  open: boolean;
  mode: Mode;
  currentDate: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
};

const labels: Record<Mode, { eyebrow: string; title: string; action: string }> = {
  navigate: { eyebrow: 'DIARIO', title: 'Vai a una data', action: 'Apri giorno' },
  'copy-day': { eyebrow: 'COPIA GIORNATA', title: 'Scegli destinazione', action: 'Copia giornata' },
  'copy-meal': { eyebrow: 'COPIA PASTO', title: 'Scegli destinazione', action: 'Copia pasto' },
};

export function DateActionModal({ open, mode, currentDate, onClose, onConfirm }: Props) {
  const [date, setDate] = useState(currentDate);
  useEffect(() => {
    if (!open) return;
    setDate(mode === 'navigate' ? currentDate : shiftDateKey(currentDate, 1));
  }, [open, mode, currentDate]);

  const label = labels[mode];
  return <AppModal open={open} title={label.title} eyebrow={label.eyebrow} onClose={onClose}>
    <div className="date-modal-body">
      <label className="date-input-label">Data
        <input type="date" value={date || localDateKey()} onChange={(event) => setDate(event.target.value)} />
      </label>
      <div className="date-quick-grid">
        <button className="secondary" onClick={() => setDate(shiftDateKey(currentDate, -1))}>Ieri</button>
        <button className="secondary" onClick={() => setDate(localDateKey())}>Oggi</button>
        <button className="secondary" onClick={() => setDate(shiftDateKey(currentDate, 1))}>Domani</button>
      </div>
      <button className="primary modal-main-action" disabled={!date} onClick={() => onConfirm(date)}>{label.action}</button>
    </div>
  </AppModal>;
}
