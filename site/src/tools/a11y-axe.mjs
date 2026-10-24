#!/usr/bin/env node
// a11y-axe.mjs — run axe-core (WCAG 2.0/2.1 A + AA rules) over the built page in a real browser: the page as a visitor
// first sees it (age gate answered), the age gate itself, every tab state, every accordion item, every opened "Read more",
// the Locations dropdown, the phone menu (with its Locations accordion) and the store chooser, at desktop and phone sizes. axe is a test tool, not part of the page: pass its file with --axe.
//
//   node src/tools/a11y-axe.mjs --axe <path/to/axe.min.js> [--dir dist] [--vp 1440x900,390x844]
//
// Exit 0 only when no violation is found. One browser, behind the same 2-slot lock check.mjs uses.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || (console.error('Set PW_CORE to the playwright-core package directory: this repo ships no machine path.'), process.exit(2)));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const AXE = opt('axe', ''); if (!AXE || !fs.existsSync(AXE)) { console.error('pass --axe <axe.min.js>'); process.exit(2); }
const DIR = path.resolve(ROOT, opt('dir', 'dist'));
const VPS = opt('vp', '1440x900,1280x720,390x844,360x740').split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h }; });
setTimeout(() => { console.error('WATCHDOG 20 min'); process.exit(3); }, 20 * 60 * 1000).unref();

const LOCKS = path.join(ROOT, 'audit', '.locks'); fs.mkdirSync(LOCKS, { recursive: true }); let lock = null;
async function acquire() { const t0 = Date.now(); for (;;) { for (const n of [1, 2]) { const d = path.join(LOCKS, 'browser-' + n); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'owner'), String(process.pid)); lock = d; return; } catch { try { const pid = Number(fs.readFileSync(path.join(d, 'owner'), 'utf8')); let alive = true; try { process.kill(pid, 0); } catch { alive = false; } if (!alive || Date.now() - fs.statSync(d).mtimeMs > 16 * 60 * 1000) fs.rmSync(d, { recursive: true, force: true }); } catch { /* raced */ } } } if (Date.now() - t0 > 12 * 60 * 1000) throw new Error('no browser slot'); await new Promise((r) => setTimeout(r, 1500)); } }
const release = () => { if (lock) fs.rmSync(lock, { recursive: true, force: true }); lock = null; };
process.on('exit', release);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(DIR, p); if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const axeSrc = fs.readFileSync(AXE, 'utf8');
const RUN = async (page, label, include) => {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async (inc) => {
    const res = await window.axe.run(inc ? { include: [inc] } : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' | ').slice(0, 300) })), count: v.nodes.length }));
  }, include || null);
  return { label, violations: r };
};

const out = [];
await acquire();
const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VPS) {
    // a first-time visitor: the age gate, open over the page
    { const c0 = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'reduce' }); const p0 = await c0.newPage();
      await p0.goto(BASE, { waitUntil: 'domcontentloaded' }); await p0.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 15000 });
      await p0.waitForTimeout(300); out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(p0, 'age gate open (first visit)')) }); await c0.close(); }
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pitstop-age-ok', '1'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 15000 });
    out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, 'page, default states')) });
    // every long review opened ("Read more"), scanned in its section
    const mores = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-readmore][data-long="true"] .readmore__btn')]; r.forEach((b) => b.click()); return r.length; });
    if (mores) { await page.waitForTimeout(150); out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, mores + ' "Read more" opened', '#reviews')) }); await page.evaluate(() => [...document.querySelectorAll('[data-readmore][data-collapsed="false"] .readmore__btn')].forEach((b) => b.click())); }
    // every tab of every tablist, scanned in its slide
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().height > 0).map((t) => t.id));
    for (const id of tabs) {
      await page.evaluate((t) => document.getElementById(t).click(), id); await page.waitForTimeout(80);
      const slide = await page.evaluate((t) => { const s = document.getElementById(t).closest('.slide'); return s ? '#' + s.id : null; }, id);
      out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, 'tab ' + id, slide)) });
    }
    // every accordion item, one at a time, scanned in its slide
    const accs = await page.evaluate(() => [...document.querySelectorAll('details')].filter((d) => d.getBoundingClientRect().height > 0).length);
    for (let i = 0; i < accs; i++) {
      const slide = await page.evaluate((k) => { const d = [...document.querySelectorAll('details')].filter((x) => x.getBoundingClientRect().height > 0)[k]; if (!d) return null; d.open = true; const s = d.closest('.slide'); return s ? '#' + s.id : null; }, i);
      if (slide) { await page.waitForTimeout(60); out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, 'accordion item ' + (i + 1) + ' open', slide)) }); }
    }
    if (vp.w >= 1180) {
      await page.evaluate(() => document.querySelector('.nav__item--sub > button').click()); await page.waitForTimeout(260);
      out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, 'Locations dropdown open', '.site-header')) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    }
    if (vp.w < 1180) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(200);
      await page.click('[data-menu-open]'); await page.waitForTimeout(350);
      await page.evaluate(() => { const t = document.querySelector('#mmenu .mmenu__toggle'); if (t) t.click(); });
      out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, 'overlay menu open (Locations accordion open)', '#mmenu')) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
    await page.click(vp.w >= 1180 ? '.bar__actions [data-locator-open]' : '.bar__tools [data-locator-open]'); await page.waitForTimeout(350);
    out.push({ vp: vp.w + 'x' + vp.h, ...(await RUN(page, 'store chooser open', '#dispenzaLocationPopup-open')) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    await ctx.close();
  }
} finally { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]); server.close(); release(); }

// one line per distinct violation + where it was seen
const seen = new Map();
for (const s of out) for (const v of s.violations) { const k = v.id + ' ' + v.nodes.map((n) => n.target).join(','); if (!seen.has(k)) seen.set(k, { ...v, where: [] }); seen.get(k).where.push(s.vp + ' · ' + s.label); }
fs.writeFileSync(path.join(ROOT, 'audit', 'a11y-axe.json'), JSON.stringify({ at: new Date().toISOString(), scans: out.length, violations: [...seen.values()] }, null, 1));
console.log(`axe: ${out.length} scans, ${seen.size} distinct violation(s)`);
for (const v of seen.values()) { console.log(`  ${v.impact.toUpperCase()} ${v.id} — ${v.help} (${v.count} node(s); ${v.where.slice(0, 3).join('; ')}${v.where.length > 3 ? '; …' : ''})`); for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target}  ${n.summary}`); }
process.exit(seen.size ? 1 : 0);
