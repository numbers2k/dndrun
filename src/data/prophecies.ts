import type { CareerState } from '../game/career'

export interface ProphecyDef {
  id: string
  text: string
  reward: string
  goal: number
  spellId?: string
  unlockDoor?: boolean
  cur: (career: CareerState) => number
  done: (career: CareerState) => boolean
}

export const PROPHECIES: ProphecyDef[] = [
  {
    id: 'ch1',
    text: 'Пройти первую главу',
    reward: 'Чертёж: Подмога',
    goal: 1,
    spellId: 's003',
    cur: (c) => Math.min(1, Math.floor(c.bestStage / 10)),
    done: (c) => c.bestStage >= 10,
  },
  {
    id: 'ch2',
    text: 'Дойти до главы 2',
    reward: 'Чертёж: Сигнал',
    goal: 2,
    spellId: 's004',
    cur: (c) => Math.min(2, Math.floor(c.bestStage / 10)),
    done: (c) => c.bestStage >= 20,
  },
  {
    id: 'ch3',
    text: 'Дойти до главы 3',
    reward: 'Чертёж: Кислотная стрела',
    goal: 3,
    spellId: 's001',
    cur: (c) => Math.min(3, Math.floor(c.bestStage / 10)),
    done: (c) => c.bestStage >= 30,
  },
  {
    id: 'runs3',
    text: 'Три вылазки',
    reward: 'Чертёж: Кислотные брызги',
    goal: 3,
    spellId: 's002',
    cur: (c) => Math.min(3, c.runs),
    done: (c) => c.runs >= 3,
  },
  {
    id: 'doors',
    text: 'Увидеть 4 края',
    reward: 'Новая дверь Порчи',
    goal: 4,
    unlockDoor: true,
    cur: (c) => Math.min(4, c.seenRegions.length),
    done: (c) => c.seenRegions.length >= 4,
  },
  {
    id: 'ch5',
    text: 'Дойти до главы 5',
    reward: 'Чертёж: Дружба с животными',
    goal: 5,
    spellId: 's006',
    cur: (c) => Math.min(5, Math.floor(c.bestStage / 10)),
    done: (c) => c.bestStage >= 50,
  },
  {
    id: 'spells',
    text: 'Встретить 12 заклинаний',
    reward: 'Пепел +6',
    goal: 12,
    cur: (c) => Math.min(12, c.seenSpellIds.length),
    done: (c) => c.seenSpellIds.length >= 12,
  },
  {
    id: 'ch8',
    text: 'Дойти до главы 8',
    reward: 'Чертёж: Поднять мертвеца',
    goal: 8,
    spellId: 's009',
    cur: (c) => Math.min(8, Math.floor(c.bestStage / 10)),
    done: (c) => c.bestStage >= 80,
  },
  {
    id: 'crown',
    text: 'Оборвать пир',
    reward: 'Печать Пира открыта',
    goal: 1,
    cur: (c) => Math.min(1, c.crowns),
    done: (c) => c.crowns >= 1,
  },
  {
    id: 'ash',
    text: 'Принести 8 пепла',
    reward: 'Чертёж: Животный вестник',
    goal: 8,
    spellId: 's007',
    cur: (c) => Math.min(8, c.ash),
    done: (c) => c.ash >= 8,
  },
]

export function prophecyRows(career: CareerState): {
  id: string
  text: string
  reward: string
  cur: number
  goal: number
  done: boolean
}[] {
  const finished = new Set(career.prophecyDone ?? [])
  return PROPHECIES.map((p) => ({
    id: p.id,
    text: p.text,
    reward: p.reward,
    cur: p.cur(career),
    goal: p.goal,
    done: finished.has(p.id) || p.done(career),
  }))
}
