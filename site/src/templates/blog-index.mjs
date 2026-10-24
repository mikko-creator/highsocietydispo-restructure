// blog-index.mjs — the blog home, its category pages and their pagination (/blog/, /blog/p/N/, /blog/<category>/,
// /blog/<category>/p/N/). Owner: the editorial lane. The build passes page.listing = { category, pageNum, pageCount,
// items, basePath } (12 per page, newest first). Sections, in the structure map's order:
//   blog home      breadcrumb, hero (title + intro), featured (the newest article, page 1 only), categories (chips with
//                  counts), the grid + pager, resources (the blog page's own blocks)
//   category page  breadcrumb, hero (title + intro), categories (this one current), the grid + pager
// Headings: h1 (hero) > h2 (Featured, the grid's title, each block) > h3 (card titles): no level is skipped.
// The hero's right-hand panel (wide screens) is a decorative cover: the category's ground and pattern, the article count.
// Words: the page JSON (title, h1, hero, blocks), site.json (blog, ui) and the blog page's labels; never this file.
// JSON-LD: CollectionPage + ItemList, BreadcrumbList.
import { crumbs, blocks } from './_shell.mjs';
import { postCard, postList, emptyState, cover, label, PATTERNS } from '../blocks/article-list.mjs';

export const meta = { name: 'blog-index', owner: 'editorial', stub: false };

function chips(L, ctx, counts) {
  const e = ctx.h.esc, B = ctx.site.blog;
  const n = (k) => (k ? `<span class="catchip__n"><span class="visually-hidden">(</span>${k}<span class="visually-hidden">)</span></span>` : '');
  const chip = (text, path, current, count) => `<li><a class="catchip${count ? '' : ' catchip--empty'}" href="${e(ctx.h.href(path))}"${current ? ' aria-current="page"' : ''}><span class="catchip__t">${e(text)}</span>${n(count)}</a></li>`;
  return `<nav class="catchips" aria-label="${e(ctx.ui.categories)}" data-chips>
      <ul class="catchips__list">
        ${chip(ctx.ui.allArticles, B.path, !L.category, ctx.articles.length)}
        ${B.categories.map((k) => chip(k.name, B.path + k.slug + '/', L.category === k.slug, counts.get(k.slug))).join('\n        ')}
      </ul>
    </nav>`;
}

// pages. Wide screens: the first, the last, the current and two either side. Phones (one 44px row): the first, the
// current and the last, Newer and Older for the neighbours. Each window draws its own gap marks (an ellipsis where
// numbers are left out), so a phone never shows "1 3 4" with the 2 silently missing.
function pager(L, ctx) {
  if (L.pageCount < 2) return '';
  const e = ctx.h.esc, ui = ctx.ui, cur = L.pageNum, N = L.pageCount;
  const href = (n) => ctx.h.href(n === 1 ? L.basePath : `${L.basePath}p/${n}/`);
  const inRange = (n) => n >= 1 && n <= N;
  const wide = [...new Set([1, N, cur - 2, cur - 1, cur, cur + 1, cur + 2])].filter(inRange).sort((a, b) => a - b);
  const narrow = new Set([1, cur, N]);
  const gap = (cls) => `<li class="pager__gap${cls}" aria-hidden="true">…</li>`;
  const cells = [];
  let prevWide = 0, prevNarrow = 0;
  for (const n of wide) {
    const onPhone = narrow.has(n);
    const gapWide = n - prevWide > 1, gapNarrow = onPhone && n - prevNarrow > 1;
    if (gapWide || gapNarrow) cells.push(gap(gapWide && gapNarrow ? '' : gapWide ? ' pager__gap--wide' : ' pager__gap--narrow'));
    const cls = onPhone ? '' : ' pager__item--wide';
    cells.push(n === cur
      ? `<li class="pager__item"><span class="pager__n" aria-current="page"><span class="visually-hidden">${e(ui.page)} </span>${n}</span></li>`
      : `<li class="pager__item${cls}"><a class="pager__n" href="${e(href(n))}"><span class="visually-hidden">${e(ui.page)} </span>${n}</a></li>`);
    prevWide = n;
    if (onPhone) prevNarrow = n;
  }
  const step = (n, rel, text, icon, after) => `<li class="pager__item pager__item--step"><a class="pager__step" href="${e(href(n))}" rel="${rel}">${after ? '' : ctx.h.icon(icon, { size: 18 })}<span>${e(text)}</span>${after ? ctx.h.icon(icon, { size: 18 }) : ''}</a></li>`;
  return `<nav class="pager" aria-label="${e(ui.pagination)}">
      <ul class="pager__list">
        ${cur > 1 ? step(cur - 1, 'prev', ui.newer, 'left', false) : ''}
        ${cells.join('\n        ')}
        ${cur < N ? step(cur + 1, 'next', ui.older, 'right', true) : ''}
      </ul>
    </nav>`;
}

export function render(page, ctx) {
  const L = page.listing, e = ctx.h.esc, ui = ctx.ui, B = ctx.site.blog;
  const cat = L.category ? B.categories.find((k) => k.slug === L.category) : null;
  const isHome = !cat, first = L.pageNum === 1;
  const c = crumbs(page, ctx);
  const counts = new Map(B.categories.map((k) => [k.slug, ctx.articles.filter((a) => a.category === k.slug).length]));
  const total = cat ? counts.get(cat.slug) : ctx.articles.length;

  // the hero: the shell's band (ink ground, trophy mark, checkered foot); the eyebrow is the blog's name; the intro on
  // the first page only (later pages are lists); a decorative cover at the right on wide screens
  const H = page.hero || {};
  const k = isHome ? 0 : B.categories.indexOf(cat) + 1;
  const panel = cover({ slug: page.path, category: cat ? cat.slug : 'blog', categoryName: cat ? cat.name : B.name }, ctx,
    { size: 'hero', num: String(total).padStart(2, '0'), unit: label(ctx, total === 1 ? 'articleOne' : 'articleMany'), pattern: PATTERNS[k % PATTERNS.length], flip: false });
  const hero = `<section class="page-hero theme-black page-hero--compact blog-hero" aria-labelledby="page-title">
  <div class="page-hero__bg" aria-hidden="true"><span class="page-hero__mark"></span></div>
  <div class="page-hero__inner blog-hero__inner">
    <div class="blog-hero__copy">
      ${c.html}
      <p class="eyebrow page-hero__eyebrow">${e(H.eyebrow || B.name)}</p>
      <h1 class="page-hero__title blog-hero__title" id="page-title">${e(page.h1)}</h1>
      ${first && H.lead ? `<div class="page-hero__lead blog-hero__lead">${ctx.md(H.lead)}</div>` : ''}
    </div>
    <div class="blog-hero__panel">${panel}</div>
  </div>
  <div class="checker page-hero__checker" aria-hidden="true"></div>
</section>`;

  // featured: the newest article, on the blog home's first page
  const items = L.items;
  const feature = isHome && first && items.length ? items[0] : null;
  const rest = feature ? items.slice(1) : items;
  const featured = feature ? (() => {
    const id = ctx.uid('blk-featured');
    return `<section class="block block--article-list posts-band posts-band--feature theme-white" aria-labelledby="${id}">
  <div class="block__inner">
    <header class="block__head"><h2 class="block__title posts-band__label" id="${id}">${e(label(ctx, 'featured'))}</h2></header>
    ${postCard(feature, ctx, { level: 3, feature: true })}
  </div>
</section>`;
  })() : '';

  // the categories and the grid share one band: the chips filter what follows. With nothing left to list (one article,
  // featured above) the band keeps the chips and drops the empty grid.
  const gid = ctx.uid('blk-articles');
  const gridTitle = cat ? `${label(ctx, 'inCategory')} ${cat.name}` : (feature ? label(ctx, 'moreArticles') : ui.allArticles);
  const list = rest.length
    ? `<header class="block__head"><h2 class="block__title" id="${gid}">${e(gridTitle)}</h2></header>
    ${postList(rest, ctx, { layout: 'grid', level: 3 })}
    ${pager(L, ctx)}`
    : (feature ? '' : `<header class="block__head"><h2 class="block__title" id="${gid}">${e(gridTitle)}</h2></header>
    ${emptyState(ctx)}`);
  const grid = `<section class="block block--article-list posts-band posts-band--grid theme-headlight"${list ? ` aria-labelledby="${gid}"` : ''}>
  <div class="block__inner">
    ${chips(L, ctx, counts)}
    ${list}
  </div>
</section>`;

  // the blog home's own blocks (structure map: resources) on every page of the blog home
  const more = isHome ? blocks(page.blocks, ctx, { grounds: ['white'] }) : '';

  return {
    main: `${hero}
<div class="page__body blog" data-template="blog-index">
${featured}
${grid}
${more}
</div>`,
    mainClass: 'page page--blog-index',
    jsonld: [
      ctx.ld.collection({ name: page.h1, path: page.path, description: page.metaDescription, items: items.map((a) => ({ path: a.path, name: a.h1 })) }),
      ctx.ld.breadcrumbs(c.items),
    ],
  };
}
