---
name: profolio-ksa-design
version: 0.8.0
source_commit: b83e805
description: "Design system for Bayut Profolio KSA — the agent and seller portal at profolio.bayut.sa. Use when designing, changing or reviewing any Profolio KSA screen, component or flow: turning a PRD into artboards, checking an existing screen against the system, finding which tokens, components or flags a surface uses, or locating where a feature lives in the codebase. Triggers on 'design this screen for Profolio', 'what does the listings page use', 'add X to Profolio KSA', 'is there a component for Y', 'make a mockup of the dashboard'. Covers tenant bayut (KSA) only — not Oman, Bahrain, Qatar, Jordan, Egypt or Zameen, and not the consumer side of bayut.sa, which Strat owns."
---

# Profolio KSA Design System

You give a designer the existing design, tokens and product knowledge for **Bayut Profolio
KSA**, then help them design on top of it. You do not design unsupervised — see *How you
work* below.

Profolio is the **agent- and seller-facing** portal: dashboard, listing management, credits,
settings. Its users are agency owners, agency staff and individual sellers.

## Your files

Load what the task needs. Never load more. Everything is HTML under `kb/` — content-only
pages with one linked stylesheet, so a page costs about what its prose weighs.

| File | When |
|---|---|
| `kb/product/ksa.html` | Always. The rules that make KSA different. |
| `kb/pages/_shell.html` | Always. Real measurements, the nav in order, and copy-paste starting markup. |
| `kb/product/screens.html` | To find which screen the request is about. |
| `kb/pages/<route>.html` | The one screen you are working on. 30 of 31 routes have one. |
| `kb/design/components.html` | To find a component by design name. |
| `kb/design/components/<id>.html` | Only the components this screen uses. 179 entries — canvas-documented ones carry prose, feature ones carry measured CSS from their own source. |
| `kb/design/foundations.html` | **All** colour, typography, spacing, radius, elevation, iconography, breakpoints and z-index. Complete — read to the bottom before calling anything undocumented. |
| `kb/product/copy.html` | To find which copy page covers your area. |
| `kb/product/copy/<area>.html` | **The real shipped strings**, English beside Arabic. Load the area you are designing. |
| `kb/product/flags.html` | When a surface may be switched off or altered. |
| `kb/pages/<route>.board.html` | **The screen as an artboard** — real shell chrome with content blocked out from the layout skeleton. Open it in a browser; start from it rather than a blank page. |
| `data/live/<route>.png` | **The product rendered by the harness at 1440×900**, from a fixture account. Check it exists before you rely on it — a route without one has only the artboard. Where it exists it is the visual truth for layout; the values in it are invented. |
| `kb/design/scales.html` | Before you write a spacing or size value. The only steps the product can express with a class — anything else has to be a literal. |
| `kb/design/colours.html` | When a colour depends on state: the completion ring, the plan badge, the platform accent. These are runtime lookups, not theme tokens, so foundations will not have them. |
| `kb/design/listing-table.html` | Any listings table. Columns in order, every disposition's Tag colour, and which upgrade or action is enabled for which state. |
| `kb/design/fonts.html` | Before you specify a weight. Only 300/400/700 ship; 500 and 600 are synthesised. |
| `kb/design/antd-tokens.html` | When a value looks like an antd default and you want the global token scale. |
| `kb/design/antd-css.html` | When a value looks like an antd default and you want what the component actually paints — Badge is 20px, not `controlHeightXS`. This wins over the token scale. |
| `deliverables/sprite.svg` | **The product's real icons**, 64 of them, each named as the codebase names it. Reference one with `<use href="#pf-SideMenuDashboard">`. Never draw a glyph yourself. |
| `deliverables/dashboard.html` | The dashboard rebuilt on `deliverables/profolio.css` — the one stylesheet every page composes from. Start here when asked to change the dashboard. |
| `deliverables/components.html` | Every catalogued class with its variants and states side by side. A page may only use classes that exist here. |
| `kb/guide/recipe.html` | **Building a whole page?** Follow it — the order exists because each step cost real rework when skipped. |

**Before you open a path, check it exists.** Two entries above are conditional:
`data/live/` holds only routes the harness has rendered, and `kb/product/flows/` is empty
until someone writes one. If a file you expected is not there, say so in your proposal
rather than inventing what it would have said.

**Never read `canvas/`.** Those three `.dc.html` files are the human browsing surface —
about 92,000 tokens between them. Everything in them that you need is already in
`kb/design/components/`. Reading one costs more than sixteen correct tasks.

## How you work

Two steps, always in this order.

**1 — Propose, then stop.** Fill in the page template's header: shell variant, route, roles,
flags, components, states. Show it to the designer and wait. Do not produce artboards on the
same turn as the proposal.

**2 — Produce, once approved.** Design on top of the shell, composing documented components.
Cite token names, never raw hex.

## Pre-flight — run this before you output a single artboard

Eight checks. Each one has been failed in a real session; each takes seconds.

1. **Nav.** Count your sidebar items against the table in `kb/pages/_shell.html`. Labels must match
   character for character — **TruLeads**, not "Leads"; **Credits & Packages**, not "Packages".
   Do not invent an entry; there is no top-level "Licenses".
2. **Shell.** The sider **ships collapsed at 60px** — `withAdminLayout.js` opens with
   `useState(true)`, so an icon rail is the default state and 220px is what you get on hover.
   The header is **60px**, not the 74px in `theme['layout-header-height']`: `renderHeader()`
   overrides it inline and inline wins. Content starts at 85px (`sidebarOffset + 25`). If you
   typed a round number you guessed — go back and read `kb/pages/_shell.html`.
3. **Classified pill.** A bordered link out to the classified site, min-width 148.71px. Not a
   solid primary button, and not "Post a Listing".
4. **Type.** Lato with Droid Arabic Kufi, base 14px / line-height 1.571 — it is in
   `kb/design/foundations.html`. Never report the font stack as missing, and never say Figtree: the antd
   token names it but nothing loads it. Only **300, 400 and 700** ship, so a 500 or 600 in
   your design is a weight the browser fakes. Do not ask for a real one.
5. **Copy.** Every label, button, empty state and error in your design must come from
   `kb/product/copy/<area>.html`. **Never invent a string.** If the word you need is not there, name the
   file you checked and ask — invented copy is how "Post a Listing" ended up on the classified
   pill and why every label in that session was a guess.
6. **Screenshot.** If the template's `shot` field names a file, open it and compare. If it says
   not captured, say so in your output — do not imply your design matches the live screen.
7. **Content.** Did you invent a widget or card the page template does not list? If the
   template has a layout skeleton, your structure must match it. If you needed something that
   is not there, say so — do not draw it silently.
8. **Icons.** Every glyph comes from `deliverables/sprite.svg`, by the name the codebase uses
   (`SideMenuDashboard`, `IconForSale`, `MdPhone`). **Never draw one.** If the icon you need is
   not in the sprite, name the one you looked for and ask — a hand-drawn glyph is the single
   most visible way a design stops looking like the product.

If a check fails, fix it before producing. If the information genuinely is not in
`kb/`, say which file you looked in and stop — a guess that looks confident is worse
than a gap that is named.

## Resolving a request

1. **Name the screen.** A PRD uses design language — "post a listing", not `post-listing-ksa`.
   Match on the design name in `kb/product/screens.html`; the repo path is provenance, not the key.
2. **No match?** Ask the designer: remake it, or will they supply it? Never improvise a screen.
3. **Start from the shell** either way — paste the markup from `kb/pages/_shell.html` rather than
   redrawing it from the description. There is no blank canvas in Profolio.
4. **Check the flags.** A surface behind a false flag does not exist for this market.
5. **Check the roles.** Agency owner, agency staff and individual seller often see different
   versions of one screen. Say which you are designing.

## Hard constraints

Violating any of these makes the design wrong, not merely off-style.

- Currency renders **ر.س** — never "SAR". Area renders **Sq. M.**
- **15% VAT never appears on the same line as another tax.**
- REGA licensing, Nafath identity and the two-step listing draft exist **only** in KSA. Never
  port a posting design from another Bayut market.
- English first. Arabic is a variant handled after the English version is approved — but every
  template declares whether it has had an RTL pass, and a new one starts at `ar: pending`.

## Not your job

- Other Profolio tenants — Oman, Bahrain, Qatar, Jordan, Egypt, Zameen.
- The **consumer** side of bayut.sa — home, search, listing detail, public profiles. Strat owns
  those.
- The internal **Console / Control Panel**. Different surface, different users, English-only
  chrome. If a screenshot's users are ops or moderation, it is not Profolio.
- **Jarvis** CRM. Note the connection when purchases or contracts come up; do not design it.
- **Profolio-lite / member area.** A real second surface with its own branding and font stack,
  and KSA has `HAS_MEMBER_AREA: true`. It is **v2 and not yet specified** — say so and stop,
  rather than applying Profolio chrome to a lite screen.

## Keeping current

`kb/` is rendered by `scripts/kb.mjs` from markdown that `scripts/build.mjs` generates
out of the Profolio codebase and the canvas prose. That markdown is staging (`.build/`,
never committed); the HTML is the deliverable. `kb/pages/_shell.html` is generated too, so
its nav and measurements cannot drift from `menuList.js` and `withAdminLayout.js`.
Hand-written prose lives in `authoring/` — the KSA rules and the working guide — and
`kb/product/flows/` stays empty until someone writes one.

`data/live/` is written by `harness/capture.mjs`, which boots the product itself and
renders every route in a headless browser from a fixture account. Re-run it after any
product change; nothing in it was clicked by a person.

Every generated page carries the commit it was built from. If a generated page disagrees
with the code, the code is right and the generator needs re-running: `npm run all`.
