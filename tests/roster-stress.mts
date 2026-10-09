import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { simulate } from './bot.mts'
import { HEROES } from '../src/expedition/data.ts'
import type { HeroId } from '../src/expedition/types.ts'
const ids = Object.keys(HEROES) as HeroId[],
  rows = []
for (let a = 0; a < ids.length; a++)
  for (let b = a + 1; b < ids.length; b++)
    for (let c = b + 1; c < ids.length; c++) {
      const party = [ids[a], ids[b], ids[c]]
      let wins = 0,
        max = 0
      for (let i = 0; i < 10; i++) {
        const r = simulate(`roster-stress-${i}`, party[0], 'tactical', 'normal', 0, 'safe', {
          party,
        })
        assert.ok(['victory', 'defeat'].includes(r.phase))
        assert.ok(r.party.every((h) => h.hp >= 0 && h.hp <= h.maxHp))
        assert.ok(Number.isSafeInteger(r.score) && r.score >= 0)
        wins += r.phase === 'victory' ? 1 : 0
        max = Math.max(max, r.cleared)
      }
      rows.push({ party: party.join(','), samples: 10, wins, max })
    }
const summary = {
  sample: 840,
  winningTriples: rows.filter((r) => r.wins > 0).length,
  zeroWins: rows.filter((r) => r.wins === 0).map((r) => r.party),
  notes:
    'Ten heuristic safe-route seeds per triple. Technical reachability sample, not a fair balance or human fun score.',
  rows,
}
writeFileSync('docs/roster-stress.json', JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({ ...summary, rows: undefined }))
