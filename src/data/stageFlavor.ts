import { REGION_MAP, type RegionId } from './regions'

type StageBlue = {
  id: string
  name: string
  kind: 'route' | 'boss'
  chapter: number
  blurb: string
  unknown?: boolean
  regionId?: RegionId | null
}

type TrialStatus = 'pending' | 'active' | 'cleared' | 'failed' | 'ghost'

/** Feast-flavor по краю — дополняет общие маршрутные строки. */
const REGION_ROUTE_FLAVOR: Partial<Record<RegionId, string[]>> = {
  soberCourt: [
    'Трезвый двор пахнет золой вместо вина.',
    'Кубки пусты — и всё равно звенят.',
  ],
  saltMire: [
    'Соль скрипит под сапогами, воздух жжёт лёгкие.',
    'Топь тянет сапог, как чужой тост.',
  ],
  bonePass: [
    'Кости под ногами — чужие или ваши, ещё не ясно.',
    'Перевал хрустит, будто пьёт за вас.',
  ],
  moonRuins: [
    'Луна смотрит сквозь руины, как судья.',
    'Свет холодный — как вино без тепла.',
  ],
  echoCrypt: [
    'Шёпот в камне повторяет ваши имена.',
    'Эхо пьёт за тех, кого уже нет.',
  ],
  scrapFeast: [
    'Объедки пира хрустят под сапогом.',
    'Здесь пировали железом и ржавчиной.',
  ],
  crimsonBridge: [
    'Мост дрожит. Внизу — не вода.',
    'Кровь вместо реки — ступай короче.',
  ],
  muteBelfry: [
    'Колокол молчит громче грома.',
    'Последний ярус: пир слышит каждый шаг.',
  ],
}

/** Атмосфера маршрутов (индекс 0–8 внутри главы). */
const ROUTE_LORE = [
  'Пыль тракта и чужой взгляд из кювета.',
  'Туман липнет к клинкам — шаги слышны слишком громко.',
  'Соль скрипит под сапогами, воздух жжёт лёгкие.',
  'Кости под ногами — чужие или ваши, ещё не ясно.',
  'Луна смотрит сквозь руины, как судья.',
  'Шёпот в камне повторяет ваши имена.',
  'Мост дрожит. Внизу — не вода.',
  'Трещина в береге пахнет грозой и железом.',
  'Тёмный проход: за спиной свет гаснет раньше, чем должен.',
]

const BOSS_WAIT = [
  'Он уже ждёт у порога главы.',
  'Лицо Порчи не спит — слышит ваш шаг.',
  'Маска ещё на месте. Пока.',
]

const BOSS_FALLEN = [
  'Маска босса пала в пыль.',
  'Край сдался — путь дальше открыт.',
  'Его тень рассеялась. На время.',
]

const ROUTE_CLEARED = [
  'След пройден — впереди снова дорога.',
  'Засада разбита, пыль оседает.',
  'Вы прошли. Земля молчит вслед.',
]

const ROUTE_FAIL = [
  'Здесь путь оборвался.',
  'Пустой кубок вместо победы.',
  'Отряд не выдержал этот клин.',
]

const BOSS_FAIL = [
  'Распорядитель остался у стола.',
  'Пир не дрогнул.',
  'Край закрылся — слишком рано.',
]

const AHEAD = [
  'Ещё не ступали сюда.',
  'Туман впереди гуще.',
  'Дорога ждёт своего часа.',
]

const GHOST = [
  'Здесь вы уже бывали…',
  'Старый след карьеры.',
  'Память гильдии, не этой вылазки.',
]

function pickStable(seed: string, options: string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return options[h % options.length] ?? options[0]
}

/** Верхняя строка лора: атмосфера места / края. */
export function stagePlaceLore(stage: StageBlue, regionId?: RegionId | null): string {
  if (stage.unknown) return 'Край ещё не выбран'
  if (stage.kind === 'boss') return stage.blurb
  const rid = regionId ?? stage.regionId ?? null
  if (rid && REGION_MAP[rid]) {
    const regional = REGION_ROUTE_FLAVOR[rid]
    const routeIdx = (Number(stage.id.replace(/\D/g, '')) - 1) % 10
    if (regional?.length) {
      return regional[routeIdx % regional.length] ?? REGION_MAP[rid].blurb
    }
    const sniff = REGION_MAP[rid].blurb.split(/[.!?]/)[0]?.trim()
    if (sniff) return sniff
  }
  const routeIdx = (Number(stage.id.replace(/\D/g, '')) - 1) % 10
  if (routeIdx === 9) return stage.blurb
  return ROUTE_LORE[routeIdx] ?? stage.blurb
}

/**
 * Нижняя строка лора: что происходит сейчас / чем закончилось.
 * Без сухих «угроза vs состав».
 */
export function stageFateLore(
  stage: StageBlue,
  status: TrialStatus,
  seed = '',
): string {
  const key = `${seed}:${stage.id}:${status}`
  if (stage.unknown) return status === 'pending' ? '···' : ''
  if (status === 'ghost') return pickStable(key, GHOST)
  if (status === 'pending') return pickStable(key, AHEAD)
  if (status === 'active') {
    if (stage.kind === 'boss') return pickStable(key, BOSS_WAIT)
    return 'Сейчас решается этот отрезок.'
  }
  if (status === 'cleared') {
    if (stage.kind === 'boss') return pickStable(key, BOSS_FALLEN)
    return pickStable(key, ROUTE_CLEARED)
  }
  if (status === 'failed') {
    if (stage.kind === 'boss') return pickStable(key, BOSS_FAIL)
    return pickStable(key, ROUTE_FAIL)
  }
  return ''
}
