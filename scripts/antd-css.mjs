#!/usr/bin/env node
/**
 * Asks antd for the CSS it actually emits.
 *
 * `antd-tokens.mjs` resolves the *global* token scale — colorSplit, padding,
 * controlHeight. That is not the same as what a component renders with, and the
 * difference is not academic: the notification badge was built at 16px because
 * `controlHeightXS` is 16, while antd's Badge emits `height: 20px`. Nothing
 * caught it, because a 16px badge looks perfectly plausible.
 *
 * antd v5 is CSS-in-JS, so the component CSS exists only once a component
 * renders. `@ant-design/cssinjs` lets that happen without a browser: render to
 * a string through a StyleProvider cache, then `extractStyle` it. Feed it the
 * product's own theme config and what comes out is what the product paints.
 *
 *   node scripts/antd-css.mjs --repo ../profolio-reactjs-copy
 *
 * The config is read out of src/theme/index.js rather than copied here, so it
 * cannot drift from the product.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import * as antd from 'antd';
import { StyleProvider, createCache, extractStyle } from '@ant-design/cssinjs';
import chroma from 'chroma-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const REPO = join(ROOT, arg('--repo', '../profolio-reactjs-copy'));

/* ── the product's own theme, evaluated not transcribed ────────────────── */
const src = readFileSync(join(REPO, 'src/theme/index.js'), 'utf8');

/** Match from an opening brace to its partner, skipping strings. */
function braces(text, open) {
  let depth = 0, i = open;
  while (i < text.length) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return text.slice(open, i + 1); }
    else if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < text.length && text[i] !== q) i += text[i] === '\\' ? 2 : 1;
    }
    i++;
  }
  throw new Error('unbalanced braces');
}

/** The object literal a top-level `const <name> = …` declares or returns. */
function objectOf(name) {
  const at = src.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`${name} not found in src/theme/index.js`);
  const body = braces(src, src.indexOf('{', at));
  /* an arrow function with a block body: take what it returns, not the block */
  const ret = body.indexOf('return');
  return ret < 0 ? body : braces(body, body.indexOf('{', ret));
}

const themeColors = new Function('chroma', `return (${objectOf('themeColors')})`)(chroma);
const config = new Function('chroma', 'colors', `return (${objectOf('getAppThemeTokens')})`)(chroma, themeColors);

/* ── render every component the design system claims to reproduce ──────── */
const h = React.createElement;
const { ConfigProvider, Menu, Layout, Card, Table, Badge, Progress, Segmented,
        Tag, Input, Button, Divider, Tabs, Statistic, Select, Avatar, Radio } = antd;

const cache = createCache();
renderToString(h(StyleProvider, { cache }, h(ConfigProvider, { theme: config },
  h('div', null,
    h(Layout, null, h(Layout.Header, null, 'h'), h(Layout.Sider, { collapsed: true, collapsedWidth: 60 },
      h(Menu, { mode: 'inline', inlineCollapsed: true, selectedKeys: ['a'],
                items: [{ key: 'a', label: 'Overview' }, { key: 'b', label: 'Listings' }] })),
      h(Layout.Content, null, 'c'), h(Layout.Footer, null, 'f')),
    h(Card, { title: 'Listings', extra: 'View All' }, h(Statistic, { title: 'Active', value: 20 })),
    h(Table, { columns: [{ title: 'Property', dataIndex: 'p' }], dataSource: [{ key: 1, p: 'x' }] }),
    h(Badge, { count: 46 }),
    h(Progress, { percent: 97 }),
    h(Progress, { percent: 90, type: 'circle', size: 34 }),
    h(Segmented, { options: ['All', 'For Sale'] }),
    h(Tag, { color: 'green' }, 'Live'),
    h(Tag, null, 'Default'),
    h(Input, { suffix: 'x' }),
    h(Button, { type: 'primary' }, 'Post Listing'),
    h(Button, null, 'Default'),
    h(Divider, { type: 'vertical' }),
    h(Tabs, { type: 'card', items: [{ key: 'v', label: 'Views', children: 'x' }] }),
    h(Select, { options: [{ value: 'a', label: 'a' }] }),
    h(Avatar, { size: 34 }),
    h(Radio.Group, { value: 'a' }, h(Radio, { value: 'a' }, 'All')),
  ))));

const css = extractStyle(cache, true);

/* ── the rules worth reading, and every declaration for the checker ────── */
const WANT = {
  'Menu item':        ['.ant-menu-item', '.ant-menu-item-selected', '.ant-menu-inline-collapsed'],
  'Layout':           ['.ant-layout-header', '.ant-layout-sider', '.ant-layout-footer', '.ant-layout-content'],
  'Card':             ['.ant-card', '.ant-card-head', '.ant-card-body', '.ant-card-head-title', '.ant-card-extra'],
  'Table':            ['.ant-table-thead >tr>th', '.ant-table-tbody >tr >td', '.ant-table'],
  'Badge':            ['.ant-badge-count', '.ant-badge'],
  'Progress':         ['.ant-progress-inner', '.ant-progress-bg', '.ant-progress-circle'],
  'Segmented':        ['.ant-segmented', '.ant-segmented-item', '.ant-segmented-item-selected'],
  'Tag':              ['.ant-tag', '.ant-tag-green'],
  'Input':            ['.ant-input', '.ant-input-affix-wrapper'],
  'Button':           ['.ant-btn', '.ant-btn-primary', '.ant-btn-default'],
  'Divider':          ['.ant-divider-vertical', '.ant-divider-horizontal'],
  'Tabs':             ['.ant-tabs-tab', '.ant-tabs-tab-active', '.ant-tabs-ink-bar'],
  'Statistic':        ['.ant-statistic-title', '.ant-statistic-content'],
  'Avatar':           ['.ant-avatar'],
};

/* Rules come out as `:where(.css-hash).ant-x .ant-y{…}`. Strip the hash scope so
   a selector is readable and comparable, and keep the last simple selector. */
const clean = (sel) => sel.replace(/:where\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

const rules = [];
for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const sel = clean(m[1]);
  const body = m[2].trim();
  if (!sel || !body || sel.startsWith('@')) continue;
  rules.push({ sel, body });
}

/** Every declaration that lands on `target`, later rules winning. */
function declarationsFor(target) {
  const out = {};
  for (const { sel, body } of rules) {
    const hits = sel.split(',').some((s) => {
      const t = s.trim();
      return t === target || t.endsWith(' ' + target) || t.endsWith('>' + target);
    });
    if (!hits) continue;
    for (const d of body.split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return out;
}

const json = {};
const md = [];
for (const [group, selectors] of Object.entries(WANT)) {
  md.push(`\n## ${group}\n`);
  for (const sel of selectors) {
    const d = declarationsFor(sel);
    const keys = Object.keys(d);
    if (!keys.length) { md.push(`\`${sel}\` — antd emits nothing for this selector in this render.\n`); continue; }
    json[sel] = d;
    md.push(`### \`${sel}\`\n`);
    md.push('| property | value |');
    md.push('|---|---|');
    /* the properties a reproduction has to get right; the rest is noise */
    const GEOM = /^(height|min-height|max-height|width|min-width|max-width|padding|margin|border|font|line-height|color|background|box-shadow|display|flex|gap|inset|top|right|bottom|left|opacity|transform|writing-mode|text-)/;
    for (const k of keys.filter((k) => GEOM.test(k)).sort())
      md.push(`| \`${k}\` | \`${d[k]}\` |`);
    md.push('');
  }
}

const version = JSON.parse(readFileSync(join(ROOT, 'node_modules/antd/package.json'), 'utf8')).version;
mkdirSync(join(ROOT, 'references', 'tokens'), { recursive: true });
writeFileSync(join(ROOT, 'references/tokens/antd-css.json'),
  JSON.stringify({ antdVersion: version, generated: new Date().toISOString(), selectors: json }, null, 2));
writeFileSync(join(ROOT, 'references/tokens/antd-css.md'),
`<!-- GENERATED by scripts/antd-css.mjs — do not edit. -->

# What antd actually paints

antd v5 is CSS-in-JS: a component's CSS exists only once it renders, so it is in
neither the product's source nor its token scale. This is that CSS, produced by
rendering each component through the product's own \`ConfigProvider\` config —
read out of \`src/theme/index.js\`, not copied — and extracting the result.

Use this whenever a value looks like an antd default. **The global token is not
the answer**: \`controlHeightXS\` is 16 and antd's Badge is 20.

Where the product overrides one of these in its own styled-components layer, the
product wins — see \`references/components/\`. Everything here is the floor.

antd **${version}** · ${Object.keys(json).length} selectors · full output in
\`references/tokens/antd-css.json\`.
${md.join('\n')}
`);

console.log(`  references/tokens/antd-css.json — ${Object.keys(json).length} selectors from antd ${version}`);
console.log(`  references/tokens/antd-css.md   — ${Object.keys(WANT).length} component groups`);
