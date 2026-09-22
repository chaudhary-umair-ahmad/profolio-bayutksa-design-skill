/**
 * The interactive census of a prototype page, in one place.
 *
 * `authoring/listings-buttons.md` is the audit matrix: one row per interactive
 * element the product renders. A matrix is only as good as the thing that
 * proves it is still complete, and the failure it has to catch is a control
 * nobody wrote down — a button added to the page that never got a row.
 *
 * So the matrix records this census, and scripts/check.mjs recomputes it. Add a
 * control to the page and the numbers stop matching until someone opens the
 * matrix and says what it is. That is the whole mechanism.
 *
 * REACHABLE means the prototype layer can actually do something with it:
 *   data-open / data-close         an overlay (data-close is a bare attribute)
 *   data-panel / data-state-panel  a tab or a page state
 *   data-state-set                the prototype bar's own state buttons
 *   data-tip                       a tooltip, which is a real product overlay
 *   href that is not "#"           a link, including the stubs to not-built.html
 *
 * DISABLED is a control the product itself disables — an applied upgrade
 * circle, Clear filters with no filter applied. It cannot be clicked in the
 * product either, so counting it as a dead click would be counting the
 * product's own behaviour as our gap.
 *
 * FIELD is an <input>, <select> or <textarea> with no target. A text box takes
 * typing; it is not a click that should lead somewhere.
 *
 * ACKNOWLEDGED is `data-noop="<why>"`: a control that cannot do anything in a
 * static page and says so — a pager that is a server round-trip, a "mark all
 * as read" that mutates data. Without this category those are indistinguishable
 * from the ones nobody has got to yet, and the dead count stops meaning
 * anything. A data-noop with no reason does not count; the reason is the point.
 *
 * Everything else is DEAD, and dead is the number the matrix exists to drive
 * to zero. `data-nav` is deliberately NOT reachable: prototype.js does not read
 * it, so a control carrying only that is dead however it looks.
 */

/* Naive on purpose: a regex, not a parser, so that this file has no
   dependencies and runs anywhere. The cost is that a `>` inside an attribute
   VALUE ends the tag as far as it is concerned. Keep angle brackets out of
   data-noop text and it is exact. */
const TAGS = /<(button|a|input|select|textarea)\b([^>]*)>/g;

export function census(html) {
  const body = html.slice(Math.max(0, html.indexOf('<body'))).replace(/<!--[\s\S]*?-->/g, '');
  const out = { button: 0, a: 0, input: 0, select: 0, textarea: 0, reachable: 0, disabled: 0, field: 0, acknowledged: 0, dead: 0, hashHref: 0 };
  let m;
  while ((m = TAGS.exec(body))) {
    const [, tag, attrs] = m;
    out[tag]++;
    const href = (/\shref="([^"]*)"/.exec(attrs) || [, null])[1];
    /* data-close carries no value, so the `="` a first draft matched never
       appeared and nine working close buttons counted as dead */
    const wired = /\sdata-(open|close|panel|state-panel|state-set|tip)(=|[\s/>]|$)/.test(attrs);
    const noop = /\sdata-noop="[^"]+"/.test(attrs);
    if (href === '#') out.hashHref++;
    if (wired || (href !== null && href !== '#')) out.reachable++;
    else if (/\sdisabled(=|[\s/>]|$)/.test(attrs)) out.disabled++;
    else if (noop) out.acknowledged++;
    else if (tag !== 'button' && tag !== 'a') out.field++;
    else out.dead++;
  }
  out.total = out.button + out.a + out.input + out.select + out.textarea;
  return out;
}

/** The fenced ```census block a matrix carries, parsed back into numbers. */
export function declaredCensus(md) {
  const block = /```census\n([\s\S]*?)```/.exec(md);
  if (!block) return null;
  const out = {};
  for (const line of block[1].split('\n')) {
    const m = /^(\w+)\s+(\d+)/.exec(line.trim());
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}
