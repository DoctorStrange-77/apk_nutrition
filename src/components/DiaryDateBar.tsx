import { formatDiaryDate, isTodayKey } from '@/domain/diary';

type Props = {
  date: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickDate: () => void;
  onCopyDay: () => void;
};

export function DiaryDateBar({ date, onPrevious, onNext, onToday, onPickDate, onCopyDay }: Props) {
  const today = isTodayKey(date);
  return <section className="diary-date-card">
    <div className="diary-date-nav">
      <button className="date-arrow" onClick={onPrevious} aria-label="Giorno precedente">‹</button>
      <button className="date-main" onClick={onPickDate}>
        <small>{today ? 'OGGI' : 'DIARIO'}</small>
        <strong>{formatDiaryDate(date)}</strong>
      </button>
      <button className="date-arrow" onClick={onNext} aria-label="Giorno successivo">›</button>
    </div>
    <div className="diary-date-actions">
      {!today && <button className="ghost" onClick={onToday}>Oggi</button>}
      <button className="secondary" onClick={onPickDate}>Vai a data</button>
      <button className="secondary" onClick={onCopyDay}>Copia giornata</button>
    </div>
  </section>;
}
