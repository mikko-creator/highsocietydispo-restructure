// h.mjs — the helpers every section renderer gets. Copy never lives here: it comes from
// src/content/home.json. These only escape, link, and emit images/icons consistently.
//
// Multi-page (core, 2026-10-24): the helpers are made PER PAGE. `page` is the page's site path ("/", "/blog/x/"); every
// asset URL carries the page's root prefix ("" on the home, "../../" two levels down), so v2's home output keeps its
// "assets/x.webp" URLs byte for byte, and the same section code works on any page. Links:
//   - v2 hrefs ("loyalty/index.html", "index.html") become clean site paths (route.fromV2) and then page-relative
//     URLs ("loyalty/" on the home, "../loyalty/" from /about/); a site path ("/deals/") the same
//   - "#x", "", CMS tokens ({{location_shop_url}}, with or without a query) and http(s)/tel:/mailto: stay verbatim
//   - every site path a page links to is reported to onLink(path) so the build can prove it exists (or is pending)
// absolute: true (404.html only, served at any depth) writes root-relative URLs ("/assets/x", "/deals/") instead.

import { fromV2, rel, depth, normalize } from './route.mjs';

export function makeHelpers({ content, images, origin, page = '/', absolute = false, onLink = null }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const root = absolute ? '/' : '../'.repeat(depth(page));
  // a file the build ships ("assets/x.webp", "styles/site.css") from this page
  const asset = (file) => root + String(file).replace(/^\.?\/+/, '');
  // a site path ("/deals/") as a URL from this page; recorded for the link check
  const link = (sitePath) => {
    const p = normalize(sitePath);
    if (onLink) onLink(p);
    return absolute ? p : rel(page, p);
  };

  // Every link lands where the reskin's does: v2 paths and site paths are made page-relative; CMS tokens such as
  // {{location_shop_url}} stay verbatim (the CMS fills them; on this static site the store chooser answers them).
  // Anything else (javascript:, data:, vbscript:, "//host", a bare relative path) fails the build: fail closed.
  const href = (u) => {
    if (u === undefined || u === null) throw new Error('link without an href');
    const s = fromV2(String(u).trim());
    if (s.startsWith('/') && !s.startsWith('//')) return link(s);
    // a CMS token counts only at the start ({{location_shop_url}}?query): one anywhere else would let any scheme through
    if (s === '' || /^#[^\s"'<>`]*$/.test(s) || /^\{\{[a-z0-9_]+\}\}[^\s"'<>`\\]*$/i.test(s) || /^(?:https?:\/\/|mailto:)[^\s"'<>`\\]+$/i.test(s) || /^tel:\+?[0-9().\- ]+$/i.test(s)) return s;
    throw new Error('unsafe or unknown href (allowed: a site path, #id, a CMS token, https/http, mailto, tel): ' + JSON.stringify(String(u)));
  };

  const attrs = (o = {}) => Object.entries(o)
    .filter(([, v]) => v !== false && v !== null && v !== undefined)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');

  // <a> from a {text, href, target} link object. External tabs get rel=noopener.
  const a = (link, { cls = '', inner = null, extra = {} } = {}) => {
    const t = link.target === '_blank';
    return `<a${attrs({ class: cls || false, href: href(link.href), target: t ? '_blank' : false, rel: t ? 'noopener' : false, ...extra })}>${inner ?? esc(link.text)}</a>`;
  };

  // <img> from a LIVE url: local WebP variants, srcset, intrinsic width/height (no layout shift).
  // priority: the one image that should jump the queue (the hero); eager alone only skips lazy-loading
  const img = (url, { alt = '', sizes = '100vw', cls = '', eager = false, priority = false, extra = {} } = {}) => {
    const rec = images[url];
    if (!rec) throw new Error('image not in src/content/images.json (run optimize-images.py): ' + url);
    const v = rec.variants;
    const last = v[v.length - 1];
    const srcset = !rec.svg && v.length > 1 ? v.map((x) => `${root}assets/${x.file} ${x.w}w`).join(', ') : false;
    return `<img${attrs({
      class: cls || false, src: root + 'assets/' + last.file, srcset, sizes: srcset ? sizes : false,
      width: rec.width, height: rec.height, alt,
      loading: eager ? 'eager' : 'lazy', decoding: 'async', fetchpriority: priority ? 'high' : false, ...extra,
    })}>`;
  };
  const imgFile = (url, w = Infinity) => {
    const rec = images[url];
    if (!rec) throw new Error('image not in images.json: ' + url);
    const v = rec.variants.find((x) => x.w >= w) || rec.variants[rec.variants.length - 1];
    return root + 'assets/' + v.file;
  };

  // A heading in the display face. parts: a string, or an array of the live heading's lines (the live <br>s).
  const title = (parts, { tag = 'h2', cls = '', id = '' } = {}) => {
    const inner = Array.isArray(parts) ? parts.map(esc).join('<br>') : esc(parts);
    return `<${tag}${attrs({ class: ('title ' + cls).trim(), id: id || false })}>${inner}</${tag}>`;
  };

  // Art direction (brief: "art-directed crops for mobile"): the desktop picture from `media` up, the phone picture
  // below it. Both are the live page's own files; the <img> carries the phone file and the alt.
  const picture = (desktopUrl, mobileUrl, { media = '(min-width: 768px)', alt = '', sizes = '100vw', mobileSizes = '100vw', cls = '', eager = false, priority = false, extra = {} } = {}) => {
    const d = images[desktopUrl], m = images[mobileUrl];
    if (!d || !m) throw new Error('picture: image not in images.json: ' + (!d ? desktopUrl : mobileUrl));
    const set = (rec) => rec.variants.map((x) => `${root}assets/${x.file} ${x.w}w`).join(', ');
    const dl = d.variants[d.variants.length - 1];
    // a phone file with an AVIF twin (optimize-images.py) is offered as a typed source after the desktop one: browsers
    // that read AVIF take it, the others the <img>'s WebP
    // (m.avif: one file at the record's width, or a list of {w, file} variants)
    const avifSet = !m.avif ? '' : Array.isArray(m.avif) ? m.avif.map((x) => `${root}assets/${x.file} ${x.w}w`).join(', ') : `${root}assets/${m.avif} ${m.width}w`;
    const avif = m.avif ? `<source${attrs({ type: 'image/avif', srcset: avifSet, sizes: mobileSizes, width: m.width, height: m.height })}>` : '';
    return `<picture><source${attrs({ media, srcset: set(d), sizes, width: d.width, height: d.height })}>${avif}${img(mobileUrl, { alt, sizes: mobileSizes, cls, eager, priority, extra })}</picture>`;
  };

  const ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h11"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    bag: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    leaf: '<path d="M12 21V11M12 11C12 6 9 3 12 2c3 1 0 4 0 9ZM12 13c-3-3-7-3-9-2 1 3 5 5 9 2ZM12 13c3-3 7-3 9-2-1 3-5 5-9 2Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    spark: '<path d="M12 2c.6 4.8 2.2 6.9 7 7.5-4.8.6-6.4 2.7-7 7.5-.6-4.8-2.2-6.9-7-7.5 4.8-.6 6.4-2.7 7-7.5Z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    brush: '<path d="M14 4l6 6-7.5 7.5-6-6Z"/><path d="M6.5 11.5c-2 0-3.5 1.5-3.5 4 0 1.6-.6 2.6-1 3.5 3 .5 6.5-.5 7.5-3.5"/>',
    wave: '<path d="M2 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/><path d="M2 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>',
    check: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    stars: '<path d="M8 3c.4 3 1.4 4.2 4.4 4.6C9.4 8 8.4 9.2 8 12.2 7.6 9.2 6.6 8 3.6 7.6 6.6 7.2 7.6 6 8 3Z"/><path d="M17 11c.3 2.3 1.1 3.2 3.4 3.5-2.3.3-3.1 1.2-3.4 3.5-.3-2.3-1.1-3.2-3.4-3.5 2.3-.3 3.1-1.2 3.4-3.5Z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.3 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.6 7.4h.01"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    cart: '<path d="M3 4h2.2l2.2 11h10.4l2-8H6.6"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  };
  const SOLID = {
    facebook: '<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/>',
    tiktok: '<path d="M16.6 2h-3.4v13.4a3.1 3.1 0 1 1-3.1-3.1c.3 0 .6 0 .9.1V8.9a6.6 6.6 0 1 0 5.6 6.5V8.6a8.2 8.2 0 0 0 4.8 1.5V6.7a4.8 4.8 0 0 1-4.8-4.7Z"/>',
    'star-solid': '<path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z"/>',
    x: '<path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z"/>',
    youtube: '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3-5.2 3Z"/>',
    yelp: '<path d="M11.2 3.3 7 4.6c-.5.2-.7.7-.5 1.2l3.7 6.3c.4.7 1.5.4 1.5-.4V3.8c0-.4-.2-.6-.5-.5ZM10 14.2l-4.4 1c-.5.1-.8.6-.7 1.1l.9 3c.2.5.8.7 1.2.3l3.6-4.2c.4-.5 0-1.3-.6-1.2Zm2.2 1.3-.1 4.6c0 .5.4.9.9.8l3.1-.7c.5-.1.8-.7.5-1.2l-3.1-3.9c-.4-.5-1.3-.3-1.3.4Zm1.3-2.2 4.3 1.6c.5.2 1 -.1 1.1-.6l.5-3.1c.1-.5-.4-1-.9-.8l-4.9 1.4c-.7.2-.7 1.2-.1 1.5Z"/>',
  };
  const icon = (name, { size = 20, cls = '' } = {}) => {
    if (SOLID[name]) return `<svg class="icon icon--${name} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${SOLID[name]}</svg>`;
    if (!ICONS[name]) throw new Error('unknown icon ' + name);
    return `<svg class="icon icon--${name} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
  };

  // Rich text from the content model (p / b / strong / i / em / a / ul / li / br, extracted from the live page by
  // build-content.py); hrefs resolved like every other link, and a link that opens a new tab gets rel=noopener.
  const rich = (html) => String(html || '')
    .replace(/href="([^"]*)"/g, (m, u) => `href="${esc(href(u.replace(/&amp;/g, '&')))}"`)
    .replace(/<a ([^>]*target="_blank"[^>]*)>/g, (m, a) => (/\srel=/.test(' ' + a) ? m : `<a ${a} rel="noopener">`));

  // an empty CMS slot of the reskin page ("Please add a content..." in the editor): the element stays, with its id, so
  // the CMS can fill it; it is empty, so it draws nothing and takes no space (.cms-slot:empty)
  const slot = (id) => {
    const s = (content.cmsSlots || []).find((x) => x.id === id);
    if (!s) throw new Error('no CMS slot ' + id + ' in home.json');
    return `<div class="cms-slot ${s.cls.join(' ')}" id="${s.id}" data-cms-slot></div>`;
  };

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return { esc, href, link, asset, root, page, attrs, a, img, imgFile, picture, slot, title, icon, rich, slug, icons: Object.keys(ICONS).concat(Object.keys(SOLID)) };
}
