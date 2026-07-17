import type { PackDef } from '../game/types'

const CHAPTERS = [
  'Пепельный грот',
  'Железный марш',
  'Лунная чащоба',
  'Костяной собор',
  'Соляные рудники',
  'Багровый мост',
  'Тихий склеп',
  'Громовая гряда',
  'Изумрудный дол',
  'Чёрный причал',
]

const COMPANY = [
  'Железноклык',
  'Пепельный Круг',
  'Седьмой Костёр',
  'Лунные Клинки',
  'Стражи Угля',
  'Тихая Рота',
  'Орден Искры',
  'Вороны Бездны',
  'Каменная Стража',
  'Певцы Пепла',
]

/** Шаблоны наборов: имя и глава. Состав рандомизируется при выдаче. */
function buildPackTemplates(): PackDef[] {
  const packs: PackDef[] = []
  let n = 0

  for (let c = 0; c < COMPANY.length; c += 1) {
    for (let ch = 0; ch < CHAPTERS.length; ch += 1) {
      packs.push({
        id: `pack-${n}`,
        name: COMPANY[c],
        chapter: `${CHAPTERS[ch]} · ${1200 + c * 3 + ch}`,
        adventurers: [],
        signatureSpells: [],
      })
      n += 1
    }
  }
  return packs
}

export const PACKS: PackDef[] = buildPackTemplates()
