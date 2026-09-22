# Profolio KSA — design system

The design system and product knowledge base for **Bayut Profolio KSA**, the agent and
seller portal at profolio.bayut.sa, packaged as a Claude skill.

Everything a reader needs is HTML. Start at **`kb/index.html`**.

| Path | What |
|---|---|
| `SKILL.md` | The router for the agent. Small on purpose. |
| `kb/` | **The knowledge base.** Product (KSA rules, screens, flags, copy) and design system (foundations, tokens, components), plus a page per route and the working guide. Generated; content-only HTML with one linked stylesheet. |
| `deliverables/` | `profolio.css` — the one stylesheet; `components.html` — every class with its states; `dashboard.html` — the dashboard composed from it; `sprite.svg` — the product's icons. |
| `data/` | Machine inputs the build consumes, not documents: `antd-css.json`, `fixtures/`, and `live/` — the product rendered route by route by the harness. |
| `harness/` | Boots the product itself in this sandbox and captures every route in a headless browser from a fixture account. `npm run harness:install`, then `npm run harness:capture`. |
| `authoring/` | The only hand-written prose: the KSA rules and the working guide. Rendered into `kb/`. |
| `scripts/` | The generators. `npm run all` rebuilds everything and runs the checks. |
| `tools/profolio-capture/` | A Chrome extension that captures a live page's layout, for when a real screen needs measuring. |
| `canvas/` | The three `.dc.html` design files — human browsing only, ~92,000 tokens. |

`npm run check` fails when a path `SKILL.md` routes to does not exist, when a `kb/` page
inlines a style, when `profolio.css` disagrees with what antd paints, or when the skill's
antd is not the version the product's lockfile pins.
