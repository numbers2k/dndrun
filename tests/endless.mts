import assert from 'node:assert/strict'
import { simulate } from './bot.mts'
import { STARTERS } from '../src/expedition/data.ts'
const results = []
for (const leader of STARTERS) {
  let entered = 0,
    second = 0,
    deepest = 0,
    points = 0
  for (let i = 0; i < 50; i++) {
    const r = simulate(`endless-${i}`, leader, 'tactical', 'normal', 3)
    entered += r.depth > 15 ? 1 : 0
    second += r.cleared >= 30 ? 1 : 0
    deepest = Math.max(deepest, r.depth)
    points = Math.max(points, r.score)
    assert.ok(['victory', 'defeat'].includes(r.phase))
    assert.ok(r.gold >= 0)
    assert.ok(Number.isFinite(r.score))
    assert.ok(r.boons.length <= 3)
  }
  results.push({ leader, runs: 50, entered, second, deepest, points })
  assert.ok(entered > 0)
  assert.ok(deepest > 20)
}
console.table(results)
console.log('300 endless expeditions terminated with valid scores.')
