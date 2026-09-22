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
| rail · language switcher | switches locale | shell | stub | `listings.capture.json` |
| rail · Help & Support | opens support | shell | stub | `listings.capture.json` |
| header · Download App | opens QR modal | shell | built → `modal-download-app` | `listings--modal-download-app` |
| header · Go to Bayut.sa | external, new tab | shell | built — a real external link; it carried `href="#"` | — |
| header · Post Listing | navigates `/post-listing` | `post-listing-button.js:11-21` | stub | — |
| header · bell | opens notifications popover | shell | built → `popover-notifications` | `listings--popover-notifications` |
| header · avatar | opens account popover | shell | built → `popover-account` | `listings--popover-account` |
| notifications · Refresh | refetches the list | shell | noop — a server call | `listings--popover-notifications` |
| notifications · Mark all as read | marks all read | shell | noop — a data mutation | `listings--popover-notifications` |
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
| Purpose | single Select, icon+label options, clearable | `listingFilters.js:33-48`, `filters.js:224-254` | built → `listbox-purpose` | `listings--select-purpose` — dropdown **245×137**, 3 flat options |
| Property Type | multi Select, grouped by parent type | `listingFilters.js:49-69` | built → `listbox-property-type` | `listings--select-property-type` — dropdown **245×278**, 8 options under 1 group |
| Property Type · `+N` overflow tag | Popover listing the hidden labels | `filters.js:245-249` | missing | unmeasured |
| **any open Select listbox** | the dropdown panel itself | `filters.js:224-254` | built — both panels, and the six controls that waited on one | `listings--select-purpose`, `listings--select-property-type` |
| Show More | opens the filters Drawer | `filters.js:619-635`, `:698` | built → `drawer-filters` | `listings--drawer-filters` |
| Show More · Badge | count of applied non-inline filters | `getBadgeCount`, `filters.js:594-603` | missing | `listings--drawer-filters` |
| Search | pushes filters into the URL | `filters.js:396-412` | noop — a URL push and a refetch | `listings.capture.json` |
| Clear filters | clears URL params; disabled when none | `filters.js:637-649` | built — disabled, which is the product's own state when nothing is applied | `listings.capture.json` |
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
| TruCheck Status select | Select dropdown | `listingFilters.js:117-131` | built → a listbox | `listings--drawer-filters` |
| Listing ID / REGA / Purpose / Property Type | **not in the drawer** — they are the four inline filters | `filters.js:62` | N/A — see section C | — |
| Posted On | read-only input, `FiCalendar`, **click → DrawerPopover calendar** | `listingFilters.js:70-83`, `DateFilter.js:71-105` | built → `popover-date-range` | `listings--date-posted-on` |
| Posted On · `DateRangePickerOne` | range calendar, `okText="Confirm"`, clearable | `DateFilter.js:71-105` | built — `.rdrDefinedRangesWrapper` 226, `.rdrStaticRange` 225×36, `.rdrMonth` 272×247, `.rdrDay` 36×36 | `listings--date-posted-on` — popover **802×381**, pad 16 |
| City | Algolia SelectSearch, multiple, clearable | `cityLocationFilter.js:155-200` | built → a listbox | `listings--drawer-filters` |
| Location | same, **disabled until a City is chosen** | `cityLocationFilter.js:200` | built — disabled until a City is chosen, which is the product's rule | `listings--drawer-filters` |
| Posted By | Select of agency users | `listingFilters.js:100-116` | N/A here — one agency user | — |
| Show Discounted Listings Only | antd Switch | `listingFilters.js:132-142`, `filters.js:344-363` | built — 35×18, 14px knob, `rgba(0,0,0,.25)` off | `listings--drawer-filters` (35×18) |
| Price Range · min / max InputNumber | numeric steppers | `rangeSlider.js:47-84` | built — 186×44, radius 6 | `listings--drawer-filters` |
| Price Range · Slider | two-handle range, marked | `rangeSlider.js:47-84` | built — rail 408×4 at `rgba(95,99,242,.2)`, 8px handles | `listings--drawer-filters` (408×12) |
| Price Range · Reset | link button | `rangeSlider.js:39-41` | noop — clears this range only | `listings--drawer-filters` |
| Area Range · the same three | + a **unit Dropdown** (sq m / sq ft) | `unitRangeSlider/unitRangeSider.js` | built, and the unit Dropdown with them | `listings--drawer-filters` |
| footer · Reset Filters | clears all | `filters.js:527-529` | noop — clears form state and URL params | `listings--drawer-filters` |
| footer · Search | applies | `filters.js:530` | built — closes the drawer | `listings--drawer-filters` |

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
| thumbnail | **opens the Listing Detail Drawer** (`cursor:pointer`) | `listing-purpose.js:79-82, 236-241` | missing — the Preview action opens the same drawer, so the flow is reachable; this second entry point is not | `listings--action-detail-drawer` |
| image-count Badge | inert (`stopPropagation` only) | `listing-purpose.js:207-215` | built, inert — correct | `listings.capture.json` |
| "Booked" chip | Tooltip "Booked Until \<date\>" | `listing-purpose.js:217-234` | built — row 6 | `listings--tooltip-booked` — **230×40** |
| discount tag | inert | `listing-purpose.js:242-254` | built, inert — correct | `listings.capture.json` |
| listing price / title | **not a link** in the product | `listing-purpose.js:261` | built — inert text, as the product renders it. It carried `href="#"` on thirteen rows | — |
| external-link icon | `target="_blank"` to `props.url` | `listing-purpose.js:282-284` | N/A — `showExternalLink` never set by the Bayut transformer | — |
| health / quality chip | **hover Popover**: Overall Quality panel. The trigger is the tag whose text is a percentage — td0 carries three tags and only that one opens anything | `listing-health.js:122-146` | built → `popover-health`, on hover and on click | `listings--popover-health` — **440×352**, placement right, inner has **no padding** (the panel styles its own) |
| health popover · Refresh | opens QuotaCreditModal | `health.js:110-121` | built → `modal-quota` | `listings--popover-health` |
| health popover · Add (Images) | navigates `/post-listing/:id#images` | `health.js:132-145` | stub | `listings--popover-health` |
| health popover · Add (Features) | navigates `/post-listing/:id#amenities` | `health.js:247-257` | stub | `listings--popover-health` |
| product badge / status tag | inert | `listing-purpose.js:267-281` | built, inert — correct | `listings.capture.json` |
| purpose / type Tag | inert | `listing-purpose.js:288-304` | built, inert — correct | `listings.capture.json` |
| spec icons + area | inert | `listing-purpose.js:306-329` | built, inert — correct | `listings.capture.json` |
| Bayut ID | inert text | `listing-purpose.js:334-335` | built, inert — correct | `listings.capture.json` |
| REGA ID · `AiOutlineInfoCircle` | **hover Popover** "Expiring on: \<date\>". It is the **last** icon in the cell; a row without a rega expiry has only the four spec icons | `listing-purpose.js:346-358` | built → `popover-rega`, on row 2 | `listings--popover-rega` — **191×54**, pad 16 |
| Permit No / "Unlicensed" Tag | inert | `listing-purpose.js:363-379` | built, inert — correct | `listings.capture.json` |

## H · Timeline cell — `user.isCurrencyUser` only

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| "Posted on" · `AiOutlineInfoCircle` | **hover Popover**, full date + time | `expiry-renewal.js:60-67` | built → `popover-timeline`. The glyph was `BsInfoLg` here; it is `AiOutlineInfoCircle` | `listings--popover-timeline` — **180×54**, placement top, pad 16 |
| second date row | hidden — `HIDE_AUTO_RENEWAL:true` | `expiry-renewal.js:71-80`, `constants.js:214` | N/A | — |
| auto-renew Switch + its confirm Modal | **does not render for KSA** — `HIDE_TIMELINE_DATA:true` | `expiry-renewal.js:82-118`, `constants.js:215` | N/A | — |

## I · Performance cell

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| Views | **no icon, no tooltip** | `listing-stats.js:134` | built, inert — correct | `listings.capture.json` |
| Clicks | **no icon, no tooltip** | `listing-stats.js:135` | built, inert — correct | `listings.capture.json` |
| Leads · `AiOutlineInfoCircle` | **hover Popover**, LMS breakdown (Calls / WhatsApp / Emails / SMS) | `listing-stats.js:93-125` | built → `popover-leads`. Views and Clicks carried one here too; they have none in the product | `listings--popover-leads` — **216×235**, placement top, pad 16 |
| stats while loading | Skeleton per value | `listing-stats.js:91` | missing | `listings--loading` |

## J · Status cell

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| status pill | **inert Tag** | `platforms-status.js:12-14` | built, inert, and now **per row** — it was hardcoded `Live` on every row including Draft and Pending | `listings.capture.json` |
| rejection `AiOutlineInfoCircle` | **click Popover**, placement right, reasons joined by commas — the only click popover in the table body; only when the disposition carries `comments` | `platforms-status.js:16-33`, `listingUtilities.js:100` | built → `popover-status`, on row 1 | `listings--popover-status-rejected` — **472×54**, pad 16 |

## K · Upgrades cell — 6 circles, 4 states

`listingUtilities.js:23-39`. A **live** listing shows exactly these six; a
not-posted / draft / expired one shows **none of them** and a Publish Now button
instead (`listingUtilities.js:42-49`).

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| Signature circle | → QuotaCreditModal "Request Signature Upgrade" | `products.js:57-90` | built → `modal-quota` | `listings--upgrade-signature` |
| Hot circle | → QuotaCreditModal | `products.js:91-123` | built → `modal-quota` | `listings--upgrade-hot` |
| Refresh circle | → QuotaCreditModal | `products.js:124-151` | built → `modal-quota` | `listings--upgrade-refresh` |
| Photography circle | → QuotaCreditModal **+ ServiceOptions** | `products.js:181-208` | built → `modal-quota-service` | `listings--upgrade-photography` |
| Videography circle | → QuotaCreditModal + ServiceOptions | `products.js:152-180` | built → `modal-quota-service` | `listings--upgrade-photography` (same shape) |
| Drone Footage circle | → QuotaCreditModal + ServiceOptions | `products.js:210-232` | built → `modal-quota-service` | `listings--upgrade-photography` (same shape) |
| circle · enabled | clickable only when `!applied && canApply` | `upgrade-icons.js:33-49` | built | `listings.real.capture.json` |
| circle · applied | green `HiCheck` overlay, disabled | `upgrade-icons.js:50-57` | built | `listings.real.capture.json` |
| circle · pending | `RequestedStateIcon`, warning colour. Pending is `is_applied && status === 'requested'` — **both together** (`products.js:5-9`); either alone renders an ordinary circle | `upgrade-icons.js:58-65` | built — row 3. Pending is `is_applied && status === 'requested'`, **both together** (`products.js:5-9`) | `listings--tooltip-upgrade-pending` |
| circle · disabled | `#F4F5F7` / `rgb(173,180,210)` at 0.54 | `platformActions.js:142` | built | `listings.real.capture.json` |
| circle tooltip · default | the `ActionPopOver` showing its title — "Mark Signature" 153×40, "Mark Hot" 109×40, "Mark Refresh" 138×40, "Request Photography/Videography Service" 250×54, "Request Drone Footage" 213×40. **White**, `#5A5F7D`, pad 6/20 | `platformActions.js:115-136` | built — `data-tip` carries products.js's own title string | `listings--tooltip-upgrade`, `listings--tooltip-upgrade-service` |
| circle tooltip · applied | the applied title — "Signature Listing" **165×40**, not "Mark Signature" | `platformActions.js:124` | built — row 3 | `listings--tooltip-upgrade-applied` |
| circle tooltip · pending | the pending title — **250×54** | `platformActions.js:124` | built — row 3 | `listings--tooltip-upgrade-pending` |
| circle tooltip · unavailable add-on | plain string "This service is not available in your region yet." — **250×58** | `platformActions.js:115-136` | built — row 8 | `listings--tooltip-upgrade-unavailable` |
| circle · disabled with **no tooltip at all** | a non-applicable circle that is not an add-on service gets nothing — a disabled circle is not always a circle with an explanation | `platformActions.js:115-136` | built — row 8's refresh circle | `listings--tooltip-upgrade-none` — nothing opens, which is the measurement |
| **QuotaCreditModal** · plain | credits table, payment radios, Submit | `quotaCreditModal.js` | built → `modal-quota` | `listings--upgrade-signature` — **708×414**, head 57, body 284, foot 73, centered |
| **QuotaCreditModal** · with ServiceOptions | + requested date + comments | `quotaCreditModal.js:103-110` | built → `modal-quota-service` | `listings--upgrade-photography` — **708×546**, body 416 |
| Publish Now | navigates `/post-listing/:id`, or OTP modal, or applies | `platformActions.js:46-73, 147-163` | built → `modal-otp`, on row 7 | `listings--tab-draft` |
| OtpVerificationModal | OTP entry, resend, 429 rate-limit | `platformActions.js:174-213` | built, **unmeasured** — drawn at the listing modal's 620 because nothing has ever opened the real one | unmeasured — a `pending-otp-verification` row now exists and renders Publish Now, but clicking it takes the currency-user branch and navigates (`platformActions.js:68-71`) rather than sending an OTP. The modal needs the FAL-OTP branch, not just the disposition |
| Publish suppressed | `pending-otp-verification` + `otp_attempts >= 3` | `listingUtilities.js:143-150` | missing | unmeasured |
| `Zameen Stories` remove + confirm | not reachable on Bayut | `popoverContent.js:43-98` | N/A | — |

## L · Actions cell — 7, two conditional

`listingUtilities.js:9-19`, in this order. Circular icon buttons, each in a
Tooltip placed left (`table-actions.js:155-162`); on mobile a `MdMoreVert`
kebab Dropdown (`:111-126`).

| # | element | product behaviour | source | our state | measured from |
|---|---|---|---|---|---|
| 1 | TruCheck | → **TruCheckModal** | `listingUtilities.js:191-203`, `listing-row-actions.js:103-105` | built → `modal-trucheck` | `listings--modal-trucheck` |
| 2 | View on Bayut | **external** `openExternalUrl(public_url)` | `listingUtilities.js:251-263` | built — an external link to the classified site | — |
| 3 | Preview | → **ListingDrawer** `.open(id)` | `listingUtilities.js:265-277` | built → `drawer-listing-detail`, **loaded** — gallery, price, spec row, information list, description | `listings--action-detail-drawer` — 576 wide, head 63, body 837 over a 528 column, gallery 528×424 |
| 4 | Edit | navigates `/post-listing/:property_id` | `listingUtilities.js:204-216` | stub | — |
| 5 | Apply Discount | stores the discount session, then navigates. **`null` unless `discount_applicable`** | `listingUtilities.js:217-237` | stub, and absent on row 5 — `discount_applicable` false | `listings--action-discount` |
| 6 | Mark as Booked | → **BookingModal**. **Only `listing_purpose.slug === 'daily-rental'`** | `listingUtilities.js:238-250` | built → `modal-booking`, on rows 4 and 9 | `listings--modal-booking` — **800×234** in context, head 57 pad 16/24, body 104 pad 24, foot 73 |
| 7 | Delete | → **ConfirmationModal** + reason Radio.Group + "other" free text | `listingUtilities.js:314-334`, `listing-row-actions.js:157-198` | built → `modal-delete` | `listings--modal-delete` |
| — | per-button Tooltip ×7 | Edit 66×40 / Preview 92×40 / View on Bayut 132×40 / Delete 84×40 / Apply Discount 137×40 / Mark as Booked / TruCheck \<status\>. Placement left, white, pad 6/20 | `table-actions.js:62-109`, `listingUtilities.js:158-175` | built — one shared `#pf-tip`, text from each trigger's `data-tip` | `listings--tooltip-action` |
| — | Delete suppressed | `pending-otp-verification` + `otp_attempts >= 3` | `listingUtilities.js:316-322` | missing | unmeasured |
| — | disable / hide / enable / unhide / change_listing_owner | **not in `listingRowActions.ksa`** — they never render here | `listingUtilities.js:279-313, 335-344` | N/A | — |

## M · Pagination

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| page numbers | push `page=<n>` into the URL | `dataTable.js:65-86` | noop — a URL push and a refetch | `listings.capture.json` |
| prev / next | same | `dataTable.js:88-104` | noop — the same. `data-nav` was the only attribute on them and `prototype.js` has never read it | `listings.capture.json` |
| page-size changer | **none** — `showSizeChanger={false}` | `dataTable.js:94` | N/A | — |
| pager visibility | only when `totalPages > 1` | `dataTable.js:181` | fixture has 1 page of rows | unmeasured |

## N · Empty, loading and error states

| element | product behaviour | source | our state | measured from |
|---|---|---|---|---|
| empty tab · Post Listing | navigates `/post-listing` | `post-listing-button.js:11-21` | stub ×3 | `listings--tab-*` |
| Ad License empty · Get an Ad License | link button → `/ad-license` | `listings.js:211-219` | missing | `listings--tab-ad-license-requests` |
| Ad License empty · "NEW" Tag | inert | `listings.js:204-234` | missing | unmeasured |
| error state · Retry | `onRetry = currentRefetch` | `dataTable.js:148-157`, `listings.js:333` | noop — refetches | `listings--error` |
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

Almost none of it was a capture problem. It was that the account could not
produce the state. `harness/fixtures.mjs` now gives each of the ten rows a job —
row 1 is rejected, row 2 has a REGA expiry, row 3 has an applied product and a
requested service, row 6 is booked, row 7 is pending OTP, row 8 has services
that are not applicable — and eight more states came back:

| now measured | size |
|---|---|
| REGA "Expiring on" popover | 191×54 |
| status rejection-reasons popover | 472×54, **click**, placement right |
| applied circle tooltip | 165×40, and it reads "Signature Listing", not "Mark Signature" |
| pending circle tooltip | 250×54 |
| "not available in your region" tooltip | 250×58 |
| a disabled non-service circle | **no tooltip at all** — which is the measurement |
| Booked chip tooltip | 230×40 |
| BookingModal, in context | 800×234, head 57, body 104, foot 73 |

One correction came out of that: **pending is `is_applied && status ===
'requested'`, both together** (`products.js:5-9`). A first attempt set
`is_applied: false` and the circle rendered as an ordinary one.

What is left, and what each still needs:

| still unmeasured | what it needs |
|---|---|
| `OtpVerificationModal`, Publish/Delete suppression | the FAL-OTP branch, not just the disposition — a `pending-otp-verification` row now renders Publish Now and it navigates instead |
| `+N` overflow popover | more property types selected than fit |
| banner, CreditsQuota, CreditInfoDrawer | more than a member-area user. With `is_package_user:false` the app never paints `.ant-layout`: the member area mounts the **classified site's** header, which wants `/api/user/favorites`, `/api/user/searches/saved` and an off-origin bookings endpoint. Answering the first two is not enough |
| the pager as a real account renders it | more than one page of listings |
| tabs while loading, stats skeleton | the `loading` state with its tab panels built |

---

## The two numbers

Quoted instead of vague claims about what is "still open". Both are recomputed
by `npm run check`, which fails when the page and this file disagree.

**Elements covered — 106 of 127 rows, 83.5%.** A row counts as covered when its
state mark is `built`, `stub`, `noop` or `N/A`.

| state | rows |
|---|---|
| built | 69 |
| stub — a link to `not-built.html` | 10 |
| noop — cannot work here, and says why | 8 |
| N/A — verified absent from this screen | 19 |
| dead | 0 |
| missing | 21 |

**Elements measured — 14 rows are `unmeasured`**, and every one of them is
listed above with what it needs.

The 21 `missing` rows are, in order of what they are waiting on: the
**member-area variant** (7 rows, blocked on the classified header's endpoints),
per-tab row sets and a multi-page pager (4), `OtpVerificationModal` and the
suppression states (3), the `+N` overflow popover, the thumbnail as a second
entry point to the detail drawer, and the Ad License empty state.

`npm run check` recomputes both and prints them. It is the authority: it fails
on a row whose state cell does not begin with one of the six marks, so these
numbers cannot drift silently.

### The page census

`scripts/census.mjs` counts the interactive elements in
`deliverables/listings.html`; `scripts/check.mjs` compares them with these
numbers. Add a control to the page and the check fails until it has a row here.
`dead` is the number this file exists to drive to zero.

```census
button 200
a 60
input 20
total 280
reachable 223
disabled 15
field 20
acknowledged 22
dead 0
hashHref 0
```

For the record, the same census of `deliverables/dashboard.html` is 166 elements
and **0 reachable** — it is hand-written, carries no `prototype.js` and no
`data-open` at all. That is tracked in `authoring/qa-listings.md` as drift, not
here; this file is the Listings screen.
