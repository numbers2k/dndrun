import { pathToFileURL } from "node:url";
import { heroes, defaultParty } from "../public/party.js";
import {
  createRun,
  claimVictory,
  rewardChoices,
  chooseReward,
  advanceRun,
  enterEndless,
  rest,
} from "../public/campaign.js";
import {
  createBattle,
  planAction,
  previewTurn,
  endTurn,
  remainingElixir,
  cardTarget,
} from "../public/combat.js";

// Greedy informed baseline: no knowledge of draw order, tries every legal card/target.
// This is a diagnostic agent, not a substitute for playtesting.
function utility(before, after) {
  let value = 0;
  for (let i = 0; i < before.enemies.length; i++) {
    const a = before.enemies[i],
      b = after.enemies[i];
    value += (a.hp - b.hp) * 1.3 + (a.guard - b.guard) * 0.35;
    if (a.hp > 0 && b.hp <= 0) value += 12 + a.attack;
    if (b.hp > 0)
      value += (b.vulnerable - a.vulnerable) * 3 + (b.slow - a.slow) * 2;
  }
  for (let i = 0; i < before.heroes.length; i++) {
    const a = before.heroes[i],
      b = after.heroes[i];
    value += (b.hp - a.hp) * 0.7;
    const threat = before.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          e.intent &&
          (e.intent.target === a.id || e.intent.type === "all"),
      )
      .reduce((n, e) => n + (e.intent.damage || e.intent.amount), 0);
    value += (Math.min(b.guard, threat) - Math.min(a.guard, threat)) * 0.75;
    if (a.hp < 15) value += (b.hp - a.hp) * 0.8;
    value += (b.dodge - a.dodge) * Math.min(threat, 10) * 0.5;
  }
  return value;
}
export function autoBattle(b, policy = "mixed") {
  while (b.status === "active" && b.turn < 35) {
    while (remainingElixir(b) > 0) {
      const initial = previewTurn(b),
        planned = new Set(
          b.plan.filter((p) => p.kind === "card").map((p) => p.id),
        );
      let best = null,
        bestValue = -Infinity;
      for (const c of b.deck.hand.filter((c) => !planned.has(c.id))) {
        const targets = cardTarget(c) === "enemy" ? b.enemies : b.heroes;
        for (const t of targets.filter((t) => t.hp > 0)) {
          const candidate = planAction(b, "card", c.id, t.id);
          if (!candidate) continue;
          let value = utility(initial, previewTurn(candidate));
          if (policy === "attack" && c.effect !== "Урон") continue;
          value /= Math.max(1, c.energy);
          if (value > bestValue) {
            bestValue = value;
            best = candidate;
          }
        }
      }
      // Spending an unhelpful card still unlocks the finite draw pile.
      if (!best) break;
      b = best;
    }
    if (b.supplies.length && !b.plan.some((p) => p.kind === "supply")) {
      let best = null,
        bestValue = 3,
        initial = previewTurn(b);
      for (const s of b.supplies)
        for (const t of [...b.enemies, ...b.heroes].filter((t) => t.hp > 0)) {
          const candidate = planAction(b, "supply", s.uid, t.id);
          if (!candidate) continue;
          const value = utility(initial, previewTurn(candidate));
          if (value > bestValue) {
            best = candidate;
            bestValue = value;
          }
        }
      if (best) b = best;
    }
    b = endTurn(b);
  }
  return b;
}
export function autoRun(
  party,
  seed,
  policy = "mixed",
  difficulty = 0,
  maxChapter = 4,
) {
  const r = createRun(party, difficulty, seed);
  let turns = 0;
  while (r.chapter <= maxChapter) {
    if (r.heroes.some((h) => h.hp < h.maxHp - 12)) rest(r);
    const b = autoBattle(
      createBattle({
        heroes: r.heroes,
        cards: r.cards,
        encounter: r.encounters[r.stage],
        relics: r.relics,
        supplies: r.supplies,
        seed: r.seed + r.completed * 919 + r.chapter * 31 + r.stage,
      }),
      policy,
    );
    turns += b.turn;
    if (b.status !== "victory")
      return {
        party,
        seed,
        policy,
        difficulty,
        chapter: r.chapter,
        stage: r.stage,
        victories: r.completed,
        status: b.status,
        turns,
        score: r.score,
      };
    claimVictory(r, b);
    const choices = rewardChoices(r),
      relic = choices.find((c) => c.kind === "relic" && r.relics.length < 5),
      upgrade = choices.find((c) => c.kind === "upgrade");
    chooseReward(r, relic || upgrade);
    const next = advanceRun(r);
    if (next === "final") enterEndless(r);
  }
  return {
    party,
    seed,
    policy,
    difficulty,
    chapter: r.chapter,
    stage: r.stage,
    victories: r.completed,
    status: "passed",
    turns,
    score: r.score,
  };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 5; j++)
      for (let k = j + 1; k < 6; k++)
        for (let seed = 1; seed <= 5; seed++)
          results.push(
            autoRun([heroes[i].id, heroes[j].id, heroes[k].id], seed * 101),
          );
  for (let seed = 1; seed <= 10; seed++) {
    results.push(autoRun(defaultParty, seed * 79, "attack"));
    results.push(autoRun(defaultParty, seed * 79, "mixed", 0, 15));
    results.push(autoRun(defaultParty, seed * 79, "mixed", 2, 4));
  }
  const summary = {
    runs: results.length,
    deepEndless: results
      .filter(
        (r) => r.policy === "mixed" && r.difficulty === 0 && r.seed % 79 === 0,
      )
      .map((r) => ({
        seed: r.seed,
        chapter: r.chapter,
        stage: r.stage,
        status: r.status,
      })),
    mainCompleted: results.filter((r) => r.victories >= 9).length,
    endlessChapterPassed: results.filter((r) => r.victories >= 12).length,
    firstBattleWins: results.filter((r) => r.victories >= 1).length,
    averageVictories:
      results.reduce((n, r) => n + r.victories, 0) / results.length,
    byParty: [...new Set(results.map((r) => r.party.join(",")))].map((p) => {
      const rows = results.filter(
        (r) => r.party.join(",") === p && r.policy === "mixed",
      );
      return {
        party: p,
        runs: rows.length,
        mainWins: rows.filter((r) => r.victories >= 9).length,
        averageVictories:
          rows.reduce((n, r) => n + r.victories, 0) / rows.length,
      };
    }),
    policy: results
      .filter((r) => r.policy === "attack")
      .map((r) => r.victories),
  };
  console.log(JSON.stringify({ ...summary, byParty: undefined }, null, 2));
}
