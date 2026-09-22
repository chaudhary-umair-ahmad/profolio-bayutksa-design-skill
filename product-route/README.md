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

## Using it

1. Open `/<lang>/design-capture` on staging (or locally).
2. Save the page with SingleFile.
3. `node scripts/measure-real.mjs <file> --route design-capture`

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
