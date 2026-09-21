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

export const NAV = [
  ['Overview',           'SideMenuDashboard'],
  ['Post Listing',       'PostListingIcon'],
  ['My Listings',        'MyListingIcon'],
  ['Credits Usage',      'SideMenuQuota'],
  ['Inbox',              'SideMenuInbox'],
  ['TruLeads',           'DashboardLmsIcon'],
  ['Agent Performance',  'AgentPerformanceIcon'],
  ['Reports',            'SideMenuReports'],
  ['Agency Staff',       'SideMenuAgency'],
  ['Settings',           'IoSettingsOutline'],
  ['Credits & Packages', 'SideMenuPropShop'],
];

export const sprite = () => {
  const f = readFileSync(join(D, 'sprite.svg'), 'utf8');
  return f.slice(f.indexOf('<svg class="pf-sprite"')).trim();
};

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
</head>
<body>
${sprite()}
${comment}
<div class="pf-shell">
  <!-- ── icon rail · collapsed (60px), the shipped default state ────── -->
  <div class="pf-rail pf-rail-fixed">
    <div class="pf-rail-brand"><span class="pf-rail-logo">${wordmark()}</span></div>
    <nav class="pf-rail-list" aria-label="Main">
${NAV.map(([label, ic]) => `      <a class="pf-rail-item"${label === current ? ' aria-current="page"' : ''} href="#" title="${esc(label)}">${icon(ic, 20)}</a>`).join('\n')}
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
        <button class="pf-btn" data-variant="link" type="button">${icon('MdPhoneIphone')}<span>Download App</span></button>
        <a class="pf-classified-pill" href="#">${icon('SidebarClassifiedLinkIcon', 18)}Go to Bayut.sa</a>
        <button class="pf-btn" data-variant="primary" type="button">${icon('PostListingIcon')}<span>Post Listing</span></button>
        <button class="pf-bell" type="button" aria-label="Notifications">${icon('GrNotification', 20)}<span class="pf-badge">${badge}</span></button>
        <span class="pf-progress-ring pct-${pct}"><span class="pf-avatar">${icon('FiUser')}</span></span>
      </div>
    </header>
    <main class="pf-content"${contentGap ? ` data-gap="${contentGap}"` : ''}>
`;
}

export function close({ year = 2026 } = {}) {
  return `    </main>
    <footer class="pf-footer">© ${year} – All Rights Reserved</footer>
  </div><!-- /.pf-main -->
</div><!-- /.pf-shell -->
</body>
</html>
`;
}

export { esc };
