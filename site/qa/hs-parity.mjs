// hs-parity.mjs - does every sentence of High Society's own pages survive on the rebuilt site?
// Source: crawl/hs/v1-pages.json (the text lines of the v1 static clone of highsocietydispo.com, one entry per page).
// Target: the BUILT page at the same path (dist/<path>/index.html), visible text of <main> (plus <h1> anywhere), or a
// mapped path (--map old=new,...). Never the content models: parity is measured on what ships.
//   node qa/hs-parity.mjs [--dist dist] [--pages /about/,/contact/] [--map /old/=/new/] [--show 15] [--json out.json]
// Default pages: every v1 page that has a built counterpart, except the store menu category pages (CMS menus).
// A source line is CHROME (not graded) when it appears on at least half of the v1 pages (header, menus, footer, the age
// gate, popups) or belongs to a known chrome block (the store chooser's store list repeats on every page).
// Units: each non-chrome line split into sentences; units of >= 5 words are graded. FOUND = the unit appears in the
// target text (normalised quotes, dashes, whitespace, case). Typos and casing in High Society's text are kept on
// purpose (the content keeps its words), so normalisation is only quotes/dashes/whitespace/case.
// Positive controls: (1) a found unit removed from one built page IN MEMORY must be reported lost; (2) a planted
// chrome-like line must not be graded. Exit 1 when any unit is lost, 3 when a control does not fire.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); opt[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
const DIST = path.resolve(opt.dist || path.join(HERE, '..', 'dist'));
const SRC = path.resolve(opt.src || path.join(HERE, '..', '..', 'crawl', 'hs', 'v1-pages.json'));
const SHOW = Number(opt.show || 15);
const MAP = Object.fromEntries(String(opt.map || '').split(',').filter(Boolean).map((p) => p.split('=')));

// spaces before closing punctuation and after an opening bracket are dropped on both sides: a link at the end of a
// sentence ("from <a>Top Taggart Field</a>.") must compare equal however the markup around it was spaced
const norm = (s) => String(s).replace(/[‘’ʼ`]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―−]/g, '-').replace(/ /g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,;:!?)\]])/g, '$1').replace(/([(\[])\s+/g, '$1').trim().toLowerCase();
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: '—', ndash: '–', hellip: '…' };
const decode = (s) => s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? ' ');
// inline tags vanish without a space (text runs straight through them, as the source extractor joins them); every other
// tag is a word boundary
const INLINE = /<\/?(a|span|strong|em|b|i|u|small|sup|sub|abbr|code|mark|s|q|cite|time|data)(\s[^>]*)?>/gi;
const htmlText = (h) => decode(String(h).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<template[\s\S]*?<\/template>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|li|h[1-6]|div|section|td|th|dd|dt|summary|figcaption|blockquote)>/gi, ' \n ').replace(INLINE, '').replace(/<[^>]+>/g, ' '));
const words = (s) => (s.match(/[A-Za-z0-9]+/g) || []).length;
const units = (line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map((x) => x.trim()).filter((x) => words(x) >= 5);

const pages = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const CATS = /\/(accessory|apparel|concentrate|edibles|flower|pre-rolls|topicals|vaporizers|tinctures)\/$/;
// chrome lines: present on >= half of the v1 pages
const freq = new Map();
for (const p of pages) for (const l of new Set(p.lines.map(norm))) freq.set(l, (freq.get(l) || 0) + 1);
const isChrome = (l) => (freq.get(norm(l)) || 0) >= pages.length / 2;

const wanted = opt.pages ? String(opt.pages).split(',').map((x) => x.trim()) : null;
const targetFile = (p) => path.join(DIST, ...p.split('/').filter(Boolean), 'index.html');
const jobs = pages.filter((p) => !CATS.test(p.path) && !['/home/', '/home-1/'].includes(p.path))
  .filter((p) => !wanted || wanted.includes(p.path))
  // grade the source page's own content region (v1's single <main>); the full-document lines are the fallback
  .map((p) => ({ src: p.path, dst: MAP[p.path] || p.path, lines: p.mainLines && p.mainLines.length ? p.mainLines : p.lines }))
  .filter((j) => wanted || fs.existsSync(targetFile(j.dst)));
if (!jobs.length) { console.error('no pages to compare (built pages missing?)'); process.exit(2); }

// declared removals and corrections: docs/hs-source-defects.json (defects in High Society's own live copy that the
// rebuild deliberately does not carry: another dispensary's sentence, a wrong store's landmarks, typos)
const DEFECTS = path.resolve(opt.declare || path.join(HERE, '..', '..', 'docs', 'hs-source-defects.json'));
const defects = fs.existsSync(DEFECTS) ? JSON.parse(fs.readFileSync(DEFECTS, 'utf8')) : { declared: [], corrections: [] };
const declaredFor = (page, unit) => (defects.declared || []).find((d) => (d.pages.includes('*') || d.pages.includes(page)) && norm(unit).includes(norm(d.contains)));
const corrected = (page, unit) => (defects.corrections || []).reduce((u, c) => (c.page === page ? u.split(c.from).join(c.to) : u), unit);

function grade(job, targetText) {
  const T = norm(targetText);
  const res = { page: job.src, built: job.dst, graded: 0, found: 0, declared: [], lost: [] };
  for (const line of job.lines) {
    if (isChrome(line)) continue;
    for (const u of units(line)) {
      res.graded++;
      if (T.includes(norm(u)) || T.includes(norm(corrected(job.src, u)))) res.found++;
      else if (declaredFor(job.src, u)) res.declared.push(u);
      else res.lost.push(u);
    }
  }
  return res;
}
const results = [];
let lostTotal = 0;
const texts = new Map();
for (const j of jobs) {
  const f = targetFile(j.dst);
  if (!fs.existsSync(f)) { results.push({ page: j.src, built: j.dst, missingPage: true, graded: 0, found: 0, lost: ['(no built page at ' + j.dst + ')'] }); lostTotal++; continue; }
  const raw = fs.readFileSync(f, 'utf8');
  const main = (raw.match(/<main[\s\S]*?<\/main>/i) || [raw])[0];
  const h1 = (raw.match(/<h1[\s\S]*?<\/h1>/gi) || []).join(' ');
  const text = htmlText(main + ' ' + h1);
  texts.set(j.src, text);
  const r = grade(j, text);
  results.push(r); lostTotal += r.lost.length;
}

// controls
let ctlOk = true;
const firstFound = results.find((r) => r.found > 0);
if (firstFound) {
  const j = jobs.find((x) => x.src === firstFound.page);
  const T = texts.get(j.src);
  const unit = j.lines.filter((l) => !isChrome(l)).flatMap(units).find((u) => norm(T).includes(norm(u)));
  // every occurrence goes (v1 prints each directions block twice: desktop tabs and the phone accordion); the check is
  // presence, so deleting one copy of a twice-printed unit is not a loss
  const cut = norm(T).split(norm(unit)).join(' ');
  if (!grade(j, cut).lost.some((u) => norm(u) === norm(unit))) { console.error('control 1: a deleted unit was not reported lost'); ctlOk = false; }
} else { console.error('control 1: no page has a found unit to delete (is dist built?)'); ctlOk = false; }
const chromeLine = [...freq.entries()].find(([l, n]) => n >= pages.length / 2 && words(l) >= 5);
if (chromeLine && !isChrome(chromeLine[0])) { console.error('control 2: a chrome line was graded'); ctlOk = false; }

for (const r of results) {
  const flag = r.lost.length ? 'LOST' : 'ok';
  const dec = (r.declared || []).length;
  console.log(`${flag.padEnd(5)} ${r.page.padEnd(70)} ${r.found}/${r.graded}${dec ? '  declared ' + dec : ''}${r.built !== r.page ? '  -> ' + r.built : ''}`);
  for (const u of r.lost.slice(0, SHOW)) console.log('        - ' + u.slice(0, 160));
}
if (opt.json) fs.writeFileSync(path.resolve(opt.json), JSON.stringify(results, null, 1) + '\n');
const g = results.reduce((a, r) => a + r.graded, 0), f = results.reduce((a, r) => a + r.found, 0), dTot = results.reduce((a, r) => a + (r.declared || []).length, 0);
console.log(`hs-parity: ${results.length} pages, ${f}/${g} units found, ${dTot} declared removals (${path.basename(DEFECTS)}), ${lostTotal} lost; controls ${ctlOk ? 'OK' : 'FAILED'}`);
process.exitCode = !ctlOk ? 3 : lostTotal ? 1 : 0;
