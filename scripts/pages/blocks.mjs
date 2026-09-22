#!/usr/bin/env node
/**
 * Pages made of measured BLOCKS — reports, LMS, ad-license.
 *
 * These screens are all the same idea in different arrangements: a row of
 * cards, each with a 47-tall head and a body of one kind — a stat grid, a plot
 * area, a table, a form, an empty state. So they are one generator driven by
 * data/fixtures/blocks.json, where every size in the config is a number read
 * off data/live/<route>.capture.json and nothing is chosen by eye.
 *
 *   node scripts/pages/blocks.mjs                 every page
 *   node scripts/pages/blocks.mjs reports-summary
 *
 * WHAT THESE PAGES SHOW
 * Mostly empty states, and that is not a shortcut. The fixture account has no
 * report data, so the product renders its own "no records" card and that is
 * what the capture contains. Reproducing what rendered is the whole method;
 * inventing rows the product did not draw is what scripts/check-captures.mjs
 * exists to prevent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, close, icon, esc, emptyArt } from './shell.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'data/fixtures/blocks.json'), 'utf8'));

/* ── the body kinds ───────────────────────────────────────────────────── */

/* a 4-column grid of icon + label/value pairs; the icons are 32x32 and the
   pairs 103 wide, measured on reports-summary's 533 card */
const stats = (b) => `            <div class="pf-stat-grid">
${b.items.map((s) => `              <div class="pf-stat-item">${icon(s.icon, 16)}<div><span class="pf-stat-title">${esc(s.label)}</span><span class="pf-stat-value">${esc(s.value)}</span></div></div>`).join('\n')}
            </div>`;

/* the plot area. We ship no chart library, so this is the box the chart
   occupies with its axis rules — the same honesty as the QR placeholder. */
const plot = (b) => `            <div class="pf-plot" data-h="${b.h}" role="img" aria-label="${esc(b.label || 'Chart')}">
              <span class="pf-plot-note">${esc(b.label || 'Chart')}</span>
            </div>`;

const table = (b) => `            <table class="pf-table">
              <thead><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
              <tbody>
                <tr>
                  <td colspan="${b.columns.length}">
                    <div class="pf-empty">
                      ${emptyArt()}
                      <div><div class="pf-empty-title">${esc(b.empty || 'No Record Found')}</div></div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>`;

const form = (b) => `            <form class="pf-form-grid"${b.cols ? ` data-cols="${b.cols}"` : ''}>
${b.fields.map((f, i) => {
  const id = `${b.id}-${i}`;
  const control = f.type === 'select'
    ? `<button class="pf-select" id="${id}" type="button" aria-haspopup="listbox" data-open="listbox-blocks" data-placement="bottom"><span class="pf-placeholder">${esc(f.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`
    : `<span class="pf-input"><input id="${id}" type="text" placeholder="${esc(f.placeholder)}"></span>`;
  return `              <div class="pf-sfield${f.span ? ' span-all' : ''}">
                <label class="pf-field-label" for="${id}">${esc(f.label)}</label>
                ${control}
              </div>`;
}).join('\n')}
            </form>`;

const tabs = (b) => `            <div class="pf-tabs" role="tablist">
${b.tabs.map((t, n) => `              <button class="pf-tab" role="tab" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-noop="this screen's tabs each refetch; the capture has one of them"><span class="pf-tab-label">${esc(t)}</span></button>`).join('\n')}
            </div>`;

const BODY = { stats, plot, table, form, tabs };

/* A TABBED card is the same component the listings table sits in —
   .ant-card-contain-tabs, a head that holds the tab strip and nothing else.
   Building these as plain cards with a title left five regions missing on
   every reports page: table.card, table.card.head, tabs.nav, tabs.tab and
   tabs.active, which is most of what those pages are. */
const tabbedCard = (b) => `        <section class="pf-table-card"${b.h ? ` data-h="${b.h}"` : ''}>
          <div class="pf-table-card-head"${b.headRow ? ' data-tall="true"' : ''}>
${b.headRow ? `            <!-- a 76-tall row above the tabs: the product puts the page's filter
                 controls here, not in a bar of their own -->
            <!-- it IS the filter bar, so it carries that class: the design QA
                 scopes filter.field and filter.clear inside filter.bar, and a
                 differently-named wrapper left both regions unresolved -->
            <div class="pf-filter-bar" data-in-head="true">
              <div class="pf-filter-fields">
${b.headRow.fields.map((f, i) => `                <div class="pf-field"><button class="pf-select" id="${b.id || 'hf'}-${i}" type="button" aria-haspopup="listbox" data-open="listbox-blocks" data-placement="bottom"><span class="pf-placeholder">${esc(f)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button></div>`).join('\n')}
              </div>
              <button class="pf-btn" data-variant="link-danger" data-size="small" type="button" data-noop="clearing a filter is a URL push and a refetch"><span>Clear filters</span></button>
            </div>` : ''}
            <div class="pf-tabs" role="tablist">
${b.tabs.map((t, n) => `              <button class="pf-tab" role="tab" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-tabw="${b.tabw}" data-noop="each tab refetches; the capture has the first"><span class="pf-tab-label">${esc(t)}</span></button>`).join('\n')}
            </div>
${b.extra ? `            <div class="pf-tabs-extra"><a class="pf-btn" data-variant="primary" data-size="small" href="not-built.html?screen=${encodeURIComponent(b.extra)}"><span>${esc(b.extra)}</span></a></div>` : ''}
          </div>
${(b.body || []).map((x) => BODY[x.kind](x)).join('\n')}
        </section>`;

/* the pager, the same component Listings uses — six pages, right-aligned */
const pager = (n, full) => `      <ul class="pf-pagination"${full ? ' data-span="full"' : ''}>
        <li class="pf-page-item" data-nav="prev" aria-disabled="true"><button type="button" aria-label="Previous page" disabled>${icon('LeftOutlined', 12)}</button></li>
${Array.from({ length: n }, (_, i) => i + 1).map((x) => `        <li class="pf-page-item"${x === 1 ? ' aria-current="page"' : ''}><a data-noop="the pager pushes the page number into the URL and refetches">${x}</a></li>`).join('\n')}
        <li class="pf-page-item" data-nav="next"><button type="button" aria-label="Next page" data-noop="the pager pushes the page number into the URL and refetches">${icon('RightOutlined', 12)}</button></li>
      </ul>`;

const card = (b) => b.tabs ? tabbedCard(b) : `        <section class="pf-card pf-block" data-w="${b.w || 'full'}"${b.h ? ` data-h="${b.h}"` : ''}>
${b.title ? `          <div class="pf-block-head">${esc(b.title)}${b.headAction ? `<a class="pf-btn" data-variant="link" data-size="small" href="not-built.html?screen=${encodeURIComponent(b.headAction)}"><span>${esc(b.headAction)}</span></a>` : ''}</div>` : ''}
          <div class="pf-block-body">
${(b.body || []).map((x) => BODY[x.kind](x)).join('\n')}
          </div>
        </section>`;

/* the page's own filter bar, the same component Listings carries above its
   table — four fields, Show More, Clear filters, Search */
const filterBar = (f, slug) => `      <div class="pf-filter-bar">
        <div class="pf-filter-fields">
${f.fields.map((x, i) => `          <div class="pf-field">
            <label class="pf-field-label" for="${slug}-fb-${i}">${esc(x.label)}</label>
${x.type === 'select'
  ? `            <button class="pf-select" id="${slug}-fb-${i}" type="button" aria-haspopup="listbox" data-open="listbox-blocks" data-placement="bottom"><span class="pf-placeholder">${esc(x.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`
  : `            <span class="pf-input"><input id="${slug}-fb-${i}" type="text" placeholder="${esc(x.placeholder)}"><span class="pf-input-suffix"></span></span>`}
          </div>`).join('\n')}
        </div>
        <div class="pf-filter-actions">
          <button class="pf-btn" data-variant="tint" data-size="small" type="button" data-noop="the extra filters open in a drawer on this screen too"><span>Show More</span>${icon('MdOutlineDoubleArrow', 18)}</button>
          <button class="pf-btn" data-variant="link-danger" data-size="small" type="button" disabled><span>Clear filters</span></button>
          <button class="pf-btn" data-variant="primary" data-size="large" type="button" data-noop="Search pushes the filter values into the URL and refetches">${icon('FiSearch', null)}<span>Search</span></button>
        </div>
      </div>`;

const row = (r) => `      <div class="pf-block-row"${r.cols ? ` style-cols="${r.cols}"` : ''} data-cols="${r.cols || 'auto'}">
${r.blocks.map(card).join('\n')}
      </div>`;

const want = process.argv[2];
for (const p of cfg.pages) {
  if (want && p.slug !== want) continue;
  const comment = `<!-- ═══════════════════════════════════════════════════════════════════
     ${p.title.toUpperCase()} — scripts/pages/blocks.mjs from data/fixtures/blocks.json
     Every size below is read off data/live/${p.route}.capture.json:
${p.notes.map((n) => `       ${n}`).join('\n')}
     ═══════════════════════════════════════════════════════════════════════ -->`;
  const html = open({ title: p.title, current: p.rail, docTitle: `${p.title} — Profolio KSA`, comment, contentGap: 8 })
    + (p.filterBar ? filterBar(p.filterBar, p.slug) + '\n' : '')
    + (p.column ? `      <div class="pf-settings-main">\n` : '')
    + p.rows.map(row).join('\n') + '\n'
    + (p.column ? '      </div>\n' : '')
    + (p.pager ? pager(p.pager, p.pagerFull) + '\n' : '')
    + close({
      overlays: `
<!-- the same 245-wide listbox every select on every page opens -->
<div class="pf-listbox" id="listbox-blocks" data-anchor="trigger" data-placement="bottom" role="listbox" aria-label="Options" hidden>
  <div class="pf-listbox-scroll">
${cfg.listbox.map((o, n) => `    <button class="pf-listbox-option" role="option" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-close>${esc(o)}</button>`).join('\n')}
  </div>
</div>`,
    });
  writeFileSync(join(ROOT, 'deliverables', `${p.slug}.html`), html);
  console.log(`  deliverables/${p.slug}.html — ${p.rows.length} row(s) · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
}
