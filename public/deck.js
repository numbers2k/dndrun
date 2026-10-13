export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Keep the run's physical copies and their latest values, including spent cards.
export function currentDeckCards(cards, encounter) {
  if (!encounter) return cards;
  const current = new Map(
    [...encounter.draw, ...encounter.spent, ...encounter.hand].map((card) => [
      card.id,
      card,
    ]),
  );
  return cards.map((card) => current.get(card.id) || card);
}
