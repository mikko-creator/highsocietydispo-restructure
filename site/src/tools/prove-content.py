#!/usr/bin/env python3
"""prove-content.py - prove every word of src/content/home.json against the reskin homepage as GitHub Pages served it
(audit/raw/client-highsocietydispo-reskin-index.html.html).

  * each text leaf must occur in the raw page: in its body text runs (src/content/home-outline.json), in an attribute
    (alt / aria-label / title / placeholder / data-redirect), or in the head (<title>, meta description) - compared with
    all whitespace squashed out, HTML entities decoded;
  * each href must be an href the raw page carries (whitespace trimmed: the raw sticky ORDER NOW href ends in a tab);
  * each src must be a src / data-src / url() the raw page carries;
  * the "ui" labels are the only strings the build adds: they are DECLARED, not proved.

  python3 -I src/tools/prove-content.py      exit 0 only when every string is proved or declared
"""
import json, os, re, sys, html
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
C = json.load(open(os.path.join(ROOT, 'src', 'content', 'home.json'), encoding='utf-8'))
O = json.load(open(os.path.join(ROOT, 'src', 'content', 'home-outline.json'), encoding='utf-8'))['items']
RAW = open(os.path.join(ROOT, 'audit', 'raw', C['meta']['raw']), encoding='utf-8').read()

norm = lambda s: re.sub(r'\s+', ' ', html.unescape(s).replace(' ', ' ')).strip()
squash = lambda s: re.sub(r'\s+', '', norm(s))


class Attrs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.vals, self.hrefs, self.srcs, self.metas = [], set(), set(), []

    def handle_starttag(self, tag, attrs):
        if tag == 'meta': self.metas.append(dict(attrs))
        for k, v in attrs:
            if v is None: continue
            if k in ('alt', 'aria-label', 'title', 'placeholder', 'data-redirect', 'content') and v.strip(): self.vals.append(v)
            if k == 'href': self.hrefs.add(v.strip())
            if k in ('src', 'data-src'): self.srcs.add(v.strip())
            if k == 'data-redirect': self.hrefs.add(v.strip())
    handle_startendtag = handle_starttag


A = Attrs(); A.feed(RAW)
corpus_text = squash(' '.join(i['t'] for i in O if i['k'] == 'text'))
corpus_attr = [squash(v) for v in A.vals]
head = squash(re.search(r'<title>([\s\S]*?)</title>', RAW).group(1)) + '\u0000' + squash(re.search(r'<meta name="description" content="([^"]*)"', RAW).group(1))
css_urls = {u.strip('"\' ') for u in re.findall(r'url\(([^)]+)\)', RAW)}

DECLARED_VALUES = {str(v): 'UI label (content.ui.%s)' % k for k, v in C.get('ui', {}).items()}
DECLARED_VALUES[C['meta']['themeColor']] = 'brand card: Red #BF3226 (theme-color meta)'
SKIP_KEYS = {'id', 'cls', 'raw', 'origin', 'lang', 'declaredDuplicates', 'ui', 'slot', 'stars', 'themeColor'}
HREF_KEYS = lambda k: k == 'href' or k.endswith('Href') or k == 'redirect' or k == 'icon'   # icon: the <link rel=icon> href
SRC_KEYS = lambda k: k in ('src', 'bg')

proved, declared, missing, bad_links, bad_srcs = [], [], [], [], []


def check_text(path, s):
    q = squash(s)
    if not q: return
    if q in corpus_text or any(q == a or q in a for a in corpus_attr) or q in head: proved.append(path)
    elif s in DECLARED_VALUES: declared.append((path, s, DECLARED_VALUES[s]))
    else: missing.append((path, norm(s)))


def check_meta(path, m):
    # a head entry is one whole tag: proved when the raw page carries a <meta> with that attribute, key and content
    if any(t.get(m['attr']) == m['key'] and norm(t.get('content') or '') == norm(m['content']) for t in A.metas): proved.append(path)
    else: missing.append((path, '<meta %s="%s" content="%s">' % (m['attr'], m['key'], norm(m['content']))))


def walk(node, path, key=None):
    if path == 'home.meta.head' and isinstance(node, list):
        for n, m in enumerate(node): check_meta('%s[%d]' % (path, n), m)
        return
    if isinstance(node, dict):
        for k, v in node.items():
            if k in SKIP_KEYS:
                if k == 'themeColor' and isinstance(v, str): declared.append((path + '.' + k, v, DECLARED_VALUES.get(v, 'brand value')))
                continue
            walk(v, path + '.' + k, k)
    elif isinstance(node, list):
        for n, v in enumerate(node): walk(v, '%s[%d]' % (path, n), key)
    elif isinstance(node, str):
        if key and HREF_KEYS(key):
            if html.unescape(node).strip() not in {html.unescape(h).strip() for h in A.hrefs}: bad_links.append((path, node))
            else: proved.append(path)
            return
        if key and SRC_KEYS(key):
            if node not in A.srcs and node not in css_urls: bad_srcs.append((path, node))
            else: proved.append(path)
            return
        check_text(path, node)


walk(C, 'home')
# the declared UI labels are reported, so the build's additions are on the record
for k, v in C.get('ui', {}).items(): declared.append(('home.ui.' + k, v, 'UI label (brief: "small UI labels needed for navigation")'))

print('content proof: %d string(s) proved against the raw reskin page, %d declared, %d UNPROVED, %d href(s) and %d src(s) not on the raw page' % (
    len(proved), len(declared), len(missing), len(bad_links), len(bad_srcs)))
for p, s, why in declared: print('  declared  %-34s %-40s <- %s' % (p[:34], s[:40], why))
for p, s in missing: print('  UNPROVED  %s: %r' % (p, s))
for p, u in bad_links: print('  BAD HREF  %s: %s' % (p, u))
for p, u in bad_srcs: print('  BAD SRC   %s: %s' % (p, u))
json.dump({'proved': proved, 'declared': [{'path': p, 'text': s, 'source': w} for p, s, w in declared], 'unproved': missing, 'badHrefs': bad_links, 'badSrcs': bad_srcs},
          open(os.path.join(ROOT, 'audit', 'content-proof.json'), 'w'), ensure_ascii=False, indent=1)
sys.exit(1 if (missing or bad_links or bad_srcs) else 0)
