#!/usr/bin/env node
/**
 * Refuse to build a page from a capture that rendered nothing.
 *
 * WHY THIS EXISTS
 * Twenty-five routes are captured and twelve of them are EMPTY SHELLS. Their
 * endpoints answer `{}`, so the product paints its chrome and no content:
 *
 *   agency-staff     0 table rows   3 cards
 *   credits-usage    0 table rows   2 cards
 *   reports-summary  0 table rows   3 cards
 *
 * A capture like that is worse than no capture, because it looks like one.
 * Every value taken from it would be invented, which is exactly how this
 * system got a fabricated calendar and a credits table the product does not
 * have. So: a route is BUILDABLE only when its capture carries content, and
 * this says which do.
 *
 *   node scripts/check-captures.mjs           every route
 *   node scripts/check-captures.mjs --strict  exit non-zero if any are empty
 *
 * It is deliberately crude. It counts what a screen is made of — rows, form
 * items, cards, controls — and a screen with none of them did not render.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = join(ROOT, 'data', 'live');
const strict = process.argv.includes('--strict');

/* the shell alone is about a hundred nodes; anything near that painted chrome
   and stopped */
const SHELL_ONLY = 140;

const COUNTS = {
  rows: /^ant-table-row$/,
  fields: /^ant-form-item$|^ant-input$|^ant-select$|^ant-picker$/,
  cards: /^ant-card$/,
  controls: /^ant-btn$/,
  charts: /^recharts-surface$|^chartjs/,
  empty: /^ant-empty$|^ant-result$/,
};

const tally = (tree) => {
  const t = Object.fromEntries(Object.keys(COUNTS).map((k) => [k, 0]));
  const walk = (n) => {
    for (const c of n.class || []) for (const [k, re] of Object.entries(COUNTS)) if (re.test(c)) t[k]++;
    (n.children || []).forEach(walk);
  };
  walk(tree);
  return t;
};

const routes = [...new Set(readdirSync(LIVE)
  .filter((f) => /\.capture\.json$/.test(f))
  .map((f) => f.replace(/\.capture\.json$/, ''))
  .filter((r) => !r.includes('--') && !r.endsWith('.real') && !r.endsWith('.rtl')))].sort();

console.log('\n  route                          nodes  rows fields cards  verdict');
const empty = [];
for (const r of routes) {
  const cap = JSON.parse(readFileSync(join(LIVE, `${r}.capture.json`), 'utf8'));
  const t = tally(cap.tree);
  /* a page has content when it renders DATA (rows, a chart) or a FORM, or when
     it deliberately renders an empty state — the product's own "no records"
     card is content, and a page that shows it is buildable */
  const has = t.rows > 0 || t.fields >= 3 || t.charts > 0 || t.empty > 0;
  const verdict = has ? 'buildable'
    : cap.nodes < SHELL_ONLY ? 'EMPTY — shell only, needs fixtures'
      : 'EMPTY — chrome but no content, needs fixtures';
  if (!has) empty.push(r);
  console.log('  ' + r.padEnd(30) + String(cap.nodes).padStart(5)
    + String(t.rows).padStart(6) + String(t.fields).padStart(7) + String(t.cards).padStart(6)
    + '  ' + verdict);
}

console.log(`\n  ${routes.length - empty.length} buildable · ${empty.length} need fixtures first\n`);
if (empty.length) console.log('  ' + empty.join('\n  ') + '\n');
if (strict && empty.length) process.exit(1);
