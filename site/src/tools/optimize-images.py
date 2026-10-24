#!/usr/bin/env python3
"""optimize-images.py - web-sized WebP derivatives of the reskin's own images (and the brand card's logo files).

The pictures are used as they are (same files, no edits, no crops; the toned-down photos, TONED below, are the
owner's exception): JPEG/PNG are re-encoded to WebP and capped at
the widths the layout can show; a WebP already at or under a width is copied byte for byte (re-encoding it would only
lose quality); SVG ships with the same shapes, its straight-line path data written compactly (below). Writes assets/optimized/* and src/content/images.json, keyed by the path the
reskin page uses ("assets/in-pages/hot_deals.webp") or "brand:<path>" for a brand card file.

  python3 -I src/tools/optimize-images.py
"""
import hashlib, json, os, re, shutil
from PIL import Image


# the brand logos are SVGs drawn only in straight lines (M/L/Z), their coordinates written absolute with 3-4 decimals
# (the horizontal lockup: 64 KB). Written as relative linetos at 2 decimals, computed from the rounded absolutes so no
# error accumulates, the same shapes take about half the bytes (64,252 -> 30,338 B; gzip 16.4 -> 7.7 KB); rendered
# against the original: 0 pixels differ at the header's 144px, under 0.002% at 1632px (speed audit, 2026-10-22). An SVG
# with any other path command ships byte for byte.
def _num(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    if s == '-0': s = '0'
    if s.startswith('0.'): s = s[1:]
    elif s.startswith('-0.'): s = '-' + s[2:]
    return s
def _cat(a, n):
    last = re.split(r'(?=-)|[ lMz]', a)[-1] if a else ''
    if not a or n.startswith('-') or (n.startswith('.') and '.' in last) or a[-1] in 'lMz': return a + n
    return a + ' ' + n
def _compact_d(d):
    toks = re.findall(r'[MLZmlz]|-?\d*\.?\d+', d); out = ''; i = 0; cx = cy = sx = sy = 0; last = None
    while i < len(toks):
        t = toks[i]
        if t in 'Zz': out += 'z'; cx, cy = sx, sy; last = 'z'; i += 1; continue
        if t not in 'ML': return None
        x = round(float(toks[i + 1]), 2); y = round(float(toks[i + 2]), 2); i += 3
        if t == 'M': out += 'M'; out = _cat(out, _num(x)); out = _cat(out, _num(y)); sx, sy = x, y; last = 'M'
        else:
            if last != 'l': out += 'l'
            out = _cat(out, _num(round(x - cx, 2))); out = _cat(out, _num(round(y - cy, 2))); last = 'l'
        cx, cy = x, y
    return out
def compact_svg(src, dst):
    s = open(src, encoding='utf-8').read(); ds = re.findall(r' d="([^"]*)"', s)
    out = [_compact_d(d) for d in ds]
    if not ds or any(o is None for o in out): shutil.copyfile(src, dst); return
    it = iter(out); open(dst, 'w', encoding='utf-8').write(re.sub(r' d="([^"]*)"', lambda m: ' d="%s"' % next(it), s))

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'optimized')
os.makedirs(OUT, exist_ok=True)

WIDTHS = [
    (r'img/scene-', [480, 800, 1200]),
    (r'img/(lifestyle|hero-pit-wall)', [640, 1024, 1600]),
    (r'in-pages/hot_deals(___2)?\.webp$', [560, 840]),
    (r'in-pages/high_society_cannabis__1__2\.webp$', [260]),     # the craft logo paints 152-242px on desktop
    (r'in-pages/image_1__1_', [420]),
    (r'in-pages/app_img', [360]),
    (r'logos/pitstop-trophy-horizontal', [480, 960]),
    (r'logos/pitstop-trophy-stacked', [360, 720]),
]
# what the page uses (reskin homepage) + the brand card's logo and pattern files
FILES = [
    *['reskin/assets/in-pages/' + f for f in (
        'banner_logo.webp', 'Layer_13_copy.webp', 'Clip_path_group.webp', 'Clip_path_group__1_.webp', 'hot_deals.webp', 'hot_deals___2.webp',
        'mobile_hot_deals.webp', 'hot_deals___mobile2.webp', '2024_06_10_HighSociety_RemakeMIJaneLogo_1.webp', 'Doozy_Color_1.webp',
        'Rooted_Logo_1.webp', 'Glostix_Logo_1.webp', 'high_society_cannabis__1__2.webp', 'high_society_cannabis__1__2__1_.webp',
        'image_1__1_.webp', 'app_img.webp', 'img1.webp')],
    *['reskin/assets/pit-stop/img/scene-%s.jpg' % s for s in ('birch-run', 'east-lansing', 'big-rapids', 'charlotte', 'lenox', 'mount-pleasant', 'saline', 'new-buffalo')],
    'reskin/assets/pit-stop/img/lifestyle-01.jpg', 'reskin/assets/pit-stop/img/lifestyle-02.jpg', 'reskin/assets/pit-stop/img/hero-pit-wall.jpg',
    'reskin/assets/pit-stop/logo/b-horizontal-web-keyline.svg', 'reskin/assets/pit-stop/logo/b-mark-badge-keyline.svg',
    'reskin/assets/pit-stop/logo/mark-red.svg', 'reskin/assets/pit-stop/logo/mark-white.svg',
    'reskin/assets/pit-stop/pattern/carbon-panel.svg', 'reskin/assets/pit-stop/pattern/carbon.svg', 'reskin/assets/pit-stop/pattern/diamond-plate.svg',
    'reskin/assets/pit-stop/pattern/checkered-band.png', 'reskin/assets/pit-stop/pattern/checkered-band-76.png',
    'brand/assets/logos/pitstop-trophy-horizontal.png', 'brand/assets/logos/pitstop-trophy-stacked-from-wrap-p01-01.png',
    'brand/assets/picked/logo/b-stacked-web-keyline.svg', 'brand/assets/picked/logo/b-mark-badge-keyline.svg',
    'brand/assets/picked/graphic/b-pattern-pit-box.svg', 'brand/assets/picked/graphic/b-pattern-diamond-plate.svg', 'brand/assets/picked/graphic/c-pattern-carbon.svg',
]


# the owner's tone-down (2026-10-23: "not as if there is a race event going on, just the beautiful storefront without
# people"; on the Join photo only the truss arc and the race car go): AI edits (fal Nano Banana Pro, independently
# reviewed, fitted back onto each original's 1600x1063 frame by labs/imagery/toned-down/) stand in for these sources
# under the same keys and widths, so every crop and object-position stays measured on the same frame. Their file names
# carry the first 8 hex of the toned file's md5 (slug below): the first republish kept the old names and a browser tab
# opened before it went on showing the race-day photos, so every new version of a toned photo gets new URLs
TONED ={'reskin/assets/pit-stop/img/%s.jpg' % n: 'derived/toned/%s.png' % n for n in ('lifestyle-02', 'scene-birch-run', 'scene-east-lansing', 'scene-big-rapids', 'scene-charlotte', 'scene-lenox', 'scene-mount-pleasant', 'scene-saline', 'scene-new-buffalo')}


def key_of(rel):
    return rel.split('/', 1)[1] if rel.startswith('reskin/') else 'brand:' + rel.split('/', 1)[1]


def slug(rel):
    s = re.sub(r'\.[a-z0-9]+$', '', rel.split('/', 1)[1].split('/')[-1])
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    s = ('brand-' if rel.startswith('brand/') else '') + s
    if rel in TONED: s += '-' + hashlib.md5(open(os.path.join(SRC, TONED[rel]), 'rb').read()).hexdigest()[:8]
    return s


def svg_size(p):
    t = open(p, encoding='utf-8', errors='ignore').read(4000)
    vb = re.search(r'viewBox="\s*([\d.\-]+)[\s,]+([\d.\-]+)[\s,]+([\d.]+)[\s,]+([\d.]+)', t)
    w = re.search(r'\swidth="([\d.]+)', t); h = re.search(r'\sheight="([\d.]+)', t)
    if vb: return round(float(vb.group(3))), round(float(vb.group(4)))
    if w and h: return round(float(w.group(1))), round(float(h.group(1)))
    return None, None


images = {}; tin = tout = 0
for rel in FILES:
    p = os.path.join(SRC, TONED.get(rel, rel))
    if not os.path.exists(p): raise SystemExit('missing source file: ' + TONED.get(rel, rel))
    k, stem, ext = key_of(rel), slug(rel), rel.rsplit('.', 1)[1].lower()
    tin += os.path.getsize(p)
    if ext == 'svg':
        fn = stem + '.svg'; compact_svg(p, os.path.join(OUT, fn)); tout += os.path.getsize(os.path.join(OUT, fn))
        w, h = svg_size(p)
        images[k] = {'file': rel, 'width': w, 'height': h, 'variants': [{'w': w, 'h': h, 'file': fn}], 'svg': True}
        continue
    if ext == 'png' and 'pattern/' in rel:      # the checkered band tiles: pixel art, kept lossless
        fn = stem + '.png'; shutil.copyfile(p, os.path.join(OUT, fn)); tout += os.path.getsize(p)
        im = Image.open(p); images[k] = {'file': rel, 'width': im.size[0], 'height': im.size[1], 'variants': [{'w': im.size[0], 'h': im.size[1], 'file': fn}]}
        continue
    im = Image.open(p); im.load(); W, H = im.size
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.mode != 'P' or 'transparency' in im.info)
    if has_alpha: has_alpha = im.convert('RGBA').getchannel('A').getextrema()[0] < 255
    ws = next((w for pat, w in WIDTHS if re.search(pat, rel)), None) or [W]
    variants = []
    for w in ws + [W]:
        w2 = min(w, W)
        if any(v['w'] == w2 for v in variants): continue
        h2 = round(H * w2 / W)
        fn = '%s-%d.webp' % (stem, w2)
        if ext == 'webp' and w2 == W:
            shutil.copyfile(p, os.path.join(OUT, fn))           # the reskin's own WebP, byte for byte
        else:
            r = im.convert('RGBA' if has_alpha else 'RGB')
            if w2 != W: r = r.resize((w2, h2), Image.LANCZOS)
            r.save(os.path.join(OUT, fn), 'WEBP', quality=90 if ('logo' in rel.lower() or 'trophy' in rel) else 80, method=6)
        tout += os.path.getsize(os.path.join(OUT, fn))
        variants.append({'w': w2, 'h': h2, 'file': fn})
        if w2 == W: break
    variants.sort(key=lambda v: v['w'])
    images[k] = {'file': rel, 'width': W, 'height': H, 'variants': variants, 'alpha': bool(has_alpha)}
    if rel in TONED: images[k]['toned'] = TONED[rel]

# art-directed crops: one region of a source, kept at its full resolution, under its own key ("<key>#<name>").
# The Join photo (1600x1063, cover, object-position 67%) on a portrait phone shows at most ~1100 source px of its width:
# the crop x 335-1435 (335 = 67% of the 500px it drops) puts every visible pixel where it was (speed audit, 2026-10-22:
# 254 KB -> 166 KB on every phone)
# (The hero's own phone crops, x 300-920 and the wide x 379-1251, were replaced on 2026-10-22 by the owner's phone hero,
# derived:owner-hero-mobile below, which the hero and the age gate share.)
CROPS = [('assets/pit-stop/img/lifestyle-02.jpg', 'phone', (335, 0, 1435, 1063), None)]
for k, name, box, avif_q in CROPS:
    rel = images[k]['file']; im = Image.open(os.path.join(SRC, TONED.get(rel, rel))).convert('RGB').crop(box)
    fn = '%s-%s-%d.webp' % (slug(rel), name, im.size[0])
    im.save(os.path.join(OUT, fn), 'WEBP', quality=80, method=6); tout += os.path.getsize(os.path.join(OUT, fn))
    images[k + '#' + name] = {'file': rel, 'crop': list(box), 'width': im.size[0], 'height': im.size[1], 'variants': [{'w': im.size[0], 'h': im.size[1], 'file': fn}], 'alpha': False}
    if avif_q:
        fa = '%s-%s-%d.avif' % (slug(rel), name, im.size[0])
        im.save(os.path.join(OUT, fa), 'AVIF', quality=avif_q, speed=4); tout += os.path.getsize(os.path.join(OUT, fa))
        images[k + '#' + name]['avif'] = fa

# the owner's phone hero (2026-10-22, "can you try this?": assets/source/derived/owner-hero-mobile.png, 1170x2532, one
# 390x844 screen at 3x: the race-day photo recomposed, PIT STOP over her head, faded to black by 57% of its height).
# Shipped cut just under its last non-black row (the hero's ground is black below it), as WebP and AVIF at 780 (2x) and
# 1170 (3x) wide; h.picture() offers the AVIF as a typed source
OWNER_HERO = 'derived/owner-hero-mobile.png'
_im = Image.open(os.path.join(SRC, OWNER_HERO)).convert('RGBA')
_flat = Image.new('RGB', _im.size, (0, 0, 0)); _flat.paste(_im, mask=_im.getchannel('A'))
_lit = [y for y in range(_flat.size[1]) if max(_flat.crop((0, y, _flat.size[0], y + 1)).getextrema(), key=lambda e: e[1])[1] > 3]
_cut = min(_flat.size[1], (max(_lit) // 4 + 2) * 4)
_flat = _flat.crop((0, 0, _flat.size[0], _cut))
_ov, _oa = [], []
for w in (780, 1170):
    r = _flat if w == _flat.size[0] else _flat.resize((w, round(_cut * w / _flat.size[0])), Image.LANCZOS)
    fw, fa = 'owner-hero-mobile-%d.webp' % w, 'owner-hero-mobile-%d.avif' % w
    r.save(os.path.join(OUT, fw), 'WEBP', quality=80, method=6); r.save(os.path.join(OUT, fa), 'AVIF', quality=55, speed=4)
    tout += os.path.getsize(os.path.join(OUT, fw)) + os.path.getsize(os.path.join(OUT, fa))
    _ov.append({'w': r.size[0], 'h': r.size[1], 'file': fw}); _oa.append({'w': r.size[0], 'h': r.size[1], 'file': fa})
images['derived:owner-hero-mobile'] = {'file': OWNER_HERO, 'cut': _cut, 'width': _flat.size[0], 'height': _cut, 'variants': _ov, 'avif': _oa, 'alpha': False}

# vector redraws made by their own tools into assets/optimized/, listed under "derived:<file>" (owner, 2026-10-22: the
# reviews' Google Rating badge, a soft 324x95 raster, redrawn sharp by src/tools/build-google-badge.py)
DERIVED = [('google-rating.svg', 'src/tools/build-google-badge.py')]
# the app's screenshot in the owner's phone mockup (owner, 2026-10-22, option G): a raster at its full width, 640px and
# 440px (phones), all written by src/tools/build-app-mockup.py as app-phone-mockup-<w>.webp
import glob as _glob
_mk = sorted(_glob.glob(os.path.join(OUT, 'app-phone-mockup-*.webp')), key=lambda f: Image.open(f).size[0])
if len(_mk) != 3: raise SystemExit('expected the 440px, 640px and full-width app-phone-mockup files: run src/tools/build-app-mockup.py first (found %d)' % len(_mk))
_v = []
for f in _mk:
    w2, h2 = Image.open(f).size; _v.append({'w': w2, 'h': h2, 'file': os.path.basename(f)}); tout += os.path.getsize(f)
images['derived:app-phone-mockup'] = {'file': 'derived/owner-phone-mockup.png', 'tool': 'src/tools/build-app-mockup.py', 'width': _v[-1]['w'], 'height': _v[-1]['h'], 'variants': _v, 'alpha': True}
for fn, tool in DERIVED:
    fp = os.path.join(OUT, fn)
    if not os.path.exists(fp): raise SystemExit('missing assets/optimized/%s: run %s first' % (fn, tool))
    w, h = svg_size(fp)
    images['derived:' + fn] = {'file': 'derived/' + fn, 'tool': tool, 'width': w, 'height': h, 'variants': [{'w': w, 'h': h, 'file': fn}], 'svg': True}

json.dump(images, open(os.path.join(ROOT, 'src', 'content', 'images.json'), 'w'), indent=1)
print('images: %d sources -> %d files | %.2f MB in -> %.2f MB out' % (len(images), sum(len(v['variants']) for v in images.values()), tin / 1e6, tout / 1e6))
