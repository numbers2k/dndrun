import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  CLASS_LABEL,
  RACE_LABEL,
  spellLevelHint,
  spellLevelLabel,
} from '../data/labels'
import { getSaveById, loadCareer } from '../game/career'
import {
  canPickAdventurer,
  canPickSpell,
  commitDraft,
  pickAdventurer,
  pickSpell,
  reroll,
  startRunFromSave,
} from '../game/draft'
import { createSeed } from '../game/rng'
import { chapterThreatBand } from '../game/simulate'
import { computeScore, partyCount, rosterFromParty } from '../game/scoring'
import type { AdventurerDef, CurrentPack, RunState, SpellDef } from '../game/types'
import { PARTY_SIZE, ROLE_LABEL_FULL } from '../game/types'
import { DraftAdventurerModal } from './DraftAdventurerModal'
import { DraftSpellModal } from './DraftSpellModal'
import { PartyColumn } from './PartyColumn'

interface DraftScreenProps {
  state: RunState
  onChange: (state: RunState) => void
}

type PickTarget =
  | { kind: 'adventurer'; adventurer: AdventurerDef }
  | { kind: 'spell'; spell: SpellDef }

type FlipPhase = 'idle' | 'flipping'

const FLIP_MS = 560
const FLIP_MID_MS = 280

function shellClass(flipping: boolean): string {
  return flipping ? 'pack-flip-shell is-flipping' : 'pack-flip-shell'
}

function shellStyle(flipping: boolean): CSSProperties {
  if (!flipping) return {}
  return {
    animation: `pack-flip ${FLIP_MS}ms cubic-bezier(0.37, 0.0, 0.2, 1) both`,
  }
}

export function DraftScreen({ state, onChange }: DraftScreenProps) {
  const pack = state.current
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [displayPack, setDisplayPack] = useState<CurrentPack | null>(pack)
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('idle')
  const firstPack = useRef(true)
  const pendingPack = useRef<CurrentPack | null>(null)
  const shownIdRef = useRef<string | null>(pack?.id ?? null)

  useEffect(() => {
    if (!pack) {
      setDisplayPack(null)
      setFlipPhase('idle')
      pendingPack.current = null
      shownIdRef.current = null
      return
    }

    if (firstPack.current) {
      firstPack.current = false
      setDisplayPack(pack)
      shownIdRef.current = pack.id
      setFlipPhase('idle')
      return
    }

    if (shownIdRef.current === pack.id) return

    pendingPack.current = pack
    setFlipPhase('flipping')

    const mid = window.setTimeout(() => {
      setDisplayPack(pendingPack.current)
      shownIdRef.current = pendingPack.current?.id ?? null
    }, FLIP_MID_MS)

    const end = window.setTimeout(() => {
      setFlipPhase('idle')
      pendingPack.current = null
    }, FLIP_MS)

    return () => {
      window.clearTimeout(mid)
      window.clearTimeout(end)
    }
  }, [pack])

  const career = useMemo(() => {
    if (state.activeSaveId) {
      return getSaveById(state.activeSaveId)?.career ?? loadCareer()
    }
    return loadCareer()
  }, [state.activeSaveId])

  const save = useMemo(
    () => (state.activeSaveId ? getSaveById(state.activeSaveId) : null),
    [state.activeSaveId],
  )

  const heroesCount = partyCount(state.party)
  const spellsCount = state.spellPool.length
  const flipping = flipPhase === 'flipping'
  const shown = displayPack
  const locked = state.pendingCommit || state.screen === 'campaign'
  const awaitingStart = state.pendingCommit
  const inCampaign = state.screen === 'campaign'
  const commitScore = useMemo(() => {
    if (!awaitingStart) return null
    const roster = rosterFromParty(state.party)
    return computeScore(roster, state.spellPool, state.spellAssign, state.spellSlots)
  }, [
    awaitingStart,
    state.party,
    state.spellPool,
    state.spellAssign,
    state.spellSlots,
  ])
  const ch1Threat = useMemo(() => {
    if (!awaitingStart) return null
    return chapterThreatBand(1, state.difficultyThreat, state.runPath)
  }, [awaitingStart, state.difficultyThreat, state.runPath])

  return (
    <>
      <div className="draft-322 has-pack-hint">
        <PartyColumn state={state} onChange={onChange} spellDrag={awaitingStart} />

        <section className="draft-right">
          <div className="draft-pack-col">
          <div className={`draft-pack ${locked ? 'is-locked' : ''}`}>
            <header className="team-header">
              <div>
                <h2>{state.teamName}</h2>
                <p className="pack-meta">
                  Герои {heroesCount}/{PARTY_SIZE} · Заклинания {spellsCount}/{PARTY_SIZE}
                  {awaitingStart || inCampaign ? ' · Отряд собран' : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm reroll-btn"
                disabled={state.rerollsLeft <= 0 || flipping || locked}
                onClick={() => onChange(reroll(state))}
              >
                ↻ Переброс ({state.rerollsLeft})
              </button>
            </header>

            <div className="section-label">АВАНТЮРИСТЫ</div>
            <div className="pack-row five">
              {(shown?.adventurers ?? []).map((adv, idx) => {
                return (
                  <div
                    key={`adv-slot-${idx}`}
                    className={shellClass(flipping)}
                    style={shellStyle(flipping)}
                  >
                    <button
                      type="button"
                      className={`player-card pickable compact rarity-${adv.rarity}`}
                      disabled={!canPickAdventurer(state, adv) || flipping}
                      onClick={() => setPick({ kind: 'adventurer', adventurer: adv })}
                    >
                      <span className="role-badge">{ROLE_LABEL_FULL[adv.role]}</span>
                      <strong className="player-name">{adv.name}</strong>
                      <span className="player-sub player-sub-stack">
                        <span>{RACE_LABEL[adv.race]}</span>
                        <span>{CLASS_LABEL[adv.classId]}</span>
                      </span>
                      <div className="mini-stats">
                        <span>
                          <em>УДР</em> {adv.impact}
                        </span>
                        <span>
                          <em>РЕС</em> {adv.economy}
                        </span>
                        <span>
                          <em>НАД</em> {adv.reliability}
                        </span>
                      </div>
                      <span className="big-rating" aria-hidden="true">
                        {adv.ovr}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="section-label">ЗАКЛИНАНИЯ</div>
            <div className="pack-row five">
              {(shown?.spells ?? []).map((spell, idx) => {
                return (
                  <div
                    key={`spell-slot-${idx}`}
                    className={shellClass(flipping)}
                    style={shellStyle(flipping)}
                  >
                    <button
                      type="button"
                      className={`player-card pickable compact is-spell rarity-${spell.rarity}`}
                      disabled={!canPickSpell(state, spell) || flipping}
                      onClick={() => setPick({ kind: 'spell', spell })}
                      title={spellLevelHint(spell.level)}
                    >
                      <span className="role-badge">{spellLevelLabel(spell.level)}</span>
                      <strong className="player-name">{spell.name}</strong>
                      <span className="player-sub">{spell.school}</span>
                      <div className="mini-stats">
                        <span>
                          <em>ДАВ</em> {spell.pressure}
                        </span>
                        <span>
                          <em>КОН</em> {spell.control}
                        </span>
                        <span>
                          <em>ПОД</em> {spell.sustain}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {awaitingStart ? (
            <div className="draft-commit">
              {commitScore && ch1Threat && (
                <p className="draft-threat-preview">
                  Сила отряда <strong>{commitScore.overall}</strong>
                  {' · '}
                  гл.1 угроза ≈ {ch1Threat.min}–{ch1Threat.max}
                  {commitScore.overall >= ch1Threat.max
                    ? ' — запас есть'
                    : commitScore.overall >= ch1Threat.min
                      ? ' — на грани'
                      : ' — будет туго'}
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => onChange(commitDraft(state))}
              >
                Начать вылазку →
              </button>
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={() => {
                  if (!save) return
                  onChange(startRunFromSave(state, save, createSeed()))
                  window.scrollTo({ top: 0, behavior: 'auto' })
                }}
              >
                Бросить отряд
              </button>
            </div>
          ) : null}
          </div>

          {!inCampaign ? (
            <div className="help-box">
              <p>
                <strong>Кликни карту</strong> — откроются подробности. В отряд или пул заклинаний карта
                попадёт только после твоего подтверждения.
              </p>
              <ul className="help-glossary">
                <li>
                  <strong>База</strong> — средний личный рейтинг героев. Основа силы отряда.
                </li>
                <li>
                  <strong>Посадка</strong> — насколько роли сидят на классе и расе. Слабая посадка режет
                  вклад героя.
                </li>
                <li>
                  <strong>Статы</strong> — удар, ресурс и надёжность под роль: ударник любит давление,
                  поддержка — ресурс и стабильность.
                </li>
                <li>
                  <strong>Спеллы</strong> — насколько пул и авторассадка подходят классам и ролям отряда.
                </li>
                <li>
                  <strong>Связки</strong> — бонусы за сочетания героев друг с другом.
                </li>
                <li>
                  <strong>Роли</strong> — покрытие пяти ролей. Дыры ослабляют отряд, моносостав всё ещё
                  возможен.
                </li>
              </ul>
              <p className="help-note">Из набора берёшь только одно: героя или заклинание.</p>
            </div>
          ) : null}
        </section>
      </div>

      {pick?.kind === 'adventurer' && !locked && (
        <DraftAdventurerModal
          adventurer={pick.adventurer}
          career={career}
          onClose={() => setPick(null)}
          onConfirm={() => {
            onChange(pickAdventurer(state, pick.adventurer))
            setPick(null)
          }}
        />
      )}

      {pick?.kind === 'spell' && !locked && (
        <DraftSpellModal
          spell={pick.spell}
          career={career}
          onClose={() => setPick(null)}
          onConfirm={() => {
            onChange(pickSpell(state, pick.spell))
            setPick(null)
          }}
        />
      )}
    </>
  )
}
