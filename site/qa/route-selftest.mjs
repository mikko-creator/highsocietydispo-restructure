// route-selftest.mjs — proves src/lib/route.mjs: depth 0..3, rel() between depths, fragments and queries, CMS tokens,
// externals, v2 hrefs, canonical. Positive control: a planted WRONG expectation must be reported as a failure by the
// same checker, else the run exits 3 (a checker that cannot fail proves nothing).
//   node qa/route-selftest.mjs      exit 0 all pass + control fired; 1 a case failed; 3 the control did not fire
import { normalize, depth, rel, asset, canonical, fromV2, isToken, isExternal } from '../src/lib/route.mjs';
import { makeHelpers } from '../src/lib/h.mjs';

const results = [];
const eq = (name, got, want) => { const ok = Object.is(got, want); results.push({ name, ok, got, want }); return ok; };
const throws = (name, fn) => { let t = false; try { fn(); } catch { t = true; } results.push({ name, ok: t, got: t ? 'threw' : 'returned', want: 'throws' }); return t; };

// normalize
eq('normalize root', normalize('/'), '/');
eq('normalize empty', normalize(''), '/');
eq('normalize adds slashes', normalize('about'), '/about/');
eq('normalize collapses //', normalize('//blog///x//'), '/blog/x/');
eq('normalize dot segments', normalize('/a/./b/../c'), '/a/c/');
eq('normalize file keeps name', normalize('/search-index.json'), '/search-index.json');
eq('normalize keeps query+hash', normalize('/search?q=thc#r'), '/search/?q=thc#r');
throws('normalize refuses to escape root', () => normalize('/../x'));

// depth 0..3
eq('depth 0', depth('/'), 0);
eq('depth 0 file', depth('/404.html'), 0);
eq('depth 1', depth('/about/'), 1);
eq('depth 2', depth('/blog/what-is-thca/'), 2);
eq('depth 3', depth('/blog/p/2/'), 3);
eq('depth ignores query/hash', depth('/deals/?x=1#y'), 1);

// rel across depths
eq('rel 0->0 same', rel('/', '/'), './');
eq('rel 1->1 same', rel('/about/', '/about/'), './');
eq('rel 0->1', rel('/', '/deals/'), 'deals/');
eq('rel 1->0', rel('/about/', '/'), '../');
eq('rel 2->1', rel('/blog/x/', '/deals/'), '../../deals/');
eq('rel 2->2 sibling', rel('/blog/x/', '/blog/y/'), '../y/');
eq('rel 2->1 parent', rel('/blog/x/', '/blog/'), '../');
eq('rel 3->1', rel('/blog/p/2/', '/blog/'), '../../');
eq('rel 3->3', rel('/blog/p/2/', '/blog/p/3/'), '../3/');
eq('rel 1->3', rel('/deals/', '/blog/cannabis-101/p/2/'), '../blog/cannabis-101/p/2/');
eq('rel to file', rel('/blog/x/', '/search-index.json'), '../../search-index.json');
eq('rel from file page', rel('/404.html', '/deals/'), 'deals/');
// fragments and queries
eq('rel same page fragment', rel('/about/', '/about/#team'), '#team');
eq('rel root fragment', rel('/', '/#deals'), '#deals');
eq('rel other page fragment', rel('/about/', '/#deals'), '../#deals');
eq('rel query kept', rel('/blog/x/', '/search/?q=sleep'), '../../search/?q=sleep');
eq('rel same page query', rel('/search/', '/search/?q=a'), './?q=a');
eq('rel query+hash kept', rel('/a/b/', '/c/?q=1#h'), '../../c/?q=1#h');

// assets
eq('asset depth 0', asset('/', 'assets/x.webp'), 'assets/x.webp');
eq('asset depth 2', asset('/blog/x/', 'assets/x.webp'), '../../assets/x.webp');
eq('asset depth 3', asset('/blog/p/2/', 'styles/site.css'), '../../../styles/site.css');
eq('asset external kept', asset('/a/', 'https://cdn.example/x.png'), 'https://cdn.example/x.png');

// canonical
eq('canonical root', canonical('/'), 'https://highsocietydispo.com/');
eq('canonical page', canonical('blog//x'), 'https://highsocietydispo.com/blog/x/');
eq('canonical drops query', canonical('/search/?q=1'), 'https://highsocietydispo.com/search/');

// v2 hrefs
eq('fromV2 dir index', fromV2('loyalty/index.html'), '/loyalty/');
eq('fromV2 root index', fromV2('index.html'), '/');
eq('fromV2 nested', fromV2('dispensary-locations/big-rapids/index.html'), '/dispensary-locations/big-rapids/');
eq('fromV2 fragment untouched', fromV2('#deals'), '#deals');
eq('fromV2 bare hash untouched', fromV2('#'), '#');
eq('fromV2 empty untouched', fromV2(''), '');
eq('fromV2 token untouched', fromV2('{{location_shop_url}}'), '{{location_shop_url}}');
eq('fromV2 token+query untouched', fromV2('{{location_shop_url}}?dtche[path]=products&dtche[search]=mi+jane'), '{{location_shop_url}}?dtche[path]=products&dtche[search]=mi+jane');
eq('fromV2 https untouched', fromV2('https://apps.apple.com/us/app/high-society-cannabis/id6503314334'), 'https://apps.apple.com/us/app/high-society-cannabis/id6503314334');
eq('fromV2 tel untouched', fromV2('tel:(989) 244-3001'), 'tel:(989) 244-3001');
eq('fromV2 site path kept', fromV2('/deals/'), '/deals/');
eq('isToken', isToken('{{location_shop_url}}'), true);
eq('isExternal protocol-relative', isExternal('//evil.example/x'), true);
eq('isExternal site path', isExternal('/deals/'), false);

// a first segment with a colon must stay a path from the home (else "javascript:..." becomes a scheme)
eq('rel colon segment from the home', rel('/', '/javascript:alert(1);/x/'), './javascript:alert(1);/x/');
eq('rel plain segment from the home', rel('/', '/deals/'), 'deals/');

// h.href: site paths, #id, CMS tokens at the start, https/http, mailto and tel pass; every other scheme throws
const hh = makeHelpers({ content: {}, images: {}, origin: 'https://highsocietydispo.com', page: '/about/' });
const hrefOf = (u) => { try { return hh.href(u); } catch { return 'THROWS'; } };
eq('href site path', hrefOf('/deals/'), '../deals/');
eq('href v2 path', hrefOf('loyalty/index.html'), '../loyalty/');
eq('href token with query', hrefOf('{{location_shop_url}}?dtche[path]=products'), '{{location_shop_url}}?dtche[path]=products');
eq('href tel with spaces', hrefOf('tel:(269) 231-5213'), 'tel:(269) 231-5213');
for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:x', 'data:text/html,x', 'vbscript:x', '//evil.example/', 'javascript:alert(1)//{{x}}', 'x{{a}}']) eq('href refuses ' + bad, hrefOf(bad), 'THROWS');

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log('FAIL ' + r.name + ': got ' + JSON.stringify(r.got) + ' want ' + JSON.stringify(r.want));

// positive control: a planted expectation that no implementation produces must be reported as a failure (it is not
// the likeliest real bug's output, so a broken rel() fails its cases instead of silencing the control)
const before = results.length;
const controlOk = eq('PLANTED WRONG CASE', rel('/blog/x/', '/deals/'), 'planted-never-a-real-output/');
results.splice(before);
const fired = controlOk === false;

console.log(`route-selftest: ${results.length - failed.length}/${results.length} cases pass; control ${fired ? 'fired (a planted wrong expectation was reported as a failure)' : 'DID NOT FIRE'}`);
process.exit(!fired ? 3 : failed.length ? 1 : 0);
