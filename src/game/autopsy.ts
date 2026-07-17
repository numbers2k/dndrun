import type { RunResult, ScoreBreakdown, SimMatch, SynergyAxes } from './types'

export type AxisKey = keyof SynergyAxes

const AXIS_META: { key: AxisKey; label: string; tip: string }[] = [
  { key: 'base', label: 'База', tip: 'Бери героев с выше личным рейтингом — база тянет силу.' },
  {
    key: 'roleFit',
    label: 'Посадка',
    tip: 'Сажай роли ближе к классу и расе — офф-мета режет вклад.',
  },
  {
    key: 'statFit',
    label: 'Статы',
    tip: 'Танку нужна надёжность, удару — удар, контролю — ресурс.',
  },
  {
    key: 'spellFit',
    label: 'Спеллы',
    tip: 'Бери спеллы родных классов и пересаживай их на подходящих героев.',
  },
  {
    key: 'bondFit',
    label: 'Связки',
    tip: 'Ищи пары по расе, роли или классу — связки дают запас.',
  },
  {
    key: 'coverage',
    label: 'Роли',
    tip: 'Закрой дыры в ролях — особенно разведку и танк.',
  },
  {
    key: 'antiSynergy',
    label: 'Анти',
    tip: 'Не сажай тяжёлые спеллы на «стекло» и не копи одну роль.',
  },
]

const REASON_TIPS: Record<string, string> = {
  'дыры в ролях': 'В следующем драфте закрой недостающую роль.',
  'слабая посадка ролей': 'Бери героев с посадкой ближе к роли класса.',
  'слабые спеллы': 'Усиль native-class спеллы или пересади пул.',
  антисинергия: 'Убери стекло + тяжёлую магию или разгрузи монороль.',
  'угроза заметно выше состава': 'Нужен выше общий OVR или осторожный путь в лагере.',
  'угроза выше состава': 'Подтяни слабую ось или возьми безопасный маршрут.',
  'не хватило запаса силы': 'Копи связки и посадку — запас решает пограничные этапы.',
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
    ? `Последняя вылазка: пир оборван · ${result.placeLabel} · сила ${result.score.overall}`
    : `Прошлая вылазка оборвалась на этапе ${failedStage}${failName ? ` (${failName.replace(/\s*·\s*гл\.\d+\s*$/i, '')})` : ''} — ${tip}`

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
