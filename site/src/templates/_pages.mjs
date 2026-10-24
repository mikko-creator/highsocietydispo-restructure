// _pages.mjs — what the pages lane's templates share (about, contact, careers, hub, guide, faq). Not a template: the
// build loads only [a-z0-9-] names from src/templates. No copy lives here: every word comes from the page JSON (its
// blocks and fields) or site.json (stores, ui).
//
//   renderBlocks(list, ctx, { grounds, variants })  -> html
//        the page's blocks in order on alternating grounds (the shell's rhythm). A block whose "variant" names one of the
//        template's own renderers is drawn by it (the template's design for that band); every other block by
//        src/blocks/<type>.mjs. A variant block keeps a real "type", so the core renderer still draws it if the
//        template ever changes.
//   oneFaqPage(ctx) -> { ctx, node() }
//        core's faq block adds one FAQPage node per block; a page with several FAQ blocks gets ONE FAQPage holding every
//        question (render with the returned ctx, then add node() to the page's JSON-LD)
//   headingsOf(html) -> [{ id, text }]      the h2s with ids in a rendered chunk, in order (contents lists, topic chips)
//   jumpNav(items, ctx, { label, cls })     a nav of same-page links (#id), labelled by a short line (not a heading)
//   sourcesSection(page, ctx)               page.sources [{ label, url }] (https only) as a numbered list of <cite>s
//   formHtml(form, ctx, { labelledby })     a form from the page JSON (contact, careers): fields, fieldsets, selects

export function renderBlocks(list, ctx, { grounds = ['white', 'headlight'], variants = {} } = {}) {
  return (list || []).map((b, i) => {
    const ground = b.ground || grounds[i % grounds.length];
    if (b.variant) {
      const v = variants[b.variant];
      if (!v) throw new Error(`block variant "${b.variant}" is not drawn by template "${ctx.page.template}" (${ctx.page.path})`);
      return v({ ...b }, { ...ctx, ground });
    }
    const r = ctx.blockRenderers[b.type];
    if (!r) throw new Error('unknown block type "' + b.type + '" on ' + ctx.page.path);
    return r({ ...b }, { ...ctx, ground });
  }).join('\n');
}

export function oneFaqPage(ctx) {
  const questions = [];
  const inner = { ...ctx, jsonld: (n) => { if (n && n['@type'] === 'FAQPage') questions.push(...(n.mainEntity || [])); else ctx.jsonld(n); } };
  return { ctx: inner, node: () => (questions.length ? { '@type': 'FAQPage', mainEntity: questions } : null) };
}

// rendered HTML -> its visible text (tags dropped, the five escapes undone)
export const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const unesc = plain;

export function headingsOf(html) {
  const out = [];
  for (const m of String(html).matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g)) {
    const id = /\sid="([^"]+)"/.exec(m[1]);
    if (id) out.push({ id: id[1], text: unesc(m[2]) });
  }
  return out;
}

export function jumpNav(items, ctx, { label, cls = '' } = {}) {
  if (!items.length) return '';
  const e = ctx.h.esc, id = ctx.uid('jump');
  return `<nav class="jumpnav${cls ? ' ' + cls : ''}" aria-labelledby="${id}">
      <p class="jumpnav__label" id="${id}">${e(label)}</p>
      <ol class="jumpnav__list">${items.map((it) => `<li><a href="#${e(it.id)}">${e(it.text)}</a></li>`).join('')}</ol>
    </nav>`;
}

export function sourcesSection(page, ctx) {
  const list = page.sources || [];
  if (!list.length) return '';
  const e = ctx.h.esc, id = ctx.uid('sources');
  for (const s of list) if (!/^https:\/\/[^\s"'<>`\\]+$/.test(s.url || '')) throw new Error(page.path + ': a source must be an https URL: ' + JSON.stringify(s.url));
  return `<section class="srcs" aria-labelledby="${id}">
      <h2 class="srcs__title" id="${id}">${e(page.sourcesHeading || ctx.ui.sources)}</h2>
      ${page.sourcesNote ? `<div class="srcs__note md">${ctx.md(page.sourcesNote)}</div>` : ''}
      <ol class="srcs__list">${list.map((s) => `<li><cite><a href="${e(ctx.h.href(s.url))}" rel="noopener">${e(s.label)}</a></cite></li>`).join('')}</ol>
    </section>`;
}

// ---- forms ----------------------------------------------------------------------------------------------------------
// form: { id, cmsFormId, cmsFormName, action (https), method, enctype, groups: [{ legend?, hint?, fields: [field] }], submit }
// field: { name, label, type (text|email|tel|date|textarea|select|file), placeholder?, required?, autocomplete?,
//          hideLabel? (the label is read, not shown: the legend names the group), half? (two to a row from 640px),
//          options? ([text] or "stores": the store names from site.json), value? (the preselected option),
//          accept? (file), help? (a line read with the field) }
const TYPES = new Set(['text', 'email', 'tel', 'date', 'textarea', 'select', 'file']);
export function formHtml(form, ctx, { labelledby } = {}) {
  const e = ctx.h.esc;
  if (!form || !Array.isArray(form.groups)) throw new Error(ctx.page.path + ': "form" needs groups');
  const action = ctx.h.href(form.action);
  if (!/^https:\/\//.test(action)) throw new Error(ctx.page.path + ': the form action must be an https URL');
  const fid = ctx.uid(form.id || 'form');
  const field = (f) => {
    if (!TYPES.has(f.type)) throw new Error(`${ctx.page.path}: form field "${f.name}" has an unknown type "${f.type}"`);
    const id = ctx.uid(fid + '-' + ctx.h.slug(f.name));
    const helpId = f.help ? ctx.uid(id + '-help') : null;
    const common = { id, name: f.name, required: !!f.required, 'aria-describedby': helpId || false };
    let control;
    if (f.type === 'textarea') control = `<textarea class="hsform__input hsform__input--area"${ctx.h.attrs({ ...common, placeholder: f.placeholder || false, rows: 6 })}></textarea>`;
    else if (f.type === 'select') {
      const opts = f.options === 'stores' ? ctx.site.stores.map((s) => s.name) : f.options;
      if (!Array.isArray(opts) || !opts.length) throw new Error(`${ctx.page.path}: select "${f.name}" has no options`);
      if (f.value !== undefined && !opts.includes(f.value)) throw new Error(`${ctx.page.path}: select "${f.name}" preselects "${f.value}", which is not one of its options`);
      control = `<span class="hsform__select"><select class="hsform__input"${ctx.h.attrs(common)}>${opts.map((o) => `<option${o === f.value ? ' selected' : ''}>${e(o)}</option>`).join('')}</select>${ctx.h.icon('chevron', { size: 18, cls: 'hsform__chev' })}</span>`;
    } else if (f.type === 'file') control = `<input class="hsform__input hsform__input--file"${ctx.h.attrs({ ...common, type: 'file', accept: f.accept || false })}>`;
    else control = `<input class="hsform__input"${ctx.h.attrs({ ...common, type: f.type, placeholder: f.placeholder || false, autocomplete: f.autocomplete || false })}>`;
    return `<div class="hsform__field${f.half ? ' hsform__field--half' : ''}${f.type === 'file' ? ' hsform__field--file' : ''}">
          <label class="hsform__label${f.hideLabel ? ' visually-hidden' : ''}" for="${id}">${e(f.label)}</label>
          ${control}
          ${helpId ? `<p class="hsform__help" id="${helpId}">${e(f.help)}</p>` : ''}
        </div>`;
  };
  const group = (g) => {
    const inner = `<div class="hsform__grid">${g.fields.map(field).join('')}</div>`;
    return g.legend ? `<fieldset class="hsform__set"><legend class="hsform__legend">${e(g.legend)}</legend>${inner}</fieldset>` : `<div class="hsform__set hsform__set--plain">${inner}</div>`;
  };
  return `<form class="hsform" id="${fid}"${ctx.h.attrs({ action, method: form.method || 'post', enctype: form.enctype || false, 'aria-labelledby': labelledby || false, 'data-form-id': form.cmsFormId || false, 'data-form-name': form.cmsFormName || false })}>
        ${form.groups.map(group).join('\n        ')}
        ${form.cmsFormId ? `<input type="hidden" name="form_id" value="${e(form.cmsFormId)}">` : ''}
        <div class="hsform__actions"><button class="btn btn--primary btn--lg hsform__submit" type="submit">${e(form.submit)}</button></div>
      </form>`;
}
