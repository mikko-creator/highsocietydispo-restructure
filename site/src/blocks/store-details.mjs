// store-details block (stores lane): one store's details as the v2 home's ink store panel (#0B0C0C, a hairline that
// turns red on hover, Changa One name, red labels), optionally beside the store's own "about" text.
//
//   { type: "store-details", store: "<slug>", heading?, lead?, ground?,
//     name?          the panel's title in High Society's words ("High Society Weed Dispensary"); default "High Society <Name>"
//     nameTag?       "h3" (default) or "p"
//     facts?         which rows, in order: "hours" | "address" | "email" | "phone" | {icon, text} (default hours, address, phone)
//     hoursText?     High Society's wording of the hours ("Open Daily: 9:00 AM - 9:00 PM"); must agree with site.json
//     addressText?   High Society's wording of the address; must agree with site.json (street number + ZIP)
//     addressLines?  true: the address as site.json's two lines (default: one line, addressText or the lines joined)
//     phoneLabel?, hoursLabel?, addressLabel?, emailLabel?   a visible label before a row (default: icon only, with a
//                    visually hidden one from site.json ui where it has one)
//     email?         the store's email (High Society's own pages: info@highsocietydispo.com)
//     mapsUrl?       High Society's own Google Maps link for the store (the address links to it; "maps" in ctas)
//     ctas?          [{ text, href ("shop" | "maps" | "tel" | "location" | a site path | https), style?, icon? }]
//     social?        [{ network: "facebook" | "instagram", href, label }]
//     note?          one line of Markdown under the rows
//     about?         { heading, md, links?: [{ text, href }], linksLabel? }  the column beside the panel }
import { section } from './_kit.mjs';
import { storeOf, telHref, checkAddressText, checkHoursText, ctaRow, plate } from './_stores.mjs';

export function render(b, ctx) {
  const s = storeOf(b.store, ctx), e = ctx.h.esc, where = `${ctx.page.path} store-details`;
  const nameId = ctx.uid('sd-' + s.slug);
  const facts = b.facts || ['hours', 'address', 'phone'];
  const label = (txt, fallback) => (txt ? `<span class="sd__label">${e(txt)}</span> ` : fallback ? `<span class="visually-hidden">${e(fallback)} </span>` : '');
  const row = (f) => {
    if (typeof f === 'object') return `<li class="sd__row">${plate(f.icon || 'check', ctx, 18)}<span class="sd__val">${ctx.inline(f.text)}</span></li>`;
    if (f === 'hours') {
      const t = b.hoursText ? checkHoursText(s, b.hoursText, where) : `${s.hours.days} ${s.hours.text}`;
      return `<li class="sd__row">${plate('clock', ctx, 18)}<span class="sd__val">${label(b.hoursLabel, ctx.ui.hoursLabel)}${e(t)}</span></li>`;
    }
    if (f === 'address') {
      const t = b.addressText ? checkAddressText(s, b.addressText, where) : null;
      const inner = t ? e(t) : b.addressLines === false ? e(s.address.lines.join(', ')) : s.address.lines.map(e).join('<br>');
      const val = b.mapsUrl ? `<a class="sd__link" href="${e(ctx.h.href(b.mapsUrl))}" target="_blank" rel="noopener">${inner}</a>` : inner;
      return `<li class="sd__row">${plate('pin', ctx, 18)}<span class="sd__val">${label(b.addressLabel, '')}${val}</span></li>`;
    }
    if (f === 'email') {
      if (!b.email) throw new Error(where + ': "email" row without an email');
      return `<li class="sd__row">${plate('mail', ctx, 18)}<span class="sd__val">${label(b.emailLabel, '')}<a class="sd__link" href="${e(ctx.h.href('mailto:' + b.email))}">${e(b.email)}</a></span></li>`;
    }
    if (f === 'phone') return `<li class="sd__row">${plate('phone', ctx, 18)}<span class="sd__val">${label(b.phoneLabel, ctx.ui.call)}<a class="sd__link" href="${e(ctx.h.href(telHref(s)))}">${e(s.phone.text)}</a></span></li>`;
    throw new Error(where + ': unknown fact "' + f + '"');
  };
  const social = (b.social || []).length ? `<ul class="sd__social">${b.social.map((x) => `<li><a class="sd__soc" href="${e(ctx.h.href(x.href))}" target="_blank" rel="noopener" aria-label="${e(x.label)}">${ctx.h.icon(x.network, { size: 20 })}</a></li>`).join('')}</ul>` : '';
  // the panel's name is the band's heading when the block has none (h2), so the outline never skips a level
  const nameTag = b.nameTag === 'p' ? 'p' : b.heading ? 'h3' : 'h2';
  const panel = `<div class="sd__panel theme-black">
        <${nameTag} class="sd__name" id="${nameId}">${e(b.name || `${ctx.site.brand.name} ${s.name}`)}</${nameTag}>
        <ul class="sd__rows">${facts.map(row).join('')}</ul>
        ${b.note ? `<div class="sd__note md">${ctx.md(b.note)}</div>` : ''}
        ${ctaRow(b.ctas, ctx, { s, b, size: 'sm', cls: 'sd__ctas', describedBy: nameTag !== 'p' ? nameId : '' })}
        ${social}
      </div>`;
  const A = b.about;
  const about = A ? `<div class="sd__about">
        ${A.heading ? `<h3 class="sd__about-title">${ctx.inline(A.heading)}</h3>` : ''}
        <div class="md">${ctx.md(A.md)}</div>
        ${(A.links || []).length ? `<nav class="sd__more" aria-label="${e(A.linksLabel || A.heading || s.name)}"><ul>${A.links.map((l) => `<li><a href="${e(ctx.h.href(l.href))}">${e(l.text)}${ctx.h.icon('arrow', { size: 16 })}</a></li>`).join('')}</ul></nav>` : ''}
      </div>` : '';
  return section(b, ctx, `<div class="sd${A ? ' sd--split' : ''}">
      ${panel}
      ${about}
    </div>`);
}
