import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  fullscreen?: boolean;
};

export function AppModal({ open, title, eyebrow, onClose, children, footer, wide = false, fullscreen = false }: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const syncViewport = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--app-visual-height', `${height}px`);
    };
    syncViewport();
    window.addEventListener('keydown', onKeyDown);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, [open, onClose]);

  if (!open) return null;
  const backdropClass = `modal-backdrop ${fullscreen ? 'modal-backdrop-fullscreen' : ''}`;
  const modalClass = `app-modal ${wide ? 'app-modal-wide' : ''} ${fullscreen ? 'app-modal-fullscreen' : ''}`;

  return (
    <div className={backdropClass} role="presentation" onMouseDown={onClose}>
      <section className={modalClass} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
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
