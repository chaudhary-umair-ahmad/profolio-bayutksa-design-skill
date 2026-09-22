/**
 * The Profolio shell, written once.
 *
 * Rail + header + footer, exactly as deliverables/dashboard.html carries them —
 * the icon rail collapsed at 60px (the shipped default), the 60px header with
 * its three actions, bell and avatar ring. A page generator wraps its content
 * in `open()` … `close()`; the sprite and the brand wordmark are read from
 * deliverables/ at generation time so scripts/sync.mjs finds them current.
 *
 * Nav labels and order are menuList.js's, character for character.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'deliverables');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* label, icon, and the page it opens. A route we have not built yet points at
   not-built.html, which says so — better than a dead link, and it keeps the
   gaps visible while walking the prototype. */
/* NINE, not eleven. Measured on the real screen
   (data/live/listings.real.capture.json) and then traced to the source:

     Inbox    menuList.js:46 renders it only when !HIDE_INBOX, and
              tenant/bayut/constants/constants.js:240 sets HIDE_INBOX: true.
              It never appears for this tenant. We were drawing it anyway.
     TruLeads menuList.js:58 needs user.is_lms_enabled AND IS_LMS_ENABLED AND
              !HIDE_REPORTS. The tenant flag is true, so this one is per
              ACCOUNT — the real account does not have it. Kept here as a
              comment rather than deleted, because a design for an LMS account
              does show it. */
export const NAV = [
  ['Overview',           'SideMenuDashboard',    'dashboard.html'],
  ['Post Listing',       'PostListingIcon',      null],
  ['My Listings',        'MyListingIcon',        'listings.html'],
  ['Credits Usage',      'SideMenuQuota',        'credits-usage.html'],
  ['Agent Performance',  'AgentPerformanceIcon', null],
  ['Reports',            'SideMenuReports',      'reports-summary.html'],
  ['Agency Staff',       'SideMenuAgency',       null],
  ['Settings',           'IoSettingsOutline',    'user-settings-user-profile.html'],
  ['Credits & Packages', 'SideMenuPropShop',     null],
];
const href = (page, label) => page || `not-built.html?screen=${encodeURIComponent(label)}`;

export const sprite = () => {
  const f = readFileSync(join(D, 'sprite.svg'), 'utf8');
  return f.slice(f.indexOf('<svg class="pf-sprite"')).trim();
};

/* the EmptyState illustration. EmptyState.js:31 passes
   color={tenantTheme['primary-light-2']}, and the art carries its own fills,
   so it is inlined from deliverables/inline-art.html rather than sprited. */
export const emptyArt = () => readFileSync(join(D, 'inline-art.html'), 'utf8')
  .match(/<svg class="pf-emptylisting"[\s\S]*?<\/svg>/)[0]
  .replace('class="pf-emptylisting"', 'class="pf-empty-art"');

export const wordmark = () => readFileSync(join(D, 'inline-art.html'), 'utf8')
  .match(/<svg class="pf-profoliologo"[\s\S]*?<\/svg>/)[0]
  .replace('class="pf-profoliologo"', 'class="pf-wordmark"');

/* size null → the bare .i (1.2em), which is how antd sizes an icon inside a button */
export const icon = (name, size = 16) => `<svg class="i${size ? ` i-${size}` : ''}"><use href="#pf-${name}"/></svg>`;

/**
 * @param {object} o
 * @param {string} o.title       header title, e.g. "My Listings"
 * @param {string} o.current     the nav label that is aria-current
 * @param {string} o.docTitle    <title>
 * @param {string} [o.comment]   a source-map comment placed above the shell
 * @param {string} [o.instance]  extra rules for the instance-data <style> block
 * @param {number} [o.badge]     notification count
 * @param {number} [o.pct]       profile completion ring
 */
export function open({ title, current, docTitle, comment = '', instance = '', badge = 46, pct = 90, contentGap }) {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(docTitle)}</title>
<!-- the product's own faces, embedded; no network -->
<link rel="stylesheet" href="fonts.css">
<!-- THE shared stylesheet — the same file components.html links.
     This page defines no component styles of its own. If you find a rule
     here that is not in profolio.css, that is a bug. -->
<link rel="stylesheet" href="profolio.css">
<style>
/* ── INSTANCE DATA ──────────────────────────────────────────────────────
   Custom-property values carrying DATA (a percentage), not presentation.
   Kept out of the body so there is not one style attribute in the markup.
   ─────────────────────────────────────────────────────────────────────── */
.pct-${pct}{--ring-pct:${pct}}                /* profile completion score */
${instance}</style>
<!-- the interaction layer: overlays, tabs and page states. Declarative —
     the markup carries data-open / data-panel / data-state-panel and nothing else. -->
<script src="prototype.js" defer></script>
</head>
<body>
${sprite()}
${comment}
<div class="pf-shell">
  <!-- ── icon rail · collapsed (60px), the shipped default state ────── -->
  <div class="pf-rail pf-rail-fixed">
    <div class="pf-rail-brand"><span class="pf-rail-logo">${wordmark()}</span></div>
    <nav class="pf-rail-list" aria-label="Main">
${NAV.map(([label, ic, page]) => `      <a class="pf-rail-item"${label === current ? ' aria-current="page"' : ''} href="${href(page, label)}" title="${esc(label)}">${icon(ic, 20)}</a>`).join('\n')}
    </nav>
    <div class="pf-rail-bottom">
      <a class="pf-btn" data-variant="ghost" data-block="true" title="العربية" href="not-built.html?screen=${encodeURIComponent('Arabic')}">${icon('LanguageSwitcherIcon', 20)}</a>
      <a class="pf-btn" data-variant="ghost" data-block="true" title="Help &amp; Support" href="not-built.html?screen=${encodeURIComponent('Help & Support')}">${icon('HelpSupportIcon', 20)}</a>
    </div>
  </div>
  <div class="pf-main">
    <!-- ── header ──────────────────────────────────────────────────── -->
    <header class="pf-header pf-header-fixed">
      <div class="pf-header-brand"><span class="pf-page-title">${esc(title)}</span></div>
      <div class="pf-header-actions">
        <button class="pf-btn" data-variant="link" type="button" data-open="modal-download-app">${icon('MdPhoneIphone')}<span>Download App</span></button>
        <!-- the one link in the shell that LEAVES the product. It carried
             href="#", which is a dead click dressed as a destination. -->
        <a class="pf-classified-pill" href="https://www.bayut.sa/" target="_blank" rel="noopener">${icon('SidebarClassifiedLinkIcon', 18)}Go to Bayut.sa</a>
        <a class="pf-btn" data-variant="primary" href="not-built.html?screen=Post%20Listing">${icon('PostListingIcon')}<span>Post Listing</span></a>
        <button class="pf-bell" type="button" aria-label="Notifications" data-open="popover-notifications">${icon('GrNotification', 20)}<span class="pf-badge">${badge}</span></button>
        <button class="pf-avatar-button" type="button" aria-label="Account" data-open="popover-account"><span class="pf-progress-ring pct-${pct}"><span class="pf-avatar">${icon('FiUser')}</span></span></button>
      </div>
    </header>
    <main class="pf-content"${contentGap ? ` data-gap="${contentGap}"` : ''}>
`;
}

/**
 * The shell's own overlays — on every page because the header is on every page.
 * Each is measured from a product capture; the comment names which.
 */
export function shellOverlays() {
  return `
<!-- ═════ SHELL OVERLAYS ═══════════════════════════════════════════════
     Every one of these was opened on the product by the harness and measured
     before it was written. The capture behind each is named on the overlay.
       data/live/listings--modal-download-app     360x409 modal, 166 QR
       data/live/listings--popover-notifications  590x776 popover, radius 8
       data/live/listings--popover-account        400x233 popover, radius 10
     ═══════════════════════════════════════════════════════════════════ -->

<!-- Download App — the title is 20/600 here, not the modal default 16/700:
     the product passes its own <span class="fw-600 fs20"> as the title. -->
<div class="pf-mask" id="modal-download-app" hidden>
  <div class="pf-modal" data-size="small" role="dialog" aria-modal="true" aria-labelledby="dl-title">
    <div class="pf-modal-head">
      <span class="pf-modal-title" data-size="lg" id="dl-title">Get the Bayut KSA App</span>
      <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
    </div>
    <!-- BODY 346, and every band in it measured rather than stacked by eye:
           label   284x25   16/600
           QR      166x166  9px under the label
           divider 312x25   17px under the QR
           badges  312x42   16px under the divider, and they are LINKS
         This was 187 tall with no links in it, which the region diff scored
         at 17% and the overlay diff at -159. -->
    <div class="pf-modal-body">
      <div class="pf-center-column">
        <div class="pf-modal-lead">Scan the QR code to download the app</div>
        <!-- the product embeds a generated QR; a design system ships the box -->
        <div class="pf-qr" role="img" aria-label="QR code placeholder"></div>
      </div>
      <div class="pf-divider-text"><span>OR</span></div>
      <!-- vendor badge art we do not ship, at the measured 111x33 / 113x35 -->
      <div class="pf-store-badges">
        <a class="pf-store-badge" href="not-built.html?screen=App%20Store">App Store</a>
        <a class="pf-store-badge" href="not-built.html?screen=Google%20Play">Google Play</a>
      </div>
    </div>
  </div>
</div>

<!-- Notification centre. Unread rows are #F7FCFC, read rows white; the
     timestamp is 12px #9D9D9D and the glyph is the primary colour. -->
<div class="pf-popover" data-kind="notifications" id="popover-notifications" data-anchor="header-end" data-placement="bottom" role="dialog" aria-label="Notifications" hidden>
  <!-- the product draws one on every anchored overlay, pointing back at
       the header control that opened it. These two shipped without. -->
  <span class="pf-arrow" aria-hidden="true"></span>
  <div class="pf-noti">
    <div class="pf-noti-head">
      <div class="pf-noti-head-start">
        <h5 class="pf-noti-title">Notifications</h5>
        <button class="pf-btn" data-variant="ghost" type="button" aria-label="Refresh" data-noop="refetches the notification list; there is no server behind this page">${icon('MdRefresh', 16)}</button>
      </div>
      <button class="pf-btn" data-variant="link" type="button" data-noop="marks every notification read; a data mutation, not a navigation">Mark all as read</button>
    </div>
    <!-- The list is a FIXED 700-TALL SCROLL REGION (rc-virtual-list), not a
         stack that ends with the last card. Three cards of 43 with a 4px
         pitch fill 142 of it and the rest is empty — which is why the product
         popover is 776 tall on an account with three notifications. Ours
         stopped at the last card and measured 241. -->
    <div class="pf-noti-list">
      <div class="pf-noti-card" data-unread>
        <div class="pf-noti-card-meta">${icon('IoRefreshSharp', 20)}<span class="pf-noti-card-title">Your listing is live</span></div>
        <span class="pf-noti-time">an hour ago</span>
      </div>
      <div class="pf-noti-card" data-unread>
        <div class="pf-noti-card-meta">${icon('IoRefreshSharp', 20)}<span class="pf-noti-card-title">Credits expiring soon</span></div>
        <span class="pf-noti-time">a day ago</span>
      </div>
      <div class="pf-noti-card">
        <div class="pf-noti-card-meta">${icon('IoRefreshSharp', 20)}<span class="pf-noti-card-title">TruCheck visit scheduled</span></div>
        <span class="pf-noti-time">3 days ago</span>
      </div>
      <div class="pf-noti-rule"></div>
    </div>
  </div>
</div>

<!-- Account menu. auth-info-style.js:250 .user-info, :280 .dropdwon-links —
     the two list items carry a 1px gray400 top border, which is where the
     rules under the badges come from. The Nafath wordmark is the product's
     own 20x9 SVG and is not in our sprite; the label stands in for it. -->
<div class="pf-popover" data-kind="account" id="popover-account" data-anchor="header-end" data-placement="bottom" role="dialog" aria-label="Account" hidden>
  <!-- the product draws one on every anchored overlay, pointing back at
       the header control that opened it. These two shipped without. -->
  <span class="pf-arrow" aria-hidden="true"></span>
  <div class="pf-user-info">
    <div class="pf-user-row">
      <span class="pf-user-avatar">${icon('FiUser', 20)}</span>
      <div class="pf-user-meta">
        <div class="pf-user-name">Faisal Al-Harbi</div>
        <div class="pf-user-sub">
          <span class="pf-user-role">Agency User</span>${icon('GoDotFill', null)}<span class="pf-user-email">faisal@najdhorizon.example</span>
        </div>
      </div>
    </div>
    <!-- ONE tag at 152x26, then a 368x34 row — not two identical spans. The
         second badge carries the Nafath wordmark and is 8px taller. -->
    <span class="pf-verified">Nafath Verified${icon('PiSealCheckFill', 14)}</span>
    <div class="pf-verified-row"><span class="pf-verified" data-size="lg">REGA Verified${icon('PiSealCheckFill', 14)}</span></div>
  </div>
  <!-- both items are LINKS in the product (400x50 each), and Sign Out was a
       button here, which is one fewer link than the product has -->
  <ul class="pf-menu-list">
    <li><a href="${href(null, 'Settings')}">${icon('FiUser', 16)}<span>Account Settings</span></a></li>
    <li><a href="not-built.html?screen=Sign%20Out">${icon('FiLogOut', 16)}<span>Sign Out</span></a></li>
  </ul>
</div>`;
}

export function close({ year = 2026, overlays = '', states = '' } = {}) {
  return `    </main>
    <footer class="pf-footer">© ${year} – All Rights Reserved</footer>
  </div><!-- /.pf-main -->
</div><!-- /.pf-shell -->
${shellOverlays()}
${overlays}
${states}
</body>
</html>
`;
}

export { esc };
