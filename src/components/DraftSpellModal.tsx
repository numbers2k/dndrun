import { CLASS_LABEL, spellLevelHint, spellLevelLabel } from '../data/labels'
import { tagTitle } from '../data/tags'
import type { CareerState } from '../game/career'
import { classRelationLabel, getBestClassesForSpell } from '../game/scoring'
import type { SpellDef } from '../game/types'
import { ROLE_LABEL_FULL } from '../game/types'

interface DraftSpellModalProps {
  spell: SpellDef
  career: CareerState
  onConfirm: () => void
  onClose: () => void
}

export function DraftSpellModal({ spell, career, onConfirm, onClose }: DraftSpellModalProps) {
  const topClasses = getBestClassesForSpell(spell, career.unlockedClasses, 5)
  const roleLine =
    spell.roles && spell.roles.length > 0
      ? spell.roles.map((r) => ROLE_LABEL_FULL[r]).join(', ')
      : null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={spell.name}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>{spell.name}</h2>
            <p title={spellLevelHint(spell.level)}>
              {spellLevelLabel(spell.level)} · {spell.school}
            </p>
            {roleLine && <p className="modal-fit">Хорошо для ролей: {roleLine}</p>}
            <p className="modal-blurb">{spell.blurb}</p>
            <p className="modal-stats-line">
              Давление {spell.pressure} · Контроль {spell.control} · Поддержка {spell.sustain}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {spell.tags.length > 0 && (
          <section>
            <h3>Теги</h3>
            <ul className="modal-tag-list">
              {spell.tags.map((tag) => (
                <li key={tag}>
                  <strong>{tag}</strong> — {tagTitle(tag)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Лучшие из открытых классов</h3>
          {topClasses.length === 0 ? (
            <p className="none-yet">— пока нечего показать —</p>
          ) : (
            <ul className="modal-class-list">
              {topClasses.map((row) => (
                <li key={row.classId}>
                  <strong>{CLASS_LABEL[row.classId]}</strong>
                  <span>{classRelationLabel(row)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="draft-pick-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            В пул
          </button>
        </footer>
      </div>
    </div>
  )
}
