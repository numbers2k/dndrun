import {
  FINALE_REGION_ID,
  INTRO_REGION_ID,
  REGION_MAP,
  STARTER_MID_REGIONS,
  nextRegionChoices,
  unlockedMidRegions,
  type RegionId,
} from '../data/regions'
import { PATH_BASE, PATH_BOSS_BONUS, PATH_PER_STAGE } from './balance'
import { SeededRng } from './rng'

export interface PathStageBlue {
  id: string
  name: string
  kind: 'route' | 'boss'
  chapter: number
  difficulty: number
  blurb: string
  regionId: RegionId | null
  bossTitle: string
  /** Глава ещё не выбрана — в UI только «???». */
  unknown: boolean
}

export const TOTAL_STAGES = 100
export const CHAPTER_COUNT = 10

/** Слот пути: середина null, пока не выбрана дверь. */
export type PathSlot = RegionId | null

/** Путь вылазки: гл.1 известна сразу; 2–10 — туман, пока не дошли / не выбрали дверь. */
export type RunPath = [
  RegionId,
  PathSlot,
  PathSlot,
  PathSlot,
  PathSlot,
  PathSlot,
  PathSlot,
  PathSlot,
  PathSlot,
  PathSlot,
]

/** Старт вылазки: виден только Трезвый Двор; всё впереди — ???. */
export function defaultRunPath(_bestStage = 0, _seed = 'static'): RunPath {
  return [
    INTRO_REGION_ID,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ]
}

/** Черновой полный путь (сиды / тесты) — сразу заполняет двери по графу. */
export function rollFullRunPath(bestStage: number, seed: string): RunPath {
  const unlocked = unlockedMidRegions(bestStage)
  const pool = unlocked.length ? unlocked : [...STARTER_MID_REGIONS]
  const rng = new SeededRng(`${seed}-runpath`)
  const mid: RegionId[] = []
  let current: RegionId = INTRO_REGION_ID
  for (let i = 0; i < 8; i += 1) {
    const choices = nextRegionChoices(current, pool)
    const next = choices.length ? rng.pick(choices) : rng.pick(pool)
    mid.push(next)
    current = next
  }
  return [INTRO_REGION_ID, ...mid, FINALE_REGION_ID] as RunPath
}

export function buildPathForRun(runPath: readonly PathSlot[]): PathStageBlue[] {
  const stages: PathStageBlue[] = []
  for (let ch = 0; ch < CHAPTER_COUNT; ch += 1) {
    const slot = runPath[ch]
    const regionId = slot ?? (ch === 0 ? INTRO_REGION_ID : null)
    const unknown = regionId === null
    const region = regionId ? REGION_MAP[regionId] : null

    for (let i = 0; i < 10; i += 1) {
      const n = ch * 10 + i + 1
      const isBoss = i === 9
      const baseDiff = Math.round(PATH_BASE + (n - 1) * PATH_PER_STAGE + (isBoss ? PATH_BOSS_BONUS : 0))
      const difficulty = baseDiff + (region?.threatAdjust ?? 0)

      if (unknown) {
        stages.push({
          id: `s${n}`,
          name: isBoss ? 'Босс: ???' : '???',
          kind: isBoss ? 'boss' : 'route',
          chapter: ch + 1,
          difficulty,
          blurb: 'Что там — неизвестно, пока не дойдёте.',
          regionId: null,
          bossTitle: 'Босс: ???',
          unknown: true,
        })
        continue
      }

      stages.push({
        id: `s${n}`,
        name: isBoss
          ? region!.bossTitle
          : `${region!.routes[i] ?? `Путь ${i + 1}`} · ${region!.name}`,
        kind: isBoss ? 'boss' : 'route',
        chapter: ch + 1,
        difficulty,
        blurb: isBoss ? region!.bossBlurb : region!.blurb,
        regionId,
        bossTitle: region!.bossTitle,
        unknown: false,
      })
    }
  }
  return stages
}

/** Статический эталон длины (для UI до первого стейта). */
export const PATH_STAGES = buildPathForRun(defaultRunPath(0, 'static'))

export function chapterThreatBandForPath(
  path: PathStageBlue[],
  chapter: number,
  extraThreat = 0,
): { min: number; max: number } {
  const start = (chapter - 1) * 10
  const end = Math.min(path.length, chapter * 10)
  let min = 999
  let max = 0
  for (let s = start; s < end; s += 1) {
    const bp = path[s]
    const encCount = bp.kind === 'boss' ? 3 : 2
    for (let e = 0; e < encCount; e += 1) {
      const lo = bp.difficulty - 1 + e * 2 + extraThreat
      const hi = lo + 1
      min = Math.min(min, lo)
      max = Math.max(max, hi)
    }
  }
  return { min, max }
}
