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
export const NAV = [
  ['Overview',           'SideMenuDashboard',    'dashboard.html'],
  ['Post Listing',       'PostListingIcon',      null],
  ['My Listings',        'MyListingIcon',        'listings.html'],
  ['Credits Usage',      'SideMenuQuota',        null],
  ['Inbox',              'SideMenuInbox',        null],
  ['TruLeads',           'DashboardLmsIcon',     null],
  ['Agent Performance',  'AgentPerformanceIcon', null],
  ['Reports',            'SideMenuReports',      null],
  ['Agency Staff',       'SideMenuAgency',       null],
  ['Settings',           'IoSettingsOutline',    null],
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
      <button class="pf-btn" data-variant="ghost" data-block="true" type="button" title="العربية">${icon('LanguageSwitcherIcon', 20)}</button>
      <button class="pf-btn" data-variant="ghost" data-block="true" type="button" title="Help &amp; Support">${icon('HelpSupportIcon', 20)}</button>
    </div>
  </div>
  <div class="pf-main">
    <!-- ── header ──────────────────────────────────────────────────── -->
    <header class="pf-header pf-header-fixed">
      <div class="pf-header-brand"><span class="pf-page-title">${esc(title)}</span></div>
      <div class="pf-header-actions">
        <button class="pf-btn" data-variant="link" type="button" data-open="modal-download-app">${icon('MdPhoneIphone')}<span>Download App</span></button>
        <a class="pf-classified-pill" href="#">${icon('SidebarClassifiedLinkIcon', 18)}Go to Bayut.sa</a>
        <button class="pf-btn" data-variant="primary" type="button">${icon('PostListingIcon')}<span>Post Listing</span></button>
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
    <div class="pf-modal-body">
      <div class="pf-center-column">
        <div class="pf-modal-lead">Scan the QR code to download the app</div>
        <!-- the product embeds a generated QR; a design system ships the box -->
        <div class="pf-qr pf-skeleton" role="img" aria-label="QR code placeholder"></div>
      </div>
      <div class="pf-divider-text"><span>OR</span></div>
      <!-- vendor badge art we do not ship, at the measured 111x33 / 113x35 -->
      <div class="pf-store-badges">
        <span class="pf-store-badge">App Store</span>
        <span class="pf-store-badge">Google Play</span>
      </div>
    </div>
  </div>
</div>

<!-- Notification centre. Unread rows are #F7FCFC, read rows white; the
     timestamp is 12px #9D9D9D and the glyph is the primary colour. -->
<div class="pf-popover" data-kind="notifications" id="popover-notifications" data-anchor="header-end" role="dialog" aria-label="Notifications" hidden>
  <div class="pf-noti">
    <div class="pf-noti-head">
      <div class="pf-noti-head-start">
        <h5 class="pf-noti-title">Notifications</h5>
        <button class="pf-btn" data-variant="ghost" type="button" aria-label="Refresh">${icon('MdRefresh', 16)}</button>
      </div>
      <button class="pf-btn" data-variant="link" type="button">Mark all as read</button>
    </div>
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

<!-- Account menu. auth-info-style.js:250 .user-info, :280 .dropdwon-links —
     the two list items carry a 1px gray400 top border, which is where the
     rules under the badges come from. The Nafath wordmark is the product's
     own 20x9 SVG and is not in our sprite; the label stands in for it. -->
<div class="pf-popover" data-kind="account" id="popover-account" data-anchor="header-end" role="dialog" aria-label="Account" hidden>
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
    <span class="pf-verified">Nafath Verified${icon('PiSealCheckFill', 14)}</span>
    <span class="pf-verified">REGA Verified${icon('PiSealCheckFill', 14)}</span>
  </div>
  <ul class="pf-menu-list">
    <li><a href="${href(null, 'Settings')}">${icon('FiUser', 16)}<span>Account Settings</span></a></li>
    <li><button type="button" data-close>${icon('FiLogOut', 16)}<span>Sign Out</span></button></li>
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
