#!/usr/bin/env node
/**
 * Renders references/**.md into ONE self-contained HTML file a human can browse.
 *
 * The markdown files are written for the agent — routed, small, loaded one at a
 * time. Nobody wants to read a design system that way. This builds the other
 * surface: a single page with a sidebar, search, and every reference rendered.
 *
 *   node scripts/site.mjs            → site/index.html
 *   open site/index.html             (no server needed — plain file:// works)
 *   npx serve site                   (if you'd rather have localhost)
 *
 * No dependencies, no network. The markdown renderer below covers exactly what
 * the reference files use: headings, tables, fenced code, inline code, bold,
 * italic, links, lists, blockquotes and rules.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const REFS = join(ROOT, 'references');
const OUT = join(ROOT, 'site');

if (!existsSync(REFS)) {
  console.error('references/ not found — run scripts/build.mjs first.');
  process.exit(1);
}

/* ── collect every markdown file ──────────────────────────────────────────── */
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) files.push(p);
  }
})(REFS);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── a small markdown renderer, scoped to what these files actually contain ── */
function md(src) {
  // strip the generated banner — it is repeated on every file and adds nothing here
  src = src.replace(/^<!--[\s\S]*?-->\s*/, '');

  const out = [];
  const lines = src.split('\n');
  let i = 0;
  let inFence = false, fenceLang = '', fenceBuf = [];

  const inline = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const flushFence = () => {
    out.push(`<pre class="code${fenceLang ? ' lang-' + fenceLang : ''}"><code>${esc(fenceBuf.join('\n'))}</code></pre>`);
    fenceBuf = []; fenceLang = '';
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      if (inFence) { flushFence(); inFence = false; }
      else { inFence = true; fenceLang = line.slice(3).trim(); }
      i++; continue;
    }
    if (inFence) { fenceBuf.push(line); i++; continue; }

    // table
    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(
        `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      );
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); i++; continue; }

    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`);
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|>|[-*]\s|\d+\.\s|\|)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  if (inFence) flushFence();
  return out.join('\n');
}

/* ── group files into sections ────────────────────────────────────────────── */
const SECTION = (rel) => {
  if (rel.startsWith('tenants/')) return 'KSA rules';
  if (rel === 'foundations.md') return 'Foundations';
  if (rel === 'flags.md') return 'Flags';
  if (rel.startsWith('pages/')) return 'Screens';
  if (rel.startsWith('components/')) return 'Components';
  if (rel.startsWith('copy/')) return 'Copy';
  if (rel.startsWith('flows/')) return 'Flows';
  return 'Other';
};
const ORDER = ['KSA rules', 'Foundations', 'Screens', 'Components', 'Copy', 'Flags', 'Flows', 'Other'];

const docs = files.map((f) => {
  const rel = relative(REFS, f).split('\\').join('/');
  const src = readFileSync(f, 'utf8');
  const title = (src.match(/^#\s+(.+)$/m) || [, rel])[1].trim();
  return { rel, id: rel.replace(/[^a-z0-9]+/gi, '-'), title, section: SECTION(rel), html: md(src), bytes: Buffer.byteLength(src) };
});

/* Disambiguate nav labels that collide — three routes all titled "Lms", say. */
{
  const seen = new Map();
  for (const d of docs) seen.set(d.title, (seen.get(d.title) || 0) + 1);
  for (const d of docs) {
    if (seen.get(d.title) > 1) {
      const leaf = d.rel.replace(/^.*\//, '').replace(/\.md$/, '');
      d.title = `${d.title} · ${leaf}`;
    }
  }
}

const sections = ORDER
  .map((name) => ({ name, docs: docs.filter((d) => d.section === name) }))
  .filter((s) => s.docs.length);

/* Shell markup gets a live preview — it is the one reference that is real HTML. */
const shell = docs.find((d) => d.rel === 'pages/_shell.md');
const shellMarkup = shell ? (readFileSync(join(REFS, 'pages/_shell.md'), 'utf8')
  .match(/```html\n([\s\S]*?)```/) || [, ''])[1] : '';

const nav = sections.map((s) => `
  <div class="navsec">
    <h3>${s.name} <span>${s.docs.length}</span></h3>
    ${s.docs.map((d) => `<a href="#${d.id}" data-t="${esc(d.title.toLowerCase())} ${esc(d.rel)}">${esc(d.title)}</a>`).join('')}
  </div>`).join('');

const body = sections.map((s) => `
  <section class="sec" data-sec="${esc(s.name)}">
    <h1 class="sectitle">${esc(s.name)}</h1>
    ${s.docs.map((d) => `
      <article class="doc" id="${d.id}" data-t="${esc(d.title.toLowerCase())} ${esc(d.rel)}">
        <div class="docpath">${esc(d.rel)}</div>
        ${d.html}
      </article>`).join('')}
  </section>`).join('');

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Profolio KSA Design System</title>
<style>
:root{--bg:#f2f5f5;--paper:#fff;--ink:#16211f;--ink2:#41544f;--mute:#6f817d;
 --rule:#d6e0de;--soft:#eaf0ef;--accent:#006169;--accent-soft:#E1F2F0;--code:#f4f7f7}
@media(prefers-color-scheme:dark){:root{--bg:#0b1312;--paper:#131e1c;--ink:#e6eeec;--ink2:#b3c4c0;
 --mute:#7f938e;--rule:#243432;--soft:#182422;--accent:#63c3c6;--accent-soft:#13302f;--code:#101a19}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);display:grid;grid-template-columns:288px 1fr;
 font:15px/1.6 Lato,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
aside{position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--paper);
 border-right:1px solid var(--rule);padding:22px 0 40px}
aside .brand{padding:0 20px 16px;border-bottom:1px solid var(--rule);margin-bottom:14px}
aside .brand b{display:block;font-size:16px;font-weight:900;color:var(--accent);letter-spacing:-.01em}
aside .brand span{font-size:11.5px;color:var(--mute)}
#q{width:calc(100% - 40px);margin:0 20px 16px;padding:9px 11px;border:1px solid var(--rule);
 border-radius:6px;background:var(--bg);color:var(--ink);font:inherit;font-size:13.5px}
#q:focus{outline:2px solid var(--accent);outline-offset:1px}
.navsec{margin-bottom:6px}
.navsec h3{font:600 10.5px/1 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;
 color:var(--mute);margin:16px 20px 7px;display:flex;justify-content:space-between}
.navsec h3 span{color:var(--accent);font-weight:500}
.navsec a{display:block;padding:5px 20px;color:var(--ink2);text-decoration:none;font-size:13.5px;
 border-inline-start:2px solid transparent;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.navsec a:hover{background:var(--soft);color:var(--accent)}
.navsec a.on{border-inline-start-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600}
main{padding:40px 48px 120px;min-width:0;max-width:1100px}
.sectitle{font-size:12px;font-family:ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;
 color:var(--mute);font-weight:600;margin:52px 0 18px;padding-bottom:10px;border-bottom:2px solid var(--ink)}
.sec:first-child .sectitle{margin-top:0}
.doc{background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:26px 30px;margin-bottom:18px}
.docpath{font:500 11px ui-monospace,monospace;color:var(--accent);margin-bottom:12px;letter-spacing:.03em}
.doc h2{font-size:24px;margin:0 0 12px;letter-spacing:-.02em;line-height:1.15}
.doc h3{font-size:16px;margin:26px 0 8px;letter-spacing:-.01em}
.doc h4{font-size:14px;margin:20px 0 6px;color:var(--ink2)}
.doc p{margin:0 0 11px;color:var(--ink2);max-width:76ch}
.doc ul,.doc ol{margin:0 0 12px;padding-inline-start:22px;color:var(--ink2)}
.doc li{margin-bottom:4px}
.doc strong{color:var(--ink)}
.doc a{color:var(--accent)}
.doc hr{border:0;border-top:1px solid var(--rule);margin:22px 0}
blockquote{margin:0 0 12px;padding:12px 16px;background:var(--soft);border-inline-start:3px solid var(--accent);
 color:var(--ink2);font-size:14px;border-radius:0 4px 4px 0}
code{font:12.5px ui-monospace,SFMono-Regular,monospace;background:var(--code);padding:.13em .38em;
 border-radius:3px;color:var(--ink);word-break:break-word}
pre.code{background:var(--code);border:1px solid var(--rule);border-radius:6px;padding:14px 16px;
 overflow-x:auto;margin:0 0 14px}
pre.code code{background:none;padding:0;font-size:12px;line-height:1.65;white-space:pre}
.tw{overflow-x:auto;margin:0 0 14px;border:1px solid var(--rule);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:440px}
th,td{text-align:start;padding:9px 13px;border-bottom:1px solid var(--rule);vertical-align:top}
th{background:var(--soft);font:600 10.5px ui-monospace,monospace;letter-spacing:.09em;
 text-transform:uppercase;color:var(--mute);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td{color:var(--ink2)}
.preview{background:var(--paper);border:1px solid var(--rule);border-radius:8px;overflow:hidden;margin-bottom:18px}
.preview>.cap{font:600 10.5px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;
 color:var(--mute);padding:12px 16px;border-bottom:1px solid var(--rule)}
.preview iframe{width:100%;height:520px;border:0;display:block;background:#fff}
.hidden{display:none!important}
#empty{color:var(--mute);font-size:14px;padding:20px 0}
@media(max-width:900px){body{grid-template-columns:1fr}aside{position:static;height:auto;border-right:0;
 border-bottom:1px solid var(--rule)}main{padding:28px 20px 80px}}
</style></head><body>

<aside>
  <div class="brand"><b>Profolio KSA</b><span>Design system · ${docs.length} references</span></div>
  <input id="q" type="search" placeholder="Search… (⌘K)" autocomplete="off">
  <nav id="nav">${nav}</nav>
</aside>

<main>
  <div class="preview">
    <div class="cap">Live shell — pages/_shell.md, rendered</div>
    <iframe title="Profolio shell" srcdoc="${esc(shellMarkup).replace(/"/g, '&quot;')}"></iframe>
  </div>
  <p id="empty" class="hidden">Nothing matches.</p>
  ${body}
</main>

<script>
const q = document.getElementById('q');
const docsEls = [...document.querySelectorAll('.doc')];
const navEls = [...document.querySelectorAll('#nav a')];
const secEls = [...document.querySelectorAll('.sec')];
const empty = document.getElementById('empty');

q.addEventListener('input', () => {
  const t = q.value.trim().toLowerCase();
  let shown = 0;
  docsEls.forEach(d => {
    const hit = !t || d.dataset.t.includes(t) || d.textContent.toLowerCase().includes(t);
    d.classList.toggle('hidden', !hit); if (hit) shown++;
  });
  navEls.forEach(a => a.classList.toggle('hidden', !(!t || a.dataset.t.includes(t))));
  secEls.forEach(s => s.classList.toggle('hidden', !s.querySelector('.doc:not(.hidden)')));
  document.querySelectorAll('.navsec').forEach(n =>
    n.classList.toggle('hidden', !n.querySelector('a:not(.hidden)')));
  empty.classList.toggle('hidden', shown > 0);
});

addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); q.focus(); q.select(); }
  if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; q.dispatchEvent(new Event('input')); }
});

const io = new IntersectionObserver(es => {
  es.forEach(e => {
    if (!e.isIntersecting) return;
    navEls.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-10% 0px -80% 0px' });
docsEls.forEach(d => io.observe(d));
</script>
</body></html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);

const bytes = Buffer.byteLength(html);
console.log(`site/index.html   ${docs.length} references · ${(bytes / 1024).toFixed(0)} KB`);
console.log(`sections          ${sections.map((s) => `${s.name} (${s.docs.length})`).join(' · ')}`);
console.log(`\nOpen it:  open site/index.html      — plain file://, no server needed`);
console.log(`Or serve: npx serve site             — if you want localhost`);
