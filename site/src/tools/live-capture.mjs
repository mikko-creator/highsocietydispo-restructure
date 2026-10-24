#!/usr/bin/env node
// live-capture.mjs — drive the LIVE Cookies Peoria Heights homepage in headless Chromium and
// harvest what a static fetch cannot see: the Joint product rails (DOM + the _search JSON they
// fetch), the store-select widget text, computed brand style, fonts, the site-reforge capture /
// scroll payloads, and full-height baseline screenshots.
//
//   node src/tools/live-capture.mjs [--only 1440]
//
// One browser, one page at a time (this Mac hangs on parallel headless jobs).
// Writes only inside the project directory.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || (console.error('Set PW_CORE to the playwright-core package directory: this repo ships no machine path.'), process.exit(2)));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_ = process.env.LIVE_URL || (console.error('Set LIVE_URL to the page to capture.'), process.exit(2));
const OUT = path.join(ROOT, 'audit', 'live'); const JOINT = path.join(OUT, 'joint');
const CAPIN = path.join(ROOT, 'audit', 'capture-in'); const SHOTS = path.join(ROOT, 'audit', 'screens', 'baseline');
for (const d of [OUT, JOINT, CAPIN, SHOTS]) fs.mkdirSync(d, { recursive: true });
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? Number(process.argv[i + 1]) : 0; })();
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 1280, h: 720 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }, { w: 360, h: 740 }].filter(v => !only || v.w === only);
// the menu feed JSON is saved only by a full run (a one-width run must not overwrite the captured feed)
const SAVE_FEED = !only;
const capSrc = fs.readFileSync(path.join(CAPIN, 'capture.js'), 'utf8');
const scrollSrc = fs.readFileSync(path.join(CAPIN, 'scroll.js'), 'utf8');
setTimeout(() => { console.error('WATCHDOG: 18 min, exiting'); process.exit(3); }, 18 * 60 * 1000).unref();
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const RAILS = { stock: '5d57c3e', flower: '8e53c92', prerolls: '4bb0a4c', edibles: '31ddafb', vapes: 'd39a484', concentrates: 'fed77f2', recommended: '86cf601' };

const HARVEST = (RAILS) => {
  const vis = el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const TYPE = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'color', 'background-color', 'background-image', 'border-radius', 'border', 'padding', 'box-shadow'];
  const pick = (el, props = TYPE) => { if (!el) return null; const c = getComputedStyle(el); const o = {}; for (const p of props) o[p] = c.getPropertyValue(p); return o; };
  const by = id => document.querySelector(`[data-id="${id}"]`);
  const rails = {};
  for (const [k, id] of Object.entries(RAILS)) {
    const w = by(id); if (!w) { rails[k] = null; continue; }
    const btns = [...w.querySelectorAll('button')].filter(b => /add to cart/i.test(txt(b)));
    const cards = btns.map(b => { let c = b; for (let i = 0; i < 12 && c.parentElement && c.parentElement !== w; i++) { c = c.parentElement; if (c.querySelector('img') && c.querySelectorAll('button').length <= 3) break; } return c; });
    rails[k] = { text: (w.innerText || '').trim(), cards: cards.map(c => ({ text: (c.innerText || '').trim(), lines: (c.innerText || '').split('\n').map(s => s.trim()).filter(Boolean), imgs: [...c.querySelectorAll('img')].map(i => ({ src: i.currentSrc || i.getAttribute('src'), alt: i.getAttribute('alt'), nw: i.naturalWidth, nh: i.naturalHeight })), links: [...c.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: txt(a), aria: a.getAttribute('aria-label') || '' })), del: [...c.querySelectorAll('del,s,[style*=line-through]')].map(txt) })), cardStyle: pick(cards[0]), btnStyle: pick(btns[0]) };
  }
  const anchors = [...document.querySelectorAll('a[href]')].map(a => ({ text: txt(a), href: a.getAttribute('href'), target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '', aria: a.getAttribute('aria-label') || '', visible: vis(a) }));
  const imgs = [...document.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src') || '', current: i.currentSrc || '', alt: i.getAttribute('alt'), nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), visible: vis(i), y: Math.round(i.getBoundingClientRect().top + scrollY) }));
  const bgs = []; for (const el of document.querySelectorAll('*')) { const b = getComputedStyle(el).backgroundImage; if (b && b !== 'none' && /url\(/.test(b)) bgs.push({ id: el.getAttribute('data-id') || '', cls: (el.getAttribute('class') || '').slice(0, 120), bg: b.slice(0, 400), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), y: Math.round(el.getBoundingClientRect().top + scrollY) }); }
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ tag: h.tagName, text: txt(h), visible: vis(h), ...pick(h, ['font-family', 'font-size', 'font-weight', 'font-style', 'color', 'text-transform', 'letter-spacing', 'line-height']) }));
  const loaded = []; document.fonts.forEach(f => { if (f.status === 'loaded') loaded.push(f.family + ' ' + f.weight + ' ' + f.style); });
  const fontFaces = []; for (const s of document.styleSheets) { let rules; try { rules = s.cssRules; } catch (e) { continue; } for (const r of rules) if (r.type === 5) fontFaces.push({ family: r.style.getPropertyValue('font-family'), weight: r.style.getPropertyValue('font-weight'), style: r.style.getPropertyValue('font-style'), src: r.style.getPropertyValue('src').slice(0, 300) }); }
  const store = by('17c6319'); const head = by('e277dc8');
  const headlineCfg = head ? head.querySelector('[data-settings]') : null;
  const chips = by('65533bb');
  return {
    url: location.href, title: document.title, viewport: { w: innerWidth, h: innerHeight }, docH: document.documentElement.scrollHeight,
    body: pick(document.body), rails, anchors, imgs, bgs, headings, loadedFonts: [...new Set(loaded)], fontFaces,
    store: store ? { text: (store.innerText || '').trim(), style: pick(store) } : null,
    headline: head ? { text: (head.innerText || '').trim(), html: head.innerHTML.slice(0, 4000), settings: head.getAttribute('data-settings'), style: pick(head.querySelector('h4') || head) } : null,
    chips: chips ? { text: (chips.innerText || '').trim(), style: pick(chips.querySelector('a')) } : null,
    announce: (() => { const t = by('b39301a'); return t ? { text: (t.innerText || '').trim(), html: t.innerHTML.slice(0, 3000), style: pick(t.querySelector('p') || t) } : null; })(),
    hdr: (() => { const h = document.querySelector('header,[data-elementor-type="header"]'); if (!h) return null; const r = h.getBoundingClientRect(); return { h: Math.round(r.height), pos: getComputedStyle(h).position, bg: getComputedStyle(h).backgroundColor, bgi: getComputedStyle(h).backgroundImage.slice(0, 300) }; })(),
    sectionBgs: [...document.querySelectorAll('.e-con.e-parent, section.elementor-section')].map(s => { const c = getComputedStyle(s); const r = s.getBoundingClientRect(); return { id: s.getAttribute('data-id'), y: Math.round(r.top + scrollY), h: Math.round(r.height), bg: c.backgroundColor, bgi: c.backgroundImage.slice(0, 300), text: (s.innerText || '').trim().slice(0, 80) }; }),
    visibleText: document.body.innerText,
  };
};

const browser = await chromium.launch({ headless: true });
const summary = []; let jn = 0;
try {
  for (const vp of VIEWPORTS) {
    say('viewport', vp.w + 'x' + vp.h);
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'America/Chicago', isMobile: vp.w < 500, hasTouch: vp.w < 500 });
    const page = await ctx.newPage(); const errs = []; const fails = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    page.on('requestfailed', r => fails.push(r.url().slice(0, 200) + ' :: ' + (r.failure() || {}).errorText));
    page.on('response', async r => {
      if (!SAVE_FEED || vp !== VIEWPORTS[0]) return;
      if (!/joint-ecommerce|joint-api|moodiday|admin-ajax/.test(r.url())) return;
      try { const body = await r.text(); if (body.length > 8e6) return; const n = String(++jn).padStart(3, '0');
        fs.writeFileSync(path.join(JOINT, `${n}.json`), JSON.stringify({ url: r.url(), status: r.status(), method: r.request().method(), post: (r.request().postData() || '').slice(0, 20000), body: (() => { try { return JSON.parse(body); } catch (e) { return body.slice(0, 200000); } })() }));
      } catch (e) {}
    });
    const resp = await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 180000 });
    say('  status', resp && resp.status());
    await page.waitForLoadState('load', { timeout: 90000 }).catch(() => say('  load timeout'));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, `fold-${vp.w}.png`) });
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < docH + vp.h; y += Math.round(vp.h * 0.6)) { await page.evaluate(yy => scrollTo({ top: yy, behavior: 'instant' }), y); await page.waitForTimeout(500); }
    const t0 = Date.now(); let n = 0;
    while (Date.now() - t0 < 40000) { n = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /add to cart/i.test(b.innerText || '')).length); if (n >= 60) break; await page.waitForTimeout(1500); }
    say('  add-to-cart buttons', n, 'after', Math.round((Date.now() - t0) / 1000) + 's');
    await page.waitForTimeout(1500);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(800);
    const data = await page.evaluate(HARVEST, RAILS);
    data.consoleErrors = errs.slice(0, 40); data.requestFailed = fails.slice(0, 60);
    fs.writeFileSync(path.join(OUT, `harvest-${vp.w}.json`), JSON.stringify(data, null, 1));
    fs.writeFileSync(path.join(OUT, `rendered-${vp.w}.html`), await page.content());
    say('  rails', Object.entries(data.rails).map(([k, v]) => k + ':' + (v ? v.cards.length : '-')).join(' '), 'docH', data.docH);
    // mobile menu
    if (vp.w < 1000) {
      const opened = await page.evaluate(async () => { const t = document.querySelector('.elementor-menu-toggle, [aria-label*="Menu" i]'); if (!t) return 'no toggle'; t.click(); await new Promise(r => setTimeout(r, 900)); return 'clicked ' + (t.className + '').slice(0, 60); });
      await page.screenshot({ path: path.join(OUT, `menu-${vp.w}.png`) }); say('  menu', opened);
      await page.evaluate(() => { const t = document.querySelector('.elementor-menu-toggle, [aria-label*="Menu" i]'); if (t) t.click(); });
    }
    const cap = await page.evaluate(capSrc).catch(e => ({ error: String(e).slice(0, 200) }));
    fs.writeFileSync(path.join(CAPIN, `cap-${vp.w}.json`), JSON.stringify(cap));
    if (vp.w === 1440 || vp.w === 390) { const sc = await page.evaluate(scrollSrc).catch(e => ({ error: String(e).slice(0, 200) })); fs.writeFileSync(path.join(CAPIN, `scroll-${vp.w}.json`), JSON.stringify(sc)); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(500); }
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: path.join(SHOTS, `index.${vp.w}.png`), fullPage: true, ...(H > 16000 ? { clip: { x: 0, y: 0, width: vp.w, height: 16000 } } : {}) });
    say('  shot ok, docH', H);
    summary.push({ w: vp.w, docH: H, rails: Object.fromEntries(Object.entries(data.rails).map(([k, v]) => [k, v ? v.cards.length : null])), consoleErrors: errs.length, requestFailed: fails.length });
    await ctx.close();
  }
} finally { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 4000))]); }
if (SAVE_FEED) fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ at: new Date().toISOString(), url: URL_, jointResponses: jn, summary }, null, 1));
say('done', JSON.stringify(summary)); process.exit(0);
