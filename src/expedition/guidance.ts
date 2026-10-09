import { CARD_MAP, HEROES } from './data'
import { comboMultiplier, playable, values, endTurn, playCard, cardCost } from './engine'
import type { Card } from './types'
import type { Run } from './types'

export function chainHint(r: Run): string {
  const b = r.combat
  if (!b) return ''
  if (!b.lastHero) return 'Начните серию. Следующая карта другого героя продолжит её.'
  if (r.rules < 5)
    return `После ${HEROES[b.lastHero].name} сыграйте другого героя. Повтор героя сбросит серию.`
  const next = b.chain + 1,
    mult =
      1 +
      Math.min(4, Math.floor((next - 1) / 2)) * 0.25 +
      (next >= 3 && r.relics.includes('conductor') ? 0.25 : 0)
  const bonus =
    next === 3 && (b.turnChain ?? 0) < 3 && (r.rules < 6 || (b.bonusDraw ?? 0) < 4)
      ? ' и +1 карта'
      : next === 5 && (b.turnChain ?? 0) < 5
        ? ' и +1 энергия'
        : ''
  return `После ${HEROES[b.lastHero].name} — другой герой: шаг ${next}, урон ×${mult}${bonus}. Повтор героя сбросит серию.`
}
export function turnOptions(r: Run) {
  if (r.phase !== 'combat' || !r.combat) return { playable: 0, useful: 0, free: 0 }
  const b = r.combat
  const cards = b.hand.filter((c) => playable(r, c))
  const useful = cards.filter((c) => {
    const d = values(c)
    if (d.damage || d.poison || d.vulnerable || d.energy || d.draw) return true
    if (d.cleanse && [...b.hand, ...b.draw, ...b.discard].some((x) => CARD_MAP[x.id].junk))
      return true
    if (d.heal && r.party.some((h) => h.hp > 0 && h.hp < h.maxHp)) return true
    if (d.block && b.enemies.some((e) => e.hp > 0 && e.intent.damage > 0)) return true
    return (
      b.lastHero !== null && b.lastHero !== d.hero && comboMultiplier(r, c) > comboMultiplier(r)
    )
  })
  return {
    playable: cards.length,
    useful: useful.length,
    free: cards.filter((c) => cardCost(r, c) === 0).length,
  }
}
export function turnForecast(r: Run) {
  if (r.phase !== 'combat' || !r.combat) return null
  // Use the real resolution on an immutable copy: poison, deaths, retargets and armor agree.
  const next = endTurn(r)
  return {
    wounds: r.party.map((h, i) => Math.max(0, h.hp - next.party[i].hp)),
    falls: r.party.map((h, i) => h.hp > 0 && next.party[i].hp <= 0),
    victory: next.phase === 'reward',
    defeated: r.combat.enemies.map(
      (e) => e.hp > 0 && (next.combat!.enemies.find((x) => x.uid === e.uid)?.hp ?? 0) === 0,
    ),
  }
}
export function allyEffect(r: Run, c: Card, index: number) {
  if (!playable(r, c) || CARD_MAP[c.id].target !== 'ally' || !r.party[index]?.hp) return null
  const next = playCard(r, c.uid, index)
  return {
    heal: next.party[index].hp - r.party[index].hp,
    block: next.party[index].block - r.party[index].block,
    wounds: turnForecast(next)?.wounds[index] ?? 0,
  }
}
