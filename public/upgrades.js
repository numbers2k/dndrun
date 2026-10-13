import { localMultiplier } from "./relics.js";
export function canUpgrade(card, item, cards) {
  if (!card || !item?.upgrade) return false;
  const mode = item.upgrade;
  if (
    ["attack", "attackMult", "growth", "poison", "slow"].includes(mode) &&
    card.effect !== "Урон"
  )
    return false;
  if (
    ["guard", "guardMult", "stone"].includes(mode) &&
    card.effect !== "Защита"
  )
    return false;
  if (["heal", "cleanse"].includes(mode) && card.effect !== "Лечение")
    return false;
  if (["power", "temper"].includes(mode) && card.amount === undefined)
    return false;
  if (mode === "mult" && !["Урон", "Защита", "Лечение"].includes(card.effect))
    return false;
  if (
    mode === "growth" &&
    (card.amount || 0) >= (card.originalAmount ?? card.amount ?? 0) + 8
  )
    return false;
  if (
    mode === "match" &&
    !cards.some(
      (c) =>
        c.name === card.name &&
        c.hero === card.hero &&
        (c.amount || 0) > (card.amount || 0),
    )
  )
    return false;
  if (
    ["poison", "gold", "growth", "cleanse", "slow"].includes(mode) &&
    card[
      mode === "cleanse"
        ? "cleansing"
        : mode === "slow"
          ? "slow"
          : mode === "growth"
            ? "growing"
            : mode === "gold"
              ? "gilded"
              : "poison"
    ]
  )
    return false;
  const next = upgradeCard(card, item, cards);
  const clean = (c) => {
    const { upgradeCount, originalAmount, ...value } = c;
    return value;
  };
  return JSON.stringify(clean(next)) !== JSON.stringify(clean(card));
}
export function upgradeCard(card, item, cards) {
  const next = {
    ...card,
    originalAmount: card.originalAmount ?? card.amount ?? 0,
  };
  const power = (n) =>
    (next.amount = Math.min(next.originalAmount + 8, (next.amount || 0) + n));
  const mult = (n) =>
    (next.multiplier = localMultiplier({
      ...next,
      multiplier: Math.round((next.multiplier + n) * 100) / 100,
    }));
  switch (item.upgrade) {
    case "power":
    case "attack":
    case "guard":
    case "heal":
      power(item.amount);
      break;
    case "mult":
    case "guardMult":
    case "attackMult":
      mult(item.amount);
      break;
    case "temper":
      power(2);
      mult(0.1);
      break;
    case "match":
      next.amount = Math.min(
        next.originalAmount + 8,
        Math.max(
          ...cards
            .filter((c) => c.hero === card.hero && c.name === card.name)
            .map((c) => c.amount || 0),
        ),
      );
      break;
    case "gold":
      next.gilded = true;
      break;
    case "stone":
      power(4);
      next.multiplier = 1;
      break;
    case "growth":
      next.growing = 4;
      break;
    case "poison":
      next.poison = 2;
      next.detail = [card.detail, "яд 2"].filter(Boolean).join(" · ");
      break;
    case "cleanse":
      power(4);
      next.cleansing = true;
      next.detail = [card.detail, "снимает яд"].filter(Boolean).join(" · ");
      break;
    case "slow":
      next.slow = true;
      next.detail = [card.detail, "замедление −2 урона"]
        .filter(Boolean)
        .join(" · ");
      break;
  }
  next.upgradeCount = (card.upgradeCount || 0) + 1;
  return next;
}
export function updateBattleCard(b, id, next) {
  for (const pile of ["hand", "draw", "spent"])
    b.deck[pile] = b.deck[pile].map((c) => (c.id === id ? next : c));
}
