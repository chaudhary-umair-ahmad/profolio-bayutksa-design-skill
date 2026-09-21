#!/usr/bin/env node
/**
 * Guards the things that have actually gone wrong.
 *
 * SKILL.md once routed the design agent at `references/screens/<route>.png` and
 * called it "the only visual truth in this system". That directory did not
 * exist. The agent was told to open a file, found nothing, and improvised — the
 * same failure that produced a wrong dashboard from a correct PRD.
 *
 * So: every path SKILL.md names must exist, or be marked conditional in the
 * same table row. Plus the deliverables' own invariants, which are cheap to
 * check and expensive to notice by eye.
 *
 *   node scripts/check.mjs
 *
 * Exits non-zero on any failure, so it works in a hook or CI.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], warns = [];
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => { fails.push(m); console.log(`  FAIL  ${m}`); };
const warn = (m) => { warns.push(m); console.log(`  warn  ${m}`); };

/* ── 1 · every path SKILL.md routes to ─────────────────────────────────── */
const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
const rows = [...skill.matchAll(/^\|\s*`([^`]+)`\s*\|(.+)\|$/gm)];
let checked = 0;

for (const [, path, blurb] of rows) {
  if (!/^(kb|deliverables|data|harness|authoring|canvas)\//.test(path)) continue;
  checked++;
  // a <placeholder> means "one per route"; check the directory instead
  const probe = path.includes('<') ? dirname(path) : path;
  const full = join(ROOT, probe);
  const conditional = /if one has been captured|empty until|check it exists|until someone/i.test(blurb);

  if (!existsSync(full)) {
    conditional ? warn(`${path} — absent, and the table says so`)
                : bad(`${path} — SKILL.md routes here and it does not exist`);
    continue;
  }
  if (statSync(full).isDirectory() && readdirSync(full).length === 0) {
    conditional ? warn(`${path} — empty, and the table says so`)
                : bad(`${path} — SKILL.md routes here and it is empty`);
    continue;
  }
  ok(path);
}
console.log(`        ${checked} routed paths checked\n`);

/* ── 2 · the deliverables' invariants ──────────────────────────────────── */
const D = join(ROOT, 'deliverables');
const css = readFileSync(join(D, 'profolio.css'), 'utf8');

const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const used = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))];
// --ring-color is set on an element at runtime and always used with a fallback
const undeclared = used.filter((v) => !declared.has(v) && v !== '--ring-color');
undeclared.length ? bad(`undeclared tokens: ${undeclared.join(', ')}`)
                  : ok(`every var() resolves (${declared.size} tokens)`);

const root = css.slice(css.indexOf(':root{'), css.indexOf('\n}', css.indexOf(':root{')));
const outside = css.replace(root, '').replace(/\/\*[\s\S]*?\*\//g, '');
const hex = outside.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
const rgb = outside.match(/\brgba?\([^)]*\)/g) || [];
hex.length || rgb.length ? bad(`raw colour outside :root — ${[...hex, ...rgb].slice(0, 5).join(', ')}`)
                         : ok('no raw colour outside :root');

const sprite = readFileSync(join(D, 'sprite.svg'), 'utf8');
const symbols = new Set([...sprite.matchAll(/id="(pf-[\w]+)"/g)].map((m) => m[1]));
for (const page of ['dashboard.html', 'listings.html', 'components.html']) {
  const raw = readFileSync(join(D, page), 'utf8');
  /* Strip comments before scanning: the sprite carries a usage example, and the
     catalogue quotes the product's JSX inside <code>, so a naive search finds
     `style={{…}}` that is documentation rather than markup. */
  const html = raw.slice(raw.indexOf('<body')).replace(/<!--[\s\S]*?-->/g, '');
  const attr = html.match(/<[a-zA-Z][^>]*?\sstyle\s*=\s*"[^"]*"/g) || [];
  attr.length ? bad(`${page} has ${attr.length} style attribute(s) in the body`)
              : ok(`${page} — no style attributes`);
  const refs = [...new Set([...html.matchAll(/href="#(pf-[\w]+)"/g)].map((m) => m[1]))];
  const broken = refs.filter((r) => !symbols.has(r));
  broken.length ? bad(`${page} references missing symbols: ${broken.join(', ')}`)
                : ok(`${page} — ${refs.length} icons, all in the sprite`);
  const head = raw.replace(/<!--[\s\S]*?-->/g, '').match(/<head>[\s\S]*?<\/head>/)?.[0] || '';
  /(href|src)="https?:\/\//.test(head) ? warn(`${page} loads something over the network`)
                                        : ok(`${page} — no network dependencies`);
}

/* ── 2b · the skill measures with the antd the product ships ───────────────
   The reference CSS was extracted from antd 5.20.6 for a week while the
   product's lockfile pinned 5.22.1. Same major, plausible output, wrong
   ground truth. The product's yarn.lock is the authority; if it is not next
   to this repo the rule is skipped, not passed. */
const lockPath = join(ROOT, '..', 'profolio-reactjs-copy', 'yarn.lock');
if (existsSync(lockPath)) {
  const m = /^antd@[^\n]*:\n  version "([^"]+)"/m.exec(readFileSync(lockPath, 'utf8'));
  const ours = JSON.parse(readFileSync(join(ROOT, 'node_modules/antd/package.json'), 'utf8')).version;
  if (m && m[1] !== ours) bad(`skill has antd ${ours}, the product's yarn.lock pins ${m[1]} — npm i antd@${m[1]} --save-exact`);
  else if (m) ok(`antd ${ours} matches the product's lockfile`);
} else {
  warn('product yarn.lock not found beside this repo — antd version parity not checked');
}

/* ── 3 · profolio.css against the CSS antd actually emits ───────────────────
   The badge shipped at 16px for a week because `controlHeightXS` is 16 and a
   16px badge looks fine. antd emits 20. This compares the two and asks for a
   note wherever the product deliberately differs — most of the time it does,
   because styled-components override antd, and that is the point: an
   unexplained difference is the one worth looking at. */
const antdPath = join(ROOT, 'data', 'antd-css.json');
if (existsSync(antdPath)) {
  const antd = JSON.parse(readFileSync(antdPath, 'utf8')).selectors;

  /* our class <- antd selector, and the properties worth holding to account */
  const MIRROR = [
    ['.pf-badge',        '.ant-badge-count',   ['height', 'min-width', 'font-size', 'line-height', 'border-radius']],
    ['.pf-credit-meter', '.ant-progress-inner', ['border-radius']],
    ['.pf-card',         '.ant-card',          ['border-radius']],
    ['.pf-tab',          '.ant-tabs-tab',      ['padding', 'font-size']],
    ['.pf-input',        '.ant-input-affix-wrapper', ['border-radius', 'font-size', 'line-height']],
  ];

  const rule = (cls) => {
    const at = css.indexOf(`\n${cls}{`);
    return at < 0 ? null : css.slice(at, css.indexOf('\n}', at));
  };
  const px = (v) => { const m = /(-?[\d.]+)px/.exec(String(v)); return m ? +m[1] : null; };

  let mismatches = 0, noted = 0, compared = 0;
  for (const [cls, sel, props] of MIRROR) {
    const ours = rule(cls);
    const theirs = antd[sel];
    if (!ours || !theirs) continue;
    for (const prop of props) {
      if (theirs[prop] === undefined) continue;
      const line = ours.split('\n').find((l) => l.trim().startsWith(prop + ':'));
      if (!line) continue;
      compared++;
      /* a var() is resolved by reading the token it names */
      const token = /var\((--[\w-]+)/.exec(line)?.[1];
      const value = token
        ? (new RegExp(`${token}\\s*:\\s*([^;/]+)`).exec(css)?.[1] || '').trim()
        : line.slice(line.indexOf(':') + 1).replace(/;.*$/, '').trim();
      const a = px(value), b = px(theirs[prop]);
      if ((a !== null && b !== null && Math.abs(a - b) <= 1) || value === theirs[prop]) continue;
      /* an explained difference is fine — the product overrides antd constantly */
      if (/\/\*/.test(line)) { noted++; continue; }
      bad(`${cls} { ${prop} } is ${value}, antd emits ${theirs[prop]} — fix it or say why`);
      mismatches++;
    }
  }
  if (!mismatches) ok(`profolio.css agrees with antd (${compared} properties, ${noted} explained)`);
} else {
  warn('data/antd-css.json absent — run npm run antd-css');
}

/* every class a page uses must be defined in the one stylesheet */
const cssCls = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const instance = new Set(['pct-90', 'pct-40', 'pct-100', 'fill-97', 'fill-50', 'fill-8']);
for (const page of ['dashboard.html', 'listings.html']) {
  if (!existsSync(join(D, page))) { bad(`${page} missing`); continue; }
  const pageCls = new Set([...readFileSync(join(D, page), 'utf8')
    .matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
  const orphan = [...pageCls].filter((c) => !cssCls.has(c) && !instance.has(c));
  orphan.length ? bad(`${page} uses classes the stylesheet does not define: ${orphan.join(', ')}`)
                : ok(`${page} — all ${pageCls.size} classes defined`);
}

/* ── 3b · the knowledge base is content, not chrome ────────────────────────
   The old reference layer inlined a <style> block into 320 pages and cost the
   agent three times the prose. kb/ links one stylesheet. A page that carries
   its own <style> or <script> is the shell leaking back in; artboards are
   exempt because they are pictures of the product, not prose. */
const KB = join(ROOT, 'kb');
if (existsSync(KB)) {
  const walkKb = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walkKb(p) : [p]; });
  const pages = walkKb(KB).filter((f) => f.endsWith('.html') && !f.endsWith('.board.html'));
  const leaking = pages.filter((f) => /<style[\s>]|<script[\s>]/i.test(readFileSync(f, 'utf8')));
  leaking.length ? bad(`${leaking.length} kb page(s) carry inline style or script: ${leaking.slice(0, 3).map((f) => f.slice(KB.length + 1)).join(', ')}`)
                 : ok(`kb/ — ${pages.length} pages, none inline a style or script`);
  existsSync(join(KB, 'kb.css')) ? ok('kb/kb.css present') : bad('kb/kb.css missing — every page links it');
  const unlinked = pages.filter((f) => !/<link rel="stylesheet" href="(\.\.\/)*kb\.css">/.test(readFileSync(f, 'utf8')));
  unlinked.length ? bad(`${unlinked.length} kb page(s) do not link kb.css`) : ok('kb/ — every page links kb.css');
  if (existsSync(join(ROOT, 'references'))) bad('references/ still exists — kb/ replaced it; delete it');
} else {
  bad('kb/ missing — run npm run kb');
}

/* ── 4 · verdict ───────────────────────────────────────────────────────── */
console.log('');
if (fails.length) {
  console.log(`  ${fails.length} failure${fails.length > 1 ? 's' : ''}.`);
  process.exit(1);
}
console.log(`  All checks passed${warns.length ? `, ${warns.length} conditional path${warns.length > 1 ? 's' : ''} absent as declared` : ''}.`);
