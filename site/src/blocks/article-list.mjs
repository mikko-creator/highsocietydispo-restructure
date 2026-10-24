// article-list.mjs — the article-list block (contract §3.1; owner: the editorial lane) and the pieces the article and
// blog-index templates share with it: the typographic cover, the article card and the editorial labels.
//
//   block fields: heading?, lead?, posts ([slugs] | { category?, limit?, min? }), items (resolved articles: templates),
//                 layout? ('grid' | 'related'), level? (card title heading level), more? ({ text, href }),
//                 afterHtml? (template markup after the cards: the pager), ground?
//   posts.min: fewer articles than this and the block renders nothing (the home's "latest" band: structure map)
//
// THE COVER (no image file, nothing generated): the category's ground, one of the four Pit Stop patterns (checkered,
// carbon weave, diamond plate, pit box) chosen from the slug so a grid of one category still varies, v2's checkered
// strip on top, the trophy mark huge and faint, the category's name in Changa One and a race-number plate carrying the
// read time. Decorative (aria-hidden): the card and the page say the same things in text.
// Headings: a card title is an h3 under the block's h2; with no block heading it is an h2 (contract §2.8: no skips).
// Every word comes from the article JSON, site.json (ui, blog) or the blog page's own JSON (labels): never from here.
import { section, buttons } from './_kit.mjs';

export const PATTERNS = ['checker', 'carbon', 'diamond', 'pitbox'];

// FNV-1a over the key: a stable pattern per slug (deterministic: no clock, no randomness)
const fnv = (key) => { let h = 0x811c9dc5; for (const ch of String(key)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
export function patternOf(key) { return PATTERNS[fnv(key) % PATTERNS.length]; }
// a second, independent choice: the mirrored layout (plate and name at the right, the trophy at the left)
export function flipOf(key) { return (fnv('flip:' + key) & 1) === 1; }

// UI labels: site.json ui first (one place, contract §2.6); the blog page's own "labels" hold the ones core has not
// added yet (docs/requests/editorial.md). A label missing from both fails the build instead of printing "undefined".
export function label(ctx, key) {
  if (ctx.ui && ctx.ui[key] != null) return ctx.ui[key];
  const blog = ctx.pages && ctx.pages.get(ctx.site.blog.path);
  const v = blog && blog.labels ? blog.labels[key] : undefined;
  if (v == null) throw new Error(`UI label "${key}" is in neither site.json ui nor ${ctx.site.blog.path} labels`);
  return v;
}

const two = (n) => String(n).padStart(2, '0');

// the cover: size "card" | "feature" | "hero"; num/unit: the plate (default: the read time)
export function cover(a, ctx, { size = 'card', num, unit, pattern, flip } = {}) {
  const e = ctx.h.esc;
  const key = a.slug || a.category;
  const pat = pattern || patternOf(key);
  const mirror = flip != null ? flip : flipOf(key);
  return `<div class="cover cover--${e(a.category)} cover--${pat} cover--${size}${mirror ? ' cover--flip' : ''}" aria-hidden="true">`
    + `<span class="cover__pat"></span><span class="cover__mark"></span>`
    + `<span class="cover__plate"><span class="cover__num">${e(num != null ? num : two(a.readMinutes))}</span><span class="cover__unit">${e(unit != null ? unit : ctx.ui.minRead)}</span></span>`
    + `<span class="cover__cat">${e(a.categoryName)}</span>`
    + `</div>`;
}

// one article card. The whole card is the link (v2's cover-link). The meta line carries the category, the date and
// the read time: the category is shown by the cover (decorative), so the line keeps it for screen readers only; on
// phones, where the cover is a narrow strip with the read-time plate, the line shows the category and hides the time.
export function postCard(a, ctx, { level = 3, feature = false } = {}) {
  const e = ctx.h.esc;
  const tid = ctx.uid('post-' + a.slug);
  const lv = Math.min(6, Math.max(2, Number(level) || 3));
  return `<article class="post card card--lift${feature ? ' post--feature' : ''}" aria-labelledby="${tid}">
          ${cover(a, ctx, { size: feature ? 'feature' : 'card' })}
          <div class="post__body">
            <p class="post__meta"><span class="post__cat">${e(a.categoryName)}</span><span class="post__sep post__sep--cat" aria-hidden="true"></span><time datetime="${e(a.published)}">${e(a.dateText)}</time><span class="post__sep post__sep--mins" aria-hidden="true"></span><span class="post__mins">${e(a.readMinutes + ' ' + ctx.ui.minRead)}</span></p>
            <h${lv} class="post__title" id="${tid}"><a class="cover-link" href="${e(ctx.h.href(a.path))}">${e(a.h1)}</a></h${lv}>
            <p class="post__excerpt">${e(a.excerpt)}</p>
            <span class="post__go" aria-hidden="true">${e(ctx.ui.readArticle)}${ctx.h.icon('arrow', { size: 18 })}</span>
          </div>
        </article>`;
}

// the articles a block names: items (already resolved), posts: [slugs], or a query { category, limit } (newest first)
export function resolve(b, ctx) {
  if (Array.isArray(b.items)) return b.items;
  const all = ctx.articles;
  if (Array.isArray(b.posts)) {
    return b.posts.map((slug) => {
      const a = all.find((x) => x.slug === slug);
      if (!a) throw new Error('article-list: unknown post ' + slug);
      return a;
    });
  }
  const q = b.posts || {};
  return all.filter((a) => !q.category || a.category === q.category).slice(0, q.limit || 3);
}

// the cards as a list: layout "grid" (the blog listings: compact rows on phones) or "related" (1 to 4 across)
export function postList(items, ctx, { layout = 'grid', level = 3 } = {}) {
  const n = items.length;
  return `<ul class="posts posts--${layout} posts--n${Math.min(n, 4)}">
        ${items.map((a) => `<li class="posts__item">${postCard(a, ctx, { level })}</li>`).join('\n        ')}
      </ul>`;
}

// the empty state: the UI line, and a way back to every article unless this is already the blog home
export function emptyState(ctx) {
  const e = ctx.h.esc, B = ctx.site.blog;
  const back = ctx.page.path !== B.path && !ctx.page.path.startsWith(B.path + 'p/')
    ? buttons([{ text: ctx.ui.allArticles, href: B.path, style: 'ghost' }], ctx, { size: 'lg' }) : '';
  return `<div class="posts__none"><p>${e(ctx.ui.noArticles)}</p>${back}</div>`;
}

export function render(b, ctx) {
  const items = resolve(b, ctx);
  const q = !Array.isArray(b.posts) && b.posts ? b.posts : {};
  if (q.min && items.length < q.min) return '';
  const layout = b.layout === 'related' ? 'related' : 'grid';
  const level = b.level || (b.heading ? 3 : 2);
  const inner = items.length ? postList(items, ctx, { layout, level }) : (b.more ? '' : emptyState(ctx));
  const more = b.more ? buttons([{ text: b.more.text, href: b.more.href, style: 'ghost' }], ctx, { size: 'lg' }) : '';
  return section(b, ctx, inner + more + (b.afterHtml || ''), { cls: 'posts-band posts-band--' + layout });
}
