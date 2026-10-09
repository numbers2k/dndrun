import assert from 'node:assert/strict'
import { BOSSES, ENCOUNTERS, ENEMY_MAP } from '../src/expedition/encounters.ts'
import { CARDS, HEROES, EVENTS } from '../src/expedition/data.ts'
import {
  newRun,
  chooseNode,
  playCard,
  endTurn,
  targetDamage,
  makeRoutes,
  retainCard,
  recruitVisitor,
  eventChoice,
  readRun,
  readProfile,
  persist,
  emptyProfile,
  record,
  cardCost,
  upcomingBoss,
  takeRelic,
  takeReward,
  combatDescription,
} from '../src/expedition/engine.ts'
import { challengeUrl, readChallenge, runRecap } from '../src/expedition/challenges.ts'
import type { Run } from '../src/expedition/types.ts'
let count = 0
function test(name: string, fn: () => void) {
  fn()
  count++
  console.log('✓ ' + name)
}
function battle(encounter = 'forest-ritual', leader: Parameters<typeof newRun>[0] = 'warden') {
  const r = newRun(leader, 'variety')
  r.depth = 1
  r.routeHistory = ['battle']
  r.nodes = [{ id: 'test', kind: 'battle', name: 'Проверка', description: '', encounter }]
  return chooseNode(r, 'test')
}
function boss(id: string) {
  const r = newRun('warden', 'boss-rule')
  r.depth = 4
  r.routeHistory = Array(4).fill('battle')
  r.nodes = [{ id: 'test', kind: 'boss', name: 'Босс', description: '', bossId: id }]
  return chooseNode(r, 'test')
}
function cards(r: Run, ids: string[]) {
  r.combat!.energy = 20
  r.combat!.hand = ids.map((id, i) => ({ id, uid: 'c' + i, upgraded: false }))
  return r.combat!.hand
}
test('Every encounter is regional, uses unique known roles, and offers enough non-repeating groups', () => {
  for (const e of ENCOUNTERS) {
    assert.equal(new Set(e.foes).size, e.foes.length)
    assert.ok(e.foes.every((id) => ENEMY_MAP[id]))
  }
  for (let a = 0; a < 3; a++) assert.ok(ENCOUNTERS.filter((e) => e.area === a).length >= 6)
  const r = newRun('warden', 'routes')
  r.depth = 2
  r.encounterHistory = ENCOUNTERS.filter((e) => e.area === 0)
    .slice(0, 3)
    .map((e) => e.id)
  for (let i = 0; i < 100; i++) {
    const nodes = makeRoutes(r)
    assert.ok(
      nodes.filter((n) => n.encounter).every((n) => !r.encounterHistory!.includes(n.encounter!)),
    )
  }
})
test('All seven bosses are scheduled, previewed and resolve to their announced rule', () => {
  for (const def of BOSSES) {
    const b = boss(def.id)
    assert.equal(b.combat!.rule, def.rule)
    assert.equal(b.combat!.enemies[0].name, def.name)
  }
  const seen = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const r = newRun('warden', 'schedule-' + i)
    r.depth = 4
    r.nodes = makeRoutes(r)
    assert.equal(r.nodes[0].bossId, upcomingBoss(r).id)
    r.bossSchedule!.forEach((id) => seen.add(id))
  }
  assert.ok(seen.size >= 6)
})
test('Ritual can be interrupted by actual health damage, not blocked damage', () => {
  let r = battle()
  const c = cards(r, ['slash', 'smite'])
  r.combat!.enemies[0].block = 20
  r = playCard(r, c[0].uid, 0)
  assert.equal(r.combat!.enemies[0].intent.kind, 'ritual')
  r.combat!.enemies[0].block = 0
  r.combat!.enemies[0].hp = r.combat!.enemies[0].maxHp = 100
  r = playCard(r, c[1].uid, 0)
  assert.equal(r.combat!.enemies[0].intent.damage, 5)
  r.combat!.hand = [{ id: 'slash', uid: 'next', upgraded: false }]
  r = playCard(r, 'next', 0)
  assert.equal(r.combat!.enemies[0].intent.damage, 0)
  assert.equal(r.combat!.enemies[0].intent.label, 'Ритуал прерван')
})
test('Shieldbearer protects others and herald buffs only surviving allies', () => {
  const shield = battle('forest-shield')
  assert.equal(shield.combat!.enemies[0].block, 0)
  assert.equal(shield.combat!.enemies[1].block, 6)
  let r = battle('forest-banner')
  r = endTurn(r)
  assert.equal(r.combat!.enemies[0].intent.kind, 'support')
  const power = r.combat!.enemies[1].power
  r = endTurn(r)
  assert.equal(r.combat!.enemies[1].power, power + 2)
})
test('Scavenger reacts once per death and poison deaths trigger the reaction', () => {
  const r = battle('forest-pack')
  r.combat!.enemies[0].poison = 100
  r.combat!.enemies[1].hp = 10
  const power = r.combat!.enemies[1].power
  const n = endTurn(r)
  assert.equal(n.combat!.enemies[1].power, power + 3)
  assert.equal(n.combat!.enemies[1].hp, 14)
  assert.equal(endTurn(n).combat!.enemies[1].power, power + 3)
})
test('Curse cards cannot be played, disappear after one draw, and can be cleansed', () => {
  let r = battle('ruins-watch', 'alchemist')
  r = endTurn(r)
  r = endTurn(r)
  assert.ok(
    [...r.combat!.hand, ...r.combat!.draw, ...r.combat!.discard].some((c) => c.id === 'ash'),
  )
  r.combat!.hand = [
    { id: 'ash', uid: 'ash1', upgraded: false },
    { id: 'antidote', uid: 'clean', upgraded: false },
  ]
  r.combat!.draw = [{ id: 'ash', uid: 'ash2', upgraded: false }]
  assert.equal(playCard(r, 'ash1', 0), r)
  r = playCard(r, 'clean', 0)
  assert.ok(
    [...r.combat!.hand, ...r.combat!.draw, ...r.combat!.discard].every((c) => c.id !== 'ash'),
  )
  r.combat!.hand = [{ id: 'ash', uid: 'ash3', upgraded: false }]
  r = endTurn(r)
  assert.ok(r.combat!.exhausted.some((c) => c.uid === 'ash3'))
})
test('Echo armor and seal break match visible damage previews', () => {
  let r = boss('bridge')
  let c = cards(r, ['slash', 'slash'])
  r = playCard(r, c[0].uid, 0)
  const preview = targetDamage(r, c[1], 0),
    hp = r.combat!.enemies[0].hp
  r = playCard(r, c[1].uid, 0)
  assert.equal(hp - r.combat!.enemies[0].hp, preview)
  assert.equal(preview, 2)
  r = boss('guardian')
  c = cards(r, ['mark', 'slash'])
  r = playCard(r, c[0].uid, 0)
  const damage = targetDamage(r, c[1], 0),
    before = r.combat!.enemies[0].hp
  r = playCard(r, c[1].uid, 0)
  assert.equal(r.combat!.enemies[0].block, 0)
  assert.equal(before - r.combat!.enemies[0].hp, damage)
})
test('Summoning is capped, adds no immediate attack, and awards no farming score', () => {
  let r = boss('cantor')
  r = endTurn(r)
  const hp = r.party.map((h) => h.hp)
  r = endTurn(r)
  assert.equal(r.combat!.enemies.length, 2)
  assert.deepEqual(
    r.party.map((h) => h.hp),
    hp,
  )
  assert.equal(r.score, 0)
  for (let i = 0; i < 4; i++) {
    r.party.forEach((h) => {
      h.hp = h.maxHp
      h.block = 100
    })
    r = endTurn(r)
  }
  assert.ok(r.combat!.enemies.filter((e) => e.hp > 0).length <= 3)
})
test('Hunt announces the marked target a full turn before attacking', () => {
  let r = boss('hunter')
  const e = r.combat!.enemies[0],
    target = e.intent.target
  assert.equal(e.intent.damage, 0)
  assert.equal(r.combat!.marked, target)
  r = endTurn(r)
  assert.equal(r.combat!.enemies[0].intent.target, target)
  assert.ok(r.combat!.enemies[0].intent.damage > 0)
})
test('Duelist block and alchemist poison change actual and previewed damage', () => {
  let r = battle('forest-patrol', 'duelist')
  r.party[0].block = 20
  const c = cards(r, ['riposte'])[0]
  const damage = targetDamage(r, c, 0),
    hp = r.combat!.enemies[0].hp
  r = playCard(r, c.uid, 0)
  assert.equal(hp - r.combat!.enemies[0].hp, damage)
  assert.equal(damage, 19)
  r = battle('forest-patrol', 'alchemist')
  const a = cards(r, ['acid', 'catalyst'])
  r = playCard(r, a[0].uid, 0)
  assert.equal(r.combat!.enemies[0].poison, 6)
  assert.equal(targetDamage(r, a[1], 0), 9)
})
test('Oracle passive draws only once per turn and healing relic discount only once per battle', () => {
  let r = battle('forest-patrol', 'duelist')
  const c = cards(r, ['omen', 'omen'])
  const draw = r.combat!.draw.length
  r = playCard(r, c[0].uid, 0)
  assert.equal(r.combat!.draw.length, draw - 1)
  r = playCard(r, c[1].uid, 1)
  assert.equal(r.combat!.draw.length, draw - 1)
  r = battle()
  r.relics = ['mercy']
  const heal = cards(r, ['mend', 'mend'])
  assert.equal(cardCost(r, heal[0]), 0)
  r = playCard(r, heal[0].uid, 0)
  assert.equal(cardCost(r, heal[1]), 1)
})
test('Memory retains exactly one chosen card and consumes it normally when played', () => {
  let r = battle()
  r.relics = ['memory']
  const c = cards(r, ['slash', 'shot', 'smite', 'shield'])
  r.combat!.enemies.forEach((e) => (e.hp = e.maxHp = 200))
  for (let i = 0; i < 3; i++) r = playCard(r, c[i].uid, 0)
  assert.ok(r.combat!.retainReady)
  r = retainCard(r, c[3].uid)
  r = endTurn(r)
  assert.ok(r.combat!.hand.some((x) => x.uid === c[3].uid))
  assert.equal(r.combat!.retained, null)
})
test('Leftover block converts into one attack, heavy seal changes draw and damage', () => {
  let r = battle()
  r.relics = ['anvil']
  r.party.forEach((h) => (h.block = 20))
  r = endTurn(r)
  assert.equal(r.combat!.reserve, 10)
  const c = cards(r, ['slash', 'slash'])
  const preview = targetDamage(r, c[0], 0)
  r = playCard(r, c[0].uid, 0)
  assert.equal(preview, 19)
  assert.equal(r.combat!.reserve, 0)
  const a = newRun('mage', 'heavy')
  a.relics = ['heavy']
  const n = chooseNode(a, 'battle-1')
  assert.equal(n.combat!.hand.length, 4)
  const meteor = cards(n, ['meteor'])[0]
  n.combat!.enemies[0].hp = n.combat!.enemies[0].maxHp = 100
  assert.equal(targetDamage(n, meteor, 0), 42)
})
test('Volatile poison has a cost and death splash bypasses armor', () => {
  let r = battle()
  r.relics = ['volatile']
  r.combat!.enemies[0].hp = 1
  r.combat!.enemies[0].poison = 12
  r.combat!.enemies[1].hp = r.combat!.enemies[1].maxHp = 100
  r.combat!.enemies[1].block = 100
  r = endTurn(r)
  assert.equal(r.combat!.enemies[1].hp, 88)
})
test('Visitors replace the chosen hero, events respect cost and player-selected cards', () => {
  let r = newRun('warden', 'visitor')
  r.phase = 'event'
  r.eventId = 4
  r.visitor = 'oracle'
  const old = r.party[1].id
  r = recruitVisitor(r, 1)
  assert.equal(r.party[1].id, 'oracle')
  assert.equal(r.deck.filter((c) => HEROES[old].cards.includes(c.id)).length, 0)
  for (let event = 0; event < EVENTS.length; event++) {
    const n = newRun('warden', 'events')
    n.phase = 'event'
    n.eventId = event
    n.gold = 0
    assert.equal(eventChoice(n, 'b').phase, event === 11 ? 'event' : 'route')
  }
  const n = newRun('warden', 'smith')
  n.phase = 'event'
  n.eventId = 3
  const uid = n.deck[3].uid
  const upgraded = eventChoice(n, 'a', uid)
  assert.equal(upgraded.deck[3].level, 1)
  assert.equal(upgraded.deck[0].level, undefined)
})
test('Regional events avoid the previous four and deterministic boss previews do not consume randomness', () => {
  const r = newRun('warden', 'event-repeat')
  r.depth = 2
  r.eventHistory = [0, 1, 2, 3]
  r.nodes = [{ id: 'event', kind: 'event', name: 'Встреча', description: '' }]
  const before = structuredClone(r)
  upcomingBoss(r)
  assert.deepEqual(r, before)
  assert.ok(!r.eventHistory.includes(chooseNode(r, 'event').eventId))
})
test('Nine heroes have distinct valid starting cards; junk never enters normal rewards', () => {
  assert.equal(Object.keys(HEROES).length, 9)
  assert.equal(CARDS.filter((c) => !c.junk).length, 54)
  for (const h of Object.values(HEROES))
    assert.ok(h.cards.every((id) => CARDS.some((c) => c.id === id && c.hero === h.id && !c.junk)))
})
test('New statuses and boss schedules survive reload, old leaderboard scores remain separate', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
    configurable: true,
  })
  const r = boss('guardian')
  r.relics.push('memory')
  const c = cards(r, ['mark'])
  const n = playCard(r, c[0].uid, 0)
  persist(n, emptyProfile())
  assert.deepEqual(readRun(), n)
  const old = newRun('warden', 'same')
  old.phase = 'defeat'
  old.rules = 4
  const profile = record(old, emptyProfile()).profile
  const modern = structuredClone(old)
  modern.rules = 5
  const p = record(modern, profile).profile
  persist(null, p)
  assert.equal(readProfile().records.length, 2)
})
test('Leech heals from wounds only and never more than six', () => {
  const r = battle('forest-leech')
  const e = r.combat!.enemies.find((e) => e.id === 'leech')!
  assert.ok(e)
  e.hp = 1
  e.intent = { kind: 'attack', damage: 20, target: 0, block: 0, label: 'Укус' }
  for (const other of r.combat!.enemies) if (other !== e) other.hp = 0
  r.party[0].block = 50
  assert.equal(endTurn(r).combat!.enemies.find((x) => x.uid === e.uid)!.hp, 1)
  r.party[0].block = 0
  assert.equal(endTurn(r).combat!.enemies.find((x) => x.uid === e.uid)!.hp, 7)
})
test('Relay rewards a fifth alternating card once, and contextual riposte text includes its bonus once', () => {
  let r = battle('forest-ritual', 'duelist')
  r.relics.push('relay')
  const c = cards(r, ['parry', 'foresight', 'mend', 'stance', 'vision'])
  for (const x of c) r = playCard(r, x.uid, 0)
  assert.equal(r.combat!.chain, 5)
  assert.ok(r.party.every((h) => h.block >= 5))
  const riposte = { id: 'riposte', uid: 'riposte-test', upgraded: false }
  assert.ok(!combatDescription(r, riposte).includes('Плюс половина'))
})
test('Invalid event selections never charge or select a different card', () => {
  for (const eventId of [3, 6, 9]) {
    const r = newRun('warden', 'bad-event')
    r.phase = 'event'
    r.eventId = eventId
    r.shopCards = [r.deck[0]]
    assert.equal(eventChoice(r, 'a', 'unknown-card'), r)
  }
})
test('Relic draft requires a valid choice once, preserves source and survives saving', () => {
  let r = boss('bridge')
  r.combat!.enemies[0].hp = 1
  const c = cards(r, ['slash'])
  r = playCard(r, c[0].uid, 0)
  assert.equal(r.phase, 'reward')
  assert.equal(r.reward!.relicChoices!.length, 3)
  assert.equal(takeReward(r, null), r)
  assert.equal(takeRelic(r, 'unknown'), r)
  const id = r.reward!.relicChoices![1],
    before = structuredClone(r)
  const chosen = takeRelic(r, id)
  assert.deepEqual(r, before)
  assert.equal(chosen.relics.filter((x) => x === id).length, 1)
  assert.equal(takeRelic(chosen, id), chosen)
  persist(r, emptyProfile())
  assert.deepEqual(readRun(), r)
  assert.equal(takeReward(chosen, null).phase, 'route')
})
test('Trials are opt-in, announce added power, and pay once for an actual win', () => {
  for (const id of ['swift', 'chain', 'flawless'] as const) {
    const source = newRun('warden', 'trial-test')
    source.depth = 1
    source.routeHistory = ['battle']
    source.nodes = [
      {
        id: 'trial',
        kind: 'battle',
        encounter: 'forest-ritual',
        name: 'Испытание',
        description: '',
        trial: id,
      },
    ]
    const normal = chooseNode(source, 'trial'),
      trial = chooseNode(source, 'trial', true)
    assert.equal(normal.combat!.trial, null)
    assert.equal(trial.combat!.enemies[0].power, normal.combat!.enemies[0].power + 2)
    for (const r of [normal, trial]) {
      r.combat!.enemies[0].hp = 1
      r.combat!.enemies[0].block = 0
      r.combat!.enemies[1].hp = 0
      r.combat!.maxChain = 4
      cards(r, ['slash'])
    }
    const won = playCard(trial, 'c0', 0),
      usual = playCard(normal, 'c0', 0)
    assert.equal(won.gold - usual.gold, 15)
    assert.equal(won.score - usual.score, 80)
    assert.equal(won.reward!.trial!.success, true)
    assert.equal(won.feats!.trials, 1)
    assert.equal(playCard(won, 'c0', 0), won)
    trial.combat!.turn = 4
    trial.combat!.maxChain = 0
    trial.combat!.damageTaken = 1
    const failed = playCard(trial, 'c0', 0)
    assert.equal(failed.reward!.trial!.success, false)
    assert.equal(failed.reward!.coins, 25)
  }
})
test('Challenge links reproduce the original party even after recruitment, and reject invalid payloads', () => {
  const r = newRun('alchemist', 'trail-same', 'hard')
  r.party[0].id = 'mage'
  const link = challengeUrl(r, 'https://example.test/dndrun/?old=1#anchor')!
  const challenge = readChallenge(new URL(link).search)!
  assert.equal(challenge.leader, 'alchemist')
  assert.deepEqual(
    newRun(challenge.leader, challenge.seed, challenge.mode),
    newRun('alchemist', 'trail-same', 'hard'),
  )
  for (const query of [
    '?rules=4&seed=x&party=warden&mode=normal',
    '?rules=5&seed=x&party=rogue&mode=normal',
    '?rules=5&seed=%3Cscript%3E&party=warden&mode=normal',
    '?rules=5&seed=x&party=mage&mode=daily',
  ])
    assert.equal(readChallenge(query), null)
  r.rules = 4
  assert.equal(challengeUrl(r, 'https://example.test/'), null)
  assert.ok(runRecap(r, 'https://example.test/').includes(r.seed))
})
test('Malformed new saves reject invalid encounters, mismatched boss rules and unknown draft relics', () => {
  const corrupt = (r: Run) => {
    persist(r, emptyProfile())
    assert.equal(readRun(), null)
  }
  const route = newRun('warden', 'corrupt')
  route.nodes[0].encounter = 'unknown'
  corrupt(route)
  const b = boss('guardian')
  b.combat!.rule = 'hunt'
  corrupt(b)
  const draft = newRun('warden', 'corrupt-draft')
  draft.phase = 'reward'
  draft.reward = {
    cards: [],
    coins: 25,
    relic: null,
    recruit: null,
    nodeKind: 'elite',
    relicChoices: ['unknown'],
  }
  corrupt(draft)
})
console.log(`${count} variety tests passed.`)
