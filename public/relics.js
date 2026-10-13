import { relicById, supplyById } from "./items.js";

const offensive = (c) => ["Урон", "Яд"].includes(c.effect);
export const plannedCards = (b) =>
  b.plan
    .filter((p) => p.kind === "card")
    .map((p) => b.deck.hand.find((c) => c.id === p.id))
    .filter(Boolean);
export const patternOf = (cards) =>
  [...new Set(cards.map((c) => c.effect))].sort().join("|");
export function relicContext(b, card = null, target = null) {
  const cards = plannedCards(b),
    ids = new Set(cards.map((c) => c.id)),
    held = b.deck.hand.filter((c) => !ids.has(c.id));
  const counts = cards.reduce(
    (map, c) => (
      (map[c.hero + ":" + c.name] = (map[c.hero + ":" + c.name] || 0) + 1),
      map
    ),
    {},
  );
  const capacity =
    b.maxElixir +
    (b.plan.some(
      (p) =>
        p.kind === "supply" &&
        supplyById(b.supplies?.find((s) => s.uid === p.id)?.id)?.effect ===
          "Эликсир",
    )
      ? 1
      : 0);
  return {
    b,
    card,
    target,
    cards,
    held,
    counts,
    heroes: new Set(cards.map((c) => c.hero)),
    effects: new Set(cards.map((c) => c.effect)),
    energy: cards.reduce((n, c) => n + c.energy, 0),
    capacity,
    pattern: patternOf(cards),
  };
}
function matches(condition, c) {
  const {
    b,
    card,
    target,
    cards,
    held,
    counts,
    heroes,
    effects,
    energy,
    pattern,
  } = c;
  if (!condition || condition === "always") return true;
  if (["warden", "ranger", "mage", "rogue"].includes(condition))
    return card
      ? card.hero === condition
      : cards.some((c) => c.hero === condition);
  switch (condition) {
    case "pair":
      return Object.values(counts).some((n) => n >= 2);
    case "triple":
      return Object.values(counts).some((n) => n >= 3);
    case "twoPairs":
      return Object.values(counts).filter((n) => n >= 2).length >= 2;
    case "sequence":
      return effects.size >= 3;
    case "sameHero3":
      return [...heroes].some(
        (id) => cards.filter((c) => c.hero === id).length >= 3,
      );
    case "small":
      return cards.length > 0 && cards.length <= 2;
    case "twoHeroes":
      return heroes.size >= 2;
    case "threeHeroes":
      return heroes.size === 3;
    case "attackGuard":
      return cards.some(offensive) && effects.has("Защита");
    case "spentAll":
      return energy >= c.capacity;
    case "thirdTurn":
      return b.turn % 3 === 0;
    case "heldPower":
      return held.some((c) => c.multiplier >= 1.5);
    case "fibonacciTurn":
      return [1, 2, 3, 5, 8].includes(b.turn);
    case "cost2":
      return card ? card.energy >= 2 : cards.some((c) => c.energy >= 2);
    case "evenEnergy":
      return energy > 0 && energy % 2 === 0;
    case "oddEnergy":
      return energy % 2 === 1;
    case "firstCard":
      return card && cards[0]?.id === card.id;
    case "firstAttack":
      return card && cards.find(offensive)?.id === card.id;
    case "noSupply":
      return !(b.metrics?.suppliesUsed || 0);
    case "heldUtility":
      return (
        held.length > 0 &&
        held.every(
          (c) =>
            !offensive(c) && !["Уязвимость", "Замедление"].includes(c.effect),
        )
      );
    case "singleFirst":
      return b.turn === 1 && cards.length === 1;
    case "repeatPattern":
      return cards.length > 0 && pattern === b.previousPattern;
    case "newPattern":
      return (
        cards.length > 0 &&
        Boolean(b.previousPattern) &&
        pattern !== b.previousPattern
      );
    case "poor":
      return (b.coins || 0) <= 3;
    case "threeHeroesUsed":
      return new Set(b.usedHeroes || []).size === 3;
    case "suppliesOnly":
      return true;
    case "manyAttacks":
      return (b.metrics?.attacksPlayed || 0) >= 5;
    case "wounded":
      return b.heroes.some((h) => h.hp > 0 && h.hp <= h.maxHp / 2);
    case "lastDraw":
      return b.deck.draw.length === 0;
    case "vulnerable":
      return Boolean(target?.vulnerable);
    default:
      return false;
  }
}
function scaleValue(effect, c, id) {
  const { b, held } = c,
    owned = b.relicState?.[id] || {},
    stats = b.stats || {},
    metrics = b.metrics || {};
  const elapsed = (key) =>
    Math.max(
      0,
      (stats[key] || 0) + (metrics[key] || 0) - (owned.baseline?.[key] || 0),
    );
  switch (effect.scale) {
    case "emptySlots":
      return Math.max(0, 5 - b.relics.length);
    case "energyLeft":
      return Math.max(0, c.capacity - c.energy);
    case "poisonKill":
      return metrics.poisonKills || 0;
    case "turnCycle":
      return 1 + ((b.turn - 1) % 3);
    case "upgraded":
      return [...b.deck.hand, ...b.deck.draw, ...b.deck.spent].filter(
        (c) => c.upgradeCount > 0,
      ).length;
    case "relicCount":
      return b.relics.length;
    case "cost2Played":
      return metrics.cost2Played || 0;
    case "repeatTurns":
      return elapsed("repeatTurns");
    case "cheapStreak":
      return b.cheapStreak || 0;
    case "wins":
      return Math.max(0, (stats.wins || 0) - (owned.baseline?.wins || 0));
    case "sequenceTurns":
      return elapsed("sequenceTurns");
    case "meltTurn":
      return Math.max(0, effect.value - (b.turn - 1)) / effect.value;
    case "meltWins":
      return (
        Math.max(
          0,
          effect.value -
            Math.max(0, (stats.wins || 0) - (owned.baseline?.wins || 0)),
        ) / effect.value
      );
    case "draw":
      return b.deck.draw.length;
    case "attacksPlayed":
      return elapsed("attacksPlayed");
    case "heldCost2":
      return held.filter((c) => c.energy >= 2).length;
    case "bossWinsPlus":
      return (
        1 + Math.max(0, (stats.bossWins || 0) - (owned.baseline?.bossWins || 0))
      );
    case "spent":
      return b.deck.spent.length;
    case "coins":
      return Math.max(0, b.coins || 0);
    case "inventoryValue":
      return b.relics
        .filter((other) => other !== id)
        .reduce(
          (n, other) =>
            n +
            (b.relicState?.[other]?.paid ?? relicById(other)?.price ?? 0) / 2,
          0,
        );
    case "suppliesUsed":
      return elapsed("suppliesUsed");
    case "skips":
      return elapsed("skips");
    case "sales":
      return elapsed("sales");
    default:
      return 1;
  }
}
export function relicBonuses(b, card = null, target = null) {
  const c = relicContext(b, card, target),
    result = {
      damage: 0,
      guard: 0,
      heal: 0,
      poison: 0,
      mult: 0,
      factor: 1,
      cardFactor: 1,
      echo: 0,
      splash: 0,
      startGuard: 0,
      income: 0,
      afterHeal: 0,
      elixir: 0,
      discount: 0,
      triggers: [],
    };
  for (const id of b.relics) {
    const relic = relicById(id);
    if (!relic) continue;
    for (const effect of relic.effects) {
      if (!matches(effect.when, c)) continue;
      let value = effect.value * scaleValue(effect, c, id);
      if (effect.cap !== undefined) value = Math.min(effect.cap, value);
      if (!value) continue;
      if (["factor", "cardFactor"].includes(effect.stat))
        result[effect.stat] *= value;
      else result[effect.stat] += value;
      result.triggers.push({ id, name: relic.name, stat: effect.stat, value });
    }
  }
  return result;
}
// Only damage uses the shared chain. Defense/healing keep their own printed multiplier.
// Diminishing returns after ×3 keep late builds useful without exponential turn growth.
export function damageChain(b) {
  const c = relicContext(b),
    bonus = relicBonuses(b);
  if (!c.cards.length) return 1;
  const teamwork = c.heroes.size === 3 ? 0.25 : 0;
  const raw = (1 + teamwork + bonus.mult) * bonus.factor;
  return Math.round((raw <= 3 ? raw : 3 + Math.sqrt(raw - 3)) * 100) / 100;
}
export function localMultiplier(card) {
  return Math.max(
    1,
    Math.min(card.effect === "Урон" ? 3 : 2, card.multiplier || 1),
  );
}
export function recordTurn(b) {
  const cards = plannedCards(b),
    metrics = b.metrics || (b.metrics = {}),
    pattern = patternOf(cards);
  const add = (key, value) => (metrics[key] = (metrics[key] || 0) + value);
  add("attacksPlayed", cards.filter((c) => c.effect === "Урон").length);
  add("cost2Played", cards.filter((c) => c.energy >= 2).length);
  add("suppliesUsed", b.plan.filter((p) => p.kind === "supply").length);
  if (cards.length && pattern === b.previousPattern) add("repeatTurns", 1);
  if (new Set(cards.map((c) => c.effect)).size >= 3) add("sequenceTurns", 1);
  b.cheapStreak =
    cards.length && cards.every((c) => c.energy === 1)
      ? (b.cheapStreak || 0) + 1
      : 0;
  b.usedHeroes = [
    ...new Set([...(b.usedHeroes || []), ...cards.map((c) => c.hero)]),
  ];
  b.previousPattern = cards.length ? pattern : null;
}
