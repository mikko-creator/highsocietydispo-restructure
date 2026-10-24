// bar-ladder.mjs — does the desktop header bar fit? (contract §2.9: "the header never overlaps itself at any width";
// measured with a REAL 15px scrollbar: qa/cdp-realsb.mjs). One Chrome, one page. For every window width from --from
// to --to (step --step) it loads the page and measures the bar row (.bar__inner) twice:
//   forced   the full desktop bar shown at every width (nav + Join; the menu button hidden): where does it stop fitting?
//   live     the page as built: the bar the visitor gets at that width (full bar or menu button)
// A bar FITS when the lockup, every nav item and the action button sit left to right without overlapping (>= 0px gap),
// no item wraps (each item one line: its height <= 1.5x its font line), and nothing spills out of the row.
// Also prints the promo row and the category bar (no overlap, no wrap) for the live state.
//   node qa/bar-ladder.mjs --url http://127.0.0.1:8841/ [--from 1024 --to 1440 --step 16]     exit 1 if a LIVE bar fails
import { launch, sleep } from './cdp-realsb.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const from = Number(args.from || 1024), to = Number(args.to || 1440), step = Number(args.step || 16);
const FORCE = '.nav, .bar__actions { display: flex !important; } .bar__tools { display: none !important; }';
const measure = `(() => {
  const row = document.querySelector('.site-header .bar__inner');
  const vis = (el) => el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const parts = [];
  const logo = row.querySelector('.logo'); if (vis(logo)) parts.push({ k: 'logo', ...box(logo) });
  for (const li of row.querySelectorAll('.nav__list > .nav__item')) if (vis(li)) {
    const a = li.querySelector('.nav__link');
    const lh = parseFloat(getComputedStyle(a).fontSize) * 1.5;
    const textH = (() => { const rg = document.createRange(); rg.selectNodeContents(a); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); const top = Math.min(...rs.map((x) => x.top)), bot = Math.max(...rs.map((x) => x.bottom)); return bot - top; })();
    parts.push({ k: 'nav:' + a.textContent.trim(), ...box(li), wrap: textH > lh });
  }
  const act = row.querySelector('.bar__actions'); if (vis(act)) for (const b of act.children) parts.push({ k: 'action:' + b.textContent.trim(), ...box(b), wrap: b.getBoundingClientRect().height > 60 });
  const tools = row.querySelector('.bar__tools'); if (vis(tools)) for (const b of tools.children) parts.push({ k: 'tool', ...box(b) });
  parts.sort((x, y) => x.l - y.l);
  let minGap = Infinity, overlaps = [], wraps = parts.filter((p) => p.wrap).map((p) => p.k);
  for (let i = 1; i < parts.length; i++) { const g = parts[i].l - parts[i - 1].r; minGap = Math.min(minGap, g); if (g < -0.5) overlaps.push(parts[i - 1].k + ' / ' + parts[i].k + ' ' + g.toFixed(1)); }
  const rb = row.getBoundingClientRect(), cs = getComputedStyle(row);
  const contentR = rb.right - parseFloat(cs.paddingRight), contentL = rb.left + parseFloat(cs.paddingLeft);
  const spill = parts.filter((p) => p.r > contentR + 0.5 || p.l < contentL - 0.5).map((p) => p.k);
  const mode = vis(row.querySelector('.nav')) ? 'full bar' : 'menu button';
  // the promo row and the category bar (live only)
  const util = document.querySelector('.util__inner'), utilParts = util ? [...util.children].filter(vis).map(box).sort((x, y) => x.l - y.l) : [];
  let utilOverlap = 0; for (let i = 1; i < utilParts.length; i++) if (utilParts[i].l < utilParts[i - 1].r - 0.5) utilOverlap++;
  const cat = document.querySelector('.catbar__list'); const catOver = cat && vis(document.querySelector('.catbar')) ? Math.max(0, cat.scrollWidth - cat.clientWidth) : 0;
  return { iw: innerWidth, cw: document.documentElement.clientWidth, mode, n: parts.length, minGap: Math.round(minGap * 10) / 10, overlaps, wraps, spill, utilOverlap, catOver, sw: document.documentElement.scrollWidth };
})()`;

const b = await launch({ port: 0 });
let liveFails = 0;
const forcedFit = [];
try {
  const pg = await b.newPage({ width: from, height: 900 });
  await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pitstop-age-ok','1')}catch(e){}" });
  console.log('width  layout | forced: fits gap  | live: mode         fits gap  | promo catbar(scroll px) | overflow');
  for (let w = from; w <= to; w += step) {
    await pg.viewport(w, 900);
    await pg.goto(args.url, { settle: 500 });
    await pg.eval('document.fonts.ready.then(() => true)');
    await sleep(150);
    const live = await pg.eval(measure);
    await pg.eval(`(() => { const s = document.createElement('style'); s.id = 'force-bar'; s.textContent = ${JSON.stringify(FORCE)}; document.head.appendChild(s); })()`);
    await sleep(120);
    const forced = await pg.eval(measure);
    await pg.eval(`document.getElementById('force-bar').remove()`);
    const fits = (m) => !m.overlaps.length && !m.wraps.length && !m.spill.length;
    if (fits(forced)) forcedFit.push(w);
    if (!fits(live) || live.utilOverlap || live.sw > live.cw) liveFails++;
    console.log(`${String(w).padEnd(6)} ${String(live.cw).padEnd(6)} | ${fits(forced) ? 'yes' : 'NO '}   ${String(forced.minGap).padEnd(6)}| ${live.mode.padEnd(12)} ${fits(live) ? 'yes' : 'NO '}   ${String(live.minGap).padEnd(6)}| ${live.utilOverlap ? 'OVERLAP' : 'ok'}    ${live.catOver} | ${live.sw > live.cw ? 'OVERFLOW ' + live.sw : 'none'}${forced.overlaps.length || forced.wraps.length || forced.spill.length ? '   forced: ' + [...forced.overlaps, ...forced.wraps.map((x) => 'wrap ' + x), ...forced.spill.map((x) => 'spill ' + x)].join('; ') : ''}${!fits(live) ? '   live: ' + [...live.overlaps, ...live.wraps, ...live.spill].join('; ') : ''}`);
  }
} finally { await b.close(); }
const allFrom = (() => { let k = forcedFit.length - 1; let lo = null; for (let w = to; w >= from; w -= step) { if (forcedFit.includes(w)) lo = w; else break; } return lo; })();
console.log(`forced full bar fits at every measured width from ${allFrom ?? '(none)'} up to ${to}; live failures: ${liveFails}`);
process.exit(liveFails ? 1 : 0);
