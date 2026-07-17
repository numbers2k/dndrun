/** Шаблоны отмазок — вставляем имя героя из текущего отряда. */
const ABANDON_TEMPLATES: Array<(name: string) => string> = [
  (n) => `${n}: «забыл компоненты»`,
  (n) => `${n} начал длинный монолог`,
  (n) => `Кубик укатился у ${n}`,
  (n) => `${n} ушёл клясться заново`,
  (n) => `${n} открыл не ту дверь`,
  (n) => `Мастер ушёл за пиццей — ${n} уже сдался`,
  (n) => `На развилке замолчал ${n}`,
  (n) => `${n} потратил все ячейки на «Сотворение воды»`,
  (n) => `Дракон просит переброс у ${n}`,
  (n) => `Карту данжа перевернул ${n}`,
  (n) => `${n} уснул на вахте`,
  (n) => `${n}: «это же только сессия ноль»`,
]

/** Случайная отмазка с именем одного из выбранных авантюристов. */
export function pickAbandonQuote(adventurerNames: string[]): string {
  const pool = adventurerNames.map((n) => n.trim()).filter(Boolean)
  const full = pool[Math.floor(Math.random() * pool.length)] || 'Кто-то'
  const name = full.split(/\s+/)[0] || full
  const template =
    ABANDON_TEMPLATES[Math.floor(Math.random() * ABANDON_TEMPLATES.length)]
  return template(name)
}
