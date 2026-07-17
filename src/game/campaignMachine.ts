/** Фазы похода — вынесены из UI для предсказуемого FSM. */

export type CampaignPhase =
  | 'hold'
  | 'rewind'
  | 'idle'
  | 'running'
  | 'bossSummary'
  | 'camp'
  | 'route'
  | 'upgrade'
  | 'holding'
  | 'done'

export type CampaignPace = 'fast' | 'cinematic'

const PACE_KEY = 'dndrun-campaign-pace'

export interface CampaignTiming {
  stageMs: number
  bossSummaryMs: number
  failHoldMs: number
  rewindMs: number
  trackScrollMs: number
  frameSettleMs: number
}

const FAST_TIMING: CampaignTiming = {
  stageMs: 420,
  bossSummaryMs: 420,
  failHoldMs: 1400,
  rewindMs: 1200,
  trackScrollMs: 200,
  frameSettleMs: 400,
}

const CINEMATIC_TIMING: CampaignTiming = {
  stageMs: 900,
  bossSummaryMs: 700,
  failHoldMs: 2200,
  rewindMs: 2200,
  trackScrollMs: 280,
  frameSettleMs: 700,
}

export function loadCampaignPace(): CampaignPace {
  try {
    const v = localStorage.getItem(PACE_KEY)
    if (v === 'cinematic' || v === 'fast') return v
  } catch {
    /* ignore */
  }
  return 'fast'
}

export function saveCampaignPace(pace: CampaignPace): void {
  try {
    localStorage.setItem(PACE_KEY, pace)
  } catch {
    /* ignore */
  }
}

export function timingForPace(pace: CampaignPace): CampaignTiming {
  return pace === 'cinematic' ? CINEMATIC_TIMING : FAST_TIMING
}

/** После босса: лагерь → маршрут → апгрейд. */
export function phaseAfterBoss(opts: {
  hasCamp: boolean
  hasRoute: boolean
  hasUpgrade: boolean
}): CampaignPhase {
  if (opts.hasCamp) return 'camp'
  if (opts.hasRoute) return 'route'
  if (opts.hasUpgrade) return 'upgrade'
  return 'running'
}
