#!/usr/bin/env node
/**
 * Measure a REAL Profolio screen, saved from a real browser with SingleFile.
 *
 *   node scripts/measure-real.mjs ~/page.html --route listings --width 1440
 *   node scripts/measure-real.mjs http://127.0.0.1:3000/en/design-capture
 *
 * It takes a SingleFile on disk or a URL. A URL is how the /design-capture
 * routes get measured without anyone saving anything: they are public, they
 * need no account and no server, so the harness's own boot serves them and
 * this walks them directly. A SingleFile is still what brings back a screen
 * this sandbox cannot reach.
 *
 * Why this exists: the sandbox cannot reach profolio.bayut.sa or
 * profolio.staging.bayut.sa — the proxy answers 403 — and there is no route to
 * anyone's browser. `harness/capture.mjs` boots the product here instead, which
 * is a good reference and was, for a while, a misleading one: it runs on a
 * FIXTURE ACCOUNT, and an account's accidents read exactly like the product's
 * rules. A listing with no discount offer taught me the row had five actions.
 * An account with no credits taught me every upgrade circle was disabled. Both
 * went into the design system as facts.
 *
 * A SingleFile of the real screen settles those questions. It is a faithful
 * copy of one rendered state — all of the DOM, all of the CSS antd had
 * injected by then, the fonts — so opening it here and walking it produces a
 * capture of the same shape as every other, and everything downstream works.
 *
 * WHAT IT DOES NOT CONTAIN: flows. antd v5 is CSS-in-JS, so a component that
 * never rendered has neither markup nor styles in the file — an unopened modal
 * leaves no trace at all. Overlays come from the harness, which opens them by
 * clicking. This file is what tells the harness's account to look like a real
 * one.
 *
 * PRIVACY. The input is somebody's signed-in screen. The walker records
 * geometry, an allow-list of computed styles, class names and icon names, and
 * no text, href, src, value, id or data-* — and this script re-proves that with
 * scripts/leaks.mjs BEFORE it writes anything. The SingleFile itself is never
 * copied into the repo; pass it from wherever it lives.
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLeaks } from './leaks.mjs';

const { chromium } = pkg;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : fallback;
};
const file = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true);
const isUrl = !!file && /^https?:\/\//.test(file);
if (!file || (!isUrl && !existsSync(file))) {
  console.error('usage: measure-real.mjs <singlefile.html | url> [--route name] [--width 1440]');
  process.exit(2);
}
const width = Number(arg('--width', 1440));

/* SingleFile writes the original URL into a comment at the top of the file.
   It is provenance worth keeping — and it is how the route defaults. */
const head = isUrl ? '' : readFileSync(file, 'utf8').slice(0, 1200);
const sourceUrl = isUrl ? file : /url:\s*(\S+)/.exec(head)?.[1] || '';
const savedAt = isUrl ? new Date().toISOString() : /saved date:\s*([^\n]+)/.exec(head)?.[1]?.trim() || '';
/* /en/design-capture/flows?only=booking → design-capture-flows-only-booking,
   so every route lands on one flat, predictable filename */
const slug = (u) => ((u.match(/\/[a-z]{2}\/(.+)$/)?.[1] || 'page')
  .replace(/[/?&=]+/g, '-').replace(/-+$/, '').replace(/^-+/, '') || 'page');
const route = arg('--route', isUrl ? slug(sourceUrl) : (sourceUrl.match(/\/[a-z]{2}\/([\w-]+)/)?.[1] || basename(file).replace(/\..*$/, '')));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(isUrl ? file : 'file://' + file, { waitUntil: isUrl ? 'domcontentloaded' : 'load' });
/* a live route has to mount, fetch its lazy chunk and let the ref-driven
   overlays open themselves; a saved file is already settled */
await page.waitForTimeout(isUrl ? 5000 : 1200);

/* the SAME walker the extension and the harness use, so the output is an
   ordinary capture and derive-layout/qa-design need no special case */
const capture = await page.evaluate(readFileSync(join(ROOT, 'tools/profolio-capture/capture.js'), 'utf8'));
capture.source = isUrl ? 'local-route' : 'singlefile';
capture.sourceUrl = sourceUrl;
capture.savedAt = savedAt;
capture.route = route;

const json = JSON.stringify(capture);
const leaks = findLeaks(json);
if (leaks.length) {
  console.error(`\n  REFUSING TO WRITE — this capture carries data it promised not to:`);
  for (const l of leaks) console.error(`    ${l}`);
  console.error('\n  Nothing was written. Fix tools/profolio-capture/capture.js, not this check.');
  await browser.close();
  process.exit(1);
}

mkdirSync(join(ROOT, 'data', 'live'), { recursive: true });
const out = join(ROOT, 'data', 'live', `${route}.real.capture.json`);
writeFileSync(out, json);
/* The PNG is a picture of a real account — listings, prices, an avatar. It is
   written for side-by-side work and .gitignore keeps it out of the repo; only
   the JSON, which carries no text at all, is committed. */
await page.screenshot({ path: join(ROOT, 'data', 'live', `${route}.real.png`), fullPage: true });

/* ── the report: what is different, in the terms the pages are built in ──── */
const seen = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
  const rows = [...document.querySelectorAll('tbody tr.ant-table-row')];
  const state = (btn) => {
    const cs = getComputedStyle(btn);
    if (btn.parentElement?.querySelector('.icon-applied')) return 'applied';
    return btn.disabled || cs.pointerEvents === 'none' || +cs.opacity < 0.9 ? 'disabled' : 'enabled';
  };
  const lastCells = (tr) => {
    const tds = [...tr.children];
    return { up: tds[tds.length - 2], act: tds[tds.length - 1] };
  };
  return {
    viewport: { w: innerWidth, h: innerHeight },
    page: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    nav: [...document.querySelectorAll('.ant-layout-sider a, .ant-layout-sider li')].map(txt).filter(Boolean),
    tabs: [...document.querySelectorAll('.ant-tabs-tab')].map(txt),
    columns: [...document.querySelectorAll('thead th')].map((th) => ({ label: txt(th) || '(empty)', w: Math.round(th.getBoundingClientRect().width) })),
    rowHeight: rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : null,
    rows: rows.slice(0, 10).map((tr) => {
      const { up, act } = lastCells(tr);
      return {
        actions: [...act.querySelectorAll('button')].map(state),
        upgrades: [...up.querySelectorAll('button')].map(state),
      };
    }),
    fontOfTitle: getComputedStyle(document.querySelector('.navbar-page-title') || document.body).fontFamily,
    bell: txt(document.querySelector('.ant-badge-count')),
  };
});
await browser.close();

const tally = (list) => Object.entries(list.reduce((a, k) => ({ ...a, [k]: (a[k] || 0) + 1 }), {}))
  .map(([k, n]) => `${n}×${k}`).join(' ');

console.log(`\n  ${sourceUrl || file}`);
console.log(`  saved ${savedAt || 'unknown'} · walked ${capture.nodes} nodes${capture.truncated ? ' (TRUNCATED)' : ''}`);
console.log(`  → ${out.slice(ROOT.length + 1)} + ${route}.real.png\n`);
console.log(`  viewport   ${seen.viewport.w}×${seen.viewport.h}   page ${seen.page.w}×${seen.page.h}`);
console.log(`  title font ${seen.fontOfTitle}`);
console.log(`  bell       ${seen.bell || '—'}`);
console.log(`  rail       ${seen.nav.length} items: ${seen.nav.join(' · ')}`);
console.log(`  tabs       ${seen.tabs.join(' · ')}`);
console.log(`  columns    ${seen.columns.map((c) => `${c.label} ${c.w}`).join(' · ')}`);
console.log(`  row height ${seen.rowHeight}`);
for (const [i, r] of seen.rows.entries()) {
  console.log(`  row ${String(i).padEnd(2)}    actions ${r.actions.length} [${tally(r.actions)}] · upgrades ${r.upgrades.length} [${tally(r.upgrades)}]`);
}
console.log(`\n  Compare:  node scripts/derive-layout.mjs --compare ${out.slice(ROOT.length + 1)} data/ours/${route}.capture.json`);
