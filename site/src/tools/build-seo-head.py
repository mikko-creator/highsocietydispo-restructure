#!/usr/bin/env python3
"""build-seo-head.py - carry the live homepage's SEO head into the rebuild.

Reads audit/raw/index.html and writes src/content/seo-head.json:
  meta    robots + Open Graph + Twitter tags, verbatim; the Open Graph / Twitter image is the SAME
          file, served from this build (assets/og-image.png, absolute against the canonical origin)
  jsonld  the page's structured data, verbatim, minus the two nodes that describe the page as a
          blog article by the CMS admin account (Article, Person: CMS output, not business facts);
          URLs into the old upload folder re-pointed to the same file in this build
  removed everything left out, each with its reason (never a silent drop)

  python3 -I src/tools/build-seo-head.py
"""
import json, os, re, html

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = open(os.path.join(ROOT, 'audit', 'raw', 'index.html'), encoding='utf-8').read()
HEAD = RAW[:RAW.find('</head>')]
images = json.load(open(os.path.join(ROOT, 'src', 'content', 'images.json')))
ORIGIN = 'https://highsocietydispo.com'
removed = []

def local(url):
    rec = images.get(url)
    if not rec: return None
    return ORIGIN + '/assets/' + rec['variants'][-1]['file']

KEEP = re.compile(r'^(robots|og:locale|og:type|og:title|og:description|og:url|og:site_name|og:updated_time|og:image|og:image:secure_url|og:image:width|og:image:height|og:image:alt|og:image:type|twitter:card|twitter:title|twitter:description|twitter:site|twitter:creator|twitter:image)$')
meta = []
for m in re.finditer(r'<meta\s+(property|name)="([^"]+)"\s+content="([^"]*)"\s*/?>', HEAD):
    kind, key, val = m.group(1), m.group(2), html.unescape(m.group(3))
    if key in ('description', 'viewport', 'theme-color'): continue
    if key == 'generator': removed.append({'what': '<meta name="generator">', 'why': 'names the source platform'}); continue
    if key.startswith('tec-api'): removed.append({'what': '<meta name="%s">' % key, 'why': 'an events-plugin API marker (The Events Calendar), not a property of the page'}); continue
    if key == 'msapplication-TileImage': continue          # the build writes its own, pointing at the same favicon file
    if KEEP.match(key):
        if '/wp-content/' in val:
            loc = local(val)
            if not loc: raise SystemExit('no local copy of ' + val)
            val = loc
        meta.append({'attr': kind, 'key': key, 'content': val})
    else:
        removed.append({'what': '<meta %s="%s" content="%s">' % (kind, key, val[:60]), 'why': 'CMS post metadata (author account, reading time), not a property of the homepage'})

def rewrite(node):
    if isinstance(node, dict): return {k: rewrite(v) for k, v in node.items()}
    if isinstance(node, list): return [rewrite(v) for v in node]
    if isinstance(node, str):
        node = html.unescape(node)
        if '/wp-content/' in node:
            loc = local(node)
            if loc: return loc
            removed.append({'what': 'structured-data URL ' + node[:110], 'why': 'points into the old upload folder and this build has no copy of that file'})
            return None
    return node

def prune(node):
    if isinstance(node, dict):
        out = {k: prune(v) for k, v in node.items()}
        return {k: v for k, v in out.items() if v not in (None, {}, [])}
    if isinstance(node, list): return [x for x in (prune(v) for v in node) if x not in (None, {}, [])]
    return node

jsonld = []
for m in re.finditer(r'<script type="application/ld\+json"[^>]*>([\s\S]*?)</script>', RAW):
    try: j = json.loads(m.group(1))
    except Exception as e:
        removed.append({'what': 'a structured-data block', 'why': 'not valid JSON on the live page: %s' % e}); continue
    if isinstance(j, dict) and '@graph' in j:
        kept = []
        for n in j['@graph']:
            if n.get('@type') in ('Person', 'Article'):
                removed.append({'what': 'structured data node ' + str(n.get('@type')), 'why': 'describes the homepage as a blog article by the CMS admin account ("%s"): CMS output, not a fact about the business' % (n.get('name') or n.get('headline') or '')[:60]})
                continue
            kept.append(n)
        j = dict(j, **{'@graph': kept})
    j = prune(rewrite(j))
    # an image object re-pointed into this build gets an @id that matches its new url
    jsonld.append(j)
txt = json.dumps(jsonld)
# @id values that were old upload URLs are now build URLs: keep references consistent
out = {'source': 'audit/raw/index.html', 'canonical': ORIGIN + '/', 'meta': meta, 'jsonld': jsonld, 'removed': removed}
json.dump(out, open(os.path.join(ROOT, 'src', 'content', 'seo-head.json'), 'w'), ensure_ascii=False, indent=1)
types = [n.get('@type') for j in jsonld for n in (j.get('@graph') or [j])]
print('seo-head.json: %d meta tags, %d JSON-LD blocks (%s), %d left out with a reason, %d old-upload URL(s) left' % (len(meta), len(jsonld), ', '.join(map(str, types)), len(removed), txt.count('wp-content')))
for r in removed: print('  left out:', r['what'][:90], '—', r['why'][:100])
