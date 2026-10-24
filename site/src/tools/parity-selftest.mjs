#!/usr/bin/env node
// parity-selftest.mjs — prove parity.mjs can FAIL. Copies dist/index.html to a scratch dir (dist-parity-selftest),
// confirms the untouched copy passes, then damages the copy every way listed below and requires each damage to be
// caught BY NAME (the expected failure line). Every mutant is aimed at the visible element inside <body> (the last
// occurrence, asserted to sit after <body>), never at the first String.replace hit, which may be a copy in <head>.
//
//   node src/tools/parity-selftest.mjs [--from dist]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = path.resolve(ROOT, opt('from', 'dist'));
const DIR = path.join(ROOT, 'dist-parity-selftest');
const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'content', 'home.json'), 'utf8'));
const IMAGES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'content', 'images.json'), 'utf8'));
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR);
const html0 = fs.readFileSync(path.join(FROM, 'index.html'), 'utf8');
const BODY = html0.search(/<body[\s>]/i);
const run = () => spawnSync('node', [path.join(ROOT, 'src', 'tools', 'parity.mjs'), '--dir', path.relative(ROOT, DIR), '--json', 'audit/parity-selftest.json'], { cwd: ROOT, encoding: 'utf8' });

// ---- fixture helpers: every one throws when its target is not where it must be ------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const variants = (s) => [...new Set([s, esc(s), s.replace(/'/g, '&#39;'), s.replace(/’/g, '&rsquo;')])];
function lastIn(h, needle) {
  let i = -1; let hit = null;
  for (const v of variants(needle)) { const k = h.lastIndexOf(v); if (k > i) { i = k; hit = v; } }
  if (i < 0) throw new Error('fixture not found in the build: ' + JSON.stringify(needle.slice(0, 60)));
  if (i < BODY) throw new Error('fixture only found before <body>: ' + JSON.stringify(needle.slice(0, 60)));
  return { i, v: hit };
}
const replaceLast = (h, a, b) => { const { i, v } = lastIn(h, a); return h.slice(0, i) + b + h.slice(i + v.length); };
const replaceAll = (h, a, b) => { let n = 0; for (const v of variants(a)) { if (h.includes(v)) { n += h.split(v).length - 1; h = h.split(v).join(b); } } if (!n) throw new Error('fixture not found: ' + a); return h; };
const insertBefore = (h, marker, s) => { const i = h.lastIndexOf(marker); if (i < BODY) throw new Error('marker not in body: ' + marker); return h.slice(0, i) + s + h.slice(i); };
// remove the innermost element of one of `tags` that encloses position idx
function removeEnclosing(h, idx, tags) {
  const re = new RegExp('<(/?)(' + tags.join('|') + ')\\b[^>]*>', 'gi'); const stack = []; let m;
  while ((m = re.exec(h)) && m.index < idx) { if (m[1]) { const k = stack.map((s) => s.tag).lastIndexOf(m[2].toLowerCase()); if (k >= 0) stack.splice(k); } else stack.push({ tag: m[2].toLowerCase(), at: m.index }); }
  let open = stack[stack.length - 1];
  if (!open) {      // no list item / article: the innermost <div> whose class names a card
    const st = []; const rd = /<(\/?)div\b([^>]*)>/gi;
    while ((m = rd.exec(h)) && m.index < idx) { if (m[1]) st.pop(); else st.push({ tag: 'div', at: m.index, card: /class="[^"]*card/i.test(m[2]) }); }
    open = [...st].reverse().find((x) => x.card);
  }
  if (!open) throw new Error('no enclosing <' + tags.join('|') + '> or card <div> at ' + idx);
  const re2 = new RegExp('<(/?)' + open.tag + '\\b[^>]*>', 'gi'); re2.lastIndex = open.at; let depth = 0;
  while ((m = re2.exec(h))) { depth += m[1] ? -1 : 1; if (depth === 0) return h.slice(0, open.at) + h.slice(m.index + m[0].length); }
  throw new Error('unbalanced <' + open.tag + '>');
}
// remove the <a> or <button> that holds the last occurrence of `text`
function removeControl(h, text) {
  const { i } = lastIn(h, text);
  const a = Math.max(h.lastIndexOf('<a ', i), h.lastIndexOf('<button', i));
  const tag = h.startsWith('<a ', a) ? 'a' : 'button';
  const end = h.indexOf('</' + tag + '>', i); if (a < BODY || end < 0) throw new Error('control not found for ' + text);
  return h.slice(0, a) + h.slice(end + tag.length + 3);
}
const fileOfKey = (key) => (IMAGES[key] ? IMAGES[key].variants.map((v) => v.file) : []);

const review = C.reviews.items[0].text;                 // "...they have amazing deals a loyalty membership..."
const craft = C.craft.text;
const card0 = C.locations.cards[0];                     // Birch Run
const saline = C.locations.cards.find((c) => /saline/i.test(c.order.href));
const pick = C.picks.items[1].img.alt;                  // "Doozy logo"
const mobileBanner = C.deals.banners[0].mobile.img.src; // the phone art-directed $10 banner
const lastView = C.locator.stores.filter((s) => s.view).pop();

const MUTANTS = [
  { name: 'one word removed from a review', f: (h) => replaceLast(h, 'they have amazing deals', 'they have deals'), expect: /source text are missing/ },
  { name: 'the craftsmanship paragraph reworded', f: (h) => replaceLast(h, 'commitment to quality, customer service', 'focus on quality and service'), expect: /source text are missing/ },
  { name: 'one store card\'s phone link re-pointed', f: (h) => replaceLast(h, 'href="' + card0.phone.href + '"', 'href="tel:(989) 244-3002"'), expect: /link\(s\) lost or re-pointed/ },
  { name: 'an invented destination added', f: (h) => insertBefore(h, '</main>', '<a href="https://example.com/promo">Deals</a>'), expect: /not on the source page/ },
  { name: 'invented copy added', f: (h) => insertBefore(h, '</main>', '<p>Voted best dispensary in Michigan</p>'), expect: /neither source copy nor a declared UI label/ },
  { name: 'a Staff Picks alt changed', f: (h) => replaceLast(h, 'alt="' + pick + '"', 'alt="Doozy"'), expect: /image problem/ },
  { name: 'a store card removed', f: (h) => { const { i } = lastIn(h.slice(0, h.indexOf('</main>')), 'href="' + saline.order.href + '"'); return removeEnclosing(h, i, ['li', 'article']); }, expect: /link\(s\) lost or re-pointed/ },
  { name: 'the age-gate line removed', f: (h) => replaceLast(h, C.ageGate.lines[0], ''), expect: /source text are missing/ },
  { name: 'title changed', f: (h) => h.replace(/<title>[\s\S]*?<\/title>/, '<title>High Society</title>'), expect: /<title> differs/ },
  { name: 'a second h1 added', f: (h) => insertBefore(h, '</main>', '<h1>' + C.deals.title + '</h1>'), expect: /<h1>/ },
  { name: 'the flower banner\'s phone <source> removed', f: (h) => { const files = fileOfKey(mobileBanner); const i = Math.max(...files.map((f) => h.lastIndexOf(f))); if (i < BODY) throw new Error('phone banner file not in the body: ' + files.join(',')); const s = h.lastIndexOf('<source', i); const e = h.indexOf('>', i); if (s < BODY || s < h.lastIndexOf('>', i - 1) - 400) throw new Error('the phone banner is not a <source>'); return h.slice(0, s) + h.slice(e + 1); }, expect: /art-directed file/ },
  { name: 'a store chooser VIEW LOCATION link removed', f: (h) => { const { i } = lastIn(h, 'href="' + lastView.view.href + '"'); const a = h.lastIndexOf('<a ', i); const e = h.indexOf('</a>', i); if (!/VIEW LOCATION/.test(h.slice(a, e))) throw new Error('last ' + lastView.view.href + ' link is not the chooser\'s VIEW LOCATION'); return h.slice(0, a) + h.slice(e + 4); }, expect: /link\(s\) lost or re-pointed/ },
  { name: 'a review author removed', f: (h) => replaceLast(h, C.reviews.items[7].name, ''), expect: /source text are missing/ },
  { name: 'the Google Rating badge alt removed', f: (h) => replaceLast(h, 'alt="' + C.reviews.badge.alt + '"', 'alt=""'), expect: /image problem/ },
];

let bad = 0;
fs.writeFileSync(path.join(DIR, 'index.html'), html0);
const c = run(); console.log((c.status === 0 ? 'ok   ' : 'WRONG') + ' untouched copy passes (exit ' + c.status + ')'); if (c.status !== 0) { bad++; console.log(c.stdout.slice(0, 900)); }
for (const m of MUTANTS) {
  let h;
  try { h = m.f(html0); } catch (e) { console.log('WRONG mutant "' + m.name + '" could not be built: ' + e.message); bad++; continue; }
  if (h === html0) { console.log('WRONG mutant "' + m.name + '" changed nothing'); bad++; continue; }
  fs.writeFileSync(path.join(DIR, 'index.html'), h);
  const r = run(); const caught = r.status === 1 && m.expect.test(r.stdout);
  console.log((caught ? 'ok   ' : 'WRONG') + ' mutant "' + m.name + '" -> exit ' + r.status + (caught ? '' : ' — NOT caught: ' + r.stdout.split('\n').slice(0, 3).join(' / ').slice(0, 300)));
  if (!caught) bad++;
}
fs.rmSync(DIR, { recursive: true, force: true }); fs.rmSync(path.join(ROOT, 'audit', 'parity-selftest.json'), { force: true });
console.log(bad ? `\nSELF-TEST FAILED: ${bad} case(s) wrong` : `\nSELF-TEST PASSED: untouched copy passes, ${MUTANTS.length}/${MUTANTS.length} mutants caught`);
process.exit(bad ? 1 : 0);
