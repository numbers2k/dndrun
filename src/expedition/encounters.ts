export const ENEMIES = {
  weaver: {
    name: 'Плетельщик завес',
    hp: 25,
    power: 4,
    trait:
      'Пока жив: перед второй и каждой следующей массовой атакой за ход даёт всем врагам 6 защиты. Одиночные удары и яд не запускают завесу; можно сначала устранить плетельщика.',
  },
  armorer: {
    name: 'Бродячий бронник',
    hp: 28,
    power: 5,
    trait:
      'Каждый ход получает 9 защиты. После первого прямого удара передаёт её остаток живому союзнику с наименьшим здоровьем. Яд не запускает передачу; пробитие позволяет обойти броню.',
  },
  raider: {
    name: 'Разбойник',
    hp: 24,
    power: 6,
    trait: 'Обычная атака. Позволяет сосредоточиться на более опасном союзнике.',
  },
  wolf: {
    name: 'Дикий волк',
    hp: 22,
    power: 6,
    trait: 'Готовит прыжок, затем бьёт сильнее. Подготовку можно использовать для атаки.',
  },
  archer: {
    name: 'Лучник',
    hp: 21,
    power: 5,
    trait: 'Каждый третий ход целится в героя с наименьшим здоровьем.',
  },
  shieldbearer: {
    name: 'Щитоносец',
    hp: 29,
    power: 4,
    trait: 'Каждый ход даёт другим врагам 6 защиты. Яд и пробитие обходят её.',
  },
  herald: {
    name: 'Знаменосец',
    hp: 19,
    power: 3,
    trait: 'Каждый второй ход вместо атаки навсегда усиливает атаки союзников на 2.',
  },
  cultist: {
    name: 'Заклинатель',
    hp: 25,
    power: 5,
    trait:
      'По нечётным ходам готовит ритуал на весь отряд. 10 потерь здоровья за ход прерывают его.',
  },
  scavenger: {
    name: 'Падальщик',
    hp: 26,
    power: 5,
    trait: 'За каждого погибшего союзника получает +3 к атаке и 4 здоровья.',
  },
  hexer: {
    name: 'Проклинатель',
    hp: 22,
    power: 4,
    trait:
      'Каждый второй ход кладёт в сброс Пепел: неиграемую карту, исчезающую после одного добора.',
  },
  leech: {
    name: 'Кровопийца',
    hp: 23,
    power: 5,
    trait: 'После атаки восстанавливает здоровье на величину нанесённых ран, максимум 6.',
  },
  sentinel: {
    name: 'Рунный часовой',
    hp: 30,
    power: 5,
    trait: 'По нечётным ходам получает 8 защиты и атакует. Пробитие и яд особенно полезны.',
  },
  bomber: {
    name: 'Носитель огня',
    hp: 20,
    power: 6,
    trait:
      'По нечётным ходам готовит взрыв. 10 потерь здоровья за ход прерывают удар по всему отряду.',
  },
  knight: {
    name: 'Забытый рыцарь',
    hp: 35,
    power: 7,
    trait: 'Каждый третий ход наносит тяжёлый удар; в остальные ходы защищается на 4.',
  },
}
export const ENEMY_MAP: Record<string, { name: string; hp: number; power: number; trait: string }> =
  ENEMIES
export const ENEMY_ROLES: Record<string, string> = {
  weaver: 'Завеса против повторной массовой атаки',
  armorer: 'Переносит оставшуюся броню',
  raider: 'Боец',
  wolf: 'Прыжок',
  archer: 'Охотится на раненых',
  shieldbearer: 'Прикрывает союзников',
  herald: 'Усиливает союзников',
  cultist: 'Прерываемый ритуал',
  scavenger: 'Питается погибшими',
  hexer: 'Засоряет колоду',
  leech: 'Похищает здоровье',
  sentinel: 'Рунная броня',
  bomber: 'Прерываемый взрыв',
  knight: 'Щит и тяжёлый удар',
}
export const BOSSES = [
  {
    id: 'bridge',
    name: 'Хранитель моста',
    rule: 'echo',
    hp: 72,
    power: 8,
    areas: [0],
    text: 'Повтор владельца карты даёт боссу 7 защиты до конца хода. Чередуйте героев или обходите защиту ядом и пробитием.',
  },
  {
    id: 'mirror',
    name: 'Собиратель эха',
    rule: 'echo',
    hp: 78,
    power: 7,
    areas: [0, 1],
    text: 'Повтор владельца карты даёт боссу 7 защиты до конца хода. Чередуйте героев или обходите защиту ядом и пробитием.',
  },
  {
    id: 'guardian',
    name: 'Хранитель печатей',
    rule: 'seal',
    hp: 118,
    power: 11,
    areas: [1],
    text: 'В начале хода получает 14 защиты. Карты двух разных героев снимают всю его защиту перед эффектом второй карты.',
  },
  {
    id: 'cantor',
    name: 'Зовущий из глубин',
    rule: 'summon',
    hp: 83,
    power: 6,
    areas: [0, 1],
    text: 'Каждый второй ход вместо атаки призывает помощника, если живы меньше трёх врагов. Массовые атаки помогут сдержать призыв.',
  },
  {
    id: 'hunter',
    name: 'Охотник за огнём',
    rule: 'hunt',
    hp: 142,
    power: 10,
    areas: [1, 2],
    text: 'Отмеченный герой получит тяжёлый удар в следующем ходу. До этого есть время подготовить защиту или добить босса.',
  },
  {
    id: 'dragon',
    name: 'Горный дракон',
    rule: 'hunt',
    hp: 210,
    power: 14,
    areas: [2],
    text: 'Отмечает героя перед тяжёлым ударом. Каждый третий ход дышит огнём на весь отряд. Подготовьте личную и общую защиту.',
  },
  {
    id: 'censor',
    name: 'Архонт печатей',
    rule: 'seal',
    hp: 195,
    power: 13,
    areas: [2],
    text: 'В начале хода получает 14 защиты. Карты двух разных героев снимают всю его защиту перед эффектом второй карты.',
  },
] as const
export const BOSS_MAP = Object.fromEntries(BOSSES.map((b) => [b.id, b])) as Record<
  string,
  (typeof BOSSES)[number]
>
export const ENCOUNTERS = [
  { id: 'forest-patrol', area: 0, name: 'Дорожный дозор', foes: ['raider', 'archer'] },
  { id: 'forest-pack', area: 0, name: 'Голодная стая', foes: ['wolf', 'scavenger'] },
  { id: 'forest-banner', area: 0, name: 'Потрёпанное знамя', foes: ['herald', 'raider'] },
  { id: 'forest-shield', area: 0, name: 'Засада у брода', foes: ['shieldbearer', 'archer'] },
  { id: 'forest-ritual', area: 0, name: 'Круг под соснами', foes: ['cultist', 'wolf'] },
  { id: 'forest-leech', area: 0, name: 'Ночная тропа', foes: ['leech', 'hexer'] },
  { id: 'forest-forge', area: 0, name: 'Телега бронника', foes: ['armorer', 'wolf'] },
  { id: 'ruins-watch', area: 1, name: 'Рунный караул', foes: ['sentinel', 'hexer'] },
  { id: 'ruins-ritual', area: 1, name: 'Сломанный алтарь', foes: ['cultist', 'shieldbearer'] },
  { id: 'ruins-banner', area: 1, name: 'Последний гарнизон', foes: ['herald', 'knight'] },
  { id: 'ruins-feast', area: 1, name: 'Пир под камнем', foes: ['scavenger', 'leech'] },
  { id: 'ruins-fire', area: 1, name: 'Огонь в крипте', foes: ['bomber', 'archer'] },
  { id: 'ruins-curse', area: 1, name: 'Шёпот за стеной', foes: ['hexer', 'raider', 'wolf'] },
  { id: 'ruins-veil', area: 1, name: 'Ткань под сводами', foes: ['weaver', 'sentinel'] },
  { id: 'ruins-forge', area: 1, name: 'Остывшая кузня', foes: ['armorer', 'cultist'] },
  { id: 'peak-watch', area: 2, name: 'Дозор на склоне', foes: ['knight', 'herald', 'archer'] },
  {
    id: 'peak-ritual',
    area: 2,
    name: 'Костёр над пропастью',
    foes: ['bomber', 'shieldbearer', 'cultist'],
  },
  { id: 'peak-hunt', area: 2, name: 'Следы на снегу', foes: ['wolf', 'leech', 'scavenger'] },
  { id: 'peak-seals', area: 2, name: 'Запечатанный проход', foes: ['sentinel', 'hexer', 'archer'] },
  { id: 'peak-banner', area: 2, name: 'Чёрное знамя', foes: ['herald', 'shieldbearer', 'raider'] },
  { id: 'peak-ashes', area: 2, name: 'Пепельный ветер', foes: ['bomber', 'hexer', 'scavenger'] },
  { id: 'peak-veil', area: 2, name: 'Завеса на перевале', foes: ['weaver', 'armorer', 'archer'] },
] as const
export const ENCOUNTER_MAP = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e])) as Record<
  string,
  (typeof ENCOUNTERS)[number]
>
