import type { CareerState } from '../game/career'

export interface RumorDef {
  id: string
  text: string
  when: (career: CareerState) => boolean
}

/** Обрывки во Дворе. Источник Порчи не называется. */
export const RUMORS: RumorDef[] = [
  {
    id: 'yard-1',
    text: 'Во Дворе шепчут: пир не кончился, он просто сменил зал.',
    when: (c) => c.runs >= 1,
  },
  {
    id: 'no-tank',
    text: 'Без щита дорога считает вас закуской. Кто-то уже проверил.',
    when: (c) => !c.lastHadTank && c.lastChapter >= 2,
  },
  {
    id: 'deep',
    text: 'Дальше Трезвого Двора колокол слышно, но он не бьёт.',
    when: (c) => c.lastChapter >= 4,
  },
  {
    id: 'ash',
    text: 'Пепел с дороги гильдия принимает. Силу за него не продают.',
    when: (c) => c.ash >= 1 || c.runs >= 2,
  },
  {
    id: 'door',
    text: 'Боковые двери открываются тем, кто дошёл, а не тем, кто читал карту.',
    when: (c) => c.bestStage >= 15,
  },
  {
    id: 'mask',
    text: 'Маска Первого Кубка всё ещё улыбается. Это не комплимент.',
    when: (c) => c.runs >= 1,
  },
  {
    id: 'win',
    text: 'Распорядитель встал из-за стола. Гильдия делает вид, что так и задумано.',
    when: (c) => c.lastPerfect || c.crowns >= 1,
  },
  {
    id: 'bell',
    text: 'Немая Колокольня ближе, чем кажется с калитки.',
    when: (c) => c.bestStage >= 50,
  },
  {
    id: 'again',
    text: 'Новая пятёрка не помнит старую. Гильдия помнит.',
    when: (c) => c.runs >= 3,
  },
  {
    id: 'quiet',
    text: 'Откуда легла Порча, во Дворе не знают. И не спрашивают вслух.',
    when: (c) => c.runs >= 1,
  },
]
