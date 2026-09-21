# Live probes

This directory is where a measurement of the real screen lands. It is empty
until someone takes one — nothing here is generated from the codebase.

## Why

Almost everything about Profolio KSA is in its source, and the generator pulls
it out. A short list is not, at any level: the chart's painted canvas height,
the antd Progress stroke width, a table row's height, and the third-party
FEEDBACK widget. Those values only exist once a browser has laid the page out.

## Taking one

1. Open the screen on live.
2. Open devtools, paste the whole of `scripts/probe.js` into the console.
3. It copies a JSON blob to your clipboard. Save it here as
   `<route>.live.probe.json` — for example `dashboard.live.probe.json`.

The probe reads **layout and computed style only**: box sizes, padding,
colours, font metrics, and the font families the browser resolved. It never
reads text, values, names or ids, so nothing about the account leaves the
browser. The file is short enough to read before you send it.

## Using one

```
node scripts/reconcile.mjs --dry     # what would change
node scripts/reconcile.mjs           # fold it into profolio.css
```

Each token it rewrites is stamped with where the number came from and when.
Tokens the probe has nothing to say about are left alone, `TBC` and all — a gap
that stays visible is the point of the marker.

## Measuring fidelity

Every probe target carries two selectors: one for the live app, one for
`deliverables/dashboard.html`. Probe both, save the second as
`<route>.ours.probe.json`, then:

```
node scripts/reconcile.mjs --diff
```

It reports every property where the two disagree, worst first, and one weighted
number at the end. The shell and type count triple, because getting those wrong
moves everything else; the feedback widget counts a quarter, because it is not
ours. That number is the honest version of "about 75%".
