// chrome-states.mjs — proves the header's interactive states in a real browser (one Chrome, one page) and screenshots
// them: the desktop mega panels by keyboard (Tab to the button, Enter opens, ArrowDown moves in, Escape closes and
// returns focus, the panel inside the viewport) and by mouse (hover intent: not open at once, open after the delay),
// the condensed header after a scroll, the phone menu with a group opened as an accordion.
//   node qa/chrome-states.mjs --url http://127.0.0.1:8841/about/ --out ../tmp/core-shots     exit 1 on a failed check
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './cdp.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const out = path.resolve(args.out || 'tmp/shots');
fs.mkdirSync(out, { recursive: true });
const checks = [];
const ok = (name, pass, detail = '') => { checks.push({ name, pass }); console.log((pass ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
// a key press as a browser sends it: Enter carries its text (a carriage return), which is what activates a focused button
const key = async (pg, k, code, vk) => { const text = k === 'Enter' ? '\r' : undefined; await pg.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, ...(text ? { text, unmodifiedText: text } : {}) }); await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); await sleep(120); };
const shot = async (pg, name) => { const r = await pg.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, name), Buffer.from(r.data, 'base64')); };

const b = await launch({ port: 0 });
try {
  const pg = await b.newPage({ width: 1280, height: 800 });
  await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pitstop-age-ok','1')}catch(e){}" });
  await pg.goto(args.url, { settle: 900 });
  // keyboard: focus the Explore button, Enter
  await pg.eval(`document.getElementById('nav-link-explore').focus()`);
  await key(pg, 'Enter', 'Enter', 13);
  let st = await pg.eval(`(() => { const btn = document.getElementById('nav-link-explore'), p = document.getElementById('mega-explore'), r = p.getBoundingClientRect(); return { exp: btn.getAttribute('aria-expanded'), vis: getComputedStyle(p).visibility, l: r.left, r: r.right, iw: document.documentElement.clientWidth }; })()`);
  ok('Enter opens Explore (aria-expanded true, panel visible)', st.exp === 'true' && st.vis === 'visible', JSON.stringify(st));
  ok('the Explore panel is inside the viewport', st.l >= 0 && st.r <= st.iw, `left ${st.l.toFixed(0)} right ${st.r.toFixed(0)} of ${st.iw}`);
  await sleep(250); await shot(pg, 'mega-explore.1280.png');
  await key(pg, 'ArrowDown', 'ArrowDown', 40);
  st = await pg.eval(`(() => { const a = document.activeElement; return { inPanel: !!a.closest('#mega-explore'), text: a.textContent.trim(), ring: getComputedStyle(a).outlineStyle }; })()`);
  ok('ArrowDown moves focus to the first link in the panel', st.inPanel, JSON.stringify(st));
  ok('the focused link shows a focus ring', st.ring !== 'none', st.ring);
  await key(pg, 'Escape', 'Escape', 27);
  st = await pg.eval(`(() => ({ exp: document.getElementById('nav-link-explore').getAttribute('aria-expanded'), focus: document.activeElement.id, vis: getComputedStyle(document.getElementById('mega-explore')).visibility }))()`);
  ok('Escape closes the panel and returns focus to its button', st.exp === 'false' && st.focus === 'nav-link-explore', JSON.stringify(st));
  // every mega panel stays inside the viewport at the narrowest full bar
  await pg.viewport(1024, 768); await sleep(400);
  for (const id of ['explore', 'resources', 'locations']) {
    await pg.eval(`(() => { const it = document.getElementById('mega-${id}').closest('.nav__item'); it.classList.add('is-open'); })()`); await sleep(260);
    const r = await pg.eval(`(() => { const r = document.getElementById('mega-${id}').getBoundingClientRect(); return { l: r.left, r: r.right, iw: document.documentElement.clientWidth }; })()`);
    ok(`at 1024 the ${id} panel is inside the viewport`, r.l >= 0 && r.r <= r.iw, `left ${r.l.toFixed(0)} right ${r.r.toFixed(0)} of ${r.iw}`);
    if (id === 'locations') await shot(pg, 'mega-locations.1024.png');
    await pg.eval(`document.getElementById('mega-${id}').closest('.nav__item').classList.remove('is-open')`); await sleep(220);
  }
  // mouse: hover intent
  await pg.viewport(1280, 800); await sleep(400);
  const c = await pg.eval(`(() => { const r = document.getElementById('nav-link-resources').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
  await sleep(30);
  const early = await pg.eval(`document.getElementById('nav-link-resources').getAttribute('aria-expanded')`);
  await sleep(250);
  const late = await pg.eval(`document.getElementById('nav-link-resources').getAttribute('aria-expanded')`);
  ok('hover intent: Resources is not open 30ms after the pointer arrives, open after the delay', early === 'false' && late === 'true', `${early} -> ${late}`);
  await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 600 }); await sleep(450);
  const gone = await pg.eval(`document.getElementById('nav-link-resources').getAttribute('aria-expanded')`);
  ok('the panel closes after the pointer leaves', gone === 'false', gone);
  // condensed header
  await pg.eval('scrollTo(0, 900)'); await sleep(500);
  st = await pg.eval(`(() => { const h = document.querySelector('.site-header'); const bar = h.querySelector('.bar__inner').getBoundingClientRect(); return { cond: h.classList.contains('is-condensed'), barTop: Math.round(bar.top), barH: Math.round(bar.height), visible: Math.round(h.querySelector('.progress').getBoundingClientRect().bottom) }; })()`);
  ok('scrolled, the header condenses to the bar (bar at the top, header bottom = bar height)', st.cond && st.barTop === 0 && Math.abs(st.visible - st.barH) <= 2, JSON.stringify(st));
  await shot(pg, 'header-condensed.1280.png');
  // phone menu
  await pg.viewport(390, 844); await pg.goto(args.url, { settle: 800 });
  await pg.eval(`document.querySelector('[data-menu-open]').click()`); await sleep(400);
  await pg.eval(`document.querySelector('#mmenu [aria-controls="mmenu-sub-explore"]').click()`); await sleep(300);
  st = await pg.eval(`(() => { const m = document.getElementById('mmenu'), s = document.getElementById('mmenu-sub-explore'), t = document.querySelector('#mmenu [aria-controls="mmenu-sub-explore"]'); return { open: m.classList.contains('is-open'), sub: !s.hidden, exp: t.getAttribute('aria-expanded'), words: ['About Us', 'Contact Us', 'Menu', 'Loyalty', 'Locations', 'Deals'].filter((w) => !m.textContent.includes(w)) }; })()`);
  ok('phone menu opens; Explore opens as an accordion', st.open && st.sub && st.exp === 'true', JSON.stringify(st));
  ok("every v2 header word is in the phone menu", st.words.length === 0, st.words.join(', '));
  await shot(pg, 'phone-menu-explore.390.png');
} finally { await b.close(); }
const failed = checks.filter((x) => !x.pass).length;
console.log(`chrome-states: ${checks.length - failed}/${checks.length} checks pass`);
process.exit(failed ? 1 : 0);
