import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STYLE_DIR = path.join(ROOT, 'src', 'styles');
const GENERATED = path.join(ROOT, 'pokemon-champions-calculator-v3.html');

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

check(existsSync(STYLE_DIR), 'style directory exists');

const cssFiles = existsSync(STYLE_DIR)
  ? readdirSync(STYLE_DIR).filter(file => file.endsWith('.css')).sort()
  : [];
const cssByFile = new Map(cssFiles.map(file => [file, read(path.join(STYLE_DIR, file))]));
const allCss = [...cssByFile.values()].join('\n');

[
  '.page-frame',
  '.ui-frame',
  '.ui-frame-head',
  '.ui-frame-body',
  '.ui-panel',
  '.ui-panel-head',
  '.ui-panel-body',
  '.ui-panel-title',
  '.ui-frame-row',
  '.ui-field',
  '.ui-field-label',
  '.ui-check',
  '.ui-btn',
  '.ui-control-frame',
  '.ui-control-row',
  '.ui-control-grid',
  '.ui-action-row',
  '.ui-stat-grid',
  '.ui-metric-row',
  '.ui-subframe',
  '.ui-subframe-stack',
  '.ui-section-head',
  '.ui-section-title',
  '.ui-control-cell',
  '.ui-control-label',
  '.ui-card-grid',
  '.ui-card',
  '.ui-card-head',
  '.ui-card-body',
  '.ui-chip-row',
  '.ui-metric-chip',
  '.ui-stepper',
  '.ui-stat-table',
  '.ui-stat-head',
  '.ui-stat-name',
  '.ui-stat-readout',
  '.ui-summary-row',
  '.ui-summary-card',
  '.ui-meter',
  '.ui-meter-fill',
  '.ui-status-badge',
  '.tool-pokemon-field',
  '.tool-pokemon-subframe',
  '.tool-pokemon-row',
  '.tool-pokemon-head-row',
  '.tool-pokemon-control-row',
  '.tool-pokemon-toolbar-row',
  '.tool-pokemon-head',
  '.tool-pokemon-title-actions',
  '.tool-pokemon-primary-actions',
  '.tool-pokemon-meta-actions',
  '.tool-pokemon-secondary-actions',
  '.tool-pokemon-combobox',
  '.tool-pokemon-input',
  '.tool-pokemon-type-strip',
].forEach(selector => {
  check(allCss.includes(selector), `${selector} has CSS ownership`);
});

[
  '--ui-frame-border',
  '--ui-frame-bg',
  '--ui-frame-radius',
  '--ui-frame-shadow',
  '--ui-frame-body-padding',
  '--ui-action-gap',
  '--ui-control-frame-gap',
  '--ui-surface',
  '--ui-header-bg',
  '--ui-action-bg',
  '--ui-option-hover-bg',
].forEach(token => {
  check(allCss.includes(token), `${token} token exists`);
});

check(allCss.includes('#page-calc .battle-grid > .ui-panel'), 'calculator page styles target ui-panel panels');
check(allCss.includes('#page-dex .dex-control-panel.ui-frame'), 'dex page styles target ui-frame control panel');
check(allCss.includes('.tool-page .ui-frame'), 'tool pages style ui-frame panels');
check(allCss.includes('.tool-page .ui-frame-head'), 'tool pages style ui-frame heads');
check(allCss.includes('.tool-page .ui-frame-body'), 'tool pages style ui-frame bodies');
check(allCss.includes('.tool-page :where(.matchup-slot'), 'tool pages centralize repeated subframes');
check(allCss.includes('#page-calc .ui-metric-chip'), 'calculator metrics target shared chips');
check(allCss.includes('#page-calc .ui-stat-readout'), 'calculator stat readouts target shared typography');

const pageCss = ['03-calc-redesign.css', '05-calc-sample-layout.css', '06-dex-redesign.css', '07-tools-redesign.css']
  .map(file => cssByFile.get(file) || '')
  .join('\n');
const legacyFrameSelectors = pageCss.match(/\.panel-head(?!-actions)|\.panel-body|\.dex-modal-head|\.dex-modal-body/g) || [];
check(
  legacyFrameSelectors.length === 0,
  `page CSS uses structural frame selectors${legacyFrameSelectors.length ? ` (${legacyFrameSelectors.join(', ')})` : ''}`
);
const legacyStructureSelectors = pageCss.match(
  /\.panel-title|\.panel-tag|\.panel-head-actions|\.checkbox-label|\.empty-state(?!-cell)|\.btn-calculate|\.btn-secondary|\.panel(?=[\s,{>:.#\[])|\.field-label|\.field(?=[\s,{>:.#\[])/g
) || [];
check(
  legacyStructureSelectors.length === 0,
  `page CSS uses ui-* structure selectors${legacyStructureSelectors.length ? ` (${legacyStructureSelectors.join(', ')})` : ''}`
);
check(cssByFile.has('08-theme-bridge.css'), 'theme bridge loads after page styles');
check(allCss.includes(':root[data-theme="dark"]'), 'dark theme token block exists');

if (existsSync(GENERATED)) {
  const generated = read(GENERATED);
  ['ui-frame', 'ui-frame-head', 'ui-frame-body', 'ui-control-frame', 'ui-action-row'].forEach(className => {
    check(generated.includes(className), `generated HTML contains ${className}`);
  });
}

if (failed) process.exit(1);
