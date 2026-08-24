import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

export function AppModal({ open, title, eyebrow, onClose, children, footer, wide = false }: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`app-modal ${wide ? 'app-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <header className="modal-header">
          <div>{eyebrow && <p className="eyebrow red">{eyebrow}</p>}<h2>{title}</h2></div>
          <button className="modal-close" type="button" aria-label="Chiudi" onClick={onClose}>×</button>
        </header>
        <div className="modal-scroll">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}
