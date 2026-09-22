# QA — the page bodies, and the number that was measuring nothing

Nine pages were reported here at 77–96% while being, in the user's words, "not
10% similar to live". Both statements were true, and the gap between them is
the finding.

## What the old number measured

`scripts/qa-design.mjs` scores **regions**, and a region is a **bounding box**
plus an allow-list of computed styles. Two pages that are both "a card on the
left, a card on the right" at the same sizes, with the same card radius, border
and shadow, score in the high eighties — whatever is inside them.

So this passed:

| page | what the product shows | what this system showed |
|---|---|---|
| Credits Usage | a 300px ring, a three-up Available/Used/Total strip, a five-row legend, and a timeline of dated property cards | a four-column stat grid and an empty table with a pager |
| Reports Summary | a purpose segmented control, a date-range field, three metric tabs with deltas, a channel strip, product pills and a 30-point line chart | two grey rectangles captioned "Chart" |
| Ad License | a 1035-wide wizard: a Back pill, an H2, three sections each a title column beside stepped fields with choice pills | a two-column form of six invented fields |
| Agency Settings | an in-card agency header, a phone field with a country box, an Agency Description textarea | an invented "Commercial Registration Number", no header, no textarea |

None of that is a styling mistake. It is **content that was written rather than
measured** — the failure the repo's own plan names as its spine, applied to the
one layer no check was looking at.

## The check that would have caught it

`scripts/qa-body.mjs`. It is `qa-overlays.mjs` one level up: it walks the
content region on both sides and compares what the body is **made of**.

```
node scripts/qa-body.mjs               every page that has both captures
node scripts/qa-body.mjs credits       only pages matching "credits"
```

| signal | what it catches |
|---|---|
| **cards** | a whole card missing, at a 400px floor so a chip is not counted as one |
| **charts** | a real `<svg>`/`<canvas>`, so a grey rectangle scores zero — the empty-state illustration and nested `<svg>` are excluded |
| **empty states** | ours empty where the product has data: a fixture answered with nothing |
| **parts** | buttons, links, fields and icons, under the conventions below |
| **nodes** | how much is in there at all — context on every line, a fault below 50% |

**Conventions it is taught, because they are deliberate and not defects:**

- a navigation is `<a href="not-built.html">` here and a Button in the product
- a select trigger is `<button class="pf-select">` here and a div wrapping an
  input in antd
- a segmented control, a product pill, a wizard choice and a metric tab are all
  antd `Radio`/`Tabs` — real `<input>`s — and `<button role="radio|tab">` here

**What the node ratio does NOT mean.** antd wraps generously and draws its
charts with a library; a hand-written page reproduces the same design with
fewer nodes and one `<svg>`. Reports Summary sits at 57% with every card, chart
and control matching. The ratio is context; the counts are the gate.

## Where the content comes from now

`scripts/outline.mjs` prints a capture's content region as a readable tree —
every box, its size, its position and the styles that decide whether it is a
card, a pill, a field or a divider:

```
node scripts/outline.mjs live/credits-usage --depth 12
```

Each page was rebuilt from three sources, in this order:

1. **the capture** (`data/live/<route>.capture.json`) for geometry
2. **the product's own field definitions** — `profileFields.js`,
   `agencySettingsFields.js`, `create-ad-license.js` — for labels, types and
   which controls are disabled
3. **the render** (`data/live/<route>.png`) for order and state

Source (2) is what caught the inverse of the usual error: Agency Settings
carried a **Commercial Registration Number** field unconditionally, when
`agencySettingsFields.js:28` gates it on `typeofBuisness === 'Agency Broker'`.
The account is not one, so the product does not draw it — an
instance-promoted-to-default, arrived at from the other direction.

## Still open

- **The range calendar is fabricated.** Both of its months share one invented
  day grid. The two new date fields on LMS Leads and Leads & Reach are
  therefore `data-noop` rather than wired to it: spreading a known-wrong
  component across three pages is worse than one honest gap.
- **Ad License is one card against the product's four**, and its choice groups
  count 24 controls against 6 — the product's capture of that page is shallower
  than the form it renders, so the tail of the wizard is unverified.
- **Listings and Dashboard** predate this check and carry their own gaps:
  Listings 35 links against 2, Dashboard 12 unmatched fields.
- **The illustration's own drawing instructions.** `svg.js` paints two of
  EmptyListing's shapes through `mask-type` and `mix-blend-mode` and three more
  through `style={{ fill: tenantTheme[…] }}`. The icon extractor dropped all of
  them and the art rendered near-black where the product's is nearly white; it
  now resolves the product's theme and keeps those two presentation styles.
  `scripts/check.mjs`'s no-inline-style rule exempts inlined `<svg>` for that
  reason and no other.
