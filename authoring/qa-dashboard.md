# QA — `/dashboard` against live

Method: measure, don't squint. Every row below is a computed value from the
rendered page set against what the codebase declares, not an impression of a
screenshot. Where the codebase declares nothing, the row says so and stays open.

Status at the time of writing: **5 defects found and fixed, 4 open, 3 of the
open ones need one live measurement.**

---

## Header — fixed

| | was | is | source |
|---|---|---|---|
| brand mark | invisible | the green mark, clipped by the rail | — |
| brand inset | 8px | **20px** | `withAdminLayout.js:177` `--sidebar-brand-inset` |
| classified pill icon | inherited grey `#767676` | **`#28B16D`** | `SidebarClassifiedLinkIcon` default prop |

The brand is not a square logo. It is the full **205×33 "Profolio KSA" wordmark**
inset 20px into a 60px rail, so only the mark shows. At 8px inset you got a
sliced "P" as well; at 20px you get what live shows.

Verified now: height 60, `padding-inline-start` 85px (`sidebarOffset + 25`),
title 20/700 `#000`, pill 149×36, primary button 36 tall, badge 16, avatar ring 34.

## Rail — fixed

| | was | is | source |
|---|---|---|---|
| item pitch | 36px | **44px** | antd Menu `itemMarginBlock: marginXXS` = 4, so 36 + 2×4 |

This was the most visible thing wrong with the rail and the easiest to miss:
every item was individually the right height, and the column was still too tight.

Verified now: 60px wide, 11 items in the order `menuList.js` declares, icons 20px
at `#707070`, selected on `#F2FAFA` at `#006169`, two bottom actions.

## The one that matters more than any pixel

**The pages carry an inlined copy of the sprite, and it had fallen four
regenerations behind.** The pill icon was fixed in `deliverables/sprite.svg` and
the page kept rendering the old symbol. Nothing catches that by eye, so it is now
`scripts/sync.mjs` and `npm run check` fails on drift.

Any generated asset that gets embedded rather than linked can do this. There are
two: the sprite and the brand wordmark. Both are covered.

---

## Still open

### Needs one live measurement

| token | current | why it cannot be sourced |
|---|---|---|
| `--chart-h` | `300px` | Chart.js canvas at `height=64` with `maintainAspectRatio`, so the painted height is a ratio of width at runtime |
| `--meter-h` | `8px` | antd `Progress` stroke width, never overridden |
| `--listing-row-h` | `auto` | content-driven; no row height is declared anywhere |
| `--feedback-tab-w` | `28px` | third-party widget, no source in `profolio-reactjs` |

Paste `scripts/probe.js` on live once and `node scripts/reconcile.mjs` fills all
four. Until then they are marked `TBC` in the stylesheet, which is the point of
the marker.

### Known approximations

1. **The chart series is traced from the screenshot**, not sourced. 30 points,
   each ±40. The shape is right; no individual value is.
2. **The listing rows carry real account data** — agency name, ten Bayut and REGA
   ids, prices, locations. No phone numbers or emails. Swap for fixtures before
   this leaves the team.
3. **`.fw-500` and `.fw-600` are synthesised**, here and in production, because
   only Lato 300/400/700 ship. That is correct, not a defect, and it is why the
   deliverables must not request a real 500 from a font service.
4. **The purpose chip** (`Floor for Sale | Ready`) renders as a Tag on
   `--primary-light-4`. On a white row that ground is nearly invisible, which
   matches `listing-purpose.js`, but it is worth a look on the real screen.

---

## What belongs in this HTML — and what does not

The rule that keeps it honest: **the page composes, the catalogue defines, the
stylesheet holds every value.**

**In:**
- one `<link>` to `profolio.css` and one to `fonts.css`, nothing else external
- the sprite, inline, synced by `scripts/sync.mjs`
- markup composed only of classes that exist in `components.html`
- `data-*` attributes for variants and states, so a state is inspectable
- one `<style>` block of *instance data* — `--ring-pct`, `--meter-pct` — which is
  data, not presentation, and keeps the body free of style attributes
- verbatim product copy

**Out:**
- style attributes in the body — `npm run check` fails on them
- raw hex, rgb or px outside `:root` — likewise
- any glyph not from the sprite
- invented copy, invented numbers, and any value that should carry a `TBC`
  instead

**Enforced, not hoped for:** `npm run check` verifies all of the above plus every
path `SKILL.md` routes to, every `var()` resolving, and every icon reference
existing.
