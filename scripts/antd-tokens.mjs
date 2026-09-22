#!/usr/bin/env node
/**
 * Asks antd what its own tokens resolve to.
 *
 * A whole class of questions in the extraction report came back "antd default,
 * cannot tell": the Table's cell padding, the Badge's geometry, the Progress
 * bar's height and track, colorSplit, the Segmented internals, the disabled
 * states. None of those are in the product's source, because the product never
 * overrides them — they are computed at runtime by antd v5's token algorithm
 * from the seed config in src/theme/index.js.
 *
 * Reading antd's source gives you the algorithm, not the answer. Running it
 * gives you the answer. This feeds the product's exact seed config to
 * `theme.getDesignToken()` and writes what comes back, so those values stop
 * being guesses without anybody having to open a browser.
 *
 *   npm i -D antd
 *   node scripts/antd-tokens.mjs --repo ../profolio-reactjs-copy
 *
 * Re-run it when antd is bumped; the output is a build artefact.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const REPO = join(ROOT, arg('--repo', '../profolio-reactjs-copy'));

let theme;
try {
  ({ theme } = await import('antd'));
} catch {
  console.error('antd is not installed here. Run:  npm i -D antd\n' +
    'It is a build-time dependency only — nothing ships it.');
  process.exit(1);
}

/* ── the product's seed ────────────────────────────────────────────────────
   src/theme/index.js builds this with getAppThemeTokens(colors). Rather than
   evaluate that module (it imports chroma and the tenant env), mirror the
   parts that steer the algorithm. Anything left out falls back to antd's own
   default, which is exactly what the product gets for it too. */
const colors = { primaryColor: '#006169', successColor: '#28b16d', warningColor: '#f0a742',
  errorColor: '#f73131', infoColor: '#2C99FF', linkColor: '#1890ff', gray100: '#f0f0f0',
  gray700: '#707070', gray600: '#9D9D9D', darkColor: '#272B41', headingColor: '#222',
  btnlg: '48px', btnsm: '36px' };

const config = {
  token: {
    borderColor: colors.gray100,
    borderRadius: 6,
    borderRadiusLG: 8,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    colorError: colors.errorColor,
    colorInfo: colors.infoColor,
    colorLink: colors.linkColor,
    colorPrimary: colors.primaryColor,
    colorSuccess: colors.successColor,
    colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
    colorWarning: colors.warningColor,
    fontFamily: 'Figtree, Droid Arabic Kufi, sans-serif',
    fontSize: 14,
    fontSizeHeading1: 38, fontSizeHeading2: 30, fontSizeHeading3: 24,
    fontSizeHeading4: 20, fontSizeHeading5: 16,
    lineHeight: 1.571,
    colorTextPlaceholder: colors.gray600,
  },
  components: {
    Button: { contentLineHeight: 2, controlHeight: 36, controlHeightLG: 40, controlHeightSM: 32,
              defaultBorderColor: colors.gray100 },
    Card: { colorTextHeading: colors.darkColor, headerBg: '#fff', colorBgContainer: '#fff',
            borderRadiusLG: 10, paddingLG: 12 },
    Layout: { bodyBg: '#F6F7FB', headerBg: '#fff', footerBg: '#fafafa', headerHeight: 74,
              siderBg: '#fff' },
    Radio: { buttonBg: '#fff', buttonCheckedBg: colors.primaryColor, buttonColor: colors.gray700 },
  },
};

const t = theme.getDesignToken(config);

/* The questions the report could not answer, and where each one lands. */
const ANSWERS = {
  'Table cell padding':      ['paddingContentVerticalLG', 'padding', 'paddingLG', 'paddingSM'],
  'Row / column dividers':   ['colorSplit', 'colorBorderSecondary', 'colorBorder', 'lineWidth'],
  'Card':                    ['borderRadiusLG', 'paddingLG', 'colorBgContainer', 'boxShadowTertiary'],
  'Badge':                   ['fontSizeSM', 'lineHeightSM', 'controlHeightXS', 'colorError'],
  'Progress':                ['fontSize', 'colorFillSecondary', 'colorSuccess', 'borderRadiusSM'],
  'Segmented':               ['controlHeight', 'controlHeightSM', 'borderRadiusSM', 'colorBgLayout'],
  'Disabled states':         ['colorTextDisabled', 'colorBgContainerDisabled', 'colorBorder', 'opacityLoading'],
  'Controls':                ['controlHeight', 'controlHeightLG', 'controlHeightSM', 'controlHeightXS',
                              'controlPaddingHorizontal', 'controlPaddingHorizontalSM'],
  'Type scale':              ['fontSize', 'fontSizeSM', 'fontSizeLG', 'fontSizeXL', 'lineHeight', 'lineHeightSM'],
  'Motion':                  ['motionDurationFast', 'motionDurationMid', 'motionEaseInOut'],
};

const lines = [];
const missing = [];
for (const [group, keys] of Object.entries(ANSWERS)) {
  lines.push(`\n## ${group}\n`);
  lines.push('| token | resolved |');
  lines.push('|---|---|');
  for (const k of keys) {
    if (t[k] === undefined) { missing.push(k); continue; }
    lines.push(`| \`${k}\` | \`${t[k]}\` |`);
  }
}

const version = JSON.parse(
  readFileSync(join(ROOT, 'node_modules', 'antd', 'package.json'), 'utf8')).version;
const appPins = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).dependencies?.antd;

mkdirSync(join(ROOT, 'data'), { recursive: true });
mkdirSync(join(ROOT, '.build', 'references', 'tokens'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'antd-tokens.json'),
  JSON.stringify({ antdVersion: version, appPins, generated: new Date().toISOString(), token: t }, null, 2));

writeFileSync(join(ROOT, '.build', 'references', 'tokens', 'antd.md'),
`<!-- GENERATED by scripts/antd-tokens.mjs — do not edit. -->

# antd resolved tokens

Everything the product leaves to antd. These are not in its source because it
never overrides them: antd v5 computes them at runtime from the seed config in
\`src/theme/index.js\`. Running that algorithm here is how they stop being
guesses.

Installed antd **${version}**; the app pins \`${appPins || 'unknown'}\`.
${version.split('.')[0] === (appPins || '').replace(/^\D+/, '').split('.')[0]
  ? '' : '\n> **The major versions differ. Re-pin before trusting a value below.**\n'}
Full output: \`data/antd-tokens.json\` (${Object.keys(t).length} tokens).

> These are antd's **global** tokens. Per-component overrides in the product's
> \`components:\` block (Card.paddingLG, Button.controlHeight and so on) are the
> app's own and are already in \`foundations.md\`; they are not re-derived here.
${lines.join('\n')}
`);

console.log(`  data/antd-tokens.json — ${Object.keys(t).length} tokens from antd ${version}`);
console.log(`  antd tokens (kb)      — the ${Object.keys(ANSWERS).length} groups the report could not answer`);
if (missing.length) console.log(`  ! not present in this antd version: ${missing.join(', ')}`);
