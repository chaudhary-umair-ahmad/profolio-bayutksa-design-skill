#!/usr/bin/env node
/**
 * The user-settings family: one generator, four pages.
 *
 * They share a skeleton — a 336-wide left column carrying the settings nav and
 * the profile-completion card, and a 1007-wide right column carrying a header
 * card and a form card — so they are one generator with a config each rather
 * than four hand-written files. That is the lesson from dashboard.html, which
 * was hand-written and drifted into an eleven-item rail nobody noticed.
 *
 *   node scripts/pages/settings.mjs            every page
 *   node scripts/pages/settings.mjs user-profile
 *
 * WHERE THE NUMBERS COME FROM
 * Geometry is measured from data/live/user-settings-*.capture.json:
 *
 *   left column   336 wide · nav card 326x256 with a 284x222 list at 26,17
 *                 profile card 326x240
 *   right column  1007 wide · header card 997x152 · form card 997x1373
 *   the form      835 wide, a two-column grid: columns 390, gutter 54,
 *                 row pitch 98, and a field is a 22 label over a 44 control
 *                 with 8 between them
 *
 * Labels and field types are read from src/tenant/bayut/data/profileFields.js.
 * The ORDER is transcribed from the capture, because a capture records where
 * things are and never what they say — the three selects at the end of the
 * form are `profileCompletionfields`, the inputs before them `basicFields`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, close, icon, esc } from './shell.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const cfg = read('data/fixtures/settings.json');

/* the settings sub-nav, from getUserSettingsRoutes() in appRoutes.js — the
   same six entries in the same order, and each one is a real link */
const NAV = cfg.nav;

const navCard = (current) => `        <section class="pf-card pf-settings-nav">
          <nav aria-label="Settings">
            <ul>
${NAV.map((n) => `              <li><a href="${n.page || `not-built.html?screen=${encodeURIComponent(n.label)}`}"${n.label === current ? ' aria-current="page"' : ''}>${icon(n.icon, 16)}<span>${esc(n.label)}</span></a></li>`).join('\n')}
            </ul>
          </nav>
        </section>`;

/* the completion card — a 36-tall title row with a link button, a 22-tall
   progress row, and a 112-tall block of one link and two mini cards */
const completionCard = `        <section class="pf-card pf-completion">
          <div class="pf-completion-head">
            <span class="pf-completion-title">Profile Completion</span>
            <a class="pf-btn" data-variant="link" data-size="small" href="not-built.html?screen=${encodeURIComponent('Profile Completion')}"><span>Complete Profile</span></a>
          </div>
          <div class="pf-completion-meter">
            <!-- the same .pf-credit-meter the dashboard's quota widget uses;
                 a second progress component would be a second truth -->
            <span class="pf-credit-meter fill-${cfg.completion}"></span>
            <span class="pf-completion-pct">${cfg.completion}%</span>
          </div>
          <div class="pf-completion-body">
            <a class="pf-btn" data-variant="primary" data-size="small" href="not-built.html?screen=${encodeURIComponent('TruBroker')}"><span>Become a TruBroker</span></a>
${cfg.badges.map((b) => `            <span class="pf-mini-card">${icon('PiSealCheckFill', 14)}${esc(b)}</span>`).join('\n')}
          </div>
        </section>`;

/* header card 997x152 — an avatar 74x68 and a 384x55 detail block */
const headerCard = (p) => `        <section class="pf-card pf-settings-head">
          <div class="pf-settings-meta">
            <span class="pf-settings-avatar">${icon('FiUser', 20)}</span>
            <div>
              <div class="pf-settings-name">${esc(cfg.user.name)}</div>
              <div class="pf-settings-sub">${esc(cfg.user.role)}${icon('GoDotFill', null)}<span>${esc(cfg.user.email)}</span></div>
            </div>
          </div>
        </section>`;

/* a field is a 22-tall label over a 44-tall control; `span` makes it 835 */
const field = (f, i) => {
  const id = `f-${i}`;
  const cls = ['pf-sfield', f.span ? 'span-all' : '', f.tall ? 'tall' : '', f.upload ? 'upload' : '', f.type === 'password' ? 'password' : ''].filter(Boolean).join(' ');
  /* a measured row height, where the product's differs from the 74 a label and
     a control come to — Agency Settings has a 118 and an 85 */
  const h = f.h ? ` style-h="${f.h}"` : '';
  const control = f.type === 'upload'
    /* the form's last row, 133 tall — an image-select (profileFields.js
       `profile_image`), not another input */
    ? `<div class="pf-upload"><span class="pf-upload-art" role="img" aria-label="Photo placeholder"></span><a class="pf-btn" data-variant="default" data-size="small" href="not-built.html?screen=${encodeURIComponent('Upload a picture')}"><span>${esc(f.placeholder)}</span></a></div>`
    : f.type === 'select'
    ? `<button class="pf-select" id="${id}" type="button" aria-haspopup="listbox"${f.disabled ? ' disabled' : ` data-open="listbox-settings" data-placement="bottom"`}><span class="pf-placeholder">${esc(f.placeholder)}</span><span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`
    : f.type === 'textarea'
      ? `<textarea class="pf-textarea" id="${id}" placeholder="${esc(f.placeholder)}"></textarea>`
      : `<span class="pf-input"><input id="${id}" type="text" placeholder="${esc(f.placeholder)}"${f.disabled ? ' disabled' : ''}><span class="pf-input-suffix"></span></span>`;
  return `            <div class="${cls}"${f.h ? ` data-h="${f.h}"` : ''}>
              <label class="pf-field-label" for="${id}">${esc(f.label)}</label>
              ${control}
            </div>`;
};

const pageHtml = (p) => {
  const comment = `<!-- ═══════════════════════════════════════════════════════════════════
     ${p.title.toUpperCase()} — scripts/pages/settings.mjs from data/fixtures/settings.json
     Measured against data/live/${p.route}.capture.json:
       left 336 · nav card 326x256 · completion card 326x240
       right 1007 · header card 997x152 · form card 997x${p.formCardH}
       form 835 wide, two 390 columns, 54 gutter, 98 row pitch
     Labels and types: src/tenant/bayut/data/profileFields.js
     ═══════════════════════════════════════════════════════════════════════ -->`;

  /* the one value on this page that is DATA rather than presentation */
  const instance = `.fill-${cfg.completion}{--meter-pct:${cfg.completion}}     /* profile completion */`;

  /* the HEADER title is the section's, not the sub-page's — measured 79 wide
     against our 123 when this said "User Settings" */
  return open({ title: 'Settings', current: 'Settings', docTitle: `${p.title} — Profolio KSA`, comment, instance, contentGap: 8 })
    + `      <div class="pf-settings-grid">
        <div class="pf-settings-side">
${navCard(p.title)}
${completionCard}
        </div>
        <div class="pf-settings-main">
${/* only the profile page carries a 997x152 header card; Agency Settings and
      Change Password go straight to their form card */ p.noHeaderCard ? '' : headerCard(p) + '\n'}
          <section class="pf-card pf-settings-form">
            <h5 class="pf-card-title">${esc(p.formTitle)}</h5>
            <form class="pf-form-grid"${p.cols ? ` data-cols="${p.cols}"` : ''}>
${p.fields.map(field).join('\n')}
            </form>
            <div class="pf-form-actions">
              <button class="pf-btn" data-size="large" type="button" data-noop="the form is not wired to a server in this page"><span>Cancel</span></button>
              <button class="pf-btn" data-variant="primary" data-size="large" type="button" data-noop="the form is not wired to a server in this page"><span>Save Changes</span></button>
            </div>
          </section>
        </div>
      </div>
`
    + close({
      overlays: `
<!-- one listbox for every select on the page, anchored to whichever opened it —
     245 wide, 11 of padding, options 223x38, measured on Listings' own selects -->
<div class="pf-listbox" id="listbox-settings" data-anchor="trigger" data-placement="bottom" role="listbox" aria-label="Options" hidden>
  <div class="pf-listbox-scroll">
${cfg.listbox.map((o, n) => `    <button class="pf-listbox-option" role="option" type="button"${n === 0 ? ' aria-selected="true"' : ''} data-close>${esc(o)}</button>`).join('\n')}
  </div>
</div>`,
    });
};

const want = process.argv[2];
for (const p of cfg.pages) {
  if (want && p.slug !== want) continue;
  const html = pageHtml(p);
  const out = join(ROOT, 'deliverables', `${p.slug}.html`);
  writeFileSync(out, html);
  console.log(`  deliverables/${p.slug}.html — ${p.fields.length} fields · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
}
