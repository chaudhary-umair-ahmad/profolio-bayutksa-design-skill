# Building a page, repeatably

The dashboard took several passes and most of the cost was rework: values read
off a screenshot that were declared in the codebase all along, and fixes that
landed in a generated file but never reached the page. This is the order that
avoids both.

It is written to be followed by a person or an agent. Every step is either a
command or a question with a file that answers it.

---

## 0 · Before anything

```
npm run all          # icons, fonts, antd tokens, layers, references, check
```

If `check` fails, stop. It means a routed path is missing or an embedded asset
has drifted, and everything downstream would inherit that.

---

## 1 · Read, don't look — in this order

Roughly ninety per cent of what a page needs is declared somewhere. The first
dashboard pass read the component layer and stopped, which is how sixteen values
ended up marked "cannot tell" when twelve of them were in files nobody opened.

| Question | File |
|---|---|
| What renders, in what order, under what condition? | the page container in `src/container/pages/<route>/` |
| What is the shell? | `references/pages/_shell.md` |
| Which components, with which props? | `references/components/<id>.md` |
| What are the real strings? | `references/copy/<area>.md` |
| What spacing and size steps exist? | `references/data/scales.md` |
| What colour depends on state? | `references/data/colours.md` |
| What are the table's columns and rules? | `references/data/listing-table.md` |
| Which weights actually ship? | `references/data/fonts.md` |
| Is this value an antd default? | `references/tokens/antd.md` |
| Is the surface behind a flag? | `references/flags.md` |

**Read the page container first and all the way through.** It is the only thing
that tells you what is conditional. On the dashboard, three widgets in the
original build do not render for the captured account at all — they are gated on
`tru_broker_start_date` and on a non-empty `banners` array.

### Four layers that are easy to miss

They are easy to miss because they are not components:

- `src/tenant/<t>/data/` — colour maps keyed on API strings
- `src/static/less/utils.less` — the real scales
- `src/tenant/<t>/utils/` + `src/components/table/` — columns, states, enable rules
- `src/hooks/useAppInit.js` — what the browser is actually given

`scripts/extract-layers.mjs` distils these into `references/data/`. If a page
needs something none of them covers, extend that script rather than reading the
source by hand — otherwise the next page pays the same cost again.

---

## 2 · Icons, never by hand

```
npm run icons
```

Add the component names the page uses to `WANTED` / `REACT_ICONS` in
`scripts/icons.mjs`. They are named in the transformer or the component that
renders them — search for `icon:` near the data you are rendering.

Hand-drawn glyphs are the single most visible way a page stops looking like the
product. The extractor reports anything it cannot resolve rather than dropping it
silently, so an empty result is loud.

Two traps it now handles, both of which produced blank or wrong glyphs:

- react-icons paints through `IconBase`, which puts `fill`, `stroke` and
  `stroke-width` on the `<svg>`; each set adds its own there too. Carry them.
- A colour prop with a literal default is intent, not a placeholder. Baking
  `currentColor` over it makes the glyph inherit whatever it lands in.

Art with a `<mask>` goes to `inline-art.html` instead of the sprite, because a
mask stops resolving once the art is instanced.

---

## 3 · Compose

Only classes that exist in `components.html`. If the page needs something new:

1. add it to `profolio.css` with a comment naming the file it came from
2. add it to `components.html` with its variants and states side by side
3. then use it

Doing it in the other order is how a stylesheet grows values nobody can trace.

Anything you cannot source gets a `TBC` marker with what you need and where it
lives — **never a plausible number**. A visible gap is worth more than a
confident guess, because a guess is indistinguishable from a fact six weeks later.

---

## 4 · Sync and check

```
npm run sync && npm run check
```

`sync` pushes the sprite and inline art into the pages that embed them. This
step exists because skipping it silently cost four rounds of icon fixes: they
landed in `deliverables/sprite.svg` and the page kept rendering the old copy.

`check` enforces: every routed path exists, every `var()` resolves, no raw colour
or style attributes outside `:root`, every icon reference present, every class
defined, no embedded asset stale.

---

## 5 · Measure against live

```
# on the live screen:      paste scripts/probe.js into the console
# on deliverables/<page>:  paste the same script
# save both to references/live/<route>.<side>.probe.json
npm run diff
```

You get every property where the two disagree, worst first, and one weighted
number. Shell and type count triple because getting those wrong moves everything
else; the third-party widget counts a quarter because it is not ours.

Then:

```
node scripts/reconcile.mjs      # fold the live values into profolio.css
```

Each rewritten token is stamped with where the number came from and when.
Anything the probe cannot speak to keeps its `TBC`.

### Add the page's own targets

`TARGETS` in `scripts/probe.js` carries two selectors per entry — antd's on live,
ours on the reproduction. Add the components your page introduces. Without the
second selector the probe finds nothing on our side and the diff is empty, which
looks like success.

---

## 6 · Look at it last

Screenshot the page and compare regions against live. By this point most defects
are already caught, and the eye is only useful for the ones no measurement
covers: something in the wrong place, something missing, something that reads
wrong.

Write the findings into `deliverables/qa-<route>.md` with the same three
headings: fixed, still open, known approximations.

---

## The order matters

Each step exists because skipping it cost real rework on the dashboard:

| Skipping | Cost |
|---|---|
| reading all four layers | 12 values marked "cannot tell" that were declared |
| reading the page container fully | three widgets built that never render |
| extracting icons | every glyph hand-drawn and visibly wrong |
| `sync` | four rounds of icon fixes that never reached the page |
| `check` | `SKILL.md` routing the agent at a directory that does not exist |
| the probe | no way to tell 75% from 95% except by argument |

---

## What "done" means

- `npm run check` passes
- `npm run diff` reports a score, and every row above the third-party noise is
  either fixed or written down
- every `TBC` names what is needed and where it lives
- `deliverables/qa-<route>.md` exists
- the page composes only catalogued classes, and the catalogue gained whatever
  the page needed

---

## Appendix · capture, in practice

```
tools/profolio-capture/        load once at chrome://extensions
references/fixtures/<route>.json   invent the data, keep the shapes
references/live/<route>.capture.json   what the extension writes
```

**Never commit a page built from a real account.** Compose from a fixture whose
strings are the same length as the real ones — a two-word agency name where the
real one is two words, an eight-digit Bayut id where the real one is eight
digits — so the layout you are checking is the layout that ships. The dashboard's
fixture is the worked example.

The capture itself carries no account data by construction, and
`npm run test-capture` asserts that. The screenshot does; capture on a test
account if it matters, or send the JSON alone.
