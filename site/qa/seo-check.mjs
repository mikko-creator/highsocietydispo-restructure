// seo-check.mjs — the SEO gate of contract §7.6 on a built site: every page has exactly one <title>, meta description,
// <h1>, robots meta and canonical (404.html: no canonical), titles / descriptions / h1s are unique across pages, the
// canonical is https://highsocietydispo.com + the page's own path, every JSON-LD block parses (with @context and typed
// nodes), and sitemap.xml lists every indexable page's canonical exactly once and nothing else (a page whose robots
// meta says noindex, such as a legal holding page, must NOT be listed).
// Positive control (always runs, in memory, on copies of the real pages): a duplicated title, a duplicated description,
// a second h1, a missing canonical, a wrong canonical, broken JSON-LD, a page left out of the sitemap, a noindex page left
// in it and a skipped heading level (h1 -> h4) must each be reported; otherwise exit 3. Heading levels inside <main> never
// skip (contract 2.8).
//   node qa/seo-check.mjs [--dir dist] [--origin https://highsocietydispo.com]     exit 1 on a finding, 3 on a dead control
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const DIST = path.resolve(arg('dir', 'dist'));
const ORIGIN = arg('origin', 'https://highsocietydispo.com');
const list = (d, base = d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { const p = path.join(d, e.name); if (e.isDirectory()) list(p, base, acc); else acc.push(path.relative(base, p).split(path.sep).join('/')); } return acc; };
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const pathOf = (rel) => (rel === '404.html' ? '/404.html' : '/' + rel.replace(/(^|\/)index\.html$/, '$1'));

const isNoindex = (html) => /<meta name="robots" content="[^"]*\bnoindex\b/.test(html.slice(0, html.indexOf('</head>') + 1 || html.length));

export function audit(pages, sitemapXml) {
  const problems = [];
  const seen = { title: new Map(), desc: new Map(), h1: new Map() };
  const add = (kind, rel, detail) => problems.push({ kind, rel, detail });
  for (const { rel, html } of pages) {
    const is404 = rel === '404.html';
    const head = html.slice(0, html.indexOf('</head>') + 1 || html.length);
    const titles = [...head.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => text(m[1]));
    const descs = [...head.matchAll(/<meta name="description" content="([^"]*)">/g)].map((m) => decode(m[1]).trim());
    const robots = (head.match(/<meta name="robots"/g) || []).length;
    const canon = [...head.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map((m) => decode(m[1]));
    const h1s = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/g)].map((m) => text(m[0]));
    if (titles.length !== 1 || !titles[0]) add('title-count', rel, titles.length); else seen.title.set(titles[0], [...(seen.title.get(titles[0]) || []), rel]);
    if (descs.length !== 1 || !descs[0]) add('description-count', rel, descs.length); else seen.desc.set(descs[0], [...(seen.desc.get(descs[0]) || []), rel]);
    if (h1s.length !== 1 || !h1s[0]) add('h1-count', rel, h1s.length); else seen.h1.set(h1s[0], [...(seen.h1.get(h1s[0]) || []), rel]);
    if (robots !== 1) add('robots-count', rel, robots);
    if (is404) { if (canon.length) add('canonical-on-404', rel, canon[0]); }
    else if (canon.length !== 1) add('canonical-count', rel, canon.length);
    else if (canon[0] !== ORIGIN + pathOf(rel)) add('canonical-wrong', rel, canon[0] + ' (want ' + ORIGIN + pathOf(rel) + ')');
    // heading levels inside <main> never skip (contract 2.8): each heading is at most one level below the one before;
    // the first is the h1, or an h2 when the h1 sits before <main>
    const mi = html.indexOf('<main'), main = mi < 0 ? '' : html.slice(mi, html.indexOf('</main>', mi) + 7);
    let prev = mi > 0 && /<h1[\s>]/.test(html.slice(0, mi)) ? 1 : 0;
    for (const m of main.matchAll(/<h([1-6])[\s>]/g)) {
      const l = Number(m[1]);
      if (l > prev + 1) { add('heading-skip', rel, `h${prev || '-'} -> h${l}`); break; }
      prev = l;
    }
    const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (!lds.length) add('jsonld-missing', rel, '');
    for (const raw of lds) {
      let j;
      try { j = JSON.parse(raw); } catch (e) { add('jsonld-parse', rel, e.message.slice(0, 80)); continue; }
      const nodes = j['@graph'] || [j];
      if (!j['@context']) add('jsonld-context', rel, '');
      for (const n of nodes) if (!n || !n['@type']) add('jsonld-untyped', rel, JSON.stringify(n).slice(0, 60));
    }
  }
  for (const [k, kind] of [['title', 'title-duplicate'], ['desc', 'description-duplicate'], ['h1', 'h1-duplicate']]) {
    for (const [v, rels] of seen[k]) if (rels.length > 1) add(kind, rels.join(', '), v.slice(0, 70));
  }
  const locs = [...String(sitemapXml || '').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => decode(m[1]));
  // a noindex page (the legal holding pages) must stay OUT of the sitemap: listing it is a 'sitemap-extra'
  const want = pages.filter((p) => p.rel !== '404.html' && !isNoindex(p.html)).map((p) => ORIGIN + pathOf(p.rel));
  const locSet = new Map(); for (const l of locs) locSet.set(l, (locSet.get(l) || 0) + 1);
  for (const w of want) { const n = locSet.get(w) || 0; if (n !== 1) add(n ? 'sitemap-duplicate' : 'sitemap-missing', w, n); }
  for (const l of locSet.keys()) if (!want.includes(l)) add('sitemap-extra', l, '');
  return problems;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const rels = list(DIST).filter((f) => f.endsWith('.html'));
  const pages = rels.map((rel) => ({ rel, html: fs.readFileSync(path.join(DIST, rel), 'utf8') }));
  const sitemap = fs.existsSync(path.join(DIST, 'sitemap.xml')) ? fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8') : '';
  const problems = audit(pages, sitemap);

  // ---- positive control ----
  const pick = (pred) => pages.find(pred);
  const a = pick((p) => p.rel === 'about/index.html') || pages[1], b = pick((p) => p.rel === 'deals/index.html') || pages[2];
  const c = pick((p) => p.rel === 'faq/index.html') || pages[3], d = pick((p) => p.rel === 'careers/index.html') || pages[4];
  const e = pick((p) => p.rel === 'contact/index.html') || pages[5];
  const tOf = (h) => /<title>([\s\S]*?)<\/title>/.exec(h)[1];
  const dOf = (h) => /<meta name="description" content="([^"]*)">/.exec(h)[1];
  const mutated = pages.map((p) => {
    let html = p.html;
    if (p === a) html = html.replace('</h1>', '</h1><h4>Planted heading skip</h4>');
    if (p === b) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${tOf(a.html)}</title>`).replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${dOf(a.html)}">`);
    if (p === c) html = html.replace(/<link rel="canonical"[^>]*>/, '').replace('</main>', '<h1>Planted second heading</h1></main>');
    if (p === d) html = html.replace(/<script type="application\/ld\+json">/, '<script type="application/ld+json">{oops').replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://example.com/">');
    if (p === e) html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">');
    return { rel: p.rel, html };
  });
  const sitemapMinus = sitemap.replace(new RegExp(`\\s*<url><loc>${(ORIGIN + pathOf(a.rel)).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc>[^\\n]*</url>`), '');
  const cp = audit(mutated, sitemapMinus);
  const fired = {
    titleDuplicate: cp.some((p) => p.kind === 'title-duplicate'),
    descriptionDuplicate: cp.some((p) => p.kind === 'description-duplicate'),
    secondH1: cp.some((p) => p.kind === 'h1-count' && p.rel === c.rel),
    missingCanonical: cp.some((p) => p.kind === 'canonical-count' && p.rel === c.rel),
    wrongCanonical: cp.some((p) => p.kind === 'canonical-wrong' && p.rel === d.rel),
    brokenJsonLd: cp.some((p) => p.kind === 'jsonld-parse' && p.rel === d.rel),
    sitemapMissing: cp.some((p) => p.kind === 'sitemap-missing'),
    headingSkip: cp.some((p) => p.kind === 'heading-skip' && p.rel === a.rel),
    noindexListed: cp.some((p) => p.kind === 'sitemap-extra' && p.rel === ORIGIN + pathOf(e.rel)),
  };
  const controlOk = Object.values(fired).every(Boolean);

  const titles = new Set(pages.map((p) => tOf(p.html)));
  console.log(`seo-check ${DIST}: ${pages.length} pages, ${titles.size} distinct titles, sitemap ${[...sitemap.matchAll(/<loc>/g)].length} URLs, noindex ${pages.filter((p) => p.rel !== '404.html' && isNoindex(p.html)).map((p) => p.rel).join(' ') || 'none'}`);
  const byKind = problems.reduce((m, p) => { m[p.kind] = (m[p.kind] || 0) + 1; return m; }, {});
  console.log(`problems: ${problems.length} ${JSON.stringify(byKind)}`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p.kind}  ${p.rel}  ${p.detail}`);
  // lengths are advice, not failures (contract: title <= 60 for articles; descriptions 120-160 in the brief)
  const long = pages.map((p) => ({ rel: p.rel, t: decode(tOf(p.html)).length, d: decode(dOf(p.html)).length })).filter((x) => x.t > 65 || x.d < 100 || x.d > 170);
  if (long.length) console.log(`advice (not failing): ${long.length} pages with a title over 65 or a description outside 100-170 chars: ` + long.slice(0, 12).map((x) => `${x.rel} (t${x.t} d${x.d})`).join(', '));
  console.log('control: ' + (controlOk ? 'fired (duplicate title, duplicate description, second h1, missing canonical, wrong canonical, broken JSON-LD, a page left out of the sitemap, a noindex page left in it and a skipped heading level all reported)' : 'DID NOT FIRE ' + JSON.stringify(fired)));
  process.exit(!controlOk ? 3 : problems.length ? 1 : 0);
}
