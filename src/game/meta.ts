import { PROPHECIES } from '../data/prophecies'
import { REGION_UNLOCK_TABLE } from '../data/regions'
import { RUMORS } from '../data/rumors'
import {
  getSaveById,
  loadCareer,
  saveCareer,
  setActiveSave,
  type CareerState,
} from './career'

export function dailySeed(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `daily-${y}-${m}-${d}`
}

/** Строка для друзей: глубина без названий краёв. */
export function shareRunLine(chaptersCleared: number, perfect: boolean): string {
  const n = Math.max(0, Math.min(10, chaptersCleared))
  const cells = Array.from({ length: 10 }, (_, i) => (i < n ? '🟩' : '⬛')).join('')
  return perfect ? `Пир оборван ${cells} 10/10` : `Пир ${cells} ${n}/10`
}

export function rememberBlueprints(spells: { id: string; rarity: string }[]): void {
  const rare = spells.filter((s) => s.rarity !== 'common').map((s) => s.id)
  if (rare.length === 0) return
  const career = loadCareer()
  const blueprints = [...new Set([...(career.blueprints ?? []), ...rare])]
  if (blueprints.length === (career.blueprints ?? []).length) return
  saveCareer({ ...career, blueprints })
}

export function claimProphecies(career: CareerState): { career: CareerState; lines: string[] } {
  const done = new Set(career.prophecyDone ?? [])
  const blueprints = new Set(career.blueprints ?? [])
  const unlockedRegions = [...career.unlockedRegions]
  let ash = career.ash ?? 0
  const lines: string[] = []
  for (const prophecy of PROPHECIES) {
    if (done.has(prophecy.id) || !prophecy.done(career)) continue
    done.add(prophecy.id)
    lines.push(prophecy.reward)
    if (prophecy.spellId) blueprints.add(prophecy.spellId)
    if (prophecy.id === 'spells') ash += 6
    if (prophecy.unlockDoor) {
      const door = REGION_UNLOCK_TABLE.find((row) => !unlockedRegions.includes(row.id))
      if (door) {
        unlockedRegions.push(door.id)
        lines[lines.length - 1] = door.label
      }
    }
  }
  if (lines.length === 0) return { career, lines }
  return {
    career: {
      ...career,
      prophecyDone: [...done],
      blueprints: [...blueprints],
      unlockedRegions,
      ash,
    },
    lines,
  }
}

export function pullRumor(career: CareerState): { career: CareerState; line: string | null } {
  if ((career.rumorsSeenCount ?? 0) >= career.runs) {
    return { career, line: career.lastRumor || null }
  }
  const heard = new Set(career.heardRumors ?? [])
  const next =
    RUMORS.find((rumor) => !heard.has(rumor.id) && rumor.when(career)) ??
    RUMORS.find((rumor) => rumor.when(career))
  if (!next) return { career, line: career.lastRumor || null }
  heard.add(next.id)
  return {
    career: {
      ...career,
      heardRumors: [...heard],
      rumorsSeenCount: career.runs,
      lastRumor: next.text,
    },
    line: next.text,
  }
}

export function addAsh(amount: number): void {
  if (amount <= 0) return
  const career = loadCareer()
  saveCareer({ ...career, ash: (career.ash ?? 0) + amount })
}

export const ASH_REROLL_COST = 2
export const ASH_DOOR_COST = 4

export function spendAsh(saveId: string, kind: 'reroll' | 'door'): string {
  setActiveSave(saveId)
  const save = getSaveById(saveId)
  if (!save) return 'Нет записи'
  const career = save.career
  if (kind === 'reroll') {
    if ((career.ash ?? 0) < ASH_REROLL_COST) return `Нужно ${ASH_REROLL_COST} пепла`
    saveCareer({
      ...career,
      ash: career.ash - ASH_REROLL_COST,
      bonusRerolls: (career.bonusRerolls ?? 0) + 1,
    })
    return 'Переброс ляжет на следующую вылазку'
  }
  if ((career.ash ?? 0) < ASH_DOOR_COST) return `Нужно ${ASH_DOOR_COST} пепла`
  const door = REGION_UNLOCK_TABLE.find((row) => !career.unlockedRegions.includes(row.id))
  if (!door) return 'Все двери уже открыты'
  saveCareer({
    ...career,
    ash: career.ash - ASH_DOOR_COST,
    unlockedRegions: [...career.unlockedRegions, door.id],
  })
  return door.label
}

export function setSeals(saveId: string, seals: number): void {
  setActiveSave(saveId)
  const save = getSaveById(saveId)
  if (!save || (save.career.crowns ?? 0) < 1) return
  const next = Math.max(0, Math.min(3, Math.round(seals)))
  saveCareer({ ...save.career, seals: next })
}
