// 07-app.mjs — Download the High Society App, in the reskin's own band (its sheet, "the app: ink band with the card's
// carbon, tone on tone", #ik44): the ink ground with the brand card's carbon weave at 40px and a soft red radial glow
// behind the phone (decoration, .slide__bg); the checkered strip along the top edge (the reskin's divider between the
// product panel and this band: its slot iw9b2 stays, empty, just before the section for the CMS).
// The ground: a checkered racing flag (the brand card's squares) behind the phone, fading into the black (owner,
// 2026-10-22; it replaced the carbon weave), the red glow through it; data-photo has text over it measured on pixels.
// One focal point: the race number, the title on its two source lines in white, the paragraph as quiet running copy,
// one red "Download Now" (the App Store link). The phone (owner, 2026-10-22, option G of the app previews): the
// reskin's app screenshot taken out of its iPhone picture and laid into the owner's own phone mockup, in perspective
// (src/tools/build-app-screen.py + build-app-mockup.py; no generator, the app's words and figures exact), cut above the
// screenshot's foot and fading out; decorative, alt "" as the reskin's picture. The reskin's own picture was (706x887, transparent, cut off at its foot in the
// artwork, alt "") stands large on the left; the reskin let that cut run off the band's foot, here the brief's edge
// padding keeps it inside the content box, so the cut foot stands on a quiet floor line (decoration) instead.
// Landscape: phone left, copy right (centred against it). Portrait tablets: the copy and the button, then the phone
// rising from the floor. Portrait phones: the copy, the phone whole and compact, then the button at the foot (the
// brief: primary actions in the bottom half). Short phones: the button and the phone share the foot row.

export const meta = { id: 'app', order: 7, label: 'Download the High Society App' };

export function render(c, h) {
  const A = c.app;
  const [line1, line2] = A.title;
  return `
${h.slot('iw9b2')}
<section class="slide theme-black app" id="${meta.id}" aria-labelledby="app-h" data-slide="${meta.order}">
  <div class="slide__bg app__bg" aria-hidden="true" data-photo></div>
  <div class="checker app__band" aria-hidden="true" data-edge-band></div>
  <div class="slide__inner app__inner">
    <div class="app__copy">
      <header class="slide__head app__head reveal">
        <div class="head__copy">
          <span class="secnum" aria-hidden="true"></span>
          <h2 class="title app__title" id="app-h">${h.esc(line1)}<br>${h.esc(line2)}</h2>
        </div>
      </header>
      <p class="prose app__text reveal" style="--i:1">${h.esc(A.text)}</p>
      <a class="btn btn--primary btn--lg app__cta reveal" style="--i:2" href="${h.esc(h.href(A.cta.href))}">${h.esc(A.cta.text)}</a>
    </div>
    <div class="app__art">
      <div class="app__stage">
        ${h.img('derived:app-phone-mockup', { alt: A.img.alt, cls: 'app__phone', sizes: '(min-width: 1180px) 560px, (min-width: 768px) 46vw, min(64vw, 30vh)' })}
      </div>
    </div>
  </div>
</section>`;
}
