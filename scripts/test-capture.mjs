#!/usr/bin/env node
/**
 * Runs the extension's page script against a local page and asserts the claims
 * its README makes. The privacy promise is only worth what a test says it is.
 *
 *   node scripts/test-capture.mjs
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAKS, findLeaks, hashyClasses } from './leaks.mjs';
const { chromium } = pkg;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(join(ROOT, 'tools/profolio-capture/capture.js'), 'utf8');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('file://' + join(ROOT, 'deliverables/dashboard.html'));
await p.waitForTimeout(800);
const cap = await p.evaluate(script);
await b.close();

const json = JSON.stringify(cap);
/* Icon symbol names are our vocabulary, not the account's — `pf-IconPkgPlatinumPlus`
   names a glyph, it does not disclose which plan anyone is on. Exclude them from
   the text checks or they trip every one. */
const jsonNoIcons = json.replace(/"icon":"[^"]*"/g, '');
const fails = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => { fails.push(m); console.log(`  FAIL  ${m}`); };

/* ── it captured something usable ──────────────────────────────────────── */
cap?.capture === 1 ? ok('returns a capture envelope') : bad('no capture envelope');
cap.nodes > 200 ? ok(`walked ${cap.nodes} elements`) : bad(`only ${cap.nodes} elements — the walk is not reaching the page`);
cap.tree?.children?.length ? ok('tree has structure') : bad('tree is flat or empty');
cap.fonts?.bodyStack ? ok(`font stack recorded (${cap.fonts.bodyStack.split(',')[0]})`) : bad('no font stack');

const depth = (n) => 1 + Math.max(0, ...(n.children || []).map(depth));
depth(cap.tree) >= 6 ? ok(`tree is ${depth(cap.tree)} deep`) : bad('tree too shallow to rebuild from');

const icons = JSON.stringify(cap).match(/"icon":"pf-/g) || [];
icons.length ? ok(`${icons.length} icon references kept`) : bad('no icon references — glyphs would be unidentifiable');

/* ── and nothing it promised not to ────────────────────────────────────── */
/* the rules live in scripts/leaks.mjs so that measure-real.mjs holds a
   capture taken from a REAL signed-in page to exactly the same promise */
function leakCheck(label, json) {
  const found = findLeaks(json);
  for (const line of found) bad(`${label} ${line}`);
  return found.length === 0;
}
const leaks = LEAKS;
for (const [what, re] of leaks) {
  const m = jsonNoIcons.match(re);
  m ? bad(`capture contains ${what} — ${JSON.stringify(m[0]).slice(0, 60)}`)
    : ok(`no ${what}`);
}

/* a generated class name would be noise at best and an id at worst */
const { all: classes, hashy } = hashyClasses(json);
hashy.length ? bad(`hashed class names survived: ${hashy.slice(0, 3).join(', ')}`)
             : ok(`${new Set(classes).size} distinct class names, none hashed`);

/* the harness writes the same shape from the real product; hold it to the same promise */
import { readdirSync, existsSync } from 'node:fs';
const LIVE = join(ROOT, 'data', 'live');
if (existsSync(LIVE)) {
  const files = readdirSync(LIVE).filter((f) => f.endsWith('.capture.json'));
  let clean = 0;
  for (const f of files) if (leakCheck(`data/live/${f}`, readFileSync(join(LIVE, f), 'utf8'))) clean++;
  clean === files.length ? ok(`${files.length} harness capture(s) in data/live carry no text, href, src, value or data-*`)
                         : bad(`${files.length - clean} of ${files.length} harness captures leak`);
}

writeFileSync('/tmp/sample.capture.json', JSON.stringify(cap, null, 2));
console.log(`\n  sample written to /tmp/sample.capture.json (${(json.length / 1024).toFixed(0)}KB)`);
if (fails.length) { console.log(`\n  ${fails.length} failure(s).`); process.exit(1); }
console.log('\n  All capture assertions passed.');
