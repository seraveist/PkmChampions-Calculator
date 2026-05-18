import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE = path.join(ROOT, 'src', 'calc-template.html');
const GENERATED = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const JS_DIR = path.join(ROOT, 'src', 'js');
const PAGES = ['calc', 'revcalc', 'finetune', 'matchup', 'dex'];

let failed = false;

function check(condition, label) {
  if (condition) {
    console.log(`[PASS] ${label}`);
  } else {
    failed = true;
    console.error(`[FAIL] ${label}`);
  }
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function buttonWithoutTypeCount(source) {
  return (source.match(/<button(?![^>]*\btype=)/g) || []).length;
}

check(existsSync(TEMPLATE), 'template exists');
check(existsSync(GENERATED), 'generated HTML exists');

const template = read(TEMPLATE);
const generated = existsSync(GENERATED) ? read(GENERATED) : '';
const generatedStaticDom = generated.split('<script id="data-pokemon"')[0] || generated;

check(buttonWithoutTypeCount(template) === 0, 'template buttons declare type');
check(buttonWithoutTypeCount(generatedStaticDom) === 0, 'generated static DOM buttons declare type');
check((template.match(/<main\b/g) || []).length === 1, 'template exposes a single main landmark');
check(template.includes('<main id="appContent" class="app-content"'), 'app content owns the main landmark');
check(template.includes('class="skip-link"') && template.includes('href="#appContent"'), 'template provides skip link to app content');

let lastPageIndex = -1;
for (const page of PAGES) {
  const pageId = `page-${page}`;
  const navId = `nav-${page}`;
  const pageIndex = template.indexOf(`id="${pageId}"`);
  check(pageIndex >= 0, `${pageId} exists`);
  check(pageIndex > lastPageIndex, `${pageId} follows navigation order`);
  lastPageIndex = pageIndex;
  check(template.includes(`<section id="${pageId}"`), `${pageId} is a section tab panel`);
  check(template.includes(`id="${navId}"`) && template.includes(`aria-controls="${pageId}"`), `${navId} controls ${pageId}`);
  check(template.includes(`id="${pageId}"`) && template.includes('page-frame'), `${pageId} uses page-frame structure`);
  check(template.includes(`aria-labelledby="${navId}"`), `${pageId} points back to ${navId}`);
}

[
  'ui-frame',
  'ui-frame-head',
  'ui-frame-body',
  'ui-frame-row',
  'ui-control-frame',
  'ui-control-row',
  'ui-control-grid',
  'ui-action-row',
].forEach(className => {
  check(template.includes(className) || generated.includes(className), `${className} structure class is present`);
});

const jsFiles = readdirSync(JS_DIR)
  .filter(file => file.endsWith('.js') && file !== '01-20-html-structure.js')
  .map(file => path.join(JS_DIR, file))
  .sort();

const sourceButtonMisses = jsFiles.flatMap(file => {
  const rel = path.relative(ROOT, file);
  const source = read(file);
  return (source.match(/<button(?![^>]*\btype=)/g) || []).map(() => rel);
});
check(sourceButtonMisses.length === 0, `rendered button literals declare type${sourceButtonMisses.length ? ` (${sourceButtonMisses.join(', ')})` : ''}`);

check(template.includes('id="dexFullPageDetail"') && template.includes('aria-label="도감 상세"'), 'dex fullpage detail has structural region');
check(template.includes('id="matchupModeTabs"') && template.includes('aria-label="상성표 모드"'), 'matchup mode tabs expose structure');
check(template.includes('aria-labelledby="dexDetailTitle"'), 'dex modal has accessible title wiring');

if (failed) process.exit(1);
