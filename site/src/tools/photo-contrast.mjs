#!/usr/bin/env node
// photo-contrast.mjs — WCAG contrast of the words that sit on the hero's store photo, measured on the real pixels.
//
// check.mjs (and axe) skip text over a picture: there is no single background colour to read. Here every text line in
// the hero whose painted background is the photo (no opaque box of its own between it and the slide) is measured:
// the words are made transparent, the first screen is captured, and the text colour is compared with the BRIGHTEST
// pixel behind each line (the worst case) and with the 95th percentile. Exit 0 only when every line clears AA on the
// worst pixel: 4.5:1, or 3:1 for large text (24px, or 18.66px bold).
//
//   node src/tools/photo-contrast.mjs [--dir dist] [--vp 1440x900,390x844] [--all] [--json audit/check/x.json]
//   --all measures the words drawn straight on every slide's surface (the halftone textures), each slide parked under
//   the header in its default state
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || (console.error('Set PW_CORE to the playwright-core package directory: this repo ships no machine path.'), process.exit(2)));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DIR = path.resolve(ROOT, opt('dir', 'dist'));
const ALL = argv.includes('--all');      // every slide (the halftone textures), not only the hero photo
const OUTF = opt('json', ALL ? 'audit/check/surface-contrast.json' : 'audit/check/photo-contrast.json');
const VPS = opt('vp', '1440x900,1280x720,1024x768,768x1024,430x932,390x844,360x740,360x640').split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h, key: s }; });

// the same 2-slot browser lock as check.mjs (this Mac hangs on more than two browsers)
const LOCKS = path.join(ROOT, 'audit', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let lockDir = null;
async function acquire() {
  const t0 = Date.now();
  for (;;) {
    for (const n of [1, 2]) {
      const d = path.join(LOCKS, 'browser-' + n);
      try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'owner'), String(process.pid)); lockDir = d; return; } catch {
        try { const pid = Number(fs.readFileSync(path.join(d, 'owner'), 'utf8')); let alive = true; try { process.kill(pid, 0); } catch { alive = false; } if (!alive || Date.now() - fs.statSync(d).mtimeMs > 16 * 60 * 1000) fs.rmSync(d, { recursive: true, force: true }); } catch { /* raced */ }
      }
    }
    if (Date.now() - t0 > 12 * 60 * 1000) throw new Error('could not get a browser slot in 12 minutes');
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
  }
}
const release = () => { if (lockDir) fs.rmSync(lockDir, { recursive: true, force: true }); lockDir = null; };
process.on('exit', release); process.on('SIGINT', () => { release(); process.exit(130); });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';

await acquire();
const browser = await chromium.launch();
const report = { generated: new Date().toISOString(), viewports: [] };
let fails = 0;
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: vp.w < 1024 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('.hero__photo')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const ids = ALL ? await page.evaluate(() => [...document.querySelectorAll('.slide')].map((x) => x.id)) : ['home'];
  const V = { key: vp.key, slides: [], fails: 0 };
  for (const id of ids) {
    await page.evaluate((sid) => { document.getElementById(sid).scrollIntoView({ block: 'start', behavior: 'instant' }); }, id);
    await page.waitForTimeout(id === 'home' ? 150 : 700);
    // the lines drawn straight on the slide's surface (photo or texture): no opaque colour or picture of their own
    // between the words and the slide, and below the sticky header
    const lines = await page.evaluate((sid) => {
      const slide = document.getElementById(sid); const out = []; const rg = document.createRange();
      const head = document.querySelector('.site-header'); const top = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
      const onSurface = (el) => { for (let p = el; p && p !== slide; p = p.parentElement) { const cs = getComputedStyle(p); const m = cs.backgroundColor.match(/[\d.]+/g); const a = !m ? 0 : m.length > 3 ? Number(m[3]) : 1; if (a > .5 || cs.backgroundImage !== 'none' || /^(IMG|PICTURE)$/.test(p.tagName)) return false; } return true; };
      for (const el of slide.querySelectorAll('*')) {
        if (el.closest('.visually-hidden, [aria-hidden="true"], [hidden]') || !onSurface(el)) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || cs.color === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
          rg.selectNodeContents(n);
          // only the part on screen: every scrolling / clipping ancestor cuts the line (a line scrolled out of a hinted
          // scroll area, or a card paged out of a carousel, is not drawn over anything)
          let wl = 0, wr = innerWidth, wt = top, wb = innerHeight;
          for (let p = el.parentElement; p && p !== slide.parentElement; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.display === 'contents') continue; if (pc.overflowX !== 'visible' || pc.overflowY !== 'visible') { const pb = p.getBoundingClientRect(); wl = Math.max(wl, pb.left); wr = Math.min(wr, pb.right); wt = Math.max(wt, pb.top); wb = Math.min(wb, pb.bottom); } }
          for (const q of rg.getClientRects()) {
            // the band the letters occupy: the line box minus its leading (a box drawn just above or below a line, clear
            // of the letters, is not behind them)
            const lead = Math.max(0, (q.height - parseFloat(cs.fontSize) * 1.1) / 2);
            const y0 = Math.max(wt, q.top + lead), y1 = Math.min(wb, q.bottom - lead), x0 = Math.max(wl, q.left), x1 = Math.min(wr, q.right);
            if (q.width > 2 && y1 - y0 > 2 && x1 - x0 > 2) out.push({ text: n.nodeValue.trim().slice(0, 40), color: cs.color, px: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), r: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
          }
        }
      }
      // hide the words, their outlines and underlines (they would count as their own background)
      const st = document.createElement('style'); st.id = 'pc-hide'; st.textContent = `#${sid}, #${sid} * { color: transparent !important; -webkit-text-fill-color: transparent !important; -webkit-text-stroke-width: 0 !important; text-decoration-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }`; document.head.appendChild(st);
      return out;
    }, id);
    await page.waitForTimeout(150);
    const shot = (await page.screenshot({ type: 'png' })).toString('base64');
    await page.evaluate(() => document.getElementById('pc-hide').remove());
    const res = await page.evaluate(async ({ shot, lines }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + shot; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const L = (r, gg, b) => .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b);
      return lines.map((ln) => {
        const d = g.getImageData(Math.round(ln.r.x), Math.round(ln.r.y), Math.max(1, Math.round(ln.r.w)), Math.max(1, Math.round(ln.r.h))).data;
        const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2], L(d[i], d[i + 1], d[i + 2])]); px.sort((a, b) => a[3] - b[3]);
        // a see-through text colour (rgba) is blended over each background pixel before the ratio is taken
        const fg = ln.color.match(/[\d.]+/g).map(Number); const al = fg.length > 3 ? fg[3] : 1;
        const cr = (bg) => { const Lf = L(...[0, 1, 2].map((k) => al * fg[k] + (1 - al) * bg[k])); return (Math.max(Lf, bg[3]) + .05) / (Math.min(Lf, bg[3]) + .05); };
        const worst = Math.min(cr(px[px.length - 1]), cr(px[0])), p95 = Math.min(cr(px[Math.floor(px.length * .95)]), cr(px[Math.floor(px.length * .05)]));
        const big = ln.px >= 24 || (ln.px >= 18.66 && ln.weight >= 700);
        return { text: ln.text, color: ln.color, px: ln.px, need: big ? 3 : 4.5, worst: Math.round(worst * 100) / 100, p95: Math.round(p95 * 100) / 100 };
      });
    }, { shot, lines });
    const bad = res.filter((x) => x.worst < x.need - .005);
    fails += bad.length; V.fails += bad.length;
    V.slides.push({ id, lines: res, fails: bad.length });
    const min = res.reduce((m, x) => Math.min(m, x.worst), 99);
    console.log(`${vp.key.padEnd(9)} ${id.padEnd(10)} ${String(res.length).padStart(3)} lines on the surface · lowest ${min === 99 ? '-' : min + ':1'} (worst pixel) ${bad.length ? '· FAIL ' + bad.slice(0, 4).map((b) => `"${b.text}" ${b.worst}:1 < ${b.need}`).join('; ') : '· ok'}`);
  }
  report.viewports.push(V);
  await ctx.close();
}
await browser.close(); release(); server.close();
fs.mkdirSync(path.join(ROOT, 'audit', 'check'), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, OUTF), JSON.stringify(report, null, 1));
console.log(fails ? `FAIL — ${fails} line(s) under AA on the ${ALL ? 'slide surfaces' : 'photo'} · ${OUTF}` : `PASS — every word on the ${ALL ? 'slide surfaces (photo + textures)' : 'photo'} clears AA on its brightest pixel · ${OUTF}`);
process.exit(fails ? 1 : 0);
