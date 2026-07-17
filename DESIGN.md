# dndrun — Ashen Design Code

Living design system. Source of truth: this file ↔ [`src/index.css`](src/index.css) tokens ↔ [`src/App.css`](src/App.css) recipes.

**Voice:** Bleak monochrome dread — black, faded gray, sparse sickness. Tension before a terrible road, not calm hearth and not space-HUD blue. Soft Russian copy. Typography stays simple.

---

## Principles

1. **One family, two weights, four sizes.** Hierarchy = size + color (+ uppercase for labels).
2. **Tokens only.** No one-off hex greys or `font-weight: 800` in components.
3. **Dense cards stay readable.** Same Body/Meta on pack cards — never solve clutter with 10px crumbs.
4. **Reject:** purple neon, cream+terracotta, warm bronze/hearth, coagulated-blood “cozy malice,” steel-blue / space HUD chrome, ornate dual-serif, glow spam, pill clusters, size/weight sprawl.

---

## Font

| | |
|--|--|
| Family | **IBM Plex Sans** (Cyrillic) |
| Load | Google Fonts in `index.html` |
| CSS | `--font-sans` |

| Weight | Token | Use |
|--------|-------|-----|
| **400** | `--font-regular` | Body, lore, meta, help, footer, secondary card lines |
| **600** | `--font-semibold` | Titles, buttons, hero names, key numbers |

No 500 / 700 / 800. Stats use `font-variant-numeric: tabular-nums`.

---

## Type scale (4 roles)

| Role | Token | Size | Weight | Color | Where |
|------|-------|------|--------|-------|-------|
| **Hero** | `--text-hero` | `clamp(1.75rem, 4vw, 2.5rem)` | 600 | `--text` | Menu brand, result fail/crown title |
| **Title** | `--text-title` | `1.125rem` (18px) | 600 | `--text` | Section heads, pack header, campaign team, radar OVR |
| **Body** | `--text-body` | `0.9375rem` (15px) | 400 | `--text` / `--text-dim` | Default UI, buttons, lore, roster, card names |
| **Meta** | `--text-meta` | `0.75rem` (12px) | 400 (600 if uppercase label) | `--muted` | Eyebrows, axes keys, roles, footer, card secondary |

Utilities: `.t-hero` · `.t-title` · `.t-body` · `.t-meta` · `.t-label` (meta + uppercase + tracking).

**Numbers:** Body or Title size + weight 600 + `--text`. Accent only for spell/bond deltas.

**Pack cards:** name = Body/600 · class·spell = Meta/400/`--muted` · rating = Title/600.

---

## Color — Bleak Monochrome

Horror / dark-fantasy UI research points the same way: restricted **black–gray–white**, desaturated world, chroma only for sparse alerts. That creates quiet tension; warm browns and blood-red chrome read as calm or “gamey,” not dread.

### Surfaces (void black — neutral, no brown, no blue)

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#050505` | Page void |
| `--bg-frame` | `#0a0a0a` | Draft / campaign / results |
| `--panel` | `#111111` | Modals, dense panels |
| `--card` | `#161616` | Cards, rows |
| `--card-2` | `#1c1c1c` | Elevated card |
| `--line` | `#2c2c2c` | Borders |

### Text (faded gray — not bone-cream, not steel-blue)

| Token | Hex | Use |
|-------|-----|-----|
| `--text` | `#c6c6c6` | Primary |
| `--text-dim` | `#8e8e8e` | Secondary |
| `--muted` | `#6a6a6a` | Meta / labels |
| `--faint` | `#454545` | Placeholders, legal |

### Accent (sick fog — institutional dread)

Not blood-warm, not sky-blue. A faded corpse-green gray for interaction and tension.

| Token | Value |
|-------|--------|
| `--accent` | `#7a8178` |
| `--accent-soft` | `rgba(122,129,120,0.12)` |
| `--accent-border` | `rgba(122,129,120,0.42)` |
| `--accent-strong` | `#9aa198` |

### Status

| Token | Role |
|-------|------|
| `--ok` / `--ok-soft` | Cleared — dead moss `#5a635a` |
| `--danger` / `--danger-soft` | Fail only — sparse wound `#8a3535` |
| `--warn` / `--warn-soft` | Boss — mid fog gray `#7a7a7a` |

### Numbers

`--num-main` → `--text` · `--num-accent` → `--accent` · `--num-muted` → `--faint`

### Rarity (3 tiers — faded, not jewel tones)

| Tier | Mood | Hex |
|------|------|-----|
| Common | Dull ash | `#6e6e6e` |
| Rare | Bruised slate (almost gray, slight dusk) | `#6a6878` |
| Legendary | Bleached relic (cold pale, not gold) | `#b0aea4` |

Cards: tinted top wash + matching border (no neon). Soft ~12% / border ~45–50% alpha.

Aliases `--cyan` / `--coral` / `--green` / `--orange` map to accent/danger/ok.

Body fog: black mist + faint sick fog — **no** warm ember, **no** void blue, **no** blood wash.

### Role badge tones (radar)

Gray ladder with tiny hue drift (moss / wound / dusk / plum / dead teal) — still bleak, never cyan HUD.

---

## Space & radius

| Token | Value |
|-------|--------|
| `--space-1`…`--space-6` | 4 / 8 / 12 / 16 / 24 / 32 px |
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--header-h` | 3.35rem |
| `--btn-radius` | `var(--radius-md)` |

Run frames: `padding: 1.25rem clamp(0.75rem, 2vw, 2rem) …` — shared horizontal grid.

---

## Components

### Buttons

- **Primary:** accent-soft fill + accent border; text `--text`; hover stronger soft
- **Secondary:** transparent + accent border; text `--accent`
- **Danger:** danger tokens only
- Sizes: default + `btn-sm`; weight 600; radius `--radius-md`

### Cards / rows

- bg `--card`, border `--line`, radius `--radius-md`
- Active: accent border + soft
- Cleared / fail: ok / danger soft

### Labels

`.t-label` everywhere (ОТРЯД, БАЗА, section crumbs).

---

## Layout shell

- **Menu:** content-sized shell + flex center; footer visible in one viewport (no shell `min-height: 100vh` trap).
- **Header logo:** always navigates home / exits run; scroll to top.
- **Draft / campaign / results:** full-bleed shared padding; campaign has no `max-width: 1100`.

---

## Do / Don’t

**Do:** black–gray hierarchy; faded text; sparse sick-fog accent; tabular nums; uppercase only for labels.

**Don’t:** warm brown chrome; blood-red as brand accent; steel-blue HUD; gold jewel legendary; fifth font size; 700/800; pure `#fff`; purple glow; micro text under 12px for UI.
