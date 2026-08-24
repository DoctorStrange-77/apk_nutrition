import { createPortal } from 'react-dom';

type Choice = { value: string; label: string; subtitle?: string };
type Props = { open: boolean; title: string; choices: Choice[]; value: string; onClose: () => void; onSelect: (value: string) => void };

export function ChoicePopup({ open, title, choices, value, onClose, onSelect }: Props) {
  if (!open) return null;
  return createPortal(
    <div className="choice-popup-backdrop" onMouseDown={onClose}>
      <section className="choice-popup" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header><h3>{title}</h3><button className="modal-close" onClick={onClose}>×</button></header>
        <div className="choice-list">
          {choices.map((choice) => <button key={choice.value} className={`choice-row ${choice.value === value ? 'active' : ''}`} onClick={() => { onSelect(choice.value); onClose(); }}>
            <span><strong>{choice.label}</strong>{choice.subtitle && <small>{choice.subtitle}</small>}</span><b>{choice.value === value ? '✓' : '›'}</b>
          </button>)}
        </div>
      </section>
    </div>,
    document.body,
  );
}
