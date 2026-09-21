#!/usr/bin/env node
/**
 * Folds a live probe back into the design system.
 *
 * `scripts/probe.js` produces a JSON blob of computed styles from a real
 * browser. This reads it, compares each measurement against the token that
 * claims to describe it, and rewrites the ones that disagree — stamping each
 * with where the number came from and when.
 *
 *   node scripts/reconcile.mjs                      # all probes in references/live/
 *   node scripts/reconcile.mjs --file <path>        # just one
 *   node scripts/reconcile.mjs --dry                # report, change nothing
 *   node scripts/reconcile.mjs --diff               # live vs ours, ranked
 *
 * --diff is the fidelity measurement. Probe the live screen and probe
 * deliverables/dashboard.html, drop both in references/live/, and it reports
 * every property where the two disagree, worst first, with one number at the
 * end. That is what replaces guessing at a percentage.
 *
 * It is idempotent: running it twice against the same probe changes nothing the
 * second time. Tokens a probe has nothing to say about are left alone, TBC and
 * all — a gap that stays visible is the point.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CSS = join(ROOT, 'deliverables', 'profolio.css');
const LIVE = join(ROOT, 'references', 'live');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const DIFF = process.argv.includes('--diff');

/* ── what a probe can answer ───────────────────────────────────────────────
   token            the custom property to rewrite
   path             where the value lives in the probe JSON
   note             what the reader should know about the number
   Everything not listed here is out of the probe's reach by design. */
const MAP = [
  { token: '--chart-h',          path: 'targets.chart.box.h', unit: 'px',
    note: 'painted canvas height — a ratio of width at runtime, not a CSS value' },
  { token: '--meter-h',          path: 'targets.progress\\.track.height',
    note: 'antd Progress stroke width' },
  { token: '--listing-row-h',    path: 'targets.table\\.row.box.h', unit: 'px',
    note: 'content-driven; this is what one row measured' },
  { token: '--feedback-tab-w',   path: 'targets.feedback.box.w', unit: 'px',
    note: 'third-party widget, no source in the repo' },
  { token: '--card-head-pad-x',  path: 'targets.card\\.head.padding', pick: 'inline',
    note: 'antd Card head padding, never overridden by the product' },
  { token: '--main-pad-block',   path: 'targets.shell\\.content.padding', pick: 'block',
    note: 'Main padding' },
  { token: '--main-pad-inline',  path: 'targets.shell\\.content.padding', pick: 'inline',
    note: 'Main padding' },
  { token: '--chart-line',       path: 'runtime.brandColor',
    note: 'platform.brandColor as the browser resolved it' },
  { token: '--table-cell-pad',   path: 'targets.table\\.cell.padding', pick: 'block',
    note: 'antd Table cell padding' },
  { token: '--badge-h',          path: 'targets.badge.height',
    note: 'antd Badge height' },
  { token: '--datepicker-minw',  path: 'targets.input\\.date.minWidth',
    note: 'DateFilter min-width' },
  { token: '--input-h',          path: 'targets.input\\.date.height',
    note: 'antd input height at size=middle' },
  { token: '--card-head-min-h',  path: 'targets.card\\.head.minHeight',
    note: 'antd Card head min-height' },
];

const dig = (obj, path) =>
  path.split(/(?<!\\)\./).map((k) => k.replace(/\\/g, ''))
      .reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** antd reports shorthand padding as "16px 24px" or one value; pick a side. */
const side = (value, which) => {
  if (typeof value !== 'string') return value;
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return which === 'block' ? parts[0] : (parts[1] ?? parts[0]);
};

/* rgb(0, 97, 105) → #006169, so a measured colour is comparable to a declared one */
const toHex = (v) => {
  const m = /^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)$/.exec(String(v).trim());
  if (!m) return v;
  const [r, g, b] = m.slice(1, 4).map((n) => Math.round(+n));
  const a = m[4] === undefined ? 1 : +m[4];
  const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return a === 1 ? hex : hex + Math.round(a * 255).toString(16).padStart(2, '0');
};

const norm = (v) => String(v).trim().toLowerCase().replace(/\s+/g, ' ');

/* ── live vs ours ──────────────────────────────────────────────────────────
   A property counts as matching when the two sides agree after normalising
   whitespace and colour notation. Numbers get a 1px tolerance, because a
   sub-pixel rounding difference is not a design defect. Everything else is
   exact. */
const num = (v) => { const m = /^(-?[\d.]+)px$/.exec(String(v).trim()); return m ? +m[1] : null; };

function comparable(a, b) {
  if (a === undefined || b === undefined) return false;
  const [x, y] = [toHex(a), toHex(b)];
  if (norm(x) === norm(y)) return true;
  const [nx, ny] = [num(x), num(y)];
  return nx !== null && ny !== null && Math.abs(nx - ny) <= 1;
}

/* Some targets matter more than others. A card's radius being wrong is
   cosmetic; the shell being the wrong width moves everything on the page. */
const WEIGHT = {
  'shell.sider': 3, 'shell.header': 3, 'shell.content': 3, 'card': 2,
  'card.body': 2, 'stat.value': 2, 'stat.leader': 2, 'table.cell': 2,
  'table.head': 2, 'listing.thumb': 2, 'feedback': 0.25,
};

function runDiff(live, ours) {
  const rows = [];
  let weighted = 0, weightedTotal = 0;

  for (const [label, l] of Object.entries(live.targets)) {
    const o = ours.targets[label];
    const w = WEIGHT[label] ?? 1;
    if (!o || o.missing) { rows.push({ label, prop: '(absent on ours)', live: l.missing ? '—' : 'present', ours: '—', w });
                           weightedTotal += w; continue; }
    if (l.missing) continue;                       // not on the live screen either

    const props = new Set([...Object.keys(l), ...Object.keys(o)].filter((k) => k !== 'box'));
    for (const p of props) {
      weightedTotal += w;
      if (comparable(l[p], o[p])) { weighted += w; continue; }
      rows.push({ label, prop: p, live: l[p] ?? '—', ours: o[p] ?? '—', w });
    }
    for (const d of ['w', 'h']) {
      weightedTotal += w;
      if (comparable(l.box?.[d] + 'px', o.box?.[d] + 'px')) { weighted += w; continue; }
      rows.push({ label, prop: 'box.' + d, live: l.box?.[d], ours: o.box?.[d], w });
    }
  }

  rows.sort((a, b) => b.w - a.w || a.label.localeCompare(b.label));
  const score = weightedTotal ? (weighted / weightedTotal) * 100 : 0;
  return { rows, score, weighted, weightedTotal };
}

if (DIFF) {
  const pick = (which) => {
    const f = readdirSync(LIVE).filter((x) => x.endsWith(`.${which}.probe.json`));
    return f.length ? JSON.parse(readFileSync(join(LIVE, f[0]), 'utf8')) : null;
  };
  if (!existsSync(LIVE)) { console.log(`No ${LIVE} directory yet.`); process.exit(0); }
  const live = pick('live'), ours = pick('ours');
  if (!live || !ours) {
    console.log('--diff needs both sides.\n');
    console.log(`  live: ${live ? 'found' : 'MISSING — paste scripts/probe.js on the real screen'}`);
    console.log(`  ours: ${ours ? 'found' : 'MISSING — paste it on deliverables/dashboard.html'}`);
    console.log(`\n  Save each as ${LIVE.replace(ROOT + '/', '')}/<route>.<side>.probe.json`);
    process.exit(0);
  }

  const { rows, score, weightedTotal } = runDiff(live, ours);
  const pad2 = (s, n) => String(s ?? '—').slice(0, n).padEnd(n);
  console.log(`\n  ${rows.length} properties differ out of ${weightedTotal} weighted checks\n`);
  console.log(`  ${pad2('component', 18)} ${pad2('property', 22)} ${pad2('live', 26)} ours`);
  console.log('  ' + '─'.repeat(88));
  for (const r of rows.slice(0, 60))
    console.log(`  ${pad2(r.label, 18)} ${pad2(r.prop, 22)} ${pad2(r.live, 26)} ${r.ours}`);
  if (rows.length > 60) console.log(`  … and ${rows.length - 60} more`);
  console.log(`\n  FIDELITY  ${score.toFixed(1)}%   (weighted; shell and type count triple, the`);
  console.log(`            third-party feedback widget counts a quarter)\n`);

  if (!DRY) {
    mkdirSync(join(ROOT, 'references', 'live'), { recursive: true });
    writeFileSync(join(LIVE, 'fidelity.json'),
      JSON.stringify({ at: new Date().toISOString(), score: +score.toFixed(2), rows }, null, 2));
    console.log('  references/live/fidelity.json written.\n');
  }
  process.exit(0);
}

/* ── gather probes ─────────────────────────────────────────────────────── */
const one = arg('--file');
let files = [];
if (one) files = [one];
else if (existsSync(LIVE)) files = readdirSync(LIVE).filter((f) => f.endsWith('.probe.json')).map((f) => join(LIVE, f));

if (!files.length) {
  mkdirSync(LIVE, { recursive: true });
  console.log('No probes found.\n');
  console.log('  1. open a live Profolio screen');
  console.log('  2. paste scripts/probe.js into the devtools console');
  console.log(`  3. save what it copies into ${LIVE.replace(ROOT + '/', '')}/<route>.probe.json`);
  console.log('  4. run this again\n');
  process.exit(0);
}

let css = readFileSync(CSS, 'utf8');
const changed = [], agreed = [], silent = [], stamp = new Date().toISOString().slice(0, 10);

for (const file of files) {
  const probe = JSON.parse(readFileSync(file, 'utf8'));
  if (probe.probe !== 1) { console.log(`  ! ${basename(file)} is not a probe file`); continue; }
  console.log(`\n── ${basename(file)}  (${probe.route}, ${probe.viewport?.w}px)`);

  /* the font question, reported but never auto-applied: it is a judgement call */
  if (probe.fonts) {
    const stack = probe.fonts.bodyStack || '';
    const declared = /--font-body:([^;]+);/.exec(css)?.[1]?.trim() || '';
    const same = norm(stack).split(',')[0] === norm(declared).split(',')[0];
    console.log(`   fonts  resolved "${norm(stack).split(',')[0]}"` +
      (same ? ' — matches --font-body' : `  ! --font-body leads with "${norm(declared).split(',')[0]}"`));
    if (probe.fonts.synthesised?.length)
      console.log(`          synthesised weights: ${probe.fonts.synthesised.join(', ')}`);
  }

  for (const m of MAP) {
    let measured = dig(probe, m.path);
    if (measured === undefined || measured === null || measured === '') { silent.push(m.token); continue; }
    if (m.pick) measured = side(measured, m.pick);
    if (typeof measured === 'number') measured = measured + (m.unit || 'px');
    if (/^rgba?\(/.test(String(measured))) measured = toHex(measured);

    const re = new RegExp(`(${m.token}\\s*:)([^;]*);`);
    const hit = re.exec(css);
    if (!hit) { silent.push(m.token + ' (not declared)'); continue; }

    const current = hit[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (norm(current) === norm(measured)) { agreed.push([m.token, current]); continue; }

    css = css.replace(re, `$1${measured};  /* measured ${stamp} — ${m.note} */`);
    changed.push([m.token, current || '(TBC)', measured]);
  }
}

/* ── report ────────────────────────────────────────────────────────────── */
const pad = (s, n) => String(s).padEnd(n);
console.log('');
if (changed.length) {
  console.log(`  ${changed.length} rewritten`);
  for (const [t, was, now] of changed) console.log(`    ${pad(t, 26)} ${pad(was, 22)} -> ${now}`);
}
if (agreed.length) {
  console.log(`  ${agreed.length} already correct`);
  for (const [t, v] of agreed) console.log(`    ${pad(t, 26)} ${v}`);
}
if (silent.length) {
  console.log(`  ${silent.length} still open — the probe had nothing to say about these`);
  for (const t of [...new Set(silent)]) console.log(`    ${t}`);
}

if (DRY) { console.log('\n  --dry: nothing written.'); process.exit(0); }
if (changed.length) {
  writeFileSync(CSS, css);
  console.log(`\n  deliverables/profolio.css updated. Re-run: npm run bundle && npm run combine`);
} else {
  console.log('\n  Nothing to change.');
}
