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
import { open, close, icon, esc } from './shell.mjs';

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
const ACTIONS = [
  ['Mark as sold', 'HiCheck'], ['Share', 'FiArrowUpRight'], ['Preview', 'IoMdEye'],
  ['Edit', 'MdEdit'], ['Discount', 'IconSellRentListing'], ['Delete', 'HiOutlineTrash'],
];
const [beds, baths, area] = ['IconBedroom', 'IconBathroom', 'IconAreaSize'];

const row = (r) => {
  const p = PRODUCT[r.product];
  return `          <tr>
            <td class="col-property">
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
            </td>
            <td>Posted on ${esc(r.posted)} ${icon('BsInfoLg', 14)}</td>
            <td>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Views</span><span class="pf-stat-value">${r.views}</span></div></div>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Clicks</span><span class="pf-stat-value">${r.clicks}</span></div></div>
              <div class="pf-stat" data-inline="true"><div><span class="pf-stat-title">Leads</span><span class="pf-stat-value">${r.leads}</span></div></div>
            </td>
            <td><span class="pf-status-pill" data-status="green">Live</span></td>
            <td class="col-upgrades">
              <div class="pf-action-grid">
${UPGRADES(r.product).map(([tone, label, ic]) => `                <button class="pf-round-action" data-tone="${tone}" type="button" aria-label="${label}">${icon(ic)}</button>`).join('\n')}
              </div>
            </td>
            <td class="col-actions">
              <div class="pf-action-grid">
${ACTIONS.map(([label, ic]) => `                <button class="pf-round-action" type="button" aria-label="${label}">${icon(ic)}</button>`).join('\n')}
              </div>
            </td>
          </tr>`;
};

/* ── the filter bar ───────────────────────────────────────────────────── */
const field = (f, i) => `        <div class="pf-field">
          <label class="pf-field-label" for="f-${f.key}">${esc(f.label)}</label>
${f.type === 'input'
  ? `          <span class="pf-input"><input id="f-${f.key}" type="text" placeholder="${esc(f.placeholder)}"><span class="pf-input-suffix"></span></span>`
  : `          <button class="pf-select" id="f-${f.key}" type="button" aria-haspopup="listbox"><span class="pf-placeholder">${esc(f.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`}
        </div>`;

/* ── tabs + pager ─────────────────────────────────────────────────────── */
const tab = (t) => `          <button class="pf-tab" role="tab"${t.current ? ' aria-selected="true"' : ''} type="button">${esc(t.label)} (${t.count})</button>`;
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

const html = open({ title: page.title, current: page.railCurrent, docTitle: `${page.title} — Profolio KSA`, comment, contentGap: 8 }) +
`      <!-- ── Filters ────────────────────────────────────────────────── -->
      <div class="pf-filter-bar">
        <div class="pf-filter-fields">
${page.filters.map(field).join('\n')}
        </div>
        <div class="pf-filter-actions">
          <button class="pf-btn" data-variant="tint" data-size="small" type="button"><span>${esc(page.actions.showMore)}</span>${icon('MdOutlineDoubleArrow', 18)}</button>
          <button class="pf-btn" data-variant="link-danger" data-size="small" type="button"><span>${esc(page.actions.clear)}</span></button>
          <button class="pf-btn" data-variant="primary" data-size="large" type="button">${icon('FiSearch', null)}<span>${esc(page.actions.search)}</span></button>
        </div>
      </div>
      <!-- ── DataTable: status tabs in the card head, the table in its body ── -->
      <section class="pf-table-card">
        <div class="pf-table-card-head">
          <div class="pf-tabs" role="tablist">
${page.tabs.map(tab).join('\n')}
          </div>
        </div>
        <table class="pf-table">
          <thead>
            <tr><th class="col-property">Property</th><th>Timeline</th><th>Performance</th><th>Status</th><th class="col-upgrades">Upgrades</th><th class="col-actions">Actions</th></tr>
          </thead>
          <tbody>
${rows.map(row).join('\n')}
          </tbody>
        </table>
      </section>
${pager}
` + close();

const out = join(ROOT, 'deliverables', 'listings.html');
writeFileSync(out, html);
console.log(`  deliverables/listings.html — ${rows.length} rows, ${page.filters.length} filters, ${page.tabs.length} tabs · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
