# The harness: rendering the product here

The live site and your browser are both unreachable from the sandbox, so the
harness runs **the product itself**: it installs the app's own dependency tree
from the committed lockfile, boots its Vite dev server, signs a headless
Chromium in with a fixture account, answers every API call from invented data,
and runs the capture extension's page script on each route.

```
npm run harness:install      # once — rewrites the lockfile host to public npm, stubs the one private package
npm run harness:capture      # every route → data/live/<route>.capture.json + <route>.png
node harness/capture.mjs --routes dashboard,listings --rtl
node harness/serve.mjs       # keep the app up to look at a page by hand: http://127.0.0.1:3000/en/dashboard
```

Three things had to be true for this to work, and each is checked rather than
assumed: the installed antd is the version the product's lockfile pins;
`REACT_APP_ENVIRONMENT=development` so the Keycloak branch never runs; and
`REACT_APP_BASE_URL` names the local origin, or `onLanding` redirects the page
to itself every three seconds.

**What a harness render is not:** production. Dev-mode React, no CDN, every
server flag at its default, fixture numbers. It answers what only a browser can
— painted heights, stroke widths, row heights — and where the source declares a
value, the source still wins.

## What the product asks the network for, and what it needs back

Traced through the source, not observed on live. Every URL is relative because
`REACT_APP_API_ENDPOINT` is empty in the harness, so Playwright's `page.route`
answers all of them on the same origin. The trap that runs through the whole
API: **URLs and redux keys say `ksa`, response bodies say `bayut`.**

## Bootstrap — every authenticated route

| call | need | if missing |
|---|---|---|
| `GET /api/surge/users/current` ×2 | `{ user: {…}, banners: [] }` — see below | **full-page spinner forever** (router.js:31) or the Error/Retry card |
| `GET /api/surge/products` | `{ products: [] }` | falls back to static `tenantData.products` — harmless |
| `GET /api/surge/agencies/{id}` | `{}` | only when `agency_admin && agency.id` |
| `GET /api/surge/notifications/stats` | `{ stats: { unseen: 46 } }` | badge shows 0 |
| `GET /api/surge/lms/leads/stats` | `{ stats: { unseen_leads_count: 0 } }` | tolerant |
| `GET /api/surge/users/{id}`, `/languages`, `/area_units`, `/experience_list` | `{}` | header avatar menu, tolerant |

### The user object — fields the app branches on

- `id` — gates every downstream query (`skip: !user?.id`)
- `is_package_user: true` — else member-area mode and a hard redirect off localhost
- `platform_mapping: { bayut: { mapped: true, external_id, platform_id: 1 } }` —
  **without `mapped: true` the performance chart never renders and every listing
  row has empty Performance / Status / Actions cells, with no error anywhere**
- `credit_user: true` → `/credits/summary` instead of `/dashboard/qc_summary`; adds the Timeline column
- `agency_admin` + `agency: { id, name }` → agency dropdown, `/agencies/{id}` call
- `is_lms_enabled`, `is_call_tracking_enabled`, `is_whatsapp_tracking_enabled` → two extra LMS calls
- `profile_completion: { score }`, `credits.bayut.{allocated,available,used,expiring,current_package}`

## `/dashboard`

| call | shape | if wrong |
|---|---|---|
| `GET /api/surge/listings/summary?…` | `{ summary: { active: 12, draft: 2, … } }` | **throws** on `Object.keys(undefined)` → red Error empty state |
| `GET /api/surge/listings?…` | `{ listings: […], pagination: {…}, statuses_and_dispositions: [{ id, slug, name }] }` | `[]` is fine — illustrated empty state |
| `GET /api/surge/ovation/stats?…` | `{ stats: { items: [{ ad_external_id, sum_view_count, … }] } }` | Performance cells spin forever; only fires when the list is non-empty |
| `GET /api/surge/dashboard/listing_stats?…` | `{ stats: { ksa: { active, sale, rent, daily_rental, 'hot-listing', 'basic-listing' } } }` | **`stats.ksa`, not `stats.platforms.bayut`** — bayut's transformer overrides common's |
| `GET /api/surge/credits/summary?…` | `{ credits_summary: { bayut: { available, used, allocated, expiring, product_wise: [], current_package } } }` | keyed `bayut` |
| `GET /api/surge/ovation/stats/trends?…` | `{ stats: { aggregates: { sum_search_count, sum_view_count, sum_lead_count, … }, trends: {…} } }` | all optional, render 0 |
| `GET /api/surge/ovation/stats/product_stats?…` | `{ stats: { items: { 'YYYY-MM-DD': { sum_search_count, … } } } }` | **object keyed by date, not an array** — an array throws inside `fillMissingDates`; all-zero hides the canvas behind a placeholder |

The report window is the last 30 days from `Date.now()`. Fixture dates are
generated relative to today, or the chart is empty.

## `/listings`

`/statuses?search_class=trucheck` → `{ statuses: [] }`; then the same
`listings/summary` + `listings` + `ovation/stats` as above; plus
`/ad_license_requests?…` → `{}` (always fired, ignored off the ad-license tab).

## Listing row — practical minimum

`id`, `price`, `location: { title, breadcrumbs: [{ level, title }] }`,
`images: [{ main: 1, sizes: { thumbnail, medium, large, full } }]`,
`listing_category: { id, name, purpose_hash: { id, slug, name } }`,
`area_unit: { value, name, id }`,
`platform_listings: [{ status: { slug, name }, disposition, posted_at, expiry_date, products_information: [{ slug, is_applied }] }]`,
`expiry_days`, `posted_by`.

## Not HTTP

- localStorage `tapTargets = { lms: { introModal: { hide: true } } }` — or a
  full-screen LMS intro modal covers the first dashboard paint
- cookie `byt_cd=<anything>` — in development `KC_ENABLED` is false and the
  cookie alone satisfies the guard
- MoEngage registers a service worker and asks for notification permission on
  any environment — block `**/*moengage*`
- `index.html` loads checkout.com and a cdnjs stylesheet; `useAppInit` loads
  Google Fonts for the member area — all blocked, none feed page data
- No websocket, no SSE, no remote config. Sentry and GA are production-only.
- There is no FEEDBACK widget in this codebase. Whatever the live screenshot
  showed at the right edge is injected outside this repo.

## Failure modes, so partial mocking is safe

Only `users/current` is all-or-nothing. Every widget has its own error state
(`EmptyState` with the error string) and its own empty state. An **aborted or
hanging** request pins a skeleton indefinitely; a **200 with `{}`** lands in a
localised empty state. So the harness answers everything, never aborts an
`/api/` call.
