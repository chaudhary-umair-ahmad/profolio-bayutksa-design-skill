/**
 * Boot the product's Vite dev server and hand back a URL.
 *
 *   import { serve } from './serve.mjs';
 *   const app = await serve();       // { url, stop }
 *   ...
 *   await app.stop();
 *
 * Reuses a server that is already listening on the port, so a capture run and
 * a manual `yarn start` do not fight. Vite is started with the product's own
 * `yarn start`, so `prestart` regenerates the gitignored
 * src/utility/variables.js exactly the way CI does.
 */

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', process.env.PROFOLIO_REPO || '../profolio-reactjs-copy');
export const PORT = Number(process.env.PROFOLIO_PORT || 3000);
export const URL_BASE = `http://127.0.0.1:${PORT}`;

const listening = async () => {
  try { const r = await fetch(URL_BASE + '/', { signal: AbortSignal.timeout(1500) }); return r.ok || r.status < 500; }
  catch { return false; }
};

export async function serve({ log = console.log } = {}) {
  if (await listening()) {
    log(`  vite already listening on ${URL_BASE} — reusing it`);
    return { url: URL_BASE, stop: async () => {} };
  }

  log('  starting vite …');
  const child = spawn('yarn', ['start', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0' },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`vite exited ${child.exitCode}:\n${out}`);
    if (await listening()) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await listening())) { child.kill(); throw new Error(`vite did not listen within 120s:\n${out}`); }
  log(`  vite up on ${URL_BASE}`);

  return {
    url: URL_BASE,
    output: () => out,
    stop: () => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 5000);
    }),
  };
}

/* run directly: keep it up until Ctrl-C, useful for looking at a page by hand */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await serve();
  console.log(`  open ${app.url}/en/dashboard — Ctrl-C to stop`);
  process.on('SIGINT', async () => { await app.stop(); process.exit(0); });
  await new Promise(() => {});
}
