import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../public/campaign.js";
import { createBattle, planAction } from "../public/combat.js";
import { defaultParty } from "../public/party.js";
import {
  saveSession,
  loadSession,
  readScores,
  recordScore,
} from "../public/storage.js";
const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
};
test("run and pending choices survive serialization; malformed snapshots are ignored", () => {
  const run = createRun(defaultParty, 0, 43);
  saveSession({ run, screen: "route", modal: "final" });
  assert.deepEqual(loadSession().run, run);
  assert.equal(loadSession().modal, "final");
  saveSession({ run, screen: "battle", modal: null });
  assert.equal(loadSession(), null);
  data.set("dndrun-new-combat-v1", "{invalid");
  assert.equal(loadSession(), null);
});
test("invalid hero IDs, deck entries and targets cannot crash a resumed game", () => {
  const run = createRun(defaultParty, 0, 43);
  run.battle = createBattle({
    heroes: run.heroes,
    cards: run.cards,
    encounter: run.encounters[0],
  });
  const card = run.battle.deck.hand.find((c) => c.effect === "Урон");
  run.battle = planAction(
    run.battle,
    "card",
    card.id,
    run.battle.enemies[0].id,
  );
  saveSession({ run, screen: "battle", modal: null });
  assert.deepEqual(loadSession().run.battle.plan, run.battle.plan);
  for (const damage of [
    (r) => (r.party[0] = "missing"),
    (r) => (r.cards[0] = null),
    (r) => (r.relics = ["missing"]),
    (r) => (r.supplies = [{ uid: "bad", id: "missing" }]),
    (r) => (r.battle.deck.draw = null),
    (r) => (r.battle.plan[0].target = "missing"),
    (r) => r.battle.plan.push({ ...r.battle.plan[0] }),
    (r) => (r.battle.enemies[0].hp = "broken"),
    (r) => (r.encounters[0].skip.labels = null),
  ]) {
    const broken = structuredClone(run);
    damage(broken);
    saveSession({ run: broken, screen: "battle", modal: null });
    assert.equal(loadSession(), null);
  }
  data.set(
    "dndrun-new-scores-v1",
    JSON.stringify([
      null,
      { score: 42, party: defaultParty, chapter: "broken" },
    ]),
  );
  assert.deepEqual(readScores(), []);
});

test("local scores are sorted, recorded once and remain usable with denied storage", () => {
  for (let score = 0; score < 25; score++) {
    const r = createRun(defaultParty);
    r.score = score;
    recordScore(r, "complete");
    recordScore(r, "complete");
  }
  assert.equal(readScores().length, 20);
  assert.equal(readScores()[0].score, 24);
  globalThis.localStorage = {
    getItem: () => {
      throw Error("disabled");
    },
    setItem: () => {
      throw Error("disabled");
    },
  };
  assert.equal(loadSession(), null);
  assert.deepEqual(readScores(), []);
  assert.doesNotThrow(() => saveSession({ run: createRun(defaultParty) }));
});
