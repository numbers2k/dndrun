import { PACKS } from '../data/packs'
import { SPELLS } from '../data/spells'
import {
  appendSaveHistory,
  applyCareerProgress,
  getActiveSave,
  getActiveSaveId,
  loadCareer,
  setActiveSave,
  type CareerSave,
  type CareerState,
} from './career'
import { generateAdventurer } from './generateAdventurer'
import { SeededRng } from './rng'
import {
  computeScore,
  emptyParty,
  isDraftComplete,
  partyCount,
  rosterFromParty,
  slotsFromPool,
} from './scoring'
import { autoAssignSpells } from './synergy'
import type {
  AdventurerDef,
  CurrentPack,
  PartySlots,
  RunConfig,
  RunState,
  SpellDef,
  SpellUpgradeOffer,
} from './types'
import { PARTY_SIZE } from './types'
import { isChapterBoss, planCampaign, TOTAL_STAGES } from './simulate'

const DEFAULT_CONFIG: RunConfig = {
  rerolls: 3,
}

let careerCache: CareerState = loadCareer()

export function refreshCareer(): CareerState {
  careerCache = loadCareer()
  return careerCache
}

export function createMenuState(seed?: string): RunState {
  const active = getActiveSave()
  careerCache = active?.career ?? loadCareer()
  return {
    screen: 'menu',
    seed: seed ?? '',
    config: { rerolls: active?.difficulty ?? DEFAULT_CONFIG.rerolls },
    rerollsLeft: 0,
    party: emptyParty(),
    spellPool: [],
    spellSlots: [],
    current: null,
    spellAssign: {},
    drawCount: 0,
    fieldSeed: 1,
    teamName: active?.teamName ?? 'Твой отряд',
    activeSaveId: active?.id ?? getActiveSaveId(),
    result: null,
    pendingUpgrade: null,
    upgradesTaken: 0,
    pendingCommit: false,
    history: active?.history ?? [],
  }
}

/** Старт забега из активного сейва (или переданного). */
export function startRunFromSave(state: RunState, save: CareerSave, seed: string): RunState {
  setActiveSave(save.id)
  careerCache = save.career
  const next: RunState = {
    ...state,
    screen: 'draft',
    seed,
    config: { rerolls: save.difficulty },
    rerollsLeft: save.difficulty,
    party: emptyParty(),
    spellPool: [],
    spellSlots: [],
    current: null,
    spellAssign: {},
    drawCount: 0,
    fieldSeed: hashFieldSeed(seed),
    teamName: save.teamName,
    activeSaveId: save.id,
    result: null,
    pendingUpgrade: null,
    upgradesTaken: 0,
    pendingCommit: false,
    history: save.history,
  }
  return drawPack(next)
}

function hashFieldSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h || 1
}

function takenAdventurerIds(party: PartySlots): Set<string> {
  return new Set(rosterFromParty(party).map((a) => a.id))
}

function takenNames(party: PartySlots): Set<string> {
  return new Set(rosterFromParty(party).map((a) => a.name.toLowerCase()))
}

function firstEmptySlot(party: PartySlots): number | null {
  const idx = party.findIndex((a) => a === null)
  return idx >= 0 ? idx : null
}

function packIsUseful(
  pack: CurrentPack,
  party: PartySlots,
  spellPool: SpellDef[],
): boolean {
  const taken = takenAdventurerIds(party)
  const canAdv =
    partyCount(party) < PARTY_SIZE && pack.adventurers.some((a) => !taken.has(a.id))
  const canSpell = spellPool.length < PARTY_SIZE
  return canAdv || canSpell
}

function pickSpellsForCareer(rng: SeededRng, career: CareerState, count: number): SpellDef[] {
  const pool = SPELLS.filter(
    (s) => s.level <= career.maxSpellTier && career.unlockedSchools.includes(s.school),
  )
  const source = pool.length >= 5 ? pool : SPELLS.filter((s) => s.level <= career.maxSpellTier)
  const fallback = source.length ? source : SPELLS
  const spells: SpellDef[] = []
  for (let i = 0; i < count; i += 1) {
    spells.push(rng.pick(fallback))
  }
  return spells
}

function materializePack(
  packId: string,
  rng: SeededRng,
  excludeNames: Set<string>,
  career: CareerState,
  drawNonce = 0,
): CurrentPack {
  const template = PACKS.find((p) => p.id === packId) ?? rng.pick(PACKS)
  const names = new Set(excludeNames)
  const adventurers: AdventurerDef[] = []
  for (let i = 0; i < PARTY_SIZE; i += 1) {
    adventurers.push(
      generateAdventurer(rng, career, names, `${packId}-${rng.int(0, 99999)}-${i}`),
    )
  }
  return {
    /** Уникальный id каждого раздачи — иначе UI не видит смену набора. */
    id: `${template.id}-d${drawNonce}-${rng.int(10000, 999999)}`,
    name: template.name,
    chapter: template.chapter,
    adventurers,
    spells: pickSpellsForCareer(rng, career, PARTY_SIZE),
  }
}

export function drawPack(state: RunState): RunState {
  const drawCount = state.drawCount + 1
  const exclude = takenNames(state.party)
  const career = careerCache
  const rng = new SeededRng(
    `${state.seed}-draw-${drawCount}-${state.rerollsLeft}-${partyCount(state.party)}-${state.spellPool.length}`,
  )
  for (let i = 0; i < 80; i += 1) {
    const pack = materializePack(rng.pick(PACKS).id, rng, exclude, career, drawCount)
    if (packIsUseful(pack, state.party, state.spellPool)) {
      return { ...state, drawCount, current: pack }
    }
  }
  return {
    ...state,
    drawCount,
    current: materializePack(rng.pick(PACKS).id, rng, exclude, career, drawCount),
  }
}

function addToParty(party: PartySlots, adv: AdventurerDef): PartySlots {
  const slot = firstEmptySlot(party)
  if (slot === null) return party
  const next = [...party] as PartySlots
  next[slot] = adv
  return next
}

export function pickAdventurer(state: RunState, adv: AdventurerDef): RunState {
  if (state.pendingCommit) return state
  if (!state.current) return state
  if (takenAdventurerIds(state.party).has(adv.id)) return state
  if (takenNames(state.party).has(adv.name.toLowerCase())) return state
  if (partyCount(state.party) >= PARTY_SIZE) return state
  if (!state.current.adventurers.some((a) => a.id === adv.id)) return state

  const party = addToParty(state.party, adv)
  const next = { ...state, party }
  if (isDraftComplete(party, state.spellPool)) return finishDraft(next)
  return drawPack(next)
}

export function pickSpell(state: RunState, spell: SpellDef): RunState {
  if (state.pendingCommit) return state
  if (!state.current) return state
  if (state.spellPool.length >= PARTY_SIZE) return state
  if (!state.current.spells.some((s) => s.id === spell.id)) return state

  const spellPool = [...state.spellPool, spell]
  const spellSlots = slotsFromPool(spellPool, state.spellSlots)
  const next = { ...state, spellPool, spellSlots }
  if (isDraftComplete(state.party, spellPool)) return finishDraft(next)
  return drawPack(next)
}

export function reroll(state: RunState): RunState {
  if (state.pendingCommit) return state
  if (state.rerollsLeft <= 0) return state
  return drawPack({ ...state, rerollsLeft: state.rerollsLeft - 1 })
}

function finishDraft(state: RunState): RunState {
  const roster = rosterFromParty(state.party)
  const spellSlots = slotsFromPool(state.spellPool, state.spellSlots)
  const spellAssign = autoAssignSpells(roster, spellSlots)
  return {
    ...state,
    screen: 'draft',
    pendingCommit: true,
    spellSlots,
    spellAssign,
  }
}

/** Подтвердить отряд и перейти к Великому Походу. */
export function commitDraft(state: RunState): RunState {
  if (!state.pendingCommit) return state
  if (!isDraftComplete(state.party, state.spellPool)) return state
  return {
    ...state,
    screen: 'campaign',
    pendingCommit: false,
    // Последний пак оставляем на кадре драфта — пики уже недоступны
  }
}

export function setTeamName(state: RunState, teamName: string): RunState {
  return { ...state, teamName: teamName.trim() || 'Твой отряд' }
}

export function assignSpell(
  state: RunState,
  adventurerId: string,
  poolIndex: number,
): RunState {
  if (poolIndex < 0 || poolIndex >= state.spellSlots.length) return state
  return {
    ...state,
    spellAssign: { ...state.spellAssign, [adventurerId]: poolIndex },
  }
}

/** Swap spells between two adventurers (drag-and-drop). */
export function swapSpells(
  state: RunState,
  fromAdvId: string,
  toAdvId: string,
): RunState {
  const a = state.spellAssign[fromAdvId]
  const b = state.spellAssign[toAdvId]
  return {
    ...state,
    spellAssign: {
      ...state.spellAssign,
      [fromAdvId]: b ?? null,
      [toAdvId]: a ?? null,
    },
  }
}

function buildUpgradeOffers(
  state: RunState,
  chapter: number,
  rng: SeededRng,
): SpellUpgradeOffer[] {
  const offers: SpellUpgradeOffer[] = []
  const slots = state.spellSlots
  if (slots.length === 0) return offers

  const levelIdx = rng.int(0, slots.length - 1)
  const slot = slots[levelIdx]
  const cap = Math.min(9, 2 + chapter)
  if (slot.effectiveLevel < cap) {
    offers.push({
      id: `lvl-${levelIdx}`,
      kind: 'level',
      label: `Уровень: ${slot.spell.name}`,
      detail: `${slot.effectiveLevel} → ${slot.effectiveLevel + 1}`,
      poolIndex: levelIdx,
    })
  }

  const masteryIdx = rng.int(0, slots.length - 1)
  const mSlot = slots[masteryIdx]
  if (mSlot.masteryBonus < 3) {
    offers.push({
      id: `mas-${masteryIdx}`,
      kind: 'mastery',
      label: `Владение: ${mSlot.spell.name}`,
      detail: `синергия +1 (сейчас ${mSlot.masteryBonus})`,
      poolIndex: masteryIdx,
    })
  }

  const career = careerCache
  const higher = SPELLS.filter(
    (s) =>
      s.level > Math.min(...slots.map((x) => x.effectiveLevel)) &&
      s.level <= career.maxSpellTier + 1 &&
      career.unlockedSchools.includes(s.school),
  )
  const replacePool = higher.length ? higher : SPELLS.filter((s) => s.level >= 3)
  const newSpell = rng.pick(replacePool.length ? replacePool : SPELLS)
  const replaceIdx = rng.int(0, slots.length - 1)
  offers.push({
    id: `rep-${replaceIdx}`,
    kind: 'replace',
    label: `Замена: ${slots[replaceIdx].spell.name}`,
    detail: `→ ${newSpell.name} (${newSpell.level} ур.)`,
    poolIndex: replaceIdx,
    newSpell,
  })

  // Ensure 3 unique-ish offers
  while (offers.length < 3) {
    const i = rng.int(0, slots.length - 1)
    offers.push({
      id: `lvl-extra-${offers.length}`,
      kind: 'level',
      label: `Уровень: ${slots[i].spell.name}`,
      detail: `${slots[i].effectiveLevel} → ${Math.min(9, slots[i].effectiveLevel + 1)}`,
      poolIndex: i,
    })
  }

  return offers.slice(0, 3)
}

export function applySpellUpgrade(state: RunState, offerId: string): RunState {
  if (!state.pendingUpgrade) return state
  const offer = state.pendingUpgrade.find((o) => o.id === offerId)
  if (!offer || offer.poolIndex === undefined) {
    // Считаем главу закрытой по апгрейду, иначе resolve снова встанет на том же боссе.
    return {
      ...state,
      pendingUpgrade: null,
      upgradesTaken: state.upgradesTaken + 1,
    }
  }

  const spellSlots = state.spellSlots.map((s) => ({ ...s }))
  const idx = offer.poolIndex
  const slot = spellSlots[idx]
  if (!slot) {
    return {
      ...state,
      pendingUpgrade: null,
      upgradesTaken: state.upgradesTaken + 1,
    }
  }

  if (offer.kind === 'level') {
    slot.effectiveLevel = Math.min(9, slot.effectiveLevel + 1)
  } else if (offer.kind === 'mastery') {
    slot.masteryBonus = Math.min(3, slot.masteryBonus + 1)
  } else if (offer.kind === 'replace' && offer.newSpell) {
    spellSlots[idx] = {
      spell: offer.newSpell,
      effectiveLevel: offer.newSpell.level,
      masteryBonus: 0,
    }
  }

  const spellPool = spellSlots.map((s) => s.spell)
  const roster = rosterFromParty(state.party)
  const spellAssign = autoAssignSpells(roster, spellSlots)

  return {
    ...state,
    spellSlots,
    spellPool,
    spellAssign,
    pendingUpgrade: null,
    upgradesTaken: state.upgradesTaken + 1,
  }
}

export function skipSpellUpgrade(state: RunState): RunState {
  return {
    ...state,
    pendingUpgrade: null,
    /** Без +1 simulateFrom снова останавливается на том же боссе — поход «залипает». */
    upgradesTaken: state.upgradesTaken + 1,
  }
}

/**
 * Полный поход с апгрейдами после боссов глав:
 * идём этап за этапом; после босса главы (если пройден) — пауза на выбор апгрейда
 * при resolveRun считаем сразу с авто-апгрейдами лучшего spellFit, если игрок уже выбрал все,
 * либо симулируем с текущими слотами и вставляем pending если остановились на апгрейде.
 *
 * Для UI CampaignScreen: сначала resolveRun считает путь до первого апгрейда / конца.
 * Затем игрок выбирает апгрейд и вызывается continueCampaign.
 */
export function resolveRun(state: RunState): RunState {
  return simulateFrom(state, 0, {})
}

export function continueCampaign(state: RunState): RunState {
  if (state.result) return state
  const cleared = state.upgradesTaken * 10
  // Continue from next stage after last completed chapter boss
  const startStage = Math.min(cleared, TOTAL_STAGES - 1)
  return simulateFrom(state, startStage, {})
}

function simulateFrom(
  state: RunState,
  startStage: number,
  _unused: Record<string, never>,
): RunState {
  const roster = rosterFromParty(state.party)
  let spellSlots = state.spellSlots.map((s) => ({ ...s, spell: s.spell }))
  let spellAssign = { ...state.spellAssign }
  let upgradesTaken = state.upgradesTaken

  const overallByStage: number[] = []
  let score = computeScore(roster, spellSlots.map((s) => s.spell), spellAssign, spellSlots)

  // Pre-walk: when we would hit a chapter boss clear, pause for upgrade if not yet taken
  // Simpler approach: simulate full campaign with current power; if we clear a boss chapter
  // and upgradesTaken < chapter, stop and offer upgrade, then UI continues.

  // Build stage-by-stage with current score, stop after clearing a boss that needs upgrade
  const probe = planCampaign(score, state.seed, state.fieldSeed, state.teamName)
  let stopForUpgradeAt: number | null = null

  for (let s = 0; s <= probe.stagesCleared; s += 1) {
    overallByStage[s] = score.overall
    if (isChapterBoss(s) && probe.stages[s]?.cleared) {
      const chapter = Math.floor(s / 10) + 1
      if (upgradesTaken < chapter && chapter < 10) {
        stopForUpgradeAt = s
        break
      }
    }
  }

  if (stopForUpgradeAt !== null && startStage === 0 && !state.result) {
    // Partial: show campaign up to that boss, then pending upgrade
    const partialOverall = Array.from({ length: TOTAL_STAGES }, (_, i) =>
      i <= stopForUpgradeAt! ? score.overall : score.overall,
    )
    const plan = planCampaign(
      score,
      state.seed,
      state.fieldSeed,
      state.teamName,
      partialOverall,
    )
    // Force clear only up to stopForUpgradeAt
    for (let i = 0; i < plan.stages.length; i += 1) {
      if (i < stopForUpgradeAt) {
        plan.stages[i].cleared = true
      } else if (i === stopForUpgradeAt) {
        plan.stages[i].cleared = true
      } else {
        plan.stages[i].cleared = false
        plan.stages[i].encounters = []
        plan.stages[i].reasons = []
      }
    }
    plan.stagesCleared = stopForUpgradeAt
    plan.eliminatedAt = null
    plan.perfect = false

    const rng = new SeededRng(`${state.seed}-up-${upgradesTaken}-${stopForUpgradeAt}`)
    const chapter = Math.floor(stopForUpgradeAt / 10) + 1
    const offers = buildUpgradeOffers({ ...state, spellSlots }, chapter, rng)

    return {
      ...state,
      screen: 'campaign',
      spellSlots,
      spellAssign,
      pendingUpgrade: offers,
      // Keep result null until campaign fully ends — store interim on a soft result?
      // Use a provisional result for UI path display
      result: {
        record: plan.record,
        wins: plan.wins,
        losses: plan.losses,
        score,
        matches: plan.stages.flatMap((stage) =>
          stage.encounters.map((enc) => ({
            round: stage.name,
            opponent: enc.name,
            won: enc.won,
            ourOvr: score.overall,
            theirOvr: enc.threat,
          })),
        ),
        perfect: false,
        place: plan.place,
        placeLabel: plan.placeLabel,
        championName: plan.championName,
        stagesCleared: stopForUpgradeAt + 1,
        stageNames: plan.stages.filter((s) => s.cleared).map((s) => s.name),
        stageReasons: plan.stages.map((s) => s.reasons),
        unlocks: [],
      },
    }
  }

  // Full finish with current slots — re-simulate applying auto best upgrades for remaining
  // chapters if player somehow skipped UI (continue after upgrade)
  const plan = planCampaign(score, state.seed, state.fieldSeed, state.teamName, overallByStage)

  // If we can still upgrade and died after a boss... handled above.
  // Check if cleared another boss needing upgrade mid-continue
  if (plan.stagesCleared >= 0) {
    for (let s = startStage; s <= plan.stagesCleared; s += 1) {
      if (isChapterBoss(s) && plan.stages[s]?.cleared) {
        const chapter = Math.floor(s / 10) + 1
        if (upgradesTaken < chapter && chapter < 10) {
          const rng = new SeededRng(`${state.seed}-up-${upgradesTaken}-${s}`)
          return {
            ...state,
            spellSlots,
            spellAssign,
            pendingUpgrade: buildUpgradeOffers({ ...state, spellSlots }, chapter, rng),
            result: {
              record: plan.record,
              wins: plan.wins,
              losses: plan.losses,
              score,
              matches: [],
              perfect: false,
              place: plan.place,
              placeLabel: plan.placeLabel,
              championName: plan.championName,
              stagesCleared: s + 1,
              stageNames: plan.stages.slice(0, s + 1).filter((x) => x.cleared).map((x) => x.name),
              stageReasons: plan.stages.map((st) => st.reasons),
              unlocks: [],
            },
          }
        }
      }
    }
  }

  const { unlocks } = applyCareerProgress(
    careerCache,
    plan.stagesCleared + 1,
    plan.perfect,
  )
  careerCache = loadCareer()

  const result = {
    record: plan.record,
    wins: plan.wins,
    losses: plan.losses,
    score,
    matches: plan.stages.flatMap((stage) =>
      stage.encounters.map((enc) => ({
        round: stage.name,
        opponent: enc.name,
        won: enc.won,
        ourOvr: score.overall,
        theirOvr: enc.threat,
      })),
    ),
    perfect: plan.perfect,
    place: plan.place,
    placeLabel: plan.placeLabel,
    championName: plan.championName,
    stagesCleared: plan.stagesCleared + 1,
    stageNames: plan.stages.filter((s) => s.cleared).map((s) => s.name),
    stageReasons: plan.stages.map((s) => s.reasons),
    unlocks,
  }

  const historyEntry = {
    seed: state.seed,
    record: result.record,
    ovr: score.overall,
    place: result.place,
    stages: result.stagesCleared,
    date: new Date().toISOString(),
  }
  const history = [historyEntry, ...state.history].slice(0, 20)
  if (state.activeSaveId) {
    appendSaveHistory(state.activeSaveId, historyEntry)
  }

  return {
    ...state,
    screen: 'campaign',
    // Последний пак остаётся на кадре драфта (пики уже недоступны).
    pendingUpgrade: null,
    result,
    history,
  }
}

/** After picking an upgrade, resume and finish (or next upgrade). */
export function afterUpgradeContinue(state: RunState): RunState {
  const withClearPending = { ...state, pendingUpgrade: null, result: null }
  // Re-resolve from scratch with higher power — upgrades already in spellSlots
  return resolveRun(withClearPending)
}

export function canPickAdventurer(state: RunState, adv: AdventurerDef): boolean {
  if (state.pendingCommit || state.screen === 'campaign') return false
  if (!state.current) return false
  if (partyCount(state.party) >= PARTY_SIZE) return false
  if (takenAdventurerIds(state.party).has(adv.id)) return false
  if (takenNames(state.party).has(adv.name.toLowerCase())) return false
  return state.current.adventurers.some((a) => a.id === adv.id)
}

export function canPickSpell(state: RunState, spell: SpellDef): boolean {
  if (state.pendingCommit || state.screen === 'campaign') return false
  if (!state.current) return false
  if (state.spellPool.length >= PARTY_SIZE) return false
  return state.current.spells.some((s) => s.id === spell.id)
}

