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
  RequestedStateIcon: 'upgrade requested',
  // upgrade services — tenant/bayut/data/products.js
  DroneIcon: 'Drone Footage (#79cdd1)',
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
  BsInfoLg: 'credits info',
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

/** Attributes that describe React, not paint — drop them wholesale. */
const DROP_ATTR = new Set(['width', 'height', 'style', 'className', 'key', 'onClick', 'xmlns', 'xmlnsXlink', 'ref']);

/**
 * Resolve one JSX attribute expression to a plain SVG value.
 * Returns a string to use, or null to drop the attribute entirely.
 * `unresolved` collects anything this does not understand, so a value is never
 * silently invented or silently lost.
 */
function resolveExpr(attr, expr, unresolved) {
  const e = expr.trim();

  if (DROP_ATTR.has(attr)) return null;

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

  unresolved.push(`${attr}={${e.length > 60 ? e.slice(0, 60) + '…' : e}}`);
  return null;
}

/* JSX children that are expressions, not markup. The logo interpolates the
   tenant's own label — `APP_LOGO.getLogoText().en`, which is 'KSA' for bayut
   (tenant/bayut/constants/constants.js:44), so the wordmark reads "Profolio KSA". */
const TEXT_CHILD = { 'props.text': 'KSA' };

function toSvg(jsx, name, unresolved) {
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
    const value = resolveExpr(attr, expr, unresolved);
    out += s.slice(i, m.index) + (value === null ? '' : `${attr}="${value}"`);
    i = j;
    re.lastIndex = j;
  }
  s = out + s.slice(i);

  // 3 — drop the literal width/height that sit alongside the viewBox
  s = s.replace(/(<svg\b[^>]*?)\s(?:width|height)="[^"]*"/g, '$1');
  s = s.replace(/(<svg\b[^>]*?)\s(?:width|height)="[^"]*"/g, '$1');
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
const missing = [];
const suspect = [];
const unresolved = [];

for (const [name, use] of Object.entries(WANTED)) {
  const body = blocks.get(name);
  if (!body) { missing.push(`${name} (local)`); continue; }
  const raw = extractSvg(body);
  if (!raw) { missing.push(`${name} (no <svg> in body)`); continue; }

  const before = unresolved.length;
  const svg = toSvg(raw, name, unresolved);
  if (unresolved.length > before) suspect.push(`${name}: ${unresolved.slice(before).join(', ')}`);
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) { missing.push(`${name} (no viewBox)`); continue; }
  if (/\{|\}/.test(svg)) suspect.push(`${name}: JSX braces survived`);

  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').trim();
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
    const sets = PREFIX_TO_SET[name.slice(0, 2)] || [];
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

console.log(`  deliverables/sprite.svg — ${symbols.length} symbols, ${(out.length / 1024).toFixed(0)}KB`);
if (suspect.length) {
  console.log(`  ! ${suspect.length} attribute(s) dropped as unresolvable — check these glyphs:`);
  for (const w of suspect) console.log(`      ${w}`);
}
if (missing.length) {
  console.log(`  ! ${missing.length} not extracted:`);
  for (const m of missing) console.log(`      ${m}`);
  if (!reactIconsAvailable) console.log(`    run:  npm i -D react-icons   then re-run this script`);
}
