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

Load what the task needs. Never load more.

| File | When |
|---|---|
| `references/tenants/ksa.md` | Always. The rules that make KSA different. |
| `references/pages/_shell.md` | Always. Real measurements, the nav in order, and copy-paste starting markup. |
| `references/pages/index.md` | To find which screen the request is about. |
| `references/pages/<route>.md` | The one screen you are working on. 30 of 31 routes have one. |
| `references/components/index.md` | To find a component by design name. |
| `references/components/<id>.md` | Only the components this screen uses. 179 entries — canvas-documented ones carry prose, feature ones carry measured CSS from their own source. |
| `references/foundations.md` | **All** colour, typography, spacing, radius, elevation, iconography, breakpoints and z-index. Complete — read to the bottom before calling anything undocumented. |
| `references/copy/index.md` | To find which copy file covers your area. |
| `references/copy/<area>.md` | **The real shipped strings**, English beside Arabic. Load the area you are designing. |
| `references/flags.md` | When a surface may be switched off or altered. |
| `references/pages/<route>.board.html` | **The screen as an artboard** — real shell chrome with content blocked out from the layout skeleton. Open it in a browser; start from it rather than a blank page. |
| `references/data/scales.md` | Before you write a spacing or size value. The only steps the product can express with a class — anything else has to be a literal. |
| `references/data/colours.md` | When a colour depends on state: the completion ring, the plan badge, the platform accent. These are runtime lookups, not theme tokens, so `foundations.md` will not have them. |
| `references/data/listing-table.md` | Any listings table. Columns in order, every disposition's Tag colour, and which upgrade or action is enabled for which state. |
| `references/data/fonts.md` | Before you specify a weight. Only 300/400/700 ship; 500 and 600 are synthesised. |
| `references/tokens/antd.md` | When a value looks like an antd default — Table padding, Badge, Progress, dividers, disabled states. Those are computed at runtime, not declared, and this is them resolved. |
| `deliverables/sprite.svg` | **The product's real icons**, 64 of them, each named as the codebase names it. Reference one with `<use href="#pf-SideMenuDashboard">`. Never draw a glyph yourself. |
| `references/screens/<route>.png` | **The live screen, if one has been captured.** Check it exists before you rely on it — `references/screens/` is empty until someone runs a capture, and most routes have none. When there is no screenshot, the artboard plus the page template is what you have. |

Every `.md` also has an `.html` beside it for people to read in a browser. **You read the
`.md`** — the HTML is the same content and costs roughly three times as much.

**Before you open a path, check it exists.** Two entries above are conditional:
`references/screens/` is populated only by a capture, and `references/flows/` is empty
until someone writes one. If a file you expected is not there, say so in your proposal
rather than inventing what it would have said.

**Never read `canvas/`.** Those three `.dc.html` files are the human browsing surface —
about 92,000 tokens between them. Everything in them that you need is already in
`references/components/`. Reading one costs more than sixteen correct tasks.

## How you work

Two steps, always in this order.

**1 — Propose, then stop.** Fill in the page template's header: shell variant, route, roles,
flags, components, states. Show it to the designer and wait. Do not produce artboards on the
same turn as the proposal.

**2 — Produce, once approved.** Design on top of the shell, composing documented components.
Cite token names, never raw hex.

## Pre-flight — run this before you output a single artboard

Eight checks. Each one has been failed in a real session; each takes seconds.

1. **Nav.** Count your sidebar items against the table in `_shell.md`. Labels must match
   character for character — **TruLeads**, not "Leads"; **Credits & Packages**, not "Packages".
   Do not invent an entry; there is no top-level "Licenses".
2. **Shell.** The sider **ships collapsed at 60px** — `withAdminLayout.js` opens with
   `useState(true)`, so an icon rail is the default state and 220px is what you get on hover.
   The header is **60px**, not the 74px in `theme['layout-header-height']`: `renderHeader()`
   overrides it inline and inline wins. Content starts at 85px (`sidebarOffset + 25`). If you
   typed a round number you guessed — go back and read `_shell.md`.
3. **Classified pill.** A bordered link out to the classified site, min-width 148.71px. Not a
   solid primary button, and not "Post a Listing".
4. **Type.** Lato with Droid Arabic Kufi, base 14px / line-height 1.571 — it is in
   `foundations.md`. Never report the font stack as missing, and never say Figtree: the antd
   token names it but nothing loads it. Only **300, 400 and 700** ship, so a 500 or 600 in
   your design is a weight the browser fakes. Do not ask for a real one.
5. **Copy.** Every label, button, empty state and error in your design must come from
   `copy/<area>.md`. **Never invent a string.** If the word you need is not there, name the
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
`references/`, say which file you looked in and stop — a guess that looks confident is worse
than a gap that is named.

## Resolving a request

1. **Name the screen.** A PRD uses design language — "post a listing", not `post-listing-ksa`.
   Match on the design name in `pages/index.md`; the repo path is provenance, not the key.
2. **No match?** Ask the designer: remake it, or will they supply it? Never improvise a screen.
3. **Start from the shell** either way — paste the markup from `_shell.md` rather than
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

`references/` is generated by `scripts/build.mjs` from the Profolio codebase and the canvas
prose. `pages/_shell.md` is generated too, so its nav and measurements cannot drift from
`menuList.js` and `withAdminLayout.js`. Hand-written: `tenants/`. Empty until someone
writes one: `flows/`.
Every generated file carries the commit it was built from. If a generated file disagrees with
the code, the code is right and the generator needs re-running.
