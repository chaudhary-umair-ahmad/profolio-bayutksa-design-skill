#!/usr/bin/env node
/**
 * Pushes generated art into the pages that embed it.
 *
 * dashboard.html and components.html carry a copy of the sprite and of the
 * brand wordmark inline, because a self-contained file cannot fetch them. That
 * copy silently went stale: the sprite was regenerated four times while the
 * pages kept an older one, so a fix to an icon's colour landed in
 * deliverables/sprite.svg and never reached the screen.
 *
 * Nothing catches that by eye. So it is a build step, and `npm run check`
 * fails if the copies drift.
 *
 *   node scripts/sync.mjs            # push sprite + inline art into the pages
 *   node scripts/sync.mjs --check    # fail if a page is out of date
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = join(ROOT, 'deliverables');
const CHECK = process.argv.includes('--check');
const PAGES = ['dashboard.html', 'listings.html', 'components.html'];

/* From the <svg> onward only. sprite.svg opens with a generated header comment,
   and embedding that alongside the one already in the page appended a fresh copy
   on every run — the file would have grown without bound. */
const spriteFile = readFileSync(join(D, 'sprite.svg'), 'utf8');
const sprite = spriteFile.slice(spriteFile.indexOf('<svg class="pf-sprite"')).trim();

/* the brand wordmark is inline rather than a <use>: it carries a <mask>, and a
   mask stops resolving once the art is instanced — see scripts/icons.mjs */
const artFile = join(D, 'inline-art.html');
const logo = existsSync(artFile)
  ? readFileSync(artFile, 'utf8').match(/<svg class="pf-profoliologo"[\s\S]*?<\/svg>/)?.[0]
      ?.replace('class="pf-profoliologo"', 'class="pf-wordmark"')
  : null;

let stale = 0, updated = 0;

for (const page of PAGES) {
  const path = join(D, page);
  let html = readFileSync(path, 'utf8');
  const before = html;

  /* 1 — the sprite block */
  const a = html.indexOf('<svg class="pf-sprite"');
  const b = html.indexOf('</defs></svg>', a);
  if (a < 0 || b < 0) { console.log(`  ! ${page}: no sprite block`); stale++; continue; }
  html = html.slice(0, a) + sprite + html.slice(b + '</defs></svg>'.length);

  /* 2 — the inline wordmark */
  if (logo) {
    /* global: the catalogue renders the rail more than once */
    const re = /<svg class="pf-wordmark"[\s\S]*?<\/svg>/g;
    if (re.test(html)) html = html.replace(re, () => logo);
    else console.log(`  ! ${page}: no .pf-wordmark to refresh`);
  }

  /* 3 — nothing may still point at a symbol that no longer exists */
  const symbols = new Set([...sprite.matchAll(/id="(pf-[\w]+)"/g)].map((m) => m[1]));
  /* comments first: the sprite documents its own usage with a <use href="#pf-Name"> */
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const broken = [...new Set([...noComments.matchAll(/href="#(pf-[\w]+)"/g)].map((m) => m[1]))]
    .filter((r) => !symbols.has(r));
  if (broken.length) { console.log(`  ! ${page}: references missing symbols — ${broken.join(', ')}`); stale++; }

  if (html === before) { console.log(`  ok   ${page} is current`); continue; }
  if (CHECK) { console.log(`  STALE ${page} — its embedded art is behind deliverables/`); stale++; continue; }
  writeFileSync(path, html);
  console.log(`  sync ${page}`);
  updated++;
}

if (CHECK && stale) {
  console.log(`\n  ${stale} page(s) out of date. Run: npm run sync`);
  process.exit(1);
}
if (!CHECK) console.log(`  ${updated} page(s) updated, ${PAGES.length - updated} already current`);
