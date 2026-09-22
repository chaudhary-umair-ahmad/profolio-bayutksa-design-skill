# My Listings — every interactive element

The definition of done for `deliverables/listings.html`. One row per interactive
element the **product** renders on `/listings` for Bayut KSA. Nothing is
complete until every row is built-and-measured or marked N/A with a reason.

This file exists because four design "rules" in this system turned out to be one
account's accidents promoted to rules — five row actions, all-disabled upgrade
circles, popover radius 10, drawer head 91. A prose list of "still open" items
could not catch that. A row-per-element list with a *source* column and a
*measured from* column can: an unsourced row is a guess, an unmeasured row is a
drawing.

**Source** is the `file:line` in `profolio-reactjs` that decides the behaviour —
paths relative to that repo's `src/`.

**Our state**

| mark | meaning |
|---|---|
| `built` | in `listings.html`, reachable, sized from a capture |
| `stub` | renders and goes to `not-built.html?screen=…` — correct for a navigation |
| `dead` | renders and does nothing. The failure this file exists to count |
| `missing` | the product renders it and we do not render it at all |
| `N/A` | verified absent from this screen for KSA. A finding, not a gap |

**Measured from** names the capture file behind our values, or `unmeasured`.
`—` means nothing to measure (a link, or an N/A row).

---

## A · Shell — rail, header, shell overlays

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| rail items ×9 | navigate | `tenant/bayut/routes` | stub | `listings.capture.json` |
| rail · language switcher | switches locale | shell | dead | `listings.capture.json` |
| rail · Help & Support | opens support | shell | dead | `listings.capture.json` |
| header · Download App | opens QR modal | shell | built → `modal-download-app` | `listings--modal-download-app` |
| header · Go to Bayut.sa | external, new tab | shell | dead (`href="#"`) | — |
| header · Post Listing | navigates `/post-listing` | `post-listing-button.js:11-21` | dead | — |
| header · bell | opens notifications popover | shell | built → `popover-notifications` | `listings--popover-notifications` |
| header · avatar | opens account popover | shell | built → `popover-account` | `listings--popover-account` |
| notifications · Refresh | refetches the list | shell | dead | `listings--popover-notifications` |
| notifications · Mark all as read | marks all read | shell | dead | `listings--popover-notifications` |
| account popover items | navigate / sign out | shell | stub | `listings--popover-account` |

## B · Page frame — and the variant we never built

`appRoutes.js:83` — `isMemberArea = user && !user.is_package_user`. The two
variants are mutually exclusive, and `listings.html` is the package-user one.

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| promo banner (whole card) | `Link` to the PropShop route | `common/banner/index.js:77` | missing | unmeasured |
| banner · Buy Package | navigates to PropShop | `common/banner/index.js:69-73` | missing | unmeasured |
| CreditsQuota · card title | opens CreditInfoDrawer | `widgets/credits-quota/credits-quota.js:127-131` | missing | unmeasured |
| CreditsQuota · `BsInfoLg` button | opens CreditInfoDrawer | `credits-quota.js:134-145` | missing | unmeasured |
| CreditsQuota · product tabs | switch the credit product | `credits-quota.js:170-198` | missing | unmeasured |
| CreditsQuota · Top-Up your Credits | DrawerModal with `CreditTopUps` | `credits-quota.js:259-271` | N/A on this screen — gated `!isMemberArea` (`:257`) while the widget is member-area only | — |
| CreditsQuota · Credits Usage | navigates `credits_usage` | `credits-quota.js:272-280` | N/A — same gate | — |
| CreditsQuota · user Select | filters by agency user | `credits-quota.js:68-88` | N/A — `usersPermission={false}` (`listings.js:175`) | — |
| CreditsQuota · error Retry | refetches | `credits-quota.js:187` | missing | unmeasured |
| page title "My Listings" | — | `listings.js:334` | missing — member-area only | — |
| filter bar | rendered only for package users | `ListingContainer.js:96` | built (this is our variant) | `listings.capture.json` |

## C · Filter bar — 4 inline of 11

`tenant/common/filters/listingFilters.js:8`. `INITIAL_FILTERS_TO_SHOW = 4`
(`filters.js:62`), so only the first four sit in the bar.

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| Listing ID | numeric input, 8 chars, clear `×`, Enter submits | `listingFilters.js:9-18`, `filters.js:300-320` | missing from the bar | `listings--drawer-filters` |
| REGA Ad License Number | numeric input, 9 chars | `listingFilters.js:19-32` | missing from the bar | `listings--drawer-filters` |
| Purpose | single Select, icon+label options, clearable | `listingFilters.js:33-48`, `filters.js:224-254` | dead (closed select, no listbox) | `listings.capture.json` |
| Property Type | multi Select, grouped by parent type | `listingFilters.js:49-69` | dead (closed select, no listbox) | `listings.capture.json` |
| Property Type · `+N` overflow tag | Popover listing the hidden labels | `filters.js:245-249` | missing | unmeasured |
| **any open Select listbox** | the dropdown panel itself | `filters.js:224-254` | missing — 6 controls depend on it | **unmeasured** |
| Show More | opens the filters Drawer | `filters.js:619-635`, `:698` | built → `drawer-filters` | `listings--drawer-filters` |
| Show More · Badge | count of applied non-inline filters | `getBadgeCount`, `filters.js:594-603` | missing | `listings--drawer-filters` |
| Search | pushes filters into the URL | `filters.js:396-412` | dead | `listings.capture.json` |
| Clear filters | clears URL params; disabled when none | `filters.js:637-649` | dead | `listings.capture.json` |
| applied-tag row · `RiFilter2Fill` | decorative | `filters.js:414-455` | missing | unmeasured |
| applied-tag row · closable Tag ×n | `×` removes that filter | `onTagClose`, `filters.js:82-91` | missing | unmeasured |
| applied-tag row · Clear All | clears everything | `filters.js:435-443` | missing | unmeasured |
| Save Search | — | not passed on this page | N/A | — |

## D · Filters drawer — the 7 non-inline filters

Measured at 450×900, header 91, body 718, footer 91 —
`listings--drawer-filters.capture.json`. It holds **only the filters the bar
does not**, which a probe of the running product confirmed as six form items:
Posted On · City (two selects) · TruCheck Status · Show Discounted · Price Range
· Area Range. Posted By is the seventh and needs `agencyUsersList.length > 1`.
The four inline filters stay in the bar and are **not** repeated here.

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| drawer close `IoMdClose` | closes | `filters.js:523` | built | `listings--drawer-filters` |
| TruCheck Status select | Select dropdown | `listingFilters.js:117-131` | dead (closed) | `listings--drawer-filters` |
| Listing ID / REGA / Purpose / Property Type | **not in the drawer** — they are the four inline filters | `filters.js:62` | N/A — see section C | — |
| Posted On | read-only input, `FiCalendar`, **click → DrawerPopover calendar** | `listingFilters.js:70-83`, `DateFilter.js:71-105` | missing | unmeasured |
| Posted On · `DateRangePickerOne` | range calendar, `okText="Confirm"`, clearable | `DateFilter.js:71-105` | missing | **unmeasured** |
| City | Algolia SelectSearch, multiple, clearable | `cityLocationFilter.js:155-200` | missing | `listings--drawer-filters` |
| Location | same, **disabled until a City is chosen** | `cityLocationFilter.js:200` | missing | `listings--drawer-filters` |
| Posted By | Select of agency users | `listingFilters.js:100-116` | N/A here — one agency user | — |
| Show Discounted Listings Only | antd Switch | `listingFilters.js:132-142`, `filters.js:344-363` | missing | `listings--drawer-filters` (35×18) |
| Price Range · min / max InputNumber | numeric steppers | `rangeSlider.js:47-84` | missing | `listings--drawer-filters` |
| Price Range · Slider | two-handle range, marked | `rangeSlider.js:47-84` | missing | `listings--drawer-filters` (408×12) |
| Price Range · Reset | link button | `rangeSlider.js:39-41` | missing | `listings--drawer-filters` |
| Area Range · the same three | + a **unit Dropdown** (sq m / sq ft) | `unitRangeSlider/unitRangeSider.js` | missing | `listings--drawer-filters` |
| footer · Reset Filters | clears all | `filters.js:527-529` | dead | `listings--drawer-filters` |
| footer · Search | applies | `filters.js:530` | dead | `listings--drawer-filters` |

## E · Status tabs

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| status tab ×n — `<Status> (<count>)` | sets `f[…status.slug]`, changes the column set | `transformers/listings.js:266-275`, `listings.js:184-201` | built ×5 panels | `listings--tab-*` |
| Ad License Requests `(N)` | sets `?tab=ad_licenses`, drops listing filters | `bayut/components/listing/constants.js:5-15` | built, but no `COLUMNS` entry | `listings--tab-ad-license-requests` |
| tabs while loading | disabled | `listings.js:337` | missing | `listings--loading` |
| `customTabs` prop | **passed and consumed nowhere** on desktop (`listings.js:338`); the visible tabs are the Card's | `listings.js:245-264` | N/A — noted so it is not reproduced | — |

## F · Table header

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| column sort | none — `useTableData` sets no `sorter` | `hooks/useTableData.js:58` | N/A | — |
| column filter / menu | none | `useTableData.js:58` | N/A | — |
| column resize | none | `useTableData.js:58` | N/A | — |
| row selection checkbox | none — `dontAllowRowSlection` | `transformers/listings.js:264` | N/A | — |
| row click | none — no `onRow` | — | N/A | — |
| horizontal scroll | `scroll={{x:'max-content'}}` | `dataTable.js:173-175` | built | `listings.capture.json` |
| Actions column sticky right | `fixed:'right'` | `listingUtilities.js:620` | built | `listings.capture.json` |

## G · Property cell

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| thumbnail | **opens the Listing Detail Drawer** (`cursor:pointer`) | `listing-purpose.js:79-82, 236-241` | dead | `listings--action-detail-drawer` |
| image-count Badge | inert (`stopPropagation` only) | `listing-purpose.js:207-215` | built, inert — correct | `listings.capture.json` |
| "Booked" chip | Tooltip "Booked Until \<date\>" | `listing-purpose.js:217-234` | missing | unmeasured |
| discount tag | inert | `listing-purpose.js:242-254` | built, inert — correct | `listings.capture.json` |
| listing price / title | **not a link** in the product | `listing-purpose.js:261` | dead — 13 × `href="#"`; the product has no link here, so it should be inert text | — |
| external-link icon | `target="_blank"` to `props.url` | `listing-purpose.js:282-284` | N/A — `showExternalLink` never set by the Bayut transformer | — |
| health / quality chip | **hover Popover**: Overall Quality panel. The trigger is the tag whose text is a percentage — td0 carries three tags and only that one opens anything | `listing-health.js:122-146` | missing | `listings--popover-health` — **440×352**, placement right, inner has **no padding** (the panel styles its own) |
| health popover · Refresh | opens QuotaCreditModal | `health.js:110-121` | missing | `listings--popover-health` |
| health popover · Add (Images) | navigates `/post-listing/:id#images` | `health.js:132-145` | missing | `listings--popover-health` |
| health popover · Add (Features) | navigates `/post-listing/:id#amenities` | `health.js:247-257` | missing | `listings--popover-health` |
| product badge / status tag | inert | `listing-purpose.js:267-281` | built, inert — correct | `listings.capture.json` |
| purpose / type Tag | inert | `listing-purpose.js:288-304` | built, inert — correct | `listings.capture.json` |
| spec icons + area | inert | `listing-purpose.js:306-329` | built, inert — correct | `listings.capture.json` |
| Bayut ID | inert text | `listing-purpose.js:334-335` | built, inert — correct | `listings.capture.json` |
| REGA ID · `AiOutlineInfoCircle` | **hover Popover** "Expiring on: \<date\>" | `listing-purpose.js:346-358` | missing | unmeasured — the probe hovered all 23 candidates in row 0 and this one never opened: the fixture row carries no `regaExpiryDate` |
| Permit No / "Unlicensed" Tag | inert | `listing-purpose.js:363-379` | built, inert — correct | `listings.capture.json` |

## H · Timeline cell — `user.isCurrencyUser` only

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| "Posted on" · `AiOutlineInfoCircle` | **hover Popover**, full date + time | `expiry-renewal.js:60-67` | missing | `listings--popover-timeline` — **180×54**, placement top, pad 16 |
| second date row | hidden — `HIDE_AUTO_RENEWAL:true` | `expiry-renewal.js:71-80`, `constants.js:214` | N/A | — |
| auto-renew Switch + its confirm Modal | **does not render for KSA** — `HIDE_TIMELINE_DATA:true` | `expiry-renewal.js:82-118`, `constants.js:215` | N/A | — |

## I · Performance cell

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| Views | **no icon, no tooltip** | `listing-stats.js:134` | built, inert — correct | `listings.capture.json` |
| Clicks | **no icon, no tooltip** | `listing-stats.js:135` | built, inert — correct | `listings.capture.json` |
| Leads · `AiOutlineInfoCircle` | **hover Popover**, LMS breakdown (Calls / WhatsApp / Emails / SMS) | `listing-stats.js:93-125` | missing | `listings--popover-leads` — **216×235**, placement top, pad 16 |
| stats while loading | Skeleton per value | `listing-stats.js:91` | missing | `listings--loading` |

## J · Status cell

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| status pill | **inert Tag** | `platforms-status.js:12-14` | built, inert — correct | `listings.capture.json` |
| rejection `AiOutlineInfoCircle` | **click Popover**, placement right, reasons list — the only click popover in the table body; only when the disposition carries `comments` | `platforms-status.js:16-33`, `listingUtilities.js:100` | missing | unmeasured — no fixture row is `rejected` with `comments`, so the icon does not render |

## K · Upgrades cell — 6 circles, 4 states

`listingUtilities.js:23-39`. A **live** listing shows exactly these six; a
not-posted / draft / expired one shows **none of them** and a Publish Now button
instead (`listingUtilities.js:42-49`).

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| Signature circle | → QuotaCreditModal "Request Signature Upgrade" | `products.js:57-90` | dead — ×12 rows | `listings--upgrade-signature` |
| Hot circle | → QuotaCreditModal | `products.js:91-123` | dead | `listings--upgrade-hot` |
| Refresh circle | → QuotaCreditModal | `products.js:124-151` | dead | `listings--upgrade-refresh` |
| Photography circle | → QuotaCreditModal **+ ServiceOptions** | `products.js:181-208` | dead | `listings--upgrade-photography` |
| Videography circle | → QuotaCreditModal + ServiceOptions | `products.js:152-180` | dead | `listings--upgrade-photography` (same shape) |
| Drone Footage circle | → QuotaCreditModal + ServiceOptions | `products.js:210-232` | dead | `listings--upgrade-photography` (same shape) |
| circle · enabled | clickable only when `!applied && canApply` | `upgrade-icons.js:33-49` | built | `listings.real.capture.json` |
| circle · applied | green `HiCheck` overlay, disabled | `upgrade-icons.js:50-57` | built | `listings.real.capture.json` |
| circle · pending | `RequestedStateIcon`, warning colour | `upgrade-icons.js:58-65` | missing | unmeasured |
| circle · disabled | `#F4F5F7` / `rgb(173,180,210)` at 0.54 | `platformActions.js:142` | built | `listings.real.capture.json` |
| circle tooltip · unavailable add-on | plain string "This service is not available in your region yet." | `platformActions.js:115-136` | missing | `listings--upgrade-*` (109–250 wide) |
| circle tooltip · **ActionPopOver panel** | title / applied / pending heading + "Expiring on" + "Selected Date & Time" | `listingActionPopover/popoverContent.js:159-169` | missing | **unmeasured** |
| **QuotaCreditModal** · plain | credits table, payment radios, Submit | `quotaCreditModal.js` | missing | `listings--upgrade-signature` — **708×414**, head 57, body 284, foot 73, centered |
| **QuotaCreditModal** · with ServiceOptions | + requested date + comments | `quotaCreditModal.js:103-110` | missing | `listings--upgrade-photography` — **708×546**, body 416 |
| Publish Now | navigates `/post-listing/:id`, or OTP modal, or applies | `platformActions.js:46-73, 147-163` | dead (Draft/Removed tabs) | `listings--tab-draft` |
| **OtpVerificationModal** | OTP entry, resend, 429 rate-limit | `platformActions.js:174-213` | missing | **unmeasured** |
| Publish suppressed | `pending-otp-verification` + `otp_attempts >= 3` | `listingUtilities.js:143-150` | missing | unmeasured |
| `Zameen Stories` remove + confirm | not reachable on Bayut | `popoverContent.js:43-98` | N/A | — |

## L · Actions cell — 7, two conditional

`listingUtilities.js:9-19`, in this order. Circular icon buttons, each in a
Tooltip placed left (`table-actions.js:155-162`); on mobile a `MdMoreVert`
kebab Dropdown (`:111-126`).

| # | element | product behaviour | source | our state | measured from |
|---|---|---|---|---|---|
| 1 | TruCheck | → **TruCheckModal** | `listingUtilities.js:191-203`, `listing-row-actions.js:103-105` | built → `modal-trucheck` | `listings--modal-trucheck` |
| 2 | View on Bayut | **external** `openExternalUrl(public_url)` | `listingUtilities.js:251-263` | dead — should be an external `<a>` | — |
| 3 | Preview | → **ListingDrawer** `.open(id)` | `listingUtilities.js:265-277` | built → `drawer-listing-detail`, **skeleton only** | `listings--action-detail-drawer` |
| 4 | Edit | navigates `/post-listing/:property_id` | `listingUtilities.js:204-216` | dead — should be a stub link | — |
| 5 | Apply Discount | stores the discount session, then navigates. **`null` unless `discount_applicable`** | `listingUtilities.js:217-237` | dead — should be a stub link | `listings--action-discount` |
| 6 | Mark as Booked | → **BookingModal**. **Only `listing_purpose.slug === 'daily-rental'`** | `listingUtilities.js:238-250` | built → `modal-booking`, **1 entry point in 13 rows** | `design-capture-flows-only-booking.real` |
| 7 | Delete | → **ConfirmationModal** + reason Radio.Group + "other" free text | `listingUtilities.js:314-334`, `listing-row-actions.js:157-198` | built → `modal-delete` | `listings--modal-delete` |
| — | per-button Tooltip ×7 | Edit 66×40 / Preview 92×40 / View on Bayut 132×40 / Delete 84×40 / Apply Discount 137×40 / Mark as Booked / TruCheck \<status\>. Placement left, white, pad 6/20 | `table-actions.js:62-109`, `listingUtilities.js:158-175` | missing | `listings--tooltip-action` |
| — | Delete suppressed | `pending-otp-verification` + `otp_attempts >= 3` | `listingUtilities.js:316-322` | missing | unmeasured |
| — | disable / hide / enable / unhide / change_listing_owner | **not in `listingRowActions.ksa`** — they never render here | `listingUtilities.js:279-313, 335-344` | N/A | — |

## M · Pagination

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| page numbers | push `page=<n>` into the URL | `dataTable.js:65-86` | dead — `href="#"` ×2 | `listings.capture.json` |
| prev / next | same | `dataTable.js:88-104` | dead — Next carries `data-nav`, which `prototype.js` does not read | `listings.capture.json` |
| page-size changer | **none** — `showSizeChanger={false}` | `dataTable.js:94` | N/A | — |
| pager visibility | only when `totalPages > 1` | `dataTable.js:181` | fixture has 1 page of rows | unmeasured |

## N · Empty, loading and error states

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| empty tab · Post Listing | navigates `/post-listing` | `post-listing-button.js:11-21` | dead ×3 | `listings--tab-*` |
| Ad License empty · Get an Ad License | link button → `/ad-license` | `listings.js:211-219` | missing | `listings--tab-ad-license-requests` |
| Ad License empty · "NEW" Tag | inert | `listings.js:204-234` | missing | unmeasured |
| error state · Retry | `onRetry = currentRefetch` | `dataTable.js:148-157`, `listings.js:333` | dead | `listings--error` |
| loading state | table spinner + `FiltersSkeleton` | `dataTable.js:164`, `filters.js:677-690` | built, **no tab panels inside** | `listings--loading` |
| `?isPackageUser=true` redirect | navigates to `/packages` or the dashboard | `listings.js:60-68` | N/A — a URL side-effect, not a control | — |

---

## Where the values come from — and what is left

A probe drove the running product and hovered all 23 hoverable things in row 0,
opened both filter-bar selects and the Posted On calendar. Nine states that had
never been captured now are, and with them went most of what this file called
`unmeasured` in its first draft:

| now measured | size |
|---|---|
| health / quality popover | 440×352, placement right, **no inner padding** |
| Timeline "Posted on" popover | 180×54, pad 16 |
| Leads popover | 216×235, pad 16 |
| upgrade-circle tooltip (= `ActionPopOver`, default) | 109–250 wide, **white**, `#5A5F7D`, pad 6/20 |
| row-action tooltip | 66–137 wide, placement left, same skin |
| Purpose select dropdown | 245×137, 3 flat options |
| Property Type select dropdown | 245×278, 8 options under 1 group header |
| Posted On calendar | popover 802×381 — **`react-date-range`, not an antd picker** |

Two corrections came out of that run and are folded in above: the product's
**tooltips are white with `#5A5F7D` text**, not antd's dark default; and the
date picker is `react-date-range` (`datePicker.js:15`), so building it means
reproducing `rdr*` markup, not `ant-picker`.

`QuotaCreditModal` was never the problem it was described as:
`listings--upgrade-signature` (708×414) and `listings--upgrade-photography`
(708×546) already carry both of its shapes. The seventy-two dead circles are a
building gap, not a measuring one.

### What is still unmeasured, and why

Almost none of it is a capture problem now. It is that **this account cannot
produce the state**:

| unmeasured | what it needs |
|---|---|
| REGA "Expiring on" popover | a row with `regaExpiryDate` |
| status rejection-reasons popover | a `rejected` row carrying `comments` |
| applied / pending circle tooltip | a row with an applied and a pending product |
| "not available in your region" tooltip | a service that is not applicable |
| `+N` overflow popover | more property types selected than fit |
| Booked chip tooltip | a row with booked ranges |
| OtpVerificationModal, Publish/Delete suppression | a row in `pending-otp-verification` |
| banner, CreditsQuota, CreditInfoDrawer | a **member-area** user — `is_package_user: false` |

That is the fixture work, and it is what makes the rest of this file finishable.

---

## The two numbers

Quoted instead of vague claims about what is "still open". Both are recomputed
by `npm run check`, which fails when the page and this file disagree.

**Elements covered — 48 of 124 rows, 38.7%.** A row counts as covered when its
state mark is `built`, `stub` or `N/A`.

| state | rows |
|---|---|
| built | 28 |
| stub | 2 |
| N/A — verified absent | 18 |
| dead | 29 |
| missing | 47 |

**Elements measured — 71 rows name a capture file, 29 are `unmeasured`**, and
those 29 cluster in the four components named above. The remaining 24 have
nothing to measure — a link, or an N/A.

`npm run check` recomputes both and prints them. It is the authority: it fails
on a row whose state cell does not begin with one of the five marks, so these
numbers cannot drift silently.

### The page census

`scripts/census.mjs` counts the interactive elements in
`deliverables/listings.html`; `scripts/check.mjs` compares them with these
numbers. Add a control to the page and the check fails until it has a row here.
`dead` is the number this file exists to drive to zero.

```census
button 162
a 65
input 7
total 234
reachable 98
dead 136
hashHref 16
```

For the record, the same census of `deliverables/dashboard.html` is 166 elements
and **0 reachable** — it is hand-written, carries no `prototype.js` and no
`data-open` at all. That is tracked in `authoring/qa-listings.md` as drift, not
here; this file is the Listings screen.
