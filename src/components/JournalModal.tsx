import { useState } from 'react'
import { CLASS_LABEL, RACE_LABEL } from '../data/labels'
import { ALL_CLASSES, ALL_RACES, SUBCLASSES } from '../data/pools'
import {
  INTRO_REGION_ID,
  MID_REGION_IDS,
  REGION_EXITS,
  REGION_MAP,
  regionsAtDepth,
} from '../data/regions'
import { SPELLS } from '../data/spells'
import type { CareerState } from '../game/career'

type JournalTab = 'regions' | 'races' | 'classes' | 'subclasses' | 'spells'

interface JournalModalProps {
  career: CareerState
  onClose: () => void
}

const TABS: { id: JournalTab; label: string }[] = [
  { id: 'regions', label: 'Края' },
  { id: 'races', label: 'Расы' },
  { id: 'classes', label: 'Классы' },
  { id: 'subclasses', label: 'Подклассы' },
  { id: 'spells', label: 'Заклинания' },
]

export function JournalModal({ career, onClose }: JournalModalProps) {
  const [tab, setTab] = useState<JournalTab>('regions')
  const seenRegions = new Set(career.seenRegions ?? [INTRO_REGION_ID])
  const seenSpells = new Set(career.seenSpellIds ?? [])
  const totalRegions = MID_REGION_IDS.length + 2

  const counts: Record<JournalTab, string> = {
    regions: `${seenRegions.size}/${totalRegions}`,
    races: `${career.seenRaces.length}/${ALL_RACES.length}`,
    classes: `${career.seenClasses.length}/${ALL_CLASSES.length}`,
    subclasses: `${career.seenSubclasses.length}/${SUBCLASSES.length}`,
    spells: `${seenSpells.size}/${SPELLS.length}`,
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card save-modal journal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 id="journal-title">Журнал</h2>
            <p>Записи гильдии о встреченном. Остальное — туман.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="journal-tabs" role="tablist" aria-label="Разделы журнала">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`journal-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="journal-tab-count">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        <div className="journal-body" role="tabpanel">
          {tab === 'regions' && (
            <section>
              <p className="journal-note">
                10 ярусов снизу вверх. Незнакомые края скрыты, пока не встретите дверь или не дойдёте.
              </p>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((depth) => {
                const ids = regionsAtDepth(depth)
                const anySeen = ids.some((id) => seenRegions.has(id))
                return (
                  <div key={depth} className="journal-depth">
                    <h4 className="journal-depth-label">Глава {depth}</h4>
                    {!anySeen ? (
                      <ul className="journal-grid">
                        <li className="journal-chip is-locked" title="Ещё не доходили">
                          ???
                        </li>
                      </ul>
                    ) : (
                      <ul className="journal-grid">
                        {ids.map((id) => {
                          const r = REGION_MAP[id]
                          const seen = seenRegions.has(id)
                          const exits = REGION_EXITS[id]
                            .filter((e) => seenRegions.has(e))
                            .map((e) => REGION_MAP[e]?.name)
                            .filter(Boolean)
                            .join(', ')
                          const tip = seen
                            ? exits
                              ? `${r.blurb} Дальше (знакомое): ${exits}.`
                              : r.blurb
                            : 'Ещё не встречали'
                          return (
                            <li
                              key={id}
                              className={`journal-chip ${seen ? 'is-open' : 'is-locked'}`}
                              title={tip}
                            >
                              {seen ? (
                                <>
                                  <strong>{r.name}</strong>
                                  <span className="journal-chip-blurb">{r.blurb}</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {tab === 'races' && (
            <ul className="journal-grid">
              {ALL_RACES.map((id) => {
                const seen = career.seenRaces.includes(id)
                return (
                  <li key={id} className={`journal-chip ${seen ? 'is-open' : 'is-locked'}`}>
                    {seen ? RACE_LABEL[id] : '—'}
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'classes' && (
            <ul className="journal-grid">
              {ALL_CLASSES.map((id) => {
                const seen = career.seenClasses.includes(id)
                return (
                  <li key={id} className={`journal-chip ${seen ? 'is-open' : 'is-locked'}`}>
                    {seen ? CLASS_LABEL[id] : '—'}
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'subclasses' && (
            <ul className="journal-grid">
              {SUBCLASSES.map((sc) => {
                const seen = career.seenSubclasses.includes(sc.id)
                return (
                  <li key={sc.id} className={`journal-chip ${seen ? 'is-open' : 'is-locked'}`}>
                    {seen ? sc.name : '—'}
                  </li>
                )
              })}
            </ul>
          )}

          {tab === 'spells' && (
            <ul className="journal-grid journal-spells">
              {SPELLS.map((s) => {
                const seen = seenSpells.has(s.id)
                return (
                  <li
                    key={s.id}
                    className={`journal-chip ${seen ? 'is-open' : 'is-locked'}`}
                    title={seen ? s.blurb : undefined}
                  >
                    {seen ? s.name : '—'}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
