import { chapterEncounters } from "./content.js";
import { heroById, heroHealth, buildDeck } from "./party.js";
import { relicBonuses } from "./relics.js";
import { openShop } from "./shop.js";

export const MAIN_CHAPTERS = 3;
export const freshStats = () => ({
  wins: 0,
  bossWins: 0,
  attacksPlayed: 0,
  cost2Played: 0,
  suppliesUsed: 0,
  sequenceTurns: 0,
  repeatTurns: 0,
  skips: 0,
  sales: 0,
});
export function createRun(party, difficulty = 0, seed = Date.now() >>> 0) {
  return {
    rulesVersion: 2,
    seed,
    chapter: 1,
    stage: 0,
    difficulty,
    score: 0,
    coins: 4,
    relics: [],
    relicState: {},
    stats: freshStats(),
    supplies: [{ uid: "starter", id: "tonic", paid: 0 }],
    supplySerial: 0,
    party: [...party],
    heroes: party.map((id) => ({
      id,
      name: heroById(id).name,
      hp: heroHealth[id],
      maxHp: heroHealth[id],
      guard: 0,
    })),
    cards: buildDeck(party),
    battle: null,
    shop: null,
    encounters: chapterEncounters(1, seed, difficulty),
    completed: 0,
    finished: false,
    endless: false,
    rewardClaimed: false,
  };
}
export function addSupply(run, id, paid = 0) {
  if (run.supplies.length >= 2) return false;
  run.supplies.push({ uid: "supply-" + ++run.supplySerial, id, paid });
  return true;
}
export function syncBattleProgress(run, b) {
  run.heroes = b.heroes;
  run.supplies = b.supplies;
  const cards = new Map(
    [...b.deck.hand, ...b.deck.draw, ...b.deck.spent].map((c) => [c.id, c]),
  );
  run.cards = run.cards.map((c) => cards.get(c.id) || c);
}
export function claimVictory(run, battle) {
  if (run.rewardClaimed || battle.status !== "victory") return false;
  syncBattleProgress(run, battle);
  const bonus = relicBonuses(battle);
  run.coins +=
    run.encounters[run.stage].reward +
    Math.min(8, Math.floor(bonus.income)) +
    (battle.coinEarned || 0);
  run.score += Math.round(
    (100 * run.chapter +
      Math.max(0, 12 - battle.turn) * 20 +
      run.heroes.reduce((n, h) => n + h.hp, 0)) *
      (1 + run.difficulty * 0.25),
  );
  for (const [key, value] of Object.entries(battle.metrics || {}))
    if (key in run.stats) run.stats[key] += value;
  run.stats.wins++;
  if (run.stage === 2) run.stats.bossWins++;
  run.completed++;
  run.rewardClaimed = true;
  run.heroes = run.heroes.map((h) => ({
    ...h,
    hp:
      h.hp > 0
        ? Math.min(h.maxHp, h.hp + 4 + Math.min(6, Math.floor(bonus.afterHeal)))
        : 8,
    guard: 0,
    poison: 0,
    vulnerable: 0,
    slow: 0,
    dodge: 0,
    strength: 0,
    strengthTurns: 0,
  }));
  run.cards = run.cards.map((c) =>
    c.growing > 0
      ? {
          ...c,
          amount: Math.min((c.originalAmount ?? c.amount) + 8, c.amount + 1),
          originalAmount: c.originalAmount ?? c.amount,
          growing: c.growing - 1,
        }
      : c,
  );
  run.battle = null;
  openShop(run);
  return true;
}
export function advanceRun(run) {
  run.battle = null;
  run.shop = null;
  run.rewardClaimed = false;
  if (run.stage < 2) {
    run.stage++;
    return "route";
  }
  if (run.chapter === MAIN_CHAPTERS && !run.endless) return "final";
  run.chapter++;
  run.stage = 0;
  run.encounters = chapterEncounters(run.chapter, run.seed, run.difficulty);
  return "route";
}
export function enterEndless(run) {
  run.endless = true;
  run.chapter++;
  run.stage = 0;
  run.battle = null;
  run.shop = null;
  run.rewardClaimed = false;
  run.encounters = chapterEncounters(run.chapter, run.seed, run.difficulty);
}
export function rest(run) {
  if (
    run.battle?.status === "active" ||
    run.coins < 3 ||
    run.heroes.every((h) => h.hp === h.maxHp)
  )
    return false;
  run.coins -= 3;
  for (const h of run.heroes) h.hp = Math.min(h.maxHp, h.hp + 12);
  return true;
}
