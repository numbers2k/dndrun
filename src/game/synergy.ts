import {
  PARTY_BASE,
  PARTY_OVERALL_MAX,
  PARTY_OVERALL_MIN,
  PARTY_OVR_PIVOT,
  PARTY_OVR_SCALE,
  PARTY_SKILL_MAX,
  PARTY_SKILL_MIN,
  SPELL_ECO_HARD,
  SPELL_ECO_SOFT,
} from './balance'
import { MECH_QUIRK_BY_TEXT } from '../data/quirks'
import { SCHOOL_ROLE_AFFINITY, ROLE_STAT_WEIGHTS, SUBCLASS_MAP } from '../data/pools'
import type {
  AdventurerDef,
  ScoreBreakdown,
  SpellDef,
  SpellSlotState,
  SynergyAxes,
} from './types'
import { PARTY_SIZE, ROLE_ORDER } from './types'

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

  fit += Math.min(3, effectiveLevel * 0.35)
  fit += masteryBonus

  if (effectiveLevel >= 5 && adv.economy < SPELL_ECO_SOFT) fit -= 1.5
  if (effectiveLevel >= 7 && adv.economy < SPELL_ECO_HARD) fit -= 1

  const axis =
    adv.role === 'striker'
      ? spell.pressure
      : adv.role === 'controller'
        ? spell.control
        : adv.role === 'support' || adv.role === 'tank'
          ? spell.sustain
          : (spell.pressure + spell.control) / 2
  fit += (axis - 72) / 40

  return fit
}

function statFitFor(adv: AdventurerDef): number {
  const w = ROLE_STAT_WEIGHTS[adv.role]
  const score =
    (adv.impact / 100) * w.impact +
    (adv.economy / 100) * w.economy +
    (adv.reliability / 100) * w.reliability
  return clamp((score - 0.72) * 22, -4, 5)
}

function coverageScore(roster: AdventurerDef[]): number {
  if (roster.length === 0) return 0
  const counts = new Map(ROLE_ORDER.map((r) => [r, 0]))
  for (const a of roster) counts.set(a.role, (counts.get(a.role) ?? 0) + 1)
  const present = ROLE_ORDER.filter((r) => (counts.get(r) ?? 0) > 0).length
  // Штраф только за повтор роли, которую уже могли не брать. Пустые места будущего отряда не режут силу.
  const expected = Math.min(ROLE_ORDER.length, roster.length)
  const missing = Math.max(0, expected - present)
  let score = -missing * 3.2
  if (present === ROLE_ORDER.length) score += 4
  const maxStack = Math.max(...ROLE_ORDER.map((r) => counts.get(r) ?? 0))
  if (maxStack >= 3) score -= 2
  if (maxStack >= 4) score -= 2
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
      const roles = new Set([a.role, b.role])
      if (roles.has('tank') && roles.has('support')) pair += 2
      if (roles.has('striker') && roles.has('scout')) pair += 1.5
      if (roles.has('controller') && roles.has('striker')) pair += 1.2
      if (roles.has('tank') && roles.has('striker')) pair += 1
      if (a.role === b.role) pair -= 0.8
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
  if (avgRel < TAG_GLASS_SOFT) pen -= 3
  const avgEco = roster.reduce((s, a) => s + a.economy, 0) / roster.length
  const heavy = spellSlots.filter((s) => s.effectiveLevel >= 5).length
  if (heavy >= 3 && avgEco < SPELL_ECO_SOFT) pen -= 2.5
  const badFits = roster.filter((a) => a.roleFit <= -2).length
  if (badFits >= 2) pen -= 2
  if (badFits >= 3) pen -= 2
  return pen
}

/** Локальный порог «стеклянного» отряда (чуть ниже тега героя). */
const TAG_GLASS_SOFT = 70

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

/**
 * overall = anchor(mean OVR) + skill(−12…+12).
 * Навык драфта должен двигать число сильнее, чем «набери максимальный OVR».
 */
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
  const armed = roster.filter((adv) => {
    const idx = assignment[adv.id]
    return idx !== null && idx !== undefined && Boolean(spellSlots[idx])
  }).length
  // Пустые руки ещё не предложенного заклинания не размывают тех, у кого оно уже село.
  const spellFitAvg = armed > 0 ? spellRaw / armed : 1.5

  const { score: bond, top: chemTop } = bondScore(roster)
  const coverage = coverageScore(roster)
  const anti = antiSynergyScore(roster, spellSlots)

  let mechBond = 0
  let mechCoverage = 0
  let mechAnti = 0
  let mechSpell = 0
  let mechRole = 0
  for (const adv of roster) {
    const mq = adv.quirk ? MECH_QUIRK_BY_TEXT[adv.quirk] : undefined
    if (!mq) continue
    mechBond += mq.bond ?? 0
    mechCoverage += mq.coverage ?? 0
    mechAnti += mq.anti ?? 0
    mechSpell += mq.spellFit ?? 0
    mechRole += mq.roleFit ?? 0
  }

  const bondAdj = bond + mechBond
  const coverageAdj = coverage + mechCoverage
  const antiAdj = anti + mechAnti
  const spellFitAdj = spellFitAvg + mechSpell
  const roleFitAdj = roleFitAvg + mechRole

  const skillRaw =
    roleFitAdj * 2.8 +
    clamp(statFitAvg, -4, 5) * 1.0 +
    (spellFitAdj - 1.5) * 2.8 +
    bondAdj * 0.9 +
    coverageAdj * 1.85 +
    antiAdj * 1.6
  const skill = clamp(skillRaw, PARTY_SKILL_MIN, PARTY_SKILL_MAX)

  const ovrTerm = (base - PARTY_OVR_PIVOT) * PARTY_OVR_SCALE
  const overall = Math.round(
    clamp(PARTY_BASE + ovrTerm + skill, PARTY_OVERALL_MIN, PARTY_OVERALL_MAX),
  )

  const axes: SynergyAxes = {
    base: Math.round(base),
    roleFit: Math.round(roleFitAdj * 10) / 10,
    statFit: Math.round(statFitAvg * 10) / 10,
    spellFit: Math.round(spellFitAdj * 10) / 10,
    bondFit: Math.round(bondAdj * 10) / 10,
    coverage: Math.round(coverageAdj * 10) / 10,
    antiSynergy: Math.round(antiAdj * 10) / 10,
  }

  const reasons: string[] = []
  if (coverageAdj < 0) reasons.push('одни и те же роли')
  if (roleFitAdj < 0) reasons.push('герои не на своих местах')
  if (spellFitAdj < 1) reasons.push('заклинания плохо сидят')
  if (bondAdj > 3) reasons.push('сильные связки')
  if (antiAdj < -2) reasons.push('отряд мешает сам себе')
  if (mechBond + mechCoverage + mechSpell !== 0) reasons.push('причуды отряда')

  return {
    overall,
    base: Math.round(base),
    spellBonus: Math.round((spellFitAdj - 2) * 2.6 * 10) / 10,
    chemBonus: Math.round(bondAdj * 0.85 * 10) / 10,
    coverageBonus: Math.round(coverageAdj * 1.85 * 10) / 10,
    roleFitBonus: Math.round(roleFitAdj * 2.5 * 10) / 10,
    statFitBonus: Math.round(statFitAvg * 0.9 * 10) / 10,
    antiSynergy: Math.round(antiAdj * 1.4 * 10) / 10,
    axes,
    assignment,
    spellLines,
    chemTop,
    reasons,
  }
}
