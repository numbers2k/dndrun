import { CARD_MAP } from '../src/expedition/data.ts'
import {
  buy,
  continueEndless,
  retire,
  chooseNode,
  endTurn,
  eventChoice,
  leaveShop,
  newRun,
  playable,
  playCard,
  rest,
  takeReward,
  values,
} from '../src/expedition/engine.ts'
import type { Card, HeroId, Run } from '../src/expedition/types.ts'

export function cardRating(c: Card) {
  const d = values(c)
  return (
    (d.damage ?? 0) / (d.cost || 0.7) +
    (d.poison ?? 0) * 1.6 +
    (d.block ?? 0) * 0.6 +
    (d.heal ?? 0) * 1.5 +
    (d.energy ?? 0) * 9 +
    (d.draw ?? 0) * 5 +
    (d.vulnerable ?? 0) * 4 +
    (c.upgraded ? 3 : 0)
  )
}
export function action(
  r: Run,
  strategy: 'tactical' | 'reckless' = 'tactical',
): { uid: string; target: number } | null {
  const b = r.combat!
  let best: { uid: string; target: number } | null = null,
    score = 0
  for (const c of b.hand) {
    if (!playable(r, c)) continue
    const d = values(c)
    const targets =
      d.target === 'enemy'
        ? b.enemies.map((_, i) => i).filter((i) => b.enemies[i].hp > 0)
        : d.target === 'ally'
          ? r.party.map((_, i) => i).filter((i) => r.party[i].hp > 0)
          : [0]
    for (const target of targets) {
      let s = 0
      const foes =
        d.target === 'all'
          ? b.enemies.filter((e) => e.hp > 0)
          : d.target === 'enemy'
            ? [b.enemies[target]]
            : []
      for (const e of foes) {
        let damage =
          (d.damage ?? 0) +
          (d.damage && r.relics.includes('whetstone') ? 2 : 0) +
          (d.damage && d.hero === 'ranger' && !b.rangerUsed ? 3 : 0) +
          (d.damage && d.hero === 'rogue' && e.vulnerable ? 3 : 0)
        if (e.vulnerable) damage = Math.floor(damage * 1.5)
        damage = Math.max(0, damage - (d.id === 'pierce' ? 0 : e.block))
        s += Math.min(e.hp, damage) * (strategy === 'reckless' ? 1 : 1.1)
        if (damage >= e.hp) s += 15 + e.intent.damage * 1.5
        if (strategy === 'tactical') {
          s += (d.poison ?? 0) * Math.min(2.2, e.hp / 15)
          if (d.vulnerable && !e.vulnerable)
            s += b.hand.some(
              (x) => x.uid !== c.uid && CARD_MAP[x.id].damage && CARD_MAP[x.id].cost <= b.energy,
            )
              ? 10
              : 2
        }
      }
      if (strategy === 'tactical') {
        const allies =
          d.target === 'all'
            ? r.party.map((_, i) => i)
            : [d.target === 'ally' ? target : r.party.findIndex((h) => h.id === d.hero)]
        for (const i of allies) {
          const h = r.party[i]
          if (h.hp <= 0) continue
          const incoming = b.enemies
            .filter((e) => e.hp > e.poison && (e.intent.target === i || e.intent.target === -1))
            .reduce(
              (n, e) => n + e.intent.damage + (e.intent.damage ? Math.max(0, b.turn - 7) * 2 : 0),
              0,
            )
          s +=
            Math.min(d.block ?? 0, Math.max(0, incoming - h.block)) * (h.hp < incoming ? 2.4 : 1.25)
          s +=
            Math.min((d.heal ?? 0) + (d.heal && d.hero === 'priest' ? 2 : 0), h.maxHp - h.hp) *
            (h.hp < 15 ? 1.8 : 1.2)
        }
        s += (d.energy ?? 0) * 8 + (d.draw ?? 0) * 3
      }
      s -= d.cost * 0.3
      if (s > score) {
        score = s
        best = { uid: c.uid, target }
      }
    }
  }
  return best
}
export function simulate(
  seed: string,
  leader: HeroId,
  strategy: 'tactical' | 'reckless' = 'tactical',
  mode: Run['mode'] = 'normal',
  endlessCycles = 0,
) {
  let r = newRun(leader, seed, mode),
    steps = 0
  while (!['victory', 'defeat'].includes(r.phase) && steps++ < 3000) {
    if (r.phase === 'checkpoint') {
      r =
        r.depth < 15 * (endlessCycles + 1)
          ? continueEndless(r, leader === 'ranger' ? 'venom' : leader === 'mage' ? 'flow' : 'edge')
          : retire(r)
    } else if (r.phase === 'combat') {
      const a = action(r, strategy)
      r = a ? playCard(r, a.uid, a.target) : endTurn(r)
    } else if (r.phase === 'route') {
      const hp = r.party.reduce((n, h) => n + h.hp, 0) / r.party.reduce((n, h) => n + h.maxHp, 0)
      const priority =
        strategy === 'reckless'
          ? ['battle', 'boss', 'elite']
          : hp < 0.64 || r.party.some((h) => h.hp <= 0)
            ? ['rest', 'event', 'shop', 'battle', 'boss']
            : ['event', 'rest', 'shop', 'battle', 'boss']
      const node =
        priority.map((k) => r.nodes.find((n) => n.kind === k)).find(Boolean) ?? r.nodes[0]
      r = chooseNode(r, node.id)
    } else if (r.phase === 'reward') {
      const c = [...r.reward!.cards].sort((x, y) => cardRating(y) - cardRating(x))[0]
      r = takeReward(
        r,
        strategy === 'reckless' ? c.uid : cardRating(c) > 13 && r.deck.length < 19 ? c.uid : null,
      )
    } else if (r.phase === 'rest') {
      const injured = r.party.some((h) => h.hp < h.maxHp * 0.65),
        fallen = r.party.some((h) => h.hp <= 0)
      const c = [...r.deck]
        .filter((c) => !c.upgraded)
        .sort((x, y) => cardRating(y) - cardRating(x))[0]
      r = rest(r, fallen ? 'revive' : injured || !c ? 'heal' : 'upgrade', c?.uid)
    } else if (r.phase === 'event') {
      const wounded = r.party.some((h) => h.hp < h.maxHp * 0.6)
      r = eventChoice(
        r,
        r.eventId === 0
          ? wounded
            ? 'a'
            : 'b'
          : r.eventId === 1
            ? r.gold >= 25
              ? 'a'
              : 'b'
            : wounded
              ? 'b'
              : 'a',
      )
    } else if (r.phase === 'shop') {
      if (r.gold >= 70 && r.shopRelic) r = buy(r, 'relic')
      const c = [...r.shopCards].sort((x, y) => cardRating(y) - cardRating(x))[0]
      if (c && cardRating(c) > 16 && r.gold >= 35) r = buy(r, 'card', c.uid)
      r = leaveShop(r)
    }
  }
  if (steps >= 3000) throw new Error(`Run did not terminate: ${seed}, ${r.phase}`)
  return r
}
