import { HERO_RARITY_WEIGHTS, SPELL_RARITY_WEIGHTS } from './balance'
import type { SeededRng } from './rng'
import type { CardRarity } from './types'

export function rarityLabel(rarity: CardRarity): string {
  if (rarity === 'legendary') return 'Легендарная'
  if (rarity === 'rare') return 'Редкая'
  return 'Обычная'
}

/** Краткая форма для спеллов (средний род). */
export function spellRarityLabel(rarity: CardRarity): string {
  if (rarity === 'legendary') return 'Легендарное'
  if (rarity === 'rare') return 'Редкое'
  return 'Обычное'
}

export function rollWeightedRarity(
  rng: SeededRng,
  weights: Record<CardRarity, number>,
): CardRarity {
  const entries: CardRarity[] = ['common', 'rare', 'legendary']
  const total = entries.reduce((s, r) => s + weights[r], 0)
  let roll = rng.next() * total
  for (const r of entries) {
    roll -= weights[r]
    if (roll <= 0) return r
  }
  return 'common'
}

export function rollHeroRarity(rng: SeededRng): CardRarity {
  return rollWeightedRarity(rng, HERO_RARITY_WEIGHTS)
}

export function pickWeightedByRarity<T extends { rarity: CardRarity }>(
  rng: SeededRng,
  pool: T[],
  weights: Record<CardRarity, number> = SPELL_RARITY_WEIGHTS,
): T {
  if (pool.length === 0) throw new Error('empty rarity pool')
  if (pool.length === 1) return pool[0]

  const buckets: Record<CardRarity, T[]> = {
    common: [],
    rare: [],
    legendary: [],
  }
  for (const item of pool) buckets[item.rarity].push(item)

  const available = (['common', 'rare', 'legendary'] as CardRarity[]).filter(
    (r) => buckets[r].length > 0,
  )
  const total = available.reduce((s, r) => s + weights[r], 0)
  let roll = rng.next() * total
  let chosen: CardRarity = available[0]
  for (const r of available) {
    roll -= weights[r]
    if (roll <= 0) {
      chosen = r
      break
    }
  }
  return rng.pick(buckets[chosen])
}
