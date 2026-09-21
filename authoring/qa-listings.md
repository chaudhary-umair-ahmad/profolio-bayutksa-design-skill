# QA — `/listings` against the harness render

**Score: 91.7%** — 15 disagreements out of 351 weighted checks, 28 regions found
in the product and 27 in ours. `data/layout/listings.score.json` carries the
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

## Still open

All fifteen remaining rows are one of two cascades, and neither is a value I can
source:

**Text metrics (9 rows).** `shell.title` 110 vs 103, `filter.clear` 72 vs 78,
`filter.showmore` 122 vs 125, `tabs.nav` 526 vs 521. Our text is laid out by the
same Lato faces at the same sizes, but the product's buttons carry antd's
`<span>` wrappers and ours do not, so a word wraps a fraction differently. The
knock-on is the filter fields: our actions column is ~7px wider, so each of the
four fields is 241.2 instead of 242.9.

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
2. **Applied upgrades have no check badge.** The product draws a small green
   tick on an applied upgrade circle; neither page does. It is in
   `table-actions.js` and not yet catalogued.
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
