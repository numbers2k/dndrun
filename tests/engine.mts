import assert from 'node:assert/strict'
import { CARD_MAP, HEROES } from '../src/expedition/data.ts'
import {
  buy,
  continueEndless,
  retire,
  migrateRun,
  upgradeLevel,
  chooseNode,
  combatDescription,
  dailySeed,
  emptyProfile,
  endTurn,
  eventChoice,
  leaveShop,
  newRun,
  persist,
  playCard,
  playable,
  readProfile,
  readRun,
  record,
  recruit,
  rest,
  takeReward,
  targetDamage,
  values,
} from '../src/expedition/engine.ts'
import { simulate } from './bot.mts'
import type { Card, Run } from '../src/expedition/types.ts'
let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`✓ ${name}`)
}
function fight(seed = 'unit') {
  return chooseNode(newRun('warden', seed), 'battle-1')
}
function put(r: Run, id: string, upgraded = false): Card {
  const c = { uid: `test-${id}`, id, upgraded }
  r.combat!.hand = [c]
  r.combat!.energy = 3
  return c
}

test('Seed reproduces complete initial state and daily date', () => {
  assert.deepEqual(newRun('warden', 'same', 'daily'), newRun('warden', 'same', 'daily'))
  assert.notDeepEqual(newRun('warden', 'a'), newRun('warden', 'b'))
  assert.equal(dailySeed(new Date(2026, 9, 8)), 'daily-2026-10-08')
})
test('Route rejects invalid node and duplicate choice', () => {
  const r = newRun('warden', 'route')
  assert.equal(chooseNode(r, 'unknown'), r)
  const b = chooseNode(r, r.nodes[0].id)
  assert.equal(b.depth, 1)
  assert.equal(chooseNode(b, 'battle-1'), b)
})
test('Card costs energy and does not mutate input', () => {
  const r = fight(),
    c = put(r, 'slash'),
    before = structuredClone(r),
    next = playCard(r, c.uid, 0)
  assert.deepEqual(r, before)
  assert.equal(next.combat!.energy, 2)
  assert.equal(next.combat!.enemies[0].hp, 10)
  assert.equal(next.combat!.hand.length, 0)
  assert.equal(next.combat!.discard[0].uid, c.uid)
  assert.equal(next.party[0].block, 6)
})
test('Invalid, dead and unaffordable targets do not spend energy', () => {
  const r = fight(),
    c = put(r, 'slash')
  assert.equal(playCard(r, c.uid, 99), r)
  r.combat!.enemies[0].hp = 0
  assert.equal(playCard(r, c.uid, 0), r)
  r.combat!.energy = 0
  assert.equal(playable(r, c), false)
  assert.equal(playCard(r, c.uid, 1), r)
  assert.equal(playCard(r, 'missing', 1), r)
})
test('Targeted shield protects exactly its ally; block resets', () => {
  const r = fight(),
    c = put(r, 'shield')
  for (const e of r.combat!.enemies) {
    e.intent.target = 1
    e.intent.damage = 6
  }
  const shielded = playCard(r, c.uid, 1),
    next = endTurn(shielded)
  assert.equal(shielded.party[1].block, 15)
  assert.equal(next.party[1].hp, HEROES.ranger.hp)
  assert.equal(next.party[1].block, 0)
})
test('Ranger passive only applies to first damage card each turn', () => {
  const r = fight(),
    c = put(r, 'shot')
  r.combat!.enemies[0].hp = 100
  r.combat!.enemies[0].maxHp = 100
  r.combat!.hand.push({ ...c, uid: 'second' })
  const one = playCard(r, c.uid, 0),
    two = playCard(one, 'second', 0)
  assert.equal(one.combat!.enemies[0].hp, 87)
  assert.equal(two.combat!.enemies[0].hp, 77)
  assert.equal(endTurn(two).combat!.rangerUsed, false)
})
test('Mark plus rogue attack amplifies damage in correct order', () => {
  const r = chooseNode(newRun('ranger', 'combo'), 'battle-1')
  const c = put(r, 'mark')
  const marked = playCard(r, c.uid, 0)
  assert.equal(marked.combat!.energy, 3)
  const a = put(marked, 'dagger')
  const hit = playCard(marked, a.uid, 0)
  assert.equal(hit.combat!.enemies[0].hp, 3)
  assert.equal(endTurn(hit).combat!.enemies[0].vulnerable, 1)
})
test('Poison bypasses block and kills before enemy acts', () => {
  const r = chooseNode(newRun('ranger', 'poison'), 'battle-1')
  const c = put(r, 'toxin')
  r.combat!.enemies[0].hp = 8
  r.combat!.enemies[0].block = 30
  r.combat!.enemies[0].intent.damage = 100
  const second = r.combat!.enemies[1]
  second.intent.damage = 0
  const next = endTurn(playCard(r, c.uid, 0))
  assert.equal(next.combat!.enemies[0].hp, 0)
  assert.deepEqual(
    next.party.map((h) => h.hp),
    r.party.map((h) => h.hp),
  )
  assert.equal(next.combat!.enemies[0].poison, 8)
})
test('Piercing ignores enemy shield, regular attacks consume it', () => {
  const r = fight(),
    c = put(r, 'pierce')
  r.combat!.enemies[0].block = 12
  const hit = playCard(r, c.uid, 0)
  assert.equal(hit.combat!.enemies[0].hp, 3)
  assert.equal(hit.combat!.enemies[0].block, 12)
  const a = put(r, 'slash'),
    normal = playCard(r, a.uid, 0)
  assert.equal(normal.combat!.enemies[0].hp, 19)
  assert.equal(normal.combat!.enemies[0].block, 3)
})
test('Guardian shield persists throughout the player turn', () => {
  const r = newRun('warden', 'guard')
  r.depth = 9
  r.nodes = [{ id: 'boss-10', kind: 'boss', name: 'Дозорный', description: '' }]
  const b = chooseNode(r, 'boss-10')
  assert.equal(b.combat!.enemies[0].block, 12)
  const c = put(b, 'slash'),
    hit = playCard(b, c.uid, 0)
  assert.equal(hit.combat!.enemies[0].hp, 138)
  assert.equal(hit.combat!.enemies[0].block, 3)
})
test('Heal uses priest bonus, caps HP and exhausts', () => {
  const r = fight(),
    c = put(r, 'mend')
  r.party[0].hp = 45
  const n = playCard(r, c.uid, 0)
  assert.equal(n.party[0].hp, 48)
  assert.equal(n.combat!.exhausted[0].uid, c.uid)
  assert.equal(n.combat!.discard.length, 0)
})
test('Area protection affects team, not enemies', () => {
  const r = chooseNode(newRun('mage', 'group'), 'battle-1'),
    c = put(r, 'chorus')
  const n = playCard(r, c.uid, 0)
  assert.ok(n.party.every((h) => h.block === 7))
  assert.ok(n.combat!.enemies.every((e) => e.block === 0))
})
test('Energy and draw cards apply and disappear once', () => {
  const r = chooseNode(newRun('mage', 'energy'), 'battle-1'),
    c = put(r, 'inspire')
  const n = playCard(r, c.uid, 0)
  assert.equal(n.combat!.energy, 4)
  assert.equal(n.combat!.hand.length, 1)
  assert.equal(n.combat!.exhausted.length, 1)
})
test('Upgrade changes only printed numerical effects', () => {
  assert.equal(values({ id: 'slash', uid: 'x', upgraded: true }).damage, 13)
  assert.equal(values({ id: 'mend', uid: 'x', upgraded: true }).heal, 9)
  assert.equal(values({ id: 'toxin', uid: 'x', upgraded: true }).poison, 12)
  assert.equal(values({ id: 'channel', uid: 'x', upgraded: true }).energy, 3)
})
test('Dead heroes cannot play and do not clog future draws', () => {
  const r = fight()
  r.party[0].hp = 0
  const c = put(r, 'slash')
  assert.equal(playable(r, c), false)
  for (const e of r.combat!.enemies) e.intent.damage = 0
  const n = endTurn(r)
  assert.ok(n.combat!.hand.every((c) => CARD_MAP[c.id].hero !== 'warden'))
  assert.ok(n.combat!.hand.length <= 5)
})
test('Relic effects: poison, damage, healing and third card', () => {
  const r = chooseNode(newRun('ranger', 'relic'), 'battle-1')
  r.relics = ['vial', 'whetstone']
  const c = put(r, 'venom'),
    n = playCard(r, c.uid, 0)
  assert.equal(n.combat!.enemies[0].poison, 7)
  assert.equal(n.combat!.enemies[0].hp, 13)
  const f = fight()
  f.relics = ['ember']
  f.combat!.played = 2
  const a = put(f, 'shield'),
    hit = playCard(f, a.uid, 0)
  assert.equal(hit.combat!.enemies[0].hp, 16)
  assert.equal(hit.combat!.enemies[1].hp, 20)
})
test('Battle reward grants coins once and optional card', () => {
  const r = fight(),
    c = put(r, 'slash')
  r.combat!.enemies[0].hp = 1
  r.combat!.enemies[1].hp = 0
  const w = playCard(r, c.uid, 0)
  assert.equal(w.phase, 'reward')
  assert.equal(w.gold, 65)
  assert.equal(playCard(w, c.uid, 0), w)
  const skipped = takeReward(w, null)
  assert.equal(skipped.deck.length, 12)
  assert.equal(skipped.phase, 'route')
  const taken = takeReward(w, w.reward!.cards[0].uid)
  assert.equal(taken.deck.length, 13)
  assert.equal(takeReward(w, 'invalid'), w)
})
test('Recruit replaces owner cards, keeps other upgrades and fills HP', () => {
  const r = fight()
  r.phase = 'reward'
  r.reward = { cards: [], coins: 0, relic: null, recruit: 'mage', nodeKind: 'boss' }
  r.deck[4].upgraded = true
  const n = recruit(r, 0)
  assert.equal(n.party[0].id, 'mage')
  assert.equal(n.party[0].hp, 30)
  assert.ok(n.deck.every((c) => CARD_MAP[c.id].hero !== 'warden'))
  assert.equal(n.deck.filter((c) => CARD_MAP[c.id].hero === 'mage').length, 4)
  assert.equal(n.reward!.recruit, null)
  assert.equal(n.deck.find((c) => c.uid === r.deck[4].uid)?.upgraded, true)
})
test('Camp consumes one action and supports revive and upgrade', () => {
  const r = newRun('warden', 'rest')
  r.phase = 'rest'
  r.depth = 4
  r.party[0].hp = 0
  const revived = rest(r, 'revive')
  assert.equal(revived.party[0].hp, 24)
  assert.equal(revived.phase, 'route')
  assert.equal(rest(revived, 'heal'), revived)
  const up = rest(r, 'upgrade', r.deck[0].uid)
  assert.equal(up.deck[0].upgraded, true)
  assert.equal(rest(r, 'upgrade', 'bad'), r)
})
test('Shop cannot overspend, double-buy or remove below minimum', () => {
  const r = newRun('warden', 'shop')
  r.phase = 'shop'
  r.shopCards = [{ id: 'slash', uid: 'shop', upgraded: false }]
  r.shopRelic = 'flask'
  const b = buy(r, 'card', 'shop')
  assert.equal(b.gold, 5)
  assert.equal(b.deck.length, 13)
  assert.equal(buy(b, 'card', 'shop'), b)
  assert.equal(buy(r, 'relic'), r)
  r.deck = r.deck.slice(0, 6)
  assert.equal(buy(r, 'remove', r.deck[0].uid), r)
  assert.equal(leaveShop(r).phase, 'route')
})
test('Event cannot charge unavailable coins and never kills heroes', () => {
  const r = newRun('warden', 'event')
  r.phase = 'event'
  r.eventId = 1
  r.gold = 0
  assert.equal(eventChoice(r, 'a'), r)
  r.eventId = 0
  r.party[0].hp = 2
  assert.equal(eventChoice(r, 'b').party[0].hp, 1)
})
test('Defeat terminates and victory is reachable by all three parties', () => {
  const r = fight()
  for (const h of r.party) {
    h.hp = 1
    h.block = 0
  }
  r.combat!.enemies[0].intent = {
    kind: 'attack',
    damage: 100,
    target: -1,
    block: 0,
    label: 'Атака',
  }
  assert.equal(endTurn(r).phase, 'defeat')
  for (const leader of ['warden', 'ranger', 'mage'] as const)
    assert.ok(
      Array.from({ length: 10 }, (_, i) => simulate('balance-' + i, leader)).some(
        (r) => r.phase === 'victory',
      ),
    )
})
test('Results are recorded once without stat buffs', () => {
  const r = newRun('warden', 'record')
  r.phase = 'victory'
  r.depth = 15
  r.cleared = 15
  const a = record(r, emptyProfile()),
    b = record(a.run, a.profile)
  assert.equal(a.profile.wins, 1)
  assert.equal(b.profile.wins, 1)
  assert.equal(b.profile.runs, 1)
  assert.equal(b.profile.history.length, 1)
  assert.equal(b.run.deck.length, 12)
})
test('Damage preview matches actual HP loss including vulnerability and armor', () => {
  const r = chooseNode(newRun('ranger', 'preview'), 'battle-1')
  r.relics = ['whetstone']
  r.combat!.enemies[0].block = 5
  r.combat!.enemies[0].vulnerable = 2
  const c = put(r, 'dagger')
  const preview = targetDamage(r, c, 0),
    n = playCard(r, c.uid, 0)
  assert.equal(preview, r.combat!.enemies[0].hp - n.combat!.enemies[0].hp)
  assert.equal(combatDescription(r, c), '10 урона.')
})
test('Boss reward revives fallen heroes and enables replacement', () => {
  const r = newRun('warden', 'boss')
  r.depth = 4
  r.nodes = [{ id: 'boss-5', kind: 'boss', name: 'Мост', description: '' }]
  const b = chooseNode(r, 'boss-5')
  b.party[2].hp = 0
  b.party[0].hp = 30
  b.combat!.enemies[0].hp = 1
  const c = put(b, 'slash'),
    n = playCard(b, c.uid, 0)
  assert.equal(n.party[2].hp, 15)
  assert.equal(n.party[0].hp, 42)
  assert.ok(n.reward!.recruit)
  assert.equal(n.relics.length, 2)
  assert.equal(n.gold, 100)
})
test('Dragon announces team attack and hits each hero only once', () => {
  const r = newRun('warden', 'dragon')
  r.depth = 14
  r.nodes = [{ id: 'boss-15', kind: 'boss', name: 'Дракон', description: '' }]
  let b = chooseNode(r, 'boss-15')
  b = endTurn(b)
  b = endTurn(b)
  assert.equal(b.combat!.turn, 3)
  assert.equal(b.combat!.enemies[0].intent.target, -1)
  assert.equal(b.combat!.enemies[0].intent.damage, 18)
  for (const h of b.party) {
    h.hp = h.maxHp
    h.block = 0
  }
  const n = endTurn(b)
  assert.ok(n.party.every((h, i) => h.hp === b.party[i].hp - 18))
})
test('Final reward ends route and cannot reopen encounters', () => {
  const r = fight()
  r.depth = 15
  r.phase = 'reward'
  r.reward = { cards: [], coins: 60, relic: null, recruit: null, nodeKind: 'boss' }
  const n = takeReward(r, null)
  assert.equal(n.phase, 'checkpoint')
  assert.equal(retire(n).phase, 'victory')
  assert.equal(n.combat, null)
  assert.equal(n.nodes.length, 0)
  assert.equal(chooseNode(n, 'boss-15'), n)
})
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
  configurable: true,
})
test('Save round trip and invalid save fallback preserve old keys', () => {
  storage.set('dndrun-old', 'legacy')
  const r = fight()
  assert.equal(persist(r, emptyProfile()), true)
  assert.deepEqual(readRun(), r)
  assert.deepEqual(readProfile(), emptyProfile())
  storage.set('dndrun-expedition-v3', '{broken')
  assert.equal(readRun(), null)
  storage.set('dndrun-expedition-v3', JSON.stringify({ version: 3, party: [], deck: [] }))
  assert.equal(readRun(), null)
  assert.equal(storage.get('dndrun-old'), 'legacy')
})
test('Endless retains build, applies chosen boon and deterministically regenerates routes', () => {
  const r = newRun('warden', 'infinity')
  r.phase = 'checkpoint'
  r.depth = r.cleared = 15
  r.routeHistory = Array(15).fill('battle')
  r.deck[0].upgraded = true
  r.score = 1234
  r.relics.push('vial')
  r.party[0].hp = 0
  const n = continueEndless(r, 'edge')
  assert.equal(n.phase, 'route')
  assert.equal(n.depth, 15)
  assert.equal(n.score, 1234)
  assert.deepEqual(n.deck, r.deck)
  assert.deepEqual(n.relics, r.relics)
  assert.equal(n.party[0].hp, 36)
  assert.equal(n.gold, r.gold + 40)
  assert.deepEqual(n.boons, ['edge'])
  assert.ok(n.omen)
  assert.deepEqual(n, continueEndless(r, 'edge'))
  assert.equal(continueEndless(r, 'bad'), r)
  assert.equal(continueEndless(n, 'edge'), n)
  const b = chooseNode(n, n.nodes.find((n) => n.kind === 'battle')!.id)
  assert.equal(b.depth, 16)
  assert.ok(b.combat!.enemies[0].maxHp > 24)
  assert.ok(b.combat!.enemies[0].power >= 8)
})
test('Each completed circle offers another continuation without a depth cap', () => {
  const r = newRun('mage', 'deep')
  r.depth = 45
  r.cleared = 45
  r.phase = 'reward'
  r.reward = { cards: [], coins: 0, relic: null, recruit: null, nodeKind: 'boss' }
  const c = takeReward(r, null)
  assert.equal(c.phase, 'checkpoint')
  const n = continueEndless(c, 'flow')
  assert.equal(n.nodes.length >= 2, true)
  assert.equal(chooseNode(n, n.nodes[0].id).depth, 46)
})
test('Chain rewards happen once per turn, same owner resets chain', () => {
  const r = fight()
  r.combat!.enemies.forEach((e) => {
    e.hp = e.maxHp = 1000
  })
  r.combat!.energy = 20
  const ids = ['slash', 'shot', 'smite', 'slash', 'shot', 'slash', 'slash', 'shot', 'smite']
  r.combat!.hand = ids.map((id, i) => ({ id, uid: String(i), upgraded: false }))
  const initialDraw = r.combat!.draw.length
  let n = r
  for (let i = 0; i < 5; i++) n = playCard(n, String(i), 0)
  assert.equal(n.combat!.chain, 5)
  assert.equal(n.combat!.energy, 16)
  assert.equal(n.combat!.draw.length, initialDraw - 1)
  for (let i = 5; i < 9; i++) n = playCard(n, String(i), 0)
  assert.equal(n.combat!.chain, 3)
  assert.equal(n.combat!.draw.length, initialDraw - 1)
  assert.equal(n.combat!.maxChain, 6)
  const next = endTurn(n)
  assert.equal(next.combat!.chain, 0)
  assert.equal(next.combat!.turnChain, 0)
  assert.equal(next.combat!.maxChain, 6)
})
test('Score rewards encounters and bonuses once, not repeated damage', () => {
  const r = fight()
  r.combat!.enemies[0].hp = 1
  r.combat!.enemies[1].hp = 0
  const c = put(r, 'slash'),
    n = playCard(r, c.uid, 0)
  assert.equal(n.score, 345)
  assert.deepEqual(n.lastScore, { base: 100, speed: 125, flawless: 100, combo: 20, total: 345 })
  assert.equal(playCard(n, c.uid, 0).score, 345)
  assert.equal(takeReward(n, null).score, 345)
})
test('Upgrades continue strengthening already upgraded cards', () => {
  const r = newRun('warden', 'up')
  r.phase = 'rest'
  r.depth = 4
  r.deck[0].upgraded = true
  const n = rest(r, 'upgrade', r.deck[0].uid)
  assert.equal(upgradeLevel(n.deck[0]), 2)
  assert.equal(values(n.deck[0]).damage, 17)
})
test('Boons change visible and actual attacks, poison and start resources', () => {
  const r = fight()
  r.boons = ['edge', 'edge']
  const c = put(r, 'slash')
  assert.equal(combatDescription(r, c), '15 урона.')
  assert.equal(targetDamage(r, c, 0), 15)
  assert.equal(playCard(r, c.uid, 0).combat!.enemies[0].hp, 4)
  const p = chooseNode(newRun('ranger', 'venom'), 'battle-1')
  p.boons = ['venom']
  const v = put(p, 'venom')
  assert.equal(playCard(p, v.uid, 0).combat!.enemies[0].poison, 9)
})
test('Retiring records score once, checkpoints remain unrecorded', () => {
  const r = newRun('warden', 'rank')
  r.phase = 'checkpoint'
  r.depth = r.cleared = 15
  r.score = 500
  const p = emptyProfile()
  p.nickname = 'Мира'
  assert.equal(record(r, p).profile.records.length, 0)
  const a = record(retire(r), p)
  assert.equal(a.profile.records[0].score, 500)
  assert.equal(a.profile.records[0].player, 'Мира')
  assert.equal(record(a.run, a.profile).profile.records.length, 1)
  assert.equal(migrateRun(a.run).phase, 'victory')
})
test('Daily board keeps each player and their best attempt', () => {
  const r = newRun('warden', 'daily-test', 'daily')
  r.phase = 'defeat'
  r.score = 400
  let p = emptyProfile()
  p.nickname = 'А'
  p = record(r, p).profile
  p.nickname = 'Б'
  p = record(r, p).profile
  assert.equal(p.records.length, 2)
  p.nickname = 'А'
  r.score = 200
  p = record(r, p).profile
  assert.equal(p.records.length, 2)
  assert.equal(p.records.find((h) => h.player === 'А')!.score, 400)
})
test('Old saves migrate with no fake ranked score and retired v4 run stays retired', () => {
  const old = structuredClone(newRun('warden', 'old')) as unknown as Record<string, unknown>
  for (const k of ['rules', 'score', 'lastScore', 'cleared', 'boons', 'omen', 'runId'])
    delete old[k]
  const n = migrateRun(old as unknown as Run)
  assert.equal(n.rules, 3)
  assert.equal(n.score, 0)
  const r = newRun('warden', 'retired')
  r.phase = 'victory'
  r.depth = r.cleared = 15
  r.recorded = true
  assert.equal(migrateRun(r).phase, 'victory')
})

test('Endless combat, checkpoint and recorded victory survive reload exactly', () => {
  const r = simulate('balance-1', 'warden')
  assert.equal(r.phase, 'victory')
  r.phase = 'checkpoint'
  r.recorded = false
  const route = continueEndless(r, 'edge')
  const combat = chooseNode(route, route.nodes.find((n) => n.kind === 'battle')!.id)
  for (const state of [r, route, combat]) {
    assert.equal(persist(state, emptyProfile()), true)
    assert.deepEqual(readRun(), state)
  }
  const result = record(retire(r), emptyProfile())
  persist(result.run, result.profile)
  assert.deepEqual(readRun(), result.run)
  assert.deepEqual(readProfile(), result.profile)
  assert.equal(record(readRun()!, readProfile()).profile.records.length, 1)
})
test('Invalid upgraded cards, scores and chain state cannot enter saved runs', () => {
  const r = fight()
  const invalids = [
    (n: Run) => {
      n.deck[0].level = -1
    },
    (n: Run) => {
      n.deck[0].level = 21
    },
    (n: Run) => {
      n.lastScore.total = -1
    },
    (n: Run) => {
      n.combat!.maxChain = -1
    },
    (n: Run) => {
      n.cleared = n.depth + 1
    },
  ]
  for (const change of invalids) {
    const n = structuredClone(r)
    change(n)
    persist(n, emptyProfile())
    assert.equal(readRun(), null)
  }
})
test('Invalid local records are discarded while valid records remain', () => {
  const r = simulate('balance-1', 'warden')
  const p = record(r, emptyProfile()).profile
  const valid = p.records[0]
  p.records.push({ ...valid, date: 'broken' }, { ...valid, cleared: -1 }, { ...valid, score: -1 })
  persist(r, p)
  assert.deepEqual(readProfile().records, [valid])
})
test('Unavailable storage reports failure without crashing', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    get() {
      throw Error('denied')
    },
    configurable: true,
  })
  assert.equal(persist(null, emptyProfile()), false)
  assert.equal(readRun(), null)
  assert.deepEqual(readProfile(), emptyProfile())
})

console.log(`${passed} engine tests passed.`)
