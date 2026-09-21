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
/* which upgrade circles are lit for a given product — table-actions.js reads
   products_information; the dashboard's rows established this mapping */
const UPGRADES = (product) => [
  ['signature', 'Signature',    'BsFillLightningChargeFill'],
  [product === 'hot' ? 'hot' : 'muted', 'Hot', 'IconSuperHot'],
  ['refresh',   'Refresh',      'MdRefresh'],
  ['photo',     'Photography',  'HiCamera'],
  ['video',     'Videography',  'HiVideoCamera'],
  ['drone',     'Drone Footage','DroneIcon'],
];
/* FIVE, not six. The product's Actions cell was counted in the state capture —
   `colActions:5btn` — and each was clicked to see what it opens:
     [0] TruCheck modal   [1] share (external)   [2] preview (external)
     [3] Edit → /post-listing/:id                [4] Delete Listing modal
   We had six: an extra "Apply Discount", which renders only for a discounted
   listing, and "Mark as sold" in place of TruCheck. */
const ACTIONS = [
  ['TruCheck', 'HiCheck',         'modal-trucheck'],
  ['Share',    'FiArrowUpRight',  null],
  ['Preview',  'IoMdEye',         null],
  ['Edit',     'MdEdit',          null],
  ['Delete',   'HiOutlineTrash',  'modal-delete'],
];
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
  property: (r) => {
    const p = PRODUCT[r.product];
    return `            <td class="col-property">
              <div class="pf-listing">
                <span class="pf-listing-thumb"><span class="pf-listing-count">${r.images}</span></span>
                <div>
                  <div class="pf-listing-price"><bdi>ر.س</bdi> ${r.price} <span class="pf-tag" data-tone="${r.product}">${icon(p.icon, 14)}${p.label}</span> <span class="pf-score" data-band="medium">${r.score}</span></div>
                  <a class="pf-listing-title" href="#">${esc(r.title)}</a>
                  <div class="pf-listing-specs"><span>${icon(beds, 14)} ${r.beds}</span><span>${icon(baths, 14)} ${r.baths}</span><span>${icon(area, 14)} ${esc(r.area)}</span></div>
                  <div class="pf-listing-loc">${esc(r.location)}</div>
                  <div class="pf-listing-ids"><span>Bayut ID: ${r.bayutId}</span><span>REGA ID: ${r.regaId}</span></div>
                </div>
              </div>
            </td>`;
  },
  timeline: (r) => `            <td>Posted on ${esc(r.posted)} ${icon('BsInfoLg', 14)}</td>`,
  performance: (r) => `            <td>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Views</span><span class="pf-stat-value">${r.views}</span></div></div>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Clicks</span><span class="pf-stat-value">${r.clicks}</span></div></div>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Leads</span><span class="pf-stat-value">${r.leads}</span></div></div>
            </td>`,
  status: () => `            <td><span class="pf-status-pill" data-status="green">Live</span></td>`,
  upgrades: (r) => `            <td class="col-upgrades">
              <div class="pf-action-grid">
${UPGRADES(r.product).map(([tone, label, ic]) => `                <button class="pf-round-action" data-tone="${tone}" type="button" aria-label="${label}">${icon(ic)}</button>`).join('\n')}
              </div>
            </td>`,
  actions: () => `            <td class="col-actions">
              <div class="pf-action-grid">
${ACTIONS.map(([label, ic, opens]) => `                <button class="pf-round-action" type="button" aria-label="${label}"${opens ? ` data-open="${opens}"` : ''}>${icon(ic)}</button>`).join('\n')}
              </div>
            </td>`,
};
CELL.publish = CELL.upgrades;

const row = (cols) => (r) => `          <tr>\n${cols.map((c) => CELL[c](r)).join('\n')}\n          </tr>`;

/* ── the filter bar ───────────────────────────────────────────────────── */
const field = (f, i) => `        <div class="pf-field">
          <label class="pf-field-label" for="f-${f.key}">${esc(f.label)}</label>
${f.type === 'input'
  ? `          <span class="pf-input"><input id="f-${f.key}" type="text" placeholder="${esc(f.placeholder)}"><span class="pf-input-suffix"></span></span>`
  : `          <button class="pf-select" id="f-${f.key}" type="button" aria-haspopup="listbox"><span class="pf-placeholder">${esc(f.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`}
        </div>`;

/* ── tabs + pager ─────────────────────────────────────────────────────── */
const panelId = (t) => 'tab-' + t.label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
/* the label sits in its own span, as antd's .ant-tabs-tab-btn does — without
   it the QA paired the product's 74x22 text strip against our 74x46 button
   and read 40% of pixels different on two identical labels */
const tab = (t) => `          <button class="pf-tab" role="tab"${t.current ? ' aria-selected="true"' : ''} type="button" data-panel="${panelId(t)}"><span class="pf-tab-label">${esc(t.label)} (${t.count})</span></button>`;
const pg = page.pagination;
const pager = `      <ul class="pf-pagination">
        <li class="pf-page-item" data-nav="prev"${pg.current === 1 ? ' aria-disabled="true"' : ''}><button type="button" aria-label="Previous page"${pg.current === 1 ? ' disabled' : ''}>${icon('LeftOutlined', 12)}</button></li>
${Array.from({ length: pg.pages }, (_, i) => i + 1).map((n) => `        <li class="pf-page-item"${n === pg.current ? ' aria-current="page"' : ''}><a href="#">${n}</a></li>`).join('\n')}
        <li class="pf-page-item" data-nav="next"${pg.current === pg.pages ? ' aria-disabled="true"' : ''}><button type="button" aria-label="Next page"${pg.current === pg.pages ? ' disabled' : ''}>${icon('RightOutlined', 12)}</button></li>
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

<!-- data/live/listings--drawer-filters — 450 wide, head 91, foot 91, mask 0.45 -->
<div class="pf-mask" id="drawer-filters-mask" hidden></div>
<div class="pf-drawer" id="drawer-filters" data-mask="drawer-filters-mask" role="dialog" aria-modal="true" aria-labelledby="flt-title" hidden>
  <div class="pf-drawer-head">
    <div>
      <div class="pf-modal-title" id="flt-title">Filters</div>
      <div class="pf-listing-loc">Apply filters to organize data accordingly</div>
    </div>
    <button class="pf-overlay-close" type="button" aria-label="Close" data-close>${icon('IoMdClose', 16)}</button>
  </div>
  <div class="pf-drawer-body">
    <div class="pf-stack">
${[['Posted On', 'Select Date Range'], ['City', 'Select City'], ['Location', 'Select City First'], ['TruCheck Status', 'Select TruCheck Status']]
  .map(([label, ph], i) => `      <div class="pf-field">
        <label class="pf-field-label" for="dflt-${i}">${label}</label>
        <button class="pf-select" id="dflt-${i}" type="button"><span class="pf-placeholder">${ph}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>
      </div>`).join('\n')}
    </div>
  </div>
  <div class="pf-drawer-foot">
    <button class="pf-btn" data-variant="link-danger" data-size="small" type="button"><span>Clear filters</span></button>
    <button class="pf-btn" data-variant="primary" data-size="large" type="button" data-close>${icon('FiSearch', null)}<span>Search</span></button>
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
          <button class="pf-btn" data-variant="primary" data-size="large" type="button">${icon('FiSearch', null)}<span>${esc(page.actions.search)}</span></button>
        </div>
      </div>
      <!-- ── the three page states ──────────────────────────────────────
           default, loading and error, each captured from the product rather
           than imagined. The prototype bar at the bottom switches between
           them; #state=loading reaches one directly. -->
      <div data-state-panel="default">
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
                    <button class="pf-btn" data-variant="primary" data-size="large" type="button">${icon('PostListingIcon', null)}<span>Post Listing</span></button>
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
${page.tabs.map((t) => `              <button class="pf-tab" role="tab"${t.current ? ' aria-selected="true"' : ''} type="button"><span class="pf-tab-label">${esc(t.label)} (${t.count})</span></button>`).join('\n')}
            </div>
          </div>
          <table class="pf-table">
            <thead><tr><th></th></tr></thead>
            <tbody><tr><td>
              <div class="pf-empty">
                ${emptyArt()}
                <div><div class="pf-empty-title">No Record Found</div></div>
                <button class="pf-btn" data-variant="primary" data-size="large" type="button">${icon('PostListingIcon', null)}<span>Post Listing</span></button>
              </div>
            </td></tr></tbody>
          </table>
        </section>
      </div>
` + close({ overlays, states: protoBar });

const out = join(ROOT, 'deliverables', 'listings.html');
writeFileSync(out, html);
console.log(`  deliverables/listings.html — ${rows.length} rows, ${page.filters.length} filters, ${page.tabs.length} tabs · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
