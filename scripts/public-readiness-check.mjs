import { parse } from 'acorn';
import { buildGameData } from './build-game-data.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PRIVATE_TEST = process.argv.includes('--private-test');
const AD_FREE = process.argv.includes('--ad-free');
if (PRIVATE_TEST && AD_FREE) throw new Error('Choose either --private-test or --ad-free, not both.');
const RAIL_FREE = PRIVATE_TEST || AD_FREE;
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');
const NOT_FOUND = path.join(DIST, '404.html');
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
];
const ASSET_BUDGETS = {
  theme: { sizeBytes: 1024, gzipBytes: 1024 },
  style: { sizeBytes: 360 * 1024, gzipBytes: 55 * 1024 },
  data: { sizeBytes: 950 * 1024, gzipBytes: 170 * 1024 },
  app: { sizeBytes: 400 * 1024, gzipBytes: 100 * 1024 },
  // The on-demand worker now includes observed exchange transitions and next-action forecasts.
  worker: { sizeBytes: 256 * 1024, gzipBytes: 68 * 1024 },
  featureDex: { sizeBytes: 80 * 1024, gzipBytes: 25 * 1024 },
  featureMatchup: { sizeBytes: 50 * 1024, gzipBytes: 18 * 1024 },
  featureFinetune: { sizeBytes: 70 * 1024, gzipBytes: 24 * 1024 },
  featureRevcalc: { sizeBytes: 240 * 1024, gzipBytes: 60 * 1024 },
};
// M-C data plus rebuilt reverse cards/state handling add about 5 KiB gzip over the prior release.
const TOTAL_GZIP_BUDGET = 448 * 1024;

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
  [INDEX, 'public index'],
  [NOT_FOUND, '404 page'],
  [HEADERS, 'hosting headers'],
  [ROBOTS, 'robots policy'],
  [MANIFEST, 'deploy manifest'],
]) {
  check(existsSync(file), `${label} exists`);
}

if (![INDEX, NOT_FOUND, HEADERS, ROBOTS, MANIFEST].every(existsSync)) process.exit(1);

const referenceData = buildGameData();
const index = read(INDEX);
const notFound = read(NOT_FOUND);
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
check(Buffer.byteLength(index)<32*1024,'public HTML shell stays below 32 KiB');
check(!index.includes('<style'), 'public index has no inline style blocks');
check(!/\sstyle=["']/.test(index), 'public index has no inline style attributes');
check(!/\son[a-z]+=["']/.test(index), 'public index has no inline event handlers');
check(!/__(?!PURE__)[A-Z0-9_]+__/.test(index), 'public index has no unresolved build placeholders');
check(notFound.includes('<!DOCTYPE html>') && notFound.includes('href="/"'), '404 page is a complete document with a home link');
check(notFound.includes('<meta name="robots" content="noindex,follow">'), '404 page is excluded from search results');
check(/<link rel="stylesheet" href="\/assets\/[a-z-]+\.[a-f0-9]{12}\.css">/.test(notFound), '404 page uses a root-relative hashed stylesheet');

const stylesheetHrefs = [...index.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
const scriptSrcs = [...index.matchAll(/<script[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g)].map(match=>match[1]);
const workerSourceMatch=index.match(/<script id="reverse-worker-source" type="application\/json" data-worker-src="([^"]+)"><\/script>/);
const workerSource=workerSourceMatch?.[1] || '';
const featureSources=Object.fromEntries(['Dex','Matchup','Finetune','Revcalc'].map(name=>[name.toLowerCase(),manifest?.assets?.['feature'+name]?.path]).filter(([,path])=>path));
const executableInlineScripts = [...index.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter((match) => !/type="application\/json"/.test(match[1]) && !/\ssrc=/.test(match[1]) && match[2].trim());

check(stylesheetHrefs.length === 1, 'public index loads one external stylesheet');
check(scriptSrcs.length === 2 && /<script type="module" src=/.test(index), 'public index loads a theme bootstrap and an ES module entry');
check(Boolean(workerSource), 'public index references a lazy reverse-analysis worker');
check(Object.keys(featureSources).sort().join(',') === 'dex,finetune,matchup,revcalc', 'module manifest records all lazy page features');
check(executableInlineScripts.length === 0, 'public index has no executable inline scripts');

const referencedAssets = [...new Set([...stylesheetHrefs,...scriptSrcs,workerSource,...Object.values(manifest?.assets || {}).map(entry=>entry.path)])].filter(Boolean);
check(referencedAssets.every((source) => /^\.\/assets\/[a-z-]+\.(?:[a-f0-9]{12}|[A-Z0-9]{8})\.(?:css|js)$/.test(source)), 'public assets use content-hashed filenames');
for (const source of referencedAssets) {
  const assetPath = path.join(DIST, source.replace(/^\.\//, ''));
  check(existsSync(assetPath) && statSync(assetPath).size > 0, `${source} exists and is non-empty`);
}

for (const id of DATA_IDS) {
  check(!index.includes(`id="${id}"`), `${id} is absent from public HTML`);
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
} else {
  check(!headers.includes('X-Robots-Tag: noindex'), 'public headers do not block indexing');
  check(robots.includes('Allow: /') && !robots.includes('Disallow: /'), 'public robots policy allows crawling');
}
if (RAIL_FREE) {
  check(!/class="(?:ad-rail|side-rail)/.test(index), `${PRIVATE_TEST ? 'private test' : 'ad-free public'} index omits advertising rails`);
  check(index.includes('<body class="deployment-rail-free">'), `${PRIVATE_TEST ? 'private test' : 'ad-free public'} index declares the rail-free layout variant`);
} else {
  check(/class="(?:ad-rail|side-rail)/.test(index), 'advertising-ready public index retains advertising rails');
  check(!index.includes('deployment-rail-free'), 'advertising-ready public index does not enable the rail-free layout variant');
}

if (manifest) {
  const expectedMode = PRIVATE_TEST ? 'private-test' : AD_FREE ? 'public-ad-free' : 'public';
  check(manifest.mode === expectedMode, `deploy manifest records ${expectedMode} mode`);
  check(manifest.artifact === 'index.html', 'deploy manifest records index artifact');
  check(manifest.sizeBytes === statSync(INDEX).size, 'deploy manifest records the current index size');
  try {
    const dataSource = read(path.join(DIST, 'assets', manifest.assets.data.file));
    parse(dataSource,{ecmaVersion:'latest',sourceType:'module'});
    // No document is provided: loading public data must not depend on a DOM.
    const data = vm.runInNewContext(`${dataSource.replace(/^export \{.*?\};?$/gm,'')}\nJSON.stringify(PKM_DATA);`, {}, { timeout: 5000 });
    const payload = JSON.parse(data);
    for (const id of DATA_IDS) {
      check(JSON.stringify(payload[id.slice(5)]) === JSON.stringify(referenceData[id.slice(5)]), `${id} matches the normalized source data without an HTML intermediate`);
    }
  } catch (error) {
    check(false, `public data object is valid (${error.message})`);
  }
  check(manifest.architecture === 'esm-direct' && manifest.source === 'src/calc-template.html','public build uses the source template directly');
  check(Object.keys(ASSET_BUDGETS).every(role=>manifest.assets?.[role]),'deploy manifest records all required asset roles');
  let totalGzipBytes = 0;
  for (const [role, entry] of Object.entries(manifest.assets || {})) {
    const budget=ASSET_BUDGETS[role] || (role.startsWith('shared') ? ASSET_BUDGETS.app : null);
    if(!budget){check(false,`unknown asset role: ${role}`);continue;}
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

// Verify native ESM edges from the emitted files, not just declared entry tags.
function inspect(node,visit) {
  if(!node || typeof node !== 'object') return;
  visit(node);
  for(const value of Object.values(node)) {
    if(Array.isArray(value)) value.forEach(child=>inspect(child,visit));
    else if(value && typeof value==='object') inspect(value,visit);
  }
}
for(const entry of Object.values(manifest?.assets || {})) {
  if(!entry.file.endsWith('.js'))continue;
  const file=path.join(DIST,'assets',entry.file),source=read(file);
  check(!source.includes('__PKM_TEST_REGISTER__'),'production '+entry.file+' omits the test bridge');
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  inspect(ast,node=>{
    const sourceNode = node.type==='ImportDeclaration' || node.type==='ExportNamedDeclaration' || node.type==='ImportExpression' ? node.source : null;
    if(!sourceNode)return;
    const specifier=sourceNode.value;
    check(typeof specifier==='string' && specifier.startsWith('./') && existsSync(path.resolve(path.dirname(file),specifier)), `${entry.file} resolves module ${specifier}`);
  });
}
if(failed)process.exit(1);
