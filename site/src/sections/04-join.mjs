// 04-join.mjs — Join The Society, in the reskin's own band: its lifestyle photo (lifestyle-02, alt "": it was a CSS
// background there) full-bleed under a black scrim, the copy on the left of the column: the race number, the title,
// the line, one red button. Landscape screens: the reskin's left-to-right scrim (.9 -> .6 -> .1), the copy centred
// against the photo. Phones and portrait tablets: the photo still edge to edge, settling into the ink ground under a
// bottom-weighted scrim, the copy in the lower part and the button in the thumb zone.
// The photo is an <img> marked data-photo (check.mjs measures the type over it on the rendered pixels) and data-fill
// (the band's photo is its content: the screen is never an empty band).
// DECLARED: the reskin's button href is "" (a CMS dynamic button) -> the header's own Join The Society destination;
// the CMS hook around it (#i55o9 .dl-cta-btn) is kept.

export const meta = { id: 'join', order: 4, label: 'Join The Society' };

export function render(c, h) {
  const J = c.join;
  // the photo is painted wider than the screen wherever the band is height-limited (cover on a 1600x1063 photo,
  // aspect 1.505): phones draw it 80% of the band tall (band = 100vh - 64px bar - 64px dock), tablets and desktops the
  // whole band (100vh - 64px bar, at most); its sizes follow that height, as the hero's do
  const photoSizes = '(max-width: 767px) max(100vw, calc((100vh - 128px) * 1.21)), max(100vw, calc((100vh - 64px) * 1.51))';
  // portrait phones get the photo's phone crop (x 335-1435 of 1600, full height, optimize-images.py): drawn 80% of the
  // band tall, so its width is that height x 1100/1063
  const phoneSizes = 'max(100vw, calc((100vh - 128px) * .83))';
  return `
<section class="slide theme-black join" id="${meta.id}" aria-labelledby="join-h" data-slide="${meta.order}">
  <div class="slide__bg join__bg" aria-hidden="true">
    <div class="join__shot" data-fill>
      ${h.picture('assets/pit-stop/img/lifestyle-02.jpg', 'assets/pit-stop/img/lifestyle-02.jpg#phone', { media: '(min-width: 768px), (orientation: landscape)', alt: '', cls: 'join__photo', sizes: photoSizes, mobileSizes: phoneSizes, extra: { 'data-photo': true } })}
    </div>
  </div>
  <div class="slide__inner join__inner">
    <div class="join__copy">
      <header class="join__head reveal">
        <span class="secnum" aria-hidden="true"></span>
        <h2 class="title join__title" id="join-h">${h.esc(J.title)}</h2>
      </header>
      <p class="join__lead reveal" style="--i:1">${h.esc(J.text)}</p>
      <div class="dl-cta-btn join__slot reveal" id="i55o9" style="--i:2"><a class="btn btn--primary btn--lg join__cta" href="${h.esc(h.href(c.header.join.href))}">${h.esc(J.cta.text)}</a></div>
    </div>
  </div>
</section>`;
}
