import { useEffect, useMemo, useRef, useState } from 'react'
import { pickAbandonQuote } from '../data/abandonQuotes'
import { getSaveById, loadCareer } from '../game/career'
import {
  afterUpgradeContinue,
  applySpellUpgrade,
  skipSpellUpgrade,
  startRunFromSave,
} from '../game/draft'
import { createSeed } from '../game/rng'
import { CHAPTER_COUNT, PATH_STAGES, TOTAL_STAGES } from '../game/simulate'
import { computeScore, rosterFromParty } from '../game/scoring'
import { stageFateLore, stagePlaceLore } from '../data/stageFlavor'
import type { RunState } from '../game/types'

const STAGE_MS = 1750
const BOSS_SUMMARY_MS = 1000
const FAIL_HOLD_MS = 3000
const REWIND_MS = 3200
const TRACK_SCROLL_MS = 420
/** Пауза после приезда на кадр похода, до rewind / старта. */
const FRAME_SETTLE_MS = 1000

/** Медленный старт → ускорение (откат ленты). */
function easeInCubic(t: number): number {
  return t * t * t
}

/** Быстрый старт → торможение (скролл вперёд по этапам). */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function stageDisplayName(name: string): string {
  return name.replace(/\s*·\s*гл\.\d+\s*$/i, '').trim()
}

interface CampaignScreenProps {
  state: RunState
  onChange: (state: RunState) => void
  onRename: (name: string) => void
  onFinished: () => void
  onAbandon: () => void
  onRevealResults: () => void
  /** true после вертикального скролла к кадру (~0.5 с); rewind стартует после паузы 1 с. */
  frameReady: boolean
}

type TrialStatus = 'pending' | 'active' | 'cleared' | 'failed' | 'ghost'

type Phase =
  | 'hold'
  | 'rewind'
  | 'idle'
  | 'running'
  | 'bossSummary'
  | 'upgrade'
  | 'holding'
  | 'done'

export function CampaignScreen({
  state,
  onChange,
  onRename,
  onFinished,
  onAbandon,
  onRevealResults,
  frameReady,
}: CampaignScreenProps) {
  const roster = rosterFromParty(state.party)
  const [quote] = useState(() => pickAbandonQuote(roster.map((a) => a.name)))
  const score = useMemo(
    () => computeScore(roster, state.spellPool, state.spellAssign, state.spellSlots),
    [roster, state.spellPool, state.spellAssign, state.spellSlots],
  )

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

  const bestStage = career.bestStage
  const needsRewind = bestStage > 1 && !state.result

  const [phase, setPhase] = useState<Phase>('hold')
  const [statuses, setStatuses] = useState<TrialStatus[]>(() =>
    PATH_STAGES.map((_, i) => (needsRewind && i < bestStage ? 'ghost' : 'pending')),
  )
  const [banner, setBanner] = useState<string | null>(null)
  const [focusIdx, setFocusIdx] = useState(needsRewind ? Math.max(0, bestStage - 1) : 0)
  const [bossChapter, setBossChapter] = useState<number | null>(null)
  const [displayStage, setDisplayStage] = useState(needsRewind ? Math.max(1, bestStage) : 1)

  const cancelRef = useRef(false)
  const timersRef = useRef<number[]>([])
  const waitResolversRef = useRef<Array<() => void>>([])
  const rewindDoneRef = useRef(!needsRewind)
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const autoStartedRef = useRef(false)
  const playedUpToRef = useRef(0)
  const revealedRef = useRef(false)
  const animGenRef = useRef(0)
  const scrollRafRef = useRef(0)
  const holdBootedRef = useRef(false)

  const resultKey = state.result
    ? `${state.seed}:${state.upgradesTaken}:${state.result.stagesCleared}:${state.pendingUpgrade ? 'u' : 'f'}`
    : null

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
    const resolvers = waitResolversRef.current
    waitResolversRef.current = []
    resolvers.forEach((r) => r())
    if (scrollRafRef.current) {
      window.cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        timersRef.current = timersRef.current.filter((t) => t !== id)
        waitResolversRef.current = waitResolversRef.current.filter((r) => r !== resolve)
        resolve()
      }, ms)
      timersRef.current.push(id)
      waitResolversRef.current.push(resolve)
    })

  const scrollLeftForIndex = (idx: number): number | null => {
    const track = trackRef.current
    const item = itemRefs.current[idx]
    if (!track || !item) return null
    const trackRect = track.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const delta =
      itemRect.left + itemRect.width / 2 - (trackRect.left + trackRect.width / 2)
    return track.scrollLeft + delta
  }

  const scrollTrackTo = (idx: number, duration: number, ease = easeOutCubic) =>
    new Promise<void>((resolve) => {
      const track = trackRef.current
      const target = scrollLeftForIndex(idx)
      if (!track || target === null) {
        resolve()
        return
      }
      const start = track.scrollLeft
      if (Math.abs(target - start) < 1 || duration <= 0) {
        track.scrollLeft = target
        resolve()
        return
      }
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current)
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration)
        track.scrollLeft = start + (target - start) * ease(p)
        if (p < 1) {
          scrollRafRef.current = window.requestAnimationFrame(step)
        } else {
          scrollRafRef.current = 0
          resolve()
        }
      }
      scrollRafRef.current = window.requestAnimationFrame(step)
    })

  const ensureVisible = async (idx: number, duration = TRACK_SCROLL_MS) => {
    setFocusIdx(idx)
    setDisplayStage(idx + 1)
    await scrollTrackTo(idx, duration, easeOutCubic)
  }

  const paintCleared = (upToExclusive: number): TrialStatus[] =>
    PATH_STAGES.map((_, i) =>
      i < upToExclusive ? ('cleared' as TrialStatus) : ('pending' as TrialStatus),
    )

  const revealResultsOnce = () => {
    if (revealedRef.current) return
    revealedRef.current = true
    onRevealResults()
  }

  /** После приезда на кадр: пауза 1 с, затем rewind или idle. */
  useEffect(() => {
    if (!frameReady || holdBootedRef.current) return
    holdBootedRef.current = true
    const id = window.setTimeout(() => {
      if (needsRewind) {
        setPhase('rewind')
      } else {
        rewindDoneRef.current = true
        setPhase('idle')
      }
    }, FRAME_SETTLE_MS)
    timersRef.current.push(id)
    return () => {
      window.clearTimeout(id)
      timersRef.current = timersRef.current.filter((t) => t !== id)
    }
  }, [frameReady, needsRewind])

  /** Пока hold — поставить ленту на bestStage без анимации. */
  useEffect(() => {
    if (phase !== 'hold' || !needsRewind) return
    const id = window.requestAnimationFrame(() => {
      const startIdx = Math.max(0, Math.min(bestStage, TOTAL_STAGES) - 1)
      const target = scrollLeftForIndex(startIdx)
      if (trackRef.current && target !== null) trackRef.current.scrollLeft = target
      setFocusIdx(startIdx)
      setDisplayStage(startIdx + 1)
    })
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  /**
   * Откат: один непрерывный горизонтальный скролл best→1,
   * ease-in (медленно → быстро), статусы обновляются по пути.
   */
  useEffect(() => {
    if (phase !== 'rewind' || rewindDoneRef.current) return
    let cancelled = false
    cancelRef.current = false

    const runRewind = async () => {
      const from = Math.min(bestStage, TOTAL_STAGES)
      const startIdx = Math.max(0, from - 1)
      const next = PATH_STAGES.map((_, i) => (i < from ? ('ghost' as TrialStatus) : 'pending'))
      setStatuses([...next])
      setBanner('Новый забег — откат к началу пути…')

      // Дождаться layout карточек
      await wait(40)
      if (cancelled || cancelRef.current) return

      const startX = scrollLeftForIndex(startIdx)
      const endX = scrollLeftForIndex(0)
      const track = trackRef.current
      if (!track || startX === null || endX === null) {
        rewindDoneRef.current = true
        setStatuses(PATH_STAGES.map(() => 'pending'))
        setBanner(null)
        setPhase('idle')
        return
      }

      track.scrollLeft = startX
      setFocusIdx(startIdx)
      setDisplayStage(startIdx + 1)
      await wait(120)
      if (cancelled || cancelRef.current) return

      await new Promise<void>((resolve) => {
        if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current)
        const t0 = performance.now()
        let lastVisual = startIdx

        const tick = (now: number) => {
          if (cancelled || cancelRef.current) {
            resolve()
            return
          }
          const raw = Math.min(1, (now - t0) / REWIND_MS)
          const eased = easeInCubic(raw)
          track.scrollLeft = startX + (endX - startX) * eased

          const visualIdx = Math.round(startIdx + (0 - startIdx) * eased)
          if (visualIdx !== lastVisual) {
            lastVisual = visualIdx
            setFocusIdx(visualIdx)
            setDisplayStage(visualIdx + 1)
            setBanner(`Откат… этап ${visualIdx + 1}`)
            // Уже «смотали» всё правее текущей позиции
            setStatuses(
              PATH_STAGES.map((_, i) => {
                if (i >= from) return 'pending'
                if (i > visualIdx) return 'pending'
                return 'ghost'
              }),
            )
          }

          if (raw < 1) {
            scrollRafRef.current = window.requestAnimationFrame(tick)
          } else {
            scrollRafRef.current = 0
            resolve()
          }
        }
        scrollRafRef.current = window.requestAnimationFrame(tick)
      })

      if (!cancelled) {
        rewindDoneRef.current = true
        setStatuses(PATH_STAGES.map(() => 'pending'))
        setBanner(null)
        setFocusIdx(0)
        setDisplayStage(1)
        setPhase('idle')
      }
    }

    void runRewind()
    return () => {
      cancelled = true
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (!frameReady) return
    if (phase !== 'idle' || state.result || autoStartedRef.current) return
    if (!rewindDoneRef.current) return
    autoStartedRef.current = true
    playedUpToRef.current = 0
    revealedRef.current = false
    setPhase('running')
    setBanner('Поход начался…')
    onFinished()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state.result, frameReady])

  useEffect(() => {
    if (!resultKey || !state.result) return
    if (!rewindDoneRef.current) return

    const gen = ++animGenRef.current
    cancelRef.current = false
    const result = state.result
    const pendingUpgrade = state.pendingUpgrade

    const runAnim = async () => {
      setPhase('running')
      const cleared = Math.max(0, result.stagesCleared)
      const from = Math.min(playedUpToRef.current, cleared)
      const next = paintCleared(from)
      setStatuses([...next])

      for (let i = from; i < cleared; i += 1) {
        if (cancelRef.current || animGenRef.current !== gen) return
        next[i] = 'active'
        setStatuses([...next])
        setBanner(`${i + 1}/${TOTAL_STAGES}: ${stageDisplayName(PATH_STAGES[i].name)}`)
        await ensureVisible(i, TRACK_SCROLL_MS)
        if (cancelRef.current || animGenRef.current !== gen) return
        await wait(Math.max(0, STAGE_MS - TRACK_SCROLL_MS))
        if (cancelRef.current || animGenRef.current !== gen) return
        next[i] = 'cleared'
        setStatuses([...next])
        playedUpToRef.current = i + 1
      }

      if (cancelRef.current || animGenRef.current !== gen) return
      playedUpToRef.current = cleared

      if (pendingUpgrade) {
        const bossIdx = Math.max(0, cleared - 1)
        const ch = PATH_STAGES[bossIdx]?.chapter ?? 1
        setBossChapter(ch)
        setBanner(`Глава ${ch} пройдена`)
        setPhase('bossSummary')
        await wait(BOSS_SUMMARY_MS)
        if (cancelRef.current || animGenRef.current !== gen) return
        setBanner('Выбери усиление заклинаний')
        setPhase('upgrade')
        return
      }

      if (!result.perfect && cleared < TOTAL_STAGES) {
        const failIdx = cleared
        if (failIdx < PATH_STAGES.length) {
          next[failIdx] = 'failed'
          setStatuses([...next])
          await ensureVisible(failIdx, TRACK_SCROLL_MS)
          const why = result.stageReasons[failIdx]?.slice(0, 2).join(' · ')
          setBanner(
            why
              ? `Провал: ${stageDisplayName(PATH_STAGES[failIdx].name)} — ${why}`
              : `Провал: ${stageDisplayName(PATH_STAGES[failIdx].name)}`,
          )
        }
        setPhase('holding')
        await wait(FAIL_HOLD_MS)
        if (animGenRef.current !== gen) return
        revealResultsOnce()
        setPhase('done')
        return
      }

      setBanner(result.perfect ? 'Корона взята!' : 'Поход завершён')
      setPhase('holding')
      await wait(FAIL_HOLD_MS)
      if (animGenRef.current !== gen) return
      revealResultsOnce()
      setPhase('done')
    }

    void runAnim()
    return () => {
      cancelRef.current = true
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey])

  const skip = () => {
    cancelRef.current = true
    clearTimers()
    animGenRef.current += 1
    if (!state.result) return

    const cleared = state.result.stagesCleared
    const next = PATH_STAGES.map((_, i) => {
      if (i < cleared) return 'cleared' as TrialStatus
      if (i === cleared && !state.result!.perfect && !state.pendingUpgrade) {
        return 'failed' as TrialStatus
      }
      return 'pending' as TrialStatus
    })
    setStatuses(next)
    playedUpToRef.current = cleared
    void ensureVisible(Math.min(Math.max(cleared - 1, 0), TOTAL_STAGES - 1), TRACK_SCROLL_MS)

    if (state.pendingUpgrade) {
      const bossIdx = Math.max(0, cleared - 1)
      setBossChapter(PATH_STAGES[bossIdx]?.chapter ?? 1)
      setBanner('Выбери усиление')
      setPhase('upgrade')
      return
    }

    setBanner(state.result.perfect ? 'Корона взята!' : 'Поход завершён')
    revealResultsOnce()
    setPhase('done')
  }

  const pickUpgrade = (offerId: string | null) => {
    cancelRef.current = true
    clearTimers()
    animGenRef.current += 1
    const base = offerId
      ? applySpellUpgrade(state, offerId)
      : skipSpellUpgrade(state)
    const next = afterUpgradeContinue(base)
    setBossChapter(null)
    setBanner('Поход продолжается…')
    setPhase('running')
    onChange(next)
  }

  const unlockedTiers = career.maxSpellTier
  const chapterOfFocus = PATH_STAGES[focusIdx]?.chapter ?? 1
  const showUpgrade = phase === 'upgrade' && Boolean(state.pendingUpgrade)
  const showBossSummary = phase === 'bossSummary' && bossChapter !== null

  return (
    <div className="campaign-panel" id="campaign-track">
      <header className="campaign-head">
        <div>
          <label className="ready-team campaign-team">
            <span className="ready-team-k">Отряд</span>
            <input
              className="ready-team-input"
              value={state.teamName}
              maxLength={32}
              disabled={phase === 'hold' || phase === 'rewind' || phase === 'running' || phase === 'holding'}
              onChange={(e) => onRename(e.target.value)}
              placeholder="Твой отряд"
            />
          </label>
          <p className="campaign-meta">
            Сила {score.overall} · Этап {displayStage}/{TOTAL_STAGES} · Глава {chapterOfFocus}/
            {CHAPTER_COUNT}
          </p>
          <p className="campaign-career">
            Карьера: лучший этап {bestStage || '—'} · тир заклинаний {unlockedTiers} · открыто
            классов {career.unlockedClasses.length}
          </p>
        </div>
        {(phase === 'running' || phase === 'bossSummary' || phase === 'holding') && (
          <button type="button" className="btn btn-secondary btn-sm ready-skip" onClick={skip}>
            Пропуск »
          </button>
        )}
      </header>

      {banner && <div className="ready-banner">{banner}</div>}

      <div className="campaign-track" ref={trackRef}>
        {PATH_STAGES.map((stage, idx) => {
          const st = statuses[idx] ?? 'pending'
          const place = stagePlaceLore(stage)
          const fate = stageFateLore(stage, st, state.seed)

          return (
            <div
              key={stage.id}
              ref={(el) => {
                itemRefs.current[idx] = el
              }}
              className={`campaign-card ${stage.kind} status-${st}`}
              onClick={() => {
                setFocusIdx(idx)
                void ensureVisible(idx, TRACK_SCROLL_MS)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setFocusIdx(idx)
                  void ensureVisible(idx, TRACK_SCROLL_MS)
                }
              }}
            >
              <strong className="campaign-card-name">{stageDisplayName(stage.name)}</strong>
              <span className="campaign-card-lore">{place}</span>
              <span className="campaign-card-fate">{fate || '\u00a0'}</span>
              <div className="campaign-card-foot">
                <em className="campaign-card-status">
                  {st === 'cleared'
                    ? 'Пройден'
                    : st === 'failed'
                      ? 'Провал'
                      : st === 'active'
                        ? 'Сейчас'
                        : st === 'ghost'
                          ? 'Рекорд'
                          : 'Впереди'}
                </em>
                <span className="campaign-card-num">{idx + 1}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="campaign-below-track">
        {showBossSummary && (
          <div className="boss-summary">
            <h3>Глава {bossChapter} пройдена</h3>
            <p>
              Босс сражён · пройдено {state.result?.stagesCleared ?? 0}/{TOTAL_STAGES} · сила отряда{' '}
              {score.overall}
            </p>
          </div>
        )}

        {showUpgrade && state.pendingUpgrade && (
          <div className="upgrade-panel upgrade-panel-columns">
            <h3>Усиление заклинаний</h3>
            <p>Выбери одно усиление перед следующей главой.</p>
            <div className="upgrade-columns">
              {state.pendingUpgrade.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="btn btn-secondary upgrade-btn upgrade-col"
                  onClick={() => pickUpgrade(offer.id)}
                >
                  <strong>{offer.label}</strong>
                  <span>{offer.detail}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => pickUpgrade(null)}>
              Пропустить усиление
            </button>
          </div>
        )}

        {phase === 'done' && state.result && !state.pendingUpgrade && (
          <button
            type="button"
            className="btn btn-danger btn-block ready-abandon"
            onClick={() => {
              if (save) {
                onChange(startRunFromSave(state, save, createSeed()))
              } else {
                onAbandon()
              }
              window.scrollTo({ top: 0, behavior: 'auto' })
            }}
          >
            <span className="ready-abandon-title">Новый забег</span>
            <span className="ready-abandon-quote">«{quote}»</span>
          </button>
        )}
      </div>
    </div>
  )
}
