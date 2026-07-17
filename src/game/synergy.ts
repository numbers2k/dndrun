import { SCHOOL_ROLE_AFFINITY, ROLE_STAT_WEIGHTS, SUBCLASS_MAP } from '../data/pools'
import type {
  AdventurerDef,
  ScoreBreakdown,
  SpellDef,
  SpellSlotState,
  SynergyAxes,
} from './types'
import { PARTY_SIZE, ROLE_ORDER } from './types'

const BASE_WEIGHT = 0.38
const ROLE_FIT_WEIGHT = 0.12
const STAT_FIT_WEIGHT = 0.12
const SPELL_FIT_WEIGHT = 0.18
const BOND_WEIGHT = 0.1
const COVERAGE_WEIGHT = 0.08
const ANTI_WEIGHT = 0.02

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function spellFitFor(
  adv: AdventurerDef,
  spell: SpellDef,
  effectiveLevel: number,
  masteryBonus = 0,
): number {
  let fit = 0
  if (spell.classes.includes(adv.classId)) fit += 3
  else fit -= 1

  const schoolRole = SCHOOL_ROLE_AFFINITY[spell.school]?.[adv.role] ?? 0
  fit += schoolRole

  if (spell.roles?.includes(adv.role)) fit += 1.5

  if (adv.subclassId) {
    fit += SUBCLASS_MAP[adv.subclassId]?.schoolBonus[spell.school] ?? 0
  }

  // Higher tier spells reward more when fitted
  fit += Math.min(3, effectiveLevel * 0.35)
  fit += masteryBonus

  // Economy matters for high-level spells
  if (effectiveLevel >= 5 && adv.economy < 65) fit -= 1.5
  if (effectiveLevel >= 7 && adv.economy < 75) fit -= 1

  // Лёгкий вес осей спелла под роль (не ломает класс/школу)
  const axis =
    adv.role === 'striker'
      ? spell.pressure
      : adv.role === 'controller'
        ? spell.control
        : adv.role === 'support' || adv.role === 'tank'
          ? spell.sustain
          : (spell.pressure + spell.control) / 2
  fit += (axis - 70) / 40

  return fit
}

function statFitFor(adv: AdventurerDef): number {
  const w = ROLE_STAT_WEIGHTS[adv.role]
  const score =
    (adv.impact / 100) * w.impact +
    (adv.economy / 100) * w.economy +
    (adv.reliability / 100) * w.reliability
  // Map 0.45–0.95 → roughly -3…+4
  return clamp((score - 0.68) * 20, -4, 5)
}

function coverageScore(roster: AdventurerDef[]): number {
  if (roster.length === 0) return 0
  const counts = new Map(ROLE_ORDER.map((r) => [r, 0]))
  for (const a of roster) counts.set(a.role, (counts.get(a.role) ?? 0) + 1)
  const missing = ROLE_ORDER.filter((r) => (counts.get(r) ?? 0) === 0).length
  let score = -missing * 2.5
  if (missing === 0) score += 3
  const maxStack = Math.max(...ROLE_ORDER.map((r) => counts.get(r) ?? 0))
  if (maxStack >= 3) score -= 1.5
  if (maxStack >= 4) score -= 1.5
  return score
}

function bondScore(roster: AdventurerDef[]): { score: number; top: { names: string[]; games: number }[] } {
  let score = 0
  const top: { names: string[]; games: number }[] = []
  for (let i = 0; i < roster.length; i += 1) {
    for (let j = i + 1; j < roster.length; j += 1) {
      const a = roster[i]
      const b = roster[j]
      let pair = 0
      if (a.race === b.race) pair += 1.2
      // Complementary roles
      const roles = new Set([a.role, b.role])
      if (roles.has('tank') && roles.has('support')) pair += 2
      if (roles.has('striker') && roles.has('scout')) pair += 1.5
      if (roles.has('controller') && roles.has('striker')) pair += 1.2
      if (roles.has('tank') && roles.has('striker')) pair += 1
      if (a.role === b.role) pair -= 0.8
      // Class synergy lite
      if (
        (a.classId === 'cleric' && b.classId === 'paladin') ||
        (a.classId === 'wizard' && b.classId === 'fighter') ||
        (a.classId === 'ranger' && b.classId === 'rogue')
      ) {
        pair += 1.5
      }
      if (pair > 0) {
        score += pair
        top.push({
          names: [a.name, b.name],
          games: Math.round(pair * 40),
        })
      }
    }
  }
  top.sort((x, y) => y.games - x.games)
  return { score: clamp(score, -4, 10), top: top.slice(0, 4) }
}

function antiSynergyScore(roster: AdventurerDef[], spellSlots: SpellSlotState[]): number {
  if (roster.length === 0) return 0
  let pen = 0
  const avgRel = roster.reduce((s, a) => s + a.reliability, 0) / roster.length
  if (avgRel < 62) pen -= 3
  const avgEco = roster.reduce((s, a) => s + a.economy, 0) / roster.length
  const heavy = spellSlots.filter((s) => s.effectiveLevel >= 5).length
  if (heavy >= 3 && avgEco < 68) pen -= 2.5
  const badFits = roster.filter((a) => a.roleFit <= -2).length
  if (badFits >= 2) pen -= 2
  if (badFits >= 3) pen -= 2
  return pen
}

export function autoAssignSpells(
  roster: AdventurerDef[],
  spellSlots: SpellSlotState[],
): Record<string, number | null> {
  const n = Math.min(PARTY_SIZE, roster.length, spellSlots.length)
  if (n === 0) return {}

  const indices = Array.from({ length: n }, (_, i) => i)
  const perms = permutations(indices)
  let bestScore = -Infinity
  let best = indices

  for (const perm of perms) {
    let score = 0
    for (let i = 0; i < n; i += 1) {
      const slot = spellSlots[perm[i]]
      const adv = roster[i]
      if (!slot || !adv) continue
      score += spellFitFor(adv, slot.spell, slot.effectiveLevel, slot.masteryBonus)
    }
    if (score > bestScore) {
      bestScore = score
      best = perm
    }
  }

  const assign: Record<string, number | null> = {}
  for (let i = 0; i < roster.length; i += 1) {
    assign[roster[i].id] = i < n ? best[i] : null
  }
  return assign
}

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  const result: number[][] = []
  for (let i = 0; i < arr.length; i += 1) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permutations(rest)) result.push([arr[i], ...p])
  }
  return result
}

export function computeSynergy(
  roster: AdventurerDef[],
  spellSlots: SpellSlotState[],
  manualAssign?: Record<string, number | null> | null,
): ScoreBreakdown {
  if (roster.length === 0) {
    const emptyAxes: SynergyAxes = {
      base: 0,
      roleFit: 0,
      statFit: 0,
      spellFit: 0,
      bondFit: 0,
      coverage: 0,
      antiSynergy: 0,
    }
    return {
      overall: 0,
      base: 0,
      spellBonus: 0,
      chemBonus: 0,
      coverageBonus: 0,
      roleFitBonus: 0,
      statFitBonus: 0,
      antiSynergy: 0,
      axes: emptyAxes,
      assignment: {},
      spellLines: [],
      chemTop: [],
      reasons: [],
    }
  }

  const assignment =
    manualAssign && Object.keys(manualAssign).length
      ? manualAssign
      : autoAssignSpells(roster, spellSlots)

  const base = roster.reduce((s, a) => s + a.ovr, 0) / roster.length
  const roleFitAvg = roster.reduce((s, a) => s + a.roleFit, 0) / roster.length
  const statFitAvg = roster.reduce((s, a) => s + statFitFor(a), 0) / roster.length

  let spellRaw = 0
  const spellLines: ScoreBreakdown['spellLines'] = []
  for (const adv of roster) {
    const idx = assignment[adv.id]
    if (idx === null || idx === undefined) continue
    const slot = spellSlots[idx]
    if (!slot) continue
    const fit = spellFitFor(adv, slot.spell, slot.effectiveLevel, slot.masteryBonus)
    spellRaw += fit
    spellLines.push({ adventurerId: adv.id, spellId: slot.spell.id, fit: Math.round(fit * 10) / 10 })
  }
  const spellFitAvg = roster.length ? spellRaw / roster.length : 0

  const { score: bond, top: chemTop } = bondScore(roster)
  const coverage = coverageScore(roster)
  const anti = antiSynergyScore(roster, spellSlots)

  // Scale axes into roughly comparable contribution points
  const basePart = base * BASE_WEIGHT * 2.2
  const rolePart = roleFitAvg * ROLE_FIT_WEIGHT * 8
  const statPart = statFitAvg * STAT_FIT_WEIGHT * 6
  const spellPart = spellFitAvg * SPELL_FIT_WEIGHT * 5
  const bondPart = bond * BOND_WEIGHT * 4
  const covPart = coverage * COVERAGE_WEIGHT * 6
  const antiPart = anti * ANTI_WEIGHT * 10

  const overall = Math.round(
    clamp(basePart + rolePart + statPart + spellPart + bondPart + covPart + antiPart, 40, 115),
  )

  const axes: SynergyAxes = {
    base: Math.round(base),
    roleFit: Math.round(roleFitAvg * 10) / 10,
    statFit: Math.round(statFitAvg * 10) / 10,
    spellFit: Math.round(spellFitAvg * 10) / 10,
    bondFit: Math.round(bond * 10) / 10,
    coverage: Math.round(coverage * 10) / 10,
    antiSynergy: Math.round(anti * 10) / 10,
  }

  const reasons: string[] = []
  if (coverage < 0) reasons.push('дыры в ролях')
  if (roleFitAvg < 0) reasons.push('слабая посадка ролей')
  if (spellFitAvg < 1) reasons.push('слабые спеллы')
  if (bond > 3) reasons.push('сильные связки')
  if (anti < -2) reasons.push('антисинергия')

  return {
    overall,
    base: Math.round(base),
    spellBonus: Math.round(spellPart * 10) / 10,
    chemBonus: Math.round(bondPart * 10) / 10,
    coverageBonus: Math.round(covPart * 10) / 10,
    roleFitBonus: Math.round(rolePart * 10) / 10,
    statFitBonus: Math.round(statPart * 10) / 10,
    antiSynergy: Math.round(antiPart * 10) / 10,
    axes,
    assignment,
    spellLines,
    chemTop,
    reasons,
  }
}

