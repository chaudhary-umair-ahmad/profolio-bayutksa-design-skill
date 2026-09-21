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
  if (!path.startsWith('references/') && !path.startsWith('deliverables/') && !path.startsWith('canvas/')) continue;
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
for (const page of ['dashboard.html', 'components.html']) {
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

/* every class the page styles must be defined in the one stylesheet */
const pageCls = new Set([...readFileSync(join(D, 'dashboard.html'), 'utf8')
  .matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
const cssCls = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const instance = new Set(['pct-90', 'pct-40', 'pct-100', 'fill-97', 'fill-50', 'fill-8']);
const orphan = [...pageCls].filter((c) => !cssCls.has(c) && !instance.has(c));
orphan.length ? bad(`dashboard.html uses classes the stylesheet does not define: ${orphan.join(', ')}`)
              : ok(`dashboard.html — all ${pageCls.size} classes defined`);

/* ── 3 · verdict ───────────────────────────────────────────────────────── */
console.log('');
if (fails.length) {
  console.log(`  ${fails.length} failure${fails.length > 1 ? 's' : ''}.`);
  process.exit(1);
}
console.log(`  All checks passed${warns.length ? `, ${warns.length} conditional path${warns.length > 1 ? 's' : ''} absent as declared` : ''}.`);
