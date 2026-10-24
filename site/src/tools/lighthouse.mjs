#!/usr/bin/env node
// lighthouse.mjs — serve the build and run Lighthouse 12 (mobile, its default throttling) against it, behind the
// same 2-slot browser lock check.mjs uses. Writes audit/lighthouse-<form>.json and prints the four scores.
//
//   node src/tools/lighthouse.mjs [--dir dist] [--form mobile|desktop]
//
// A local static server is not a CDN: no compression, no HTTP/2. The score is a floor for a real host, not a ceiling.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(ROOT, opt('dir', 'dist')); const FORM = opt('form', 'mobile');
const CHROME = process.env.CHROME_PATH || (() => { const base = path.join(process.env.HOME, 'Library/Caches/ms-playwright'); const d = fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().pop(); return path.join(base, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'); })();
if (!fs.existsSync(CHROME)) { console.error('no Chrome at ' + CHROME + ' (set CHROME_PATH)'); process.exit(2); }

const LOCKS = path.join(ROOT, 'audit', '.locks'); fs.mkdirSync(LOCKS, { recursive: true }); let lock = null;
async function acquire() { const t0 = Date.now(); for (;;) { for (const n of [1, 2]) { const d = path.join(LOCKS, 'browser-' + n); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'owner'), String(process.pid)); lock = d; return; } catch { try { const pid = Number(fs.readFileSync(path.join(d, 'owner'), 'utf8')); let alive = true; try { process.kill(pid, 0); } catch { alive = false; } if (!alive || Date.now() - fs.statSync(d).mtimeMs > 16 * 60 * 1000) fs.rmSync(d, { recursive: true, force: true }); } catch { /* raced */ } } } if (Date.now() - t0 > 12 * 60 * 1000) throw new Error('no browser slot'); await new Promise((r) => setTimeout(r, 1500)); } }
const release = () => { if (lock) fs.rmSync(lock, { recursive: true, force: true }); lock = null; };
process.on('exit', release);

// a static host as a real one would be: gzip for text, long cache for hashed assets
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f); const h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' };
  if (/\.(html|css|js|svg)$/.test(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) { h['content-encoding'] = 'gzip'; res.writeHead(200, h); res.end(zlib.gzipSync(fs.readFileSync(f))); return; }
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = 'http://127.0.0.1:' + server.address().port + '/';
await acquire();
const out = path.join(ROOT, 'audit', `lighthouse-${FORM}.json`);
const args = ['-y', 'lighthouse@12.2.1', URL_, '--output=json', '--output-path=' + out, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,accessibility,best-practices,seo'];
if (FORM === 'desktop') args.push('--preset=desktop');
// async, never spawnSync: a synchronous child blocks this process's event loop, and with it the server Lighthouse is loading
if (fs.existsSync(out)) fs.rmSync(out);
const r = await new Promise((resolve) => {
  const ch = spawn('npx', args, { env: { ...process.env, CHROME_PATH: CHROME } }); let err = '';
  ch.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
  const t = setTimeout(() => { ch.kill('SIGKILL'); }, 8 * 60 * 1000);
  ch.on('close', (code) => { clearTimeout(t); resolve({ status: code, stderr: err }); });
});
server.close(); release();
if (!fs.existsSync(out)) { console.error('lighthouse produced no report', r.status, (r.stderr || '').slice(-800)); process.exit(2); }
const j = JSON.parse(fs.readFileSync(out, 'utf8'));
const s = Object.fromEntries(Object.entries(j.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
const m = (id) => j.audits[id] && j.audits[id].displayValue;
console.log(`lighthouse ${FORM}: performance ${s.performance} · accessibility ${s.accessibility} · best-practices ${s['best-practices']} · seo ${s.seo}`);
console.log(`  FCP ${m('first-contentful-paint')} · LCP ${m('largest-contentful-paint')} · TBT ${m('total-blocking-time')} · CLS ${m('cumulative-layout-shift')} · SI ${m('speed-index')} · weight ${m('total-byte-weight')}`);
const fails = Object.values(j.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual').map((a) => `${a.id} (${a.displayValue || Math.round(a.score * 100)})`);
if (fails.length) console.log('  below 90: ' + fails.slice(0, 20).join(' · '));
process.exit(0);
