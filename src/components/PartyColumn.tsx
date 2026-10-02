import { useMemo, useState } from 'react'
import { buildRadarVertices } from '../game/radar'
import { computeScore, rosterFromParty } from '../game/scoring'
import { chapterThreatBand } from '../game/simulate'
import { chapterPower } from '../game/causality'
import { swapSpells } from '../game/draft'
import { ROLE_LABEL_FULL, type AdventurerDef, type RunState } from '../game/types'
import { ROLE_VERB, roleCoverageLabel } from '../game/verbs'
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
  const [details, setDetails] = useState(false)
  const roster = rosterFromParty(state.party)
  const score = useMemo(
    () => computeScore(roster, state.spellPool, state.spellAssign, state.spellSlots),
    [roster, state.spellPool, state.spellAssign, state.spellSlots],
  )
  const vertices = useMemo(
    () => buildRadarVertices(state.party, state.spellPool, score.assignment),
    [state.party, state.spellPool, score.assignment],
  )
  const ahead = state.beat === 'camp'
  const chapter = Math.min(10, (state.upgradesTaken || 0) + (ahead ? 2 : 1))
  const threat = chapterThreatBand(chapter, state.difficultyThreat, state.runPath)
  const shown = chapterPower(score.overall, state.campaignMods, chapter)
  const axes = score.axes
  const verdict =
    shown >= threat.max ? 'запас есть' : shown >= threat.min ? 'на грани' : 'не хватит'

  return (
    <aside className="draft-left">
      <div className="stat-block">
        <ul className="party-roster">
          {roster.length === 0 && <li className="party-roster-empty">Пока никого. Возьми первую карту.</li>}
          {roster.map((adv) => (
            <li key={adv.id}>
              <span>{ROLE_LABEL_FULL[adv.role]}</span>
              <strong>
                {adv.name}
                <em>{ROLE_VERB[adv.role]}</em>
              </strong>
              <b>{adv.ovr}</b>
            </li>
          ))}
        </ul>
        <div className="power-hero">
          <span>{ahead ? 'Сила на следующую главу' : 'Сила'}</span>
          <strong>{roster.length === 0 ? '—' : shown}</strong>
          <em>
            {roleCoverageLabel(roster)} · гл.{chapter} ≈ {threat.min}–{threat.max}
            {roster.length > 0 ? ` · ${verdict}` : ''}
          </em>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetails((open) => !open)}>
          {details ? 'Скрыть оси' : 'Подробнее'}
        </button>

        {details && (
          <>
        <div className="draft-radar">
          <TeamRadar
            vertices={vertices}
            ovr={score.overall}
            onAdventurerClick={setModalAdv}
            spellDrag={spellDrag && Boolean(onChange) && roster.length > 1}
            onSpellSwap={(fromId, toId) => onChange?.(swapSpells(state, fromId, toId))}
            assignment={score.assignment}
          />
          {spellDrag && roster.length > 1 && (
            <p className="spell-drag-hint">
              Заклинание можно перетащить на другого героя — от этого меняется сила.
            </p>
          )}
          {modalAdv && <AdventurerModal adventurer={modalAdv} onClose={() => setModalAdv(null)} />}
        </div>
        <div className="stat-strip synergy-strip">
          <div className="stat-cell">
            <span className="stat-k">ГЕРОИ</span>
            <span className="stat-v">{axes.base}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">МЕСТА</span>
            <span className="stat-v">{axes.roleFit >= 0 ? '+' : ''}{axes.roleFit}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">СКЛАД</span>
            <span className="stat-v">{axes.statFit >= 0 ? '+' : ''}{axes.statFit}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-k">ЗАКЛИНАНИЯ</span>
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
                      <span className="pos">{line.fit}</span>{' '}
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
          </>
        )}
      </div>
    </aside>
  )
}
