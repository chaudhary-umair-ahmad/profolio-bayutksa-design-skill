#!/usr/bin/env node
/**
 * Composes deliverables/dashboard.html.
 *
 * It used to be hand-written, and that cost exactly what hand-writing a shell
 * always costs. By the time anyone looked, dashboard.html carried:
 *
 *   - an ELEVEN-item rail, still listing Inbox and TruLeads. shell.mjs dropped
 *     both when the real screen proved they do not render for this tenant
 *     (menuList.js:46 hides Inbox behind HIDE_INBOX; :58 gates TruLeads on the
 *     account) and this page never heard about it.
 *   - every rail item pointing at href="#".
 *   - no prototype.js and not one data-open, so the three shell overlays that
 *     work on Listings — Download App, the notification centre, the account
 *     menu — were unreachable here. 166 controls, 0 of them wired.
 *
 * So the shell comes from scripts/pages/shell.mjs now, the same one Listings
 * uses, and there is one shell rather than two. The page's own CONTENT — the
 * widgets, the chart, the recent-listings table — is scripts/pages/dashboard-body.html,
 * lifted verbatim from the hand-written file.
 *
 *   node scripts/pages/dashboard.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, close } from './shell.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const body = readFileSync(join(HERE, 'dashboard-body.html'), 'utf8');

const comment = `<!-- ═══════════════════════════════════════════════════════════════════
     OVERVIEW — the shell from scripts/pages/shell.mjs, the body from
     scripts/pages/dashboard-body.html, composed by scripts/pages/dashboard.mjs.
     Measured against data/live/dashboard.capture.json.
     ═══════════════════════════════════════════════════════════════════════ -->`;

/* the two data-carrying custom properties this page's widgets need */
const instance = `.pct-90{--ring-pct:90}                /* profile completion score */
.fill-97{--meter-pct:97.17}           /* 72,880 / 75,000 — QuotaCreditsStatWidget */`;

const html = open({
  title: 'Overview',
  current: 'Overview',
  docTitle: 'Overview — Profolio KSA',
  comment,
  instance,
}) + body + close();

const out = join(ROOT, 'deliverables', 'dashboard.html');
writeFileSync(out, html);
console.log(`  deliverables/dashboard.html — through shell.mjs · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB`);
