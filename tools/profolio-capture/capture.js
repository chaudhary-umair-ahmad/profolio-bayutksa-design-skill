/**
 * Injected into the page when you press Capture.
 *
 * Records what the page looks like, never what it says. The allow-lists below
 * are the whole privacy story: an attribute or a style property that is not
 * named here does not leave the page, so adding a field is a deliberate act
 * rather than an oversight.
 *
 * Returns a plain object. background.js turns it into a download.
 */
(() => {
  /* ── what we keep ────────────────────────────────────────────────────── */

  /* Styles that decide how something looks. Deliberately excludes content
     properties, background-image (it can carry a signed URL) and anything
     that could hold text. */
  const STYLE = [
    'display', 'position', 'boxSizing', 'overflow',
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'marginTop', 'marginBottom', 'marginInlineStart', 'marginInlineEnd',
    'paddingTop', 'paddingBottom', 'paddingInlineStart', 'paddingInlineEnd',
    'borderTopWidth', 'borderBottomWidth', 'borderInlineStartWidth', 'borderInlineEndWidth',
    'borderTopColor', 'borderBottomColor', 'borderInlineStartColor', 'borderInlineEndColor',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
    'color', 'backgroundColor', 'opacity', 'boxShadow',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textAlign', 'textTransform', 'textDecorationLine', 'whiteSpace',
    'flexDirection', 'flexWrap', 'alignItems', 'justifyContent', 'gap',
    'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
    'writingMode', 'aspectRatio', 'zIndex', 'objectFit',
  ];

  /* A class name that looks generated tells us nothing and may encode an id. */
  const SAFE_CLASS = /^[a-z][a-z0-9-]*$/i;
  const HASHY = /^(css-|jsx-|sc-|_)|[0-9a-f]{6,}/i;

  const classesOf = (el) => {
    const raw = typeof el.className === 'string' ? el.className : '';
    return raw.trim().split(/\s+/)
      .filter((c) => c && SAFE_CLASS.test(c) && !HASHY.test(c))
      .slice(0, 8);
  };

  const box = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY),
      w: Math.round(r.width), h: Math.round(r.height),
    };
  };

  const styleOf = (el) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of STYLE) {
      const v = cs[p];
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        out[p] = v;
      }
    }
    return out;
  };

  /* ── the walk ────────────────────────────────────────────────────────── */

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'TITLE', 'HEAD']);
  const MAX_DEPTH = 18;
  const MAX_NODES = 4000;
  let nodes = 0;

  function walk(el, depth) {
    if (nodes >= MAX_NODES || depth > MAX_DEPTH || SKIP.has(el.tagName)) return null;
    const b = box(el);
    /* something with no area is not laid out, so it cannot be measured against */
    if (b.w === 0 && b.h === 0) return null;
    nodes++;

    const node = { tag: el.tagName.toLowerCase(), depth, box: b, style: styleOf(el) };
    const cls = classesOf(el);
    if (cls.length) node.class = cls;

    /* an <svg><use href="#icon"> tells us which glyph without telling us anything
       about the account, and it is the one href worth keeping */
    if (el.tagName === 'svg') {
      const use = el.querySelector('use');
      const href = use && (use.getAttribute('href') || use.getAttribute('xlink:href'));
      if (href && href.startsWith('#')) node.icon = href.slice(1);
      return node;   /* do not descend into icon internals */
    }

    const kids = [];
    for (const child of el.children) {
      const c = walk(child, depth + 1);
      if (c) kids.push(c);
    }
    if (kids.length) node.children = kids;
    return node;
  }

  /* ── fonts: the one question that changes every glyph ────────────────── */
  const stack = getComputedStyle(document.body).fontFamily;
  const family = (stack.split(',')[0] || '').replace(/["']/g, '').trim();
  const fonts = {
    bodyStack: stack,
    loaded: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style} ${f.status}`),
    synthesised: [300, 400, 500, 600, 700, 800, 900]
      .filter((w) => !document.fonts.check(`${w} 14px "${family}"`)),
  };

  const root = document.querySelector('.ant-layout') || document.body;

  /* walk first: an object literal evaluates its properties in order, so reading
     `nodes` alongside `tree` reports the count from before the walk ran */
  const tree = walk(root, 0);

  return {
    capture: 1,
    route: location.pathname,
    capturedAt: new Date().toISOString(),
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
                page: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight } },
    fonts,
    nodes,
    truncated: nodes >= MAX_NODES,
    tree,
  };
})();
