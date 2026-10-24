#!/usr/bin/env python3
"""build-app-mockup.py - the app's screenshot laid into the owner's phone mockup (owner, 2026-10-22: "use this mockup
and lay the screenshot here … important to see the screenshot well … okay if you only use half of the phone").

No generator: the real screenshot (src/tools/build-app-screen.py, the reskin's own app screen without its iPhone) is
mapped onto the mockup's screen with a perspective transform, so every word and figure of the app stays exactly as it is.
  1. the screen: the mockup's white glass (brighter than 196: the light grey band around it on the lit top and left
     sides is 157-192 and stays the phone's), the region connected to the screen's middle; each of its four edges is
     fitted as a straight line, dropping the samples more than 3px off it (the rounded corners, the notch), and the
     lines' crossings are the screen's corners; the screenshot is drawn only inside that glass, so its corners take the
     screen's own rounding;
  2. the screenshot spans the screen's full width from its top edge; the full screen is taken at a notched phone's own
     proportions (2532 x 1170, the screenshot's own kind of phone: measured flat, the turned mockup's edges read 2.6,
     its width foreshortened, which would squash the app), and the screenshot (cut at its foot in the source) fills
     its top part;
  3. it is drawn only inside the glass (the corners stay round, the bezel untouched); the mockup's notch, light grey on a
     dark status bar, is set black as a phone's notch is;
  4. the picture is cut across just above where the screenshot ends (the owner's "half of the phone"), so no blank glass
     shows, and its lowest 18% fades out to transparent (the cut line would slice the app's last row at a slant; the
     phone dissolves into the band instead). Output: assets/optimized/app-phone-mockup-<w>.webp at full size, 640px and 440px wide (transparent around the phone; the 440 for phones, speed audit 2026-10-22).

  python3 -I src/tools/build-app-mockup.py
"""
import os, subprocess, sys, tempfile
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MOCKUP = os.path.join(ROOT, 'assets', 'source', 'derived', 'owner-phone-mockup.png')
OUT = os.path.join(ROOT, 'assets', 'optimized')
SCREEN = 2532 / 1170   # a notched phone's screen, height / width


def fit_line(pts, keep=3.0):
    """total-least-squares line through pts, refitted after dropping the points more than `keep` px off it (the corners'
    curves, the notch); returned as a point and a direction"""
    p = np.array(pts, float)
    for _ in range(8):
        c = p.mean(axis=0); _, _, vt = np.linalg.svd(p - c); d = vt[0]; n = np.array([-d[1], d[0]])
        r = np.abs((p - c) @ n)
        if r.max() <= keep: break
        p = p[r <= max(keep, np.percentile(r, 75))]
    return c, d


def cross(l1, l2):
    (p, d), (q, e) = l1, l2
    t = np.linalg.solve(np.array([d, -e]).T, q - p); return p + t[0] * d


def homography(src, dst):
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    h = np.linalg.solve(np.array(a, float), np.array([c for uv in dst for c in uv], float))
    return np.append(h, 1).reshape(3, 3)


def main():
    m = Image.open(MOCKUP).convert('RGBA'); arr = np.asarray(m).astype(int); H, W, _ = arr.shape
    light = (arr[..., 3] > 200) & (arr[..., :3].min(axis=2) > 196)
    seen = np.zeros((H, W), bool); cy, cx = H // 2, W // 2; q = deque([(cy, cx)]); seen[cy, cx] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] and light[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    ys, xs = np.nonzero(seen); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    # edge samples on each side's straight run (the phone leans, so a column's top runs down the right edge past the
    # top-right corner and its bottom up the left edge past the bottom-left one): measured on this mockup's profile,
    # the top on both sides of the notch (x0+40..x0+140, x0+420..x0+500), the bottom x0+280..x1-60, the sides between
    # their corners (y0+160..y1-160); the fit still drops any sample more than 3px off its line
    left = [(np.nonzero(seen[y])[0].min(), y) for y in range(y0 + 160, y1 - 160, 6)]
    right = [(np.nonzero(seen[y])[0].max(), y) for y in range(y0 + 160, y1 - 160, 6)]
    top = [(x, np.nonzero(seen[:, x])[0].min()) for x in list(range(x0 + 40, x0 + 140, 3)) + list(range(x0 + 420, x0 + 500, 3))]
    bottom = [(x, np.nonzero(seen[:, x])[0].max()) for x in range(x0 + 280, x1 - 60, 6)]
    L, R, T, B = fit_line(left), fit_line(right), fit_line(top), fit_line(bottom)
    tl, tr, br, bl = cross(T, L), cross(T, R), cross(B, R), cross(B, L)
    width = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2; height = (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2
    print('screen corners', [tuple(np.round(p, 1)) for p in (tl, tr, br, bl)], 'proportions %.3f' % (height / width))

    with tempfile.TemporaryDirectory() as tmp:
        shot_file = os.path.join(tmp, 'screen.webp')
        subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'src', 'tools', 'build-app-screen.py'), shot_file], check=True, capture_output=True)
        shot = Image.open(shot_file).convert('RGBA'); shot.load()
    sw, sh = shot.size; full_h = sw * SCREEN
    # the full screen as a rectangle sw x full_h; the screenshot fills its top sh rows
    hm = homography([(0, 0), (sw, 0), (sw, full_h), (0, full_h)], [tuple(tl), tuple(tr), tuple(br), tuple(bl)])
    # the screenshot is padded by PAD px of its own edge pixels on its top and sides, so the glass's edge (where the
    # warp's last column would be half transparent) is covered by the app's own colour, never the white glass under it
    PAD = 6
    sa = np.asarray(shot); sa = np.pad(sa, ((PAD, 0), (PAD, PAD), (0, 0)), mode='edge')
    canvas = Image.new('RGBA', (sw + 2 * PAD, int(np.ceil(full_h)) + PAD), (0, 0, 0, 0)); canvas.paste(Image.fromarray(sa), (0, 0))
    shift = np.array([[1, 0, PAD], [0, 1, PAD], [0, 0, 1]], float)          # rect coords -> padded canvas coords
    inv = shift @ np.linalg.inv(hm); inv = inv / inv[2, 2]
    warped = canvas.transform((W, H), Image.PERSPECTIVE, tuple(inv.flatten()[:8]), resample=Image.BICUBIC)

    glass = Image.fromarray((seen * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))
    out = m.copy()
    # the notch: the grey shape hanging from the middle of the top edge, filled from its own middle and only below the
    # fitted top line (the band above the line, and the band left in the rounded corners, stay the phone's)
    def top_y(x): return T[0][1] + (x - T[0][0]) * T[1][1] / T[1][0]
    grey = (arr[..., 3] > 200) & (arr[..., :3].min(axis=2) > 110) & (arr[..., :3].min(axis=2) <= 200)
    # the seed: beside the speaker slot (whose soft rim is a small grey island of its own), where the notch is plain grey
    # (3 grey pixels in a row going down, 150-195)
    mid = (tl + tr) / 2; seed = None
    for off in (-60, 60, -90, 90):
        sx = int(round(mid[0])) + off; base = int(round(top_y(sx)))
        for sy in range(base + 3, base + 70):
            if all(150 <= arr[sy + k, sx, :3].min() <= 195 for k in range(3)): seed = (sx, sy); break
        if seed: break
    if not seed: raise SystemExit('no notch found under the top edge')
    sx, sy = seed
    notch = np.zeros((H, W), bool); q = deque([(sy, sx)]); notch[sy, sx] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not notch[ny, nx] and grey[ny, nx] and ny >= top_y(nx) - .5: notch[ny, nx] = True; q.append((ny, nx))
    # the notch's speaker slot (darker than grey) inside it is filled too: every pixel enclosed by the notch's span
    nys, nxs = np.nonzero(notch)
    for x in range(nxs.min(), nxs.max() + 1):
        c = np.nonzero(notch[:, x])[0]
        if len(c): notch[c.min():c.max() + 1, x] = True
    nz = notch.sum(); print('notch pixels set black:', int(nz))
    o = np.asarray(out).copy(); o[notch, :3] = (10, 10, 11); out = Image.fromarray(o)
    # the screenshot only inside the glass (its own alpha is 0 below its foot: the glass keeps the mockup there)
    wa = np.asarray(warped.getchannel('A')).astype(float) / 255 * np.asarray(glass).astype(float) / 255
    warped.putalpha(Image.fromarray((wa * 255).round().astype(np.uint8)))
    out.alpha_composite(warped)

    # cut across just above the screenshot's foot (its higher end), so no blank glass shows; trim to the phone
    foot = [hm @ np.array([x, sh, 1.0]) for x in (0, sw)]; foot = [p[:2] / p[2] for p in foot]
    cut = int(np.floor(min(p[1] for p in foot))) - 2
    alpha = np.asarray(out.getchannel('A'))[:cut]; cols = np.nonzero(alpha.max(axis=0) > 8)[0]; rows = np.nonzero(alpha.max(axis=1) > 8)[0]
    box = (int(cols.min()), int(rows.min()), int(cols.max()) + 1, cut)
    final = out.crop(box)
    # the foot fades out (smoothstep over the lowest 18%)
    fa = np.asarray(final.getchannel('A')).astype(float); fh = fa.shape[0]; f0 = int(fh * .82)
    tt = np.clip((np.arange(fh) - f0) / max(1, fh - 1 - f0), 0, 1); fade = 1 - tt * tt * (3 - 2 * tt)
    final.putalpha(Image.fromarray((fa * fade[:, None]).round().astype(np.uint8)))
    print('cut at y %d; picture %dx%d' % (cut, *final.size))
    for w in (final.size[0], 640, 440):
        im = final if w == final.size[0] else final.resize((w, round(final.size[1] * w / final.size[0])), Image.LANCZOS)
        fn = os.path.join(OUT, 'app-phone-mockup-%d.webp' % w); im.save(fn, 'WEBP', quality=90, method=6)
        print('wrote %s (%dx%d)' % (os.path.relpath(fn, ROOT), *im.size))


if __name__ == '__main__':
    main()
