import { CARD_MAP, HEROES } from './data'
import type { HeroId } from './types'

export function partyCoverage(party: readonly HeroId[]) {
  const cards = party.flatMap((id) => [
    HEROES[id].cards[0],
    HEROES[id].cards[0],
    HEROES[id].cards[1],
    HEROES[id].cards[2],
  ])
  return {
    block: cards.filter((id) => CARD_MAP[id].block).length,
    healing: cards.filter((id) => CARD_MAP[id].heal).length,
  }
}
