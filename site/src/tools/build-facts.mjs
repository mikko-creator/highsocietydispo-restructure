#!/usr/bin/env node
// build-facts.mjs — write facts/client-facts.json: where each claim on the rebuilt homepage comes from. One source:
//   live   the reskin homepage as served, audit/raw/client-highsocietydispo-reskin-index.html.html (fetched 2026-10-21)
// Nothing here is authored: values are read from src/content/home.json, which prove-content.py proves string by string
// against that page. The reviews are declared as testimonials (sr-fabrication traces every <blockquote>/<figure> to a
// declared source) with the exact text the page carries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const c = J('src/content/home.json');
const RAW = fs.readFileSync(path.join(ROOT, 'audit', 'raw', c.meta.raw), 'utf8');
const LIVE = 'reskin homepage, audit/raw/' + c.meta.raw + ' (fetched 2026-10-21)';
const URL_ = 'https://sgencms.github.io/client-highsocietydispo-reskin/index.html';
const onPage = (s) => { const squash = (x) => x.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ''); return squash(RAW).includes(squash(s)); };
const must = (s) => { if (!onPage(s)) throw new Error('not on the reskin page, refusing to declare: ' + s); return s; };

const cards = c.locations.cards;
const facts = {
  schema: 'site-reforge/client-facts@1',
  note: 'Declared facts. ONLY facts recorded here or present in audit/content-inventory.json may appear as claims on the rebuild. Written by src/tools/build-facts.mjs; every entry names its source and was checked against the raw page.',
  legalName: '',
  brand: 'High Society',
  phone: [...new Set([...cards.map((k) => must(k.phone.text)), ...c.locator.stores.map((s) => must(s.phone.text))])],
  email: [],
  addresses: [
    ...cards.map((k) => ({ text: k.name.join(' ') + ': ' + k.address.map(must).join(', '), source: LIVE })),
    ...c.locator.stores.map((s) => ({ text: s.name + ' (store chooser): ' + s.address.map(must).join(', '), source: LIVE })),
  ],
  hours: cards.map((k) => ({ store: k.name.join(' '), day: must(k.hoursLabel), time: must(k.hours), source: LIVE })),
  licences: [],
  certifications: [],
  awards: [],
  statistics: [{ text: must(c.reviews.badge.alt), context: 'the Google rating badge image (img1.webp); its figures are printed in the picture, not in page text', source: LIVE }],
  testimonials: c.reviews.items.map((r) => ({ text: must(r.text), author: must(r.name), rating: r.stars, source: LIVE, url: URL_ })),
  clients: [],
  guarantees: [],
  pricing: [
    ...c.deals.cards.map((d) => ({ text: [d.heading, ...(d.caption || []).map((x) => x.text), d.free, d.brand, d.weight].filter(Boolean).map(must).join(' '), source: LIVE })),
    ...c.deals.banners.map((b) => ({ text: must(b.img.alt), context: 'flower deal banner (the price is printed in the picture)', source: LIVE })),
  ],
  services: [],
  uiLabels: { source: 'added by the rebuild as interface labels, no claim content', text: c.ui },
};
fs.mkdirSync(path.join(ROOT, 'facts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'facts', 'client-facts.json'), JSON.stringify(facts, null, 1));
console.log(`client-facts.json: ${facts.phone.length} phones, ${facts.addresses.length} addresses, ${facts.hours.length} hours, ${facts.testimonials.length} testimonials, ${facts.pricing.length} price claims — every entry checked against the raw page`);
