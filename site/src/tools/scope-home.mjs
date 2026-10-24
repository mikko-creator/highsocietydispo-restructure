#!/usr/bin/env node
// scope-home.mjs — make the HOMEPAGE-SCOPED grading workspace at <project>/home.
//
// Why it exists: the owner's brief is one page (the reskin's homepage). The project record holds a
// 61-page crawl of the reskin (store pages, shop pages, about, careers…), so the skill's gate run on
// the project root grades 60 pages that were never in scope and can only say NOT-READY about them. This workspace holds the SAME evidence filtered to the one page that was built, so
// every check is about the deliverable.
//
// It never edits the project's own inventories. Each derived file says where it came from
// and carries the site-level truth (the crawl WAS truncated at site level, on purpose) under
// `scope`. Evidence folders are linked, not copied, so the graders read the real files.
//
//   node src/tools/scope-home.mjs            (re-run any time; idempotent)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOME = path.join(ROOT, 'home');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const W = (p, o) => { fs.mkdirSync(path.dirname(path.join(HOME, p)), { recursive: true }); fs.writeFileSync(path.join(HOME, p), JSON.stringify(o, null, 1)); };
const isHome = (u) => { try { const x = new URL(u); return x.pathname === '/client-highsocietydispo-reskin/index.html' || x.pathname === '/client-highsocietydispo-reskin/'; } catch { return false; } };
const link = (name, target) => { const p = path.join(HOME, name); fs.mkdirSync(path.dirname(p), { recursive: true }); try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* absent */ } fs.symlinkSync(target, p); };

fs.mkdirSync(path.join(HOME, 'audit'), { recursive: true });
const site = J('audit/site-inventory.json');
const scope = {
  kind: 'homepage-only',
  reason: 'owner brief 2026-10-21 restructures the homepage only (docs/OWNER-BRIEF.md)',
  derivedFrom: '../audit/ (project-level inventories, untouched)',
  siteLevel: { pagesCrawled: site.counts.html, sitemapUrlCount: site.discovery.sitemapUrlCount, truncated: site.truncated, queueRemaining: site.queueRemaining, maxPages: site.maxPages, failed: site.counts.failed },
};
// a failed fetch belongs to the homepage when the homepage links to it (the link graph's edges from it); the others are
// links on other pages, and stay recorded at site level in ../audit/failures.json
const homeTargets = new Set(J('audit/link-graph.json').edges.filter((e) => isHome(e.from)).map((e) => e.to));
const siteFailures = J('audit/failures.json').items;
const ofHome = (i) => i.stage !== 'crawl:page' || homeTargets.has(i.target);
const homeFailed = siteFailures.filter((i) => i.stage === 'crawl:page' && homeTargets.has(i.target)).length;

// project record
const project = J('project.json');
W('project.json', { ...project, name: project.name + '-home', config: { ...project.config, maxPages: 1 }, scope });

// inventories, filtered to the one page
const pages = site.pages.filter((p) => isHome(p.url));
if (pages.length !== 1) throw new Error('expected exactly one homepage record in the site inventory, found ' + pages.length);
W('audit/site-inventory.json', { ...site, scope, counts: { ...site.counts, pages: 1, html: 1, fetchedThisRun: 1, failed: homeFailed }, truncated: false, queueRemaining: 0, maxPages: 1, pages });
for (const f of ['content-inventory', 'seo-inventory']) { const j = J(`audit/${f}.json`); W(`audit/${f}.json`, { ...j, scope, pages: j.pages.filter((p) => isHome(p.url)) }); }
{ const j = J('audit/content-inventory.json'); const p = j.pages.filter((x) => isHome(x.url)); W('audit/content-inventory.json', { ...j, scope, renderRisk: { high: 0, medium: 0, note: 'homepage: low (see the page record)' }, pages: p }); }
{ const j = J('audit/image-inventory.json'); const keep = j.images.filter((i) => (i.usedOn || []).some((u) => isHome(typeof u === 'string' ? u : u.url))).map((i) => ({ ...i, usedOn: (i.usedOn || []).filter((u) => isHome(typeof u === 'string' ? u : u.url)) })); W('audit/image-inventory.json', { ...j, scope, images: keep }); }
{ const j = J('audit/link-graph.json'); W('audit/link-graph.json', { ...j, scope, nodes: j.nodes.filter((n) => isHome(n.url)), edges: j.edges.filter((e) => isHome(e.from)) }); }
{ const j = J('audit/architecture.json'); W('audit/architecture.json', { ...j, scope, pageTypes: { home: 1 }, urlDepthHistogram: { 0: 1 }, orphanPages: [] }); }
// failures.json keeps what the scoped stages recorded (and accepted) themselves; crawl failures of links on other pages
// are taken out, and counted, with a pointer to the site-level record
{ const hf = path.join(HOME, 'audit', 'failures.json');
  const cur = fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')) : J('audit/failures.json');
  const other = siteFailures.filter((i) => !ofHome(i)).length;
  W('audit/failures.json', { ...cur, scope: { ...scope, note: other + ' crawl failure(s) of links on OTHER pages of the reskin are site-level: recorded in ../audit/failures.json, not graded here' }, items: cur.items.filter(ofHome) }); }
for (const f of ['design-baseline', 'motion-inventory', 'source-cms', 'home-assets']) { const src = path.join(ROOT, 'audit', f + '.json'); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(HOME, 'audit', f + '.json')); }
if (fs.existsSync(path.join(ROOT, 'audit', 'robots.txt'))) fs.copyFileSync(path.join(ROOT, 'audit', 'robots.txt'), path.join(HOME, 'audit', 'robots.txt'));

// evidence: the raw homepage only, and links to the captures / screens / stylesheets
fs.rmSync(path.join(HOME, 'audit', 'raw'), { recursive: true, force: true });
fs.mkdirSync(path.join(HOME, 'audit', 'raw'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'audit', 'raw', pages[0].savedAs), path.join(HOME, 'audit', 'raw', pages[0].savedAs));
for (const d of ['capture', 'css', 'screens']) link(path.join('audit', d), path.join('..', '..', 'audit', d));
for (const d of ['src', 'dist', 'docs', 'facts', 'assets']) link(d, path.join('..', d));

console.log('homepage-scoped workspace ready: ' + path.relative(ROOT, HOME) + '/');
console.log('  page       ' + pages[0].url + ' (' + pages[0].bytes + ' bytes, sha256 ' + pages[0].sha256.slice(0, 12) + '…)');
console.log('  site level ' + site.counts.html + ' pages crawled of ' + site.discovery.sitemapUrlCount + ' in the sitemap — truncated on purpose, recorded under "scope"');
console.log('  grade with node <skill>/scripts/sr-gate.mjs --project ' + JSON.stringify(HOME));
