#!/usr/bin/env node
// source-capture.mjs — drive the SOURCE (the reskin homepage) in headless Chromium for the skill's capture stage:
// per viewport, answer the age gate, scroll the page once at a human pace (its reveal-on-scroll blocks arrive), run the
// skill's capture IIFE (sr-capture --emit) and, at 1440 and 390, its scroll pass (--emit-scroll); save a full-height
// baseline screenshot for the pixel stage. One browser, one page at a time, behind the project's 2-slot lock.
//
//   node src/tools/source-capture.mjs            (then: sr-capture --project home --merge audit/capture-in/cap-<w>.json)
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || (console.error('Set PW_CORE to the playwright-core package directory: this repo ships no machine path.'), process.exit(2)));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_ = 'https://sgencms.github.io/client-highsocietydispo-reskin/index.html';
const CAPIN = path.join(ROOT, 'audit', 'capture-in'); const SHOTS = path.join(ROOT, 'audit', 'screens', 'baseline');
for (const d of [CAPIN, SHOTS]) fs.mkdirSync(d, { recursive: true });
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 1280, h: 720 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }, { w: 360, h: 740 }];
const capSrc = fs.readFileSync(path.join(CAPIN, 'capture.js'), 'utf8');
const scrollSrc = fs.readFileSync(path.join(CAPIN, 'scroll.js'), 'utf8');
setTimeout(() => { console.error('WATCHDOG: 15 min, exiting'); process.exit(3); }, 15 * 60 * 1000).unref();
const LOCKS = path.join(ROOT, 'audit', '.locks'); fs.mkdirSync(LOCKS, { recursive: true }); let lock = null;
for (const t0 = Date.now(); !lock;) { for (const n of [1, 2]) { const d = path.join(LOCKS, 'browser-' + n); try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'owner'), String(process.pid)); lock = d; break; } catch { try { const pid = Number(fs.readFileSync(path.join(d, 'owner'), 'utf8')); let alive = true; try { process.kill(pid, 0); } catch { alive = false; } if (!alive) fs.rmSync(d, { recursive: true, force: true }); } catch { /* */ } } } if (!lock) { if (Date.now() - t0 > 600000) { console.error('no browser slot'); process.exit(4); } await new Promise((r) => setTimeout(r, 1500)); } }
process.on('exit', () => { if (lock) fs.rmSync(lock, { recursive: true, force: true }); });
const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const y = document.querySelector('.sg_age-verification .btn--yes'); if (y && y.offsetParent) y.click(); });
    await page.waitForTimeout(600);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H + vp.h; y += Math.round(vp.h * 0.5)) { await page.evaluate((yy) => scrollTo({ top: yy, behavior: 'instant' }), y); await page.waitForTimeout(260); }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(700);
    const cap = await page.evaluate(capSrc).catch((e) => ({ error: String(e).slice(0, 300) }));
    fs.writeFileSync(path.join(CAPIN, `cap-${vp.w}.json`), JSON.stringify(cap));
    if (vp.w === 1440 || vp.w === 390) { const sc = await page.evaluate(scrollSrc).catch((e) => ({ error: String(e).slice(0, 300) })); fs.writeFileSync(path.join(CAPIN, `scroll-${vp.w}.json`), JSON.stringify(sc)); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(500); }
    const H2 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: path.join(SHOTS, `index.${vp.w}.png`), fullPage: true, ...(H2 > 16000 ? { clip: { x: 0, y: 0, width: vp.w, height: 16000 } } : {}) });
    console.log(vp.w + 'x' + vp.h, 'docH', H2, cap && cap.error ? 'CAPTURE ERROR ' + cap.error : 'captured');
    await ctx.close();
  }
} finally { await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]); }
process.exit(0);
