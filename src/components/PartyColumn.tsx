import { useMemo, useState } from 'react'
import { buildRadarVertices } from '../game/radar'
import { computeScore, rosterFromParty } from '../game/scoring'
import { swapSpells } from '../game/draft'
import type { AdventurerDef, RunState } from '../game/types'
import { AdventurerModal } from './AdventurerModal'
import { TeamRadar } from './TeamRadar'

interface PartyColumnProps {
  state: RunState
  onChange?: (state: RunState) => void
  /** Разрешить перетаскивание спеллов (ready). */
  spellDrag?: boolean
}

export function PartyColumn({ state, onChange, spellDrag }: PartyColumnProps) {
  const [modalAdv, setModalAdv] = useState<AdventurerDef | null>(null)
  const roster = rosterFromParty(state.party)
  const score = useMemo(
    () => computeScore(roster, state.spellPool, state.spellAssign, state.spellSlots),
    [roster, state.spellPool, state.spellAssign, state.spellSlots],
  )
  const vertices = useMemo(
    () => buildRadarVertices(state.party, state.spellPool, score.assignment),
    [state.party, state.spellPool, score.assignment],
  )

  const axes = score.axes

  return (
    <aside className="draft-left">
      <div className="draft-radar">
        <TeamRadar
          vertices={vertices}
          ovr={score.overall}
          onAdventurerClick={setModalAdv}
          spellDrag={spellDrag && Boolean(onChange)}
          onSpellSwap={(fromId, toId) => onChange?.(swapSpells(state, fromId, toId))}
          assignment={score.assignment}
        />

        {spellDrag && (
          <p className="spell-drag-hint">Спеллы рассажены автоматически — перетащи между героями.</p>
        )}

        {modalAdv && <AdventurerModal adventurer={modalAdv} onClose={() => setModalAdv(null)} />}
      </div>

      <div className="stat-block">
        <div className="stat-strip synergy-strip">
          <div className="stat-cell">
            <span className="stat-k">БАЗА</span>
            <span className="stat-v">{axes.base}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">ПОСАДКА</span>
            <span className="stat-v">{axes.roleFit >= 0 ? '+' : ''}{axes.roleFit}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">СТАТЫ</span>
            <span className="stat-v">{axes.statFit >= 0 ? '+' : ''}{axes.statFit}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">СПЕЛЛЫ</span>
            <span className="stat-v syn">{axes.spellFit >= 0 ? '+' : ''}{axes.spellFit}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">СВЯЗКИ</span>
            <span className="stat-v chem">{axes.bondFit >= 0 ? '+' : ''}{axes.bondFit}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">РОЛИ</span>
            <span className="stat-v">{axes.coverage >= 0 ? '+' : ''}{axes.coverage}</span>
          </div>
        </div>

        <div className="syn-columns">
          <div>
            <h4>СИНЕРГИЯ ЗАКЛИНАНИЙ</h4>
            {score.spellLines.length === 0 ? (
              <p className="none-yet">— пока пусто —</p>
            ) : (
              <ul>
                {score.spellLines.map((line) => {
                  const adv = roster.find((a) => a.id === line.adventurerId)
                  const idx = score.assignment[line.adventurerId]
                  const spellName =
                    idx !== null && idx !== undefined
                      ? state.spellSlots[idx]?.spell.name ??
                        state.spellPool[idx]?.name ??
                        line.spellId
                      : line.spellId
                  return (
                    <li key={line.adventurerId}>
                      <span className="pos">фит {line.fit}</span>{' '}
                      {adv?.name.split(' ')[0]} · {spellName}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div>
            <h4>СВЯЗКИ ОТРЯДА</h4>
            {score.chemTop.length === 0 ? (
              <p className="none-yet">— пока пусто —</p>
            ) : (
              <ul>
                {score.chemTop.map((c) => (
                  <li key={c.names.join('-')}>
                    <span className="pos">{c.games}</span>{' '}
                    {c.names.map((n) => n.split(' ')[0]).join(' + ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
