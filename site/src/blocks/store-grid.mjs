// store-grid block (stores lane): the stores as the v2 home's location cards (its Locations section's language): the
// store's own race-day scene, the name in Changa One, the address / telephone / hours facts with v2's labels, the red
// "Order Now" and a ghost second action. Every fact from site.json "stores" (D-nap).
//
//   { type: "store-grid", stores: "all" | [slugs], heading?, lead?, ground? (default black),
//     to: "location" | "shop"        what the card (its name) links to (default "location")
//     primary?: { text, to: "shop" | "location" }   the red button (default: the store's own "Order Now" -> its shop page)
//     secondary?: { text, to }        a ghost button (e.g. "View Location")
//     titleTag?: "h3"                 the card name's level (h3 under the block heading; h2 when the block has none) }
import { section } from './_kit.mjs';
import { storeOf, telHref } from './_stores.mjs';

const FOCUS_X = {   // v2's own crop focus per scene (src/sections/02-locations.mjs): every store's sign stays whole
  'assets/pit-stop/img/scene-birch-run.jpg': '88%', 'assets/pit-stop/img/scene-east-lansing.jpg': '70%',
  'assets/pit-stop/img/scene-big-rapids.jpg': '25%', 'assets/pit-stop/img/scene-charlotte.jpg': '92%',
  'assets/pit-stop/img/scene-lenox.jpg': '84%', 'assets/pit-stop/img/scene-mount-pleasant.jpg': '97.5%',
  'assets/pit-stop/img/scene-saline.jpg': '100%', 'assets/pit-stop/img/scene-new-buffalo.jpg': '32%',
};
export const focusX = (src) => FOCUS_X[src] || '50%';

export function storeCard(s, ctx, { to = 'location', primary, secondary, titleTag = 'h3', cls = '' } = {}) {
  const e = ctx.h.esc;
  const nid = ctx.uid('sg-' + s.slug);
  const dest = (t) => (t === 'shop' ? s.shopPath : s.locationPath);
  const P = primary || { text: s.labels.order, to: 'shop' };
  const btn = (c, style) => `<a class="btn btn--${style} btn--sm" href="${e(ctx.h.href(dest(c.to)))}" aria-describedby="${nid}">${e(c.text)}</a>`;
  return `<li class="sg__item${cls ? ' ' + cls : ''}">
        <article class="sg__card card card--lift" aria-labelledby="${nid}">
          <div class="sg__media media" style="--fx:${focusX(s.image.src)}">${ctx.h.img(s.image.src, { alt: s.image.alt || '', sizes: '(min-width: 1280px) 400px, (min-width: 768px) 46vw, 100vw' })}</div>
          <div class="sg__body">
            <${titleTag} class="sg__name" id="${nid}"><a class="cover-link" href="${e(ctx.h.href(dest(to)))}">${e(s.name)}</a></${titleTag}>
            <dl class="sg__facts">
              <div class="sg__fact"><dt>${e(s.labels.address)}</dt><dd>${s.address.lines.map(e).join('<br>')}</dd></div>
              <div class="sg__fact"><dt>${e(s.labels.phone)}</dt><dd><a class="sg__tel" href="${e(ctx.h.href(telHref(s)))}">${e(s.phone.text)}</a></dd></div>
              <div class="sg__fact"><dt>${e(s.hours.days)}</dt><dd>${e(s.hours.text)}</dd></div>
            </dl>
            <div class="sg__ctas">${btn(P, 'primary')}${secondary ? btn(secondary, 'ghost') : ''}</div>
          </div>
        </article>
      </li>`;
}

export function render(b, ctx) {
  const list = b.stores === 'all' || !b.stores ? ctx.site.stores : b.stores.map((x) => storeOf(x, ctx));
  // no block heading: the store names are the band's headings (h2), so the outline never skips a level
  const titleTag = b.heading ? (b.titleTag || 'h3') : 'h2';
  return section({ ground: 'black', ...b }, ctx, `<ul class="sg sg--${list.length > 4 ? 'many' : 'few'}">
      ${list.map((s) => storeCard(s, ctx, { to: b.to, primary: b.primary, secondary: b.secondary, titleTag })).join('\n      ')}
    </ul>`);
}
