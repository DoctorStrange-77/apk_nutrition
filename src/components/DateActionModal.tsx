import { useEffect, useMemo, useState } from 'react';
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
  navigate: { eyebrow: 'DIARIO', title: 'Seleziona una data', action: 'Apri giorno' },
  'copy-day': { eyebrow: 'COPIA GIORNATA', title: 'Scegli destinazione', action: 'Copia giornata' },
  'copy-meal': { eyebrow: 'COPIA PASTO', title: 'Scegli destinazione', action: 'Copia pasto' },
};

const fromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, Math.max(0, month - 1), day || 1);
};

const toKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export function DateActionModal({ open, mode, currentDate, onClose, onConfirm }: Props) {
  const [date, setDate] = useState(currentDate);
  const [visibleMonth, setVisibleMonth] = useState(() => fromKey(currentDate));

  useEffect(() => {
    if (!open) return;
    const initial = mode === 'navigate' ? currentDate : shiftDateKey(currentDate, 1);
    setDate(initial);
    setVisibleMonth(fromKey(initial));
  }, [open, mode, currentDate]);

  const cells = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { key: toKey(value), day: value.getDate(), currentMonth: value.getMonth() === visibleMonth.getMonth() };
    });
  }, [visibleMonth]);

  const selected = fromKey(date || localDateKey());
  const selectedLabel = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(selected);
  const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(visibleMonth);
  const label = labels[mode];

  return <AppModal open={open} title={label.title} eyebrow={label.eyebrow} onClose={onClose} wide>
    <div className="calendar-picker">
      <div className="calendar-selected"><small>DATA SELEZIONATA</small><strong>{selectedLabel}</strong></div>
      <div className="calendar-month-head">
        <button className="date-arrow" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} aria-label="Mese precedente">‹</button>
        <strong>{monthLabel}</strong>
        <button className="date-arrow" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} aria-label="Mese successivo">›</button>
      </div>
      <div className="calendar-weekdays">{['L','M','M','G','V','S','D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="calendar-days">
        {cells.map((cell) => <button key={cell.key} className={`${cell.currentMonth ? '' : 'outside'} ${cell.key === date ? 'selected' : ''} ${cell.key === localDateKey() ? 'today' : ''}`} onClick={() => setDate(cell.key)}>{cell.day}</button>)}
      </div>
      <div className="calendar-quick"><button className="secondary" onClick={() => { const today = localDateKey(); setDate(today); setVisibleMonth(fromKey(today)); }}>Oggi</button><button className="secondary" onClick={() => { const tomorrow = shiftDateKey(localDateKey(), 1); setDate(tomorrow); setVisibleMonth(fromKey(tomorrow)); }}>Domani</button></div>
      <div className="calendar-actions"><button className="ghost" onClick={onClose}>Annulla</button><button className="primary" disabled={!date} onClick={() => onConfirm(date)}>{label.action}</button></div>
    </div>
  </AppModal>;
}
