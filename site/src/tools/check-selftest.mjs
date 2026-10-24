#!/usr/bin/env node
// check-selftest.mjs — prove check.mjs can FAIL. A gate that has only ever said PASS has not been tested.
// Builds the hero (+ Staff Picks, so the page scrolls) into a scratch dir, confirms the clean build passes, then breaks
// it in every way listed below and requires check.mjs to catch each one BY NAME.
//   slide mutants: measured on the hero alone (--slide home; a mutant's own slide where it names one) at a short desktop
//   and a short phone screen
//   page mutants: the functional pass (age gate, store chooser, action bar, no-snap) at 390x844
//
//   node src/tools/check-selftest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'dist-selftest');
const run = (cmd, args) => spawnSync('node', [path.join(ROOT, 'src', 'tools', cmd), ...args], { cwd: ROOT, encoding: 'utf8' });

// the fixture: the hero, one standard section and the footer (the page's last slide, graded at the page end)
const b = run('build.mjs', ['--out', 'dist-selftest', '--include', '01-hero,05-picks,09-footer']);
if (b.status !== 0) { console.error(b.stdout + b.stderr); process.exit(2); }
const cssFile = path.join(DIR, 'styles', 'site.css'); const htmlFile = path.join(DIR, 'index.html');
const css0 = fs.readFileSync(cssFile, 'utf8'); const html0 = fs.readFileSync(htmlFile, 'utf8');
const slideCheck = (label, slide = 'home') => run('check.mjs', ['--dir', 'dist-selftest', '--slide', slide, '--vp', '360x640,1280x720', '--label', 'selftest-' + label, '--no-states']);
const pageCheck = (label) => run('check.mjs', ['--dir', 'dist-selftest', '--vp', '390x844', '--label', 'selftest-' + label, '--no-states']);
const must = (h, a, b2) => { if (!h.includes(a)) throw new Error('self-test fixture not found: ' + a); return h.replace(a, b2); };

const SLIDE = [
  { name: 'content pushed below the section', css: '.hero .hero__actions { margin-top: 70vh !important; }', expect: /below the slide's content box|cut off vertically/ },
  { name: 'heading truncated with an ellipsis', css: '.hero .hero__title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 120px; }', expect: /truncated with an ellipsis|text clipped/ },
  { name: 'buttons shrunk to 30px', css: '.hero .hero__actions .btn { min-height: 30px !important; height: 30px !important; }', expect: /tap target .* \(needs 44x44\)/ },
  { name: 'a button made dark on dark', css: '.hero .hero__cta { color: #2a2a2a !important; background: #030404 !important; }', expect: /contrast \d/ },
  { name: 'page made to scroll sideways', css: '.hero .slide__inner { width: 160vw !important; max-width: none !important; }', expect: /scrolls sideways|runs off the side|cut off horizontally|from the right edge/ },
  { name: 'section stretched to the full screen', css: '.hero.slide { height: 100vh !important; }', expect: /px between header and dock|runs \d+px below|above the (action bar|screen edge)/ },
  { name: 'empty band inside a phone section', html: (h) => must(h, ' data-fill', ' data-nofill'), css: '@media (max-width: 767.98px) { .hero .hero__stack { display: none !important; } }', expect: /empty band of \d+px/ },
  { name: 'content crowding the left edge', css: '.hero .slide__inner { padding-left: 4px !important; }', expect: /from the left edge \(needs \d+px\)/ },
  // the pair stands aside over the hero (owner, 2026-10-22), so this one is measured on Staff Picks, where it floats
  { name: 'content run under the floating pair', slide: 'picks', css: '@media (min-width: 768px) { .picks .slide__head { position: absolute !important; right: 24px; bottom: 24px; z-index: 6; } }', expect: /floating ORDER NOW \/ CONTACT US pair/ },
  { name: 'a picture behind text', css: '.hero .hero__stack { background-image: url(../assets/mark-red.svg); }', expect: /sits on a background picture/ },
  { name: 'a button parked on the heading', css: '.hero .hero__actions { position: relative; z-index: 5; margin-top: -120px !important; }', expect: /is covered by (a\.btn|div\.hero__actions)/ },
  // (the wordmark ships as its one 1040px file since the speed pass, 2026-10-22: no srcset)
  { name: 'hero art broken', html: (h) => must(h, '<img class="hero__wordmark" src="assets/banner-logo-1040.webp"', '<img class="hero__wordmark" src="assets/does-not-exist.webp"'), expect: /broken image|failed requests|404 from the build/ },
  // text over the hero's photo is measured on the rendered pixels ([data-photo]): both must fail
  { name: 'heading too dark for the photo', css: '.hero .hero__title { color: #3a3a3a !important; }', expect: /on the photo behind/ },
  { name: 'photo scrim removed, photo brightened', css: '.hero .hero__scrim { display: none !important; } .hero .hero__photo { filter: brightness(2.4) !important; }', expect: /on the photo behind/ },
];
const PAGE = [
  { name: 'scroll snapping switched on', css: 'html { scroll-snap-type: y mandatory; } .slide { scroll-snap-align: start; }', expect: /scroll snapping is on/ },
  { name: 'age gate never opens', html: (h) => h.split('id="agegate"').join('id="agegate-off"').split("getElementById('agegate')").join("getElementById('agegate-off')"), expect: /age gate/ },
  { name: 'a store dropped from the chooser', html: (h) => { const i = h.lastIndexOf('<li class="store">'); const j = h.indexOf('</li>', i) + 5; return h.slice(0, i) + h.slice(j); }, expect: /store chooser: stores or order differ/ },
  { name: 'action bar buttons shrunk', css: '.dock .btn { min-height: 30px !important; height: 30px !important; }', expect: /action bar: ORDER NOW \/ CONTACT US missing or under 44px/ },
  // owner, 2026-10-22: the pair stands aside over the hero; one shown there must fail
  { name: 'action bar shown over the hero', css: '.dock.is-off { visibility: visible !important; transform: none !important; }', expect: /action bar: should stand aside over the hero/ },
  // the last slide is graded at the page end (whole, flush on the bottom edge): a footer lifted off that edge must fail
  // the restyled footer fills a phone screen by its content alone, so the defect is a SHORT last section with room left
  // under it at the page end
  { name: 'footer lifted off the page end', css: 'footer.slide { min-height: 0 !important; height: 400px !important; overflow: hidden; margin-bottom: 40px; }', expect: /last slide not whole and flush at the page end/ },
];

let bad = 0;
const go = (list, check, kind) => {
  // the clean build must pass on every slide a mutant is measured on, or a "caught" could be the slide's own failure
  for (const sl of [undefined, ...new Set(list.map((m) => m.slide).filter(Boolean))]) {
    const clean = check('clean-' + kind + (sl ? '-' + sl : ''), sl);
    console.log((clean.status === 0 ? 'ok   ' : 'WRONG') + ` clean build passes the ${kind} check${sl ? ' on ' + sl : ''} (exit ${clean.status})`);
    if (clean.status !== 0) { bad++; console.log(clean.stdout.split('\n').slice(-14).join('\n')); }
  }
  for (const m of list) {
    fs.writeFileSync(cssFile, css0 + (m.css ? '\n/* mutant */\n' + m.css + '\n' : ''));
    fs.writeFileSync(htmlFile, m.html ? m.html(html0) : html0);
    const r = check(m.name.replace(/[^a-z]+/gi, '-').slice(0, 22), m.slide);
    const caught = r.status === 1 && m.expect.test(r.stdout);
    console.log((caught ? 'ok   ' : 'WRONG') + ' mutant "' + m.name + '" -> exit ' + r.status + (caught ? ', caught: ' + (r.stdout.match(m.expect) || [''])[0] : ' — NOT caught by name'));
    if (!caught) { bad++; console.log(r.stdout.split('\n').slice(-10).join('\n')); }
  }
  fs.writeFileSync(cssFile, css0); fs.writeFileSync(htmlFile, html0);
};
go(SLIDE, slideCheck, 'section');
go(PAGE, pageCheck, 'page');
fs.rmSync(DIR, { recursive: true, force: true });
for (const f of fs.readdirSync(path.join(ROOT, 'audit', 'check'))) if (f.startsWith('selftest-')) fs.rmSync(path.join(ROOT, 'audit', 'check', f));
const n = SLIDE.length + PAGE.length;
console.log(bad ? `\nSELF-TEST FAILED: ${bad} case(s) wrong` : `\nSELF-TEST PASSED: clean build passes both checks, ${n}/${n} mutants caught`);
process.exit(bad ? 1 : 0);
