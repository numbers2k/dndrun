import { failChapter } from './causality'
import type { RunResult, ScoreBreakdown, SimMatch, SynergyAxes } from './types'

export type AxisKey = keyof SynergyAxes

const AXIS_META: { key: AxisKey; label: string; tip: string }[] = [
  { key: 'base', label: 'Герои', tip: 'Бери героев с числом повыше — оно тянет силу отряда.' },
  {
    key: 'roleFit',
    label: 'Свои места',
    tip: 'Герой сильнее, когда роль совпадает с тем, кем он назван.',
  },
  {
    key: 'statFit',
    label: 'Склад',
    tip: 'Танку нужна стойкость, удару — напор, поддержке — запас.',
  },
  {
    key: 'spellFit',
    label: 'Заклинания',
    tip: 'Бери заклинание, которое садится на кого-то из отряда.',
  },
  {
    key: 'bondFit',
    label: 'Связки',
    tip: 'Два разных героя рядом дают больше, чем два одинаковых.',
  },
  {
    key: 'coverage',
    label: 'Роли',
    tip: 'Не бери вторую такую же роль, пока не закрыты другие.',
  },
  {
    key: 'antiSynergy',
    label: 'Помеха',
    tip: 'Одинаковые роли и проклятые карты режут отряд.',
  },
]

const REASON_TIPS: Record<string, string> = {
  'одни и те же роли': 'В следующий раз возьми роль, которой ещё нет.',
  'герои не на своих местах': 'Смотри глагол на карте: он должен совпадать с делом героя.',
  'заклинания плохо сидят': 'Бери заклинание с пометкой «сядет» — оно для кого-то из отряда.',
  'отряд мешает сам себе': 'Разведи одинаковые роли и не копи проклятые карты.',
  'угроза заметно выше состава': 'Перед дверью посмотри силу и порог главы. Если не хватает — возьми героя.',
  'угроза выше состава': 'Тише дверь или ещё один герой. Иначе следующая глава оборвётся.',
  'не хватило запаса силы': 'Связка двух разных ролей даёт запас на пограничной главе.',
}

export interface RunAutopsy {
  perfect: boolean
  failedStage: number | null
  place: number
  placeLabel: string
  record: string
  wins: number
  losses: number
  championName: string
  reasons: string[]
  weakest: { key: AxisKey; label: string; value: number }
  tip: string
  failEncounters: SimMatch[]
  hubLine: string
}

function weakestAxis(axes: SynergyAxes): { key: AxisKey; label: string; value: number } {
  let worst = AXIS_META[0]
  let value = axes[worst.key]
  for (const meta of AXIS_META) {
    if (axes[meta.key] < value) {
      worst = meta
      value = axes[meta.key]
    }
  }
  return { key: worst.key, label: worst.label, value }
}

function tipFrom(reasons: string[], weakest: { key: AxisKey; label: string; value: number }): string {
  for (const r of reasons) {
    const mapped = REASON_TIPS[r]
    if (mapped) return mapped
  }
  return AXIS_META.find((a) => a.key === weakest.key)?.tip ?? 'Собери отряд плотнее и попробуй снова.'
}

export function buildRunAutopsy(result: RunResult, score?: ScoreBreakdown): RunAutopsy {
  const axes = score?.axes ?? result.score.axes
  const perfect = result.perfect
  const failedStage = perfect ? null : Math.min(result.stagesCleared + 1, 100)
  const failIdx = perfect ? -1 : result.stagesCleared
  const reasons = failIdx >= 0 ? (result.stageReasons[failIdx] ?? []).slice(0, 3) : []
  const weakest = weakestAxis(axes)
  const tip = perfect
    ? 'Пир оборван. Новая вылазка — ради других краёв Порчи или рекорда силы.'
    : tipFrom(reasons, weakest)

  // stageNames — только пройденные; имя провала берём из матчей.
  const failMatch = failIdx >= 0 ? result.matches.find((m) => !m.won) : undefined
  const failName = failMatch?.round ?? null

  const failEncounters =
    failIdx >= 0 && failName
      ? result.matches.filter((m) => m.round === failName)
      : failIdx >= 0
        ? result.matches.filter((m) => !m.won)
        : []

  // Prefer encounters from the fail stage by matching round prefix / last losses
  let encounters = failEncounters
  if (encounters.length === 0 && !perfect) {
    const losses = result.matches.filter((m) => !m.won)
    const lastLoss = losses[losses.length - 1]
    if (lastLoss) {
      encounters = result.matches.filter((m) => m.round === lastLoss.round)
    }
  }

  const hubLine = perfect
    ? `Последняя вылазка: пир оборван · сила ${result.score.overall}`
    : `Прошлая вылазка оборвалась на главе ${failChapter(result.stagesCleared)} — ${tip}`

  return {
    perfect,
    failedStage,
    place: result.place,
    placeLabel: result.placeLabel,
    record: result.record,
    wins: result.wins,
    losses: result.losses,
    championName: result.championName,
    reasons,
    weakest,
    tip,
    failEncounters: encounters.slice(0, 4),
    hubLine,
  }
}
