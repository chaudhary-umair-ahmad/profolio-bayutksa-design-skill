#!/usr/bin/env node
/**
 * Compare an overlay's INSIDES against the product's, not just its box.
 *
 * WHY THIS EXISTS
 * scripts/qa-design.mjs diffs regions from a manifest — shell, table, modal,
 * popover — and a region is a BOUNDING BOX. So an overlay that is the right
 * size on the outside and invented on the inside scores a few percent and
 * passes. The health popover scored 8% while being 81px too short with three
 * rows where the product has five, and a date panel scored 6% while showing
 * the same fabricated month twice.
 *
 * A box diff cannot catch that, because most of a popover's pixels are white.
 * So this walks both subtrees and compares what they are MADE OF:
 *
 *   outer size          the overlay's own width and height
 *   band profile        the heights of the horizontal bands inside it — a
 *                       header, then n rows — which is what "three rows where
 *                       there should be five" actually looks like in numbers
 *   inset               where content starts, which catches a 16 that should
 *                       be a 24
 *   parts               buttons, links, inputs, icons and text blocks inside
 *
 * None of that needs the text, which the capture walker deliberately drops.
 *
 *   node scripts/qa-overlays.mjs            every state
 *   node scripts/qa-overlays.mjs health     only states matching "health"
 *
 * Exits non-zero when any overlay differs beyond the tolerances below, so it
 * can gate a build the way npm run check does.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, classes, findAll, find, bands, inset, parts } from './lib/structure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = join(ROOT, 'data', 'live');
const OURS = join(ROOT, 'data', 'ours');
const only = process.argv[2];

/* what counts as an overlay root on each side. The product's modal has a
   -content wrapper inside the sized element; ours is the sized element. */
const KINDS = [
  { kind: 'modal',    theirs: /^ant-modal-content$/,   ours: /^pf-modal$/ },
  { kind: 'drawer',   theirs: /^ant-drawer-content$/,  ours: /^pf-drawer$/ },
  { kind: 'popover',  theirs: /^ant-popover-inner$/,   ours: /^pf-popover$/ },
  { kind: 'tooltip',  theirs: /^ant-tooltip-inner$/,   ours: /^pf-tip$/ },
  { kind: 'listbox',  theirs: /^ant-select-dropdown$/, ours: /^pf-listbox$/ },
];

/* Tolerances. A band profile is compared as a multiset of heights, because the
   ORDER can legitimately differ (antd puts the close button first in the DOM)
   while the shape must not. */
const SIZE_TOL = 4;        /* px on width or height */
const BAND_TOL = 6;        /* px on a single band */

/* The arrow lives OUTSIDE the box this tool walks — antd makes it a sibling of
   .ant-popover-inner — which is exactly why eleven overlays shipped without one
   and nothing caught it. Look for it in the whole capture instead: a state
   opens one overlay, so one arrow is unambiguous. */
function arrowOf(tree, re, near) {
  /* NEAR the overlay, not anywhere in the capture: a state can leave another
     popover's arrow mounted, and an unscoped search reported a missing arrow
     on three modals, which have never had one. */
  const found = findAll(tree, re)
    .filter((n) => n.box && n.box.w > 0)
    .filter((n) => n.box.x > near.x - 40 && n.box.x < near.x + near.w + 40
                && n.box.y > near.y - 40 && n.box.y < near.y + near.h + 40);
  return found.length ? found[0].box : null;
}

/* What the overlay is PAINTED with. Geometry can match exactly while the
   surface is the wrong colour, radius or shadow, and a band profile says
   nothing about any of it. */
const PAINT = ['backgroundColor', 'borderTopLeftRadius', 'boxShadow', 'borderTopWidth', 'borderTopColor'];
function paint(n) {
  const out = {};
  for (const k of PAINT) if (n.style?.[k] !== undefined) out[k] = n.style[k];
  return out;
}

function compare(name, kind, a, b, trees) {
  const faults = [];
  const A = a.box, B = b.box;
  if (Math.abs(A.w - B.w) > SIZE_TOL) faults.push({ w: 3, m: `width ${Math.round(B.w)} vs ${Math.round(A.w)} (${B.w > A.w ? '+' : ''}${Math.round(B.w - A.w)})` });
  if (Math.abs(A.h - B.h) > SIZE_TOL) faults.push({ w: 3, m: `height ${Math.round(B.h)} vs ${Math.round(A.h)} (${B.h > A.h ? '+' : ''}${Math.round(B.h - A.h)})` });

  const ba = bands(a), bb = bands(b);
  if (ba.length !== bb.length) {
    faults.push({ w: 4, m: `${bb.length} band(s) inside, the product has ${ba.length} — [${bb.join(' ')}] vs [${ba.join(' ')}]` });
  } else {
    const off = ba.map((h, i) => [h, bb[i]]).filter(([x, y]) => Math.abs(x - y) > BAND_TOL);
    if (off.length) faults.push({ w: 2, m: `band heights ${off.map(([x, y]) => `${y}≠${x}`).join(' ')}` });
  }
  /* Same outside, different granularity is not a defect. A scroll holder counts
     as one band on their side and as its options on ours; a wrapper swallows
     the gaps between our bands. When the OVERLAY'S OWN HEIGHT matches, a
     different band count is a shape of the DOM, not a shape on the screen. */
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const outerOk = Math.abs(A.h - B.h) <= SIZE_TOL && Math.abs(A.w - B.w) <= SIZE_TOL;
  if (ba.length !== bb.length && (outerOk || Math.abs(sum(ba) - sum(bb)) <= BAND_TOL)) {
    faults.pop();
    faults.push({ w: 0, m: `note: ${bb.length} band(s) against ${ba.length} — same box outside, a wrapper or scroll holder counts differently inside` });
  }

  const ia = inset(a), ib = inset(b);
  if (ia !== null && ib !== null && Math.abs(ia - ib) > 2) faults.push({ w: 2, m: `content inset ${ib} vs ${ia}` });

  /* only an ANCHORED overlay has an arrow; a modal and a drawer never do */
  if (trees && (kind === 'popover' || kind === 'tooltip' || kind === 'listbox')) {
    const aArrow = arrowOf(trees[0], /(popover|tooltip)-arrow$/, A);
    const bArrow = arrowOf(trees[1], /^pf-arrow$/, B);
    if (aArrow && !bArrow) faults.push({ w: 4, m: `the product draws a ${Math.round(aArrow.w)}x${Math.round(aArrow.h)} arrow and our overlay has none` });
    else if (!aArrow && bArrow) faults.push({ w: 2, m: 'our overlay draws an arrow and the product does not' });
    else if (aArrow && bArrow && Math.abs(aArrow.w - bArrow.w) > 2) faults.push({ w: 2, m: `arrow ${Math.round(bArrow.w)} wide against ${Math.round(aArrow.w)}` });
  }

  const pA = paint(a), pB = paint(b);
  for (const k of PAINT) {
    if (pA[k] === undefined || pB[k] === undefined) continue;
    /* a shadow is a long string that antd and a stylesheet spell differently;
       compare only whether BOTH have one */
    if (k === 'boxShadow') { if ((pA[k] === 'none') !== (pB[k] === 'none')) faults.push({ w: 2, m: `box-shadow ${pB[k] === 'none' ? 'missing' : 'present'} where the product has ${pA[k] === 'none' ? 'none' : 'one'}` }); continue; }
    /* a border COLOUR on a surface with no border is just the inherited text
       colour, and comparing it flagged every overlay in the set */
    if (/^borderTop(Width|Color)$/.test(k)) {
      const wA = parseFloat(pA.borderTopWidth) || 0, wB = parseFloat(pB.borderTopWidth) || 0;
      if (!wA && !wB) continue;
    }
    if (pA[k] !== pB[k]) faults.push({ w: 2, m: `${k} ${pB[k]} against ${pA[k]}` });
  }

  const pa = parts(a), pb = parts(b);
  /* Count what is INTERACTIVE, not what tag it is. This prototype turns a
     navigation into <a href="not-built.html"> where the product uses a Button
     with an onClick — a deliberate convention (see authoring/listings-buttons.md),
     not a defect, and flagging it made three matching overlays look broken.
     The split is still reported, as a note. */
  const actA = pa.button + pa.link, actB = pb.button + pb.link;
  if (actA !== actB) faults.push({ w: 3, m: `${actB} interactive control(s), the product has ${actA}` });
  else if (pa.button !== pb.button) faults.push({ w: 0, m: `note: ${pb.link} link(s) where the product has ${pa.link} — this page links its navigations` });
  /* A NOTE, not a fault. antd wraps a search input in every Select and we
     render a button that opens a listbox; the counts diverge on markup
     convention, not on anything visible. Geometry is the signal. */
  if (pa.input !== pb.input) faults.push({ w: 0, m: `note: ${pb.input} field(s) against ${pa.input} — antd puts a search input in every Select` });
  return { name, kind, faults, theirs: { ...A, bands: ba, ...pa }, ours: { ...B, bands: bb, ...pb } };
}

/* ── run ────────────────────────────────────────────────────────────────── */
const states = readdirSync(LIVE)
  .filter((f) => /^listings--.*\.capture\.json$/.test(f))
  .map((f) => f.replace(/^listings--|\.capture\.json$/g, ''))
  .filter((s) => !only || s.includes(only))
  .sort();

const results = [];
for (const state of states) {
  const lf = join(LIVE, `listings--${state}.capture.json`);
  const of = join(OURS, `listings--${state}.capture.json`);
  if (!existsSync(of)) { results.push({ name: state, skip: 'no capture of ours — run qa-design first' }); continue; }
  const L = load(lf).tree, O = load(of).tree;
  let matched = false;
  for (const { kind, theirs, ours } of KINDS) {
    const a = find(L, theirs);
    if (!a) continue;
    const b = find(O, ours);
    if (!b) { results.push({ name: state, kind, faults: [{ w: 5, m: `the product opens a ${kind} here and our page has none` }] }); matched = true; break; }
    results.push(compare(state, kind, a, b, [L, O]));
    matched = true;
    break;
  }
  if (!matched) results.push({ name: state, skip: 'no overlay in the product capture' });
}

const scored = results.filter((r) => r.faults);
scored.sort((x, y) => y.faults.reduce((a, f) => a + f.w, 0) - x.faults.reduce((a, f) => a + f.w, 0));

console.log(`\n  OVERLAY INTERIORS — ${scored.length} compared, ${results.length - scored.length} with no overlay\n`);
let bad = 0;
for (const r of scored) {
  const real = r.faults.filter((f) => f.w > 0);
  if (!real.length) {
    console.log(`  ok    ${r.name.padEnd(28)} ${r.kind}${r.faults.length ? '  (' + r.faults[0].m + ')' : ''}`);
    continue;
  }
  bad++;
  console.log(`  DIFF  ${r.name.padEnd(28)} ${r.kind}`);
  for (const f of r.faults.sort((a, b) => b.w - a.w)) console.log(`          ${f.m}`);
}
for (const r of results.filter((r) => r.skip)) console.log(`  --    ${r.name.padEnd(28)} ${r.skip}`);

writeFileSync(join(ROOT, 'data', 'qa', 'listings-overlays.json'), JSON.stringify(results, null, 2));
console.log(`\n  ${bad} overlay(s) differ inside. → data/qa/listings-overlays.json\n`);
process.exit(bad ? 1 : 0);
