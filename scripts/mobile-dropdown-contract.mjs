import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GENERATED = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const COMBOBOX_JS = path.join(ROOT, 'src', 'js', '03-20-calc-combobox.js');
const COMBOBOX_CSS = path.join(ROOT, 'src', 'styles', 'components', 'combobox.css');
const PAGE_CSS_DIR = path.join(ROOT, 'src', 'styles', 'pages');
const CALC_CSS_FILES = readdirSync(PAGE_CSS_DIR)
  .filter(file => file.startsWith('calculator-') && file.endsWith('.css'))
  .sort()
  .map(file => path.join(PAGE_CSS_DIR, file));

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
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

const generated = read(GENERATED);
const comboJs = read(COMBOBOX_JS);
const comboboxCss = read(COMBOBOX_CSS);
const calcCss = CALC_CSS_FILES.map(read).join('\n');

check(existsSync(GENERATED), 'generated HTML exists');
check(existsSync(COMBOBOX_JS), 'calculator combobox source exists');
check(existsSync(COMBOBOX_CSS), 'combobox component CSS exists');
check(CALC_CSS_FILES.length >= 2 && CALC_CSS_FILES.every(existsSync), 'calculator CSS modules exist');

[
  'pokemon',
  'move',
  'moveType',
  'ability',
  'item',
  'nature',
  'status',
  'type1',
  'type2',
  'form',
  'weather',
  'terrain',
  'gameType',
  'spikesLayers',
].forEach(type => {
  check(comboJs.includes(`'${type}'`), `portal type includes ${type}`);
});

check(
  comboJs.includes("input?.closest?.('#page-calc') && CALC_PAGE_PORTAL_COMBOBOX_TYPES.has(type)"),
  'calculator page comboboxes opt into portal positioning'
);
check(comboJs.includes('function calcComboboxPortalMinWidth'), 'portal min-width helper exists');
check(comboJs.includes('dataset.calcPortalPlacement'), 'portal records top or bottom placement');
check(comboJs.includes('CALC_COMBOBOX_PORTAL_WIDTHS'), 'portal width map exists');

[
  'pokemon: { min: 420',
  'nature: { min: 188',
  'status: { min: 180',
  'ability: { min: 220',
  'item: { min: 220',
  'type1: { min: 116',
  'type2: { min: 116',
].forEach(needle => {
  check(comboJs.includes(needle), `portal width floor exists: ${needle}`);
});

check(
  !comboJs.includes("optsEl.addEventListener('touchstart', handleOptionSelect"),
  'touchstart no longer selects options before scroll can start'
);
check(comboJs.includes("optsEl.addEventListener('touchmove'"), 'touchmove tracks scroll gestures');
check(comboJs.includes("optsEl.addEventListener('touchend'"), 'touchend handles tap selection');

check(comboboxCss.includes('.combobox-options.combobox-options-portal'), 'portal CSS selector exists');
check(comboboxCss.includes('position: fixed;'), 'portal CSS uses fixed positioning');
check(comboboxCss.includes('touch-action: pan-y;'), 'dropdown CSS allows vertical touch scrolling');
check(comboboxCss.includes('.combobox-options.calc-page-options-portal'), 'calculator portal CSS class exists');

check(
  calcCss.includes('width: min(188px, calc(100vw - 24px))'),
  'calculator nature dropdown fallback keeps mobile width contract'
);
check(
  generated.includes('CALC_PAGE_PORTAL_COMBOBOX_TYPES')
    && generated.includes('.combobox-options.calc-page-options-portal')
    && generated.includes('touch-action: pan-y;'),
  'generated HTML includes mobile dropdown contracts'
);

if (failed) process.exit(1);
