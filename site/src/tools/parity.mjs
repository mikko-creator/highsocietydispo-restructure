#!/usr/bin/env node
// parity.mjs — the static content gate: is every word, link and image of the reskin homepage on the rebuilt page,
// and did the rebuild add anything it should not have?
//
//   node src/tools/parity.mjs [--dir dist] [--json audit/parity-home.json]
//
// Source of truth: audit/raw/client-highsocietydispo-reskin-index.html.html (the page as GitHub Pages served it),
// read through src/content/home-outline.json (outline.py). What the rebuild deliberately does not carry, or carries
// differently, is declared with its reason in audit/declared-removals.json: every declaration that applies is
// listed in the report; anything not declared must be on the build. Exit 0 only on PASS.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve(ROOT, opt('dir', 'dist'));
const OUT = path.resolve(ROOT, opt('json', 'audit/parity-home.json'));
const readJ = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const content = readJ('src/content/home.json');
const images = readJ('src/content/images.json');
const outline = readJ('src/content/home-outline.json').items;
const DECL = readJ('audit/declared-removals.json').items;

const ent = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const norm = (s) => String(s).replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const squash = (s) => norm(s).replace(/\s+/g, '');
const canon = (u) => ent(String(u || '')).trim();

// ---------------------------------------------------------------- declarations
const containers = new Set(DECL.filter((d) => d.kind === 'container').map((d) => d.match.id));
const slots = new Set(DECL.filter((d) => d.kind === 'cms-slot').map((d) => d.match.id));
const applied = new Map();      // declaration index -> count of source items it covered
const apply = (d) => { const i = DECL.indexOf(d); applied.set(i, (applied.get(i) || 0) + 1); };
const inIds = (item, set) => (item.ids || []).find((id) => set.has(id));
const declFor = (kind, pred) => DECL.find((d) => d.kind === kind && pred(d.match));
const containerDecl = (id) => DECL.find((d) => d.kind === 'container' && d.match.id === id);
const slotDecl = (id) => DECL.find((d) => d.kind === 'cms-slot' && d.match.id === id);
const PLACEHOLDER = DECL.find((d) => d.kind === 'placeholder');

// ---------------------------------------------------------------- source side
const srcRuns = []; const optRuns = []; const srcLinks = []; const srcImgs = []; const srcAria = []; const vocabRuns = [];
let cur = null;
for (const it of outline) {
  const cont = inIds(it, containers); const slot = inIds(it, slots);
  if (it.k === 'a_open') { cur = { href: it.href, hrefRaw: it.href, aria: it.aria || '', cls: it.cls || [], ids: it.ids || [], first: '', text: '', imgs: [], cont, slot }; continue; }
  if (it.k === 'a_close') { if (cur) srcLinks.push(cur); cur = null; continue; }
  if (it.k === 'text') {
    const t = norm(it.t); if (!t) continue;
    vocabRuns.push(t);
    if (cur) { if (!cur.first) cur.first = t; cur.text += ' ' + t; }
    if (cont) { apply(containerDecl(cont)); continue; }
    if (it.placeholder || (PLACEHOLDER && t === PLACEHOLDER.match.text)) { apply(PLACEHOLDER); continue; }
    if (slot) { apply(slotDecl(slot)); optRuns.push(t); continue; }
    srcRuns.push({ t, hidden: !!it.hidden, ids: it.ids });
    continue;
  }
  if (it.k === 'img') {
    const rec = { src: it.src, alt: it.alt || '', ids: it.ids || [], inLinkCls: cur ? cur.cls : [], cont, slot };
    if (cur) cur.imgs.push(rec);
    srcImgs.push(rec);
    continue;
  }
  if (it.k === 'aria') srcAria.push({ v: it.v, tag: it.tag, ids: it.ids || [], cont: inIds(it, containers), slot: inIds(it, slots) });
}

// ---------------------------------------------------------------- build side
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const fileToKey = {};
for (const [key, rec] of Object.entries(images)) for (const v of rec.variants || []) fileToKey[v.file] = key;
const fileOf = (u) => { const s = String(u || '').trim().split(/[?#]/)[0]; return s.replace(/^\.?\/?assets\//, ''); };
const keyOf = (u) => fileToKey[fileOf(u)] || (images[String(u || '').trim()] ? String(u).trim() : null);
const srcsetFiles = (s) => String(s || '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean);

function parseBuild(src) {
  const bi = src.search(/<body[\s>]/i);
  const body = bi >= 0 ? src.slice(bi) : src;
  const re = /<!--[\s\S]*?-->|<(script|style|template)\b[\s\S]*?<\/\1>|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  const text = []; const links = []; const buttons = []; const attrsText = []; const imgs = []; const h1 = []; const ids = [];
  let m; let a = null; let btn = null; let inH1 = null; let pic = null;
  const attr = (raw, k) => { const x = new RegExp('(?:^|\\s)' + k + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(raw || ''); return x ? ent(x[1] ?? x[2]) : null; };
  while ((m = re.exec(body))) {
    if (m[2]) {
      const tag = m[2].toLowerCase(); const closing = m[0][1] === '/'; const raw = m[3];
      if (!closing) {
        const id = attr(raw, 'id'); if (id) ids.push(id);
        for (const k of ['placeholder', 'alt', 'aria-label', 'title']) { const v = attr(raw, k); if (v) attrsText.push({ k, v }); }
        if (tag === 'a') a = { href: attr(raw, 'href'), text: '', imgAlts: [], imgFiles: [], aria: attr(raw, 'aria-label') || '', role: attr(raw, 'role') || '' };
        if (tag === 'button') btn = { text: '', aria: attr(raw, 'aria-label') || '' };
        if (tag === 'picture') pic = { sources: [] };
        if (tag === 'source' && pic) for (const f of srcsetFiles(attr(raw, 'srcset'))) pic.sources.push(f);
        if (tag === 'img') {
          const files = [attr(raw, 'src'), ...srcsetFiles(attr(raw, 'srcset'))].filter(Boolean);
          const rec = { src: attr(raw, 'src') || '', alt: attr(raw, 'alt'), width: attr(raw, 'width'), height: attr(raw, 'height'), loading: attr(raw, 'loading'), files, pictureSources: pic ? [...pic.sources] : [] };
          imgs.push(rec); if (a) { a.imgAlts.push(rec.alt || ''); a.imgFiles.push(...rec.files, ...rec.pictureSources); }
        }
        if (tag === 'h1') inH1 = '';
      } else {
        // a link that acts as a button (role="button", e.g. the menu opener that keeps a no-script #mmenu target) counts as both
        if (tag === 'a' && a) { links.push(a); if (a.role === 'button') buttons.push({ text: a.text, aria: a.aria }); a = null; }
        if (tag === 'button' && btn) { buttons.push(btn); btn = null; }
        if (tag === 'picture') pic = null;
        if (tag === 'h1' && inH1 !== null) { h1.push(norm(inH1)); inH1 = null; }
      }
      if (/^(p|div|li|ul|ol|h[1-6]|section|header|footer|nav|br|button|summary|details|article|figure|figcaption|form|label|td|tr|dl|dt|dd|dialog|main|blockquote|span|a|strong|b|em|i|small)$/.test(tag)) text.push(' ');
    } else if (m[4] !== undefined) {
      const t = ent(m[4]); text.push(t); if (a) a.text += t; if (btn) btn.text += t; if (inH1 !== null) inH1 += t;
    }
  }
  return { text: norm(text.join('')), links, buttons, attrsText, imgs, h1, ids };
}
const B = parseBuild(html);
const buildSquash = squash(B.text);
const title = ent((/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '');
const desc = ent((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '');
const buildIds = new Set(B.ids);

const fails = []; const notes = [];

// 1. every source text run (outside the declared duplicates and placeholders) is on the page
const missing = srcRuns.filter((r) => !buildSquash.includes(squash(r.t)));
if (missing.length) fails.push(`${missing.length} piece(s) of source text are missing from the build: ` + [...new Set(missing.map((r) => JSON.stringify(r.t.slice(0, 80))))].slice(0, 14).join(' · '));
const optPresent = optRuns.filter((t) => buildSquash.includes(squash(t)));
if (optRuns.length) notes.push(`CMS popup slot text (optional): ${optPresent.length}/${optRuns.length} present (${optRuns.join(' | ')})`);

// 2. links: every (lead text, destination) pair survives
const buildLinks = B.links.map((l) => ({ href: canon(l.href), text: squash(l.text), alts: l.imgAlts, files: new Set(l.imgFiles.map(keyOf).filter(Boolean)), aria: l.aria }));
// a phone art-directed picture (declared img-art) merges into its desktop picture: its alt goes, its file stays
const isArt = (im) => DECL.some((x) => x.kind === 'img-art' && im.ids.includes(x.match.id));
const lost = []; const asButtons = []; const linkWant = {};
for (const l of srcLinks) {
  if (l.cont) { apply(containerDecl(l.cont)); continue; }
  if (l.slot) { apply(slotDecl(l.slot)); continue; }
  const href = canon(l.hrefRaw);
  const text = squash(l.first);
  const artImgs = l.imgs.filter(isArt);
  const keptImgs = l.imgs.filter((im) => !declImg(im) && !isArt(im));
  const empty = (d) => (d.href !== undefined ? d.href === href : true) && (d.hrefPrefix ? href.startsWith(d.hrefPrefix) : true) && (d.cls ? l.cls.includes(d.cls) : true);
  let d;
  if ((d = declFor('link-empty', (mt) => empty(mt))) && !text) { apply(d); continue; }
  if ((d = declFor('link-dropped', (mt) => (mt.aria === undefined || mt.aria === l.aria) && mt.href === href))) { apply(d); continue; }
  if ((d = declFor('relink', (mt) => mt.href === href && squash(mt.text) === text))) {
    apply(d);
    if (!buildLinks.some((b) => b.href === canon(d.to) && b.text.includes(text))) lost.push(`${JSON.stringify(norm(l.text))} -> ${d.to} (declared re-point of "${href}")`);
    continue;
  }
  if ((d = declFor('link-button', (mt) => mt.href === href))) {
    apply(d);
    const name = l.aria || norm(l.text);
    const ok = B.buttons.some((b) => (name && (b.aria === name || squash(b.text) === squash(name)))) || buildLinks.some((b) => b.href === href);
    if (!ok) lost.push(`control ${JSON.stringify(name)} (was ${href}) is neither a link nor a button named so`);
    continue;
  }
  let hit;
  if (text) hit = buildLinks.some((b) => b.href === href && b.text.includes(text));
  else if (keptImgs.some((im) => im.alt)) hit = buildLinks.some((b) => b.href === href && keptImgs.filter((im) => im.alt).every((im) => b.alts.includes(im.alt)));
  // a link around art-directed pictures only: a link to the same place must carry the same files
  else if (artImgs.length) hit = buildLinks.some((b) => b.href === href && artImgs.every((im) => b.files.has(im.src)));
  else hit = buildLinks.some((b) => b.href === href);
  // a JS hook (an in-page "#..." link) may be carried as a <button> with the same words
  if (!hit && href.startsWith('#') && text) { const b = B.buttons.find((x) => squash(x.text).includes(text) || squash(x.aria) === text); if (b) { hit = true; asButtons.push(`${norm(l.text)} (${href})`); } }
  if (!hit) lost.push(`${JSON.stringify(norm(l.text) || (keptImgs.length ? '[image] ' + keptImgs.map((im) => im.alt).join('/') : '[empty link]'))} -> ${href || '(empty href)'}`);
  else if (text) { const k = href + '\u0000' + text; linkWant[k] = (linkWant[k] || 0) + 1; }
}
// a (destination, words) pair the source carries N times outside the declared duplicates must be on the build N times
// (one store card's phone changed while the chooser keeps the right one is still a wrong phone)
for (const [k, n] of Object.entries(linkWant)) {
  const [href, text] = k.split('\u0000');
  const have = buildLinks.filter((b) => b.href === href && b.text.includes(text)).length + (href.startsWith('#') ? B.buttons.filter((x) => squash(x.text).includes(text)).length : 0);
  if (have < n) lost.push(`${JSON.stringify(text)} -> ${href} appears ${n}× in the source, ${have}× on the build`);
}
const lostU = [...new Set(lost)];
if (lostU.length) fails.push(`${lostU.length} source link(s) lost or re-pointed: ` + lostU.slice(0, 14).join(' · '));
if (asButtons.length) notes.push(`in-page hooks carried as <button>: ${[...new Set(asButtons)].join(' · ')}`);

// 3. images: every (picture, alt) pair the source shows is on the build, as often as the source repeats it
function declImg(im) {
  let d;
  if ((d = DECL.find((x) => x.kind === 'img' && x.match.id && im.ids.includes(x.match.id)))) return d;
  if ((d = DECL.find((x) => x.kind === 'img' && x.match.inLinkCls && im.inLinkCls.includes(x.match.inLinkCls)))) return d;
  return null;
}
const buildPairs = {}; const buildKeys = new Set();
for (const im of B.imgs) {
  const keys = new Set([...im.files, ...im.pictureSources].map(keyOf).filter(Boolean));
  for (const k of keys) { buildKeys.add(k); const p = k + '\u0000' + (im.alt || ''); buildPairs[p] = (buildPairs[p] || 0) + 1; }
}
const want = {}; const imgMissing = []; const decorative = [];
for (const im of srcImgs) {
  if (im.cont) { apply(containerDecl(im.cont)); continue; }
  if (im.slot) { apply(slotDecl(im.slot)); continue; }
  let d = declImg(im);
  if (d) { apply(d); continue; }
  let key = im.src;
  if ((d = DECL.find((x) => x.kind === 'img-replace' && x.match.srcPrefix && im.src.startsWith(x.match.srcPrefix)))) { apply(d); key = d.to; }
  if ((d = DECL.find((x) => x.kind === 'img-art' && im.ids.includes(x.match.id)))) {
    apply(d);
    if (!buildKeys.has(key)) imgMissing.push(`art-directed file ${key} is not on the page (as <img> or <source srcset>)`);
    continue;
  }
  if (!images[key]) { imgMissing.push(`source image ${key} was never downloaded/optimised (not in images.json)`); continue; }
  if (!im.alt) { decorative.push(key); if (!buildKeys.has(key)) imgMissing.push(`decorative picture ${key} is not on the page`); continue; }
  const p = key + '\u0000' + im.alt; want[p] = (want[p] || 0) + 1;
}
for (const [p, n] of Object.entries(want)) {
  const have = buildPairs[p] || 0; const [k, alt] = p.split('\u0000');
  if (have < n) imgMissing.push(`${k} with alt="${alt}" appears ${n}× in the source, ${have}× on the build`);
}
if (imgMissing.length) fails.push(`${imgMissing.length} image problem(s): ` + imgMissing.slice(0, 12).join(' · '));

// 4. accessible names (aria-label) the source gives: carried as a name or as visible text, unless declared
const ariaLost = [];
for (const x of srcAria) {
  if (x.cont) { apply(containerDecl(x.cont)); continue; }
  if (x.slot) { apply(slotDecl(x.slot)); continue; }
  const d = DECL.find((y) => y.kind === 'aria-dropped' && (y.match.aria === x.v || (y.match.ariaPrefix && x.v.startsWith(y.match.ariaPrefix))));
  if (d) { apply(d); continue; }
  const ok = B.attrsText.some((y) => y.v === x.v) || buildSquash.includes(squash(x.v));
  if (!ok) ariaLost.push(x.v);
}
if (ariaLost.length) fails.push(`${[...new Set(ariaLost)].length} source accessible name(s) lost: ` + [...new Set(ariaLost)].slice(0, 10).map((v) => JSON.stringify(v)).join(' · '));

// 5. no invented destinations
const known = new Set(srcLinks.map((l) => canon(l.hrefRaw)));
for (const d of DECL.filter((x) => x.kind === 'relink')) known.add(canon(d.to));
if (content.ageGate && content.ageGate.no && content.ageGate.no.redirect) known.add(canon(content.ageGate.no.redirect));
const invented = [...new Set(buildLinks.map((l) => l.href).filter((h) => !known.has(h) && !(h.startsWith('#') && buildIds.has(h.slice(1)))))];
if (invented.length) fails.push(`${invented.length} link destination(s) are not on the source page: ` + invented.slice(0, 10).map((h) => JSON.stringify(h)).join(' · '));

// 6. added words: only the declared UI labels and carousel counters
const words = (s) => (norm(s).match(/[\p{L}\p{N}$%&'’+¢][\p{L}\p{N}$%&'’+.:,/–—¢()-]*/gu) || []).map((w) => w.replace(/[.,:;!?()]+$/, '').replace(/^\(/, '').toLowerCase()).filter(Boolean);
const vocab = new Set(); for (const t of vocabRuns) for (const w of words(t)) vocab.add(w);
const allow = new Set(); for (const s of Object.values(content.ui || {})) for (const w of words(s)) allow.add(w);
const extra = {};
for (const w of words(B.text)) {
  if (vocab.has(w) || allow.has(w)) continue;
  if (/^\d{1,2}(–\d{1,2})?\/\d{1,2}$/.test(w)) continue;      // carousel counters: 1/8, 1–4/8
  extra[w] = (extra[w] || 0) + 1;
}
const extraWords = Object.keys(extra);
if (extraWords.length) fails.push(`${extraWords.length} word(s) on the build are neither source copy nor a declared UI label: ` + extraWords.slice(0, 40).join(', '));
const usedLabels = Object.values(content.ui || {}).filter((s) => B.text.toLowerCase().includes(norm(s).toLowerCase()));

// 6b. editor placeholders are never rendered (brief: keep the slots, not the placeholder text)
if (PLACEHOLDER && buildSquash.includes(squash(PLACEHOLDER.match.text))) fails.push(`the editor placeholder ${JSON.stringify(PLACEHOLDER.match.text)} is in the build's text`);

// 7. head + structure
if (norm(title) !== norm(content.meta.title)) fails.push(`<title> differs: ${JSON.stringify(title)}`);
if (norm(desc) !== norm(content.meta.description)) fails.push(`meta description differs: ${JSON.stringify(desc)}`);
if (B.h1.length !== 1) fails.push(`the page has ${B.h1.length} <h1> (needs exactly one)`);
else if (B.h1[0] !== norm(content.hero.title)) fails.push(`<h1> reads ${JSON.stringify(B.h1[0])}, expected ${JSON.stringify(content.hero.title)}`);

// 8. image hygiene: dimensions, local, WebP or SVG
const noDim = B.imgs.filter((i) => !i.width || !i.height); if (noDim.length) fails.push(`${noDim.length} <img> without width/height: ` + noDim.slice(0, 4).map((i) => i.src).join(', '));
const remote = B.imgs.filter((i) => /^(https?:|data:|\/\/)/i.test(i.src)); if (remote.length) fails.push(`${remote.length} <img> not served locally: ` + remote.slice(0, 3).map((i) => i.src.slice(0, 60)).join(', '));
const badFmt = B.imgs.filter((i) => !/\.(webp|svg)$/i.test(fileOf(i.src))); if (badFmt.length) fails.push(`${badFmt.length} <img> neither WebP nor SVG: ` + [...new Set(badFmt.map((i) => i.src))].slice(0, 4).join(', '));
const eager = B.imgs.filter((i) => i.loading !== 'lazy').length;
notes.push(`${B.imgs.length} <img> on the page: ${B.imgs.length - eager} lazy-loaded, ${eager} eager`);
if (decorative.length) notes.push(`decorative source pictures (alt="") checked by file only: ${[...new Set(decorative)].length}`);

const appliedList = [...applied.entries()].sort((x, y) => x[0] - y[0]).map(([i, n]) => ({ kind: DECL[i].kind, match: DECL[i].match, to: DECL[i].to, coveredSourceItems: n, why: DECL[i].why }));
const unused = DECL.filter((d, i) => !applied.has(i)).map((d) => ({ kind: d.kind, match: d.match }));
if (unused.length) notes.push(`${unused.length} declaration(s) matched nothing in the source: ` + unused.map((d) => d.kind + ' ' + JSON.stringify(d.match)).join(' · '));

const report = {
  at: new Date().toISOString(), dir: path.relative(ROOT, DIR), verdict: fails.length ? 'FAIL' : 'PASS', fails, notes,
  counts: {
    sourceTextRuns: srcRuns.length, missing: missing.length, sourceLinks: srcLinks.length, buildLinks: B.links.length, buildButtons: B.buttons.length,
    lostLinks: lostU.length, sourceImages: srcImgs.length, buildImages: B.imgs.length, imageProblems: imgMissing.length, sourceAriaLabels: srcAria.length,
    ariaLost: [...new Set(ariaLost)].length, inventedDestinations: invented.length, extraWords: extraWords.length,
  },
  declaredApplied: appliedList, declaredUnused: unused, declaredLabelsUsed: usedLabels,
  missing: missing.map((r) => r.t), lost: lostU, imageProblems: imgMissing, ariaLost: [...new Set(ariaLost)], invented, extraWords: extra,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
const c = report.counts;
console.log(`parity ${report.verdict} — ${c.sourceTextRuns} source text runs (${c.missing} missing) · ${c.sourceLinks} source links (${c.lostLinks} lost, ${c.inventedDestinations} invented) · ${c.sourceImages} source images (${c.imageProblems} problems) · ${c.sourceAriaLabels} aria-labels (${c.ariaLost} lost) · ${c.extraWords} undeclared word(s)`);
for (const f of fails) console.log('  FAIL ' + f);
for (const n of notes) console.log('  note ' + n);
for (const d of appliedList) console.log(`  declared ${d.kind.padEnd(12)} ${JSON.stringify(d.match).slice(0, 70).padEnd(70)} ×${d.coveredSourceItems}`);
console.log('  labels added by the build: ' + (usedLabels.join(' | ') || '(none)'));
process.exit(fails.length ? 1 : 0);
