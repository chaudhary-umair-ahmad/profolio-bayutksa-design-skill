#!/usr/bin/env node
/**
 * The user-settings family: one generator, three pages.
 *
 * They share a left column — a 326-wide settings nav over a 326-wide profile
 * completeness card — and then they DIVERGE, which is the thing the first
 * version of this file got wrong. It assumed one right-hand shape (a header
 * card over a form card) and filled it with invented fields, and the region
 * diff could not see the difference because a region is a bounding box. The
 * product has three shapes:
 *
 *   profile   a 997x150 header card over a 997x1371 form card
 *   agency    ONE 997x902 card whose header, divider and form are inside it
 *   narrow    ONE 997x504 card holding a 500-wide centred column
 *
 *   node scripts/pages/settings.mjs            every page
 *   node scripts/pages/settings.mjs user-profile
 *
 * WHERE THE NUMBERS COME FROM — data/live/user-settings-*.capture.json, read
 * with scripts/outline.mjs:
 *
 *   left column   336 wide (326 card + antd's 5 of column padding each side)
 *                 nav card 326x256, list 284 wide, rows 38 with 8 between
 *                 completeness card 326x240, meter 235x8, steps 24 tall r10
 *   profile       form 835 wide, columns 390, gutter 54, pitch 98
 *   agency        form 880 wide, columns 413, gutter 54, pitch 100
 *   narrow        column 500 wide, fields 500x44, Confirm 191x40
 *
 * Labels, placeholders, types and which controls are disabled come from
 * src/tenant/bayut/data/profileFields.js and agencySettingsFields.js — the
 * product's own definitions, not from reading a screenshot.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, close, icon, esc } from './shell.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'data/fixtures/settings.json'), 'utf8'));
const link = (label) => `not-built.html?screen=${encodeURIComponent(label)}`;

/* ── the left column ─────────────────────────────────────────────────────── */

/* Five entries, each with its own icon, and the current one is a filled pill —
   background #f7fcfc, radius 4, weight 600 — not merely coloured text. */
const navCard = (current) => `        <section class="pf-card pf-settings-nav">
          <nav aria-label="Settings">
            <ul>
${cfg.nav.map((n) => `              <li><a href="${n.page || link(n.label)}"${n.label === current ? ' aria-current="page"' : ''}>${icon(n.icon, 18)}<span class="nav-text">${esc(n.label)}</span></a></li>`).join('\n')}
            </ul>
          </nav>
        </section>`;

/* The completeness card is not a progress bar with two chips. It is a title
   row with a link, an ORANGE meter (#f0a742 — not the page's teal), and three
   verification steps: an outlined one for what is still to do and a tinted one
   with a check for each that is done. */
const step = (s) => `            <span class="pf-step" data-state="${s.state}" style="--step-w:${s.w}px">${icon(s.state === 'done' ? 'HiCheck' : 'GoDotFill', 16)}<span>${esc(s.label)}</span></span>`;

const completionCard = `        <section class="pf-card pf-completion">
          <div class="pf-completion-head">
            <span class="pf-completion-title">${esc(cfg.completion.title)}</span>
            <a class="pf-btn" data-variant="link" data-size="small" href="${link(cfg.completion.link)}"><span class="fz-12">${esc(cfg.completion.link)}</span></a>
          </div>
          <div class="pf-completion-meter">
            <span class="pf-progress"><span class="pf-progress-bg"></span></span>
            <span class="pf-completion-pct">${cfg.completion.pct}%</span>
          </div>
          <div class="pf-completion-body">
${cfg.completion.steps.map(step).join('\n')}
          </div>
        </section>`;

/* ── fields ──────────────────────────────────────────────────────────────── */

/* Field ids are namespaced by page: `f-0` on three pages is three elements
   with one id the moment combine.mjs puts them in one document, and a
   <label for> then points at whichever came first. */
const control = (f, id) => {
  if (f.type === 'phone') {
    /* a compound: a 68-wide country box with its own arrow, then the number.
       The product renders react-phone-number-input with countrySelectProps
       disabled, which is why the flag never opens anything. */
    return `<span class="pf-phone">
                <button class="pf-phone-country" type="button" disabled data-noop="the product disables the country select — countrySelectProps.disabled, profileFields.js:275"><span class="pf-flag"></span>${icon('DownOutlined', 12)}</button>
                <span class="pf-input"><input id="${id}" type="tel" value="${esc(f.value || '')}"></span>
              </span>`;
  }
  if (f.type === 'select') {
    const label = f.tag
      ? `<span class="pf-select-tag">${esc(f.tag)}${icon('IoMdClose', 12)}</span>`
      : `<span class="${f.value ? 'pf-select-value' : 'pf-placeholder'}">${esc(f.value || f.placeholder || '')}</span>`;
    return `<button class="pf-select" id="${id}" type="button" aria-haspopup="listbox"${f.disabled ? ' disabled' : ' data-open="listbox-settings" data-placement="bottom"'}>${label}<span class="pf-select-arrow">${icon('DownOutlined', 12)}</span></button>`;
  }
  if (f.type === 'textarea' || f.type === 'generate') {
    return `<textarea class="pf-textarea" id="${id}" placeholder="${esc(f.placeholder || '')}"${f.rtl ? ' dir="rtl"' : ''}></textarea>`;
  }
  if (f.type === 'password') {
    return `<span class="pf-input"><input id="${id}" type="password" placeholder="${esc(f.placeholder || '')}"><button class="pf-input-suffix" type="button" data-noop="revealing a password needs script the product loads and this page does not">${icon('IoMdEyeOff', 14)}</button></span>`;
  }
  if (f.type === 'upload') {
    /* image-upload.js:83 — a primaryOutlined Button with borderStyle dashed,
       not a grey square beside a plain button */
    return `<div class="pf-upload"${f.uploadW ? ` style="--upload-w:${f.uploadW}px"` : ''}>
                <button class="pf-upload-btn" type="button" data-noop="a file picker needs a server to upload to">${icon('MdOutlineCloudUpload', 18)}<span>${esc(f.placeholder)}</span></button>
${f.guidelines ? `                <div class="pf-guidelines">
                  <div class="pf-guidelines-title">${esc(f.guidelines.title)}</div>
${f.guidelines.items.map((t) => `                  <div class="pf-guideline">${icon('GoDotFill', 12)}<span>${esc(t)}</span></div>`).join('\n')}
                  <a href="${link('Profile picture guidelines')}">${esc(f.guidelines.link)}</a>
                </div>` : ''}
              </div>`;
  }
  return `<span class="pf-input"><input id="${id}" type="text"${f.value ? ` value="${esc(f.value)}"` : ''}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.disabled ? ' disabled' : ''}${f.rtl ? ' dir="rtl"' : ''}></span>`;
};

const field = (slug) => (f, i) => {
  const id = `${slug}-f-${i}`;
  /* the type becomes a modifier class, prefixed: a bare `input` or `select`
     in a shared stylesheet would collide with anything */
  const cls = ['pf-sfield', f.span ? 'span-all' : '', `sf-${f.type}`, f.rtl ? 'rtl' : ''].filter(Boolean).join(' ');
  const btn = f.button
    ? `\n              <div class="pf-generate" data-align="${f.button.align}"><button class="pf-btn" data-variant="round" type="button" style="--round-w:${f.button.w}px" data-noop="generating a description calls the product's AI endpoint">${icon('BsStars', 12)}<span>${esc(f.button.label)}</span></button></div>`
    : '';
  return `            <div class="${cls}">
              <label class="pf-field-label" for="${id}">${esc(f.label)}</label>
              ${control(f, id)}${btn}
            </div>`;
};

/* ── the three right-hand shapes ─────────────────────────────────────────── */

const form = (p) => `            <form class="pf-form-grid" data-cols="${p.cols || 'one'}" style="--form-w:${p.formWidth || p.colWidth}px">
${p.fields.map(field(p.slug)).join('\n')}
            </form>`;

const saveRow = (p) => `            <div class="pf-form-actions">
              <button class="pf-btn" data-variant="primary" data-size="large" type="button" style="--save-w:${p.save.w}px${p.save.radius ? `;--save-r:${p.save.radius}px` : ''}" data-noop="the form is not wired to a server in this page"><span>${esc(p.save.label)}</span></button>
            </div>`;

/* profile: a 150-tall header card carrying the avatar, the name, the role tags
   and the email, then the form card */
const profileMain = (p) => `          <section class="pf-card pf-settings-head">
            <span class="pf-settings-avatar"><span class="pf-avatar-pct">${cfg.completion.pct}%</span></span>
            <div class="pf-settings-who">
              <div class="pf-settings-nameline">
                <h2 class="pf-settings-name">${esc(cfg.user.name)}</h2>
${cfg.user.tags.map((t) => `                <span class="pf-user-tag"${t.tone ? ` data-tone="${t.tone}"` : ''}>${icon(t.icon, 14)}<span>${esc(t.label)}</span></span>`).join('\n')}
              </div>
              <div class="pf-settings-sub">${esc(cfg.user.email)}</div>
            </div>
          </section>
          <section class="pf-card pf-settings-form">
            <h5 class="pf-card-title">${esc(p.formTitle)}</h5>
${form(p)}
${saveRow(p)}
          </section>`;

/* agency: one card. The header is INSIDE it, over a full-width divider. */
const agencyMain = (p) => `          <section class="pf-card pf-settings-form pf-agency">
            <div class="pf-agency-head">
              <span class="pf-agency-logo"></span>
              <div>
                <h2 class="pf-agency-name">${esc(cfg.agency.name)}</h2>
                <div class="pf-agency-users">${icon('FiUsers', 17)}<span>${esc(cfg.agency.users)}</span></div>
              </div>
            </div>
            <hr class="pf-divider">
${form(p)}
${saveRow(p)}
          </section>`;

/* narrow: one card holding a centred 500-wide column */
const narrowMain = (p) => `          <section class="pf-card pf-settings-form pf-narrow">
${form(p)}
${saveRow(p)}
          </section>`;

const MAIN = { profile: profileMain, agency: agencyMain, narrow: narrowMain };

const pageHtml = (p) => {
  const comment = `<!-- ═══════════════════════════════════════════════════════════════════
     ${p.title.toUpperCase()} — scripts/pages/settings.mjs from data/fixtures/settings.json
     Measured against data/live/${p.slug}.capture.json (scripts/outline.mjs):
       left 336 · nav card 326x256, rows 38 · completeness card 326x240
       right 1007 · shape "${p.shape}"
     Fields: src/tenant/bayut/data/${p.shape === 'agency' ? 'agencySettingsFields.js' : 'profileFields.js'}
     ═══════════════════════════════════════════════════════════════════════ -->`;

  const instance = `.pf-progress .pf-progress-bg{inline-size:${cfg.completion.pct}%}   /* profile completeness */`;

  return open({ title: 'Settings', current: 'Settings', docTitle: `${p.title} — Profolio KSA`, comment, instance, contentGap: 8 })
    + `      <div class="pf-settings-grid">
        <div class="pf-settings-side">
${navCard(p.title)}
${completionCard}
        </div>
        <div class="pf-settings-main">
${MAIN[p.shape](p)}
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
  if (want && !p.slug.includes(want)) continue;
  const html = pageHtml(p);
  writeFileSync(join(ROOT, 'deliverables', `${p.slug}.html`), html);
  console.log(`  deliverables/${p.slug}.html — ${p.shape} · ${p.fields.length} fields · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
}
