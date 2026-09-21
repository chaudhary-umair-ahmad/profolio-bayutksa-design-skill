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
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = join(dirname(fileURLToPath(import.meta.url)), '..', 'deliverables');
const css = readFileSync(join(D, 'profolio.css'), 'utf8');
const fonts = readFileSync(join(D, 'fonts.css'), 'utf8');

for (const [src, out] of [['dashboard.html', 'dashboard.bundled.html'],
                          ['listings.html', 'listings.bundled.html'],
                          ['components.html', 'components.bundled.html']]) {
  const html = readFileSync(join(D, src), 'utf8');
  const link = '<link rel="stylesheet" href="profolio.css">';
  const fontLink = '<link rel="stylesheet" href="fonts.css">';
  if (!html.includes(link)) throw new Error(`no stylesheet link in ${src}`);
  writeFileSync(join(D, out), html
    .replace(fontLink, `<style>\n/* inlined from fonts.css — see scripts/bundle.mjs */\n${fonts}\n</style>`)
    .replace(link, `<style>\n/* inlined from profolio.css — see scripts/bundle.mjs */\n${css}\n</style>`));
  console.log(`  ${out}`);
}
