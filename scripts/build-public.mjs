import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const SOURCE_HTML = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const PRIVATE_TEST = process.argv.includes('--private-test');
const AD_FREE = process.argv.includes('--ad-free');
if (PRIVATE_TEST && AD_FREE) throw new Error('Choose either --private-test or --ad-free, not both.');
const RAIL_FREE = PRIVATE_TEST || AD_FREE;
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
const FEATURE_FILES = {
  dex: ['04-10-dex.js', '04-11-dex-detail.js'],
  matchup: ['04-20-matchup.js'],
  finetune: ['04-30-finetune.js', '04-31-finetune-render.js'],
  revcalc: [
    '04-40-revcalc-state.js',
    '04-41-revcalc-scoring.js',
    '04-42-revcalc-candidates.js',
    '04-43-revcalc-render.js',
    '04-44-revcalc-events.js',
    '04-45-revcalc-actions.js',
  ],
};
const RAIL_PATTERNS = [
  /\s*<aside class="ad-rail[^"]*"[\s\S]*?<\/aside>\s*/g,
  /\s*<aside class="side-rail[^"]*"[\s\S]*?<\/aside>\s*/g,
];

function runStandaloneBuild() {
  const result = spawnSync(process.execPath, ['build.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`build.mjs failed with exit code ${result.status}`);
  }
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function asset(name, extension, content) {
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  const file = `${name}.${hash(normalized)}.${extension}`;
  writeFileSync(path.join(ASSETS, file), normalized, 'utf8');
  return {
    file,
    path: `./assets/${file}`,
    sizeBytes: Buffer.byteLength(normalized),
    gzipBytes: gzipSync(normalized).byteLength,
  };
}

function writeStaticFile(name, content) {
  writeFileSync(path.join(DIST, name), `${content.trimEnd()}\n`, 'utf8');
}

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Unable to extract ${label} from standalone HTML.`);
  return match;
}

function extractInlineScript(source, predicate, label) {
  const matches = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  const match = matches.find((candidate) => !candidate[1].trim() && predicate(candidate[2]));
  if (!match) throw new Error(`Unable to extract ${label} from standalone HTML.`);
  return match;
}

function buildDataBootstrap(dataScripts) {
  const payload = dataScripts
    .map(({ id, raw }) => `    ${JSON.stringify(id)}: ${JSON.stringify(raw)}`)
    .join(',\n');
  return `(() => {
  const payloads = {
${payload}
  };
  for (const [id, value] of Object.entries(payloads)) {
    const node = document.getElementById(id);
    if (!node) throw new Error(\`Missing embedded data target: \${id}\`);
    node.textContent = value;
  }
})();`;
}

function splitApplicationSource(source) {
  const marker = /\/\* @source-file:([^*]+) \*\//g;
  const matches = [...source.matchAll(marker)];
  if (!matches.length) throw new Error('Application source file markers are missing.');
  const files = new Map();
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    files.set(match[1].trim(), source.slice(start, end).trim());
  });
  const deferred = new Set(Object.values(FEATURE_FILES).flat());
  for (const file of deferred) {
    if (!files.has(file)) throw new Error(`Deferred application source is missing: ${file}`);
  }
  return {
    core: [...files].filter(([file]) => !deferred.has(file)).map(([, body]) => body).join('\n\n'),
    features: Object.fromEntries(Object.entries(FEATURE_FILES).map(([page, pageFiles]) => [
      page,
      pageFiles.map(file => files.get(file)).join('\n\n'),
    ])),
  };
}

runStandaloneBuild();
if (!existsSync(SOURCE_HTML)) throw new Error(`Expected build output not found: ${SOURCE_HTML}`);

let html = readFileSync(SOURCE_HTML, 'utf8');
const styleMatch = requiredMatch(html, /<style>([\s\S]*?)<\/style>/, 'inline CSS');
const themeMatch = extractInlineScript(html, (body) => body.includes('pkchamps-theme'), 'theme bootstrap');
const appMatch = extractInlineScript(html, (body) => body.includes('"use strict";'), 'application JavaScript');
const applicationSource = splitApplicationSource(appMatch[2]);
const dataScripts = DATA_IDS.map((id) => {
  const match = requiredMatch(
    html,
    new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`),
    `${id} data`,
  );
  JSON.parse(match[1]);
  return { id, match, raw: match[1] };
});
const reverseWorkerMatch = requiredMatch(
  html,
  /<script id="reverse-worker-source" type="application\/json">([\s\S]*?)<\/script>/,
  'reverse analysis worker',
);
const featureAssetsMatch = requiredMatch(
  html,
  /<script id="page-feature-assets" type="application\/json"><\/script>/,
  'page feature asset target',
);
const reverseWorkerSource = JSON.parse(reverseWorkerMatch[1]);
if (typeof reverseWorkerSource !== 'string' || !reverseWorkerSource.trim()) {
  throw new Error('Reverse analysis worker source is empty.');
}

if (RAIL_FREE) {
  const original = html;
  for (const pattern of RAIL_PATTERNS) html = html.replace(pattern, '\n');
  if (html === original) throw new Error('Expected rail markup was not found in the generated HTML.');
  if (!html.includes('<body>')) throw new Error('Expected body element was not found in the generated HTML.');
  html = html.replace('<body>', '<body class="deployment-rail-free">');
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(ASSETS, { recursive: true });

const cssSource = styleMatch[1].trim();
const themeAsset = asset('theme', 'js', themeMatch[2].trim());
const styleAsset = asset('app', 'css', cssSource);
const dataAsset = asset('data', 'js', buildDataBootstrap(dataScripts));
const appAsset = asset('app', 'js', applicationSource.core);
const workerAsset = asset('reverse-worker', 'js', reverseWorkerSource);
const featureAssets = Object.fromEntries(Object.entries(applicationSource.features).map(([page, source]) => [
  page,
  asset(`feature-${page}`, 'js', source),
]));

html = html.replace(themeMatch[0], `<script src="${themeAsset.path}"></script>`);
html = html.replace(styleMatch[0], `<link rel="stylesheet" href="${styleAsset.path}">`);
for (const { id, match } of dataScripts) {
  html = html.replace(match[0], `<script id="${id}" type="application/json"></script>`);
}
html = html.replace(
  reverseWorkerMatch[0],
  `<script id="reverse-worker-source" type="application/json" data-worker-src="${workerAsset.path}"></script>`,
);
html = html.replace(
  featureAssetsMatch[0],
  `<script id="page-feature-assets" type="application/json" ${Object.entries(featureAssets).map(([page, entry]) => `data-${page}-src="${entry.path}"`).join(' ')}></script>`,
);
html = html.replace(
  appMatch[0],
  `<script src="${dataAsset.path}"></script>\n<script src="${appAsset.path}"></script>`,
);

const indexPath = path.join(DIST, 'index.html');
writeFileSync(indexPath, html, 'utf8');
writeStaticFile('404.html', `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,follow">
  <title>페이지를 찾을 수 없습니다 · Pokémon Champions Calculator</title>
  <link rel="stylesheet" href="/${styleAsset.path.replace(/^\.\//, '')}">
</head>
<body>
  <main class="app-content">
    <section class="ui-panel" aria-labelledby="notFoundTitle">
      <h1 id="notFoundTitle" class="ui-panel-title">페이지를 찾을 수 없습니다</h1>
      <p>주소를 다시 확인하거나 계산기 첫 화면으로 돌아가 주세요.</p>
      <p><a class="btn primary" href="/">계산기로 돌아가기</a></p>
    </section>
  </main>
</body>
</html>`);

writeStaticFile('robots.txt', PRIVATE_TEST
  ? `User-agent: *\nDisallow: /`
  : `User-agent: *\nAllow: /`);
writeStaticFile('_redirects', `/pokemon-champions-calculator-v3.html / 301`);

const indexingHeaders = PRIVATE_TEST
  ? `  X-Robots-Tag: noindex, noarchive, nosnippet\n`
  : '';
writeStaticFile('_headers', `/*
${indexingHeaders}  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://raw.githubusercontent.com; font-src 'self' data:; connect-src 'none'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

const assets = {
  theme: themeAsset,
  style: styleAsset,
  data: dataAsset,
  app: appAsset,
  worker: workerAsset,
  featureDex: featureAssets.dex,
  featureMatchup: featureAssets.matchup,
  featureFinetune: featureAssets.finetune,
  featureRevcalc: featureAssets.revcalc,
};
const deployMode = PRIVATE_TEST ? 'private-test' : AD_FREE ? 'public-ad-free' : 'public';
const manifest = {
  artifact: 'index.html',
  source: path.basename(SOURCE_HTML),
  mode: deployMode,
  generatedAt: new Date().toISOString(),
  sizeBytes: statSync(indexPath).size,
  deployRoot: 'dist',
  host: 'static',
  assets,
  notes: [
    'The offline standalone artifact remains pokemon-champions-calculator-v3.html.',
    'HTML, CSS, core application code, embedded data, page features, and the lazy reverse-analysis worker are emitted as separate static assets.',
    'Hashed assets are safe to cache immutably.',
    PRIVATE_TEST
      ? 'Search indexing and advertising rails are disabled for the private test deployment.'
      : AD_FREE
        ? 'Search indexing is enabled and advertising rails are omitted from the Cloudflare Pages deployment.'
        : 'Search indexing and advertising rails remain enabled for the advertising-ready public deployment.',
  ],
};
writeStaticFile('deploy-manifest.json', JSON.stringify(manifest, null, 2));

console.log(`${PRIVATE_TEST ? 'Private test' : AD_FREE ? 'Ad-free public' : 'Advertising-ready public'} static output ready: ${indexPath}`);
console.log(`index: ${(manifest.sizeBytes / 1024).toFixed(1)} KB, assets: ${Object.values(assets).map((entry) => entry.file).join(', ')}`);
