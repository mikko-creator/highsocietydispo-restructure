#!/usr/bin/env node
// accept-failures.mjs — close the homepage workspace's recorded fetch failures DELIBERATELY, one reason per item, and
// only for things the rebuild does not need. Anything the built page loads is never accepted here: it stays open and
// keeps gate check C24 red. The unfilled CMS token is the one exception the brief makes: its links are kept verbatim.
//   node src/tools/accept-failures.mjs [--project home]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const i = process.argv.indexOf('--project'); const P = path.resolve(ROOT, i > 0 ? process.argv[i + 1] : 'home');
const file = path.join(P, 'audit', 'failures.json'); const f = JSON.parse(fs.readFileSync(file, 'utf8'));
const built = ['index.html', 'styles/site.css', 'scripts/site.js'].map((x) => fs.readFileSync(path.join(ROOT, 'dist', x), 'utf8')).join('\n');
const BASE = 'https://sgencms.github.io/client-highsocietydispo-reskin/';
// a reference the page would fetch: the path inside url(), or a src / href / srcset value (not the same letters in prose
// or a CSS keyword: "normal")
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const loads = (rel) => new RegExp('(?:url\\(\\s*["\']?|(?:src|href|srcset)="(?:[^"]*[\\s,])?)' + esc(rel) + '(?=["\')\\s,?#])').test(built);
let acc = 0, open = 0;
for (const it of f.items) {
  if (it.accepted) continue;
  const u = String(it.target || ''); const rel = u.startsWith(BASE) ? u.slice(BASE.length) : '';
  let why = null;
  if (it.stage === 'crawl:page' && u.includes('%7B%7Blocation_shop_url%7D%7D')) why = 'the CMS token {{location_shop_url}}: the CMS writes the chosen store\'s shop address into it when it serves the page; on the static github.io copy the unfilled token resolves to a path that does not exist. The brief keeps every link, so the rebuild carries the token verbatim and site.js opens the store chooser on a click of an unfilled token (docs/DEPLOY.md).';
  else if (rel && loads(rel)) { open++; continue; }                  // the page loads it: never waive
  else if (it.stage === 'crawl:robots') why = 'sgencms.github.io serves no robots.txt (404): there is no Disallow to honour and nothing to carry over.';
  else if (it.stage === 'assets:font') why = 'a font URL in the reskin\'s CSS that 404s on its own host (a rewritten Google Fonts path / a CSS keyword read as a url); the rebuild self-hosts the brand card\'s own faces (Changa One, Changa, Work Sans) and loads neither.';
  else if (it.stage === 'assets:data' && /fancybox/.test(u)) why = 'a data file of the CMS\'s fancybox lightbox plugin (404 on its own host); the platform-free rebuild ships no fancybox.';
  if (!why) { open++; continue; }
  it.accepted = true; it.acceptedReason = why; it.acceptedAt = new Date().toISOString(); acc++;
}
fs.writeFileSync(file, JSON.stringify(f, null, 1));
console.log(`failures: ${f.items.length} recorded, ${acc} accepted now (each with its reason), ${open} left OPEN`);
for (const it of f.items.filter((x) => !x.accepted)) console.log('  OPEN', it.stage, String(it.target).slice(0, 100), '|', String(it.reason).slice(0, 60));
