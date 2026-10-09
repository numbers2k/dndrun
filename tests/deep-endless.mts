import assert from 'node:assert/strict'
import { simulate } from './bot.mts'
import { STARTERS } from '../src/expedition/data.ts'

// A small stress sample beyond the regular four-circle smoke suite.
const rows = STARTERS.map((leader) => {
  const runs = Array.from({ length: 5 }, (_, i) =>
    simulate(`deep-${i}`, leader, 'tactical', 'normal', 9),
  )
  for (const r of runs) {
    assert.ok(['victory', 'defeat'].includes(r.phase))
    assert.ok(Number.isSafeInteger(r.score) && r.score >= 0)
    assert.ok(r.party.every((h) => h.hp >= 0 && h.hp <= h.maxHp))
    assert.ok(r.combat?.enemies.every((e) => Number.isFinite(e.maxHp)) ?? true)
  }
  const depths = runs.map((r) => r.cleared).sort((a, b) => a - b)
  return {
    leader,
    runs: runs.length,
    retiredAt150: runs.filter((r) => r.phase === 'victory' && r.cleared === 150).length,
    min: depths[0],
    median: depths[2],
    max: depths[4],
    bestScore: Math.max(...runs.map((r) => r.score)),
  }
})
console.table(rows)
assert.ok(
  rows.some((r) => r.retiredAt150 < r.runs),
  'Deep enemies should resist the reference bot',
)
console.log(
  '30 deep expeditions tested up to 150 stops. This sample does not measure human difficulty.',
)
