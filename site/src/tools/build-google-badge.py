#!/usr/bin/env python3
"""build-google-badge.py - the reviews section's "Google Rating" badge redrawn as a vector (owner, 2026-10-22: the
reskin's badge "looks blurry"). The reskin's file (assets/in-pages/img1.webp) is a 324x95 raster drawn soft, shown at
twice its pixels on sharp screens; no larger copy exists. This draws the same badge, laid out on the raster's 324x95
canvas, every part a vector; the file is cropped to the art itself (x 46-300, y 20-79: 254x59, the raster's empty
margins dropped, which the page used to trim with negative margins):
  - the Google wordmark: Google's own logo outlines (Wikimedia Commons, Google_2015_logo.svg; kept at
    assets/source/derived/google-logo-2015.svg), placed where the raster has it (x 47-139, y 20-50);
  - "Rating", "4.7" and "1,054 reviews": the raster's own words and figures, set in the site's Work Sans and turned into
    outlines (no font needed inside an <img>), on the raster's lines;
  - five stars, the fifth filled to 70% (4.7).
"1,054 reviews" takes Google's secondary grey (#5F6368, 5.6:1 on the reviews ground) instead of the raster's faint
#B1B1B1 (1.9:1): text in an image keeps WCAG AA too.

  python3 -I src/tools/build-google-badge.py   ->  assets/optimized/google-rating.svg
"""
import os, re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OPT = os.path.join(ROOT, 'assets', 'optimized')
LOGO = os.path.join(ROOT, 'assets', 'source', 'derived', 'google-logo-2015.svg')

W, H = 324, 95                     # the raster's canvas (the layout below is drawn on it)
ART = (46, 20, 254, 59)            # the art's box on that canvas: the file's viewBox
INK = '#1F1F21'; GREY = '#3C4043'; SOFT = '#5F6368'; STAR = '#F9C006'; STAR_OFF = '#DADCE0'


def outline(font_file, text, ink_left, baseline, ink_width):
    """text as one SVG path: sized so its ink spans ink_width, its ink starting at ink_left, on baseline"""
    f = TTFont(os.path.join(OPT, font_file)); gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f['hmtx']
    names = [cmap[ord(ch)] for ch in text]
    # ink bounds at 1 unit per font unit
    x = 0; lo = hi = None
    for n in names:
        bp = BoundsPen(gs); gs[n].draw(bp)
        if bp.bounds:
            l, b, r, t = bp.bounds; lo = x + l if lo is None else min(lo, x + l); hi = x + r if hi is None else max(hi, x + r)
        x += hmtx[n][0]
    s = ink_width / (hi - lo)
    pen = SVGPathPen(gs); x = 0
    for n in names:
        # font units, y up -> badge pixels, y down
        gs[n].draw(TransformPen(pen, (s, 0, 0, -s, ink_left - lo * s + x * s, baseline)))
        x += hmtx[n][0]
    return pen.getCommands(), s


def star(cx, cy, r):
    pts = []
    for k in range(10):
        import math
        a = -math.pi / 2 + k * math.pi / 5; rr = r if k % 2 == 0 else r * .5
        pts.append('%.2f,%.2f' % (cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return 'M' + ' L'.join(pts) + 'Z'


def main():
    logo = open(LOGO, encoding='utf-8').read()
    # paths only: no script, no event handler attribute, no link (the file came from the web)
    if re.search(r'<script|\son[a-z]+\s*=|href', logo, re.I): raise SystemExit('the logo file carries more than paths')
    paths = re.findall(r'<path\b[^>]*/>', logo)
    if len(paths) != 6: raise SystemExit('expected the 6 paths of the Google wordmark, found %d' % len(paths))
    # the wordmark's viewBox is 272x92 (tight); the raster draws it 92px wide from (47, 20); its letters sit on y 69.36
    k = 92 / 272; base1 = 20 + 69.36 * k
    rating, _ = outline('work-sans-400.woff2', 'Rating', 151, base1, 68)
    four7, _ = outline('work-sans-600.woff2', '4.7', 47, 78, 32)
    reviews, _ = outline('work-sans-400.woff2', '1,054 reviews', 213, 78, 86)
    # five stars across x 90-197 (the raster's), 19.4px tall, their foot on the line's baseline
    import math
    r = 19.4 / (1 + math.cos(math.pi / 5)); sw = 2 * r * math.cos(math.pi / 10); gap = (107 - 5 * sw) / 4
    cy = 78 - r * math.cos(math.pi / 5)
    stars = [star(90 + sw / 2 + i * (sw + gap), cy, r) for i in range(5)]
    x5 = 90 + 4 * (sw + gap)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" width="%d" height="%d">' % (ART + ART[2:])
        + '<g transform="translate(47 20) scale(%.6f)">%s</g>' % (k, ''.join(paths))
        + '<path fill="%s" d="%s"/>' % (GREY, rating)
        + '<path fill="%s" d="%s"/>' % (INK, four7)
        + '<g fill="%s" stroke="%s" stroke-width="1.2" stroke-linejoin="round">%s</g>' % (STAR, STAR, ''.join('<path d="%s"/>' % p for p in stars[:4]))
        + '<clipPath id="g47"><rect x="%.2f" y="0" width="%.2f" height="%d"/></clipPath>' % (x5 - 1, sw * .7 + 1, H)
        + '<path d="%s" fill="%s" stroke="%s" stroke-width="1.2" stroke-linejoin="round"/>' % (stars[4], STAR_OFF, STAR_OFF)
        + '<path d="%s" fill="%s" stroke="%s" stroke-width="1.2" stroke-linejoin="round" clip-path="url(#g47)"/>' % (stars[4], STAR, STAR)
        + '<path fill="%s" d="%s"/>' % (SOFT, reviews)
        + '</svg>\n'
    )
    out = os.path.join(OPT, 'google-rating.svg'); open(out, 'w').write(svg)
    print('wrote %s (%d bytes)' % (os.path.relpath(out, ROOT), len(svg)))


if __name__ == '__main__':
    main()
