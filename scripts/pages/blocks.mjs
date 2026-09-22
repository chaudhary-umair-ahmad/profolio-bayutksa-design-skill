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
import { donut, lineChart } from './charts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* The riyal mark U+FDFC is an Arabic LETTER, and the bidi algorithm resolves
   the European digits that follow it into Arabic numbers — so the whole price
   becomes one right-to-left run and "﷼ 1,250,000" renders as "1,250,000 ﷼".
   Isolating the mark keeps the product's order. CSS alone cannot fix it,
   because the two have to be separate bidi runs. */
const price = (v) => String(v).replace(/^(\u{FDFC})\s*/u, '<bdi>$1</bdi> ');
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

/* A table either has rows or it has the product's own empty card. Which one
   is not a choice made here: it is what the fixture account's screen showed. */
const table = (b) => `            <table class="pf-table">
              <thead><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
              <tbody>
${b.rows && b.rows.length
  ? b.rows.map((r) => `                <tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n')
  : `                <tr>
                  <td colspan="${b.columns.length}">
                    <div class="pf-empty">
                      ${emptyArt()}
                      <div><div class="pf-empty-title">${esc(b.empty || 'No Record Found')}</div></div>
                    </div>
                  </td>
                </tr>`}
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

/* ── the blocks these pages are actually made of ───────────────────────── */

/* Reports Summary's Listings card: one big "Active" figure with a status dot,
   then a 3x2 grid of 103-wide pairs whose 32x32 icon tile is tinted with the
   PRODUCT's own colour at 8% — rgba(45,62,155,.08) for For Sale, (71,158,235)
   for To Rent and Daily Rentals, (175,111,255) Signature, (247,49,49) Hot,
   (40,177,109) Basic. Measured on data/live/reports-summary.capture.json. */
const statcard = (b) => `            <div class="pf-statcard">
              <div class="pf-stat-lead">
                <span class="pf-stat-title">${esc(b.lead.label)}</span>
                <span class="pf-stat-lead-value">${icon('GoDotFill', 12)}${esc(b.lead.value)}</span>
              </div>
              <div class="pf-stat-grid">
${b.items.map((s) => `                <div class="pf-stat-item"><span class="pf-stat-tile" style="--tile:${s.tint}">${icon(s.icon, 17)}</span><div><span class="pf-stat-title">${esc(s.label)}</span><span class="pf-stat-value">${esc(s.value)}</span></div></div>`).join('\n')}
              </div>
            </div>`;

/* Breakdown By Location: one 128 ring per purpose with its legend beside it.
   An empty series draws the track alone and says "Not enough data", which is
   what the fixture account's screen shows. */
const donuts = (b) => `            <div class="pf-donut-row">
${b.items.map((d) => `              <div class="pf-donut-cell">
${donut({ value: d.value, label: d.label, series: d.series || [] })}
                <div class="pf-donut-legend">
${(d.legend || [{ label: d.note }]).map((l) => `                  <span class="pf-legend-item">${icon('GoDotFill', 10)}<span>${esc(l.label)}</span>${l.value !== undefined ? `<b>${esc(l.value)}</b>` : ''}</span>`).join('\n')}
                </div>
              </div>`).join('\n')}
            </div>`;

/* The Performance card. Its head is 158 tall and holds two things the first
   version of this page had neither of: a 44-tall row with a segmented purpose
   control and a date-range field, and an 84-tall TAB STRIP whose tabs are the
   metric tiles (Views / Clicks / Leads) with the channel totals in the tabs'
   extra slot. Then the body: a 29-tall row of product pills and the chart. */
const segmented = (b) => `              <div class="pf-segmented" role="tablist">
${b.segments.map((t, n) => `                <button class="pf-segment" role="tab" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-noop="switching purpose refetches the series">${esc(t)}</button>`).join('\n')}
              </div>`;

const metricTabs = (b) => `              <div class="pf-metrics" role="tablist">
${b.metrics.map((m, n) => `                <button class="pf-metric" role="tab" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-noop="each metric redraws the series">
                  <span class="pf-metric-tile" style="--tile:${m.tint}">${icon(m.icon, 18)}</span>
                  <span class="pf-metric-text"><span class="pf-metric-label">${esc(m.label)}</span><span class="pf-metric-value">${esc(m.value)}${m.delta ? `<span class="pf-delta" data-dir="${m.dir}">${icon(m.dir === 'up' ? 'TiArrowSortedUp' : 'TiArrowSortedDown', 12)}${esc(m.delta)}</span>` : ''}</span></span>
                </button>`).join('\n')}
              </div>
              <div class="pf-channels">
${b.channels.map((c) => `                <span class="pf-channel">${icon(c.icon, 16)}<span>${esc(c.label)}</span><b>${esc(c.value)}</b></span>`).join('\n')}
              </div>`;

const pills = (b) => `            <div class="pf-pills" role="radiogroup">
${b.pills.map((x, n) => `              <button class="pf-pill" role="radio" type="button"${n === 0 ? ' aria-checked="true"' : ''} data-noop="filtering by product refetches the series">${icon(x.icon, 14)}<span>${esc(x.label)}</span></button>`).join('\n')}
            </div>`;

const chart = (b) => lineChart(b);

/* Credits Usage's left card: a Top-Up pill in the head, a tinted 3-up strip,
   a 300 ring and a legend of five rows. */
const credits = (b) => `            <div class="pf-credits">
              <div class="pf-credits-note">${esc(b.note)}</div>
              <div class="pf-credits-strip">
${b.strip.map((x) => `                <div class="pf-credits-cell"><span class="pf-stat-title">${esc(x.label)}</span><span class="pf-credits-value">${esc(x.value)}</span></div>`).join('\n')}
              </div>
${donut({ size: b.donut.size, thickness: b.donut.thickness, series: b.donut.series })}
              <div class="pf-credits-breakdown">
                <div class="pf-credits-bd-title">${esc(b.breakdown.title)}</div>
${b.breakdown.rows.map((r) => `                <div class="pf-bd-row"><span class="pf-bd-swatch" style="--swatch:${r.color}">${icon('GoDotFill', 10)}</span><span class="pf-bd-value">${esc(r.value)}</span></div>`).join('\n')}
              </div>
            </div>`;

/* Credits Usage's right card: a scrolling timeline of dated property cards. */
const timeline = (b) => `            <div class="pf-timeline">
${b.items.map((t) => `              <div class="pf-tl-item">
                <span class="pf-tl-dot"></span>
                <div class="pf-card pf-tl-card">
                  <div class="pf-card pf-tl-prop">
                    <span class="pf-tl-thumb"></span>
                    <div>
                      <div class="pf-tl-price">${price(esc(t.price))}</div>
                      <span class="pf-tl-tag">${esc(t.product)}</span>
                      <div class="pf-tl-specs">${t.specs.map((x) => `<span>${icon(x.icon, 14)}${esc(x.text)}</span>`).join('')}</div>
                    </div>
                  </div>
                  <div class="pf-tl-date">${esc(t.date)}</div>
                </div>
              </div>`).join('\n')}
            </div>`;

/* Listing Report's table: a property cell on the left and the reach columns
   on the right. The property cell is the one the listings table already
   draws — thumb, price with a quality chip, specs, address, ids. */
const proptable = (b) => `            <table class="pf-table pf-proptable">
              <thead><tr>${b.columns.map((c, i) => `<th${i === 0 ? ' class="pf-th-prop"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
              <tbody>
${b.rows.map((r) => `                <tr>
                  <td class="pf-td-prop">
                    <div class="pf-prop">
                      <span class="pf-prop-thumb"></span>
                      <div class="pf-prop-detail">
                        <div class="pf-prop-priceline"><span class="pf-prop-price">${price(esc(r.price))}</span><span class="pf-quality" data-band="${r.band}">${esc(r.quality)}</span></div>
                        <div class="pf-prop-specs">${r.specs.map((x) => `<span>${icon(x.icon, 14)}${esc(x.text)}</span>`).join('')}</div>
                        <div class="pf-prop-address">${esc(r.address)}</div>
                        <div class="pf-prop-ids">${r.ids.map((x) => `<span>${esc(x)}</span>`).join('<i>|</i>')}</div>
                      </div>
                    </div>
                  </td>
${r.cells.map((c) => `                  <td>${esc(c)}</td>`).join('\n')}
                </tr>`).join('\n')}
              </tbody>
            </table>`;

/* Ad License is a wizard, not a two-column form: a 1035-wide panel of section
   cards, each a 195-wide title column (an icon tile over the section name) and
   a 640-wide column of fields, where a field's control can be a row of choice
   pills as easily as an input. create-ad-license.js:270,447,474. */
const wizard = (b) => `            <div class="pf-wizard">
${b.sections.map((sec, si) => `              <section class="pf-wsection">
                <div class="pf-wsection-title">
                  <span class="pf-wsection-icon">${icon(sec.icon, 24)}</span>
                  <span>${esc(sec.title)}</span>
                </div>
                <div class="pf-wsection-fields">
${sec.fields.map((f, fi) => {
  const id = `${b.id}-${si}-${fi}`;
  const body = f.type === 'choices'
    ? `                      <div class="pf-choices" role="radiogroup">${f.options.map((o) => `<button class="pf-choice" role="radio" type="button" data-noop="choosing a value here refetches the fields below it">${o.icon ? icon(o.icon, 14) : ''}<span>${esc(o.label || o)}</span></button>`).join('')}</div>`
    : f.type === 'select'
      ? `                      <button class="pf-select" id="${id}" type="button" aria-haspopup="listbox"${f.disabled ? ' disabled' : ' data-open="listbox-blocks" data-placement="bottom"'}><span class="pf-placeholder">${esc(f.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`
      : `                      <span class="pf-input"><input id="${id}" type="text" placeholder="${esc(f.placeholder || '')}"></span>`;
  return `                  <div class="pf-wfield">
                    <span class="pf-wfield-icon">${icon(f.icon, 16)}</span>
                    <div class="pf-wfield-body">
                      <label class="pf-field-label" for="${id}">${esc(f.label)}${f.hint ? `<span class="pf-field-hint"> (${esc(f.hint)})</span>` : ''}</label>
${f.type === 'choices' || f.type === 'select' || true ? body : ''}
                    </div>
                  </div>`;
}).join('\n')}
                </div>
              </section>`).join('\n')}
            </div>`;

const BODY = { stats, plot, table, form, tabs, statcard, donuts, segmented, metricTabs, pills, chart, credits, timeline, proptable, wizard };

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

/* A card's HEAD is not always a title and a link. The Performance card's head
   is 158 tall and carries a segmented control, a date field and a tab strip of
   metric tiles; Credits Usage's carries a pill button; Listing Report's an icon
   button. So a head is a title plus any number of blocks, rendered in the same
   vocabulary as a body — which is what let this page stop being a grey box. */
const headRight = (b) => [
  b.segments ? BODY.segmented(b) : '',
  b.dateField ? `              <button class="pf-datefield" type="button" data-noop="the range picker opens a two-month calendar the product mounts on demand"><span>${esc(b.dateField)}</span>${icon('FiCalendar', 16)}</button>` : '',
  b.headAction ? `<a class="pf-btn" data-variant="${b.headActionVariant || 'link'}" data-size="small" href="not-built.html?screen=${encodeURIComponent(b.headAction)}">${b.headActionIcon ? icon(b.headActionIcon, 16) : ''}<span>${esc(b.headAction)}</span></a>` : '',
  b.headIcon ? `<button class="pf-icon-btn" type="button" data-noop="${esc(b.headIconNoop || 'this control needs the product\'s own drawer')}">${icon(b.headIcon, 16)}</button>` : '',
].filter(Boolean).join('\n');

const card = (b) => b.tabs ? tabbedCard(b) : `        <section class="pf-card pf-block" data-w="${b.w || 'full'}"${b.h ? ` data-h="${b.h}"` : ''}${b.headBody ? ' data-head="tall"' : ''}>
${b.title || b.headBody ? `          <div class="pf-block-head"${b.headBody ? ' data-tall="true"' : ''}>
            <div class="pf-block-head-row">
              <span class="pf-block-title">${esc(b.title || '')}</span>
${headRight(b)}
            </div>
${(b.headBody || []).map((x) => BODY[x.kind](x)).join('\n')}
          </div>` : ''}
          <div class="pf-block-body">
${(b.body || []).map((x) => BODY[x.kind](x)).join('\n')}
          </div>
        </section>`;

/* The filter bar. Not one bar: Listings has Show More / Clear / Search, Leads
   & Reach has a labelled date range and a purpose select, and LMS Leads has a
   compound search field plus an "Add New Lead" button on the right. So the
   fields AND the actions come from the fixture. */
const fbField = (slug) => (x, i) => {
  const id = `${slug}-fb-${i}`;
  const ctl = x.type === 'select'
    ? `            <button class="pf-select" id="${id}" type="button" aria-haspopup="listbox" data-open="listbox-blocks" data-placement="bottom"><span class="pf-placeholder">${esc(x.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`
    : x.type === 'date'
      /* NOT wired to the Listings calendar. That overlay is this system's one
         known-fabricated component — both of its months share one invented day
         grid — and putting it behind two more triggers would spread a defect
         rather than reuse a measurement. It says so instead. */
      ? `            <button class="pf-datefield" id="${id}" type="button" data-noop="the range calendar is not measured yet — see authoring/qa-listings.md"><span class="pf-placeholder">${esc(x.placeholder)}</span>${icon('FiCalendar', 16)}</button>`
      : x.type === 'search-compound'
        /* LMS Leads: one control that is an input and a select side by side,
           sharing a border — searchBy picks which field the text applies to */
        ? `            <span class="pf-compound">
              <span class="pf-input"><input id="${id}" type="text" placeholder="${esc(x.placeholder)}"></span>
              <button class="pf-select" type="button" aria-haspopup="listbox" data-open="listbox-blocks" data-placement="bottom"><span class="pf-placeholder">${esc(x.selectPlaceholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>
            </span>`
        : `            <span class="pf-input"><input id="${id}" type="text" placeholder="${esc(x.placeholder)}"></span>`;
  return `          <div class="pf-field"${x.w ? ` style="--field-w:${x.w}px"` : ''}>
${x.label ? `            <label class="pf-field-label" for="${id}">${esc(x.label)}</label>` : ''}
${ctl}
          </div>`;
};

const fbAction = (a) => {
  if (a.kind === 'clear') return `          <button class="pf-btn" data-variant="link-danger" data-size="small" type="button" data-noop="clearing a filter is a URL push and a refetch"><span>${esc(a.label)}</span></button>`;
  if (a.kind === 'showmore') return `          <button class="pf-btn" data-variant="tint" data-size="small" type="button" data-open="drawer-filters"><span>${esc(a.label)}</span>${icon('MdOutlineDoubleArrow', 18)}</button>`;
  if (a.kind === 'link') return `          <a class="pf-btn" data-variant="${a.variant || 'default'}" data-size="large" href="not-built.html?screen=${encodeURIComponent(a.label)}">${a.icon ? icon(a.icon, 16) : ''}<span>${esc(a.label)}</span></a>`;
  return `          <button class="pf-btn" data-variant="${a.variant || 'primary'}" data-size="large" type="button" data-noop="Search pushes the filter values into the URL and refetches">${a.icon ? icon(a.icon, null) : ''}<span>${esc(a.label)}</span></button>`;
};

const filterBar = (f, slug) => `      <div class="pf-filter-bar"${f.plain ? ' data-plain="true"' : ''}>
        <div class="pf-filter-fields">
${f.fields.map(fbField(slug)).join('\n')}
        </div>
        <div class="pf-filter-actions">
${(f.actions || []).map(fbAction).join('\n')}
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
  const html = open({ title: p.title, current: p.rail, docTitle: `${p.docTitle || p.title} — Profolio KSA`, comment, contentGap: 8 })
    + (p.back ? `      <div class="pf-page-lead">
        <a class="pf-btn" data-variant="tint" data-size="small" href="${p.back.href || 'listings.html'}">${icon('LeftOutlined', 14)}<span>${esc(p.back.label)}</span></a>
        <h2 class="pf-page-h2">${esc(p.heading)}</h2>
      </div>\n` : '')
    + (p.filterBar ? filterBar(p.filterBar, p.slug) + '\n' : '')
    + (p.column ? `      <div class="pf-settings-main">\n` : '')
    + p.rows.map((r) => (r.heading ? `      <h3 class="pf-section-h">${esc(r.heading)}</h3>\n` : '') + (r.filterBar ? filterBar(r.filterBar, p.slug) + '\n' : '') + row(r)).join('\n') + '\n'
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
