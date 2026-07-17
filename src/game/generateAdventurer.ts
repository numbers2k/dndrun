import {
  HERO_RARITY_BANDS,
  TAG_FRONT,
  TAG_GLASS,
  TAG_PRESSURE,
  TAG_RITUAL,
  TAG_SCOUT_ECO,
} from './balance'
import {
  ALL_ROLES,
  CLASS_ROLE_AFFINITY,
  FIRST_NAMES,
  RACE_ROLE_MOD,
  ROLE_STAT_WEIGHTS,
  SUBCLASS_MAP,
  type SubclassId,
} from '../data/pools'
import {
  MECH_QUIRKS,
  QUIRKS_BY_ROLE,
  QUIRKS_BY_TAG,
  QUIRKS_GENERIC,
} from '../data/quirks'
import { rarityLabel, rollHeroRarity } from './rarity'
import type { AdventurerDef, CardRarity, ClassId, RaceId, RoleId } from './types'
import type { CareerState } from './career'
import type { SeededRng } from './rng'

export { rarityLabel }

export function computeRoleFit(
  classId: ClassId,
  role: RoleId,
  race: RaceId,
  subclassId?: SubclassId,
): number {
  let fit = CLASS_ROLE_AFFINITY[classId][role]
  fit += RACE_ROLE_MOD[race]?.[role] ?? 0
  if (subclassId) {
    fit += SUBCLASS_MAP[subclassId]?.roleBonus[role] ?? 0
  }
  return Math.max(-4, Math.min(4, fit))
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Ось в полосе редкости + лёгкий bias роли. */
function rollAxis(rng: SeededRng, rarity: CardRarity, bias: number): number {
  const band = HERO_RARITY_BANDS[rarity]
  const span = band.axisMax - band.axisMin
  const a = rng.int(0, span)
  const b = rng.int(0, span)
  const raw = band.axisMin + Math.round((a + b) / 2 + bias)
  return clamp(raw, band.axisMin, band.axisMax)
}

function buildTags(
  role: RoleId,
  impact: number,
  economy: number,
  reliability: number,
  roleFit: number,
): string[] {
  const tags: string[] = []
  if (reliability >= TAG_FRONT) tags.push('фронт')
  if (reliability <= TAG_GLASS) tags.push('стекло')
  if (economy >= TAG_RITUAL) tags.push('ритуал')
  if (impact >= TAG_PRESSURE) tags.push('давление')
  if (roleFit >= 2) tags.push('посадка+')
  if (roleFit <= -2) tags.push('офф-мета')
  if (role === 'scout' && economy >= TAG_SCOUT_ECO) tags.push('след')
  return tags.slice(0, 2)
}

function pickRole(rng: SeededRng, classId: ClassId): RoleId {
  const weights = ALL_ROLES.map((role) => {
    const aff = CLASS_ROLE_AFFINITY[classId][role]
    return Math.max(1, 4 + aff)
  })
  const total = weights.reduce((s, w) => s + w, 0)
  let roll = rng.next() * total
  for (let i = 0; i < ALL_ROLES.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return ALL_ROLES[i]
  }
  return rng.pick(ALL_ROLES)
}

function uniqueName(rng: SeededRng, exclude: Set<string>): string {
  for (let i = 0; i < 80; i += 1) {
    const name = rng.pick(FIRST_NAMES)
    if (!exclude.has(name.toLowerCase())) return name
  }
  return `${rng.pick(FIRST_NAMES)}${rng.int(2, 99)}`
}

function pickQuirk(rng: SeededRng, role: RoleId, tags: string[]): string {
  // ~12% — механическая причуда (влияет на score)
  if (rng.next() < 0.12) return rng.pick(MECH_QUIRKS).text
  const fromTags = tags.flatMap((t) => QUIRKS_BY_TAG[t] ?? [])
  if (fromTags.length > 0 && rng.next() < 0.65) return rng.pick(fromTags)
  if (rng.next() < 0.7) return rng.pick(QUIRKS_BY_ROLE[role])
  return rng.pick(QUIRKS_GENERIC)
}

export function generateAdventurer(
  rng: SeededRng,
  career: CareerState,
  excludeNames: Set<string>,
  idSuffix: string,
): AdventurerDef {
  const race = rng.pick(career.unlockedRaces)
  const classId = rng.pick(career.unlockedClasses)
  const role = pickRole(rng, classId)

  const subclassPool = career.unlockedSubclasses
    .map((id) => SUBCLASS_MAP[id])
    .filter((s) => s && s.classId === classId)
  const subclassId =
    subclassPool.length > 0 && rng.next() < 0.45 ? rng.pick(subclassPool).id : undefined

  const roleFit = computeRoleFit(classId, role, race, subclassId)
  const rarity = rollHeroRarity(rng)
  const band = HERO_RARITY_BANDS[rarity]
  const weights = ROLE_STAT_WEIGHTS[role]

  let impact = rollAxis(rng, rarity, Math.round((weights.impact - 0.33) * 10))
  let economy = rollAxis(rng, rarity, Math.round((weights.economy - 0.33) * 10))
  let reliability = rollAxis(rng, rarity, Math.round((weights.reliability - 0.33) * 10))

  // Подтянуть к цели в полосе: часто верхняя треть — чтобы common перекрывал rare.
  const mean = (impact + economy + reliability) / 3
  const span = band.ovrMax - band.ovrMin
  const target =
    rng.next() < 0.42
      ? band.ovrMin + span * (0.55 + rng.next() * 0.45)
      : band.ovrMin + span * (0.2 + rng.next() * 0.45)
  const shift = Math.round((target - mean) * 0.55)
  impact = clamp(impact + shift, band.axisMin, band.axisMax)
  economy = clamp(economy + shift, band.axisMin, band.axisMax)
  reliability = clamp(reliability + shift, band.axisMin, band.axisMax)

  const rawOvr = Math.round(impact * 0.4 + economy * 0.3 + reliability * 0.3)
  const ovr = clamp(rawOvr, band.ovrMin, band.ovrMax)

  const name = uniqueName(rng, excludeNames)
  excludeNames.add(name.toLowerCase())
  const tags = buildTags(role, impact, economy, reliability, roleFit)

  return {
    id: `adv-${idSuffix}`,
    name,
    race,
    classId,
    role,
    subclassId,
    ovr,
    impact,
    economy,
    reliability,
    roleFit,
    tags,
    rarity,
    quirk: pickQuirk(rng, role, tags),
  }
}

/** Посадка роли: Слабо / Средне / Хорошо. */
export function roleFitLabel(fit: number): string {
  if (fit >= 2) return 'Хорошо'
  if (fit >= 0) return 'Средне'
  return 'Слабо'
}
