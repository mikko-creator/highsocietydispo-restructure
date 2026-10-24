#!/usr/bin/env node
// build.mjs — the MULTI-PAGE build (core lane, 2026-10-24; grew out of v2's one-page build). No dependencies.
//
//   node src/tools/build.mjs [--out dist] [--strict]     --strict: publish mode (no pending or planned-but-unbuilt targets)
//
// Inputs (contract §1): src/content/site.json (origin, brand, stores, deals, ui, blog, ia), home.json + images.json
// (v2's: the home's words, links and images), src/content/pages/*.json (one per page, schema §3),
// src/content/blog/*.json (one per article, schema §4). Code: src/templates/<name>.mjs (one per template, §6),
// src/blocks/<type>.mjs (one per block type, §3.1), src/chrome/{chrome,footer}.mjs (every page's header and footer),
// src/sections/01-08 (v2's home sections; 00-chrome and 09-footer are replaced by src/chrome and not built).
//
// Steps: load -> validate (unique paths, known templates, required fields, categories, slugs) -> generate the blog
// listings (/blog/, /blog/p/N/, /blog/<category>/, /blog/<category>/p/N/, perPage from site.json) -> render every page
// (head + chrome + <main> from its template + footer + dialogs + script) -> prove every internal link target is a built
// page, a built file, a site.json pending path or a planned.json page not built yet (--strict: built only); no Markdown link rejected; one h1; no duplicate id -> one CSS bundle
// (v2's order: tokens, fonts, theme, base, components, sections/*, then chrome.css, blocks/*.css, templates/*.css; v2's
// unused-variable pruning and minifier) and one JS bundle (v2's site.js + additions, sections/*.js, pages/*.js; v2's
// jsmin with its token-equality guard) -> /search-index.json, sitemap.xml (canonical URLs), robots.txt (production) ->
// copy the referenced assets -> write dist/ atomically (a temp dir, then a swap, as v2) -> print a summary.
// Deterministic (contract §2.3): pages in path order, no clock, no randomness; two builds are byte-identical.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { makeHelpers } from '../lib/h.mjs';
import * as route from '../lib/route.mjs';
import { renderMarkdown, renderInline, plainText } from '../lib/md.mjs';
import * as seo from '../lib/seo.mjs';
import { renderChrome } from '../chrome/chrome.mjs';
import { renderFooter } from '../chrome/footer.mjs';
import { minify as minifyJs, tokenize as jsTokens } from './jsmin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('out', 'dist'));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => { try { return JSON.parse(read(p)); } catch (e) { throw new Error(p + ': ' + e.message); } };
const listDir = (p, re) => (fs.existsSync(path.join(ROOT, p)) ? fs.readdirSync(path.join(ROOT, p)).filter((f) => re.test(f)).sort() : []);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const problems = [];
const fail = (msg) => problems.push(msg);
const stop = (what) => { if (problems.length) { console.error(`build FAILED (${what}): ${problems.length} problem(s)`); for (const p of problems.slice(0, 80)) console.error('  - ' + p); process.exit(1); } };

// ---- content ---------------------------------------------------------------------------------------------------
const site = json('src/content/site.json');
const home = json('src/content/home.json');
const images = json('src/content/images.json');
const ORIGIN = site.origin;
if (ORIGIN !== route.ORIGIN) fail(`site.json origin ${ORIGIN} differs from route.ORIGIN ${route.ORIGIN}`);
const ui = site.ui;
const pending = new Set((site.pending && site.pending.paths || []).map((p) => route.normalize(p.path)));
// planned.json (tools/make-planned.mjs): every page and article the plan calls for. A link or a related slug may point
// at a planned page that is not built yet (counted, not rendered for related); --strict (publish mode) refuses both,
// and pending paths too.
const STRICT = process.argv.includes('--strict');
const planned = fs.existsSync(path.join(ROOT, 'src/content/planned.json')) ? json('src/content/planned.json') : { pages: [], articles: [] };
const plannedArticles = new Set(planned.articles || []);
const plannedPaths = new Set([...(planned.pages || []).map((p) => route.normalize(p)), ...[...plannedArticles].map((s) => route.normalize(`${site.blog.path}${s}/`))]);

// ---- code: templates, blocks, v2's home sections ----------------------------------------------------------------
const TEMPLATES = ['home', 'locations-hub', 'location', 'service-area-hub', 'service-area', 'menu-placeholder', 'deals', 'rewards', 'about', 'contact', 'careers', 'hub', 'guide', 'faq', 'legal', 'sitemap', 'search', '404', 'article', 'blog-index'];
const templates = {};
for (const f of listDir('src/templates', /^[a-z0-9-]+\.mjs$/)) {
  const mod = await import(pathToFileURL(path.join(ROOT, 'src/templates', f)).href);
  if (typeof mod.render !== 'function') fail(`src/templates/${f} does not export render()`);
  templates[f.replace(/\.mjs$/, '')] = mod;
}
for (const t of TEMPLATES) if (!templates[t]) fail(`template "${t}" (contract §6) is missing: src/templates/${t}.mjs`);
const blockRenderers = {};
for (const f of listDir('src/blocks', /^[a-z0-9-]+\.mjs$/)) {
  if (f === 'core.mjs') continue;
  const mod = await import(pathToFileURL(path.join(ROOT, 'src/blocks', f)).href);
  if (typeof mod.render !== 'function') { fail(`src/blocks/${f} does not export render()`); continue; }
  blockRenderers[f.replace(/\.mjs$/, '')] = mod.render;
}
const sections = [];
for (const f of listDir('src/sections', /^\d\d-.*\.mjs$/)) {
  if (/^(00|09)-/.test(f)) continue;   // v2's chrome and footer: replaced by src/chrome
  const mod = await import(pathToFileURL(path.join(ROOT, 'src/sections', f)).href);
  if (typeof mod.render !== 'function') { fail(`src/sections/${f} does not export render()`); continue; }
  sections.push({ name: f.replace(/\.mjs$/, ''), meta: mod.meta || {}, render: mod.render });
}
const sectionCtx = { images, origin: home.meta.origin, sections: sections.map((s) => ({ name: s.name, ...s.meta })) };
stop('code');

// ---- pages and articles -------------------------------------------------------------------------------------------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateText = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${dd}, ${y}`; };
const words = (s) => (plainText(s).match(/\S+/g) || []).length;
const cats = new Map(site.blog.categories.map((c) => [c.slug, c]));

const pages = [];
for (const f of listDir('src/content/pages', /\.json$/)) {
  const p = json('src/content/pages/' + f);
  p._src = 'pages/' + f;
  if (p.template === 'home') {
    // the home's head comes from home.json (v2's own title, description, H1): the page JSON holds only the additions
    p.titleFull = p.titleFull || home.meta.title;
    p.metaDescription = p.metaDescription || home.meta.description;
    p.h1 = p.h1 || home.hero.title;
  }
  if (!p.path) { fail(`${p._src}: no "path"`); continue; }
  p.path = p.path === '/404.html' ? p.path : route.normalize(p.path);
  if (!templates[p.template]) fail(`${p._src}: unknown template "${p.template}"`);
  if (!p.title && !p.titleFull) fail(`${p._src}: no "title"`);
  if (!p.metaDescription) fail(`${p._src}: no "metaDescription"`);
  if (!p.h1) fail(`${p._src}: no "h1"`);
  for (const b of p.blocks || []) if (!blockRenderers[b.type]) fail(`${p._src}: unknown block type "${b.type}"`);
  pages.push(p);
}
const RESERVED = new Set(['p', ...cats.keys()]);
const articles = [];
for (const f of listDir('src/content/blog', /\.json$/)) {
  const a = json('src/content/blog/' + f);
  a._src = 'blog/' + f;
  const slug = f.replace(/\.json$/, '');
  if (a.slug !== slug) fail(`${a._src}: slug "${a.slug}" is not the file name`);
  if (RESERVED.has(slug)) fail(`${a._src}: slug "${slug}" is reserved (a blog category or the pager)`);
  if (!cats.has(a.category)) fail(`${a._src}: category "${a.category}" is not one of site.json blog.categories`);
  for (const k of ['title', 'h1', 'metaDescription', 'excerpt', 'published', 'body']) if (!a[k]) fail(`${a._src}: no "${k}"`);
  if (a.published && !/^\d{4}-\d{2}-\d{2}$/.test(a.published)) fail(`${a._src}: published must be YYYY-MM-DD`);
  if (a.recipe && (!Array.isArray(a.recipe.ingredients) || !Array.isArray(a.recipe.steps))) fail(`${a._src}: recipe needs ingredients[] and steps[]`);
  Object.assign(a, {
    path: site.blog.path + slug + '/', template: 'article', crumb: a.h1,
    categoryName: cats.has(a.category) ? cats.get(a.category).name : a.category,
    dateText: a.published ? dateText(a.published) : '',
    readMinutes: Math.max(1, Math.ceil(words([a.body, ...(a.keyTakeaways || []), ...(a.faq || []).map((q) => q.q + ' ' + q.a)].join('\n')) / 230)),
  });
  articles.push(a);
}
// a related slug that is planned but not written yet is left out of the page (and counted); anything else fails
const relatedPlanned = new Map();
for (const a of articles) {
  a.related = (a.related || []).filter((r) => {
    if (articles.some((x) => x.slug === r)) return true;
    if (!STRICT && plannedArticles.has(r)) { relatedPlanned.set(r, (relatedPlanned.get(r) || 0) + 1); return false; }
    fail(`${a._src}: related "${r}" is not an article${plannedArticles.has(r) ? ' yet (planned; --strict)' : ''}`);
    return false;
  });
}
articles.sort((x, y) => (x.published < y.published ? 1 : x.published > y.published ? -1 : x.slug < y.slug ? -1 : 1));
pages.push(...articles);

// the blog listings: the blog home's page JSON (template blog-index at site.json blog.path) and one page per category
// (its own page JSON when there is one, else from site.json blog.categories), each paginated by blog.perPage
const per = site.blog.perPage;
const blogHome = pages.find((p) => p.path === site.blog.path);
if (!blogHome || blogHome.template !== 'blog-index') fail(`src/content/pages: the blog home (${site.blog.path}, template blog-index) is required`);
stop('content');
const paginate = (base, items, category) => {
  const count = Math.max(1, Math.ceil(items.length / per));
  base.listing = { category, pageNum: 1, pageCount: count, items: items.slice(0, per), basePath: base.path };
  for (let n = 2; n <= count; n++) {
    pages.push({
      ...base, path: `${base.path}p/${n}/`, _src: base._src + ` (page ${n})`, generated: true,
      title: `${base.title.split(':')[0]}: ${ui.page} ${n}`, titleFull: base.titleFull ? `${base.titleFull} (${ui.page} ${n})` : undefined,
      metaDescription: `${base.metaDescription} ${ui.page} ${n}.`, h1: `${base.h1}: ${ui.page} ${n}`, crumb: `${ui.page} ${n}`,
      breadcrumbs: [{ name: ui.home, path: '/' }, { name: base.crumb || base.h1, path: base.path }, { name: `${ui.page} ${n}` }],
      listing: { category, pageNum: n, pageCount: count, items: items.slice((n - 1) * per, n * per), basePath: base.path },
    });
  }
};
paginate(blogHome, articles, null);
for (const c of site.blog.categories) {
  const p = site.blog.path + c.slug + '/';
  let base = pages.find((x) => x.path === p);
  if (!base) {
    base = { path: p, template: 'blog-index', title: c.title, metaDescription: c.metaDescription, h1: c.name, crumb: c.name, hero: { eyebrow: site.blog.name, lead: c.lead }, _src: 'site.json blog.categories', generated: true };
    pages.push(base);
  }
  paginate(base, articles.filter((a) => a.category === c.slug), c.slug);
}

// unique paths, then path order (deterministic output order)
const byPath = new Map();
for (const p of pages) { if (byPath.has(p.path)) fail(`duplicate path ${p.path}: ${byPath.get(p.path)._src} and ${p._src}`); byPath.set(p.path, p); }
stop('paths');
pages.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
// a page JSON with "indexable": false (the legal holding pages, until High Society supplies the text) gets
// noindex, follow and stays out of sitemap.xml and the search index; the /site-map/ page still lists it
for (const p of pages) if ('indexable' in p && typeof p.indexable !== 'boolean') fail(`${p._src || p.path}: "indexable" must be true or false`);
stop('indexable');
const listed = pages.filter((p) => p.path !== '/404.html');
const indexable = listed.filter((p) => p.indexable !== false);

// the /site-map/ groups (site.json ia.sitemap), pagination pages left out
const SM = site.ia.sitemap;
// (the home is "Home", not its h1; in each group the index pages, such as /blog/ and its categories, come before the
// articles, so a group reads as an index first)
const smGroups = SM.groups.map((g) => ({ title: g.title, links: [], articles: [] }));
const smOther = { title: SM.other, links: [], articles: [] };
for (const p of listed) {
  if (/\/p\/\d+\/$/.test(p.path)) continue;
  const k = SM.groups.findIndex((g) => (g.paths || []).includes(p.path) || (g.prefixes || []).some((x) => p.path.startsWith(x)));
  const g = k >= 0 ? smGroups[k] : smOther;
  (p.template === 'article' ? g.articles : g.links).push({ text: p.path === '/' ? ui.home : p.crumb || p.h1, path: p.path });
  if (k < 0) console.warn(`  note: ${p.path} is in no site.json ia.sitemap group; listed under "${SM.other}"`);
}
const sitemapGroups = [...smGroups, smOther].map((g) => ({ title: g.title, links: [...g.links, ...g.articles] })).filter((g) => g.links.length);

// ---- render ---------------------------------------------------------------------------------------------------------
const STATIC_FILES = new Set(['/search-index.json', '/sitemap.xml', '/robots.txt']);
const lcpPreload = (body, h) => {
  // v2's rule, per page: the first screen's largest picture is preloaded with the srcset and sizes its <img> uses (the
  // image a template marks data-lcp); an art-directed one (<picture> + data-lcp-media) gets one preload per media
  const lcpImg = /<img([^>]*\sdata-lcp\b[^>]*)>/.exec(body);
  const lcpAttr = (k) => { const x = lcpImg && new RegExp('\\s' + k + '="([^"]*)"').exec(lcpImg[1]); return x ? x[1] : ''; };
  const lcpSource = lcpImg && lcpAttr('data-lcp-media') ? (() => { const at = body.indexOf(lcpImg[0]); const pic = body.lastIndexOf('<picture>', at); const src = pic >= 0 ? /<source([^>]*)>/.exec(body.slice(pic, at)) : null; return src ? src[1] : null; })() : null;
  const srcAttr = (k) => { const x = lcpSource && new RegExp('\\s' + k + '="([^"]*)"').exec(lcpSource); return x ? x[1] : ''; };
  const lcpAvif = lcpSource ? (() => { const at = body.indexOf(lcpImg[0]); const pic = body.lastIndexOf('<picture>', at); const m2 = /<source([^>]*\stype="image\/avif"[^>]*)>/.exec(body.slice(pic, at)); return m2 ? m2[1] : null; })() : null;
  const avifAttr = (k) => { const x = lcpAvif && new RegExp('\\s' + k + '="([^"]*)"').exec(lcpAvif); return x ? x[1] : ''; };
  return !lcpImg ? '' : lcpSource
    ? `<link rel="preload" as="image" media="${srcAttr('media')}" imagesrcset="${srcAttr('srcset')}" imagesizes="${srcAttr('sizes')}" fetchpriority="high">` + (lcpAvif
      ? `<link rel="preload" as="image" type="image/avif" media="${lcpAttr('data-lcp-media')}" imagesrcset="${avifAttr('srcset')}" imagesizes="${avifAttr('sizes')}" fetchpriority="high">`
      : `<link rel="preload" as="image" media="${lcpAttr('data-lcp-media')}" href="${lcpAttr('src')}"${lcpAttr('srcset') ? ` imagesrcset="${lcpAttr('srcset')}" imagesizes="${lcpAttr('sizes')}"` : ''} fetchpriority="high">`)
    : `<link rel="preload" as="image" href="${lcpAttr('src')}"${lcpAttr('srcset') ? ` imagesrcset="${lcpAttr('srcset')}" imagesizes="${lcpAttr('sizes')}"` : ''} fetchpriority="high">`;
};
const homeExtraHead = home.meta.head.filter((t) => ['og:image:secure_url', 'google-site-verification'].includes(t.key));
const CSS_TOKEN = '__CSS_HASH__', JS_TOKEN = '__JS_HASH__';

const rendered = [];
for (const page of pages) {
  const is404 = page.path === '/404.html';
  const links = new Set();
  const h = makeHelpers({ content: home, images, origin: home.meta.origin, page: page.path, absolute: is404, onLink: (p) => links.add(p) });
  const usedIds = new Set();
  const uid = (base) => { let id = base, n = 1; while (usedIds.has(id)) id = base + '-' + (++n); usedIds.add(id); return id; };
  const rejected = [];
  const mdOpts = { link: (p) => h.link(p), usedIds, tableLabel: ui.tableLabel };
  const mdDoc = (src) => { const r = renderMarkdown(src, mdOpts); rejected.push(...r.rejected); for (const w of r.warnings) console.warn(`  note: ${page.path}: ${w}`); return r; };
  const md = (src) => mdDoc(src).html;
  const inline = (src) => { const col = { links: [], rejected: [] }; const html = renderInline(src, { link: (p) => h.link(p), collect: col }); rejected.push(...col.rejected); return html; };
  const extraLd = [];
  const ctx = {
    h, md, mdDoc, inline, uid, ui, site, home, images, page, articles, pages: byPath, ld: seo.ld, route,
    jsonld: (n) => extraLd.push(n), blockRenderers, sections, sectionCtx, sitemapGroups,
  };
  let r;
  try { r = templates[page.template].render(page, ctx); } catch (e) { fail(`${page.path} (${page._src}, template ${page.template}): ${e.message}`); continue; }
  for (const x of rejected) fail(`${page.path} (${page._src}): Markdown link refused (not a site path, #fragment, https/http, mailto or tel): ${JSON.stringify(x)}`);

  const chrome = renderChrome({ site, home, h });
  const takenIds = new Set([...chrome.header.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const footer = renderFooter({ site, home, h, takenIds });

  const title = page.titleFull || page.title + site.brand.titleSuffix;
  const heroFile = page.hero && page.hero.image ? h.imgFile(page.hero.image, 1200).replace(/^(\.\.\/|\/)+/, '') : null;
  const head = seo.headTags({
    title, description: page.metaDescription,
    canonical: is404 ? null : route.canonical(page.path),
    robots: is404 || page.indexable === false ? 'noindex, follow' : seo.ROBOTS_INDEX,
    ogType: page.template === 'article' ? 'article' : 'website',
    ogImage: page.template !== 'home' && heroFile ? ORIGIN + '/' + heroFile : site.brand.ogImage,
    siteName: site.brand.name,
    extra: page.template === 'home' ? homeExtraHead : [],
  });
  const ld = seo.jsonLdScript([...(r.jsonld || []), ...extraLd, ...(page.jsonld || [])]);
  const html = `<!doctype html>
<html lang="${esc(site.brand.lang)}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
<meta name="theme-color" content="${esc(site.brand.themeColor)}">
<link rel="icon" type="image/svg+xml" href="${h.asset(site.brand.icon)}">
<script>document.documentElement.className=document.documentElement.className.replace('no-js','js');requestAnimationFrame(function(){var e=document.documentElement;if(e.className.indexOf('reveal-on')<0)e.className+=' hero-shown'})</script>
<link rel="preload" href="${h.asset('assets/changa-one-400.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${h.asset('assets/work-sans-400.woff2')}" as="font" type="font/woff2" crossorigin>
${lcpPreload(r.main, h)}
<link rel="stylesheet" href="${h.asset('styles/site.css')}?v=${CSS_TOKEN}">
${ld}
</head>
<body data-template="${esc(page.template)}"${page.brief && page.brief.riskLevel === 'medical' ? ' data-risk="medical"' : ''}>
${chrome.header}
<main id="main-inner" class="${esc(r.mainClass || 'page')}">
${r.main}
</main>
${footer}
${chrome.after}
<script src="${h.asset('scripts/site.js')}?v=${JS_TOKEN}" defer onerror="document.documentElement.className=document.documentElement.className.replace(/\\bjs\\b/,'no-js')"></script>
</body>
</html>
`;
  // per page: one h1, no duplicate id
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) fail(`${page.path}: ${h1s} <h1> elements (one per page)`);
  const ids = new Map();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.set(m[1], (ids.get(m[1]) || 0) + 1);
  for (const [id, n] of ids) if (n > 1) fail(`${page.path}: id "${id}" is used ${n} times`);
  rendered.push({ page, html, links });
}
stop('render');

// every internal link target is a built page, a built file, a pending path (site.json pending.paths) or a planned page
// not built yet (planned.json); --strict accepts only built pages and files
const built = new Set(pages.map((p) => p.path));
const pendingHits = new Map(), plannedHits = new Map();
for (const { page, links } of rendered) {
  for (const l of links) {
    const target = l.replace(/[?#].*$/, '');
    if (built.has(target) || STATIC_FILES.has(target)) continue;
    if (!STRICT && pending.has(target)) { pendingHits.set(target, (pendingHits.get(target) || 0) + 1); continue; }
    if (!STRICT && plannedPaths.has(target)) { plannedHits.set(target, (plannedHits.get(target) || 0) + 1); continue; }
    fail(`${page.path} (${page._src}) links to ${l}: no such page${STRICT && (pending.has(target) || plannedPaths.has(target)) ? ' yet (pending or planned; --strict)' : ' (add the page, or list it in site.json pending.paths)'}`);
  }
}
stop('links');

// ---- styles -------------------------------------------------------------------------------------------------------
const cssFiles = [
  ...['tokens.css', 'fonts.css', 'theme.css', 'base.css', 'components.css'].map((f) => 'src/styles/' + f),
  ...listDir('src/styles/sections', /\.css$/).map((f) => 'src/styles/sections/' + f),
  'src/styles/chrome.css',
  ...listDir('src/styles/blocks', /\.css$/).map((f) => 'src/styles/blocks/' + f),
  ...listDir('src/styles/templates', /\.css$/).map((f) => 'src/styles/templates/' + f),
];
let css = cssFiles.map((f) => `/* ==== ${f.replace('src/styles/', '')} ==== */\n` + read(f)).join('\n\n');
// A `*/` inside comment prose silently ends the comment and kills the rules after it.
const opens = (css.match(/\/\*/g) || []).length; const closes = (css.match(/\*\//g) || []).length;
if (opens !== closes) throw new Error(`CSS comment delimiters unbalanced: ${opens} "/*" vs ${closes} "*/"`);

// v2's lean CSS: 1. custom properties nothing reads are dropped (tokens.css keeps every value the live site was measured
// with); 2. comments and runs of whitespace go; strings and url() are copied untouched
const referenced = (txt) => new Set([...txt.matchAll(/var\(\s*(--[\w-]+)/g), ...txt.matchAll(/setProperty\(\s*'(--[\w-]+)'/g)].map((m) => m[1]));
const KEEP = /^--(slide-mode|red|black|white|dark-red|cream|charcoal|headlight|neon|oxblood|night|chrome|clay|bar-h|dock-h|fab-h|pad-x|pad-y|s-[1-6]|radius|font-(display|head|body)|fs-[a-z0-9]+)$/;
function pruneVars(src, extra) {
  for (let pass = 0; pass < 6; pass++) {
    const used = referenced(src + '\n' + extra);
    const next = src.replace(/(^|[;{\s])(--[\w-]+)\s*:[^;{}]*;/g, (m, pre, name) => (used.has(name) || KEEP.test(name) ? m : pre));
    if (next === src) return src;
    src = next;
  }
  return src;
}
function minifyCss(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const ch = src[i];
    if (q) { out += ch; if (ch === '\\') { out += src[i + 1] || ''; i += 2; continue; } if (ch === q) q = null; i++; continue; }
    if (ch === '"' || ch === "'") { q = ch; out += ch; i++; continue; }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (/\s/.test(ch)) { while (i < src.length && /\s/.test(src[i])) i++; if (!out.endsWith(' ')) out += ' '; continue; }
    out += ch; i++;
  }
  return out.replace(/ ?([{};]) ?/g, '$1').replace(/;}/g, '}').trim();
}
const cssSourceBytes = css.length;

// ---- script -------------------------------------------------------------------------------------------------------
const jsFiles = ['src/scripts/site.js', ...listDir('src/scripts/sections', /\.js$/).map((f) => 'src/scripts/sections/' + f), ...listDir('src/scripts/pages', /\.js$/).map((f) => 'src/scripts/pages/' + f)];
let js = jsFiles.map((f, i) => (i ? `\n\n/* ==== ${f.replace('src/scripts/', '')} ==== */\n` : '') + read(f)).join('');
css = minifyCss(pruneVars(css, js + '\n' + rendered.map((r) => r.html).join('\n')));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
// the script ships minified (comments and whitespace only, nothing renamed): fail closed if the minified script's
// tokens differ from the source's or it does not compile
{
  const min = minifyJs(js), sig = (s) => jsTokens(s).map((t) => t.t + ':' + t.v).join('\u0001');
  if (sig(min) !== sig(js)) throw new Error('jsmin: the minified site.js does not carry the same tokens as the source');
  new vm.Script(min, { filename: 'site.js' });
  js = min;
}
const cssHash = hash(css), jsHash = hash(js);
for (const r of rendered) r.html = r.html.replace(CSS_TOKEN, cssHash).replace(JS_TOKEN, jsHash);

// ---- the generated files ---------------------------------------------------------------------------------------------
const searchIndex = JSON.stringify(indexable.map((p) => ({
  p: p.path, t: p.titleFull || p.title, h: p.h1, d: p.metaDescription, k: p.template, ...(p.categoryName ? { c: p.categoryName } : {}),
})));
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + indexable.map((p) => `  <url><loc>${xmlEsc(route.canonical(p.path))}</loc>${p.template === 'article' && p.published ? `<lastmod>${p.updated || p.published}</lastmod>` : ''}</url>`).join('\n')
  + `\n</urlset>\n`;
// production robots: everything crawlable but the search results (?q=...); the preview step replaces this file
const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /search/?\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;

// ---- write (temp dir, then swap) ----------------------------------------------------------------------------------
const fileOf = (p) => (p === '/404.html' ? '404.html' : p === '/' ? 'index.html' : p.slice(1) + 'index.html');
const tmp = OUT + '.tmp-' + process.pid;
fs.rmSync(tmp, { recursive: true, force: true });
for (const d of ['styles', 'scripts', 'assets']) fs.mkdirSync(path.join(tmp, d), { recursive: true });
let htmlBytes = 0;
for (const r of rendered) {
  const f = path.join(tmp, fileOf(r.page.path));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, r.html); htmlBytes += Buffer.byteLength(r.html);
}
fs.writeFileSync(path.join(tmp, 'styles', 'site.css'), css);
fs.writeFileSync(path.join(tmp, 'scripts', 'site.js'), js);
fs.writeFileSync(path.join(tmp, 'search-index.json'), searchIndex);
fs.writeFileSync(path.join(tmp, 'sitemap.xml'), sitemapXml);
fs.writeFileSync(path.join(tmp, 'robots.txt'), robotsTxt);
// an asset reference is a local URL (page-relative "../assets/x", root-relative "/assets/x" on 404.html) or one on the
// site's own origin (og:image, JSON-LD); "assets/" inside another site's URL (".../siteassets/publications/...", an
// article source) is not ours
const used = new Set();
const ASSET_REF = new RegExp(`(?:(?<=["'(\\s,=])(?:\\.\\./)*/?|${ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/)assets/([A-Za-z0-9._-]+)`, 'g');
for (const t of [css, ...rendered.map((r) => r.html)]) for (const m of t.matchAll(ASSET_REF)) used.add(m[1]);
let assetBytes = 0;
for (const f of [...used].sort()) {
  const src = path.join(ROOT, 'assets', 'optimized', f);
  if (!fs.existsSync(src)) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('referenced asset is missing from assets/optimized: ' + f); }
  fs.copyFileSync(src, path.join(tmp, 'assets', f)); assetBytes += fs.statSync(src).size;
}
const STATIC = path.join(ROOT, 'src', 'static');
if (fs.existsSync(STATIC)) for (const f of fs.readdirSync(STATIC).sort()) fs.copyFileSync(path.join(STATIC, f), path.join(tmp, f));
// Windows refuses a rename while another process holds a file in dist/ open (a server streaming a file, a scanner):
// retry for a few seconds, then fail closed with the temp build left beside dist/
const old = OUT + '.old-' + process.pid;
const renameRetry = (a, z) => {
  for (let k = 0; ; k++) {
    try { fs.renameSync(a, z); return; } catch (e) {
      if (k >= 40 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw new Error(`could not move ${a} to ${z} (${e.code}); the new build is in ${tmp}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
};
if (fs.existsSync(OUT)) renameRetry(OUT, old);
renameRetry(tmp, OUT);
fs.rmSync(old, { recursive: true, force: true });

// ---- summary --------------------------------------------------------------------------------------------------------
const byTpl = {};
for (const r of rendered) { const k = r.page.template + (templates[r.page.template].meta && templates[r.page.template].meta.stub ? ' (stub)' : ''); byTpl[k] = (byTpl[k] || 0) + 1; }
console.log(`built ${path.relative(ROOT, OUT) || '.'}/: ${rendered.length} pages, ${articles.length} articles, ${used.size} assets`);
console.log('  pages per template: ' + Object.entries(byTpl).sort().map(([k, n]) => `${k} ${n}`).join(', '));
console.log(`  html ${(htmlBytes / 1024).toFixed(0)} KB total (${(htmlBytes / rendered.length / 1024).toFixed(1)} KB/page) · css ${(css.length / 1024).toFixed(1)} KB (from ${(cssSourceBytes / 1024).toFixed(0)} KB of source) · js ${(js.length / 1024).toFixed(1)} KB · assets ${(assetBytes / 1024).toFixed(0)} KB · search-index ${(searchIndex.length / 1024).toFixed(1)} KB`);
if (pendingHits.size) console.log(`  pending link targets (allowed; site.json pending.paths): ${[...pendingHits].map(([p, n]) => `${p} (${n} links)`).join(', ')}`);
if (plannedHits.size || relatedPlanned.size) {
  const nLinks = [...plannedHits.values()].reduce((x, y) => x + y, 0), nRel = [...relatedPlanned.values()].reduce((x, y) => x + y, 0);
  console.log(`  planned, not built yet (allowed; planned.json): ${plannedHits.size} link targets (${nLinks} links), ${relatedPlanned.size} related slugs left out (${nRel} times); first: ${[...plannedHits.keys()].sort().slice(0, 6).join(', ')}`);
}
if (STRICT) console.log('  strict: every link and related slug resolves to a built page');
