import type { ClassId, RaceId } from '../game/types'

export const RACE_LABEL: Record<RaceId, string> = {
  human: 'Человек',
  elf: 'Эльф',
  dwarf: 'Дварф',
  halfling: 'Полурослик',
  dragonborn: 'Драконорожденный',
  gnome: 'Гном',
  halfOrc: 'Полуорк',
  tiefling: 'Тифлинг',
  halfElf: 'Полуэльф',
}

export const CLASS_LABEL: Record<ClassId, string> = {
  fighter: 'Воин',
  wizard: 'Волшебник',
  cleric: 'Жрец',
  rogue: 'Плут',
  ranger: 'Следопыт',
  paladin: 'Паладин',
  barbarian: 'Варвар',
  bard: 'Бард',
  warlock: 'Колдун',
  druid: 'Друид',
  monk: 'Монах',
  sorcerer: 'Чародей',
}

/** Метка уровня в бейдже карточки спелла (как роль у героя): Фокус / N уровень. */
export function spellLevelLabel(level: number): string {
  return level === 0 ? 'Фокус' : `${level} уровень`
}

/** Компактная метка уровня в списках/модалках: Ф или число. */
export function spellLevelMark(level: number): string {
  return level === 0 ? 'Ф' : String(level)
}

export function spellLevelHint(level: number): string {
  return level === 0
    ? 'Заговор (0 уровень) — без слота'
    : `Ячейка ${level} уровня`
}
