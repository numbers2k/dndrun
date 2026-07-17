import { CLASS_LABEL, RACE_LABEL, spellLevelMark } from '../data/labels'
import { SPELLS } from '../data/spells'
import { SUBCLASS_MAP } from '../data/pools'
import { roleFitLabel } from '../game/generateAdventurer'
import { getBestSpellsFromPool } from '../game/scoring'
import type { AdventurerDef } from '../game/types'
import { ROLE_LABEL_FULL } from '../game/types'

interface AdventurerModalProps {
  adventurer: AdventurerDef
  onClose: () => void
}

export function AdventurerModal({ adventurer, onClose }: AdventurerModalProps) {
  const best = getBestSpellsFromPool(adventurer, SPELLS, 14)
  const classFits = best.filter((r) => r.classFit)
  const others = best.filter((r) => !r.classFit)
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
              {RACE_LABEL[adventurer.race]} · {CLASS_LABEL[adventurer.classId]}
              {subclass ? ` · ${subclass.name}` : ''} · {ROLE_LABEL_FULL[adventurer.role]} · рейтинг{' '}
              {adventurer.ovr}
            </p>
            <p className="modal-fit">
              Посадка: {roleFitLabel(adventurer.roleFit)} · удар {adventurer.impact} · ресурс{' '}
              {adventurer.economy} · надёжность {adventurer.reliability}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {classFits.length > 0 && (
          <section>
            <h3>Сильные для класса</h3>
            <div className="modal-spell-grid">
              {classFits.map((row) => (
                <div key={row.spell.id} className="modal-spell-row">
                  <div className="modal-spell-art">{spellLevelMark(row.spell.level)}</div>
                  <div>
                    <strong>{row.spell.name}</strong>
                    <span>
                      фит {row.fit.toFixed(1)} · {row.spell.school}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3>{classFits.length > 0 ? 'Другие варианты' : 'Лучшие заклинания'}</h3>
          <div className="modal-spell-grid">
            {(classFits.length > 0 ? others : best).slice(0, 8).map((row) => (
              <div key={row.spell.id} className="modal-spell-row">
                <div className="modal-spell-art">{spellLevelMark(row.spell.level)}</div>
                <div>
                  <strong>{row.spell.name}</strong>
                  <span>
                    фит {row.fit.toFixed(1)} · {row.spell.school}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
