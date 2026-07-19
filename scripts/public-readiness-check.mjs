import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PRIVATE_TEST = process.argv.includes('--private-test');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');
const HEADERS = path.join(DIST, '_headers');
const ROBOTS = path.join(DIST, 'robots.txt');
const MANIFEST = path.join(DIST, 'deploy-manifest.json');
const STANDALONE = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const DATA_IDS = [
  'data-pokemon',
  'data-moves',
  'data-abilities',
  'data-items',
  'data-natures',
  'data-typechart',
  'data-rules',
  'data-meta-threats',
];
const ASSET_BUDGETS = {
  theme: { sizeBytes: 16 * 1024, gzipBytes: 8 * 1024 },
  style: { sizeBytes: 420 * 1024, gzipBytes: 80 * 1024 },
  data: { sizeBytes: 1100 * 1024, gzipBytes: 230 * 1024 },
  app: { sizeBytes: 800 * 1024, gzipBytes: 190 * 1024 },
  worker: { sizeBytes: 300 * 1024, gzipBytes: 80 * 1024 },
};
const TOTAL_GZIP_BUDGET = 520 * 1024;

let failed = false;

function check(condition, label) {
  if (condition) console.log(`[PASS] ${label}`);
  else {
    failed = true;
    console.error(`[FAIL] ${label}`);
  }
}

function read(file) {
  return readFileSync(file, 'utf8');
}

for (const [file, label] of [
  [STANDALONE, 'standalone artifact'],
  [INDEX, 'public index'],
  [HEADERS, 'hosting headers'],
  [ROBOTS, 'robots policy'],
  [MANIFEST, 'deploy manifest'],
]) {
  check(existsSync(file), `${label} exists`);
}

if (![STANDALONE, INDEX, HEADERS, ROBOTS, MANIFEST].every(existsSync)) process.exit(1);

const standalone = read(STANDALONE);
const index = read(INDEX);
const headers = read(HEADERS);
const robots = read(ROBOTS);
let manifest = null;
try {
  manifest = JSON.parse(read(MANIFEST));
  check(true, 'deploy manifest parses');
} catch (error) {
  check(false, `deploy manifest parses (${error.message})`);
}

check(index.includes('<!DOCTYPE html>'), 'public index is a complete HTML document');
check(index.includes('<meta charset="UTF-8">'), 'public index declares charset');
check(index.includes('name="viewport"'), 'public index declares viewport');
check(index.includes('<meta name="robots" content="index,follow">'), 'source index keeps the public robots metadata');
check(index.length < standalone.length, 'public index is smaller than the standalone artifact');
check(!index.includes('<style'), 'public index has no inline style blocks');
check(!/\sstyle=["']/.test(index), 'public index has no inline style attributes');
check(!/\son[a-z]+=["']/.test(index), 'public index has no inline event handlers');
check(!/__[A-Z0-9_]+__/.test(index), 'public index has no unresolved build placeholders');

const stylesheetHrefs = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
const scriptSrcs = [...index.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map((match) => match[1]);
const workerSourceMatch = index.match(/<script id="reverse-worker-source" type="application\/json" data-worker-src="([^"]+)"><\/script>/);
const workerSource = workerSourceMatch?.[1] || '';
const executableInlineScripts = [...index.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((match) => !/type="application\/json"/.test(match[1]) && !/\ssrc=/.test(match[1]) && match[2].trim());

check(stylesheetHrefs.length === 1, 'public index loads one external stylesheet');
check(scriptSrcs.length === 3, 'public index loads theme, data, and app scripts externally');
check(Boolean(workerSource), 'public index references a lazy reverse-analysis worker');
check(executableInlineScripts.length === 0, 'public index has no executable inline scripts');

const referencedAssets = [...stylesheetHrefs, ...scriptSrcs, workerSource].filter(Boolean);
check(referencedAssets.every((source) => /^\.\/assets\/[a-z-]+\.[a-f0-9]{12}\.(?:css|js)$/.test(source)), 'public assets use content-hashed filenames');
for (const source of referencedAssets) {
  const assetPath = path.join(DIST, source.replace(/^\.\//, ''));
  check(existsSync(assetPath) && statSync(assetPath).size > 0, `${source} exists and is non-empty`);
}

for (const id of DATA_IDS) {
  check(index.includes(`<script id="${id}" type="application/json"></script>`), `${id} has an empty bootstrap target`);
}

check(!headers.includes("'unsafe-inline'"), 'CSP does not allow unsafe-inline scripts or styles');
check(headers.includes("script-src 'self'"), 'CSP limits scripts to same-origin assets');
check(headers.includes("style-src 'self'"), 'CSP limits styles to same-origin assets');
check(headers.includes("worker-src 'self' blob:"), 'CSP permits same-origin and standalone reverse calculator workers');
check(headers.includes("object-src 'none'"), 'CSP blocks object embeds');
check(headers.includes('max-age=31536000, immutable'), 'hashed assets have immutable cache headers');
if (PRIVATE_TEST) {
  check(headers.includes('X-Robots-Tag: noindex'), 'private test headers block indexing');
  check(robots.includes('Disallow: /'), 'private test robots policy blocks crawling');
  check(!/class="(?:ad-rail|side-rail)/.test(index), 'private test index omits advertising rails');
} else {
  check(!headers.includes('X-Robots-Tag: noindex'), 'public headers do not block indexing');
  check(robots.includes('Allow: /') && !robots.includes('Disallow: /'), 'public robots policy allows crawling');
}

if (manifest) {
  check(manifest.mode === (PRIVATE_TEST ? 'private-test' : 'public'), `deploy manifest records ${PRIVATE_TEST ? 'private test' : 'public'} mode`);
  check(manifest.artifact === 'index.html', 'deploy manifest records index artifact');
  check(manifest.sizeBytes === statSync(INDEX).size, 'deploy manifest records the current index size');
  check(Object.keys(manifest.assets || {}).sort().join(',') === 'app,data,style,theme,worker', 'deploy manifest records all asset roles');
  let totalGzipBytes = 0;
  for (const [role, budget] of Object.entries(ASSET_BUDGETS)) {
    const entry = manifest.assets?.[role];
    if (!entry) continue;
    const assetPath = path.join(DIST, 'assets', entry.file);
    check(entry.sizeBytes === statSync(assetPath).size, `${role} manifest size matches the emitted asset`);
    check(Number.isInteger(entry.gzipBytes) && entry.gzipBytes > 0, `${role} manifest records gzip size`);
    check(entry.sizeBytes <= budget.sizeBytes, `${role} raw size stays within budget (${entry.sizeBytes}/${budget.sizeBytes})`);
    check(entry.gzipBytes <= budget.gzipBytes, `${role} gzip size stays within budget (${entry.gzipBytes}/${budget.gzipBytes})`);
    totalGzipBytes += entry.gzipBytes || 0;
  }
  check(totalGzipBytes <= TOTAL_GZIP_BUDGET, `total asset gzip size stays within budget (${totalGzipBytes}/${TOTAL_GZIP_BUDGET})`);
}

if (failed) process.exit(1);
