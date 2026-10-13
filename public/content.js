export const relics = [
  {
    id: "rune",
    name: "Острая руна",
    icon: "sword",
    description: "Урон карт +2 до множителя.",
  },
  {
    id: "ward",
    name: "Клятва щита",
    icon: "shield",
    description: "Защита карт +2 до множителя.",
  },
  {
    id: "herb",
    name: "Лесной оберег",
    icon: "leaf",
    description:
      "Лечение карт +3 до множителя. После победы живые герои лечатся на 3.",
  },
  {
    id: "moon",
    name: "Осколок луны",
    icon: "magic",
    description: "Карты двух разных героев в одном ходу: множитель +0,5.",
  },
  {
    id: "oath",
    name: "Знак единства",
    icon: "book",
    description: "Атака и защита в одном ходу: множитель +0,5.",
  },
  {
    id: "venom",
    name: "Змеиный зуб",
    icon: "eye",
    description:
      "Наложение яда +2. Каждый ход начинается с 2 защиты у живых героев.",
  },
  {
    id: "flask",
    name: "Глубокая фляга",
    icon: "elixir",
    description: "Максимум эликсира +1. Не складывается с другой такой флягой.",
  },
  {
    id: "ember",
    name: "Уголь костра",
    icon: "flame",
    description:
      "Первый удар каждой карты по врагу с уязвимостью: +3 базового урона.",
  },
];
export const supplies = [
  {
    id: "bomb",
    name: "Огненная смесь",
    icon: "flame",
    effect: "Урон",
    amount: 14,
    target: "enemy",
    description: "14 урона одной цели, без множителя.",
  },
  {
    id: "tonic",
    name: "Лечебный настой",
    icon: "leaf",
    effect: "Лечение",
    amount: 16,
    target: "ally",
    description: "Восстановить 16 здоровья, без множителя.",
  },
  {
    id: "antidote",
    name: "Чистая соль",
    icon: "magic",
    effect: "Очищение",
    amount: 6,
    target: "ally",
    description: "Снять яд и уязвимость; восстановить 6 здоровья.",
  },
  {
    id: "venom",
    name: "Ядовитый экстракт",
    icon: "eye",
    effect: "Яд",
    amount: 7,
    target: "enemy",
    description: "Наложить 7 яда. Яд действует перед ответом врагов.",
  },
  {
    id: "oil",
    name: "Масло клинка",
    icon: "sword",
    effect: "Усиление",
    amount: 3,
    target: "ally",
    description: "Атаки героя +3 до конца следующего хода.",
  },
];
export const relicById = (id) => relics.find((r) => r.id === id);
export const supplyById = (id) => supplies.find((s) => s.id === id);
export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
const foes = {
  wolf: { name: "Серый волк", art: "wolf", hp: 20, attack: 5, role: "attack" },
  hunter: {
    name: "Лесной охотник",
    art: "ranger",
    hp: 23,
    attack: 6,
    role: "attack",
  },
  spider: {
    name: "Ядовитый ловец",
    art: "druid",
    hp: 18,
    attack: 3,
    role: "poison",
  },
  bandit: {
    name: "Разбойник",
    art: "rogue",
    hp: 25,
    attack: 6,
    role: "attack",
  },
  shield: {
    name: "Страж руин",
    art: "warden",
    hp: 30,
    attack: 5,
    role: "guard",
  },
  priest: {
    name: "Хранитель пепла",
    art: "mage",
    hp: 22,
    attack: 4,
    role: "heal",
  },
  stone: {
    name: "Каменный дозорный",
    art: "guardian",
    hp: 33,
    attack: 6,
    role: "guard",
  },
  hex: { name: "Заклинатель", art: "mage", hp: 23, attack: 4, role: "hex" },
  brute: {
    name: "Наёмный громила",
    art: "paladin",
    hp: 36,
    attack: 8,
    role: "heavy",
  },
  stalker: {
    name: "Теневой следопыт",
    art: "rogue",
    hp: 25,
    attack: 5,
    role: "poison",
  },
  alpha: {
    name: "Вожак стаи",
    art: "wolf",
    hp: 66,
    attack: 7,
    role: "boss",
    rule: "На каждом третьем ходу атакует весь отряд.",
  },
  sentinel: {
    name: "Хранитель перевала",
    art: "guardian",
    hp: 78,
    attack: 8,
    role: "boss",
    rule: "Чередует удар, защиту и атаку всего отряда.",
  },
  witch: {
    name: "Ткач сумерек",
    art: "mage",
    hp: 74,
    attack: 7,
    role: "boss",
    rule: "На втором ходу цикла накладывает уязвимость, на третьем атакует всех.",
  },
};
const regions = [
  {
    name: "Зелёный тракт",
    groups: [
      ["wolf", "spider"],
      ["bandit", "shield", "priest"],
      ["alpha", "wolf"],
    ],
    titles: ["Лесной дозор", "Засада у моста", "Вожак стаи"],
  },
  {
    name: "Забытые руины",
    groups: [
      ["hunter", "hex"],
      ["stone", "stalker", "priest"],
      ["sentinel", "shield"],
    ],
    titles: ["Дозор в развалинах", "Каменный караул", "Хранитель перевала"],
  },
  {
    name: "Сумеречный перевал",
    groups: [
      ["bandit", "stalker", "hex"],
      ["brute", "priest", "spider"],
      ["witch", "hex"],
    ],
    titles: ["Тени перевала", "Последняя застава", "Ткач сумерек"],
  },
];
export function chapterEncounters(chapter, seed = 1, difficulty = 0) {
  const region = regions[(chapter - 1) % regions.length],
    random = seededRandom(seed + chapter * 7919);
  const depth = Math.max(0, chapter - 1);
  const growth =
    1 + depth * 0.3 + Math.max(0, chapter - 3) ** 2.4 * 0.05 + difficulty * 0.3;
  return region.groups.map((group, index) => {
    let types = [...group];
    if (chapter > 3 && index < 2) {
      const options =
        index === 0
          ? ["wolf", "hunter", "bandit", "spider", "stalker"]
          : ["shield", "stone", "brute", "priest", "hex"];
      types[0] = options[Math.floor(random() * options.length)];
    }
    const enemies = types.map((type, i) => {
      const f = foes[type];
      return {
        ...f,
        id: `enemy-${i}`,
        type,
        maxHp: Math.round(f.hp * growth),
        hp: Math.round(f.hp * growth),
        attack: Math.round(
          f.attack *
            (1 +
              depth * 0.2 +
              Math.max(0, chapter - 3) * 0.08 +
              difficulty * 0.3),
        ),
        guard: f.role === "guard" ? 4 + Math.floor(depth / 2) : 0,
      };
    });
    return {
      name: region.titles[index],
      type: index === 2 ? "БОСС" : index === 1 ? "ЭЛИТА" : "СТЫЧКА",
      icon: enemies[0].art,
      color: index === 2 ? "red" : index === 1 ? "gold" : "blue",
      reward: 3 + index,
      detail:
        index === 2
          ? enemies[0].rule
          : index === 0
            ? "Дозор на дороге"
            : "Усиленный отряд",
      enemies,
      chapter,
      region: region.name,
      skip:
        index < 2
          ? {
              labels:
                index === 0
                  ? ["Пройти скрытно", "Обойти по тропе", "Ускользнуть"]
                  : ["Сбежать", "Обойти руины", "Пробраться мимо"],
              coins: index === 1 ? 2 : 0,
              supplies: index === 0 ? 1 : 0,
            }
          : null,
    };
  });
}
