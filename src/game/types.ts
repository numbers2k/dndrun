import type { SubclassId } from '../data/pools'

export type RoleId = 'tank' | 'striker' | 'controller' | 'support' | 'scout'

export type RaceId =
  | 'human'
  | 'elf'
  | 'dwarf'
  | 'halfling'
  | 'dragonborn'
  | 'gnome'
  | 'halfOrc'
  | 'tiefling'
  | 'halfElf'

export type ClassId =
  | 'fighter'
  | 'wizard'
  | 'cleric'
  | 'rogue'
  | 'ranger'
  | 'paladin'
  | 'barbarian'
  | 'bard'
  | 'warlock'
  | 'druid'
  | 'monk'
  | 'sorcerer'

export type Screen = 'menu' | 'draft' | 'campaign'

export type CardRarity = 'common' | 'rare' | 'legendary'

export interface AdventurerDef {
  id: string
  name: string
  race: RaceId
  classId: ClassId
  role: RoleId
  subclassId?: SubclassId
  ovr: number
  impact: number
  economy: number
  reliability: number
  /** Посадка роли на класс/расу (−4…+4). */
  roleFit: number
  tags: string[]
  rarity: CardRarity
}

export interface SpellDef {
  id: string
  name: string
  level: number
  school: string
  classes: ClassId[]
  /** Роли, которым спелл особенно полезен. */
  roles?: RoleId[]
  /** Короткая фраза: что делает в бою. */
  blurb: string
  tags: string[]
  /** Давление / урон (45–98). */
  pressure: number
  /** Контроль / поле (45–98). */
  control: number
  /** Поддержка / живучесть (45–98). */
  sustain: number
}

export interface SpellSlotState {
  spell: SpellDef
  /** Эффективный уровень после апгрейдов. */
  effectiveLevel: number
  /** Доп. бонус владения (0–3). */
  masteryBonus: number
}

export interface PackDef {
  id: string
  name: string
  chapter: string
  adventurers: AdventurerDef[]
  signatureSpells: string[]
}

export type PartySlots = [
  AdventurerDef | null,
  AdventurerDef | null,
  AdventurerDef | null,
  AdventurerDef | null,
  AdventurerDef | null,
]

export const PARTY_SIZE = 5

export interface CurrentPack {
  id: string
  name: string
  chapter: string
  adventurers: AdventurerDef[]
  spells: SpellDef[]
}

export interface SynergyAxes {
  base: number
  roleFit: number
  statFit: number
  spellFit: number
  bondFit: number
  coverage: number
  antiSynergy: number
}

export interface ScoreBreakdown {
  overall: number
  base: number
  spellBonus: number
  chemBonus: number
  coverageBonus: number
  roleFitBonus: number
  statFitBonus: number
  antiSynergy: number
  axes: SynergyAxes
  assignment: Record<string, number | null>
  spellLines: { adventurerId: string; spellId: string; fit: number }[]
  chemTop: { names: string[]; games: number }[]
  reasons: string[]
}

export interface SimMatch {
  round: string
  opponent: string
  won: boolean
  ourOvr: number
  theirOvr: number
}

export interface RunResult {
  record: string
  wins: number
  losses: number
  score: ScoreBreakdown
  matches: SimMatch[]
  perfect: boolean
  place: number
  placeLabel: string
  championName: string
  stagesCleared: number
  stageNames: string[]
  /** Причины win/fail по этапам (индекс = номер этапа − 1). */
  stageReasons: string[][]
  unlocks: string[]
}

export interface RunConfig {
  rerolls: number
}

export interface RunState {
  screen: Screen
  seed: string
  config: RunConfig
  rerollsLeft: number
  party: PartySlots
  spellPool: SpellDef[]
  /** Состояние слотов спеллов (уровень/мастерство). */
  spellSlots: SpellSlotState[]
  current: CurrentPack | null
  spellAssign: Record<string, number | null>
  drawCount: number
  fieldSeed: number
  teamName: string
  /** Активный сейв карьеры. */
  activeSaveId: string | null
  result: RunResult | null
  /** Пауза выбора апгрейда после босса главы. */
  pendingUpgrade: SpellUpgradeOffer[] | null
  /** Сколько глав уже дали апгрейд. */
  upgradesTaken: number
  /** Драфт 5+5 собран — ждём старт или отказ, пак ещё виден. */
  pendingCommit: boolean
  history: {
    seed: string
    record: string
    ovr: number
    place?: number
    stages?: number
    date: string
  }[]
}

export interface SpellUpgradeOffer {
  id: string
  kind: 'level' | 'replace' | 'mastery'
  label: string
  detail: string
  poolIndex?: number
  newSpell?: SpellDef
}

export const ROLE_ORDER: RoleId[] = ['tank', 'striker', 'controller', 'support', 'scout']

export const ROLE_LABEL_FULL: Record<RoleId, string> = {
  tank: 'Танк',
  striker: 'Удар',
  controller: 'Контроль',
  support: 'Поддержка',
  scout: 'Разведка',
}

export interface RadarVertex {
  slotIndex: number
  role: RoleId | null
  adventurer: AdventurerDef | null
  spell: SpellDef | null
  spellOrphan: boolean
}
