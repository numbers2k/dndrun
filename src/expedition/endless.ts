export const BOONS = [
  {
    id: 'edge',
    name: 'Кровавая грань',
    icon: 'sword',
    text: 'Все атаки +3 урона. Собирайте метки и добор для серии ударов.',
  },
  {
    id: 'venom',
    name: 'Чёрный настой',
    icon: 'drop',
    text: 'Карты накладывают ещё 4 яда. Яд перед ходом врага наносит на 25% больше урона.',
  },
  {
    id: 'bastion',
    name: 'Клятва стали',
    icon: 'shield',
    text: 'В начале каждого хода весь отряд получает ещё 3 защиты.',
  },
  {
    id: 'flow',
    name: 'Запретное знание',
    icon: 'spark',
    text: '+1 энергия и +1 карта в первом ходу каждого боя.',
  },
]
export const OMENS = [
  {
    id: 'iron',
    name: 'Железные тени',
    text: 'Все враги получают 6 защиты каждый ход. Яд и пробитие обходят её.',
  },
  {
    id: 'hunger',
    name: 'Голодная ночь',
    text: 'В начале хода вы берёте на одну карту меньше. Добор и короткая колода особенно важны.',
  },
  {
    id: 'swarm',
    name: 'Зов бездны',
    text: 'В обычных и элитных боях появляется дополнительный враг.',
  },
  {
    id: 'rage',
    name: 'Кровавый туман',
    text: 'Все враги наносят ещё 3 урона. Устраняйте угрозы до их атаки.',
  },
]
export const BOON_MAP = Object.fromEntries(BOONS.map((b) => [b.id, b])) as Record<
  string,
  (typeof BOONS)[number]
>
export const OMEN_MAP = Object.fromEntries(OMENS.map((b) => [b.id, b])) as Record<
  string,
  (typeof OMENS)[number]
>
