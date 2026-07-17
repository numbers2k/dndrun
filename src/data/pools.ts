import type { ClassId, RaceId, RoleId } from '../game/types'

export type SubclassId =
  | 'champion'
  | 'eldritchKnight'
  | 'evoker'
  | 'abjurer'
  | 'lifeDomain'
  | 'warDomain'
  | 'thief'
  | 'assassin'
  | 'hunter'
  | 'beastMaster'
  | 'oathDevotion'
  | 'oathVengeance'
  | 'berserker'
  | 'totem'
  | 'loreCollege'
  | 'valorCollege'
  | 'fiendPatron'
  | 'archfey'
  | 'landCircle'
  | 'moonCircle'
  | 'openHand'
  | 'shadow'
  | 'draconic'
  | 'wildMagic'

export const FIRST_NAMES = [
  'Ара', 'Бренна', 'Вэйл', 'Гаррет', 'Данн', 'Элдра', 'Фенн', 'Харн', 'Ивэль', 'Касс',
  'Кира', 'Лира', 'Мара', 'Мира', 'Ним', 'Оррик', 'Пип', 'Ривен', 'Рук', 'Сайра',
  'Сара', 'Сильва', 'Том', 'Торг', 'Ульф', 'Векс', 'Войда', 'Эзра', 'Элиан', 'Ашлин',
  'Брикк', 'Дракс', 'Йорн', 'Келл', 'Люсьен', 'Найра', 'Оуэн', 'Рея', 'Сторм', 'Талия',
]

export const ALL_RACES: RaceId[] = [
  'human',
  'elf',
  'dwarf',
  'halfling',
  'dragonborn',
  'gnome',
  'halfOrc',
  'tiefling',
  'halfElf',
]

export const ALL_CLASSES: ClassId[] = [
  'fighter',
  'wizard',
  'cleric',
  'rogue',
  'ranger',
  'paladin',
  'barbarian',
  'bard',
  'warlock',
  'druid',
  'monk',
  'sorcerer',
]

export const ALL_ROLES: RoleId[] = ['tank', 'striker', 'controller', 'support', 'scout']

/** class × role affinity: -3 … +3 */
export const CLASS_ROLE_AFFINITY: Record<ClassId, Record<RoleId, number>> = {
  fighter: { tank: 3, striker: 2, controller: -1, support: -1, scout: 0 },
  wizard: { tank: -3, striker: 0, controller: 3, support: 1, scout: -1 },
  cleric: { tank: 1, striker: -1, controller: 1, support: 3, scout: -2 },
  rogue: { tank: -2, striker: 2, controller: 0, support: -2, scout: 3 },
  ranger: { tank: -1, striker: 2, controller: 0, support: 0, scout: 3 },
  paladin: { tank: 3, striker: 1, controller: -1, support: 2, scout: -2 },
  barbarian: { tank: 2, striker: 3, controller: -2, support: -2, scout: 0 },
  bard: { tank: -1, striker: 0, controller: 1, support: 3, scout: 1 },
  warlock: { tank: -3, striker: 1, controller: 3, support: 0, scout: 0 },
  druid: { tank: 0, striker: 0, controller: 2, support: 2, scout: 1 },
  monk: { tank: 1, striker: 2, controller: 0, support: -1, scout: 2 },
  sorcerer: { tank: -3, striker: 2, controller: 3, support: 0, scout: -1 },
}

/** Soft race modifiers for roles */
export const RACE_ROLE_MOD: Partial<Record<RaceId, Partial<Record<RoleId, number>>>> = {
  dwarf: { tank: 1, scout: -1 },
  elf: { scout: 1, controller: 1, tank: -1 },
  halfOrc: { tank: 1, striker: 1, support: -1 },
  halfling: { scout: 1, tank: -1 },
  dragonborn: { tank: 1, striker: 1 },
  gnome: { controller: 1, support: 1 },
  tiefling: { controller: 1, striker: 1 },
  halfElf: { support: 1, scout: 1 },
  human: {},
}

export interface SubclassDef {
  id: SubclassId
  name: string
  classId: ClassId
  /** Bonus to roleFit for preferred roles */
  roleBonus: Partial<Record<RoleId, number>>
  /** Bonus to spell schools */
  schoolBonus: Record<string, number>
}

export const SUBCLASSES: SubclassDef[] = [
  { id: 'champion', name: 'Чемпион', classId: 'fighter', roleBonus: { tank: 1, striker: 1 }, schoolBonus: {} },
  { id: 'eldritchKnight', name: 'Мистический рыцарь', classId: 'fighter', roleBonus: { controller: 1 }, schoolBonus: { Воплощение: 1 } },
  { id: 'evoker', name: 'Вызыватель', classId: 'wizard', roleBonus: { striker: 1 }, schoolBonus: { Воплощение: 2 } },
  { id: 'abjurer', name: 'Оградитель', classId: 'wizard', roleBonus: { support: 1 }, schoolBonus: { Ограждение: 2 } },
  { id: 'lifeDomain', name: 'Жизнь', classId: 'cleric', roleBonus: { support: 2 }, schoolBonus: { Воплощение: 1 } },
  { id: 'warDomain', name: 'Война', classId: 'cleric', roleBonus: { tank: 1, striker: 1 }, schoolBonus: {} },
  { id: 'thief', name: 'Вор', classId: 'rogue', roleBonus: { scout: 2 }, schoolBonus: {} },
  { id: 'assassin', name: 'Убийца', classId: 'rogue', roleBonus: { striker: 2 }, schoolBonus: {} },
  { id: 'hunter', name: 'Охотник', classId: 'ranger', roleBonus: { striker: 1, scout: 1 }, schoolBonus: { Прорицание: 1 } },
  { id: 'beastMaster', name: 'Повелитель зверей', classId: 'ranger', roleBonus: { support: 1 }, schoolBonus: { Вызов: 1 } },
  { id: 'oathDevotion', name: 'Преданность', classId: 'paladin', roleBonus: { support: 1, tank: 1 }, schoolBonus: { Очарование: 1 } },
  { id: 'oathVengeance', name: 'Месть', classId: 'paladin', roleBonus: { striker: 2 }, schoolBonus: {} },
  { id: 'berserker', name: 'Берсерк', classId: 'barbarian', roleBonus: { striker: 2 }, schoolBonus: {} },
  { id: 'totem', name: 'Тотем', classId: 'barbarian', roleBonus: { tank: 2 }, schoolBonus: {} },
  { id: 'loreCollege', name: 'Знание', classId: 'bard', roleBonus: { controller: 1 }, schoolBonus: { Очарование: 1 } },
  { id: 'valorCollege', name: 'Доблесть', classId: 'bard', roleBonus: { tank: 1, support: 1 }, schoolBonus: {} },
  { id: 'fiendPatron', name: 'Исчадие', classId: 'warlock', roleBonus: { striker: 1 }, schoolBonus: { Воплощение: 1 } },
  { id: 'archfey', name: 'Архифея', classId: 'warlock', roleBonus: { controller: 1 }, schoolBonus: { Очарование: 1 } },
  { id: 'landCircle', name: 'Земля', classId: 'druid', roleBonus: { controller: 1 }, schoolBonus: { Вызов: 1 } },
  { id: 'moonCircle', name: 'Луна', classId: 'druid', roleBonus: { tank: 1, striker: 1 }, schoolBonus: {} },
  { id: 'openHand', name: 'Открытая ладонь', classId: 'monk', roleBonus: { striker: 1 }, schoolBonus: {} },
  { id: 'shadow', name: 'Тень', classId: 'monk', roleBonus: { scout: 2 }, schoolBonus: { Иллюзия: 1 } },
  { id: 'draconic', name: 'Драконья кровь', classId: 'sorcerer', roleBonus: { striker: 1 }, schoolBonus: { Воплощение: 1 } },
  { id: 'wildMagic', name: 'Дикая магия', classId: 'sorcerer', roleBonus: { controller: 1 }, schoolBonus: {} },
]

export const SUBCLASS_MAP = Object.fromEntries(SUBCLASSES.map((s) => [s.id, s])) as Record<
  SubclassId,
  SubclassDef
>

/** Role preferred stats weights for statFit */
export const ROLE_STAT_WEIGHTS: Record<
  RoleId,
  { impact: number; economy: number; reliability: number }
> = {
  tank: { impact: 0.2, economy: 0.25, reliability: 0.55 },
  striker: { impact: 0.55, economy: 0.25, reliability: 0.2 },
  controller: { impact: 0.25, economy: 0.5, reliability: 0.25 },
  support: { impact: 0.15, economy: 0.4, reliability: 0.45 },
  scout: { impact: 0.35, economy: 0.4, reliability: 0.25 },
}

export const SCHOOL_ROLE_AFFINITY: Record<string, Partial<Record<RoleId, number>>> = {
  Воплощение: { striker: 2, controller: 1 },
  Ограждение: { tank: 2, support: 1 },
  Очарование: { controller: 2, support: 1 },
  Прорицание: { scout: 2, controller: 1 },
  Вызов: { controller: 1, support: 1, striker: 1 },
  Иллюзия: { scout: 2, controller: 1 },
  Преобразование: { scout: 1, support: 1 },
  Некромантия: { controller: 2, striker: 1 },
}
