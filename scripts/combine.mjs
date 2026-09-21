#!/usr/bin/env node
/**
 * Emits deliverables/profolio-ksa.html — one self-contained file carrying all
 * three deliverables behind a tab bar:
 *
 *   Report     extraction-report.md, rendered
 *   Catalogue  components.html
 *   Dashboard  dashboard.html
 *
 * The three keep living as separate files; this is the build artefact you hand
 * to someone who just wants to open one thing. No network calls except the
 * Google Fonts stylesheet the pages already load; everything else is inlined.
 *
 *   node scripts/combine.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = join(dirname(fileURLToPath(import.meta.url)), '..', 'deliverables');
const read = (f) => readFileSync(join(D, f), 'utf8');

const css   = read('profolio.css');
const fonts = read('fonts.css');
const cat   = read('components.html');
const dash  = read('dashboard.html');
const list  = read('listings.html');
const md    = readFileSync(join(D, '..', 'authoring', 'extraction-report.md'), 'utf8');

/* ── slice out the parts ──────────────────────────────────────────────── */
const between = (s, a, b, label) => {
  const i = s.indexOf(a), j = s.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`could not find ${label}`);
  return s.slice(i, j + b.length);
};

const sprite    = between(cat,  '<svg class="pf-sprite"', '</defs></svg>', 'sprite');
const catChrome = between(cat,  '/* ── CATALOGUE CHROME ONLY', '</style>', 'catalogue chrome')
                    .replace(/<\/style>$/, '');
const catBody   = between(cat,  '<nav class="cat-nav">', '</main>', 'catalogue body');
const dashBody  = between(dash, '<div class="pf-shell">', '<!-- /.pf-shell -->', 'dashboard body');
const fbTab     = between(dash, '<div class="pf-feedback-tab">', '</div>', 'feedback tab');
const listBody  = between(list, '<div class="pf-shell">', '<!-- /.pf-shell -->', 'listings body');

/* ── markdown → html (only what the report actually uses) ─────────────── */
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');

function markdown(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0, list = null, para = [];

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  // soft-wrapped lines belong to one paragraph, not one <p> each
  const closePara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };

  while (i < lines.length) {
    const l = lines[i];

    // fenced code
    if (/^```/.test(l)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      closeList(); closePara();
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // table
    if (/^\|/.test(l) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      closeList(); closePara();
      out.push('<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>');
      continue;
    }

    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      closeList(); closePara();
      const lvl = m[1].length;
      const id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${lvl} id="r-${id}">${inline(m[2])}</h${lvl}>`);
    } else if (/^(---|\*\*\*)\s*$/.test(l)) {
      closeList(); closePara(); out.push('<hr>');
    } else if ((m = l.match(/^\s*[*-]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); closePara(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = l.match(/^\s*\d+\.\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); closePara(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (l.trim() === '') {
      closeList(); closePara();
    } else if (list) {
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(l.trim()) + '</li>');
    } else {
      para.push(l.trim());
    }
    i++;
  }
  closeList(); closePara();
  return out.join('\n');
}

const report = markdown(md);

/* section links for the report's own sidebar */
const toc = [...report.matchAll(/<h([23]) id="(r-[^"]+)">(.*?)<\/h[23]>/g)]
  .map(([, lvl, id, text]) =>
    `      <button class="cmb-toc-item" data-lvl="${lvl}" data-go="${id}" type="button">${text.replace(/<[^>]+>/g, '')}</button>`)
  .join('\n');

/* ── assemble ─────────────────────────────────────────────────────────── */
const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Profolio KSA — Overview</title>
<style>
/* ═══════════════════════════════════════════════════════════════════════
   0 · THE PRODUCT'S OWN FONT FACES  (fonts.css, inlined)
   Lato 300/400/700 and Droid Arabic Kufi, copied out of
   public/profolio-assets/bayut/fonts/. No network, and no weight the product
   does not ship.
   ═══════════════════════════════════════════════════════════════════════ */
${fonts}

/* ═══════════════════════════════════════════════════════════════════════
   1 · THE SHARED STYLESHEET  (profolio.css, inlined verbatim)
   Every component on both the catalogue and the page is defined here, once.
   ═══════════════════════════════════════════════════════════════════════ */
${css}

/* ═══════════════════════════════════════════════════════════════════════
   2 · INSTANCE DATA
   Custom-property values that carry DATA (a percentage), not presentation.
   Here so neither view needs a single style attribute in its markup.
   ═══════════════════════════════════════════════════════════════════════ */
.pct-90{--ring-pct:90}
.pct-40{--ring-pct:40}
.pct-100{--ring-pct:100;--ring-color:var(--success)}
.fill-97{--meter-pct:97.17}
.fill-50{--meter-pct:50}
.fill-8{--meter-pct:8}

/* ═══════════════════════════════════════════════════════════════════════
   3 · CATALOGUE CHROME  (scoped to #view-catalogue so it cannot reach the page)
   ═══════════════════════════════════════════════════════════════════════ */
${catChrome.replace(/^body\.cat\{[^}]*\}\s*$/m, '')
           .replace(/(^|\n)(\.cat-[^\n{]*|\.pf-sprite|\.i[\w-]*)(?=[\s,{])/g, '$1#view-catalogue $2')}
#view-catalogue{display:grid;grid-template-columns:230px 1fr;background:var(--bg-content)}
#view-catalogue .cat-nav{height:calc(100vh - var(--cmb-tabbar-h));top:var(--cmb-tabbar-h)}

/* ═══════════════════════════════════════════════════════════════════════
   4 · COMBINER CHROME — the tab bar and the report view. Nothing here
       styles a product component.
   ═══════════════════════════════════════════════════════════════════════ */
:root{--cmb-tabbar-h:52px}
body{margin:var(--sp-0)}
.cmb-tabbar{
  position:sticky;top:var(--sp-0);z-index:2000;
  height:var(--cmb-tabbar-h);
  display:flex;align-items:center;gap:var(--sp-4);
  padding-inline:var(--sp-16);
  background:var(--white);
  border-block-end:var(--border-w) solid var(--gray-300);
  box-shadow:var(--shadow-card);
}
.cmb-brand{
  font-weight:var(--fw-900);color:var(--primary);
  font-size:var(--fs-card-title);margin-inline-end:var(--sp-16);white-space:nowrap;
}
.cmb-brand span{
  font-weight:var(--fw-400);color:var(--gray-600);
  font-size:var(--fs-12);margin-inline-start:var(--sp-8);
}
.cmb-tab{
  height:var(--ctl-h);padding-inline:var(--sp-16);
  border-radius:var(--radius-control);
  color:var(--gray-700);font-weight:var(--fw-600);font-size:var(--fs-base);
  white-space:nowrap;
}
.cmb-tab:hover{background:var(--primary-light-4);color:var(--primary)}
.cmb-tab[aria-selected="true"]{background:var(--primary);color:var(--white)}
.cmb-meta{margin-inline-start:auto;color:var(--gray-600);font-size:var(--fs-12);white-space:nowrap}

/* report view */
#view-report{display:grid;grid-template-columns:270px 1fr;background:var(--bg-content)}
.cmb-toc{
  position:sticky;top:var(--cmb-tabbar-h);align-self:start;
  height:calc(100vh - var(--cmb-tabbar-h));overflow:auto;
  background:var(--white);border-inline-end:var(--border-w) solid var(--gray-300);
  padding:var(--sp-20) var(--sp-12);
}
.cmb-toc-item{
  display:block;width:100%;text-align:start;
  padding:var(--sp-4) var(--sp-8);border-radius:var(--radius-tag);
  color:var(--gray-700);font-size:var(--fs-12);line-height:var(--lh-base);
}
.cmb-toc-item[data-lvl="3"]{padding-inline-start:var(--sp-20);color:var(--gray-600)}
.cmb-toc-item:hover{background:var(--primary-light-4);color:var(--primary)}
.cmb-doc{padding:var(--sp-32) var(--sp-32) var(--sp-54);max-width:96ch;min-width:var(--sp-0)}
.cmb-doc h1{font-size:var(--sp-28);margin:var(--sp-0) var(--sp-0) var(--sp-16);color:var(--base)}
.cmb-doc h2{
  font-size:var(--sp-20);margin:var(--sp-40) var(--sp-0) var(--sp-12);color:var(--primary);
  padding-block-end:var(--sp-8);border-block-end:var(--border-w) solid var(--gray-300);
}
.cmb-doc h3{font-size:var(--fs-card-title);margin:var(--sp-24) var(--sp-0) var(--sp-8);color:var(--base)}
.cmb-doc h4{font-size:var(--fs-base);margin:var(--sp-16) var(--sp-0) var(--sp-8);color:var(--gray-800)}
.cmb-doc p{margin:var(--sp-0) var(--sp-0) var(--sp-12);color:var(--gray-900);line-height:1.65}
.cmb-doc ul,.cmb-doc ol{margin:var(--sp-0) var(--sp-0) var(--sp-12);padding-inline-start:var(--sp-24)}
.cmb-doc li{margin-block-end:var(--sp-4);color:var(--gray-900);line-height:1.65}
.cmb-doc hr{border:0;border-block-start:var(--border-w) solid var(--gray-300);margin:var(--sp-32) var(--sp-0)}
.cmb-doc code{
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--fs-12);
  background:var(--primary-light-4);color:var(--primary);
  padding:var(--sp-2) var(--sp-6);border-radius:var(--radius-tag);
}
.cmb-doc pre{
  background:var(--white);border:var(--border-w) solid var(--gray-300);
  border-radius:var(--radius-card);padding:var(--sp-16);overflow:auto;
}
.cmb-doc pre code{background:none;color:var(--base);padding:var(--sp-0);font-size:var(--fs-13)}
.cmb-doc table{
  width:100%;border-collapse:collapse;margin:var(--sp-0) var(--sp-0) var(--sp-20);
  background:var(--white);border:var(--border-w) solid var(--gray-300);
  border-radius:var(--radius-card);overflow:hidden;font-size:var(--fs-13);
}
.cmb-doc th,.cmb-doc td{
  text-align:start;padding:var(--sp-8) var(--sp-12);
  border-block-end:var(--border-w) solid var(--gray-200);vertical-align:top;
}
.cmb-doc th{background:var(--bg-gray-light);color:var(--gray-700);font-weight:var(--fw-700);white-space:nowrap}
.cmb-doc tbody tr:last-child td{border-block-end:0}
.cmb-doc strong{color:var(--base)}

/* the dashboard view keeps its own full-bleed shell */
#view-dashboard .pf-rail-fixed,#view-listings .pf-rail-fixed{inset-block-start:var(--cmb-tabbar-h)}
#view-dashboard .pf-header-fixed,#view-listings .pf-header-fixed{inset-block-start:var(--cmb-tabbar-h)}

@media (max-width:991px){
  #view-report,#view-catalogue{grid-template-columns:1fr}
  .cmb-toc,#view-catalogue .cat-nav{display:none}
}
</style>
</head>
<body>

${sprite}

<nav class="cmb-tabbar" role="tablist" aria-label="Deliverables">
  <span class="cmb-brand">Profolio KSA<span>design system · /dashboard + /listings</span></span>
  <button class="cmb-tab" role="tab" data-view="dashboard" aria-selected="true" type="button">Dashboard</button>
  <button class="cmb-tab" role="tab" data-view="listings" aria-selected="false" type="button">My Listings</button>
  <button class="cmb-tab" role="tab" data-view="catalogue" aria-selected="false" type="button">Catalogue</button>
  <button class="cmb-tab" role="tab" data-view="report" aria-selected="false" type="button">Extraction report</button>
  <span class="cmb-meta">sourced from profolio-reactjs @ b83e805</span>
</nav>

<!-- ═════ DASHBOARD ═════════════════════════════════════════════════════ -->
<div id="view-dashboard">
${dashBody}
${fbTab}
</div>

<!-- ═════ LISTINGS ══════════════════════════════════════════════════════ -->
<div id="view-listings" hidden>
${listBody}
</div>

<!-- ═════ CATALOGUE ═════════════════════════════════════════════════════ -->
<div id="view-catalogue" hidden>
${catBody}
</div>

<!-- ═════ REPORT ════════════════════════════════════════════════════════ -->
<div id="view-report" hidden>
  <aside class="cmb-toc">
${toc}
  </aside>
  <article class="cmb-doc">
${report}
  </article>
</div>

<script>
/* Tabs and in-page jumps are buttons driving scrollIntoView, never <a href="#…">.
   A hash link counts as a navigation inside a sandboxed viewer and pops an
   "external link" dialog; this does not. */
(function () {
  var tabs = document.querySelectorAll('.cmb-tab');
  var views = {};
  tabs.forEach(function (t) { views[t.dataset.view] = 'view-' + t.dataset.view; });

  function show(name) {
    Object.keys(views).forEach(function (k) {
      document.getElementById(views[k]).hidden = (k !== name);
    });
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.view === name)); });
    window.scrollTo(0, 0);
    try { localStorage.setItem('profolio-ksa-view', name); } catch (e) {}
  }

  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.view); }); });

  // the catalogue's own nav ships as <a href="#c-…">; intercept so it scrolls
  // instead of navigating
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go], a[href^="#"]');
    if (!el) return;
    var id = el.dataset.go || el.getAttribute('href').slice(1);
    e.preventDefault();
    if (!id) return;
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  try {
    var saved = localStorage.getItem('profolio-ksa-view');
    if (saved && views[saved]) show(saved);
  } catch (e) {}
})();
</script>
</body>
</html>
`;

writeFileSync(join(D, 'profolio-ksa.html'), html);
console.log('  deliverables/profolio-ksa.html', (html.length / 1024).toFixed(0) + 'KB');
