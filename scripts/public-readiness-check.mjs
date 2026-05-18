import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE = path.join(ROOT, 'src', 'calc-template.html');
const GENERATED = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
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

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

check(existsSync(TEMPLATE), 'template exists');
check(existsSync(GENERATED), 'generated HTML exists');

const template = existsSync(TEMPLATE) ? read(TEMPLATE) : '';
const generated = existsSync(GENERATED) ? read(GENERATED) : '';
const generatedStaticDom = generated.split('<script id="data-pokemon"')[0] || generated;

[
  '<html lang="ko">',
  '<meta name="description"',
  '<meta name="application-name"',
  '<meta name="theme-color"',
  '<meta name="color-scheme"',
  '<meta name="robots" content="index,follow">',
  '<meta property="og:title"',
  '<meta property="og:description"',
  '<meta property="og:type" content="website">',
  '<meta property="og:locale" content="ko_KR">',
  '<meta name="twitter:card" content="summary">',
  '<link rel="icon"',
].forEach(needle => {
  check(template.includes(needle), `template includes public head contract: ${needle}`);
  check(generated.includes(needle), `generated includes public head contract: ${needle}`);
});

check(count(generatedStaticDom, /<main\b/g) === 1, 'generated static DOM exposes one main landmark');
check(generatedStaticDom.includes('id="appContent"'), 'generated static DOM has skip-link target');
check(generatedStaticDom.includes('class="skip-link"') && generatedStaticDom.includes('href="#appContent"'), 'generated static DOM has skip link');
check(generatedStaticDom.includes('<noscript>') && generatedStaticDom.includes('JavaScript'), 'generated static DOM has noscript notice');

for (const page of PAGES) {
  const pageId = `page-${page}`;
  const navId = `nav-${page}`;
  check(generatedStaticDom.includes(`<section id="${pageId}"`), `${pageId} is a section panel`);
  check(generatedStaticDom.includes(`id="${navId}"`) && generatedStaticDom.includes(`aria-controls="${pageId}"`), `${navId} controls ${pageId}`);
}

[
  'aria-labelledby="dexDetailTitle"',
  'bindUiTabKeyboard(',
  'bindMainNavigation()',
  'activateMainPageFromHash',
  'partyPresetBackupNote',
].forEach(needle => {
  check(generated.includes(needle), `generated includes accessibility/runtime contract: ${needle}`);
});

check(generatedStaticDom.includes('aria-label="왼쪽 광고 영역"'), 'left ad rail has Korean accessible label');
check(generatedStaticDom.includes('aria-label="오른쪽 광고 영역"'), 'right ad rail has Korean accessible label');

if (failed) process.exit(1);
