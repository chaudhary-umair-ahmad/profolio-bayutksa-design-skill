#!/usr/bin/env node
/**
 * Embeds the faces the product actually paints with.
 *
 * This was wrong for the whole life of the project, and the design QA's pixel
 * diff is what caught it: every page was rendering in **Lato**, and Profolio
 * KSA paints in **Figtree**.
 *
 * The evidence, in the product's own render (data/live/listings.capture.json):
 * 1,698 of 1,708 elements compute `Figtree, "Droid Arabic Kufi", sans-serif`.
 * The other ten are `icomoon`. Nothing computes Lato.
 *
 *   src/theme/index.js:306   antd token  fontFamily: 'Figtree, Droid Arabic Kufi, sans-serif'
 *   src/hooks/useAppInit.js  loads Figtree + Mukta from Google Fonts when !isMemberArea
 *   src/hooks/useAppInit.js  also loads lato-font.css for bayut — but nothing references
 *                            Lato except FONT_FAMILY_LITE and the lite footer, so it
 *                            paints nothing in Profolio proper
 *
 * Figtree is a **variable font, weight 300–900**, so 500 and 600 are real
 * weights. The previous note here claimed they were synthesised; that was true
 * of Lato, which is not what paints.
 *
 * Arabic and the currency glyph stay: the stack names Droid Arabic Kufi second
 * and KSA ships Arabic first, so an Arabic string falls through to it.
 *
 *   node scripts/fonts.mjs --repo ../profolio-reactjs-copy --tenant bayut
 *
 * Figtree is fetched once from Google (the same URL useAppInit asks for) and
 * cached in .build/fonts/, so a later run needs no network.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const REPO = join(ROOT, arg('--repo', '../profolio-reactjs-copy'));
const TENANT = arg('--tenant', 'bayut');
const DIR = join(REPO, 'public', 'profolio-assets', TENANT, 'fonts');
const CACHE = join(ROOT, '.build', 'fonts');
mkdirSync(CACHE, { recursive: true });

/* the exact request useAppInit.js makes */
const GF = 'https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&family=Mukta:wght@200;300;400;500;600;700;800&display=swap';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const out = [];
const missing = [];
let bytes = 0;

/* ── 1 · Figtree, variable, from Google ─────────────────────────────────── */
async function figtree() {
  const cssCache = join(CACHE, 'figtree.css');
  let css;
  if (existsSync(cssCache)) css = readFileSync(cssCache, 'utf8');
  else {
    const r = await fetch(GF, { headers: { 'User-Agent': UA } });
    if (!r.ok) { missing.push(`Figtree css (${r.status})`); return; }
    css = await r.text();
    writeFileSync(cssCache, css);
  }
  /* latin and latin-ext only: the deliverables are English with Arabic falling
     through to Droid Arabic Kufi, and the other subsets are dead weight */
  const blocks = [...css.matchAll(/\/\*\s*(latin|latin-ext)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)];
  const seen = new Set();
  for (const [, subset, body] of blocks) {
    if (!/font-family:\s*'Figtree'/.test(body)) continue;
    /* THE URL ASKS FOR `ital,wght@0,300..900;1,300..900`, so Google answers
       with the ITALIC faces first. This loop took the first latin block it
       saw, cached it as figtree-latin.woff2 and wrote `font-style:normal`
       over it — every page in the design system was painting in Figtree
       Italic, and because the harness serves this same file to the product,
       both sides of every comparison were italic and the QA could not see it.
       Take the upright faces, and never write a style we did not read. */
    const style = /font-style:\s*([^;]+);/.exec(body)?.[1]?.trim() || 'normal';
    if (style !== 'normal') continue;
    if (seen.has(subset)) continue;
    seen.add(subset);
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1];
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim() || '300 900';
    if (!url) continue;
    const name = `figtree-${subset}.woff2`;
    const file = join(CACHE, name);
    let buf;
    if (existsSync(file)) buf = readFileSync(file);
    else {
      const fr = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!fr.ok) { missing.push(`${name} (${fr.status})`); continue; }
      buf = Buffer.from(await fr.arrayBuffer());
      writeFileSync(file, buf);
    }
    bytes += buf.length;
    out.push(
      `/* ${subset} */\n@font-face{\n` +
      `  font-family:"Figtree";\n` +
      `  src:url(data:font/woff2;base64,${buf.toString('base64')}) format("woff2");\n` +
      `  font-weight:${weight};\n` +
      `  font-style:${style};\n  font-display:swap;\n` +
      (range ? `  unicode-range:${range};\n` : '') +
      `}`
    );
  }
}

/* ── 2 · the tenant's own faces ─────────────────────────────────────────── */
const LOCAL = [
  { file: 'DroidArabicKufi.woff2', family: 'Droid Arabic Kufi', weight: 400 },
];

await figtree();

for (const f of LOCAL) {
  const p = join(DIR, f.file);
  if (!existsSync(p)) { missing.push(f.file); continue; }
  const buf = readFileSync(p);
  bytes += buf.length;
  out.push(
    `@font-face{\n` +
    `  font-family:"${f.family}";\n` +
    `  src:url(data:font/woff2;base64,${buf.toString('base64')}) format("woff2");\n` +
    `  font-weight:${f.weight};\n  font-style:normal;\n  font-display:swap;\n}`
  );
}

const css =
`/* GENERATED by scripts/fonts.mjs — do not edit.

   Figtree is what Profolio KSA paints with: the antd token at
   src/theme/index.js:306 names it, useAppInit.js fetches it from Google, and
   1,698 of the 1,708 elements in the product's own render compute it. It is a
   VARIABLE font at weight 300-900, so every weight in that range is a real
   face — 500 and 600 are not synthesised.

   Lato is loaded by the product too, and paints nothing: only FONT_FAMILY_LITE
   and the lite footer name it. It is deliberately not embedded here.

   Droid Arabic Kufi is second in the stack and KSA ships Arabic first, so it
   is here for every Arabic string. Embedded as base64 — no network. */
${out.join('\n')}
`;

writeFileSync(join(ROOT, 'deliverables', 'fonts.css'), css);
console.log(`  deliverables/fonts.css — ${out.length} faces, ${(bytes / 1024).toFixed(0)}KB embedded`);
if (missing.length) console.log(`  MISSING: ${missing.join(', ')}`);
