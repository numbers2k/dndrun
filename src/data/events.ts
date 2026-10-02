import type { RegionEventOffer } from '../game/types'

/** Одно микрорешение лагеря. Не бой. На чётной главе вместо привала — жадный кубок. */
export function buildRegionEvents(chapter: number): RegionEventOffer[] {
  const ash = Math.max(1, chapter)
  const greedy = chapter >= 2 && chapter % 2 === 0
  return [
    {
      id: `ash-${chapter}`,
      label: 'Собрать пепел',
      detail: `+${ash} пепла в гильдию. Сила отряда не растёт.`,
      ash,
    },
    greedy
      ? {
          id: `cup-${chapter}`,
          label: 'Чужой кубок',
          detail: `+${ash + 2} пепла, зато сила на следующую главу −3.`,
          ash: ash + 2,
          ovrBuffer: -3,
        }
      : {
          id: `rest-${chapter}`,
          label: 'Привал',
          detail: 'Запас силы +4 на следующую главу. Пепла нет.',
          ovrBuffer: 4,
        },
  ]
}
