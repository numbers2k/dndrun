import assert from 'node:assert/strict'
import { simulate } from './bot.mts'
import { STARTERS } from '../src/expedition/data.ts'
import { writeFileSync } from 'node:fs'

const rows = []
for (const leader of STARTERS)
  for (const strategy of ['novice', 'tactical'] as const)
    for (const route of ['safe', 'active'] as const) {
      let wins = 0,
        depth = 0,
        points = 0
      for (let i = 0; i < 40; i++) {
        const r = simulate(`audit-${i}`, leader, strategy, 'normal', 0, route)
        assert.ok(['victory', 'defeat'].includes(r.phase))
        assert.ok(Number.isSafeInteger(r.score) && r.score >= 0)
        wins += r.phase === 'victory' ? 1 : 0
        depth += r.cleared
        points += r.score
      }
      rows.push({
        leader,
        strategy,
        route,
        runs: 40,
        wins,
        meanDepth: Number((depth / 40).toFixed(2)),
        meanScore: Math.round(points / 40),
      })
    }
console.table(rows)
writeFileSync(
  'docs/player-balance-snapshot.json',
  JSON.stringify(
    {
      date: '2026-10-09',
      sample: 960,
      notes:
        'Heuristic policies, not human players. Same seed sets; decisions change later RNG. Active prefers combat when healthy; safe prefers events/rest/shops.',
      rows,
    },
    null,
    2,
  ) + '\n',
)
console.log('960 player-policy expeditions checked.')
