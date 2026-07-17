interface SiteHeaderProps {
  onHome: () => void
  onHowTo: () => void
}

/** Общая шапка: логотип → меню, «Как играть» справа. */
export function SiteHeader({ onHome, onHowTo }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button
          type="button"
          className="brand-mark site-header-brand"
          onClick={onHome}
          aria-label="На главную"
        >
          dndrun
        </button>
        <button type="button" className="btn btn-secondary btn-sm site-header-help" onClick={onHowTo}>
          Как играть
        </button>
      </div>
    </header>
  )
}
