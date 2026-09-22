/**
 * What a capture is not allowed to contain, in one place.
 *
 * `tools/profolio-capture/capture.js` promises to record how a page looks and
 * never what it says. These are the rules that hold it to that, and they now
 * matter more than they did: a capture taken from the running product with a
 * fixture account could only ever leak invented data, but a capture taken from
 * a SingleFile of a REAL signed-in screen would leak a real one.
 *
 * scripts/test-capture.mjs asserts them over everything in data/live/.
 * scripts/measure-real.mjs asserts them before it writes anything at all.
 */

export const LEAKS = [
  /* the strings that appear on the screens we capture — any of them in the
     JSON means text escaped the walker */
  ['visible text', /Alfalw|Overview|Platinum|Riyadh|Jeddah|Listings|Credits/],
  ['a Bayut or REGA id', /\b(8[78]\d{6}|720\d{7})\b/],
  ['an href or src', /"(href|src|srcset|action)"\s*:/],
  ['a data-\\* attribute', /"data-[\w-]+"\s*:/],
  ['an element id', /"id"\s*:/],
  ['an email', /[\w.+-]+@[\w-]+\.\w+/],
  ['a phone number', /\+?9665\d{8}|\b05\d{8}\b/],
  ['a text or value field', /"(text|value|placeholder|title|alt|ariaLabel)"\s*:/],
];

/** A generated class name is noise at best and an identifier at worst. */
export const hashyClasses = (json) => {
  const classes = [...json.matchAll(/"class":\[([^\]]*)\]/g)]
    .flatMap((m) => m[1].split(','))
    .map((c) => c.replace(/"/g, ''));
  return { all: classes, hashy: classes.filter((c) => /^(css-|jsx-|sc-)|[0-9a-f]{6,}/i.test(c)) };
};

/**
 * @returns {string[]} one line per violation — empty means clean.
 * `icon` values are exempt: they are glyph names, and `pf-MdEmail` would
 * otherwise read as an email address.
 */
export function findLeaks(json) {
  const noIcons = json.replace(/"icon":"[^"]*"/g, '');
  const out = [];
  for (const [what, re] of LEAKS) {
    const m = noIcons.match(re);
    if (m) out.push(`contains ${what} — ${JSON.stringify(m[0]).slice(0, 60)}`);
  }
  const { hashy } = hashyClasses(json);
  if (hashy.length) out.push(`hashed class names survived: ${hashy.slice(0, 3).join(', ')}`);
  return out;
}
