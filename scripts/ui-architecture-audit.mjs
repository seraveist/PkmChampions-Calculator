import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE = path.join(ROOT, 'src', 'calc-template.html');
const CSS_ROOT = path.join(ROOT, 'src', 'styles');
const JS_ROOT = path.join(ROOT, 'src', 'js');
const MANIFEST = path.join(ROOT, 'dist', 'deploy-manifest.json');
const PAGE_OWNERS = new Map([
  ['pages/01-matchup.css', 'matchup'],
  ['pages/02-finetune.css', 'finetune'],
  ['pages/03-reverse.css', 'revcalc'],
  ['pages/calculator.css', 'calc'],
  ['pages/calculator-base.css', 'calc'],
  ['pages/dex.css', 'dex'],
]);

function filesUnder(root, extension) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(absolute, extension) : entry.name.endsWith(extension) ? [absolute] : [];
  }).sort();
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function occurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

function rel(file, root) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function top(items, count = 8) {
  return [...items].sort((a, b) => b.bytes - a.bytes).slice(0, count);
}

const html = read(TEMPLATE);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const idCounts = new Map();
for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));

const cssFiles = filesUnder(CSS_ROOT, '.css').map(file => {
  const source = read(file);
  const relative = rel(file, CSS_ROOT);
  const expectedPage = PAGE_OWNERS.get(relative);
  const pageReferences = [...new Set([...source.matchAll(/#page-(calc|revcalc|finetune|matchup|dex)\b/g)].map(match => match[1]))];
  return {
    file: relative,
    bytes: statSync(file).size,
    lines: source.split(/\r?\n/).length,
    rules: occurrences(source, /\{/g) - occurrences(source, /@(media|supports|container|keyframes|layer)\b[^\{]*\{/g),
    mediaQueries: occurrences(source, /@media\b/g),
    important: occurrences(source, /!important\b/g),
    customProperties: occurrences(source, /--[a-z0-9-]+\s*:/gi),
    colorLiterals: occurrences(source, /#[0-9a-f]{3,8}\b/gi),
    foreignPageReferences: expectedPage ? pageReferences.filter(page => page !== expectedPage) : [],
  };
});

const jsFiles = filesUnder(JS_ROOT, '.js').map(file => {
  const source = read(file);
  return {
    file: rel(file, JS_ROOT),
    bytes: statSync(file).size,
    lines: source.split(/\r?\n/).length,
    functions: occurrences(source, /\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g),
    innerHtmlWrites: occurrences(source, /\.innerHTML\s*=/g),
    domIdLookups: occurrences(source, /getElementById\s*\(/g),
  };
});

let publicAssets = null;
if (existsSync(MANIFEST)) {
  const manifest = JSON.parse(read(MANIFEST));
  const assets = Object.entries(manifest.assets || {}).map(([role, entry]) => ({
    role,
    file: entry.file,
    bytes: entry.sizeBytes,
    gzipBytes: entry.gzipBytes,
  }));
  publicAssets = {
    count: assets.length,
    initialGzipBytes: assets
      .filter(asset => ['theme', 'style', 'data', 'app'].includes(asset.role))
      .reduce((sum, asset) => sum + (asset.gzipBytes || 0), 0),
    totalGzipBytes: assets.reduce((sum, asset) => sum + (asset.gzipBytes || 0), 0),
    assets,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  html: {
    bytes: statSync(TEMPLATE).size,
    lines: html.split(/\r?\n/).length,
    staticIds: ids.length,
    duplicateIds,
    pageSections: occurrences(html, /<section\b[^>]*\bid="page-/g),
    headings: occurrences(html, /<h[1-6]\b/g),
    buttons: occurrences(html, /<button\b/g),
    buttonsWithoutType: occurrences(html, /<button(?![^>]*\btype=)/g),
    inlineStyleAttributes: occurrences(html, /\sstyle="/g),
    inlineEventAttributes: occurrences(html, /\son[a-z]+="/gi),
  },
  css: {
    files: cssFiles.length,
    bytes: cssFiles.reduce((sum, file) => sum + file.bytes, 0),
    rules: cssFiles.reduce((sum, file) => sum + file.rules, 0),
    mediaQueries: cssFiles.reduce((sum, file) => sum + file.mediaQueries, 0),
    important: cssFiles.reduce((sum, file) => sum + file.important, 0),
    customProperties: cssFiles.reduce((sum, file) => sum + file.customProperties, 0),
    colorLiterals: cssFiles.reduce((sum, file) => sum + file.colorLiterals, 0),
    largestFiles: top(cssFiles),
    crossPageOwnership: cssFiles
      .filter(file => file.foreignPageReferences.length)
      .map(({ file, foreignPageReferences }) => ({ file, foreignPageReferences })),
  },
  javascript: {
    files: jsFiles.length,
    bytes: jsFiles.reduce((sum, file) => sum + file.bytes, 0),
    functions: jsFiles.reduce((sum, file) => sum + file.functions, 0),
    innerHtmlWrites: jsFiles.reduce((sum, file) => sum + file.innerHtmlWrites, 0),
    domIdLookups: jsFiles.reduce((sum, file) => sum + file.domIdLookups, 0),
    filesOver40KiB: jsFiles.filter(file => file.bytes > 40 * 1024),
    largestFiles: top(jsFiles),
  },
  publicAssets,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('UI architecture audit');
  console.log(`HTML: ${report.html.bytes} bytes, ${report.html.staticIds} static ids, ${report.html.pageSections} pages`);
  console.log(`HTML hygiene: ${duplicateIds.length} duplicate ids, ${report.html.buttonsWithoutType} buttons without type, ${report.html.inlineStyleAttributes} inline styles, ${report.html.inlineEventAttributes} inline events`);
  console.log(`CSS: ${report.css.files} files, ${report.css.bytes} bytes, ${report.css.rules} rules, ${report.css.mediaQueries} media queries, ${report.css.important} !important`);
  console.log(`JS: ${report.javascript.files} files, ${report.javascript.bytes} bytes, ${report.javascript.functions} named functions, ${report.javascript.innerHtmlWrites} innerHTML writes`);
  console.log(`JS files over 40 KiB: ${report.javascript.filesOver40KiB.map(file => file.file).join(', ') || 'none'}`);
  console.log(`Cross-page CSS ownership: ${report.css.crossPageOwnership.map(item => `${item.file} -> ${item.foreignPageReferences.join(',')}`).join('; ') || 'none'}`);
  if (publicAssets) console.log(`Public assets: ${publicAssets.initialGzipBytes} initial gzip bytes, ${publicAssets.totalGzipBytes} total gzip bytes`);
  console.log('Largest CSS files:');
  for (const file of report.css.largestFiles) console.log(`  ${file.file}: ${file.bytes} bytes`);
  console.log('Largest JS files:');
  for (const file of report.javascript.largestFiles) console.log(`  ${file.file}: ${file.bytes} bytes`);
}
