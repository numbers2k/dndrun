import test from "node:test";
import assert from "node:assert/strict";
import { buildDeck, defaultParty } from "../public/party.js";
import { shuffle, currentDeckCards } from "../public/deck.js";
import { createRun } from "../public/campaign.js";
import { createBattle, endTurn, planAction } from "../public/combat.js";

test("shuffle preserves every physical copy and leaves the source untouched", () => {
  const cards = buildDeck(defaultParty),
    ids = cards.map((c) => c.id),
    result = shuffle(cards, () => 0);
  assert.deepEqual(
    cards.map((c) => c.id),
    ids,
  );
  assert.deepEqual(
    result.map((c) => c.id).sort((a, b) => a - b),
    ids,
  );
  assert.notDeepEqual(result, cards);
});
test("run book uses latest values from hand, draw and spent without rebuilding copies", () => {
  const r = createRun(defaultParty),
    b = createBattle({
      heroes: r.heroes,
      cards: r.cards,
      encounter: r.encounters[0],
      seed: 1,
    });
  const card = b.deck.hand.find((c) => c.effect === "Урон");
  card.amount = 35;
  card.multiplier = 3;
  b.deck.draw[0].amount = 22;
  const next = endTurn(planAction(b, "card", card.id, "enemy-0")),
    current = currentDeckCards(r.cards, next.deck);
  assert.equal(current.length, 27);
  assert.equal(new Set(current.map((c) => c.id)).size, 27);
  assert.equal(current.find((c) => c.id === card.id).amount, 35);
  assert.equal(current.find((c) => c.id === card.id).multiplier, 3);
  assert.equal(current.find((c) => c.id === b.deck.draw[0].id).amount, 22);
  assert.equal(r.cards.find((c) => c.id === card.id).multiplier, 1);
  assert.equal(currentDeckCards(r.cards, null), r.cards);
});
