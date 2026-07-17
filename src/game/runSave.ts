import { defaultRunPath } from './path'
import { DEFAULT_CAMPAIGN_MODS, type RunState } from './types'

const RUN_KEY = 'dndrun-run-v1'

type RunStore = Record<string, RunState>

function readStore(): RunStore {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as RunStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: RunStore): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(store))
  } catch {
    /* ignore quota */
  }
}

/** Драфт или пауза похода (лагерь / маршрут / апгрейд) — можно продолжить. */
export function isResumableRun(state: RunState | null | undefined): boolean {
  if (!state?.activeSaveId) return false
  if (state.screen === 'draft') return true
  if (state.screen !== 'campaign') return false
  if (state.pendingCamp || state.pendingUpgrade || state.pendingRoute) return true
  if (!state.result) return true
  return false
}

/** Совместимость старых пауз в localStorage. */
function migrateRunState(raw: RunState): RunState {
  return {
    ...raw,
    pendingRoute: raw.pendingRoute ?? null,
    pendingCamp: raw.pendingCamp ?? null,
    pendingUpgrade: raw.pendingUpgrade ?? null,
    campaignMods: raw.campaignMods ?? { ...DEFAULT_CAMPAIGN_MODS },
    difficultyThreat: raw.difficultyThreat ?? 0,
    runPath: raw.runPath ?? defaultRunPath(),
    pendingCommit: raw.pendingCommit ?? false,
    upgradesTaken: raw.upgradesTaken ?? 0,
    spellSlots: raw.spellSlots ?? [],
    spellAssign: raw.spellAssign ?? {},
    history: raw.history ?? [],
  }
}

export function saveRunState(state: RunState): void {
  if (!state.activeSaveId) return
  if (!isResumableRun(state)) {
    clearRunState(state.activeSaveId)
    return
  }
  const store = readStore()
  store[state.activeSaveId] = state
  writeStore(store)
}

export function loadRunState(saveId: string): RunState | null {
  const raw = readStore()[saveId]
  if (!raw) return null
  const state = migrateRunState(raw)
  if (!isResumableRun(state)) return null
  return state
}

export function clearRunState(saveId: string): void {
  const store = readStore()
  if (!(saveId in store)) return
  delete store[saveId]
  writeStore(store)
}

export function hasRunState(saveId: string): boolean {
  return loadRunState(saveId) !== null
}
