type Tab = 'menu' | 'timing' | 'foods' | 'saved';

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

const items: Array<{ id: Tab; label: string; icon: JSX.Element }> = [
  {
    id: 'menu',
    label: 'Menu',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>,
  },
  {
    id: 'timing',
    label: 'Timing',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M9 2h6"/></svg>,
  },
  {
    id: 'foods',
    label: 'Alimenti',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7"/><path d="M4 3v4a3 3 0 0 0 6 0V3"/><path d="M7 10v11"/><path d="M16 3v18"/><path d="M16 3c3 2 4 5 4 8h-4"/></svg>,
  },
  {
    id: 'saved',
    label: 'Salvati',
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4z"/></svg>,
  },
];

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Navigazione principale">
      <div className="bottom-nav-inner">
        {items.map((item) => (
          <button key={item.id} className={`bottom-nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onChange(item.id)} aria-current={active === item.id ? 'page' : undefined}>
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
