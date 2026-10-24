// _stores.mjs — what the stores lane's blocks share (stores lane, 2026-10-24). Not a block (the build loads only
// src/blocks/<a-z…>.mjs): store lookup, the store's own links, the fact rows, icons on plates, a CTA row.
//
// Store data (name, address, phone, hours) comes from site.json "stores" ONLY (decision D-nap: one value per store).
// A page may print High Society's own wording of a fact (its "addressText" / "hoursText"), but the wording must agree
// with site.json (street number, ZIP, opening and closing times), or the build fails: no page can drift from D-nap.

export const storeOf = (slug, ctx) => {
  const s = ctx.site.stores.find((x) => x.slug === slug);
  if (!s) throw new Error('unknown store "' + slug + '" (site.json stores)');
  return s;
};

// a tel: URL from the store's number: digits only, +1 prefix (every store number is a US number)
export const telHref = (s) => {
  const d = String(s.phone.text).replace(/\D/g, '');
  if (d.length !== 10) throw new Error('store ' + s.slug + ': phone "' + s.phone.text + '" is not a 10-digit US number');
  return 'tel:+1' + d;
};

// the store's shop page filtered by a menu category: High Society's own link form on its v1 store pages
// (/shop/<store>/?dtche[category]=flower); the category query is read by the CMS menu on highsocietydispo.com
export const shopCategoryHref = (s, dtche) => (dtche ? `${s.shopPath}?dtche%5Bcategory%5D=${encodeURIComponent(dtche)}` : s.shopPath);

const norm = (t) => String(t).replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
// High Society's wording of the address must name the same street number and ZIP as site.json
export function checkAddressText(s, text, where) {
  const num = s.address.street.split(' ')[0];
  if (!norm(text).includes(norm(num)) || !norm(text).includes(norm(s.address.postalCode))) {
    throw new Error(`${where}: addressText "${text}" disagrees with site.json ${s.slug} (${s.address.lines.join(', ')})`);
  }
  return text;
}
// … and the hours wording the same opening and closing times
export function checkHoursText(s, text, where) {
  const [open, close] = String(s.hours.text).split(/\s+[-–]\s+/);
  const t = norm(text).replace(/\s+/g, '');
  if (!open || !close || !t.includes(norm(open).replace(/\s+/g, '')) || !t.includes(norm(close).replace(/\s+/g, ''))) {
    throw new Error(`${where}: hoursText "${text}" disagrees with site.json ${s.slug} hours (${s.hours.text})`);
  }
  return text;
}

// an icon on the brand's small red plate
export const plate = (name, ctx, size = 20) => `<span class="splate" aria-hidden="true">${ctx.h.icon(name, { size })}</span>`;

// a button row: [{ text, href, style?, icon?, locator?, external? }]; "maps" / "tel" / "shop" / "location" as href take
// the store's own link (b.mapsUrl, the store's phone, its shop page, its location page)
export function resolveHref(href, s, b) {
  if (href === 'maps') { if (!b.mapsUrl) throw new Error('a "maps" link needs mapsUrl on the block'); return b.mapsUrl; }
  if (href === 'tel') { if (!s) throw new Error('a "tel" link needs a store'); return telHref(s); }
  if (href === 'shop') { if (!s) throw new Error('a "shop" link needs a store'); return s.shopPath; }
  if (href === 'location') { if (!s) throw new Error('a "location" link needs a store'); return s.locationPath; }
  return href;
}
export function ctaRow(ctas, ctx, { s = null, b = {}, size = 'sm', cls = '', describedBy = '' } = {}) {
  if (!ctas || !ctas.length) return '';
  const e = ctx.h.esc;
  return `<div class="sbtns${cls ? ' ' + cls : ''}">${ctas.map((c, i) => {
    const href = resolveHref(c.href, s, b);
    const style = c.style || (i ? 'ghost' : 'primary');
    const ext = /^https?:/i.test(href);
    return `<a class="btn btn--${style} btn--${size}" href="${e(ctx.h.href(href))}"${ext ? ' target="_blank" rel="noopener"' : ''}${c.locator ? ' data-locator-open aria-haspopup="dialog"' : ''}${c.category ? ` data-shop-category="${e(c.category)}"` : ''}${describedBy ? ` aria-describedby="${e(describedBy)}"` : ''}>${c.icon ? ctx.h.icon(c.icon, { size: 18 }) : ''}${e(c.text)}</a>`;
  }).join('\n')}</div>`;
}
