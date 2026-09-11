# The Profolio shell

Hand-written. Not regenerated.

**Every Profolio KSA screen starts here.** There is no blank canvas. A screen that does not
exist yet still has the header, side navigation and footer — so the worst case a designer ever
receives is correct chrome around an empty content area, never an improvised layout.

Source: `src/layout/withAdminLayout.js`, which composes Ant's `Header · Sider · Content ·
Footer` and hangs `AppBanner`, `AuthInfo`, `MenueItems` and `LeadNudgeToasts` off them.

Every part below is already specified in `references/components/` — the shell composes existing
entries, it does not introduce new ones.

## Default — desktop Profolio

| Region | Spec |
|---|---|
| **Header** | 74px, white. Header search · platform segmented control (multi-platform users only) · credits summary · notification badge · classified pill (min-width 148.71px) · account dropdown. Inbox hidden when `HIDE_INBOX`. |
| **Sider** | `common/navbar` with `MenueItems` — 12 entries, each permission- and flag-gated. Top block `30px 30px 0`, bottom `10px 15px 25px`. Collapse trigger 48px; zero-trigger 36 × 42px. |
| **Content** | `#F6F7FB`. `.ant-layout-content` is a grid, `grid-template-rows: auto 1fr`. Page header padding `24px 32px`. |
| **Footer** | `#fafafa`, `24px 15px`. **On KSA carries the REGA compliance block and the report-to-REGA link** (`SHOW_REGA_FOOTER`, `SHOW_REPORT_TO_REGA`). |

## Variants

`withAdminLayout.js` branches four ways. Name which one you are designing — a flat "the shell"
is wrong about a quarter of the time.

| Variant | Condition | What changes |
|---|---|---|
| `isMobile` | ≤ 992px | Sider becomes a fixed 280px drawer at `top: 75px`, sliding on a 0.35s ease-in transform. `lite-header-dropdown` replaces the account menu; `lite-sidebar-drawer` replaces the sider. Cards lose their border. Selects shrink to 40px. |
| `isMemberArea` | `HAS_MEMBER_AREA: true` on KSA | Reduced chrome. **This is the lite / member-area surface — v2, not yet specified.** Stop and say so. |
| `topMenu` | layout preference | Horizontal navigation replaces the sider. |
| `isWebView` | embedded in the app | Chrome suppressed entirely. |

## The rule

A new screen inherits **default** unless the PRD says otherwise. State the variant in the
template header so a reviewer can see which one was assumed.

## Page template header

Every `pages/<route>.md` opens with these fields. This header is also the **proposal** — filling
it in and having the designer approve it is what unlocks producing artboards.

```
shell     default | isMobile | isMemberArea | topMenu | isWebView
route     /the-route
source    src/container/pages/<dir>          # provenance, not fetched
purpose   one sentence, user-side
roles     agency owner · agency staff · individual seller — and what differs
flags     the tenant constants that change or remove it
uses      the documented components it composes
states    loading · empty · error · flag-off · no-permission
lang      en <draft|approved> · ar <pending|passed>
ga4       event names, when product supplies them in the PRD
```
