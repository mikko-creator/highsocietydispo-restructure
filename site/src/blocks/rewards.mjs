// rewards block (stores lane): The Society's loyalty tiers as High Society publishes them (only inside an image on its
// pages: assets/in-pages/Price_Table.webp, "High Society Cannabis Loyalty Tiers"), transcribed as an accessible table in
// the v2 language: the tier names on the ink header row, the red check plate where a perk is included.
//
//   { type: "rewards", heading?, lead?, ground?, caption?,
//     tiers: [names],                                   column heads
//     rows: [{ label, values?: [text per tier], includes?: [true|false per tier] }],
//     yes, no                                           the words a screen reader hears for an included / missing perk
//     image?: { src, alt }                              the live site's tier art (an images.json key), shown above
//     note?: md, ctas?: [{ text, href, style? }] }
import { section, buttons } from './_kit.mjs';

export function render(b, ctx) {
  const e = ctx.h.esc;
  if (!Array.isArray(b.tiers) || !Array.isArray(b.rows)) throw new Error('rewards block: tiers[] and rows[] are required');
  for (const r of b.rows) {
    const n = (r.values || r.includes || []).length;
    if (n !== b.tiers.length) throw new Error(`rewards block: row "${r.label}" has ${n} cells for ${b.tiers.length} tiers`);
  }
  const cell = (r, k) => {
    if (r.values) return `<td>${ctx.inline(r.values[k])}</td>`;
    return r.includes[k]
      ? `<td class="tiers__yes"><span class="tiers__check" aria-hidden="true">${ctx.h.icon('check', { size: 22 })}</span><span class="visually-hidden">${e(b.yes)}</span></td>`
      : `<td class="tiers__no"><span aria-hidden="true">&ndash;</span><span class="visually-hidden">${e(b.no)}</span></td>`;
  };
  const img = b.image ? `<figure class="tiers__art media">${ctx.h.img(b.image.src, { alt: b.image.alt, sizes: '(min-width: 1280px) 1200px, 100vw' })}</figure>` : '';
  return section(b, ctx, `${img}<div class="tiers md-table" role="region" tabindex="0" aria-label="${e(b.caption || b.heading || ctx.ui.tableLabel)}">
      <table>
        ${b.caption ? `<caption>${ctx.inline(b.caption)}</caption>` : ''}
        <thead><tr><th scope="col">${e(b.perksLabel || '')}</th>${b.tiers.map((t) => `<th scope="col">${e(t)}</th>`).join('')}</tr></thead>
        <tbody>${b.rows.map((r) => `<tr><th scope="row">${ctx.inline(r.label)}</th>${b.tiers.map((_, k) => cell(r, k)).join('')}</tr>`).join('\n        ')}</tbody>
      </table>
    </div>
    ${b.note ? `<div class="tiers__note md">${ctx.md(b.note)}</div>` : ''}
    ${buttons(b.ctas, ctx)}`);
}
