// contrast.mjs — WCAG contrast of every text/background pair the redesign's CSS declares.
// Colours are resolved by Chrome itself (a token can be a hex, a var() chain or a color-mix() in
// oklab): each is painted onto a 1x1 canvas over white and read back as sRGB bytes, so the ratio is
// computed from what the browser draws, not from a hand conversion. A gradient background is
// judged at EVERY stop and the worst stop is reported. Translucent colours are composited over the
// surface named in `over`.
//   node src/tools/contrast.mjs   -> audit/contrast.json (exit 1 if any pair misses its AA threshold)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// [use, foreground token, background token(s), large?, source rule]
const PAIRS = [
  ['body text', '--ink', ['--clay'], false, 'base.css body'],
  ['cards: body text', '--ink', ['--clay-hi', '--clay'], false, 'components.css .pcard (gradient)'],
  ['secondary text: crumbs, footer links', '--ink-2', ['--clay', '--clay-hi'], false, '.crumbs a, .footer__col a'],
  ['muted text: footer base, toolbar labels', '--ink-3', ['--clay', '--clay-hi'], false, '.muted, .footer__base, .toolbar label'],
  ['eyebrows, card brand, footer headings', '--pine', ['--clay', '--clay-hi'], false, '.eyebrow, .pcard__brand, .footer__col h2'],
  ['brand chips', '--pine-ink', ['--clay'], false, 'neumorph.css .chip--brand'],
  ['announcement bar', '--sun-pale', ['--ink'], false, 'components.css .announce'],
  ['tagline band (large display type)', '--sun-pale', ['--pine'], true, 'components.css .tagline-band'],
  ['sun buttons', '--ink', ['--sun-pale', '--sun', '--sun-2'], false, 'neumorph.css .btn--sun (radial gradient)'],
  ['pine buttons, pickup badge', '--paper', ['--pine-2', '--pine'], false, 'neumorph.css .btn--pine, .store-pill__badge'],
  ['store status CLOSED badge', '--paper', ['--ember-ink'], false, 'components.css .hours__status b'],
  ['strain badge: indica', '--strain-indica', ['mix:--strain-indica:10:--clay-hi'], false, 'neumorph.css .strain'],
  ['strain badge: sativa', '--strain-sativa', ['mix:--strain-sativa:10:--clay-hi'], false, 'neumorph.css .strain'],
  ['strain badge: hybrid', '--strain-hybrid', ['mix:--strain-hybrid:10:--clay-hi'], false, 'neumorph.css .strain'],
  ['strain badge: cbd', '--strain-cbd', ['mix:--strain-cbd:10:--clay-hi'], false, 'neumorph.css .strain'],
  ['warning chip', '--ember-ink', ['mix:--ember:14:--clay-hi'], false, 'components.css .chip--warning'],
  ['stock label on a product photo (glass over white, worst case)', '--paper', ['over:--ink-glass:white'], false, 'components.css .pcard__stock'],
];

const b = await launch({ port: 0 });
let out;
try {
  const p = await b.newPage({ width: 800, height: 600 });
  await p.goto('http://127.0.0.1:8793/', { settle: 400 });
  out = await p.eval(`(() => {
    const PAIRS = ${JSON.stringify(PAIRS)};
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
    const probe = document.createElement('div'); document.body.appendChild(probe);
    const css = (v) => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
    const paint = (colour, under) => { g.clearRect(0, 0, 1, 1); g.fillStyle = under || '#ffffff'; g.fillRect(0, 0, 1, 1); g.fillStyle = colour; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
    const resolve = (spec) => {
      if (spec.startsWith('mix:')) { const [, a, pct, bb] = spec.split(':'); return css('color-mix(in oklab, var(' + a + ') ' + pct + '%, var(' + bb + '))'); }
      if (spec.startsWith('over:')) { const [, a] = spec.split(':'); return css('var(' + a + ')'); }
      return css('var(' + spec + ')');
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, c) => { const L1 = lum(a), L2 = lum(c); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
    const rows = PAIRS.map(([use, fg, bgs, large, rule]) => {
      const stops = bgs.map((s) => { const bgc = paint(resolve(s)); return { token: s, rgb: hex(bgc), bgc }; });
      const fgc = paint(resolve(fg), stops[0].rgb);
      const per = stops.map((s) => ({ bg: s.token, bgHex: s.rgb, ratio: Math.round(ratio(paint(resolve(fg), s.rgb), s.bgc) * 100) / 100 }));
      const worst = per.reduce((m, x) => (x.ratio < m.ratio ? x : m));
      const need = large ? 3 : 4.5;
      return { use, fg, fgHex: hex(fgc), bg: worst.bg, bgHex: worst.bgHex, ratio: worst.ratio, stops: per, large, need, pass: worst.ratio >= need, rule };
    });
    probe.remove();
    return rows;
  })()`);
} finally { await b.close(); }
fs.writeFileSync(path.join(ROOT, 'audit/contrast.json'), JSON.stringify({ schema: 'highsociety/contrast@1', generated: new Date().toISOString(), method: 'Chrome-resolved sRGB via canvas; WCAG 2.x relative luminance; gradients judged at their worst stop.', pairs: out }, null, 1));
for (const r of out) console.log((r.pass ? 'AA  ' : 'FAIL') + ' ' + String(r.ratio.toFixed(2)).padStart(6) + ' (need ' + r.need + ')  ' + r.fg + ' ' + r.fgHex + ' on ' + r.bg + ' ' + r.bgHex + '  — ' + r.use);
if (out.some((r) => !r.pass)) process.exit(1);
