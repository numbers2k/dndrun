type StageBlue = {
  id: string
  name: string
  kind: 'route' | 'boss'
  chapter: number
  blurb: string
}

type TrialStatus = 'pending' | 'active' | 'cleared' | 'failed' | 'ghost'

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
  'Владыка пути не спит — слышит ваш шаг.',
  'Корона ещё на месте. Пока.',
]

const BOSS_FALLEN = [
  'Корона босса пала в пыль.',
  'Глава сдалась — путь дальше открыт.',
  'Его тень рассеялась. На время.',
]

const ROUTE_CLEARED = [
  'След пройден — впереди снова дорога.',
  'Засада разбита, пыль оседает.',
  'Вы прошли. Земля молчит вслед.',
]

const ROUTE_FAIL = [
  'Здесь путь оборвался.',
  'Пепел вместо победы.',
  'Отряд не выдержал этот клин.',
]

const BOSS_FAIL = [
  'Владыка остался на троне.',
  'Корона не дрогнула.',
  'Глава закрылась — слишком рано.',
]

const AHEAD = [
  'Ещё не ступали сюда.',
  'Туман впереди гуще.',
  'Дорога ждёт своего часа.',
]

const GHOST = [
  'Здесь вы уже бывали…',
  'Старый след карьеры.',
  'Память сейва, не этого забега.',
]

function pickStable(seed: string, options: string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return options[h % options.length] ?? options[0]
}

/** Верхняя строка лора: атмосфера места. */
export function stagePlaceLore(stage: StageBlue): string {
  if (stage.kind === 'boss') return stage.blurb
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
