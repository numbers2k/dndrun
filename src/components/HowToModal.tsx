interface HowToModalProps {
  onClose: () => void
}

export function HowToModal({ onClose }: HowToModalProps) {
  return (
    <div className="modal-backdrop howto-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card howto-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head howto-head">
          <div>
            <h2 id="howto-title">Как играть</h2>
            <p>Собери отряд по дороге и дойди до Немой Колокольни.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <ol className="howto-list">
          <li>Клик по карте берёт её. «ещё» — подробности, они не обязательны.</li>
          <li>Сначала один герой. Остальных находишь в лагере после главы.</li>
          <li>Дверь говорит, кто нужен. Сила отряда должна покрыть угрозу главы.</li>
          <li>Провал приносит пепел, чертёж или слух. Снова в путь — одна кнопка.</li>
        </ol>
        <footer className="howto-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  )
}
