import assert from 'node:assert/strict'
import { simulate } from './bot.mts'
import { STARTERS } from '../src/expedition/data.ts'
const reports = []
for (const leader of STARTERS) {
  for (const strategy of ['tactical', 'reckless'] as const) {
    let wins = 0,
      total = 0,
      best = 0
    for (let i = 0; i < 100; i++) {
      const r = simulate(`balance-${i}`, leader, strategy)
      wins += r.phase === 'victory' ? 1 : 0
      total += r.depth
      best = Math.max(best, r.depth)
      assert.ok(r.party.every((h) => h.hp >= 0 && h.hp <= h.maxHp))
      assert.ok(r.gold >= 0)
      assert.ok(r.deck.length >= 6)
    }
    reports.push({
      leader,
      strategy,
      runs: 100,
      wins,
      meanDepth: Number((total / 100).toFixed(2)),
      best,
    })
  }
}
console.table(reports)
for (const r of reports.filter((r) => r.strategy === 'tactical'))
  assert.ok(r.wins > 0, `${r.leader} must be able to win`)
for (const leader of STARTERS) {
  const smart = reports.find((r) => r.leader === leader && r.strategy === 'tactical')!,
    rash = reports.find((r) => r.leader === leader && r.strategy === 'reckless')!
  assert.ok(smart.meanDepth > rash.meanDepth, 'Targeting and route choices should help')
}
let hardWins = 0
for (let i = 0; i < 100; i++)
  hardWins += simulate(`balance-${i}`, 'warden', 'tactical', 'hard').phase === 'victory' ? 1 : 0
console.log(`Hard: ${hardWins}/100. Total: 1300 complete runs.`)
assert.ok(hardWins < reports[0].wins, 'Hard mode must be harder')
