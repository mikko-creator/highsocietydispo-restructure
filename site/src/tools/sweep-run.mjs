#!/usr/bin/env node
// sweep-run.mjs — run the skill's responsive sweep payload (sr-sweep --emit) in a real browser
// at each project breakpoint, on the reskin homepage (baseline) and on the rebuild, merge the
// results into the homepage-scoped workspace, and take the full-page rebuild screenshots the
// pixel-diff stage pairs with the baseline ones (at every width source-capture.mjs shot).
//
//   node src/tools/sweep-run.mjs [--side baseline|rebuild|both] [--dir dist]
//
// Read-only for dist/. One browser, one page at a time, behind the same 2-slot lock check.mjs
// uses. The returned viewport width is asserted: a sweep of the wrong viewport is refused.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || (console.error('Set PW_CORE to the playwright-core package directory: this repo ships no machine path.'), process.exit(2)));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SR = process.env.SR_ROOT || (console.error('Set SR_ROOT to the site-reforge scripts directory: this repo ships no machine path.'), process.exit(2));
const HOME = path.join(ROOT, 'home');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SIDE = opt('side', 'both'); const DIR = path.resolve(ROOT, opt('dir', 'dist'));
const LIVE = 'https://sgencms.github.io/client-highsocietydispo-reskin/index.html';
// the baseline capture's sizes (source-capture.mjs); the sweep runs at the project's breakpoints, the screenshots at all six
const VPS = [{ w: 1440, h: 900 }, { w: 1280, h: 720 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }, { w: 360, h: 740 }];
const BREAKPOINTS = JSON.parse(fs.readFileSync(path.join(HOME, 'project.json'), 'utf8')).config.breakpoints;
const IN = path.join(ROOT, 'audit', 'capture-in'); fs.mkdirSync(IN, { recursive: true });
const sweepSrc = execFileSync('node', [path.join(SR, 'sr-sweep.mjs'), '--emit'], { encoding: 'utf8' });
setTimeout(() => { console.error('WATCHDOG 14 min'); process.exit(3); }, 14 * 60 * 1000).unref();

// same lock as check.mjs
const LOCKS = path.join(ROOT, 'audit', '.locks'); fs.mkdirSync(LOCKS, { recursive: true }); let lock = null;
async function acquire() { const t0 = Date.now(); for (;;) { for (const n of [1, 2]) { const d = path.join(LOCKS, 'browser-' + n); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'owner'), String(process.pid)); lock = d; return; } catch { try { const pid = Number(fs.readFileSync(path.join(d, 'owner'), 'utf8')); let alive = true; try { process.kill(pid, 0); } catch { alive = false; } if (!alive || Date.now() - fs.statSync(d).mtimeMs > 16 * 60 * 1000) fs.rmSync(d, { recursive: true, force: true }); } catch { /* raced */ } } } if (Date.now() - t0 > 12 * 60 * 1000) throw new Error('no browser slot'); await new Promise((r) => setTimeout(r, 1500)); } }
const release = () => { if (lock) fs.rmSync(lock, { recursive: true, force: true }); lock = null; };
process.on('exit', release);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const LOCAL = 'http://127.0.0.1:' + server.address().port + '/';
const merge = (file, side) => console.log('   ' + execFileSync('node', [path.join(SR, 'sr-sweep.mjs'), '--project', HOME, '--merge', file, '--side', side], { encoding: 'utf8' }).trim().split('\n').join('\n   '));

await acquire();
const browser = await chromium.launch({ headless: true });
let bad = 0;
try {
  for (const side of ['baseline', 'rebuild']) {
    if (SIDE !== 'both' && SIDE !== side) continue;
    for (const vp of VPS) {
      const sweep = BREAKPOINTS.includes(vp.w);
      if (side === 'baseline' && !sweep) continue;                  // the baseline screenshots are source-capture.mjs's
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: side === 'rebuild' ? 'reduce' : 'no-preference' });
      // the rebuild's age gate is answered the way a returning visitor's is (its own key); the reskin's by its Yes button
      if (side === 'rebuild') await ctx.addInitScript(() => { try { localStorage.setItem('pitstop-age-ok', '1'); } catch (e) { /* storage off */ } });
      const page = await ctx.newPage();
      try {
        await page.goto(side === 'baseline' ? LIVE : LOCAL, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(side === 'baseline' ? 2500 : 600);
        if (side === 'baseline') { await page.evaluate(() => { const y = document.querySelector('.sg_age-verification .btn--yes'); if (y && y.offsetParent) y.click(); }); await page.waitForTimeout(600); }
        await page.evaluate(() => document.fonts && document.fonts.ready);
        const H = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < H + vp.h; y += Math.round(vp.h * 0.8)) { await page.evaluate((yy) => scrollTo({ top: yy, behavior: 'instant' }), y); await page.waitForTimeout(side === 'baseline' ? 250 : 120); }
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(500);
        if (sweep) {
          const res = await page.evaluate(sweepSrc);
          if (!res || !res.viewport || res.viewport.w !== vp.w) { console.log(`REFUSED ${side} ${vp.w}: swept viewport was ${res && res.viewport && res.viewport.w}`); bad++; await ctx.close(); continue; }
          const f = path.join(IN, `sweep-${side}-${vp.w}.json`); fs.writeFileSync(f, JSON.stringify(res));
          console.log(`${side} ${vp.w}x${vp.h}: document ${H}px tall`); merge(f, side);
        }
        if (side === 'rebuild') {
          const out = path.join(ROOT, 'audit', 'screens', 'rebuild'); fs.mkdirSync(out, { recursive: true });
          const H2 = await page.evaluate(() => document.documentElement.scrollHeight);
          await page.screenshot({ path: path.join(out, `index.${vp.w}.png`), fullPage: true, ...(H2 > 16000 ? { clip: { x: 0, y: 0, width: vp.w, height: 16000 } } : {}) });
          console.log(`rebuild ${vp.w}x${vp.h}: full-page screenshot ${H2}px`);
        }
      } catch (e) { console.log(`FAILED ${side} ${vp.w}: ${String(e.message).split('\n')[0]}`); bad++; }
      await ctx.close();
    }
  }
} finally { await browser.close(); server.close(); release(); }
console.log(bad ? `sweep run: ${bad} capture(s) failed` : 'sweep run: all captures merged');
process.exit(bad ? 1 : 0);
