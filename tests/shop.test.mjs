import test from "node:test";
import assert from "node:assert/strict";
import { createRun, advanceRun } from "../public/campaign.js";
import {
  createBattle,
  planAction,
  previewTurn,
  undoAction,
  remainingElixir,
} from "../public/combat.js";
import { defaultParty } from "../public/party.js";
import { relics, supplies } from "../public/items.js";
import {
  openShop,
  buyOffer,
  sellItem,
  sellValue,
  priceFor,
} from "../public/shop.js";
import { canUpgrade, upgradeCard } from "../public/upgrades.js";
import { saveSession, loadSession } from "../public/storage.js";

const fixture = () => {
  const r = createRun(defaultParty, 0, 43);
  return createBattle({
    heroes: r.heroes,
    cards: r.cards,
    encounter: r.encounters[0],
    context: r,
  });
};
test("75 joker and 22 tarot adaptations have unique IDs and executable effects", () => {
  assert.equal(relics.filter((r) => r.sourceRef).length, 75);
  assert.equal(supplies.filter((s) => s.sourceRef).length, 22);
  assert.equal(new Set(relics.map((r) => r.id)).size, relics.length);
  assert.equal(new Set(supplies.map((s) => s.id)).size, supplies.length);
  assert.ok(relics.every((r) => r.effects.length && r.price >= 2));
});
test("three high-multiplier cards cannot multiply a neighbouring shield", () => {
  let b = fixture();
  b.relics = ["r_joker", "moon", "oath"];
  b.deck.hand = [
    {
      id: 1,
      hero: "warden",
      name: "Щит",
      effect: "Защита",
      amount: 11,
      multiplier: 1,
      energy: 1,
    },
    {
      id: 2,
      hero: "mage",
      name: "Атака",
      effect: "Урон",
      amount: 1,
      multiplier: 3,
      energy: 1,
    },
    {
      id: 3,
      hero: "ranger",
      name: "Метка",
      effect: "Уязвимость",
      multiplier: 2,
      energy: 1,
    },
  ];
  b = planAction(b, "card", 1, "warden");
  b = planAction(b, "card", 2, "enemy-0");
  b = planAction(b, "card", 3, "enemy-0");
  assert.equal(previewTurn(b).heroes[0].guard, 11);
});
test("shop inventory is seeded, persistent and remains unchanged by purchases or reload", () => {
  const a = createRun(defaultParty, 0, 47),
    b = createRun(defaultParty, 0, 47);
  assert.deepEqual(openShop(a), openShop(b));
  a.coins = 100;
  a.rewardClaimed = true;
  const offers = structuredClone(a.shop.offers);
  const price = priceFor(a, "relic", offers[0].id);
  assert.ok(buyOffer(a, 0).ok);
  assert.equal(sellValue(a, "relic", offers[0].id), price / 2);
  assert.equal(buyOffer(a, 0).ok, false);
  assert.ok(sellItem(a, "relic", offers[0].id));
  assert.equal(buyOffer(a, 0).ok, false);
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
  saveSession({ run: a, screen: "shop", modal: null });
  assert.deepEqual(loadSession().run.shop, a.shop);
  const next = advanceRun(a);
  assert.equal(next, "route");
  assert.equal(a.shop, null);
});
test("a purchased upgrade changes only its selected physical copy and respects caps", () => {
  const r = createRun(defaultParty),
    card = r.cards.find((c) => c.effect === "Защита"),
    item = supplies.find((s) => s.id === "chariot");
  let next = card;
  while (canUpgrade(next, item, r.cards))
    next = upgradeCard(next, item, r.cards);
  assert.equal(next.multiplier, 2);
  assert.equal(card.multiplier, 1);
  assert.equal(
    r.cards.filter((c) => c.name === card.name && c.hero === card.hero).length,
    3,
  );
  const power = supplies.find((s) => s.id === "magician");
  let strong = card;
  while (canUpgrade(strong, power, r.cards))
    strong = upgradeCard(strong, power, r.cards);
  assert.equal(strong.amount, card.amount + 8);
});
test("an elixir supply permits one extra energy, and undo cannot leave overspent actions", () => {
  let b = fixture();
  b.supplies = [{ uid: "extra", id: "hermit" }];
  b.deck.hand = Array.from({ length: 5 }, (_, id) => ({
    id,
    hero: "warden",
    name: "Атака",
    effect: "Урон",
    amount: 1,
    multiplier: 1,
    energy: 1,
  }));
  b = planAction(b, "supply", "extra", "warden");
  for (let id = 0; id < 5; id++) b = planAction(b, "card", id, "enemy-0");
  assert.equal(remainingElixir(b), 0);
  const undone = undoAction(b, 0);
  assert.equal(undone.plan.length, 4);
  assert.equal(remainingElixir(undone), 0);
});
