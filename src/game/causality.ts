import type { ScoreBreakdown } from './types'

export interface CauseLine {
  label: string
  delta: number
}

export function chapterPower(
  overall: number,
  mods: { ovrBuffer: number; modFromStage: number | null; modUntilStage: number | null },
  chapter: number,
): number {
  const stage = Math.max(0, chapter - 1) * 10
  const active =
    (mods.modFromStage === null || stage >= mods.modFromStage) &&
    (mods.modUntilStage === null || stage < mods.modUntilStage)
  return overall + (active ? mods.ovrBuffer : 0)
}
/** Глава, на которой вылазка оборвалась. stagesCleared — число уже взятых этапов. */
export function failChapter(stagesCleared: number): number {
  const cleared = Math.max(0, stagesCleared)
  return Math.min(10, Math.max(1, Math.ceil((cleared + 1) / 10)))
}

/** Сколько глав закрыто целиком. На границе 10/20/… смерть уже в следующей главе. */
export function clearedChapters(stagesCleared: number, perfect: boolean): number {
  if (perfect) return 10
  return Math.max(0, failChapter(stagesCleared) - 1)
}

export function chapterCauses(
  score: ScoreBreakdown,
  threat: number,
  missingLabels: string[],
  reserve = 0,
): CauseLine[] {
  const lines: CauseLine[] = [{ label: 'База отряда', delta: Math.round(score.axes.base) }]
  if (score.axes.bondFit) lines.push({ label: 'Связки', delta: Math.round(score.axes.bondFit) })
  if (score.axes.spellFit) lines.push({ label: 'Заклинания', delta: Math.round(score.axes.spellFit) })
  if (score.axes.coverage) lines.push({ label: 'Роли', delta: Math.round(score.axes.coverage) })
  if (reserve > 0) lines.push({ label: 'Запас силы', delta: reserve })
  for (const label of missingLabels) {
    lines.push({ label, delta: -2 })
  }
  lines.push({ label: 'Угроза главы', delta: -Math.round(threat) })
  return lines
}
