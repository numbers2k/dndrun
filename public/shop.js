import { relics, supplies, relicById, supplyById } from "./items.js";
import { seededRandom } from "./content.js";
import { canUpgrade } from "./upgrades.js";

const roundMoney = (n) => Math.round(n * 100) / 100;
export function priceFor(run, kind, id) {
  const item = kind === "relic" ? relicById(id) : supplyById(id);
  if (!item) return null;
  const discount = run.relics.reduce(
    (n, id) =>
      n +
      (relicById(id)?.effects || [])
        .filter(
          (e) =>
            e.stat === "discount" &&
            (e.when !== "suppliesOnly" || kind === "supply"),
        )
        .reduce((n, e) => n + e.value, 0),
    0,
  );
  return Math.max(2, item.price - Math.min(2, discount));
}
function pick(random, pool) {
  const weight = (item) => (item.rarity === 3 ? 1 : item.rarity === 2 ? 3 : 6);
  let cursor = random() * pool.reduce((n, item) => n + weight(item), 0);
  return pool.find((item) => (cursor -= weight(item)) < 0) || pool.at(-1);
}
export function openShop(run) {
  if (run.shop) return run.shop;
  const random = seededRandom(
    run.seed + run.completed * 15331 + run.chapter * 257 + run.stage * 47,
  );
  const pool = relics.filter(
    (r) =>
      !run.relics.includes(r.id) &&
      r.effects.every(
        (e) =>
          !["warden", "ranger", "mage", "rogue"].includes(e.when) ||
          run.party.includes(e.when),
      ),
  );
  const offers = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const item = pick(random, pool);
    offers.push({ kind: "relic", id: item.id, sold: false });
    pool.splice(pool.indexOf(item), 1);
  }
  const useful = supplies.filter(
    (s) => !s.upgrade || run.cards.some((c) => canUpgrade(c, s, run.cards)),
  );
  offers.push({
    kind: "supply",
    id: useful[Math.floor(random() * useful.length)].id,
    sold: false,
  });
  run.shop = { offers, chapter: run.chapter, stage: run.stage };
  return run.shop;
}
export function buyOffer(run, index) {
  if (!run.shop || !Number.isInteger(index))
    return { ok: false, reason: "Лавка закрыта." };
  const offer = run.shop.offers[index];
  if (!offer || offer.sold) return { ok: false, reason: "Уже куплено." };
  const price = priceFor(run, offer.kind, offer.id);
  if (price === null || run.coins < price)
    return { ok: false, reason: "Недостаточно монет." };
  if (offer.kind === "relic") {
    if (run.relics.length >= 5)
      return {
        ok: false,
        reason: "Продайте одну реликвию, чтобы освободить место.",
      };
    if (run.relics.includes(offer.id))
      return { ok: false, reason: "Эта реликвия уже есть." };
    run.relics.push(offer.id);
    run.relicState[offer.id] = { paid: price, baseline: { ...run.stats } };
  } else {
    if (run.supplies.length >= 2)
      return { ok: false, reason: "Продайте припас, чтобы освободить место." };
    run.supplies.push({
      uid: "supply-" + ++run.supplySerial,
      id: offer.id,
      paid: price,
    });
  }
  run.coins = roundMoney(run.coins - price);
  offer.sold = true;
  return { ok: true };
}
export function sellValue(run, kind, id) {
  if (kind === "relic")
    return roundMoney((run.relicState?.[id]?.paid || 0) / 2);
  return roundMoney((run.supplies.find((s) => s.uid === id)?.paid || 0) / 2);
}
export function sellItem(run, kind, id) {
  if (!run.shop) return false;
  if (kind === "relic") {
    if (!run.relics.includes(id)) return false;
    run.coins = roundMoney(run.coins + sellValue(run, kind, id));
    run.relics = run.relics.filter((r) => r !== id);
    delete run.relicState[id];
  } else if (kind === "supply") {
    if (!run.supplies.some((s) => s.uid === id)) return false;
    run.coins = roundMoney(run.coins + sellValue(run, kind, id));
    run.supplies = run.supplies.filter((s) => s.uid !== id);
  } else return false;
  run.stats.sales++;
  return true;
}
