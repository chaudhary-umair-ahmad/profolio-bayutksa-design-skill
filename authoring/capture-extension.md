# Profolio Capture

One click on a live Profolio screen writes everything the design system needs to
measure itself against that page.

## Install — once

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this folder

A green circle appears in the toolbar. Pin it.

## Use — once per page

1. Navigate to the screen on live. Wait for it to finish loading.
2. Click the extension, check the route, press **Capture**.

Two files land in your Downloads:

```
profolio-capture/<route>.capture.json
profolio-capture/<route>.png
```

Drop both into `data/live/` in this repo.

## What it records

Layout only:

- the element tree — tag, classes, box, depth — down to a sensible depth
- the computed styles that decide how something looks: box model, colour,
  border, type, flex and grid
- which fonts the browser resolved, and which weights it is faking
- the viewport it was captured at

## What it never records

- text content of any kind
- `value`, `placeholder`, `title`, `alt`, `aria-label`
- `href`, `src`, `srcset`, `action`
- any `data-*` attribute
- any `id`, and any class that looks like a hash or an id

The filter runs **inside the page, before anything is handed back**, so nothing
identifying reaches the download. Open the JSON before you send it — it is
readable, and you will see there is nothing personal in it.

The screenshot is a different matter: it is a picture of the screen and it shows
whatever is on it. If the account data matters, capture on a test account, or
send the JSON alone — the JSON is what the tooling actually reads.

## If the extension is awkward

`scripts/probe.js` does a smaller version of the same thing as a devtools console
paste, with nothing to install.
