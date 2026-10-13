import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultParty,
  heroes,
  heroById,
  replaceHero,
  buildDeck,
} from "../public/party.js";

test("replacement preserves three distinct heroes without mutating the original", () => {
  const original = [...defaultParty];
  const changed = replaceHero(original, 1, "rogue");
  assert.deepEqual(changed, ["warden", "rogue", "mage"]);
  assert.deepEqual(original, defaultParty);
  assert.equal(new Set(changed).size, 3);
  assert.equal(replaceHero(changed, 1, "ranger")[1], "ranger");
});

test("duplicates, unknown heroes and invalid slots leave the party unchanged", () => {
  for (const [slot, id] of [
    [0, "mage"],
    [0, "unknown"],
    [-1, "rogue"],
    [3, "rogue"],
    [1.5, "rogue"],
  ]) {
    assert.equal(replaceHero(defaultParty, slot, id), defaultParty);
  }
});

test("every possible party has twenty-seven cards and the exact 4/3/2 charge allocation", () => {
  let combinations = 0;
  for (let a = 0; a < heroes.length; a++)
    for (let b = a + 1; b < heroes.length; b++)
      for (let c = b + 1; c < heroes.length; c++) {
        const party = [heroes[a].id, heroes[b].id, heroes[c].id];
        const deck = buildDeck(party);
        assert.equal(deck.length, 27);
        assert.equal(new Set(deck.map((card) => card.id)).size, 27);
        assert.deepEqual(
          new Set(deck.slice(0, 8).map((card) => card.hero)),
          new Set(party),
        );
        for (const id of party) {
          const heroCards = deck.filter((card) => card.hero === id);
          assert.equal(heroCards.length, 9);
          heroById(id).spells.forEach((spell, index) =>
            assert.equal(
              heroCards.filter((card) => card.name === spell.name).length,
              [4, 3, 2][index],
            ),
          );
          assert.deepEqual(
            new Set(heroCards.map((card) => card.name)),
            new Set(heroById(id).spells.map((spell) => spell.name)),
          );
        }
        combinations++;
      }
  assert.equal(combinations, 20);
});
