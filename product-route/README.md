# `/design-capture` — a route in the product, for measuring the product

Three files. One new, two one-line registrations. Nothing else imports it, and
it never registers in production.

## Why a route, and not more captures of real screens

A saved copy of a real screen has two limits that no amount of capturing fixes:

1. **It shows only the states that account happens to have.** A listing with no
   discount offer renders five row actions; an account with no credits renders
   six dead upgrade circles. Both of those went into this design system as
   rules about the product, from honest measurements of an unrepresentative
   account.
2. **It contains no flows.** antd v5 is CSS-in-JS, so a component that has never
   rendered has neither markup nor styles in the page. Measured on a real
   saved screen:

   ```
   ant-modal    markup=0  css-rules=0
   ant-drawer   markup=0  css-rules=0
   ant-popover  markup=0  css-rules=0
   ant-tooltip  markup=3  css-rules=2   ← one had opened
   ```

This route renders **every component in every state**, with the real theme, the
real antd and the real styled-components — and renders the overlays **inline**,
so their markup and their generated CSS are in the page. Save it once and the
whole vocabulary comes across.

It is a **public** route: no login, no account, no data. It cannot show anyone's
information, which is also why it is safe to save and hand over.

## The patch

**1. Add the page** — `src/container/pages/design-capture/DesignCapture.js`
(the file beside this README; copy it in).

**2. Export it** — `src/container/index.js`

```diff
+import DesignCapture from './pages/design-capture/DesignCapture';

 export const PublicPages = {
   PaymentProcess,
   Maintenance,
   PostAd,
   EventCheckoutPage,
+  DesignCapture,
 };
```

**3. Register it** — `src/tenant/common/routes/appRoutes.js`

```diff
 const publicRoutes = () => [
+  /* A page that exists to be measured: every component in every state, with
+     the real theme and the overlays rendered in place. Never in production. */
+  ...(process.env.REACT_APP_ENVIRONMENT !== 'production'
+    ? [{ path: '/design-capture', Component: 'DesignCapture' }]
+    : []),
   { path: '/content/process-payment', Component: 'PaymentProcess' },
```

To remove it: delete the file and those two hunks. There is nothing else.

## Verified

Applied to a checkout and loaded at `/en/design-capture` in the running app:

```
mounted   true          no login, no redirect
specs     21            data-spec sections
buttons   52            real .ant-btn, real theme
modal     2  inline     .ant-modal present in the DOM, with its CSS
drawer    1  inline
popover   1  inline
```

## The second route: `/design-capture/flows`

`DesignCaptureFlows.js`, registered the same way. Where the first route renders
the component vocabulary, this one renders **the My Listings flows** — the real
modals and drawers, mounted from the same files the table mounts them from and
opened through the same refs the row actions use.

The inventory is the product's, not a guess. `listing-row-actions.js:89` gives
a row exactly six things to do:

| ref method | what it opens | here |
|---|---|---|
| `showDeleteListingModal` | ConfirmationModal + the reason list | ✅ renders |
| `trucheckModal` | TruCheckModal | ✅ renders |
| `showBookingModal` | BookingModal (daily-rental only) | ✅ renders, portalled |
| `showListingDetail` | ListingDrawer | ✅ renders, portalled — in its loading state, since there is no server |
| `showEditListingPage` | navigates to `/post-listing/:id` | not an overlay |
| `showListingOnClassified` | opens the classified site | not an overlay |

Two caveats worth knowing before you save:

- **`getContainer={false}` only works where the wrapper forwards it.**
  ConfirmationModal and TruCheckModal do, so they sit inside their own section.
  BookingModal and ListingDrawer do not, so antd portals them to `<body>` and
  they float over everything. They are still completely captured — markup and
  generated CSS are in the file either way — but they cover the rest of the
  page. Use `?only=<name>` to render one at a time:

  ```
  /design-capture/flows                             all of them, one save
  /design-capture/flows?only=booking                just that one, clean
  /design-capture/flows?only=listing-detail-drawer
  ```

- **Each specimen has its own error boundary.** These components expect a
  listing, a store and an API; here they get a static item and no server. One
  that fails says so in place and the rest of the page still saves.

## Using it

1. Open `/<lang>/design-capture` on staging (or locally) — save with SingleFile.
2. Open `/<lang>/design-capture/flows` — save.
3. Then `?only=booking` and `?only=listing-detail-drawer` — save each.
4. Send the files. `node scripts/measure-real.mjs <file> --route design-capture`
   walks each one.

Each specimen carries `data-spec="<name>"` — `button/primary`, `modal/default`,
`drawer/right`, `round-action/states`. That attribute is the contract: a
specimen can move on the page without breaking the measurement.

## What it deliberately does not do

- **No data.** No API calls, no redux, no listing rows. Screens with data stay
  the job of the harness, which boots the product against fixtures.
- **No styling of its own.** The page frames specimens in monospace labels and
  hairlines and paints nothing else, so no value on it can be mistaken for the
  product's.
- **One known measurement caveat.** Each overlay section is a composited layer
  (`transform: translateZ(0)`) so that a `fixed` overlay is confined to its own
  box instead of stacking in the middle of the viewport. A composited layer
  also makes the browser rasterise text greyscale rather than subpixel — which
  is what the product's own screens do anyway, and what the design QA already
  compares for.
