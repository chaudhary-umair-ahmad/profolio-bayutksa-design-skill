#!/usr/bin/env node
/**
 * Renders the knowledge base: kb/, HTML only.
 *
 * The reference layer used to be 320 markdown files with a generated .html twin
 * beside each — 363KB of prose published as 1.66MB, because every twin carried
 * its own <style> block. SKILL.md told the agent to read the .md because the
 * HTML "costs three times as much". That cost was the inlined shell, not HTML.
 *
 * So: markdown is staging (.build/, gitignored). This renders it once, links one
 * stylesheet, and writes content-only pages. A page is <h1>, <table>, <p>,
 * <code> — no nav markup, no <style>, no <script>. It prints the byte ratio
 * against the markdown it replaced, and check.mjs fails a page that inlines a
 * style, so the shell cannot leak back in.
 *
 *   node scripts/kb.mjs
 *
 * Reads   .build/references/**  (build.mjs, extract-layers.mjs, antd-*.mjs)
 *         authoring/*.md         (the hand-written prose)
 * Writes  kb/index.html, kb/kb.css, kb/{design,product,pages,guide}/**
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFS = join(ROOT, '.build', 'references');
const AUTH = join(ROOT, 'authoring');
const OUT = join(ROOT, 'kb');

if (!existsSync(REFS)) { console.error('.build/references not found — run npm run build first.'); process.exit(1); }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

/* ── where each source lands ───────────────────────────────────────────────
   Two halves, as asked: the design system and the product. Pages and the
   working guide sit beside them. */
const SECTIONS = ['Product', 'Design system', 'Pages', 'Guide'];

function place(rel) {
  const m = (re) => rel.match(re);
  let x;
  if (rel === 'tenants/ksa.md')          return ['Product', 'product/ksa.html', 10];
  if (rel === 'pages/index.md')          return ['Product', 'product/screens.html', 20];
  if (rel === 'flags.md')                return ['Product', 'product/flags.html', 30];
  if (rel === 'copy/index.md')           return ['Product', 'product/copy.html', 40];
  if ((x = m(/^copy\/(.+)\.md$/)))       return ['Product', `product/copy/${x[1]}.html`, 41, true];
  if ((x = m(/^flows\/(.+)\.md$/)))      return ['Product', `product/flows/${x[1]}.html`, 50];

  if (rel === 'foundations.md')          return ['Design system', 'design/foundations.html', 10];
  if (rel === 'data/scales.md')          return ['Design system', 'design/scales.html', 20];
  if (rel === 'data/colours.md')         return ['Design system', 'design/colours.html', 21];
  if (rel === 'data/fonts.md')           return ['Design system', 'design/fonts.html', 22];
  if (rel === 'data/listing-table.md')   return ['Design system', 'design/listing-table.html', 23];
  if (rel === 'tokens/antd.md')          return ['Design system', 'design/antd-tokens.html', 30];
  if (rel === 'tokens/antd-css.md')      return ['Design system', 'design/antd-css.html', 31];
  if (rel === 'components/index.md')     return ['Design system', 'design/components.html', 40];
  if ((x = m(/^components\/(.+)\.md$/))) return ['Design system', `design/components/${x[1]}.html`, 41, true];
  if ((x = m(/^data\/(.+)\.md$/)))       return ['Design system', `design/${x[1]}.html`, 25];

  if (rel === 'pages/_shell.md')         return ['Pages', 'pages/_shell.html', 0];
  if ((x = m(/^pages\/(.+)\.md$/)))      return ['Pages', `pages/${x[1]}.html`, 10, true];

  return ['Guide', `guide/${basename(rel, '.md')}.html`, 90];
}

const GUIDE_ORDER = ['recipe', 'qa-dashboard', 'extraction-report', 'harness', 'capture-extension'];

/* ── inputs ────────────────────────────────────────────────────────────── */
const sources = [
  ...walk(REFS).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, rel: relative(REFS, f).split('\\').join('/') })),
  ...(existsSync(AUTH) ? readdirSync(AUTH).filter((n) => n.endsWith('.md') && n !== 'ksa.md')
        .map((n) => ({ file: join(AUTH, n), rel: `guide/${n}` })) : []),
];

const docs = sources.map(({ file, rel }) => {
  const src = readFileSync(file, 'utf8');
  const [section, out, order, leaf] = place(rel);
  const title = (src.match(/^#\s+(.+)$/m) || [, basename(rel, '.md')])[1].trim();
  const guideIdx = GUIDE_ORDER.indexOf(basename(rel, '.md'));
  return { rel, out, section, order: section === 'Guide' && guideIdx > -1 ? guideIdx : order, leaf: !!leaf, title, src, mdBytes: Buffer.byteLength(src) };
});

/* three routes are all titled "Lms" and two "Post Listing": suffix the route so
   the index can tell them apart */
{
  const seen = new Map();
  for (const d of docs) seen.set(d.section + d.title, (seen.get(d.section + d.title) || 0) + 1);
  for (const d of docs) if (seen.get(d.section + d.title) > 1) d.title = `${d.title} · ${basename(d.out, '.html')}`;
}

/* every path a reference might cite, in either spelling → the kb page */
const targets = new Map();
for (const d of docs) {
  targets.set(d.rel, d.out);
  targets.set('references/' + d.rel, d.out);
  targets.set(d.rel.replace(/^guide\//, 'authoring/'), d.out);
}
for (const b of walk(join(REFS, 'pages')).filter((f) => f.endsWith('.board.html'))) {
  const name = basename(b);
  targets.set(`pages/${name}`, `pages/${name}`);
  targets.set(`references/pages/${name}`, `pages/${name}`);
  targets.set(`kb/pages/${name}`, `pages/${name}`);
}
/* things outside kb that the prose points at */
const OUTSIDE = { 'deliverables/sprite.svg': '../deliverables/sprite.svg', 'deliverables/dashboard.html': '../deliverables/dashboard.html',
  'deliverables/components.html': '../deliverables/components.html', 'deliverables/profolio.css': '../deliverables/profolio.css',
  'deliverables/profolio-ksa.html': '../deliverables/profolio-ksa.html' };

const relTo = (from, to) => { const up = from.split('/').length - 1; return '../'.repeat(up) + to; };

function linkify(html, from) {
  return html.replace(/<code>([^<]+)<\/code>/g, (m, text) => {
    const key = text.replace(/^`|`$/g, '');
    if (targets.has(key)) {
      const to = targets.get(key);
      return `<a href="${relTo(from, to)}"><code>${basename(to)}</code></a>`;
    }
    if (OUTSIDE[key]) return `<a href="${relTo(from, OUTSIDE[key]).replace(/^(\.\.\/)+\.\.\//, (s) => s)}"><code>${esc(key)}</code></a>`;
    return m;
  });
}

/* ── markdown → html, scoped to what these files contain ───────────────── */
function md(src) {
  src = src.replace(/^<!--[\s\S]*?-->\s*/, '');
  const out = [];
  const lines = src.split('\n');
  let i = 0, inFence = false, fenceLang = '', fenceBuf = [];

  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, a, href) => `<a href="${href.replace(/\.md$/, '.html')}">${a}</a>`);

  const flushFence = () => {
    out.push(`<pre class="code${fenceLang ? ' lang-' + fenceLang : ''}"><code>${esc(fenceBuf.join('\n'))}</code></pre>`);
    fenceBuf = []; fenceLang = '';
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) { if (inFence) { flushFence(); inFence = false; } else { inFence = true; fenceLang = line.slice(3).trim(); } i++; continue; }
    if (inFence) { fenceBuf.push(line); i++; continue; }

    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim())); i++; }
      out.push(`<table><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; } out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    if (/^[-*]\s+/.test(line)) { const buf = []; while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, '')); i++; } out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`); continue; }
    if (/^\d+\.\s+/.test(line)) { const buf = []; while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\d+\.\s+/, '')); i++; } out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`); continue; }
    if (line.trim() === '') { i++; continue; }
    /* the page templates carry a key/value header block: `route  /dashboard` */
    const kv = line.match(/^([a-z_]+)\s{2,}(.+)$/);
    if (kv && !/^(#|```|>|[-*]\s|\d+\.\s|\|)/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[a-z_]+\s{2,}.+$/.test(lines[i])) { const m2 = lines[i].match(/^([a-z_]+)\s{2,}(.+)$/); buf.push(`<tr><th>${m2[1]}</th><td>${inline(m2[2])}</td></tr>`); i++; }
      out.push(`<table class="kv">${buf.join('')}</table>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|>|[-*]\s|\d+\.\s|\|)/.test(lines[i])) { buf.push(lines[i]); i++; }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  if (inFence) flushFence();
  return out.join('\n');
}

/* ── write ─────────────────────────────────────────────────────────────── */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const page = (d, body, crumbs) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title)} — Profolio KSA</title>
<link rel="stylesheet" href="${relTo(d.out, 'kb.css')}">
</head>
<body>
<nav>${crumbs}</nav>
<main>
${body}
</main>
</body>
</html>
`;

const boards = walk(join(REFS, 'pages')).filter((f) => f.endsWith('.board.html'));
let kbBytes = 0, mdBytes = 0, worst = [];
for (const d of docs) {
  const html = linkify(md(d.src), d.out);
  const route = d.section === 'Pages' && d.leaf ? basename(d.out, '.html') : null;
  const board = route && boards.find((b) => basename(b) === `${route}.board.html`);
  const shot = route && existsSync(join(ROOT, 'data', 'live', `${route}.png`));
  const extras = route ? `<p class="open">${board ? `<a href="${route}.board.html">Open the artboard →</a>` : ''}${shot ? ` <a href="${relTo(d.out, `../data/live/${route}.png`)}">Open the harness render →</a>` : ''}</p>` : '';
  const crumbs = `<a href="${relTo(d.out, 'index.html')}">Profolio KSA</a> › <a href="${relTo(d.out, 'index.html')}#${d.section.toLowerCase().replace(/\s+/g, '-')}">${d.section}</a> › ${esc(d.title)}`;
  const body = extras + html;
  const full = page(d, body, crumbs);
  mkdirSync(dirname(join(OUT, d.out)), { recursive: true });
  writeFileSync(join(OUT, d.out), full);
  const b = Buffer.byteLength(full);
  kbBytes += b; mdBytes += d.mdBytes;
  worst.push({ out: d.out, ratio: b / d.mdBytes, b, md: d.mdBytes });
}
for (const b of boards) copyFileSync(b, join(OUT, 'pages', basename(b)));

/* ── the router ────────────────────────────────────────────────────────── */
const bySection = Object.fromEntries(SECTIONS.map((s) => [s, docs.filter((d) => d.section === s).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))]));

const item = (d, from = 'index.html') => `<li><a href="${d.out}">${esc(d.title)}</a></li>`;
const group = (label, list) => list.length ? `<details><summary>${label} <span>${list.length}</span></summary><ul>${list.map((d) => item(d)).join('')}</ul></details>` : '';

const sectionHtml = (name) => {
  const all = bySection[name];
  const top = all.filter((d) => !d.leaf);
  const leaves = all.filter((d) => d.leaf);
  const id = name.toLowerCase().replace(/\s+/g, '-');
  let leafBlock = '';
  if (name === 'Design system') leafBlock = group('Components', leaves);
  if (name === 'Product') leafBlock = group('Copy by area', leaves);
  if (name === 'Pages') leafBlock = `<ul class="routes">${leaves.map((d) => {
    const r = basename(d.out, '.html');
    const shot = existsSync(join(ROOT, 'data', 'live', `${r}.png`));
    return `<li><a href="${d.out}">${esc(d.title)}</a> <small>${shot ? `<a href="../data/live/${r}.png">render</a> · ` : ''}<a href="pages/${r}.board.html">artboard</a></small></li>`;
  }).join('')}</ul>`;
  return `<section id="${id}"><h2>${name}</h2><ul>${top.map((d) => item(d)).join('')}</ul>${leafBlock}</section>`;
};

const deliverables = ['dashboard.html', 'components.html', 'profolio-ksa.html', 'profolio.css', 'sprite.svg']
  .filter((f) => existsSync(join(ROOT, 'deliverables', f)))
  .map((f) => `<li><a href="../deliverables/${f}">deliverables/${f}</a></li>`).join('');

writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Profolio KSA — Knowledge base</title>
<link rel="stylesheet" href="kb.css">
</head>
<body>
<main class="index">
<h1>Profolio KSA</h1>
<p class="lead">The design system and the product, as the code declares them. ${docs.length} pages, generated from <code>profolio-reactjs</code>; nothing here was typed from a screenshot.</p>
${SECTIONS.map(sectionHtml).join('\n')}
<section id="deliverables"><h2>Deliverables</h2><ul>${deliverables}</ul></section>
</main>
<footer>Generated by <code>scripts/kb.mjs</code>.</footer>
</body>
</html>
`);

/* ── one stylesheet, linked, never inlined ─────────────────────────────── */
writeFileSync(join(OUT, 'kb.css'), `/* Documentation chrome for kb/ — linked once by every page, inlined by none.
   Deliberately not the product's tokens: a reference page is not a Profolio
   screen. The type is the product's, though: the same three Lato faces. */
@import url("../deliverables/fonts.css");
:root{--bg:#f4f6f6;--paper:#fff;--ink:#16211f;--ink2:#41544f;--mute:#6f817d;--rule:#e2e8e7;--accent:#006169;--tint:#f2fafa;--code:#f1f4f4}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;color:var(--ink);font:15px/1.6 Lato,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
nav{max-width:960px;margin:0 auto;padding:18px 24px 0;font-size:13px;color:var(--mute)}
nav a{color:var(--accent);text-decoration:none}
main{max-width:960px;margin:12px auto 0;padding:32px 40px 48px;background:var(--paper);border:1px solid var(--rule);border-radius:10px}
footer{max-width:960px;margin:0 auto;padding:16px 24px 48px;font-size:12px;color:var(--mute)}
h1{font-size:28px;line-height:1.2;margin:0 0 16px;letter-spacing:-.01em}
h2{font-size:19px;margin:36px 0 10px;padding-top:18px;border-top:1px solid var(--rule)}
h3{font-size:16px;margin:26px 0 8px}
h4{font-size:14px;margin:20px 0 6px;color:var(--ink2)}
p,li{color:var(--ink2)}
a{color:var(--accent)}
code{font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);padding:1px 5px;border-radius:4px}
pre.code{background:#101817;color:#e6efed;padding:14px 16px;border-radius:8px;overflow:auto;font-size:12.5px;line-height:1.55}
pre.code code{background:none;padding:0;color:inherit}
table{border-collapse:collapse;width:100%;margin:12px 0 18px;font-size:13.5px}
th,td{text-align:start;vertical-align:top;padding:7px 10px;border-bottom:1px solid var(--rule)}
th{color:var(--mute);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
table.kv th{width:140px;text-transform:none;letter-spacing:0;font-size:13px}
blockquote{margin:0 0 14px;padding:10px 16px;background:var(--tint);border-inline-start:3px solid var(--accent);border-radius:0 6px 6px 0}
hr{border:0;border-top:1px solid var(--rule);margin:24px 0}
p.open a{display:inline-block;margin:0 12px 8px 0;padding:6px 12px;border:1px solid var(--accent);border-radius:6px;text-decoration:none;font-size:13px;font-weight:700}
.index section{margin-top:8px}
.index ul{columns:2;column-gap:32px;padding-inline-start:20px}
.index ul.routes{columns:2}
.index li{break-inside:avoid;margin:2px 0}
.index small{color:var(--mute)}
.index details{margin:8px 0 0}
.index summary{cursor:pointer;color:var(--ink2);font-weight:700}
.index summary span{color:var(--mute);font-weight:400}
.lead{font-size:16px}
@media (max-width:720px){main{padding:20px 16px;border-radius:0;border-inline:0}.index ul{columns:1}}
`);

/* ── the cost claim, measured ─────────────────────────────────────────── */
worst.sort((a, b) => b.ratio - a.ratio);
const over = worst.filter((w) => w.ratio > 2 && w.md > 600);
console.log(`  kb/  ${docs.length} pages + ${boards.length} artboards`);
console.log(`  markdown ${(mdBytes / 1024).toFixed(0)}KB → html ${(kbBytes / 1024).toFixed(0)}KB  (${(kbBytes / mdBytes).toFixed(2)}× overall)`);
if (over.length) {
  console.log(`  ${over.length} page(s) over 2× their markdown — the shell is leaking into the page:`);
  for (const w of over.slice(0, 5)) console.log(`    ${w.out.padEnd(44)} ${w.ratio.toFixed(2)}×  (${w.md} → ${w.b} bytes)`);
} else {
  console.log(`  no page over 2× its markdown (worst ${worst[0].ratio.toFixed(2)}× ${worst[0].out})`);
}
