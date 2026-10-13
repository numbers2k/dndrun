import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  claimVictory,
  chooseReward,
  rewardChoices,
  advanceRun,
  enterEndless,
  rest,
} from "../public/campaign.js";
import {
  createBattle,
  planAction,
  undoAction,
  endTurn,
  previewTurn,
  turnMultiplier,
  remainingElixir,
  effectiveCard,
} from "../public/combat.js";
import { defaultParty, heroes, buildDeck } from "../public/party.js";
import { chapterEncounters } from "../public/content.js";

function fixture() {
  const r = createRun(defaultParty, 0, 123);
  return createBattle({
    heroes: r.heroes,
    cards: r.cards,
    encounter: r.encounters[0],
    seed: 99,
  });
}
function giveCards(b, definitions) {
  b.deck = {
    hand: definitions.map((c, id) => ({
      id,
      hero: "warden",
      energy: 1,
      multiplier: 1,
      ...c,
    })),
    draw: [],
    spent: [],
    total: definitions.length,
  };
  return b;
}

test("battle starts with 9 unique copies, 4 elixir and deterministic visible intentions", () => {
  const a = fixture(),
    b = fixture();
  assert.deepEqual(a, b);
  assert.equal(a.deck.hand.length, 9);
  assert.equal(a.deck.draw.length, 18);
  assert.equal(remainingElixir(a), 4);
  assert.ok(a.enemies.every((e) => e.intent.target));
  assert.equal(
    new Set([...a.deck.hand, ...a.deck.draw].map((c) => c.id)).size,
    27,
  );
});
test("planning validates targets, budget, ownership and duplicate copies without mutating input", () => {
  const b = giveCards(fixture(), [
      { effect: "Урон", amount: 4, energy: 2 },
      { effect: "Лечение", amount: 6, energy: 2 },
      { effect: "Урон", amount: 3 },
    ]),
    before = JSON.stringify(b);
  assert.equal(planAction(b, "card", 0, "warden"), null);
  assert.equal(planAction(b, "card", 1, "enemy-0"), null);
  const one = planAction(b, "card", 0, "enemy-0");
  assert.equal(one.deck.hand.length, 3);
  assert.equal(one.deck.spent.length, 0);
  assert.equal(one.deck.draw.length, 0);
  assert.equal(planAction(one, "card", 0, "enemy-0"), null);
  const two = planAction(one, "card", 1, "warden");
  assert.equal(remainingElixir(two), 0);
  assert.equal(planAction(two, "card", 2, "enemy-0"), null);
  assert.equal(remainingElixir(undoAction(two, 1)), 2);
  assert.equal(JSON.stringify(b), before);
});
test("additive multiplier applies once, preview agrees, killed enemies do not reply", () => {
  let b = giveCards(fixture(), [
    { effect: "Урон", amount: 10, multiplier: 2 },
    { effect: "Урон", amount: 10, multiplier: 2 },
  ]);
  b.enemies.forEach((e) => {
    e.hp = e.maxHp = 30;
  });
  b = planAction(b, "card", 0, "enemy-0");
  b = planAction(b, "card", 1, "enemy-1");
  assert.equal(turnMultiplier(b), 3);
  const preview = previewTurn(b),
    resolved = endTurn(b);
  assert.deepEqual(
    preview.enemies.map((e) => e.hp),
    resolved.enemies.map((e) => e.hp),
  );
  assert.equal(resolved.status, "victory");
  assert.deepEqual(
    resolved.heroes.map((h) => h.hp),
    b.heroes.map((h) => h.hp),
  );
  assert.equal(resolved.deck.spent.length, 2);
  assert.deepEqual(endTurn(resolved), resolved);
});
test("end of turn preserves unplayed cards, refills only then, resets elixir and multiplier", () => {
  let b = fixture();
  const c = b.deck.hand.find((c) => c.effect === "Урон");
  const ids = b.deck.hand.filter((x) => x.id !== c.id).map((c) => c.id);
  b = planAction(b, "card", c.id, "enemy-0");
  const next = endTurn(b);
  assert.equal(next.turn, 2);
  assert.equal(next.deck.hand.length, 9);
  assert.equal(next.deck.draw.length, 17);
  assert.equal(next.deck.spent.length, 1);
  assert.ok(ids.every((id) => next.deck.hand.some((c) => c.id === id)));
  assert.equal(turnMultiplier(next), 1);
  assert.equal(remainingElixir(next), 4);
});
test("poison kills before reply and ignores shield; healing is capped", () => {
  let b = giveCards(fixture(), [
    { effect: "Яд", amount: 4 },
    { effect: "Лечение", amount: 100 },
  ]);
  b.enemies = [{ ...b.enemies[0], hp: 4, guard: 100 }];
  b.heroes[0].hp = 2;
  b = planAction(b, "card", 0, "enemy-0");
  b = planAction(b, "card", 1, "warden");
  const next = endTurn(b);
  assert.equal(next.status, "victory");
  assert.equal(next.heroes[0].hp, next.heroes[0].maxHp);
  assert.equal(next.enemies[0].guard, 100);
});
test("shield absorbs retaliation and expires next turn; slowing and dodge reduce attacks", () => {
  let b = giveCards(fixture(), [
    { effect: "Защита", amount: 10 },
    { effect: "Уклонение" },
  ]);
  b.enemies = [b.enemies[0]];
  b.enemies[0].intent = { type: "attack", amount: 12, target: "warden" };
  const hp = b.heroes[0].hp;
  b = planAction(b, "card", 0, "warden");
  b = planAction(b, "card", 1, "warden");
  b.deck.draw = [
    {
      id: 3,
      hero: "warden",
      effect: "Урон",
      amount: 2,
      energy: 1,
      multiplier: 1,
    },
  ];
  const next = endTurn(b);
  assert.equal(next.heroes[0].hp, hp);
  assert.equal(next.heroes[0].guard, 0);
  assert.equal(next.heroes[0].dodge, 0);
});
test("one supply per turn, no elixir or multiplier, cancellation never consumes it", () => {
  let b = giveCards(fixture(), [
    { effect: "Защита", amount: 1, multiplier: 2 },
  ]);
  b.supplies = [
    { uid: "a", id: "bomb" },
    { uid: "b", id: "tonic" },
  ];
  b.enemies = [{ ...b.enemies[0], hp: 100, maxHp: 100 }];
  b = planAction(b, "card", 0, "warden");
  b = planAction(b, "supply", "a", "enemy-0");
  assert.equal(remainingElixir(b), 3);
  assert.equal(planAction(b, "supply", "b", "warden"), null);
  assert.equal(undoAction(b, 1).supplies.length, 2);
  const next = endTurn(b);
  assert.equal(next.enemies[0].hp, 86);
  assert.deepEqual(next.supplies, [{ uid: "b", id: "tonic" }]);
});
test("dead targets do not silently redirect extra damage; fallen heroes cannot act", () => {
  let b = giveCards(fixture(), [
    { effect: "Урон", amount: 30 },
    { effect: "Урон", amount: 30 },
  ]);
  b = planAction(b, "card", 0, "enemy-0");
  b = planAction(b, "card", 1, "enemy-0");
  assert.equal(previewTurn(b).enemies[1].hp, b.enemies[1].hp);
  const dead = fixture();
  dead.heroes[0].hp = 0;
  const card = dead.deck.hand.find((c) => c.hero === "warden");
  assert.equal(planAction(dead, "card", card.id, "enemy-0"), null);
});
test("relic bonuses are conditional; elixir bonus is bounded to one copy", () => {
  let b = giveCards(fixture(), [
    { effect: "Урон", amount: 5 },
    { effect: "Защита", amount: 3, hero: "mage" },
  ]);
  b.relics = ["moon", "oath", "rune", "ward"];
  b = planAction(b, "card", 0, "enemy-0");
  b = planAction(b, "card", 1, "warden");
  assert.equal(turnMultiplier(b), 2);
  const preview = previewTurn(b);
  assert.equal(preview.enemies[0].hp, b.enemies[0].hp - 14);
  assert.equal(preview.heroes[0].guard, 10);
  const r = createRun(defaultParty);
  const flask = createBattle({
    heroes: r.heroes,
    cards: r.cards,
    encounter: r.encounters[0],
    relics: ["flask"],
  });
  assert.equal(flask.maxElixir, 5);
});
test("wipe and full resource exhaustion end the fight; dead-owner cards leave finite piles", () => {
  let b = giveCards(fixture(), []);
  b.enemies[0].intent = { type: "all", amount: 100, target: "all" };
  assert.equal(endTurn(b).status, "defeat");
  b = giveCards(fixture(), []);
  const depleted = endTurn(b);
  assert.equal(depleted.status, "defeat");
  assert.match(depleted.reason, /Заклинания/);
  b = fixture();
  b.heroes[0].hp = 0;
  const next = endTurn(b);
  assert.ok(
    [...next.deck.hand, ...next.deck.draw].every((c) => c.hero !== "warden"),
  );
});
test("rewards and score cannot be claimed twice, rest costs gold and upgrade changes all copies", () => {
  const r = createRun(defaultParty, 0, 12),
    b = fixture();
  b.status = "victory";
  b.heroes[0].hp = 10;
  assert.ok(claimVictory(r, b));
  const score = r.score,
    coins = r.coins;
  assert.equal(claimVictory(r, b), false);
  assert.equal(r.score, score);
  assert.equal(r.coins, coins);
  const upgrade = rewardChoices(r).find((c) => c.kind === "upgrade"),
    before = r.cards.filter(
      (c) => c.hero === upgrade.hero && c.name === upgrade.spell,
    );
  assert.ok(chooseReward(r, upgrade));
  assert.equal(chooseReward(r, upgrade), false);
  const after = r.cards.filter(
    (c) => c.hero === upgrade.hero && c.name === upgrade.spell,
  );
  assert.ok(
    after.every((c, i) => c.multiplier === before[i].multiplier + 0.25),
  );
  const gold = r.coins;
  assert.ok(rest(r));
  assert.equal(r.coins, gold - 3);
});
test("three chapters lead to finish-or-endless choice; endless progression is reproducible and grows", () => {
  const r = createRun(defaultParty, 0, 87);
  r.chapter = 3;
  r.stage = 2;
  assert.equal(advanceRun(r), "final");
  enterEndless(r);
  assert.equal(r.chapter, 4);
  assert.ok(r.endless);
  assert.deepEqual(chapterEncounters(10, 87), chapterEncounters(10, 87));
  assert.ok(
    chapterEncounters(10, 87)[2].enemies[0].hp >
      chapterEncounters(4, 87)[2].enemies[0].hp,
  );
  assert.ok(
    chapterEncounters(10, 87)[2].enemies[0].attack >
      chapterEncounters(4, 87)[2].enemies[0].attack,
  );
});
test("all twenty hero combinations have legal cards and preserved copy identity over turns", () => {
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 5; j++)
      for (let k = j + 1; k < 6; k++) {
        const party = [heroes[i].id, heroes[j].id, heroes[k].id],
          r = createRun(party),
          b = createBattle({
            heroes: r.heroes,
            cards: buildDeck(party),
            encounter: r.encounters[0],
          });
        assert.equal(b.deck.hand.length, 9);
        assert.equal(b.deck.total, 27);
        for (const c of b.deck.hand) {
          const targets = ["Урон", "Яд", "Уязвимость", "Замедление"].includes(
            c.effect,
          )
            ? b.enemies
            : b.heroes;
          assert.ok(planAction(b, "card", c.id, targets[0].id));
        }
      }
});
test("finite copies never reshuffle, including empty turns and deck exhaustion", () => {
  const r = createRun(defaultParty),
    encounter = {
      ...r.encounters[0],
      enemies: [
        {
          ...r.encounters[0].enemies[0],
          hp: 100000,
          maxHp: 100000,
          attack: 0,
          role: "guard",
        },
      ],
    };
  let b = createBattle({
    heroes: r.heroes,
    cards: r.cards,
    encounter,
    seed: 12,
  });
  b.heroes.forEach((h) => (h.hp = h.maxHp = 100000));
  for (let turn = 0; turn < 20 && b.status === "active"; turn++) {
    const spent = new Set(b.deck.spent.map((c) => c.id));
    for (const c of b.deck.hand) {
      const target = ["Урон", "Яд", "Уязвимость", "Замедление"].includes(
        c.effect,
      )
        ? "enemy-0"
        : c.hero;
      const next = planAction(b, "card", c.id, target);
      if (next) b = next;
    }
    b = endTurn(b);
    assert.equal(
      new Set(
        [...b.deck.hand, ...b.deck.draw, ...b.deck.spent].map((c) => c.id),
      ).size,
      27,
    );
    assert.ok(b.deck.hand.every((c) => !spent.has(c.id)));
  }
  assert.equal(b.status, "defeat");
  assert.equal(b.deck.spent.length, 27);
});
test("cleansing and strength supplies have real effects, armour and area cards scale once", () => {
  let b = giveCards(fixture(), [{ effect: "Урон", amount: 5 }]);
  b.heroes[0].poison = 9;
  b.heroes[0].vulnerable = 2;
  b.heroes[0].hp -= 8;
  b.supplies = [{ uid: "clean", id: "antidote" }];
  b = planAction(b, "supply", "clean", "warden");
  const clean = previewTurn(b);
  assert.equal(clean.heroes[0].poison, 0);
  assert.equal(clean.heroes[0].vulnerable, 0);
  assert.equal(clean.heroes[0].hp, b.heroes[0].hp + 6);
  b.supplies = [{ uid: "oil", id: "oil" }];
  b.plan = [];
  b = planAction(b, "supply", "oil", "warden");
  b = planAction(b, "card", 0, "enemy-0");
  assert.equal(previewTurn(b).enemies[0].hp, b.enemies[0].hp - 8);
  const area = giveCards(fixture(), [
    { effect: "Защита", amount: 5, all: true, multiplier: 2 },
  ]);
  assert.ok(
    previewTurn(planAction(area, "card", 0, "warden")).heroes.every(
      (h) => h.guard === 10,
    ),
  );
});
test("full inventories require explicit replacement, and upgrades remain current in battle piles", () => {
  const r = createRun(defaultParty);
  const b = fixture();
  b.status = "victory";
  claimVictory(r, b);
  r.relics = ["rune", "ward", "herb", "moon", "oath"];
  assert.equal(chooseReward(r, { kind: "relic", id: "venom" }), false);
  assert.equal(r.relics.length, 5);
  assert.ok(chooseReward(r, { kind: "relic", id: "venom" }, "ward"));
  assert.equal(r.relics.length, 5);
  assert.ok(!r.relics.includes("ward"));
  r.rewardChosen = false;
  r.supplies = [
    { uid: "one", id: "bomb" },
    { uid: "two", id: "tonic" },
  ];
  assert.equal(chooseReward(r, { kind: "supply", id: "oil" }), false);
  assert.ok(chooseReward(r, { kind: "supply", id: "oil" }, "one"));
  assert.equal(r.supplies.length, 2);
  r.rewardChosen = false;
  const c = r.cards.find((c) => c.effect === "Урон");
  chooseReward(r, { kind: "upgrade", hero: c.hero, spell: c.name });
  const updated = [
    ...r.battle.deck.hand,
    ...r.battle.deck.draw,
    ...r.battle.deck.spent,
  ].filter((x) => x.hero === c.hero && x.name === c.name);
  assert.ok(updated.every((x) => x.amount === c.amount + 2));
});
test("exhausted cards do not forfeit a victory still achievable through ticking poison", () => {
  let b = giveCards(fixture(), [{ effect: "Яд", amount: 4 }]);
  b.supplies = [];
  b.enemies = [{ ...b.enemies[0], hp: 6, maxHp: 6 }];
  b = endTurn(planAction(b, "card", 0, "enemy-0"));
  assert.equal(b.status, "active");
  assert.equal(b.deck.hand.length, 0);
  assert.equal(b.enemies[0].hp, 2);
  b = endTurn(b);
  assert.equal(b.status, "victory");
});
test("shown relic effects match base computation without modifying stored cards", () => {
  const c = { effect: "Урон", amount: 7, poison: 2, multiplier: 1 };
  const shown = effectiveCard(c, ["rune", "venom"], { strength: 3 });
  assert.equal(shown.amount, 12);
  assert.equal(shown.detail, "яд 4");
  assert.equal(c.amount, 7);
  let b = giveCards(fixture(), [c]);
  b.relics = ["rune", "venom"];
  b.heroes[0].strength = 3;
  b = planAction(b, "card", 0, "enemy-0");
  const result = previewTurn(b);
  assert.equal(result.enemies[0].hp, b.enemies[0].hp - 12 - 4);
});
