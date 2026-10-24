// route.mjs — site paths for the multi-page build (contract §2.1). Node builtins only, no state.
//
// A SITE PATH is root-absolute and directory-style: "/", "/deals/", "/blog/what-is-thca/". Files keep their name:
// "/404.html", "/search-index.json". Content and templates write site paths; the build turns every one into a URL
// relative to the page that carries it (rel), so dist/ works from any sub-path (a GitHub Pages project preview).
// The one exception is 404.html, served at any depth: its URLs stay root-relative (the preview step re-prefixes them).
//
//   normalize('/blog//x')            -> '/blog/x/'
//   depth('/blog/x/')                -> 2           (directories between the site root and the page)
//   rel('/blog/x/', '/deals/')       -> '../../deals/'
//   rel('/', '/')                    -> './'
//   rel('/about/', '/about/#team')   -> '#team'     (same page: the fragment alone)
//   asset('/blog/x/', 'assets/a.webp') -> '../../assets/a.webp'
//   canonical('/deals/')             -> 'https://highsocietydispo.com/deals/'
//   fromV2('loyalty/index.html')     -> '/loyalty/'  (v2's hrefs; '#x', '{{token}}', 'https://..', 'tel:..' unchanged)

export const ORIGIN = 'https://highsocietydispo.com';

// a CMS token ({{location_shop_url}}) is never a path: the store chooser handles it (v2's site.js)
export const isToken = (u) => /\{\{[^}]*\}\}/.test(String(u));
// anything with a scheme or a protocol-relative start is not a site path
export const isExternal = (u) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(u).trim());

const splitTail = (u) => {
  const s = String(u);
  const h = s.indexOf('#'), q = s.indexOf('?');
  const cut = [h, q].filter((x) => x >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? [s, ''] : [s.slice(0, cut), s.slice(cut)];
};
const isFile = (p) => /\.[a-z0-9]+$/i.test(p.split('/').pop() || '');

/** Leading slash, trailing slash for directories, no "//", no "." segments; "?query#hash" kept as written. */
export function normalize(p) {
  if (p === undefined || p === null) throw new Error('route.normalize: no path');
  const [body, tail] = splitTail(String(p).trim());
  const parts = [];
  for (const seg of body.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { if (!parts.length) throw new Error('route.normalize: path escapes the site root: ' + p); parts.pop(); continue; }
    parts.push(seg);
  }
  if (!parts.length) return '/' + tail;
  const joined = '/' + parts.join('/');
  return (isFile(joined) ? joined : joined + '/') + tail;
}

const dirParts = (p) => {
  const [body] = splitTail(normalize(p));
  const parts = body.split('/').filter(Boolean);
  if (isFile(body)) parts.pop();
  return parts;
};

/** How many directories deep the page is: '/' 0, '/about/' 1, '/blog/p/2/' 3, '/404.html' 0. */
export const depth = (p) => dirParts(p).length;

/** The URL of toPath relative to the page at fromPath. Keeps "?query" and "#hash". */
export function rel(fromPath, toPath) {
  const to = normalize(toPath);
  const [toBody, tail] = splitTail(to);
  const from = normalize(fromPath).replace(/[?#].*$/, '');
  // the same page: a fragment alone stays a fragment
  if (toBody === from && tail.startsWith('#')) return tail;
  const a = dirParts(from);
  const bAll = toBody.split('/').filter(Boolean);
  const file = isFile(toBody) ? bAll.pop() : null;
  let i = 0;
  while (i < a.length && i < bAll.length && a[i] === bAll[i]) i++;
  const up = '../'.repeat(a.length - i);
  const down = bAll.slice(i).map((s) => s + '/').join('') + (file || '');
  const out = (up + down || './') + tail;
  // a bare first segment with a colon would read as a URL scheme ("/javascript:x/" from the home -> "javascript:x/"):
  // "./" keeps it a path
  return /^[^/?#]*:/.test(out) ? './' + out : out;
}

/** An asset file ("assets/x.webp", "styles/site.css") from the page at fromPath. */
export function asset(fromPath, file) {
  const f = String(file).replace(/^\.?\//, '');
  if (isExternal(f)) return f;
  return '../'.repeat(depth(fromPath)) + f;
}

export const canonical = (p) => ORIGIN + normalize(p).replace(/[?#].*$/, '');

/** v2's hrefs (relative to the site root, "x/index.html") -> site paths; everything that is not a v2 path is kept. */
export function fromV2(href) {
  if (href === undefined || href === null) throw new Error('route.fromV2: no href');
  const s = String(href).trim();
  if (s === '' || s.startsWith('#') || isToken(s) || isExternal(s)) return s;
  const [body, tail] = splitTail(s);
  const clean = body.replace(/(^|\/)index\.html$/, '$1');
  return normalize('/' + clean) + tail;
}
