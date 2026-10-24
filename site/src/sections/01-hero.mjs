// 01-hero.mjs — the reskin's cover (owner, 2026-10-21: "the reskin still looks more modern"; "i want this hero
// background image retained here"), in the owner's layout E (2026-10-22, "Minimal cinematic"): the race-day photo
// full-bleed under the reskin's black scrim; on desktop the type in the lower right, beside the woman: the trophy kicker
// (the red mark between two red rules), the HIGH SOCIETY wordmark (banner_logo.webp), the H1, then "Order Now" as the
// reskin's red hero action (white trophy mark, red glow) and "CALL TO ACTION" as the ghost.
// The reskin's HS monogram (Layer_13_copy.webp) is not drawn here (owner, 2026-10-22: "having this logo here creates
// redundancy, it can do fine without it": the HIGH SOCIETY wordmark over the H1 carries the H; declared in
// audit/declared-removals.json).
// Along the foot the reskin's two rolling store-name tickers, small (owner: "keep these but … make it small that it
// fits here", the band under the actions), over a 12px checkered strip. The tickers are decoration (aria-hidden); the
// band itself is the pause control (owner: no pause/play button): an empty layer over it (so the control's name is not
// at odds with the names it rolls) that a tap, a click, Enter or Space turns into a pause of every ticker on the page
// and again a restart (WCAG 2.2.2); where motion is reduced nothing moves.

export const meta = { id: 'home', order: 1, label: 'Hero' };

export function render(c, h) {
  const H = c.hero;
  const names = c.header.nav.find((n) => n.sub).sub.map((s) => s.text);
  // one run of the eight store names, each followed by the trophy mark; the track holds the run twice so the loop is
  // seamless. The outline row starts further along the list, so the two rows never line up name over name.
  const run = (list) => list.map((n) => `<span class="ticker__name">${h.esc(n)}</span><i class="ticker__mark"></i>`).join('');
  const ticker = (cls, list) => `<div class="ticker ${cls}" aria-hidden="true"><div class="ticker__track"><div class="ticker__run">${run(list)}</div><div class="ticker__run">${run(list)}</div></div></div>`;
  const later = names.slice(5).concat(names.slice(0, 5));
  // the photo is painted wider than the screen (cover on a 2000x858 panorama): its sizes follow the section's height
  const photoSizes = 'max(100vw, calc(100vh * 2.34))';   // the photo runs up under the clear bar: the full screen high
  // the ticker band is painted content that fills the hero's foot (data-fill: check.mjs counts it for the empty-band
  // rule); on portrait phones the photo ends near the middle, so without it the band under the buttons read as empty
  // portrait phones get the owner's phone hero (2026-10-22, "can you try this?": the race-day photo recomposed for a
  // 390x844 screen, faded to black): drawn at the top of the screen at the full width (01-hero.css), so it is 100vw wide
  const phoneMedia = '(max-width: 767.98px) and (orientation: portrait)';
  const phoneSizes = '100vw';
  return `
<section class="slide slide--first theme-black hero" id="${meta.id}" aria-labelledby="hero-h" data-slide="${meta.order}">
  <div class="slide__bg hero__bg" aria-hidden="true">
    ${h.picture('assets/pit-stop/img/hero-pit-wall.jpg', 'derived:owner-hero-mobile', { media: '(min-width: 768px), (orientation: landscape)', alt: '', cls: 'hero__photo', sizes: photoSizes, mobileSizes: phoneSizes, eager: true, priority: true, extra: { 'data-photo': true, 'data-fill': true, 'data-lcp': true, 'data-lcp-media': phoneMedia } })}
    <div class="hero__scrim"></div>
  </div>
  <div class="slide__inner hero__inner">
    <div class="hero__stack">
      <span class="hero__kicker" aria-hidden="true"></span>
      ${h.img(H.banner.src, { alt: H.banner.alt, cls: 'hero__wordmark', sizes: '(min-width: 1024px) 440px, (min-width: 768px) 380px, 300px', eager: true })}
      <h1 class="hero__title" id="hero-h">${h.esc(H.title)}</h1>
      <div class="hero__actions">
        <a class="btn btn--primary btn--lg hero__go" href="${h.esc(h.href(H.order.href))}">${h.esc(H.order.text)}</a>
        <a class="btn btn--ghost btn--lg hero__cta" href="${h.esc(h.href(H.cta.href))}">${h.esc(H.cta.text)}</a>
      </div>
    </div>
    ${h.slot('iryvf')}${h.slot('im4qg')}
  </div>
  <div class="hero__type" data-fill>
    ${ticker('ticker--big hero__ticker', names)}
    ${ticker('ticker--big ticker--outline ticker--rev hero__ticker', later)}
    <span class="motion-band" data-motion-toggle data-label="${h.esc(c.ui.pauseMotion)}"></span>
  </div>
  <div class="checker hero__checker" aria-hidden="true" data-edge-band></div>
</section>
${h.slot('iktdr')}`;
}
