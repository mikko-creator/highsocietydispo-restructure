// run-gates.mjs - the integration gate run on the whole site: build twice (byte-identical), then every gate, each with
// its own positive control, and one table of exit codes and summary lines. Nothing is piped, so exit codes are real.
//   node qa/run-gates.mjs [--skip-build] [--allow-pending] [--browser] [--json ../tmp/gates.json]
//   --allow-pending   preview mode: the build and link-check allow pending paths and planned pages not built yet
//                     (site.json pending.paths, src/content/planned.json); without it the build runs --strict (publish)
//   --browser         also jserrors + overflow (390 and 1280) on a sample of pages: ONE headless Chrome at a time
// Exit 0 when every gate exits 0; 3 when any gate reports a dead control (its exit 3); otherwise 1.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WS = path.resolve(SITE, '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const val = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const DIST = path.join(SITE, 'dist');
const DIST2 = path.join(WS, 'tmp', 'gates-dist2');
const node = process.execPath;
const rows = [];

function run(name, args, { summary = /./, cwd = SITE, timeout = 15 * 60e3 } = {}) {
  const t0 = Date.now();
  const r = spawnSync(node, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 256 << 20 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  const line = [...lines].reverse().find((l) => summary.test(l)) || lines[lines.length - 1] || '';
  const code = r.status === null ? 124 : r.status;
  rows.push({ gate: name, exit: code, secs: Math.round((Date.now() - t0) / 1000), summary: line.slice(0, 220) });
  fs.mkdirSync(path.join(WS, 'tmp', 'gates'), { recursive: true });
  fs.writeFileSync(path.join(WS, 'tmp', 'gates', name.replace(/[^a-z0-9-]+/gi, '_') + '.log'), out);
  return { code, out };
}

// ---- build twice, prove determinism
if (!has('skip-build')) {
  const strict = has('allow-pending') ? [] : ['--strict'];
  run('build', ['src/tools/build.mjs', ...strict], { summary: /built|pages|FAILED/i });
  fs.rmSync(DIST2, { recursive: true, force: true });
  run('build-2', ['src/tools/build.mjs', '--out', DIST2, ...strict], { summary: /built|pages|FAILED/i });
  run('hashdir', ['qa/hashdir.mjs', DIST, DIST2], { summary: /IDENTICAL|DIFFER|differ/i });
  run('hashdir-control', ['qa/hashdir.mjs', DIST, '--control'], { summary: /control/i });
}
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('no dist/index.html: build first'); process.exit(2); }

// ---- static gates
run('route-selftest', ['qa/route-selftest.mjs'], { summary: /route-selftest/ });
run('md-selftest', ['qa/md-selftest.mjs'], { summary: /md-selftest|checks pass/i });
run('link-check', ['qa/link-check.mjs', '--dir', DIST, ...(has('allow-pending') ? ['--allow-pending'] : [])], { summary: /broken|link-check/i });
run('seo-check', ['qa/seo-check.mjs', '--dir', DIST], { summary: /seo-check|pages/i });
run('residue', ['qa/residue-grep.mjs', '--dir', DIST, '--dir', path.join(SITE, 'src', 'content')], { summary: /FAIL|residue/i });
run('overlap', ['qa/overlap-check.mjs', '--dir', DIST], { summary: /^reference:/ });
run('overlap-control', ['qa/overlap-check.mjs', '--files', path.join(DIST, 'index.html'), '--control'], { summary: /control|DETECTED|MISSED/i });
run('hs-parity', ['qa/hs-parity.mjs', '--dist', DIST, '--show', '8'], { summary: /^hs-parity:/ });
run('article-gate', ['qa/article-gate.mjs', '--dir', path.join(SITE, 'src', 'content', 'blog')], { summary: /^article-gate:/ });

// ---- meta-language and placeholder scan of what visitors read (<main> text of every built page)
{
  const BAD = /(Please add a content|lorem ipsum|\bTODO\b|\bTBD\b|\bplaceholder\b|as an AI|\{\{[a-z_]+\}\}|\[\[[^\]]*\]\]|undefined|\bNaN\b|\[object Object\])/i;
  const text = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<template[\s\S]*?<\/template>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) files.push(p); } };
  walk(DIST);
  const hits = [];
  for (const f of files) {
    const h = fs.readFileSync(f, 'utf8');
    const main = (h.match(/<main[\s\S]*?<\/main>/i) || [''])[0];
    const m = text(main).match(BAD);
    if (m) hits.push(path.relative(DIST, f).split(path.sep).join('/') + ': "' + m[0] + '"');
  }
  const control = BAD.test(text('<main><p>Please add a content...</p></main>')) && !BAD.test(text('<main><p>Order ahead for pickup.</p></main>'));
  fs.writeFileSync(path.join(WS, 'tmp', 'gates', 'placeholder-scan.log'), hits.join('\n') + '\n');
  rows.push({ gate: 'placeholder-scan', exit: !control ? 3 : hits.length ? 1 : 0, secs: 0, summary: `${files.length} pages, ${hits.length} with placeholder/meta text${hits.length ? ' (first: ' + hits[0] + ')' : ''}; control ${control ? 'OK' : 'DEAD'}` });
}

// ---- browser gates (opt-in): one server, one Chrome at a time
if (has('browser')) {
  const port = 8900 + (process.pid % 90);
  const srv = spawn(node, ['qa/serve.mjs', '--root', DIST, '--port', String(port), '--no-open', '--not-found', '404.html'], { cwd: SITE, stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 1200));
    const base = `http://127.0.0.1:${port}`;
    const sample = ['/', '/dispensary-locations/', '/dispensary-locations/big-rapids/', '/deals/', '/club-member-program/', '/getting-a-medical-card/', '/cannabis-laws-by-state/michigan/', '/faq/', '/blog/', '/blog/recipes/'];
    const art = fs.readdirSync(path.join(SITE, 'src', 'content', 'blog')).filter((f) => f.endsWith('.json')).sort()[0];
    if (art) sample.push('/blog/' + art.replace(/\.json$/, '') + '/');
    const paths = sample.filter((p) => fs.existsSync(path.join(DIST, ...p.split('/').filter(Boolean), 'index.html')));
    run('jserrors', ['qa/jserrors.mjs', '--base', base, '--paths', paths.join(',')], { summary: /error|exception|0 /i });
    for (const w of [390, 1280]) for (const p of paths) {
      const r = run(`overflow-${w}${p.replace(/\//g, '_')}`, ['qa/overflow.mjs', '--url', base + p, '--width', String(w)], { summary: /overflow|wider|none|scrollWidth/i });
      if (r.code === 0) rows.pop(); // keep the table short: only failing overflow rows
    }
    rows.push({ gate: 'overflow', exit: rows.some((r) => r.gate.startsWith('overflow-') && r.exit) ? 1 : 0, secs: 0, summary: `${paths.length} pages x 390/1280; failing rows listed above` });
  } finally { srv.kill(); }
}

// ---- report
const w = Math.max(...rows.map((r) => r.gate.length));
for (const r of rows) console.log(`${r.exit === 0 ? 'ok  ' : 'FAIL'} ${r.gate.padEnd(w)}  exit ${String(r.exit).padEnd(3)} ${String(r.secs).padStart(4)}s  ${r.summary}`);
if (val('json')) fs.writeFileSync(path.resolve(val('json')), JSON.stringify(rows, null, 1) + '\n');
const dead = rows.some((r) => r.exit === 3), bad = rows.some((r) => r.exit !== 0);
console.log(`run-gates: ${rows.length} gates, ${rows.filter((r) => r.exit === 0).length} ok, ${rows.filter((r) => r.exit !== 0).length} failing${dead ? ', a CONTROL IS DEAD' : ''} (logs: tmp/gates/)`);
process.exitCode = dead ? 3 : bad ? 1 : 0;
