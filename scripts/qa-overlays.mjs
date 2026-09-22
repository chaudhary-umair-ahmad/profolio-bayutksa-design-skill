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

const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const classes = (n) => n.class || [];
const findAll = (n, re, out = []) => {
  if (classes(n).some((c) => re.test(c))) out.push(n);
  (n.children || []).forEach((k) => findAll(k, re, out));
  return out;
};
/* the biggest match wins: a page can carry a hidden second popover, and the
   one that was open is the one with area */
const find = (tree, re) => findAll(tree, re).sort((a, b) => (b.box?.w * b.box?.h || 0) - (a.box?.w * a.box?.h || 0))[0];

/**
 * The horizontal bands inside an overlay.
 *
 * Descend while a node has exactly one child that fills it — those are
 * wrappers, not structure — then take the children that stack vertically and
 * record their heights. That is the shape a designer sees: a header, five
 * rows, a footer.
 */
function bands(root) {
  /* An absolutely-positioned child is not a band: antd's modal close button is
     a 32px box floating over the header, and counting it made every modal read
     as one band short. Same for our own overlays, where the close sits inside
     the header instead. */
  const flow = (n) => (n.children || []).filter((k) => k.box && k.box.h > 0 && k.box.w > 0
    && k.style?.position !== 'absolute' && k.style?.position !== 'fixed');

  let n = root;
  for (let i = 0; i < 6; i++) {
    const kids = flow(n);
    if (kids.length !== 1) break;
    if (kids[0].box.h < (n.box?.h || 0) - 2) break;      /* a real child, not a wrapper */
    n = kids[0];
  }
  const kids = flow(n);
  /* A text-only overlay — a one-line tooltip, an "Expiring on" popover — is
     one band, and the band is the TEXT, not the box: compare 22 against 22
     rather than our padded 54 against their unpadded 22. */
  if (!kids.length) {
    if (!n.box?.h) return [];
    const px = (v) => parseFloat(v) || 0;
    return [Math.round(n.box.h - px(n.style?.paddingTop) - px(n.style?.paddingBottom))];
  }
  /* if the one level down is a list, its items are the bands */
  if (kids.length === 1 && flow(kids[0]).length > 1) {
    const inner = flow(kids[0]);
    if (inner.length > kids.length) return inner.map((k) => Math.round(k.box.h));
  }
  return kids.map((k) => Math.round(k.box.h));
}

/** where content starts inside the overlay — a 16 that should be a 24 */
function inset(root) {
  const O = root.box;
  let best = null;
  const walk = (n, d = 0) => {
    if (d > 4) return;
    const b = n.box;
    if (b && b.w > 0 && b.h > 0 && b.w < O.w - 4) {
      const dx = Math.round(b.x - O.x);
      if (dx > 0 && (best === null || dx < best)) best = dx;
    }
    (n.children || []).forEach((k) => walk(k, d + 1));
  };
  walk(root);
  return best;
}

/** what the overlay is made of, by tag and role */
function parts(root) {
  const t = { button: 0, link: 0, input: 0, icon: 0, text: 0 };
  const walk = (n) => {
    const b = n.box;
    if (b && b.w > 0 && b.h > 0) {
      if (n.tag === 'button') t.button++;
      else if (n.tag === 'a') t.link++;
      else if (n.tag === 'input' || n.tag === 'textarea') t.input++;
      else if (n.tag === 'svg' || classes(n).some((c) => /anticon|^i$/.test(c))) t.icon++;
      else if (!(n.children || []).length) t.text++;
    }
    (n.children || []).forEach(walk);
  };
  walk(root);
  return t;
}

/* Tolerances. A band profile is compared as a multiset of heights, because the
   ORDER can legitimately differ (antd puts the close button first in the DOM)
   while the shape must not. */
const SIZE_TOL = 4;        /* px on width or height */
const BAND_TOL = 6;        /* px on a single band */

function compare(name, kind, a, b) {
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

  const ia = inset(a), ib = inset(b);
  if (ia !== null && ib !== null && Math.abs(ia - ib) > 2) faults.push({ w: 2, m: `content inset ${ib} vs ${ia}` });

  const pa = parts(a), pb = parts(b);
  /* Count what is INTERACTIVE, not what tag it is. This prototype turns a
     navigation into <a href="not-built.html"> where the product uses a Button
     with an onClick — a deliberate convention (see authoring/listings-buttons.md),
     not a defect, and flagging it made three matching overlays look broken.
     The split is still reported, as a note. */
  const actA = pa.button + pa.link, actB = pb.button + pb.link;
  if (actA !== actB) faults.push({ w: 3, m: `${actB} interactive control(s), the product has ${actA}` });
  else if (pa.button !== pb.button) faults.push({ w: 0, m: `note: ${pb.link} link(s) where the product has ${pa.link} — this page links its navigations` });
  if (pa.input !== pb.input) faults.push({ w: 2, m: `${pb.input} input(s), the product has ${pa.input}` });
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
    results.push(compare(state, kind, a, b));
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
