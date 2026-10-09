import assert from 'node:assert/strict'
import {
  newRun,
  chooseNode,
  makeRoutes,
  eventChoice,
  endTurn,
  playCard,
} from '../src/expedition/engine.ts'
import { chainHint, turnOptions, turnForecast, allyEffect } from '../src/expedition/guidance.ts'
import { relicFits, recruitPreview } from '../src/expedition/synergies.ts'
let count = 0
function test(name: string, fn: () => void) {
  fn()
  count++
  console.log('✓ ' + name)
}
test('Supplies heal an injured high-HP hero rather than full-health low-HP heroes', () => {
  const r = newRun('warden', 'supplies')
  r.phase = 'event'
  r.eventId = 6
  r.party[0].hp = 45
  const n = eventChoice(r, 'b')
  assert.equal(n.party[0].hp, 48)
  assert.equal(r.party[0].hp, 45)
})
test('Route alternatives never offer the same encounter, across campaign and abyss seeds', () => {
  for (let i = 0; i < 80; i++)
    for (const depth of [2, 5, 7, 10, 15, 17, 20, 22, 50]) {
      const r = newRun('warden', `alternatives-${i}`)
      r.depth = depth
      const ids = makeRoutes(r).flatMap((n) => (n.encounter ? [n.encounter] : []))
      assert.equal(ids.length, new Set(ids).size)
    }
})
test('Guidance explains the next threshold, no second draw, and free available actions', () => {
  let r = chooseNode(newRun('warden', 'guidance'), 'battle-1')
  r.combat!.chain = 2
  r.combat!.maxChain = 2
  r.combat!.lastHero = 'warden'
  assert.ok(chainHint(r).includes('+1 карта'))
  r.combat!.turnChain = 3
  assert.ok(!chainHint(r).includes('+1 карта'))
  r.combat!.energy = 0
  r.combat!.hand = [{ id: 'mark', uid: 'free', upgraded: false }]
  assert.equal(turnOptions(r).free, 1)
  r = playCard(r, 'free', 0)
  assert.equal(turnOptions(r).free, 0)
  assert.ok(chainHint(endTurn(r)).includes('Начните'))
})
test('Regional pressure rises gradually, while the first fight is identical in both modes', () => {
  const normal = chooseNode(newRun('warden', 'first-pressure'), 'battle-1')
  const hard = chooseNode(newRun('warden', 'first-pressure', 'hard'), 'battle-1')
  assert.deepEqual(normal.combat!.enemies, hard.combat!.enemies)
  const r = newRun('warden', 'regional')
  r.depth = 14
  r.routeHistory = Array(14).fill('battle')
  r.nodes = makeRoutes(r)
  const v5 = chooseNode(r, r.nodes[0].id)
  r.rules = 4
  const legacy = chooseNode(r, r.nodes[0].id)
  assert.equal(v5.combat!.enemies[0].maxHp, Math.ceil(legacy.combat!.enemies[0].maxHp * 1.2))
  assert.equal(v5.combat!.enemies[0].power, legacy.combat!.enemies[0].power + 2)
})
test('Turn forecast resolves lethal poison, death splashes and redirected attacks without changing state', () => {
  for (const volatile of [false, true])
    for (const poison of [0, 5, 30])
      for (const block of [0, 8]) {
        const r = chooseNode(newRun('warden', 'forecast'), 'battle-1')
        r.party[0].hp = 3
        r.party.forEach((h) => (h.block = block))
        r.combat!.enemies.forEach((e) => {
          e.intent.target = 0
          e.poison = poison
          e.hp = 5
        })
        if (volatile) r.relics.push('volatile')
        const source = structuredClone(r),
          f = turnForecast(r)!,
          next = endTurn(r)
        assert.deepEqual(
          f.wounds,
          r.party.map((h, i) => Math.max(0, h.hp - next.party[i].hp)),
        )
        assert.deepEqual(
          f.falls,
          r.party.map((h, i) => h.hp > 0 && next.party[i].hp <= 0),
        )
        assert.deepEqual(r, source)
        if (poison === 30) assert.ok(f.victory)
      }
})
test('Ally preview shows actual capped heal, prevention and priest/relic bonuses', () => {
  const r = chooseNode(newRun('warden', 'ally-preview'), 'battle-1')
  r.party[0].hp = 4
  r.party[0].block = 0
  r.combat!.enemies.forEach((e) => {
    e.intent.target = 0
  })
  const c = { id: 'shield', uid: 'shield-preview', upgraded: false }
  r.combat!.hand = [c]
  const preview = allyEffect(r, c, 0)!
  assert.equal(preview.block, 13) // 11 card + 2 warden passive on self
  assert.equal(preview.wounds, 0)
  r.relics.push('herbs')
  r.party[1].hp = 35
  const heal = { id: 'mend', uid: 'heal-preview', upgraded: false }
  r.combat!.hand = [heal]
  assert.equal(allyEffect(r, heal, 1)!.heal, 1)
})
test('Relic drafts offer a working option when available; recruitment previews match lost cards', () => {
  for (let i = 0; i < 100; i++) {
    let r = newRun('warden', `draft-fit-${i}`)
    r.depth = 4
    r.routeHistory = Array(4).fill('battle')
    r.nodes = makeRoutes(r)
    r = chooseNode(r, r.nodes[0].id)
    r.combat!.enemies.forEach((e) => {
      e.hp = 1
      e.block = 0
    })
    r.combat!.hand = [{ id: 'slash', uid: 'draft-win', upgraded: false }]
    r = playCard(r, 'draft-win', 0)
    assert.ok(r.reward!.relicChoices!.some((id) => relicFits(r, id)))
  }
  const r = newRun('warden', 'recruit-review')
  r.deck[0].upgraded = true
  const preview = recruitPreview(r, 0, 'oracle')!
  assert.equal(
    preview.lost,
    r.deck.filter((c) => c.id === 'slash' || c.id === 'shield' || c.id === 'bash').length,
  )
  assert.equal(preview.upgraded, 1)
  assert.equal(preview.newCards.length, 4)
})
console.log(`${count} player audit tests passed.`)
