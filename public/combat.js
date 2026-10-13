import { shuffle } from "./deck.js";
import { seededRandom, supplyById } from "./content.js";
import {
  relicBonuses,
  damageChain,
  localMultiplier,
  recordTurn,
  plannedCards,
} from "./relics.js";
import { canUpgrade, upgradeCard, updateBattleCard } from "./upgrades.js";

export const HAND_LIMIT = 9;
export const BASE_ELIXIR = 4;
const clone = (value) => structuredClone(value);
const alive = (unit) => unit.hp > 0;
const partyAlive = (b) => b.heroes.filter(alive);
export const cardTarget = (card) =>
  ["Урон", "Яд", "Уязвимость", "Замедление"].includes(card.effect)
    ? "enemy"
    : "ally";
const cardById = (b, id) => b.deck.hand.find((c) => c.id === id);
export function effectiveCard(
  card,
  relics = [],
  owner = null,
  battle = null,
  context = {},
) {
  // Outside combat, show persistent bonuses without inventing a planned turn.
  const b = battle || {
    ...context,
    relics,
    plan: [],
    deck: { hand: context.cards || [card], draw: [], spent: [] },
    heroes: context.heroes || (owner ? [owner] : []),
    turn: 0,
    maxElixir: 4,
  };
  const bonuses = relicBonuses(b, card),
    next = { ...card, multiplier: localMultiplier(card) };
  if (card.effect === "Урон")
    next.amount += Math.floor(bonuses.damage) + (owner?.strength || 0);
  if (card.effect === "Защита") next.amount += Math.floor(bonuses.guard);
  if (card.effect === "Лечение") next.amount += Math.floor(bonuses.heal);
  if (card.poison)
    next.detail = (card.detail || "яд " + card.poison).replace(
      /яд \d+/,
      "яд " + (card.poison + Math.floor(bonuses.poison)),
    );
  if (card.gilded)
    next.detail = [next.detail, "+1 монета"].filter(Boolean).join(" · ");
  return next;
}
export function remainingElixir(b) {
  const extra = b.plan.some(
    (p) =>
      p.kind === "supply" &&
      supplyById(b.supplies.find((s) => s.uid === p.id)?.id)?.effect ===
        "Эликсир",
  )
    ? 1
    : 0;
  return (
    b.maxElixir + extra - plannedCards(b).reduce((n, c) => n + c.energy, 0)
  );
}
export const turnMultiplier = damageChain;
function cleanUnit(unit) {
  return {
    ...unit,
    poison: 0,
    vulnerable: 0,
    slow: 0,
    dodge: 0,
    strength: 0,
    strengthTurns: 0,
  };
}
function refreshIntents(b) {
  const living = partyAlive(b);
  b.enemies.forEach((e, i) => {
    if (!alive(e)) {
      e.intent = null;
      return;
    }
    const target = living[(b.turn - 1 + i) % living.length]?.id;
    const n = b.turn % 3;
    if (e.role === "guard" && n === 1)
      e.intent = { type: "guard", amount: 6, target: e.id };
    else if (
      e.role === "heal" &&
      b.enemies.some((u) => alive(u) && u.hp < u.maxHp - 4)
    )
      e.intent = {
        type: "heal",
        amount: 7,
        target: [...b.enemies]
          .filter(alive)
          .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0].id,
      };
    else if (e.type === "witch" && n === 2)
      e.intent = { type: "hex", amount: 2, target };
    else if (e.role === "boss" && n === 0)
      e.intent = {
        type: "all",
        amount: Math.max(1, e.attack - 2),
        target: "all",
      };
    else if (e.type === "sentinel" && n === 2)
      e.intent = { type: "guard", amount: 10, target: e.id };
    else if (e.role === "hex" && n === 1)
      e.intent = { type: "hex", amount: 2, target };
    else if (e.role === "poison" && n !== 0)
      e.intent = {
        type: "poison",
        amount: 3 + Math.floor((b.chapter - 1) / 3),
        damage: e.attack,
        target,
      };
    else
      e.intent = {
        type: "attack",
        amount: e.role === "heavy" && n === 0 ? e.attack + 4 : e.attack,
        target,
      };
  });
}
export function createBattle({
  heroes,
  cards,
  encounter,
  relics = [],
  supplies = [],
  seed = 1,
  context = {},
}) {
  const draw = shuffle(clone(cards), seededRandom(seed)),
    maxElixir =
      BASE_ELIXIR +
      Math.min(
        1,
        relicBonuses({
          relics,
          plan: [],
          deck: { hand: [], draw: [], spent: [] },
          heroes: [],
          turn: 1,
          maxElixir: 4,
        }).elixir,
      );
  const b = {
    coins: context.coins || 0,
    stats: structuredClone(context.stats || {}),
    relicState: structuredClone(context.relicState || {}),
    metrics: {},
    usedHeroes: [],
    previousPattern: null,
    cheapStreak: 0,
    coinEarned: 0,
    gildedUsed: [],
    heroes: heroes.map((h) => cleanUnit({ ...h, guard: 0 })),
    enemies: encounter.enemies.map(cleanUnit),
    relics: [...relics],
    supplies: clone(supplies),
    maxElixir,
    turn: 1,
    chapter: encounter.chapter,
    deck: {
      hand: draw.splice(0, HAND_LIMIT),
      draw,
      spent: [],
      total: cards.length,
    },
    plan: [],
    status: "active",
    log: [],
  };
  const startGuard = Math.min(12, Math.floor(relicBonuses(b).startGuard));
  b.heroes.forEach((h) => (h.guard = startGuard));
  refreshIntents(b);
  return b;
}
export function validTarget(b, kind, id, target) {
  const item =
    kind === "card"
      ? cardById(b, id)
      : supplyById(b.supplies.find((s) => s.uid === id)?.id);
  if (!item) return false;
  if (kind === "supply" && item.target === "card") {
    const card = b.deck.hand.find((c) => "card:" + c.id === target);
    return Boolean(
      card &&
      b.heroes.some((h) => h.id === card.hero && alive(h)) &&
      canUpgrade(card, item, [...b.deck.hand, ...b.deck.draw, ...b.deck.spent]),
    );
  }
  if (kind === "supply" && item.effect === "Возврат")
    return (
      b.deck.hand.length < HAND_LIMIT &&
      b.deck.spent.some((c) => c.hero === target) &&
      b.heroes.some((h) => h.id === target && alive(h))
    );
  const side = kind === "card" ? cardTarget(item) : item.target;
  return (side === "enemy" ? b.enemies : b.heroes).some(
    (u) => u.id === target && alive(u),
  );
}
export function planAction(b, kind, id, target) {
  if (
    b.status !== "active" ||
    !["card", "supply"].includes(kind) ||
    !validTarget(b, kind, id, target) ||
    b.plan.some((p) => p.kind === kind && p.id === id)
  )
    return null;
  if (kind === "card") {
    const c = cardById(b, id);
    if (
      !b.heroes.some((h) => h.id === c.hero && alive(h)) ||
      c.energy > remainingElixir(b)
    )
      return null;
  } else if (b.plan.some((p) => p.kind === "supply")) return null;
  const next = clone(b);
  next.plan.push({ kind, id, target });
  return next;
}
export function undoAction(b, index) {
  if (
    b.status !== "active" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= b.plan.length
  )
    return b;
  const next = clone(b);
  next.plan.splice(index, 1);
  while (remainingElixir(next) < 0) {
    const i = next.plan.findLastIndex((p) => p.kind === "card");
    next.plan.splice(i, 1);
  }
  return next;
}
function hit(unit, amount, b, label) {
  if (!alive(unit)) return;
  let damage = Math.max(0, Math.floor(amount * (unit.vulnerable ? 1.25 : 1)));
  if (unit.dodge) {
    damage = Math.floor(damage / 2);
    unit.dodge = 0;
  }
  const blocked = Math.min(unit.guard, damage);
  unit.guard -= blocked;
  damage -= blocked;
  unit.hp = Math.max(0, unit.hp - damage);
  b.log.push(
    `${label}: ${unit.name || unit.id} −${damage}${blocked ? ` (щит ${blocked})` : ""}`,
  );
}
function tickPoison(units, b) {
  for (const u of units.filter(alive)) {
    if (u.poison) {
      const damage = u.poison;
      if (b.enemies.includes(u) && damage >= u.hp)
        b.metrics.poisonKills = (b.metrics.poisonKills || 0) + 1;
      u.hp = Math.max(0, u.hp - damage);
      u.poison = Math.max(0, u.poison - 1);
      b.log.push(`Яд: ${u.name || u.id} −${damage}`);
    }
  }
}
function playerPhase(b) {
  const chain = turnMultiplier(b);
  b.log = [];
  b.metrics ||= {};
  b.gildedUsed ||= [];
  b.coinEarned ||= 0;
  for (const p of b.plan) {
    const card = p.kind === "card" ? cardById(b, p.id) : null;
    const item = card || supplyById(b.supplies.find((s) => s.uid === p.id)?.id);
    if (!item) continue;
    if (!card && item.target === "card") {
      const chosen = b.deck.hand.find((c) => "card:" + c.id === p.target);
      if (
        chosen &&
        canUpgrade(chosen, item, [
          ...b.deck.hand,
          ...b.deck.draw,
          ...b.deck.spent,
        ])
      ) {
        updateBattleCard(
          b,
          chosen.id,
          upgradeCard(chosen, item, [
            ...b.deck.hand,
            ...b.deck.draw,
            ...b.deck.spent,
          ]),
        );
        b.log.push(item.name + ": " + chosen.name + " улучшена");
      }
      continue;
    }
    if (!card && item.effect === "Эликсир") continue;
    if (!card && item.effect === "Возврат") {
      const index = b.deck.spent.findLastIndex((c) => c.hero === p.target);
      if (index >= 0 && b.deck.hand.length < HAND_LIMIT)
        b.deck.hand.push(...b.deck.spent.splice(index, 1));
      continue;
    }
    const side = card ? cardTarget(card) : item.target,
      units = side === "enemy" ? b.enemies : b.heroes;
    const target = units.find((u) => u.id === p.target);
    if (!target || !alive(target)) continue;
    const targets = item.all ? units.filter(alive) : [target];
    const owner = card ? b.heroes.find((h) => h.id === card.hero) : null;
    for (const u of targets) {
      const bonus = card ? relicBonuses(b, card, u) : null;
      let base = item.amount || 0;
      if (card && item.effect === "Урон")
        base += Math.floor(bonus.damage) + (owner?.strength || 0);
      if (card && item.effect === "Защита") base += Math.floor(bonus.guard);
      if (card && item.effect === "Лечение") base += Math.floor(bonus.heal);
      const scale = card
        ? localMultiplier(card) *
          (item.effect === "Урон" ? chain * bonus.cardFactor : 1)
        : 1;
      const amount = Math.floor(base * scale);
      if (item.effect === "Урон") {
        hit(u, amount, b, item.name);
        if (card && bonus.echo > 0 && alive(u))
          hit(u, Math.floor(base * Math.min(0.5, bonus.echo)), b, "Эхо");
        if (card && bonus.splash > 0)
          for (const other of b.enemies.filter((e) => e !== u && alive(e)))
            hit(
              other,
              Math.floor(amount * Math.min(0.4, bonus.splash)),
              b,
              "Разлив",
            );
      }
      if (item.effect === "Защита") {
        u.guard += amount;
        b.log.push(
          item.name + ": " + (u.name || u.id) + " +" + amount + " защиты",
        );
      }
      if (item.effect === "Лечение") {
        const healed = Math.min(u.maxHp - u.hp, amount);
        u.hp += healed;
        if (card?.cleansing) u.poison = 0;
        b.log.push(
          item.name + ": " + (u.name || u.id) + " +" + healed + " здоровья",
        );
      }
      if (item.effect === "Уязвимость")
        u.vulnerable = Math.max(u.vulnerable, 2);
      if (item.effect === "Замедление" || card?.slow)
        u.slow = Math.max(u.slow, 2);
      if (item.effect === "Уклонение") u.dodge = 1;
      if (item.effect === "Очищение") {
        u.poison = 0;
        u.vulnerable = 0;
        u.hp = Math.min(u.maxHp, u.hp + amount);
      }
      if (item.effect === "Разоружение")
        u.guard = Math.max(0, u.guard - amount);
      if (item.effect === "Усиление") {
        u.strength = amount;
        u.strengthTurns = 2;
      }
      if (item.effect === "Яд" || card?.poison)
        u.poison += Math.floor(
          (card?.poison || base) + (card ? bonus.poison : 0),
        );
    }
    if (card?.gilded && !b.gildedUsed.includes(card.id)) {
      b.coinEarned++;
      b.gildedUsed.push(card.id);
    }
  }
}
function checkOutcome(b) {
  if (!partyAlive(b).length) {
    b.status = "defeat";
    b.reason = "Отряд пал.";
    return true;
  }
  if (!b.enemies.some(alive)) {
    b.status = "victory";
    return true;
  }
  return false;
}
function enemyPhase(b) {
  for (const e of b.enemies.filter(alive)) {
    const intent = e.intent;
    if (!intent) continue;
    const target = (
      ["guard", "heal"].includes(intent.type) ? b.enemies : b.heroes
    ).find((u) => u.id === intent.target);
    if (intent.type === "all") {
      for (const h of partyAlive(b))
        hit(h, Math.max(1, intent.amount - (e.slow ? 2 : 0)), b, e.name);
    } else if (target && alive(target)) {
      if (intent.type === "guard") target.guard += intent.amount;
      else if (intent.type === "heal")
        target.hp = Math.min(target.maxHp, target.hp + intent.amount);
      else if (intent.type === "hex")
        target.vulnerable = Math.max(target.vulnerable, 2);
      else {
        hit(
          target,
          Math.max(1, (intent.damage || intent.amount) - (e.slow ? 2 : 0)),
          b,
          e.name,
        );
        if (intent.type === "poison" && alive(target))
          target.poison += intent.amount;
      }
    }
    if (checkOutcome(b)) return;
  }
  tickPoison(b.heroes, b);
  checkOutcome(b);
}
export function previewTurn(b) {
  const next = clone(b);
  playerPhase(next);
  tickPoison(next.enemies, next);
  checkOutcome(next);
  return next;
}
export function endTurn(b) {
  if (b.status !== "active") return b;
  const next = clone(b);
  playerPhase(next);
  tickPoison(next.enemies, next);
  recordTurn(next);
  const cardIds = new Set(
      next.plan.filter((p) => p.kind === "card").map((p) => p.id),
    ),
    supplyIds = new Set(
      next.plan.filter((p) => p.kind === "supply").map((p) => p.id),
    );
  next.deck.spent.push(...next.deck.hand.filter((c) => cardIds.has(c.id)));
  next.deck.hand = next.deck.hand.filter((c) => !cardIds.has(c.id));
  next.supplies = next.supplies.filter((s) => !supplyIds.has(s.uid));
  next.plan = [];
  if (checkOutcome(next)) return next;
  enemyPhase(next);
  if (next.status !== "active") return next;
  next.turn++;
  for (const u of [...next.heroes, ...next.enemies]) {
    u.vulnerable = Math.max(0, u.vulnerable - 1);
    u.slow = Math.max(0, u.slow - 1);
    u.strengthTurns = Math.max(0, u.strengthTurns - 1);
    if (!u.strengthTurns) u.strength = 0;
    if (next.heroes.includes(u)) {
      u.guard = 0;
      u.dodge = 0;
    }
  }
  // A fallen hero's unusable cards must never clog the finite hand.
  for (const pile of ["hand", "draw"]) {
    const unusable = next.deck[pile].filter(
      (c) => !next.heroes.some((h) => h.id === c.hero && alive(h)),
    );
    next.deck.spent.push(...unusable);
    next.deck[pile] = next.deck[pile].filter((c) => !unusable.includes(c));
  }
  next.deck.hand.push(
    ...next.deck.draw.splice(
      0,
      Math.max(0, HAND_LIMIT - next.deck.hand.length),
    ),
  );
  refreshIntents(next);
  if (
    !next.deck.hand.length &&
    !next.supplies.some((s) =>
      [...next.heroes, ...next.enemies].some((u) =>
        validTarget(next, "supply", s.uid, u.id),
      ),
    ) &&
    !next.enemies.some((e) => alive(e) && e.poison > 0)
  ) {
    next.status = "defeat";
    next.reason = "Заклинания и припасы закончились.";
  }
  return next;
}
