#!/usr/bin/env python3
"""add-mega-images.py - web-sized WebP files for the mega menus' feature images, added to assets/optimized and
src/content/images.json the way add-page-images.py adds the inner pages' images (no re-run of optimize-images.py).

Sources: the Higgsfield generations in ../higgsfield/ (workspace root; PROVENANCE.json there lists each file's job id,
model and prompt). They stay in the working project and are never published, like v1-source/.

Two pictures per source, both re-encoded WebP q80 method 6 (LANCZOS), as add-page-images.py does:
  - the desktop card (key 'higgsfield/<name>.png'): the whole 3:4 frame, at the card's 1x and 2x widths
  - the phone card (key 'higgsfield/<name>.png#phone'): a 16:9 band of the frame, centred on the subject (CROP_Y, the
    band's centre in source pixels, chosen by eye on 2026-10-24), at the phone menu card's widths
An existing images.json entry is only (re)written for the keys below; its variant sizes must match.

  python -X utf8 -I src/tools/add-mega-images.py            (from site/)
"""
import json, os, sys
from PIL import Image

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(SITE, '..', 'higgsfield')
OUT = os.path.join(SITE, 'assets', 'optimized')
IMAGES = os.path.join(SITE, 'src', 'content', 'images.json')

DESKTOP_W = [360, 640]          # the card is 240-320px wide on the desktop panels
PHONE_W = [480, 800, 1120]      # the phone menu card is at most 560px wide
# name -> centre of the 16:9 phone band, in source pixels from the top (sources are 1536x2048)
CROP_Y = {'mega-explore': 1000, 'mega-resources': 900, 'mega-locations': 940}


def encode(im, w, fn):
    W, H = im.size
    h = round(H * w / W)
    r = im if w == W else im.resize((w, h), Image.LANCZOS)
    r.save(os.path.join(OUT, fn), 'WEBP', quality=80, method=6)
    return {'w': w, 'h': h, 'file': fn}


images = json.load(open(IMAGES, encoding='utf-8'))
for name, cy in CROP_Y.items():
    p = os.path.join(SRC, name + '.png')
    if not os.path.exists(p): sys.exit('missing source file: higgsfield/' + name + '.png')
    im = Image.open(p); im.load(); im = im.convert('RGB'); W, H = im.size
    bh = round(W * 9 / 16)
    top = min(max(0, cy - bh // 2), H - bh)
    band = im.crop((0, top, W, top + bh))
    for key, pic, widths, stem in ((f'higgsfield/{name}.png', im, DESKTOP_W, name), (f'higgsfield/{name}.png#phone', band, PHONE_W, name + '-phone')):
        variants = [encode(pic, w, '%s-%d.webp' % (stem, w)) for w in widths if w <= pic.size[0]]
        old = images.get(key)
        if old and [(v['w'], v['h'], v['file']) for v in old['variants']] != [(v['w'], v['h'], v['file']) for v in variants]:
            sys.exit(f'{key}: images.json lists other variants {old["variants"]} than this tool makes {variants}')
        images[key] = {'file': key.split('#')[0], 'width': pic.size[0], 'height': pic.size[1], 'variants': variants, 'alpha': False}
        if key.endswith('#phone'): images[key]['crop'] = [0, top, W, top + bh]
        print(f'{key}: {pic.size[0]}x{pic.size[1]}, ' + ', '.join(f"{v['file']} ({os.path.getsize(os.path.join(OUT, v['file'])) // 1024} KB)" for v in variants) + (' (entry existed)' if old else ''))

# the file's own layout (optimize-images.py on Windows): indent 1, CRLF, no final newline
open(IMAGES, 'w', encoding='utf-8', newline='\r\n').write(json.dumps(images, ensure_ascii=False, indent=1))
