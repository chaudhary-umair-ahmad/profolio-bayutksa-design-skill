#!/usr/bin/env node
/**
 * Composes deliverables/listings.html — the My Listings page — from
 * data/fixtures/listings.json and the ten rows in data/fixtures/dashboard.json.
 *
 * Only classes that exist in deliverables/components.html. No style
 * attributes. The row markup is the dashboard's, class for class, so the two
 * tables cannot drift; the shell comes from scripts/pages/shell.mjs.
 *
 * Layout, from data/layout/listings.json (the harness render):
 *   filter bar 1332×95  →  table card (tabs in the head, 10 rows)  →  pager 40
 *
 *   node scripts/pages/listings.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, close, icon, esc, emptyArt } from './shell.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const page = read('data/fixtures/listings.json');
const rows = read(join('data/fixtures', page.rowsFrom)).recentListings;

/* ── the listing row, exactly as dashboard.html writes it ─────────────── */
const PRODUCT = {
  basic:     { label: 'Basic',     icon: 'IconBasic' },
  hot:       { label: 'Hot',       icon: 'IconSuperHot' },
  signature: { label: 'Signature', icon: 'BsFillLightningChargeFill' },
};
/* THREE states, and the default one is ENABLED AND COLOURED.
   data/live/listings.real.capture.json — nine of its ten rows show six
   enabled circles, two of those carry an applied tick, and one row shows
   2 enabled · 1 applied · 3 disabled. So all three occur, on one screen:

     enabled   the product's colour at 10% under that colour, opacity 1
     applied   the same, plus the 14px #28b16d tick (upgrade-icons.js:50)
     disabled  #F4F5F7 under rgb(173,180,210) at 0.54 — platformActions.js:142
               disables a circle that is neither applied nor applicable

   Yesterday I changed this page to render ALL SIX DISABLED on every row,
   because every circle in the harness capture came back disabled. That is
   what an account with no credits looks like, not what the product does.
   The colourful version this replaced was closer to right than its
   replacement — the error was calling a fixture's state a rule.

   `applicable` here stands for "this account can buy it", which the real
   account can. The fixture row's `product` is the applied one. */
/* ── what each row is FOR ──────────────────────────────────────────────────
   The same roles harness/fixtures.mjs gives the ten API rows, kept in step on
   purpose: the page shows the states the harness captured rather than ten
   copies of one row. Ten identical rows are how this design system got its
   wrong rules — "five row actions", "every circle disabled" — and one row per
   state is the cheapest guard against getting them again.

     0  the plain live listing          5  no discount offer → six actions
     1  rejected, with reasons          6  booked dates
     2  a REGA expiry date              7  pending OTP → Publish Now
     3  applied + requested             8  services not applicable
     4  daily rental → Mark as Booked   9  daily rental again                */
const ROLE = (i) => ({
  rejected:    i === 1,
  regaExpiry:  i === 2,
  requested:   i === 3,
  dailyRental: i === 4 || i === 9,
  noDiscount:  i === 5,
  booked:      i === 6,
  otpPending:  i === 7,
  servicesOff: i === 8,
});

/* THREE states, and the default one is ENABLED AND COLOURED.
   data/live/listings.real.capture.json — nine of its ten rows show six
   enabled circles, two of those carry an applied tick, and one row shows
   2 enabled · 1 applied · 3 disabled. So all three occur, on one screen:

     enabled   the product's colour at 10% under that colour, opacity 1
     applied   the same, plus the 14px #28b16d tick (upgrade-icons.js:50)
     pending   RequestedStateIcon in the warning colour (upgrade-icons.js:58) —
               and pending is `is_applied && status === 'requested'`, BOTH
               (products.js:5-9), which is why it had never rendered here
     disabled  #F4F5F7 under rgb(173,180,210) at 0.54 — platformActions.js:142
               disables a circle that is neither applied nor applicable

   Yesterday I changed this page to render ALL SIX DISABLED on every row,
   because every circle in the harness capture came back disabled. That is
   what an account with no credits looks like, not what the product does.

   Every enabled circle opens QuotaCreditModal. The three SERVICES open it with
   the ServiceOptions form, which is 132px taller — two shapes of one overlay,
   both measured (listings--upgrade-signature 708x414, --photography 708x546).

   The tooltip strings are products.js's own title / appliedTitle / pendingTitle,
   not paraphrases: "Mark Signature" becomes "Signature Listing" when applied. */
const UPGRADE_DEFS = [
  ['signature', 'BsFillLightningChargeFill', 'Mark Signature',              'Signature Listing',              null,                              false],
  ['hot',       'IconSuperHot',              'Mark Hot',                    'Hot Listing',                    null,                              false],
  ['refresh',   'MdRefresh',                 'Mark Refresh',                'Refresh Listing',                null,                              false],
  ['photo',     'HiCamera',                  'Request Photography Service', 'Photography Service Applied',    'Photography Service Requested',   true],
  ['video',     'HiVideoCamera',             'Request Videography Service', 'Videography Service Applied',    'Videography Service Requested',   true],
  ['drone',     'DroneIcon',                 'Request Drone Footage',       'Drone Footage Service Applied',  'Drone Footage Service Requested', true],
];
/* platformActions.js:115-136 — an unavailable ADD-ON says so; an unavailable
   circle that is not a service gets no tooltip at all. Measured both ways:
   listings--tooltip-upgrade-unavailable is 250x58, listings--tooltip-upgrade-none
   opens nothing, which is itself the measurement. */
const UNAVAILABLE = 'This service is not available in your region yet.';

const UPGRADES = (r, i) => {
  const role = ROLE(i);
  return UPGRADE_DEFS.map(([tone, ic, title, appliedTitle, pendingTitle, isService]) => {
    const applied = r.product === tone;
    const pending = role.requested && tone === 'photo';
    const off = !applied && !pending && (r.upgradesApplicable === false || (role.servicesOff && (isService || tone === 'refresh')));
    const tip = applied ? appliedTitle : pending ? pendingTitle : off ? (isService ? UNAVAILABLE : null) : title;
    return { tone, ic, applied, pending, off, tip, isService };
  });
};

/* SIX, measured on the real screen — data/live/listings.real.capture.json,
   every one of its ten rows.

   This said FIVE, and said so confidently: "the product's Actions cell was
   counted in the state capture … and each was clicked to see what it opens."
   All true, and all of it against a FIXTURE listing. That listing offers no
   Sell-or-Rent action, so the harness rendered five and I wrote five down as
   the product's rule.

   THE ORDER IS THE PRODUCT'S — listingUtilities.js:9 listingRowActions.ksa:

     trucheck · listing_detail · listing_detail_drawer · edit_listing ·
     sell_rent_listing · booking · delete_listing

   Seven entries, and TWO are conditional: `sell_rent_listing` returns null
   unless the listing is discountable (:236) and `booking` unless it is a daily
   rental (:238). That is why the real page shows six on most rows — the
   seventh is conditional, not missing — and why one row here shows five.

   The tooltips are the product's own (table-actions.js:62-109), measured:
   Edit 66x40 · Preview 92x40 · View on Bayut 132x40 · Delete 84x40 ·
   Apply Discount 137x40. */
const ACTIONS = (r, i) => {
  const role = ROLE(i);
  return [
    ['TruCheck Eligible',  'TruCheckIcon',        'modal-trucheck'],
    /* the one action that LEAVES the app — openExternalUrl(item.public_url),
       listingUtilities.js:251. A link, with a real destination. */
    ['View on Bayut',      'FiArrowUpRight',      { external: 'https://www.bayut.sa/' }],
    ['Preview',            'IoMdEye',             'drawer-listing-detail'],
    ['Edit',               'MdEdit',              null],
    /* the tooltip says "Apply Discount" (listingUtilities.js:222), even though
       the icon type is sell-rent-listing and the generic label map calls it
       "Sell or Rent Property". The tooltip is what a user reads. */
    ...(role.noDiscount ? [] : [['Apply Discount', 'IconSellRentListing', null]]),
    ...(role.dailyRental ? [['Mark as Booked', 'MdDateRange', 'modal-booking']] : []),
    ['Delete',             'HiOutlineTrash',      'modal-delete'],
  ];
};
const [beds, baths, area] = ['IconBedroom', 'IconBathroom', 'IconAreaSize'];

/* Which columns each status tab renders, from listingUtilities.js:402
   `listingTableColumnMapper(user, disposition)`. This is not cosmetic: Draft
   trades Performance for Publish, Pending drops both, Removed carries both.
   Timeline is conditional on user.isCurrencyUser, which a KSA agency user is. */
const COLUMNS = {
  active:  ['property', 'timeline', 'performance', 'status', 'upgrades', 'actions'],
  draft:   ['property', 'timeline', 'status', 'publish', 'actions'],
  pending: ['property', 'timeline', 'status', 'actions'],
  removed: ['property', 'timeline', 'performance', 'status', 'publish', 'actions'],
};
const HEAD = {
  property:    ['Property', 'col-property'],
  timeline:    ['Timeline', ''],
  performance: ['Performance', ''],
  status:      ['Status', ''],
  /* Upgrades and Publish are the SAME component (PlatformListingActions) under
     two titles — hence one class, col-platform-actions in the product. */
  upgrades:    ['Upgrades', 'col-upgrades'],
  publish:     ['Publish', 'col-upgrades'],
  actions:     ['Actions', 'col-actions'],
};

const CELL = {
  property: (r, i) => {
    const p = PRODUCT[r.product];
    const role = ROLE(i);
    return `            <td class="col-property">
              <div class="pf-listing">
                <span class="pf-listing-thumb"><span class="pf-listing-count">${r.images}</span>${role.booked
                  /* listing-purpose.js:217 — a Tooltip'd chip over the thumbnail,
                     and only when the listing has booked ranges. 230x40 */
                  ? `<span class="pf-tag" data-tone="booked" data-tip="Booked Until ${esc(r.posted)}" data-states="tooltip-booked">Booked</span>` : ''}</span>
                <div>
                  <div class="pf-listing-price"><bdi>ر.س</bdi> ${r.price} <span class="pf-tag" data-tone="${r.product}">${icon(p.icon, 14)}${p.label}</span> <span class="pf-score" data-band="medium" data-open="popover-health" data-hover data-placement="right" tabindex="0" role="button">${r.score}</span></div>
                  <!-- NOT A LINK. listing-purpose.js:261 renders the price and
                       title as plain text; the product gives a listing no title
                       link at all on this screen. This carried href="#" on
                       thirteen rows, which is a dead click pretending to be a
                       feature the product does not have. -->
                  <span class="pf-listing-title">${esc(r.title)}</span>
                  <div class="pf-listing-specs">${r.beds > 0
                    ? `<span>${icon(beds, 14)} ${r.beds}</span><span>${icon(baths, 14)} ${r.baths}</span>`
                    /* beds 0 → the label "Studio", and the BATH SPEC IS DROPPED
                       ENTIRELY. staticLists.js:288 renders '' for beds when the
                       count is 0; the real page shows two specs on such a row,
                       not three — measured on every row of listings.real. */
                    : `<span>${icon(beds, 14)} Studio</span>`}<span>${icon(area, 14)} ${esc(r.area)}</span></div>
                  <div class="pf-listing-loc">${esc(r.location)}</div>
                  <div class="pf-listing-ids"><span>Bayut ID: ${r.bayutId}</span><span>REGA ID: ${r.regaId}${role.regaExpiry
                    /* listing-purpose.js:346 — renders ONLY when the listing
                       carries a rega expiry date, which is why no capture in
                       this system contained it until a fixture row had one */
                    ? ` <button class="pf-info" type="button" aria-label="REGA expiry" data-open="popover-rega" data-hover data-placement="top">${icon('AiOutlineInfoCircle', 14)}</button>` : ''}</span></div>
                </div>
              </div>
            </td>`;
  },
  /* expiry-renewal.js:60 — the glyph is AiOutlineInfoCircle, not BsInfoLg.
     BsInfoLg is the CreditsQuota card's, and this page was drawing it here. */
  timeline: (r) => `            <td>Posted on ${esc(r.posted)} <button class="pf-info" type="button" aria-label="Posted on" data-open="popover-timeline" data-hover data-placement="top">${icon('AiOutlineInfoCircle', 14)}</button></td>`,
  /* listing-stats.js:93 — LEADS ONLY. Views and Clicks carry no icon and no
     tooltip; all three had one here. */
  performance: (r) => `            <td>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Views</span><span class="pf-stat-value">${r.views}</span></div></div>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Clicks</span><span class="pf-stat-value">${r.clicks}</span></div></div>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Leads ${`<button class="pf-info" type="button" aria-label="Leads breakdown" data-open="popover-leads" data-hover data-placement="top">${icon('AiOutlineInfoCircle', 14)}</button>`}</span><span class="pf-stat-value">${r.leads}</span></div></div>
            </td>`,
  /* the pill is inert (platforms-status.js:12). The info icon beside it is the
     ONE click-triggered popover in the table body, and it renders only when the
     disposition carries comments — listingUtilities.js:100 sets those for
     `rejected` alone. Status was hardcoded "Live" on every row here, including
     the Draft and Pending tabs. */
  status: (r, i) => {
    const role = ROLE(i);
    const [label, tone] = role.rejected ? ['Rejected', 'red']
      : role.otpPending ? ['Pending OTP Verification', '']
      : ['Live', 'green'];
    return `            <td><span class="pf-status-pill"${tone ? ` data-status="${tone}"` : ''}>${label}</span>${role.rejected
      ? ` <button class="pf-info" data-tone="danger" type="button" aria-label="Rejection reasons" data-open="popover-status" data-placement="right">${icon('AiOutlineInfoCircle', 14)}</button>` : ''}</td>`;
  },
  upgrades: (r, i) => {
    const role = ROLE(i);
    /* listingUtilities.js:42-49 — the six circles are gated to `live`, and
       publish to not-posted/expired/pending-otp. A row is one or the other,
       never both, and a rejected row gets NEITHER. */
    if (role.rejected) return `            <td class="col-upgrades"></td>`;
    if (role.otpPending) return `            <td class="col-upgrades">
              <button class="pf-btn" data-variant="tint" data-block="true" type="button" data-open="modal-otp"><span>Publish Now</span></button>
            </td>`;
    return `            <td class="col-upgrades">
              <div class="pf-action-grid" data-dense>
${UPGRADES(r, i).map(({ tone, ic, applied, pending, off, tip, isService }) => {
  /* an applied circle is disabled too — platformActions.js:142 disables both
     ends: nothing to buy when it is already yours. A disabled circle still
     carries its tooltip, so data-tip sits on the WRAPPER, which is where antd
     puts it too. */
  const dis = applied || pending || off;
  const tipAttr = tip ? ` data-tip="${esc(tip)}"` : '';
  /* which captured tooltip this wrapper reproduces, so scripts/qa-design.mjs
     can reach it by name. The harness hovered row 0's first and fourth
     circles, row 3's first and fourth, and row 8's third and fourth. */
  const st = {
    '0-signature': 'tooltip-upgrade', '0-photo': 'tooltip-upgrade-service',
    '3-signature': 'tooltip-upgrade-applied', '3-photo': 'tooltip-upgrade-pending',
    '8-refresh': 'tooltip-upgrade-none', '8-photo': 'tooltip-upgrade-unavailable',
  }[`${i}-${tone}`];
  const stAttr = st ? ` data-states="${st}"` : '';
  const state = off ? ' data-tone="muted"' : ` data-tone="${tone}"`;
  return `                <span class="pf-round-action-wrap"${tipAttr}${stAttr}><button class="pf-round-action"${state}${applied ? ' data-applied' : ''}${pending ? ' data-pending' : ''} type="button" aria-label="${esc(tip || tone)}"${dis ? ' disabled' : ` data-open="${isService ? 'modal-quota-service' : 'modal-quota'}"`}>${icon(ic, applied ? null : 16)}</button>${applied ? `<span class="pf-applied-check">${icon('HiCheck', null)}</span>` : ''}${pending ? `<span class="pf-pending-mark">${icon('MdRefresh', null)}</span>` : ''}</span>`;
}).join('\n')}
              </div>
            </td>`;
  },
  actions: (r, i) => `            <td class="col-actions">
              <div class="pf-action-grid">
${ACTIONS(r, i).map(([label, ic, opens]) => {
  /* the harness hovered Actions[1] of row 0 — View on Bayut, 132x40 */
  const tip = ` data-tip="${esc(label)}" data-placement="left"${i === 0 && label === 'View on Bayut' ? ' data-states="tooltip-action"' : ''}`;
  /* an action that opens an overlay is a button; one that NAVIGATES is a link,
     the same way the rail handles a screen we have not built; the one that
     LEAVES the app is a link to the classified site. None of them is a dead
     click. */
  if (opens && opens.external) return `                <a class="pf-round-action" aria-label="${label}"${tip} href="${opens.external}" target="_blank" rel="noopener">${icon(ic)}</a>`;
  if (opens) return `                <button class="pf-round-action" type="button" aria-label="${label}"${tip} data-open="${opens}">${icon(ic)}</button>`;
  return `                <a class="pf-round-action" aria-label="${label}"${tip} href="not-built.html?screen=${encodeURIComponent(label)}">${icon(ic)}</a>`;
}).join('\n')}
              </div>
            </td>`,
};
CELL.publish = CELL.upgrades;

const row = (cols) => (r, i) => `          <tr>\n${cols.map((c) => CELL[c](r, i)).join('\n')}\n          </tr>`;

/* ── the filter bar ───────────────────────────────────────────────────── */
/* which listbox each select opens. Both panels are measured
   (listings--select-purpose 245x137 flat, --select-property-type 245x278
   grouped) and they are DIFFERENT panels, not one panel at two heights. */
const LISTBOX = { purpose_id: 'listbox-purpose', type_id: 'listbox-property-type' };

const field = (f, i) => `        <div class="pf-field">
          <label class="pf-field-label" for="f-${f.key}">${esc(f.label)}</label>
${f.type === 'input'
  ? `          <span class="pf-input"><input id="f-${f.key}" type="text" placeholder="${esc(f.placeholder)}"><span class="pf-input-suffix"></span></span>`
  : `          <button class="pf-select" id="f-${f.key}" type="button" aria-haspopup="listbox" data-open="${LISTBOX[f.key]}" data-placement="bottom"><span class="pf-placeholder">${esc(f.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`}
        </div>`;

/* ── tabs + pager ─────────────────────────────────────────────────────── */
const panelId = (t) => 'tab-' + t.label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
/* the label sits in its own span, as antd's .ant-tabs-tab-btn does — without
   it the QA paired the product's 74x22 text strip against our 74x46 button
   and read 40% of pixels different on two identical labels */
const tab = (t) => `          <button class="pf-tab" role="tab"${t.current ? ' aria-selected="true"' : ''} type="button" data-panel="${panelId(t)}"><span class="pf-tab-label">${esc(t.label)} (${t.count})</span></button>`;
const pg = page.pagination;
/* dataTable.js:65-86 pushes `page=<n>` into the URL and refetches, and there
   is no second page of fixture rows to fetch. So these say so rather than
   pretending: data-noop is a control that cannot work here AND KNOWS IT, which
   is what keeps it out of the dead count in scripts/census.mjs.
   `data-nav` used to be the only attribute on prev/next, and prototype.js has
   never read it — a dead click that looked wired. */
/* no angle brackets in an attribute value: scripts/census.mjs reads the
   page with a regex, and a `>` inside a value ends the tag as far as it is
   concerned — three working controls counted as dead the first time round. */
const NOPAGE = 'the pager pushes the page number into the URL and refetches; there is one page of fixture rows';
const pager = `      <ul class="pf-pagination">
        <li class="pf-page-item"${pg.current === 1 ? ' aria-disabled="true"' : ''}><button type="button" aria-label="Previous page"${pg.current === 1 ? ' disabled' : ` data-noop="${NOPAGE}"`}>${icon('LeftOutlined', 12)}</button></li>
${Array.from({ length: pg.pages }, (_, i) => i + 1).map((n) => `        <li class="pf-page-item"${n === pg.current ? ' aria-current="page"' : ''}><button type="button" data-noop="${NOPAGE}">${n}</button></li>`).join('\n')}
        <li class="pf-page-item"${pg.current === pg.pages ? ' aria-disabled="true"' : ''}><button type="button" aria-label="Next page"${pg.current === pg.pages ? ' disabled' : ` data-noop="${NOPAGE}"`}>${icon('RightOutlined', 12)}</button></li>
      </ul>`;

/* ── the page ─────────────────────────────────────────────────────────── */
const comment = `<!-- ═══════════════════════════════════════════════════════════════════
     MY LISTINGS — composed from data/fixtures/listings.json by scripts/pages/listings.mjs
     Structure follows src/tenant/bayut/components/listing/listings.js:
       <Filters filtersList={filtersList}/>               → .pf-filter-bar
       <DataTable renderBanner tabs={TabsStyled}>          → .pf-table-card
         <Card contain-tabs> head: status tabs             →   .pf-table-card-head > .pf-tabs
         body: <Table columns={listingTableColumnMapper}>  →   .pf-table
       <Pagination showSizeChanger={false}>                → .pf-pagination
     Measured against data/live/listings.capture.json — see data/layout/listings.json.
     ═══════════════════════════════════════════════════════════════════════ -->`;

/* ── the page's overlays ─────────────────────────────────────────────────
   Every one has a product capture behind it. Nothing here was drawn from
   imagination; the comment on each names the file it was measured from. */
const overlays = `
<!-- data/live/listings--modal-delete — 620 wide, radius 8, five reasons, Cancel · Delete -->
<div class="pf-mask" id="modal-delete" hidden>
  <div class="pf-modal" role="dialog" aria-modal="true" aria-labelledby="del-title">
    <div class="pf-modal-head">
      <span class="pf-modal-title" id="del-title">Delete Listing</span>
      <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
    </div>
    <div class="pf-modal-body">
      <p><strong>Why are you deleting your listing?</strong></p>
      <div class="pf-stack">
${['Property is no longer available', 'Rented out through Bayut', 'Sold through Bayut', 'Rented out through another source', 'Other']
  .map((r, i) => `        <label class="pf-radio"><input type="radio" name="delete-reason" value="${i + 1}"><span>${r}</span></label>`).join('\n')}
      </div>
    </div>
    <div class="pf-modal-foot">
      <button class="pf-btn" type="button" data-close><span>Cancel</span></button>
      <button class="pf-btn" data-variant="primary" type="button" data-close><span>Delete</span></button>
    </div>
  </div>
</div>

<!-- data/live/listings--modal-trucheck — 620x376 -->
<div class="pf-mask" id="modal-trucheck" hidden>
  <div class="pf-modal" role="dialog" aria-modal="true" aria-labelledby="tc-title">
    <div class="pf-modal-head">
      <span class="pf-modal-title" id="tc-title">TruCheck Eligible</span>
      <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
    </div>
    <div class="pf-modal-body">
      <p>TruCheck is a cutting-edge technology solution that allows real estate agents to easily validate the properties they list on Bayut.</p>
    </div>
    <div class="pf-modal-foot">
      <button class="pf-btn" type="button" data-close><span>Close</span></button>
    </div>
  </div>
</div>

<!-- data/live/design-capture-flows-only-booking — 800 wide, head 57, body 104,
     foot 73. Reachable only from a daily-rental row, which is the product's
     own rule (listingUtilities.js:238) rather than a simplification here. -->
<div class="pf-mask" id="modal-booking" hidden>
  <div class="pf-modal" data-size="large" role="dialog" aria-modal="true" aria-labelledby="bk-title">
    <div class="pf-modal-head">
      <span class="pf-modal-title" id="bk-title">Mark as Booked</span>
      <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
    </div>
    <!-- NO LABEL. The product's body is 104 tall: 24 of padding each side and
         a single 40-tall field in a 56-tall space item. A label here made ours
         143 and the QA read modal.body as 100% different. -->
    <div class="pf-modal-body">
      <div class="pf-field">
        <button class="pf-select" id="bk-range" type="button" data-open="popover-date-range" data-placement="bottom"><span class="pf-placeholder">Select Date Range</span><span class="pf-select-arrow">${icon('MdDateRange', 16)}</span></button>
      </div>
    </div>
    <!-- the footer's buttons are 40 tall (86 and 113 wide), not the 36 a
         default-size pf-btn draws -->
    <div class="pf-modal-foot">
      <button class="pf-btn" data-size="large" type="button" data-close><span>Cancel</span></button>
      <button class="pf-btn" data-variant="primary" data-size="large" type="button" data-close><span>Add Range</span></button>
    </div>
  </div>
</div>

<!-- data/live/listings--action-detail-drawer — 576 wide, head 63, body 837
     with a 528 content column (24 each side). LOADED, not the skeleton: the
     drawer fetches /api/surge/listings/:id/edit (surgePostListingEndpoints.js:65)
     and that call went unanswered, so the transformer threw inside the drawer
     and every capture of it came back blank. The harness answers it now.
       gallery  528x424, with a 51x36 count button over it
       head     a secondary label, the price at 20/700 in the primary colour,
                an h5 title, then a 299x20 spec row of three items
       list     an h5 and a 528x300 split list
       about    an h5 and a single ellipsed line -->
<div class="pf-mask" id="drawer-listing-detail-mask" hidden></div>
<div class="pf-drawer" data-kind="detail" id="drawer-listing-detail" data-states="action-detail-drawer" data-mask="drawer-listing-detail-mask" role="dialog" aria-modal="true" aria-labelledby="ld-title" hidden>
  <div class="pf-drawer-head">
    <div class="pf-modal-title" id="ld-title">Listing Details</div>
    <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
  </div>
  <div class="pf-drawer-body">
    <div class="pf-detail-gallery">
      <span class="pf-detail-photo"></span>
      <button class="pf-btn" data-variant="default" data-size="small" type="button" data-noop="the gallery pages through the listing's images; this page carries one placeholder">${icon('HiCamera', 14)}<span>${esc(String(rows[0].images))}</span></button>
    </div>
    <div class="pf-detail-head">
      <span class="pf-detail-label">Price</span>
      <div class="pf-detail-price"><bdi>ر.س</bdi> ${esc(rows[0].price)}</div>
      <div class="pf-detail-title">${esc(rows[0].title)}</div>
      <div class="pf-listing-specs"><span>${icon(beds, 14)} ${rows[0].beds}</span><span>${icon(baths, 14)} ${rows[0].baths}</span><span>${icon(area, 14)} ${esc(rows[0].area)}</span></div>
    </div>
    <div class="pf-detail-section">
      <div class="pf-detail-h">Listing Information</div>
      <dl class="pf-detail-list">
${[['Bayut ID', rows[0].bayutId], ['REGA Ad License', rows[0].regaId], ['Purpose', 'For Sale'], ['Type', 'Floor'], ['Location', rows[0].location], ['Posted on', rows[0].posted]]
  .map(([k, v]) => `        <div class="pf-detail-row"><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('\n')}
      </dl>
    </div>
    <div class="pf-detail-section">
      <div class="pf-detail-h">About this property</div>
      <p class="pf-detail-about">A well-presented unit in a quiet residential block, close to schools and daily amenities.</p>
    </div>
  </div>
</div>

<!-- data/live/listings--drawer-filters — 450 wide, head 91, foot 91, mask 0.45 -->
<div class="pf-mask" id="drawer-filters-mask" hidden></div>
<div class="pf-drawer" data-kind="filters" id="drawer-filters" data-mask="drawer-filters-mask" role="dialog" aria-modal="true" aria-labelledby="flt-title" hidden>
  <div class="pf-drawer-head">
    <div>
      <div class="pf-modal-title" id="flt-title">Filters</div>
      <div class="pf-listing-loc">Apply filters to organize data accordingly</div>
    </div>
    <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
  </div>
  <div class="pf-drawer-body">
    <div class="pf-stack">
${/* the NON-INLINE filters — the four in the bar are not repeated here
      (filters.js:62). Location is DISABLED until a city is chosen, which is
      the product's own rule (cityLocationFilter.js:200) and not a gap. */
  [['Posted On', 'Select Date Range', 'popover-date-range', 'MdDateRange'],
   ['City', 'Select City', 'listbox-purpose', 'DownOutlined'],
   ['Location', 'Select City First', null, 'DownOutlined'],
   ['TruCheck Status', 'Select TruCheck Status', 'listbox-purpose', 'DownOutlined']]
  .map(([label, ph, opens, ic], i) => `      <div class="pf-field">
        <label class="pf-field-label" for="dflt-${i}">${label}</label>
        <button class="pf-select" id="dflt-${i}" type="button"${opens ? ` data-open="${opens}" data-placement="bottom"` : ' disabled'}><span class="pf-placeholder">${ph}</span><span class="pf-select-arrow">${icon(ic, 12)}</span></button>
      </div>`).join('\n')}
    </div>
  </div>
  <div class="pf-drawer-foot">
    <button class="pf-btn" data-variant="link-danger" data-size="small" type="button" data-noop="Reset Filters clears the form and the URL params; there is nothing to clear in a static page"><span>Clear filters</span></button>
    <button class="pf-btn" data-variant="primary" data-size="large" type="button" data-close>${icon('FiSearch', null)}<span>Search</span></button>
  </div>
</div>`;


/* ── the table-body overlays ─────────────────────────────────────────────
   Six popovers, two listboxes and a shared tooltip, all of them inside the
   listing table and none of them ever captured before this pass. One instance
   of each: the product renders ninety tooltips and thirteen health popovers on
   this screen, and ninety copies of the same markup is a worse reference than
   one. prototype.js anchors whichever one is open to whatever opened it. */
const tableOverlays = `
<!-- the shared tooltip. Its text comes from the trigger's data-tip, which is
     the product's own title string (products.js, table-actions.js:62-109).
     data/live/listings--tooltip-action — 132x40, WHITE with #5A5F7D text and a
     hairline border. antd ships a dark pill; the product overrides it. -->
<div class="pf-tip" id="pf-tip" role="tooltip" hidden></div>

<!-- data/live/listings--popover-health — 440x352, placement right. The inner
     carries NO padding: this panel dresses its own rows. Three buttons live in
     it, which is why it is a popover and not a tooltip. -->
<div class="pf-popover" data-kind="health" id="popover-health" data-anchor="trigger" data-placement="right" role="dialog" aria-label="Overall Quality" hidden>
  <div class="pf-popover-body">
    <div class="pf-health-head">
      <div>
        <div class="pf-modal-title">Overall Quality</div>
        <div class="pf-listing-loc">Higher quality means more listing visibility &amp; leads</div>
      </div>
      <span class="pf-score" data-band="medium">62%</span>
    </div>
    <div class="pf-health-row">
      <span class="pf-health-label">${icon('MdRefresh', 16)} Freshness</span>
      <!-- health.js:110 — this opens QuotaCreditModal, the same overlay the
           Refresh circle opens -->
      <button class="pf-btn" data-variant="link" data-size="small" type="button" data-open="modal-quota"><span>Refresh</span></button>
    </div>
    <div class="pf-health-row">
      <span class="pf-health-label">${icon('HiCamera', 16)} Images</span>
      <a class="pf-btn" data-variant="link" data-size="small" href="not-built.html?screen=${encodeURIComponent('Post Listing — Images')}"><span>Add</span></a>
    </div>
    <div class="pf-health-row">
      <span class="pf-health-label">${icon('PiSealCheckFill', 16)} Features</span>
      <a class="pf-btn" data-variant="link" data-size="small" href="not-built.html?screen=${encodeURIComponent('Post Listing — Amenities')}"><span>Add</span></a>
    </div>
  </div>
</div>

<!-- data/live/listings--popover-timeline — 180x54, pad 16 -->
<div class="pf-popover" data-kind="anchored" id="popover-timeline" data-anchor="trigger" data-placement="top" role="dialog" aria-label="Posted on" hidden>
  <div class="pf-popover-body">12:00 am, Sep 20, 2026</div>
</div>

<!-- data/live/listings--popover-rega — 191x54, pad 16 -->
<div class="pf-popover" data-kind="anchored" id="popover-rega" data-anchor="trigger" data-placement="top" role="dialog" aria-label="REGA expiry" hidden>
  <div class="pf-popover-body">Expiring on: Jan 20, 2027</div>
</div>

<!-- data/live/listings--popover-status-rejected — 472x54, pad 16, placement
     right, and it opens on CLICK. The only click-triggered popover in the
     table body (platforms-status.js:16). -->
<div class="pf-popover" data-kind="anchored" id="popover-status" data-states="popover-status-rejected" data-anchor="trigger" data-placement="right" role="dialog" aria-label="Rejection reasons" hidden>
  <div class="pf-popover-body">Images do not match the property, Price is outside the expected range</div>
</div>

<!-- data/live/listings--popover-leads — 216x235, pad 16. The LMS breakdown;
     a non-LMS account gets a plainer 120px list (listing-stats.js:97). -->
<div class="pf-popover" data-kind="leads" id="popover-leads" data-anchor="trigger" data-placement="top" role="dialog" aria-label="Leads breakdown" hidden>
  <div class="pf-popover-body">
${[['Calls', [['Calls Clicked', '0']]],
   ['Whatsapp', [['WhatsApp Clicked', '0'], ['Chats Initiated', '0']]],
   ['Emails', [['Emails Clicked', '0'], ['Emails Received', '0']]],
   ['SMS', [['SMS Clicked', '0']]]]
  .map(([group, rows_]) => `    <div class="pf-lead-group">
      <div class="pf-lead-title">${group}</div>
${rows_.map(([k, v]) => `      <div class="pf-lead-row"><span>${k}</span><span>${v}</span></div>`).join('\n')}
    </div>`).join('\n')}
  </div>
</div>

<!-- data/live/listings--select-purpose — 245x137, pad 11, options 223x38 -->
<div class="pf-listbox" id="listbox-purpose" data-states="select-purpose" data-anchor="trigger" data-placement="bottom" role="listbox" aria-label="Purpose" hidden>
${['Sale', 'Rent', 'Daily Rental'].map((o, n) => `  <button class="pf-listbox-option" role="option" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-close>${esc(o)}</button>`).join('\n')}
</div>

<!-- data/live/listings--select-property-type — 245x278. A GROUPED panel, not
     the same one taller: a 223x35 group header at 12px, and its options
     indented to 25 instead of 12. -->
<div class="pf-listbox" id="listbox-property-type" data-states="select-property-type" data-anchor="trigger" data-placement="bottom" role="listbox" aria-label="Property Type" hidden>
  <div class="pf-listbox-group" role="presentation">Residential</div>
${['Apartment', 'Villa', 'Floor', 'Chalet', 'Townhouse', 'Duplex', 'Penthouse'].map((o) => `  <button class="pf-listbox-option" role="option" type="button" data-close>${esc(o)}</button>`).join('\n')}
</div>

<!-- data/live/listings--date-posted-on — the popover is 802x381 and holds
     REACT-DATE-RANGE, not an antd picker (datePicker.js:15): two months side
     by side and a list of static ranges. The capture has 70 .rdrDay and no
     .ant-picker, which is the only reason this is not drawn as one. -->
<div class="pf-popover" data-kind="date" id="popover-date-range" data-states="date-posted-on" data-anchor="trigger" data-placement="bottom" role="dialog" aria-label="Search by Calendar" hidden>
  <div class="pf-popover-title">Search by Calendar</div>
  <div class="pf-popover-body">
    <div class="pf-daterange">
      <ul class="pf-daterange-static">
${['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month'].map((o, n) => `        <li><button class="pf-btn" data-variant="link" data-size="small" type="button"${n === 0 ? ' aria-pressed="true"' : ''} data-noop="a static range sets the two dates in the calendar; the calendar here is a reproduction, not a date picker"><span>${o}</span></button></li>`).join('\n')}
      </ul>
      <div class="pf-daterange-months">
${['September 2026', 'October 2026'].map((m) => `        <div class="pf-daterange-month">
          <div class="pf-daterange-name">${m}</div>
          <div class="pf-daterange-weekdays">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="pf-daterange-days">${Array.from({ length: 35 }, (_, d) => `<span class="pf-daterange-day">${d > 1 && d < 32 ? d - 1 : ''}</span>`).join('')}</div>
        </div>`).join('\n')}
      </div>
    </div>
  </div>
  <div class="pf-drawer-foot">
    <button class="pf-btn" type="button" data-close><span>Cancel</span></button>
    <button class="pf-btn" data-variant="primary" type="button" data-close><span>Confirm</span></button>
  </div>
</div>`;

/* ── QuotaCreditModal, in both of its shapes ─────────────────────────────
   What all seventy-two upgrade circles open, and the single largest thing this
   page was missing. It was never a measuring problem: the harness captured it
   the first time a circle was clicked.
     data/live/listings--upgrade-signature    708x414, body 284
     data/live/listings--upgrade-photography  708x546, body 416 — the three
                                              SERVICES add the ServiceOptions
                                              form, which is the 132px */
const quotaModal = (id, title, states, extra = '') => `
<div class="pf-mask" id="${id}" data-states="${states}" hidden>
  <div class="pf-modal" data-size="quota" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
    <div class="pf-modal-head">
      <span class="pf-modal-title" id="${id}-title">${title}</span>
      <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
    </div>
    <div class="pf-modal-body">
      <div class="pf-alert" data-tone="info">${icon('AiOutlineInfoCircle', 16)}<span>Credits will be deducted from your account once the request is approved.</span></div>
${extra}
      <table class="pf-credit-table">
        <thead><tr><th>Product</th><th>Credits required</th><th>Credits available</th></tr></thead>
        <tbody>
          <tr><td>${title.replace(/^(Mark|Request)\s+/, '')}</td><td>1</td><td>34</td></tr>
          <tr class="pf-credit-total"><td>Total</td><td>1</td><td>34</td></tr>
        </tbody>
      </table>
    </div>
    <div class="pf-modal-foot">
      <button class="pf-btn" type="button" data-close><span>Cancel</span></button>
      <button class="pf-btn" data-variant="primary" type="button" data-close><span>Request Now</span></button>
    </div>
  </div>
</div>`;

const serviceOptions = `      <div class="pf-stack">
        <div class="pf-field">
          <label class="pf-field-label" for="svc-date">Requested date</label>
          <button class="pf-select" id="svc-date" type="button" data-open="popover-date-range" data-placement="bottom"><span class="pf-placeholder">Select Date Range</span><span class="pf-select-arrow">${icon('MdDateRange', 16)}</span></button>
        </div>
        <div class="pf-field">
          <label class="pf-field-label" for="svc-note">Comments</label>
          <span class="pf-input"><input id="svc-note" type="text" placeholder="Anything the crew should know"><span class="pf-input-suffix"></span></span>
        </div>
      </div>
`;

/* platformActions.js:174-213. UNMEASURED, and marked as such in
   authoring/listings-buttons.md: a pending-otp-verification row renders
   Publish Now but clicking it takes the currency-user branch and navigates
   (:68-71), so the harness has never opened this modal. The size below is the
   listing modal's 620, not a measurement of this one. */
const otpModal = `
<div class="pf-mask" id="modal-otp" hidden>
  <div class="pf-modal" role="dialog" aria-modal="true" aria-labelledby="otp-title">
    <div class="pf-modal-head">
      <span class="pf-modal-title" id="otp-title">Verify your licence</span>
      <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
    </div>
    <div class="pf-modal-body">
      <p>Enter the code we sent to the mobile number registered with your FAL licence.</p>
      <div class="pf-otp">${[0, 1, 2, 3].map((n) => `<input class="pf-otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit ${n + 1}">`).join('')}</div>
      <button class="pf-btn" data-variant="link" data-size="small" type="button" data-noop="resend is a server call; this page has no server"><span>Resend code</span></button>
    </div>
    <div class="pf-modal-foot">
      <button class="pf-btn" type="button" data-close><span>Cancel</span></button>
      <button class="pf-btn" data-variant="primary" type="button" data-close><span>Verify</span></button>
    </div>
  </div>
</div>`;

/* The prototype bar is NOT a product component — it is the only thing on this
   page the product does not have, and it says so. It switches the page between
   the three captured states. */
const protoBar = `
<div class="pf-proto-bar" role="group" aria-label="Prototype states — not part of the product">
  <b>Prototype</b>
  <button type="button" data-state-set="default" aria-pressed="true">Default</button>
  <button type="button" data-state-set="loading" aria-pressed="false">Loading</button>
  <button type="button" data-state-set="error" aria-pressed="false">Error</button>
</div>`;

const html = open({ title: page.title, current: page.railCurrent, docTitle: `${page.title} — Profolio KSA`, comment, contentGap: 8 }) +
`      <!-- ── Filters ────────────────────────────────────────────────── -->
      <div class="pf-filter-bar">
        <div class="pf-filter-fields">
${page.filters.map(field).join('\n')}
        </div>
        <div class="pf-filter-actions">
          <button class="pf-btn" data-variant="tint" data-size="small" type="button" data-open="drawer-filters"><span>${esc(page.actions.showMore)}</span>${icon('MdOutlineDoubleArrow', 18)}</button>
          <!-- filters.js:641 disables it while no filter is applied, and
               utils.less:142 dims anything disabled to 0.54 -->
          <button class="pf-btn" data-variant="link-danger" data-size="small" type="button" disabled><span>${esc(page.actions.clear)}</span></button>
          <button class="pf-btn" data-variant="primary" data-size="large" type="button" data-noop="Search pushes the filter values into the URL and refetches; this page has one fixed result set">${icon('FiSearch', null)}<span>${esc(page.actions.search)}</span></button>
        </div>
      </div>
      <!-- ── the three page states ──────────────────────────────────────
           default, loading and error, each captured from the product rather
           than imagined. The prototype bar at the bottom switches between
           them; #state=loading reaches one directly. -->
      <div data-state-panel="default" data-states="action-discount">
      <!-- ── DataTable: status tabs in the card head, the table in its body ──
           One panel per tab, all but the current one hidden. The column set
           per tab is listingUtilities.js:402's, and the row COUNT follows the
           tab's own label — Draft (2) shows two rows, Pending (1) one, and
           Removed (0) the empty state the product renders from an empty answer
           (data/live/listings--tab-removed.capture.json). -->
      <section class="pf-table-card">
        <div class="pf-table-card-head">
          <div class="pf-tabs" role="tablist">
${page.tabs.map(tab).join('\n')}
          </div>
        </div>
${page.tabs.map((t) => {
  const id = panelId(t);
  const slug = id.replace(/^tab-/, '');
  const cols = COLUMNS[slug];
  const hidden = t.current ? '' : ' hidden';
  if (!cols || t.count === 0) {
    /* the empty state, measured: a 164x89 illustration, an 18/600 title and a
       primary button, in a grid with 32px gaps; the head keeps ONE empty cell */
    return `        <div data-panel-id="${id}"${hidden}>
          <table class="pf-table">
            <thead><tr><th></th></tr></thead>
            <tbody>
              <tr>
                <td>
                  <div class="pf-empty">
                    ${emptyArt()}
                    <div><div class="pf-empty-title">No Record Found</div></div>
                    <a class="pf-btn" data-variant="primary" data-size="large" href="not-built.html?screen=Post%20Listing">${icon('PostListingIcon', null)}<span>Post Listing</span></a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>`;
  }
  const body = (t.count && t.count < rows.length ? rows.slice(0, t.count) : rows);
  return `        <div data-panel-id="${id}"${hidden}>
          <table class="pf-table">
            <thead>
              <tr>${cols.map((c) => { const [label, cls] = HEAD[c]; return `<th${cls ? ` class="${cls}"` : ''}>${label}</th>`; }).join('')}</tr>
            </thead>
            <tbody>
${body.map(row(cols)).join('\n')}
            </tbody>
          </table>
        </div>`;
}).join('\n')}
      </section>
${pager}
      </div><!-- /default -->

      <!-- data/live/listings--loading.capture.json — the listings query held
           open. The card head stays (47 tall) but carries no tabs: the counts
           come from the same query. The body is 553 with a 400px spin area. -->
      <div data-state-panel="loading" hidden>
        <section class="pf-table-card">
          <div class="pf-table-card-head"><div class="pf-tabs" role="tablist"></div></div>
          <div class="pf-spin"><span class="pf-spin-dot"><i></i><i></i><i></i><i></i></span></div>
        </section>
      </div>

      <!-- data/live/listings--error.capture.json — /api/surge/listings answers
           500 and the product renders NO error card: the table falls back to
           the same No Record Found empty state. That is the product's
           behaviour, not a shortcut here. -->
      <div data-state-panel="error" hidden>
        <section class="pf-table-card">
          <div class="pf-table-card-head">
            <!-- the tabs render, but WITHOUT data-panel: they belong to this
                 state's card, and sharing the panel names would let a click
                 here reveal the default state's table underneath -->
            <div class="pf-tabs" role="tablist">
${page.tabs.map((t) => `              <button class="pf-tab" role="tab"${t.current ? ' aria-selected="true"' : ''} type="button" data-noop="this state's tabs share no panel names with the default state's, so that a click here cannot reveal the table underneath"><span class="pf-tab-label">${esc(t.label)} (${t.count})</span></button>`).join('\n')}
            </div>
          </div>
          <table class="pf-table">
            <thead><tr><th></th></tr></thead>
            <tbody><tr><td>
              <div class="pf-empty">
                ${emptyArt()}
                <div><div class="pf-empty-title">No Record Found</div></div>
                <a class="pf-btn" data-variant="primary" data-size="large" href="not-built.html?screen=Post%20Listing">${icon('PostListingIcon', null)}<span>Post Listing</span></a>
              </div>
            </td></tr></tbody>
          </table>
        </section>
      </div>
` + close({ overlays: overlays + tableOverlays
  /* four captures of four different circles are four captures of ONE overlay;
     data-states is where that is written down */
  + quotaModal('modal-quota', 'Mark Signature', 'upgrade-signature upgrade-hot upgrade-refresh')
  + quotaModal('modal-quota-service', 'Request Photography Service', 'upgrade-photography', serviceOptions)
  + otpModal, states: protoBar });

const out = join(ROOT, 'deliverables', 'listings.html');
writeFileSync(out, html);
console.log(`  deliverables/listings.html — ${rows.length} rows, ${page.filters.length} filters, ${page.tabs.length} tabs · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
