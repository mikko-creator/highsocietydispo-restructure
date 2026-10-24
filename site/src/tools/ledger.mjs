#!/usr/bin/env node
// ledger.mjs — record the change-control decision for every section row the skill's ledger tool found on the reskin
// homepage (sr-plan reads the page's heading tree: 12 rows), through sr-plan --set, in the homepage-scoped workspace.
// Every kept row is IMPROVE (content word for word, layout changed). The one REMOVE is the phone-only duplicate heading,
// with its reason. A row this file cannot place stops the run.
//
//   node src/tools/ledger.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOME = path.join(ROOT, 'home');
const SR = process.env.SR_ROOT || (console.error('Set SR_ROOT to the site-reforge scripts directory: this repo ships no machine path.'), process.exit(2));
const plan = (...args) => execFileSync('node', [path.join(SR, 'sr-plan.mjs'), '--project', HOME, ...args], { encoding: 'utf8' });

if (!fs.existsSync(path.join(HOME, 'audit', 'change-control.json'))) plan();
const ledger = JSON.parse(fs.readFileSync(path.join(HOME, 'audit', 'change-control.json'), 'utf8'));
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'content', 'home.json'), 'utf8'));
const craft = c.craft.title.join(' '), app = c.app.title.join(' ');

// label -> [decision, rebuiltAs, narrative slot, why]
const rule = (label) => {
  const L = (label || '').trim();
  if (L === c.hero.title) return ['IMPROVE', '01 hero', 'value-proposition', 'The first screen: flat brand red with the checkered band at its foot (brief); the heading becomes the page H1 (Changa One), the hero art (banner_logo + Layer_13_copy) on a tone-on-tone disc, "Order Now" and "CALL TO ACTION" as its two actions.'];
  if (L === c.locations.title) return ['IMPROVE', '02 locations', 'trust-positioning', 'One set of the 8 stores with their correct data (brief), from the card set #iabik; the four duplicate store sets of the reskin are collapsed (docs/CHANGE-LOG.md). Desktop 4-up carousel, phones 1-up swipe with a counter; the header\'s "Select a Location" as the section action.'];
  if (L === c.deals.title) return ['IMPROVE', '03 deals', 'benefits-solution', 'The reskin hid the whole block (d-none); the brief shows it: the 710Labs and M.I.JANE offers as red cards and the two flower banners as one card (desktop art + phone art in one <picture>); 3-up on desktop, a swipe carousel on phones.'];
  if (L === c.deals.cards[1].brand) return ['IMPROVE', '03 deals — M.I.JANE card', 'benefits-solution', 'The brand line of the M.I.JANE offer card ("B2G1 / Free / M.I. JANE / 3.5G"), kept word for word inside its card.'];
  if (L === c.join.title) return ['IMPROVE', '04 join', 'strategic-cta', 'A bold banner on black with the carbon weave and checkered edges (brief); the line and "Join the Society Today"; the reskin\'s own Join photo framed beside the copy instead of behind it.'];
  if (L === c.picks.title) return ['IMPROVE', '05 picks', 'benefits-solution', 'Four equal logo tiles in one row (phones 2×2), each linking to its brand search; the second, mis-linked gallery #i9vl is collapsed.'];
  if (L === craft) return ['IMPROVE', '06 craft', 'trust-positioning', 'An editorial split: the HS logo art and the product photo beside the heading, the full paragraph and both "learn more" links (About Us, Menu).'];
  if (L === app) return ['IMPROVE', '07 app', 'strategic-cta', 'Two columns: the heading, the full paragraph and "Download Now" beside the app phone image; stacked and compact on phones.'];
  if (L === c.reviews.title) return ['IMPROVE', '08 reviews', 'social-proof', 'All 8 reviews verbatim with their names in a carousel (3-up desktop, 1-up phones) with the Google Rating badge; fixed card height with "Read more" opening inside the card (brief). The reviews are declared in facts/client-facts.json.'];
  if (L === c.reviews.titlePhone) return ['REMOVE', '08 reviews (heading)', 'social-proof', 'The reskin\'s phone-only duplicate of the reviews heading (d-md-none), worded "Says"; the brief names "What Our Customers Say About Us", which is kept once for every screen size.'];
  if (L === c.ageGate.title) return ['IMPROVE', 'global — age gate', 'objection-handling', 'The age gate (logo, the question, both lines, both buttons) kept as a modal shown on a first visit and remembered; without scripts the page is never blocked.'];
  if (/sgFlex-component-tmp-section/.test(L)) return ['IMPROVE', '08 reviews (wrapper)', 'social-proof', 'The CMS wrapper section that holds the reviews block (#ihzxt): its content is the reviews row above.'];
  return null;
};

let set = 0; const unplaced = [];
for (const r of ledger.rows) {
  const x = rule(r.label);
  if (!x) { unplaced.push(r.id + ' ' + JSON.stringify(r.label)); continue; }
  plan('--set', r.id, '--decision', x[0], '--as', x[1], '--slot', x[2], '--why', x[3]);
  set++;
}
if (unplaced.length) { console.error('rows with no decision rule:\n  ' + unplaced.join('\n  ')); process.exit(1); }
console.log(`ledger: ${set} of ${ledger.rows.length} homepage rows decided`);

// The skill's ledger reads <section>/<article>/<aside> and the H2/H3 tree; the reskin's footer is a <footer> landmark
// with h4 titles, so it gets no row and the required footer slot reads unmapped. It is a real section of the source,
// kept whole by the rebuild: record its row here, only if the raw page carries it (sr-plan keeps rows it did not make).
{
  const L = JSON.parse(fs.readFileSync(path.join(HOME, 'audit', 'change-control.json'), 'utf8'));
  const rawFile = fs.readdirSync(path.join(HOME, 'audit', 'raw')).find((f) => f.endsWith('.html'));
  const raw = fs.readFileSync(path.join(HOME, 'audit', 'raw', rawFile), 'utf8');
  const tag = (/<footer id="masterfoot">/.exec(raw) || [])[0];
  if (!tag) { console.error('the raw homepage has no <footer id="masterfoot">: no footer row written'); process.exit(1); }
  const page = L.rows[0];
  const id = page.url.replace(/^https?:\/\//, '') + '#footer';
  const row = {
    id, url: page.url, pageType: page.pageType, index: L.rows.filter((r) => r.id !== id).length + 1,
    label: [c.footer.quick.title, c.footer.locations.title, c.footer.store.title].join(' · '),
    sourceTag: 'footer', sourceClass: 'masterfoot', decision: 'IMPROVE', narrativeSlot: 'footer', presetId: '', rebuiltAs: '09 footer',
    why: 'The reskin\'s footer (logo, Quick Links, Locations, Your Store with its CMS slot, copyright, the two legal lines) kept word for word on black under the checkered band and the red store-name band; compact 3-column link grids on phones, the whole footer within one screen.',
    evidence: 'audit/raw/' + rawFile + ': ' + tag,
    addedBy: 'src/tools/ledger.mjs (a <footer> landmark is outside sr-plan\'s <section>/H2/H3 scan)',
  };
  L.rows = L.rows.filter((r) => r.id !== id).concat(row); L.rowCount = L.rows.length; L.updated = new Date().toISOString();
  fs.writeFileSync(path.join(HOME, 'audit', 'change-control.json'), JSON.stringify(L, null, 2));
  console.log('ledger: footer row recorded (' + tag + ' in the raw page) -> IMPROVE, slot footer');
}
try { process.stdout.write(plan('--check').split('\n').slice(-8).join('\n') + '\n'); }
catch (e) { process.stdout.write(String(e.stdout || '').split('\n').slice(-8).join('\n') + '\n'); process.exit(1); }
