#!/usr/bin/env node
/**
 * The capture as a layout manifest — and the score.
 *
 * A capture is a tree of boxes and computed styles with the product's own
 * class names on it. This reads one and writes data/layout/<route>.json: the
 * regions a page is made of, found by those class names (never by position),
 * each with its box, the styles that matter, and which catalogued class of
 * ours it maps to. That manifest is what a page is composed against.
 *
 * The same region table matched against a capture of OUR page gives the
 * comparison: box delta and differing properties per region, ranked, then one
 * weighted number. Shell and type count triple, table cells double, the same
 * weighting reconcile.mjs --diff uses so the two scores mean the same thing.
 *
 *   node scripts/derive-layout.mjs data/live/listings.capture.json
 *   node scripts/derive-layout.mjs --ours deliverables/listings.html      # capture our page → data/ours/
 *   node scripts/derive-layout.mjs --compare data/live/listings.capture.json data/ours/listings.capture.json
 *
 * Attributes are not captured (capture.js keeps tag, class, box, style, icon),
 * so "active" states on our side are recognised by the style they produce —
 * a 700 tab, a primary-bordered page item — not by aria-*.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const after = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : undefined; };

/* ── helpers over a capture tree ─────────────────────────────────────────── */
const walk = (n, fn, depth = 0) => { if (!n) return; fn(n, depth); (n.children || []).forEach((k) => walk(k, fn, depth + 1)); };
const all = (root, pred) => { const out = []; walk(root, (n) => { if (pred(n)) out.push(n); }); return out; };
const first = (root, pred) => all(root, pred)[0];
const has = (n, ...cls) => cls.every((c) => (n.class || []).some((x) => x === c || x.startsWith(c + '-') && c.endsWith('*')));
const cls = (n, c) => (n.class || []).includes(c);
const within = (outer, n) => n.box.x >= outer.box.x && n.box.y >= outer.box.y &&
  n.box.x + n.box.w <= outer.box.x + outer.box.w + 1 && n.box.y + n.box.h <= outer.box.y + outer.box.h + 1;
const px = (v) => { const m = /(-?[\d.]+)px/.exec(String(v)); return m ? +m[1] : null; };
const rgb = (v) => String(v).replace(/\s+/g, '').replace(/^rgba\((\d+),(\d+),(\d+),1\)$/, 'rgb($1,$2,$3)');

/* ── the regions, and how to find each on either side ────────────────────
   live : predicate over a product node (ant-* / product class names)
   ours : predicate over one of our nodes (pf-* class names, or the style an
          attribute state produces)
   props: the computed properties worth holding to account for this region
   w    : weight in the score                                                */
const GEOM = ['width', 'height'];
const PAD = ['paddingTop', 'paddingBottom', 'paddingInlineStart', 'paddingInlineEnd'];
const TYPE = ['fontSize', 'fontWeight', 'lineHeight', 'color'];
const BOXY = ['backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderTopLeftRadius'];

export const REGIONS = [
  { id: 'shell.sider',    ours: '.pf-rail',          w: 3, live: (n) => cls(n, 'ant-layout-sider'),      mine: (n) => cls(n, 'pf-rail'),          props: [...GEOM, 'backgroundColor'] },
  { id: 'shell.header',   ours: '.pf-header',        w: 3, live: (n) => cls(n, 'ant-layout-header'),     mine: (n) => cls(n, 'pf-header'),        props: [...GEOM, 'paddingInlineStart', 'backgroundColor'] },
  { id: 'shell.title',    ours: '.pf-page-title',    w: 3, live: (n) => cls(n, 'navbar-page-title'),     mine: (n) => cls(n, 'pf-page-title'),    props: TYPE },
  { id: 'shell.content',  ours: '.pf-content',       w: 3, live: (n) => cls(n, 'ant-layout-content'),    mine: (n) => cls(n, 'pf-content'),       props: GEOM },
  { id: 'shell.footer',   ours: '.pf-footer',        w: 3, live: (n) => n.tag === 'footer',              mine: (n) => cls(n, 'pf-footer'),        props: [...GEOM, ...PAD, 'fontSize', 'color', 'backgroundColor'] },

  { id: 'filter.bar',     ours: '.pf-filter-bar',    w: 2, live: (n) => cls(n, 'main-filter-container'), mine: (n) => cls(n, 'pf-filter-bar'),    props: [...GEOM, 'gap'] },
  { id: 'filter.field',   ours: '.pf-field',         w: 1, scope: 'filter.bar', live: (n) => cls(n, 'ant-form-item'),         mine: (n) => cls(n, 'pf-field'),         props: [...GEOM, 'marginBottom'] },
  { id: 'filter.label',   ours: '.pf-field-label',   w: 3, scope: 'filter.bar', live: (n) => n.tag === 'label' && n.style.fontSize === '12px', mine: (n) => cls(n, 'pf-field-label'), props: [...GEOM, ...TYPE] },
  { id: 'filter.input',   ours: '.pf-input',         w: 2, scope: 'filter.bar', live: (n) => cls(n, 'ant-input-affix-wrapper'), mine: (n) => cls(n, 'pf-input'),       props: [...GEOM, ...PAD, ...BOXY, 'fontSize', 'lineHeight'] },
  { id: 'filter.select',  ours: '.pf-select',        w: 2, scope: 'filter.bar', live: (n) => cls(n, 'ant-select-selector'),   mine: (n) => cls(n, 'pf-select'),        props: [...GEOM, 'paddingInlineStart', 'paddingInlineEnd', ...BOXY, 'fontSize'] },
  { id: 'filter.showmore',ours: '.pf-btn[data-variant="tint"]', w: 1, scope: 'filter.bar', live: (n) => cls(n, 'ant-btn-default') && n.style.fontSize === '13px', mine: (n) => cls(n, 'pf-btn') && rgb(n.style.backgroundColor) === 'rgb(242,250,250)' && n.style.fontSize === '13px', props: [...GEOM, ...PAD, ...TYPE, 'backgroundColor', 'borderTopLeftRadius'] },
  { id: 'filter.clear',   ours: '.pf-btn[data-variant="link-danger"]', w: 1, scope: 'filter.bar', live: (n) => cls(n, 'ant-btn-link') && rgb(n.style.color) === 'rgb(247,49,49)', mine: (n) => cls(n, 'pf-btn') && rgb(n.style.color) === 'rgb(247,49,49)', props: [...GEOM, ...TYPE] },
  { id: 'filter.search',  ours: '.pf-filter-actions .pf-btn[data-variant="primary"]', w: 2, scope: 'filter.bar', live: (n) => cls(n, 'ant-btn-primary') && n.style.fontSize === '16px', mine: (n) => cls(n, 'pf-btn') && n.style.fontSize === '16px' && rgb(n.style.backgroundColor) === 'rgb(0,97,105)', props: [...GEOM, ...PAD, ...TYPE, 'backgroundColor', 'borderTopLeftRadius'] },

  { id: 'table.card',     ours: '.pf-table-card',    w: 2, live: (n) => cls(n, 'ant-card') && cls(n, 'ant-card-contain-tabs'), mine: (n) => cls(n, 'pf-table-card'), props: [...GEOM, 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'boxShadow'] },
  { id: 'table.card.head',ours: '.pf-table-card-head', w: 1, scope: 'table.card', live: (n) => cls(n, 'ant-card-head'),       mine: (n) => cls(n, 'pf-table-card-head'), props: [...GEOM, 'paddingInlineStart', 'borderBottomColor'] },
  { id: 'tabs.nav',       ours: '.pf-tabs',          w: 2, scope: 'table.card', live: (n) => cls(n, 'ant-tabs-nav-list'),     mine: (n) => cls(n, 'pf-tabs'),          props: [...GEOM, 'gap'] },
  { id: 'tabs.tab',       ours: '.pf-tab',           w: 3, scope: 'table.card', live: (n) => cls(n, 'ant-tabs-tab') && !cls(n, 'ant-tabs-tab-active'), mine: (n) => cls(n, 'pf-tab') && n.style.fontWeight !== '700', props: [...GEOM, 'paddingTop', 'paddingBottom', ...TYPE] },
  { id: 'tabs.active',    ours: '.pf-tab[aria-selected="true"]', w: 3, scope: 'table.card', noBox: true, live: (n) => cls(n, 'ant-tabs-tab-btn') && n.style.fontWeight === '700', mine: (n) => cls(n, 'pf-tab') && n.style.fontWeight === '700', props: ['fontWeight', 'color', 'fontSize'] },
  { id: 'tabs.ink',       ours: '.pf-tab[aria-selected] ink', w: 1, scope: 'table.card', live: (n) => cls(n, 'ant-tabs-ink-bar'), mine: null, props: ['height', 'backgroundColor'] },

  { id: 'table',          ours: '.pf-table',         w: 2, live: (n) => n.tag === 'table',               mine: (n) => n.tag === 'table',          props: [...GEOM, 'fontSize'] },
  { id: 'table.head',     ours: '.pf-table th',      w: 2, live: (n) => n.tag === 'th',                  mine: (n) => n.tag === 'th',             props: ['height', ...PAD, ...TYPE, 'backgroundColor', 'borderTopColor'] },
  { id: 'table.row',      ours: '.pf-table tbody tr',w: 2, live: (n) => n.tag === 'tr' && cls(n, 'ant-table-row'), mine: (n) => n.tag === 'tr' && n.children?.[0]?.tag === 'td', props: ['height'] },
  { id: 'table.cell',     ours: '.pf-table td',      w: 2, live: (n) => n.tag === 'td' && n.box.h > 0,                  mine: (n) => n.tag === 'td',             props: ['height', ...PAD, 'fontSize', 'borderBottomWidth'] },
  { id: 'table.thumb',    ours: '.pf-listing-thumb', w: 2, live: (n) => cls(n, 'ant-image-img'),         mine: (n) => cls(n, 'pf-listing-thumb'), props: [...GEOM] },

  { id: 'pager',          ours: '.pf-pagination',    w: 1, live: (n) => cls(n, 'ant-pagination'),        mine: (n) => cls(n, 'pf-pagination'),    props: [...GEOM, 'justifyContent'] },
  { id: 'pager.item',     ours: '.pf-page-item',     w: 1, live: (n) => cls(n, 'ant-pagination-item') && !cls(n, 'ant-pagination-item-active'), mine: (n) => cls(n, 'pf-page-item') && n.children?.[0]?.tag === 'a' && rgb(n.style.borderTopColor) !== 'rgb(0,97,105)', props: [...GEOM, 'minWidth', 'marginTop', 'marginInlineStart', ...BOXY, 'fontSize', 'lineHeight'] },
  { id: 'pager.active',   ours: '.pf-page-item[aria-current="page"]', w: 1, live: (n) => cls(n, 'ant-pagination-item-active'), mine: (n) => cls(n, 'pf-page-item') && rgb(n.style.borderTopColor) === 'rgb(0,97,105)', props: ['backgroundColor', 'borderTopColor', 'fontWeight'] },
  { id: 'pager.nav',      ours: '.pf-page-item[data-nav]', w: 1, live: (n) => cls(n, 'ant-pagination-prev'), mine: (n) => cls(n, 'pf-page-item') && n.children?.[0]?.tag === 'button', props: [...GEOM, 'borderTopLeftRadius', 'marginTop'] },
];

/* the shell's fixed rail and sticky header put x/y in the same place on both
   sides, so position is compared too — but only for regions with a stable
   anchor; a row's y depends on everything above it */
const POSITIONAL = new Set(['shell.sider', 'shell.header', 'shell.content', 'filter.bar', 'table.card', 'tabs.nav', 'table', 'pager']);

/* a region with a scope is searched only inside the node its scope resolved to,
   so a dashboard's card tabs are not mistaken for a listings page's status tabs */
export function pickRegions(capture, side) { return pick(capture, side); }

function pick(capture, side) {
  const found = {};
  for (const r of REGIONS) {
    const pred = side === 'live' ? r.live : r.mine;
    if (!pred) continue;
    const root = r.scope ? found[r.scope] : capture.tree;
    if (!root) continue;
    const n = first(root, pred);
    if (n) found[r.id] = n;
  }
  return found;
}

const manifestOf = (capture, side) => {
  const nodes = pick(capture, side);
  return Object.fromEntries(REGIONS.filter((r) => nodes[r.id]).map((r) => {
    const n = nodes[r.id];
    const style = Object.fromEntries(r.props.filter((p) => n.style[p] !== undefined).map((p) => [p, n.style[p]]));
    return [r.id, { ours: r.ours, weight: r.w, box: n.box, style }];
  }));
};

/* ── modes ───────────────────────────────────────────────────────────────
   Only when run directly: scripts/qa-design.mjs imports REGIONS and
   pickRegions from here, and an import must not run a CLI. */
const DIRECT = process.argv[1] && process.argv[1].endsWith('derive-layout.mjs');
if (!DIRECT) { /* imported as a library */ } else {
const routeOf = (file) => basename(file).replace(/\.capture\.json$/, '').replace(/\.rtl$/, '');

if (flag('--ours')) {
  /* capture our page with the extension's own script, exactly as the harness does */
  const page = after('--ours');
  const pkg = await import('/opt/node22/lib/node_modules/playwright/index.js');
  const { chromium } = pkg.default || pkg;
  const script = readFileSync(join(ROOT, 'tools/profolio-capture/capture.js'), 'utf8');
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('file://' + join(ROOT, page));
  await p.waitForTimeout(800);
  const cap = await p.evaluate(script);
  await b.close();
  cap.source = 'ours';
  mkdirSync(join(ROOT, 'data', 'ours'), { recursive: true });
  const out = join(ROOT, 'data', 'ours', `${basename(page, '.html')}.capture.json`);
  writeFileSync(out, JSON.stringify(cap));
  console.log(`  ${out.slice(ROOT.length + 1)} — ${cap.nodes} nodes, page ${cap.viewport.page.w}×${cap.viewport.page.h}`);
  process.exit(0);
}

if (flag('--compare')) {
  const [a, b] = [after('--compare'), args[args.indexOf('--compare') + 2]];
  const live = JSON.parse(readFileSync(a, 'utf8')), ours = JSON.parse(readFileSync(b, 'utf8'));
  const L = pick(live, 'live'), O = pick(ours, 'ours');
  const rows = [];
  let weighted = 0, total = 0;
  const same = (p, x, y) => {
    if (x === undefined && y === undefined) return true;
    if (x === undefined || y === undefined) return false;
    const px1 = px(x), px2 = px(y);
    if (px1 !== null && px2 !== null) return Math.abs(px1 - px2) <= 1;
    return rgb(x) === rgb(y);
  };
  for (const r of REGIONS) {
    const l = L[r.id], o = O[r.id];
    if (!l) continue;                                   /* the product does not have it on this page */
    if (!r.mine) continue;                              /* nothing of ours can be matched (the ink bar is a box-shadow) */
    if (!o) { rows.push({ id: r.id, prop: '(region)', live: 'present', ours: 'MISSING', w: r.w }); total += r.w * (r.props.length + 2); continue; }
    const dims = r.noBox ? [] : POSITIONAL.has(r.id) ? ['x', 'y', 'w', 'h'] : ['w', 'h'];
    for (const d of dims) {
      if (!['w', 'h'].includes(d) && !POSITIONAL.has(r.id)) continue;
      const geomProp = d === 'w' ? 'width' : d === 'h' ? 'height' : null;
      if (geomProp && r.props.includes(geomProp)) continue;   /* counted once, via the style */
      total += r.w;
      if (Math.abs(l.box[d] - o.box[d]) <= 1) weighted += r.w;
      else rows.push({ id: r.id, prop: `box.${d}`, live: l.box[d], ours: o.box[d], w: r.w });
    }
    for (const p of r.props) {
      total += r.w;
      if (same(p, l.style[p], o.style[p])) weighted += r.w;
      else rows.push({ id: r.id, prop: p, live: l.style[p] ?? '—', ours: o.style[p] ?? '—', w: r.w });
    }
  }
  rows.sort((x, y) => y.w - x.w || x.id.localeCompare(y.id));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n  ${pad('region', 18)} ${pad('property', 22)} ${pad('product', 30)} ours`);
  for (const r of rows) console.log(`  ${pad(r.id, 18)} ${pad(r.prop, 22)} ${pad(String(r.live).slice(0, 29), 30)} ${String(r.ours).slice(0, 40)}`);
  const score = total ? (weighted / total) * 100 : 0;
  console.log(`\n  ${rows.length} disagreements out of ${total} weighted checks · regions found: product ${Object.keys(L).length}, ours ${Object.keys(O).length}`);
  console.log(`  score  ${score.toFixed(1)}%\n`);
  mkdirSync(join(ROOT, 'data', 'layout'), { recursive: true });
  writeFileSync(join(ROOT, 'data', 'layout', `${routeOf(a)}.score.json`), JSON.stringify({ score: +score.toFixed(1), checks: total, disagreements: rows, at: new Date().toISOString() }, null, 2));
  process.exit(0);
}

/* default: manifest of a product capture */
const file = args.find((x) => !x.startsWith('--'));
if (!file) { console.error('usage: derive-layout.mjs <capture.json> | --ours <page.html> | --compare <live> <ours>'); process.exit(2); }
const cap = JSON.parse(readFileSync(file, 'utf8'));
const manifest = { route: cap.route, source: cap.source || 'live', viewport: cap.viewport, regions: manifestOf(cap, 'live') };
mkdirSync(join(ROOT, 'data', 'layout'), { recursive: true });
const out = join(ROOT, 'data', 'layout', `${routeOf(file)}.json`);
writeFileSync(out, JSON.stringify(manifest, null, 2));
const ids = Object.keys(manifest.regions);
console.log(`  ${out.slice(ROOT.length + 1)} — ${ids.length}/${REGIONS.length} regions found`);
const missing = REGIONS.filter((r) => !manifest.regions[r.id]).map((r) => r.id);
if (missing.length) console.log(`  not on this page: ${missing.join(', ')}`);
for (const id of ids) { const r = manifest.regions[id]; console.log(`    ${id.padEnd(18)} ${String(r.box.x).padStart(5)},${String(r.box.y).padStart(5)} ${String(r.box.w).padStart(5)}×${String(r.box.h).padStart(4)}  → ${r.ours}`); }
}
