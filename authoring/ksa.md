# Bayut Profolio KSA

Hand-written. Not regenerated — the codebase cannot tell you most of this.

Sources: `product-agent` v4.3.0 (`references/products/bayut-ksa.md`, `product-knowledge.md`),
confirmed by Product 2026-08-13 and 2026-08-21; plus the Profolio codebase where noted.

## Identity

- Market **KSA** · business **Bayut** · vertical **Property**
- Tenant key `bayut` (`REACT_APP_TENANT`), cookie domain `.bayut.sa`
- Surface **profolio.bayut.sa**, repo `profolio-reactjs`
- Users: **agency owners · agency staff · individual sellers**

## What makes KSA different: REGA

REGA — the Saudi real-estate licensing regime — exists **only here**. Anything touching listing
creation, identity or posting eligibility behaves differently than on any other Bayut. Never
port a posting design from another market without walking through these.

- **Ad-licence flow** — individual vs agency licences (`ENABLE_FAL_LICENSE`)
- **Two-step draft** — a listing does not go live in one action. Post-listing is a multi-state
  flow, not a form; every spec needs a draft state.
- **OTP step** (`ENABLE_FAL_LICENSE_OTP_VERIFICATION`)
- **Nafath** identity verification (`ENABLE_NAFATH`)
- **Daily-rental permits** (`DAILY_RENTAL_ENABLED`) — a listing subtype with its own
  compliance fields
- **Non-Saudi national limits** — posting restrictions by nationality
- Regulator surfaces: `SHOW_REGA_DETAIL` · `SHOW_REPORT_TO_REGA` · `SHOW_REGA_FOOTER` ·
  `SHOW_NATIONAL_ADDRESS`

Settle any compliance question with the PM **before** the design is final. A design that leaves
a compliance question open reads to the team as not-ready.

## House display rules

These are checks a design either passes or fails.

| Rule | Detail |
|---|---|
| Currency | Renders **ر.س**. Flag any spec or design showing "SAR". |
| Area | **Sq. M.** |
| VAT | **15%**, and never on the same line as another tax. A layout constraint on cart and checkout, not a copy rule. |
| Language | Arabic is the user's first language, but **English is designed and approved first**; Arabic follows. |

## Monetisation

Bayut is a **credits** model — not Zameen's quotas, not a free-tier-plus-premium. Packages,
credit pools, top-ups, wallet, add-ons and agency tiers all sit on it.

When a feature touches products, packages, credits or tiers, pin down: which products and tiers
are affected, expiry behaviour, and which payment methods.

Payment methods configured for KSA (`PAYMENT_METHODS`): credit/debit via Checkout,
**Tamara**, **Tabby**, **Apple Pay** (hidden off mobile/Safari). BNPL is KSA-only and has no
design coverage yet.

Purchases and contracts have a **Jarvis** connection. Note it; do not design it.

## Surfaces, and where the boundaries are

- **Profolio** — this system. Agent- and seller-facing. Bilingual EN/AR with RTL mirroring.
- **Profolio-lite / member area** — a real second surface. Own favicon, manifest, logo set and
  font stack (`FONT_FAMILY_LITE: 'Lato, Droid Arabic Kufi, sans-serif'`), referenced across 12
  files, and KSA has `HAS_MEMBER_AREA: true`. **v2 — not yet specified.** Say so rather than
  applying Profolio chrome to it.
- **Internal Console / Control Panel** — different surface, different users (ops, moderation,
  finance), English-only chrome. The knowledge base writes "Profolio (CP)" loosely in places;
  do not take "CP" as proof a screen is the Console — check who the users are.
- **Discovery pages** — home, search, listing detail, public agency and seller profiles.
  **Strat owns these.** Not a Profolio design task.

## Known gaps

Look these up rather than assuming:

- Moderation reject reasons and their labels
- Agency tier definitions and what each unlocks
- Which listing states exist and what moves a listing between them

## Known defects in the codebase

Found while building this system. Neither is fixed.

- **`TIMEZONE: 'Asia/Karachi'`** on the KSA tenant — should be `Asia/Riyadh` (UTC+3, not UTC+5).
  Copy-pasted across bayut, oman, qatar, bahrain, jordan and zameen. Currently harmless because
  nothing outside the constants files reads it; a two-hour error for the first feature that does.
- **The design export's flag pointer is wrong.** Its README says feature flags live in
  `src/utility/env.js`. They resolve from `tenantConstants` in
  `src/tenant/bayut/constants/constants.js`. Use `kb/product/flags.html`.
