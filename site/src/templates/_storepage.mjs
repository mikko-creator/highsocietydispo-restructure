// _storepage.mjs — what the stores lane's templates share (stores lane, 2026-10-24): the page = core's hero band
// (src/templates/_shell.mjs) + the page's blocks, with the lane's TEMPLATE PARTS placed between blocks, + JSON-LD.
// Not a template (the build loads only src/templates/<a-z…>.mjs).
//
// Template parts are page-JSON fields the templates draw themselves (they are not contract block types), each placed
// before the block whose "id" it names ("before": "<block id>"; a part naming no block, or a block id that does not
// exist, fails the build):
//   visiting  { before, heading, lead (md), label, tabs: [{ label, title, md }] }           directions from landmarks
//   routes    { before, heading, lead (md), label, items: [{ title, links: [...] }], more? } area route cards
//   form      { before, heading, lead (md), slotId, ctas? }                                 the CMS's empty widget slot
// The words of every part come from the page JSON.
import { crumbs, hero, pageLd } from './_shell.mjs';
import { storeOf, telHref, ctaRow } from '../blocks/_stores.mjs';

const partHead = (P, ctx, id) => `<header class="block__head"><h2 class="block__title" id="${id}">${ctx.inline(P.heading)}</h2>${P.lead ? `<div class="block__lead md">${ctx.md(P.lead)}</div>` : ''}</header>`;

// directions from the store's landmarks: tabs (stores.js) over panels; without scripts every panel shows, one after the
// other, and the tab row is not drawn
function visiting(P, ctx) {
  const id = ctx.uid('visiting'), lid = ctx.uid('visiting-label'), e = ctx.h.esc;
  const tabs = P.tabs.map((t) => ({ ...t, key: ctx.uid('dir-' + ctx.h.slug(t.label)) }));
  return `<section class="block block--visiting theme-${P.ground || 'headlight'}" aria-labelledby="${id}">
  <div class="block__inner">
    ${partHead(P, ctx, id)}
    <div class="vtabs" data-tabs>
      <p class="vtabs__label" id="${lid}">${e(P.label)}</p>
      <div class="vtabs__list" role="tablist" aria-labelledby="${lid}">
        ${tabs.map((t, i) => `<button class="vtabs__tab" type="button" role="tab" id="${t.key}-tab" aria-controls="${t.key}" aria-selected="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}>${ctx.h.icon('pin', { size: 16 })}${e(t.label)}</button>`).join('\n        ')}
      </div>
      ${tabs.map((t) => `<div class="vtabs__panel" role="tabpanel" id="${t.key}" aria-labelledby="${t.key}-tab" tabindex="0">
        <h3 class="vtabs__title">${ctx.inline(t.title)}</h3>
        <div class="vtabs__body md">${ctx.md(t.md)}</div>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

// route cards for a store's service areas (New Buffalo): each area's title and its three actions
function routes(P, ctx, page) {
  const id = ctx.uid('routes'), e = ctx.h.esc;
  const s = page.store ? storeOf(page.store, ctx) : null;
  return `<section class="block block--routes theme-${P.ground || 'headlight'}" aria-labelledby="${id}">
  <div class="block__inner">
    ${partHead(P, ctx, id)}
    ${P.label ? `<p class="routes__label">${e(P.label)}</p>` : ''}
    <ul class="routes">
      ${P.items.map((r) => {
        const rid = ctx.uid('route-' + ctx.h.slug(r.title));
        return `<li class="routes__item"><article class="routes__card card" aria-labelledby="${rid}">
        <span class="routes__mark" aria-hidden="true">${ctx.h.icon('pin', { size: 22 })}</span>
        <h3 class="routes__title" id="${rid}">${e(r.title)}</h3>
        ${r.md ? `<div class="routes__text md">${ctx.md(r.md)}</div>` : ''}
        ${ctaRow(r.links, ctx, { s, b: { mapsUrl: P.mapsUrl }, size: 'sm', cls: 'routes__ctas' })}
      </article></li>`;
      }).join('\n      ')}
    </ul>
    ${P.more ? `<p class="routes__more"><a class="textlink" href="${e(ctx.h.href(P.more.href))}">${e(P.more.text)}${ctx.h.icon('arrow', { size: 18 })}</a></p>` : ''}
  </div>
</section>`;
}

// the CMS's login / sign-up widget slot (empty on this static copy, as on the live page until the widget loads)
function form(P, ctx) {
  const id = ctx.uid('form-' + ctx.h.slug(P.heading));
  return `<section class="block block--form theme-${P.ground || 'black'}" aria-labelledby="${id}">
  <div class="block__inner sform">
    ${partHead(P, ctx, id)}
    <div class="cms-slot sform__slot" id="${ctx.h.esc(P.slotId)}" data-cms-slot></div>
    ${ctaRow(P.ctas, ctx, { size: 'lg' })}
  </div>
</section>`;
}

// the loyalty FAQ: core's FAQ markup and behaviour (.acc.faq, data-accordion, FAQPage JSON-LD), plus answers that end in
// a short list. High Society prints its perks answer as one run of words ("Members enjoy perks like:Exclusive
// discountsPersonalized offers…", a CMS list that lost its markup): here the items are list items set as lines (inline
// elements, so the words keep High Society's order and spacing), and the JSON-LD answer reads them as a sentence.
function faq(P, ctx) {
  const id = ctx.uid('blk-' + ctx.h.slug(P.heading)), e = ctx.h.esc;
  ctx.jsonld(ctx.ld.faq(P.items.map((it) => ({ q: it.q, a: it.list ? `${it.a} ${it.list.join(', ')}` : it.a }))));
  const answer = (it) => {
    const html = ctx.md(it.a);
    if (!it.list) return html;
    if (!/<\/p>$/.test(html)) throw new Error('faq part: an answer with a list must end in a paragraph');
    return html.replace(/<\/p>$/, `<span class="faqlist" role="list">${it.list.map((x) => `<span class="faqlist__item" role="listitem">${ctx.inline(x)}</span>`).join('')}</span></p>`);
  };
  return `<section class="block block--faq theme-${P.ground || 'white'}" aria-labelledby="${id}">
  <div class="block__inner">
    ${partHead(P, ctx, id)}
    <div class="acc faq" data-accordion>
      ${P.items.map((it) => `<details class="acc__item faq__item">
        <summary class="acc__q faq__q"><span class="faq__qtext">${ctx.inline(it.q)}</span><span class="acc__icon" aria-hidden="true">${ctx.h.icon('plus', { size: 22 })}</span></summary>
        <div class="acc__a faq__a md">${answer(it)}</div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

const PARTS = { visiting, routes, form, faq };

// the blocks in order, each template part drawn before the block it names. The blocks whose "id" (page JSON) other
// pages link to also carry it as their band's element id: /dispensary-locations/<store>/#first-visit, #order-pickup,
// #faq (docs/structure-map.json: /dispensary-guides/ and /faq/), whatever the band's heading says. Only these: the
// shared CSS and scripts style and drive v2's home sections by id (#reviews: sections/08-reviews.css and .js), so
// another block id on a band would pull those in. Fails closed: a block that does not render as one <section> stops
// the build.
const ANCHORS = new Set(['first-visit', 'order-pickup', 'faq']);
export function body(page, ctx, { grounds } = {}) {
  const list = page.blocks || [];
  const parts = Object.keys(PARTS).filter((k) => page[k]).map((k) => ({ k, P: page[k] }));
  for (const { k, P } of parts) {
    if (!P.before || !list.some((b) => b.id === P.before)) throw new Error(`${page.path}: part "${k}" names no block to sit before ("before": ${JSON.stringify(P.before)})`);
  }
  const seen = new Set();
  const out = [];
  list.forEach((b, i) => {
    for (const { k, P } of parts) if (P.before === b.id) out.push(PARTS[k](P, ctx, page));
    const r = ctx.blockRenderers[b.type];
    if (!r) throw new Error('unknown block type "' + b.type + '" on ' + page.path);
    let html = r({ ...b }, { ...ctx, ground: b.ground || (grounds ? grounds[i % grounds.length] : 'white') });
    if (b.id && ANCHORS.has(b.id)) {
      if (seen.has(b.id)) throw new Error(`${page.path}: block id "${b.id}" is used twice`);
      seen.add(b.id);
      if (!/^\s*<section\s/.test(html)) throw new Error(`${page.path}: block "${b.id}" (${b.type}) does not render as a <section>, so it cannot carry its anchor`);
      html = html.replace(/^(\s*<section)\s/, `$1 id="${ctx.h.esc(b.id)}" `);
    }
    out.push(html);
  });
  return out.join('\n');
}

// the page hero (core's band) with the stores lane's additions after the CTAs: the store's open/closed line (stores.js
// fills it from the hours; nothing shows without scripts) and its address and phone
export function storeHeroExtra(page, ctx) {
  const H = page.hero || {};
  const note = H.note ? `<div class="shero__note">${ctx.md(H.note)}</div>` : '';
  if (!page.store) return note;
  const s = storeOf(page.store, ctx), e = ctx.h.esc;
  const st = H.status ? `<p class="shero__status" data-store-status data-opens="${e(s.hours.opens)}" data-closes="${e(s.hours.closes)}" data-open-text="${e(H.status.open)}" data-closed-text="${e(H.status.closed)}" hidden></p>` : '';
  const facts = H.facts === false ? '' : `<ul class="shero__facts">
      <li>${ctx.h.icon('pin', { size: 18 })}${H.mapsUrl ? `<a href="${e(ctx.h.href(H.mapsUrl))}" target="_blank" rel="noopener">${e(s.address.lines.join(', '))}</a>` : e(s.address.lines.join(', '))}</li>
      <li>${ctx.h.icon('phone', { size: 18 })}<a href="${e(ctx.h.href(telHref(s)))}">${e(s.phone.text)}</a></li>
      <li>${ctx.h.icon('clock', { size: 18 })}<span>${e(s.hours.days)} ${e(s.hours.text)}</span></li>
    </ul>`;
  return note + st + facts;
}

export function renderStorePage(page, ctx, meta, { heroCls = '', extraLd = [], grounds } = {}) {
  const c = crumbs(page, ctx);
  const heroHtml = hero(page, ctx, { crumbsHtml: c.html, after: storeHeroExtra(page, ctx), cls: heroCls });
  const main = `${heroHtml}
<div class="page__body spage spage--${ctx.h.esc(meta.name)}" data-template="${ctx.h.esc(meta.name)}">
${body(page, ctx, { grounds })}
</div>`;
  return { main, mainClass: `page page--${meta.name}`, jsonld: [...pageLd(page, ctx, c.items), ...extraLd] };
}
