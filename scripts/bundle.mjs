#!/usr/bin/env node
/**
 * dashboard.html and components.html share one stylesheet by <link>. That is the
 * point — a component is defined once. But dashboard.qa.html loads the page as
 * text into a srcdoc iframe (so the frame stays same-origin and the measurement
 * layer can read it), and a srcdoc frame cannot resolve a relative <link>.
 *
 * So for the QA harness only, emit a single-file copy with the stylesheet inlined.
 * Nothing authors against this file — it is a build artefact.
 *
 *   node scripts/bundle.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = join(dirname(fileURLToPath(import.meta.url)), '..', 'deliverables');
const css = readFileSync(join(D, 'profolio.css'), 'utf8');
const fonts = readFileSync(join(D, 'fonts.css'), 'utf8');
const proto = readFileSync(join(D, 'prototype.js'), 'utf8');

/* EVERY page in deliverables/, not a hand-kept three. Three settings pages
   shipped unbundled the day they were generated because this list did not
   know about them — the same failure mode as check.mjs's page list. */
const PAGES = readdirSync(D)
  .filter((f) => f.endsWith('.html'))
  .filter((f) => !/bundled|not-built|inline-art|qa-|\.qa\.|profolio-ksa/.test(f))
  .sort()
  .map((f) => [f, f.replace(/\.html$/, '.bundled.html')]);

for (const [src, out] of PAGES) {
  const html = readFileSync(join(D, src), 'utf8');
  const link = '<link rel="stylesheet" href="profolio.css">';
  const fontLink = '<link rel="stylesheet" href="fonts.css">';
  if (!html.includes(link)) throw new Error(`no stylesheet link in ${src}`);
  writeFileSync(join(D, out), html
    .replace(fontLink, `<style>\n/* inlined from fonts.css — see scripts/bundle.mjs */\n${fonts}\n</style>`)
    .replace(link, `<style>\n/* inlined from profolio.css — see scripts/bundle.mjs */\n${css}\n</style>`)
    /* the interaction layer has to travel with the page or a single file opens dead */
    .replace('<script src="prototype.js" defer></script>',
             `<script>\n/* inlined from prototype.js — see scripts/bundle.mjs */\n${proto}\n</script>`));
  console.log(`  ${out}`);
}
