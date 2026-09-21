#!/usr/bin/env node
/**
 * Captures reference screenshots of the live Profolio KSA screens into
 * references/screens/, so the design system carries its own visual truth
 * instead of relying on someone attaching a screenshot to a PRD.
 *
 * Profolio is behind Keycloak, so this never handles credentials. You log in
 * once by hand; Playwright saves the session and reuses it headlessly.
 *
 *   1. node scripts/capture.mjs --login --base https://profolio.bayut.sa
 *        Opens a real browser. Log in, then press Enter in the terminal.
 *        Session is written to .auth.json (git-ignored).
 *
 *   2. node scripts/capture.mjs --base https://profolio.bayut.sa
 *        Visits every route in references/pages/index.md and writes
 *        references/screens/<route>.png. Add --only /dashboard for one screen.
 *
 * Then re-run build.mjs so the page templates pick the screenshots up.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SCREENS = join(ROOT, 'references', 'screens');
const LIVE = join(ROOT, 'canvas', 'live');

/* Redact production data before anything is written to disk. The capture runs
   against a real logged-in account; names, numbers and ids must not reach git. */
const scrub = (html) => html
  .replace(/(\+?9665\d{8}|\b05\d{8}\b)/g, '+966500000000')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'user@example.com')
  .replace(/\b\d{10,}\b/g, (m) => '0'.repeat(m.length))
  .replace(/\b(1200\d{6})\b/g, '1200000000');
const AUTH = join(ROOT, '.auth.json');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(name);

const BASE = (arg('--base', 'https://profolio.bayut.sa')).replace(/\/$/, '');
const ONLY = arg('--only', '');
const WIDTH = Number(arg('--width', 1440));
const HEIGHT = Number(arg('--height', 900));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed here. Run:  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

/* ── 1. one-time login ────────────────────────────────────────────────────── */
if (has('--login')) {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`);
  console.log('\nA browser window is open. Log in to Profolio KSA.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('Press Enter once you can see the Overview… ');
  rl.close();
  await ctx.storageState({ path: AUTH });
  await browser.close();
  console.log(`Session saved to ${AUTH}. It is git-ignored — do not commit it.`);
  console.log('Now run:  node scripts/capture.mjs --base ' + BASE);
  process.exit(0);
}

if (!existsSync(AUTH)) {
  console.error(`No saved session. Run first:\n  node scripts/capture.mjs --login --base ${BASE}`);
  process.exit(1);
}

/* ── 2. routes to capture ─────────────────────────────────────────────────── */
const indexMd = existsSync(join(ROOT, 'references/pages/index.md'))
  ? readFileSync(join(ROOT, 'references/pages/index.md'), 'utf8')
  : '';

const routes = ONLY
  ? [ONLY]
  : [...new Set([...indexMd.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]))]
      .filter((r) => r.startsWith('/') && !r.includes(':') && !r.includes('*'));

if (!routes.length) {
  console.error('No routes found. Run build.mjs first so references/pages/index.md exists.');
  process.exit(1);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';

mkdirSync(SCREENS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: AUTH,
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

let ok = 0, failed = [];
for (const route of routes) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });

    // A redirect back to sign-in means the saved session expired.
    if (/signin|auth|login/i.test(page.url()) && !/signin/.test(route)) {
      throw new Error('redirected to sign-in — session expired, re-run --login');
    }

    // Let skeletons settle so the shot shows loaded content, not loading state.
    await page.waitForTimeout(2500);

    const name = slug(route);

    /* 1 — screenshot */
    await page.screenshot({ path: join(SCREENS, `${name}.png`), fullPage: true });

    /* 2 — rendered DOM. Raw, goes to canvas/live/ which the agent never reads;
           the generator distils it. Scrubbed first — this is production data. */
    const rawHtml = await page.evaluate(() => document.documentElement.outerHTML);
    mkdirSync(LIVE, { recursive: true });
    writeFileSync(join(LIVE, `${name}.html`), scrub(rawHtml));

    /* 3 — computed styles of the widget containers. An image cannot tell you a
           card's padding is 24px; this can. */
    const styles = await page.evaluate(() => {
      const PROPS = ['display','gridTemplateColumns','gridTemplateRows','flexDirection','gap',
        'width','minHeight','padding','margin','backgroundColor','color','borderRadius',
        'border','boxShadow','fontFamily','fontSize','fontWeight','lineHeight','alignItems',
        'justifyContent','textAlign'];
      const seen = new Set();
      const pick = (el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const o = {};
        for (const p of PROPS) { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== 'auto') o[p] = v; }
        return {
          selector: el.tagName.toLowerCase() +
            (el.id ? '#' + el.id : '') +
            (typeof el.className === 'string' && el.className
              ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
          box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
          text: (el.innerText || '').trim().split('\n')[0].slice(0, 60),
          style: o,
        };
      };
      const out = { chrome: [], widgets: [] };
      for (const sel of ['header', 'aside', '.ant-layout-sider', 'main', '.ant-layout-content', 'footer']) {
        const el = document.querySelector(sel);
        if (el && !seen.has(el)) { seen.add(el); out.chrome.push(pick(el)); }
      }
      const content = document.querySelector('.ant-layout-content, main') || document.body;
      for (const el of content.querySelectorAll('.ant-card, [class*="card" i], [class*="widget" i]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 120 || r.height < 60 || seen.has(el)) continue;
        if (el.closest('.ant-card') && el.closest('.ant-card') !== el) continue;  // outermost only
        seen.add(el);
        out.widgets.push(pick(el));
      }
      return out;
    });
    writeFileSync(join(SCREENS, `${name}.styles.json`), JSON.stringify(styles, null, 2));

    console.log(`  ✓ ${route}`);
    console.log(`      screenshot  references/screens/${name}.png`);
    console.log(`      dom         canvas/live/${name}.html`);
    console.log(`      styles      references/screens/${name}.styles.json  (${styles.chrome.length} chrome, ${styles.widgets.length} widgets)`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${route.padEnd(34)} ${String(e.message).slice(0, 80)}`);
    failed.push(route);
  } finally {
    await page.close();
  }
}
await browser.close();

/* ── 3. manifest so the generator knows what exists ───────────────────────── */
const files = readdirSync(SCREENS).filter((f) => f.endsWith('.png'));
writeFileSync(
  join(SCREENS, 'index.json'),
  JSON.stringify({ base: BASE, captured: new Date().toISOString(), viewport: `${WIDTH}x${HEIGHT}`, files }, null, 2)
);

console.log(`\n${ok} captured, ${failed.length} failed.`);
if (failed.length) console.log('Failed: ' + failed.join(', '));
console.log('Now run:  node scripts/build.mjs --repo ../profolio-reactjs-copy');
