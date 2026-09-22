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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, REPO } from './serve.mjs';
import { answer, THUMB, AVATAR_SVG } from './fixtures.mjs';

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
const FONTS_CSS = readFileSync(join(ROOT, 'deliverables/fonts.css'), 'utf8');
const locales = flag('--rtl') ? ['en', 'ar'] : ['en'];
const WITH_STATES = flag('--states');
/* the answer-set mode a state step is running under — null for a normal
   answer, 'error' or 'slow' while one step wants a failure or a wait */
let MODE = null;

/* ── one page per route ────────────────────────────────────────────────── */
/* wait for the page to stop moving — the same settle every capture uses, so a
   state capture is not held to a looser standard than the default one */
async function settle(page) {
  try { await page.waitForLoadState('networkidle', { timeout: 20_000 }); } catch {}
  try {
    /* the Credits card keeps two zero-size spinners mounted; only a spinner with area is waiting on something */
    await page.waitForFunction(() => ![...document.querySelectorAll('.ant-spin-spinning, .ant-skeleton-active')]
      .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), null, { timeout: 15_000 });
  } catch {}
  await page.waitForTimeout(1200);
}

/** Capture whatever is on screen right now under `name`. */
async function snap(page, name, captureSrc, locale, extra = {}) {
  const state = await page.evaluate(() => ({
    finalPath: location.pathname,
    shell: !!document.querySelector('.ant-layout-header') && !!document.querySelector('.ant-layout-sider'),
    errorCard: !!document.querySelector('.ant-result-error'),
    overlay: {
      modal: !!document.querySelector('.ant-modal'),
      drawer: !!document.querySelector('.ant-drawer-content'),
      popover: !!document.querySelector('.ant-popover'),
      dropdown: !!document.querySelector('.ant-dropdown'),
    },
    spinning: [...document.querySelectorAll('.ant-spin-spinning, .ant-skeleton-active')].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
    pageHeight: document.documentElement.scrollHeight,
  }));
  const capture = await page.evaluate(captureSrc);
  capture.source = 'harness';
  capture.locale = locale;
  capture.state = name;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.capture.json`), JSON.stringify(capture));
  /* an overlay is positioned in the viewport, so a full-page shot would put it
     at the top of a 1929px image and crop nothing usefully — shoot the viewport */
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: !state.overlay.modal && !state.overlay.drawer && !state.overlay.popover });
  writeFileSync(join(OUT, `${name}.log.json`), JSON.stringify({ ...state, ...extra }, null, 2));
  return { state, nodes: capture.nodes };
}

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
    /* Google Fonts is the one off-origin request worth answering rather than
       blocking: useAppInit.js fetches Figtree there, and Figtree is what the
       product paints with. Blocking it made the product render in the system
       fallback while our page rendered in a real face, so every text width
       differed for a reason that had nothing to do with our markup. Serve the
       same embedded faces deliverables/fonts.css carries. */
    if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.host)) {
      if (u.host === 'fonts.googleapis.com') {
        log.fonts = 'served from deliverables/fonts.css';
        return r.fulfill({ status: 200, contentType: 'text/css', body: FONTS_CSS });
      }
      return r.abort();          /* the faces are already inlined in that CSS */
    }
    if (u.host !== appHost) { log.blocked++; return r.abort(); }         /* nothing else leaves the sandbox */
    if (u.pathname.startsWith('/harness-img/')) return r.fulfill({ status: 200, contentType: THUMB.contentType, body: u.pathname.includes('avatar') ? AVATAR_SVG : THUMB.body });
    if (u.pathname.startsWith('/api/')) {
      /* A step may put the answer set into a MODE, which is how the loading
         and error states get captured rather than drawn:
           'error' — the listings query fails, and the product renders its own
                     error card. Only that endpoint fails; a 500 everywhere
                     would take the shell down with it.
           'slow'  — the listings query is held open, so the screen the
                     product paints while waiting is what gets captured.
         Anything else answers normally. */
      if (MODE === 'error' && /\/api\/surge\/listings$/.test(u.pathname)) {
        log.mode = 'error on /api/surge/listings';
        return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"harness: deliberate failure"}' });
      }
      if (MODE === 'slow' && /\/api\/surge\/(listings|ovation)/.test(u.pathname)) {
        log.mode = 'listings held open';
        return new Promise(() => {});      /* never settles; the step snaps the skeleton */
      }
      const body = answer(r.request().method(), u.pathname, u.search, MODE);
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

  /* ── the states ──────────────────────────────────────────────────────
     Each step runs on a page reloaded to the default first, so one state can
     never leak into the next. */
  const states = [];
  if (WITH_STATES) {
    const file = join(HERE, 'interactions', `${slug(route)}.mjs`);
    if (existsSync(file)) {
      let steps = (await import(file)).default;
      /* --states=a,b runs only those steps. A full sweep of Listings is 27
         page loads; while adding one state you want the one. */
      const only = (arg('--states') || '').split(',').map((x) => x.trim()).filter(Boolean);
      if (only.length) {
        const unknown = only.filter((o) => !steps.some((st) => st.name === o));
        if (unknown.length) console.log(`  unknown state(s): ${unknown.join(', ')}`);
        steps = steps.filter((st) => only.includes(st.name));
      }
      for (const step of steps) {
        try {
          MODE = step.mode || null;
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          await page.waitForSelector('.ant-layout', { timeout: 30_000 });
          /* a held-open or failed query never settles — that is the point.
             'member' is a different answer SET, not a broken one, so it waits
             like any other step. */
          if (step.mode !== 'slow' && step.mode !== 'error') await settle(page);
          if (step.do) await step.do(page);
          await page.waitForTimeout(600);
          const r = await snap(page, `${name}--${step.name}`, captureSrc, locale, { note: step.note, url });
          const kinds = Object.entries(r.state.overlay).filter(([, v]) => v).map(([k]) => k);
          states.push({ name: step.name, ok: true, nodes: r.nodes, overlay: kinds.join('+') || 'inline' });
        } catch (e) {
          states.push({ name: step.name, ok: false, why: String(e).split('\n')[0].slice(0, 90) });
        } finally {
          MODE = null;
        }
      }
    }
  }

  await ctx.close();
  return { name, ...state, nodes: capture.nodes, states, unanswered: [...new Set(log.unanswered)], errors: [...new Set(log.errors)], ms: Date.now() - t0 };
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
    (r.errors.length ? `\n${' '.repeat(32)}errors: ${r.errors.slice(0, 3).join(' | ')}` : '') +
    ((r.states || []).length ? `\n${' '.repeat(32)}states: ${r.states.map((x) => x.ok ? `${x.name} (${x.overlay})` : `${x.name} FAILED — ${x.why}`).join('\n' + ' '.repeat(40))}` : ''));
}
await browser.close();
if (!process.env.KEEP_SERVER) await app.stop();
console.log(`\n  ${results.length} capture(s) in data/live/`);
