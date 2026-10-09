import assert from 'node:assert/strict'
import {
  newRun,
  chooseNode,
  playCard,
  endTurn,
  eventChoice,
  leaveEvent,
  targetDamage,
  persist,
  readRun,
  emptyProfile,
} from '../src/expedition/engine.ts'
import { actionFeedback, nextExperiment } from '../src/expedition/experience.ts'
import type { Run } from '../src/expedition/types.ts'
let count = 0
const data = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  },
  configurable: true,
})
function test(name: string, fn: () => void) {
  fn()
  count++
  console.log('✓ ' + name)
}
function fight(encounter: string): Run {
  const r = newRun('mage', 'encounter', 'normal', ['mage', 'ranger', 'warden'])
  r.depth = 6
  r.cleared = 6
  r.routeHistory = Array(6).fill('battle')
  r.nodes = [{ id: 'fixture', kind: 'battle', name: 'Fixture', description: '', encounter }]
  return chooseNode(r, 'fixture')
}
function put(r: Run, id: string, uid = id) {
  r.combat!.hand.push({ id, uid, upgraded: false })
  r.combat!.energy = 20
  return uid
}
test('Repeated area damage triggers visible veil and all-target previews match actual wounds', () => {
  let r = fight('ruins-veil')
  r.combat!.enemies.forEach((e) => {
    e.hp = 100
    e.maxHp = 100
    e.block = 0
  })
  r.combat!.hand = []
  r = playCard(r, put(r, 'nova', 'one'), 0)
  assert.equal(r.combat!.areaAttacks, 1)
  const c = { id: 'volley', uid: 'two', upgraded: false }
  r.combat!.hand = [c]
  const expected = r.combat!.enemies.map((_, i) => targetDamage(r, c, i))
  const next = playCard(r, c.uid, 0)
  assert.deepEqual(
    next.combat!.enemies.map((e, i) => r.combat!.enemies[i].hp - e.hp),
    expected,
  )
  assert.ok(next.combat!.log.some((x) => x.includes('Завеса')))
  assert.equal(endTurn(next).combat!.areaAttacks, 0)
})
test('Single hits, poison-only area cards and killing the weaver answer the rule', () => {
  let r = fight('ruins-veil')
  r.combat!.enemies.forEach((e) => {
    e.hp = 100
    e.block = 0
  })
  r.combat!.hand = []
  r = playCard(r, put(r, 'shot'), 0)
  assert.equal(r.combat!.areaAttacks, 0)
  r.party[0].id = 'alchemist'
  r = playCard(r, put(r, 'flaskburst'), 0)
  assert.equal(r.combat!.areaAttacks, 0)
  r.party[0].id = 'mage'
  r.combat!.areaAttacks = 1
  r.combat!.enemies[0].hp = 1
  r = playCard(r, put(r, 'shot', 'finish'), 0)
  r = playCard(r, put(r, 'nova'), 0)
  assert.ok(!r.combat!.log.some((x) => x.includes('Завеса')))
})
test('Armorer transfers only remaining armor once per turn after direct card; poison does not trigger transfer', () => {
  let r = fight('forest-forge')
  r.combat!.hand = []
  r.combat!.enemies.forEach((e) => {
    e.hp = 100
    e.maxHp = 100
  })
  const target = r.combat!.enemies[1].block
  assert.equal(r.combat!.enemies[0].block, 9)
  r = playCard(r, put(r, 'bash'), 0)
  assert.equal(r.combat!.enemies[0].block, 0)
  assert.equal(r.combat!.enemies[1].block, target + 3)
  assert.ok(r.combat!.enemies[0].armorMoved)
  r = playCard(r, put(r, 'bash', 'again'), 0)
  assert.equal(r.combat!.enemies[1].block, target + 3)
  const poison = fight('forest-forge')
  poison.combat!.enemies[0].poison = 1
  const next = endTurn(poison)
  assert.equal(next.combat!.enemies[0].armorMoved, false)
  assert.equal(next.combat!.enemies[0].block, 9)
})
test('Mass attack resolves before armor transfer; preview agrees for every affected target', () => {
  const r = fight('forest-forge')
  r.combat!.hand = []
  r.combat!.enemies.forEach((e) => {
    e.hp = 100
    e.maxHp = 100
  })
  const uid = put(r, 'volley'),
    c = r.combat!.hand[0]
  const expected = r.combat!.enemies.map((_, i) => targetDamage(r, c, i))
  const n = playCard(r, uid, 0)
  assert.deepEqual(
    n.combat!.enemies.map((e, i) => r.combat!.enemies[i].hp - e.hp),
    expected,
  )
})
test('Forbidden manuscript upgrades selected card and persistent ash returns next combat', () => {
  const r = newRun('warden', 'manuscript')
  r.phase = 'event'
  r.eventId = 10
  assert.equal(eventChoice(r, 'a', 'missing'), r)
  const n = eventChoice(r, 'a', r.deck[2].uid)
  assert.ok(n.deck[2].upgraded)
  assert.equal(n.deck.filter((c) => c.id === 'ash').length, 1)
  const battle = chooseNode(n, n.nodes[0].id)
  assert.equal(
    [...battle.combat!.hand, ...battle.combat!.draw].filter((c) => c.id === 'ash').length,
    1,
  )
  assert.equal(
    r.deck.some((c) => c.id === 'ash'),
    false,
  )
})
test('Preparation costs once, lasts two fights, saves/reloads, and can be declined without payment', () => {
  const event = newRun('warden', 'pact')
  event.phase = 'event'
  event.eventId = 11
  const declined = leaveEvent(event)
  assert.equal(declined.gold, 40)
  assert.equal(declined.pact, undefined)
  for (const choice of ['a', 'b'] as const) {
    let r = eventChoice(event, choice)
    assert.equal(r.gold, 20)
    assert.equal(r.pact!.remaining, 2)
    persist(r, emptyProfile())
    assert.deepEqual(readRun(), r)
    r = chooseNode(r, r.nodes[0].id)
    assert.equal(r.pact!.remaining, 1)
    if (choice === 'a') assert.ok(r.party.every((h) => h.block === 10))
    else assert.equal(r.combat!.reserve, 6)
    r.phase = 'route'
    r.nodes = [
      { id: 'next', kind: 'battle', name: 'next', description: '', encounter: 'forest-patrol' },
    ]
    r = chooseNode(r, 'next')
    assert.equal(r.pact, null)
  }
  event.gold = 19
  assert.equal(eventChoice(event, 'a'), event)
  assert.equal(eventChoice(event, 'b'), event)
})
test('Duelist gains a preparation card; previous save rules keep old parry behavior', () => {
  const r = chooseNode(newRun('duelist', 'parry'), 'battle-1')
  r.combat!.hand = [{ id: 'parry', uid: 'parry', upgraded: false }]
  const n = playCard(r, 'parry', 0)
  assert.equal(n.combat!.hand.length, 1)
  r.rules = 5
  assert.equal(playCard(r, 'parry', 0).combat!.hand.length, 0)
})
test('Action feedback reports observed damage, transfer source and healing without mutating runs', () => {
  const r = chooseNode(newRun('warden', 'feedback'), 'battle-1')
  r.combat!.hand = []
  r.combat!.guardRelay = { hero: 'ranger', bonus: 4 }
  const uid = put(r, 'slash')
  const copy = structuredClone(r)
  const n = playCard(r, uid, 0),
    f = actionFeedback(r, n)!
  assert.equal(f.damage, r.combat!.enemies[0].hp - n.combat!.enemies[0].hp)
  assert.ok(f.detail.includes('подготовка +4'))
  assert.deepEqual(r, copy)
  assert.equal(actionFeedback(r, endTurn(r)), null)
  assert.ok(nextExperiment(r, emptyProfile()).length > 20)
})
test('Boss completion healing is not attributed to a final attack', () => {
  const r = newRun('warden', 'boss-feedback')
  r.depth = r.cleared = 4
  r.nodes = [{ id: 'boss', kind: 'boss', bossId: 'bridge', name: 'Boss', description: '' }]
  let fightRun = chooseNode(r, 'boss')
  fightRun.party.forEach((h) => (h.hp = h.maxHp - 20))
  fightRun.combat!.enemies.forEach((e) => {
    e.hp = 1
    e.block = 0
  })
  fightRun.combat!.hand = [{ id: 'slash', uid: 'final-hit', upgraded: false }]
  const result = playCard(fightRun, 'final-hit', 0)
  const feedback = actionFeedback(fightRun, result)!
  assert.equal(result.phase, 'reward')
  assert.equal(feedback.heal, 0)
  assert.ok(!feedback.detail.includes('здоровья'))
})
test('Ally-heal feedback uses the selected target and respects missing health', () => {
  const r = chooseNode(newRun('priest', 'heal-feedback'), 'battle-1')
  r.party[0].hp = r.party[0].maxHp - 20
  r.party[1].hp = r.party[1].maxHp - 3
  r.combat!.hand = [{ id: 'mend', uid: 'heal-target', upgraded: false }]
  const result = playCard(r, 'heal-target', 1)
  assert.equal(actionFeedback(r, result, 1)?.heal, 3)
  assert.equal(actionFeedback(r, result)?.heal, 0)
})
console.log(`${count} iteration tests passed.`)
