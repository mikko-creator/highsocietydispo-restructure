// secret-scan.mjs - no credential may be published. Scans exactly the files git would publish from this workspace
// (`git ls-files -co --exclude-standard`: tracked + untracked-not-ignored, i.e. what `git add -A` stages), or every
// file under --dir (a preview copy, an unpacked zip). Node builtins only.
//   node tools/secret-scan.mjs [--dir <folder>] [--keys <file> ...] [--control]
// Patterns: Google API keys (AIza...), GitHub tokens (gh[pousr]_...), AWS access key ids, Slack tokens, Stripe live keys,
// PEM private-key headers, and the literal id and secret halves of every --keys file (fal.key / hf.key live OUTSIDE the
// project; their values are read here and never printed - hits print the file path and the pattern name only).
// --control plants every pattern in a temp folder and requires each to be found, then exits.
// Exit 1 on any hit or a control that does not fire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dirArg = argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : null;
const keyFiles = argv.flatMap((a, i) => (a === '--keys' && argv[i + 1] ? [argv[i + 1]] : []));
const PATTERNS = [
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ['aws-access-key-id', /\bAKIA[0-9A-Z]{16}\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['stripe-live-key', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/g],
];
for (const kf of keyFiles) {
  const v = fs.readFileSync(kf, 'utf8').trim();
  for (const [i, part] of v.split(':').entries()) if (part.length >= 16) PATTERNS.push([path.basename(kf) + (i ? ':secret' : ':id'), new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')]);
}
const TEXTISH = /\.(html?|css|js|mjs|cjs|json|jsonl|md|txt|xml|svg|ya?ml|sh|ps1|ini|cfg|env|log|csv|map|htaccess)$|(^|\/)(_redirects|\.gitignore|\.gitattributes|\.nojekyll|robots\.txt)$/i;

function list(dir) {
  if (dir) {
    const out = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git') continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); } }(dir));
    return out;
  }
  const raw = execFileSync('git', ['-C', ROOT, 'ls-files', '-co', '--exclude-standard', '-z'], { maxBuffer: 1 << 28 }).toString('utf8');
  return raw.split('\0').filter(Boolean).map((f) => path.join(ROOT, f));
}

function scan(files) {
  const hits = [];
  let scanned = 0, binary = 0;
  for (const f of files) {
    let buf;
    try { buf = fs.readFileSync(f); } catch { continue; }
    // binary files are scanned too (a soft-404 HTML saved under an image name once carried a key), as latin1 text
    const text = TEXTISH.test(f.split(path.sep).join('/')) ? buf.toString('utf8') : (binary++, buf.toString('latin1'));
    scanned++;
    for (const [name, re] of PATTERNS) { re.lastIndex = 0; const n = (text.match(re) || []).length; if (n) hits.push({ file: f, pattern: name, count: n }); }
  }
  return { scanned, binary, hits };
}

if (argv.includes('--control')) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-ctl-'));
  const planted = { 'a.html': 'key=AIza' + 'A'.repeat(35), 'b.js': 'gh' + 'p_' + 'a'.repeat(36), 'c.txt': 'AKIA' + 'ABCDEFGHIJKLMNOP', 'd.md': 'xox' + 'b-1234567890-abcdef', 'e.json': 'sk' + '_live_' + 'b'.repeat(24), 'f.pem': '-----BEGIN ' + 'PRIVATE KEY-----', 'g.webp': 'RIFF\u0000\u0000WEBPVP8 junk AIza' + 'B'.repeat(35) };
  for (const kf of keyFiles) planted['h-' + path.basename(kf) + '.txt'] = 'x ' + fs.readFileSync(kf, 'utf8').trim() + ' y';
  for (const [n, v] of Object.entries(planted)) fs.writeFileSync(path.join(t, n), v);
  const r = scan(list(t));
  const found = new Set(r.hits.map((h) => h.pattern));
  const want = PATTERNS.map((p) => p[0]);
  const missing = want.filter((w) => !found.has(w));
  fs.rmSync(t, { recursive: true, force: true });
  console.log('control', missing.length ? 'DID NOT FIRE for: ' + missing.join(', ') : 'FIRED for all ' + want.length + ' patterns (incl. a key inside a binary-named file)');
  process.exitCode = missing.length ? 1 : 0;
} else {
  const target = dirArg ? path.resolve(dirArg) : ROOT;
  const r = scan(list(dirArg ? target : null));
  console.log('secret-scan   ', dirArg ? target : 'git publish set of ' + ROOT, '| files', r.scanned, '(binary scanned as latin1:', r.binary + ')', '| patterns', PATTERNS.length, '| hits', r.hits.length);
  for (const h of r.hits) console.log('   HIT', h.pattern, h.count + 'x', path.relative(target, h.file));
  process.exitCode = r.hits.length ? 1 : 0;
}
