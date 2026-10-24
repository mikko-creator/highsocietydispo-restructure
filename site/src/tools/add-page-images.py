#!/usr/bin/env python3
"""add-page-images.py - web-sized WebP files for the inner pages' own images, added to assets/optimized and
src/content/images.json WITHOUT re-running optimize-images.py (its sources, assets/source/, did not ship with v2, and
re-encoding the home's 83 files would change bytes the home was measured on).

Same rules as optimize-images.py: the picture is used as it is (no edits, no crops); widths capped at what the layout
can show; a WebP at its own full width is copied byte for byte; other widths re-encoded WebP q80 method 6 (LANCZOS).
Sources are High Society's own files from the v1 clone of highsocietydispo.com (v1-source/), the images the v1 pages
show. An existing images.json entry is only (re)written for the keys below; its variant sizes must match.

  python -X utf8 -I src/tools/add-page-images.py            (from site/)
"""
import json, os, re, shutil, sys
from PIL import Image

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
V1 = os.path.join(SITE, '..', 'v1-source')
OUT = os.path.join(SITE, 'assets', 'optimized')
IMAGES = os.path.join(SITE, 'src', 'content', 'images.json')

# key (the path a page JSON uses) -> source under v1-source, widths besides the full one
ADD = [
    # the stores lane's requests (docs/requests/stores.md item 3)
    ('assets/in-pages/Price_Table.webp', 'assets/in-pages/Price_Table.webp', [720, 1080]),          # /loyalty/, /club-member-program/
    *[(f'assets/in-pages/{p}_gallery_{i}.webp', f'assets/in-pages/{p}_gallery_{i}.webp', []) for p in ('i_94_exit', 'Michiana', 'Union_Pier') for i in (1, 2, 3)],
    # in images.json already, files missing from assets/optimized (v2 shipped only what its home used)
    ('assets/pit-stop/img/lifestyle-01.jpg', 'assets/pit-stop/img/lifestyle-01.jpg', [640, 1024]),
    ('assets/in-pages/app_img.webp', 'assets/in-pages/app_img.webp', [360]),
]


def slug(src):
    s = re.sub(r'\.[a-z0-9]+$', '', src.split('/')[-1])
    return re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()


images = json.load(open(IMAGES, encoding='utf-8'))
for key, src, widths in ADD:
    p = os.path.join(V1, *src.split('/'))
    if not os.path.exists(p): sys.exit('missing source file: v1-source/' + src)
    im = Image.open(p); im.load(); W, H = im.size
    ext = src.rsplit('.', 1)[1].lower()
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.mode != 'P' or 'transparency' in im.info)
    if has_alpha: has_alpha = im.convert('RGBA').getchannel('A').getextrema()[0] < 255
    variants = []
    for w in sorted(widths) + [W]:
        w2 = min(w, W)
        if any(v['w'] == w2 for v in variants): continue
        h2 = round(H * w2 / W)
        fn = '%s-%d.webp' % (slug(src), w2)
        if ext == 'webp' and w2 == W:
            shutil.copyfile(p, os.path.join(OUT, fn))
        else:
            r = im.convert('RGBA' if has_alpha else 'RGB')
            if w2 != W: r = r.resize((w2, h2), Image.LANCZOS)
            r.save(os.path.join(OUT, fn), 'WEBP', quality=80, method=6)
        variants.append({'w': w2, 'h': h2, 'file': fn})
        if w2 == W: break
    old = images.get(key)
    if old and [(v['w'], v['h'], v['file']) for v in old['variants']] != [(v['w'], v['h'], v['file']) for v in variants]:
        sys.exit(f'{key}: images.json lists other variants {old["variants"]} than this tool makes {variants}')
    images[key] = old or {'file': 'v1/' + src, 'width': W, 'height': H, 'variants': variants, 'alpha': bool(has_alpha)}
    print(f'{key}: {W}x{H}, ' + ', '.join(f"{v['file']} ({os.path.getsize(os.path.join(OUT, v['file'])) // 1024} KB)" for v in variants) + (' (entry existed)' if old else ''))

# the file's own layout (optimize-images.py on Windows): indent 1, CRLF, no final newline
open(IMAGES, 'w', encoding='utf-8', newline='\r\n').write(json.dumps(images, ensure_ascii=False, indent=1))
