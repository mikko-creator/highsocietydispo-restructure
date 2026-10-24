// reference-patterns.mjs - the names of the reference site (the competitor whose page structure this site follows): its
// business, domain, brands, banners, blog and events, the planted strings that prove the patterns fire, and where its
// crawl lives. They are kept in tmp/reference-patterns.json at the workspace root, a local file that is never published,
// so no published file names the reference. residue-grep, the article gate and overlap-check read them; without the file
// (outside the working project) those checks stop with exit 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE = path.resolve(HERE, '..', '..');
export const REFERENCE_FILE = path.join(WORKSPACE, 'tmp', 'reference-patterns.json');

// -> { corpus, fail: [[name, RegExp]], review: [[name, RegExp]], planted: [string], innocent, articlePlant }
export function loadReference(file = REFERENCE_FILE) {
  if (!fs.existsSync(file)) {
    console.error(`no reference patterns at ${file} (local to the working project, never published)`);
    process.exit(2);
  }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rx = (list) => list.map(([name, source, flags]) => [name, new RegExp(source, flags)]);
  return { corpus: path.resolve(WORKSPACE, d.corpus), fail: rx(d.fail), review: rx(d.review), planted: d.planted, innocent: d.innocent, articlePlant: d.articlePlant };
}
