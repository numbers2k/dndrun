import type { PartySlots, RadarVertex, SpellDef } from './types'
import { PARTY_SIZE } from './types'

/** Пять вершин = пять слотов отряда по часовой, начиная сверху. */
export function buildRadarVertices(
  party: PartySlots,
  spellPool: SpellDef[],
  assignment: Record<string, number | null>,
): RadarVertex[] {
  const assignedIndices = new Set(
    Object.values(assignment).filter((i): i is number => i !== null && i !== undefined),
  )
  const orphans = spellPool.filter((_, idx) => !assignedIndices.has(idx))
  let orphanIdx = 0

  return Array.from({ length: PARTY_SIZE }, (_, slotIndex) => {
    const adventurer = party[slotIndex] ?? null

    if (adventurer) {
      const poolIndex = assignment[adventurer.id]
      const spell =
        poolIndex !== null && poolIndex !== undefined
          ? (spellPool[poolIndex] ?? null)
          : null
      return {
        slotIndex,
        role: adventurer.role,
        adventurer,
        spell,
        spellOrphan: false,
      }
    }

    const orphan = orphans[orphanIdx] ?? null
    if (orphan) orphanIdx += 1
    return {
      slotIndex,
      role: null,
      adventurer: null,
      spell: orphan,
      spellOrphan: Boolean(orphan),
    }
  })
}
