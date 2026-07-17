import { PACKS } from '../data/packs'
import {
  FINALE_REGION_ID,
  INTRO_REGION_ID,
  REGION_MAP,
  STARTER_MID_REGIONS,
  nextRegionChoices,
  type RegionId,
} from '../data/regions'
import { SPELLS } from '../data/spells'
import { pickWeightedByRarity } from './rarity'
import { buildRunAutopsy } from './autopsy'
import {
  appendSaveHistory,
  applyCareerProgress,
  difficultyThreatAdjust,
  getActiveSave,
  getActiveSaveId,
  loadCareer,
  markCareerSeen,
  setActiveSave,
  type CareerSave,
  type CareerState,
} from './career'
import { generateAdventurer } from './generateAdventurer'
import { defaultRunPath, type RunPath } from './path'
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
  CampOffer,
  CurrentPack,
  PartySlots,
  RouteOffer,
  RunConfig,
  RunState,
  SpellDef,
  SpellUpgradeOffer,
} from './types'
import { DEFAULT_CAMPAIGN_MODS, PARTY_SIZE } from './types'
import { isChapterBoss, planCampaign, TOTAL_STAGES } from './simulate'

const DEFAULT_CONFIG: RunConfig = {
  rerolls: 3,
}

/** Актуальная карьера активного сейва (без module-global кэша). */
export function refreshCareer(): CareerState {
  return loadCareer()
}

function activeCareer(): CareerState {
  return getActiveSave()?.career ?? loadCareer()
}

export function createMenuState(seed?: string): RunState {
  const active = getActiveSave()
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
    pendingCamp: null,
    pendingRoute: null,
    campaignMods: { ...DEFAULT_CAMPAIGN_MODS },
    difficultyThreat: difficultyThreatAdjust(active?.difficulty ?? 3),
    runPath: defaultRunPath(active?.career.bestStage ?? 0, seed ?? 'menu'),
    upgradesTaken: 0,
    pendingCommit: false,
    history: active?.history ?? [],
  }
}

/** Старт вылазки из активного сейва (или переданного). */
export function startRunFromSave(state: RunState, save: CareerSave, seed: string): RunState {
  setActiveSave(save.id)
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
    pendingCamp: null,
    pendingRoute: null,
    campaignMods: { ...DEFAULT_CAMPAIGN_MODS },
    difficultyThreat: difficultyThreatAdjust(save.difficulty),
    runPath: defaultRunPath(save.career.bestStage, seed),
    upgradesTaken: 0,
    pendingCommit: false,
    history: save.history,
  }
  noteSeenRegions([INTRO_REGION_ID])
  return drawPack(next)
}

function planOpts(state: RunState, overallByStage?: number[], resumeFrom = 0) {
  return {
    overallByStage,
    threatAdjust: state.campaignMods.threatAdjust,
    ovrBuffer: state.campaignMods.ovrBuffer,
    modFromStage: state.campaignMods.modFromStage,
    modUntilStage: state.campaignMods.modUntilStage,
    difficultyThreat: state.difficultyThreat,
    runPath: state.runPath,
    resumeFrom,
  }
}

function matchesFromPlan(plan: { stages: { name: string; encounters: { name: string; won: boolean; threat: number; ourPower: number; noise: number }[] }[] }) {
  return plan.stages.flatMap((stage) =>
    stage.encounters.map((enc) => ({
      round: stage.name,
      opponent: enc.name,
      won: enc.won,
      ourOvr: enc.ourPower,
      theirOvr: enc.threat,
      noise: enc.noise,
    })),
  )
}

function noteSeenFromPack(state: RunState): void {
  if (!state.current || !state.activeSaveId) return
  const advs = state.current.adventurers
  markCareerSeen(activeCareer(), {
    races: advs.map((a) => a.race),
    classes: advs.map((a) => a.classId),
    subclasses: advs.map((a) => a.subclassId).filter(Boolean) as NonNullable<
      AdventurerDef['subclassId']
    >[],
    spellIds: state.current.spells.map((s) => s.id),
  })
}

function noteSeenRegions(regionIds: Array<RegionId | null | undefined>): void {
  const regions = regionIds.filter((id): id is RegionId => Boolean(id))
  if (!regions.length) return
  markCareerSeen(activeCareer(), { regions })
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
    spells.push(pickWeightedByRarity(rng, fallback))
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
  const career = activeCareer()
  const rng = new SeededRng(
    `${state.seed}-draw-${drawCount}-${state.rerollsLeft}-${partyCount(state.party)}-${state.spellPool.length}`,
  )
  for (let i = 0; i < 80; i += 1) {
    const pack = materializePack(rng.pick(PACKS).id, rng, exclude, career, drawCount)
    if (packIsUseful(pack, state.party, state.spellPool)) {
      const next = { ...state, drawCount, current: pack }
      noteSeenFromPack(next)
      return next
    }
  }
  const current = materializePack(rng.pick(PACKS).id, rng, exclude, career, drawCount)
  const next = { ...state, drawCount, current }
  noteSeenFromPack(next)
  return next
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

  if (state.activeSaveId) {
    markCareerSeen(activeCareer(), {
      races: [adv.race],
      classes: [adv.classId],
      subclasses: adv.subclassId ? [adv.subclassId] : [],
    })
  }

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

  if (state.activeSaveId) {
    markCareerSeen(activeCareer(), { spellIds: [spell.id] })
  }

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

/** Подтвердить отряд и перейти к вылазке. */
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

  const career = activeCareer()
  const higher = SPELLS.filter(
    (s) =>
      s.level > Math.min(...slots.map((x) => x.effectiveLevel)) &&
      s.level <= career.maxSpellTier + 1 &&
      career.unlockedSchools.includes(s.school),
  )
  const replacePool = higher.length ? higher : SPELLS.filter((s) => s.level >= 3)
  const newSpell = rng.pick(replacePool.length ? replacePool : SPELLS)
  const replaceIdx = rng.int(0, slots.length - 1)
  // Предложение замены = встреча со спеллом.
  if (state.activeSaveId) {
    markCareerSeen(activeCareer(), { spellIds: [newSpell.id] })
  }
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

function buildCampOffers(
  chapterJustCleared: number,
  rng: SeededRng,
  career: CareerState,
  runPath: RunPath,
): CampOffer[] {
  // После гл.9 идём в Немую Колокольню без выбора края
  if (chapterJustCleared >= 9) return []

  const unlocked = career.unlockedRegions?.length
    ? career.unlockedRegions
    : [...STARTER_MID_REGIONS]
  const pool = unlocked.filter((id) => REGION_MAP[id])
  const source = pool.length ? pool : [...STARTER_MID_REGIONS]

  // Двери только на следующий ярус (дерево глубин, назад нельзя).
  const fromRegion = runPath[chapterJustCleared - 1] ?? runPath[0]
  if (!fromRegion) return []
  let picks = nextRegionChoices(fromRegion, source)

  const shuffled = [...picks]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  picks = shuffled.slice(0, Math.min(3, shuffled.length))

  // Двери в лагере = встреча с краем (имя можно показать).
  noteSeenRegions(picks)

  return picks.map((regionId) => {
    const r = REGION_MAP[regionId]
    const threatLabel =
      r.threatAdjust === 0
        ? 'обычная угроза'
        : r.threatAdjust > 0
          ? `жёстче (+${r.threatAdjust})`
          : `тише (${r.threatAdjust})`
    const pace =
      r.threatAdjust > 1
        ? 'дорога кусается'
        : r.threatAdjust < 0
          ? 'дорога мягче'
          : 'дорога ровная'
    const bufLabel =
      r.ovrBuffer > 0
        ? ` · запас силы +${r.ovrBuffer}`
        : r.ovrBuffer < 0
          ? ` · запас ${r.ovrBuffer}`
          : ' · без запаса'
    // Без имени босса — не спойлерим setpiece незнакомого края.
    const sniff = r.blurb.split(/[.!?]/)[0]?.trim() ?? r.tag
    return {
      id: `region-${regionId}`,
      kind: 'region' as const,
      regionId,
      label: r.name,
      detail: `${r.tag} · ${threatLabel}${bufLabel} · ${pace}. ${sniff}.`,
      threatAdjust: r.threatAdjust,
      ovrBuffer: r.ovrBuffer,
      durationStages: 10,
    }
  })
}

/** Одно микрорешение на главу: осторожно / напролом. */
export function buildRouteOffers(chapter: number, _rng: SeededRng): RouteOffer[] {
  return [
    {
      id: `route-cautious-${chapter}`,
      label: 'Осторожно',
      detail: 'Угроза −1 на главу · меньше риска на дороге',
      threatAdjust: -1,
      ovrBuffer: 0,
      durationStages: 10,
    },
    {
      id: `route-bold-${chapter}`,
      label: 'Напролом',
      detail: 'Запас силы +1 · угроза как у края',
      threatAdjust: 0,
      ovrBuffer: 1,
      durationStages: 10,
    },
  ]
}

export function applyRouteChoice(state: RunState, offerId: string): RunState {
  if (!state.pendingRoute) return state
  const offer = state.pendingRoute.find((o) => o.id === offerId)
  if (!offer) return state

  const fromStage = state.result?.stagesCleared ?? 0
  // Лагерь уже выставил свежие моды на эту главу — складываем. Иначе сбрасываем хвост прошлой главы.
  const campFresh = state.campaignMods.modFromStage === fromStage
  return {
    ...state,
    pendingRoute: null,
    campaignMods: {
      threatAdjust: campFresh
        ? state.campaignMods.threatAdjust + offer.threatAdjust
        : offer.threatAdjust,
      ovrBuffer: campFresh
        ? state.campaignMods.ovrBuffer + offer.ovrBuffer
        : offer.ovrBuffer,
      modFromStage: fromStage,
      modUntilStage: fromStage + offer.durationStages,
    },
  }
}

export function skipRouteChoice(state: RunState): RunState {
  if (!state.pendingRoute?.length) return state
  const rng = new SeededRng(`${state.seed}-skip-route-${state.upgradesTaken}`)
  const offer = rng.pick(state.pendingRoute)
  return applyRouteChoice(state, offer.id)
}

/** Выбор края Порчи после босса — до усиления спеллов. */
export function applyCampChoice(state: RunState, offerId: string): RunState {
  if (!state.pendingCamp) return state
  const offer = state.pendingCamp.find((o) => o.id === offerId)
  if (!offer) return state

  const fromStage = state.result?.stagesCleared ?? 0
  const modUntilStage = fromStage + offer.durationStages
  const nextChapterIndex = Math.min(8, Math.floor(fromStage / 10))
  // fromStage 10 → chapter index 1 (вторая глава)
  const pathIndex = Math.min(8, Math.max(1, nextChapterIndex))
  const runPath = [...state.runPath] as RunPath
  runPath[pathIndex] = offer.regionId
  noteSeenRegions([offer.regionId])

  return {
    ...state,
    pendingCamp: null,
    runPath,
    // Угроза края уже в difficulty пути; здесь только запас силы на главу.
    campaignMods: {
      threatAdjust: 0,
      ovrBuffer: offer.ovrBuffer,
      modFromStage: fromStage,
      modUntilStage,
    },
  }
}

export function skipCampChoice(state: RunState): RunState {
  if (!state.pendingCamp?.length) return state
  const fromStage = state.result?.stagesCleared ?? 0
  const pathIndex = Math.min(8, Math.max(1, Math.floor(fromStage / 10)))
  const rng = new SeededRng(`${state.seed}-skip-camp-${fromStage}`)
  const offer = rng.pick(state.pendingCamp)
  const regionId = offer.regionId
  const r = REGION_MAP[regionId]
  const runPath = [...state.runPath] as RunPath
  runPath[pathIndex] = regionId
  noteSeenRegions([regionId])
  return {
    ...state,
    pendingCamp: null,
    runPath,
    campaignMods: r
      ? {
          threatAdjust: 0,
          ovrBuffer: r.ovrBuffer,
          modFromStage: fromStage,
          modUntilStage: fromStage + 10,
        }
      : state.campaignMods,
  }
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
 * Затем игрок выбирает апгрейд и вызывается afterUpgradeContinue.
 */
export function resolveRun(state: RunState, resumeFrom = 0): RunState {
  return simulateFrom(state, resumeFrom)
}

function simulateFrom(state: RunState, resumeFrom: number): RunState {
  const roster = rosterFromParty(state.party)
  let spellSlots = state.spellSlots.map((s) => ({ ...s, spell: s.spell }))
  let spellAssign = { ...state.spellAssign }
  let upgradesTaken = state.upgradesTaken

  const overallByStage: number[] = []
  let score = computeScore(roster, spellSlots.map((s) => s.spell), spellAssign, spellSlots)

  const resume = Math.max(0, resumeFrom)
  const probe = planCampaign(
    score,
    state.seed,
    state.fieldSeed,
    state.teamName,
    planOpts(state, undefined, resume),
  )
  let stopForUpgradeAt: number | null = null

  for (let s = 0; s <= probe.stagesCleared; s += 1) {
    overallByStage[s] = score.overall
    // Боссов до точки продолжения уже «оплатили» апгрейдом — не останавливаемся снова.
    if (s < resume) continue
    if (isChapterBoss(s) && probe.stages[s]?.cleared) {
      const chapter = Math.floor(s / 10) + 1
      if (upgradesTaken < chapter && chapter < 10) {
        stopForUpgradeAt = s
        break
      }
    }
  }

  if (stopForUpgradeAt !== null) {
    const partialOverall = Array.from({ length: TOTAL_STAGES }, () => score.overall)
    const plan = planCampaign(
      score,
      state.seed,
      state.fieldSeed,
      state.teamName,
      planOpts(state, partialOverall, resume),
    )
    for (let i = 0; i < plan.stages.length; i += 1) {
      if (i <= stopForUpgradeAt) {
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
    const campRng = new SeededRng(`${state.seed}-camp-${upgradesTaken}-${stopForUpgradeAt}`)
    const campOffers = buildCampOffers(chapter, campRng, activeCareer(), state.runPath)
    const routeRng = new SeededRng(`${state.seed}-route-${upgradesTaken}-${stopForUpgradeAt}`)
    const routeOffers = buildRouteOffers(chapter, routeRng)

    return {
      ...state,
      screen: 'campaign',
      spellSlots,
      spellAssign,
      pendingCamp: campOffers.length ? campOffers : null,
      pendingRoute: routeOffers,
      pendingUpgrade: offers,
      result: {
        record: plan.record,
        wins: plan.wins,
        losses: plan.losses,
        score,
        matches: matchesFromPlan(plan),
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

  const plan = planCampaign(
    score,
    state.seed,
    state.fieldSeed,
    state.teamName,
    planOpts(state, overallByStage, resume),
  )

  const { unlocks } = applyCareerProgress(
    activeCareer(),
    plan.stagesCleared + 1,
    plan.perfect,
  )

  const result = {
    record: plan.record,
    wins: plan.wins,
    losses: plan.losses,
    score,
    matches: matchesFromPlan(plan),
    perfect: plan.perfect,
    place: plan.place,
    placeLabel: plan.placeLabel,
    championName: plan.championName,
    stagesCleared: plan.stagesCleared + 1,
    stageNames: plan.stages.filter((s) => s.cleared).map((s) => s.name),
    stageReasons: plan.stages.map((s) => s.reasons),
    unlocks,
  }

  const autopsy = buildRunAutopsy(result, score)
  const historyEntry = {
    seed: '',
    record: result.record,
    ovr: score.overall,
    place: result.place,
    stages: result.stagesCleared,
    date: new Date().toISOString(),
  }
  const history = [historyEntry, ...state.history].slice(0, 20)
  if (state.activeSaveId) {
    appendSaveHistory(state.activeSaveId, historyEntry, autopsy.hubLine)
  }

  return {
    ...state,
    screen: 'campaign',
    pendingUpgrade: null,
    pendingCamp: null,
    pendingRoute: null,
    result,
    history,
  }
}

/** After picking an upgrade, resume and finish (or next upgrade). */
export function afterUpgradeContinue(state: RunState): RunState {
  const resumeFrom = state.result?.stagesCleared ?? 0
  let next: RunState = {
    ...state,
    pendingUpgrade: null,
    pendingCamp: null,
    pendingRoute: null,
    result: null,
  }
  // Финал (гл.10) открывается только когда до него дошли — до этого ??? на ленте.
  if (next.upgradesTaken >= 9 && !next.runPath[9]) {
    const runPath = [...next.runPath] as RunPath
    runPath[9] = FINALE_REGION_ID
    next = { ...next, runPath }
    noteSeenRegions([FINALE_REGION_ID])
  }
  return resolveRun(next, resumeFrom)
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

