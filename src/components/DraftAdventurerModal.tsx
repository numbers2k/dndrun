import { CLASS_LABEL, RACE_LABEL } from '../data/labels'
import { SUBCLASS_MAP } from '../data/pools'
import { tagTitle } from '../data/tags'
import type { CareerState } from '../game/career'
import { rarityLabel, roleFitLabel } from '../game/generateAdventurer'
import { getBestCareerSpells, spellRelationLabel } from '../game/scoring'
import type { AdventurerDef } from '../game/types'
import { ROLE_LABEL_FULL } from '../game/types'

interface DraftAdventurerModalProps {
  adventurer: AdventurerDef
  career: CareerState
  onConfirm: () => void
  onClose: () => void
}

export function DraftAdventurerModal({
  adventurer,
  career,
  onConfirm,
  onClose,
}: DraftAdventurerModalProps) {
  const best = getBestCareerSpells(adventurer, career, 5)
  const subclass = adventurer.subclassId ? SUBCLASS_MAP[adventurer.subclassId] : null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={adventurer.name}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>{adventurer.name}</h2>
            <p>
              {ROLE_LABEL_FULL[adventurer.role]} · {RACE_LABEL[adventurer.race]} ·{' '}
              {CLASS_LABEL[adventurer.classId]}
              {subclass ? ` · ${subclass.name}` : ''} ·{' '}
              <span className={`rarity-tag rarity-${adventurer.rarity}`}>
                {rarityLabel(adventurer.rarity)}
              </span>
            </p>
            <p className="modal-fit">
              Посадка роли: {roleFitLabel(adventurer.roleFit)}
            </p>
            <p className="modal-stats-line">
              Удар {adventurer.impact} · Ресурс {adventurer.economy} · Надёжность{' '}
              {adventurer.reliability} · Личный рейтинг {adventurer.ovr}
            </p>
            {adventurer.quirk && <p className="modal-quirk">{adventurer.quirk}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {adventurer.tags.length > 0 && (
          <section>
            <h3>Теги</h3>
            <ul className="modal-tag-list">
              {adventurer.tags.map((tag) => (
                <li key={tag}>
                  <strong>{tag}</strong> — {tagTitle(tag)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Из знакомых заклинаний</h3>
          {best.length === 0 ? (
            <p className="none-yet">— пока мало знакомых спеллов —</p>
          ) : (
            <ul className="modal-class-list">
              {best.map((row) => (
                <li key={row.spell.id}>
                  <strong>{row.spell.name}</strong>
                  <span>
                    {spellRelationLabel(row)} · {row.spell.school}
                  </span>
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
            В отряд
          </button>
        </footer>
      </div>
    </div>
  )
}
