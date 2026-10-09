// Diagnostic audit, intentionally records current weaknesses rather than asserting they are fixed.
// Everything runs in memory: no browser or user save is touched.
import { writeFileSync } from 'node:fs'
import {
  newRun,
  chooseNode,
  playCard,
  emptyProfile,
  record,
  canUpgrade,
  cardDescription,
  rest,
} from '../src/expedition/engine.ts'
import { actionFeedback } from '../src/expedition/experience.ts'
import { BOSSES } from '../src/expedition/encounters.ts'
import { simulate } from './bot.mts'

let boss = newRun('warden', 'critique-boss-heal')
boss.depth = boss.cleared = 4
boss.nodes = [{ id: 'boss', kind: 'boss', bossId: 'bridge', name: 'Audit', description: '' }]
boss = chooseNode(boss, 'boss')
boss.party.forEach((h) => {
  h.hp = h.maxHp - 20
})
boss.combat!.enemies.forEach((e) => {
  e.hp = 1
  e.block = 0
})
boss.combat!.hand = [{ id: 'slash', uid: 'finish', upgraded: false }]
const bossAfter = playCard(boss, 'finish', 0)
const feedback = actionFeedback(boss, bossAfter)

const ashRun = newRun('warden', 'critique-ash-upgrade')
ashRun.phase = 'rest'
const ash = { id: 'ash', uid: 'persistent-ash', upgraded: false }
ashRun.deck.push(ash)
const upgradedAshRun = rest(ashRun, 'upgrade', ash.uid)
const upgradedAsh = upgradedAshRun.deck.find((c) => c.uid === ash.uid)!

let profile = emptyProfile()
for (let i = 0; i < 100; i++) {
  const r = newRun('mage', `record-${i}`, 'normal', ['mage', 'oracle', 'bard'])
  r.runId = `high-${i}`
  r.phase = 'victory'
  r.depth = r.cleared = 30
  r.score = 20000 + i
  profile = record(r, profile).profile
}
const low = newRun('warden', 'new-category')
low.runId = 'new-category'
low.phase = 'victory'
low.depth = low.cleared = 15
low.score = 5000
profile = record(low, profile).profile

const cohorts = []
for (const routeStyle of ['safe', 'active'] as const) {
  const sizes: number[][] = Array.from({ length: 12 }, () => [])
  const completions: number[] = []
  let wins = 0,
    totalScore = 0
  for (let person = 0; person < 50; person++) {
    let p = emptyProfile(),
      completed = false
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = simulate(
        `critique-${person}-${attempt}`,
        'warden',
        'tactical',
        'normal',
        0,
        routeStyle,
        {
          observe(state) {
            p = record(state, p).profile
          },
        },
      )
      p = record(r, p).profile
      sizes[attempt].push(p.unlockedHeroes.length)
      wins += r.phase === 'victory' ? 1 : 0
      totalScore += r.score
      if (!completed && p.unlockedHeroes.length === 9) {
        completions.push(attempt + 1)
        completed = true
      }
    }
  }
  cohorts.push({
    routeStyle,
    samples: 600,
    wins,
    meanScore: Math.round(totalScore / 600),
    meanKnownByAttempt: sizes.map((s) => +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)),
    completeCollectionsBy12: completions.length,
    earliestFullCollection: Math.min(...completions),
    latestFullCollection: completions.length ? Math.max(...completions) : null,
    medianFullCollectionAmongCompleted:
      [...completions].sort((a, b) => a - b)[Math.floor(completions.length / 2)] ?? null,
  })
}
const result = {
  date: new Date().toISOString(),
  notes:
    '1200 heuristic campaigns, 50 fresh profiles per route policy, fixed default party; no recruitment or optimized combos. Completion sample is censored at 12 runs.',
  bossAttackFeedback: {
    phase: bossAfter.phase,
    card: feedback?.name,
    healAttributed: feedback?.heal,
    detail: feedback?.detail,
  },
  ashUpgrade: {
    offered: canUpgrade(ash),
    phaseAfter: upgradedAshRun.phase,
    upgraded: upgradedAsh.upgraded,
    before: cardDescription(ash),
    after: cardDescription(upgradedAsh),
  },
  leaderboard: {
    retained: profile.records.length,
    newCategorySaved: profile.records.some((r) => r.runId === 'new-category'),
    historyContainsIt: profile.history.some((r) => r.runId === 'new-category'),
  },
  bossFamilies: [...new Set(BOSSES.map((b) => b.rule))],
  cohorts,
}
writeFileSync('docs/critique-diagnostics.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
