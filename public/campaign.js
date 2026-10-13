import {
  chapterEncounters,
  relics,
  supplies,
  seededRandom,
} from "./content.js";
import { heroById, heroHealth, buildDeck } from "./party.js";

export const MAIN_CHAPTERS = 3;
export function createRun(party, difficulty = 0, seed = Date.now() >>> 0) {
  return {
    seed,
    chapter: 1,
    stage: 0,
    difficulty,
    score: 0,
    coins: 4,
    relics: [],
    supplies: [{ uid: "starter", id: "tonic" }],
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
    encounters: chapterEncounters(1, seed, difficulty),
    completed: 0,
    finished: false,
    endless: false,
    rewardClaimed: false,
  };
}
export function addSupply(run, id) {
  if (run.supplies.length >= 2) return false;
  run.supplies.push({ uid: `supply-${++run.supplySerial}`, id });
  return true;
}
export function rewardChoices(run) {
  const random = seededRandom(run.seed + run.chapter * 101 + run.stage * 17);
  const available = relics.filter((r) => !run.relics.includes(r.id));
  const relic = available[Math.floor(random() * available.length)];
  const hero = run.party[Math.floor(random() * run.party.length)];
  const attack =
    run.cards.filter((c) => c.hero === hero && c.effect === "Урон")[0] ||
    run.cards.find((c) => c.hero === hero);
  const item = supplies[Math.floor(random() * supplies.length)];
  return [
    relic && {
      kind: "relic",
      id: relic.id,
      name: relic.name,
      description: relic.description,
      icon: relic.icon,
    },
    {
      kind: "upgrade",
      hero,
      name: `${attack.name} +2`,
      spell: attack.name,
      description: "Все копии: эффект +2, множитель +0,25.",
      icon: attack.icon,
    },
    {
      kind: "supply",
      id: item.id,
      name: item.name,
      description: item.description,
      icon: item.icon,
    },
  ].filter(Boolean);
}
export function claimVictory(run, battle) {
  if (run.rewardClaimed || battle.status !== "victory") return false;
  run.battle = battle;
  run.heroes = battle.heroes.map((h) => ({
    ...h,
    guard: 0,
    poison: 0,
    vulnerable: 0,
    slow: 0,
    dodge: 0,
    strength: 0,
    strengthTurns: 0,
  }));
  run.supplies = battle.supplies;
  run.coins += run.encounters[run.stage].reward;
  run.score += Math.round(
    (100 * run.chapter +
      Math.max(0, 12 - battle.turn) * 20 +
      run.heroes.reduce((n, h) => n + h.hp, 0)) *
      (1 + run.difficulty * 0.25),
  );
  run.completed++;
  run.rewardClaimed = true;
  // A downed hero returns wounded between encounters; deaths still end an entire wiped squad.
  for (const h of run.heroes) {
    h.hp =
      h.hp > 0
        ? Math.min(h.maxHp, h.hp + 4 + (run.relics.includes("herb") ? 3 : 0))
        : 8;
  }
  return true;
}
export function chooseReward(run, choice, replace = null) {
  if (!run.rewardClaimed || run.rewardChosen) return false;
  if (choice.kind === "relic") {
    if (run.relics.includes(choice.id)) return false;
    if (run.relics.length >= 5) {
      if (!run.relics.includes(replace)) return false;
      run.relics.splice(run.relics.indexOf(replace), 1);
    }
    run.relics.push(choice.id);
  } else if (choice.kind === "upgrade") {
    const improve = (c) =>
      c.hero === choice.hero && c.name === choice.spell
        ? {
            ...c,
            amount: (c.amount || 0) + 2,
            multiplier: Math.round((c.multiplier + 0.25) * 100) / 100,
          }
        : c;
    run.cards = run.cards.map(improve);
    if (run.battle)
      for (const pile of ["hand", "draw", "spent"])
        run.battle.deck[pile] = run.battle.deck[pile].map(improve);
  } else if (choice.kind === "supply") {
    if (run.supplies.length >= 2) {
      if (!run.supplies.some((s) => s.uid === replace)) return false;
      run.supplies = run.supplies.filter((s) => s.uid !== replace);
    }
    addSupply(run, choice.id);
  } else return false;
  run.rewardChosen = true;
  return true;
}
export function advanceRun(run) {
  run.battle = null;
  run.rewardClaimed = false;
  run.rewardChosen = false;
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
  run.rewardClaimed = false;
  run.rewardChosen = false;
  run.encounters = chapterEncounters(run.chapter, run.seed, run.difficulty);
}
export function rest(run) {
  if (run.coins < 3 || run.heroes.every((h) => h.hp === h.maxHp)) return false;
  run.coins -= 3;
  for (const h of run.heroes) h.hp = Math.min(h.maxHp, h.hp + 12);
  return true;
}
