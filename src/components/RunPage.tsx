import { useEffect, useRef, useState } from 'react'
import { resolveRun, setTeamName } from '../game/draft'
import type { RunState } from '../game/types'
import { CampaignScreen } from './CampaignScreen'
import { DraftScreen } from './DraftScreen'
import { ResultSummary } from './ResultSummary'

interface RunPageProps {
  state: RunState
  onChange: (state: RunState) => void
  onAbandon: () => void
  onAgain: () => void
  onMenu: () => void
}

const PAGE_SCROLL_MS = 500

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function headerHeight(): number {
  const header = document.querySelector('.site-header') as HTMLElement | null
  return header?.getBoundingClientRect().height ?? 54
}

/** Вертикальный скролл к кадру: быстро → торможение (~0.5 с). */
function animatePageToFrame(el: HTMLElement, duration = PAGE_SCROLL_MS): Promise<void> {
  const startY = window.scrollY
  const targetY = Math.max(
    0,
    Math.round(window.scrollY + el.getBoundingClientRect().top - headerHeight()),
  )
  if (Math.abs(targetY - startY) < 2) {
    window.scrollTo(0, targetY)
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      window.scrollTo(0, startY + (targetY - startY) * easeOutCubic(p))
      if (p < 1) {
        window.requestAnimationFrame(tick)
      } else {
        window.scrollTo(0, targetY)
        resolve()
      }
    }
    window.requestAnimationFrame(tick)
  })
}

export function RunPage({ state, onChange, onAbandon, onAgain, onMenu }: RunPageProps) {
  const started = state.screen === 'campaign'
  const [revealResults, setRevealResults] = useState(false)
  /** Кадр похода на месте под шапкой — можно начинать rewind / прогон. */
  const [campaignFrameReady, setCampaignFrameReady] = useState(false)
  const campaignRef = useRef<HTMLElement>(null)
  const resultsRef = useRef<HTMLElement>(null)
  const scrolledToCampaign = useRef(false)

  useEffect(() => {
    if (!started) {
      setRevealResults(false)
      setCampaignFrameReady(false)
      scrolledToCampaign.current = false
    }
  }, [started, state.seed])

  useEffect(() => {
    if (!started || scrolledToCampaign.current) return
    scrolledToCampaign.current = true
    let cancelled = false
    const id = window.setTimeout(() => {
      const el = campaignRef.current
      if (!el) {
        setCampaignFrameReady(true)
        return
      }
      void animatePageToFrame(el).then(() => {
        if (!cancelled) setCampaignFrameReady(true)
      })
    }, 40)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [started])

  useEffect(() => {
    if (!revealResults) return
    const el = resultsRef.current
    if (!el) return
    const id = window.setTimeout(() => {
      void animatePageToFrame(el)
    }, 40)
    return () => window.clearTimeout(id)
  }, [revealResults])

  const showResults =
    revealResults && Boolean(state.result) && !state.pendingUpgrade

  return (
    <div className={`run-page ${started ? 'is-started' : ''} ${showResults ? 'has-results' : ''}`}>
      <section id="run-draft" className="run-frame run-frame-draft">
        <DraftScreen state={state} onChange={onChange} />
      </section>

      {started && (
        <section
          id="run-campaign"
          ref={campaignRef}
          className="run-frame run-frame-campaign"
        >
          <CampaignScreen
            state={state}
            onChange={onChange}
            onRename={(name) => onChange(setTeamName(state, name))}
            onFinished={() => onChange(resolveRun(state))}
            onAbandon={onAbandon}
            onRevealResults={() => setRevealResults(true)}
            frameReady={campaignFrameReady}
          />
        </section>
      )}

      {showResults && (
        <section id="run-results" ref={resultsRef} className="run-frame run-frame-results">
          <ResultSummary state={state} onAgain={onAgain} onMenu={onMenu} />
        </section>
      )}
    </div>
  )
}
