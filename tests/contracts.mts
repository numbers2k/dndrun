import assert from 'node:assert/strict'
import { HEROES, CARD_MAP } from '../src/expedition/data.ts'
import {
  newRun,
  emptyProfile,
  record,
  migrateRun,
  persist,
  readProfile,
  readRun,
  chooseNode,
  endTurn,
  playCard,
  recruit,
  recruitVisitor,
  eventChoice,
} from '../src/expedition/engine.ts'
import { contractUnlocked, DEFAULT_PARTY, partyIdentity } from '../src/expedition/contracts.ts'
import { challengeUrl, readChallenge } from '../src/expedition/challenges.ts'
import type { HeroId } from '../src/expedition/types.ts'
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  },
  configurable: true,
})
let count = 0
function test(name: string, fn: () => void) {
  fn()
  count++
  console.log('✓ ' + name)
}
test('Fresh collection has only the default three; old profiles retain access without stat buffs', () => {
  assert.deepEqual(emptyProfile().unlockedHeroes, [...DEFAULT_PARTY])
  const p = emptyProfile()
  delete (p as Partial<typeof p>).unlockedHeroes
  p.runs = 1
  persist(null, p)
  assert.equal(readProfile().unlockedHeroes.length, 9)
  p.runs = 0
  persist(null, p)
  assert.equal(readProfile().unlockedHeroes.length, 3)
})
test('All 84 unique triples start with 12 owner cards and equal equipment; duplicates rejected', () => {
  const ids = Object.keys(HEROES) as HeroId[]
  let triples = 0
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++)
      for (let c = b + 1; c < ids.length; c++) {
        const party = [ids[a], ids[b], ids[c]],
          r = newRun(party[0], 'triple', 'normal', party)
        assert.deepEqual(r.startParty, party)
        assert.deepEqual(
          r.party.map((h) => h.id),
          party,
        )
        assert.equal(r.deck.length, 12)
        for (const id of party)
          assert.equal(r.deck.filter((c) => CARD_MAP[c.id].hero === id).length, 4)
        assert.deepEqual(r.relics, ['lantern'])
        triples++
      }
  assert.equal(triples, 84)
  const bad = newRun('warden', 'duplicate', 'normal', ['warden', 'warden', 'mage'])
  assert.equal(new Set(bad.party.map((h) => h.id)).size, 3)
})
test('Daily overrides arbitrary party and contract', () => {
  assert.equal(partyIdentity(['priest', 'ranger', 'warden']), partyIdentity(DEFAULT_PARTY))
  const r = newRun('mage', 'daily-test', 'daily', ['mage', 'oracle', 'bard'], 'ashfall')
  assert.deepEqual(r.startParty, [...DEFAULT_PARTY])
  assert.equal(r.contract, 'standard')
})
test('Contract unlocks follow wins and a usable non-healer collection', () => {
  const p = emptyProfile()
  assert.ok(contractUnlocked('standard', p))
  assert.ok(!contractUnlocked('thin-hand', p))
  p.wins = 1
  assert.ok(contractUnlocked('thin-hand', p))
  assert.ok(!contractUnlocked('no-healer', p))
  p.unlockedHeroes.push('rogue')
  assert.ok(contractUnlocked('no-healer', p))
  assert.ok(!contractUnlocked('ashfall', p))
  p.wins = 2
  assert.ok(contractUnlocked('ashfall', p))
})
test('Meeting or recruit offer unlocks without hiring; invitations never unlock their initial party', () => {
  let r = newRun('mage', 'loan', 'normal', ['mage', 'oracle', 'bard'])
  const p = emptyProfile()
  assert.deepEqual(record(r, p).profile.unlockedHeroes, p.unlockedHeroes)
  r.phase = 'event'
  r.visitor = 'duelist'
  assert.ok(record(r, p).profile.unlockedHeroes.includes('duelist'))
  assert.ok(!p.unlockedHeroes.includes('duelist'))
  r.phase = 'reward'
  r.reward = { cards: [], coins: 0, relic: null, recruit: 'rogue', nodeKind: 'battle' }
  assert.ok(record(r, p).profile.unlockedHeroes.includes('rogue'))
})
test('No healer keeps road healing but rejects healer recruits in rewards and events', () => {
  const party: HeroId[] = ['warden', 'ranger', 'rogue']
  const r = newRun('warden', 'no-healer', 'normal', party, 'no-healer')
  assert.ok(r.deck.every((c) => CARD_MAP[c.id].hero !== 'priest'))
  r.phase = 'event'
  r.eventId = 5
  r.party[0].hp = 10
  assert.equal(eventChoice(r, 'a').party[0].hp, 20)
  r.eventId = 4
  r.visitor = 'priest'
  assert.equal(recruitVisitor(r, 0), r)
  r.phase = 'reward'
  r.reward = { cards: [], coins: 0, relic: null, recruit: 'priest', nodeKind: 'battle' }
  assert.equal(recruit(r, 0), r)
})
test('Thin hand removes exactly one opening card; ashfall adds only one temporary junk card', () => {
  const a = chooseNode(newRun('warden', 'hand'), 'battle-1'),
    b = chooseNode(newRun('warden', 'hand', 'normal', [...DEFAULT_PARTY], 'thin-hand'), 'battle-1')
  assert.equal(a.combat!.hand.length - b.combat!.hand.length, 1)
  const ash = chooseNode(
    newRun('warden', 'ash', 'normal', [...DEFAULT_PARTY], 'ashfall'),
    'battle-1',
  )
  assert.equal([...ash.combat!.hand, ...ash.combat!.draw].filter((c) => c.id === 'ash').length, 1)
  assert.ok(!ash.deck.some((c) => c.id === 'ash'))
})
test('Contract multiplier changes score without changing enemy strength', () => {
  const win = (contract: 'standard' | 'ashfall') => {
    let r = chooseNode(
      newRun('warden', 'score', 'normal', [...DEFAULT_PARTY], contract),
      'battle-1',
    )
    r.combat!.enemies.forEach((e) => {
      e.hp = 1
      e.block = 0
    })
    r.combat!.hand = [{ id: 'volley', uid: 'win', upgraded: false }]
    r.combat!.energy = 3
    r = playCard(r, 'win', 0)
    return r
  }
  assert.equal(win('ashfall').lastScore.total, Math.round(win('standard').lastScore.total * 1.25))
})
test('Shared links restore INITIAL full party and contract after recruiting; old balance links rejected', () => {
  const r = newRun('warden', 'link', 'hard', ['warden', 'rogue', 'duelist'], 'no-healer')
  r.party[1].id = 'oracle'
  const c = readChallenge(new URL(challengeUrl(r, 'https://example.test/dndrun/')!).search)!
  assert.deepEqual(c.party, r.startParty)
  assert.equal(c.contract, r.contract)
  assert.deepEqual(newRun(c.leader, c.seed, c.mode, c.party, c.contract).startParty, r.startParty)
  for (const q of [
    '?rules=5&seed=x&party=warden&mode=normal',
    '?rules=6&seed=x&party=warden,warden,mage&mode=normal',
    '?rules=6&seed=x&party=warden,ranger,mage&mode=daily',
    '?rules=6&seed=x&party=warden,ranger,priest&contract=no-healer&mode=normal',
  ])
    assert.equal(readChallenge(q), null)
})
test('Records classify by starting party, rule version and contract; repeated terminal recording is idempotent', () => {
  let r = newRun('warden', 'record', 'normal', ['warden', 'ranger', 'rogue'], 'no-healer')
  r.party[1].id = 'oracle'
  r.phase = 'defeat'
  r.score = 100
  const first = record(r, emptyProfile())
  assert.deepEqual(first.profile.records[0].party, r.startParty)
  assert.equal(first.profile.records[0].contract, 'no-healer')
  assert.equal(record(first.run, first.profile).profile.runs, 1)
  r = newRun('warden', 'record')
  r.phase = 'defeat'
  r.score = 200
  assert.equal(record(r, first.profile).profile.records.length, 2)
})
test('New save round trips full initial party and contract; migration defaults standard without rewriting old rules', () => {
  const r = newRun('rogue', 'save', 'normal', ['rogue', 'bard', 'alchemist'], 'ashfall')
  persist(r, emptyProfile())
  assert.deepEqual(readRun(), r)
  const raw = structuredClone(r)
  delete (raw as Partial<typeof r>).contract
  raw.rules = 5
  const migrated = migrateRun(raw)
  assert.equal(migrated.contract, 'standard')
  assert.equal(migrated.rules, 5)
})
test('Bonus draw cap applies to cards and oracle together, resets each turn and leaves old saves uncapped', () => {
  const r = chooseNode(newRun('oracle', 'cap', 'normal', ['oracle', 'mage', 'bard']), 'battle-1')
  r.combat!.enemies.forEach((e) => (e.hp = 200))
  r.combat!.hand = [{ id: 'vision', uid: 'vision', upgraded: true, level: 10 }]
  r.combat!.draw = Array.from({ length: 12 }, (_, i) => ({
    id: 'spark',
    uid: 'cap' + i,
    upgraded: false,
  }))
  r.combat!.bonusDraw = 0
  const capped = playCard(r, 'vision', 0)
  assert.equal(capped.combat!.hand.length, 4)
  assert.equal(capped.combat!.bonusDraw, 4)
  const next = endTurn(capped)
  assert.equal(next.combat!.bonusDraw, 0)
  r.rules = 5
  assert.ok(playCard(r, 'vision', 0).combat!.hand.length > 4)
})
console.log(`${count} contract and roster tests passed.`)
