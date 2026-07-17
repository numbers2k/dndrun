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
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head howto-head">
          <div>
            <h2 id="howto-title">Как играть в dndrun</h2>
            <p>
              Собери 5 авантюристов и 5 заклинаний → пройди Великий Поход (100 испытаний). Открывай
              расы, классы и тиры спеллов между забегами.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="howto-body">
          <div className="howto-grid">
            <section>
              <h3>Ход игры</h3>
              <ol className="howto-list">
                <li>Создай кампанию в одном из трёх слотов: имя отряда и сложность (навсегда).</li>
                <li>Собери 5 героев и 5 заклинаний на экране драфта.</li>
                <li>После 5+5: начать Поход или бросить отряд и собрать заново.</li>
                <li>Кадр похода появляется ниже; пауза ~1 с, затем при необходимости откат ленты; ~1.75 с на этап (есть Пропуск).</li>
                <li>После босса — резюме и три усиления; после провала/короны — кадр итогов.</li>
              </ol>
            </section>

            <section>
              <h3>Читай карты</h3>
              <ul className="howto-list">
                <li>У героев: посадка роли, удар / ресурс / надёжность и теги в попапе.</li>
                <li>У спеллов: давление / контроль / поддержка, короткий эффект и теги.</li>
                <li>Любая роль доступна любому классу — но слабая посадка бьёт по силе.</li>
              </ul>
            </section>

            <section>
              <h3>Сила отряда</h3>
              <ul className="howto-list">
                <li>База, посадка, статы под роль, фит спеллов, связки, покрытие ролей.</li>
                <li>Антисинергия штрафует «стеклянных» героев и тяжёлые спеллы без ресурса.</li>
                <li>Дыры в ролях ослабляют отряд — но моносостав разрешён.</li>
              </ul>
            </section>

            <section>
              <h3>Великий Поход</h3>
              <p>
                Три кадра на одной странице: драфт → поход → итоги. После провала или короны итоги
                открываются не сразу — сначала ~3 с видно этап на ленте, затем кадр итогов и футер.
                Новый забег откатывает путь к этапу 1, открытия карьеры остаются.
              </p>
            </section>

            <section>
              <h3>Кампания и теги</h3>
              <ul className="howto-list">
                <li>Лучший этап открывает расы, классы, подклассы и тиры спеллов.</li>
                <li>
                  Теги: <strong>фронт</strong> — держит удар; <strong>стекло</strong> — сыпется под
                  давлением; <strong>давление</strong> — сильный удар; <strong>ритуал</strong> —
                  тянет дорогие спеллы; <strong>посадка+</strong> — роль сидит хорошо.
                </li>
                <li>Наведи на тег — увидишь короткое пояснение.</li>
              </ul>
            </section>

            <div className="howto-cell-empty" aria-hidden="true" />
          </div>
        </div>

        <footer className="howto-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Понятно, в путь
          </button>
        </footer>
      </div>
    </div>
  )
}
