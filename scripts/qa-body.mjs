#!/usr/bin/env node
/**
 * Compare a PAGE BODY's insides against the product's.
 *
 * WHY THIS EXISTS — and it is the same reason qa-overlays.mjs exists, one
 * level up. qa-design.mjs diffs regions, and a region is a BOUNDING BOX. Two
 * pages that are both "a card on the left, a card on the right" at the same
 * sizes score in the high eighties while containing entirely different things.
 * That is not a hypothetical: it is how nine pages were reported at 77–96%
 * while Credits Usage had a stat grid and an empty table where the product has
 * a donut chart and a timeline of property cards, and Agency Settings invented
 * a "Commercial Registration Number" field and dropped the agency header, the
 * phone country select and the description textarea.
 *
 * A box diff cannot see any of that. This walks the content region on both
 * sides and compares what it is MADE OF:
 *
 *   nodes       how much is in there at all — the bluntest and most honest
 *               number, and the one that says "a third of the page is missing"
 *   cards       the card stack, with each card's size
 *   bands       the heights inside each card: a header, then n rows
 *   parts       buttons, links, fields, icons, text blocks
 *   canvas      <svg>/<canvas> of chart size — a real chart, or the grey
 *               rectangle a generator emits when it has nothing to draw
 *
 * None of it needs the text, which the capture walker deliberately drops.
 *
 *   node scripts/qa-body.mjs               every page that has both captures
 *   node scripts/qa-body.mjs credits       only pages matching "credits"
 *
 * Exits non-zero when a page is missing structure, so it can gate a build.
 */
import { readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, classes, findAll, find, bands, parts } from './lib/structure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = join(ROOT, 'data', 'live');
const OURS = join(ROOT, 'data', 'ours');
const only = process.argv[2];

const CONTENT = { theirs: /^ant-layout-content$/, ours: /^pf-content$/ };
/* a tabbed card is a card: .ant-card-contain-tabs on their side, and on ours
   the table card, which is the same component with the tab strip in its head */
const CARD = { theirs: /^ant-card$/, ours: /^(pf-card|pf-table-card)$/ };

const count = (n) => 1 + (n.children || []).reduce((a, k) => a + count(k), 0);
const box = (n) => (n.box ? `${Math.round(n.box.w)}×${Math.round(n.box.h)}` : '—');

/* A chart is the thing a placeholder is most often standing in for, so it gets
   counted on its own: any svg or canvas big enough to be a plot rather than an
   icon. A generator that emits a grey <div> instead scores zero here. */
const charts = (root) => {
  const out = [];
  /* Two things are big <svg> and are not charts: the empty-state illustration,
     and any <svg> nested inside another one. Counting either made a page with
     no data at all read as having a chart the product does not draw. */
  const walk = (n, inArt = false, inSvg = false) => {
    const art = inArt || classes(n).some((c) => /empty/.test(c));
    const isSvg = n.tag === 'svg' || n.tag === 'canvas';
    if (isSvg && !art && !inSvg && n.box && n.box.w > 80 && n.box.h > 80) out.push(box(n));
    (n.children || []).forEach((k) => walk(k, art, inSvg || isSvg));
  };
  walk(root);
  return out;
};

/* An empty-state illustration is a legitimate thing to render — and it is also
   what a page shows when its fixture answered with nothing, which is a
   different page from the one the product shows. Worth naming separately. */
const emptyStates = (root) => findAll(root, /(^|-)(empty|emptylisting|empty-art)$/).length;

const pages = readdirSync(OURS)
  .filter((f) => f.endsWith('.capture.json') && !f.includes('--'))
  .map((f) => f.replace('.capture.json', ''))
  .filter((p) => existsSync(join(LIVE, `${p}.capture.json`)))
  .filter((p) => !only || p.includes(only))
  .sort();

const rows = [];
for (const p of pages) {
  const A = load(join(LIVE, `${p}.capture.json`));
  const B = load(join(OURS, `${p}.capture.json`));
  const a = find(A.tree, CONTENT.theirs);
  const b = find(B.tree, CONTENT.ours);
  if (!a || !b) { rows.push({ page: p, skip: 'no content region on one side' }); continue; }

  /* 260 is the floor for a LAYOUT card. The product also renders an ant-card
     for small things — a 202-wide verification chip on the settings pages —
     and counting those made a page read a card short against its own design. */
  /* 400 is the floor for a LAYOUT card — the thing a designer would call a
     card on the page. The product also renders an ant-card for a verification
     chip, a timeline entry and each section of a wizard, and counting those
     made Credits Usage read 2 cards against 13 while both pages show two. */
  const cardsA = findAll(a, CARD.theirs).filter((n) => n.box?.w >= 400);
  const cardsB = findAll(b, CARD.ours).filter((n) => n.box?.w >= 400);
  const r = {
    page: p,
    nodes: [count(a), count(b)],
    cards: [cardsA.length, cardsB.length],
    cardSizes: [cardsA.map(box), cardsB.map(box)],
    bands: [cardsA.map((c) => bands(c)), cardsB.map((c) => bands(c))],
    parts: [parts(a), parts(b)],
    charts: [charts(a), charts(b)],
    empty: [emptyStates(a), emptyStates(b)],
  };
  /* the headline: how much of the product's body we actually reproduce */
  r.coverage = Math.round((r.nodes[1] / r.nodes[0]) * 100);
  r.faults = [];
  /* antd wraps generously — a field is a div in a div in a div — so a
     hand-written page legitimately carries fewer nodes for the same design.
     A chart the product draws with a library and this system draws as one
     <svg> widens the gap further. So the node ratio is printed on every line
     as context and only FAULTS below 50%; the card, chart, empty-state and
     part counts below are the sharp signals and are what actually gate. */
  if (r.coverage < 50) r.faults.push(`body carries ${r.nodes[1]} nodes against the product's ${r.nodes[0]} (${r.coverage}%)`);
  if (r.cards[0] !== r.cards[1]) r.faults.push(`${r.cards[1]} card(s) against ${r.cards[0]}`);
  if (r.charts[0].length !== r.charts[1].length) r.faults.push(`${r.charts[1].length} chart(s) against ${r.charts[0].length}`);
  if (r.empty[1] > r.empty[0]) r.faults.push(`${r.empty[1]} empty state(s) where the product has ${r.empty[0]} — a fixture answered with nothing`);
  for (const k of ['button', 'link', 'input']) {
    const [x, y] = [r.parts[0][k], r.parts[1][k]];
    if (Math.abs(x - y) > Math.max(2, x * 0.25)) r.faults.push(`${y} ${k}(s) against ${x}`);
  }
  rows.push(r);
}

const pad = (s, n) => String(s).padEnd(n);
console.log('');
for (const r of rows) {
  if (r.skip) { console.log(`  --    ${pad(r.page, 32)} ${r.skip}`); continue; }
  const mark = r.faults.length ? 'DIFF' : 'ok  ';
  console.log(`  ${mark}  ${pad(r.page, 32)} ${pad(`${r.coverage}% of the body`, 18)} cards ${r.cards[1]}/${r.cards[0]}  charts ${r.charts[1].length}/${r.charts[0].length}`);
  for (const f of r.faults) console.log(`          ${f}`);
}

mkdirSync(join(ROOT, 'data', 'qa'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'qa', 'page-bodies.json'), JSON.stringify(rows, null, 2));
const bad = rows.filter((r) => r.faults?.length);
console.log(`\n  ${bad.length} of ${rows.length} page bodies differ. → data/qa/page-bodies.json`);
process.exit(bad.length ? 1 : 0);
