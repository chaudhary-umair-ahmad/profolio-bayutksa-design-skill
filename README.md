# Profolio KSA Design System

Design system and Claude skill for **Bayut Profolio KSA** — the agent and seller portal at
profolio.bayut.sa.

## Layout

| Path | What |
|---|---|
| `SKILL.md` | The router. Small on purpose — it decides what gets loaded, and loads nothing else. |
| `references/tenants/ksa.md` | Hand-written. REGA, ر.س, VAT, roles, scope boundaries. |
| `references/pages/_shell.md` | Hand-written. The shell every screen starts from, and its four variants. |
| `references/**` (rest) | **Generated.** Screens, components, flags, tokens. |
| `scripts/build.mjs` | The generator. |
| `canvas/` | The three `.dc.html` design files — **human browsing only.** |

## Previewing the canvas

Open any `canvas/*.dc.html` in a browser. **It needs internet access on first load** —
`support.js` fetches React 18.3.1 from unpkg and the fonts from Google Fonts at runtime, and
renders blank without them. Keep `support.js` and `public/` alongside the HTML; moving a single
file out on its own gives a blank page.

To make it work offline, download React and ReactDOM UMD builds into `canvas/vendor/` and add
them as `<script>` tags above `support.js` in each file — it uses `window.React` when present
instead of fetching.

## The canvas files are not for the agent

`canvas/` is ~92,000 tokens. Everything an agent needs from it is already extracted into
`references/components/`, at roughly 116 tokens per component. A routed task costs about 6,000
tokens; reading the canvas costs fifteen times that. `SKILL.md` says never to read it — keep it
that way, and keep it outside `references/`.

## Regenerating

```sh
node scripts/build.mjs --repo ../profolio-reactjs-copy
```

Reads the Profolio codebase and the canvas prose; writes the generated half of `references/`.
Hand-written files are never touched. Every generated file is stamped with the commit it came
from.

In CI this runs on merge to main in the code repo and pushes the result here, so the system
tracks the code instead of ageing away from it.
