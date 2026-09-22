#!/usr/bin/env node
/**
 * Design QA — look at the finished page, don't just score its boxes.
 *
 * derive-layout.mjs answers "are the measurements right?" for the regions
 * somebody listed. It cannot see a wrong glyph, a colour on an element nobody
 * listed, content in the wrong order, or a page that falls apart in Arabic.
 * This looks.
 *
 *   node scripts/qa-design.mjs listings
 *   node scripts/qa-design.mjs listings dashboard
 *   node scripts/qa-design.mjs --all
 *
 * Reads  data/live/<route>.{png,capture.json}   the product, rendered by the harness
 *        data/ours/<route>.{png,capture.json}   ours (rendered here if absent)
 * Writes deliverables/qa-<route>.html           a side-by-side visual report
 *        data/qa/<route>.json                   the findings, for a diff over time
 *
 * Six checks:
 *   1 region pixel diff   what a designer would spot — ranked, not pass/fail
 *   2 token audit         every computed colour traces to a :root token
 *   3 scale adherence     every size is a step utils.less declares
 *   4 contrast            text vs its ground, with the product's own value beside it
 *   5 RTL                 KSA ships Arabic first; nothing may overflow or stay physical
 *   6 coverage            regions the product has that we never modelled
 *
 * No new dependency: the comparison runs in a canvas in the Chromium Playwright
 * already drives.
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS, pickRegions } from './derive-layout.mjs';

const { chromium } = pkg;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

/* ── what counts as on-scale ── src/static/less/utils.less, via kb/design/scales.html ── */
const SPACE = [0, 2, 4, 8, 12, 16, 20, 24, 25, 30, 32, 40, 48, 54];
const FONT = [10, 12, 13, 14, 16, 18, 20, 24];
const WEIGHT = [400, 500, 600, 700, 800];
/* sizes a component may declare as a literal because the product does too —
   each is a token in profolio.css with its source in the comment beside it */
const ALLOWED_LITERAL = new Set([
  60,   /* rail width, header height */
  36, 32, 40, 42, 44,  /* control heights: ctl-h, sm, lg, filter search, input */
  106,  /* listing thumbnail */
  34, 20, 46, 50, 85, 5.5, 11, 10, 9.5, 6, 3, 1, 2,
]);

/* the shell is the same markup on every page, so it is the one hard threshold */
const SHELL = new Set(['shell.sider', 'shell.header', 'shell.title', 'shell.footer']);
const SHELL_MAX = 6;      /* % of pixels that may differ in a shell region */

const pct = (n) => `${n.toFixed(1)}%`;
const rgbOf = (s) => (String(s).match(/[\d.]+/g) || []).map(Number);
/* normalise a colour string so rgb(0,0,0) and rgba(0,0,0,1) are one key */
const rgb = (v) => String(v).replace(/\s+/g, '').replace(/^rgba\((\d+),(\d+),(\d+),1\)$/, 'rgb($1,$2,$3)');

/* ── relative luminance / contrast, WCAG ──────────────────────────────── */
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (fg, bg) => {
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/* ── walk helpers over a capture ──────────────────────────────────────── */
const each = (n, fn) => { if (!n) return; fn(n); (n.children || []).forEach((k) => each(k, fn)); };
const collect = (root, pred) => { const o = []; each(root, (n) => { if (pred(n)) o.push(n); }); return o; };

/** The nearest ancestor with an opaque background — what text actually sits on. */
function groundOf(tree, target) {
  const path = [];
  (function find(n, trail) {
    if (n === target) { path.push(...trail, n); return true; }
    return (n.children || []).some((k) => find(k, [...trail, n]));
  })(tree, []);
  for (let i = path.length - 1; i >= 0; i--) {
    const bg = path[i].style.backgroundColor;
    if (!bg) continue;
    const c = rgbOf(bg);
    if (c.length >= 3 && (c.length === 3 || c[3] > 0.9)) return c.slice(0, 3);
  }
  return [255, 255, 255];
}

/* ── 1 · region pixel diff, in a canvas ───────────────────────────────── */
const DIFF_PAGE = `
window.__diff = async (aSrc, bSrc, boxes) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [A, B] = await Promise.all([load(aSrc), load(bSrc)]);
  const out = [];
  for (const { id, a, b } of boxes) {
    const w = Math.min(a.w, b.w), h = Math.min(a.h, b.h);
    if (w < 4 || h < 4) { out.push({ id, skipped: 'region too small to compare' }); continue; }
    const ca = document.createElement('canvas'), cb = document.createElement('canvas');
    ca.width = cb.width = w; ca.height = cb.height = h;
    const xa = ca.getContext('2d', { willReadFrequently: true }), xb = cb.getContext('2d', { willReadFrequently: true });
    xa.drawImage(A, a.x, a.y, w, h, 0, 0, w, h);
    xb.drawImage(B, b.x, b.y, w, h, 0, 0, w, h);
    const da = xa.getImageData(0, 0, w, h).data, db = xb.getImageData(0, 0, w, h).data;
    let differing = 0;
    /* Compare LUMINANCE, not channels.
       The product's text rasterises greyscale and ours subpixel: magnified,
       our glyphs carry orange and blue fringes and the product's do not. Same
       font, same size, same weight, same box, same colour — a per-channel
       tolerance still called every glyph edge different, and put shell.title
       at 23.8% on a region with no measurable disagreement at all.
       It is the compositor, not the design: -webkit-font-smoothing:antialiased
       is a no-op in this Chromium (781 vs 725 coloured pixels in a controlled
       render) while transform:translateZ(0) takes it to 0, and something in
       the product's tree composites.
       Luminance keeps every real difference — a wrong weight, a shifted
       baseline, a missing glyph, a different colour all move it — and drops
       the fringe. Colour itself is held to account by the token audit. */
    const L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2];
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(L(da, i) - L(db, i)) > 24) differing++;
    }
    out.push({ id, w, h, diff: (differing / (w * h)) * 100,
               cropA: ca.toDataURL('image/png'), cropB: cb.toDataURL('image/png') });
  }
  return out;
};
`;

/* ── the run ──────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Every state the harness captured for this route, in capture order. */
function statesOf(route) {
  const dir = join(ROOT, 'data', 'live');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => new RegExp(`^${route}--(.+)\\.capture\\.json$`).exec(f))
    .filter(Boolean).map((m) => m[1]).sort();
}

/**
 * One pass over one state of one route.
 *
 * `state` null is the default screen and gets every check. A named state is an
 * overlay or a tab — the stylesheet checks (literals, physical properties) and
 * the RTL pass are properties of the page, not of the state, so they run once
 * on the default and are not repeated. Everything that can differ per state —
 * the region diff, what the page computes, contrast inside the overlay — runs
 * every time.
 */
async function qa(route, browser, state = null) {
  const suffix = state ? `--${state}` : '';
  const full = !state;
  const liveCap = join(ROOT, 'data', 'live', `${route}${suffix}.capture.json`);
  const livePng = join(ROOT, 'data', 'live', `${route}${suffix}.png`);
  const page = join(ROOT, 'deliverables', `${route}.html`);
  for (const f of [liveCap, livePng, page]) if (!existsSync(f)) return { route, state, error: `missing ${f.slice(ROOT.length + 1)}` };

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  /* ── render ours: full page at 1440, plus the capture, plus an RTL pass ── */
  const script = readFileSync(join(ROOT, 'tools/profolio-capture/capture.js'), 'utf8');
  await p.goto('file://' + page);
  await p.waitForTimeout(500);

  /* Reach the state the same way a reviewer does — through the page's own
     deep-link resolver. If the name does not resolve, the state is not built
     yet, and saying so is the finding. */
  if (state) {
    const applied = await p.evaluate((s) => (window.pfGoTo ? window.pfGoTo(s) : false), state);
    if (!applied) {
      await ctx.close();
      return { route, state, error: `not built — nothing in the page answers to “${state}”` };
    }
    await p.waitForTimeout(300);
  }

  /* The prototype bar is ours alone — it says so on the page — and being
     fixed it lands on the footer in a full-page shot. Take it out of the
     comparison rather than let it read as a 15% footer difference. */
  await p.evaluate(() => document.querySelectorAll('.pf-proto-bar').forEach((el) => { el.hidden = true; }));

  /* An open overlay is positioned in the viewport, so the harness shot the
     viewport rather than the full page. Match it, or the two images are in
     different coordinate systems and every crop is wrong. */
  const overlayOpen = await p.evaluate(() => [...document.querySelectorAll('.pf-mask,.pf-drawer,.pf-popover')]
    .some((el) => !el.hidden && el.getClientRects().length));

  const oursPng = join(ROOT, 'data', 'ours', `${route}${suffix}.png`);
  mkdirSync(dirname(oursPng), { recursive: true });
  await p.screenshot({ path: oursPng, fullPage: !overlayOpen });
  const oursCap = await p.evaluate(script);
  writeFileSync(join(ROOT, 'data', 'ours', `${route}${suffix}.capture.json`), JSON.stringify(oursCap));

  /* 3 · scale adherence, 2 · token audit, 4 · contrast — all from the live DOM */
  const dom = await p.evaluate(({ SPACE, FONT, WEIGHT, ALLOWED }) => {
    const off = { size: [], weight: [], space: [] };
    const px = (v) => { const m = /^(-?[\d.]+)px$/.exec(v); return m ? Math.abs(+m[1]) : null; };
    const where = (el) => {
      const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
      return el.tagName.toLowerCase() + (c ? '.' + c : '');
    };
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!el.getClientRects().length) continue;
      /* likewise a computed 15.9992px font-size is `1.1428em`, which the
         product declares; only whole-pixel sizes can be judged here */
      const fsz = px(cs.fontSize);
      if (fsz !== null && Number.isInteger(fsz) && !FONT.includes(fsz) && !ALLOWED.includes(fsz)) {
        const k = 'f' + fsz + where(el); if (!seen.has(k)) { seen.add(k); off.size.push({ value: fsz, at: where(el) }); }
      }
      const fw = +cs.fontWeight;
      if (fw && !WEIGHT.includes(fw)) {
        const k = 'w' + fw + where(el); if (!seen.has(k)) { seen.add(k); off.weight.push({ value: fw, at: where(el) }); }
      }
      /* Spacing is NOT checked here. A computed 14px padding may be the
         product's own `1em` at a 14px font — correct, derived, and
         indistinguishable from a literal once the browser has resolved it.
         The honest place to check a literal is the stylesheet, below. */
    }

    /* contrast: every element with its own text, against the nearest opaque ground */
    const texts = [];
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      let bg = 'rgba(0, 0, 0, 0)', n = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        const m = (c.match(/[\d.]+/g) || []).map(Number);
        if (m.length >= 3 && (m.length === 3 || m[3] > 0.9)) { bg = c; break; }
        n = n.parentElement;
      }
      texts.push({ fg: cs.color, bg, size: cs.fontSize, weight: cs.fontWeight,
                   at: where(el), text: (el.textContent || '').trim().slice(0, 40) });
    }
    return { off, text: texts, docHeight: document.documentElement.scrollHeight };
  }, { SPACE, FONT, WEIGHT, ALLOWED: [...ALLOWED_LITERAL] });

  /* 5 · RTL — KSA ships Arabic first. A property of the page, so the default
     pass carries it and a state pass inherits the verdict. */
  if (full) await p.evaluate(() => { document.documentElement.dir = 'rtl'; });
  await p.waitForTimeout(full ? 350 : 0);
  const rtl = !full ? null : await p.evaluate(() => {
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -2 || r.right > innerWidth + 2)) {
        const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
        over.push({ at: el.tagName.toLowerCase() + (c ? '.' + c : ''), left: Math.round(r.left), right: Math.round(r.right) });
      }
    }
    return { overflow: document.documentElement.scrollWidth > innerWidth + 2,
             scrollWidth: document.documentElement.scrollWidth, offscreen: over.slice(0, 8) };
  });
  await ctx.close();

  /* physical properties that should be logical — a stylesheet-level RTL defect */
  const css = full ? readFileSync(join(ROOT, 'deliverables', 'profolio.css'), 'utf8') : ':root{\n}';
  let off_literals = [];
  /* Every px literal outside :root, and every physical property.
     These were line-anchored regexes until a negative test proved them
     vacuous: most rules in this stylesheet are written on one line, so
     `^\s*padding:` never matched them and the checks passed on a file with
     deliberate faults in it. Tokenise the declarations instead. */
  const rootEnd = css.indexOf('\n}', css.indexOf(':root{'));
  const body = css.slice(rootEnd).replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = [];
  for (const chunk of body.split('}')) {
    const at = chunk.indexOf('{');
    if (at < 0) continue;
    const selector = chunk.slice(0, at).split('\n').pop().trim();
    for (const d of chunk.slice(at + 1).split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const prop = d.slice(0, i).trim(), value = d.slice(i + 1).trim();
      if (prop && value) decls.push({ selector, prop, value });
    }
  }

  const literals = [];
  for (const { selector, prop, value } of decls) {
    for (const n of value.match(/(\d+(?:\.\d+)?)px/g) || []) {
      const v = parseFloat(n);
      if (v === 0 || v === 1) continue;                    /* borders and zero */
      if (SPACE.includes(v) || FONT.includes(v) || ALLOWED_LITERAL.has(v)) continue;
      literals.push(`${selector} { ${prop}: ${value} }`);
    }
  }
  off_literals = [...new Set(literals)];

  const physical = [...new Set(decls
    .filter(({ prop }) => /^(margin|padding|border)-(left|right)(-|$)/.test(prop) || /^(left|right)$/.test(prop))
    .map(({ selector, prop, value }) => `${selector} { ${prop}: ${value} }`))];

  /* ── 1 + 6 · regions: diff each side against ITS OWN box, so a page that
     runs 30px shorter still compares the right content ─────────────────── */
  const live = JSON.parse(readFileSync(liveCap, 'utf8'));
  const L = pickRegions(live, 'live'), O = pickRegions(oursCap, 'ours');
  const boxes = [], notModelled = [];
  for (const r of REGIONS) {
    if (!L[r.id]) continue;
    if (!O[r.id]) { notModelled.push(r.id); continue; }
    boxes.push({ id: r.id, a: L[r.id].box, b: O[r.id].box });
  }

  const dp = await (await browser.newContext()).newPage();
  await dp.addInitScript(DIFF_PAGE);
  await dp.goto('about:blank');
  await dp.addScriptTag({ content: DIFF_PAGE });
  const toDataUrl = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
  const diffs = await dp.evaluate(([a, b, boxes]) => window.__diff(a, b, boxes),
    [toDataUrl(livePng), toDataUrl(oursPng), boxes]);
  await dp.context().close();

  /* Regions where a difference is the correct outcome, not a defect. Recorded
     with the reason rather than dropped, so the exclusion is visible. */
  const EXPECTED = {
    'table.thumb': 'the product renders a photo; a design system renders the placeholder it ships with',
  };
  for (const d of diffs) if (EXPECTED[d.id]) d.expected = EXPECTED[d.id];

  /* A region an open overlay sits on top of is not being compared — the crop is
     mostly the overlay. Mark those rather than rank them: in the account-popover
     state the filter buttons read 49.5% different, and every pixel of it is the
     popover covering them. The translucent mask is NOT an occluder; it dims both
     sides equally and what is under it still compares. */
  const OCCLUDERS = ['modal', 'drawer', 'popover'];
  const covers = (o, b) => {
    const w = Math.max(0, Math.min(o.x + o.w, b.x + b.w) - Math.max(o.x, b.x));
    const h = Math.max(0, Math.min(o.y + o.h, b.y + b.h) - Math.max(o.y, b.y));
    return b.w && b.h ? (w * h) / (b.w * b.h) : 0;
  };
  const occ = OCCLUDERS.flatMap((id) => [L[id]?.box, O[id]?.box].filter(Boolean));
  for (const d of diffs) {
    if (OCCLUDERS.includes(d.id.split('.')[0])) continue;
    const box = L[d.id]?.box;
    if (box && occ.some((o) => covers(o, box) > 0.3)) d.behind = true;
  }
  const aside = (d) => (d.expected || d.behind ? 1 : 0);
  diffs.sort((x, y) => aside(x) - aside(y) || (y.diff ?? -1) - (x.diff ?? -1));

  /* ── findings ──────────────────────────────────────────────────────── */
  const shellFails = diffs.filter((d) => SHELL.has(d.id) && !d.behind && d.diff > SHELL_MAX);
  /* Contrast is a COMPARISON, not an absolute. The product itself puts eight
     text colours below 4.5:1 across ~490 elements — rgb(173,180,210) at 2.05:1
     on 208 of them. Reporting those as our defects told you 74 things that were
     mostly not true. We report only where WE are worse than the product, and
     list the product's own sub-4.5 colours separately as its choice to own. */
  const productColours = new Map();
  each(live.tree, (n) => {
    if (!n.style.color) return;
    const key = rgb(n.style.color);
    productColours.set(key, (productColours.get(key) || 0) + 1);
  });
  const productLow = [...productColours.entries()]
    .map(([col, n]) => ({ col, n, ratio: contrast(rgbOf(col), [255, 255, 255]) }))
    .filter((c) => c.ratio < 4.5)
    .sort((a, b) => a.ratio - b.ratio);

  const rated = dom.text.map((t) => ({ ...t, ratio: contrast(rgbOf(t.fg), rgbOf(t.bg)) }));
  /* ours is a real finding only when the colour is below 4.5 AND the product
     does not paint text in that colour at all */
  const lowContrast = rated
    .filter((t) => t.ratio < 4.5 && !productColours.has(rgb(t.fg)))
    .sort((a, b) => a.ratio - b.ratio);
  const matchedProduct = rated.filter((t) => t.ratio < 4.5 && productColours.has(rgb(t.fg))).length;

  return { route, state, full, diffs, notModelled, off: dom.off, literals: off_literals, lowContrast, productLow, matchedProduct, rtl, physical, shellFails,
           heights: { product: live.viewport.page.h, ours: dom.docHeight } };
}

/* ── the report ───────────────────────────────────────────────────────── */
function report(r) {
  const band = (d) => d > 25 ? 'high' : d > 8 ? 'mid' : 'low';
  const rows = r.diffs.filter((d) => d.diff !== undefined);
  const list = (arr, fn) => arr.length ? `<ul>${arr.map(fn).join('')}</ul>` : '<p class="ok">Nothing to report.</p>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design QA — ${esc(r.route)}</title>
<link rel="stylesheet" href="fonts.css">
<style>
:root{--bg:#f4f6f6;--paper:#fff;--ink:#16211f;--mute:#6f817d;--rule:#e2e8e7;--accent:#006169;
 --high:#f73131;--mid:#f0a742;--low:#28b16d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
 font:14px/1.6 Lato,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 24px 64px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 10px;padding-top:16px;border-top:1px solid var(--rule)}
.sub{color:var(--mute);margin:0 0 20px}
.card{background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:16px 18px;margin-bottom:12px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
.pair figure{margin:0}.pair img{max-width:100%;display:block;border:1px solid var(--rule);border-radius:6px;background:#fff}
.pair figcaption{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);margin-bottom:4px}
.hd{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.hd code{font-size:13px;color:var(--accent)}
.n{font-weight:700}.n[data-band=high]{color:var(--high)}.n[data-band=mid]{color:var(--mid)}.n[data-band=low]{color:var(--low)}
ul{margin:8px 0 0;padding-inline-start:20px}li{margin:3px 0;color:#41544f}
code{background:#f1f4f4;padding:1px 5px;border-radius:4px;font:12px ui-monospace,Menlo,monospace}
.ok{color:var(--low);margin:6px 0 0}.bad{color:var(--high);font-weight:700}
.lede{background:#fff;border:1px solid var(--rule);border-inline-start:3px solid var(--accent);
 border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px}
</style></head><body><main>
<h1>Design QA — ${esc(r.route)}</h1>
<p class="sub">Our page against the product's own render, region by region.
Product page ${r.heights.product}px · ours ${r.heights.ours}px.</p>

<div class="lede"><strong>This is a worklist, not a pass mark.</strong> A dev-mode React render and
static HTML are never pixel-identical — synthesised font weights alone see to that. The percentages
rank where to look. The one hard rule is the shell (rail, header, footer): identical markup on every
page, so anything over ${SHELL_MAX}% there is a real defect.
${r.shellFails.length ? `<br><span class="bad">${r.shellFails.length} shell region(s) over threshold: ${r.shellFails.map((d) => esc(d.id)).join(', ')}</span>` : '<br><span class="ok">Shell within threshold.</span>'}</div>

<h2>1 · Region pixel diff</h2>
${rows.map((d) => `<div class="card">
  <div class="hd"><code>${esc(d.id)}</code><span class="n" data-band="${d.expected || d.behind ? 'low' : band(d.diff)}">${pct(d.diff)} of pixels differ${d.expected ? ' · expected' : d.behind ? ' · behind the overlay' : ''}</span></div>
  ${d.expected ? `<p class="sub" style="margin:4px 0 0">Expected: ${esc(d.expected)}</p>` : ''}
  ${d.behind ? '<p class="sub" style="margin:4px 0 0">An open overlay covers this region — the crop is the overlay, not a comparison.</p>' : ''}
  <div class="pair">
    <figure><figcaption>product · ${d.w}×${d.h}</figcaption><img src="${d.cropA}" alt=""></figure>
    <figure><figcaption>ours</figcaption><img src="${d.cropB}" alt=""></figure>
  </div></div>`).join('')}

<h2>2 · Off-scale sizes</h2>
<p class="sub">Every font-size, weight, gap and padding the page computes, against the steps
<code>utils.less</code> declares. A value not here had to be written as a literal.</p>
${list(r.off.size, (o) => `<li><code>${o.value}px</code> font-size on <code>${esc(o.at)}</code></li>`)}
${list(r.off.weight, (o) => `<li><code>${o.value}</code> font-weight on <code>${esc(o.at)}</code></li>`)}
<h3 style="font-size:14px;margin:18px 0 4px">px literals outside <code>:root</code></h3>
<p class="sub">A computed padding cannot be judged — the product's own <code>1em</code> resolves to 14px and
looks identical to a literal. A value written as px in a rule can be, and every one belongs in a token
with its source beside it.</p>
${list(r.literals, (l) => `<li><code>${esc(l)}</code></li>`)}

<h2>3 · Contrast</h2>
<p class="sub">A comparison, not an absolute. ${r.matchedProduct} of our low-contrast texts use a colour the
product paints text in too — we match it rather than quietly diverging, because a design system that
corrects the product stops describing it. Only colours the product never uses are listed as ours.</p>
<h3 style="font-size:14px;margin:18px 0 4px">Ours, below 4.5:1 and not the product's</h3>
${list(r.lowContrast.slice(0, 20), (t) => `<li><strong>${t.ratio.toFixed(2)}:1</strong> — <code>${esc(t.at)}</code>
  ${esc(t.fg)} on ${esc(t.bg)} at ${t.size}/${t.weight} · “${esc(t.text)}”</li>`)}
<h3 style="font-size:14px;margin:18px 0 4px">The product's own, for the record</h3>
<p class="sub">Its choice to own, not ours to fix. Listed so nobody reports them as our defects.</p>
${list(r.productLow, (c) => `<li><strong>${c.ratio.toFixed(2)}:1</strong> — <code>${esc(c.col)}</code> on ${c.n} element${c.n > 1 ? 's' : ''}</li>`)}

<h2>4 · RTL</h2>
<p class="sub">KSA ships Arabic first — <code>LANGUAGES[0]</code> is <code>ar</code>, so a bare route is RTL.</p>
${r.rtl.overflow ? `<p class="bad">Horizontal overflow at dir=rtl: document is ${r.rtl.scrollWidth}px wide.</p>` : '<p class="ok">No horizontal overflow at dir=rtl.</p>'}
${list(r.rtl.offscreen, (o) => `<li><code>${esc(o.at)}</code> sits at ${o.left}…${o.right}</li>`)}
${r.physical.length ? `<p class="bad">${r.physical.length} physical propert${r.physical.length > 1 ? 'ies' : 'y'} in profolio.css that should be logical:</p>${list(r.physical.slice(0, 10), (p) => `<li><code>${esc(p)}</code></li>`)}` : '<p class="ok">No physical left/right properties in the stylesheet.</p>'}

<h2>5 · States</h2>
<p class="sub">A page is not done when its default screen scores. Every state the harness captured —
each overlay, each tab — is rendered here through the page's own <code>#state=</code> deep link and
diffed against <code>data/live/${esc(r.route)}--&lt;state&gt;.png</code>. A state the page cannot reach
says so rather than being left out.</p>
${(r.states || []).length ? (r.states || []).map((st) => `<div class="card">
  <div class="hd"><code>${esc(st.state)}</code>${st.error
    ? `<span class="bad">${esc(st.error)}</span>`
    : `<span class="n" data-band="${st.shellFails.length ? 'high' : 'low'}">${st.diffs.filter((d) => d.diff !== undefined && !d.behind).length} region(s) compared${st.shellFails.length ? ` · shell FAIL` : ''}</span>`}</div>
  ${st.error ? '' : `${st.diffs.filter((d) => d.diff !== undefined).map((d) => `<div class="hd" style="margin-top:10px">
      <code>${esc(d.id)}</code><span class="n" data-band="${d.behind || d.expected ? 'low' : band(d.diff)}">${pct(d.diff)}${d.behind ? ' · behind the overlay' : d.expected ? ' · expected' : ''}</span></div>
    <div class="pair">
      <figure><figcaption>product · ${d.w}×${d.h}</figcaption><img src="${d.cropA}" alt=""></figure>
      <figure><figcaption>ours</figcaption><img src="${d.cropB}" alt=""></figure>
    </div>`).join('')}
    ${st.notModelled.length ? `<p class="sub" style="margin-top:8px">Not modelled in this state: ${st.notModelled.map((id) => `<code>${esc(id)}</code>`).join(' ')}</p>` : ''}`}
  </div>`).join('') : '<p class="sub">No states captured for this route yet — <code>node harness/capture.mjs --routes ' + esc(r.route) + ' --states</code>.</p>'}

<h2>6 · Coverage</h2>
<p class="sub">Regions the product's render has that our page never modelled. Not a score — a list of
what we chose not to build, so a percentage can never quietly mean “of the part I listed”.</p>
${list(r.notModelled, (id) => `<li><code>${esc(id)}</code></li>`)}
</main></body></html>`;
}

/* ── main ─────────────────────────────────────────────────────────────── */
let routes = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all')) {
  routes = readdirSync(join(ROOT, 'deliverables'))
    .filter((f) => f.endsWith('.html') && !/bundled|components|profolio-ksa|qa-|\.qa\./.test(f))
    .map((f) => f.replace('.html', ''));
}
if (!routes.length) { console.error('usage: qa-design.mjs <route>… | --all'); process.exit(2); }

const browser = await chromium.launch();
mkdirSync(join(ROOT, 'data', 'qa'), { recursive: true });
let worst = 0;
const withStates = !args.includes('--no-states');
for (const route of routes) {
  const r = await qa(route, browser);
  if (r.error) { console.log(`  ${route.padEnd(16)} skipped — ${r.error}`); continue; }

  /* every state the harness captured, scored the same way */
  r.states = [];
  for (const st of withStates ? statesOf(route) : []) r.states.push(await qa(route, browser, st));
  writeFileSync(join(ROOT, 'deliverables', `qa-${route}.html`), report(r));
  writeFileSync(join(ROOT, 'data', 'qa', `${route}.json`), JSON.stringify({
    route, at: new Date().toISOString(), shellFails: r.shellFails.map((d) => ({ id: d.id, diff: +d.diff.toFixed(1) })),
    diffs: r.diffs.filter((d) => d.diff !== undefined).map((d) => ({ id: d.id, diff: +d.diff.toFixed(1) })),
    offScale: r.off, literals: r.literals, lowContrast: r.lowContrast.length, contrastMatchingProduct: r.matchedProduct, productLow: r.productLow.map((c) => ({ col: c.col, n: c.n, ratio: +c.ratio.toFixed(2) })), notModelled: r.notModelled,
    rtlOverflow: r.rtl.overflow, physical: r.physical.length,
    states: r.states.map((st) => (st.error
      ? { state: st.state, error: st.error }
      : { state: st.state, shellFails: st.shellFails.map((d) => d.id),
          diffs: st.diffs.filter((d) => d.diff !== undefined).map((d) => ({ id: d.id, diff: +d.diff.toFixed(1) })),
          notModelled: st.notModelled })),
  }, null, 2));

  const top = r.diffs.filter((d) => d.diff !== undefined).slice(0, 3);
  const offCount = r.off.size.length + r.off.weight.length + r.literals.length;
  console.log(`  ${route.padEnd(16)} shell ${r.shellFails.length ? `FAIL(${r.shellFails.map((d) => d.id).join(',')})` : 'ok'} · ` +
    `off-scale ${offCount} · contrast ${r.lowContrast.length} ours/${r.matchedProduct} the product's · rtl ${r.rtl.overflow ? 'OVERFLOW' : 'ok'} · ` +
    `physical ${r.physical.length} · not modelled ${r.notModelled.length}`);
  console.log(`  ${' '.repeat(16)} worst regions: ${top.map((d) => `${d.id} ${pct(d.diff)}`).join(' · ')}`);
  for (const st of r.states) {
    console.log(`  ${' '.repeat(16)} ${st.state.padEnd(22)} ${st.error ? st.error
      : `${st.diffs.filter((d) => d.diff !== undefined && !d.behind).length} region(s) · ` +
        st.diffs.filter((d) => d.diff !== undefined && !d.behind && !d.expected).slice(0, 3).map((d) => `${d.id} ${pct(d.diff)}`).join(' · ')}`);
    worst += st.error ? 0 : st.shellFails.length;
  }
  console.log(`  ${' '.repeat(16)} → deliverables/qa-${route}.html`);
  worst += r.shellFails.length;
}
await browser.close();
process.exit(worst ? 1 : 0);
