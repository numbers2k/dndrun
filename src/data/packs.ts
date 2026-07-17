import type { PackDef } from '../game/types'

const CHAPTERS = [
  'Двор пустых кубков',
  'Маскарадный марш',
  'Лунная зала',
  'Костяной пир',
  'Соляные погреба',
  'Багровый мост',
  'Склеп тостов',
  'Хоровод камня',
  'Причал неуезжающих',
  'Немая галерея',
]

const COMPANY = [
  'Железноклык',
  'Круг Масок',
  'Седьмой Кубок',
  'Лунные Клинки',
  'Стражи Рассола',
  'Тихая Рота',
  'Орден Искры',
  'Вороны Пира',
  'Каменная Стража',
  'Певцы Тишины',
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
