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

    const out = join(SCREENS, `${slug(route)}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`  ✓ ${route.padEnd(34)} → references/screens/${slug(route)}.png`);
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
