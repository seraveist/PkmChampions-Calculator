import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const SOURCE_HTML = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const PRIVATE_TEST = process.argv.includes('--private-test');
const DATA_IDS = [
  'data-pokemon',
  'data-moves',
  'data-abilities',
  'data-items',
  'data-natures',
  'data-typechart',
  'data-rules',
  'data-meta-threats',
  'reverse-worker-source',
];
const RAIL_PATTERNS = [
  /\s*<aside class="ad-rail[^"]*"[\s\S]*?<\/aside>\s*/g,
  /\s*<aside class="side-rail[^"]*"[\s\S]*?<\/aside>\s*/g,
];
const PRIVATE_TEST_CSS = `
header > .header-top,
header > .main-nav {
  max-width: var(--app-content-max) !important;
}

.site-shell {
  max-width: calc(var(--app-content-max) + (var(--app-shell-gutter) * 2)) !important;
  grid-template-columns: minmax(0, var(--app-content-max)) !important;
  gap: 0 !important;
}

.app-content {
  grid-column: 1 !important;
}

.ad-rail,
.ad-slot,
.side-rail,
.rail-slot {
  display: none !important;
}
`;

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
  return { file, path: `./assets/${file}`, sizeBytes: Buffer.byteLength(normalized) };
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
    .map(({ id, raw }) => `    ${JSON.stringify(id)}: ${raw}`)
    .join(',\n');
  return `(() => {
  const payloads = {
${payload}
  };
  for (const [id, value] of Object.entries(payloads)) {
    const node = document.getElementById(id);
    if (!node) throw new Error(\`Missing embedded data target: \${id}\`);
    node.textContent = JSON.stringify(value);
  }
})();`;
}

runStandaloneBuild();
if (!existsSync(SOURCE_HTML)) throw new Error(`Expected build output not found: ${SOURCE_HTML}`);

let html = readFileSync(SOURCE_HTML, 'utf8');
const styleMatch = requiredMatch(html, /<style>([\s\S]*?)<\/style>/, 'inline CSS');
const themeMatch = extractInlineScript(html, (body) => body.includes('pkchamps-theme'), 'theme bootstrap');
const appMatch = extractInlineScript(html, (body) => body.includes('"use strict";'), 'application JavaScript');
const dataScripts = DATA_IDS.map((id) => {
  const match = requiredMatch(
    html,
    new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`),
    `${id} data`,
  );
  JSON.parse(match[1]);
  return { id, match, raw: match[1] };
});

if (PRIVATE_TEST) {
  const original = html;
  for (const pattern of RAIL_PATTERNS) html = html.replace(pattern, '\n');
  if (html === original) throw new Error('Expected rail markup was not found in the generated HTML.');
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(ASSETS, { recursive: true });

const cssSource = PRIVATE_TEST ? `${styleMatch[1].trim()}\n${PRIVATE_TEST_CSS}` : styleMatch[1].trim();
const themeAsset = asset('theme', 'js', themeMatch[2].trim());
const styleAsset = asset('app', 'css', cssSource);
const dataAsset = asset('data', 'js', buildDataBootstrap(dataScripts));
const appAsset = asset('app', 'js', appMatch[2].trim());

html = html.replace(themeMatch[0], `<script src="${themeAsset.path}"></script>`);
html = html.replace(styleMatch[0], `<link rel="stylesheet" href="${styleAsset.path}">`);
for (const { id, match } of dataScripts) {
  html = html.replace(match[0], `<script id="${id}" type="application/json"></script>`);
}
html = html.replace(
  appMatch[0],
  `<script src="${dataAsset.path}"></script>\n<script src="${appAsset.path}"></script>`,
);

const indexPath = path.join(DIST, 'index.html');
writeFileSync(indexPath, html, 'utf8');

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
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://raw.githubusercontent.com; font-src 'self' data:; connect-src 'none'; worker-src blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

const assets = { theme: themeAsset, style: styleAsset, data: dataAsset, app: appAsset };
const manifest = {
  artifact: 'index.html',
  source: path.basename(SOURCE_HTML),
  mode: PRIVATE_TEST ? 'private-test' : 'public',
  generatedAt: new Date().toISOString(),
  sizeBytes: statSync(indexPath).size,
  deployRoot: 'dist',
  host: 'static',
  assets,
  notes: [
    'The offline standalone artifact remains pokemon-champions-calculator-v3.html.',
    'HTML, CSS, application code, and embedded data are emitted as separate static assets.',
    'Hashed assets are safe to cache immutably.',
    PRIVATE_TEST
      ? 'Search indexing and advertising rails are disabled for the private test deployment.'
      : 'Search indexing and advertising rails remain enabled for the public deployment.',
  ],
};
writeStaticFile('deploy-manifest.json', JSON.stringify(manifest, null, 2));

console.log(`${PRIVATE_TEST ? 'Private test' : 'Public'} static output ready: ${indexPath}`);
console.log(`index: ${(manifest.sizeBytes / 1024).toFixed(1)} KB, assets: ${Object.values(assets).map((entry) => entry.file).join(', ')}`);
