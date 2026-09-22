# QA — `/listings` against the harness render

**Score: 94.9%** — 10 disagreements out of 351 weighted checks, 28 regions found
in the product and 27 in ours. It was 91.7% until the design QA found that the
whole system was painting in the wrong typeface; see below. `data/layout/listings.score.json` carries the
full list; re-run it with

```
node harness/capture.mjs --routes listings          # the product, in a real browser
node scripts/derive-layout.mjs --ours deliverables/listings.html
node scripts/derive-layout.mjs --compare data/live/listings.capture.json data/ours/listings.capture.json
```

This is the first page built the right way round: the measurement existed
before the markup. The dashboard took several passes against one screenshot and
still has no number; this took one pass and has one.

---

## Fixed, and what the measurement caught

| | was | is | how it was found |
|---|---|---|---|
| **header title 60px too far right** | `padding-inline-start:85px` inside `.pf-main`, which is already offset by the rail — so the title landed at 145 | the header now spans the viewport (`margin-inline-start:-60px; width:calc(100% + 60px)`), exactly as `withAdminLayout` renders it with the rail painted over its first 60px | `shell.header box.x 0 vs 60` |
| **row divider drawn that the product does not draw** | `td { border-block-end: 1px solid #f0f0f0 }` — antd's default, which I had assumed survived | `border-block-end:0`; `dataTable/style.js` sets `border-collapse !important` and the harness render shows no divider on any row | `table.cell borderBottomWidth 0 vs 1px` |
| **button icon gap 6px** | from `button/styled.js:243` | **8px** — antd's `.ant-btn` gap. Line 243 sits under a commented-out selector and never applies; the render measures 8 | `filter.search` width delta |
| **large button line-height** | inherited 1.571 → 22px | `--lh-btn-lg:1.5` → 24px, antd's `lineHeightLG` | `filter.search lineHeight 24 vs 25.14` |
| **footer 6px too tall** | inherited `--lh-base` | `line-height:normal` — `footerStyle` sets none | `shell.footer height 40.09 vs 45.98` |
| **capture stopped above the cells** | `MAX_DEPTH = 18`; `<td>` is at depth 19 on this page | 28, and `MAX_NODES` 6000. **Every table capture before this carried no cells at all** — the dashboard's table is shallower, so it never showed | `table.cell` had no product side to compare |
| **pager radius, nav font-size** | the nav chevrons' 12px sat on the `<li>`, so the scorer matched the wrong element | font-size moved to the `<button>`; the region predicates now tell a page item from a nav item by its child (`<a>` vs `<button>`), not by style | `pager.nav MISSING` |

Two of those — the divider and the icon gap — were wrong on the **dashboard**
too, and are now fixed there by the same stylesheet.

# Against the real screen — 92.3%

Everything above this line was measured against `harness/capture.mjs`: the
product booted here, in Vite dev mode, on a fixture account. On 22 Sep a
SingleFile of `profolio.staging.bayut.sa/en/listings` arrived, and
`scripts/measure-real.mjs` walks it with the same walker, so it scores the
same way. **92.3%**, and that is the number to quote.

The reassuring part first: the real page is `1440 × 1918` and the harness
renders `1440 × 1918`. Shell, header, rail, footer, fonts — all of it was
right. What was wrong was not measurement. It was inference.

## Three rules my fixture account invented

| | the rule I wrote | what the real page shows |
|---|---|---|
| row actions | "**FIVE, not six.** … each was clicked to see what it opens" | **six**, on every row — the fifth is `sell-rent-listing`, the `%` glyph |
| upgrade circles | every circle disabled at 0.54, on every row | **enabled** on nine of ten rows; one row has 2 enabled · 1 applied · 3 disabled |
| the rail | eleven items | **nine** |

Each has the same shape. I measured a real render, the render was honest, and
the account behind it was not representative. A listing that offers no
sell-or-rent action renders five buttons. An account with no credits renders
six dead circles. A tenant constant (`HIDE_INBOX`) and an account flag
(`is_lms_enabled`) between them remove two rail entries. All three went into
the design system as facts about the product.

The guard against this is not more measurement. It is **a second account**, and
that is what the SingleFile is.

## What it settled on sight

- A **studio** row labels the bed spec `Studio` and **drops the bath spec
  entirely** — two specs, not three (`staticLists.js:288` returns `''` for
  beds when the count is 0).
- The **pagination** is content-sized and pushed to the end (308 wide at
  x=1108), not a full-width row with `justify-end`.
- The first action button is **`TruCheckIcon` at 18px with a 6px inline-end
  margin** (`icons.js:922`) — which is why it measures 40 wide and the other
  five measure 36. We were drawing `HiCheck`.

## The deployed build is ahead of this checkout

The filter bar is the evidence, and it is worth stating plainly because it
limits what the source can be trusted for:

| | the real page | what `filters.js` in this checkout renders |
|---|---|---|
| Show More | 142×40, **16/700**, `#4F4F4F` | `size="small"` → 13/600, 32 tall |
| Clear filters | 74×40, 13/600 | `size="small"` → 32 tall |
| Search | 90×40, **12/700**, 12px padding | `size="large"`, `btnHeight=42` → 42 tall, 16px, 16px padding |

Three buttons in one component, all disagreeing, and the heights agreeing at
40 across all three — that is a set, deliberately restyled. The checkout is a
single import commit dated **3 Aug 2026**; the capture is **22 Sep 2026**.

So: **where the real page and the source disagree, the real page wins**, and
the values above are taken from it. The rest of the design system is still
derived from a checkout that is seven weeks behind what ships. A fresh drop of
`profolio-reactjs` is the single highest-value thing that could arrive next —
it would also let the harness boot today's product and re-capture all thirteen
states.

## What the real page cannot give

Flows. antd v5 is CSS-in-JS: a component that has never rendered has neither
markup nor styles in a snapshot. Measured on the file:

```
ant-modal   markup=0  css-rules=0
ant-drawer  markup=0  css-rules=0
ant-popover markup=0  css-rules=0
ant-tooltip markup=3  css-rules=2     ← one had opened
```

Overlays come from the harness, which opens them by clicking — and the six it
found were limited by the same fixture account. That is the next thing to fix.

## Still open

All fifteen remaining rows are one of two cascades, and neither is a value I can
source:

**Text metrics — mostly gone, and my explanation for them was wrong.** I wrote
that the product's antd `<span>` wrappers made words wrap differently. They did
not. **We were rendering in Lato and the product renders in Figtree.** Six of
the nine rows disappeared the moment that was fixed. What is left is
`filter.clear` 69 vs 71 and `filter.showmore` 120 vs 122 — two pixels each, on
the two buttons whose label is set in the browser's own metrics.

**Table column widths (4 rows).** Product `452 250 138 103 197 190`, ours
`465 240 143 99 192 190`. Both are auto-layout over the same content; only
`col-actions` (180, declared in `listingUtilities.js`) is a real number. The
product's cells wrap their content in `.mb-8` divs that claim more width in the
Timeline column. **I have not forced these with a `<colgroup>`** — transcribing
the measured widths would make the page match this one render and teach the
design system nothing.

**Page height, 1900 vs 1929 (2 rows).** The product has one row at 170px where
the location wraps to two lines (`Riyadh, North Riyadh, Al Mughrizat`); at our
column width it fits on one. Same cause as above.

## Known approximations

1. **The listing title reads `Floor for Sale | Ready`.** On live it does; in the
   harness render it reads `Floor for Sale`, because ` | Ready` is appended only
   when `purpose.slug === 'sale'` and the fixture's slug is `for-sale`. The
   fixture is wrong, not the page — `data/fixtures/listings.json` inherits it
   from the dashboard's, which was read off the live screenshot.
2. ~~**Applied upgrades have no check badge.**~~ **Closed.** It is
   `upgrade-icons.js:50` — an `HiCheck` rendered beside the circle when the
   upgrade is applied, 14×14 on `#28b16d` at −2/−2 (`styled.js:29`). Built,
   catalogued, and it brought two more measurements with it: an applied circle
   keeps its product colour at 10% with a 19px glyph while every other circle
   is `#F4F5F7` under `rgb(173,180,210)` at 16, and **all of them are
   disabled** — `platformActions.js:142` disables a circle when it is neither
   applied nor applicable AND when it is applied.
3. **The filter input's focus ring and the select's open state are TBC.**
   Nothing is focused in a capture, so neither was measured; antd's is
   `0 0 0 2px` of the primary at 10%, unverified here.
4. **`Show More` uses `MdOutlineDoubleArrow` unflipped.** The product adds its
   `.flipX` class; on the LTR harness render the glyph points right either way.

---

## What this page added to the system

Seven classes the other pages will reuse, each defined in `profolio.css` with
its source and shown in `components.html` with its states:

`.pf-filter-bar` · `.pf-filter-fields` · `.pf-field` · `.pf-field-label` ·
`.pf-input` · `.pf-select` · `.pf-filter-actions` · `.pf-table-card` ·
`.pf-tabs` · `.pf-tab` · `.pf-pagination` · `.pf-page-item`, plus two button
variants (`tint`, `link-danger`) and five sprite symbols (`FiSearch`,
`MdOutlineDoubleArrow`, and antd's own `DownOutlined` / `LeftOutlined` /
`RightOutlined`, which `scripts/icons.mjs` now extracts from
`@ant-design/icons-svg`).

The shell is no longer copied: `scripts/pages/shell.mjs` writes the rail,
header and footer once, and `scripts/pages/listings.mjs` composes the page
around it from `data/fixtures/listings.json`. The row markup is the dashboard's,
class for class, so the two tables cannot drift.

---

## A caveat about running this against the dashboard

`derive-layout.mjs --compare` will happily score `dashboard.html` and reports
**55.8%**. That number is not meaningful yet and should not be quoted. The
region table is the listings page's vocabulary — filter bar, status tabs, table
card, pager — and on the dashboard it matches the Performance widget's card and
metric tabs as though they were the listings table's, then counts our page
"missing" six regions it never had. The dashboard needs its own regions
(breakdown, credits meter, chart, account switcher) before its score means
anything. What the run does prove is that the two shared fixes — the row divider
and the button icon gap — landed on both pages.


---

## What the design QA found that the score could not

The region score was 91.7% and every number in it was right. It still missed the
largest defect in the system, because it compares the regions somebody listed
and says nothing about how they are painted.

**The whole design system was rendering in Lato. Profolio KSA paints in Figtree.**

`scripts/qa-design.mjs` crops the product's render and ours to each region and
compares them pixel by pixel. The page title came back 42.7% different — far too
much for a box that measured within 7px. The crops, side by side, showed two
different typefaces. The capture settled it: **1,698 of the 1,708 elements** in
the product compute `Figtree, "Droid Arabic Kufi", sans-serif`, and none
computes Lato.

| | |
|---|---|
| `theme/index.js:306` | antd token `fontFamily: 'Figtree, Droid Arabic Kufi, sans-serif'` |
| `useAppInit.js` | fetches Figtree + Mukta from Google Fonts whenever `!isMemberArea` |
| `useAppInit.js` | also injects `lato-font.css` for every bayut session — and nothing references Lato except `FONT_FAMILY_LITE` and the lite footer |

`kb/design/fonts.html` stated the opposite outright — *"Nothing anywhere loads
Figtree. Lato is what paints."* — and `SKILL.md` instructed the design agent
never to say Figtree. Both are corrected. So is the claim, repeated several
times, that `.fw-500` and `.fw-600` are synthesised: **Figtree is variable
300–900**, so they are real weights. That was true of Lato and never true of
what ships.

Two harness faults came out of the same thread:

- The capture **blocked Google Fonts**, so the product rendered in the system
  fallback while our page rendered in a real face. Every text width differed for
  a reason that had nothing to do with our markup. The capture now serves the
  same embedded faces `deliverables/fonts.css` carries.
- The fixture user had `settings: []`, so `push_notifications` defaulted to
  `disabled` and **the header bell never rendered in the product**. I nearly
  deleted our bell as invented. It is real and conditional
  (`header-components.js:53`); the fixture was wrong.

## The QA's own checks were vacuous, and a negative test proved it

The stylesheet checks — px literals outside `:root`, physical `left`/`right`
properties — were line-anchored regexes. Most rules in `profolio.css` are
written on one line, so `^\s*padding:` never matched them. Appending
`.pf-negative-test{padding:7px;margin-left:5px;font-size:15px}` produced **zero
findings**.

They tokenise declarations now, and the same negative test catches all three.
A check that has never failed is not evidence.

## Where it stands

| | |
|---|---|
| region score | **94.9%** — 10 disagreements, all one cascade: the auto column widths |
| shell.sider / header / title / footer | **all inside threshold, in all 13 states** |
| off-scale values | 0 |
| px literals outside `:root` | 0 |
| physical properties | 0 |
| RTL | no overflow |
| contrast | **0 ours** / 74 the product's own |
| states captured and scored | **13** |

---

# The states

`94.9%` measured one screen. A page can score that and still be useless to
walk, and this one was. Thirteen states are captured from the product now and
every one is scored the same way the default is:

| state | what it is |
|---|---|
| `modal-trucheck` `modal-delete` `modal-download-app` | row actions and the header |
| `drawer-filters` | Show More |
| `popover-notifications` `popover-account` | the header bell and avatar |
| `tab-draft` `tab-pending` `tab-removed` `tab-ad-license-requests` | every status tab |
| `loading` `error` | the query held open, and the query failing |

Reach any of them in the page with `listings.html#state=<name>`; that is also
how `qa-design.mjs` gets to them.

## What the states found that the default screen could not

**We shipped Figtree Italic.** The Google URL asks for
`ital,wght@0,300..900;1,300..900` and Google answers italic-first.
`scripts/fonts.mjs` took the first `latin` block it saw, cached it under the
upright name and wrote `font-style:normal` over it. Every page in the design
system painted in italic — and because the harness serves that same file to
the product, **both sides of every comparison were italic** and no number
moved. It took looking at a magnified crop to see it.

**The rail stays bright over a modal.** Both masks measure `z-index: 1000`
(antd's `zIndexPopupBase`) and the sider is 1002. Ours was 1050, so it dimmed
the rail: `shell.sider` read 99.4% different in every masked state. A popover
is not masked at all and the product lifts it to 99999.

**`[disabled] { opacity: 0.54 }` is a global rule** (`utils.less:142`). Three
of our components carried an invented 0.45, and the Clear filters button is
*disabled* whenever no filter is applied (`filters.js:641`) — which is the
default screen.

**The Draft tab is not the Active tab with fewer rows.** The tab is a query
parameter (`f[nested.platform_listings.status.slug]`), and each tab gets its
own column set from `listingUtilities.js:402`: Draft trades Performance for
Publish, Pending drops both, Removed carries both. The harness answered every
tab with the same ten rows until this was fixed, so **"Removed (0)" rendered
ten listings** and the empty state had never been captured at all.

**A failed query shows no error card.** `/api/surge/listings` answering 500
renders the same *No Record Found* empty state as an empty one. That was worth
capturing rather than guessing, and the page does what the product does.

**An upgrade circle is coloured only when the upgrade is applied.** Ours lit
five of six on every row.

## What the QA itself had wrong

**It compared colour channels.** The product rasterises text greyscale and we
rasterise subpixel, so every glyph edge carried orange and blue fringes:
`shell.title` read 23.8% on a region with *no* measurable disagreement — same
family, size, weight, line-height, colour and box. It compares luminance now.
The cause is a composited layer in the product's tree, not a style we are
missing: `-webkit-font-smoothing: antialiased` is a no-op in this Chromium
(781 vs 725 coloured pixels in a controlled render) while
`transform: translateZ(0)` takes it to zero.

**It ranked regions hidden behind an open overlay.** The account popover sits
on the filter buttons, and `filter.showmore` duly read 49.5% different — every
pixel of it the popover. Those are marked *behind the overlay* now, not ranked.

**It paired the wrong elements for `tabs.active`.** The product's region is the
74×22 label inside the tab; ours was the 74×46 button. 42% of that was the
button's own padding. Our markup carries a `.pf-tab-label` now, exactly as antd
carries `.ant-tabs-tab-btn`.

## Still open

- **Table column widths**, unchanged and deliberate: product `456 250 138 103
  197 190`, ours `470 240 143 99 192 190`. Both are auto-layout over the same
  content; forcing a `<colgroup>` of measured widths would match this one
  render and teach the system nothing. Page height (1892 vs 1918) follows from
  it, as does `table.cell` at 24.5%.
- `filter.clear` 13.1% and `tabs.active` 13.0% — two-pixel label widths, the
  browser's own metrics.
- The **Download App** modal body is 17.4% different because the QR and the two
  store badges are art we do not ship; they are drawn as labelled placeholders
  at the measured 166×166 and 111×33.
- Six row-action overlays (hide, unhide, booking, change owner, apply discount,
  the listing drawer) are **not built**, because they do not render for these
  fixtures and there is nothing to measure. They need the fixture backlog
  first — an overlay drawn from imagination is exactly what this method exists
  to prevent.
