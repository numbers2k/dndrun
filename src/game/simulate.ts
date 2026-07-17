import { encountersForRegion } from '../data/regionEncounters'
import type { RegionId } from '../data/regions'
import { FIELD_STRENGTH_MAX, FIELD_STRENGTH_MIN } from './balance'
import {
  CHAPTER_COUNT,
  PATH_STAGES,
  TOTAL_STAGES,
  buildPathForRun,
  chapterThreatBandForPath,
  type PathStageBlue,
} from './path'
import { SeededRng } from './rng'
import type { ScoreBreakdown } from './types'

export { CHAPTER_COUNT, TOTAL_STAGES, buildPathForRun }

export interface FieldTeam {
  id: string
  name: string
  strength: number
  isUser: boolean
}

export interface EncounterDef {
  id: string
  name: string
  threat: number
  won: boolean
  ourPower: number
  noise: number
}

export interface StageDef {
  id: string
  name: string
  kind: 'route' | 'boss'
  chapter: number
  difficulty: number
  encounters: EncounterDef[]
  cleared: boolean
  reasons: string[]
  regionId?: RegionId | null
}

export interface CampaignPlan {
  field: FieldTeam[]
  fieldSeed: number
  stages: StageDef[]
  stagesCleared: number
  eliminatedAt: number | null
  place: number
  placeLow: number
  placeHigh: number
  placeLabel: string
  championName: string
  perfect: boolean
  record: string
  wins: number
  losses: number
}

const RIVAL_NAMES = [
  'Культ Масок',
  'Железный Синдикат',
  'Лунные Охотники',
  'Орден Костей',
  'Вороны Кубка',
  'Стражи Соли',
  'Певцы Склепа',
  'Гильдия Искры',
  'Чёрный Причал',
  'Каменный Круг',
  'Тихие Клинки',
  'Багровый Дозор',
  'Пустые Кубки',
  'Соляные Вестники',
  'Круг Масок',
  'Ночные Факелы',
  'Золотая Трясина',
]

const ENCOUNTER_POOL = [
  'Маскированный дозор',
  'Тост из тумана',
  'Проклятый алтарь пира',
  'Страж пустых кубков',
  'Отряд наёмников',
  'Гнилой кравчий',
  'Тень распорядителя',
  'Костяной рыцарь',
  'Культисты Порчи',
  'Змей руин',
  'Призрак капитана',
  'Каменный хоровод',
  'Соляной ужас',
  'Лунный охотник',
  'Шёпот пустого кубка',
]

/** Место среди обречённых — feast-лексика, не «лига». */
export function feastPlaceLabel(n: number): string {
  if (n <= 1) return 'у главы стола'
  if (n === 2) return 'у правой руки'
  if (n <= 4) return 'у верхней скатерти'
  if (n <= 8) return 'среди тостов'
  if (n <= 12) return 'у края стола'
  return 'в тени зала'
}

function projectPlaces(our: number, field: FieldTeam[]): { low: number; high: number } {
  const sorted = [...field].sort((a, b) => b.strength - a.strength)
  const rank = sorted.findIndex((t) => t.isUser) + 1
  const jitter = our >= 95 ? 1 : our >= 85 ? 2 : our >= 75 ? 3 : 4
  const low = Math.max(1, rank - jitter)
  const high = Math.min(field.length, rank + jitter)
  return { low, high }
}

function rivalDepth(strength: number, rng: SeededRng, blueprint: PathStageBlue[]): number {
  let cleared = 0
  for (let i = 0; i < blueprint.length; i += 1) {
    const diff = blueprint[i].difficulty
    const noise = rng.next() * 8 - 3
    if (strength + noise >= diff - 1) cleared += 1
    else break
  }
  return cleared
}

export function buildField(ourOvr: number, teamName: string, fieldSeed: number): FieldTeam[] {
  const rng = new SeededRng(`field-${fieldSeed}`)
  const names = [...RIVAL_NAMES]
  const rivals: FieldTeam[] = []
  for (let i = 0; i < 17; i += 1) {
    const name = names.splice(rng.int(0, names.length - 1), 1)[0] ?? `Отряд ${i + 1}`
    const strength = Math.round(
      Math.min(
        FIELD_STRENGTH_MAX,
        Math.max(FIELD_STRENGTH_MIN, ourOvr + rng.int(-18, 16) + (i < 3 ? 4 : 0)),
      ),
    )
    rivals.push({ id: `riv-${i}`, name, strength, isUser: false })
  }
  const field = [
    ...rivals,
    { id: 'user', name: teamName || 'Твой отряд', strength: ourOvr, isUser: true },
  ]
  return field.sort((a, b) => b.strength - a.strength)
}

function threatLabel(ourOvr: number, difficulty: number): string {
  const delta = ourOvr - difficulty
  if (delta >= 8) return 'угроза слабее состава'
  if (delta >= 2) return 'угроза по силам'
  if (delta >= -4) return 'угроза выше состава'
  return 'угроза заметно выше состава'
}

function stageReasons(
  score: ScoreBreakdown,
  ourOvr: number,
  difficulty: number,
  won: boolean,
): string[] {
  const out: string[] = []
  const threat = threatLabel(ourOvr, difficulty)
  if (won) {
    if (ourOvr >= difficulty + 2) out.push(threat)
    else out.push('прошли на грани')
    for (const r of score.reasons) {
      if (r === 'сильные связки' && out.length < 3) out.push(r)
    }
    if (score.axes.spellFit >= 2 && out.length < 3) out.push('спеллы держат темп')
    if (score.axes.coverage >= 0 && out.length < 3) out.push('роли закрыты')
  } else {
    out.push(threat)
    for (const r of score.reasons) {
      if (r !== 'сильные связки' && out.length < 3) out.push(r)
    }
    if (out.length < 2) out.push('не хватило запаса силы')
  }
  return out.slice(0, 3)
}

export interface PlanCampaignOpts {
  overallByStage?: number[]
  threatAdjust?: number
  ovrBuffer?: number
  modFromStage?: number | null
  modUntilStage?: number | null
  difficultyThreat?: number
  /** Путь вылазки (10 краёв). */
  runPath?: readonly (RegionId | null)[]
  /**
   * Сколько этапов уже пройдено (счёт 1..100). Не переигрывать их:
   * иначе после лагеря/апгрейда старые этапы сыпятся без прошлого запаса силы.
   */
  resumeFrom?: number
}

/** Симуляция с учётом силы и выбранного пути краёв. */
export function planCampaign(
  score: ScoreBreakdown,
  seed: string,
  fieldSeed: number,
  teamName = 'Твой отряд',
  overallByStageOrOpts?: number[] | PlanCampaignOpts,
): CampaignPlan {
  const opts: PlanCampaignOpts = Array.isArray(overallByStageOrOpts)
    ? { overallByStage: overallByStageOrOpts }
    : (overallByStageOrOpts ?? {})
  const blueprint = opts.runPath ? buildPathForRun(opts.runPath) : PATH_STAGES
  const baseOvr = score.overall
  const resumeFrom = Math.max(0, Math.min(blueprint.length, opts.resumeFrom ?? 0))
  // Отдельный поток RNG после паузы — не перематываем прошлые броски.
  const rng = new SeededRng(
    resumeFrom > 0
      ? `${seed}-feast-resume-${resumeFrom}-${baseOvr}-${fieldSeed}`
      : `${seed}-feast-${baseOvr}-${fieldSeed}`,
  )
  const field = buildField(baseOvr, teamName, fieldSeed)
  const { low: placeLow, high: placeHigh } = projectPlaces(baseOvr, field)
  const difficultyThreat = opts.difficultyThreat ?? 0
  const campThreat = opts.threatAdjust ?? 0
  const campBuffer = opts.ovrBuffer ?? 0
  const modFrom = opts.modFromStage
  const modUntil = opts.modUntilStage

  const stages: StageDef[] = []
  let stagesCleared = -1
  let eliminatedAt: number | null = null
  let wins = 0
  let losses = 0

  for (let s = 0; s < blueprint.length; s += 1) {
    const bp = blueprint[s]

    // Уже пройденные до паузы — фиксируем победу, не бросаем заново.
    if (s < resumeFrom) {
      stages.push({
        id: bp.id,
        name: bp.name,
        kind: bp.kind,
        chapter: bp.chapter,
        difficulty: bp.difficulty,
        encounters: [],
        cleared: true,
        reasons: [],
        regionId: bp.regionId,
      })
      stagesCleared = s
      wins += bp.kind === 'boss' ? 3 : 2
      continue
    }

    const campActive =
      (modFrom === null || modFrom === undefined || s >= modFrom) &&
      (modUntil === null || modUntil === undefined || s < modUntil) &&
      (campThreat !== 0 || campBuffer !== 0)
    const ourOvr = (opts.overallByStage?.[s] ?? baseOvr) + (campActive ? campBuffer : 0)
    const encCount = bp.kind === 'boss' ? 3 : 2
    const encounters: EncounterDef[] = []
    let stageWon = true
    const threatShift = difficultyThreat + (campActive ? campThreat : 0)

    const regionPool = [
      ...encountersForRegion(bp.regionId),
      ...ENCOUNTER_POOL,
    ]
    for (let e = 0; e < encCount; e += 1) {
      const threat = Math.round(bp.difficulty - 1 + e * 2 + rng.int(0, 1) + threatShift)
      const won = ourOvr >= threat
      encounters.push({
        id: `${bp.id}-e${e}`,
        name:
          e === encCount - 1 && bp.kind === 'boss'
            ? bp.bossTitle
            : rng.pick(regionPool),
        threat,
        won,
        ourPower: ourOvr,
        noise: 0,
      })
      if (won) wins += 1
      else {
        losses += 1
        stageWon = false
        break
      }
    }

    const effectiveDiff = bp.difficulty + threatShift
    stages.push({
      id: bp.id,
      name: bp.name,
      kind: bp.kind,
      chapter: bp.chapter,
      difficulty: bp.difficulty,
      encounters,
      cleared: stageWon,
      reasons: stageReasons(score, ourOvr, effectiveDiff, stageWon),
      regionId: bp.regionId,
    })

    if (stageWon) stagesCleared = s
    else {
      eliminatedAt = s
      break
    }
  }

  for (let s = stages.length; s < blueprint.length; s += 1) {
    const bp = blueprint[s]
    stages.push({
      id: bp.id,
      name: bp.name,
      kind: bp.kind,
      chapter: bp.chapter,
      difficulty: bp.difficulty,
      encounters: [],
      cleared: false,
      reasons: [],
      regionId: bp.regionId,
    })
  }

  const perfect = stagesCleared === blueprint.length - 1

  const depths = field.map((t) => {
    if (t.isUser) return { t, depth: stagesCleared + 1 }
    return {
      t,
      depth: rivalDepth(t.strength, new SeededRng(`${seed}-depth-${t.id}-${fieldSeed}`), blueprint),
    }
  })
  depths.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth
    return b.t.strength - a.t.strength
  })
  const place = depths.findIndex((d) => d.t.isUser) + 1
  const championName = depths[0]?.t.name ?? '—'

  return {
    field,
    fieldSeed,
    stages,
    stagesCleared,
    eliminatedAt,
    place,
    placeLow,
    placeHigh,
    placeLabel: feastPlaceLabel(place),
    championName,
    perfect,
    record: `${wins}–${losses}`,
    wins,
    losses,
  }
}

export function isChapterBoss(stageIndex: number): boolean {
  return (stageIndex + 1) % 10 === 0
}

/** Совместимость: полоса угрозы главы по текущему PATH или runPath. */
export function chapterThreatBand(
  chapter: number,
  threatAdjust = 0,
  runPath?: readonly (RegionId | null)[],
): { min: number; max: number } {
  const path = runPath ? buildPathForRun(runPath) : PATH_STAGES
  return chapterThreatBandForPath(path, chapter, threatAdjust)
}
