// overlap-check.mjs — proves High Society's copy does not reproduce the prose of the reference site (the competitor whose
// page structure this site follows). Builds the set of N-word sequences (shingles) in the reference crawl (each page's
// <main> text, title, h1 and headings) and reports every span of a checked file made of shared shingles. Node builtins only.
//
//   node qa/overlap-check.mjs --dir dist [--files a.json,b.html] [--n 6] [--fail 8] [--corpus <corpus.json>]
//        [--json out.json] [--control] [--whole]
//
// --corpus  default: the crawl named in qa/reference-patterns.mjs (beside site/; never published)
// --n       shingle size used to find shared spans (default 6 words: "review" level)
// --fail    a shared span this many words or longer fails the run (default 8)
// --whole   HTML: grade the whole page, not only <main> (the header and footer reuse the reference's menu LABELS on purpose -
//           the information architecture is the deliverable - so whole-page runs are dominated by labels)
// --control inserts one real reference sentence into the first checked file IN MEMORY and requires that the run reports it;
//           a control run proves the instrument and NEVER grades the files: exit 0 = detected, 3 = missed. Never read a
//           control run's exit code as a pass.
// JSON inputs: only the visible copy fields are graded (title, h1, metaDescription, excerpt, body, intro, text, md,
// heading, q, a, items, keyTakeaways, ...); review/claims/sources/ids/paths are not (they quote evidence on purpose).
// HTML inputs: visible text of <main> (scripts, styles, JSON-LD and <cite> source titles removed). Each block element
// (paragraph, list item, heading, table cell, FAQ question...) is its own text: a span never runs from one block into
// the next, the way High Society's own v1 lines are kept apart below. Two adjacent headings of a table of contents, a
// question and its answer, or a heading and the sentence under it are not a copied passage; a copied sentence or
// heading still sits inside one block and is still caught (--control).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReference } from './reference-patterns.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  args[k] = v;
}
const N = Number(args.n || 6);
const FAIL = Number(args.fail || 8);
const CORPUS = path.resolve(String(args.corpus || loadReference().corpus));

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: ' ', ndash: ' ', hellip: ' ', copy: ' ', reg: ' ', trade: ' ' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : ' '));
}
// a token no reference shingle contains: placed between blocks, no shared span can cross it
const BLOCK = 'qqblockbreakqq';
const BLOCK_TAG = /<\/?(?:p|li|ul|ol|dl|dt|dd|h[1-6]|table|thead|tbody|tfoot|tr|td|th|caption|summary|details|figcaption|figure|blockquote|div|section|article|header|footer|nav|aside|main|br|hr|button|label|legend|fieldset|form|select|option)\b[^>]*>/gi;
function htmlText(h, blocks = false) {
  let s = String(h)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    // <cite>: the title of a cited work (article sources). Titles of the same papers appear on other sites by nature,
    // as the JSON mode's skipped "sources" field; Markdown cannot emit <cite> (raw HTML is text), only templates do
    .replace(/<cite\b[\s\S]*?<\/cite>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  if (blocks) s = s.replace(BLOCK_TAG, ` ${BLOCK} `);
  return decode(s.replace(/<[^>]+>/g, ' '));
}
// visible copy fields of the content JSON (pages and articles); everything else is evidence or plumbing. "recipe" was
// missing until 2026-10-24, so a recipe card's ingredients, steps and dosing note were never graded in JSON mode
const VISIBLE = new Set(['title', 'seoTitle', 'h1', 'metaDescription', 'description', 'excerpt', 'body', 'intro', 'lead', 'text', 'md', 'html', 'heading', 'subheading', 'eyebrow', 'label', 'q', 'a', 'question', 'answer', 'items', 'keyTakeaways', 'takeaways', 'caption', 'note', 'cta', 'sections', 'blocks', 'faq', 'steps', 'ingredients', 'tips', 'bullets', 'cards', 'name', 'summary', 'dek', 'quote', 'rows', 'cells', 'columns', 'content', 'recipe', 'dosingNote']);
// Markdown as the built page shows it: a link shows its text, never its target, so "](/blog/<slug>/)" is dropped (an
// 8-word slug alone failed every body link to /blog/how-long-does-marijuana-stay-in-your-system/ until 2026-10-24); and
// each line (paragraph, list item, heading, table row) and table cell is its own block, as the HTML mode splits them
function mdText(s) {
  return s.replace(/\]\((?:[^()\s]|\([^()\s]*\))*(?:\s+"[^"]*")?\)/g, ']').replace(/[ \t]*\|[ \t]*|\n+/g, ` ${BLOCK} `);
}
function jsonText(v, out = [], key = '') {
  if (typeof v === 'string') { if (!key || VISIBLE.has(key)) out.push(/<[a-z][^>]*>/i.test(v) ? htmlText(v, true) : decode(mdText(v))); }
  else if (Array.isArray(v)) v.forEach((x) => jsonText(x, out, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!key || VISIBLE.has(key)) jsonText(x, out, k); }
  return out;
}
// One token stream per block; sentence boundaries do not stop a span (a copied passage stays a span). JSON fields are
// split at Markdown lines and table cells (mdText) or at block elements when they hold HTML; HTML pages are split at
// block elements (htmlText(..., true)).
function tokens(text) {
  return String(text).toLowerCase()
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .match(/[a-z0-9]+(?:'[a-z0-9]+)*/g) || [];
}

if (!fs.existsSync(CORPUS)) { console.error('no reference corpus at ' + CORPUS); process.exit(2); }
const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8')).filter((r) => r.status === 200 && r.type !== 'redirect' && r.type !== 'error');
const refSet = new Map(); // shingle -> first reference url
const refSentences = [];
for (const r of corpus) {
  const text = [r.title, ...(r.h1 || []), ...(r.headings || []).map((h) => h[1]), r.desc, r.text].filter(Boolean).join(' \n ');
  const t = tokens(text);
  for (let i = 0; i + N <= t.length; i++) { const k = t.slice(i, i + N).join(' '); if (!refSet.has(k)) refSet.set(k, r.url); }
  if (r.type === 'post') for (const s of String(r.text || '').split(/(?<=[.!?])\s+|\n/)) if (tokens(s).length >= 14 && tokens(s).length <= 40) refSentences.push(s.trim());
}

// High Society's OWN published text (the v1 clone of its live pages, the v2 homepage): a shared span made only of
// shingles that High Society itself already published is its own wording, not a copy (v2's home shares "whether you're
// at home or on the go" with the reference site). Such spans are reported as "own" and never fail. --own none switches this off.
const OWN = String(args.own || [path.join(HERE, '..', '..', 'crawl', 'hs', 'v1-pages.json'), path.join(HERE, '..', '..', 'v2-source', 'src', 'content', 'home.json')].join(','));
const ownSet = new Set();
const allStrings = (v, out = []) => { if (typeof v === 'string') out.push(/<[a-z][^>]*>/i.test(v) ? htmlText(v) : decode(v)); else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out)); return out; };
if (OWN !== 'none') for (const f of OWN.split(',').map((x) => path.resolve(x.trim()))) {
  if (!fs.existsSync(f)) { console.error('own-text source missing: ' + f); process.exit(2); }
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  // v1-pages.json is a list of pages whose text is in .lines (one block per line): each line is its own text, so a
  // span never joins two unrelated blocks; home.json is the v2 content model: every string in it
  const texts = Array.isArray(data) ? data.flatMap((p) => p.lines || []) : allStrings(data);
  for (const s of texts) { const t = tokens(s); for (let i = 0; i + N <= t.length; i++) ownSet.add(t.slice(i, i + N).join(' ')); }
}
// a run of clock times, numbers and day names ("9 00 am 9 00 pm") is data, not prose
const TRIVIAL = /^(?:(?:\d+|am|pm|a|m|p|to|and|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?: |$))+$/;

let files = [];
if (args.dir) {
  const d = path.resolve(String(args.dir));
  const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) walk(q); else if (/\.(json|html?)$/i.test(e.name)) files.push(q); } };
  walk(d);
}
if (args.files) files.push(...String(args.files).split(',').map((f) => path.resolve(f.trim())));
files = [...new Set(files)].sort();
if (!files.length) { console.error('nothing to check (use --dir or --files)'); process.exit(2); }

const control = !!args.control;
const controlSentence = control ? refSentences[Math.floor(refSentences.length / 2)] : null;
const report = { schema: 'highsociety/overlap@1', n: N, fail: FAIL, corpus: CORPUS, refPages: corpus.length, refShingles: refSet.size, control: control ? controlSentence : null, files: [] };
let worst = 0, controlSeen = false;

files.forEach((file, idx) => {
  const raw = fs.readFileSync(file, 'utf8');
  let text;
  // each JSON string is its own text, as a block is on the built page, and so is each Markdown line inside one (mdText)
  if (/\.json$/i.test(file)) text = jsonText(JSON.parse(raw)).join(` ${BLOCK} `);
  else {
    const scope = args.whole ? raw : ((raw.match(/<main[\s\S]*?<\/main>/i) || [raw])[0]);
    text = htmlText(scope, true);
  }
  if (control && idx === 0) text += ' ' + controlSentence;
  const t = tokens(text);
  const hit = new Array(t.length).fill(false);
  const src = {};
  for (let i = 0; i + N <= t.length; i++) {
    const k = t.slice(i, i + N).join(' ');
    if (refSet.has(k)) { for (let j = i; j < i + N; j++) hit[j] = true; src[i] = refSet.get(k); }
  }
  const spans = [];
  for (let i = 0; i < t.length;) {
    if (!hit[i]) { i++; continue; }
    let j = i; while (j < t.length && hit[j]) j++;
    const rf = Object.keys(src).map(Number).filter((s) => s >= i && s < j).map((s) => src[s]);
    const words = t.slice(i, j);
    let own = ownSet.size > 0;
    for (let s = i; own && s + N <= j; s++) if (!ownSet.has(t.slice(s, s + N).join(' '))) own = false;
    const kind = TRIVIAL.test(words.join(' ')) ? 'trivial' : own ? 'own' : 'copy';
    spans.push({ words: j - i, text: words.join(' '), kind, ref: [...new Set(rf)].slice(0, 5) });
    i = j;
  }
  spans.sort((a, b) => (b.kind === 'copy') - (a.kind === 'copy') || b.words - a.words);
  const graded = spans.filter((s) => s.kind === 'copy');
  const max = graded.length ? Math.max(...graded.map((s) => s.words)) : 0;
  if (!(control && idx === 0)) worst = Math.max(worst, max);
  if (control && idx === 0) controlSeen = spans.some((s) => s.words >= Math.min(FAIL, tokens(controlSentence).length));
  report.files.push({ file: path.relative(process.cwd(), file).split(path.sep).join('/'), words: t.filter((w) => w !== BLOCK).length, sharedSpans: spans.length, longest: max, spans: spans.slice(0, 25) });
});

if (args.json) fs.writeFileSync(path.resolve(String(args.json)), JSON.stringify(report, null, 1) + '\n');
const quiet = report.files.length > 40;
for (const f of report.files) {
  const flag = f.longest >= FAIL ? 'FAIL' : (f.longest >= N ? 'review' : 'ok');
  if (quiet && flag === 'ok') continue;
  console.log(`${flag.padEnd(6)} ${f.file}  words ${f.words}  shared spans ${f.sharedSpans}  longest copy ${f.longest}`);
  for (const s of f.spans.filter((x) => x.words >= N).slice(0, 6)) console.log(`         ${s.words}w ${s.kind.padEnd(7)} "${s.text}"  <- ${s.ref.join(', ')}`);
}
const kinds = { own: 0, trivial: 0, copy: 0 };
for (const f of report.files) for (const s of f.spans) kinds[s.kind]++;
console.log(`span kinds: copy ${kinds.copy}, own ${kinds.own} (High Society's own published wording), trivial ${kinds.trivial} (times/numbers); own-text shingles ${ownSet.size}`);
const nFail = report.files.filter((f) => f.longest >= FAIL).length, nReview = report.files.filter((f) => f.longest >= N && f.longest < FAIL).length;
console.log(`reference: ${corpus.length} pages, ${refSet.size} ${N}-word shingles; checked ${files.length} file(s): ${nFail} fail, ${nReview} review; longest shared span ${worst} words (fail at ${FAIL})`);
if (control) {
  console.log(`control: inserted ${tokens(controlSentence).length}-word reference sentence -> ${controlSeen ? 'DETECTED' : 'MISSED'} (a control run grades nothing)`);
  process.exitCode = controlSeen ? 0 : 3;
} else process.exitCode = worst >= FAIL ? 1 : 0;
