#!/usr/bin/env python3
"""build-content.py - write src/content/home.json, the redesign's ONLY source of copy, by reading the reskin
homepage exactly as GitHub Pages served it (audit/raw/client-highsocietydispo-reskin-index.html.html).

Every string is pulled out of the raw page by the id of the CMS component that holds it, so nothing is typed by
hand. The few strings the build adds are UI labels, listed under "ui"; prove-content.py checks all of it again.

Where the reskin carries the same content more than once (five copies of the store set, two Staff Picks galleries,
a phone-only copy of the reviews heading) the copy the brief asks for is read, and the others are recorded under
"declaredDuplicates" with the reason, so the parity gate can tell a declared duplicate from a loss.

  python3 -I src/tools/build-content.py
"""
import json, os, re, html
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW_NAME = 'client-highsocietydispo-reskin-index.html.html'
RAW = open(os.path.join(ROOT, 'audit', 'raw', RAW_NAME), encoding='utf-8').read()
ORIGIN = 'https://sgencms.github.io/client-highsocietydispo-reskin/'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.kids = tag, attrs, parent, []

    def find_all(self, pred):
        out = []
        for k in self.kids:
            if isinstance(k, Node):
                if pred(k): out.append(k)
                out.extend(k.find_all(pred))
        return out

    def find(self, pred):
        r = self.find_all(pred)
        return r[0] if r else None

    def text(self):
        return ''.join(k if isinstance(k, str) else ('' if k.tag in ('script', 'style', 'svg') else k.text()) for k in self.kids)

    def cls(self):
        return (self.attrs.get('class') or '').split()

    def children(self):
        return [k for k in self.kids if isinstance(k, Node)]


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', {}, None); self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, {k: (v if v is not None else '') for k, v in attrs}, self.cur)
        self.cur.kids.append(n)
        if tag not in VOID: self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, {k: (v if v is not None else '') for k, v in attrs}, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag: n = n.parent
        if n is not None and n.parent is not None: self.cur = n.parent

    def handle_data(self, d):
        self.cur.kids.append(d)


T = Tree(); T.feed(RAW)
R = T.root
norm = lambda s: re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()


def by_id(i):
    n = R.find(lambda x: x.attrs.get('id') == i)
    if n is None: raise SystemExit('no element #%s in the raw page' % i)
    return n


def first(n, tag):
    r = n.find(lambda x: x.tag == tag)
    if r is None: raise SystemExit('no <%s> under <%s id=%s>' % (tag, n.tag, n.attrs.get('id')))
    return r


def lines(n):
    """The node's text split at its <br>s (each part normalised): "Birch <br> Run" -> ["Birch", "Run"]."""
    parts, cur = [], ''
    def walk(x):
        nonlocal cur
        for k in x.kids:
            if isinstance(k, str): cur += k
            elif k.tag == 'br': parts.append(cur); cur = ''
            elif k.tag not in ('script', 'style', 'svg'): walk(k)
    walk(n); parts.append(cur)
    return [norm(p) for p in parts if norm(p)]


def img(n):
    im = n if n.tag == 'img' else first(n, 'img')
    src = im.attrs.get('data-src') or im.attrs.get('src')
    return {'src': src, 'alt': im.attrs.get('alt', '')}


def link(a, text=None):
    d = {'text': norm(a.text()) if text is None else text, 'href': a.attrs.get('href', '')}
    if a.attrs.get('aria-label'): d['aria'] = a.attrs['aria-label']
    if a.attrs.get('target') and a.attrs['target'] != '_self': d['target'] = a.attrs['target']
    return d


C = {}

# ---- head ------------------------------------------------------------------------------------------------
title = norm(first(R, 'title').text())
desc = re.search(r'<meta name="description" content="([^"]*)"', RAW).group(1)
lang = re.search(r'<html[^>]*\slang="([^"]+)"', RAW)
C['meta'] = {'lang': lang.group(1) if lang else 'en', 'title': title, 'description': html.unescape(desc), 'origin': ORIGIN, 'themeColor': '#BF3226', 'raw': RAW_NAME}
HEAD = RAW[:RAW.find('</head>')]
# the SEO head carried verbatim: canonical, robots, Open Graph, the site verification. Left out (with the reason in
# docs/CHANGE-LOG.md): the sgen_* CMS identity tags (the CMS writes its own head) and the old viewport (maximum-scale).
KEEP_META = ('robots', 'og:title', 'og:description', 'og:image', 'og:image:secure_url', 'google-site-verification')
C['meta']['head'] = [{'attr': m.group(1), 'key': m.group(2), 'content': html.unescape(m.group(3))}
                     for m in re.finditer(r'<meta\s+(property|name)="([^"]+)"\s+content="([^"]*)"\s*/?>', HEAD) if m.group(2) in KEEP_META]
C['meta']['canonical'] = re.search(r'<link rel="canonical" href="([^"]+)"', HEAD).group(1)
C['meta']['icon'] = re.search(r'<link rel="icon"[^>]*href="([^"]+)"', HEAD).group(1)

# ---- header / nav ------------------------------------------------------------------------------------------
skip = R.find(lambda x: x.tag == 'a' and 'skip-link' in x.cls())
C['skip'] = link(skip)
hdr = by_id('masterhead')
nav = hdr.find(lambda x: x.tag == 'nav')
logo_a = nav.find(lambda x: x.tag == 'a' and 'navbar-brand' in x.cls() and 'mobile-navbar-brand' not in x.cls())
C['header'] = {'logo': {'href': logo_a.attrs['href'], **img(logo_a)}}
ul = nav.find(lambda x: x.tag == 'ul' and 'navbar-nav' in x.cls())
items = []
for li in [k for k in ul.children() if k.tag == 'li']:
    a = li.find(lambda x: x.tag == 'a')
    if 'location-selector' in a.cls():
        C['header']['selectA'] = link(a)
        continue
    it = link(a)
    sub = li.find(lambda x: x.tag == 'ul' and x is not ul)
    if sub is not None:
        it['sub'] = [link(s) for s in sub.find_all(lambda x: x.tag == 'a')]
    items.append(it)
C['header']['nav'] = items
join = hdr.find(lambda x: x.tag == 'a' and x.attrs.get('href') == 'club-member-program/index.html')
C['header']['join'] = link(join)
short = hdr.find(lambda x: x.tag == 'a' and 'top-location-btn' in x.cls())
C['header']['selectShort'] = link(short)
burger = hdr.find(lambda x: x.tag == 'a' and x.attrs.get('href') == '#openNav-mobile')
C['header']['burgerAria'] = burger.attrs.get('aria-label', '')
mnav = by_id('mobile-nav')
C['header']['mobileNavAria'] = mnav.attrs.get('aria-label', '')

# ---- hero ------------------------------------------------------------------------------------------------
C['hero'] = {
    'title': norm(first(by_id('ixlxq'), 'h3').text()),
    'banner': img(by_id('i5yap')),
    'logo': img(by_id('iupjl')),
    'order': link(first(by_id('ikvuk'), 'a')),
    'cta': link(first(by_id('irb1g'), 'a')),
}

# ---- empty CMS slots (editor placeholders: kept in the markup, never rendered) ------------------------------------
slots = []
for n in R.find_all(lambda x: x.tag == 'div' and ('dl-content' in x.cls() or 'dl-heading' in x.cls())):
    slots.append({'id': n.attrs.get('id'), 'cls': [c for c in n.cls() if c in ('dl-content', 'dl-heading', 'sg-spacing-checkered')], 'placeholder': norm(n.text())})
C['cmsSlots'] = slots

# ---- locations: the card set #iabik (all 8 stores, correct data, Order Now) ------------------------------------
loc = {'title': norm(first(by_id('iaewp'), 'h2').text()), 'cards': []}
for card in by_id('sg-card-items-iabik').find_all(lambda x: x.tag == 'div' and 'sgFlex-component-card' in x.cls()):
    cover = card.find(lambda x: x.tag == 'a' and 'p' in x.cls())
    info = card.find(lambda x: 'info' in x.cls())
    content = info.find(lambda x: 'content' in x.cls())
    kids = content.children()
    h5 = [k for k in kids if k.tag == 'h5']; ps = [k for k in kids if k.tag == 'p']
    tel = ps[1].find(lambda x: x.tag == 'a')
    btn = card.find(lambda x: x.tag == 'a' and 'btn' in x.cls())
    loc['cards'].append({
        'name': lines(info.find(lambda x: 'title' in x.cls())),
        'href': cover.attrs['href'], 'aria': cover.attrs.get('aria-label', ''),
        'img': img(card.find(lambda x: 'thumbnail' in x.cls())),
        'addressLabel': norm(h5[0].text()), 'address': lines(ps[0]),
        'phoneLabel': norm(h5[1].text()), 'phone': link(tel),
        'hoursLabel': norm(h5[2].text()), 'hours': norm(ps[2].text()),
        'order': link(btn),
    })
C['locations'] = loc

# ---- deals: the reskin hides the block (d-none); the brief shows it -------------------------------------------
deals = {'title': norm(first(by_id('i730d'), 'h2').text()), 'cards': [], 'banners': []}
for it in by_id('slider-items-i2vx').find_all(lambda x: x.tag == 'div' and 'slider-item' in x.cls()):
    a = it.find(lambda x: x.tag == 'a' and 'p' in x.cls())
    sc = it.find(lambda x: 'slide-content' in x.cls())
    cap = sc.find(lambda x: 'caption' in x.cls())
    d = {'href': a.attrs['href'], 'aria': a.attrs.get('aria-label', ''), 'img': img(it.find(lambda x: 'thumb' in x.cls())),
         'heading': norm(first(sc, 'h4').text())}
    free = cap.find(lambda x: 'txtfree' in x.cls())
    d['free'] = norm(free.text()) if free is not None else None
    if cap.find(lambda x: x.tag == 'h3') is not None:      # M.I.JANE: brand line + weight
        d['brand'] = norm(first(cap, 'h3').text())
        d['weight'] = norm(cap.find(lambda x: x.tag == 'p').text())
    else:                                                  # 710Labs: "GET A FREE Battery"
        parts = []
        for k in cap.kids:
            if isinstance(k, str): parts.append(('t', norm(k)))
            elif 'txtfree' in k.cls(): continue
            elif 'pclr' in k.cls(): parts.append(('em', norm(k.text())))
        d['caption'] = [{'text': t, 'em': kind == 'em'} for kind, t in parts if t]
    deals['cards'].append(d)
mob = by_id('gallery-items-ifqek').find_all(lambda x: x.tag == 'a')
for k, iid in enumerate(['ifu1', 'in9q']):
    a = first(by_id(iid), 'a')
    deals['banners'].append({'href': a.attrs['href'], 'aria': a.attrs.get('aria-label', ''), 'img': img(a),
                             'mobile': {'href': mob[k].attrs['href'], 'aria': mob[k].attrs.get('aria-label', ''), 'img': img(mob[k])}})
C['deals'] = deals

# ---- join the society -----------------------------------------------------------------------------------------
dl_btn = first(by_id('i55o9'), 'a')
C['join'] = {'title': norm(first(by_id('idzvd'), 'h2').text()), 'text': norm(by_id('i0bio').text()),
             'cta': {'text': norm(dl_btn.text()), 'href': dl_btn.attrs.get('href', ''), 'hiddenTwin': link(first(by_id('igy6u'), 'a'))}}

# ---- staff picks: gallery #i88s (brand-search links) ---------------------------------------------------------------
C['picks'] = {'title': norm(first(by_id('i4lmf'), 'h2').text()),
              'items': [{'href': a.attrs['href'], 'aria': a.attrs.get('aria-label', ''), 'img': img(a)} for a in by_id('gallery-items-i88s').find_all(lambda x: x.tag == 'a')]}

# ---- where cannabis meets craftmanship (sections #ikvbl + #ig6ch) --------------------------------------------------
C['craft'] = {'title': lines(first(by_id('iivyk'), 'h2')), 'text': norm(by_id('ixdoj').text()),
              'logo': img(by_id('ivw17')), 'logoMobile': img(by_id('iexxa')),
              'about': link(first(by_id('id32f'), 'a')), 'menu': link(first(by_id('i6r77'), 'a')),
              'photos': [img(by_id('ih9k1')), img(by_id('ixda4'))]}

# ---- the app -------------------------------------------------------------------------------------------------
C['app'] = {'title': lines(first(by_id('itbf'), 'h2')), 'text': norm(by_id('irt3').text()),
            'cta': link(first(by_id('i3z27'), 'a')), 'img': img(by_id('iwfk')), 'bg': 'assets/pit-stop/pattern/carbon-panel.svg'}

# ---- reviews -------------------------------------------------------------------------------------------------
C['reviews'] = {'title': norm(first(by_id('i6vn5'), 'h2').text()), 'titlePhone': norm(first(by_id('i00b'), 'h2').text()),
                'badge': img(by_id('iqc8')), 'items': []}
for t in by_id('testimonial-items-ir0mp').find_all(lambda x: x.tag == 'div' and 'testimonial-item' in x.cls()):
    stars = len(t.find_all(lambda x: x.tag == 'span' and 'fa-star' in x.cls() and 'checked' in x.cls()))
    C['reviews']['items'].append({'text': norm(t.find(lambda x: 'content' in x.cls()).text()), 'name': norm(t.find(lambda x: 'name' in x.cls()).text()), 'stars': stars})

# ---- footer --------------------------------------------------------------------------------------------------
f_logo = first(by_id('iyp8'), 'a')
def iconlist(i):
    return [link(a) for a in by_id(i).find_all(lambda x: x.tag == 'a')]
C['footer'] = {
    'logo': {'href': f_logo.attrs['href'], 'aria': f_logo.attrs.get('aria-label', ''), **img(f_logo)},
    'quick': {'title': norm(first(by_id('i88b'), 'h4').text()), 'links': iconlist('iz8tj')},
    'locations': {'title': norm(first(by_id('ic4hc'), 'h4').text()), 'links': iconlist('i959r')},
    'store': {'title': norm(first(by_id('iw6oo'), 'h4').text()), 'slot': 'ieb8f'},
    'copyright': norm(by_id('idlti').text()),
    'legal': norm(by_id('i0lmq').text()), 'company': norm(by_id('iyokb').text()),
}

# ---- sticky action bar ------------------------------------------------------------------------------------------
bar = R.find(lambda x: 'sticky-mobile-ctas' in x.cls())
C['sticky'] = [{'text': norm(a.text()), 'href': a.attrs.get('href', '').strip()} for a in bar.find_all(lambda x: x.tag == 'a')]

# ---- the store chooser ("Select Location" sidebar popup) ------------------------------------------------------------
pop = R.find(lambda x: 'sgDispenzaLocation-sidebar-popup' in x.cls())
loc_close = pop.find(lambda x: x.tag == 'a' and 'cb' in x.cls())
stores = []
for it in pop.find_all(lambda x: x.tag == 'div' and 'item-loc-card' in x.cls()):
    cover = it.find(lambda x: x.tag == 'a' and 'p' in x.cls())
    name = it.find(lambda x: 'locationName' in x.cls())
    addr = it.find(lambda x: 'locationAddress' in x.cls() or 'address' in x.cls())
    tel = it.find(lambda x: x.tag == 'a' and 'locationPhone' in x.cls())
    btns = it.find_all(lambda x: x.tag == 'a' and 'btn' in x.cls())
    spans = addr.find_all(lambda x: x.tag == 'span') if addr is not None else []
    s = {'name': norm(name.text()), 'href': cover.attrs['href'], 'address': [norm(x.text()) for x in spans if norm(x.text())], 'phone': link(tel)}
    for b in btns:
        k = 'select' if 'btn--location-select' in b.cls() else 'shop' if 'btn--location-shop' in b.cls() else 'view' if 'btn--location-location' in b.cls() else None
        if k: s[k] = link(b)
    stores.append(s)
C['locator'] = {'title': norm(pop.find(lambda x: 't' in x.cls() and x.tag == 'span').text()), 'aria': pop.attrs.get('aria-label', ''),
                'closeAria': loc_close.attrs.get('aria-label', ''), 'closeHref': loc_close.attrs.get('href', ''), 'stores': stores}

# ---- the CMS popups (AJAX-loaded on the CMS: empty here, kept as slots) -------------------------------------------
C['popups'] = [{'id': n.attrs['id'], 'aria': n.attrs.get('aria-label', ''), 'title': norm(n.find(lambda x: 'sgpopup-title' in x.cls()).text()) if n.find(lambda x: 'sgpopup-title' in x.cls()) else None,
                'cls': [c for c in n.cls() if c != 'sgpopup']} for n in R.find_all(lambda x: x.tag == 'div' and 'sgpopup' in x.cls())]

# ---- age gate --------------------------------------------------------------------------------------------------
ag = R.find(lambda x: 'sg_age-verification' in x.cls())
ag_a = ag.find(lambda x: x.tag == 'a' and x.attrs.get('aria-label'))
info = ag.find(lambda x: 'info' in x.cls())
ps = [norm(p.text()) for p in info.find_all(lambda x: x.tag == 'p')]
yes = ag.find(lambda x: x.tag == 'a' and 'btn--yes' in x.cls()); no = ag.find(lambda x: x.tag == 'a' and 'btn--no' in x.cls())
C['ageGate'] = {'aria': ag.attrs.get('aria-label', ''), 'logo': {'href': ag_a.attrs['href'], 'aria': ag_a.attrs['aria-label'], 'alt': first(ag_a, 'img').attrs.get('alt', '')},
                'title': norm(first(info, 'h2').text()), 'lines': ps,
                'yes': link(yes), 'no': {**link(no), 'redirect': no.attrs.get('data-redirect', '')}}

# ---- what the build adds: UI labels only (brief: "small UI labels needed for navigation") -----------------------------
C['ui'] = {
    'prev': 'Prev', 'next': 'Next', 'close': 'Close', 'menu': 'Menu', 'readMore': 'Read more', 'readLess': 'Read less',
    'goTo': 'Go to', 'carouselLocations': 'Locations', 'carouselDeals': 'DEALS', 'carouselReviews': 'What Our Customers Say About Us',
    'toggleLocations': 'Show locations',
    'pauseMotion': 'Pause motion',   # the rolling store-name tickers' pause toggle (WCAG 2.2.2)
}

# ---- duplicates the brief collapses (read by parity.mjs) ----------------------------------------------------------
C['declaredDuplicates'] = [
    {'where': '#imz4h slider (7 stores)', 'why': 'every store shows the Big Rapids address "804 clark st, big rapids / mi 49307, united states" and phone; the brief: ONE set of 8 cards with the correct data'},
    {'where': '#iiwmg slider (7 stores, d-none)', 'why': 'hidden duplicate of the store set; alts: High Society in Birch Run, east lansing weed dispensary, big rapids weed store, High Society Charlotte, Lenox / Mount Pleasant / Saline Cannabis Weed Dispensary'},
    {'where': '#i584w slider (7 stores)', 'why': 'duplicate of the store set (no New Buffalo); alts "<store> dispensary location"'},
    {'where': '#iqq4g card set', 'why': 'second copy of the #iabik card set, identical text'},
    {'where': '#i9vl gallery', 'why': 'second Staff Picks gallery: its links point at other brands (MI Jane logo -> glo-stix) and carry stray words in the hrefs'},
    {'where': '#i00b heading', 'why': 'phone-only copy of the reviews heading ("Says"); the brief names "What Our Customers Say About Us"'},
    {'where': '#igy6u button (d-none)', 'why': 'hidden twin of "Join the Society Today" (href "#")'},
    {'where': '#mobile-nav', 'why': 'second copy of the nav for the phone sidebar; one nav serves both'},
    {'where': 'mobile brand logo', 'why': 'the header carries the lockup three times (desktop, phone, sidebar)'},
]

out = os.path.join(ROOT, 'src', 'content', 'home.json')
json.dump(C, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('home.json: %d nav items, %d store cards, %d deal cards + %d banners, %d picks, %d reviews, %d chooser stores, %d CMS slots, %d popups' % (
    len(C['header']['nav']), len(loc['cards']), len(deals['cards']), len(deals['banners']), len(C['picks']['items']), len(C['reviews']['items']), len(stores), len(slots), len(C['popups'])))
