#!/usr/bin/env node
/**
 * Turns the product's real icons into a sprite.
 *
 * Every glyph in the deliverables was a hand-drawn placeholder, which is the
 * single largest visual difference from the live screen. The real ones are not
 * hiding anywhere clever: `src/components/svg.js` holds 363 of them as plain
 * inline SVG React components, and the rest are re-exported from `react-icons`
 * through `src/components/icons.js`.
 *
 * This reads both and writes `deliverables/sprite.svg` as <symbol>s that the
 * pages reference with <use href="#pf-Name">.
 *
 *   node scripts/icons.mjs --repo ../profolio-reactjs-copy
 *
 * react-icons is optional. If it is not installed the script still emits every
 * local icon and lists what it skipped, so the sprite is always usable.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const REPO = join(ROOT, arg('--repo', '../profolio-reactjs-copy'));

/* ── what the dashboard actually uses ──────────────────────────────────────
   Grouped so the sprite stays legible and so a missing icon is obvious. The
   comment on each line is where the product names it. */
const WANTED = {
  // rail — tenant/common/menuList/menuList.js
  SideMenuDashboard: 'Overview',
  PostListingIcon: 'Post Listing',
  MyListingIcon: 'My Listings',
  SideMenuQuota: 'Credits Usage',
  SideMenuInbox: 'Inbox',
  DashboardLmsIcon: 'TruLeads',
  AgentPerformanceIcon: 'Agent Performance',
  SideMenuReports: 'Reports',
  SideMenuAgency: 'Agency Staff',
  SideMenuPropShop: 'Credits & Packages',
  // rail bottom — layout/MenueItems.js
  LanguageSwitcherIcon: 'language switcher',
  HelpSupportIcon: 'Help & Support',
  // brand — tenant/common/components/logo/Logo.js renders this at 190x32;
  // the collapsed 60px rail clips it, which is the small mark on the live screen
  ProfolioLogo: 'brand wordmark',
  // header — tenant/common/components/headerLink/headerLink.js
  SidebarClassifiedLinkIcon: 'Go to Bayut.sa',
  // Listings breakdown — tenant/bayut/transformers/listings.js widgetParser
  ActiveListingIcon: 'Active (total)',
  IconForSale: 'For Sale',
  IconForRent: 'To Rent',
  IconRental: 'Daily Rentals',
  // products — tenant/bayut/data/products.js
  IconBasic: 'Basic listing',
  IconSuperHot: 'Hot listing',
  IconPkgPlatinumPlus: 'Platinum Plus package',
  // leads summary — tenant/common/transformers/reports.js
  IconWhatsapp: 'WhatsApp leads',
  // listing cell — components/table/table-components/listing-purpose.js,
  // specs from tenant/common/data/staticLists.js getListingSpecs
  IconAreaSize: 'area',
  IconBedroom: 'beds',
  IconBathroom: 'baths',
  // row actions — components/table/table-actions/table-actions.js
  IconSellRentListing: 'Sell or Rent Property',
  /* the first row action. icons.js:922 renders it at size 18 with a 6px
     inline-end margin, which is why that button measures 40 wide and the
     other five measure 36. We were drawing HiCheck in its place. */
  TruCheckIcon: 'TruCheck (row action 1)',
  RequestedStateIcon: 'upgrade requested',
  // upgrade services — tenant/bayut/data/products.js
  DroneIcon: 'Drone Footage (#79cdd1)',
  // empty state — components/common/EmptyState/EmptyState.js:31 renders
  // <EmptyListing color={tenantTheme['primary-light-2']}/> for type="table"
  EmptyListing: 'No Record Found illustration',
  // the settings sub-nav — appRoutes.js getUserSettingsRoutes()
  SideMenuSetting: 'Agency Settings (settings sub-nav)',
  // the Ad License wizard's section marks — create-ad-license.js:270,447,474
  IconPropertyInfo: 'Property Information',
  IconLocationPurpose: 'Property Location',
  IconContactInfo: 'Contact Information',
};

/* react-icons names the product uses on this screen. Resolution order in
   components/common/icon/icon.js is ReactIcons first, so these win over any
   same-named local icon. */
const REACT_ICONS = {
  MdPhoneIphone: 'Download App',
  MdKeyboardArrowDown: 'account switcher',
  FiUser: 'avatar fallback',
  FiArrowUpRight: 'View All Listings',
  FiCalendar: 'date filter',
  FiUsers: 'Assign to Users',
  FiLogOut: 'Sign Out',
  IoAddCircleOutline: 'Top-Up your Credits',
  PiClockClockwiseFill: 'Credits Usage',
  BsInfoLg: 'credits info — the CreditsQuota card, and the ONLY BsInfoLg on Listings',
  /* the info glyph in the table body is this one, not BsInfoLg: it sits beside
     the REGA id (listing-purpose.js:346), beside Timeline's posted-on
     (expiry-renewal.js:60), beside Leads (listing-stats.js:93) and beside a
     rejected Status pill (platforms-status.js:26). Four popovers hang off it
     and the design system was drawing BsInfoLg for all of them. */
  AiOutlineInfoCircle: 'the table-body info icon — four popovers hang off it',
  IoSettingsOutline: 'Settings',
  GoDotFill: 'separator dot',
  PiSealCheckFill: 'verified',
  TiArrowSortedUp: 'trend up',
  TiArrowSortedDown: 'trend down',
  IoMdClose: 'dismiss',
  IoMdEye: 'Preview',
  IoMdEyeOff: 'hide',
  MdEdit: 'Edit',
  MdDateRange: 'Mark as Booked',
  HiOutlineTrash: 'Delete',
  HiCheck: 'upgrade applied',
  MdMoreVert: 'more actions',
  BsFillLightningChargeFill: 'Signature listing',
  BiSearch: 'search',
  FiSearch: 'filter bar Search button (filters.js searchButton icon default)',
  MdOutlineDoubleArrow: 'Show More filters (filters.js:629)',
  MdPieChartOutline: 'manage products',
  // performance metrics — tenant/common/transformers/reports.js reach_data
  HiCursorClick: 'Clicks',
  MdPhone: 'Leads / Calls',
  MdSms: 'SMS',
  MdEmail: 'Emails',
  // notifications — components/notification-center/notification-center.js
  GrNotification: 'notifications',
  IoRefreshSharp: 'refresh notifications',
  // listing drawer — components/table/table-actions/table-actions.js
  TiArrowForwardOutline: 'listing detail drawer',
  // upgrade services — tenant/bayut/data/products.js
  MdRefresh: 'Refresh Property (#479EEB)',
  // the settings sub-nav — appRoutes.js getUserSettingsRoutes()
  PiIdentificationCard: 'Licenses',
  VscSettings: 'Preferences',
  MdPassword: 'Change Password',
  // the settings forms
  BsStars: 'Generate Agent Description — GenerateContentField.js:182',
  /* image-upload.js:90 animates a Lottie cloud here rather than drawing an
     icon. A static page cannot carry the animation, so this is the closest
     glyph and the one place on these pages where the mark is an equivalent
     rather than the product's own. */
  MdOutlineCloudUpload: 'Browse and Upload (stands in for the upload Lottie)',
  HiCamera: 'Verified Photography (#5462AF)',
  HiVideoCamera: 'Verified Videography (#FFA900)',
};

/* ── JSX → SVG ─────────────────────────────────────────────────────────────
   These components are plain SVG with a handful of JSX-isms. Everything the
   files actually use is handled below; anything unhandled is left alone and
   shows up in the report rather than being silently dropped. */
const ATTR = {
  strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin', strokeDasharray: 'stroke-dasharray',
  strokeMiterlimit: 'stroke-miterlimit', strokeOpacity: 'stroke-opacity',
  fillRule: 'fill-rule', clipRule: 'clip-rule', fillOpacity: 'fill-opacity',
  clipPath: 'clip-path', stopColor: 'stop-color', stopOpacity: 'stop-opacity',
  gradientUnits: 'gradientUnits', gradientTransform: 'gradientTransform',
  patternUnits: 'patternUnits', maskUnits: 'maskUnits',
  xlinkHref: 'xlink:href', xmlnsXlink: 'xmlns:xlink',
};

/** Attributes that describe React, not paint — drop them wholesale.
    Note what is NOT here: width and height. They are meaningless on the root
    <svg> (the <use> sizes it) but load-bearing on <mask>, <rect>, <pattern> and
    <filter>. Dropping them everywhere made the brand wordmark paint nothing,
    because its mask had no extent to mask. They are stripped from the root tag
    only, further down. */
/* `style` is dropped EXCEPT when it paints: svg.js writes the design system's
   own colours as `style={{ fill: tenantTheme['primary-light'] }}` on several
   shapes, and dropping those left the empty-state illustration's three big
   bars unpainted — they inherited the page's text colour and the art came out
   near-black where the product's is nearly white. */
const DROP_ATTR = new Set(['className', 'key', 'onClick', 'xmlns', 'xmlnsXlink', 'ref']);

/* The product's palette, read from its own theme file so a colour here is
   never a guess. src/theme/index.js exports `colors` and maps them to the
   hyphenated names svg.js uses. */
const THEME = (() => {
  const f = join(REPO, 'src', 'theme', 'index.js');
  if (!existsSync(f)) return {};
  const src = readFileSync(f, 'utf8');
  const raw = {};
  for (const m of src.matchAll(/^\s*(\w+):\s*'(#[0-9a-fA-F]{3,8})'/gm)) raw[m[1]] = m[2];
  const out = {};
  for (const m of src.matchAll(/'([\w-]+)':\s*colors\.(\w+)/g)) if (raw[m[2]]) out[m[1]] = raw[m[2]];
  return out;
})();

/**
 * Resolve one JSX attribute expression to a plain SVG value.
 * Returns a string to use, or null to drop the attribute entirely.
 * `unresolved` collects anything this does not understand, so a value is never
 * silently invented or silently lost.
 */
function resolveExpr(attr, expr, unresolved, defaults = {}) {
  const e = expr.trim();

  if (DROP_ATTR.has(attr)) return null;

  /* style={{ fill: tenantTheme['primary-light'] }} — the only style this
     honours, and only when it resolves to a real colour in the product's own
     theme. Anything else in a style object is reported, not invented. */
  if (attr === 'style') {
    const m = e.match(/^\{\s*(fill|stroke)\s*:\s*tenantTheme\[['"]([\w-]+)['"]\]\s*\}$/);
    if (m && THEME[m[2]]) return { asAttr: m[1], value: THEME[m[2]] };
    /* the two presentation styles the illustrations rely on. Dropping them
       left EmptyListing's masked group unmasked and unmultiplied, so two
       shapes the product blends away rendered as solid #222 blocks. */
    const css = [...e.matchAll(/(\w+)\s*:\s*'([^']+)'/g)]
      .map(([, k, v]) => [k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v])
      .filter(([k]) => k === 'mask-type' || k === 'mix-blend-mode' || k === 'display');
    if (css.length && css.length === [...e.matchAll(/\w+\s*:/g)].length) {
      return { asAttr: 'style', value: css.map(([k, v]) => `${k}:${v}`).join(';') };
    }
    unresolved.push(`${attr}={${e.length > 60 ? e.slice(0, 60) + '…' : e}}`);
    return null;
  }

  // tenantTheme['primary-color'] on its own
  const tok = e.match(/^tenantTheme\[['"]([\w-]+)['"]\]$/);
  if (tok && THEME[tok[1]]) return THEME[tok[1]];

  /* a prop whose default is a literal colour: that default is the product's
     intent, not a placeholder for the cascade */
  if (Object.prototype.hasOwnProperty.call(defaults, e)) return defaults[e];

  // a number:  strokeWidth={0.8}
  if (/^-?[\d.]+$/.test(e)) return e;

  // a plain string:  fill={'none'}
  const str = e.match(/^['"]([^'"]*)['"]$/);
  if (str) return str[1];

  // anything colour-shaped inherits from CSS
  if (/^(props\.)?(color|fill|stroke)(\s*\|\|\s*['"][^'"]*['"])?$/.test(e)) return 'currentColor';

  // a template literal, e.g. `color-mix(in srgb, ${props.color || 'x'} 8%, #fff)`
  const tpl = e.match(/^`([\s\S]*)`$/);
  if (tpl) {
    const body = tpl[1].replace(/\$\{[^}]*\}/g, 'currentColor');
    if (!/[${}]/.test(body)) return body;
  }

  // a defaulted prop with a literal fallback:  {size || '1em'}
  const fallback = e.match(/\|\|\s*['"]([^'"]*)['"]\s*$/);
  if (fallback) return fallback[1];

  // size on the root <svg> is the caller's, and the <use> supplies it here
  if (attr === 'width' || attr === 'height') return null;

  unresolved.push(`${attr}={${e.length > 60 ? e.slice(0, 60) + '…' : e}}`);
  return null;
}

/* JSX children that are expressions, not markup. The logo interpolates the
   tenant's own label — `APP_LOGO.getLogoText().en`, which is 'KSA' for bayut
   (tenant/bayut/constants/constants.js:44), so the wordmark reads "Profolio KSA". */
const TEXT_CHILD = { 'props.text': 'KSA' };

/**
 * Literal colour defaults in a component's own signature, e.g.
 * `({ color = '#28B16D', ... })`. That default is the product's intent — the
 * classified-link icon is green wherever it appears — so it must win over
 * `currentColor`, which would let it inherit whatever the parent happens to be.
 * Read from the component body, not the <svg> block: by then the signature is
 * already behind us.
 */
function colourDefaults(body) {
  const params = body.match(/\(\s*\{([^}]*)\}/)?.[1] || '';
  const out = {};
  for (const m of params.matchAll(/(\w+)\s*=\s*'(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))'/g))
    out[m[1]] = m[2];
  return out;
}

function toSvg(jsx, name, unresolved, defaults = {}) {

  // 1 — spreads carry no paint information
  let s = jsx.replace(/\{\s*\.\.\.\w+\s*\}/g, '');

  // 1b — expression children, e.g. <text>{props.text}</text>
  s = s.replace(/\{\s*([\w.]+)\s*\}/g, (full, expr) =>
    Object.prototype.hasOwnProperty.call(TEXT_CHILD, expr) ? TEXT_CHILD[expr] : full);

  // 2 — walk every `attr={ … }`, brace-balanced, and resolve it
  let out = '', i = 0;
  const re = /([\w:-]+)=\{/g;
  let m;
  while ((m = re.exec(s))) {
    const [full, attr] = m;
    let depth = 1, j = m.index + full.length;
    // scan to the matching brace, skipping over strings and template literals
    while (j < s.length && depth) {
      const c = s[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '"' || c === "'" || c === '`') {
        const q = c; j++;
        while (j < s.length && s[j] !== q) j += s[j] === '\\' ? 2 : 1;
      }
      j++;
    }
    const expr = s.slice(m.index + full.length, j - 1);
    const value = resolveExpr(attr, expr, unresolved, defaults);
    /* a resolver may rename the attribute — a painting `style` becomes the
       `fill` or `stroke` it was setting */
    const emit = value === null ? ''
      : (typeof value === 'object' ? `${value.asAttr}="${value.value}"` : `${attr}="${value}"`);
    out += s.slice(i, m.index) + emit;
    i = j;
    re.lastIndex = j;
  }
  s = out + s.slice(i);

  // 3 — width/height belong to the <use>, not the symbol, but only on the root
  //     tag: nested elements need theirs
  s = s.replace(/^<svg\b[^>]*>/, (tag) => tag.replace(/\s(?:width|height)="[^"]*"/g, ''));
  s = s.replace(/\s(?:xmlns|xmlnsXlink)="[^"]*"/g, '');

  // 4 — camelCase → SVG attribute names
  for (const [from, to] of Object.entries(ATTR)) {
    if (from !== to) s = s.replace(new RegExp(`\\s${from}=`, 'g'), ` ${to}=`);
  }

  // 5 — ids are global once every icon shares one document, so namespace them
  s = s.replace(/\bid="([^"]+)"/g, (_, id) => `id="${name}__${id}"`);
  s = s.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${name}__${id})`);

  return s.replace(/\s+\n/g, '\n').replace(/\n\s*\n/g, '\n').trim();
}

/** Pull the <svg>…</svg> block out of a component body, matching nesting. */
function extractSvg(body) {
  const start = body.indexOf('<svg');
  if (start < 0) return null;
  let depth = 0, i = start;
  while (i < body.length) {
    if (body.startsWith('<svg', i)) { depth++; i += 4; continue; }
    if (body.startsWith('</svg>', i)) { depth--; i += 6; if (!depth) return body.slice(start, i); continue; }
    i++;
  }
  return null;
}

/* ── 1 · local icons ───────────────────────────────────────────────────── */
const svgSrc = readFileSync(join(REPO, 'src/components/svg.js'), 'utf8');
const blocks = new Map();
{
  const re = /^export const (\w+)\s*=/gm;
  const hits = [...svgSrc.matchAll(re)];
  hits.forEach((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : svgSrc.length;
    blocks.set(m[1], svgSrc.slice(m.index, end));
  });
}

const symbols = [];
const inlineArt = [];      /* art that cannot travel through <use> — see below */
const missing = [];
const suspect = [];
const unresolved = [];

for (const [name, use] of Object.entries(WANTED)) {
  const body = blocks.get(name);
  if (!body) { missing.push(`${name} (local)`); continue; }
  const raw = extractSvg(body);
  if (!raw) { missing.push(`${name} (no <svg> in body)`); continue; }

  const before = unresolved.length;
  const svg = toSvg(raw, name, unresolved, colourDefaults(body));
  if (unresolved.length > before) suspect.push(`${name}: ${unresolved.slice(before).join(', ')}`);
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) { missing.push(`${name} (no viewBox)`); continue; }
  if (/\{|\}/.test(svg)) suspect.push(`${name}: JSX braces survived`);

  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').trim();

  /* A <mask> or <filter> inside a <symbol> does not survive instancing through
     <use>: the reference resolves against the sprite's own zero-size,
     overflow-hidden viewport and the masked group paints nothing. The brand
     wordmark is the one asset here that uses one. It is also used once per page
     rather than many times, so it loses nothing by being written out as
     ready-to-inline markup instead. */
  if (/<(mask|filter)\b/.test(inner)) {
    /* Strip the mask. These are Figma export artefacts that crop the art to a
       rectangle it already fits inside, so removing one changes nothing you can
       see — and keeping one costs you the whole glyph, because a mask stops
       resolving once the art is instanced or the document carries a stylesheet.
       Verified on the brand wordmark: identical with and without, in isolation;
       blank with it, correct without it, on the page. If a future icon's mask
       is load-bearing, the proof sheet will show it. */
    const unmasked = inner
      .replace(/<mask[\s\S]*?<\/mask>\s*/g, '')
      .replace(/\s*mask="url\(#[^)]*\)"/g, '');
    inlineArt.push({ name, use, viewBox, masked: inner !== unmasked, markup:
      `<svg class="pf-${name.toLowerCase()}" width="${viewBox.split(' ')[2]}" ` +
      `height="${viewBox.split(' ')[3]}" viewBox="${viewBox}" role="img" aria-label="${use}">\n` +
      unmasked.split('\n').filter((l) => l.trim()).map((l) => '  ' + l.trim()).join('\n') + `\n</svg>` });
    continue;
  }

  symbols.push(
    `  <!-- ${use} · src/components/svg.js -->\n` +
    `  <symbol id="pf-${name}" viewBox="${viewBox}">\n` +
    inner.split('\n').map((l) => '    ' + l.trim()).join('\n') +
    `\n  </symbol>`
  );
}

/* ── 2 · react-icons ───────────────────────────────────────────────────── */
/* react-icons ships each set as a data module: an exported function whose body
   carries {tag, attr, child} trees. Reading the tree is stable across v4 and
   v5; rendering it needs no React. */
/* A prefix can span more than one set — `IoMd*`/`IoIos*` are ionicons 4 (`io`)
   while plain `Io*` is ionicons 5 (`io5`), and both ship under the same prefix.
   Each entry is tried in order. */
const PREFIX_TO_SET = {
  Md: ['md'], Fi: ['fi'], Io: ['io5', 'io'], Bs: ['bs'], Hi: ['hi', 'hi2'],
  Ti: ['ti'], Pi: ['pi'], Go: ['go'], Bi: ['bi'], Ai: ['ai'], Ri: ['ri'],
  Fa: ['fa', 'fa6'], Gr: ['gr'], Cg: ['cg'], Im: ['im'], Si: ['si'], Tb: ['tb'],
  Vsc: ['vsc'],
};
/* Read the package off disk rather than importing it: its `exports` map hides
   the per-set entry points from require.resolve, and we only want the data. */
const RI = join(ROOT, 'node_modules', 'react-icons');
const reactIconsAvailable = existsSync(RI);

if (reactIconsAvailable) {
  const cache = new Map();

  const loadSet = (set) => {
    if (cache.has(set)) return cache.get(set);
    let src = '';
    for (const f of ['index.mjs', 'index.js', 'index.esm.js']) {
      const p = join(RI, set, f);
      if (existsSync(p)) { src = readFileSync(p, 'utf8'); break; }
    }
    cache.set(set, src);
    return src;
  };

  const render = (node) => {
    const attrs = Object.entries(node.attr || {})
      .map(([k, v]) => ` ${ATTR[k] || k}="${v}"`).join('');
    const kids = (node.child || []).map(render).join('');
    return kids ? `<${node.tag}${attrs}>${kids}</${node.tag}>` : `<${node.tag}${attrs}/>`;
  };

  for (const [name, use] of Object.entries(REACT_ICONS)) {
    /* the prefix is the leading capital run, not always two letters: `Vsc*` is
       vscode-icons and `Md*` is material, and slicing a fixed 2 sent VscSettings
       looking in a set called `Vs` that does not exist */
    const prefix = (name.match(/^[A-Z][a-z]*/) || [''])[0];
    const sets = PREFIX_TO_SET[prefix] || PREFIX_TO_SET[name.slice(0, 2)] || [];
    // each icon is `export function Name (props) { return GenIcon({…})(props); }`
    const pattern = new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{\\s*return GenIcon\\((\\{.*?\\})\\)\\(props\\)`);
    let m = null, set = null;
    for (const s_ of sets) { m = loadSet(s_).match(pattern); if (m) { set = s_; break; } }
    if (!m) { missing.push(`${name} (react-icons/${sets.join('|') || '?'})`); continue; }
    let tree;
    try { tree = new Function(`return (${m[1]})`)(); }
    catch { missing.push(`${name} (unparseable)`); continue; }
    const viewBox = tree?.attr?.viewBox;
    if (!viewBox) { missing.push(`${name} (no viewBox)`); continue; }
    /* Two layers of attributes live on the <svg>, not on the paths, and both
       have to come across or the glyph paints wrong:
         · IconBase's defaults — fill, stroke, stroke-width 0
         · the icon set's own — Feather, for one, sets fill:none and
           stroke-width:2 there, so dropping it renders a filled blob
       The set's values win, exactly as they do at runtime. */
    const svgAttrs = { fill: 'currentColor', stroke: 'currentColor', strokeWidth: '0', ...tree.attr };
    delete svgAttrs.viewBox;
    const attrStr = Object.entries(svgAttrs)
      .map(([k, v]) => ` ${ATTR[k] || k}="${v}"`).join('');
    symbols.push(
      `  <!-- ${use} · react-icons/${set} -->\n` +
      `  <symbol id="pf-${name}" viewBox="${viewBox}"${attrStr}>\n` +
      `    ${(tree.child || []).map(render).join('')}\n` +
      `  </symbol>`
    );
  }
} else {
  for (const name of Object.keys(REACT_ICONS)) missing.push(`${name} (react-icons not installed)`);
}

/* ── 2b · antd's own icons ──────────────────────────────────────────────── */
/* The Select arrow and the Pagination chevrons are antd's, not the product's:
   @ant-design/icons-svg ships each as a data module with the same {tag, attrs,
   children} shape react-icons uses. antd renders them at 1em with fill
   currentColor. */
const ANTD_ICONS = {
  DownOutlined: 'Select arrow',
  LeftOutlined: 'Pagination previous',
  RightOutlined: 'Pagination next',
};
const ASN = join(ROOT, 'node_modules', '@ant-design', 'icons-svg', 'es', 'asn');
if (existsSync(ASN)) {
  const renderAnt = (node) => {
    const attrs = Object.entries(node.attrs || {}).map(([k, v]) => ` ${k}="${v}"`).join('');
    const kids = (node.children || []).map(renderAnt).join('');
    return kids ? `<${node.tag}${attrs}>${kids}</${node.tag}>` : `<${node.tag}${attrs}/>`;
  };
  for (const [name, use] of Object.entries(ANTD_ICONS)) {
    const file = join(ASN, `${name}.js`);
    if (!existsSync(file)) { missing.push(`${name} (@ant-design/icons-svg)`); continue; }
    const m = readFileSync(file, 'utf8').match(/=\s*(\{[\s\S]*?\});\s*\n/);
    let icon; try { icon = new Function(`return (${m[1]})`)().icon; } catch { missing.push(`${name} (unparseable)`); continue; }
    symbols.push(
      `  <!-- ${use} · @ant-design/icons-svg -->\n` +
      `  <symbol id="pf-${name}" viewBox="${icon.attrs.viewBox}" fill="currentColor">\n` +
      `    ${(icon.children || []).map(renderAnt).join('')}\n` +
      `  </symbol>`
    );
  }
} else {
  for (const name of Object.keys(ANTD_ICONS)) missing.push(`${name} (@ant-design/icons-svg not installed)`);
}

/* ── 3 · write ─────────────────────────────────────────────────────────── */
const out = `<!-- GENERATED by scripts/icons.mjs — do not edit.
     ${symbols.length} real icons from the Profolio codebase.
     Local icons: src/components/svg.js. The rest: react-icons, resolved the
     same way components/common/icon/icon.js resolves them at runtime.
     Reference one with <svg class="i"><use href="#pf-Name"/></svg>. -->
<svg class="pf-sprite" aria-hidden="true" focusable="false"><defs>
${symbols.join('\n')}
</defs></svg>
`;
mkdirSync(join(ROOT, 'deliverables'), { recursive: true });
writeFileSync(join(ROOT, 'deliverables', 'sprite.svg'), out);

if (inlineArt.length) {
  writeFileSync(join(ROOT, 'deliverables', 'inline-art.html'),
`<!-- GENERATED by scripts/icons.mjs — do not edit.
     Art that carries a <mask> or <filter>. Those do not survive instancing
     through <use>, so paste these in directly where they are needed rather
     than referencing them from the sprite. -->
${inlineArt.map((a) => `\n<!-- ${a.use} -->\n${a.markup}`).join('\n')}
`);
}

console.log(`  deliverables/sprite.svg — ${symbols.length} symbols, ${(out.length / 1024).toFixed(0)}KB`);
if (inlineArt.length)
  console.log(`  deliverables/inline-art.html — ${inlineArt.length} masked: ${inlineArt.map((a) => a.name).join(', ')}`);
if (suspect.length) {
  console.log(`  ! ${suspect.length} attribute(s) dropped as unresolvable — check these glyphs:`);
  for (const w of suspect) console.log(`      ${w}`);
}
if (missing.length) {
  console.log(`  ! ${missing.length} not extracted:`);
  for (const m of missing) console.log(`      ${m}`);
  if (!reactIconsAvailable) console.log(`    run:  npm i -D react-icons   then re-run this script`);
}
