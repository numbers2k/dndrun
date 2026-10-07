import { BOONS, OMENS } from './endless'
import { AREAS, CARDS, CARD_MAP, EVENTS, HEROES, RELICS, STARTER_PARTIES } from './data'
import type {
  Card,
  Combat,
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
      h.party.every((id) => id in HEROES)
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
        ? p.records
            .filter(
              (h: Profile['history'][number]) =>
                validHistory(h) &&
                h.rules === 4 &&
                Number.isSafeInteger(h.score) &&
                h.score! >= 0 &&
                Number.isSafeInteger(h.cleared) &&
                h.cleared! >= 0 &&
                h.cleared! <= h.depth &&
                typeof h.runId === 'string' &&
                typeof h.player === 'string',
            )
            .slice(0, 100)
        : [],
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
      !Array.isArray(r.boons) ||
      !r.boons.every((id) => BOONS.some((b) => b.id === id)) ||
      (r.omen !== null && !OMENS.some((o) => o.id === r.omen)) ||
      typeof r.runId !== 'string' ||
      ![3, 4].includes(r.rules) ||
      !num(r.gold) ||
      !num(r.battles) ||
      !num(r.damageDealt) ||
      typeof r.recorded !== 'boolean'
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
          typeof n.description === 'string',
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
        typeof b.rangerUsed !== 'boolean' ||
        !Array.isArray(b.log) ||
        !b.log.every((s) => typeof s === 'string') ||
        typeof b.name !== 'string' ||
        !['battle', 'elite', 'boss'].includes(b.kind) ||
        !Array.isArray(b.enemies) ||
        !b.enemies.length
      )
        return null
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
            e.intent &&
            ['attack', 'guard', 'charge'].includes(e.intent.kind) &&
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
        (r.reward.relic !== null && !RELICS.some((x) => x.id === r.reward!.relic)))
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
  return upgradeLevel(c) < 20
}
export function upgradeCard(c: Card) {
  c.level = upgradeLevel(c) + 1
  c.upgraded = true
}

export function makeRoutes(r: Run): RouteNode[] {
  const next = r.depth + 1,
    area = AREAS[areaIndex(next)]
  if (next % 5 === 0)
    return [
      {
        id: `boss-${next}`,
        kind: 'boss',
        name: area.boss,
        description: 'Победа откроет следующую область. Реликвия и новая карта в награду.',
      },
    ]
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
  return kinds.map((kind) => ({
    id: `${kind}-${next}`,
    kind,
    name: `${next > 15 ? pick(r, ['Затерянный', 'Погребённый', 'Безымянный']) + ' путь · ' : ''}${names[kind][areaIndex(next)]}`,
    description: descriptions[kind],
  }))
}
export function newRun(leader: HeroId, seed: string, mode: Run['mode'] = 'normal'): Run {
  if (mode === 'daily') leader = 'warden'
  const r: Run = {
    version: 3,
    seed,
    rng: hash(seed),
    mode,
    phase: 'route',
    depth: 0,
    party: STARTER_PARTIES[leader].map((id) => ({
      id,
      hp: HEROES[id].hp,
      maxHp: HEROES[id].hp,
      block: 0,
    })),
    deck: [],
    relics: [leader === 'warden' ? 'lantern' : leader === 'ranger' ? 'satchel' : 'hourglass'],
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
    runId: `${seed}-${leader}-${mode}`,
    rules: 4,
  }
  for (const h of r.party) {
    for (const id of [...HEROES[h.id].cards, HEROES[h.id].cards[0]]) r.deck.push(card(r, id))
  }
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
  return out.join('. ') + '.'
}
export function combatDescription(r: Run, c: Card): string {
  const d = values(c)
  if (d.damage) {
    d.damage +=
      (r.relics.includes('whetstone') ? 2 : 0) +
      boonCount(r, 'edge') * 3 +
      (d.hero === 'ranger' && !r.combat?.rangerUsed ? 3 : 0)
  }
  if (d.heal) d.heal += (d.hero === 'priest' ? 2 : 0) + (r.relics.includes('herbs') ? 2 : 0)
  if (d.poison) d.poison += (r.relics.includes('vial') ? 2 : 0) + boonCount(r, 'venom') * 4
  return effectDescription(d)
}
export function targetDamage(r: Run, c: Card, index: number): number {
  const d = values(c),
    e = r.combat?.enemies[index]
  if (!d.damage || !e) return 0
  let amount =
    d.damage +
    (r.relics.includes('whetstone') ? 2 : 0) +
    boonCount(r, 'edge') * 3 +
    (d.hero === 'ranger' && !r.combat?.rangerUsed ? 3 : 0) +
    (d.hero === 'rogue' && e.vulnerable > 0 ? 3 : 0)
  if (e.vulnerable > 0) amount = Math.floor(amount * 1.5)
  return Math.min(e.hp, Math.max(0, amount - (d.id === 'pierce' ? 0 : e.block)))
}
function log(b: Combat, message: string) {
  b.log = [message, ...b.log].slice(0, 16)
}
function heal(r: Run, index: number, amount: number) {
  const h = r.party[index]
  if (!h || h.hp <= 0) return
  h.hp = Math.min(h.maxHp, h.hp + amount + (r.relics.includes('herbs') ? 2 : 0))
}
function draw(r: Run, n: number) {
  const b = r.combat!
  for (let i = 0; i < n; i++) {
    if (!b.draw.length) {
      b.draw = shuffle(r, b.discard)
      b.discard = []
    }
    if (!b.draw.length) break
    const c = b.draw.pop()!
    if (r.party.some((h) => h.id === CARD_MAP[c.id].hero && h.hp > 0)) b.hand.push(c)
    else i--
  }
}
function enemyIntent(r: Run, e: Enemy): Intent {
  const b = r.combat!,
    turn = b.turn,
    alive = r.party.map((h, i) => ({ h, i })).filter(({ h }) => h.hp > 0)
  const target = alive.length ? pick(r, alive).i : 0
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
  b.lastHero = null
  b.chain = 0
  b.turnChain = 0
  for (const h of r.party)
    h.block =
      boonCount(r, 'bastion') * 3 +
      (r.relics.includes('cloak') ? 2 : 0) +
      (first && r.relics.includes('lantern') ? 4 : 0)
  for (const e of b.enemies) {
    e.intent = enemyIntent(r, e)
    e.block = e.intent.block + (r.omen === 'iron' ? 6 : 0)
  }
  draw(
    r,
    5 +
      (r.relics.includes('quiver') ? 1 : 0) +
      (first && r.relics.includes('satchel') ? 2 : 0) +
      (first ? boonCount(r, 'flow') : 0) -
      (r.omen === 'hunger' ? 1 : 0),
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
function beginCombat(r: Run, node: RouteNode) {
  const a = areaIndex(r.depth),
    hard = r.mode === 'hard' ? 4 : 0
  let foes: Enemy[]
  if (node.kind === 'boss') {
    const id = ['bridge', 'guardian', 'dragon'][a]
    foes = [
      enemy(
        r,
        id,
        AREAS[a].boss,
        Math.ceil([76, 138, 250][a] * (r.mode === 'hard' ? 1.25 : 1)),
        [10, 15, 19][a] + hard,
        true,
      ),
    ]
  } else if (node.kind === 'elite') {
    foes = [
      enemy(r, ['wolf', 'guardian', 'knight'][a], node.name, 50 + a * 17, 10 + a * 3 + hard, true),
      enemy(r, 'archer', 'Дозорный', 20 + a * 6, 5 + a * 2 + hard),
    ]
  } else if (r.depth === 1) {
    foes = [enemy(r, 'wolf', 'Лесной волк', 19, 5), enemy(r, 'raider', 'Разбойник', 23, 6)]
  } else {
    const options = [
      ['raider', 'Разбойник'],
      ['wolf', 'Дикий волк'],
      ['archer', 'Лучник'],
    ]
    foes = Array.from({ length: a === 2 ? 3 : 2 }, () => {
      const [id, name] = pick(r, options)
      return enemy(r, id, name, 24 + a * 9, 6 + a * 2 + hard)
    })
  }
  const cycle = cycleIndex(r.depth)
  if (cycle > 0) {
    if (r.omen === 'swarm' && node.kind !== 'boss')
      foes.push(enemy(r, 'archer', 'Призванный дозорный', 25 + cycle * 8, 5 + cycle))
    for (const e of foes) {
      e.hp = e.maxHp = Math.ceil(e.hp * Math.pow(1.22, cycle))
      e.power += cycle * 2 + (r.omen === 'rage' ? 3 : 0)
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
  }
  r.phase = 'combat'
  if (r.relics.includes('banner')) r.party.forEach((_, i) => heal(r, i, 3))
  prepareTurn(r, true)
}
export function chooseNode(source: Run, nodeId: string): Run {
  if (source.phase !== 'route') return source
  const r = clone(source),
    node = r.nodes.find((n) => n.id === nodeId)
  if (!node) return source
  r.depth++
  r.chosen = node
  r.routeHistory.push(node.kind)
  if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss') beginCombat(r, node)
  else {
    r.phase = node.kind
    if (node.kind === 'event') r.eventId = Math.floor(random(r) * EVENTS.length)
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
    CARDS.filter((c) => active.has(c.hero)),
  )
    .slice(0, 3)
    .map((c) => card(r, c.id, random(r) < 0.12))
}
function winCombat(r: Run) {
  const b = r.combat!
  r.battles++
  const scale = (1 + cycleIndex(r.depth) * 0.4) * (r.mode === 'hard' ? 1.5 : 1)
  const parts = {
    base: b.kind === 'boss' ? 600 : b.kind === 'elite' ? 250 : 100,
    speed: Math.max(0, 6 - b.turn) * 25,
    flawless: b.damageTaken === 0 ? 100 : 0,
    combo: Math.min(10, b.maxChain) * 20,
  }
  r.lastScore = {
    ...parts,
    total: Math.round((parts.base + parts.speed + parts.flawless + parts.combo) * scale),
  }
  r.score += r.lastScore.total
  r.cleared = r.depth
  const coins =
    (b.kind === 'boss' ? 60 : b.kind === 'elite' ? 45 : 25) + (r.relics.includes('coin') ? 10 : 0)
  r.gold += coins
  for (const [i, h] of r.party.entries()) {
    if (h.hp > 0 && r.relics.includes('flask')) heal(r, i, 5)
  }
  const relic = b.kind !== 'battle' ? randomRelic(r) : null
  if (relic) r.relics.push(relic)
  if (b.kind === 'boss') {
    for (const h of r.party) {
      if (h.hp <= 0) h.hp = Math.ceil(h.maxHp * 0.4)
      else h.hp = Math.min(h.maxHp, h.hp + 12)
    }
  }
  const absent = (Object.keys(HEROES) as HeroId[]).filter((id) => !r.party.some((h) => h.id === id))
  r.reward = {
    cards: rewardCards(r),
    coins,
    relic,
    recruit: b.kind === 'boss' && r.depth % 15 !== 0 ? pick(r, absent) : null,
    nodeKind: b.kind,
  }
  r.phase = 'reward'
}
function damageEnemy(r: Run, e: Enemy, amount: number, pierce = false) {
  const absorbed = pierce ? 0 : Math.min(e.block, amount)
  e.block -= absorbed
  const damage = Math.min(e.hp, Math.max(0, amount - absorbed))
  e.hp -= damage
  r.damageDealt += damage
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
    r.party.some((h) => h.id === CARD_MAP[c.id].hero && h.hp > 0) &&
    r.combat!.energy >= CARD_MAP[c.id].cost
  )
}
export function playCard(source: Run, uid: string, targetIndex: number): Run {
  if (source.phase !== 'combat') return source
  const found = source.combat!.hand.find((c) => c.uid === uid)
  if (!found || !playable(source, found)) return source
  const d = values(found)
  if (d.target === 'enemy' && !source.combat!.enemies.some((e, i) => i === targetIndex && e.hp > 0))
    return source
  if (d.target === 'ally' && !source.party.some((h, i) => i === targetIndex && h.hp > 0))
    return source
  const r = clone(source),
    b = r.combat!,
    owner = r.party.findIndex((h) => h.id === d.hero),
    c = b.hand.find((c) => c.uid === uid)!
  b.hand = b.hand.filter((c) => c.uid !== uid)
  b.energy -= d.cost
  ;(d.exhaust ? b.exhausted : b.discard).push(c)
  b.played++
  b.chain = b.lastHero !== null && b.lastHero !== d.hero ? b.chain + 1 : 1
  b.lastHero = d.hero
  const previousChain = b.turnChain ?? 0
  b.turnChain = Math.max(previousChain, b.chain)
  b.maxChain = Math.max(b.maxChain, b.chain)
  if (b.chain === 3 && previousChain < 3) {
    draw(r, 1)
    log(b, `Связка ×${b.chain}: +1 карта.`)
  }
  if (b.chain === 5 && previousChain < 5) {
    b.energy++
    log(b, `Связка ×${b.chain}: +1 энергия.`)
  }
  const enemies =
    d.target === 'all'
      ? b.enemies.filter((e) => e.hp > 0)
      : d.target === 'enemy'
        ? [b.enemies[targetIndex]]
        : []
  let bonus = (r.relics.includes('whetstone') ? 2 : 0) + boonCount(r, 'edge') * 3
  if (d.damage && d.hero === 'ranger' && !b.rangerUsed) {
    bonus += 3
    b.rangerUsed = true
  }
  for (const e of enemies) {
    if (d.damage) {
      let amount = d.damage + bonus
      if (d.hero === 'rogue' && e.vulnerable > 0) amount += 3
      if (e.vulnerable > 0) amount = Math.floor(amount * 1.5)
      const before = e.hp
      damageEnemy(r, e, amount, d.id === 'pierce')
      log(b, `${d.name} → ${e.name}: ${before - e.hp} урона.`)
    }
    if (d.poison)
      e.poison += d.poison + (r.relics.includes('vial') ? 2 : 0) + boonCount(r, 'venom') * 4
    if (d.vulnerable) e.vulnerable += d.vulnerable
  }
  if (d.block) {
    const targets =
      d.target === 'all' ? r.party.map((_, i) => i) : [d.target === 'ally' ? targetIndex : owner]
    for (const i of targets) if (r.party[i].hp > 0) r.party[i].block += d.block
    log(b, `${d.name}: защита +${d.block}.`)
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
      const damage = Math.min(e.hp, Math.floor(e.poison * (1 + boonCount(r, 'venom') * 0.25)))
      e.hp -= damage
      r.damageDealt += damage
      log(b, `${e.name}: яд наносит ${damage} урона.`)
      e.poison--
    }
  }
  if (finishIfWon(r)) return r
  for (const e of b.enemies) {
    if (e.hp <= 0) continue
    const intent = e.intent
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
        b.damageTaken += Math.min(h.hp, amount - blocked)
        h.hp = Math.max(0, h.hp - (amount - blocked))
        log(
          b,
          `${e.name} → ${HEROES[h.id].name}: ${amount - blocked} урона${blocked ? ` (${blocked} остановила защита)` : ''}.`,
        )
      }
    }
    if (e.vulnerable > 0) e.vulnerable--
  }
  if (r.party.every((h) => h.hp <= 0)) {
    r.phase = 'defeat'
    return r
  }
  b.discard.push(...b.hand)
  b.hand = []
  b.turn++
  prepareTurn(r)
  return r
}
function nextRoute(r: Run) {
  if (r.phase !== 'reward')
    r.score += Math.round(25 * (1 + cycleIndex(r.depth) * 0.4) * (r.mode === 'hard' ? 1.5 : 1))
  r.combat = null
  r.reward = null
  r.chosen = null
  r.cleared = r.depth

  r.phase = r.depth > 0 && r.depth % 15 === 0 ? 'checkpoint' : 'route'
  r.nodes = r.phase === 'route' ? makeRoutes(r) : []
}
export function takeReward(source: Run, uid: string | null): Run {
  if (source.phase !== 'reward') return source
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
export function eventChoice(source: Run, choice: 'a' | 'b'): Run {
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
      won: run.cleared >= 15,
      score: run.score,
      runId: run.runId,
      rules: run.rules,
      cleared: run.cleared,
      player: p.nickname.trim() || 'Странник',
      depth: run.depth,
      party: run.party.map((h) => h.id),
      date: new Date().toISOString(),
    },
    ...profile.history,
  ].slice(0, 20)
  if (run.rules === 4) {
    const prior = profile.records.find(
      (h) => h.runId === run.runId && h.player === (p.nickname.trim() || 'Странник'),
    )
    profile.records = [
      prior && (prior.score ?? 0) > run.score ? prior : profile.history[0],
      ...profile.records.filter(
        (h) => h.runId !== run.runId || h.player !== (p.nickname.trim() || 'Странник'),
      ),
    ]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 100)
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
  r.rules ??= 3
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
  r.nodes = makeRoutes(r)
  return r
}
export function retire(source: Run): Run {
  if (source.phase !== 'checkpoint') return source
  const r = clone(source)
  r.phase = 'victory'
  return r
}
