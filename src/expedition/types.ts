export type HeroId = 'warden' | 'ranger' | 'mage' | 'rogue' | 'priest' | 'bard'
export type CardKind = 'attack' | 'skill' | 'spell'
export type Target = 'enemy' | 'ally' | 'all' | 'self'
export interface HeroDef {
  id: HeroId
  name: string
  role: string
  title: string
  hp: number
  color: string
  passive: string
  cards: string[]
}
export interface Hero {
  id: HeroId
  hp: number
  maxHp: number
  block: number
}
export interface CardDef {
  id: string
  name: string
  hero: HeroId
  kind: CardKind
  cost: number
  target: Target
  damage?: number
  block?: number
  heal?: number
  poison?: number
  vulnerable?: number
  draw?: number
  energy?: number
  exhaust?: boolean
  text: string
}
export interface Card {
  uid: string
  id: string
  upgraded: boolean
  level?: number
}
export interface Intent {
  kind: 'attack' | 'guard' | 'charge'
  damage: number
  target: number
  block: number
  label: string
}
export interface Enemy {
  uid: string
  id: string
  name: string
  hp: number
  maxHp: number
  block: number
  poison: number
  vulnerable: number
  power: number
  intent: Intent
  elite: boolean
}
export interface Combat {
  enemies: Enemy[]
  hand: Card[]
  draw: Card[]
  discard: Card[]
  exhausted: Card[]
  energy: number
  turn: number
  played: number
  rangerUsed: boolean
  log: string[]
  name: string
  kind: 'battle' | 'elite' | 'boss'
  lastHero: HeroId | null
  chain: number
  maxChain: number
  turnChain?: number
  damageTaken: number
}
export type NodeKind = 'battle' | 'elite' | 'rest' | 'event' | 'shop' | 'boss'
export interface RouteNode {
  id: string
  kind: NodeKind
  name: string
  description: string
}
export interface Reward {
  cards: Card[]
  coins: number
  relic: string | null
  recruit: HeroId | null
  nodeKind: NodeKind
}
export interface Run {
  version: 3
  seed: string
  rng: number
  mode: 'normal' | 'daily' | 'hard'
  phase:
    'route' | 'combat' | 'reward' | 'rest' | 'event' | 'shop' | 'checkpoint' | 'victory' | 'defeat'
  depth: number
  party: Hero[]
  deck: Card[]
  relics: string[]
  gold: number
  nodes: RouteNode[]
  chosen: RouteNode | null
  combat: Combat | null
  reward: Reward | null
  eventId: number
  shopCards: Card[]
  shopRelic: string | null
  routeHistory: NodeKind[]
  battles: number
  damageDealt: number
  recorded: boolean
  score: number
  lastScore: { base: number; speed: number; flawless: number; combo: number; total: number }
  cleared: number
  boons: string[]
  omen: string | null
  runId: string
  rules: 4 | 3
}
export interface HistoryEntry {
  seed: string
  mode: Run['mode']
  won: boolean
  depth: number
  party: HeroId[]
  date: string
  score?: number
  runId?: string
  rules?: number
  cleared?: number
  player?: string
}
export interface Profile {
  version: 3
  runs: number
  wins: number
  best: number
  seenCards: string[]
  seenRelics: string[]
  history: HistoryEntry[]
  tutorialDone: boolean
  nickname: string
  records: HistoryEntry[]
}
