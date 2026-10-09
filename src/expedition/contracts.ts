import type { ContractId, HeroId, Profile } from './types'

export const CONTRACTS: Record<
  ContractId,
  { name: string; title: string; description: string; bonus: number; unlock: string }
> = {
  standard: {
    name: 'Обычный поход',
    title: 'Держать строй',
    description: 'Полный набор правил. Хорошая отправная точка для нового состава.',
    bonus: 1,
    unlock: 'Открыт сразу',
  },
  'no-healer': {
    name: 'Без целителя',
    title: 'Клятва без лекаря',
    description: 'Целитель не может войти в отряд. Лечение в пути и на привале остаётся.',
    bonus: 1.2,
    unlock: 'Откроется после первой победы над драконом',
  },
  'thin-hand': {
    name: 'Короткая рука',
    title: 'Дефицит времени',
    description: 'В начале хода берите на одну карту меньше. Очки за поход выше.',
    bonus: 1.25,
    unlock: 'Откроется после первой победы над драконом',
  },
  ashfall: {
    name: 'Пепельный след',
    title: 'Пепел за спиной',
    description: 'В каждом бою в колоду попадает одна карта Пепла. Она исчезает в конце хода.',
    bonus: 1.25,
    unlock: 'Откроется после двух побед над драконом',
  },
}

export const CONTRACT_IDS = Object.keys(CONTRACTS) as ContractId[]
export const DEFAULT_PARTY = ['warden', 'ranger', 'priest'] as const
export function partyIdentity(party: readonly HeroId[]) {
  return [...party].sort().join(',')
}

export function contractUnlocked(id: ContractId, profile: Profile) {
  if (id === 'standard') return true
  if (id === 'no-healer')
    return profile.wins >= 1 && profile.unlockedHeroes.filter((h) => h !== 'priest').length >= 3
  if (id === 'thin-hand') return profile.wins >= 1
  return profile.wins >= 2
}
