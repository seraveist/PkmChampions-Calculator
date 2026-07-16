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
check(!template.includes('fonts.googleapis.com') && !template.includes('fonts.gstatic.com'), 'template has no external webfont dependency');
check(!template.includes('role="heading"'), 'template uses native heading elements');
check((template.match(/<h2\b/g) || []).length >= 10, 'template exposes semantic section headings');
check(template.includes('id="reverse-worker-source"'), 'template embeds the reverse analysis worker source');
check((template.match(/data-calc-detail-toggle=/g) || []).length === 2, 'calculator exposes one mobile detail toggle per side');

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
  'ui-panel',
  'ui-panel-head',
  'ui-panel-body',
  'ui-panel-title',
  'ui-panel-tag',
  'ui-panel-actions',
  'ui-frame-row',
  'ui-field',
  'ui-field-label',
  'ui-check',
  'ui-btn',
  'ui-control-frame',
  'ui-control-row',
  'ui-control-grid',
  'ui-action-row',
  'ui-subframe',
  'ui-subframe-stack',
  'ui-section-head',
  'ui-section-title',
  'ui-control-cell',
  'ui-control-label',
  'ui-card-grid',
  'ui-card',
  'ui-chip-row',
  'ui-metric-chip',
  'ui-stepper',
  'ui-stat-table',
  'ui-stat-head',
  'ui-stat-readout',
  'ui-summary-row',
  'ui-summary-card',
  'ui-meter',
  'ui-status-badge',
  'tool-pokemon-field',
  'tool-pokemon-subframe',
  'tool-pokemon-row',
  'tool-pokemon-head-row',
  'tool-pokemon-control-row',
  'tool-pokemon-toolbar-row',
  'tool-pokemon-head',
  'tool-pokemon-title-actions',
  'tool-pokemon-primary-actions',
  'tool-pokemon-meta-actions',
  'tool-pokemon-secondary-actions',
  'tool-pokemon-combobox',
  'tool-pokemon-input',
  'tool-pokemon-type-strip',
  'tool-settings-layout',
  'tool-settings-subframe',
  'tool-settings-grid',
  'tool-settings-cell',
  'tool-settings-label',
  'tool-settings-control',
  'tool-settings-compound',
  'tool-settings-combobox',
  'tool-settings-choice-cell',
  'tool-settings-choice-label',
  'tool-settings-choice-control',
  'tool-settings-choice-combobox',
  'tool-settings-choice-surface',
  'tool-settings-choice-input',
  'tool-settings-select-cell',
  'tool-settings-select-label',
  'tool-settings-select-control',
  'tool-settings-select-combobox',
  'tool-settings-select-input',
  'tool-settings-condition-cell',
  'tool-settings-condition-control',
  'tool-settings-status-combobox',
  'tool-settings-hp-control',
  'tool-settings-hp-input',
  'tool-stat-panel',
  'tool-stat-set',
  'tool-stat-panel-head',
  'tool-stat-panel-title',
  'tool-stat-panel-body',
  'tool-stat-table-frame',
  'tool-stat-head-row',
  'tool-stat-head-cell',
  'tool-stat-row',
  'tool-stat-grid',
  'tool-stat-total',
  'tool-stat-col-name',
  'tool-stat-col-base',
  'tool-stat-col-point',
  'tool-stat-col-magic',
  'tool-stat-col-final',
  'tool-stat-col-rank',
  'tool-stat-name-text',
  'tool-stat-nature-mark',
  'tool-stat-nature-up',
  'tool-stat-nature-down',
  'tool-stat-nature-empty',
  'tool-stat-preset-button',
  'tool-stat-preset-popover',
  'tool-stat-preset-menu',
  'tool-stat-preset-label',
  'tool-stat-preset-row',
  'tool-stat-preset-option',
  'tool-stat-bulk-strip',
  'tool-stat-bulk-card',
  'tool-stat-bulk-label',
  'tool-stat-bulk-value',
  'tool-stat-magic',
  'tool-stat-magic-prev',
  'tool-stat-magic-current',
  'tool-stat-magic-next',
  'tool-stat-point-stepper',
  'tool-stat-point-button',
  'tool-stat-point-input',
  'tool-stat-rank-stepper',
  'tool-stat-rank-button',
  'tool-stat-rank-value',
  'tool-stat-rank-empty',
  'tool-move-panel',
  'tool-move-panel-head',
  'tool-move-panel-title',
  'tool-move-panel-body',
  'tool-move-list-frame',
  'tool-move-list',
  'tool-move-head-row',
  'tool-move-row',
  'tool-move-combobox',
  'tool-move-input',
  'tool-move-type-control',
  'tool-move-power-control',
  'tool-move-power-input',
  'tool-move-power-readout',
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

const calcSideRenderer = read(path.join(JS_DIR, '03-30-calc-side-render.js'));
check(!calcSideRenderer.includes('section-divider'), 'calculator side renderer stacks subframes directly');
[
  ['attack side panel body', /class="[^"]*\bui-subframe-stack\b[^"]*" id="atk-body"/],
  ['defense side panel body', /class="[^"]*\bui-subframe-stack\b[^"]*" id="def-body"/],
  ['result panel body', /class="[^"]*\bui-subframe-stack\b[^"]*" id="calc-results-body"/],
].forEach(([label, pattern]) => {
  check(pattern.test(template), `calculator ${label} uses subframe stack`);
});
check(/id="calc-field-panel"[\s\S]*?class="[^"]*\bui-panel-body\b[^"]*\bui-subframe-stack\b/.test(template), 'calculator field panel body uses subframe stack');

if (failed) process.exit(1);
