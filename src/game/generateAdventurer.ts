import {
  ALL_ROLES,
  CLASS_ROLE_AFFINITY,
  FIRST_NAMES,
  RACE_ROLE_MOD,
  ROLE_STAT_WEIGHTS,
  SUBCLASS_MAP,
  type SubclassId,
} from '../data/pools'
import type { AdventurerDef, CardRarity, ClassId, RaceId, RoleId } from './types'
import type { CareerState } from './career'
import type { SeededRng } from './rng'

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

function rollStat(rng: SeededRng, bias = 0): number {
  // Bell-ish: average of two rolls in 50–95
  const a = rng.int(50, 95)
  const b = rng.int(50, 95)
  return Math.max(45, Math.min(98, Math.round((a + b) / 2 + bias)))
}

function rarityFromStats(impact: number, economy: number, reliability: number): CardRarity {
  const avg = (impact + economy + reliability) / 3
  if (avg >= 88) return 'legendary'
  if (avg >= 78) return 'rare'
  return 'common'
}

function buildTags(
  role: RoleId,
  impact: number,
  economy: number,
  reliability: number,
  roleFit: number,
): string[] {
  const tags: string[] = []
  if (reliability >= 85) tags.push('фронт')
  if (reliability <= 60) tags.push('стекло')
  if (economy >= 85) tags.push('ритуал')
  if (impact >= 88) tags.push('давление')
  if (roleFit >= 2) tags.push('посадка+')
  if (roleFit <= -2) tags.push('офф-мета')
  if (role === 'scout' && economy >= 75) tags.push('след')
  return tags.slice(0, 2)
}

function pickRole(rng: SeededRng, classId: ClassId): RoleId {
  // Soft bias toward good fits, but allow anything
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
  const weights = ROLE_STAT_WEIGHTS[role]
  const impact = rollStat(rng, Math.round((weights.impact - 0.33) * 12))
  const economy = rollStat(rng, Math.round((weights.economy - 0.33) * 12))
  const reliability = rollStat(rng, Math.round((weights.reliability - 0.33) * 12))

  const ovr = Math.round(
    impact * 0.4 + economy * 0.3 + reliability * 0.3 + roleFit * 1.2 + rng.int(-2, 2),
  )
  const clampedOvr = Math.max(52, Math.min(94, ovr))
  const rarity = rarityFromStats(impact, economy, reliability)
  const name = uniqueName(rng, excludeNames)
  excludeNames.add(name.toLowerCase())

  return {
    id: `adv-${idSuffix}`,
    name,
    race,
    classId,
    role,
    subclassId,
    ovr: clampedOvr,
    impact,
    economy,
    reliability,
    roleFit,
    tags: buildTags(role, impact, economy, reliability, roleFit),
    rarity,
  }
}

/** Посадка роли: Слабо / Средне / Хорошо. */
export function roleFitLabel(fit: number): string {
  if (fit >= 2) return 'Хорошо'
  if (fit >= 0) return 'Средне'
  return 'Слабо'
}

export function rarityLabel(rarity: CardRarity): string {
  if (rarity === 'legendary') return 'Легендарная'
  if (rarity === 'rare') return 'Редкая'
  return 'Обычная'
}
