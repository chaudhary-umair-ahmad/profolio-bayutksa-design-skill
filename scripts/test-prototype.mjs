#!/usr/bin/env node
/**
 * Walks the prototypes and asserts they actually work.
 *
 * A page can carry every overlay in its markup and still be dead: a trigger
 * that names an id nothing has, a close button outside the dialog, a tab whose
 * panel was never written. `check.mjs` catches the static half of that; this
 * catches the rest by doing what a reviewer does — clicking.
 *
 *   node scripts/test-prototype.mjs            every page with a prototype
 *   node scripts/test-prototype.mjs listings
 *
 * For every [data-open] on the page: click it, assert the target became
 * visible, close it with Escape, assert it went away and focus came back.
 * Then every tab, then every page state.
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = pkg;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = join(ROOT, 'deliverables');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const pages = args.length ? args : readdirSync(D)
  .filter((f) => f.endsWith('.html') && !/bundled|components|profolio-ksa|qa-|not-built|\.qa\./.test(f))
  .map((f) => f.replace('.html', ''));

const fails = [];
const ok = (m) => console.log(`    ok    ${m}`);
const bad = (m) => { fails.push(m); console.log(`    FAIL  ${m}`); };

const browser = await chromium.launch();

for (const name of pages) {
  const file = join(D, `${name}.html`);
  if (!existsSync(file)) { bad(`${name}.html missing`); continue; }
  console.log(`\n  ${name}.html`);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto('file://' + file);
  await page.waitForTimeout(400);

  /* ── overlays ─────────────────────────────────────────────────────── */
  /* one click per distinct target: ten rows carry the same two triggers */
  const seenIds = new Set();
  const triggers = (await page.$$eval('[data-open]', (els) =>
    els.map((e) => ({ id: e.getAttribute('data-open'), label: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24) }))))
    .filter((t) => !seenIds.has(t.id) && seenIds.add(t.id));
  if (!triggers.length) console.log('    (no overlays on this page)');

  for (const t of triggers) {
    const target = await page.$(`#${t.id}`);
    if (!target) { bad(`${t.label} → #${t.id} does not exist`); continue; }

    /* NESTED TRIGGERS. Some overlays are only reachable from inside another
       one — the date range opens from the booking modal's date field and from
       the filters drawer's Posted On, and both of those start closed. Clicking
       the first matching trigger therefore clicks an invisible element and
       waits thirty seconds for it. So: prefer a visible trigger, and if there
       is none, open whatever overlay the trigger sits in first. */
    let trigger = page.locator(`[data-open="${t.id}"]:visible`).first();
    if (!(await trigger.count())) {
      const parent = await page.evaluate((id) => {
        const el = document.querySelector(`[data-open="${id}"]`);
        const host = el && el.closest('.pf-mask, .pf-drawer, .pf-popover');
        return host ? host.id : null;
      }, t.id);
      if (!parent) { bad(`${t.label} → no visible trigger for #${t.id} and it sits in no overlay`); continue; }
      await page.locator(`[data-open="${parent}"]:visible`).first().click();
      await page.waitForTimeout(220);
      trigger = page.locator(`[data-open="${t.id}"]:visible`).first();
      if (!(await trigger.count())) { bad(`${t.label} → #${t.id}'s trigger is still not visible after opening #${parent}`); continue; }
    }

    await trigger.click();
    await page.waitForTimeout(220);
    let vis = await page.isVisible(`#${t.id}`);
    if (!vis) { bad(`${t.label} → #${t.id} did not open`); continue; }

    /* Focus must move into the overlay — but only where there is something to
       move to. A popover with nothing focusable in it (the empty notification
       centre) correctly leaves focus where it was; asserting otherwise would
       be testing my assumption rather than the product's behaviour. */
    const { inside, focusable } = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const f = el.querySelector('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
      return { inside: !!(document.activeElement && el.contains(document.activeElement)), focusable: !!f };
    }, t.id);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(220);
    vis = await page.isVisible(`#${t.id}`);
    if (vis) { bad(`${t.label} → #${t.id} did not close on Escape`); continue; }

    const returned = await page.evaluate((id) => {
      var els = document.querySelectorAll(`[data-open="${id}"]`);
      return Array.prototype.indexOf.call(els, document.activeElement) > -1;
    }, t.id);

    ok(`${t.label} → #${t.id} opens, Escape closes` +
       (!focusable ? ', nothing focusable inside (fine)' : inside ? ', focus enters' : ', BUT focus did not enter') +
       (returned ? ', focus returns' : focusable ? ', BUT focus did not return' : ''));
    if (focusable && !inside) bad(`${t.id}: focus did not move into the overlay`);
    if (focusable && !returned) bad(`${t.id}: focus did not return to the trigger`);

    /* Escape closes the TOPMOST overlay, so a nested one leaves its parent
       open and the next click lands on that parent's mask. Clear the stack. */
    for (let i = 0; i < 4 && await page.locator('.pf-mask:visible, .pf-drawer:visible, .pf-popover:visible').count(); i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
    }
  }

  /* ── tabs ─────────────────────────────────────────────────────────── */
  const tabs = await page.$$eval('[data-panel]', (els) => els.map((e) => e.getAttribute('data-panel')));
  for (const id of tabs) {
    await page.click(`[data-panel="${id}"]`);
    await page.waitForTimeout(150);
    const selected = await page.getAttribute(`[data-panel="${id}"]`, 'aria-selected');
    if (selected !== 'true') { bad(`tab ${id} did not become selected`); continue; }
    const panel = await page.$(`[data-panel-id="${id}"]`);
    if (panel && !(await panel.isVisible())) bad(`tab ${id} selected but its panel stayed hidden`);
    else ok(`tab ${id} selects${panel ? ' and shows its panel' : ' (no panel yet)'}`);
  }

  /* ── page states ──────────────────────────────────────────────────── */
  const states = await page.$$eval('[data-state-set]', (els) => els.map((e) => e.getAttribute('data-state-set')));
  for (const st of states) {
    await page.click(`[data-state-set="${st}"]`);
    await page.waitForTimeout(150);
    const shown = await page.isVisible(`[data-state-panel="${st}"]`);
    shown ? ok(`state ${st} shows`) : bad(`state ${st} did not show`);
  }

  if (errors.length) bad(`${errors.length} page error(s): ${[...new Set(errors)].slice(0, 2).join(' | ')}`);
  await page.context().close();
}

await browser.close();
console.log('');
if (fails.length) { console.log(`  ${fails.length} failure(s).`); process.exit(1); }
console.log('  Every trigger opens, closes and returns focus.');
