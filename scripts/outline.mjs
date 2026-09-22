#!/usr/bin/env node
/**
 * Print a capture's content region as a readable tree.
 *
 * Rebuilding a page by eye from a screenshot is how nine pages came to carry
 * invented fields: a picture tells you there is an input, not that it is 415
 * wide with a 40px tall sibling select in front of it. The capture knows all of
 * that. This makes it legible, so a generator can be written FROM the product's
 * own geometry instead of from an impression of it.
 *
 *   node scripts/outline.mjs live/credits-usage            the content region
 *   node scripts/outline.mjs ours/credits-usage --depth 8
 *   node scripts/outline.mjs live/reports-summary --all    from <body>
 *
 * It prints no text, because the capture carries none. Read the .png beside it
 * for the words.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, classes, find } from './lib/structure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const spec = argv.find((a) => !a.startsWith('--'));
if (!spec) { console.error('usage: outline.mjs <live|ours>/<page> [--depth n] [--all]'); process.exit(2); }
const depth = Number(argv[argv.indexOf('--depth') + 1]) || 7;
const cap = load(join(ROOT, 'data', `${spec}.capture.json`));

const root = argv.includes('--all') ? cap.tree
  : (find(cap.tree, /^ant-layout-content$/) || find(cap.tree, /^pf-content$/) || cap.tree);

/* the style values worth seeing while rebuilding: the ones that decide whether
   a box is a card, a pill, a field or a divider */
const NOTE = ['backgroundColor', 'borderTopLeftRadius', 'borderTopWidth', 'fontSize', 'fontWeight', 'color'];
const px = (v) => (v == null ? '' : String(v).replace(/px$/, ''));

const line = (n, d) => {
  const b = n.box || {};
  const cls = classes(n).filter((c) => !/^(css|sc)-[\w]{5,}$/.test(c)).slice(0, 4).join('.');
  const s = n.style || {};
  const notes = NOTE.map((k) => (s[k] ? `${k.replace(/^border(Top)?/, 'b').replace('LeftRadius', 'r').replace('Width', 'w')}:${px(s[k])}` : null))
    .filter(Boolean).join(' ');
  return `${'  '.repeat(d)}${n.tag}${cls ? '.' + cls : ''}  ${Math.round(b.w || 0)}×${Math.round(b.h || 0)} @${Math.round(b.x || 0)},${Math.round(b.y || 0)}  ${notes}`;
};

let shown = 0;
const walk = (n, d = 0) => {
  if (d > depth) return;
  if (n.box && n.box.w === 0 && n.box.h === 0) return;
  console.log(line(n, d));
  shown++;
  (n.children || []).forEach((k) => walk(k, d + 1));
};
walk(root);
console.log(`\n  ${shown} nodes shown to depth ${depth} · ${spec}`);
