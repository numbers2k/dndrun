import { SeededRng } from './rng'
import type { ScoreBreakdown } from './types'

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
}

export interface StageDef {
  id: string
  name: string
  kind: 'route' | 'boss'
  chapter: number
  difficulty: number
  encounters: EncounterDef[]
  cleared: boolean
  /** Почему прошли или провалили (2–3 коротких причины). */
  reasons: string[]
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
  'Культ Пепла',
  'Железный Синдикат',
  'Лунные Охотники',
  'Орден Костей',
  'Вороны Бездны',
  'Стражи Соли',
  'Певцы Склепа',
  'Гильдия Искры',
  'Чёрный Причал',
  'Каменный Круг',
  'Тихие Клинки',
  'Багровый Дозор',
  'Пепельные Псы',
  'Соляные Вестники',
  'Круг Угля',
  'Ночные Факелы',
  'Золотая Трясина',
]

const CHAPTER_NAMES = [
  'Пепельная дорога',
  'Соляные топи',
  'Костяной перевал',
  'Лунные руины',
  'Склеп Эха',
  'Багровый мост',
  'Берег Бездны',
  'Чёрные врата',
  'Чертог Короны',
  'Трон Короны',
]

const CHAPTER_BLURBS = [
  'Первые засады и пыль тракта',
  'Топи, соль и слепые твари',
  'Узкие тропы под обстрелом',
  'Проклятые алтари под луной',
  'Нежить и ловушки гробниц',
  'Мост над пропастью огня',
  'Разломы и шёпот пустоты',
  'Культисты у порога трона',
  'Элитная стража короны',
  'Финальный владыка пути',
]

const ROUTE_NAMES = [
  'Засада у обочины',
  'Туманная гряда',
  'Соляной штрек',
  'Костяной спуск',
  'Лунный двор',
  'Эхо коридора',
  'Багровый сход',
  'Разлом берега',
  'Чёрный проход',
  'Зал стражи',
]

function buildPathStages(): {
  id: string
  name: string
  kind: 'route' | 'boss'
  chapter: number
  difficulty: number
  blurb: string
}[] {
  const stages = []
  for (let ch = 0; ch < 10; ch += 1) {
    for (let i = 0; i < 10; i += 1) {
      const n = ch * 10 + i + 1
      const isBoss = i === 9
      const difficulty = Math.round(62 + (n - 1) * 0.42 + (isBoss ? 3 : 0))
      stages.push({
        id: `s${n}`,
        name: isBoss ? `Босс: ${CHAPTER_NAMES[ch]}` : `${ROUTE_NAMES[i]} · гл.${ch + 1}`,
        kind: (isBoss ? 'boss' : 'route') as 'route' | 'boss',
        chapter: ch + 1,
        difficulty,
        blurb: isBoss ? CHAPTER_BLURBS[ch] : CHAPTER_BLURBS[ch],
      })
    }
  }
  return stages
}

export const PATH_STAGES = buildPathStages()
export const TOTAL_STAGES = PATH_STAGES.length
export const CHAPTER_COUNT = 10

const STAGE_BLUEPRINT = PATH_STAGES

const ENCOUNTER_POOL = [
  'Засада гоблинов',
  'Туманные ворги',
  'Проклятый алтарь',
  'Страж гробницы',
  'Отряд наёмников',
  'Огненный элементаль',
  'Тень архимага',
  'Костяной рыцарь',
  'Культисты Пепла',
  'Змей руин',
  'Призрак капитана',
  'Каменный голем',
  'Соляной ужас',
  'Лунный охотник',
  'Бездонный шёпот',
]

function ordinalRu(n: number): string {
  return `${n}-е`
}

function projectPlaces(our: number, field: FieldTeam[]): { low: number; high: number } {
  const sorted = [...field].sort((a, b) => b.strength - a.strength)
  const rank = sorted.findIndex((t) => t.isUser) + 1
  const jitter = our >= 95 ? 1 : our >= 85 ? 2 : our >= 75 ? 3 : 4
  const low = Math.max(1, rank - jitter)
  const high = Math.min(field.length, rank + jitter)
  return { low, high }
}

function rivalDepth(strength: number, rng: SeededRng): number {
  let cleared = 0
  for (let i = 0; i < STAGE_BLUEPRINT.length; i += 1) {
    const diff = STAGE_BLUEPRINT[i].difficulty
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
      Math.min(110, Math.max(55, ourOvr + rng.int(-20, 18) + (i < 3 ? 5 : 0))),
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

/** Симуляция с учётом силы на каждом этапе (апгрейды меняют overall по пути через score). */
export function planCampaign(
  score: ScoreBreakdown,
  seed: string,
  fieldSeed: number,
  teamName = 'Твой отряд',
  /** overallOverrides[stageIndex] если сила росла после апгрейдов — иначе константа */
  overallByStage?: number[],
): CampaignPlan {
  const baseOvr = score.overall
  const rng = new SeededRng(`${seed}-crown-${baseOvr}-${fieldSeed}`)
  const field = buildField(baseOvr, teamName, fieldSeed)
  const { low: placeLow, high: placeHigh } = projectPlaces(baseOvr, field)

  const stages: StageDef[] = []
  let stagesCleared = -1
  let eliminatedAt: number | null = null
  let wins = 0
  let losses = 0

  for (let s = 0; s < STAGE_BLUEPRINT.length; s += 1) {
    const bp = STAGE_BLUEPRINT[s]
    const ourOvr = overallByStage?.[s] ?? baseOvr
    const encCount = bp.kind === 'boss' ? 3 : 2
    const encounters: EncounterDef[] = []
    let stageWon = true

    for (let e = 0; e < encCount; e += 1) {
      const threat = Math.round(bp.difficulty - 3 + e * 3 + rng.int(0, 2))
      const noise = rng.next() * 6 - 2.5
      const won = ourOvr + noise >= threat
      encounters.push({
        id: `${bp.id}-e${e}`,
        name:
          e === encCount - 1 && bp.kind === 'boss'
            ? `Босс: ${CHAPTER_NAMES[bp.chapter - 1]}`
            : rng.pick(ENCOUNTER_POOL),
        threat,
        won,
      })
      if (won) wins += 1
      else {
        losses += 1
        stageWon = false
        break
      }
    }

    stages.push({
      id: bp.id,
      name: bp.name,
      kind: bp.kind,
      chapter: bp.chapter,
      difficulty: bp.difficulty,
      encounters,
      cleared: stageWon,
      reasons: stageReasons(score, ourOvr, bp.difficulty, stageWon),
    })

    if (stageWon) stagesCleared = s
    else {
      eliminatedAt = s
      break
    }
  }

  for (let s = stages.length; s < STAGE_BLUEPRINT.length; s += 1) {
    const bp = STAGE_BLUEPRINT[s]
    stages.push({
      id: bp.id,
      name: bp.name,
      kind: bp.kind,
      chapter: bp.chapter,
      difficulty: bp.difficulty,
      encounters: [],
      cleared: false,
      reasons: [],
    })
  }

  const perfect = stagesCleared === STAGE_BLUEPRINT.length - 1

  const depths = field.map((t) => {
    if (t.isUser) return { t, depth: stagesCleared + 1 }
    return { t, depth: rivalDepth(t.strength, new SeededRng(`${seed}-depth-${t.id}-${fieldSeed}`)) }
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
    placeLabel: ordinalRu(place),
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
