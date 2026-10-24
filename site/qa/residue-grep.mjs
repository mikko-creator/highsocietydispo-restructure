// residue-grep.mjs - no trace of the reference site (the competitor whose page structure this site follows) survives in
// what this site builds or ships: its name, domain, blog name, loyalty program, house brands, sister banners, events or
// venues. The patterns come from qa/reference-patterns.mjs (a local file, never published).
//   node qa/residue-grep.mjs [--dir dist] [--dir src/content ...] [--json out.json]
// FAIL patterns are unambiguous and fail the run. REVIEW patterns are words with an innocent meaning too (a common word
// that starts a sentence, a generic product name): every hit is printed with its context to be read, and they do not
// fail the run.
// Positive control (always runs): every FAIL pattern must fire on a planted string, and a planted innocent sentence must
// not fire; otherwise exit 3. Binary files are skipped by extension.
import fs from 'node:fs';
import path from 'node:path';
import { loadReference } from './reference-patterns.mjs';

const argv = process.argv.slice(2);
const dirs = [];
let jsonOut = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dir') dirs.push(path.resolve(argv[++i]));
  else if (argv[i] === '--json') jsonOut = path.resolve(argv[++i]);
}
if (!dirs.length) dirs.push(path.resolve('dist'));

const { fail: FAIL, review: REVIEW, planted, innocent } = loadReference();
const SKIP = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp4|webm|zip|pdf)$/i;

// controls
let controlOk = true;
FAIL.forEach(([name, re], k) => { if (!planted.some((s) => re.test(s))) { console.error('control: FAIL pattern "' + name + '" did not fire on any planted string'); controlOk = false; } });
for (const [name, re] of FAIL) if (re.test(innocent)) { console.error('control: FAIL pattern "' + name + '" fired on the innocent sentence'); controlOk = false; }
if (!controlOk) process.exit(3);

const files = [];
const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); if (e.isDirectory()) { if (e.name !== '.git' && e.name !== 'node_modules') walk(q); } else if (!SKIP.test(e.name)) files.push(q); } };
for (const d of dirs) { if (!fs.existsSync(d)) { console.error('missing dir ' + d); process.exit(2); } walk(d); }
// the patterns file is outside the scanned folders; these two tools only read it
const SELF = new Set(['residue-grep.mjs', 'overlap-check.mjs']);

const report = { fail: [], review: [] };
for (const f of files) {
  if (SELF.has(path.basename(f))) continue;
  const text = fs.readFileSync(f, 'utf8');
  for (const [tier, list] of [['fail', FAIL], ['review', REVIEW]]) {
    for (const [name, re] of list) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(text))) {
        const ctx = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).replace(/\s+/g, ' ');
        report[tier].push({ file: path.relative(process.cwd(), f).split(path.sep).join('/'), pattern: name, match: m[0], ctx });
        if (report[tier].length > 5000) break;
      }
    }
  }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1) + '\n');
for (const h of report.fail.slice(0, 60)) console.log(`FAIL   ${h.file}  [${h.pattern}] "${h.match}"  ...${h.ctx}...`);
for (const h of report.review.slice(0, 60)) console.log(`review ${h.file}  [${h.pattern}] "${h.match}"  ...${h.ctx}...`);
console.log(`residue: ${files.length} files scanned in ${dirs.map((d) => path.relative(process.cwd(), d) || '.').join(', ')}; ${report.fail.length} FAIL, ${report.review.length} to review; controls OK`);
process.exitCode = report.fail.length ? 1 : 0;
