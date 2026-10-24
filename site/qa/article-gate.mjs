// article-gate.mjs - the gate every article JSON (src/content/blog/<slug>.json) must pass before it is accepted.
//   node qa/article-gate.mjs [--files a.json,b.json | --dir src/content/blog] [--json out.json] [--no-overlap]
// Checks (FAIL unless marked review):
//   schema: required fields, slug = file name, category is a blog category, recipe shape
//   lengths: title <= 60 (65 hard), metaDescription 110-165, excerpt <= 220, h1 present
//   body: Markdown subset only (no raw HTML), opens with a paragraph, >= 3 "## " sections, no "# " heading
//   words: body + faq + takeaways >= 80% of the brief's lengthTarget (recipes: 60%), <= 2,800
//   links: every internal [..](/path/) targets a planned page (docs/structure-map.json pages, the blog categories, or a
//          planned article /blog/<hsSlug>/ from docs/briefs/batch-*.json that is not MERGE/SKIP); externals are https
//   related: 2-4 planned article slugs, never itself
//   sources: required (>= 1, https) when the brief's riskLevel is medical or legal
//   medical: an article whose riskLevel is medical links to no shop, menu, deals or rewards page (Michigan R 420.507)
//   residue: the reference site's names (residue-grep's FAIL patterns, from qa/reference-patterns.mjs)
//   review (printed, not failing): meta-language (editor asides), compliance words (cure, treat, FDA, guarantee...)
//   overlap: qa/overlap-check.mjs on the files (copy span >= 8 words fails)
// Positive controls run first on planted articles (a raw-HTML body, a dead link, a reference name, a short body): each must
// fail, and a clean planted article must pass; otherwise exit 3.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeHelpers } from '../src/lib/h.mjs';
import { loadReference } from './reference-patterns.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// the build's own link rule (h.href): an outside URL the build would refuse (an unencoded quote or space, a stray
// scheme) fails here, where the writer sees it, not later in the build (a source URL with "president's" did)
const H = makeHelpers({ content: {}, images: {}, origin: 'https://highsocietydispo.com' });
const hrefOk = (u) => { try { H.href(u); return true; } catch { return false; } };
const SITE = path.resolve(HERE, '..');
const WS = path.resolve(SITE, '..');
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); opt[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }

const CATS = { 'cannabis-101': 'Cannabis 101', 'health-and-lifestyle': 'Health & Lifestyle', popular: 'Most Popular', 'news-and-culture': 'News & Culture', recipes: 'Recipes', resources: 'Resources', 'shopping-and-reviews': 'Shopping & Reviews' };
const catSlug = (name) => Object.keys(CATS).find((k) => CATS[k].toLowerCase() === String(name || '').toLowerCase()) || String(name || '');

// ---- the plan: planned pages and articles
const briefs = new Map();
const briefDir = path.join(WS, 'docs', 'briefs');
for (const f of fs.existsSync(briefDir) ? fs.readdirSync(briefDir).filter((x) => /^batch-\d+\.json$/.test(x)) : []) {
  for (const b of JSON.parse(fs.readFileSync(path.join(briefDir, f), 'utf8')).briefs || []) if (b.hsSlug) briefs.set(b.hsSlug, b);
}
const planned = new Set(['/', '/blog/', ...Object.keys(CATS).map((c) => `/blog/${c}/`)]);
// HOLD briefs (written later, if High Society approves) are not linkable yet, like MERGE and SKIP
for (const [slug, b] of briefs) if (!['MERGE', 'SKIP', 'HOLD'].includes(String(b.action).toUpperCase())) planned.add(`/blog/${slug}/`);
const smPath = path.join(WS, 'docs', 'structure-map.json');
if (fs.existsSync(smPath)) { const sm = JSON.parse(fs.readFileSync(smPath, 'utf8')); for (const p of sm.pages || []) if (p.path) planned.add(p.path.endsWith('/') ? p.path : p.path + '/'); }
const plannedArticle = (slug) => planned.has(`/blog/${slug}/`);

// ---- patterns
// the same FAIL list residue-grep uses (this file kept an older copy until 2026-10-24)
const REF = loadReference();
const RESIDUE = REF.fail.map(([, re]) => re);
const META = /\b(invent\w*|verif\w*|confirm\w*|owner|placeholder|unknown|not stated|the brief|per the brief|rule|adapt\w*|TODO|TBD|lorem|as an ai|i cannot)\b|\[[^\]]*\](?!\()/i;
const COMPLIANCE = /\b(cures?|curing|treats?|treatment for|heals?|prevents? (cancer|disease)|FDA[- ]approved|guarantee\w*|miracle|risk[- ]free|safe for everyone|prescri\w+)\b/i;
const RAW_HTML = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?>/i;

const words = (s) => (String(s || '').match(/[A-Za-z0-9’']+/g) || []).length;
const visible = (a) => [a.title, a.h1, a.metaDescription, a.excerpt, ...(a.keyTakeaways || []), a.body, ...(a.faq || []).flatMap((f) => [f.q, f.a]), ...(a.recipe ? [...(a.recipe.ingredients || []), ...(a.recipe.steps || []), a.recipe.dosingNote] : [])].filter(Boolean).join('\n');

function check(a, fileSlug) {
  const fails = [], reviews = [];
  const need = ['slug', 'category', 'title', 'h1', 'metaDescription', 'excerpt', 'published', 'body', 'related'];
  for (const k of need) if (a[k] === undefined || a[k] === null || a[k] === '') fails.push('missing ' + k);
  if (a.slug !== fileSlug) fails.push(`slug "${a.slug}" != file name "${fileSlug}"`);
  if (!CATS[a.category]) fails.push('category not a blog category slug: ' + a.category);
  const b = briefs.get(a.slug);
  if (!b) reviews.push('no brief with hsSlug ' + a.slug);
  if (String(a.title || '').length > 65) fails.push('title > 65 chars (' + String(a.title).length + ')'); else if (String(a.title || '').length > 60) reviews.push('title > 60 chars');
  const md = String(a.metaDescription || '').length; if (md < 110 || md > 165) fails.push('metaDescription length ' + md + ' (110-165)');
  if (String(a.excerpt || '').length > 220) fails.push('excerpt > 220 chars');
  const body = String(a.body || '');
  if (RAW_HTML.test(visible(a))) fails.push('raw HTML in copy: ' + (visible(a).match(RAW_HTML) || [''])[0]);
  if (/^\s*#/.test(body)) fails.push('body must open with a paragraph, not a heading');
  if (/^# /m.test(body)) fails.push('body uses a "# " (h1) heading');
  const h2 = (body.match(/^## /gm) || []).length; if (h2 < 3) fails.push('fewer than 3 "## " sections (' + h2 + ')');
  const w = words(body) + words((a.faq || []).map((f) => f.q + ' ' + f.a).join(' ')) + words((a.keyTakeaways || []).join(' ')) + (a.recipe ? words([...(a.recipe.ingredients || []), ...(a.recipe.steps || [])].join(' ')) : 0);
  const target = b && Number(b.lengthTarget) ? Number(b.lengthTarget) : 700;
  const min = Math.round(target * (a.category === 'recipes' ? 0.6 : 0.8));
  if (w < min) fails.push(`words ${w} < ${min} (brief target ${target})`);
  if (w > 2800) fails.push('words ' + w + ' > 2800');
  for (const m of visible(a).matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const u = m[2];
    if (u.startsWith('/')) { const p = u.split('#')[0]; const pp = p.endsWith('/') ? p : p + '/'; if (!planned.has(pp)) fails.push('link to unplanned page ' + u); }
    else if (!/^https:\/\//.test(u) && !/^(tel|mailto):/.test(u)) fails.push('link not https or site path: ' + u);
    else if (!hrefOk(u)) fails.push('link the build refuses (percent-encode it: \' as %27, a space as %20): ' + u);
  }
  const rel = Array.isArray(a.related) ? a.related : [];
  if (rel.length < 2 || rel.length > 4) fails.push('related needs 2-4 slugs (' + rel.length + ')');
  for (const r of rel) { if (r === a.slug) fails.push('related lists itself'); else if (!plannedArticle(r)) fails.push('related slug not a planned article: ' + r); }
  const risk = String((a.brief && a.brief.riskLevel) || (b && b.riskLevel) || 'low');
  if ((risk === 'medical' || risk === 'legal') && !(Array.isArray(a.sources) && a.sources.some((s) => /^https:\/\//.test(s.url || '')))) fails.push(risk + ' article without https sources');
  for (const s of a.sources || []) if (!/^https:\/\//.test(s.url || '')) fails.push('source not https: ' + (s.url || ''));
  else if (!hrefOk(s.url)) fails.push('source URL the build refuses (percent-encode it: \' as %27, a space as %20): ' + s.url);
  // Michigan R 420.507 (facts/law-facts.json mi-advertising): a health article ties no purchase to its topic
  if (risk === 'medical') for (const m of visible(a).matchAll(/\]\((\/shop\/[^)]*|\/deals\/[^)]*|\/club-member-program\/[^)]*|\/loyalty\/[^)]*|\{\{[^)]*)\)/g)) fails.push('medical article links to a shop, deals or rewards page: ' + m[1]);
  if (a.category === 'recipes' && !(a.recipe && Array.isArray(a.recipe.ingredients) && a.recipe.ingredients.length && Array.isArray(a.recipe.steps) && a.recipe.steps.length)) fails.push('recipe article without recipe.ingredients/steps');
  const vis = visible(a);
  for (const re of RESIDUE) { const m = vis.match(re); if (m) fails.push('residue: ' + m[0]); }
  for (const line of vis.split('\n')) { const m = line.match(META); if (m) reviews.push('meta-language "' + m[0] + '": ' + line.trim().slice(0, 140)); }
  for (const line of vis.split('\n')) { const m = line.match(COMPLIANCE); if (m) reviews.push('compliance word "' + m[0] + '": ' + line.trim().slice(0, 140)); }
  return { fails, reviews, words: w, target };
}

// ---- controls
const good = { slug: 'ctl', category: 'cannabis-101', title: 'A planted control article', h1: 'A planted control article', metaDescription: 'x'.repeat(130), excerpt: 'Short.', published: '2026-10-24', body: 'Intro paragraph.\n\n## One\n\n' + 'word '.repeat(620) + '\n\n## Two\n\ntext\n\n## Three\n\ntext', related: [], faq: [] };
const someArticle = [...planned].find((p) => /^\/blog\/[^/]+\/$/.test(p) && !CATS[p.split('/')[2]]);
if (someArticle) good.related = [someArticle.split('/')[2], someArticle.split('/')[2]];
const ctl = [
  ['clean', good, true],
  ['raw html', { ...good, body: good.body + '\n\n<script>x</script>' }, false],
  ['dead link', { ...good, body: good.body + '\n\n[x](/no-such-page/)' }, false],
  ['residue', { ...good, body: good.body + ' ' + REF.articlePlant }, false],
  ['short', { ...good, body: 'Intro.\n\n## A\n\nb\n\n## C\n\nd\n\n## E\n\nf' }, false],
  ['medical shop link', { ...good, brief: { riskLevel: 'medical' }, sources: [{ label: 'A source', url: 'https://example.org/' }], body: good.body + '\n\n[the menu](/shop/)' }, false],
  ['medical clean', { ...good, brief: { riskLevel: 'medical' }, sources: [{ label: 'A source', url: 'https://example.org/' }] }, true],
  ['source url with a quote', { ...good, sources: [{ label: 'A source', url: "https://example.org/president's-office/p.pdf" }] }, false],
  ['body link with a quote', { ...good, body: good.body + "\n\n[a page](https://example.org/it's)" }, false],
];
let ctlOk = true;
for (const [name, art, shouldPass] of ctl) {
  const r = check(art, 'ctl');
  const passed = r.fails.length === 0;
  if (passed !== shouldPass) { console.error(`control "${name}": expected ${shouldPass ? 'pass' : 'fail'}, got ${passed ? 'pass' : 'fail'} ${JSON.stringify(r.fails)}`); ctlOk = false; }
}
if (!someArticle) { console.error('control: no planned article found (are docs/briefs/batch-*.json present?)'); ctlOk = false; }
if (!ctlOk) process.exit(3);

// ---- run
let files = [];
if (opt.dir) for (const f of fs.readdirSync(path.resolve(opt.dir))) if (f.endsWith('.json')) files.push(path.join(path.resolve(opt.dir), f));
if (opt.files) files.push(...String(opt.files).split(',').map((f) => path.resolve(f.trim())));
files = [...new Set(files)].sort();
if (!files.length) { console.error('nothing to check (--files or --dir)'); process.exit(2); }
const out = [];
let failN = 0;
for (const f of files) {
  let a; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { out.push({ file: f, fails: ['JSON: ' + e.message], reviews: [] }); failN++; continue; }
  const r = check(a, path.basename(f, '.json'));
  out.push({ file: path.relative(process.cwd(), f).split(path.sep).join('/'), ...r });
  if (r.fails.length) failN++;
}
let overlapExit = 0;
if (!opt['no-overlap']) {
  const r = spawnSync(process.execPath, [path.join(HERE, 'overlap-check.mjs'), '--files', files.join(',')], { encoding: 'utf8' });
  overlapExit = r.status;
  const lines = (r.stdout || '').split('\n').filter((l) => /^(FAIL|review)\s|\d+w (copy|own|trivial)|^reference:|^span kinds/.test(l));
  for (const l of lines) console.log('overlap ' + l);
  if (r.status !== 0 && r.status !== 1) { console.error(r.stderr); process.exit(2); }
}
for (const r of out) {
  if (r.fails.length) { console.log(`FAIL   ${r.file}  (${r.words}w / target ${r.target})`); for (const x of r.fails) console.log('         - ' + x); }
  for (const x of r.reviews) console.log(`review ${r.file}  ${x}`);
}
if (opt.json) fs.writeFileSync(path.resolve(opt.json), JSON.stringify(out, null, 1) + '\n');
console.log(`article-gate: ${files.length} file(s), ${failN} failing, overlap ${opt['no-overlap'] ? 'SKIPPED' : overlapExit === 0 ? 'ok' : 'FAIL'}; planned pages ${planned.size}; controls OK`);
process.exitCode = failN || overlapExit ? 1 : 0;
