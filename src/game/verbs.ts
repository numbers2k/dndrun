import type { AdventurerDef, RoleId, SpellDef } from './types'
import { ROLE_LABEL_FULL } from './types'

export const ROLE_VERB: Record<RoleId, string> = {
  tank: 'держит строй',
  striker: 'рвёт с фланга',
  controller: 'ломает строй',
  support: 'держит своих',
  scout: 'видит засаду',
}

export function spellVerb(spell: SpellDef): string {
  if (spell.pressure >= spell.control && spell.pressure >= spell.sustain) return 'давит'
  if (spell.control >= spell.sustain) return 'держит'
  return 'лечит'
}

export function roleCoverageLabel(roster: AdventurerDef[]): string {
  const roles = new Set(roster.map((a) => a.role))
  return `роли ${roles.size}/5`
}

/** Подсказка на карте: дыра в отряде или нужда двери. */
export function heroHint(
  adv: AdventurerDef,
  roster: AdventurerDef[],
  wanted: RoleId[],
): string | null {
  const have = new Set(roster.map((a) => a.role))
  if (have.has(adv.role)) return null
  if (wanted.includes(adv.role)) return 'закроет дыру'
  if (roster.length > 0) return 'новая роль'
  return null
}

export function spellHint(
  spell: SpellDef,
  roster: AdventurerDef[],
  wanted: RoleId[],
): string | null {
  const have = new Set(roster.map((a) => a.role))
  const roles = spell.roles ?? []
  if (roles.some((r) => wanted.includes(r) && !have.has(r))) return 'закроет дыру'
  if (roster.some((a) => spell.classes.includes(a.classId))) return 'сядет'
  return null
}

export function missingRoleNames(roster: AdventurerDef[], wanted: RoleId[]): string[] {
  const have = new Set(roster.map((a) => a.role))
  return wanted.filter((r) => !have.has(r)).map((r) => ROLE_LABEL_FULL[r])
}
