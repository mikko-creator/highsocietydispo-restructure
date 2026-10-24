#!/usr/bin/env node
// link-check.mjs - every internal reference in dist/ resolves to a file in dist/ (PIPELINE role).
// Checks, in every .html file: href, src, poster, action, formaction, cite, data-* URL values (data-src, data-link,
// ...), every srcset / imagesrcset / data-srcset candidate, url() in style attributes and <style> blocks; in every
// .css file: url() and @import. Script bodies and comments are not read (JSON-LD carries absolute live-origin URLs).
//   - external (http:, https:, //host) references are listed per host with counts; tel:/mailto:/data: are counted;
//     javascript:/vbscript: anywhere, and data: as a link, form or cite target, are findings (unsafe-scheme);
//   - "#id" must name an element id on the same page, and "page#id" an id on the target page;
//   - pages are page-relative by contract (src/build.mjs relativizes them), so a root-absolute "/x" in a page is a
//     finding (it would 404 under a Pages project subpath); dist/404.html is served at any depth, so there every
//     local reference must be root-relative and is resolved against the dist root;
//   - a local reference resolves to an existing file (a directory to its index.html), never outside dist/.
// Positive controls (in memory, against the real file set): a missing file, a root-absolute page link, a dead
// fragment, a missing srcset candidate, a missing CSS url() and a page-relative link in 404.html must each be
// reported, and a valid reference must not be; otherwise the run fails.
//   node tools/link-check.mjs [--dir dist] [--json <report.json>]     exit 1 on any broken reference or a dead control
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEME = /^(mailto|tel|sms|data|javascript|vbscript|about|blob):/i;
// script schemes are never allowed; data: only for images and CSS (never a link, form or cite target)
const UNSAFE = (scheme, attr) => scheme === 'javascript' || scheme === 'vbscript' || (scheme === 'data' && ['href', 'action', 'formaction', 'cite'].includes(attr));
const EXTERNAL = /^(https?:)?\/\//i;
const decodeAttr = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const URL_ATTRS = new Set(['href', 'src', 'poster', 'action', 'formaction', 'cite']);
const SRCSET_ATTRS = new Set(['srcset', 'imagesrcset', 'data-srcset']);
const TAG_RE = /<[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const ATTR_RE = /\s([^\s"'>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)/gi;

function listFiles(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

export function refsOfHtml(html) {
  const out = [];
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b(?:"[^"]*"|'[^']*'|[^'">])*>)[\s\S]*?<\/script\s*>/gi, '$1</script>');
  for (const t of body.match(TAG_RE) || []) {
    for (const m of t.matchAll(ATTR_RE)) {
      const name = m[1].toLowerCase();
      const val = decodeAttr(m[2] !== undefined ? m[2] : m[3]);
      if (SRCSET_ATTRS.has(name)) { for (const part of val.split(',')) { const u = part.trim().split(/\s+/)[0]; if (u) out.push({ attr: name, value: u }); } }
      else if (URL_ATTRS.has(name)) out.push({ attr: name, value: val });
      else if (name.startsWith('data-') && /^(\/|\.\.?\/|https?:\/\/)/.test(val)) out.push({ attr: name, value: val });
      else if (name === 'style') for (const u of val.matchAll(CSS_URL)) out.push({ attr: 'style-url', value: (u[1] ?? u[2] ?? u[3]).trim() });
    }
  }
  for (const s of body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) for (const u of s[1].matchAll(CSS_URL)) out.push({ attr: 'style-block-url', value: (u[1] ?? u[2] ?? u[3]).trim() });
  return out;
}
export function refsOfCss(css) {
  const out = [];
  const c = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of c.matchAll(CSS_URL)) out.push({ attr: 'css-url', value: (m[1] ?? m[2] ?? m[3]).trim() });
  for (const m of c.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/gi)) out.push({ attr: 'css-import', value: m[1].trim() });
  return out;
}
const idsOf = (html) => new Set([...html.matchAll(/\sid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)].map((m) => m[1] ?? m[2]));

function checkFile(rel, text, env) {
  const problems = [];
  const isHtml = /\.html?$/i.test(rel);
  const is404 = rel === '404.html';
  const refs = isHtml ? refsOfHtml(text) : refsOfCss(text);
  const ids = isHtml ? idsOf(text) : null;
  let local = 0;
  for (const r of refs) {
    const v = r.value.trim();
    if (!v) { if (r.attr === 'href' || r.attr === 'src') problems.push({ kind: 'empty', attr: r.attr, value: v }); continue; }
    if (EXTERNAL.test(v)) { let host = '(unparsed)'; try { host = new URL(v.startsWith('//') ? 'https:' + v : v).host; } catch { /* keep */ } env.hosts[host] = (env.hosts[host] || 0) + 1; continue; }
    // a CMS token ({{location_shop_url}}, alone or with a query) stays verbatim by contract (BUILD-CONTRACT §2.1): the
    // CMS fills it, the static site's store chooser answers it. Counted, never resolved as a file.
    if (/^\{\{[a-z0-9_]+\}\}/i.test(v)) { env.schemes['cms-token'] = (env.schemes['cms-token'] || 0) + 1; continue; }
    if (SCHEME.test(v)) { const s = v.split(':')[0].toLowerCase(); env.schemes[s] = (env.schemes[s] || 0) + 1; if (UNSAFE(s, r.attr)) problems.push({ kind: 'unsafe-scheme', attr: r.attr, value: v }); continue; }
    if (v.startsWith('#')) {
      if (isHtml && v.length > 1 && !ids.has(decodeURIComponent(v.slice(1)))) problems.push({ kind: 'dead-fragment', attr: r.attr, value: v });
      env.fragments++;
      continue;
    }
    local++;
    if (is404 && isHtml && !v.startsWith('/')) { problems.push({ kind: 'page-relative-in-404', attr: r.attr, value: v }); continue; }
    if (!is404 && isHtml && v.startsWith('/')) { problems.push({ kind: 'root-absolute', attr: r.attr, value: v }); continue; }
    let clean;
    try { clean = decodeURIComponent(v.split('#')[0].split('?')[0]); } catch { problems.push({ kind: 'bad-encoding', attr: r.attr, value: v }); continue; }
    const frag = v.includes('#') ? v.slice(v.indexOf('#') + 1) : '';
    const target = v.startsWith('/') ? path.posix.normalize(clean.replace(/^\/+/, '') || '.') : path.posix.normalize(path.posix.join(path.posix.dirname(rel), clean || '.'));
    if (target.startsWith('..')) { problems.push({ kind: 'escapes-root', attr: r.attr, value: v }); continue; }
    let cands;
    if (clean === '' && !v.startsWith('/')) cands = [rel];                       /* "?q" or "?q#f": this same file */
    else if (clean.endsWith('/') || clean === '' || target === '.') cands = [(target === '.' ? '' : target.replace(/\/?$/, '/')) + 'index.html'];
    else cands = [target, target + '/index.html'];
    const hit = cands.find((c) => env.exists(c));
    if (!hit) { problems.push({ kind: 'missing', attr: r.attr, value: v, resolved: cands[0] }); continue; }
    if (frag && /\.html$/.test(hit)) {
      const tids = env.idsOfFile(hit);
      if (tids && !tids.has(decodeURIComponent(frag))) problems.push({ kind: 'dead-fragment', attr: r.attr, value: v });
    }
  }
  return { problems, local };
}

// a missing page whose site path is in `pending` (site.json pending.paths: linked before the page exists) is reported
// apart, not as broken, when the run allows it (--allow-pending)
const sitePathOf = (resolved) => '/' + String(resolved || '').replace(/(^|\/)index\.html$/, '$1');
export function checkDist(dist, { pending = null } = {}) {
  const files = listFiles(dist);
  const set = new Set(files);
  const idCache = new Map();
  const env = {
    hosts: {}, schemes: {}, fragments: 0,
    exists: (p) => set.has(p.replace(/^\.\//, '')),
    idsOfFile: (p) => { if (!idCache.has(p)) idCache.set(p, set.has(p) ? idsOf(fs.readFileSync(path.join(dist, p), 'utf8')) : null); return idCache.get(p); },
  };
  let local = 0, checked = 0;
  const broken = [], pendingRefs = [];
  const isPending = (p) => !!pending && p.kind === 'missing' && pending.has(sitePathOf(p.resolved));
  for (const rel of files) {
    if (!/\.(html?|css)$/i.test(rel)) continue;
    checked++;
    const r = checkFile(rel, fs.readFileSync(path.join(dist, rel), 'utf8'), env);
    local += r.local;
    for (const p of r.problems) (isPending(p) ? pendingRefs : broken).push({ file: rel, ...p });
  }
  /* positive controls, in memory, against the real file set (their counts do not enter the totals) */
  const cenv = { ...env, hosts: {}, schemes: {}, fragments: 0 };
  const anyCss = files.find((f) => /\.css$/.test(f));
  const anyImg = files.find((f) => /\.webp$/.test(f));
  const page = 'ctl/page/index.html';
  const ctlHtml = '<a href="../../nope/">a</a><a href="/abs/">b</a><a href="#missing-id">c</a><img src="../../x.webp" srcset="../../none-1.webp 1w, ../../' + (anyImg || 'none-2.webp') + ' 2w" alt="">'
    + '<a href="../../">ok</a>' + (anyCss ? '<link rel="stylesheet" href="../../' + anyCss + '">' : '')
    + '<a href="{{location_shop_url}}">t</a><a href="{{location_shop_url}}?dtche[path]=products">t2</a><a href="{{oops">u</a>'
    + '<a href="javascript:alert(1)">j</a><a href="data:text/html,x">d</a><img src="data:image/png;base64,AAAA" alt="">';
  const p1 = checkFile(page, ctlHtml, cenv).problems;
  // pending: a planted missing page in the pending set is set apart; a missing page outside it stays broken
  const ctlPending = new Set(['/ctl-pending/']);
  const p4 = checkFile('ctl/q/index.html', '<a href="../../ctl-pending/">p</a><a href="../../ctl-not-pending/">n</a>', cenv).problems;
  const pendingSplit = p4.filter((p) => p.kind === 'missing' && ctlPending.has(sitePathOf(p.resolved))).map((p) => p.value);
  const p2 = checkFile('ctl/x.css', '.a{background:url("../none-3.webp")}.b{background:url(data:image/png;base64,AAAA)}', cenv).problems;
  const p3 = checkFile('404.html', '<a href="index.html">rel</a><a href="/">root ok</a>', cenv).problems;
  const has = (ps, kind, value) => ps.some((p) => p.kind === kind && p.value === value);
  const control = {
    missingFile: has(p1, 'missing', '../../nope/'),
    rootAbsolute: has(p1, 'root-absolute', '/abs/'),
    deadFragment: has(p1, 'dead-fragment', '#missing-id'),
    missingSrcsetCandidate: has(p1, 'missing', '../../none-1.webp'),
    missingCssUrl: has(p2, 'missing', '../none-3.webp'),
    pageRelativeIn404: has(p3, 'page-relative-in-404', 'index.html'),
    validNotReported: !p1.some((p) => p.value === '../../' || (anyCss && p.value === '../../' + anyCss) || (anyImg && p.value === '../../' + anyImg)) && !p3.some((p) => p.value === '/'),
    cmsTokenNotReported: !p1.some((p) => p.value.startsWith('{{location_shop_url}}')),
    malformedTokenReported: has(p1, 'missing', '{{oops'),
    unsafeSchemesReported: has(p1, 'unsafe-scheme', 'javascript:alert(1)') && has(p1, 'unsafe-scheme', 'data:text/html,x') && !p1.some((p) => p.value.startsWith('data:image/')) && !p2.some((p) => p.value.startsWith('data:')),
    pendingSetApart: pendingSplit.length === 1 && pendingSplit[0] === '../../ctl-pending/' && has(p4, 'missing', '../../ctl-not-pending/'),
  };
  control.fired = Object.values(control).every(Boolean);
  const byKind = broken.reduce((a, b) => { a[b.kind] = (a[b.kind] || 0) + 1; return a; }, {});
  const hosts = Object.fromEntries(Object.entries(env.hosts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));
  return { dist, files: files.length, filesChecked: checked, localRefs: local, fragmentsChecked: env.fragments, externalHosts: hosts, schemes: env.schemes, broken, byKind, pendingRefs, control };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i === -1 ? null : process.argv[i + 1]; };
  const dist = path.resolve(arg('--dir') || path.join(ROOT, 'dist'));
  // --allow-pending: the site paths in src/content/site.json pending.paths (linked before their page exists) and the
  // planned pages and articles in src/content/planned.json (tools/make-planned.mjs) are listed apart instead of failing
  // the run. A publish gate runs WITHOUT it.
  const allow = process.argv.includes('--allow-pending');
  const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
  const siteJson = readJson(path.join(ROOT, 'src', 'content', 'site.json')) || {};
  const plannedJson = readJson(path.join(ROOT, 'src', 'content', 'planned.json')) || { pages: [], articles: [] };
  const blogBase = (siteJson.blog && siteJson.blog.path) || '/blog/';
  const pending = allow ? new Set([...((siteJson.pending && siteJson.pending.paths) || []).map((p) => p.path), ...(plannedJson.pages || []), ...(plannedJson.articles || []).map((s) => blogBase + s + '/')]) : null;
  const r = checkDist(dist, { pending });
  console.log('link-check ' + dist);
  console.log('files ' + r.files + ' | html+css checked ' + r.filesChecked + ' | local refs ' + r.localRefs + ' | fragments ' + r.fragmentsChecked + ' | broken ' + r.broken.length + ' ' + JSON.stringify(r.byKind) + (allow ? ' | pending (allowed) ' + r.pendingRefs.length : ''));
  console.log('external hosts: ' + (Object.keys(r.externalHosts).length ? Object.entries(r.externalHosts).map(([h, n]) => h + ' ' + n).join(', ') : 'none'));
  console.log('schemes: ' + JSON.stringify(r.schemes));
  for (const b of r.broken.slice(0, 25)) console.log('  BROKEN ' + b.file + '  ' + b.kind + ' ' + b.attr + '=' + b.value);
  if (allow) {
    const byTarget = new Map();
    for (const p of r.pendingRefs) { const k = sitePathOf(p.resolved); byTarget.set(k, (byTarget.get(k) || 0) + 1); }
    const top = [...byTarget].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    console.log('pending/planned targets not built yet: ' + top.length);
    for (const [k, n] of top.slice(0, 12)) console.log('  pending ' + k + '  (' + n + ' references)');
    if (top.length > 12) console.log('  ... and ' + (top.length - 12) + ' more');
  }
  console.log('control: ' + (r.control.fired ? 'fired (11 checks: 7 planted defects reported incl. a malformed CMS token; javascript: and data: links reported, data: images not; valid references and CMS tokens not reported; a pending page set apart from a missing one)' : 'DID NOT FIRE ' + JSON.stringify(r.control)));
  if (arg('--json')) fs.writeFileSync(path.resolve(arg('--json')), JSON.stringify(r, null, 1));
  process.exitCode = r.broken.length || !r.control.fired ? 1 : 0;
}
