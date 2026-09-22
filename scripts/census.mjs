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
 *   data-open / data-close      an overlay
 *   data-panel / data-state-panel  a tab or a page state
 *   href that is not "#"        a link, including the stubs to not-built.html
 * Everything else is DEAD, and dead is the number the matrix exists to drive
 * down. `data-nav` is deliberately NOT reachable: prototype.js does not read
 * it, so a control carrying only that is dead however it looks.
 */

const TAGS = /<(button|a|input|select|textarea)\b([^>]*)>/g;

export function census(html) {
  const body = html.slice(Math.max(0, html.indexOf('<body'))).replace(/<!--[\s\S]*?-->/g, '');
  const out = { button: 0, a: 0, input: 0, select: 0, textarea: 0, reachable: 0, dead: 0, hashHref: 0 };
  let m;
  while ((m = TAGS.exec(body))) {
    const [, tag, attrs] = m;
    out[tag]++;
    const href = (/\shref="([^"]*)"/.exec(attrs) || [, null])[1];
    const wired = /\sdata-(open|close|panel|state-panel)="/.test(attrs);
    if (href === '#') out.hashHref++;
    if (wired || (href !== null && href !== '#')) out.reachable++;
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
