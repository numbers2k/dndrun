export const heroes = [
  {
    id: "warden",
    name: "Бран",
    role: "Страж",
    color: "blue",
    spells: [
      {
        name: "Удар мечом",
        icon: "sword",
        effect: "Урон",
        amount: 9,
        energy: 1,
      },
      {
        name: "Поднять щит",
        icon: "shield",
        effect: "Защита",
        amount: 11,
        energy: 1,
      },
      {
        name: "Крепость",
        icon: "shield",
        effect: "Защита",
        amount: 5,
        all: true,
        multiplier: 1.25,
        detail: "всему отряду",
        energy: 2,
      },
    ],
  },
  {
    id: "ranger",
    name: "Лина",
    role: "Следопыт",
    color: "green",
    spells: [
      {
        name: "Точный выстрел",
        icon: "bow",
        effect: "Урон",
        amount: 13,
        energy: 1,
      },
      {
        name: "Метка охотника",
        icon: "eye",
        effect: "Уязвимость",
        multiplier: 1.5,
        energy: 1,
      },
      {
        name: "Лесной оберег",
        icon: "leaf",
        effect: "Лечение",
        amount: 7,
        energy: 2,
      },
    ],
  },
  {
    id: "mage",
    name: "Эли",
    role: "Маг",
    color: "purple",
    spells: [
      { name: "Искра", icon: "flame", effect: "Урон", amount: 11, energy: 1 },
      {
        name: "Ледяная печать",
        icon: "magic",
        effect: "Урон",
        amount: 7,
        slow: true,
        detail: "замедление −2 урона",
        energy: 1,
      },
      {
        name: "Магический барьер",
        icon: "shield",
        effect: "Защита",
        amount: 12,
        multiplier: 1.5,
        energy: 2,
      },
    ],
  },
  {
    id: "rogue",
    name: "Кай",
    role: "Плут",
    color: "green",
    spells: [
      {
        name: "Удар кинжалом",
        icon: "sword",
        effect: "Урон",
        amount: 12,
        energy: 1,
      },
      {
        name: "Дымовая завеса",
        icon: "eye",
        effect: "Уклонение",
        detail: "следующая атака −50%",
        energy: 1,
      },
      {
        name: "Теневая метка",
        icon: "magic",
        effect: "Уязвимость",
        multiplier: 2,
        detail: "получаемый урон +25%",
        energy: 2,
      },
    ],
  },
  {
    id: "paladin",
    name: "Ирэн",
    role: "Паладин",
    color: "blue",
    spells: [
      {
        name: "Карающий свет",
        icon: "flame",
        effect: "Урон",
        amount: 10,
        energy: 1,
      },
      {
        name: "Клятва защиты",
        icon: "shield",
        effect: "Защита",
        amount: 3,
        all: true,
        detail: "всему отряду",
        energy: 1,
      },
      {
        name: "Возложение рук",
        icon: "leaf",
        effect: "Лечение",
        amount: 8,
        energy: 2,
      },
    ],
  },
  {
    id: "druid",
    name: "Мора",
    role: "Друид",
    color: "purple",
    spells: [
      {
        name: "Терновый хлыст",
        icon: "leaf",
        effect: "Урон",
        amount: 7,
        poison: 2,
        detail: "яд 2",
        energy: 1,
      },
      {
        name: "Корни",
        icon: "magic",
        effect: "Замедление",
        multiplier: 1.5,
        detail: "урон врага −2",
        energy: 1,
      },
      {
        name: "Живая кора",
        icon: "shield",
        effect: "Защита",
        amount: 10,
        multiplier: 1.5,
        energy: 2,
      },
    ],
  },
].map((hero) => ({
  ...hero,
  spells: hero.spells.map((spell) => ({ multiplier: 1, ...spell })),
}));
export const defaultParty = ["warden", "ranger", "mage"];
export const heroHealth = {
  warden: 42,
  ranger: 34,
  mage: 32,
  rogue: 34,
  paladin: 40,
  druid: 36,
};
export const heroById = (id) => heroes.find((hero) => hero.id === id);
export const spellDescription = (spell) =>
  [
    `${spell.effect}${spell.amount === undefined ? "" : ` ${spell.amount}`}`,
    `Множитель ×${String(spell.multiplier).replace(".", ",")}`,
    spell.detail || "",
  ]
    .filter(Boolean)
    .join(" · ");
// Provisional encounter charges: basic / tactical / powerful.
export const spellCopies = [4, 3, 2];

export function replaceHero(party, slot, id) {
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= 3 ||
    !heroById(id) ||
    party.includes(id)
  )
    return party;
  return party.map((current, index) => (index === slot ? id : current));
}

export function buildDeck(party) {
  const members = party.map(heroById);
  const dealOrder = Array.from(
    { length: Math.max(...spellCopies) },
    (_, copy) =>
      spellCopies.flatMap((count, index) => (copy < count ? [index] : [])),
  ).flat();
  return dealOrder
    .flatMap((spellIndex) =>
      members.map((hero) => ({
        ...hero.spells[spellIndex],
        hero: hero.id,
        color: hero.color,
      })),
    )
    .map((card, id) => ({ ...card, id }));
}
