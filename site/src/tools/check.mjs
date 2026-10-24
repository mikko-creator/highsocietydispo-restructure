#!/usr/bin/env node
// check.mjs — the rendered gate (Pit Stop homepage). Proves, in a real browser, that every slide fits its
// viewport in EVERY state (each tab, each accordion item), and that the interactive parts work.
//
//   node src/tools/check.mjs                                  all slides, the six gate viewports
//   node src/tools/check.mjs --slide deals --vp 1280x720,360x640 --shots
//   node src/tools/check.mjs --dir dist --label final --no-states
//
// Exit 0 only when there is not one FAIL. A slide the run could not measure is a FAIL.
// One browser per run; runs are serialised through a 2-slot lock (this Mac hangs on more).

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || (console.error('Set PW_CORE to the playwright-core package directory: this repo ships no machine path.'), process.exit(2)));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

// the four the brief names, its two short screens (720px desktop is one of the four; 640px phone), and the sizes
// that slipped through the last build of this kind: a portrait tablet, a tall phone, a landscape tablet
const GATE_VPS = '1440x900,1280x720,1024x768,768x1024,430x932,390x844,360x740,360x640';   // the brief's four + its two short screens + tablets and a tall phone
const VPS = opt('vp', GATE_VPS).split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h, key: s }; });
const DIR = path.resolve(ROOT, opt('dir', 'dist'));
const ONLY = opt('slide', '');
const LABEL = opt('label', ONLY || 'all');
const SHOTS = flag('shots');
const STATES = !flag('no-states');
const FONTS = opt('fonts', 'allow');      // "block" = refuse the brand webfonts, to prove the fallback faces fit too
const OUTDIR = path.join(ROOT, 'audit', 'check');
fs.mkdirSync(OUTDIR, { recursive: true });

// a hang, not a long run, is what the watchdog is for: the full page (every tab and accordion state) needs longer
const WATCH_MIN = Number(opt('watchdog', '14'));
setTimeout(() => { console.error(`WATCHDOG: ${WATCH_MIN} minutes without finishing — exiting 3`); process.exit(3); }, WATCH_MIN * 60 * 1000).unref();

// ---- 2-slot browser lock ----------------------------------------------------
const LOCKS = path.join(ROOT, 'audit', '.locks'); fs.mkdirSync(LOCKS, { recursive: true });
let lockDir = null;
async function acquire() {
  const t0 = Date.now();
  for (;;) {
    for (const n of [1, 2]) {
      const d = path.join(LOCKS, 'browser-' + n);
      try { fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'owner'), String(process.pid)); lockDir = d; return; } catch (e) {
        try {
          const pid = Number(fs.readFileSync(path.join(d, 'owner'), 'utf8'));
          let alive = true; try { process.kill(pid, 0); } catch { alive = false; }
          const age = Date.now() - fs.statSync(d).mtimeMs;
          if (!alive || age > 16 * 60 * 1000) fs.rmSync(d, { recursive: true, force: true });
        } catch { /* raced */ }
      }
    }
    if (Date.now() - t0 > 12 * 60 * 1000) throw new Error('could not get a browser slot in 12 minutes');
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
  }
}
const release = () => { if (lockDir) fs.rmSync(lockDir, { recursive: true, force: true }); lockDir = null; };
process.on('exit', release); process.on('SIGINT', () => { release(); process.exit(130); }); process.on('SIGTERM', () => { release(); process.exit(143); });

// ---- static server ----------------------------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon' };
const missing = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { missing.push(p); res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';

// ---- in-page measurement ----------------------------------------------------
// Runs with one slide parked at the top of the viewport. Returns every way it fails to fit.
const MEASURE = (slideId) => {
  const s = document.getElementById(slideId);
  const out = { id: slideId, fails: [], notes: [], scrollers: [] };
  if (!s) { out.fails.push('slide not found'); return out; }
  const vw = innerWidth, vh = innerHeight;
  const header = document.querySelector('.site-header'); const dock = document.querySelector('.dock');
  const top = header ? header.getBoundingClientRect().bottom : 0;
  // the bar can stand aside (over the hero, owner 2026-10-22: hidden, out of the tab order): then nothing ends on it
  const dockOn = dock && getComputedStyle(dock).display !== 'none' && getComputedStyle(dock).visibility !== 'hidden';
  // phones: the ORDER NOW / CONTACT US bar spans the screen and the section ends on top of it; from 768px it is a
  // floating pair in the bottom-right corner, inside every section's bottom padding (checked below: nothing under it)
  const dockRect = dockOn ? dock.getBoundingClientRect() : null;
  const floating = !!dockRect && dockRect.width < vw - 1;
  const bottom = dockOn && !floating ? dockRect.top : vh;
  const r = s.getBoundingClientRect();
  out.box = { top: Math.round(r.top), height: Math.round(r.height * 10) / 10, vh, headerBottom: Math.round(top), contentBottom: Math.round(bottom), budget: Math.round(bottom - top) };
  const flow = getComputedStyle(document.documentElement).getPropertyValue('--slide-mode').trim() === 'flow';
  out.box.mode = flow ? 'flow' : 'screen';
  out.box.natural = s.classList.contains('slide--natural');
  if (flow) {
    // the page reserves the header and the dock once; the slide is exactly the space between them (a .slide--natural
    // slide is as tall as its content, and must still fit that space)
    // the last slide (the footer) can only scroll as far as the page ends: there it must sit whole on screen, flush on the
    // bottom edge (the dock's top on phones), instead of under the header
    const atEnd = out.box.natural && !s.nextElementSibling?.matches?.('.slide, main, footer') && Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 1.5;
    out.box.atPageEnd = atEnd;
    if (atEnd ? (r.top < top - 1.5 || Math.abs(r.bottom - bottom) > 1.5) : Math.abs(r.top - top) > 1.5) out.fails.push(atEnd ? `last slide not whole and flush at the page end (top=${r.top.toFixed(1)}, bottom=${r.bottom.toFixed(1)}, content box ${top.toFixed(1)}–${bottom.toFixed(1)})` : `slide not parked under the header (top=${r.top.toFixed(1)}, header ends ${top.toFixed(1)})`);
    if (out.box.natural ? r.height > bottom - top + 1.5 : Math.abs(r.height - (bottom - top)) > 1.5) out.fails.push(`slide height ${r.height.toFixed(1)} ${out.box.natural ? '>' : '!='} the ${Math.round(bottom - top)}px between header and dock`);
  } else {
    if (Math.abs(r.top) > 1.5) out.fails.push(`slide not parked at the top (top=${r.top.toFixed(1)})`);
    if (Math.abs(r.height - vh) > 1.5) out.fails.push(`slide height ${r.height.toFixed(1)} != viewport ${vh}`);
  }
  if (document.documentElement.scrollWidth > vw + 1) out.fails.push(`page scrolls sideways: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);

  const name = (el) => { let n = el.tagName.toLowerCase(); if (el.id) n += '#' + el.id; const c = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.'); if (c) n += '.' + c; return n; };
  const label = (el) => name(el) + ' "' + (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 36) + '"';
  const isDecor = (el) => !!el.closest('.slide__bg, [data-decor], [aria-hidden="true"], .checker');
  // a collapsed "Read more" text: hidden on purpose, opened by its button (each card's open state is measured too)
  const collapsedMore = (p) => p.classList.contains('readmore__text') && (() => { const r = p.closest('[data-readmore]'); return r && r.getAttribute('data-collapsed') !== 'false' && r.getAttribute('data-long') === 'true'; })();
  const openMore = (p) => p.classList.contains('readmore__text') && (() => { const r = p.closest('[data-readmore]'); return r && r.getAttribute('data-collapsed') === 'false'; })();
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; const b = el.getBoundingClientRect(); return b.width > 0.5 && b.height > 0.5; };
  const hasOwnText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true; return false; };
  const scrollerY = (el) => { const o = getComputedStyle(el).overflowY; return ((o === 'auto' || o === 'scroll') && (el.hasAttribute('data-scrolly') || openMore(el))) || collapsedMore(el); };
  const scrollerX = (el) => { const o = getComputedStyle(el).overflowX; return o === 'auto' || o === 'scroll' || el.classList.contains('marquee'); };
  const clips = (el) => { const cs = getComputedStyle(el); return { x: /hidden|clip|auto|scroll/.test(cs.overflowX), y: /hidden|clip|auto|scroll/.test(cs.overflowY) }; };

  // 1. designated vertical scrollers: allowed as the last resort, but they must fit and say so
  for (const el of s.querySelectorAll('.readmore__text')) {
    if (!visible(el) || !openMore(el)) continue;
    const b = el.getBoundingClientRect(); const over = el.scrollHeight - el.clientHeight;
    if (over > 1) { out.scrollers.push({ el: name(el), hidden: Math.round(over), hinted: true }); if (b.height < 88) out.fails.push(`opened "Read more" text ${name(el)} is only ${Math.round(b.height)}px tall — too small to read`); }
  }
  for (const el of s.querySelectorAll('[data-scrolly]')) {
    if (!visible(el)) continue;
    const b = el.getBoundingClientRect(); const over = el.scrollHeight - el.clientHeight;
    if (over > 1) {
      const hinted = el.getAttribute('data-overflow') === 'true';
      out.scrollers.push({ el: name(el), hidden: Math.round(over), hinted });
      if (!hinted) out.fails.push(`internal scroll area ${name(el)} overflows by ${Math.round(over)}px with no scroll hint (data-overflow not set)`);
      if (b.height < 88) out.fails.push(`internal scroll area ${name(el)} is only ${Math.round(b.height)}px tall — too small to read`);
    }
  }

  // 2. every piece of content must sit inside the slide's content box, unclipped
  const seen = new Set();
  const ext = { top: Infinity, bottom: -Infinity };      // where the slide's visible content starts and ends
  const all = s.querySelectorAll('*');
  for (const el of all) {
    // the numbered race box of a section head is decoration to a screen reader but painted on screen: it counts for
    // where the section's visible content starts (2b), nothing else
    if (el.classList.contains('secnum') && visible(el)) { const nb = el.getBoundingClientRect(); ext.top = Math.min(ext.top, nb.top); ext.bottom = Math.max(ext.bottom, nb.bottom); continue; }
    if (isDecor(el) || !visible(el)) continue;
    const tag = el.tagName;
    const content = hasOwnText(el) || /^(IMG|SVG|INPUT|BUTTON|IFRAME|VIDEO|SELECT|TEXTAREA)$/.test(tag) || (tag === 'A' && el.querySelector('img,svg'));
    if (!content) {
      // a painted surface (card, bar, outline) is something on screen too, for the empty-band test (2b)
      const sc = getComputedStyle(el), painted = !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(sc.backgroundColor) || sc.backgroundImage !== 'none' || parseFloat(sc.borderTopWidth) > 0 || parseFloat(sc.borderBottomWidth) > 0 || sc.borderTopStyle === 'dashed';
      if (painted) { const pb = el.getBoundingClientRect(); ext.top = Math.min(ext.top, pb.top); ext.bottom = Math.max(ext.bottom, pb.bottom); }
      continue;
    }
    if (el.closest('svg') && tag !== 'svg' && tag !== 'SVG') continue;
    // For text, measure the TEXT (its line boxes), not padding around it: a link may pad its own
    // box out to a 44px target, and clipping empty padding hides nothing.
    let b = el.getBoundingClientRect();
    if (hasOwnText(el) && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(tag)) {
      const rg = document.createRange(); let tb = null;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) { if (!q.width) continue; tb = tb ? { top: Math.min(tb.top, q.top), bottom: Math.max(tb.bottom, q.bottom), left: Math.min(tb.left, q.left), right: Math.max(tb.right, q.right) } : { top: q.top, bottom: q.bottom, left: q.left, right: q.right }; }
      }
      if (tb) b = tb;
    }
    // nearest ancestors that scroll / clip
    let inY = false, inX = false, clipFail = null;
    for (let p = el.parentElement; p && p !== s.parentElement; p = p.parentElement) {
      if (getComputedStyle(p).display === 'contents') continue;       // generates no box, so it cannot clip
      if (scrollerY(p)) { inY = true; break; }
      const c = clips(p); const pb = p.getBoundingClientRect();
      const px = scrollerX(p);
      if (px) inX = true;
      if (c.y && !clipFail && (b.bottom > pb.bottom + 1.5 || b.top < pb.top - 1.5) && !(tag === 'IMG' && getComputedStyle(el).objectFit !== 'fill')) {
        if (p !== s) clipFail = `${label(el)} is cut off vertically by ${name(p)} (${Math.round(Math.max(b.bottom - pb.bottom, pb.top - b.top))}px hidden)`;
      }
      if (c.x && !px && !clipFail && (b.right > pb.right + 1.5 || b.left < pb.left - 1.5) && !(tag === 'IMG' && getComputedStyle(el).objectFit !== 'fill')) {
        if (p !== s) clipFail = `${label(el)} is cut off horizontally by ${name(p)} (${Math.round(Math.max(b.right - pb.right, pb.left - b.left))}px hidden)`;
      }
    }
    if (!inY) { ext.top = Math.min(ext.top, b.top); ext.bottom = Math.max(ext.bottom, b.bottom); }
    if (inY) continue;                                   // lives inside a hinted scroll area
    if (clipFail && !seen.has(clipFail)) { seen.add(clipFail); out.fails.push(clipFail); }
    if (b.bottom > bottom + 1.5) { const m = `${label(el)} runs ${Math.round(b.bottom - bottom)}px below the slide's content box`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
    if (b.top < top - 1.5) { const m = `${label(el)} sits ${Math.round(top - b.top)}px under the header`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
    if (!inX && (b.right > vw + 1.5 || b.left < -1.5)) { const m = `${label(el)} runs off the side of the screen`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
    // truncation
    const cs = getComputedStyle(el);
    // running copy (a sentence or more) is body text: the brief sets it at 14-16px
    if (hasOwnText(el) && !el.closest('.visually-hidden')) {
      let own = ''; for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
      own = own.replace(/\s+/g, ' ').trim();
      if (own.length >= 70 && parseFloat(cs.fontSize) < 14.95) { const m = `body copy at ${parseFloat(cs.fontSize).toFixed(1)}px (needs 15px or more): ${label(el)}`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
    }
    if (hasOwnText(el) && !el.closest('.visually-hidden')) {      // a screen-reader-only label is a 1px box by design
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.fails.push(`${label(el)} is truncated with an ellipsis`);
      if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) out.fails.push(`${label(el)} is line-clamped`);
      if (cs.overflow !== 'visible' && !scrollerY(el) && !scrollerX(el) && (el.scrollHeight > el.clientHeight + 2) && cs.display !== 'inline') out.fails.push(`${label(el)} has ${el.scrollHeight - el.clientHeight}px of text clipped by its own overflow`);
    }
  }

  // 2a. EDGE SPACING (brief, strict): no text, button, card or image may touch or crowd the section's edges. Sides: at
  // least 16px on phones (the brief's 20px, never under 16), 24px from 768px; full-bleed decoration (the checkered
  // band, the background layer, textures) is exempt. A carousel row is judged by its viewport (its cards scroll inside
  // it): on phones the viewport may run into the RIGHT padding only (the next card's peek, brief: 16–24px).
  // Top and bottom: content keeps 16px clear of the header and of the phone's action bar.
  {
    const SIDE = vw < 768 ? 16 : 24, CLEAR = 16;
    // a carousel row, or a row of controls that scrolls sideways (.scroll-row, the Locations store tabs on phones): only
    // the part inside the row's box is on screen
    const near = (el) => el.closest('.carousel__viewport, .scroll-row');
    const cand = [...s.querySelectorAll('*')].filter((el) => !isDecor(el) && visible(el) && !el.closest('.visually-hidden'));
    const rg2 = document.createRange();
    for (const el of cand) {
      const tag = el.tagName; const cs = getComputedStyle(el);
      const painted = /^(IMG|PICTURE|VIDEO|BUTTON|A)$/.test(tag) || hasOwnText(el) || (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderTopWidth) > 0);
      if (!painted) continue;
      let b = el.getBoundingClientRect();
      if (b.width >= vw - 1) continue;                                      // a full-bleed band (the section's own ground)
      if (hasOwnText(el) && !/^(BUTTON|A)$/.test(tag)) { let tb = null; for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.nodeValue.trim()) continue; rg2.selectNodeContents(n); for (const q of rg2.getClientRects()) { if (!q.width) continue; tb = tb ? { left: Math.min(tb.left, q.left), right: Math.max(tb.right, q.right), top: Math.min(tb.top, q.top), bottom: Math.max(tb.bottom, q.bottom) } : { left: q.left, right: q.right, top: q.top, bottom: q.bottom }; } } if (tb) b = tb; }
      // lines a box clips away (a collapsed Read-more, a scroll area) are not on screen: only the visible part counts
      // (as in 2c). The carousel viewport is left to the carousel rule below.
      { let hidden = false;
        for (let p = el.parentElement; p && p !== s; p = p.parentElement) {
          if (p.classList.contains('carousel__viewport')) continue;
          const pc = getComputedStyle(p); if (pc.display === 'contents' || (pc.overflowX === 'visible' && pc.overflowY === 'visible')) continue;
          const pb = p.getBoundingClientRect();
          const nb = { left: Math.max(b.left, pb.left), right: Math.min(b.right, pb.right), top: Math.max(b.top, pb.top), bottom: Math.min(b.bottom, pb.bottom) };
          if (nb.right <= nb.left + 1 || nb.bottom <= nb.top + 1) { hidden = true; break; }
          b = nb;
        }
        if (hidden) continue; }
      const vpEl = near(el);
      if (vpEl && vpEl !== el) {
        // inside a carousel row: only the part inside the row's viewport is on screen
        const vb = vpEl.getBoundingClientRect(); const l = Math.max(b.left, vb.left), r2 = Math.min(b.right, vb.right);
        if (r2 <= l + 1) continue; b = { left: l, right: r2, top: b.top, bottom: b.bottom };
        const peek = vw < 768 && b.right > vw - SIDE + 1 && b.left > vw - SIDE - 40;   // a card's sliver in the right padding
        if (peek) { if (vw - b.left > 26) out.fails.push(`${label(el)}: the next card peeks ${Math.round(vw - b.left)}px into the right padding (brief: 16–24px)`); continue; }
      }
      if (b.left < SIDE - 1) { const m = `${label(el)} is ${Math.round(b.left)}px from the left edge (needs ${SIDE}px)`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
      if (b.right > vw - SIDE + 1 && !(vpEl === el && vw < 768 && b.right <= vw + 1)) { const m = `${label(el)} is ${Math.round(vw - b.right)}px from the right edge (needs ${SIDE}px)`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
      if (b.top < top + CLEAR - 1 && b.bottom > top) { const m = `${label(el)} is ${Math.round(b.top - top)}px under the header (needs ${CLEAR}px of air)`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
      if (b.bottom > bottom - CLEAR + 1 && b.top < bottom) { const m = `${label(el)} ends ${Math.round(bottom - b.bottom)}px above the ${dockOn && !floating ? 'action bar' : 'screen edge'} (needs ${CLEAR}px)`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
      if (floating) {
        const f = dockRect;
        if (b.right > f.left - 8 && b.left < f.right && b.bottom > f.top - CLEAR + 1 && b.top < f.bottom) { const m = `${label(el)} runs under the floating ORDER NOW / CONTACT US pair`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
      }
    }
  }

  // 2b. no large empty band at a slide's top or bottom (owner, 2026-10-14: "huge gap" between sections on
  // phones). Every slide here is the space under the header (flow mode); desktop keeps a little more air.
  // a slide may declare a background layer that is its content (the hero's photo band) with data-fill
  for (const el of s.querySelectorAll('[data-fill]')) { if (!visible(el)) continue; const fb = el.getBoundingClientRect(); ext.top = Math.min(ext.top, Math.max(fb.top, r.top)); ext.bottom = Math.max(ext.bottom, Math.min(fb.bottom, r.bottom)); }
  // a slide that draws nothing at all (no text, picture, control or declared fill) is one empty band: without this the
  // measure below had no extent to compare and said nothing
  if (flow && !(ext.bottom > ext.top)) out.fails.push(`empty band of ${Math.round(r.height)}px: the slide shows no content (max ${vw >= 1180 ? 150 : 96}px)`);
  if (flow && ext.bottom > ext.top) {
    // a checkered band along a section's top or bottom edge (data-edge-band) is the section's frame: the air is measured
    // from the content to the band, not to the screen edge behind it
    let refTop = r.top, refBottom = r.bottom;
    for (const e of s.querySelectorAll('[data-edge-band]')) { if (!visible(e)) continue; const eb = e.getBoundingClientRect(); if (Math.abs(eb.bottom - r.bottom) <= 2) refBottom = Math.min(refBottom, eb.top); if (Math.abs(eb.top - r.top) <= 2) refTop = Math.max(refTop, eb.bottom); }
    const GAP_MAX = vw >= 1180 ? 150 : 96, above = Math.round(ext.top - refTop), below = Math.round(refBottom - ext.bottom);
    out.box.empty = { above, below };
    if (above > GAP_MAX) out.fails.push(`empty band of ${above}px above the slide's content (max ${GAP_MAX}px)`);
    if (below > GAP_MAX) out.fails.push(`empty band of ${below}px below the slide's content (max ${GAP_MAX}px)`);
  }

  // 2c. text must keep an inner margin from the card, photo or plate it sits on (owner, 2026-10-14: "texts are too
  // close to the edge"). The smallest painted box holding the text is its frame; full-bleed bands are left to
  // the page gutter. Centred text needs the margin on both sides; other text on its leading side, and on the
  // trailing side too when it runs most of the frame's width.
  {
    const EDGE_MIN = 8;
    const paintedBox = (el) => {
      if (isDecor(el)) return false;
      if (/^(IMG|PICTURE|VIDEO|FIGURE)$/.test(el.tagName)) return true;
      const cs = getComputedStyle(el); const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); const parts = m ? m[1].split(',') : [];
      const alpha = !m ? 0 : parts.length > 3 ? parseFloat(parts[3]) : 1;
      return alpha > 0.04 || cs.backgroundImage !== 'none' || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
    };
    const frames = [...s.querySelectorAll('*')].filter((e) => visible(e) && paintedBox(e)).map((e) => ({ e, r: e.getBoundingClientRect() })).filter((f) => f.r.width > 20 && f.r.height > 10 && f.r.width < vw - 2);
    const rg = document.createRange();
    for (const el of s.querySelectorAll('*')) {
      if (isDecor(el) || !visible(el) || el.closest('.visually-hidden')) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;   // a closed answer keeps layout boxes but is not drawn
      let t = null;
      for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.nodeValue.trim()) continue; rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (!q.width) continue; t = t ? { l: Math.min(t.l, q.left), r: Math.max(t.r, q.right), t: Math.min(t.t, q.top), b: Math.max(t.b, q.bottom) } : { l: q.left, r: q.right, t: q.top, b: q.bottom }; } }
      if (!t || t.b < top || t.t > bottom || t.r < 0 || t.l > vw) continue;
      // text scrolled out of a scroll area (or paged out of a carousel) is not on screen: only its visible part counts
      { let wl = 0, wr = vw, wt = top, wb = bottom;
        for (let p = el.parentElement; p && p !== s.parentElement; p = p.parentElement) { const pc = getComputedStyle(p); if (pc.display === 'contents') continue; if (pc.overflowX !== 'visible' || pc.overflowY !== 'visible') { const pb = p.getBoundingClientRect(); wl = Math.max(wl, pb.left); wr = Math.min(wr, pb.right); wt = Math.max(wt, pb.top); wb = Math.min(wb, pb.bottom); } }
        if (t.b <= wt + 1 || t.t >= wb - 1 || t.r <= wl + 1 || t.l >= wr - 1) continue;
        t = { l: Math.max(t.l, wl), r: Math.min(t.r, wr), t: Math.max(t.t, wt), b: Math.min(t.b, wb) }; }
      // text that runs out of its own card (a box it belongs to that paints a colour or a border) is cut by the card's
      // edge: on a dark slide a dark card hides it, on a light or coloured one it shows (category names under the
      // tiles on a 390x844 phone, 2026-10-20)
      for (const c of frames) {
        if (!c.e.contains(el) || c.e === el) continue;
        const r = c.r, over = Math.max(r.left - t.l, t.r - r.right, r.top - t.t, t.b - r.bottom);
        if (over > 1.5 && !/^(IMG|PICTURE|VIDEO|FIGURE)$/.test(c.e.tagName)) { const m = `${label(el)} runs ${Math.round(over)}px out of ${name(c.e)}`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
      }
      let f = null;
      for (const c of frames) { const r = c.r; if (r.left - 1 > t.l || r.right + 1 < t.r || r.top - 1 > t.t || r.bottom + 1 < t.b) continue; if (!f || r.width * r.height < f.r.width * f.r.height) f = c; }
      if (!f) continue;
      const L = t.l - f.r.left, R = f.r.right - t.r, centred = Math.abs(L - R) <= 3;
      const tight = centred ? L < EDGE_MIN : (L < EDGE_MIN || (R < EDGE_MIN && t.r - t.l > f.r.width * .7));
      if (tight) { const m = `${label(el)} sits ${Math.round(Math.min(L, R))}px from the edge of ${name(f.e)} (needs ${EDGE_MIN}px)`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } }
    }
  }

  // 3. tap targets on touch-sized screens
  {   // the brief asks for 44px targets at every width
    for (const el of s.querySelectorAll('a[href], button, input:not([type="hidden"]), summary, [role="tab"], [role="radio"]')) {
      if (!visible(el) || isDecor(el)) continue;
      const cs = getComputedStyle(el);
      // a link inside a sentence (also when the live copy wraps it in <strong>/<em>: walk up through inline wrappers)
      if (el.tagName === 'A' && cs.display === 'inline' && (() => { let p = el.parentElement; while (p && /^(B|STRONG|I|EM|SPAN)$/.test(p.tagName) && !hasOwnText(p)) p = p.parentElement; return p && hasOwnText(p); })()) continue;
      let b = el.getBoundingClientRect();
      // a card-covering link is as big as its ::after
      if (el.classList.contains('cover-link')) { let p = el.offsetParent; while (p && getComputedStyle(p).position === 'static') p = p.offsetParent; if (p) b = p.getBoundingClientRect(); }
      if (el.tagName === 'INPUT' && el.type === 'search') { const f = el.closest('form'); if (f) b = { width: Math.max(b.width, 44), height: b.height }; }
      if (b.width < 43.5 || b.height < 43.5) out.fails.push(`tap target ${label(el)} is ${Math.round(b.width)}x${Math.round(b.height)} (needs 44x44)`);
    }
  }

  // 3b. no text sits on a picture: the brief removes the busy background from behind all content. A text
  // node whose box (or any ancestor inside the slide) paints a url() background fails; a flat colour or a
  // gradient tint does not.
  {
    for (const el of s.querySelectorAll('*')) {
      if (isDecor(el) || !visible(el) || !hasOwnText(el) || el.closest('.visually-hidden')) continue;
      for (let p = el; p && p !== s.parentElement; p = p.parentElement) {
        if (/url\(/.test(getComputedStyle(p).backgroundImage)) { const m = `${label(el)} sits on a background picture (${name(p)})`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); } break; }
      }
    }
  }

  // 3c. nothing covers text: the element at the centre of each text line box must be the text's own element (or
  // inside it). Catches a plate or a button parked on a word (a footer link hidden under the credit plate, 2026-10-20).
  {
    const rg = document.createRange();
    for (const el of s.querySelectorAll('*')) {
      if (isDecor(el) || !visible(el) || !hasOwnText(el) || el.closest('.visually-hidden')) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      // the visible window of this text: every clipping / scrolling ancestor cuts it (a line scrolled out of a hinted
      // scroll area, or a card paged out of a carousel, is not on screen to be covered)
      let win = { l: 0, r: vw, t: top, b: bottom };
      for (let p = el.parentElement; p && p !== s.parentElement; p = p.parentElement) {
        const pc = getComputedStyle(p); if (pc.display === 'contents') continue;
        if (pc.overflowX !== 'visible' || pc.overflowY !== 'visible') { const pb = p.getBoundingClientRect(); win = { l: Math.max(win.l, pb.left), r: Math.min(win.r, pb.right), t: Math.max(win.t, pb.top), b: Math.min(win.b, pb.bottom) }; }
      }
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) {
          if (q.width < 2 || q.height < 2) continue;
          const x = q.left + q.width / 2, y = q.top + q.height / 2;
          if (x < win.l + 1 || x > win.r - 1 || y < win.t + 1 || y > win.b - 1) continue;
          const hit = document.elementFromPoint(x, y);
          if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
          // a card-covering link answers for the whole card through its transparent ::after: that is the card's hit
          // area, not something painted over the words
          if (hit.classList.contains('cover-link') && hit.closest('article, li, .card, .pcard') && hit.closest('article, li, .card, .pcard').contains(el)) continue;
          // an ancestor's ::after (cover-link) or a transparent hit layer is not a cover
          const hs = getComputedStyle(hit);
          if (hit.closest('[aria-hidden="true"], [data-decor]') && (Number(hs.opacity) === 0 || hs.backgroundColor === 'rgba(0, 0, 0, 0)')) continue;
          const m = `${label(el)} is covered by ${name(hit)}`; if (!seen.has(m)) { seen.add(m); out.fails.push(m); }
          break;
        }
      }
    }
  }

  // 4. images
  for (const im of s.querySelectorAll('img')) {
    if (!visible(im)) continue;
    if (im.complete && im.naturalWidth === 0) out.fails.push(`broken image ${im.getAttribute('src')}`);
    if (!im.getAttribute('width') || !im.getAttribute('height')) out.fails.push(`image without width/height: ${im.getAttribute('src')}`);
  }

  // 5. contrast, where the background is a flat colour we can actually read
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return { L: .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]), a: m[3] === undefined ? 1 : m[3], rgb: m }; };
  out.contrast = { checked: 0, overImage: 0, min: 99 };
  // a photo layer the section declares behind its content ([data-photo], e.g. the hero's photo under its scrim): text
  // over it is measured on the rendered pixels (Node side, photoContrast), not against the section's flat colour
  out.photoText = [];
  const photos = [...s.querySelectorAll('[data-photo]')].filter((e) => visible(e)).map((e) => e.getBoundingClientRect());
  const rgP = document.createRange();
  for (const el of all) {
    if (isDecor(el) || !visible(el) || !hasOwnText(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') continue;         // outline type
    const fg = lum(cs.color); if (fg.a < .99) { out.contrast.overImage++; continue; }
    if (photos.length) {
      let tb = null;
      for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.nodeValue.trim()) continue; rgP.selectNodeContents(n); for (const q of rgP.getClientRects()) { if (!q.width) continue; tb = tb ? { l: Math.min(tb.l, q.left), r: Math.max(tb.r, q.right), t: Math.min(tb.t, q.top), b: Math.max(tb.b, q.bottom) } : { l: q.left, r: q.right, t: q.top, b: q.bottom }; } }
      let own = false; for (let p = el; p && p !== s; p = p.parentElement) { const b = lum(getComputedStyle(p).backgroundColor); if (b.a >= .99 || getComputedStyle(p).backgroundImage !== 'none') { own = true; break; } }
      if (tb && !own && photos.some((r) => r.left < tb.r && r.right > tb.l && r.top < tb.b && r.bottom > tb.t)) {
        const px = parseFloat(cs.fontSize);
        out.photoText.push({ label: label(el), rect: { x: Math.max(0, tb.l), y: Math.max(0, tb.t), w: Math.min(innerWidth, tb.r) - Math.max(0, tb.l), h: Math.min(innerHeight, tb.b) - Math.max(0, tb.t) }, fgL: fg.L, big: px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700) });
        continue;
      }
    }
    let bg = null, img = false;
    for (let p = el; p; p = p.parentElement) {
      const pc = getComputedStyle(p);
      if (pc.backgroundImage && pc.backgroundImage !== 'none') { img = true; break; }
      if (p !== el && (pc.position === 'absolute' || pc.position === 'fixed') ) { /* keep walking */ }
      const b = lum(pc.backgroundColor);
      if (b.a >= .99) { bg = b; break; }
      if (b.a > .02) { img = true; break; }
      // a positioned sibling image behind this element also counts as "over an image"
      // (only an image that is laid out BEHIND the text counts: a picture beside it in the same box does not)
      if (p.parentElement) { const eb = el.getBoundingClientRect(); const behind = [...p.parentElement.querySelectorAll(':scope > img, :scope > .media, :scope > picture > img')].some((im) => { const ib = im.getBoundingClientRect(); const pos = getComputedStyle(im.closest('.media') || im).position; return (pos === 'absolute' || pos === 'fixed') && ib.left < eb.right - 1 && ib.right > eb.left + 1 && ib.top < eb.bottom - 1 && ib.bottom > eb.top + 1; }); if (behind) { img = true; break; } }
    }
    if (img || !bg) { out.contrast.overImage++; continue; }
    const ratio = (Math.max(fg.L, bg.L) + .05) / (Math.min(fg.L, bg.L) + .05);
    const px = parseFloat(cs.fontSize); const big = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    out.contrast.checked++; out.contrast.min = Math.min(out.contrast.min, Math.round(ratio * 100) / 100);
    if (ratio < (big ? 3 : 4.5) - .01) out.fails.push(`contrast ${ratio.toFixed(2)}:1 on ${label(el)} (needs ${big ? 3 : 4.5}:1)`);
  }
  return out;
};

// text over a declared photo: the slide's glyphs are made transparent (layout unchanged), the pixels under each text
// box are captured and decoded in the page, and the worst 5% of the background is held to WCAG's ratio (4.5:1, large
// text 3:1): light type against the brightest 5% of what is behind it, dark type against the darkest 5%
const photoContrast = async (page, sid, items) => {
  const fails = []; let min = 99;
  const shown = items.filter((t) => t.rect.w >= 2 && t.rect.h >= 2);
  if (!shown.length) return { fails, min: null, n: 0 };
  await page.evaluate((id) => { const st = document.createElement('style'); st.id = '__pc-hide'; st.textContent = `#${id} *, #${id} *::before, #${id} *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }`; document.head.appendChild(st); }, sid);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  try {
    for (const t of shown) {
      const buf = await page.screenshot({ clip: { x: t.rect.x, y: t.rect.y, width: t.rect.w, height: t.rect.h } });
      const st = await page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data; const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        const L = []; for (let i = 0; i < d.length; i += 4) L.push(.2126 * f(d[i]) + .7152 * f(d[i + 1]) + .0722 * f(d[i + 2]));
        L.sort((a, b) => a - b); const q = (p) => L[Math.min(L.length - 1, Math.floor(p * L.length))];
        return { lo: q(.05), hi: q(.95) };
      }, buf.toString('base64'));
      const ratio = t.fgL >= .5 ? (t.fgL + .05) / (st.hi + .05) : (st.lo + .05) / (t.fgL + .05);
      min = Math.min(min, Math.round(ratio * 100) / 100);
      if (ratio < (t.big ? 3 : 4.5) - .01) fails.push(`contrast ${ratio.toFixed(2)}:1 on the photo behind ${t.label} (needs ${t.big ? 3 : 4.5}:1, measured on the rendered pixels)`);
    }
  } finally { await page.evaluate(() => { const st = document.getElementById('__pc-hide'); if (st) st.remove(); }); }
  return { fails, min, n: shown.length };
};

const PARK = async (page, id) => {
  // the page reserves the header: scrollIntoView honours html scroll-padding-top (the compact header) and the first
  // slide's scroll-margin (the announcement bar), exactly where an in-page link parks a slide
  await page.evaluate((sid) => { const s = document.getElementById(sid); if (!s) return; s.scrollIntoView({ block: 'start', behavior: 'instant' }); }, id);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // the header and the action bar change with the scroll (clear / solid, aside / in): measure once they have settled
  await page.evaluate(() => Promise.race([Promise.all([...document.querySelectorAll('.site-header, .dock')].flatMap((e) => (e.getAnimations ? e.getAnimations() : []).map((a) => a.finished.catch(() => {})))), new Promise((r) => setTimeout(r, 1500))]));
  // wait for this slide's images (lazy ones start loading once it is on screen)
  await page.evaluate(async (sid) => {
    const s = document.getElementById(sid); if (!s) return;
    const t0 = Date.now();
    for (;;) {
      const pending = [...s.querySelectorAll('img')].filter((i) => { const b = i.getBoundingClientRect(); return b.width > 0 && b.left < innerWidth && b.right > 0 && !i.complete; });
      if (!pending.length || Date.now() - t0 > 6000) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }, id);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

// The brand faces are self-hosted (assets/*.woff2). --fonts block refuses them, to prove the fallback faces fit too.
async function kitRoute(context) {
  if (FONTS !== 'block') return;
  await context.route(/\/assets\/[^/?]+\.(woff2|ttf)(\?|$)/, (route) => route.abort());
}

const report = { label: LABEL, dir: path.relative(ROOT, DIR), at: new Date().toISOString(), viewports: [], totals: { fail: 0, checks: 0 } };
const say = (...a) => console.log(...a);

await acquire();
const browser = await chromium.launch({ headless: true });
let exitCode = 0;
try {
  for (const vp of VPS) {
    const V = { key: vp.key, slides: [], page: [], functional: [] };
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: vp.w < 1024, isMobile: false });
    await kitRoute(ctx);
    await ctx.addInitScript(() => { try { localStorage.setItem('pitstop-age-ok', '1'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
    const bad = [];
    page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(BASE, '/')); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Barlow (headings) and Montserrat (body) are served from the build. Give them a few seconds, then measure with
    // whatever is there and RECORD which it was: the layout has to hold with or without them. The H1 must be Barlow at the
    // design's display weight (--fw-display: 500 since the 2026-10-20 Cookies-look pass, 800 before).
    // the brand card's faces, self-hosted: Changa One (display), Changa (heads, buttons), Work Sans (paragraphs)
    V.brandFont = FONTS === 'block' ? false : await page.evaluate(async () => { await Promise.allSettled(['400 1em "Changa One"', '400 1em "Work Sans"', '700 1em "Changa"'].map((f) => document.fonts.load(f))); const t0 = Date.now(); while (Date.now() - t0 < 9000) { await document.fonts.ready; const loaded = (fam, w) => [...document.fonts].some((f) => f.family.replace(/"/g, '') === fam && String(f.weight) === w && f.status === 'loaded'); if (loaded('Changa One', '400') && loaded('Work Sans', '400') && (loaded('Changa', '700') || loaded('Changa', '800') || loaded('Changa', '600'))) return true; await new Promise((r) => setTimeout(r, 200)); } return false; });
    V.h1 = await page.evaluate(() => { const e = document.querySelector('h1'); if (!e) return null; const c = getComputedStyle(e); return { family: c.fontFamily, weight: c.fontWeight, want: '900', fs: c.fontSize, tt: c.textTransform }; });
    // a single-slide build (--only NN-x) has no hero: the H1 checks belong to the full page and the hero's own run
    const h1Due = !ONLY || ONLY === 'home' || !!V.h1;
    if (h1Due && FONTS !== 'block' && (!V.h1 || V.h1.weight !== V.h1.want || !/^"?Changa One/.test(V.h1.family) || V.h1.tt !== 'uppercase' || !V.brandFont)) V.page.push('hero H1 is not rendering in Changa One (drawn at 900, the reskin\'s display weight) uppercase: ' + JSON.stringify(V.h1) + ' brand faces loaded: ' + V.brandFont);
    await page.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 10000 }).catch(() => V.page.push('site.js never finished booting (html.is-ready missing)'));
    const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    if (size.w !== vp.w || size.h !== vp.h) V.page.push(`viewport is ${size.w}x${size.h}, not the ${vp.key} asked for`);

    const ids = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((s) => s.id));
    if (!ids.length) V.page.push('no .slide elements on the page');
    const todo = ONLY ? ids.filter((i) => i === ONLY) : ids;
    if (ONLY && !todo.length) V.page.push(`slide "${ONLY}" not found (have: ${ids.join(', ')})`);

    for (const id of todo) {
      await PARK(page, id);
      const S = { id, states: [] };
      const run = async (state) => {
        await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
        await PARK(page, id);
        const m = await page.evaluate(MEASURE, id);
        if (m.photoText && m.photoText.length) { const pc = await photoContrast(page, id, m.photoText); m.fails.push(...pc.fails); m.contrast.photo = { checked: pc.n, min: pc.min }; }
        S.states.push({ state, fails: m.fails, scrollers: m.scrollers, box: m.box, contrast: m.contrast });
        report.totals.checks++;
        return m;
      };
      await run('default');
      if (SHOTS) { const d = path.join(ROOT, 'audit', 'screens', 'check', LABEL, vp.key); fs.mkdirSync(d, { recursive: true }); await page.screenshot({ path: path.join(d, `${String(ids.indexOf(id) + 1).padStart(2, '0')}-${id}.png`) }); }

      if (STATES) {
        // every tab of every visible tablist, and inside each, every accordion item
        const tablists = await page.evaluate((sid) => [...document.getElementById(sid).querySelectorAll('[role="tablist"]')].filter((l) => !l.hidden && l.getBoundingClientRect().height > 0).map((l) => [...l.querySelectorAll('[role="tab"]')].map((t) => t.id)), id);
        const accStates = async (prefix) => {
          const n = await page.evaluate((sid) => [...document.getElementById(sid).querySelectorAll('details')].filter((d) => d.getBoundingClientRect().height > 0).length, id);
          for (let k = 0; k < n; k++) {
            const q = await page.evaluate(([sid, i]) => { const ds = [...document.getElementById(sid).querySelectorAll('details')].filter((d) => d.getBoundingClientRect().height > 0); const d = ds[i]; if (!d) return null; d.querySelector('summary').click(); if (!d.open) d.querySelector('summary').click(); return (d.querySelector('summary').innerText || '').trim().slice(0, 40); }, [id, k]);
            if (q === null) continue;
            const open = await page.evaluate((sid) => [...document.getElementById(sid).querySelectorAll('details[open]')].filter((d) => d.getBoundingClientRect().height > 0).length, id);
            const m = await run(`${prefix}accordion ${k + 1}/${n} open: ${q}`);
            if (open !== 1) { S.states[S.states.length - 1].fails.push(`accordion: ${open} items open at once (only one may be)`); }
            if (SHOTS && k === 0) { const d = path.join(ROOT, 'audit', 'screens', 'check', LABEL, vp.key); await page.screenshot({ path: path.join(d, `${String(ids.indexOf(id) + 1).padStart(2, '0')}-${id}--${prefix.replace(/[^a-z0-9]+/gi, '-')}acc1.png`) }); }
          }
        };
        if (!tablists.length) await accStates('');
        for (const list of tablists) {
          for (const tid of list) {
            const lbl = await page.evaluate((t) => { const el = document.getElementById(t); el.click(); return el.innerText.trim(); }, tid);
            const ok = await page.evaluate((t) => { const el = document.getElementById(t); const p = document.getElementById(el.getAttribute('aria-controls')); return el.getAttribute('aria-selected') === 'true' && p && !p.hidden; }, tid);
            await run(`tab: ${lbl}`);
            if (!ok) S.states[S.states.length - 1].fails.push(`tab "${lbl}" did not select its panel`);
            if (SHOTS) { const d = path.join(ROOT, 'audit', 'screens', 'check', LABEL, vp.key); await page.screenshot({ path: path.join(d, `${String(ids.indexOf(id) + 1).padStart(2, '0')}-${id}--tab-${lbl.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`) }); }
            await accStates(`tab ${lbl} · `);
          }
          // back to the first tab so the next list starts from the default, and let it lay out
          await page.evaluate((t) => document.getElementById(t).click(), list[0]);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        }
        // carousels: page to the end, the counter must move and the last item must arrive
        const cars = await page.evaluate((sid) => [...document.getElementById(sid).querySelectorAll('[data-carousel]')].filter((c) => c.getBoundingClientRect().height > 0).length, id);
        for (let k = 0; k < cars; k++) {
          const res = await page.evaluate(async ([sid, i]) => {
            const c = [...document.getElementById(sid).querySelectorAll('[data-carousel]')].filter((x) => x.getBoundingClientRect().height > 0)[i];
            const vp = c.querySelector('.carousel__viewport'), next = c.querySelector('[data-next]'), count = c.querySelector('[data-count]');
            const items = [...c.querySelector('.carousel__track').children];
            const max = vp.scrollWidth - vp.clientWidth;
            if (max <= 1) return { static: true, items: items.length };
            if (!next) { vp.scrollLeft = max; await new Promise((r) => setTimeout(r, 120)); }
            else { const first = count ? count.textContent : ''; let guard = 0; while (next.getAttribute('aria-disabled') !== 'true' && guard++ < 60) { next.click(); await new Promise((r) => setTimeout(r, 140)); } var moved = count ? count.textContent !== first : true; }
            const last = items[items.length - 1].getBoundingClientRect(); const vb = vp.getBoundingClientRect();
            const arrived = last.right <= vb.right + 2 && last.left >= vb.left - 2;
            const r = { static: false, items: items.length, arrived, counter: count ? count.textContent : null, moved: next ? moved : true, uiVisible: !!(next && next.getBoundingClientRect().height > 0) || !!c.querySelector('[data-dots]') };
            vp.scrollLeft = 0; await new Promise((r2) => setTimeout(r2, 120));
            return r;
          }, [id, k]);
          const f = [];
          if (!res.static) { if (!res.arrived) f.push(`carousel ${k + 1}: the last of ${res.items} items never comes fully into view`); if (!res.moved) f.push(`carousel ${k + 1}: the counter did not change while paging`); }
          S.states.push({ state: `carousel ${k + 1} (${res.items} items${res.static ? ', all visible' : ', counter ' + res.counter})`, fails: f, scrollers: [] });
          report.totals.checks++;
        }
        // "Read more": each long text opened inside its card (brief: "a fixed card height with Read more expanding
        // inside the card"); the card is brought into view first, measured open, then closed again
        const mores = await page.evaluate((sid) => [...document.getElementById(sid).querySelectorAll('[data-readmore]')].filter((r) => r.getAttribute('data-long') === 'true').length, id);
        for (let k = 0; k < mores; k++) {
          const who = await page.evaluate(async ([sid, i]) => {
            const r = [...document.getElementById(sid).querySelectorAll('[data-readmore]')].filter((x) => x.getAttribute('data-long') === 'true')[i];
            const vp = r.closest('.carousel__viewport'), item = r.closest('.carousel__track > *');
            if (vp && item) { vp.scrollLeft = Math.min(item.offsetLeft - item.parentElement.offsetLeft, vp.scrollWidth - vp.clientWidth); await new Promise((q) => setTimeout(q, 160)); }
            const h0 = r.closest('li, article, .card') ? r.closest('li, article, .card').getBoundingClientRect().height : 0;
            r.querySelector('.readmore__btn').click(); await new Promise((q) => setTimeout(q, 120));
            const h1 = r.closest('li, article, .card') ? r.closest('li, article, .card').getBoundingClientRect().height : 0;
            return { name: (r.closest('li, article, .card') || r).innerText.trim().split('\n').filter(Boolean).slice(-1)[0].slice(0, 30), open: r.getAttribute('data-collapsed') === 'false', expanded: r.querySelector('.readmore__btn').getAttribute('aria-expanded'), grew: Math.round(h1 - h0) };
          }, [id, k]);
          const m = await run(`read more ${k + 1}/${mores} open: ${who.name}`);
          if (!who.open || who.expanded !== 'true') S.states[S.states.length - 1].fails.push(`"Read more" ${k + 1} did not open (aria-expanded ${who.expanded})`);
          if (Math.abs(who.grew) > 1) S.states[S.states.length - 1].fails.push(`"Read more" ${k + 1} changed its card's height by ${who.grew}px (brief: a fixed card height)`);
          if (SHOTS && k === 0) { const d = path.join(ROOT, 'audit', 'screens', 'check', LABEL, vp.key); await page.screenshot({ path: path.join(d, `${String(ids.indexOf(id) + 1).padStart(2, '0')}-${id}--readmore1.png`) }); }
          await page.evaluate(async ([sid, i]) => { const r = [...document.getElementById(sid).querySelectorAll('[data-readmore]')].filter((x) => x.getAttribute('data-long') === 'true')[i]; r.querySelector('.readmore__btn').click(); const vp = r.closest('.carousel__viewport'); if (vp) vp.scrollLeft = 0; await new Promise((q) => setTimeout(q, 120)); }, [id, k]);
        }
      }
      V.slides.push(S);
    }

    // page-level
    // in --fonts block mode the one refused request (the font kit) is ours, not a page defect
    const realErrors = FONTS === 'block' ? errors.filter((e) => !/net::ERR_FAILED/.test(e)) : errors;
    if (realErrors.length) V.page.push('console errors: ' + [...new Set(realErrors)].join(' | '));
    if (bad.length) V.page.push('failed requests: ' + [...new Set(bad)].join(', '));
    await ctx.close();

    // ---- functional pass, once per viewport, in a FRESH visitor ------------
    if (!ONLY && !flag('no-functional')) {
      const c2 = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, hasTouch: vp.w < 1024 });
      await kitRoute(c2);
      const p2 = await c2.newPage();
      const F = V.functional; const need = (ok, msg) => { report.totals.checks++; if (!ok) F.push(msg); };
      await p2.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p2.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 10000 }).catch(() => {});
      await p2.evaluate(() => document.fonts && document.fonts.ready);
      const WIDE = vp.w >= 1180;

      // NO SNAP, NO LOCK (brief: NATURAL SCROLLING): nothing on the page snaps, the page itself scrolls
      const snap = await p2.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return c.scrollSnapType && c.scrollSnapType !== 'none'; }).map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '')));
      need(!snap.length, 'scroll snapping is on: ' + snap.slice(0, 6).join(', '));

      // the age gate: a first-time visitor meets it, it holds focus, it does not close on Escape, "Yes" lets them in
      await p2.waitForFunction(() => { const g = document.getElementById('agegate'); return g && g.classList.contains('is-open') && g.contains(document.activeElement); }, null, { timeout: 4000 }).catch(() => {});
      const g1 = await p2.evaluate(() => { const g = document.getElementById('agegate'); if (!g) return { shown: false, missing: true, title: '', lines: [], btns: [] }; return { shown: !!g && !g.hidden && g.classList.contains('is-open'), focusIn: !!g && g.contains(document.activeElement), title: g ? g.querySelector('h2').textContent.trim() : '', lines: g ? [...g.querySelectorAll('p')].map((x) => x.textContent.trim()) : [], btns: g ? [...g.querySelectorAll('.btn')].map((x) => x.textContent.trim()) : [], locked: document.body.classList.contains('is-locked') }; });
      need(g1.shown && g1.focusIn && g1.locked, 'age gate: not shown to a first-time visitor with focus inside and the page locked: ' + JSON.stringify(g1));
      need(g1.title === 'ARE YOU 21 OR OLDER?' && g1.lines.join('|') === 'To continue, please confirm your age.|By clicking "Yes," you confirm that you meet the age requirement.' && g1.btns.join('|') === 'Yes, I’m 21 or older|No, I’m under 21', 'age gate: words differ from the reskin: ' + JSON.stringify(g1));
      if (g1.shown) {
        for (let t = 0; t < 5; t++) await p2.keyboard.press('Tab');
        await p2.keyboard.press('Escape'); await p2.waitForTimeout(250);
        const g2 = await p2.evaluate(() => { const g = document.getElementById('agegate'); return { stillOpen: g.classList.contains('is-open'), focusIn: g.contains(document.activeElement) }; });
        need(g2.stillOpen && g2.focusIn, 'age gate: Tab let focus out, or Escape closed it without an answer: ' + JSON.stringify(g2));
        await p2.click('#agegate [data-age-yes]', { timeout: 5000 }).catch(() => {}); await p2.waitForTimeout(350);
        const g3 = await p2.evaluate(() => ({ hidden: document.getElementById('agegate').hidden, locked: document.body.classList.contains('is-locked'), stored: (() => { try { return localStorage.getItem('pitstop-age-ok'); } catch (e) { return null; } })() }));
        need(g3.hidden && !g3.locked && g3.stored === '1', 'age gate: "Yes" did not close it and remember the answer: ' + JSON.stringify(g3));
        await p2.reload({ waitUntil: 'domcontentloaded' }); await p2.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 10000 }).catch(() => {});
        need(await p2.evaluate(() => { const g = document.getElementById('agegate'); return !!g && g.hidden; }), 'age gate: shown again after the visitor answered');
      } else {
        // the rest of the pass needs a page the visitor can use: answer for them the way "Yes" would
        await p2.evaluate(() => { try { localStorage.setItem('pitstop-age-ok', '1'); } catch (e) { /* */ } });
        await p2.reload({ waitUntil: 'domcontentloaded' }); await p2.waitForFunction(() => document.documentElement.classList.contains('is-ready'), null, { timeout: 10000 }).catch(() => {});
        await p2.evaluate(() => { const g = document.querySelector('.agegate'); if (g) { g.hidden = true; g.classList.remove('is-open'); } document.body.classList.remove('is-locked'); });
      }
      await p2.evaluate(() => document.fonts && document.fonts.ready);

      // the header: one slim sticky bar, every control a 44px target
      const hd = await p2.evaluate(() => {
        const hdr = document.querySelector('.site-header'); const r = hdr.getBoundingClientRect();
        const px = (v) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;height:' + v; document.body.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h; };
        const small = [];
        for (const el of hdr.querySelectorAll('a[href], button')) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const b = el.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue; if (el.closest('.nav__sub') && getComputedStyle(el.closest('.nav__sub')).visibility === 'hidden') continue; if (b.width < 43.5 || b.height < 43.5) small.push(`${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24)} ${Math.round(b.width)}x${Math.round(b.height)}`); }
        const logo = hdr.querySelector('.logo img').getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height), bar: Math.round(px('var(--bar-h)')), small, logoW: Math.round(logo.width), fixed: getComputedStyle(hdr).position };
      });
      need(hd.top === 0 && Math.abs(hd.height - hd.bar) <= 1 && hd.fixed === 'fixed', `header: should be a fixed ${hd.bar}px bar at the top: ${JSON.stringify(hd)}`);
      need(!hd.small.length, 'header: controls under 44px: ' + hd.small.join(' · '));
      if (WIDE) need(hd.logoW >= 189.5, `header: the lockup is ${hd.logoW}px wide (brand card: about 190px minimum for the web version)`);
      // stays put while the page scrolls
      await p2.evaluate(() => { const all = document.querySelectorAll('.slide'); const s = all[Math.min(2, all.length - 1)]; if (s) s.scrollIntoView({ block: 'start', behavior: 'instant' }); }); await p2.waitForTimeout(300);
      need(await p2.evaluate(() => Math.round(document.querySelector('.site-header').getBoundingClientRect().top) === 0 && window.scrollY > 100), 'header: did not stay at the top while the page scrolled (or the page did not scroll)');
      await p2.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p2.waitForTimeout(250);

      const NAV = 'Menu|Loyalty|Locations|Contact Us|About Us|Deals';
      const STORES = 'Big Rapids|Birch Run|Charlotte|East Lansing|Lenox|Mount Pleasant|New Buffalo|Saline';
      if (WIDE) {
        const nav = await p2.evaluate(() => ({ items: [...document.querySelectorAll('.nav .nav__link')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()), actions: [...document.querySelectorAll('.bar__actions .btn')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()), order: (() => { const l = document.querySelector('.logo').getBoundingClientRect(), n = document.querySelector('.nav').getBoundingClientRect(), a = document.querySelector('.bar__actions').getBoundingClientRect(); return l.right <= n.left + 1 && n.right <= a.left + 1; })() }));
        need(nav.items.join('|') === NAV, 'desktop nav: items differ from the reskin: ' + nav.items.join('|'));
        need(nav.actions.join('|') === 'Select a Location|Join The Society', 'desktop bar: the right-hand actions should be Select a Location, Join The Society: ' + nav.actions.join('|'));
        need(nav.order, 'desktop bar: not logo left, nav centre, actions right');
        const dd = await p2.evaluate(async () => {
          const b = document.querySelector('.nav__item--sub > button'); b.focus(); b.click(); await new Promise((r) => setTimeout(r, 320));
          const sub = document.getElementById(b.getAttribute('aria-controls')); const cs = getComputedStyle(sub); const r = sub.getBoundingClientRect();
          const res = { expanded: b.getAttribute('aria-expanded'), visible: cs.visibility === 'visible' && Number(cs.opacity) > .9, inView: r.right <= innerWidth && r.left >= 0 && r.bottom <= innerHeight, links: [...sub.querySelectorAll('a')].map((a) => a.textContent.trim()), tall: [...sub.querySelectorAll('a')].every((a) => a.getBoundingClientRect().height >= 44) };
          sub.querySelector('a').focus();
          document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 320));
          res.afterEsc = { expanded: b.getAttribute('aria-expanded'), visible: getComputedStyle(sub).visibility === 'visible' && Number(getComputedStyle(sub).opacity) > .5, focusBack: document.activeElement === b };
          return res;
        });
        need(dd.expanded === 'true' && dd.visible && dd.inView && dd.tall, 'desktop nav: the Locations dropdown did not open on screen with 44px items: ' + JSON.stringify(dd));
        need(dd.links.join('|') === STORES, 'desktop nav: Locations dropdown items: ' + dd.links.join('|'));
        need(dd.afterEsc.expanded === 'false' && !dd.afterEsc.visible && dd.afterEsc.focusBack, 'desktop nav: Escape did not close the dropdown and return focus: ' + JSON.stringify(dd.afterEsc));
      } else {
        const tools = await p2.evaluate(() => [...document.querySelectorAll('.bar__tools a, .bar__tools button')].map((a) => (a.textContent.trim() || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ')));
        need(tools.join('|') === 'Select Location|Open mobile navigation from the right', 'phone bar: should hold Select Location and the menu button: ' + tools.join('|'));
        await p2.click('[data-menu-open]'); await p2.waitForTimeout(350);
        const m1 = await p2.evaluate(() => { const m = document.getElementById('mmenu'); const b = m.getBoundingClientRect(); return { open: m.classList.contains('is-open') && !m.hidden, full: b.width >= innerWidth - 1 && b.height >= innerHeight - 1, top: [...m.querySelectorAll('.mmenu__link')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()), acts: [...m.querySelectorAll('.mmenu__actions .btn')].map((a) => a.textContent.trim()), focusIn: m.contains(document.activeElement) }; });
        need(m1.open && m1.full && m1.focusIn, 'phone menu: did not open full-screen with focus inside: ' + JSON.stringify(m1));
        need(m1.top.join('|') === NAV, 'phone menu: items differ from the reskin: ' + m1.top.join('|'));
        need(m1.acts.join('|') === 'Select a Location|Join The Society', 'phone menu: actions: ' + m1.acts.join('|'));
        const acc = await p2.evaluate(async () => { const t = document.querySelector('#mmenu .mmenu__toggle'); const sub = document.getElementById(t.getAttribute('aria-controls')); const before = !sub.hidden; t.click(); await new Promise((r) => setTimeout(r, 80)); const r = { before, open: !sub.hidden && t.getAttribute('aria-expanded') === 'true', links: [...sub.querySelectorAll('a')].map((a) => a.textContent.trim()) }; t.click(); await new Promise((q) => setTimeout(q, 80)); r.closed = sub.hidden && t.getAttribute('aria-expanded') === 'false'; return r; });
        need(!acc.before && acc.open && acc.closed, 'phone menu: the Locations accordion does not open and close: ' + JSON.stringify(acc));
        need(acc.links.join('|') === STORES, 'phone menu: Locations accordion items: ' + acc.links.join('|'));
        const tap = await p2.evaluate(() => [...document.querySelectorAll('#mmenu a[href], #mmenu button')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => { const b = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) }; }).filter((x) => x.w < 44 || x.h < 44));
        need(!tap.length, 'phone menu: tap targets under 44px: ' + JSON.stringify(tap).slice(0, 300));
        for (let t = 0; t < 14; t++) await p2.keyboard.press('Tab');
        need(await p2.evaluate(() => document.getElementById('mmenu').contains(document.activeElement)), 'phone menu: Tab let focus out of the open menu');
        await p2.keyboard.press('Escape'); await p2.waitForTimeout(350);
        need(await p2.evaluate(() => !document.getElementById('mmenu').classList.contains('is-open') && document.activeElement && document.activeElement.hasAttribute('data-menu-open')), 'phone menu: Escape did not close it and return focus');
        // the menu's own "Select a Location": the menu closes, the chooser opens, and Escape brings focus back to a
        // control on screen (the menu button), not to the header's link that is not shown below 1180px
        await p2.click('[data-menu-open]'); await p2.waitForTimeout(350);
        await p2.focus('#mmenu [data-locator-open]'); await p2.keyboard.press('Enter'); await p2.waitForTimeout(400);
        const viaMenu = await p2.evaluate(() => ({ menuOpen: document.getElementById('mmenu').classList.contains('is-open'), chooser: document.getElementById('dispenzaLocationPopup-open').classList.contains('is-open') }));
        await p2.keyboard.press('Escape'); await p2.waitForTimeout(400);
        const back = await p2.evaluate(() => { const a = document.activeElement; return { onMenuButton: !!(a && a.hasAttribute('data-menu-open')), shown: !!(a && a.getClientRects().length), tag: a ? a.tagName + '.' + a.className : null }; });
        need(!viaMenu.menuOpen && viaMenu.chooser && back.onMenuButton && back.shown, 'store chooser from the phone menu: focus did not come back to the menu button: ' + JSON.stringify({ viaMenu, back }));
      }

      // the store chooser: modal on desktop, bottom sheet on phones; all eight stores as the popup states them
      const opener = WIDE ? '.bar__actions [data-locator-open]' : '.bar__tools [data-locator-open]';
      await p2.focus(opener); await p2.keyboard.press('Enter'); await p2.waitForTimeout(400);
      const lc = await p2.evaluate(() => {
        const d = document.getElementById('dispenzaLocationPopup-open'); const p = d.querySelector('.dialog__panel').getBoundingClientRect();
        const stores = [...d.querySelectorAll('.store')].map((s) => ({ n: s.querySelector('.store__name').textContent.trim(), a: s.querySelector('.store__addr').innerText.replace(/\n/g, ' | ').trim(), t: s.querySelector('.store__phone').textContent.trim(), b: [...s.querySelectorAll('.store__ctas .btn')].map((x) => x.textContent.trim()) }));
        return { open: d.classList.contains('is-open') && !d.hidden, focusIn: d.contains(document.activeElement), stores, sheet: Math.abs(p.bottom - innerHeight) <= 1 && p.width >= innerWidth - 1, centred: p.left > 1 && Math.abs((innerWidth - p.right) - p.left) <= 2, title: d.querySelector('.dialog__title').textContent.trim() };
      });
      need(lc.open && lc.focusIn && lc.title === 'Select Location', 'store chooser: did not open with focus inside: ' + JSON.stringify({ open: lc.open, focusIn: lc.focusIn, title: lc.title }));
      need(lc.stores.map((x) => x.n).join('|') === 'Charlotte|Mount Pleasant|Saline|East Lansing|Lenox|Birch Run|Big Rapids|New Buffalo', 'store chooser: stores or order differ from the popup: ' + lc.stores.map((x) => x.n).join('|'));
      need(lc.stores.length === 8 && lc.stores.filter((x) => x.b.join('|') === 'SELECT LOCATION|SHOP NOW|VIEW LOCATION').length === 7 && lc.stores[7].b.join('|') === 'SELECT LOCATION|SHOP NOW', 'store chooser: buttons differ (7 stores with all three, New Buffalo without VIEW LOCATION): ' + JSON.stringify(lc.stores.map((x) => x.b.length)));
      need(lc.stores.length === 8 && lc.stores[0].a === '515 Lansing St | Charlotte, MI 48813-1100' && lc.stores[7].t === '(269) 231-5213', 'store chooser: addresses/phones are not the popup\'s own: ' + JSON.stringify(lc.stores[0]) + JSON.stringify(lc.stores[7]));
      need(vp.w < 768 ? lc.sheet : lc.centred, `store chooser: should be ${vp.w < 768 ? 'a bottom sheet across the screen' : 'a centred modal'}`);
      for (let t = 0; t < 30; t++) await p2.keyboard.press('Tab');
      need(await p2.evaluate(() => document.getElementById('dispenzaLocationPopup-open').contains(document.activeElement)), 'store chooser: Tab let focus out of the open dialog');
      // the dialog hides on a 220ms timer after its closing transition: wait for the closed state itself (up to 2s), not
      // a fixed time a loaded machine can overrun
      await p2.keyboard.press('Escape');
      const closed = (sel) => document.getElementById('dispenzaLocationPopup-open').hidden && document.activeElement === document.querySelector(sel) && !document.body.classList.contains('is-locked');
      await p2.waitForFunction(closed, opener, { timeout: 2000 }).catch(() => {});
      need(await p2.evaluate(closed, opener), 'store chooser: Escape did not close it and return focus to its opener');

      // a link the CMS has not filled ({{location_shop_url}}) asks for the store instead of going nowhere
      const tok = await p2.evaluate(async () => { const a = [...document.querySelectorAll('a[href*="{{location_shop_url}}"]')].find((x) => x.getBoundingClientRect().height > 0); if (!a) return null; const before = location.href; a.click(); await new Promise((r) => setTimeout(r, 350)); const d = document.getElementById('dispenzaLocationPopup-open'); const r = { text: a.textContent.trim(), opened: d.classList.contains('is-open'), stayed: location.href === before }; d.querySelector('[data-dialog-close]').click(); await new Promise((q) => setTimeout(q, 300)); return r; });
      need(tok && tok.opened && tok.stayed, 'a {{location_shop_url}} link did not open the store chooser: ' + JSON.stringify(tok));

      // ORDER NOW / CONTACT US (owner, 2026-10-22): aside over the hero (hidden, out of the tab order), then a bottom bar
      // on phones and a floating pair from 768px once the hero has scrolled past
      await p2.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p2.waitForTimeout(450);
      const dkHero = await p2.evaluate(() => { const d = document.querySelector('.dock'); return d ? getComputedStyle(d).visibility : 'missing'; });
      need(dkHero === 'hidden', 'action bar: should stand aside over the hero (owner, 2026-10-22), visibility is ' + dkHero);
      await p2.evaluate(() => { const s = document.querySelectorAll('.slide')[1]; if (s) s.scrollIntoView({ block: 'start', behavior: 'instant' }); }); await p2.waitForTimeout(450);
      const dk = await p2.evaluate(() => { const d = document.querySelector('.dock'); const r = d.getBoundingClientRect(); const b = [...d.querySelectorAll('.btn')].map((x) => { const q = x.getBoundingClientRect(); return { t: x.textContent.trim(), w: Math.round(q.width), h: Math.round(q.height) }; }); return { bottom: Math.round(r.bottom), left: Math.round(r.left), width: Math.round(r.width), b, fixed: getComputedStyle(d).position }; });
      need(dk.fixed === 'fixed' && dk.b.map((x) => x.t).join('|') === 'ORDER NOW|CONTACT US' && dk.b.every((x) => x.h >= 44 && x.w >= 44), 'action bar: ORDER NOW / CONTACT US missing or under 44px: ' + JSON.stringify(dk));
      need(vp.w < 768 ? (dk.bottom === vp.h && dk.left === 0 && dk.width === vp.w) : (dk.width < vp.w / 2 && vp.h - dk.bottom >= 8), `action bar: should be ${vp.w < 768 ? 'a bar along the bottom of the screen' : 'a compact floating pair'}: ` + JSON.stringify(dk));

      // motion on: after a human-paced scroll nothing may be left invisible. Each slide gets up to 4 s for its entrance
      // to finish (they take ~0.5-0.8 s; on this shared Mac under load a slow frame stretched one past a fixed 1.3 s
      // wait on old and new builds alike, 2026-10-20), so only content that never appears fails.
      const stuck = await p2.evaluate(async () => {
        const out = [];
        for (const s of document.querySelectorAll('.slide')) {
          s.scrollIntoView({ block: 'start', behavior: 'instant' });
          const hidden = () => [...s.querySelectorAll('.reveal')].filter((el) => el.getBoundingClientRect().height > 0 && Number(getComputedStyle(el).opacity) < .98);
          const t0 = performance.now(); await new Promise((r) => setTimeout(r, 600));
          while (hidden().length && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 100));
          for (const el of hidden()) out.push(s.id + ': ' + (el.className || el.tagName).toString().slice(0, 40));
        }
        return out;
      });
      need(!stuck.length, 'entrance animation left content invisible: ' + stuck.slice(0, 6).join(' | '));
      await c2.close();
    }
    report.viewports.push(V);
  }
} catch (e) {
  console.error('CHECK CRASHED:', e && e.stack || e); exitCode = 2;
} finally {
  await browser.close(); server.close(); release();
}

// ---- report -----------------------------------------------------------------
let fails = 0;
for (const V of report.viewports) {
  const lines = [];
  for (const m of V.page) { lines.push('  PAGE  ' + m); fails++; }
  for (const S of V.slides) {
    const bad = S.states.filter((st) => st.fails.length);
    const scroll = S.states.flatMap((st) => st.scrollers.map((x) => `${st.state}: ${x.el} scrolls ${x.hidden}px`));
    const box = S.states[0] && S.states[0].box;
    lines.push(`  ${bad.length ? 'FAIL' : 'ok  '}  ${S.id.padEnd(10)} ${S.states.length} state(s)${box ? ` · budget ${box.budget}px` : ''}${scroll.length ? ` · internal scroll in ${scroll.length} state(s)` : ''}`);
    for (const st of bad) { for (const f of st.fails.slice(0, 8)) lines.push(`          [${st.state}] ${f}`); if (st.fails.length > 8) lines.push(`          [${st.state}] …and ${st.fails.length - 8} more`); fails += st.fails.length; }
  }
  for (const m of V.functional) { lines.push('  FUNC  ' + m); fails++; }
  say(`\n== ${V.key} ==`); lines.forEach((l) => say(l));
}
if (missing.length) { say('\n404 from the build: ' + [...new Set(missing)].join(', ')); fails += new Set(missing).size; }
if (!report.viewports.length || report.viewports.some((V) => !V.slides.length && !V.page.length)) { say('\nNOTHING MEASURED — treating as failure'); fails++; }
// A run that died part-way has NOT checked the viewports it never reached: say so and fail.
const reached = new Set(report.viewports.map((V) => V.key));
const unreached = VPS.map((v) => v.key).filter((k) => !reached.has(k));
if (unreached.length) { say('\nNOT MEASURED (run stopped early): ' + unreached.join(', ')); fails += unreached.length; }
if (exitCode) { say('\nTHE RUN CRASHED — the result below is incomplete'); fails++; }
report.totals.fail = fails; report.missing = [...new Set(missing)];
fs.writeFileSync(path.join(OUTDIR, LABEL + '.json'), JSON.stringify(report, null, 1));
const withBrand = report.viewports.filter((V) => V.brandFont).length;
say(`\nbrand faces (Changa One + Changa + Work Sans, self-hosted): ${FONTS === 'block' ? 'BLOCKED on purpose — fallback faces measured' : withBrand === report.viewports.length ? 'loaded at every viewport measured' : 'loaded at ' + withBrand + ' of ' + report.viewports.length + ' viewports — the rest were measured with the FALLBACK faces'}`);
report.fonts = { mode: FONTS, brandLoadedAt: report.viewports.filter((V) => V.brandFont).map((V) => V.key) };
say(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s) across ${report.totals.checks} state measurements · report audit/check/${LABEL}.json`);
process.exit(exitCode || (fails ? 1 : 0));
