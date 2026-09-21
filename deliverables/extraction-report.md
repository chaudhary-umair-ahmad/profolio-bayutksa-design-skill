# STEP 1 — Extraction report · `/dashboard` (Overview), tenant `bayut` (KSA)

Two sources, used for different things.

* **The screenshot** is the authority on *structure, order and copy*: what is on the
  screen, in what order, saying what.
* **`profolio-reactjs @ b83e805`** is the authority on *values*: colours, spacing,
  radii, type sizes. Eyeballing a hex off a downscaled PNG is guessing; reading it
  out of `src/theme/index.js` is not.

Where the two disagree I say so. Where neither answers, the item is **cannot tell**
and it is listed at the end as a question, never as a number.

Confidence is marked per item: **[read]** direct from source or screenshot ·
**[inf]** inferred · **[?]** cannot tell.

---

## The single biggest correction

The previous `dashboard.html` was built from a flattened component skeleton and got
three structural facts wrong. All three are now sourced:

| | scrap said | actually |
|---|---|---|
| sider | 220px expanded, 14 labelled rows | **60px collapsed icon rail, 11 items.** `withAdminLayout.js` opens with `useState(true)` — collapsed *is* the default state |
| header | 74px | **60px.** `theme['layout-header-height']` is 74px but `renderHeader()` sets `minHeight:60, maxHeight:60` inline, and inline wins |
| widgets | TruBrokerStatus, TruPointsWidget, DashboardPromoBanner, profile row… | **none of those render here.** The TruBroker pair is gated on `user.tru_broker_start_date`; the promo banner on a non-empty `loginUser.banners` |

---

## LAYOUT

### Rail

| item | value | conf |
|---|---|---|
| width | **60px** (`SIDEBAR_COLLAPSED_WIDTH`) | [read] `withAdminLayout.js` |
| expanded width | 220px (`SIDEBAR_EXPANDED_WIDTH`), not the shipped default | [read] |
| ground / border / shadow | `#fff` · `1px solid gray400 #DEDEDE` inline-end · `0 0 30px #9299B810` | [read] `layout/style.js` |
| item count | **11** nav items + 2 bottom actions | [read] `menuList.js` + [read] screenshot (11 + 2 counted) |
| item order | Overview · Post Listing · My Listings · Credits Usage · Inbox · TruLeads · Agent Performance · Reports · Agency Staff · Settings · Credits & Packages | [read] |
| item box | height 36px, width 70% of the rail, `padding-inline 10px`, `margin-inline auto` | [read] |
| icon | 20 × 20, colour `gray700 #707070` | [read] |
| **active treatment** | ground `primary-light-4 #F2FAFA`, colour + icon `primary #006169`, weight 600 | [read] |
| active item | Overview (`/dashboard`) | [read] screenshot |
| bottom actions | language switcher, then Help & Support — both `outlined` buttons, transparent ground, content `#707070`, border `#e6e6e6`, `block`, wrapped in `px-8` | [read] `MenueItems.js` |
| icon glyphs | named (`SideMenuDashboard`, `SideMenuQuota`, `DashboardLmsIcon`…) but they are local SVG components I did not open | **[?]** |
| item radius, gap between items | not declared | **[?]** |

### Header

| item | value | conf |
|---|---|---|
| height | **60px**, `padding-block 12px` | [read] inline style |
| padding-inline-start | **85px** = `sidebarOffset (60) + 25` | [read] |
| padding-inline-end | 20px | [read] |
| ground | `#fff` | [read] |
| elements, left → right | `Overview` · Download App · Go to Bayut.sa · Post Listing · bell + badge · avatar ring | [read] both |
| page title | weight 700, **20px**, `#000`, line-height 1.2, `white-space: nowrap` | [read] |
| title string | **“Overview”** — the matched menu entry's own title, not “Dashboard” | [read] |
| “Download App” | `Button type="link" icon="MdPhoneIphone" iconSize="1.3em" className="px-0"`, gated on `PITCH_MOBILE_APP` | [read] |
| “Go to Bayut.sa” | `Go to {{link}}` with `capitalizeFirstLetter(LINK_TITLE)` | [read] |
| “Post Listing” | `Button type="primary" icon="PostListingIcon"` | [read] |
| bell | gated on `NOTIFICATION_CENTER_ENABLED && push_notifications.value == 'enabled'` | [read] |
| badge count | **46** | [read] screenshot |
| avatar | antd circular `Progress` at **size 34**, stroke = `getClassificationColor(classification)`, containing the profile image at **size 30 / icon 24 / container 26** | [read] `auth-info/info.js` |
| Row gutter | 16 | [read] |
| badge offset / overflow rule | antd `Badge` defaults | **[?]** |
| classification → colour map | not in the files I read | **[?]** |

### Content column

| item | value | conf |
|---|---|---|
| widget gap | **16px** (`<Group gap="16px">`) | [read] `dashboard.js` |
| gap under the account switcher | **24px** (`.mb-24`) | [read] |
| the one sourced grid | `repeat(2, minmax(0, 1fr))`, gap 16 — `<Group className="c-listing-credits">` | [read] |
| outer gutter of the content area | not declared anywhere in `withAdminLayout.js` or `Main` | **[?]** — 16px used, measured |
| max-width | there is none; the layout is fluid | [read] |

### Grid — which cards share a row

```
row 1   alert banner                                        full width
row 2   account switcher                                    full width
row 3   Listings              │ Credits Balance             1fr │ 1fr   ← sourced
row 4   Performance                                         full width
row 5   Recent Listings (heading outside the card)          full width
```
[read] — the order is the literal child order of `<ContainerWidgets>` in `dashboard.js`.

### Footer

`padding 12px 16px` · colour `rgba(0,0,0,0.65)` · 14px · ground `rgba(255,255,255,.90)` ·
`box-shadow 0 -5px 10px rgba(146,153,184,0.05)` · centred ·
text **“© 2026 – All Rights Reserved”** (an en dash, and the year is `getFullYear()`). All **[read]**.

---

## PER CARD, in DOM order

### 1 · alert-banner — `ProfileCompletionBanner`

* Ground `primary-light-4`, border `1px primary-light-2`, radius **12px** above 767px,
  shadow `0px 1px 6px 0px #0000001C`, padding **16px**. All **[read]**.
* Structure: 38px progress ring (34px avatar + square score badge) → text block →
  CTA, the text block and CTA at `justify: space-between`. **[read]**
* Copy — **“Your profile is incomplete”** (bold, 14px, `base-color`) /
  **“Agents with a complete profile are likely to attract more leads.”** (12px,
  `color-gray-dark`) / inline link **“Why is this important?”** / CTA
  **“Complete your Profile”**.
  The first two are **API strings** (`profile_completion.title` / `.message`), so they are
  [read] from the screenshot, not from the repo. The link and CTA are [read] from the repo.
* Score badge padding, radius and type size — **[?]**

### 2 · account-switcher

* `CardMetaStyled` gap 8px, `--card-height: 33px`, `titleFontWeight 700`, avatar `iconSize 24`.
  Dropdown: `padding 8px`, `suffixIcon "MdKeyboardArrowDown"` tinted `primary-color`,
  `iconSize 14px`. All **[read]**.
* Name **“Alfalw Company LTD”** [read]. Renders only for `is_agency_admin` or a multi-platform user.
* The `TruBrokerTag` slot next to the name is empty here — `TRU_BROKER_ENABLED && is_tru_broker` is false. [inf]
* Dropdown panel geometry — **[?]**

### 3 · Listings — `ListingBreakdown linear={false}`

* Card body padding **`30px 24px`**, head `borderBottom: none`, title `.fz-16` weight 700. [read]
* Header right: `Button type="link"` from `link_data.text` → **“View All Listings”**. [read] repo + screenshot
* Body: `<Flex align="center" gap="50px">` → leader statistic · full-height vertical divider ·
  `<Flex vertical gap="40px">` containing two `<Group template="repeat(3, 1fr)" gap="30px 30px">`. [read]
* **3 columns** — `templateVar = round((purposes 3 + products 3) / 2) = 3`. [read], and it matches the screenshot.
* Leader: **Active / 20**, `leader` size `1.5714em`. Purposes: **For Sale 20 · To Rent 0 · Daily Rentals 0**.
  Products: **Signature 12 · Hot 5 · Basic 3**. Stat title 13px. [read] screenshot + [read] `fontSize="13px"`
* Which icon and tone each row uses — they come from the API per row, so the pairing is **[inf]** from the screenshot's hues.

### 4 · Credits Balance — `CreditsQuota`

* Card body padding **24**, head `borderBottom: none`, title `.fz-16` weight 700, plus a
  circular `type="primary-light"` info button at **18 × 18** with ground `primary-light-3`. [read]
* Stats row: `<Group template="repeat(6, auto) 1fr" gap="32px">` — statistic, 40px divider,
  statistic, divider, statistic, divider, plan block pushed to the end. [read]
* **Available Credits 72,880 · Used 2,120 · Total 75,000**, all `lead` (`1.4285em`), weight 700. [read]
* Plan block: **“Current Plan”** (`fw-400`, secondary, right-aligned) over an 18px package icon
  and **“Platinum Plus”** at weight 700, `--icon-styled-width: 30px`. [read]
* Progress: `percent = available / total × 100` = **97.17%**, `showInfo={false}`,
  `strokeColor = platform.brandColor`. [read]
* Actions: `<Flex justify="center" gap="10px">` with two `primaryOutlined` buttons at `w-100`:
  **“Top-Up your Credits”** (`IoAddCircleOutline`) and **“Credits Usage”** (`PiClockClockwiseFill`). [read]
* Progress bar height, track colour, and `brandColor` itself — **[?]**
* `packageColor` and the per-tier package icon (`tenantData.packages[slugType]`) — **[?]**

### 5 · Performance — `ReportsLeadsTrafficSection` → `LeadsStatsGraphWidget`

* Card title row: `className="px-16 mb-16"`, `justify="space-between"`, `alignItems: start`. [read]
* Title **“Performance”** — this is `item.title` off the API. Note `dashboard.js` passes
  `chartTitle={t('Breakdown By Date')}`, but that prop is **not what renders here**. [read]
* Right: `<Group template="repeat(2, 1fr)" gap 16 align center>` = `Segmented` + `DateFilter`. [read]
* Segmented options **All · For Sale · For Rent · Daily Rentals** — the fourth exists only when
  `DAILY_RENTAL_ENABLED`, and it is on screen, so KSA has it on. [read]
* Date filter label **“Last 30 Days”**, default window `getVariousDates(29)`. [read]
* Metric tabs (`item.reach_data`): **Views 24,853 · Clicks 387 · Leads 12**, each a `lead`
  statistic with a 40px icon tile at `size 1.6em`. Tab box `padding 16px 1.6em`,
  `min-width 200px`, ground white, radius 0, gutter 0. [read]
* Active tab: `linear-gradient(color-mix(in srgb, var(--primary-color) 6%, #fff) 0%, #fff 80%)`,
  `box-shadow 0px 16px 0 -1px #fff, 2px 0px 21px -10px #41414164`, **ink bar moved to `top: 0`,
  height 3px**. [read]
* Tab-bar extra (`item.data_summary`, minus the row keyed `leads`): **Calls 3 · WhatsApp 9 ·
  SMS 0 · Emails 0**, `Space size="large"`, 40px vertical dividers, `padding-inline 1.7143em`,
  preceded by a `4px` wide `blur(4px)` `#0007` rule. [read]
* Chip row: `RadioPill shape="round" size="small"` → **All · Basic · Hot · Signature**, each an
  antd `Badge` dot + label, `marginBottom 10px`. Rest ground `gray200`, checked ground
  `primary-light-3`, border `primary-light-1`, text `primary-color`, weight 700. [read]
* Body padding **24**. [read]
* The divider placement inside the extra strip: source writes `{i > 1 && <Divider/>}` over an
  array whose `leads` row is skipped in render but still counted in the index, so the first gap
  may carry no rule. The screenshot is too soft to settle it. **[?]**

### 6 · Recent Listings — `renderListings()`

* Heading row is **outside** the card: `<Row className="px-4 mb-8" justify="space-between"
  alignItems="baseline" gap 24>` → **“Recent Listings”** (`.fz-16`, weight 700, `base-color`)
  and **“View All Listings”** (`LinkWithIcon`, colour `gray700`, trailing `FiArrowUpRight`). [read]
* Table card is `<ListingContainer className="p-0">` — **no body padding**. [read]
* Columns, in order: **Property · Timeline · Performance · Status · Upgrades · Actions**.
  `Timeline` appears only for an `isCurrencyUser`; `Actions` is `fixed: 'right', width: 180`.
  [read] `listingUtilities.js` `listingTableColumnMapper(user,'active')` — and it matches the screenshot exactly.
* Per row, [read] from the screenshot: a numbered green badge on the thumbnail · price in
  **ر.س** · product tag (Basic / Hot / Signature) · a percentage · title as a teal link ·
  bed / bath / area · location · **Bayut ID** and **REGA ID** · “Posted on «date»” + info icon ·
  Views / Clicks / Leads · a **Live** pill · two 3 × 2 grids of circular icon buttons.
* Thumbnail size, row padding, row divider colour, header row height, the count badge's meaning
  and size, column widths other than `Actions: 180` — **all [?]**
* Which glyph maps to which upgrade / action, and the enabled vs. disabled rule — **[?]**

---

## TYPE

Every distinct pair on the screen, with where it is used and its token.

| token | size / weight | used on | conf |
|---|---|---|---|
| `--fs-page-title` | **20 / 700** | header “Overview” | [read] inline |
| `--fs-card-title` | **16 / 700** | every card title (`.fz-16`) | [read] |
| `--fs-card-h4` | 18 / — | `.ant-card-head-title h4`, overridden to 16 everywhere on this page | [read] |
| `--fs-base` | **14 / 400** | body, buttons, pill | [read] |
| `--fs-stat-title` | **1em = 14 / 400** | “Available Credits”, “Views”, “Calls” | [read] |
| `--fs-13` | **13 / 400** | the six breakdown stat titles (`fontSize="13px"`) | [read] |
| `--fs-stat-value` | **1.1428em ≈ 16 / 700** | inline metrics | [read] |
| `--fs-stat-lead` | **1.4285em = 20 / 700** | Views 24,853 · Available Credits 72,880 | [read] |
| `--fs-stat-leader` | **1.5714em ≈ 22 / 700** | Active 20 | [read] |
| `--fs-12` | **12 / 400** | banner message, tooltip title, chips | [read] |
| `--fs-tag` | **11 / 700** | product tags, IDs line, badge | [read] `tag-font-size` |
| `--fs-btn-sm` | 13 / 600 | `size="small"` buttons | [read] |
| `--fs-chart-tick` | **13**, colour `#182b49` | y-axis ticks | [read] |
| `--fs-chart-tick-x` | 10 | x-axis ticks | **[?]** measured, not declared |
| weights | 400 / 500 / 600 / 700 / 900 | `.fw-*` utilities | [read] |
| line-height | body **1.571** · statistic **1.4** · page title **1.2** · pill **1** | [read] |

**A real conflict, unresolved.** The styled-components theme sets
`'font-family': 'Lato, Droid Arabic Kufi, sans-serif'` while the antd v5 token block in the
*same file* sets `fontFamily: 'Figtree, Droid Arabic Kufi, sans-serif'`. Both ship. Which one
paints a given node depends on which layer wins there. I used **Lato**. **[?]**

---

## COLOUR

Named by role, every value from `src/theme/index.js`. **All [read]** unless marked.

| role | token | value |
|---|---|---|
| brand | `--primary` | `#006169` |
| brand tints | `--primary-light-1 … -4` | `#A6C8CA` `#CCDFE1` `#E1F2F0` `#F2FAFA` |
| page ground | `--bg-content` | `#F6F7FB` |
| surface | `--card-bg`, `--header-bg`, `--sider-bg` | `#fff` |
| card border | `--gray-100` | `#f0f0f0` |
| sider border | `--gray-400` | `#DEDEDE` |
| input border | `--border-normal` | `#DEDEDE` |
| hairline | `--border-light` | `#F1F2F6` |
| text — body | `--base` / `--heading` | `#222` |
| text — antd default | `--dark` | `#272B41` |
| text — muted / label | `--gray-700` | `#707070` |
| text — meta | `--light-gray` | `#868EAE` |
| text — placeholder | `--gray-600` | `#9D9D9D` |
| default button fg | `--gray-color` | `#5A5F7D` |
| success | `--success` | `#28b16d` |
| warning | `--warning` | `#f0a742` |
| danger / badge-danger | `--danger` | `#f73131` |
| info | `--info` / `--info-alt` | `#2C99FF` / `#479eeb` |
| chip rest ground | `--gray-200` | `#f5f5f5` |
| tile default ground | `--bg-gray-normal` | `#F4F5F7` |
| tag default ground | `--bg-gray-deep` | `#EFF0F3` |
| product · signature | `--color-signature` | `#af6fff` |
| product · hot | `--color-hot` | `#f73131` |
| product · basic | `--color-basic` | `#28b16d` |
| purpose · for sale | `--color-for-sale` | `#2d3e9b` |
| purpose · for rent | `--color-for-rent` | `#479eeb` |
| metric · clicks | `--color-clicks` | `#f0a742` |
| pill text | `--pill-text` | `#767676` |
| pill border | `--pill-border` | `rgb(240,240,240)` |
| classified icon | `--pill-icon` | `rgba(40,177,109,1)` |
| chart gridline | `--chart-grid` | `rgba(0,0,0,0.1)` |
| chart zero line | `--chart-zero-line` | `#e5e9f2` |
| chart tick | `--chart-tick` | `#182b49` |
| footer ground / text | `--footer-bg` / `--footer-text` | `rgba(255,255,255,.90)` / `rgba(0,0,0,0.65)` |

Tile grounds are the icon's own colour at **alpha 0.08** — `IconStyled` builds them with
`chroma(color).alpha(0.08)`. [read]

**Cannot tell:** the chart line colour and the credit-meter fill. Both are
`platform.brandColor`, which arrives from the `/platforms` API and is not in the repo.
I used `--primary`. **[?]**

---

## CHART

| item | value | conf |
|---|---|---|
| type | Chart.js line (`ChartjsAreaChart`), `fill: false` | [read] |
| series | one, `borderWidth 2`, `pointBorderColor '#fff'` | [read] |
| y range | **0 → 2500**, ticks every 500, `beginAtZero`, `min: 0` | [read] screenshot; `beginAtZero/min` [read] repo |
| y tick type | 13px, `#182b49` | [read] |
| y gridlines | `rgba(0,0,0,0.1)`, `borderDash [3,3]` | [read] |
| zero line | `#e5e9f2`, width 1 (y) / width 2 (x) | [read] |
| x gridlines | `color: 'transparent'`, `tickMarkLength: 0` | [read] |
| x ticks | `padding: 10`; **Aug 23 → Sep 21, 30 daily labels** | [read] repo; range [read] screenshot |
| tooltip | ground `#fff`, `box-shadow 0 8px 10px #9299B815`, `padding 10px 12px`, `radius 3px`, `border 1px #F1F2F6`, 5px white caret underneath, `min-width 175px` | [read] |
| tooltip title | 12px / 500 / Inter / capitalised / `margin-bottom 4`, colour `gray-color` | [read] |
| tooltip row | 13px / 500 / `dark-color`; label is `` `${metricLabel}: ${yLabel}` `` | [read] |
| tooltip on screen | **“Aug 23”** / **“Views: 0”** | [read] screenshot |
| **point markers** | visible on screen — **but the source sets `pointRadius: '0'`** (a string), so something downstream overrides it | **conflict** |
| marker radius | 2.6px | **[?]** measured |
| painted height | `height={64}` with `maintainAspectRatio: true`, so it is a *ratio*, not a CSS height | **[?]** |
| **the 30 data values** | **traced off the screenshot** — treat every point as ±40 | **[inf]** |

Two dead-code notes found while reading: `.chartjs-tooltip-key` is declared
`background: "pink"` — a quoted string, so it is invalid CSS and does nothing. And
`.tooltip-value` is `#63b963` at 22/600, a green that appears nowhere else in the theme
and is not what this tooltip variant renders.

---

## Everything I cannot tell — the questions

Answer these and I will fill them; I will not guess a number for any of them.

**Geometry**
1. Rail item corner radius, and the vertical gap between rail items.
2. The content column's outer gutter (left/right and top).
3. Card head padding — theme says 16, antd token says 12, screen looks like 24.
4. `DateFilter` field height: the 36px control height or the 44px input height?
5. Listing thumbnail box (w × h), listing row vertical padding, table header row height.
6. Chart canvas painted height at a 1440 viewport.

**Colour**
7. `platform.brandColor` for bayut.sa — drives the chart line, the credit meter and the tab ink bar.
8. `getClassificationColor()` map — the avatar and banner ring stroke.
9. `tenantData.packages[slugType].packageColor` and icon for Platinum Plus.
10. The listing score percentage colour, and its bands. The theme's `health-color-*` are pastels
    (`#FF7258 / #FFDC65 / #98DAB9`) and the screen is clearly not those.
11. The “All” chip's dot colour (`types[0].borderColor` off the reports API).

**Type**
12. **Lato or Figtree?** See the conflict above — this one changes every line of text.
13. Is the leader statistic really `1.5714em` (21.9996px), or is live a flat 22px?

**Identity**
14. The 11 rail icon glyphs and the 12 circular upgrade/action glyphs.
15. Whether the divider before “Calls” in the tab-bar extra strip renders.
16. The FEEDBACK rail — I found no source for it in `profolio-reactjs` at all.

---

## One housekeeping note

`dashboard.html` carries the real account data off your screenshot: the agency name,
ten Bayut and REGA listing IDs, prices and locations. No phone numbers or email
addresses. If this file is going anywhere beyond the team, say the word and I will
swap the table for fixtures.
