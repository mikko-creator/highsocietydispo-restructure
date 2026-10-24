// pageshots.mjs — full-page screenshots that keep the REAL viewport (v2's sections are sized in svh, so a capture that
// resizes the viewport to the page height stretches them): one Chrome, one page; for each url x width it scrolls the
// page in viewport steps, captures each screen, then stitches them (Python + Pillow). The fixed header and the dock
// show on the first screen only. The age gate is answered before load.
//   node qa/pageshots.mjs --base http://127.0.0.1:8841 --paths /,/about/ --widths 1280,390 [--height 800] --out ../tmp/shots
// Writes <out>/<name>.<width>.png (name from the path: "home", "about", "blog-x"). Prints scrollWidth per capture.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './cdp.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const paths = String(args.paths || '/').split(',');
const widths = String(args.widths || '1280,390').split(',').map(Number);
const H = Number(args.height || 800);
const out = path.resolve(args.out || 'tmp/shots');
fs.mkdirSync(out, { recursive: true });
const nameOf = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-'));
const b = await launch({ port: 0 });
let failed = 0;
try {
  const pg = await b.newPage({ width: widths[0], height: H });
  await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('pitstop-age-ok','1')}catch(e){}" });
  for (const p of paths) {
    for (const w of widths) {
      await pg.viewport(w, H);
      await pg.goto(args.base + p, { settle: 700 });
      await pg.eval('document.fonts.ready.then(() => true)');
      const total = await pg.eval('document.documentElement.scrollHeight');
      for (let y = 0; y < total; y += H) { await pg.eval(`scrollTo(0, ${y})`); await sleep(220); }
      await pg.eval('scrollTo(0, 0)'); await sleep(500);
      await pg.eval(`Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 6000); })))`);
      const sw = await pg.eval('document.documentElement.scrollWidth');
      const tiles = [];
      const full = await pg.eval('document.documentElement.scrollHeight');
      for (let y = 0, k = 0; y < full; y += H, k++) {
        await pg.eval(`scrollTo(0, ${y})`); await sleep(260);
        if (k === 1) await pg.eval(`(() => { const s = document.createElement('style'); s.id = 'shot-hide'; s.textContent = '.site-header, .dock { visibility: hidden !important; }'; document.head.appendChild(s); })()`);
        const at = await pg.eval('Math.round(scrollY)');
        const r = await pg.send('Page.captureScreenshot', { format: 'png' });
        const f = path.join(out, `.tile-${k}.png`);
        fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
        tiles.push({ f, at });
      }
      await pg.eval(`(() => { const s = document.getElementById('shot-hide'); if (s) s.remove(); })()`);
      const file = path.join(out, `${nameOf(p)}.${w}.png`);
      const py = `import json,sys\nfrom PIL import Image\nt=json.loads(sys.argv[1]);H=int(sys.argv[2]);full=int(sys.argv[3])\nims=[(Image.open(x['f']),x['at']) for x in t]\nW=ims[0][0].size[0]\nc=Image.new('RGB',(W,full),'white')\nfor im,at in ims: c.paste(im.convert('RGB'),(0,at))\nc.save(sys.argv[4])\n`;
      const r = spawnSync('python', ['-X', 'utf8', '-I', '-c', py, JSON.stringify(tiles), String(H), String(full), file], { encoding: 'utf8' });
      if (r.status !== 0) { failed++; console.log('stitch failed', r.stderr.slice(0, 300)); }
      for (const t of tiles) fs.rmSync(t.f, { force: true });
      console.log(`${w} ${p} scrollWidth ${sw} ${sw > w ? 'OVERFLOW' : 'ok'} height ${full} -> ${path.relative(process.cwd(), file)}`);
    }
  }
} finally { await b.close(); }
process.exit(failed ? 1 : 0);
