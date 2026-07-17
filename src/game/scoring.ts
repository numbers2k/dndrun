import { SCHOOL_ROLE_AFFINITY } from '../data/pools'
import { SPELLS } from '../data/spells'
import type { CareerState } from './career'
import type {
  AdventurerDef,
  ClassId,
  PartySlots,
  ScoreBreakdown,
  SpellDef,
  SpellSlotState,
} from './types'
import { PARTY_SIZE } from './types'
import { computeSynergy, spellFitFor } from './synergy'

export function emptyParty(): PartySlots {
  return [null, null, null, null, null]
}

export function rosterFromParty(party: PartySlots): AdventurerDef[] {
  return party.filter((a): a is AdventurerDef => a !== null)
}

export function partyCount(party: PartySlots): number {
  return rosterFromParty(party).length
}

export function isDraftComplete(party: PartySlots, spellPool: SpellDef[]): boolean {
  return partyCount(party) >= PARTY_SIZE && spellPool.length >= PARTY_SIZE
}

export function slotsFromPool(spellPool: SpellDef[], existing?: SpellSlotState[]): SpellSlotState[] {
  return spellPool.map((spell, i) => {
    const prev = existing?.[i]
    if (prev && prev.spell.id === spell.id) return prev
    return { spell, effectiveLevel: spell.level, masteryBonus: 0 }
  })
}

export function computeScore(
  roster: AdventurerDef[],
  spellPool: SpellDef[],
  manualAssign?: Record<string, number | null> | null,
  spellSlots?: SpellSlotState[],
): ScoreBreakdown {
  const slots = spellSlots ?? slotsFromPool(spellPool)
  return computeSynergy(roster, slots, manualAssign)
}

export interface SpellRankRow {
  spell: SpellDef
  fit: number
  classFit: boolean
}

/** Лучшие спеллы из пула для героя (по spellFit). */
export function getBestSpellsFromPool(
  adventurer: AdventurerDef,
  pool: SpellDef[],
  limit = 12,
): SpellRankRow[] {
  return [...pool]
    .map((spell) => ({
      spell,
      fit: spellFitFor(adventurer, spell, spell.level, 0),
      classFit: spell.classes.includes(adventurer.classId),
    }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, limit)
}

/** Спеллы, уже открытые в карьере (тир + школы). */
function careerUnlockedSpells(career: CareerState): SpellDef[] {
  const filtered = SPELLS.filter(
    (s) => s.level <= career.maxSpellTier && career.unlockedSchools.includes(s.school),
  )
  return filtered.length > 0
    ? filtered
    : SPELLS.filter((s) => s.level <= career.maxSpellTier)
}

/** Топ спеллов из открытых в карьере для героя. */
export function getBestCareerSpells(
  adventurer: AdventurerDef,
  career: CareerState,
  limit = 5,
): SpellRankRow[] {
  return getBestSpellsFromPool(adventurer, careerUnlockedSpells(career), limit)
}

export interface ClassRankRow {
  classId: ClassId
  fit: number
  native: boolean
}

/** Подпись отношения класса к спеллу. */
export function classRelationLabel(row: ClassRankRow): string {
  if (row.native) return 'Родной класс'
  if (row.fit >= 1) return 'Смежный класс'
  return 'Чужой класс'
}

/** Подпись отношения спелла к герою (зеркало classRelationLabel). */
export function spellRelationLabel(row: SpellRankRow): string {
  if (row.classFit) return 'Родное'
  if (row.fit >= 1) return 'Смежное'
  return 'Чужое'
}

/** Фит спелла к классу (без конкретного героя). */
function classFitForSpell(classId: ClassId, spell: SpellDef): number {
  let fit = spell.classes.includes(classId) ? 3 : -1
  const school = SCHOOL_ROLE_AFFINITY[spell.school]
  if (school) {
    if (spell.roles && spell.roles.length > 0) {
      const avg =
        spell.roles.reduce((sum, role) => sum + (school[role] ?? 0), 0) / spell.roles.length
      fit += avg
    } else {
      fit += Math.max(0, ...Object.values(school)) * 0.5
    }
  }
  fit += Math.min(2, spell.level * 0.2)
  return fit
}

/** Топ открытых классов сейва по фиту к спеллу. */
export function getBestClassesForSpell(
  spell: SpellDef,
  unlockedClasses: ClassId[],
  limit = 5,
): ClassRankRow[] {
  return [...unlockedClasses]
    .map((classId) => ({
      classId,
      fit: classFitForSpell(classId, spell),
      native: spell.classes.includes(classId),
    }))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, limit)
}
