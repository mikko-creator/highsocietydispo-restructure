#!/usr/bin/env node
// make-preview.mjs — derive the shareable PREVIEW copy of dist/ (what a GitHub Pages project site serves) for the
// multi-page build.
//
// dist/ is the deliverable: every page carries exactly one robots meta ("index, follow, max-image-preview:large", the
// 404 page "noindex, follow") and its canonical on https://highsocietydispo.com, because it is meant to BE that site.
// A preview on another host must never be indexed, so the copy:
//   1. swaps the one robots meta of EVERY .html page for noindex, nofollow, noarchive, noimageindex (fails closed when
//      a page has none or more than one), and proves each swap is the only change by reversing it (byte for byte);
//   2. replaces robots.txt with one that allows crawling and lists no sitemap: a crawler barred by robots.txt never reads
//      a page's noindex and may still index the bare URL from an outside link, so the noindex tags must stay readable
//      (CORE-VERIFY L9; a project site's robots.txt is not read anyway, it is not at the host root);
//   3. adds .nojekyll (GitHub Pages must serve every file as is);
//   4. re-prefixes 404.html's root-relative URLs ("/assets/x", "/deals/") with --prefix (the repo path, "/<repo>/"),
//      because the host serves that one page at any depth under the project path; then proves no root-relative URL
//      outside the prefix is left in it;
//   5. switches off every form that posts to another host (the CMS's contact and employment forms post to
//      highsocietydispo.com): action "#", submit buttons disabled, a one-line note. A stranger on the preview must not
//      reach High Society's inbox or hiring queue; dist/ keeps the CMS action. Reversed byte for byte like step 1.
// Canonical links, sitemap.xml and JSON-LD keep the production origin on purpose: the production site is the real one.
//
//   node src/tools/make-preview.mjs --out <dir> --prefix /<repo>/ [--dist <build>]   (everything in <dir> except .git is replaced)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i < 0 ? null : process.argv[i + 1]; };
// --dist <dir>: another build to derive from (default dist/; the fail-closed control uses a planted copy)
const DIST = path.resolve(arg('dist') || path.join(ROOT, 'dist'));
const outArg = arg('out'), prefix = arg('prefix');
if (!outArg || !prefix) { console.error('usage: node src/tools/make-preview.mjs --out <dir> --prefix /<repo>/'); process.exit(2); }
if (!/^\/[A-Za-z0-9._-]+\/$/.test(prefix)) { console.error('--prefix must look like /<repo>/ (one path segment, slashes on both sides): ' + prefix); process.exit(2); }
const OUT = path.resolve(outArg);
if (OUT === DIST || OUT.startsWith(DIST + path.sep) || DIST.startsWith(OUT + path.sep) || OUT === ROOT) { console.error('refusing to write over or inside dist/ or the site root'); process.exit(2); }
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('no dist/index.html: build first'); process.exit(1); }

const NOINDEX = '<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const list = (d, base = d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { const p = path.join(d, e.name); if (e.isDirectory()) list(p, base, acc); else acc.push(path.relative(base, p).split(path.sep).join('/')); } return acc; };
const fail = (m) => { console.error('make-preview FAILED: ' + m); process.exit(1); };

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f !== '.git') fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
fs.cpSync(DIST, OUT, { recursive: true });

// 5. (and its exact reverse, for the proof below)
const OFF_NOTE = '<p class="hsform__note" role="note">Preview copy: this form is switched off and sends nothing.</p>';
let formsSwitchedOff = 0;
const formsOff = (html) => html.replace(/(<form\b[^>]*?\s)action="(https?:\/\/[^"]+)"([^>]*>)([\s\S]*?)<\/form>/g, (m, a, url, b, inner) => {
  formsSwitchedOff++;
  return `${a}action="#" data-preview-action="${url}"${b}${inner.replace(/(<button\b[^>]*\stype="submit")/g, '$1 disabled')}${OFF_NOTE}</form>`;
});
const formsOn = (html) => html.replace(/(<form\b[^>]*?\s)action="#" data-preview-action="(https?:\/\/[^"]+)"([^>]*>)([\s\S]*?)<\/form>/g, (m, a, url, b, inner) =>
  `${a}action="${url}"${b}${inner.replace(/(<button\b[^>]*\stype="submit") disabled/g, '$1').replace(OFF_NOTE, '')}</form>`);

// 1. robots meta on every page (and 5. the outside forms)
const pages = list(DIST).filter((f) => f.endsWith('.html'));
for (const rel of pages) {
  const src = fs.readFileSync(path.join(DIST, rel), 'utf8');
  const tags = src.match(/<meta name="robots"[^>]*>/g) || [];
  if (tags.length !== 1) fail(`expected exactly one robots meta in dist/${rel}, found ${tags.length}`);
  let out = formsOff(src.replace(tags[0], NOINDEX));
  if (formsOn(out).replace(NOINDEX, tags[0]) !== src) fail(`dist/${rel}: the preview differs from dist/ by more than the robots tag and the switched-off forms`);
  // 4. 404.html: every root-relative URL gets the repo prefix (attributes and srcset candidates; never "//host")
  if (rel === '404.html') {
    const before = out;
    out = out.replace(/(\s(?:href|src|action|poster|data-[a-z-]+)=")\/(?!\/)/g, `$1${prefix}`)
      .replace(/(\s(?:srcset|imagesrcset)=")([^"]*)"/g, (m, a, v) => a + v.split(',').map((c) => c.replace(/^(\s*)\/(?!\/)/, `$1${prefix}`)).join(',') + '"');
    const left = [...out.matchAll(/\s(?:href|src|action|poster|srcset|imagesrcset|data-[a-z-]+)="([^"]*)"/g)].map((m) => m[1]).flatMap((v) => v.split(',').map((c) => c.trim().split(/\s+/)[0]))
      .filter((u) => u.startsWith('/') && !u.startsWith('//') && !u.startsWith(prefix));
    if (left.length) fail('404.html keeps root-relative URLs outside ' + prefix + ': ' + left.slice(0, 5).join(', '));
    if (before === out) fail('404.html had no root-relative URL to prefix (was it built with absolute: true?)');
  }
  fs.writeFileSync(path.join(OUT, rel), out);
}
// 2, 3
fs.writeFileSync(path.join(OUT, 'robots.txt'), '# Preview copy: every page carries noindex. Crawling stays allowed so crawlers can read it.\nUser-agent: *\nDisallow:\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// re-read what was written: every page noindex, exactly once
for (const rel of pages) {
  const t = fs.readFileSync(path.join(OUT, rel), 'utf8');
  const n = (t.match(/<meta name="robots"[^>]*>/g) || []).length;
  if (n !== 1 || !t.includes(NOINDEX)) fail(`${rel}: the written preview page does not carry exactly one noindex robots meta`);
  if (/<form\b[^>]*\saction="https?:\/\//.test(t)) fail(`${rel}: a form in the written preview still posts to another host`);
}
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log('preview written: ' + OUT);
console.log(`  pages       ${pages.length} .html, each with one robots meta: ${NOINDEX}`);
console.log(`  files       ${count(OUT)} (dist ${count(DIST)} + .nojekyll)`);
console.log(`  robots.txt  crawling allowed, no sitemap (dist's production robots.txt replaced; the noindex tags do the work)`);
console.log(`  404.html    root-relative URLs prefixed with ${prefix}; sha256 ${sha(fs.readFileSync(path.join(OUT, '404.html'))).slice(0, 16)}…`);
console.log(`  forms       ${formsSwitchedOff} form(s) that post to another host switched off (action "#", submit disabled, a note)`);
