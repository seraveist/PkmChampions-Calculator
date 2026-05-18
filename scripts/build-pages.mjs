import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const SOURCE_HTML = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const INDEX_HTML = path.join(DIST, 'index.html');
const RAIL_PATTERNS = [
  /\s*<aside class="ad-rail[^"]*"[\s\S]*?<\/aside>\s*/g,
  /\s*<aside class="side-rail[^"]*"[\s\S]*?<\/aside>\s*/g,
];

function runBuild() {
  const result = spawnSync(process.execPath, ['build.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`build.mjs failed with exit code ${result.status}`);
  }
}

function writeStaticFile(name, content) {
  writeFileSync(path.join(DIST, name), `${content.trimEnd()}\n`, 'utf8');
}

function buildPrivateTestHtml(html) {
  let output = html;
  for (const pattern of RAIL_PATTERNS) {
    output = output.replace(pattern, '\n');
  }

  if (output === html) {
    throw new Error('Expected rail markup was not found in the generated HTML.');
  }

  const noRailOverride = `
<style id="private-test-no-rail-override">
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
</style>
`;

  return output.replace('</head>', `${noRailOverride}</head>`);
}

runBuild();

if (!existsSync(SOURCE_HTML)) {
  throw new Error(`Expected build output not found: ${SOURCE_HTML}`);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
writeFileSync(INDEX_HTML, buildPrivateTestHtml(readFileSync(SOURCE_HTML, 'utf8')), 'utf8');

writeStaticFile('robots.txt', `User-agent: *
Disallow: /
`);

writeStaticFile('_redirects', `/pokemon-champions-calculator-v3.html / 301
`);

writeStaticFile('_headers', `/*
  X-Robots-Tag: noindex, noarchive, nosnippet
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
`);

const stat = statSync(INDEX_HTML);
const manifest = {
  artifact: 'index.html',
  source: path.basename(SOURCE_HTML),
  generatedAt: new Date().toISOString(),
  sizeBytes: stat.size,
  deployRoot: 'dist',
  host: 'Cloudflare Pages',
  notes: [
    'Cloudflare Pages build command: npm run build:pages',
    'Cloudflare Pages build output directory: /dist',
    'Robots headers intentionally keep this test deployment out of search indexes.',
    'The app is a single static HTML SPA and does not require server-side routing.',
  ],
};

writeStaticFile('deploy-manifest.json', JSON.stringify(manifest, null, 2));

console.log(`Cloudflare Pages output ready: ${INDEX_HTML}`);
console.log(`size: ${(stat.size / 1024).toFixed(1)} KB`);
