/**
 * Reading STRUCTURE out of a capture.
 *
 * A capture records geometry, an allow-list of computed styles and class
 * names — and deliberately no text. Everything this design system knows about
 * whether a thing matches the product is therefore a statement about shape:
 * how tall the bands inside it are, where its content starts, what it is made
 * of. These are the functions that answer those questions, shared by the
 * overlay comparator and the page-body comparator so that both mean exactly
 * the same thing by "a band".
 */
import { readFileSync } from 'node:fs';

export const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
export const classes = (n) => n.class || [];
export const findAll = (n, re, out = []) => {
  if (classes(n).some((c) => re.test(c))) out.push(n);
  (n.children || []).forEach((k) => findAll(k, re, out));
  return out;
};
/* the biggest match wins: a page can carry a hidden second popover, and the
   one that was open is the one with area */
export const find = (tree, re) => findAll(tree, re).sort((a, b) => (b.box?.w * b.box?.h || 0) - (a.box?.w * a.box?.h || 0))[0];

/**
 * The horizontal bands inside an overlay.
 *
 * Descend while a node has exactly one child that fills it — those are
 * wrappers, not structure — then take the children that stack vertically and
 * record their heights. That is the shape a designer sees: a header, five
 * rows, a footer.
 */
export function bands(root) {
  /* An absolutely-positioned child is not a band: antd's modal close button is
     a 32px box floating over the header, and counting it made every modal read
     as one band short. Same for our own overlays, where the close sits inside
     the header instead. */
  const flow = (n) => (n.children || []).filter((k) => k.box && k.box.h > 0 && k.box.w > 0
    && k.style?.position !== 'absolute' && k.style?.position !== 'fixed');

  let n = root;
  for (let i = 0; i < 6; i++) {
    const kids = flow(n);
    if (kids.length !== 1) break;
    if (kids[0].box.h < (n.box?.h || 0) - 2) break;      /* a real child, not a wrapper */
    n = kids[0];
  }
  const kids = flow(n);
  /* A text-only overlay — a one-line tooltip, an "Expiring on" popover — is
     one band, and the band is the TEXT, not the box: compare 22 against 22
     rather than our padded 54 against their unpadded 22. */
  if (!kids.length) {
    if (!n.box?.h) return [];
    const px = (v) => parseFloat(v) || 0;
    return [Math.round(n.box.h - px(n.style?.paddingTop) - px(n.style?.paddingBottom))];
  }
  /* if the one level down is a list, its items are the bands */
  if (kids.length === 1 && flow(kids[0]).length > 1) {
    const inner = flow(kids[0]);
    if (inner.length > kids.length) return inner.map((k) => Math.round(k.box.h));
  }
  return kids.map((k) => Math.round(k.box.h));
}

/** where content starts inside the overlay — a 16 that should be a 24 */
export function inset(root) {
  const O = root.box;
  let best = null;
  const walk = (n, d = 0) => {
    if (d > 4) return;
    const b = n.box;
    /* an absolutely-positioned child is not content — the arrow sits at 50%
       and made a 16px inset read as 86 */
    if (n.style?.position === 'absolute' || n.style?.position === 'fixed') return;
    if (b && b.w > 0 && b.h > 0 && b.w < O.w - 4) {
      const dx = Math.round(b.x - O.x);
      if (dx > 0 && (best === null || dx < best)) best = dx;
    }
    (n.children || []).forEach((k) => walk(k, d + 1));
  };
  walk(root);
  return best;
}

/** what the overlay is made of, by tag and role */
/* Classify by ROLE, not by tag. Two conventions in this prototype are
   deliberate and would otherwise read as defects on every overlay:
     a navigation is an <a href="not-built.html">, where the product uses a
       Button with an onClick
     a select is a <button class="pf-select"> that opens a listbox, where antd
       renders a div wrapping a search <input>
     a listbox option is a <button role="option">, where antd uses a div
   So a select trigger counts as a FIELD and an option counts as neither. */
export function parts(root) {
  const t = { button: 0, link: 0, input: 0, icon: 0, text: 0 };
  const walk = (n) => {
    const b = n.box;
    const cls = classes(n);
    if (b && b.w > 0 && b.h > 0) {
      /* the close control is not counted on either side. antd gives a modal a
         <button> and a drawer a clickable icon in its extra slot; ours is a
         button in both, and counting it made the filters drawer read one
         control over while matching it exactly. */
      if (cls.some((c) => /(^|-)(overlay|modal|drawer)-close/.test(c))) { /* chrome, not content */ }
      else if (cls.includes('pf-select') || cls.includes('ant-select-selector')) t.input++;
      /* A segmented control, a product pill and a wizard choice are all
         antd Radio in the product — which renders a real <input> inside a
         label — and a <button role=radio> here. Counting ours as buttons made
         Reports Summary read 12 buttons against 1 and 0 inputs against 5,
         which is one convention, not five missing controls. */
      else if (n.attrs?.role === 'radio' || n.attrs?.role === 'tab'
               || cls.some((c) => /^(pf-segment|pf-pill|pf-choice|pf-metric)$/.test(c))
               || cls.some((c) => /^ant-(radio-button|segmented-item|tabs-tab)$/.test(c))) t.input++;
      else if (n.attrs?.role === 'option' || cls.some((c) => /select-item-option$/.test(c)) || cls.includes('pf-listbox-option')) { /* an option is not a control */ }
      else if (n.tag === 'button') t.button++;
      /* A navigation is an <a href="not-built.html"> in this prototype where
         the product uses a Button with an onClick — the convention already
         stated for overlays. Counting them as links made Listings read 35
         links against the product's 2 while the controls matched. */
      else if (n.tag === 'a') { if (/not-built\.html/.test(n.attrs?.href || '')) t.button++; else t.link++; }
      else if (n.tag === 'input' || n.tag === 'textarea') t.input++;
      else if (n.tag === 'svg' || classes(n).some((c) => /anticon|^i$/.test(c))) t.icon++;
      else if (!(n.children || []).length) t.text++;
    }
    (n.children || []).forEach(walk);
  };
  walk(root);
  return t;
}

