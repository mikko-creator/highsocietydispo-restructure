// overflow.mjs — does the page get wider than the viewport, and which elements push it?
//   node qa/overflow.mjs --url <u> --width 390
// Fails (exit 1) when document scrollWidth passes innerWidth. Lists elements whose right edge passes innerWidth and that
// no ancestor clips (overflow hidden/clip/auto/scroll), deepest-first, with their selector and computed width (body's
// own overflow-x: clip hides overflow from the eye, not from scrollWidth). Exits as soon as Chrome is closed.
import { launch } from './cdp.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const w = Number(args.width || 390);
let code = 2;
const b = await launch({ port: 0 });
try {
  const p = await b.newPage({ width: w, height: 900, mobile: false });
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pitstop-age-ok','1')}catch(e){}" });
  await p.goto(args.url, { settle: 1200 });
  const r = await p.eval(`(() => {
    const W = innerWidth, out = [];
    // fixed-position subtrees never add document overflow (closed drawers sit off-screen by design)
    const inFixed = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true; return false; };
    const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return a; } return null; };
    const sel = (el) => { const p = []; for (let n = el; n && n !== document.body && p.length < 5; n = n.parentElement) p.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '')); return p.join(' > '); };
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= W + 0.5) continue;
      if (clipped(el) || inFixed(el)) continue;
      out.push({ sel: sel(el), right: Math.round(r.right), width: Math.round(r.width), cw: getComputedStyle(el).width, text: (el.innerText || '').trim().slice(0, 40) });
    }
    out.sort((a, b) => b.right - a.right);
    return { sw: document.documentElement.scrollWidth, W, items: out.slice(0, 12) };
  })()`);
  const bad = r.sw > r.W;
  console.log((bad ? 'OVERFLOW' : 'ok') + ' scrollWidth ' + r.sw + ' viewport ' + r.W + ' ' + args.url);
  for (const i of r.items) console.log(i.right, i.width, i.cw, '|', i.sel, '|', JSON.stringify(i.text));
  code = bad ? 1 : 0;
} catch (e) {
  console.error('overflow: ' + (e && e.message));
} finally { await b.close().catch(() => {}); }
process.exit(code);
