import { heroById } from "./party.js";
import { relicById, supplyById } from "./content.js";
import { HAND_LIMIT, planAction } from "./combat.js";
import { localMultiplier } from "./relics.js";
import { openShop } from "./shop.js";
import { freshStats } from "./campaign.js";

const SAVE = "dndrun-new-combat-v1",
  SCORES = "dndrun-new-scores-v1";
const nonnegative = (value) => Number.isFinite(value) && value >= 0;
const distinct = (values) => new Set(values).size === values.length;
const validParty = (party) =>
  Array.isArray(party) &&
  party.length === 3 &&
  distinct(party) &&
  party.every(heroById);
const validRelics = (relics) =>
  Array.isArray(relics) &&
  relics.length <= 5 &&
  distinct(relics) &&
  relics.every(relicById);
const validSupplies = (supplies) =>
  Array.isArray(supplies) &&
  supplies.length <= 2 &&
  supplies.every(
    (s) =>
      s &&
      typeof s.uid === "string" &&
      supplyById(s.id) &&
      (s.paid === undefined || nonnegative(s.paid)),
  ) &&
  distinct(supplies.map((s) => s.uid));
const validUnit = (unit) =>
  unit &&
  typeof unit.id === "string" &&
  nonnegative(unit.hp) &&
  Number.isFinite(unit.maxHp) &&
  unit.maxHp > 0 &&
  unit.hp <= unit.maxHp &&
  nonnegative(unit.guard);
const validCard = (card, party) =>
  card &&
  Number.isInteger(card.id) &&
  party.includes(card.hero) &&
  typeof card.name === "string" &&
  typeof card.effect === "string" &&
  Number.isInteger(card.energy) &&
  card.energy > 0 &&
  Number.isFinite(card.multiplier) &&
  card.multiplier >= 1 &&
  (card.amount === undefined || nonnegative(card.amount));
function validShop(shop, run) {
  if (
    !shop ||
    shop.chapter !== run.chapter ||
    shop.stage !== run.stage ||
    !Array.isArray(shop.offers) ||
    shop.offers.length !== 4
  )
    return false;
  if (
    !shop.offers.every(
      (o) =>
        o &&
        typeof o.sold === "boolean" &&
        (o.kind === "relic"
          ? relicById(o.id)
          : o.kind === "supply" && supplyById(o.id)),
    )
  )
    return false;
  return (
    shop.offers.filter((o) => o.kind === "relic").length === 3 &&
    shop.offers.filter((o) => o.kind === "supply").length === 1 &&
    distinct(shop.offers.map((o) => o.kind + ":" + o.id))
  );
}
function migrateSession(s) {
  const r = s.run;
  r.stats ||= {
    ...freshStats(),
    wins: r.completed,
    bossWins: Math.floor(r.completed / 3),
  };
  r.relicState ||= {};
  for (const id of r.relics)
    r.relicState[id] ||= { paid: 0, baseline: { ...r.stats } };
  r.supplies = r.supplies.map((item) => ({ paid: 0, ...item }));
  if (!r.rulesVersion) {
    r.cards = r.cards.map((c) => ({ ...c, multiplier: localMultiplier(c) }));
    if (r.battle)
      for (const pile of ["hand", "draw", "spent"])
        if (Array.isArray(r.battle.deck?.[pile]))
          r.battle.deck[pile] = r.battle.deck[pile].map((c) => ({
            ...c,
            multiplier: localMultiplier(c),
          }));
  }
  r.rulesVersion = 2;
  if (r.battle) {
    const b = r.battle;
    b.stats ||= { ...r.stats };
    b.relicState ||= structuredClone(r.relicState);
    b.metrics ||= {};
    b.usedHeroes ||= [];
    b.gildedUsed ||= [];
    b.coinEarned ||= 0;
    b.coins ??= r.coins;
  }
  if (s.modal === "victory" && r.rewardClaimed) {
    r.battle = null;
    openShop(r);
    s.screen = "shop";
    s.modal = null;
  }
  s.version = 2;
  return s;
}
function validBattle(battle, run) {
  if (
    !battle ||
    !["active", "victory", "defeat"].includes(battle.status) ||
    !Array.isArray(battle.heroes) ||
    battle.heroes.length !== 3 ||
    !battle.heroes.every(validUnit) ||
    battle.heroes.some((h, i) => h.id !== run.party[i]) ||
    !Array.isArray(battle.enemies) ||
    !battle.enemies.length ||
    !battle.enemies.every(validUnit) ||
    !distinct(battle.enemies.map((e) => e.id))
  )
    return false;
  if (
    !validRelics(battle.relics) ||
    !validSupplies(battle.supplies) ||
    !Number.isInteger(battle.turn) ||
    battle.turn < 1 ||
    !Number.isInteger(battle.maxElixir) ||
    battle.maxElixir < 4 ||
    !Array.isArray(battle.log) ||
    !battle.log.every((line) => typeof line === "string") ||
    !Array.isArray(battle.plan)
  )
    return false;
  const deck = battle.deck;
  if (
    !deck ||
    !["hand", "draw", "spent"].every((pile) => Array.isArray(deck[pile])) ||
    deck.hand.length > HAND_LIMIT
  )
    return false;
  const cards = [...deck.hand, ...deck.draw, ...deck.spent];
  if (
    cards.length !== run.cards.length ||
    !distinct(cards.map((c) => c?.id)) ||
    !cards.every(
      (c) =>
        validCard(c, run.party) &&
        run.cards.some(
          (original) => original.id === c.id && original.hero === c.hero,
        ),
    )
  )
    return false;
  const ids = [...run.party, ...battle.enemies.map((e) => e.id)];
  if (
    battle.enemies.some(
      (e) =>
        e.intent &&
        (!["attack", "all", "guard", "heal", "hex", "poison"].includes(
          e.intent.type,
        ) ||
          !nonnegative(e.intent.amount) ||
          (!ids.includes(e.intent.target) && e.intent.target !== "all")),
    )
  )
    return false;
  let planned = { ...battle, plan: [] };
  for (const action of battle.plan) {
    if (!action) return false;
    planned = planAction(planned, action.kind, action.id, action.target);
    if (!planned) return false;
  }
  return true;
}
export function saveSession(session) {
  try {
    localStorage.setItem(SAVE, JSON.stringify({ version: 2, ...session }));
  } catch {
    /* Storage may be disabled; the current session stays playable. */
  }
}
export function loadSession() {
  try {
    let s = JSON.parse(localStorage.getItem(SAVE)),
      r = s?.run;
    if (
      ![1, 2].includes(s?.version) ||
      !r ||
      r.cards?.length !== 27 ||
      !Array.isArray(r.heroes) ||
      r.heroes.length !== 3 ||
      !Array.isArray(r.party) ||
      r.party.length !== 3 ||
      !Array.isArray(r.relics) ||
      !Array.isArray(r.supplies) ||
      !Array.isArray(r.encounters) ||
      r.encounters.length !== 3 ||
      !Number.isInteger(r.chapter) ||
      r.chapter < 1 ||
      !Number.isInteger(r.stage) ||
      r.stage < 0 ||
      r.stage > 2 ||
      !Number.isFinite(r.score) ||
      !Number.isFinite(r.coins)
    )
      return null;
    if (
      !validParty(r.party) ||
      !r.heroes.every(validUnit) ||
      r.heroes.some((h, i) => h.id !== r.party[i]) ||
      !r.cards.every((c) => validCard(c, r.party)) ||
      !distinct(r.cards.map((c) => c.id)) ||
      !validRelics(r.relics) ||
      !validSupplies(r.supplies) ||
      !Number.isInteger(r.difficulty) ||
      r.difficulty < 0 ||
      r.difficulty > 2 ||
      !Number.isInteger(r.seed) ||
      !Number.isInteger(r.completed) ||
      r.completed < 0 ||
      !Number.isInteger(r.supplySerial) ||
      r.supplySerial < 0
    )
      return null;
    if (
      r.encounters.some(
        (e) =>
          !e ||
          typeof e.name !== "string" ||
          typeof e.region !== "string" ||
          !Array.isArray(e.enemies) ||
          !e.enemies.length ||
          !e.enemies.every(validUnit) ||
          !nonnegative(e.reward) ||
          (e.skip &&
            (!Array.isArray(e.skip.labels) ||
              !e.skip.labels.length ||
              !e.skip.labels.every((label) => typeof label === "string"))),
      )
    )
      return null;
    s = migrateSession(s);
    if (
      !Object.values(r.stats).every(nonnegative) ||
      !r.relicState ||
      r.relics.some((id) => !nonnegative(r.relicState[id]?.paid))
    )
      return null;
    if (
      !["route", "battle", "shop"].includes(s.screen) ||
      (s.screen === "battle" && !validBattle(r.battle, r))
    )
      return null;
    if (s.screen === "shop" && (!r.rewardClaimed || !validShop(r.shop, r)))
      return null;
    if (s.modal !== null && !["final"].includes(s.modal)) return null;
    if (s.modal === "final" && s.screen !== "route") return null;
    return s;
  } catch {
    return null;
  }
}
export function readScores() {
  try {
    const rows = JSON.parse(localStorage.getItem(SCORES));
    return Array.isArray(rows)
      ? rows
          .filter(
            (r) =>
              r &&
              nonnegative(r.score) &&
              validParty(r.party) &&
              Number.isInteger(r.chapter) &&
              r.chapter > 0,
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
export function recordScore(run, outcome) {
  if (run.finished) return;
  run.finished = true;
  try {
    const rows = readScores();
    rows.push({
      score: run.score,
      chapter: run.chapter,
      party: run.party,
      outcome,
      date: Date.now(),
    });
    rows.sort((a, b) => b.score - a.score);
    localStorage.setItem(SCORES, JSON.stringify(rows.slice(0, 20)));
  } catch {}
}
