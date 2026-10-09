import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { simulate } from './bot.mts'
import type { ContractId, HeroId, Run } from '../src/expedition/types.ts'
import { CARD_MAP } from '../src/expedition/data.ts'
const samples = Number(process.env.SAMPLES ?? 200)
const cases: { name: string; party: HeroId[]; contract?: ContractId; mode?: Run['mode'] }[] = [
  { name: 'standard', party: ['warden', 'ranger', 'priest'] },
  { name: 'arcane', party: ['mage', 'bard', 'priest'] },
  { name: 'oracle', party: ['oracle', 'warden', 'bard'] },
  { name: 'poison', party: ['alchemist', 'rogue', 'priest'] },
  { name: 'counter', party: ['duelist', 'warden', 'priest'] },
  { name: 'fragile', party: ['mage', 'rogue', 'ranger'] },
  { name: 'draw-engine', party: ['mage', 'oracle', 'bard'] },
  { name: 'no-healer', party: ['warden', 'ranger', 'rogue'], contract: 'no-healer' },
  { name: 'thin-hand', party: ['warden', 'ranger', 'priest'], contract: 'thin-hand' },
  { name: 'ashfall', party: ['warden', 'ranger', 'priest'], contract: 'ashfall' },
  { name: 'hard', party: ['warden', 'ranger', 'priest'], mode: 'hard' },
]
const rows = []
for (const c of cases)
  for (const strategy of ['novice', 'tactical'] as const) {
    let wins = 0,
      points = 0,
      depth = 0,
      bossTurns = 0,
      bosses = 0,
      empty = 0,
      turns = 0,
      maxPlays = 0
    const deaths: Record<string, number> = {},
      fallen: Record<string, number> = {}
    for (let i = 0; i < samples; i++) {
      const seen = new Set<string>(),
        bossSeen = new Set<number>(),
        fell = new Set<string>()
      const r = simulate(`contracts-${i}`, c.party[0], strategy, c.mode ?? 'normal', 0, 'active', {
        party: c.party,
        contract: c.contract,
        observe(r) {
          for (const h of r.party) if (h.hp <= 0) fell.add(h.id)
          if (r.phase === 'combat') {
            maxPlays = Math.max(maxPlays, r.combat!.played)
            const key = `${r.depth}-${r.combat!.turn}`
            if (!seen.has(key)) {
              seen.add(key)
              turns++
              if (!r.combat!.hand.some((x) => CARD_MAP[x.id].block || CARD_MAP[x.id].heal)) empty++
              if (r.combat!.kind === 'boss') {
                bossTurns++
                if (!bossSeen.has(r.depth)) {
                  bosses++
                  bossSeen.add(r.depth)
                }
              }
            }
          }
        },
      })
      assert.ok(['victory', 'defeat'].includes(r.phase))
      assert.ok(Number.isSafeInteger(r.score) && r.score >= 0)
      wins += r.phase === 'victory' ? 1 : 0
      points += r.score
      depth += r.cleared
      if (r.phase === 'defeat') deaths[r.depth] = (deaths[r.depth] ?? 0) + 1
      for (const id of fell) fallen[id] = (fallen[id] ?? 0) + 1
    }
    rows.push({
      name: c.name,
      strategy,
      samples,
      wins,
      meanScore: Math.round(points / samples),
      meanDepth: +(depth / samples).toFixed(2),
      meanBossTurns: +(bossTurns / (bosses || 1)).toFixed(2),
      emptyDefensiveHands: +(empty / (turns || 1)).toFixed(3),
      maxPlays,
      deaths,
      fallen,
    })
  }
console.table(rows.map(({ deaths: _deaths, fallen: _fallen, ...r }) => r))
writeFileSync(
  process.env.OUTPUT ?? 'docs/contracts-balance-after.json',
  JSON.stringify(
    {
      date: new Date().toISOString().slice(0, 10),
      sample: rows.length * samples,
      notes:
        'Heuristic bots, not human playtests. Active routes; shared starting seeds, later RNG changes with decisions. Empty defensive hand means no printed block/heal, not proof of an unavoidable wound.',
      rows,
    },
    null,
    2,
  ) + '\n',
)
