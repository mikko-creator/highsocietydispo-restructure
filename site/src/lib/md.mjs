// md.mjs — the strict Markdown subset of contract §5 -> HTML. Node builtins only, no state between calls.
//
// Content never carries HTML (contract §2.7): every character of the source is escaped, and the only tags in the
// output are the ones this file writes:
//   blocks  p, h2, h3 (from "## " and "### "), ul/li ("- "), ol/li ("1. ", one level), blockquote ("> "),
//           aside.callout ("> **Note:** ..."; also Tip / Warning / Important / Legal), table (GFM pipe tables, wrapped
//           in a scroll region so a wide table never widens the page)
//   inline  strong (**x**), em (*x*), a ([text](url)), and backslash escapes (\* \[ \| ...)
// Anything else ("# h1", "#### h4", raw <tags>, `code`, images) is text. Links:
//   "/site/path/"   internal: handed to opts.link(path) -> the URL to write (the build makes it page-relative and
//                   records it for the link check); null/'' renders the text without a link
//   "#fragment"     kept (same-page anchor; [A-Za-z0-9_-] only)
//   "https://..."   external, rel="noopener" (http:// too); mailto: and tel: kept
//   anything else   (javascript:, data:, vbscript:, relative paths, "//host", entity or whitespace tricks): the text
//                   alone, no link, and the href is listed in result.rejected (the build fails on it)
// Headings get stable ids (a slug of their text, de-duplicated with -2, -3 ... across opts.usedIds) and a toc entry.
//
//   renderMarkdown(src, opts) -> { html, toc: [{ level, id, text }], links: [{ href, url }], rejected: [href], warnings }
//   renderInline(src, opts)   -> html (one line: strong, em, links)
//   plainText(src)            -> the visible words, no markup (meta, JSON-LD answers, read time)
//   slugify(text)             -> 'a-stable-id'

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// combining marks (U+0300..U+036F), dropped after NFKD so "Cafe" and "Café" slug alike
const COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
// whitespace, C0/C1 controls, DEL and the two Unicode line separators
const hasControl = (s) => { for (const ch of s) { const c = ch.codePointAt(0); if (c <= 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true; } return false; };

export function slugify(text) {
  const s = String(text ?? '').normalize('NFKD').replace(COMBINING, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s.slice(0, 64).replace(/-+$/, '')) || 'section';
}

const PUNCT = /[\\`*_{}[\]()#+\-.!|>~<"'&:]/;

// ---- links -----------------------------------------------------------------------------------------------------
function classify(raw) {
  const href = String(raw);
  // no whitespace or control characters anywhere: they are how scheme filters get dodged ("java\tscript:")
  if (!href || hasControl(href)) return { kind: 'reject' };
  if (/^\/(?![/\\])/.test(href)) return /[\\<>"'`]/.test(href) ? { kind: 'reject' } : { kind: 'internal' };
  if (/^#[A-Za-z0-9_-]+$/.test(href)) return { kind: 'fragment' };
  if (/^https?:\/\/[^\s<>"'`\\]+$/i.test(href)) return { kind: 'external' };
  if (/^mailto:[^\s<>"'`\\]+@[^\s<>"'`\\]+$/i.test(href)) return { kind: 'mailto' };
  if (/^tel:\+?[0-9().\-]+$/i.test(href)) return { kind: 'tel' };
  return { kind: 'reject' };
}

// index of the "]" that closes the "[" at i (nesting counted, escapes skipped), or -1
function closeBracket(s, i) {
  let d = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k++; continue; }
    if (c === '[') d++;
    else if (c === ']') { d--; if (d === 0) return k; }
  }
  return -1;
}
// index of the ")" that closes the "(" at i (balanced parens inside, escapes skipped), or -1
function closeParen(s, i) {
  let d = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k++; continue; }
    if (c === '(') d++;
    else if (c === ')') { d--; if (d === 0) return k; }
    else if (c === '\n') return -1;
  }
  return -1;
}
// a closing delimiter: not preceded by whitespace, and (for "*") not part of "**"
function closeDelim(s, from, delim) {
  for (let k = from; k < s.length; k++) {
    if (s[k] === '\\') { k++; continue; }
    if (s.startsWith(delim, k) && k > from && !/\s/.test(s[k - 1])) {
      if (delim === '*' && (s[k + 1] === '*' || s[k - 1] === '*')) continue;
      return k;
    }
  }
  return -1;
}

function inline(src, st, inLink) {
  let out = '', text = '';
  const flush = () => { out += esc(text); text = ''; };
  const s = String(src);
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && PUNCT.test(s[i + 1])) { text += s[i + 1]; i += 2; continue; }
    if (c === '*' && s[i + 1] === '*' && s[i + 2] && !/\s/.test(s[i + 2])) {
      const end = closeDelim(s, i + 2, '**');
      if (end > i + 2) { flush(); out += '<strong>' + inline(s.slice(i + 2, end), st, inLink) + '</strong>'; i = end + 2; continue; }
    }
    if (c === '*' && s[i + 1] !== '*' && s[i + 1] && !/\s/.test(s[i + 1])) {
      const end = closeDelim(s, i + 1, '*');
      if (end > i + 1) { flush(); out += '<em>' + inline(s.slice(i + 1, end), st, inLink) + '</em>'; i = end + 1; continue; }
    }
    if (c === '[' && !inLink) {
      const cb = closeBracket(s, i);
      if (cb > i && s[cb + 1] === '(') {
        const cp = closeParen(s, cb + 1);
        if (cp > cb + 1) {
          const label = s.slice(i + 1, cb);
          // backslash escapes in a URL unescape ASCII punctuation only (CommonMark): "/\evil" keeps its backslash
          const href = s.slice(cb + 2, cp).replace(/\\([!-/:-@[-`{-~])/g, '$1');
          flush();
          out += link(label, href, st);
          i = cp + 1;
          continue;
        }
      }
    }
    text += c; i++;
  }
  flush();
  return out;
}

function link(label, href, st) {
  const inner = inline(label, st, true);
  const { kind } = classify(href);
  if (kind === 'reject') { st.rejected.push(href); return inner; }
  let url = href, extra = '';
  if (kind === 'internal') {
    url = st.opts.link ? st.opts.link(href) : href;
    st.links.push({ href, url: url || null });
    if (!url) return inner;
  }
  if (kind === 'external') extra = ' rel="noopener"';
  return `<a href="${esc(url)}"${extra}>${inner}</a>`;
}

// ---- blocks ------------------------------------------------------------------------------------------------------
const RE = {
  heading: /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/,
  bullet: /^[ \t]{0,3}-[ \t]+(.*)$/,
  ordered: /^[ \t]{0,3}(\d{1,9})[.)][ \t]+(.*)$/,
  quote: /^[ \t]{0,3}>[ \t]?(.*)$/,
  tableSep: /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/,
  blank: /^[ \t]*$/,
};
const CALLOUT = { note: 'info', tip: 'info', warning: 'warn', important: 'warn', caution: 'warn', legal: 'legal' };

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function startsBlock(line, next) {
  return RE.heading.test(line) || RE.bullet.test(line) || RE.ordered.test(line) || RE.quote.test(line)
    || (line.trim().startsWith('|') && next !== undefined && RE.tableSep.test(next));
}

function uniqueId(base, st) {
  let id = (st.opts.idPrefix || '') + base, n = 1;
  while (st.used.has(id)) id = (st.opts.idPrefix || '') + base + '-' + (++n);
  st.used.add(id);
  return id;
}

function paragraphs(lines, st) {
  // a quote/callout body: blank lines split paragraphs
  const out = []; let buf = [];
  const flush = () => { if (buf.length) out.push('<p>' + inline(buf.join(' '), st, false) + '</p>'); buf = []; };
  for (const l of lines) { if (RE.blank.test(l)) flush(); else buf.push(l.trim()); }
  flush();
  return out.join('');
}

export function renderMarkdown(src, opts = {}) {
  const st = { opts, used: opts.usedIds || new Set(), links: [], rejected: [], warnings: [], toc: [] };
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (RE.blank.test(line)) { i++; continue; }

    // headings: ## and ### only (an article body never uses #); others stay text
    const hm = RE.heading.exec(line);
    if (hm && (hm[1].length === 2 || hm[1].length === 3)) {
      const level = Math.min(6, hm[1].length + (opts.headingOffset || 0));
      const html = inline(hm[2], st, false);
      const text = plainText(hm[2]);
      const id = uniqueId(slugify(text), st);
      st.toc.push({ level: hm[1].length, id, text });
      out.push(`<h${level} id="${esc(id)}">${html}</h${level}>`);
      i++; continue;
    }
    if (hm) st.warnings.push(`line ${i + 1}: "${hm[1]}" heading is not in the subset (## and ### only); kept as text`);

    // tables: a header row, a separator row, then rows
    if (line.trim().startsWith('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
      const cls = (k) => (align[k] ? ` class="t-${align[k]}"` : '');
      const cell = (tag, c, k) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}${cls(k)}>${inline(c, st, false)}</${tag}>`;
      const width = head.length;
      const fit = (r) => Array.from({ length: width }, (_, k) => r[k] ?? '');
      st.tables = (st.tables || 0) + 1;
      out.push(`<div class="md-table" role="region" tabindex="0" aria-label="${esc(opts.tableLabel || 'Table')}"><table>`
        + `<thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${fit(r).map((c, k) => cell('td', c, k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    // quotes and callouts
    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && RE.quote.test(lines[i])) { body.push(RE.quote.exec(lines[i])[1]); i++; }
      const cm = /^\*\*([A-Za-z]+):\*\*[ \t]*/.exec(body[0] || '');
      const tone = cm && CALLOUT[cm[1].toLowerCase()];
      if (tone) {
        out.push(`<aside class="callout callout--${tone}" role="note">${paragraphs(body, st)}</aside>`);
      } else {
        out.push(`<blockquote>${paragraphs(body, st)}</blockquote>`);
      }
      continue;
    }

    // lists: one level; an indented line continues the item; a blank line between items of the same kind keeps the list
    const lm = RE.bullet.exec(line) || RE.ordered.exec(line);
    if (lm) {
      const ordered = !RE.bullet.test(line);
      const re = ordered ? RE.ordered : RE.bullet;
      const items = [];
      const start = ordered ? Number(RE.ordered.exec(line)[1]) : 1;
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) { items.push([ordered ? m[2] : m[1]]); i++; continue; }
        if (items.length && /^[ \t]{2,}\S/.test(lines[i]) && !RE.bullet.test(lines[i]) && !RE.ordered.test(lines[i])) { items[items.length - 1].push(lines[i].trim()); i++; continue; }
        if (RE.blank.test(lines[i])) {
          let k = i; while (k < lines.length && RE.blank.test(lines[k])) k++;
          if (k < lines.length && re.test(lines[k])) { i = k; continue; }
        }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
      out.push(`<${tag}${startAttr}>${items.map((it) => `<li>${inline(it.join(' '), st, false)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // a paragraph: lines up to a blank line or the start of another block
    const buf = [line.trim()];
    i++;
    while (i < lines.length && !RE.blank.test(lines[i]) && !startsBlock(lines[i], lines[i + 1])) { buf.push(lines[i].trim()); i++; }
    out.push('<p>' + inline(buf.join(' '), st, false) + '</p>');
  }
  return { html: out.join('\n'), toc: st.toc, links: st.links, rejected: st.rejected, warnings: st.warnings };
}

export function renderInline(src, opts = {}) {
  const st = { opts, used: new Set(), links: [], rejected: [], warnings: [], toc: [] };
  const html = inline(String(src ?? '').replace(/\s*\n\s*/g, ' '), st, false);
  if (opts.collect) { opts.collect.links.push(...st.links); opts.collect.rejected.push(...st.rejected); }
  return html;
}

/** The visible words of a Markdown string: markers, link targets and table rules dropped. */
export function plainText(src) {
  return String(src ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}.*$/gm, ' ')
    .replace(/^[ \t]{0,3}(#{1,6}|>|-|\d{1,9}[.)])[ \t]+/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\(.)/g, '$1')
    .replace(/\*\*|\*|\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
