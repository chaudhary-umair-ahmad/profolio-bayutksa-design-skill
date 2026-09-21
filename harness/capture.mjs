#!/usr/bin/env node
/**
 * Capture every route of the product, from the product itself.
 *
 * Boots the app's own Vite dev server, signs a headless Chromium in with a
 * fixture user, answers every API call from harness/fixtures.mjs, and runs the
 * capture extension's page script — tools/profolio-capture/capture.js, verbatim —
 * on each route. Same allow-lists, same output shape, so a harness capture and
 * one someone clicks out of the extension are directly comparable.
 *
 *   node harness/capture.mjs                    every route, English
 *   node harness/capture.mjs --routes dashboard,listings
 *   node harness/capture.mjs --rtl              also /ar for each route
 *   node harness/capture.mjs --list             print the route table and exit
 *
 * Writes data/live/<route>.capture.json and <route>.png (full page, 1440 wide).
 * A route that never shows the shell, or shows the Error card, is reported and
 * still written — a failed capture is evidence too.
 *
 * What this is not: production. No CDN, dev-mode React, every flag at its
 * default, fixture data. It answers what only a browser can — painted heights,
 * stroke widths, row heights — and where the source declares a value, the
 * source still wins.
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, REPO } from './serve.mjs';
import { answer, THUMB } from './fixtures.mjs';

const { chromium } = pkg;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'data', 'live');
const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
const flag = (n) => process.argv.includes(n);

/* ── the route table is the product's, read not maintained ─────────────── */
const routesSrc = readFileSync(join(REPO, 'src/tenant/common/routes/appRoutes.js'), 'utf8');
/* getUserSettingsRoutes() declares its paths as `${path}/user-profile` but they
   mount under /user-settings/*, so anything declared before the next helper
   gets that prefix */
const settingsEnd = routesSrc.indexOf('const getInboxSubRoutes');
const ALL = [...new Set(
  [...routesSrc.matchAll(/path:\s*`\$\{path\}([^`]+)`/g)]
    .map((m) => (m.index < settingsEnd ? '/user-settings' : '') + m[1])
    .filter((p) => !p.includes(':'))            /* needs an id we do not have */
    .map((p) => p.replace(/\/\*$/, ''))         /* /inbox/*  → /inbox */
)];
const slug = (p) => p.replace(/^\//, '').replace(/\//g, '-');

let routes = ALL;
if (arg('--routes')) {
  const want = arg('--routes').split(',').map((s) => s.trim());
  routes = ALL.filter((p) => want.includes(slug(p)) || want.includes(p));
  const missing = want.filter((w) => !routes.some((p) => slug(p) === w || p === w));
  if (missing.length) { console.error(`  unknown route(s): ${missing.join(', ')}\n  known: ${ALL.map(slug).join(' ')}`); process.exit(2); }
}
if (flag('--list')) { console.log(ALL.map((p) => `  ${slug(p).padEnd(28)} ${p}`).join('\n')); process.exit(0); }

const user = JSON.parse(readFileSync(join(HERE, 'fixtures/user.json'), 'utf8'));
const captureSrc = readFileSync(join(ROOT, 'tools/profolio-capture/capture.js'), 'utf8');
const locales = flag('--rtl') ? ['en', 'ar'] : ['en'];

/* ── one page per route ────────────────────────────────────────────────── */
async function captureRoute(browser, base, route, locale) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: locale === 'ar' ? 'ar-SA' : 'en',
  });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('tapTargets', JSON.stringify({ lms: { introModal: { hide: true } } })); } catch {}
  });
  await ctx.addCookies([{ name: 'byt_cd', value: 'harness-token', domain: '127.0.0.1', path: '/' }]);
  const page = await ctx.newPage();

  const log = { answered: [], unanswered: [], errors: [], blocked: 0 };
  page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' && !/^Warning:|ERR_FAILED|ERR_ABORTED|Moengage|ServiceWorker/.test(m.text())) log.errors.push(m.text().slice(0, 300)); });

  const appHost = new URL(base).host;
  await page.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.host !== appHost) { log.blocked++; return r.abort(); }         /* nothing leaves the sandbox */
    if (u.pathname.startsWith('/harness-img/')) return r.fulfill({ status: 200, contentType: THUMB.contentType, body: THUMB.body });
    if (u.pathname.startsWith('/api/')) {
      const body = answer(r.request().method(), u.pathname);
      (body === undefined ? log.unanswered : log.answered).push(`${r.request().method()} ${u.pathname}`);
      /* never abort an API call: an aborted request pins a skeleton forever, a 200 lands in an empty state */
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body ?? {}) });
    }
    return r.continue();
  });

  const url = `${base}/${locale}${route}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  try { await page.waitForSelector('.ant-layout', { timeout: 30_000 }); } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: 20_000 }); } catch {}
  /* let skeletons and spinners resolve, then a beat for the chart to paint */
  try {
    /* the Credits card keeps two zero-size spinners mounted; only a spinner with area is waiting on something */
    await page.waitForFunction(() => ![...document.querySelectorAll('.ant-spin-spinning, .ant-skeleton-active')]
      .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), null, { timeout: 15_000 });
  } catch {}
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => ({
    finalPath: location.pathname,
    shell: !!document.querySelector('.ant-layout-header') && !!document.querySelector('.ant-layout-sider'),
    errorCard: !!document.querySelector('.ant-result-error'),
    spinning: [...document.querySelectorAll('.ant-spin-spinning, .ant-skeleton-active')].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
    pageHeight: document.documentElement.scrollHeight,
  }));

  const capture = await page.evaluate(captureSrc);
  capture.source = 'harness';           /* vs. the extension; same shape otherwise */
  capture.locale = locale;

  const name = slug(route) + (locale === 'ar' ? '.rtl' : '');
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.capture.json`), JSON.stringify(capture));
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  writeFileSync(join(OUT, `${name}.log.json`), JSON.stringify({ url, ...state, ...log, answered: [...new Set(log.answered)], ms: Date.now() - t0 }, null, 2));

  await ctx.close();
  return { name, ...state, nodes: capture.nodes, unanswered: [...new Set(log.unanswered)], errors: [...new Set(log.errors)], ms: Date.now() - t0 };
}

/* ── run ───────────────────────────────────────────────────────────────── */
const app = await serve();
const browser = await chromium.launch();
const results = [];
for (const route of routes) for (const locale of locales) {
  const r = await captureRoute(browser, app.url, route, locale);
  results.push(r);
  const verdict = r.errorCard ? 'ERROR CARD' : !r.shell ? 'NO SHELL' : r.spinning ? 'still spinning' : 'ok';
  console.log(`  ${r.name.padEnd(30)} ${verdict.padEnd(15)} ${String(r.nodes).padStart(5)} nodes  ${String(r.pageHeight).padStart(5)}px  ${String(r.ms).padStart(6)}ms` +
    (r.unanswered.length ? `\n${' '.repeat(32)}unanswered: ${r.unanswered.join(', ')}` : '') +
    (r.errors.length ? `\n${' '.repeat(32)}errors: ${r.errors.slice(0, 3).join(' | ')}` : ''));
}
await browser.close();
if (!process.env.KEEP_SERVER) await app.stop();
console.log(`\n  ${results.length} capture(s) in data/live/`);
