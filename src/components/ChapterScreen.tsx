import { useEffect, useMemo, useRef, useState } from 'react'
import { REGION_MAP } from '../data/regions'
import { getSaveById, loadCareer, type CareerState } from '../game/career'
import { chapterCauses, chapterPower } from '../game/causality'
import {
  applyCampChoice,
  applyEventChoice,
  applyRouteChoice,
  applySpellUpgrade,
  campBlocked,
  canPickAdventurer,
  canPickSpell,
  leaveCamp,
  pickAdventurer,
  pickSpell,
  reroll,
  skipToNext,
} from '../game/draft'
import { needCovered, regionNeeds } from '../game/needs'
import { chapterThreatBand } from '../game/simulate'
import { computeScore, rosterFromParty } from '../game/scoring'
import type { AdventurerDef, RunState, SpellDef } from '../game/types'
import { heroHint, roleCoverageLabel, spellHint } from '../game/verbs'
import { DraftAdventurerModal } from './DraftAdventurerModal'
import { DraftSpellModal } from './DraftSpellModal'
import { PartyColumn } from './PartyColumn'
import { HeroPickCard, SpellPickCard } from './PickCards'

interface ChapterScreenProps {
  state: RunState
  onChange: (state: RunState) => void
  onFinished: () => void
  onAbandon: () => void
  onRevealResults: () => void
}

type Detail =
  | { kind: 'adventurer'; adventurer: AdventurerDef }
  | { kind: 'spell'; spell: SpellDef }

export function ChapterScreen({
  state,
  onChange,
  onFinished,
  onAbandon,
  onRevealResults,
}: ChapterScreenProps) {
  const beat = state.beat ?? 'march'
  const roster = rosterFromParty(state.party)
  const [detail, setDetail] = useState<Detail | null>(null)
  const resolvedKey = useRef('')
  const revealed = useRef(false)
  const seenSeed = useRef(state.seed)
  if (seenSeed.current !== state.seed) {
    seenSeed.current = state.seed
    revealed.current = false
  }

  const career: CareerState = useMemo(() => {
    if (state.activeSaveId) return getSaveById(state.activeSaveId)?.career ?? loadCareer()
    return loadCareer()
  }, [state.activeSaveId, state.result, state.current])

  const score = useMemo(
    () => computeScore(roster, state.spellPool, state.spellAssign, state.spellSlots),
    [roster, state.spellPool, state.spellAssign, state.spellSlots],
  )

  const finishedChapter = state.result
    ? Math.min(10, Math.max(1, Math.ceil(state.result.stagesCleared / 10)))
    : 1
  const upcoming = Math.min(10, state.upgradesTaken + (beat === 'camp' ? 2 : 1))
  const threat = chapterThreatBand(finishedChapter, state.difficultyThreat, state.runPath)
  const nextThreat = chapterThreatBand(upcoming, state.difficultyThreat, state.runPath)
  const pendingWanted = (state.pendingCamp ?? []).flatMap((offer) => offer.needRoles ?? [])
  const chosenRegion = state.runPath[Math.min(8, Math.max(1, state.upgradesTaken + 1))]
  const chosenNeeds =
    beat === 'camp' && chosenRegion ? regionNeeds(chosenRegion).map((need) => need.role) : []
  const wanted = pendingWanted.length > 0 ? pendingWanted : chosenNeeds
  const basis = state.result?.score ?? score
  const fought = state.result?.matches.length
    ? state.result.matches[state.result.matches.length - 1].ourOvr
    : chapterPower(basis.overall, state.campaignMods, finishedChapter)
  const reserve = Math.max(0, fought - basis.overall)
  const livePower = chapterPower(score.overall, state.campaignMods, upcoming)
  const shortOnNext = beat === 'camp' && roster.length > 0 && livePower < nextThreat.min
  const placeId = state.runPath[Math.max(0, finishedChapter - 1)]
  const place = placeId ? REGION_MAP[placeId] : null
  const lastMatch = state.result?.matches.length
    ? state.result.matches[state.result.matches.length - 1]
    : null
  const killingThreat =
    beat === 'done' && lastMatch && !lastMatch.won
      ? lastMatch.theirOvr
      : Math.round((threat.min + threat.max) / 2)
  const causes = chapterCauses(basis, killingThreat, [], reserve)

  useEffect(() => {
    if (beat !== 'march') return
    if (state.result || state.campTick) return
    if (roster.length === 0) return
    const key = `${state.seed}:${state.upgradesTaken}`
    if (resolvedKey.current === key) return
    resolvedKey.current = key
    onFinished()
  }, [beat, onFinished, roster.length, state.campTick, state.result, state.seed, state.upgradesTaken])

  useEffect(() => {
    if (beat !== 'done' || !state.result || state.campTick || state.pendingCamp) return
    if (revealed.current) return
    revealed.current = true
    onRevealResults()
  }, [beat, onRevealResults, state.campTick, state.pendingCamp, state.result])

  const blocked = campBlocked(state)
  const showRecruit = beat === 'camp' && state.current && !state.recruitPicked

  return (
    <div className="draft-322 chapter-run">
      <PartyColumn state={state} onChange={onChange} spellDrag={roster.length > 0 && beat !== 'starter'} />
      <section className="draft-right">
        <header className="team-header">
          <div>
            <h2>{state.teamName}</h2>
            <p className="pack-meta">
              {beat === 'starter'
                ? 'Возьми одного. Танк закрывает первую дыру.'
                : beat === 'camp'
                  ? `Лагерь после главы ${finishedChapter} · ${roleCoverageLabel(roster)} · сила ${livePower}`
                  : beat === 'done'
                    ? 'Вылазка окончена'
                    : `Глава ${Math.min(10, state.upgradesTaken + 1)} · сила ${livePower}`}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAbandon}>
            В гильдию
          </button>
        </header>

        {beat === 'starter' && (
          <>
            <div className="section-label">КТО ИДЁТ ПЕРВЫМ</div>
            <div className="pack-row five">
              {(state.current?.adventurers ?? []).map((adv) => (
                <HeroPickCard
                  key={adv.id}
                  adventurer={adv}
                  teach={adv.role === 'tank'}
                  hint={adv.role === 'tank' ? 'закроет дыру' : null}
                  disabled={!canPickAdventurer(state, adv)}
                  onPick={() => onChange(pickAdventurer(state, adv))}
                  onDetails={() => setDetail({ kind: 'adventurer', adventurer: adv })}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={state.rerollsLeft <= 0}
              onClick={() => onChange(reroll(state))}
            >
              ↻ Другие трое ({state.rerollsLeft})
            </button>
          </>
        )}

        {beat === 'march' && !state.result && (
          <p className="chapter-wait">Считаем главу…</p>
        )}

        {(beat === 'camp' || (beat === 'done' && state.result)) && state.result && (
          <ol className="cause-strip" aria-label="Почему такая сила">
            {causes.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <strong className={line.delta < 0 ? 'neg' : 'pos'}>
                  {line.delta > 0 ? `+${line.delta}` : line.delta}
                </strong>
              </li>
            ))}
            <li>
              <span>Сила</span>
              <strong>{fought}</strong>
            </li>
          </ol>
        )}

        {place && (beat === 'camp' || beat === 'done') && (
          <p className="chapter-place">
            {place.name}. {place.blurb}
          </p>
        )}

        {beat === 'camp' && state.pendingCamp && (
          <p className="help-note">Сначала дверь — на ней написано, кто нужен. Потом одно событие. Находку можно пропустить.</p>
        )}

        {state.pendingCamp && state.pendingCamp.length > 0 && (
          <div className="camp-block">
            <div className="section-label">ДВЕРЬ</div>
            <div className="camp-choices">
              {state.pendingCamp.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="cfg-card"
                  onClick={() => onChange(applyCampChoice(state, offer.id))}
                >
                  <strong>{offer.label}</strong>
                  <span>{offer.detail}</span>
                  <em>
                    {needCovered(
                      offer.needRoles ?? [],
                      roster.map((hero) => hero.role),
                    )}
                  </em>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.pendingRoute && state.pendingRoute.length > 0 && (
          <div className="camp-block">
            <div className="section-label">МАРШРУТ</div>
            <div className="camp-choices">
              {state.pendingRoute.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="cfg-card"
                  onClick={() => onChange(applyRouteChoice(state, offer.id))}
                >
                  <strong>{offer.label}</strong>
                  <span>{offer.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.pendingEvent && state.pendingEvent.length > 0 && (
          <div className="camp-block">
            <div className="section-label">СОБЫТИЕ КРАЯ</div>
            <div className="camp-choices">
              {state.pendingEvent.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="cfg-card"
                  disabled={Boolean(state.pendingCamp?.length)}
                  onClick={() => onChange(applyEventChoice(state, offer.id))}
                >
                  <strong>{offer.label}</strong>
                  <span>{offer.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.pendingUpgrade && state.pendingUpgrade.length > 0 && (
          <div className="camp-block">
            <div className="section-label">УСИЛЕНИЕ</div>
            <div className="camp-choices">
              {state.pendingUpgrade.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="cfg-card"
                  onClick={() => onChange(applySpellUpgrade(state, offer.id))}
                >
                  <strong>{offer.label}</strong>
                  <span>{offer.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showRecruit && (
          <div className="camp-block">
            <div className="section-label">НАХОДКА — ОДНО</div>
            <div className="pack-row five">
              {(state.current?.adventurers ?? []).map((adv) => (
                <HeroPickCard
                  key={adv.id}
                  adventurer={adv}
                  hint={heroHint(adv, roster, wanted)}
                  disabled={!canPickAdventurer(state, adv)}
                  onPick={() => onChange(pickAdventurer(state, adv))}
                  onDetails={() => setDetail({ kind: 'adventurer', adventurer: adv })}
                />
              ))}
            </div>
            <div className="pack-row five">
              {(state.current?.spells ?? []).map((spell) => (
                <SpellPickCard
                  key={spell.id}
                  spell={spell}
                  hint={spellHint(spell, roster, wanted)}
                  blueprint={(career.blueprints ?? []).includes(spell.id)}
                  disabled={!canPickSpell(state, spell)}
                  onPick={() => onChange(pickSpell(state, spell))}
                  onDetails={() => setDetail({ kind: 'spell', spell })}
                />
              ))}
            </div>
            <p className="help-note">Находку можно пропустить. Дверь и событие — нет.</p>
          </div>
        )}

        {shortOnNext && (
          <p className="camp-warn">
            На главу {upcoming} нужно около {nextThreat.min}. Сейчас {livePower}. Возьми героя или
            заклинание — иначе дорога оборвётся сразу.
          </p>
        )}

        {beat === 'camp' && (
          <div className="chapter-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={blocked}
              onClick={() => onChange(state.campTick ? leaveCamp(state) : skipToNext(state))}
            >
              {shortOnNext ? 'Всё равно идти' : 'Дальше'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onChange(skipToNext(state))}>
              Пропуск »
            </button>
          </div>
        )}

      </section>

      {detail?.kind === 'adventurer' && (
        <DraftAdventurerModal
          adventurer={detail.adventurer}
          career={career}
          onClose={() => setDetail(null)}
          onConfirm={() => {
            if (canPickAdventurer(state, detail.adventurer)) {
              onChange(pickAdventurer(state, detail.adventurer))
            }
            setDetail(null)
          }}
        />
      )}
      {detail?.kind === 'spell' && (
        <DraftSpellModal
          spell={detail.spell}
          career={career}
          onClose={() => setDetail(null)}
          onConfirm={() => {
            if (canPickSpell(state, detail.spell)) onChange(pickSpell(state, detail.spell))
            setDetail(null)
          }}
        />
      )}
    </div>
  )
}
