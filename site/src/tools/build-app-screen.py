#!/usr/bin/env python3
"""build-app-screen.py - the app section's screenshot without its iPhone (owner, 2026-10-22: "replace the iphone mockup
here while retaining the screenshot"). The reskin's app_img.webp (706x887) is one flat picture: an iPhone, front on, cut
off at its foot, the app's screen inside it. This takes the screen out of it, and nothing else:
  - the crop is the screen's own area, x 109-597 (where the app's white page meets the black bezel on both sides) and
    y 124 down to the picture's foot (the status bar's black starts under the frame at y 118);
  - the phone's notch (hardware drawn over the status bar, x 300-430) and the frame's two corner arcs crossing the
    status bar's black (x 109-130 and 575-597, y 124-210) are filled with that black; the time, the status icons and
    every pixel of the app below stay as they are.

  python3 -I src/tools/build-app-screen.py [out.webp]   ->  assets/optimized/app-screen-489.webp (default)
"""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'source', 'reskin', 'assets', 'in-pages', 'app_img.webp')
BOX = (109, 124, 598, 887)
BLACK_OUT = [(300, 124, 430, 168), (109, 124, 130, 210), (575, 124, 597, 210)]   # notch, left arc, right arc


def main():
    im = Image.open(SRC).convert('RGBA'); crop = im.crop(BOX).copy(); d = ImageDraw.Draw(crop)
    for x0, y0, x1, y1 in BLACK_OUT:
        d.rectangle((x0 - BOX[0], y0 - BOX[1], x1 - BOX[0], y1 - BOX[1]), fill=(0, 0, 0, 255))
    crop = crop.convert('RGB')
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'optimized', 'app-screen-%d.webp' % crop.size[0])
    crop.save(out, 'WEBP', quality=90, method=6)
    print('wrote %s (%dx%d)' % (os.path.relpath(out, ROOT), *crop.size))


if __name__ == '__main__':
    main()
