#!/usr/bin/env python3
"""optimize-fonts.py - the brand card's font files, made light for the web (owner, 2026-10-22: "optimize site to load
fast"). The card's files (assets/source/brand/assets/picked/type/) are full fonts: Changa One a 22.7 KB TrueType, the
Work Sans cuts carrying ~30 OpenType features the page never turns on. Each face is written to
assets/optimized/<same name>.woff2:
  - cut to a copy-edit-safe Latin set: Basic Latin, Latin-1 and the common typographic punctuation (dashes, curly
    quotes, bullet, ellipsis, euro, trademark), so a later edit or a store name the CMS writes still finds its glyphs;
    the page draws only ASCII plus (c), en dash and curly apostrophe today;
  - the default OpenType features kept (kern, liga, calt, locl, ccmp, mark, mkmk, ...), the hinting kept, the vertical
    metrics untouched (so the metric-matched fallbacks in fonts.css still match);
  - WOFF2 (Changa One included: it was the page's only .ttf).
Measured before adopting (labs speed audit, 2026-10-22): the four faces a phone loads at startup 92.5 KB -> 51.3 KB;
all 185 text runs on the page drawn with the old and the new files: identical shaped widths, 0 pixels different.

  python3 -I src/tools/optimize-fonts.py
"""
import os
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'source', 'brand', 'assets', 'picked', 'type')
OUT = os.path.join(ROOT, 'assets', 'optimized')
# the faces fonts.css declares (the card's Changa 200/400 and the Changa One italic are not used by the page)
FILES = ['changa-one-400.ttf', 'changa-300.woff2', 'changa-500.woff2', 'changa-600.woff2', 'changa-700.woff2',
         'changa-800.woff2', 'work-sans-400.woff2', 'work-sans-500.woff2', 'work-sans-600.woff2', 'work-sans-700.woff2']
LATIN = (set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))
         | {0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
            0x2022, 0x2026, 0x2039, 0x203A, 0x20AC, 0x2122})


def main():
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = True
    opts.name_IDs = ['*']; opts.name_languages = ['*']
    opts.legacy_kern = True
    opts.notdef_outline = True
    opts.glyph_names = False
    before = after = 0
    for fn in FILES:
        src = os.path.join(SRC, fn)
        dst = os.path.join(OUT, os.path.splitext(fn)[0] + '.woff2')
        f = TTFont(src)
        s = subset.Subsetter(options=opts); s.populate(unicodes=LATIN); s.subset(f)
        f.flavor = 'woff2'; f.save(dst)
        before += os.path.getsize(src); after += os.path.getsize(dst)
        print('%-22s %7d -> %7d B' % (fn, os.path.getsize(src), os.path.getsize(dst)))
    print('all faces %d -> %d B' % (before, after))


if __name__ == '__main__':
    main()
