import { landscape, portrait, symbol, deckArt } from "./art.js";
import {
  heroes,
  defaultParty,
  heroById,
  replaceHero,
  buildDeck,
  spellDescription,
} from "./party.js";
import { currentDeckCards } from "./deck.js";
import {
  BASE_ELIXIR,
  createBattle,
  planAction,
  undoAction,
  remainingElixir,
  turnMultiplier,
  previewTurn,
  endTurn,
  validTarget,
  effectiveCard,
} from "./combat.js";
import { relics, relicById, supplyById, chapterEncounters } from "./content.js";
import {
  createRun,
  claimVictory,
  rewardChoices,
  chooseReward,
  advanceRun,
  enterEndless,
  addSupply,
  rest,
} from "./campaign.js";
import {
  saveSession,
  loadSession,
  readScores,
  recordScore,
} from "./storage.js";

const root = document.querySelector("#app");
const desktopViewport = matchMedia(
  "(min-width: 1024px) and (min-height: 640px)",
);
const startingElixir = BASE_ELIXIR;
const state = {
  screen: "menu",
  modal: null,
  tab: "new",
  difficulty: 0,
  stage: 0,
  score: 0,
  elixir: startingElixir,
  maxElixir: startingElixir,
  coins: 4,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
};
state.party = [...defaultParty];
state.runParty = null;
state.runHeroes = [];
state.runSkips = [];
state.hasRun = false;
state.resumeScreen = "route";
state.pickedHero = null;
state.partyNotice = "";
const difficulties = [
  {
    name: "Тихая дорога",
    description: "Обычный поход · время освоиться",
    icon: "camp",
  },
  {
    name: "За последним костром",
    description: "Опасный поход · меньше права на ошибку",
    icon: "flame",
  },
  {
    name: "Без оглядки",
    description: "Самый опасный поход · враги сильнее",
    icon: "skull",
  },
];
let encounters = chapterEncounters(1);
state.run = null;
state.activeItem = null;
state.notice = "";
state.resumeModal = null;
state.replaceReward = null;
let cards = buildDeck(defaultParty);
let hand = cards.slice(0, 9);
let encounterDeck = null;
const button = (label, action, color = "gold", extra = "") =>
  `<button class="bevel ${color}" data-action="${action}" ${extra}>${label}</button>`;

function menu() {
  return `<main class="main-menu" aria-label="Главное меню">
    <div class="title-scene"><div class="floating-card left-card">${deckArt("#6c8271")}</div><div class="floating-card right-card">${deckArt("#a06445")}</div>
      <div class="wordmark" aria-label="dndrun"><span>DND</span><div class="title-die">${symbol("die")}</div><span>RUN</span></div>
    </div>
    <div class="menu-footer">
      <nav class="menu-actions" aria-label="Навигация">${button("ЛИДЕРБОРД", "leaderboard", "dark")}${button("ИГРАТЬ", "setup", "blue")}${button("КОЛЛЕКЦИЯ", "collection", "green")}</nav>
    </div>
  </main>`;
}

function sidebar() {
  return `<aside class="sidebar run-sidebar" aria-label="Поход">
    <div class="run-score"><span>Счёт</span><strong>${state.score.toLocaleString("ru")}</strong></div>
    <div class="run-resources">
      <div class="run-coins" aria-label="Золотые монеты: ${state.coins}">${symbol("coin")}<strong>${state.coins}</strong></div>
      <div class="run-elixir" aria-label="Эликсир: ${state.elixir} из ${state.maxElixir}"><div>${symbol("elixir")}<span>Эликсир</span><strong>${state.elixir}<small> / ${state.maxElixir}</small></strong></div><div class="elixir-meter" aria-hidden="true"><i style="width:${(state.elixir / state.maxElixir) * 100}%"></i></div></div>
      <div class="run-progress"><div><span>Глава</span><strong>${state.run?.chapter || 1}</strong></div><div><span>Встреча</span><strong>${state.stage + 1}</strong></div></div>
      ${deckStack()}
    </div>
    ${button("Выйти", "exit-run", "dark")}
  </aside>`;
}
function syncRun() {
  if (!state.run) return;
  const r = state.run;
  encounters = r.encounters;
  cards = r.cards;
  state.runParty = r.party;
  state.runDifficulty = r.difficulty;
  state.stage = r.stage;
  state.score = r.score;
  state.coins = r.coins;
  state.runHeroes = r.heroes;
  encounterDeck = r.battle?.deck || null;
  hand = encounterDeck?.hand || cards.slice(0, 9);
  state.maxElixir = BASE_ELIXIR + (r.relics.includes("flask") ? 1 : 0);
  state.elixir =
    r.battle?.status === "active" ? remainingElixir(r.battle) : state.maxElixir;
  state.runSkips = encounters.map(
    (e, i) =>
      e.skip?.labels[(r.seed + r.chapter + i) % e.skip.labels.length] || "",
  );
}
const stored = loadSession();
if (stored && !stored.run.finished) {
  state.run = stored.run;
  state.hasRun = true;
  state.resumeScreen = stored.screen;
  state.resumeModal = stored.modal;
  syncRun();
}
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function persist() {
  if (state.run) {
    const modal = state.screen === "menu" ? state.resumeModal : state.modal;
    saveSession({
      run: state.run,
      screen: state.screen === "menu" ? state.resumeScreen : state.screen,
      modal: ["victory", "final"].includes(modal)
        ? modal
        : modal === "replace-reward"
          ? "victory"
          : null,
    });
  }
}

function deckStack() {
  return `<button class="deck-stack" data-action="run-book" aria-label="Открыть книгу отряда и колоды">${deckArt()}<strong>${state.screen === "battle" ? encounterDeck.draw.length : cards.length}/${cards.length}</strong><small>КОЛОДА</small></button>`;
}
function gearCard(item, kind) {
  const data = kind === "relic" ? relicById(item) : supplyById(item.id);
  return `<button class="gear-card empty-slot ${state.activeItem?.kind === kind && state.activeItem.id === item.uid ? "selected" : ""}" data-action="${kind === "relic" ? "inspect-relic" : "supply"}" data-id="${kind === "relic" ? item : item.uid}" aria-label="${esc(data.name)}, ${esc(data.description)}" title="${esc(data.description)}">${symbol(data.icon)}<small>${data.name}</small></button>`;
}
function topSlots() {
  const r = state.run;
  return `<div class="top-slots"><div class="relic-zone"><span>РЕЛИКВИИ <b>${r?.relics.length || 0}/5</b></span><div class="empty-slot-row">${Array.from({ length: 5 }, (_, i) => (r?.relics[i] ? gearCard(r.relics[i], "relic") : '<div class="empty-slot">◇</div>')).join("")}</div></div><div class="supply-zone"><span>ПРИПАСЫ <b>${r?.supplies.length || 0}/2</b></span><div class="empty-slot-row">${Array.from({ length: 2 }, (_, i) => (r?.supplies[i] ? gearCard(r.supplies[i], "supply") : '<div class="empty-slot">◇</div>')).join("")}</div></div></div>`;
}
function partyCondition() {
  return `<section class="party-condition" aria-label="Состояние отряда">${state.runHeroes.map((h) => `<div class="condition-member">${heroCard(h.id)}<div class="hero-vitals" aria-label="${heroById(h.id).name}: здоровье ${h.hp} из ${h.maxHp}, защита ${h.guard}"><span>${symbol("heart")}<strong>${h.hp}<small> / ${h.maxHp}</small></strong></span><span>${symbol("shield")}<strong>${h.guard}</strong></span></div><div class="health-meter" aria-hidden="true"><i style="width:${(h.hp / h.maxHp) * 100}%"></i></div></div>`).join("")}</section>`;
}
function expeditionStatus() {
  return `<div class="expedition-status">${partyCondition()}${topSlots()}</div>`;
}
function coinReward(count) {
  return `<span class="coin-reward" aria-label="Награда: ${count} золотых монет">${Array.from({ length: count }, () => symbol("coin")).join("")}</span>`;
}
function encounterCard(e, i) {
  const current = i === state.stage,
    complete = i < state.stage;
  const skip = e.skip;
  return `<article class="encounter-card ${e.color} ${current ? "current" : complete ? "complete" : "waiting"}">
    ${i === encounters.length - 1 ? '<small class="boss-tag">БОСС</small>' : ""}<div class="encounter-name ${e.color}">${e.name}</div>
    <div class="encounter-portrait">${e.icon === "skull" ? symbol("skull") : portrait(e.icon)}</div>
    ${coinReward(e.reward)}<div class="encounter-divider"></div><p>${e.detail}</p>
    <div class="encounter-top">${current ? button("В бой", "encounter", "gold") : `<div class="bevel muted">${complete ? "Пройдено" : "Впереди"}</div>`}</div>
    ${skip && !complete ? `<div class="skip-row">${button(`${state.runSkips[i]}<small class="skip-bonus">${skip.supplies ? `+${skip.supplies} припас` : `+${coinReward(skip.coins)}`}</small>`, "skip", "dark", current ? "" : "disabled")}</div>` : ""}
  </article>`;
}
function encounterTrail(index) {
  const points =
    index === 1
      ? [
          [0, 76],
          [26, 26],
          [68, 13],
          [100, 48],
        ]
      : [
          [0, 77],
          [32, 111],
          [75, 139],
          [100, 90],
        ];
  const steps = Array.from({ length: 14 }, (_, i) => {
    const t = 0.04 + (i * 0.92) / 13,
      u = 1 - t;
    const [a, b, c, d] = points;
    const x =
      u * u * u * a[0] +
      3 * u * u * t * b[0] +
      3 * u * t * t * c[0] +
      t * t * t * d[0];
    const y =
      u * u * u * a[1] +
      3 * u * u * t * b[1] +
      3 * u * t * t * c[1] +
      t * t * t * d[1];
    const dx =
      3 * u * u * (b[0] - a[0]) +
      6 * u * t * (c[0] - b[0]) +
      3 * t * t * (d[0] - c[0]);
    const dy =
      3 * u * u * (b[1] - a[1]) +
      6 * u * t * (c[1] - b[1]) +
      3 * t * t * (d[1] - c[1]);
    return `<i class="trail-step" style="left:${x}%;top:${y + (i % 2 ? 4 : -4)}px;--step-angle:${(Math.atan2(dy, dx * 2) * 180) / Math.PI}deg"></i>`;
  }).join("");
  return `<div class="encounter-trail" aria-hidden="true">${steps}</div>`;
}
function route() {
  return `<main class="game-layout">${sidebar()}<section class="playfield route-field" aria-label="Выбор встречи"><div class="encounter-cards">${encounters.map((e, i) => `${i ? encounterTrail(i) : ""}${encounterCard(e, i)}`).join("")}</div>${expeditionStatus()}<div class="route-footer"><p class="field-caption">${encounters[0].region} <span>·</span> ГЛАВА ${state.run.chapter}${state.run.endless ? " · ∞" : ""}</p>${button("Привал · 3 монеты", "rest", "dark", state.run.coins < 3 || state.run.heroes.every((h) => h.hp === h.maxHp) ? "disabled" : "")}</div></section></main>`;
}
function actionCard(c, index, preview = false, spent = false) {
  if (state.run && (!preview || state.modal === "run-book"))
    c = effectiveCard(
      c,
      state.run.relics,
      state.run.battle?.heroes.find((h) => h.id === c.hero),
    );
  const selected =
    !preview &&
    state.activeItem?.kind === "card" &&
    state.activeItem.id === c.id;
  const owner = heroById(c.hero).name;
  return `<button class="action-card ${c.color} ${preview ? "book-spell" : ""} ${spent ? "spent-card" : ""} ${selected ? "selected" : ""}" style="--card-index:${index};--card-angle:${preview ? 0 : (index - (hand.length - 1) / 2) * 1.5}deg;--card-drop:${preview ? 0 : Math.abs(index - (hand.length - 1) / 2) * 3}px" ${preview ? "" : `data-action="card" data-drag-card="${c.id}" data-id="${c.id}" aria-pressed="${selected}"`} aria-label="${c.name}, ${spellDescription(c)}, энергия ${c.energy}, ${owner}${spent ? ", израсходована" : ""}"><div class="card-illustration">${portrait(c.hero)}</div><div class="card-title">${c.name}</div><div class="card-effect">${c.effect}${c.amount === undefined ? "" : ` <strong>${c.amount}</strong>`}</div><div class="card-multiplier">Множитель <strong>×${String(c.multiplier).replace(".", ",")}</strong></div>${c.detail ? `<div class="card-detail">${c.detail}</div>` : ""}<div class="card-bottom-symbol"><span class="card-energy" aria-label="Энергия ${c.energy}">${symbol("energy")}<strong>${c.energy}</strong></span><span class="card-owner">${owner}</span></div></button>`;
}
function statuses(u) {
  return [
    u.poison ? `Яд ${u.poison}` : "",
    u.vulnerable ? "Уязвимость" : "",
    u.slow ? "Замедление" : "",
    u.dodge ? "Уклонение" : "",
    u.strength ? `Урон +${u.strength}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
function intentText(e, b) {
  const i = e.intent;
  if (!i || !e.hp) return "";
  const amount = Math.max(1, (i.damage || i.amount) - (e.slow ? 2 : 0));
  const target =
    [...b.heroes, ...b.enemies].find((h) => h.id === i.target)?.name || "";
  return i.type === "all"
    ? `Урон ${amount} всем`
    : i.type === "guard"
      ? `Защита +${i.amount}`
      : i.type === "heal"
        ? `Лечение ${i.amount} → ${target}`
        : i.type === "hex"
          ? `Уязвимость → ${target}`
          : i.type === "poison"
            ? `Урон ${amount}, яд ${i.amount} → ${target}`
            : `Урон ${amount} → ${target}`;
}
function combatUnit(u, side, forecast, b) {
  const h = side === "ally" ? heroById(u.id) : u;
  const future = forecast.find((f) => f.id === u.id);
  const eligible =
    state.activeItem &&
    validTarget(b, state.activeItem.kind, state.activeItem.id, u.id);
  return `<div class="combat-unit ${u.hp ? "" : "fallen"}"><button class="hero-card ${side === "enemy" ? "enemy-card" : "ally-card"} ${eligible ? "target-ready" : ""}" data-action="target" data-target="${u.id}" data-side="${side}" aria-label="${h.name}, здоровье ${u.hp}, защита ${u.guard}${side === "enemy" ? ", " + intentText(u, b) : ""}" ${!u.hp ? "disabled" : ""}><div class="hero-card-art">${portrait(side === "ally" ? u.id : u.art)}</div><strong>${h.name}</strong><small>${side === "ally" ? h.role : u.role === "boss" ? "Босс" : ""}</small></button><div class="hero-vitals"><span>${symbol("heart")}<strong>${u.hp}<small> / ${u.maxHp}</small></strong>${future && future.hp !== u.hp ? `<em>→${future.hp}</em>` : ""}</span><span>${symbol("shield")}<strong>${u.guard}</strong>${future && future.guard !== u.guard ? `<em>→${future.guard}</em>` : ""}</span></div><div class="unit-status">${statuses(u)}</div>${side === "enemy" ? `<div class="enemy-intent">${intentText(u, b)}</div>` : ""}</div>`;
}
function battle() {
  const b = state.run.battle,
    forecast = previewTurn(b),
    queued = new Set(b.plan.filter((p) => p.kind === "card").map((p) => p.id));
  const visible = b.deck.hand.filter((c) => !queued.has(c.id));
  return `<main class="game-layout">${sidebar()}<section class="playfield combat-field" aria-label="Бой">
    <div class="combat-row enemy-row">${b.enemies.map((e) => combatUnit(e, "enemy", forecast.enemies, b)).join("")}</div>
    <div class="turn-center"><span>Ход ${b.turn}</span><strong title="1 + прибавки множителей карт и реликвий">Множитель ×${String(turnMultiplier(b)).replace(".", ",")}</strong><div class="plan-queue">${b.plan
      .map((p, i) => {
        const c =
          p.kind === "card"
            ? b.deck.hand.find((c) => c.id === p.id)
            : supplyById(b.supplies.find((s) => s.uid === p.id).id);
        const t = [...b.heroes, ...b.enemies].find((u) => u.id === p.target);
        return `<button data-action="undo" data-index="${i}" title="Вернуть в руку">${c.name} → ${t.name} <span>×</span></button>`;
      })
      .join("")}</div></div>
    <div class="combat-row ally-row">${b.heroes.map((h) => combatUnit(h, "ally", forecast.heroes, b)).join("")}</div>
    <div class="combat-gear">${topSlots()}</div>
    <div class="combat-hand"><div class="hand-cards">${visible.map((c, i) => actionCard(c, i)).join("")}</div></div>
    <div class="turn-footer"><span class="combat-notice" role="status">${state.notice || ""}</span>${button("Завершить ход", "end-turn", "blue", b.status === "active" ? "" : "disabled")}<button class="combat-help" data-action="help" aria-label="Правила боя">?</button></div>
  </section></main>`;
}

function heroCard(id, { slot = null, reserve = false } = {}) {
  const h = heroById(id);
  return `<button class="hero-card ${h.color} ${state.pickedHero === id ? "picked" : ""}" data-action="${reserve ? "pick-hero" : slot === null ? "none" : "replace-slot"}" ${reserve ? `data-drag-hero="${id}" data-hero="${id}" aria-pressed="${state.pickedHero === id}"` : `data-slot="${slot}"`} aria-label="${reserve ? `Выбрать ${h.name}, ${h.role}` : slot === null ? `${h.name}, ${h.role}` : `Заменить ${h.name}, место ${slot + 1}`}" ${slot === null && !reserve ? "disabled" : ""}><div class="hero-card-art">${portrait(id)}</div><strong>${h.name}</strong><small>${h.role}</small></button>`;
}

function setup() {
  const df = difficulties[state.difficulty];
  return `<div class="setup-content"><div class="setup-tabs" role="tablist">${[
    ["new", "Новый поход"],
    ["continue", "Продолжить"],
  ]
    .map(([id, name]) =>
      button(
        name,
        "tab",
        state.tab === id ? "red" : "dark",
        `role="tab" aria-selected="${state.tab === id}" data-tab="${id}"`,
      ),
    )
    .join("")}</div>
  ${
    state.tab === "continue"
      ? `<div class="continue-preview inset">${symbol("camp")}<h2>${state.hasRun ? encounters[0].region : "Нет начатого похода"}</h2><p>${state.hasRun ? `Глава ${state.run.chapter} · встреча ${state.stage + 1} · ${difficulties[state.runDifficulty].name}` : "Начните новый поход. Поход сохраняется на этом компьютере."}</p><div class="setup-party-cards">${(state.runParty || state.party).map((id) => heroCard(id)).join("")}</div></div>`
      : `<div class="setup-party inset"><h2>Походный отряд</h2><div class="setup-party-cards">${state.party.map((id) => heroCard(id)).join("")}</div>${button("Изменить отряд", "party-book", "dark")}</div>
  <div class="setup-difficulty inset"><button class="arrow-button" data-action="prev-difficulty" aria-label="Предыдущая сложность">‹</button><div class="difficulty-icon">${symbol(df.icon)}</div><div><h3>${df.name}</h3><div class="paper">${df.description}</div></div><button class="arrow-button" data-action="next-difficulty" aria-label="Следующая сложность">›</button></div>`
  }</div>`;
}

function partyBook(inRun = false) {
  const party = inRun ? state.runParty : state.party;
  const reserve = heroes.filter((h) => !party.includes(h.id));
  const deck = inRun
    ? currentDeckCards(cards, state.screen === "battle" ? encounterDeck : null)
    : buildDeck(party);
  const spent = new Set(
    inRun && state.screen === "battle"
      ? encounterDeck.spent.map((c) => c.id)
      : [],
  );
  return `<div class="party-book ${inRun ? "run-book" : ""}"><section class="book-page current-page"><header><small>СОСТАВ</small><h2>Текущий отряд</h2></header><div class="book-current-grid">${party.map((id, slot) => heroCard(id, inRun ? {} : { slot })).join("")}</div><div class="book-fans" aria-label="${inRun ? "Заклинания отряда" : "Стартовые заклинания"}">${party
    .map((id) => {
      const h = heroById(id);
      const memberCards = deck.filter((c) => c.hero === id);
      const names = [...new Set(memberCards.map((c) => c.name))];
      const ordered = names.flatMap((name) =>
        memberCards.filter((c) => c.name === name),
      );
      return `<div class="spell-fan" style="--fan-count:${Math.max(1, ordered.length - 1)}" aria-label="Заклинания ${h.name}">${ordered.map((c, i) => actionCard(c, i, true, spent.has(c.id))).join("")}</div>`;
    })
    .join(
      "",
    )}</div>${inRun ? "" : `<span class="sr-only" role="status">${state.partyNotice}</span>`}</section><section class="book-page reserve-page">${inRun ? "" : `<header><small>ПЕРСОНАЖИ</small><h2>Доступны для замены</h2></header><div class="book-reserve-grid">${reserve.map((h) => heroCard(h.id, { reserve: true })).join("")}</div>`}</section></div>`;
}

function modalFooter() {
  if (
    ["exit-run", "victory", "defeat", "final", "replace-reward"].includes(
      state.modal,
    )
  )
    return "";
  if (state.modal === "setup")
    return button(
      state.tab === "continue" ? "Продолжить" : "Начать",
      state.tab === "continue" ? "resume" : "start",
      "blue",
      state.tab === "continue" && !state.hasRun ? "disabled" : "",
    );
  if (state.modal === "party-book")
    return button("Готово", "finish-party", "blue");
  if (state.modal === "run-book") return button("Готово", "close", "blue");
  return button("Назад", "close", "gold", 'aria-label="Закрыть окно"');
}
function gameModalBody() {
  const r = state.run;
  if (state.modal === "collection")
    return `<h2 class="modal-heading">Реликвии</h2><div class="collection-grid">${relics.map((data) => `<div class="relic-card paper">${symbol(data.icon)}<h3>${data.name}</h3><p>${data.description}</p></div>`).join("")}</div>`;
  if (state.modal === "inspect-relic" || state.modal === "inspect-supply") {
    const item =
      state.modal === "inspect-relic"
        ? relicById(state.inspectId)
        : supplyById(state.inspectId);
    return `<h2 class="modal-heading">${item.name}</h2><div class="item-detail">${symbol(item.icon)}<p>${item.description}</p></div>`;
  }
  if (state.modal === "help")
    return `<h2 class="modal-heading">Бой</h2><div class="paper note"><p>Seed ${r.seed} · глава ${r.chapter} · ${difficulties[r.difficulty].name}</p><p>Перетащите карту на цель или выберите карту и цель кликами. Карты разрешаются по порядку после «Завершить ход». Нажатие на действие в центре возвращает карту.</p><p>Каждый ход: 4 эликсира, рука до 9 карт. Неиспользованные карты остаются. Потраченные возвращаются только перед следующим боем.</p><p>Множитель = 1 + сумма прибавок карт и реликвий. Две карты ×2 дают ×3. Он усиливает урон, защиту, лечение и наложение яда; сбрасывается каждый ход.</p><p>Яд обходит защиту и действует перед ответом врагов, затем уменьшается на 1. Уязвимость: +25% получаемого урона. Замедление: −2 урона атаки. Щиты героев действуют до следующего хода.</p><p>Один припас за ход, без эликсира и множителя. Погибший герой не действует; после победы возвращается с 8 здоровья. Поход заканчивается при гибели всего отряда или исчерпании всех карт и припасов.</p><p>Числа под стрелками — результат запланированных действий до ответа врагов. Их намерения показаны под карточками.</p>${r?.battle?.log.length ? `<hr><p>${r.battle.log.map(esc).join("<br>")}</p>` : ""}</div>`;
  if (state.modal === "leaderboard") {
    const rows = readScores();
    return `<h2 class="modal-heading">Лидерборд</h2><p class="modal-intro">На этом компьютере</p><div class="leaderboard-table"><table><thead><tr><th>Место</th><th>Отряд</th><th>Глава</th><th>Счёт</th></tr></thead><tbody>${rows.length ? rows.map((row, i) => `<tr><td>${i + 1}</td><td>${row.party.map((id) => heroById(id)?.name || "—").join(", ")}</td><td>${Math.floor(row.chapter)}${row.outcome === "complete" ? " ✓" : ""}</td><td>${Math.floor(row.score).toLocaleString("ru")}</td></tr>`).join("") : '<tr><td colspan="4">Нет завершённых походов</td></tr>'}</tbody></table></div>`;
  }
  if (state.modal === "victory")
    return `<h2 class="modal-heading">Победа</h2><p class="modal-intro">${encounters[r.stage].name} · +${encounters[r.stage].reward} монет</p><div class="reward-grid">${rewardChoices(
      r,
    )
      .map(
        (c, i) =>
          `<button class="reward-card paper" data-action="reward" data-index="${i}" ${r.rewardChosen ? "disabled" : ""}>${symbol(c.icon)}<strong>${c.name}</strong><p>${c.description}</p></button>`,
      )
      .join(
        "",
      )}</div><div class="reward-actions">${button("Привал · 3 монеты", "rest", "dark", r.coins < 3 || r.heroes.every((h) => h.hp === h.maxHp) ? "disabled" : "")}${r.rewardChosen ? "<span>Награда получена</span>" : button("Отказаться от награды", "skip-reward", "dark")}${button("Продолжить", "next-stage", "blue", r.rewardChosen ? "" : "disabled")}</div>`;
  if (state.modal === "replace-reward")
    return `<h2 class="modal-heading">Что заменить?</h2><div class="reward-grid">${(state
      .replaceReward.kind === "relic"
      ? r.relics
      : r.supplies
    )
      .map((item) => {
        const data =
          state.replaceReward.kind === "relic"
            ? relicById(item)
            : supplyById(item.id);
        return `<button class="reward-card paper" data-action="replace-reward" data-id="${state.replaceReward.kind === "relic" ? item : item.uid}">${symbol(data.icon)}<strong>${data.name}</strong><p>${data.description}</p></button>`;
      })
      .join("")}</div>${button("Отмена", "cancel-reward", "dark")}`;
  if (state.modal === "defeat")
    return `<h2 class="modal-heading">Поход окончен</h2><div class="result-summary"><p>${esc(r.battle?.reason || "Отряд пал.")}</p><strong>${r.score.toLocaleString("ru")} очков</strong><span>Глава ${r.chapter} · ${r.completed} побед</span></div>${button("В главное меню", "end-run", "blue")}`;
  if (state.modal === "final")
    return `<h2 class="modal-heading">Перевал пройден</h2><div class="result-summary"><strong>${r.score.toLocaleString("ru")} очков</strong><p>Дальше — новые отряды и растущая сила врагов.</p></div><div class="reward-actions">${button("Завершить поход", "finish-run", "dark")}${button("Бесконечный путь", "endless", "blue")}</div>`;
  return null;
}
function modalBody() {
  const gameBody = gameModalBody();
  if (gameBody !== null) return gameBody;
  switch (state.modal) {
    case "setup":
      return setup();
    case "party-book":
      return partyBook();
    case "run-book":
      return partyBook(true);
    case "exit-run":
      return `<h2 class="modal-heading">Выйти в главное меню?</h2><p class="modal-intro">Поход сохранён на этом компьютере.</p><div class="exit-actions">${button("Остаться", "close", "blue")}${button("Выйти", "confirm-exit", "dark")}</div>${state.run?.endless ? button("Завершить поход и записать счёт", "retire", "dark") : ""}`;
    default:
      return '<h2 class="modal-heading">dndrun</h2>';
  }
}
let returnFocus = null;
function openModal(name) {
  if (name === "setup") state.tab = "new";
  returnFocus = document.activeElement;
  state.modal = name;
  render();
  document.querySelector(".modal button")?.focus();
}
function closeModal() {
  if (state.modal === "party-book") {
    state.modal = "setup";
    state.pickedHero = null;
    render();
    document.querySelector("[data-action=party-book]")?.focus();
    return;
  }
  if (["victory", "defeat", "final", "replace-reward"].includes(state.modal))
    return;
  state.modal = null;
  render();
  if (returnFocus?.dataset.action)
    document
      .querySelector(`[data-action="${returnFocus.dataset.action}"]`)
      ?.focus();
}
function render() {
  syncRun();
  persist();
  cancelPartyDrag();
  if (!desktopViewport.matches) {
    root.innerHTML = `<main class="screen-notice"><div class="notice-art">${symbol("die")}</div><small>DNDRUN</small><h1>Мобильная версия<br>пока в разработке</h1><p>Сейчас приключение доступно на компьютере.<br>Откройте игру в окне размером от 1024 × 640.</p><span>Если вы уже на компьютере — увеличьте окно браузера.</span></main>`;
    return;
  }
  root.innerHTML = `<div class="world ${state.screen === "menu" ? "menu-world" : "table-world"} ${state.reduced ? "still" : ""}"><div class="world-art">${landscape()}</div><div class="world-vignette"></div>${state.screen === "menu" ? menu() : state.screen === "route" ? route() : battle()}${state.modal ? `<div class="modal-backdrop"><section class="modal ${state.modal === "setup" ? "setup-modal" : state.modal === "exit-run" ? "exit-modal" : ""}" role="dialog" aria-modal="true" aria-label="${state.modal === "setup" ? "Выбор похода" : state.modal === "party-book" ? "Книга отряда" : state.modal === "exit-run" ? "Подтверждение выхода" : "Окно игры"}">${["setup", "party-book", "run-book"].includes(state.modal) ? '<button class="modal-close" data-action="close" aria-label="Закрыть окно">×</button>' : ""}<div class="modal-body">${modalBody()}</div>${modalFooter()}</section></div>` : ""}</div>`;
  root.querySelector("main").inert = Boolean(state.modal);
  if (["party-book", "run-book"].includes(state.modal)) {
    root.querySelector(".modal").classList.add("book-modal");
    root.querySelector(".modal").setAttribute("aria-label", "Книга отряда");
  }
}

function swapPartyHero(slot, id) {
  const next = replaceHero(state.party, slot, id);
  if (next === state.party) return;
  state.party = next;
  state.pickedHero = null;
  state.partyNotice = `${heroById(id).name} в отряде. Стартовые заклинания обновлены.`;
  render();
  root.querySelector(`[data-slot="${slot}"]`)?.focus({ preventScroll: true });
}

let partyDrag = null,
  suppressPartyClick = false;
let combatDrag = null,
  suppressCombatClick = false;
function applyTarget(target) {
  const item = state.activeItem;
  if (!item) return;
  const planned = planAction(state.run.battle, item.kind, item.id, target);
  if (planned) {
    state.run.battle = planned;
    state.activeItem = null;
    state.notice = "";
  } else state.notice = "Эту карту нельзя применить к выбранной цели.";
}
root.addEventListener("pointerdown", (event) => {
  if (state.screen !== "battle" || state.modal || event.button !== 0) return;
  const card = event.target.closest("[data-drag-card]"),
    supply = event.target.closest('[data-action="supply"]');
  if (!card && !supply) return;
  const id = card ? Number(card.dataset.dragCard) : supply.dataset.id;
  combatDrag = {
    source: card || supply,
    kind: card ? "card" : "supply",
    id,
    x: event.clientX,
    y: event.clientY,
    ghost: null,
  };
});
document.addEventListener("pointermove", (event) => {
  if (!combatDrag) return;
  const d = combatDrag;
  if (!d.ghost && Math.hypot(event.clientX - d.x, event.clientY - d.y) > 5) {
    d.ghost = d.source.cloneNode(true);
    d.ghost.classList.add("combat-drag");
    d.ghost.removeAttribute("data-action");
    d.ghost.setAttribute("aria-hidden", "true");
    document.body.append(d.ghost);
    state.activeItem = { kind: d.kind, id: d.id };
    root
      .querySelectorAll("[data-target]")
      .forEach((e) =>
        e.classList.toggle(
          "target-ready",
          validTarget(state.run.battle, d.kind, d.id, e.dataset.target),
        ),
      );
  }
  if (!d.ghost) return;
  event.preventDefault();
  d.ghost.style.left = `${event.clientX - 55}px`;
  d.ghost.style.top = `${event.clientY - 70}px`;
});
function finishCombatDrag(event, cancel = false) {
  if (!combatDrag) return;
  const d = combatDrag;
  combatDrag = null;
  if (!d.ghost) return;
  d.ghost.remove();
  suppressCombatClick = true;
  setTimeout(() => (suppressCombatClick = false), 0);
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-target]");
  if (!cancel && target) applyTarget(target.dataset.target);
  else state.activeItem = null;
  render();
}
document.addEventListener("pointerup", (event) => finishCombatDrag(event));
document.addEventListener("pointercancel", (event) =>
  finishCombatDrag(event, true),
);
function cancelPartyDrag() {
  partyDrag?.ghost?.remove();
  partyDrag = null;
  root
    .querySelectorAll(".drop-target")
    .forEach((e) => e.classList.remove("drop-target"));
}
root.addEventListener("pointerdown", (event) => {
  const source = event.target.closest("[data-drag-hero]");
  if (state.modal !== "party-book" || !source || event.button !== 0) return;
  partyDrag = {
    id: source.dataset.dragHero,
    x: event.clientX,
    y: event.clientY,
    source,
    ghost: null,
  };
});
document.addEventListener("pointermove", (event) => {
  if (!partyDrag) return;
  if (
    !partyDrag.ghost &&
    Math.hypot(event.clientX - partyDrag.x, event.clientY - partyDrag.y) > 5
  ) {
    const ghost = partyDrag.source.cloneNode(true);
    ghost.className = "hero-card drag-ghost";
    ghost.removeAttribute("data-action");
    ghost.setAttribute("aria-hidden", "true");
    ghost.tabIndex = -1;
    document.body.append(ghost);
    partyDrag.ghost = ghost;
  }
  if (!partyDrag.ghost) return;
  event.preventDefault();
  partyDrag.ghost.style.left = `${event.clientX - 65}px`;
  partyDrag.ghost.style.top = `${event.clientY - 70}px`;
  root
    .querySelectorAll(".drop-target")
    .forEach((e) => e.classList.remove("drop-target"));
  document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-slot]")
    ?.classList.add("drop-target");
});
function finishPartyDrag(event, cancel = false) {
  if (!partyDrag) return;
  const drag = partyDrag;
  partyDrag = null;
  root
    .querySelectorAll(".drop-target")
    .forEach((e) => e.classList.remove("drop-target"));
  if (!drag.ghost) return;
  drag.ghost.remove();
  suppressPartyClick = true;
  setTimeout(() => (suppressPartyClick = false), 0);
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-slot]");
  if (!cancel && target && state.modal === "party-book")
    swapPartyHero(Number(target.dataset.slot), drag.id);
}
document.addEventListener("pointerup", (event) => finishPartyDrag(event));
document.addEventListener("pointercancel", (event) =>
  finishPartyDrag(event, true),
);
root.addEventListener("click", (event) => {
  if (suppressPartyClick || suppressCombatClick) return;
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (
    [
      "setup",
      "collection",
      "run-book",
      "leaderboard",
      "help",
      "exit-run",
    ].includes(action)
  ) {
    openModal(action);
    return;
  }
  if (action === "close") {
    closeModal();
    return;
  }
  if (action === "party-book") {
    state.modal = "party-book";
    state.pickedHero = null;
    state.partyNotice = "";
    render();
    document.querySelector(".modal-close")?.focus();
    return;
  }
  if (action === "finish-party") {
    closeModal();
    return;
  }
  if (action === "pick-hero") {
    state.pickedHero = target.dataset.hero;
    state.partyNotice = `${heroById(state.pickedHero).name}: выберите место в текущем отряде.`;
  }
  if (action === "replace-slot" && state.pickedHero) {
    swapPartyHero(Number(target.dataset.slot), state.pickedHero);
    return;
  }
  if (action === "resume" && state.hasRun) {
    state.screen = state.resumeScreen;
    state.modal = state.resumeModal || null;
    state.activeItem = null;
  }
  if (action === "tab") state.tab = target.dataset.tab;
  if (action === "prev-difficulty")
    state.difficulty = (state.difficulty + 2) % 3;
  if (action === "next-difficulty")
    state.difficulty = (state.difficulty + 1) % 3;
  if (action === "start") {
    state.run = createRun(state.party, state.difficulty);
    state.hasRun = true;
    state.screen = "route";
    state.modal = null;
    state.resumeScreen = "route";
    state.resumeModal = null;
    state.activeItem = null;
    state.notice = "";
  }
  if (action === "confirm-exit") {
    state.resumeScreen = state.screen;
    state.resumeModal = null;
    state.screen = "menu";
    state.modal = null;
  }
  if (action === "encounter" && state.screen === "route") {
    const r = state.run;
    r.battle = createBattle({
      heroes: r.heroes,
      cards: r.cards,
      encounter: r.encounters[r.stage],
      relics: r.relics,
      supplies: r.supplies,
      seed: r.seed + r.completed * 919 + r.chapter * 31 + r.stage,
    });
    state.screen = "battle";
    state.activeItem = null;
    state.notice = "";
  }
  if (action === "skip" && state.screen === "route") {
    const r = state.run,
      skip = r.encounters[r.stage].skip;
    if (!skip) return;
    r.coins += skip.coins || 0;
    if (skip.supplies) addSupply(r, "tonic");
    r.stage++;
  }
  if (action === "card" && state.screen === "battle") {
    const id = Number(target.dataset.id),
      b = state.run.battle,
      c = b.deck.hand.find((c) => c.id === id);
    if (!c || c.energy > remainingElixir(b)) {
      state.notice = "Недостаточно эликсира.";
    } else {
      state.activeItem =
        state.activeItem?.id === id && state.activeItem.kind === "card"
          ? null
          : { kind: "card", id };
      state.notice = "";
    }
  }
  if (action === "supply") {
    const item = state.run.supplies.find((s) => s.uid === target.dataset.id);
    if (state.screen !== "battle") {
      state.inspectId = item.id;
      state.modal = "inspect-supply";
    } else if (state.run.battle.plan.some((p) => p.kind === "supply"))
      state.notice = "Один припас за ход.";
    else state.activeItem = { kind: "supply", id: item.uid };
  }
  if (action === "inspect-relic") {
    state.inspectId = target.dataset.id;
    state.modal = "inspect-relic";
  }
  if (action === "target" && state.activeItem)
    applyTarget(target.dataset.target);
  if (action === "undo") {
    state.run.battle = undoAction(
      state.run.battle,
      Number(target.dataset.index),
    );
    state.notice = "";
    state.activeItem = null;
  }
  if (action === "end-turn" && state.screen === "battle" && !state.modal) {
    const r = state.run;
    r.battle = endTurn(r.battle);
    r.heroes = r.battle.heroes;
    r.supplies = r.battle.supplies;
    state.activeItem = null;
    state.notice = "";
    if (r.battle.status === "victory") {
      claimVictory(r, r.battle);
      state.modal = "victory";
    } else if (r.battle.status === "defeat") {
      recordScore(r, "defeat");
      state.hasRun = false;
      state.modal = "defeat";
    }
  }
  if (action === "rest") rest(state.run);
  if (action === "reward") {
    const r = state.run,
      c = rewardChoices(r)[Number(target.dataset.index)];
    if (c) {
      if (
        (c.kind === "relic" && r.relics.length === 5) ||
        (c.kind === "supply" && r.supplies.length === 2)
      ) {
        state.replaceReward = c;
        state.modal = "replace-reward";
      } else chooseReward(r, c);
    }
  }
  if (action === "replace-reward") {
    chooseReward(state.run, state.replaceReward, target.dataset.id);
    state.replaceReward = null;
    state.modal = "victory";
  }
  if (action === "cancel-reward") {
    state.replaceReward = null;
    state.modal = "victory";
  }
  if (action === "skip-reward") state.run.rewardChosen = true;
  if (action === "next-stage" && state.run.rewardChosen) {
    const next = advanceRun(state.run);
    state.screen = "route";
    state.modal = next === "final" ? "final" : null;
  }
  if (action === "endless") {
    enterEndless(state.run);
    state.screen = "route";
    state.modal = null;
  }
  if (action === "retire") {
    recordScore(state.run, "retired");
    state.hasRun = false;
    state.screen = "menu";
    state.modal = null;
  }
  if (action === "finish-run") {
    recordScore(state.run, "complete");
    state.hasRun = false;
    state.screen = "menu";
    state.modal = null;
  }
  if (action === "end-run") {
    state.screen = "menu";
    state.modal = null;
    state.hasRun = false;
  }
  render();
  // Preserve focus through DOM updates, without changing scroll position.
  const focusKey =
    action === "card"
      ? `[data-id="${target.dataset.id}"]`
      : action === "pick-hero"
        ? `[data-hero="${target.dataset.hero}"]`
        : action === "tab"
          ? `[data-tab="${target.dataset.tab}"]`
          : "";
  document
    .querySelector(`[data-action="${action}"]${focusKey}`)
    ?.focus({ preventScroll: true });
  if (state.modal && !document.activeElement.closest(".modal"))
    document.querySelector(".modal button")?.focus({ preventScroll: true });
});
document.addEventListener("keydown", (event) => {
  if (!desktopViewport.matches) return;
  if (event.key === "Escape" && state.modal) {
    event.preventDefault();
    closeModal();
  } else if (event.key === "Escape" && state.activeItem) {
    state.activeItem = null;
    state.notice = "";
    render();
  }
  if (
    event.key === "Enter" &&
    !state.modal &&
    state.screen === "battle" &&
    !event.target.closest("button")
  )
    document.querySelector('[data-action="end-turn"]')?.click();
  if (event.key === "Tab" && state.modal) {
    const elements = [
      ...document.querySelectorAll(".modal button:not(:disabled)"),
    ];
    const first = elements[0],
      last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
desktopViewport.addEventListener("change", render);
render();
