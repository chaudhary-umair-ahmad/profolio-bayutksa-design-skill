/* ═══════════════════════════════════════════════════════════════════════════
   PROFOLIO KSA — LIVE PROBE
   ═══════════════════════════════════════════════════════════════════════════

   Paste this whole file into the devtools console on a live Profolio screen.
   It copies a JSON blob to your clipboard. Save that as

       references/live/<route>.live.probe.json

   and run  `node scripts/reconcile.mjs`  to fold it into the design system.

   It also runs on deliverables/dashboard.html — every target carries a second
   selector for our reproduction. Probe both sides and
   `node scripts/reconcile.mjs --diff` reports, property by property, where they
   disagree. That is what turns "about 75%" into a list you can work through.

   WHAT IT READS
     Layout and computed style only — box sizes, padding, colours, font
     metrics, and the font families the browser actually resolved. It never
     reads text content, values, names, ids or anything you can see on the
     screen, so nothing about the account leaves the browser. Open the JSON
     before you send it; it is short enough to read.

   WHY IT EXISTS
     A handful of values are not in the codebase at any level: the chart's
     painted canvas height, the antd Progress stroke width, the listing row
     height, and the third-party FEEDBACK widget. They only exist once a
     browser has laid the page out.

   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  /* Each entry: a label, the selector on the LIVE app, the selector on our
     reproduction, and the properties worth capturing.

     Two selectors, not one, on purpose. Run this on live and you get the truth;
     run it on deliverables/dashboard.html and you get what we built. Feed both
     to scripts/reconcile.mjs and it diffs them property by property, which is
     how "about 75%" turns into a list of specific numbers that disagree.

     Keep this list short — a probe nobody reads is a probe nobody trusts. */
  const TARGETS = [
    ['shell.sider',      '.ant-layout-sider',            '.pf-rail',            ['width', 'paddingInline', 'boxShadow', 'borderInlineEndColor', 'backgroundColor']],
    ['shell.header',     '.ant-layout-header',           '.pf-header',          ['height', 'paddingInlineStart', 'paddingInlineEnd', 'paddingBlock', 'backgroundColor']],
    ['shell.content',    '.ant-layout-content > *',      '.pf-content',         ['padding', 'maxWidth', 'gap']],
    ['shell.footer',     '.admin-footer',                '.pf-footer',          ['padding', 'backgroundColor', 'color', 'fontSize', 'boxShadow']],
    ['nav.item',         '.ant-menu-item',               '.pf-rail-item',       ['height', 'width', 'paddingInline', 'borderRadius', 'fontWeight', 'color']],
    ['nav.selected',     '.ant-menu-item-selected',      '.pf-rail-item[aria-current]', ['backgroundColor', 'color', 'fontWeight']],
    ['card',             '.ant-card',                    '.pf-card',            ['borderRadius', 'borderColor', 'borderWidth', 'boxShadow', 'backgroundColor']],
    ['card.head',        '.ant-card-head',               '.pf-card-head',       ['minHeight', 'padding', 'borderBlockEndColor']],
    ['card.body',        '.ant-card-body',               '.pf-card-body',       ['padding']],
    ['card.title',       '.ant-card-head-title',         '.pf-card-title',      ['fontSize', 'fontWeight', 'color']],
    ['stat.title',       '.ant-statistic-title',         '.pf-stat-title',      ['fontSize', 'color', 'marginBlockEnd', 'fontWeight']],
    ['stat.value',       '.ant-statistic-content',       '.pf-stat-value',      ['fontSize', 'fontWeight', 'color', 'lineHeight']],
    ['stat.leader',      '.ant-statistic-content',       '.pf-stat[data-emphasis="leader"] .pf-stat-value', ['fontSize', 'fontWeight']],
    ['divider.vertical', '.ant-divider-vertical',        '.pf-divider[data-orientation="vertical"]', ['borderInlineStartColor', 'height']],
    ['progress.track',   '.ant-progress-inner',          '.pf-credit-meter',    ['height', 'backgroundColor', 'borderRadius']],
    ['badge',            '.ant-badge-count',             '.pf-badge',           ['height', 'minWidth', 'fontSize', 'backgroundColor', 'borderRadius', 'lineHeight']],
    ['segmented',        '.ant-segmented',               '.pf-segmented',       ['padding', 'backgroundColor', 'borderColor', 'borderRadius']],
    ['segmented.item',   '.ant-segmented-item-label',    '.pf-segmented-item',  ['minHeight', 'lineHeight', 'paddingInline', 'fontSize', 'fontWeight']],
    ['tab',              '.ant-tabs-tab',                '.pf-metric-tab',      ['padding', 'minWidth', 'backgroundColor']],
    ['tab.active',       '.ant-tabs-tab-active',         '.pf-metric-tab[aria-selected="true"]', ['background', 'boxShadow']],
    ['chip',             '.ant-radio-wrapper',           '.pf-chip',            ['borderRadius', 'lineHeight', 'paddingInline', 'fontSize', 'backgroundColor']],
    ['chip.checked',     '.ant-radio-wrapper-checked',   '.pf-chip[aria-checked="true"]', ['backgroundColor', 'borderColor', 'color', 'fontWeight']],
    ['chart',            'canvas',                       '.pf-chart svg',       ['width', 'height']],
    ['table.head',       '.ant-table-thead th',          '.pf-table th',        ['padding', 'backgroundColor', 'color', 'fontWeight', 'fontSize']],
    ['table.cell',       '.ant-table-tbody td',          '.pf-table td',        ['padding', 'borderBlockEndColor', 'fontSize']],
    ['table.row',        '.ant-table-tbody tr',          '.pf-table tbody tr',  ['height']],
    ['listing.thumb',    '.col-property img',            '.pf-listing-thumb',   ['width', 'height', 'borderRadius', 'objectFit']],
    ['tag',              '.ant-tag',                     '.pf-status-pill',     ['borderRadius', 'lineHeight', 'paddingInline', 'fontSize', 'fontWeight', 'backgroundColor', 'color']],
    ['input.date',       '.dateFilter, .ant-input-affix-wrapper', '.pf-datepicker', ['height', 'paddingInline', 'borderColor', 'borderRadius', 'minWidth']],
    ['btn.primary',      '.ant-btn-primary',             '.pf-btn[data-variant="primary"]', ['height', 'padding', 'borderRadius', 'fontSize', 'fontWeight', 'backgroundColor']],
    ['btn.outlined',     '.ant-btn',                     '.pf-btn[data-variant="primary-outlined"]', ['height', 'borderColor', 'backgroundColor', 'color']],
    ['alert',            '.ant-card',                    '.pf-alert',           ['backgroundColor', 'borderColor', 'borderRadius', 'padding', 'boxShadow']],
    ['feedback',         '[class*="feedback" i], [id*="feedback" i]', '.pf-feedback-tab', ['width', 'height', 'backgroundColor', 'insetInlineEnd', 'writingMode', 'borderRadius']],
  ];

  const px = (v) => (typeof v === 'string' ? v : String(v));

  const measure = ([label, liveSel, oursSel, props]) => {
    const el = document.querySelector(liveSel) || document.querySelector(oursSel);
    if (!el) return [label, { missing: `${liveSel} | ${oursSel}` }];
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const out = { box: { w: Math.round(r.width), h: Math.round(r.height) } };
    for (const p of props) {
      const v = cs[p];
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') out[p] = px(v);
    }
    return [label, out];
  };

  /* Which faces the browser actually resolved, and at which weights. This is
     the one question that changes every glyph on the page. */
  const fonts = {
    bodyStack: getComputedStyle(document.body).fontFamily,
    loaded: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style} ${f.status}`),
    synthesised: [300, 400, 500, 600, 700, 800, 900]
      .filter((w) => !document.fonts.check(`${w} 14px Lato`)),
  };

  /* The colours the product resolves at runtime rather than declaring. */
  const runtime = {};
  const ring = document.querySelector('.ant-progress-circle-path');
  if (ring) runtime.classificationStroke = getComputedStyle(ring).stroke;
  const line = document.querySelector('.ant-tabs-ink-bar');
  if (line) runtime.brandColor = getComputedStyle(line).backgroundColor;

  /* Which side of the comparison this is, so reconcile.mjs never mixes them up. */
  const side = document.querySelector('.ant-layout') ? 'live'
             : document.querySelector('.pf-shell') ? 'ours'
             : 'unknown';

  const payload = {
    probe: 1,
    side,
    route: location.pathname,
    capturedAt: new Date().toISOString(),
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    fonts,
    runtime,
    targets: Object.fromEntries(TARGETS.map(measure)),
  };

  const json = JSON.stringify(payload, null, 2);
  const found = Object.values(payload.targets).filter((t) => !t.missing).length;

  const done = () => {
    console.log(
      `%c Profolio probe %c ${side}  ·  ${found}/${TARGETS.length} targets  ·  ${(json.length / 1024).toFixed(1)}KB copied `,
      'background:#006169;color:#fff;font-weight:700;padding:2px 6px;border-radius:3px 0 0 3px',
      'background:#E1F2F0;color:#006169;padding:2px 6px;border-radius:0 3px 3px 0'
    );
    const absent = Object.entries(payload.targets).filter(([, v]) => v.missing).map(([k]) => k);
    if (absent.length) console.log('not on this screen:', absent.join(', '));
    const slug = location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'root';
    console.log(`save as references/live/${slug}.${side}.probe.json`);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(done, () => { console.log(json); done(); });
  } else {
    console.log(json);
    done();
  }
  return payload;
})();
