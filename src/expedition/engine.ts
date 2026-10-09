import { BOONS, OMENS } from './endless'
import { CARDS, CARD_MAP, EVENTS, HEROES, RELICS, STARTER_PARTIES } from './data'
import { BOSSES, BOSS_MAP, ENEMY_MAP, ENCOUNTERS, ENCOUNTER_MAP } from './encounters'
import { relicFits } from './synergies'
import { CONTRACTS, DEFAULT_PARTY, partyIdentity } from './contracts'
import type {
  Card,
  Combat,
  ContractId,
  Enemy,
  HeroId,
  Intent,
  NodeKind,
  Profile,
  RouteNode,
  Run,
} from './types'

export const SAVE_KEY = 'dndrun-expedition-v3'
export const PROFILE_KEY = 'dndrun-guild-v3'
export function emptyProfile(): Profile {
  return {
    version: 3,
    runs: 0,
    wins: 0,
    best: 0,
    seenCards: [],
    seenRelics: [],
    history: [],
    tutorialDone: false,
    nickname: 'Странник',
    records: [],
    unlockedHeroes: [...DEFAULT_PARTY],
  }
}
export function readProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
    const validHistory = (h: Profile['history'][number]) =>
      h &&
      ['normal', 'daily', 'hard'].includes(h.mode) &&
      Number.isSafeInteger(h.depth) &&
      h.depth >= 0 &&
      typeof h.date === 'string' &&
      Number.isFinite(Date.parse(h.date)) &&
      typeof h.seed === 'string' &&
      typeof h.won === 'boolean' &&
      Array.isArray(h.party) &&
      h.party.every((id) => id in HEROES) &&
      (h.contract === undefined ||
        ['standard', 'no-healer', 'thin-hand', 'ashfall'].includes(h.contract))
    if (
      p?.version !== 3 ||
      !['runs', 'wins', 'best'].every((k) => Number.isInteger(p[k]) && p[k] >= 0) ||
      !Array.isArray(p.seenCards) ||
      !Array.isArray(p.seenRelics) ||
      !Array.isArray(p.history)
    )
      return emptyProfile()
    return {
      ...emptyProfile(),
      ...p,
      nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 24) : 'Странник',
      records: Array.isArray(p.records)
        ? p.records.filter(
            (h: Profile['history'][number]) =>
              validHistory(h) &&
              [4, 5, 6].includes(h.rules!) &&
              Number.isSafeInteger(h.score) &&
              h.score! >= 0 &&
              Number.isSafeInteger(h.cleared) &&
              h.cleared! >= 0 &&
              h.cleared! <= h.depth &&
              typeof h.runId === 'string' &&
              typeof h.player === 'string',
          )
        : [],
      unlockedHeroes: Array.isArray(p.unlockedHeroes)
        ? [...new Set([...DEFAULT_PARTY, ...p.unlockedHeroes.filter((id: string) => id in HEROES)])]
        : p.runs > 0
          ? (Object.keys(HEROES) as HeroId[])
          : [...DEFAULT_PARTY],
      seenCards: p.seenCards.filter((id: string) => id in CARD_MAP),
      seenRelics: p.seenRelics.filter((id: string) => RELICS.some((r) => r.id === id)),
      history: p.history.filter(validHistory).slice(0, 20),
    }
  } catch {
    return emptyProfile()
  }
}
export function readRun(): Run | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')
    const r = raw ? migrateRun(raw) : null
    const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0
    const cards = (a: unknown): boolean =>
      Array.isArray(a) &&
      a.every(
        (c) =>
          c &&
          c.id in CARD_MAP &&
          typeof c.uid === 'string' &&
          typeof c.upgraded === 'boolean' &&
          (c.level === undefined || (Number.isInteger(c.level) && c.level >= 0 && c.level <= 20)),
      )
    if (
      !r ||
      r.version !== 3 ||
      ![
        'route',
        'combat',
        'reward',
        'rest',
        'event',
        'shop',
        'checkpoint',
        'victory',
        'defeat',
      ].includes(r.phase) ||
      !['normal', 'daily', 'hard'].includes(r.mode) ||
      !['standard', 'no-healer', 'thin-hand', 'ashfall'].includes(r.contract) ||
      typeof r.seed !== 'string' ||
      !num(r.rng) ||
      !Number.isInteger(r.depth) ||
      r.depth < 0 ||
      !Number.isSafeInteger(r.score) ||
      r.score < 0 ||
      !Number.isSafeInteger(r.cleared) ||
      r.cleared < 0 ||
      r.cleared > r.depth ||
      !r.lastScore ||
      !['base', 'speed', 'flawless', 'combo', 'total'].every((k) =>
        num(r.lastScore[k as keyof Run['lastScore']]),
      ) ||
      (r.lastScore.finisher !== undefined &&
        (!num(r.lastScore.finisher) || r.lastScore.finisher > 150)) ||
      !Array.isArray(r.boons) ||
      !r.boons.every((id) => BOONS.some((b) => b.id === id)) ||
      (r.omen !== null && !OMENS.some((o) => o.id === r.omen)) ||
      typeof r.runId !== 'string' ||
      ![3, 4, 5, 6].includes(r.rules) ||
      !Array.isArray(r.bossSchedule) ||
      r.bossSchedule.length !== 3 ||
      !r.bossSchedule.every((id) => id in BOSS_MAP) ||
      !Array.isArray(r.encounterHistory) ||
      !r.encounterHistory.every((id) => id in ENCOUNTER_MAP) ||
      !Array.isArray(r.eventHistory) ||
      !r.eventHistory.every((id) => Number.isInteger(id) && id >= 0 && id < EVENTS.length) ||
      (r.visitor !== null && !(r.visitor! in HEROES)) ||
      !num(r.gold) ||
      !num(r.battles) ||
      !num(r.damageDealt) ||
      typeof r.recorded !== 'boolean'
    )
      return null
    if (
      r.pact !== undefined &&
      r.pact !== null &&
      (!['guard', 'edge'].includes(r.pact.kind) ||
        !Number.isInteger(r.pact.remaining) ||
        r.pact.remaining < 1 ||
        r.pact.remaining > 2)
    )
      return null
    if (
      !Array.isArray(r.party) ||
      r.party.length !== 3 ||
      new Set(r.party.map((h) => h?.id)).size !== 3 ||
      !r.party.every(
        (h) =>
          h &&
          h.id in HEROES &&
          num(h.hp) &&
          num(h.maxHp) &&
          h.maxHp === HEROES[h.id].hp &&
          h.hp <= h.maxHp &&
          num(h.block),
      ) ||
      (r.contract === 'no-healer' && r.party.some((h) => h.id === 'priest')) ||
      !cards(r.deck) ||
      r.deck.length < 6
    )
      return null
    if (
      !Array.isArray(r.relics) ||
      !r.relics.every((id) => RELICS.some((x) => x.id === id)) ||
      !Array.isArray(r.nodes) ||
      !r.nodes.every(
        (n) =>
          n &&
          typeof n.id === 'string' &&
          n.kind in KIND_NAMES &&
          typeof n.name === 'string' &&
          typeof n.description === 'string' &&
          (n.bossId === undefined || (n.kind === 'boss' && n.bossId in BOSS_MAP)) &&
          (n.encounter === undefined ||
            (['battle', 'elite'].includes(n.kind) && n.encounter in ENCOUNTER_MAP)) &&
          (n.trial === undefined || ['swift', 'chain', 'flawless'].includes(n.trial)),
      ) ||
      !Array.isArray(r.routeHistory) ||
      r.routeHistory.length !== r.depth ||
      !r.routeHistory.every((k) => k in KIND_NAMES) ||
      !cards(r.shopCards) ||
      !Number.isInteger(r.eventId) ||
      r.eventId < 0 ||
      r.eventId >= EVENTS.length ||
      (r.shopRelic !== null && !RELICS.some((x) => x.id === r.shopRelic))
    )
      return null
    if (r.phase === 'combat') {
      const b = r.combat
      if (
        !b ||
        !cards(b.hand) ||
        !cards(b.draw) ||
        !cards(b.discard) ||
        !cards(b.exhausted) ||
        !num(b.energy) ||
        !Number.isInteger(b.turn) ||
        b.turn < 1 ||
        !num(b.played) ||
        (b.lastHero !== null && !(b.lastHero in HEROES)) ||
        !Number.isSafeInteger(b.chain) ||
        b.chain < 0 ||
        !Number.isSafeInteger(b.maxChain) ||
        b.maxChain < b.chain ||
        (b.turnChain !== undefined &&
          (!Number.isSafeInteger(b.turnChain) || b.turnChain < b.chain)) ||
        !num(b.damageTaken) ||
        (b.finisher !== undefined && (!num(b.finisher) || b.finisher > 150)) ||
        (b.rule !== undefined &&
          b.rule !== null &&
          !['echo', 'seal', 'summon', 'hunt'].includes(b.rule)) ||
        (b.ruleHeroes !== undefined &&
          (!Array.isArray(b.ruleHeroes) ||
            !b.ruleHeroes.every((id) => id in HEROES) ||
            new Set(b.ruleHeroes).size !== b.ruleHeroes.length)) ||
        (b.marked !== undefined &&
          (!Number.isInteger(b.marked) || b.marked < 0 || b.marked >= 3)) ||
        (b.retained !== undefined && b.retained !== null && typeof b.retained !== 'string') ||
        (b.reserve !== undefined && !num(b.reserve)) ||
        (b.spent !== undefined &&
          (!Array.isArray(b.spent) || !b.spent.every((id) => typeof id === 'string'))) ||
        !['poisonRelay', 'guardRelay'].every((key) => {
          const charge = b[key as 'poisonRelay' | 'guardRelay']
          return (
            charge === undefined ||
            charge === null ||
            (charge.hero in HEROES &&
              num(charge.bonus) &&
              charge.bonus <= (key === 'poisonRelay' ? 12 : 10))
          )
        }) ||
        (b.trial !== undefined &&
          b.trial !== null &&
          !['swift', 'chain', 'flawless'].includes(b.trial)) ||
        !['duelistUsed', 'oracleUsed', 'healUsed', 'retainReady'].every(
          (k) => b[k as keyof Combat] === undefined || typeof b[k as keyof Combat] === 'boolean',
        ) ||
        (b.bonusDraw !== undefined &&
          (!Number.isInteger(b.bonusDraw) ||
            b.bonusDraw < 0 ||
            (r.rules >= 6 && b.bonusDraw > 4))) ||
        (b.areaAttacks !== undefined && (!Number.isInteger(b.areaAttacks) || b.areaAttacks < 0)) ||
        (b.openingGuard !== undefined && b.openingGuard !== 6) ||
        typeof b.rangerUsed !== 'boolean' ||
        !Array.isArray(b.log) ||
        !b.log.every((s) => typeof s === 'string') ||
        typeof b.name !== 'string' ||
        !['battle', 'elite', 'boss'].includes(b.kind) ||
        !Array.isArray(b.enemies) ||
        !b.enemies.length
      )
        return null
      if (b.rule && !b.enemies.some((e) => BOSS_MAP[e.id]?.rule === b.rule)) return null
      if (
        !b.enemies.every(
          (e) =>
            e &&
            typeof e.uid === 'string' &&
            typeof e.id === 'string' &&
            typeof e.name === 'string' &&
            num(e.hp) &&
            num(e.maxHp) &&
            e.maxHp > 0 &&
            e.hp <= e.maxHp &&
            num(e.block) &&
            num(e.poison) &&
            num(e.vulnerable) &&
            num(e.power) &&
            (e.damageThisTurn === undefined || num(e.damageThisTurn)) &&
            (e.fallenProcessed === undefined || typeof e.fallenProcessed === 'boolean') &&
            (e.summoned === undefined || typeof e.summoned === 'boolean') &&
            e.intent &&
            ['attack', 'guard', 'charge', 'ritual', 'support', 'curse'].includes(e.intent.kind) &&
            num(e.intent.damage) &&
            num(e.intent.block) &&
            Number.isInteger(e.intent.target) &&
            e.intent.target >= -1 &&
            e.intent.target < 3,
        )
      )
        return null
    }
    if (
      r.phase === 'reward' &&
      (!r.reward ||
        !cards(r.reward.cards) ||
        !num(r.reward.coins) ||
        (r.reward.recruit !== null && !(r.reward.recruit in HEROES)) ||
        (r.reward.relic !== null && !RELICS.some((x) => x.id === r.reward!.relic)) ||
        (r.reward.relicChoices !== undefined &&
          (!Array.isArray(r.reward.relicChoices) ||
            new Set(r.reward.relicChoices).size !== r.reward.relicChoices.length ||
            !r.reward.relicChoices.every(
              (id) => RELICS.some((x) => x.id === id) && !r.relics.includes(id),
            ))) ||
        (r.reward.trial !== undefined &&
          (!['swift', 'chain', 'flawless'].includes(r.reward.trial.id) ||
            typeof r.reward.trial.success !== 'boolean')))
    )
      return null
    if (r.startLeader !== undefined && !(r.startLeader in HEROES)) return null
    if (
      r.startParty !== undefined &&
      (!Array.isArray(r.startParty) ||
        r.startParty.length !== 3 ||
        new Set(r.startParty).size !== 3 ||
        !r.startParty.every((id) => id in HEROES))
    )
      return null
    if (
      r.feats !== undefined &&
      !['bestHit', 'bestChain', 'interrupts', 'trials'].every((k) =>
        num(r.feats![k as keyof NonNullable<Run['feats']>]),
      )
    )
      return null
    return r
  } catch {
    return null
  }
}
const KIND_NAMES = { battle: 1, elite: 1, boss: 1, rest: 1, event: 1, shop: 1 }
export function persist(run: Run | null, profile: Profile): boolean {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run))
    else localStorage.removeItem(SAVE_KEY)
    return true
  } catch {
    return false
  }
}
function hash(seed: string): number {
  let h = 2166136261
  for (const ch of seed) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function random(r: Run): number {
  let t = (r.rng += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  r.rng >>>= 0
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function pick<T>(r: Run, items: T[]): T {
  return items[Math.floor(random(r) * items.length)]
}
function shuffle<T>(r: Run, items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(r) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
function card(r: Run, id: string, upgraded = false): Card {
  return { uid: `c-${Math.floor(random(r) * 0xffffffff).toString(36)}`, id, upgraded }
}
function clone(r: Run): Run {
  return structuredClone(r)
}
export function dailySeed(date = new Date()): string {
  return `daily-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function areaIndex(depth: number): number {
  return Math.floor(((Math.max(1, depth) - 1) % 15) / 5)
}
export function cycleIndex(depth: number): number {
  return Math.floor((Math.max(1, depth) - 1) / 15)
}
export function boonCount(r: Run, id: string): number {
  return r.boons.filter((x) => x === id).length
}
export function upgradeLevel(c: Card): number {
  return c.level ?? (c.upgraded ? 1 : 0)
}
export function canUpgrade(c: Card): boolean {
  return !CARD_MAP[c.id].junk && upgradeLevel(c) < 20
}
export function upgradeCard(c: Card) {
  c.level = upgradeLevel(c) + 1
  c.upgraded = true
}
function scheduleBosses(r: Run): string[] {
  const schedule: string[] = []
  for (const a of [0, 1, 2]) {
    const all = BOSSES.filter((b) => b.areas.some((x) => x === a))
    const pool = all.filter((b) => !schedule.includes(b.id) && b.id !== r.bossSchedule?.[a])
    schedule.push(r.depth < 15 && a === 2 ? 'dragon' : pick(r, pool.length ? pool : all).id)
  }
  return schedule
}
export function upcomingBoss(r: Run) {
  return BOSS_MAP[
    r.bossSchedule?.[areaIndex(r.phase === 'route' ? r.depth + 1 : r.depth)] ??
      ['bridge', 'guardian', 'dragon'][areaIndex(r.depth + 1)]
  ]
}
function chooseEncounter(r: Run, area: number, offered: string[] = []) {
  const pool = ENCOUNTERS.filter(
    (e) =>
      e.area === area &&
      (r.rules >= 6 || !e.foes.some((id) => ['weaver', 'armorer'].includes(id))) &&
      !offered.includes(e.id) &&
      !r.encounterHistory?.slice(-3).includes(e.id),
  )
  return pick(
    r,
    pool.length ? pool : ENCOUNTERS.filter((e) => e.area === area && !offered.includes(e.id)),
  )
}

export function makeRoutes(r: Run): RouteNode[] {
  const next = r.depth + 1
  if (next % 5 === 0) {
    const boss =
      BOSS_MAP[
        r.bossSchedule?.[areaIndex(next)] ?? ['bridge', 'guardian', 'dragon'][areaIndex(next)]
      ]
    return [
      {
        id: `boss-${next}`,
        kind: 'boss',
        name: boss.name,
        bossId: boss.id,
        description: boss.text,
        trial: ['swift', 'chain', 'flawless'][Math.floor(next / 5) % 3] as RouteNode['trial'],
      },
    ]
  }
  if (next === 1)
    return [
      {
        id: 'battle-1',
        kind: 'battle',
        name: 'Первый дозор',
        description: 'Начните с короткой стычки. Карта действия и монеты за победу.',
      },
    ]
  let kinds: NodeKind[] =
    next % 5 === 1
      ? ['battle', 'elite']
      : next % 5 === 4
        ? ['battle', 'rest', 'shop']
        : next % 5 === 3
          ? ['battle', 'elite']
          : ['battle', 'event', 'shop']
  if (next > 15) {
    kinds =
      next % 5 === 4
        ? ['battle', 'rest', 'shop']
        : next % 5 === 1
          ? ['battle', 'elite']
          : shuffle<NodeKind>(r, ['battle', 'elite', 'event', 'shop']).slice(0, 3)
    if (!kinds.includes('battle')) kinds[0] = 'battle'
  }
  const names: Record<NodeKind, string[]> = {
    battle: ['Лесная засада', 'Дорожный дозор', 'Старая башня'],
    elite: ['Вожак стаи', 'Забытый рыцарь', 'Страж перевала'],
    rest: ['Тихий костёр', 'Укрытие у стены', 'Горный источник'],
    event: ['Путник у дороги', 'Следы путешественников', 'Незнакомый огонёк'],
    shop: ['Бродячий торговец', 'Лавка у руин', 'Горный караван'],
    boss: [],
  }
  const descriptions: Record<NodeKind, string> = {
    battle: 'Обычный бой. Карта и 25 монет за победу.',
    elite: 'Сильные враги. Реликвия, карта и 45 монет.',
    rest: 'Восстановить отряд, улучшить карту или вернуть павшего героя.',
    event: 'Небольшая история. Выберите награду и её цену.',
    shop: 'Купить карту или реликвию. Удалить ненужную карту.',
    boss: '',
  }
  const offered: string[] = []
  return kinds.map((kind) => {
    const encounter =
      kind === 'battle' || kind === 'elite' ? chooseEncounter(r, areaIndex(next), offered) : null
    if (encounter) offered.push(encounter.id)
    return {
      id: `${kind}-${next}`,
      kind,
      name: encounter
        ? (kind === 'elite' ? 'Элита · ' : '') + encounter.name
        : names[kind][areaIndex(next)],
      ...(encounter ? { encounter: encounter.id } : {}),
      ...(encounter
        ? { trial: ['swift', 'chain', 'flawless'][next % 3] as RouteNode['trial'] }
        : {}),
      description: encounter
        ? encounter.foes.map((id) => ENEMY_MAP[id].name).join(' + ') + '. ' + descriptions[kind]
        : descriptions[kind],
    }
  })
}
export function newRun(
  leader: HeroId,
  seed: string,
  mode: Run['mode'] = 'normal',
  requestedParty?: HeroId[],
  contract: ContractId = 'standard',
): Run {
  if (mode === 'daily') {
    leader = 'warden'
    contract = 'standard'
  }
  const partyIds =
    mode === 'daily'
      ? [...DEFAULT_PARTY]
      : requestedParty?.length === 3 &&
          new Set(requestedParty).size === 3 &&
          requestedParty.every((id) => id in HEROES) &&
          (contract !== 'no-healer' || !requestedParty.includes('priest'))
        ? [...requestedParty]
        : [...(STARTER_PARTIES[leader] ?? DEFAULT_PARTY)]
  if (contract === 'no-healer' && partyIds.includes('priest'))
    throw new Error('The no-healer contract cannot start with the priest.')
  const r: Run = {
    version: 3,
    seed,
    rng: hash(seed),
    mode,
    contract,
    phase: 'route',
    depth: 0,
    party: partyIds.map((id) => ({
      id,
      hp: HEROES[id].hp,
      maxHp: HEROES[id].hp,
      block: 0,
    })),
    deck: [],
    relics: ['lantern'],
    gold: 40,
    nodes: [],
    chosen: null,
    combat: null,
    reward: null,
    eventId: 0,
    shopCards: [],
    shopRelic: null,
    routeHistory: [],
    battles: 0,
    damageDealt: 0,
    recorded: false,
    score: 0,
    lastScore: { base: 0, speed: 0, flawless: 0, combo: 0, total: 0 },
    cleared: 0,
    boons: [],
    omen: null,
    runId: `${seed}-${partyIds.join('.')}-${mode}-${contract}`,
    rules: 6,
    startParty: [...partyIds],
    bossSchedule: [],
    encounterHistory: [],
    eventHistory: [],
    visitor: null,
    startLeader: leader,
    feats: { bestHit: 0, bestChain: 0, interrupts: 0, trials: 0 },
  }
  for (const h of r.party) {
    for (const id of [...HEROES[h.id].cards, HEROES[h.id].cards[0]]) r.deck.push(card(r, id))
  }
  r.deck = r.deck.filter((c) => contract !== 'no-healer' || CARD_MAP[c.id].hero !== 'priest')
  r.bossSchedule = scheduleBosses(r)
  r.nodes = makeRoutes(r)
  return r
}
export function values(c: Card) {
  const d = CARD_MAP[c.id],
    tier = upgradeLevel(c)
  return {
    ...d,
    damage: d.damage ? d.damage + tier * 4 : undefined,
    block: d.block ? d.block + tier * 4 : undefined,
    heal: d.heal ? d.heal + tier * 3 : undefined,
    poison: d.poison ? d.poison + tier * 3 : undefined,
    draw: d.draw ? d.draw + (!d.damage && !d.block ? tier : 0) : undefined,
    energy: d.energy ? d.energy + tier : undefined,
    vulnerable: d.vulnerable ? d.vulnerable + tier : undefined,
  }
}
export function cardDescription(c: Card): string {
  return effectDescription(values(c))
}
function effectDescription(d: ReturnType<typeof values>): string {
  if (d.junk) return d.text
  const out: string[] = []
  if (d.damage)
    out.push(
      `${d.damage} урона${d.target === 'all' ? ' всем врагам' : ''}${d.id === 'pierce' ? ' сквозь защиту' : ''}`,
    )
  if (d.block)
    out.push(
      `${d.block} защиты${d.target === 'all' ? ' всему отряду' : d.target === 'enemy' ? ' владельцу' : ''}`,
    )
  if (d.heal) out.push(`${d.heal} здоровья${d.target === 'all' ? ' всему отряду' : ''}`)
  if (d.poison) out.push(`${d.poison} яда`)
  if (d.vulnerable) out.push(`Уязвимость: ${d.vulnerable} ход${d.vulnerable > 1 ? 'а' : ''}`)
  if (d.draw) out.push(`Взять ${d.draw} карт${d.draw === 1 ? 'у' : 'ы'}`)
  if (d.energy) out.push(`+${d.energy} энергии`)
  if (d.blockStrike) out.push('Плюс половина защиты владельца, максимум +12')
  if (d.poisonStrike) out.push('Плюс текущий яд врага')
  if (d.cleanse) out.push('Убрать весь Пепел из боя')
  return out.join('. ') + '.'
}
export function combatDescription(r: Run, c: Card): string {
  const d = values(c)
  if (r.rules < 6 && d.id === 'parry') d.draw = undefined
  const b = r.combat
  const chainDrawReserved =
    b && b.chain === 2 && b.lastHero !== CARD_MAP[c.id].hero && (b.turnChain ?? 0) < 3 ? 1 : 0
  const drawLimit = Math.max(0, 4 - (b?.bonusDraw ?? 0) - chainDrawReserved)
  const drawLimited = r.rules >= 6 && !!d.draw && d.draw > drawLimit
  if (r.rules >= 6 && d.draw) d.draw = Math.min(d.draw, drawLimit)
  const poisonStrike = d.poisonStrike
  if (d.damage) {
    d.damage +=
      (r.relics.includes('whetstone') ? 2 : 0) + boonCount(r, 'edge') * 3 + attackBonus(r, d)
    if (!poisonStrike) d.damage = Math.floor(d.damage * comboMultiplier(r, c))
    d.blockStrike = false
  }
  if (d.heal) d.heal += (d.hero === 'priest' ? 2 : 0) + (r.relics.includes('herbs') ? 2 : 0)
  if (d.poison)
    d.poison +=
      (r.relics.includes('vial') ? 2 : 0) +
      boonCount(r, 'venom') * 4 +
      (d.hero === 'alchemist' ? 2 : 0)
  if (poisonStrike) {
    d.poisonStrike = false
    return (
      effectDescription(d) +
      ` Текущий яд прибавляется к силе до множителя связки ×${comboMultiplier(r, c)}. Точный урон — на цели.`
    )
  }
  const description = effectDescription(d)
  return drawLimited
    ? `${description || 'Эта карта не наносит прямого урона.'} Добор карты ограничен общей прибавкой: ${drawLimit} из 4 осталось после бонуса связки.`
    : description
}
export function comboMultiplier(r: Run, c?: Card): number {
  if (r.rules < 5 || !r.combat) return 1
  const b = r.combat
  const chain = c
    ? b.lastHero !== null && b.lastHero !== CARD_MAP[c.id].hero
      ? b.chain + 1
      : 1
    : b.chain
  return (
    1 +
    Math.min(4, Math.floor(Math.max(0, chain - 1) / 2)) * 0.25 +
    (chain >= 3 && r.relics.includes('conductor') ? 0.25 : 0)
  )
}
function attackBonus(r: Run, d: ReturnType<typeof values>) {
  const owner = r.party.find((h) => h.id === d.hero)
  return (
    (d.hero === 'ranger' && !r.combat?.rangerUsed ? 3 : 0) +
    (d.hero === 'duelist' && !r.combat?.duelistUsed && (owner?.block ?? 0) > 0 ? 4 : 0) +
    (d.blockStrike ? Math.min(12, Math.floor((owner?.block ?? 0) / 2)) : 0) +
    (r.relics.includes('heavy') && d.cost >= 2 ? 8 : 0) +
    (r.combat?.poisonRelay && r.combat.poisonRelay.hero !== d.hero
      ? r.combat.poisonRelay.bonus
      : 0) +
    (r.combat?.guardRelay && r.combat.guardRelay.hero !== d.hero ? r.combat.guardRelay.bonus : 0) +
    (r.combat?.reserve ?? 0)
  )
}
export function targetDamage(r: Run, c: Card, index: number): number {
  return damageBreakdown(r, c, index)?.damage ?? 0
}
export function damageBreakdown(r: Run, c: Card, index: number) {
  const d = values(c),
    e = r.combat?.enemies[index]
  if (!d.damage || !e || e.hp <= 0) return null
  let amount =
    d.damage +
    (r.relics.includes('whetstone') ? 2 : 0) +
    boonCount(r, 'edge') * 3 +
    attackBonus(r, d) +
    (d.poisonStrike ? e.poison : 0) +
    (d.hero === 'rogue' && e.vulnerable > 0 ? 3 : 0)
  const power = amount,
    multiplier = comboMultiplier(r, c)
  amount = Math.floor(amount * multiplier)
  if (e.vulnerable > 0) amount = Math.floor(amount * 1.5)
  let block = e.block
  const b = r.combat!
  if (d.target === 'all' && d.damage && (b.areaAttacks ?? 0) >= 1)
    block += b.enemies.filter((foe) => foe.hp > 0 && foe.id === 'weaver').length * 6
  if (b.rule === 'echo' && b.lastHero === d.hero && BOSS_MAP[e.id]) block += 7
  if (
    b.rule === 'seal' &&
    !(b.ruleHeroes ?? []).includes(d.hero) &&
    (b.ruleHeroes?.length ?? 0) === 1 &&
    BOSS_MAP[e.id]
  )
    block = 0
  const armor = d.id === 'pierce' ? 0 : block
  const impact = Math.max(0, amount - armor)
  const projectedFinisher =
    r.rules >= 5 && !e.summoned && multiplier > 1 && impact >= e.hp
      ? Math.min(150, impact - e.hp)
      : 0
  return {
    power,
    multiplier,
    vulnerable: e.vulnerable > 0 ? 1.5 : 1,
    armor,
    impact,
    damage: Math.min(e.hp, impact),
    finisher: Math.max(0, projectedFinisher - (b.finisher ?? 0)),
  }
}
function log(b: Combat, message: string) {
  b.log = [message, ...b.log].slice(0, 16)
}
function heal(r: Run, index: number, amount: number) {
  const h = r.party[index]
  if (!h || h.hp <= 0) return
  h.hp = Math.min(h.maxHp, h.hp + amount + (r.relics.includes('herbs') ? 2 : 0))
}
function draw(r: Run, n: number, bonus = true) {
  const b = r.combat!
  if (r.rules >= 6 && bonus) n = Math.min(n, Math.max(0, 4 - (b.bonusDraw ?? 0)))
  for (let i = 0; i < n; i++) {
    if (!b.draw.length) {
      const ready = b.discard.filter((c) => r.rules < 5 || !b.spent?.includes(c.uid))
      b.draw = shuffle(r, ready)
      b.discard = b.discard.filter((c) => !ready.some((x) => x.uid === c.uid))
    }
    if (!b.draw.length) break
    const c = b.draw.pop()!
    if (CARD_MAP[c.id].junk || r.party.some((h) => h.id === CARD_MAP[c.id].hero && h.hp > 0)) {
      b.hand.push(c)
      if (bonus) b.bonusDraw = (b.bonusDraw ?? 0) + 1
    } else i--
  }
}
function enemyIntent(r: Run, e: Enemy): Intent {
  const b = r.combat!,
    turn = b.turn,
    alive = r.party.map((h, i) => ({ h, i })).filter(({ h }) => h.hp > 0)
  const target = alive.length ? pick(r, alive).i : 0
  if (e.id === 'armorer')
    return { kind: 'guard', damage: e.power, target, block: 9, label: 'Переносимая броня' }
  if (BOSS_MAP[e.id] && b.rule) {
    if (b.rule === 'summon' && turn % 2 === 0)
      return { kind: 'support', damage: 0, target, block: 0, label: 'Призыв помощника' }
    if (b.rule === 'hunt') {
      if (e.id === 'dragon' && turn % 3 === 0)
        return {
          kind: 'attack',
          damage: e.power - 2,
          target: -1,
          block: 0,
          label: 'Огненное дыхание',
        }
      if (turn % 2 === 0)
        return {
          kind: 'attack',
          damage: e.power + 5,
          target: alive.some((x) => x.i === b.marked) ? b.marked! : target,
          block: 0,
          label: 'Удар по метке',
        }
      b.marked = target
      return {
        kind: 'charge',
        damage: 0,
        target,
        block: 0,
        label: `Метка: ${HEROES[r.party[target].id].name} · тяжёлый удар в следующем ходу`,
      }
    }
    return {
      kind: 'attack',
      damage: e.power,
      target,
      block: b.rule === 'seal' ? 14 : 0,
      label: b.rule === 'seal' ? 'Печать и удар' : 'Атака',
    }
  }
  if ((e.id === 'cultist' || e.id === 'bomber') && turn % 2 === 1)
    return {
      kind: 'ritual',
      damage: e.power,
      target: -1,
      block: 0,
      label: 'Ритуал · 10 ран прерывают',
    }
  if (e.id === 'herald' && turn % 2 === 0)
    return { kind: 'support', damage: 0, target, block: 0, label: 'Союзникам +2 к атаке' }
  if (e.id === 'hexer' && turn % 2 === 0)
    return { kind: 'curse', damage: 0, target, block: 0, label: 'Пепел в сброс' }
  if (e.id === 'sentinel' && turn % 2 === 1)
    return { kind: 'guard', damage: e.power, target, block: 8, label: 'Рунная броня' }
  if (e.id === 'knight')
    return {
      kind: 'attack',
      damage: e.power + (turn % 3 === 0 ? 4 : 0),
      target,
      block: turn % 3 === 0 ? 0 : 4,
      label: turn % 3 === 0 ? 'Тяжёлый замах' : 'Щит и удар',
    }
  if (e.id === 'dragon' && turn % 3 === 0)
    return { kind: 'attack', damage: e.power - 1, target: -1, block: 0, label: 'Огненное дыхание' }
  if (e.id === 'guardian' && turn % 3 === 1)
    return {
      kind: 'guard',
      damage: Math.max(3, e.power - 3),
      target,
      block: 12,
      label: 'Каменный щит',
    }
  if (e.id === 'wolf' && turn % 3 === 2)
    return { kind: 'charge', damage: 0, target, block: 0, label: 'Готовит прыжок' }
  if (e.id === 'wolf' && turn % 3 === 0)
    return { kind: 'attack', damage: e.power + 4, target, block: 0, label: 'Прыжок' }
  if (e.id === 'archer' && turn % 3 === 0)
    return {
      kind: 'attack',
      damage: e.power + 3,
      target: r.party.findIndex((h) => h.hp > 0 && h.hp === Math.min(...alive.map((a) => a.h.hp))),
      block: 0,
      label: 'Выстрел в слабого',
    }
  if (e.id === 'bridge' && turn % 3 === 2)
    return { kind: 'attack', damage: e.power + 4, target, block: 0, label: 'Тяжёлый замах' }
  return { kind: 'attack', damage: e.power, target, block: 0, label: 'Атака' }
}
function prepareTurn(r: Run, first = false) {
  const b = r.combat!
  b.energy =
    3 + (first && r.relics.includes('hourglass') ? 1 : 0) + (first ? boonCount(r, 'flow') : 0)
  b.rangerUsed = false
  b.played = 0
  b.spent = []
  b.poisonRelay = null
  b.guardRelay = null
  b.lastHero = null
  b.chain = 0
  b.turnChain = 0
  b.duelistUsed = false
  b.oracleUsed = false
  b.bonusDraw = 0
  b.areaAttacks = 0
  b.ruleHeroes = []
  b.retained = null
  b.retainReady = false
  if (first) b.reserve ??= 0
  for (const h of r.party)
    h.block =
      boonCount(r, 'bastion') * 3 +
      (r.relics.includes('cloak') ? 2 : 0) +
      (first && r.relics.includes('lantern') ? 4 : 0) +
      (first ? (b.openingGuard ?? 0) : 0)
  for (const e of b.enemies) {
    e.damageThisTurn = 0
    e.armorMoved = false
    e.intent = enemyIntent(r, e)
    e.block = e.intent.block + (r.omen === 'iron' ? 6 : 0)
  }
  const bearers = b.enemies.filter((e) => e.hp > 0 && e.id === 'shieldbearer')
  for (const e of b.enemies)
    if (e.hp > 0) e.block += bearers.filter((x) => x.uid !== e.uid).length * 6
  draw(
    r,
    5 +
      (r.contract === 'thin-hand' ? -1 : 0) +
      (r.relics.includes('quiver') ? 1 : 0) +
      (first && r.relics.includes('satchel') ? 2 : 0) +
      (first ? boonCount(r, 'flow') : 0) -
      (r.omen === 'hunger' ? 1 : 0) -
      (r.relics.includes('conductor') ? 1 : 0) -
      (r.relics.includes('heavy') ? 1 : 0),
    false,
  )
}
function enemy(r: Run, id: string, name: string, hp: number, power: number, elite = false): Enemy {
  return {
    uid: `e-${Math.floor(random(r) * 1e7)}`,
    id,
    name,
    hp,
    maxHp: hp,
    block: 0,
    poison: 0,
    vulnerable: 0,
    power,
    intent: { kind: 'attack', damage: power, target: 0, block: 0, label: 'Атака' },
    elite,
  }
}
function beginCombat(r: Run, node: RouteNode, acceptTrial = false) {
  const a = areaIndex(r.depth),
    hard = r.mode === 'hard' ? (r.rules >= 6 ? 4 : 5) : 0
  let foes: Enemy[]
  if (node.kind === 'boss') {
    const id = node.bossId ?? r.bossSchedule?.[a] ?? ['bridge', 'guardian', 'dragon'][a]
    const boss = BOSS_MAP[id]
    foes = [
      enemy(
        r,
        id,
        boss.name,
        Math.ceil(boss.hp * (r.mode === 'hard' ? 1.4 : 1)),
        boss.power + hard,
        true,
      ),
    ]
  } else if (r.depth === 1) {
    foes = [enemy(r, 'wolf', 'Лесной волк', 19, 5), enemy(r, 'raider', 'Разбойник', 23, 6)]
  } else {
    const encounter = ENCOUNTER_MAP[node.encounter ?? ''] ?? chooseEncounter(r, a)
    r.encounterHistory = [...(r.encounterHistory ?? []), encounter.id].slice(-12)
    foes = encounter.foes.map((id, i) => {
      const def = ENEMY_MAP[id],
        elite = node.kind === 'elite' && i === 0
      return enemy(
        r,
        id,
        (elite ? 'Матёрый · ' : '') + def.name,
        Math.ceil((def.hp + a * 7) * (elite ? 1.45 : 1)),
        def.power + a * 2 + hard + (elite ? 2 : 0),
        elite,
      )
    })
  }
  const cycle = cycleIndex(r.depth)
  // Campaign pressure rises by region; the introductory fight stays unchanged.
  if (r.rules >= 5 && r.depth > 1)
    for (const e of foes) {
      e.power += a === 2 && node.kind !== 'boss' ? 1 : a
      if (node.kind === 'boss') {
        e.maxHp = Math.ceil(e.maxHp * (1 + a * 0.1))
        e.hp = e.maxHp
      }
    }
  if (acceptTrial && node.trial) for (const e of foes) e.power += 2
  if (cycle > 0) {
    if (r.omen === 'swarm' && node.kind !== 'boss')
      foes.push(enemy(r, 'archer', 'Призванный дозорный', 25 + cycle * 8, 5 + cycle))
    for (const e of foes) {
      e.hp = e.maxHp = Math.ceil(e.hp * Math.pow(1.3, cycle))
      e.power += cycle * 3 + (r.omen === 'rage' ? 3 : 0)
      e.name = cycle > 0 ? `${e.name} · Тень ${cycle}` : e.name
    }
  }
  r.combat = {
    enemies: foes,
    hand: [],
    draw: shuffle(
      r,
      r.deck.map((c) => ({ ...c })),
    ),
    discard: [],
    exhausted: [],
    energy: 3,
    turn: 1,
    played: 0,
    rangerUsed: false,
    log: ['Враг показывает намерение. Защитите героя, которого он атакует.'],
    name: node.name,
    kind: node.kind as Combat['kind'],
    lastHero: null,
    chain: 0,
    maxChain: 0,
    damageTaken: 0,
    rule: node.kind === 'boss' ? BOSS_MAP[foes[0].id].rule : null,
    ruleHeroes: [],
    retained: null,
    retainReady: false,
    reserve: 0,
    duelistUsed: false,
    oracleUsed: false,
    trial: acceptTrial ? (node.trial ?? null) : null,
  }
  if (r.pact && r.pact.remaining > 0) {
    if (r.pact.kind === 'guard') r.combat.openingGuard = 6
    else r.combat.reserve = 6
    r.pact.remaining--
    if (!r.pact.remaining) r.pact = null
  }
  if (r.contract === 'ashfall') r.combat.draw.push(card(r, 'ash'))
  r.phase = 'combat'
  if (r.relics.includes('banner')) r.party.forEach((_, i) => heal(r, i, 3))
  prepareTurn(r, true)
}
export function chooseNode(source: Run, nodeId: string, acceptTrial = false): Run {
  if (source.phase !== 'route') return source
  const r = clone(source),
    node = r.nodes.find((n) => n.id === nodeId)
  if (!node) return source
  r.depth++
  r.chosen = node
  r.routeHistory.push(node.kind)
  if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss')
    beginCombat(r, node, acceptTrial)
  else {
    r.phase = node.kind
    if (node.kind === 'event') {
      const available = EVENTS.map((_, i) => i).filter(
        (i) => (r.rules >= 6 || i < 10) && !r.eventHistory?.slice(-4).includes(i),
      )
      r.eventId = pick(r, available)
      r.eventHistory = [...(r.eventHistory ?? []), r.eventId].slice(-10)
      r.visitor =
        r.eventId === 4
          ? pick(
              r,
              (Object.keys(HEROES) as HeroId[]).filter(
                (id) =>
                  !r.party.some((h) => h.id === id) &&
                  (r.contract !== 'no-healer' || id !== 'priest'),
              ),
            )
          : null
      if (r.eventId === 9) r.shopCards = rewardCards(r)
    }
    if (node.kind === 'shop') {
      r.shopCards = rewardCards(r)
      r.shopRelic = randomRelic(r)
    }
  }
  return r
}
function randomRelic(r: Run): string | null {
  const pool = RELICS.filter((relic) => !r.relics.includes(relic.id))
  return pool.length ? pick(r, pool).id : null
}
function rewardCards(r: Run): Card[] {
  const active = new Set(r.party.map((h) => h.id))
  return shuffle(
    r,
    CARDS.filter((c) => !c.junk && active.has(c.hero)),
  )
    .slice(0, 3)
    .map((c) => card(r, c.id, random(r) < 0.12))
}
function winCombat(r: Run) {
  const b = r.combat!
  r.battles++
  const scale =
    (1 + cycleIndex(r.depth) * 0.4) * (r.mode === 'hard' ? 1.5 : 1) * CONTRACTS[r.contract].bonus
  const parts = {
    base: b.kind === 'boss' ? 600 : b.kind === 'elite' ? 250 : 100,
    speed: Math.max(0, 6 - b.turn) * 25,
    flawless: b.damageTaken === 0 ? 100 : 0,
    combo: Math.min(10, b.maxChain) * 20,
    ...(r.rules >= 5 ? { finisher: b.finisher ?? 0 } : {}),
  }
  r.lastScore = {
    ...parts,
    total: Math.round(
      (parts.base + parts.speed + parts.flawless + parts.combo + (parts.finisher ?? 0)) * scale,
    ),
  }
  r.score += r.lastScore.total
  const trialSuccess =
    b.trial === 'swift'
      ? b.turn <= 3
      : b.trial === 'chain'
        ? b.maxChain >= 4
        : b.trial === 'flawless'
          ? b.damageTaken === 0
          : false
  if (trialSuccess) {
    r.score += Math.round(80 * scale)
    if (r.feats) r.feats.trials++
  }
  if (r.feats) r.feats.bestChain = Math.max(r.feats.bestChain, b.maxChain)
  r.cleared = r.depth
  const coins =
    (b.kind === 'boss' ? 60 : b.kind === 'elite' ? 45 : 25) +
    (r.relics.includes('coin') ? 10 : 0) +
    (trialSuccess ? 15 : 0)
  r.gold += coins
  for (const [i, h] of r.party.entries()) {
    if (h.hp > 0 && r.relics.includes('flask')) heal(r, i, 5)
  }
  const relicChoices =
    b.kind !== 'battle'
      ? shuffle(
          r,
          RELICS.filter((x) => !r.relics.includes(x.id)),
        )
          .slice(0, 3)
          .map((x) => x.id)
      : []
  if (relicChoices.length && !relicChoices.some((id) => relicFits(r, id))) {
    const working = RELICS.filter((x) => !r.relics.includes(x.id) && relicFits(r, x.id))
    if (working.length) relicChoices[0] = pick(r, working).id
  }
  if (b.kind === 'boss') {
    for (const h of r.party) {
      if (h.hp <= 0) h.hp = Math.ceil(h.maxHp * 0.4)
      else h.hp = Math.min(h.maxHp, h.hp + 12)
    }
  }
  const absent = (Object.keys(HEROES) as HeroId[]).filter(
    (id) => !r.party.some((h) => h.id === id) && (r.contract !== 'no-healer' || id !== 'priest'),
  )
  r.reward = {
    cards: rewardCards(r),
    coins,
    relic: null,
    relicChoices,
    ...(b.trial ? { trial: { id: b.trial, success: trialSuccess } } : {}),
    recruit: b.kind === 'boss' && r.depth % 15 !== 0 && absent.length ? pick(r, absent) : null,
    nodeKind: b.kind,
  }
  r.phase = 'reward'
}
function damageEnemy(r: Run, e: Enemy, amount: number, pierce = false, direct = false) {
  if (e.hp <= 0) return
  const absorbed = pierce ? 0 : Math.min(e.block, amount)
  e.block -= absorbed
  const damage = Math.min(e.hp, Math.max(0, amount - absorbed))
  if (direct && r.rules >= 5 && r.combat!.chain >= 3 && !e.summoned && damage === e.hp) {
    const excess = Math.min(150, Math.max(0, amount - absorbed - e.hp))
    if (excess > (r.combat!.finisher ?? 0)) {
      r.combat!.finisher = excess
      log(r.combat!, `Завершающий удар: бонус ${excess}/150 очков за бой.`)
    }
  }
  e.hp -= damage
  r.damageDealt += damage
  if (r.feats) r.feats.bestHit = Math.max(r.feats.bestHit, damage)
  e.damageThisTurn = (e.damageThisTurn ?? 0) + damage
  if (e.intent.kind === 'ritual' && e.damageThisTurn >= 10) {
    e.intent = { ...e.intent, kind: 'charge', damage: 0, label: 'Ритуал прерван' }
    log(r.combat!, `${e.name}: ритуал прерван.`)
    if (r.feats) r.feats.interrupts++
  }
  processDeaths(r)
}
function processDeaths(r: Run) {
  const b = r.combat!
  for (const e of b.enemies) {
    if (e.hp > 0 || e.fallenProcessed) continue
    e.fallenProcessed = true
    for (const scav of b.enemies)
      if (scav.hp > 0 && scav.id === 'scavenger') {
        scav.power += 3
        scav.hp = Math.min(scav.maxHp, scav.hp + 4)
        if (scav.intent.damage > 0) scav.intent.damage += 3
        log(b, `${scav.name}: гибель союзника усилила атаку.`)
      }
    if (r.relics.includes('volatile') && e.poison > 0) {
      log(b, 'Нестабильный сосуд: яд взрывается.')
      for (const other of b.enemies)
        if (other.hp > 0) damageEnemy(r, other, Math.min(15, e.poison), true)
    }
  }
}
function finishIfWon(r: Run): boolean {
  if (r.combat!.enemies.every((e) => e.hp <= 0)) {
    winCombat(r)
    return true
  }
  return false
}
export function playable(r: Run, c: Card): boolean {
  return (
    r.phase === 'combat' &&
    !CARD_MAP[c.id].junk &&
    r.party.some((h) => h.id === CARD_MAP[c.id].hero && h.hp > 0) &&
    r.combat!.energy >= cardCost(r, c)
  )
}
export function cardCost(r: Run, c: Card) {
  const d = CARD_MAP[c.id]
  return Math.max(0, d.cost - (d.heal && r.relics.includes('mercy') && !r.combat?.healUsed ? 1 : 0))
}
export function playCard(source: Run, uid: string, targetIndex: number): Run {
  if (source.phase !== 'combat') return source
  const found = source.combat!.hand.find((c) => c.uid === uid)
  if (!found || !playable(source, found)) return source
  const d = values(found)
  if (source.rules < 6 && d.id === 'parry') d.draw = undefined
  const multiplier = comboMultiplier(source, found)
  if (d.target === 'enemy' && !source.combat!.enemies.some((e, i) => i === targetIndex && e.hp > 0))
    return source
  if (d.target === 'ally' && !source.party.some((h, i) => i === targetIndex && h.hp > 0))
    return source
  const r = clone(source),
    b = r.combat!,
    owner = r.party.findIndex((h) => h.id === d.hero),
    c = b.hand.find((c) => c.uid === uid)!
  b.hand = b.hand.filter((c) => c.uid !== uid)
  b.energy -= cardCost(r, c)
  if (d.heal) b.healUsed = true
  ;(d.exhaust ? b.exhausted : b.discard).push(c)
  b.played++
  b.spent = [...(b.spent ?? []), c.uid]
  const repeated = b.lastHero === d.hero
  if (b.rule === 'echo' && repeated)
    for (const e of b.enemies) if (e.hp > 0 && BOSS_MAP[e.id]) e.block += 7
  if (!b.ruleHeroes?.includes(d.hero)) b.ruleHeroes = [...(b.ruleHeroes ?? []), d.hero]
  if (b.rule === 'seal' && b.ruleHeroes.length === 2)
    for (const e of b.enemies) if (BOSS_MAP[e.id]) e.block = 0
  b.chain = b.lastHero !== null && b.lastHero !== d.hero ? b.chain + 1 : 1
  b.lastHero = d.hero
  const previousChain = b.turnChain ?? 0
  b.turnChain = Math.max(previousChain, b.chain)
  b.maxChain = Math.max(b.maxChain, b.chain)
  if (r.feats) r.feats.bestChain = Math.max(r.feats.bestChain, b.chain)
  if (b.chain === 3 && previousChain < 3) {
    const before = b.hand.length
    draw(r, 1)
    log(
      b,
      b.hand.length > before
        ? `Связка ×${b.chain}: +1 карта.`
        : `Связка ×${b.chain}: лимит добора исчерпан.`,
    )
    if (r.relics.includes('memory')) b.retainReady = true
  }
  if (b.chain === 5 && previousChain < 5) {
    b.energy++
    if (r.relics.includes('relay'))
      r.party.forEach((h) => {
        if (h.hp > 0) h.block += 5
      })
    log(b, `Связка ×${b.chain}: +1 энергия.`)
  }
  if (d.target === 'all' && d.damage) {
    if ((b.areaAttacks ?? 0) >= 1) {
      const veil = b.enemies.filter((e) => e.hp > 0 && e.id === 'weaver').length * 6
      if (veil) {
        for (const e of b.enemies) if (e.hp > 0) e.block += veil
        log(b, `Завеса: врагам +${veil} защиты перед массовой атакой.`)
      }
    }
    b.areaAttacks = (b.areaAttacks ?? 0) + 1
  }
  const enemies =
    d.target === 'all'
      ? b.enemies.filter((e) => e.hp > 0)
      : d.target === 'enemy'
        ? [b.enemies[targetIndex]]
        : []
  const bonus =
    (r.relics.includes('whetstone') ? 2 : 0) + boonCount(r, 'edge') * 3 + attackBonus(r, d)
  if (d.damage && d.hero === 'ranger') b.rangerUsed = true
  if (d.damage && d.hero === 'duelist') b.duelistUsed = true
  if (d.damage) b.reserve = 0
  if (d.damage && b.poisonRelay?.hero !== d.hero) b.poisonRelay = null
  if (d.damage && b.guardRelay?.hero !== d.hero) b.guardRelay = null
  for (const e of enemies) {
    if (d.damage) {
      let amount = d.damage + bonus + (d.poisonStrike ? e.poison : 0)
      if (d.hero === 'rogue' && e.vulnerable > 0) amount += 3
      amount = Math.floor(amount * multiplier)
      if (e.vulnerable > 0) amount = Math.floor(amount * 1.5)
      const before = e.hp
      damageEnemy(r, e, amount, d.id === 'pierce', true)
      log(
        b,
        `${d.name} → ${e.name}: ${before - e.hp} урона${multiplier > 1 ? ` (связка ×${multiplier})` : ''}.`,
      )
    }
    if (d.poison)
      e.poison +=
        d.poison +
        (r.relics.includes('vial') ? 2 : 0) +
        boonCount(r, 'venom') * 4 +
        (d.hero === 'alchemist' ? 2 : 0)
    if (d.vulnerable) e.vulnerable += d.vulnerable
  }
  if (d.damage)
    for (const e of enemies) {
      if (e.id !== 'armorer' || e.armorMoved) continue
      e.armorMoved = true
      const ally = b.enemies
        .filter((x) => x.uid !== e.uid && x.hp > 0)
        .sort((a, b) => a.hp - b.hp)[0]
      if (e.hp > 0 && e.block > 0 && ally) {
        log(b, `${e.name}: ${e.block} защиты передано ${ally.name}.`)
        ally.block += e.block
        e.block = 0
      }
    }
  if (d.block) {
    const targets =
      d.target === 'all' ? r.party.map((_, i) => i) : [d.target === 'ally' ? targetIndex : owner]
    for (const i of targets) if (r.party[i].hp > 0) r.party[i].block += d.block
    log(b, `${d.name}: защита +${d.block}.`)
    if (r.relics.includes('guardbond'))
      b.guardRelay = { hero: d.hero, bonus: Math.min(10, Math.floor(d.block / 2)) }
  }
  if (d.poison && r.relics.includes('venombond')) {
    const applied =
      d.poison +
      (r.relics.includes('vial') ? 2 : 0) +
      boonCount(r, 'venom') * 4 +
      (d.hero === 'alchemist' ? 2 : 0)
    b.poisonRelay = { hero: d.hero, bonus: Math.min(12, Math.floor(applied / 2)) }
  }
  if (d.heal) {
    const targets = d.target === 'all' ? r.party.map((_, i) => i) : [targetIndex]
    for (const i of targets) heal(r, i, d.heal + (d.hero === 'priest' ? 2 : 0))
    log(b, `${d.name}: восстановление здоровья.`)
  }
  if (d.hero === 'warden') r.party[owner].block += 2
  if ((d.hero === 'mage' && d.kind === 'spell') || d.hero === 'bard')
    for (const h of r.party) if (h.hp > 0) h.block++
  if (d.energy) b.energy += d.energy
  if (d.draw) draw(r, d.draw)
  if (d.hero === 'oracle' && !b.oracleUsed) {
    b.oracleUsed = true
    draw(r, 1)
  }
  if (d.cleanse) {
    for (const pile of [b.hand, b.draw, b.discard]) {
      const ash = pile.filter((c) => CARD_MAP[c.id].junk)
      b.exhausted.push(...ash)
      for (const c of ash) pile.splice(pile.indexOf(c), 1)
    }
    log(b, 'Пепел очищен.')
  }
  if (r.relics.includes('ember') && b.played % 3 === 0) {
    for (const e of b.enemies) if (e.hp > 0) damageEnemy(r, e, 3)
    log(b, 'Тёплый уголь: всем врагам 3 урона.')
  }
  finishIfWon(r)
  return r
}
export function endTurn(source: Run): Run {
  if (source.phase !== 'combat') return source
  const r = clone(source),
    b = r.combat!
  for (const e of b.enemies) {
    if (e.hp > 0 && e.poison > 0) {
      const damage = Math.min(
        e.hp,
        Math.floor(
          e.poison *
            (1 + boonCount(r, 'venom') * 0.25) *
            (r.relics.includes('volatile') ? 0.75 : 1),
        ),
      )
      damageEnemy(r, e, damage, true)
      log(b, `${e.name}: яд наносит ${damage} урона.`)
      e.poison--
    }
  }
  if (finishIfWon(r)) return r
  for (const e of b.enemies) {
    if (e.hp <= 0) continue
    const intent = e.intent
    if (intent.kind === 'support') {
      if (BOSS_MAP[e.id] && b.rule === 'summon') {
        if (b.enemies.filter((x) => x.hp > 0).length < 3) {
          const cycle = cycleIndex(r.depth)
          b.enemies = b.enemies.filter((x) => x.hp > 0)
          b.enemies.push({
            ...enemy(
              r,
              'raider',
              'Призванная тень',
              Math.ceil((18 + areaIndex(r.depth) * 4) * Math.pow(1.3, cycle)),
              4 +
                areaIndex(r.depth) +
                cycle * 3 +
                (r.mode === 'hard' ? (r.rules >= 6 ? 4 : 5) : 0) +
                (r.omen === 'rage' ? 3 : 0),
            ),
            summoned: true,
          })
          log(b, 'Босс призвал помощника. Он действует со следующего хода.')
        }
      } else if (e.id === 'herald') {
        for (const ally of b.enemies) if (ally.hp > 0 && ally.uid !== e.uid) ally.power += 2
        log(b, 'Знаменосец усилил союзников на 2.')
      }
    }
    if (intent.kind === 'curse') {
      if ([...b.hand, ...b.draw, ...b.discard].filter((c) => c.id === 'ash').length < 3)
        b.discard.push(card(r, 'ash'))
      log(b, 'Проклинатель: Пепел попал в сброс.')
    }
    let wounds = 0
    if (intent.damage > 0) {
      const alive = r.party.map((h, i) => ({ h, i })).filter(({ h }) => h.hp > 0)
      const targets =
        intent.target === -1
          ? alive.map((a) => a.i)
          : [r.party[intent.target]?.hp > 0 ? intent.target : alive[0]?.i]
      for (const i of targets) {
        if (i === undefined) continue
        const h = r.party[i],
          amount = intent.damage + Math.max(0, b.turn - 7) * 2,
          blocked = Math.min(h.block, amount)
        h.block -= blocked
        const wound = Math.min(h.hp, amount - blocked)
        b.damageTaken += wound
        h.hp = Math.max(0, h.hp - (amount - blocked))
        wounds += wound
        log(
          b,
          `${e.name} → ${HEROES[h.id].name}: ${amount - blocked} урона${blocked ? ` (${blocked} остановила защита)` : ''}.`,
        )
      }
    }
    if (e.id === 'leech' && wounds > 0) {
      e.hp = Math.min(e.maxHp, e.hp + Math.min(6, wounds))
      log(b, 'Кровопийца восстановил здоровье из нанесённых ран.')
    }
    if (e.vulnerable > 0) e.vulnerable--
  }
  if (r.party.every((h) => h.hp <= 0)) {
    r.phase = 'defeat'
    return r
  }
  b.reserve = r.relics.includes('anvil')
    ? Math.min(10, Math.floor(r.party.reduce((n, h) => n + (h.hp > 0 ? h.block : 0), 0) / 2))
    : 0
  b.exhausted.push(...b.hand.filter((c) => CARD_MAP[c.id].junk))
  b.discard.push(...b.hand.filter((c) => !CARD_MAP[c.id].junk && c.uid !== b.retained))
  b.hand = b.hand.filter(
    (c) =>
      !CARD_MAP[c.id].junk &&
      c.uid === b.retained &&
      r.party.some((h) => h.hp > 0 && h.id === CARD_MAP[c.id].hero),
  )
  b.turn++
  prepareTurn(r)
  return r
}
export function retainCard(source: Run, uid: string): Run {
  if (
    source.phase !== 'combat' ||
    !source.relics.includes('memory') ||
    !source.combat!.retainReady ||
    !source.combat!.hand.some((c) => c.uid === uid && !CARD_MAP[c.id].junk)
  )
    return source
  const r = clone(source)
  r.combat!.retained = r.combat!.retained === uid ? null : uid
  return r
}
function nextRoute(r: Run) {
  if (r.phase !== 'reward')
    r.score += Math.round(
      25 *
        (1 + cycleIndex(r.depth) * 0.4) *
        (r.mode === 'hard' ? 1.5 : 1) *
        CONTRACTS[r.contract].bonus,
    )
  r.combat = null
  r.reward = null
  r.chosen = null
  r.cleared = r.depth

  r.phase = r.depth > 0 && r.depth % 15 === 0 ? 'checkpoint' : 'route'
  r.nodes = r.phase === 'route' ? makeRoutes(r) : []
}
export function takeRelic(source: Run, id: string): Run {
  if (
    source.phase !== 'reward' ||
    !source.reward?.relicChoices?.includes(id) ||
    source.relics.includes(id)
  )
    return source
  const r = clone(source)
  r.relics.push(id)
  r.reward!.relic = id
  r.reward!.relicChoices = []
  return r
}
export function takeReward(source: Run, uid: string | null): Run {
  if (source.phase !== 'reward' || source.reward?.relicChoices?.length) return source
  const r = clone(source)
  if (uid) {
    const c = r.reward!.cards.find((c) => c.uid === uid)
    if (!c) return source
    r.deck.push(c)
  }
  nextRoute(r)
  return r
}
export function recruit(source: Run, slot: number): Run {
  if (
    source.phase !== 'reward' ||
    !source.reward?.recruit ||
    (source.contract === 'no-healer' && source.reward.recruit === 'priest') ||
    slot < 0 ||
    slot >= source.party.length
  )
    return source
  const r = clone(source),
    id = r.reward!.recruit!,
    old = r.party[slot].id
  r.party[slot] = { id, hp: HEROES[id].hp, maxHp: HEROES[id].hp, block: 0 }
  r.deck = r.deck.filter((c) => CARD_MAP[c.id].hero !== old)
  for (const cid of [...HEROES[id].cards, HEROES[id].cards[0]]) r.deck.push(card(r, cid))
  r.reward!.recruit = null
  r.reward!.cards = rewardCards(r)
  return r
}
export function rest(source: Run, action: 'heal' | 'upgrade' | 'revive', uid?: string): Run {
  if (source.phase !== 'rest') return source
  const r = clone(source)
  if (action === 'heal') r.party.forEach((_, i) => heal(r, i, Math.ceil(r.party[i].maxHp * 0.35)))
  else if (action === 'revive') {
    const fallen = r.party.find((h) => h.hp <= 0)
    if (!fallen) return source
    fallen.hp = Math.ceil(fallen.maxHp * 0.5)
  } else {
    const c = r.deck.find((c) => c.uid === uid && canUpgrade(c))
    if (!c) return source
    upgradeCard(c)
  }
  nextRoute(r)
  return r
}
export function eventChoice(source: Run, choice: 'a' | 'b', uid?: string): Run {
  if (source.phase !== 'event') return source
  const r = clone(source)
  if (r.eventId === 0) {
    if (choice === 'a') r.party.forEach((_, i) => heal(r, i, 12))
    else {
      const relic = randomRelic(r)
      if (relic) r.relics.push(relic)
      for (const h of r.party) if (h.hp > 0) h.hp = Math.max(1, h.hp - 7)
    }
  }
  if (r.eventId === 1) {
    if (choice === 'a') {
      if (r.gold < 25) return source
      r.gold -= 25
      for (const c of shuffle(
        r,
        r.deck.filter((c) => canUpgrade(c)),
      ).slice(0, 2))
        upgradeCard(c)
    } else r.gold += 15
  }
  if (r.eventId === 2) {
    if (choice === 'a') {
      r.gold += 50
      const h = r.party.find((h) => h.hp > 0)
      if (h) h.hp = Math.max(1, h.hp - 10)
    } else r.party.forEach((_, i) => heal(r, i, 4))
  }
  if (r.eventId === 3) {
    if (choice === 'a') {
      const c = uid === undefined ? r.deck.find(canUpgrade) : r.deck.find((c) => c.uid === uid)
      if (r.gold < 20 || !c || !canUpgrade(c)) return source
      r.gold -= 20
      upgradeCard(c)
    } else r.gold += 12
  }
  if (r.eventId === 4) {
    if (choice === 'a') return source
    else r.party.forEach((_, i) => heal(r, i, 6))
  }
  if (r.eventId === 5) {
    if (choice === 'a') {
      if (r.gold < 15) return source
      r.gold -= 15
      r.party.forEach((_, i) => heal(r, i, 10))
    } else r.gold += 18
  }
  if (r.eventId === 6) {
    if (choice === 'a') {
      const c = uid === undefined ? r.deck[0] : r.deck.find((c) => c.uid === uid)
      if (r.deck.length <= 6 || !c) return source
      r.deck = r.deck.filter((x) => x.uid !== c.uid)
      r.gold += 10
    } else {
      const h = r.party
        .filter((h) => h.hp > 0 && h.hp < h.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
      if (h) heal(r, r.party.indexOf(h), 5)
    }
  }
  if (r.eventId === 7) {
    if (choice === 'a') {
      const relic = randomRelic(r)
      if (relic) r.relics.push(relic)
      for (const h of r.party) if (h.hp > 0) h.hp = Math.max(1, h.hp - 9)
    } else r.party.forEach((_, i) => heal(r, i, 5))
  }
  if (r.eventId === 8) {
    if (choice === 'a') {
      if (r.gold < 25) return source
      r.gold -= 25
      const h = r.party.find((h) => h.hp <= 0)
      if (h) h.hp = Math.ceil(h.maxHp / 2)
      r.party.forEach((_, i) => heal(r, i, 8))
    } else {
      r.gold += 8
      r.party.forEach((_, i) => heal(r, i, 4))
    }
  }
  if (r.eventId === 9) {
    if (choice === 'a') {
      const c = uid === undefined ? r.shopCards[0] : r.shopCards.find((c) => c.uid === uid)
      if (r.gold < 15 || !c) return source
      r.gold -= 15
      r.deck.push(c)
    } else {
      r.gold += 10
      r.party.forEach((_, i) => heal(r, i, 3))
    }
  }
  if (r.eventId === 10) {
    if (choice === 'a') {
      const c = r.deck.find((c) => c.uid === uid && canUpgrade(c))
      if (!c) return source
      upgradeCard(c)
      r.deck.push(card(r, 'ash'))
    } else r.party.forEach((_, i) => heal(r, i, 5))
  }
  if (r.eventId === 11) {
    if (r.gold < 20) return source
    r.gold -= 20
    r.pact = { kind: choice === 'a' ? 'guard' : 'edge', remaining: 2 }
  }
  nextRoute(r)
  return r
}
export function leaveEvent(source: Run): Run {
  if (source.phase !== 'event' || source.eventId !== 11) return source
  const r = clone(source)
  nextRoute(r)
  return r
}
export function recruitVisitor(source: Run, slot: number): Run {
  if (
    source.phase !== 'event' ||
    source.eventId !== 4 ||
    !source.visitor ||
    (source.contract === 'no-healer' && source.visitor === 'priest') ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= 3
  )
    return source
  const r = clone(source),
    id = r.visitor!,
    old = r.party[slot].id
  r.party[slot] = { id, hp: HEROES[id].hp, maxHp: HEROES[id].hp, block: 0 }
  r.deck = r.deck.filter((c) => CARD_MAP[c.id].hero !== old)
  for (const cid of [...HEROES[id].cards, HEROES[id].cards[0]]) r.deck.push(card(r, cid))
  nextRoute(r)
  return r
}
export function buy(source: Run, kind: 'card' | 'relic' | 'remove', uid?: string): Run {
  if (source.phase !== 'shop') return source
  const cost = kind === 'card' ? 35 : kind === 'relic' ? 70 : 30
  if (source.gold < cost) return source
  const r = clone(source)
  if (kind === 'card') {
    const c = r.shopCards.find((c) => c.uid === uid)
    if (!c) return source
    r.deck.push(c)
    r.shopCards = r.shopCards.filter((c) => c.uid !== uid)
  } else if (kind === 'relic') {
    if (!r.shopRelic) return source
    r.relics.push(r.shopRelic)
    r.shopRelic = null
  } else {
    if (r.deck.length <= 6 || !r.deck.some((c) => c.uid === uid)) return source
    r.deck = r.deck.filter((c) => c.uid !== uid)
  }
  r.gold -= cost
  return r
}
export function leaveShop(source: Run): Run {
  if (source.phase !== 'shop') return source
  const r = clone(source)
  nextRoute(r)
  return r
}
export function record(source: Run, p: Profile): { run: Run; profile: Profile } {
  const profile = {
    ...p,
    unlockedHeroes: [
      ...new Set([
        ...p.unlockedHeroes,
        ...(source.phase === 'event' && source.visitor ? [source.visitor] : []),
        ...(source.reward?.recruit ? [source.reward.recruit] : []),
      ]),
    ],
    seenCards: [
      ...new Set([
        ...p.seenCards,
        ...source.deck.map((c) => c.id),
        ...(source.reward?.cards.map((c) => c.id) ?? []),
      ]),
    ],
    seenRelics: [...new Set([...p.seenRelics, ...source.relics])],
  }
  if (!['victory', 'defeat'].includes(source.phase) || source.recorded)
    return { run: source, profile }
  const run = clone(source)
  run.recorded = true
  profile.runs++
  profile.wins += run.cleared >= 15 ? 1 : 0
  profile.best = Math.max(profile.best, run.depth)
  profile.history = [
    {
      seed: run.seed,
      mode: run.mode,
      contract: run.contract,
      won: run.cleared >= 15,
      score: run.score,
      runId: run.runId,
      rules: run.rules,
      cleared: run.cleared,
      player: p.nickname.trim() || 'Странник',
      depth: run.depth,
      party: run.startParty ?? run.party.map((h) => h.id),
      date: new Date().toISOString(),
    },
    ...profile.history,
  ].slice(0, 20)
  if (run.rules >= 4) {
    const prior = profile.records.find(
      (h) =>
        h.rules === run.rules &&
        (h.contract ?? 'standard') === run.contract &&
        h.runId === run.runId &&
        h.player === (p.nickname.trim() || 'Странник'),
    )
    const records = [
      prior && (prior.score ?? 0) > run.score ? prior : profile.history[0],
      ...profile.records.filter(
        (h) =>
          h.rules !== run.rules ||
          (h.contract ?? 'standard') !== run.contract ||
          h.runId !== run.runId ||
          h.player !== (p.nickname.trim() || 'Странник'),
      ),
    ].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const categoryCount = new Map<string, number>()
    profile.records = records.filter((entry) => {
      const category = [
        entry.rules,
        entry.mode,
        entry.contract ?? 'standard',
        partyIdentity(entry.party),
      ].join('|')
      const count = categoryCount.get(category) ?? 0
      categoryCount.set(category, count + 1)
      return count < 10
    })
  }
  return { run, profile }
}

/** Accept v0.3 saves without putting earlier runs into the new ranked rules. */
export function migrateRun(raw: Run): Run {
  const r = structuredClone(raw)
  r.score ??= 0
  r.lastScore ??= { base: 0, speed: 0, flawless: 0, combo: 0, total: 0 }
  r.cleared ??=
    r.phase === 'victory' ? r.depth : Math.max(0, r.depth - (r.phase === 'combat' ? 1 : 0))
  r.boons ??= []
  r.omen ??= null
  r.runId ??= `legacy-${r.seed}-${r.mode}`
  r.contract ??= 'standard'
  r.rules ??= 3
  r.bossSchedule ??= ['bridge', 'guardian', 'dragon']
  r.encounterHistory ??= []
  r.eventHistory ??= []
  r.visitor ??= null
  if (r.combat) {
    r.combat.lastHero ??= null
    r.combat.chain ??= 0
    r.combat.maxChain ??= 0
    r.combat.damageTaken ??= 0
  }
  if (r.rules === 3 && !r.recorded && r.phase === 'victory' && r.depth > 0 && r.depth % 15 === 0) {
    r.phase = 'checkpoint'
    r.recorded = false
  }
  return r
}
export function continueEndless(source: Run, boon: string): Run {
  if (source.phase !== 'checkpoint' || !BOONS.some((b) => b.id === boon)) return source
  const r = clone(source)
  r.boons.push(boon)
  r.omen = pick(
    r,
    OMENS.filter((o) => o.id !== r.omen),
  ).id
  for (const h of r.party) {
    h.hp = Math.max(h.hp, Math.ceil(h.maxHp * 0.75))
    h.block = 0
  }
  r.gold += 40
  r.phase = 'route'
  r.recorded = false
  r.bossSchedule = scheduleBosses(r)
  r.nodes = makeRoutes(r)
  return r
}
export function retire(source: Run): Run {
  if (source.phase !== 'checkpoint') return source
  const r = clone(source)
  r.phase = 'victory'
  return r
}
