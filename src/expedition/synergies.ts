import { CARD_MAP, HEROES } from './data'
import type { Card, Run } from './types'
export function relicFits(r: Run, id: string) {
  const cards = r.deck.map((c) => CARD_MAP[c.id])
  if (['venombond', 'volatile', 'vial'].includes(id)) return cards.some((c) => c.poison)
  if (['guardbond', 'anvil'].includes(id)) return cards.some((c) => c.block)
  if (['mercy', 'herbs'].includes(id)) return cards.some((c) => c.heal)
  if (id === 'heavy') return cards.some((c) => c.damage && c.cost >= 2)
  return true
}
export function recruitPreview(r: Run, slot: number, id: Run['party'][number]['id']) {
  const old = r.party[slot]?.id
  if (!old) return null
  const removed = r.deck.filter((c) => CARD_MAP[c.id].hero === old)
  return {
    old: HEROES[old].name,
    lost: removed.length,
    upgraded: removed.filter((c) => c.upgraded).length,
    newCards: [...HEROES[id].cards, HEROES[id].cards[0]].map((cid) => CARD_MAP[cid].name),
  }
}
export function cardTags(c: Card): string[] {
  const d = CARD_MAP[c.id]
  return [
    d.damage && 'Удар',
    d.block && 'Защита',
    d.poison && 'Яд',
    d.vulnerable && 'Метка',
    (d.draw || d.energy) && 'Ритм',
    (d.blockStrike || d.poisonStrike) && 'Добивание',
    d.heal && 'Лечение',
  ].filter(Boolean) as string[]
}
export function relicHint(r: Run, id: string): string {
  const cards = r.deck.map((c) => CARD_MAP[c.id])
  const count = (key: 'damage' | 'block' | 'poison' | 'draw' | 'heal') =>
    cards.filter((c) => c[key]).length
  if (['venombond', 'volatile', 'vial'].includes(id))
    return count('poison')
      ? `В колоде ${count('poison')} карт с ядом. ${id === 'venombond' ? 'После яда ударьте другим героем.' : 'Усилит план через яд.'}`
      : 'Пока нет карт с ядом — реликвии нужна подготовка.'
  if (['guardbond', 'anvil'].includes(id))
    return count('block')
      ? `В колоде ${count('block')} карт с защитой. ${id === 'guardbond' ? 'Подготовьте защиту перед ударом другого героя.' : 'Оставляйте защиту для следующего хода.'}`
      : 'Пока нет карт с защитой — реликвии нужна подготовка.'
  if (['conductor', 'relay', 'memory'].includes(id))
    return `В колоде ${count('draw')} карт добора. Чередуйте героев, оставляя сильный удар на конец серии.`
  if (id === 'heavy') {
    const n = cards.filter((c) => c.damage && c.cost >= 2).length
    return n
      ? `Подходит ${n} дорогим атакам в колоде. Меньшая рука усложнит связки.`
      : 'Пока нет дорогих атак — бонус не сработает.'
  }
  if (['mercy', 'herbs'].includes(id)) return `В колоде ${count('heal')} карт лечения.`
  return 'Постоянный эффект для отряда.'
}
export function buildPlans(r: Run) {
  const list = r.deck.map((c) => CARD_MAP[c.id])
  const names = (filter: (d: (typeof list)[number]) => boolean) =>
    [...new Set(list.filter(filter).map((d) => d.name))].slice(0, 4).join(', ')
  return [
    {
      name: 'Метка → сильный удар',
      ready: list.some((c) => c.vulnerable) && list.some((c) => c.damage),
      setup: names((c) => !!c.vulnerable),
      finish:
        names((c) => !!c.damage && (c.cost >= 2 || c.hero === 'rogue')) || names((c) => !!c.damage),
      text: 'Уязвимость даёт ×1,5 после множителя связки. Отметьте врага до сильной атаки, а не после неё.',
    },
    {
      name: 'Защита → контратака',
      ready:
        list.some((c) => c.block) &&
        (list.some((c) => c.blockStrike) ||
          r.relics.some((id) => ['guardbond', 'anvil'].includes(id))),
      setup: names((c) => !!c.block),
      finish: names((c) => !!c.blockStrike),
      text: 'Кай прибавляет половину своей защиты к Ответному удару (максимум +12). Клятва щита передаёт бонус другому герою; Отголосок стали — на следующий ход.',
    },
    {
      name: 'Яд → добивание',
      ready:
        list.some((c) => c.poison) &&
        (list.some((c) => c.poisonStrike) ||
          r.relics.some((id) => ['venombond', 'volatile'].includes(id))),
      setup: names((c) => !!c.poison),
      finish: names((c) => !!c.poisonStrike),
      text: 'Катализатор добавляет текущий яд цели к удару, затем работают связка и уязвимость. Проводник яда передаёт бонус другому герою; Сосуд создаёт цепную реакцию.',
    },
    {
      name: 'Три голоса → резонанс',
      ready: list.some((c) => c.draw || c.energy),
      setup: names((c) => !!(c.draw || c.energy)),
      finish: r.party.map((h) => HEROES[h.id].name).join(' → '),
      text: 'Чередуйте владельцев: 3 карты — ×1,25, 5 — ×1,5, 7 — ×1,75, 9 — ×2. Бесплатные карты готовят место для дорогой атаки.',
    },
  ].map((p) => ({
    ...p,
    setup: p.setup || 'Нужны карты подготовки',
    finish: p.finish || 'Подберите завершающую карту или реликвию',
  }))
}
