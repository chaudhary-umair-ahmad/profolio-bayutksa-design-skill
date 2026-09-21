#!/usr/bin/env node
/**
 * Stand the product up in this sandbox.
 *
 * The product's yarn.lock points every one of its 1461 entries at a private
 * Nexus mirror that is not reachable from here. But each entry carries the
 * version and an integrity hash, so rewriting the host to public npm restores
 * the same tree — yarn still verifies every tarball against the committed
 * hash. Exactly one package is genuinely private (@sector-labs/fe-auth-redux);
 * it is imported once, for one class, on the branch development never takes,
 * so a local stub satisfies the module graph.
 *
 *   node harness/install.mjs [--repo ../profolio-reactjs-copy]
 *
 * Touches the product checkout only through files git already ignores
 * (node_modules, .env, src/utility/variables.js) plus a harness-stubs/ folder
 * listed in .git/info/exclude. package.json and yarn.lock are swapped for the
 * install and restored from git afterwards, so `git status` stays clean.
 *
 * Refuses to succeed if the installed antd, react or styled-components differ
 * from what the lockfile names. A measurement from the wrong antd is worse
 * than no measurement — the skill's own reference CSS was extracted from
 * 5.20.6 while the product ships 5.22.1, and nothing noticed for a week.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const REPO = join(ROOT, arg('--repo', '../profolio-reactjs-copy'));
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: REPO, stdio: 'inherit', ...opts });

const PRIVATE = '@sector-labs/fe-auth-redux';
const MIRROR = 'https://nexus.sector.sh/repository/yarn/';
const PUBLIC = 'https://registry.npmjs.org/';

/* ── 1 · what the lockfile says the product ships ──────────────────────── */
const lock = readFileSync(join(REPO, 'yarn.lock'), 'utf8');
const pinned = (name) => {
  const re = new RegExp(`^"?${name.replace('/', '\\/')}@[^\\n]*:\\n  version "([^"]+)"`, 'm');
  const m = re.exec(lock);
  if (!m) throw new Error(`${name} not in yarn.lock`);
  return m[1];
};
const EXPECT = Object.fromEntries(
  ['antd', 'react', 'react-dom', 'styled-components', '@ant-design/pro-components', 'vite']
    .map((n) => [n, pinned(n)]));
console.log('  lockfile pins', EXPECT);

/* ── 2 · the public lockfile ───────────────────────────────────────────── */
const publicLock = lock.split(MIRROR).join(PUBLIC)
  /* drop the private entry: from its header to the next blank line */
  .replace(new RegExp(`^"${PRIVATE}@[^\\n]*:\\n(?:  [^\\n]*\\n)*\\n`, 'm'), '');
if (publicLock.includes('nexus.sector.sh')) throw new Error('mirror host survived the rewrite');
writeFileSync(join(HERE, 'yarn.public.lock'), publicLock);

/* ── 3 · the stub ──────────────────────────────────────────────────────── */
const stubDir = join(REPO, 'harness-stubs', 'fe-auth-redux');
mkdirSync(stubDir, { recursive: true });
copyFileSync(join(HERE, 'stubs', 'fe-auth-redux.js'), join(stubDir, 'index.js'));
writeFileSync(join(stubDir, 'package.json'), JSON.stringify({
  name: PRIVATE, version: pinned(PRIVATE), main: 'index.js', module: 'index.js', type: 'module',
}, null, 2) + '\n');

const exclude = join(REPO, '.git', 'info', 'exclude');
const excluded = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
for (const line of ['harness-stubs/', '.env'])
  if (!excluded.split('\n').includes(line)) appendFileSync(exclude, line + '\n');

/* ── 4 · .env: the committed example, with only what localhost needs ───── */
writeFileSync(join(REPO, '.env'), readFileSync(join(HERE, 'env'), 'utf8'));

/* ── 5 · install against the public lock, then put git's files back ────── */
const pkgPath = join(REPO, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.dependencies[PRIVATE] = 'file:./harness-stubs/fe-auth-redux';
try {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(join(REPO, 'yarn.lock'), publicLock);
  sh('yarn install --ignore-engines --network-timeout 120000');
} finally {
  sh('git checkout -- package.json yarn.lock');
}

/* ── 6 · refuse to lie about what got installed ────────────────────────── */
const drift = [];
for (const [name, want] of Object.entries(EXPECT)) {
  const got = JSON.parse(readFileSync(join(REPO, 'node_modules', name, 'package.json'), 'utf8')).version;
  if (got !== want) drift.push(`${name}: installed ${got}, lockfile says ${want}`);
  else console.log(`  ok    ${name} ${got}`);
}
if (drift.length) {
  console.error('\n  The installed tree is not the product\'s tree:\n    ' + drift.join('\n    '));
  process.exit(1);
}
console.log('\n  The product\'s dependency tree is installed. Next: node harness/capture.mjs');
