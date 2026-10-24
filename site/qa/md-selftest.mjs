// md-selftest.mjs — proves src/lib/md.mjs: normal Markdown renders EXACTLY as expected, and every XSS control comes out
// inert (only md.mjs's own tags and attributes, no dangerous URL, no event handler, raw markup escaped).
// The inertness checker is itself proved: planted unsafe HTML strings must each be flagged, else exit 3.
//   node qa/md-selftest.mjs      exit 0 pass; 1 a case failed; 3 a control did not fire
import { renderMarkdown, renderInline, plainText, slugify } from '../src/lib/md.mjs';

const fails = [];
let n = 0;
const check = (name, ok, detail = '') => { n++; if (!ok) fails.push(name + (detail ? ': ' + detail : '')); };

// ---- the inertness checker -------------------------------------------------------------------------------------
const TAGS = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'aside', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'strong', 'em', 'a']);
const ATTRS = new Set(['id', 'href', 'rel', 'class', 'role', 'tabindex', 'aria-label', 'scope', 'start']);
const decode = (s) => s.replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&colon;/gi, ':').replace(/&tab;/gi, '\t').replace(/&newline;/gi, '\n').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function unsafe(html) {
  const bad = [];
  // every "<" must open one of our tags; a "<" that is not a tag at all is a leak
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>"'/]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  let stripped = html.replace(tagRe, (m, close, name, attrs) => {
    if (!TAGS.has(name.toLowerCase())) bad.push('tag <' + name + '>');
    for (const a of attrs.matchAll(/\s+([^\s=>"'/]+)(?:="([^"]*)")?/g)) {
      const k = a[1].toLowerCase();
      if (!ATTRS.has(k)) bad.push('attribute ' + k);
      if (k === 'href') {
        const v = decode(a[2] || '').replace(/[\x00-\x20]+/g, '');
        if (/^(javascript|data|vbscript):/i.test(v) || /^\/\//.test(v) || /^\/\\/.test(v)) bad.push('href ' + a[2]);
      }
    }
    return '';
  });
  if (/</.test(stripped)) bad.push('stray "<" outside a known tag: ' + stripped.slice(stripped.indexOf('<'), stripped.indexOf('<') + 40));
  if (/\son[a-z]+\s*=/i.test(html.replace(/>[^<]*</g, '><'))) bad.push('event handler attribute');
  return bad;
}
// control: the checker must flag each of these
const planted = [
  '<p>ok</p><script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<p onclick="alert(1)">x</p>',
  '<img src=x onerror=alert(1)>',
  '<p>a < b</p>',
  '<a href="//evil.example/">x</a>',
];
const controlMisses = planted.filter((h) => !unsafe(h).length);
const controlClean = unsafe('<p><a href="../deals/">x</a> <strong>b</strong></p>').length === 0;

// ---- normal Markdown: exact output -----------------------------------------------------------------------------
const links = [];
const opts = { link: (p) => { links.push(p); return '../..' + p; }, tableLabel: 'Comparison table' };
const doc = [
  'Cannabis comes in **many forms**, and *each one* works a little differently.',
  'A second line joins the paragraph.',
  '',
  '## How it works',
  '',
  'See [the deals](/deals/) or [the law](https://www.michigan.gov/cra).',
  '',
  '### Step one',
  '',
  '- First item',
  '- Second item with **bold**',
  '  continued here',
  '',
  '1. One',
  '2. Two',
  '',
  '> A plain quote.',
  '',
  '> **Note:** Must be 21 or older.',
  '',
  '| Form | Onset |',
  '|---|---:|',
  '| Flower | Minutes |',
  '| Edible \\| gummy | 30-120 min |',
  '',
  '## How it works',
  '',
  'Escaped \\*stars\\* and a [same-page link](#how-it-works).',
].join('\n');
const want = [
  '<p>Cannabis comes in <strong>many forms</strong>, and <em>each one</em> works a little differently. A second line joins the paragraph.</p>',
  '<h2 id="how-it-works">How it works</h2>',
  '<p>See <a href="../../deals/">the deals</a> or <a href="https://www.michigan.gov/cra" rel="noopener">the law</a>.</p>',
  '<h3 id="step-one">Step one</h3>',
  '<ul><li>First item</li><li>Second item with <strong>bold</strong> continued here</li></ul>',
  '<ol><li>One</li><li>Two</li></ol>',
  '<blockquote><p>A plain quote.</p></blockquote>',
  '<aside class="callout callout--info" role="note"><p><strong>Note:</strong> Must be 21 or older.</p></aside>',
  '<div class="md-table" role="region" tabindex="0" aria-label="Comparison table"><table><thead><tr><th scope="col">Form</th><th scope="col" class="t-right">Onset</th></tr></thead><tbody><tr><td>Flower</td><td class="t-right">Minutes</td></tr><tr><td>Edible | gummy</td><td class="t-right">30-120 min</td></tr></tbody></table></div>',
  '<h2 id="how-it-works-2">How it works</h2>',
  '<p>Escaped *stars* and a <a href="#how-it-works">same-page link</a>.</p>',
].join('\n');
const r = renderMarkdown(doc, opts);
check('normal markdown renders exactly', r.html === want, '\n--- got\n' + r.html + '\n--- want\n' + want);
check('toc', JSON.stringify(r.toc) === JSON.stringify([{ level: 2, id: 'how-it-works', text: 'How it works' }, { level: 3, id: 'step-one', text: 'Step one' }, { level: 2, id: 'how-it-works-2', text: 'How it works' }]), JSON.stringify(r.toc));
check('internal link went through the callback', JSON.stringify(links) === JSON.stringify(['/deals/']), JSON.stringify(links));
check('links recorded', r.links.length === 1 && r.links[0].href === '/deals/' && r.links[0].url === '../../deals/');
check('no rejections on clean input', r.rejected.length === 0, JSON.stringify(r.rejected));
check('normal output is inert', unsafe(r.html).length === 0, unsafe(r.html).join('; '));
check('ordered list start', renderMarkdown('3. Three\n4. Four').html === '<ol start="3"><li>Three</li><li>Four</li></ol>');
check('h1 and h4 are text', renderMarkdown('# Big\n\n#### Small').html === '<p># Big</p>\n<p>#### Small</p>');
check('callout warn', renderMarkdown('> **Warning:** Keep away from children.').html === '<aside class="callout callout--warn" role="note"><p><strong>Warning:</strong> Keep away from children.</p></aside>');
check('ids de-duplicate across calls with usedIds', (() => { const used = new Set(['faq']); return renderMarkdown('## FAQ', { usedIds: used }).html === '<h2 id="faq-2">FAQ</h2>'; })());
check('inline renders one line', renderInline('**a**\n*b* [c](/x/)', { link: (p) => p }) === '<strong>a</strong> <em>b</em> <a href="/x/">c</a>');
check('internal link refused by callback renders text', renderInline('[gone](/nope/)', { link: () => null }) === 'gone');
check('mailto and tel kept', renderInline('[m](mailto:info@example.com) [t](tel:+15177863002)') === '<a href="mailto:info@example.com">m</a> <a href="tel:+15177863002">t</a>');
check('plainText', plainText('## Title\n\n- **Bold** [link](/x/)\n\n| a | b |\n|---|---|\n| c | d |') === 'Title Bold link a b c d', plainText('## Title\n\n- **Bold** [link](/x/)\n\n| a | b |\n|---|---|\n| c | d |'));
check('slugify', slugify('What’s THC? Café & Co.') === 'whats-thc-cafe-and-co', slugify('What’s THC? Café & Co.'));
check('asterisks in arithmetic stay text', renderInline('2 * 3 * 4') === '2 * 3 * 4', renderInline('2 * 3 * 4'));
check('unclosed emphasis stays text', renderInline('**open') === '**open');

// ---- XSS controls: each must come out inert ---------------------------------------------------------------------
const xss = [
  ['raw script', '<script>alert(1)</script>'],
  ['unspaced handler', '<img/src=x/onerror=alert(1)>'],
  ['svg onload', '<svg/onload=alert(1)>'],
  ['quoted > in attribute', '<a title=">" onmouseover="alert(1)">x</a>'],
  ['nested brackets, inner javascript', '[[inner](javascript:alert(1))](/deals/)'],
  ['nested brackets, label', '[a [b] c](/deals/)'],
  ['bracket breakout', '[x](/deals/)](javascript:alert(1))'],
  ['javascript plain', '[x](javascript:alert(1))'],
  ['javascript mixed case', '[x](JaVaScRiPt:alert(1))'],
  ['javascript entity', '[x](&#106;avascript:alert(1))'],
  ['javascript hex entity', '[x](&#x6A;avascript:alert(1))'],
  ['javascript named colon entity', '[x](javascript&colon;alert(1))'],
  ['javascript leading space', '[x]( javascript:alert(1))'],
  ['javascript tab inside', '[x](java\tscript:alert(1))'],
  ['javascript newline inside', '[x](java\nscript:alert(1))'],
  ['javascript percent-encoded', '[x](%6Aavascript:alert(1))'],
  ['data url', '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
  ['vbscript', '[x](vbscript:msgbox(1))'],
  ['protocol-relative', '[x](//evil.example/)'],
  ['backslash host', '[x](/\\evil.example/)'],
  ['quote breakout external', '[x](https://ok.example/"onmouseover="alert(1))'],
  ['quote breakout internal', '[x](/deals/" onclick="alert(1))'],
  ['script close in table cell', '| a | b |\n|---|---|\n| </script><script>alert(1)</script> | <b onclick=alert(1)>x</b> |'],
  ['script close in heading', '## </script><script>alert(1)</script>'],
  ['html comment', '<!-- <script>alert(1)</script> -->'],
  ['callout with markup', '> **Note:** <iframe src=javascript:alert(1)></iframe>'],
  ['entity in text', '&lt;script&gt;alert(1)&lt;/script&gt; &#60;img src=x onerror=alert(1)&#62;'],
];
// ('bracket breakout' is not here: its "](javascript:...)" tail is never a link candidate, only text; it must be inert)
const mustReject = new Set(['nested brackets, inner javascript', 'javascript plain', 'javascript mixed case', 'javascript entity', 'javascript hex entity', 'javascript named colon entity', 'javascript leading space', 'javascript tab inside', 'javascript percent-encoded', 'data url', 'vbscript', 'protocol-relative', 'backslash host', 'quote breakout external', 'quote breakout internal']);
for (const [name, src] of xss) {
  const out = renderMarkdown(src, { link: (p) => '..' + p });
  const bad = unsafe(out.html);
  check('xss inert: ' + name, bad.length === 0, bad.join('; ') + ' in ' + out.html);
  if (mustReject.has(name)) check('xss rejected href recorded: ' + name, out.rejected.length >= 1 || name === 'nested brackets, inner javascript', JSON.stringify(out.rejected));
  check('xss no live script: ' + name, !/<script/i.test(out.html) && !/<iframe/i.test(out.html) && !/<img/i.test(out.html) && !/<svg/i.test(out.html));
}
// the rejected link keeps its words
check('rejected link keeps its text', renderMarkdown('[click me](javascript:alert(1))').html === '<p>click me</p>');
check('nested label renders as text inside the safe link', renderMarkdown('[[inner](javascript:alert(1))](/deals/)', { link: (p) => '..' + p }).html === '<p><a href="../deals/">[inner](javascript:alert(1))</a></p>', renderMarkdown('[[inner](javascript:alert(1))](/deals/)', { link: (p) => '..' + p }).html);
check('table cell script escaped', renderMarkdown('| a |\n|---|\n| </script> |').html.includes('<td>&lt;/script&gt;</td>'));

const fired = controlMisses.length === 0 && controlClean;
for (const f of fails) console.log('FAIL ' + f);
console.log(`md-selftest: ${n - fails.length}/${n} checks pass (${xss.length} XSS controls inert); checker control ${fired ? 'fired (all ' + planted.length + ' planted unsafe strings flagged, a clean string not)' : 'DID NOT FIRE: ' + JSON.stringify({ controlMisses, controlClean })}`);
process.exit(!fired ? 3 : fails.length ? 1 : 0);
