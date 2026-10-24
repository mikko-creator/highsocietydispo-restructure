// seo.mjs — head tags and JSON-LD builders. Node builtins only, no state. Copy is never typed here: every name,
// address and sentence comes from site.json / the page JSON the caller passes in.
//
//   headTags({ title, description, canonical, robots, ogType, ogImage, siteName, extra }) -> '<title>…<meta …>' lines
//   jsonLdScript(nodes)   -> one <script type="application/ld+json"> holding {"@context", "@graph": nodes}, serialized
//                            safely: "<", ">", "&", U+2028 and U+2029 escaped as \uXXXX, so no string in it can end
//                            the script element or break the JSON
//   ld.organization(site) ld.website(site) ld.breadcrumbs(items, site) ld.store(store, site) ld.article(a, site)
//   ld.faq(items) ld.collection({ name, path, description, items }, site) ld.recipe(recipe, article, site)
//   ld.webPage({ name, path, description }, site)

import { canonical as canon, ORIGIN } from './route.mjs';
import { plainText } from './md.mjs';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ESC[c]);

export const ROBOTS_INDEX = 'index, follow, max-image-preview:large';

export function headTags({ title, description, canonical, robots = ROBOTS_INDEX, ogType = 'website', ogImage, siteName, extra = [] }) {
  if (!title) throw new Error('seo.headTags: no title');
  if (!description) throw new Error('seo.headTags: no description for ' + title);
  const meta = (attr, key, content) => `<meta ${attr}="${esc(key)}" content="${esc(content)}">`;
  const out = [
    `<title>${esc(title)}</title>`,
    meta('name', 'description', description),
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    meta('name', 'robots', robots),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:type', ogType),
    canonical ? meta('property', 'og:url', canonical) : '',
    ogImage ? meta('property', 'og:image', ogImage) : '',
    siteName ? meta('property', 'og:site_name', siteName) : '',
    meta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary'),
    ...extra.map((t) => meta(t.attr, t.key, t.content)),
  ];
  return out.filter(Boolean).join('\n');
}

// JSON for a <script> element: nothing inside can close the element or start a comment/CDATA
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028').replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}
export function jsonLdScript(nodes) {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  if (!list.length) return '';
  return `<script type="application/ld+json">${safeJson({ '@context': 'https://schema.org', '@graph': list })}</script>`;
}

const abs = (u) => (/^https?:\/\//.test(u) ? u : ORIGIN + '/' + String(u).replace(/^\/+/, ''));
const orgId = () => ORIGIN + '/#organization';
const siteId = () => ORIGIN + '/#website';

export const ld = {
  organization(site) {
    return {
      '@type': 'Organization', '@id': orgId(), name: site.brand.name, url: ORIGIN + '/',
      logo: { '@type': 'ImageObject', url: abs(site.brand.logoFile) },
    };
  },
  website(site) {
    return {
      '@type': 'WebSite', '@id': siteId(), url: ORIGIN + '/', name: site.brand.name, publisher: { '@id': orgId() },
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: ORIGIN + '/search/?q={search_term_string}' }, 'query-input': 'required name=search_term_string' },
    };
  },
  webPage({ name, path, description }) {
    return { '@type': 'WebPage', '@id': canon(path) + '#webpage', url: canon(path), name, description, isPartOf: { '@id': siteId() } };
  },
  breadcrumbs(items) {
    return {
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.path ? { item: canon(it.path) } : {}) })),
    };
  },
  // a store: Store is a LocalBusiness. No geo unless site.json knows it (it does not today).
  store(s, site) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return {
      '@type': 'Store', '@id': canon(s.locationPath) + '#store', name: s.legalName || `${site.brand.name} ${s.name}`,
      url: canon(s.locationPath), telephone: s.phone.text,
      image: s.imageFile ? abs(s.imageFile) : undefined,
      address: { '@type': 'PostalAddress', streetAddress: s.address.street, addressLocality: s.address.locality, addressRegion: s.address.region, postalCode: s.address.postalCode, addressCountry: 'US' },
      openingHoursSpecification: s.hours && s.hours.opens ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: s.hours.opens, closes: s.hours.closes }] : undefined,
      ...(s.geo ? { geo: { '@type': 'GeoCoordinates', latitude: s.geo.lat, longitude: s.geo.lng } } : {}),
      parentOrganization: { '@id': orgId() },
    };
  },
  article(a, site) {
    return {
      '@type': 'Article', '@id': canon(a.path) + '#article', headline: a.h1 || a.title, description: a.metaDescription,
      datePublished: a.published, dateModified: a.updated || a.published,
      author: { '@type': 'Organization', name: site.brand.name, url: ORIGIN + '/' },
      publisher: { '@id': orgId() },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canon(a.path) },
      image: a.image ? abs(a.image) : abs(site.brand.ogImageFile),
      articleSection: a.categoryName,
    };
  },
  faq(items) {
    return {
      '@type': 'FAQPage',
      mainEntity: items.map((it) => ({ '@type': 'Question', name: plainText(it.q), acceptedAnswer: { '@type': 'Answer', text: plainText(it.a) } })),
    };
  },
  collection({ name, path, description, items }) {
    return {
      '@type': 'CollectionPage', '@id': canon(path) + '#collection', url: canon(path), name, description,
      isPartOf: { '@id': siteId() },
      mainEntity: { '@type': 'ItemList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: canon(it.path), name: it.name })) },
    };
  },
  recipe(r, a, site) {
    const dur = (s) => {
      // "15 minutes", "1 hour 30 minutes", "2 hrs" -> ISO 8601 (PT1H30M); anything else is left out, never guessed
      const t = String(s || '').toLowerCase(); if (!t) return undefined;
      const h = /(\d+)\s*(h|hr|hrs|hour|hours)\b/.exec(t), m = /(\d+)\s*(m|min|mins|minute|minutes)\b/.exec(t);
      if (!h && !m) return undefined;
      return 'PT' + (h ? h[1] + 'H' : '') + (m ? m[1] + 'M' : '');
    };
    return {
      '@type': 'Recipe', '@id': canon(a.path) + '#recipe', name: a.h1 || a.title, description: a.metaDescription,
      author: { '@type': 'Organization', name: site.brand.name }, datePublished: a.published,
      image: a.image ? abs(a.image) : abs(site.brand.ogImageFile),
      recipeYield: r.yield || undefined, prepTime: dur(r.prepTime), cookTime: dur(r.cookTime),
      recipeIngredient: (r.ingredients || []).map(plainText),
      recipeInstructions: (r.steps || []).map((s) => ({ '@type': 'HowToStep', text: plainText(s) })),
    };
  },
};
