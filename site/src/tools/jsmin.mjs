// jsmin.mjs — comment + whitespace removal for site.js at build time (speed audit, 2026-10-22: 32.6 KB -> 21.4 KB raw,
// 9.5 -> 6.1 KB gzip), Node builtins only. No renaming, no rewriting; the source keeps every comment.
// A tokenizer separates strings, template literals (with ${} nesting), regex literals (by the previous significant
// token), comments, identifiers/numbers and punctuators. Output keeps a line break wherever the source had one between
// two tokens (so automatic semicolon insertion is unchanged); --safe keeps ALL line breaks, default drops a break where
// the previous token is one that can never end a statement ( { ( [ , ; : = operators ) and the next can never start a
// continuation hazard. A space is kept only where two tokens would otherwise fuse (ident ident, + +, - -, / regex).
// Self-check (build.mjs runs it): the significant token stream of the output must equal the input's, and vm.Script
// must compile it; either failing stops the build.

export function tokenize(src) {
  const toks = []; let i = 0; const n = src.length;
  const braceStack = []; // for template literal ${ } nesting: 'tpl' marks a template expression brace
  let nl = false; // a line break seen since the last significant token
  const prevSig = () => { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== 'ws') return toks[k]; return null; };
  const regexAllowed = () => {
    const p = prevSig(); if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 'tpl' || p.t === 're') return false;
    if (p.t === 'id') return /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/.test(p.v);
    if (p.t === 'p') return !/^[)\]}]$/.test(p.v) || false;
    return true;
  };
  const push = (t, v) => { toks.push({ t, v, nl }); nl = false; };
  const readTemplate = (start) => { // from a ` or a } that resumes a template; returns end index after ` or after ${
    let j = start;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return { end: j + 1, open: false };
      if (c === '$' && src[j + 1] === '{') return { end: j + 2, open: true };
      j++;
    }
    throw new Error('unterminated template');
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n' || c === '\r' || c === ' ' || c === ' ') { nl = true; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) throw new Error('unterminated comment'); if (/[\n\r]/.test(src.slice(i, e))) nl = true; i = e + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') throw new Error('newline in string at ' + j); j++; } push('str', src.slice(i, j + 1)); i = j + 1; continue; }
    if (c === '`') { const r = readTemplate(i + 1); push('tpl', src.slice(i, r.end)); if (r.open) braceStack.push('tpl'); i = r.end; continue; }
    if (c === '}' && braceStack.length && braceStack[braceStack.length - 1] === 'tpl') { braceStack.pop(); const r = readTemplate(i + 1); push('tpl', src.slice(i, r.end)); if (r.open) braceStack.push('tpl'); i = r.end; continue; }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < n) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '\n') throw new Error('newline in regex at ' + j); if (cls) { if (d === ']') cls = false; } else if (d === '[') cls = true; else if (d === '/') break; j++; }
      j++; while (j < n && /[a-z]/i.test(src[j])) j++;
      push('re', src.slice(i, j)); i = j; continue;
    }
    if (/[A-Za-z_$\u0080-￿]/.test(c)) { let j = i + 1; while (j < n && /[\w$\u0080-￿]/.test(src[j])) j++; push('id', src.slice(i, j)); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { let j = i + 1; while (j < n && /[\w.]/.test(src[j]) || (/[eE]/.test(src[j - 1]) && /[+-]/.test(src[j]) && /^[0-9.]/.test(src.slice(i)))) j++; push('num', src.slice(i, j)); i = j; continue; }
    // punctuators, longest first
    const P = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**'];
    const m = P.find((p) => src.startsWith(p, i)) || c;
    if (m === '{') braceStack.push('{');
    if (m === '}') braceStack.pop();
    push('p', m); i += m.length;
  }
  return toks;
}

const wordy = (t) => t.t === 'id' || t.t === 'num';
// a line break may be dropped after these: no statement can end on them
const NO_END = new Set(['{', '(', '[', ',', ';', ':', '=', '?', '.', '?.', '=>', '&&', '||', '??', '+', '-', '*', '/', '%', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+=', '-=', '*=', '/=', '&', '|', '^', '!', '~']);

export function minify(src, safe) {
  const toks = tokenize(src);
  let out = '';
  let prev = null;
  for (const t of toks) {
    if (prev) {
      let sep = '';
      if (t.nl) {
        const dropBreak = !safe && prev.t === 'p' && NO_END.has(prev.v) && !(prev.v === '+' || prev.v === '-');
        // a break before } ) ] , ; is never needed for ASI either
        const dropBefore = !safe && t.t === 'p' && /^[}\]),;]$/.test(t.v);
        sep = dropBreak || dropBefore ? '' : '\n';
      }
      if (!sep) {
        if (wordy(prev) && wordy(t)) sep = ' ';
        else if (prev.t === 'num' && t.t === 'p' && t.v === '.') sep = ' ';
        else if (prev.t === 'p' && t.t === 'p' && ((prev.v === '+' || prev.v === '++') && (t.v === '+' || t.v === '++') || (prev.v === '-' || prev.v === '--') && (t.v === '-' || t.v === '--'))) sep = ' ';
        else if (t.t === 're' && prev.t === 'p' && prev.v === '/') sep = ' ';
        else if (prev.t === 're' && wordy(t)) sep = ' ';
      }
      out += sep;
    }
    out += t.v;
    prev = t;
  }
  return out + '\n';
}
