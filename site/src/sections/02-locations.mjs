// 02-locations.mjs — Locations, in the reskin's own store-panel language (RESKIN-STYLE §Sections 2): an ink band, the
// eight stores (the reskin's card set #iabik: photos, location pages, click-to-call phones, hours, "Order Now") as
// #0B0C0C panels with a hairline that turns red on hover and a photo that zooms a little. The owner's layout E
// (2026-10-22, "Store picker"): a list of the eight store names picks the store shown in ONE big panel.
//   - from 1024px: the list on the left; the panel (photo left 1.45fr, details right) beside it, its top edge on the
//     list's top edge; the race number and "Select a Location" share the top row (owner: "align in a single row"), the
//     title under them; under the panel the pager: arrows and the counter (1/8).
//   - portrait tablets: the list as a row of tabs over one wide card, photo on top.
//   - phones: the tabs over one card a page (the next card's peek), photo on top; the counter beside the title, the
//     action and the arrows share the thumb row under the card.
// The list's buttons are the carousel's picker (site.js [data-pick]); the dots it replaces are not drawn. Without
// scripts the list is not drawn (the row scrolls). Source order = reading order: head, action, list, cards, pager.
// Every word comes from home.json (the list repeats the stores' own names); the only added words are c.ui labels and
// the counter site.js writes.

export const meta = { id: 'locations', order: 2, label: 'Locations' };

// the rendered width of the photo FILE (object-fit: cover scales it past its box): the desktop panel's photo shows
// 60–100% of the photo's width (the file a little wider than its box); phones and tablets show nearly all of it
// (very tall desktops, 1000px and up, draw the panel taller with the store list: the photo paints ~960px wide there)
const SIZES = '(min-width: 1180px) and (min-height: 1000px) 960px, (min-width: 1180px) 720px, (min-width: 1024px) 560px, calc(100vw - 58px)';   // phones: the card's photo box is 100vw - 58px

// art direction, not copy: the object-position across each store photo, so every crop keeps the store's own sign whole.
// Measured lettering spans (percent of the photo's width, labs/restyle/02-locations/sign-*.png): Birch Run banner
// 50–92 (gantry 3–31); East Lansing sign 39–80 (gantry letters 12–23); Big Rapids HIGH SOCIETY 41–55 (gantry banner
// 68–100); Charlotte sign 49–86 (tent letters 29–35); Lenox sign 66–85; Mount Pleasant fascia 54–79 + gantry letters
// 82–98 (H box 30–37); Saline sign 57–95 (gantry letters 20–39); New Buffalo gantry letters 18–34 + fascia 43–62.
// Each value holds the main sign (and any second sign it can) whole in BOTH crop families the CSS allows: the
// desktop panels (47–60% of the width visible) and the phone cards (93–100%), proved in labs/restyle/02-locations/crop-sim.png.
const FOCUS_X = {
  'assets/pit-stop/img/scene-birch-run.jpg': '88%',
  'assets/pit-stop/img/scene-east-lansing.jpg': '70%',
  'assets/pit-stop/img/scene-big-rapids.jpg': '25%',
  'assets/pit-stop/img/scene-charlotte.jpg': '92%',
  'assets/pit-stop/img/scene-lenox.jpg': '84%',
  'assets/pit-stop/img/scene-mount-pleasant.jpg': '97.5%',
  'assets/pit-stop/img/scene-saline.jpg': '100%',
  'assets/pit-stop/img/scene-new-buffalo.jpg': '32%',
};

// the store shown first, at every width (owner, 2026-10-22: "use Lennox as the first store on mobile", then "do the same
// on desktop"; the client named its storefront the most realistic of the eight): its card and its tab lead the list,
// the other seven keep the reskin's order. Only this section's order changes (the header's Locations menu, the
// footer and the store chooser keep theirs)
const FIRST = 'Lenox';

export function render(c, h) {
  const L = c.locations;
  const isFirst = (s) => s.name.join(' ') === FIRST;
  const cards = [...L.cards.filter(isFirst), ...L.cards.filter((s) => !isFirst(s))];
  const S = c.header.selectA;
  const card = (s, i) => {
    const nid = `locations-name-${i + 1}`;
    return `<li class="locations__item reveal" id="locations-card-${i + 1}" style="--i:${Math.min(i, 3)};--fx:${FOCUS_X[s.img.src] || '50%'}">
          <article class="locations__card card card--lift">
            <div class="locations__media media">${h.img(s.img.src, { alt: s.img.alt, sizes: SIZES })}</div>
            <div class="locations__info">
              <h3 class="locations__name" id="${nid}"><a class="cover-link" href="${h.esc(h.href(s.href))}">${s.name.map((w) => `<span class="locations__nl">${h.esc(w)}</span>`).join(' ')}</a></h3>
              <div class="locations__foot">
                <dl class="locations__facts">
                  <div class="locations__fact locations__fact--addr"><dt>${h.esc(s.addressLabel)}</dt><dd>${s.address.map(h.esc).join('<br>')}</dd></div>
                  <div class="locations__fact locations__fact--tel"><dt>${h.esc(s.phoneLabel)}</dt><dd><a class="locations__tel" href="${h.esc(h.href(s.phone.href))}">${h.esc(s.phone.text)}</a></dd></div>
                  <div class="locations__fact locations__fact--hours"><dt>${h.esc(s.hoursLabel)}</dt><dd>${h.esc(s.hours)}</dd></div>
                </dl>
                <a class="btn btn--primary locations__order" href="${h.esc(h.href(s.order.href))}" aria-describedby="${nid}">${h.esc(s.order.text)}</a>
              </div>
            </div>
          </article>
        </li>`;
  };
  return `
<section class="slide theme-black locations" id="${meta.id}" aria-labelledby="locations-h" data-slide="${meta.order}">
  <div class="slide__inner">
    <div class="carousel locations__rail" data-carousel aria-labelledby="locations-h">
      <header class="slide__head locations__head">
        <div class="head__copy">
          <span class="secnum" aria-hidden="true"></span>
          <h2 class="title" id="locations-h">${h.esc(L.title)}</h2>
        </div>
      </header>
      <a class="btn btn--ghost locations__action" href="${h.esc(h.href(S.href))}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 18 })}${h.esc(S.text)}</a>
      <div class="locations__picker scroll-row">
        ${cards.map((s, i) => `<button class="locations__pick" type="button" data-pick aria-controls="locations-card-${i + 1}">${h.esc(s.name.join(' '))}</button>`).join('\n        ')}
      </div>
      <div class="carousel__viewport locations__viewport">
        <ul class="carousel__track locations__track">
        ${cards.map(card).join('\n        ')}
        </ul>
      </div>
      <div class="carousel__ui locations__ui">
        <button class="carousel__btn" type="button" data-prev aria-label="${h.esc(c.ui.prev)}">${h.icon('left', { size: 20 })}</button>
        <button class="carousel__btn" type="button" data-next aria-label="${h.esc(c.ui.next)}">${h.icon('right', { size: 20 })}</button>
      </div>
      <p class="carousel__count locations__count" data-count></p>
    </div>
  </div>
</section>`;
}
