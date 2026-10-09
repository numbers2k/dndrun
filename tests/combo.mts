import assert from 'node:assert/strict'
import {
  newRun,
  chooseNode,
  playCard,
  endTurn,
  targetDamage,
  comboMultiplier,
  damageBreakdown,
  persist,
  emptyProfile,
  readRun,
} from '../src/expedition/engine.ts'
import type { Run } from '../src/expedition/types.ts'
import { relicHint, buildPlans } from '../src/expedition/synergies.ts'
import { CARDS, STARTERS } from '../src/expedition/data.ts'
let count = 0
function test(name: string, fn: () => void) {
  fn()
  count++
  console.log('✓ ' + name)
}
function fight(): Run {
  const r = chooseNode(newRun('warden', 'combo'), 'battle-1')
  r.combat!.enemies = r.combat!.enemies.slice(0, 1)
  r.combat!.enemies.forEach((e) => {
    e.hp = e.maxHp = 1000
    e.block = 0
  })
  r.combat!.energy = 50
  r.combat!.draw = []
  return r
}
test('Alternating attacks scale at 3, 5, 7 and 9, and preview matches real wounds', () => {
  let r = fight()
  r.combat!.hand = [
    'slash',
    'shot',
    'smite',
    'slash',
    'shot',
    'smite',
    'slash',
    'shot',
    'smite',
  ].map((id, i) => ({ id, uid: 'chain' + i, upgraded: false }))
  for (let i = 0; i < 9; i++) {
    const c = r.combat!.hand.find((c) => c.uid === 'chain' + i)!
    const mult = comboMultiplier(r, c)
    assert.equal(mult, 1 + Math.floor(i / 2) * 0.25)
    const predicted = targetDamage(r, c, 0),
      hp = r.combat!.enemies[0].hp
    r = playCard(r, c.uid, 0)
    assert.equal(hp - r.combat!.enemies[0].hp, predicted)
  }
  assert.equal(comboMultiplier(r), 2)
  r.combat!.hand.push({ id: 'smite', uid: 'same', upgraded: false })
  assert.equal(comboMultiplier(r, r.combat!.hand.at(-1)), 1)
  assert.equal(comboMultiplier(endTurn(r)), 1)
})
test('One physical card cannot redraw itself in a turn; separate copies and next turns work', () => {
  const r = fight()
  r.combat!.hand = [{ id: 'bless', uid: 'aim1', upgraded: false }]
  const n = playCard(r, 'aim1', 0)
  assert.equal(n.combat!.hand.length, 0)
  assert.equal(n.combat!.discard[0].uid, 'aim1')
  assert.deepEqual(n.combat!.spent, ['aim1'])
  assert.ok(endTurn(n).combat!.hand.some((c) => c.uid === 'aim1'))
  r.combat!.discard = [{ id: 'bless', uid: 'aim2', upgraded: false }]
  assert.ok(playCard(r, 'aim1', 0).combat!.hand.some((c) => c.uid === 'aim2'))
})
test('Combo multiplies conditional damage before vulnerability and armor, and caps growth', () => {
  const r = fight(),
    c = { id: 'shot', uid: 'shot-test', upgraded: false }
  r.combat!.hand = [c]
  r.combat!.chain = 8
  r.combat!.lastHero = 'warden'
  r.combat!.enemies[0].vulnerable = 1
  r.combat!.enemies[0].block = 5
  const predicted = targetDamage(r, c, 0),
    hp = r.combat!.enemies[0].hp
  assert.equal(predicted, 34) // (10 + ranger 3) × 2 × 1.5 − 5
  const n = playCard(r, c.uid, 0)
  assert.equal(hp - n.combat!.enemies[0].hp, predicted)
  n.combat!.chain = 100
  assert.equal(comboMultiplier(n), 2)
})
test('Legacy v4 combat retains original damage and reshuffle behavior', () => {
  const r = fight()
  r.rules = 4
  r.combat!.chain = 8
  r.combat!.lastHero = 'priest'
  assert.equal(comboMultiplier(r, { id: 'slash', uid: 'old', upgraded: false }), 1)
  r.combat!.hand = [{ id: 'bless', uid: 'legacy', upgraded: false }]
  assert.ok(playCard(r, 'legacy', 0).combat!.hand.some((c) => c.uid === 'legacy'))
})
test('Spent card state survives save and rejects malformed payloads', () => {
  const map = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
      removeItem: (k: string) => map.delete(k),
    },
    configurable: true,
  })
  const r = chooseNode(newRun('warden', 'save-combo'), 'battle-1')
  r.combat!.spent = ['spent-one']
  persist(r, emptyProfile())
  assert.deepEqual(readRun(), r)
  r.combat!.spent = [3 as unknown as string]
  persist(r, emptyProfile())
  assert.equal(readRun(), null)
})
test('Poison relay arms from actual applied poison, requires a different hero and expires', () => {
  let r = chooseNode(newRun('alchemist', 'poison-combo'), 'battle-1')
  r.combat!.energy = 20
  r.combat!.enemies[0].hp = r.combat!.enemies[0].maxHp = 1000
  r.relics.push('venombond', 'vial')
  r.combat!.hand = ['acid', 'catalyst', 'slash'].map((id, i) => ({
    id,
    uid: 'poison' + i,
    upgraded: false,
  }))
  r = playCard(r, 'poison0', 0)
  assert.deepEqual(r.combat!.poisonRelay, { hero: 'alchemist', bonus: 4 })
  const own = targetDamage(
    r,
    r.combat!.hand.find((c) => c.id === 'catalyst')!,
    0,
  )
  assert.equal(own, 11)
  r = playCard(r, 'poison1', 0)
  assert.equal(r.combat!.poisonRelay!.bonus, 4)
  const attack = r.combat!.hand.find((c) => c.id === 'slash')!,
    predicted = targetDamage(r, attack, 0),
    hp = r.combat!.enemies[0].hp
  r = playCard(r, attack.uid, 0)
  assert.equal(hp - r.combat!.enemies[0].hp, predicted)
  assert.equal(r.combat!.poisonRelay, null)
  r.combat!.poisonRelay = { hero: 'alchemist', bonus: 12 }
  assert.equal(endTurn(r).combat!.poisonRelay, null)
})
test('Guard relay and duelist can combine with poison without reusing charges', () => {
  let r = chooseNode(newRun('duelist', 'guard-combo'), 'battle-1')
  r.relics.push('guardbond')
  r.combat!.energy = 20
  r.combat!.enemies[0].hp = r.combat!.enemies[0].maxHp = 1000
  r.combat!.hand = ['parry', 'omen', 'riposte'].map((id, i) => ({
    id,
    uid: 'guard' + i,
    upgraded: false,
  }))
  r = playCard(r, 'guard0', 0)
  assert.deepEqual(r.combat!.guardRelay, { hero: 'duelist', bonus: 6 })
  const c = r.combat!.hand.find((c) => c.id === 'omen')!
  assert.equal(targetDamage(r, c, 0), 13)
  r = playCard(r, c.uid, 0)
  assert.equal(r.combat!.guardRelay, null)
  const attack = r.combat!.hand.find((c) => c.id === 'riposte')!,
    hp = r.combat!.enemies[0].hp,
    predicted = targetDamage(r, attack, 0)
  r = playCard(r, attack.uid, 0)
  assert.equal(hp - r.combat!.enemies[0].hp, predicted)
  assert.ok(predicted > 20)
})
test('Conductor improves a prepared chain at the cost of one starting card', () => {
  const source = newRun('warden', 'conductor')
  const plain = chooseNode(source, 'battle-1')
  source.relics.push('conductor')
  const r = chooseNode(source, 'battle-1')
  assert.equal(r.combat!.hand.length, plain.combat!.hand.length - 1)
  r.combat!.chain = 2
  r.combat!.lastHero = 'warden'
  assert.equal(comboMultiplier(r, { id: 'shot', uid: 'x', upgraded: false }), 1.5)
  r.combat!.chain = 50
  assert.equal(comboMultiplier(r), 2.25)
})
test('Build advice reports real cards, missing setups and distinct plans', () => {
  const r = newRun('warden', 'advice')
  assert.ok(relicHint(r, 'venombond').includes('Пока нет'))
  assert.equal(buildPlans(r).length, 4)
  assert.ok(buildPlans(r).find((p) => p.name.includes('Метка'))!.ready)
  assert.ok(!buildPlans(r).find((p) => p.name.includes('Яд'))!.ready)
  const n = newRun('alchemist', 'advice')
  assert.ok(relicHint(n, 'venombond').includes('карт с ядом'))
})
test('The same three cards and energy produce 50 or 18 wounds depending on planning', () => {
  const source = chooseNode(newRun('duelist', 'order-skill'), 'battle-1')
  source.relics = ['guardbond', 'conductor']
  source.combat!.enemies[0].hp = source.combat!.enemies[0].maxHp = 1000
  source.combat!.energy = 3
  source.combat!.draw = []
  source.combat!.discard = []
  source.combat!.hand = ['parry', 'omen', 'riposte'].map((id) => ({ id, uid: id, upgraded: false }))
  const resolve = (order: string[]) => order.reduce((r, uid) => playCard(r, uid, 0), source)
  const planned = resolve(['parry', 'omen', 'riposte']),
    improvised = resolve(['riposte', 'omen', 'parry'])
  assert.equal(1000 - planned.combat!.enemies[0].hp, 50)
  assert.equal(1000 - improvised.combat!.enemies[0].hp, 18)
  assert.equal(planned.combat!.energy, improvised.combat!.energy)
  assert.equal(source.combat!.enemies[0].hp, 1000)
})
test('Finisher rewards excess after armor once per battle, with exact preview and a cap', () => {
  let r = fight()
  const b = r.combat!
  b.chain = 2
  b.maxChain = 2
  b.lastHero = 'priest'
  b.enemies[0].hp = 4
  b.enemies[0].block = 3
  b.hand = [{ id: 'slash', uid: 'finish', upgraded: false }]
  const preview = damageBreakdown(r, b.hand[0], 0)!
  assert.equal(preview.finisher, 4) // floor(9 × 1.25) − 3 armor − 4 HP
  r = playCard(r, 'finish', 0)
  assert.equal(r.lastScore.finisher, 4)
  assert.equal(r.lastScore.total, 100 + 125 + 100 + 60 + 4)
  const score = r.score
  assert.equal(playCard(r, 'finish', 0).score, score)

  r = fight()
  r.combat!.chain = 8
  r.combat!.maxChain = 8
  r.combat!.lastHero = 'priest'
  r.combat!.hand = [{ id: 'slash', uid: 'cap', upgraded: true, level: 20 }]
  r.combat!.enemies[0].hp = 1
  assert.equal(damageBreakdown(r, r.combat!.hand[0], 0)!.finisher, 150)
  assert.equal(playCard(r, 'cap', 0).lastScore.finisher, 150)
})
test('Only the best finisher counts; summons, poison and short chains cannot farm it', () => {
  let r = fight()
  r.combat!.enemies.push({ ...r.combat!.enemies[0], uid: 'second' })
  r.combat!.enemies[0].hp = 1
  r.combat!.chain = 2
  r.combat!.maxChain = 2
  r.combat!.lastHero = 'priest'
  r.combat!.finisher = 20
  r.combat!.hand = [{ id: 'slash', uid: 'small', upgraded: false }]
  assert.equal(damageBreakdown(r, r.combat!.hand[0], 0)!.finisher, 0)
  r = playCard(r, 'small', 0)
  assert.equal(r.combat!.finisher, 20)
  r.combat!.enemies[1].hp = 1
  r.combat!.enemies[1].summoned = true
  r.combat!.hand = [{ id: 'shot', uid: 'summon', upgraded: true, level: 20 }]
  assert.equal(damageBreakdown(r, r.combat!.hand[0], 1)!.finisher, 0)
  r = playCard(r, 'summon', 1)
  assert.equal(r.lastScore.finisher, 20)
  r = fight()
  r.combat!.enemies[0].hp = 1
  r.combat!.enemies[0].poison = 100
  r.combat!.chain = 9
  r.combat!.maxChain = 9
  assert.equal(endTurn(r).lastScore.finisher, 0)
  r = fight()
  r.combat!.enemies[0].hp = 1
  r.combat!.hand = [{ id: 'slash', uid: 'short', upgraded: true, level: 20 }]
  assert.equal(playCard(r, 'short', 0).lastScore.finisher, 0)
  r.rules = 4
  assert.equal(playCard(r, 'short', 0).lastScore.finisher, undefined)
})
test('Finisher and summon state roundtrip; invalid scoring payloads are rejected', () => {
  const r = chooseNode(newRun('warden', 'finisher-save'), 'battle-1')
  r.combat!.finisher = 75
  r.combat!.enemies[0].summoned = true
  persist(r, emptyProfile())
  assert.deepEqual(readRun(), r)
  r.combat!.finisher = 151
  persist(r, emptyProfile())
  assert.equal(readRun(), null)
})
test('Damage previews match actual attacks across heroes, relics, chains, armor and vulnerability', () => {
  let cases = 0
  for (const leader of STARTERS) {
    const source = chooseNode(newRun(leader, 'preview-matrix'), 'battle-1')
    const attacks = CARDS.filter((d) => d.damage && source.party.some((h) => h.id === d.hero))
    for (const d of attacks)
      for (const chain of [0, 2, 4, 8])
        for (const vulnerable of [0, 1])
          for (const block of [0, 13])
            for (const boosted of [false, true]) {
              const r = structuredClone(source),
                b = r.combat!
              r.relics = boosted ? ['whetstone', 'heavy', 'conductor'] : []
              r.boons = boosted ? ['edge'] : []
              r.party.forEach((h) => {
                h.block = 16
              })
              b.enemies.forEach((e) => {
                e.hp = e.maxHp = 1000
                e.block = block
                e.vulnerable = vulnerable
                e.poison = 7
              })
              b.energy = 20
              b.chain = chain
              b.maxChain = chain
              b.lastHero = r.party.find((h) => h.id !== d.hero)!.id
              b.draw = []
              b.discard = []
              b.reserve = boosted ? 5 : 0
              b.poisonRelay = boosted ? { hero: b.lastHero, bonus: 7 } : null
              b.guardRelay = boosted ? { hero: b.lastHero, bonus: 6 } : null
              const c = { id: d.id, uid: 'matrix', upgraded: boosted }
              b.hand = [c]
              const expected = targetDamage(r, c, 0),
                after = playCard(r, c.uid, 0)
              assert.equal(
                1000 - after.combat!.enemies[0].hp,
                expected,
                `${leader}/${d.id}/${chain}/${vulnerable}/${block}/${boosted}`,
              )
              cases++
            }
  }
  console.log(`  ${cases} damage combinations verified`)
})
console.log(`${count} combo tests passed.`)
