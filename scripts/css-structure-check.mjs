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

function listCssFiles(dir, relativeDir = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .flatMap(entry => {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return listCssFiles(path.join(dir, entry.name), relativePath);
      return entry.isFile() && entry.name.endsWith('.css') ? [relativePath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

const cssFiles = listCssFiles(STYLE_DIR);
const cssByFile = new Map(cssFiles.map(file => [
  file,
  read(path.join(STYLE_DIR, ...file.split('/'))),
]));
const allCss = [...cssByFile.values()].join('\n');
const importantCount = (allCss.match(/!important/g) || []).length;
const mediaQueryCount = (allCss.match(/@media/g) || []).length;

check(importantCount <= 70, `CSS important budget (${importantCount}/70)`);
check(mediaQueryCount <= 36, `CSS media-query budget (${mediaQueryCount}/36)`);
check(cssByFile.has('00-tokens.css'), 'semantic token stylesheet exists');

[
  '--color-surface-canvas',
  '--color-surface-panel',
  '--color-border-default',
  '--color-text-primary',
  '--color-side-attack',
  '--color-side-defense',
  '--shadow-surface',
  '--layout-content-max',
].forEach(token => {
  check((cssByFile.get('00-tokens.css') || '').includes(token), `${token} semantic token exists`);
});

const panelComponentCss = cssByFile.get('components/panels.css') || '';
const buttonComponentCss = cssByFile.get('components/buttons.css') || '';
const fieldComponentCss = cssByFile.get('components/fields.css') || '';
const comboboxComponentCss = cssByFile.get('components/combobox.css') || '';
const resetCss = cssByFile.get('01-reset.css') || '';
const appShellCss = cssByFile.get('layouts/app-shell.css') || '';
const legacyFoundationCss = cssByFile.get('04-ui-foundation.css') || '';
check(!cssByFile.has('01-base.css'), 'legacy base stylesheet is removed');
check(
  resetCss.includes('scrollbar-gutter: stable')
    && resetCss.includes("font-family: 'Noto Sans KR', sans-serif"),
  'reset stylesheet owns document defaults'
);
check(
  appShellCss.includes('.site-shell')
    && appShellCss.includes('.ad-slot-rail')
    && appShellCss.includes('.page.active'),
  'app shell layout owns navigation, page visibility, and ad rails'
);
check(Boolean(panelComponentCss), 'panel component stylesheet exists');
check(
  panelComponentCss.includes('.ui-frame.ui-panel')
    && panelComponentCss.includes('.ui-panel-body.ui-subframe-stack'),
  'panel component owns shared frame and panel structure'
);
check(
  !legacyFoundationCss.includes('.ui-frame.ui-panel')
    && !legacyFoundationCss.includes('.ui-panel-body.ui-subframe-stack'),
  'legacy foundation releases shared panel ownership'
);
check(Boolean(buttonComponentCss), 'button component stylesheet exists');
check(
  buttonComponentCss.includes('.ui-btn-primary')
    && buttonComponentCss.includes('.ui-btn-secondary.active'),
  'button component owns shared button variants and states'
);
check(
  !legacyFoundationCss.includes('.ui-btn-primary')
    && !legacyFoundationCss.includes('.ui-btn-secondary.active'),
  'legacy foundation releases shared button ownership'
);
check(Boolean(fieldComponentCss), 'field component stylesheet exists');
check(
  fieldComponentCss.includes('.ui-field-label')
    && fieldComponentCss.includes('.ui-inline-number-input'),
  'field component owns labels, controls, and inline numbers'
);
check(
  !legacyFoundationCss.includes('.ui-field-head .ui-field-label')
    && !legacyFoundationCss.includes('.ui-inline-number-input'),
  'legacy foundation releases shared field ownership'
);
check(Boolean(comboboxComponentCss), 'combobox component stylesheet exists');
check(
  comboboxComponentCss.includes('.combobox-options.combobox-options-portal')
    && comboboxComponentCss.includes('.combobox-option.selected'),
  'combobox component owns portal, option, and selection states'
);
check(
  !legacyFoundationCss.includes('.combobox-options.combobox-options-portal')
    && !legacyFoundationCss.includes('.combobox-option.ui-option.selected'),
  'legacy foundation releases shared combobox ownership'
);

[
  '.page-frame',
  '.ui-frame',
  '.ui-frame-head',
  '.ui-frame-body',
  '.ui-panel',
  '.ui-panel-head',
  '.ui-panel-body',
  '.ui-panel-title',
  '.ui-panel-tag',
  '.ui-panel-actions',
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
  '.tool-settings-layout',
  '.tool-settings-subframe',
  '.tool-settings-grid',
  '.tool-settings-cell',
  '.tool-settings-label',
  '.tool-settings-control',
  '.tool-settings-compound',
  '.tool-settings-combobox',
  '.tool-settings-choice-cell',
  '.tool-settings-choice-label',
  '.tool-settings-choice-control',
  '.tool-settings-choice-combobox',
  '.tool-settings-choice-surface',
  '.tool-settings-choice-input',
  '.tool-settings-select-cell',
  '.tool-settings-select-label',
  '.tool-settings-select-control',
  '.tool-settings-select-combobox',
  '.tool-settings-select-input',
  '.tool-settings-condition-cell',
  '.tool-settings-condition-control',
  '.tool-settings-status-combobox',
  '.tool-settings-hp-control',
  '.tool-settings-hp-input',
  '.tool-stat-panel',
  '.tool-stat-set',
  '.tool-stat-panel-head',
  '.tool-stat-panel-title',
  '.tool-stat-panel-body',
  '.tool-stat-table-frame',
  '.tool-stat-head-row',
  '.tool-stat-head-cell',
  '.tool-stat-row',
  '.tool-stat-grid',
  '.tool-stat-total',
  '.tool-stat-col-name',
  '.tool-stat-col-base',
  '.tool-stat-col-point',
  '.tool-stat-col-magic',
  '.tool-stat-col-final',
  '.tool-stat-col-rank',
  '.tool-stat-name-text',
  '.tool-stat-nature-mark',
  '.tool-stat-nature-up',
  '.tool-stat-nature-down',
  '.tool-stat-nature-empty',
  '.tool-stat-preset-button',
  '.tool-stat-preset-popover',
  '.tool-stat-preset-menu',
  '.tool-stat-preset-label',
  '.tool-stat-preset-row',
  '.tool-stat-preset-option',
  '.tool-stat-bulk-strip',
  '.tool-stat-bulk-card',
  '.tool-stat-bulk-label',
  '.tool-stat-bulk-value',
  '.tool-stat-magic',
  '.tool-stat-magic-prev',
  '.tool-stat-magic-current',
  '.tool-stat-magic-next',
  '.tool-stat-point-stepper',
  '.tool-stat-point-button',
  '.tool-stat-point-input',
  '.tool-stat-rank-stepper',
  '.tool-stat-rank-button',
  '.tool-stat-rank-value',
  '.tool-stat-rank-empty',
  '.tool-move-panel',
  '.tool-move-panel-head',
  '.tool-move-panel-title',
  '.tool-move-panel-body',
  '.tool-move-list-frame',
  '.tool-move-list',
  '.tool-move-head-row',
  '.tool-move-row',
  '.tool-move-combobox',
  '.tool-move-input',
  '.tool-move-type-control',
  '.tool-move-power-control',
  '.tool-move-power-input',
  '.tool-move-power-readout',
].forEach(selector => {
  check(allCss.includes(selector), `${selector} has CSS ownership`);
});

[
  '--ui-frame-border',
  '--ui-frame-bg',
  '--ui-frame-radius',
  '--ui-frame-shadow',
  '--ui-frame-body-padding',
  '--ui-panel-body-stack-gap',
  '--ui-panel-point-height',
  '--ui-action-gap',
  '--ui-panel-actions-gap',
  '--ui-panel-action-height',
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
check(!allCss.includes('.tool-page .ui-frame'), 'tool pages rely on shared ui-frame styles');
check(allCss.includes('.ui-frame.ui-panel'), 'shared ui-frame ui-panel selector owns panel point sizing');
check(!allCss.includes('.tool-page .ui-frame-head'), 'tool pages rely on shared ui-frame-head styles');
check(!allCss.includes('.tool-page .ui-frame-body'), 'tool pages rely on shared ui-frame-body styles');
const toolRepeatedSubframes = [
  '.matchup-control-row',
  '.matchup-slots',
  '.matchup-coverage-inputs',
  '.matchup-slot',
  '.matchup-coverage-card',
].every(selector => allCss.includes(selector));
check(
  allCss.includes('.tool-page :where(') && toolRepeatedSubframes,
  'tool pages centralize repeated subframes'
);
check(allCss.includes('#page-calc .ui-metric-chip'), 'calculator metrics target shared chips');
check(allCss.includes('#page-calc .ui-stat-readout'), 'calculator stat readouts target shared typography');
check(!allCss.includes('--calc-radius'), 'calculator panels do not define a legacy radius token');
check(!allCss.includes('--calc-shadow'), 'calculator panels do not define a legacy shadow token');

const pageCss = ['pages/calculator-base.css', 'pages/calculator.css', 'pages/dex.css', '07-tools-redesign.css']
  .map(file => cssByFile.get(file) || '')
  .join('\n');
check(!pageCss.includes('--panel-point-height'), 'page CSS does not override panel point height');
check(!pageCss.includes('#page-calc .ui-panel > .ui-panel-body'), 'calculator panel bodies use shared frame padding');
check(allCss.includes('.ui-panel-body.ui-subframe-stack'), 'shared panel body subframe stack spacing exists');
check(/\.ui-frame-row\s*\{[^}]*gap:\s*var\(--ui-frame-row-gap\)/s.test(allCss), 'shared frame rows own row gap');
check(/\.page-frame\s*>[\s\S]*\+\s*:where\(\.ui-frame-row,\s*\.ui-frame,\s*\.ui-panel\)\s*\{[^}]*margin-top:\s*var\(--ui-frame-row-gap\)/s.test(allCss), 'shared page frame owns panel row spacing');
check(!pageCss.includes('#page-calc .calc-results-body.ui-subframe-stack'), 'calculator results body uses shared stack spacing');
check(!pageCss.includes('#page-calc .battle-grid > .ui-panel > .ui-subframe-stack'), 'calculator side panels use shared stack spacing');
check(!pageCss.includes('#page-calc #calc-field-panel > .ui-subframe-stack'), 'calculator field panel uses shared stack spacing');
const structuralSpacingSelectorRe = /(battle-grid|calc-field-row|calc-results-body|battle-field-select-frame|calc-field-effects-frame|matchup-results-panel|matchup-control-row|matchup-slots|matchup-coverage-inputs|matchup-coverage-card|matchup-result-layout|ft-layout|ft-speed-panel-body|ft-speed-embedded|ft-speed-body|rc-grid|rc-my-build-row|rc-input-grid|rc-setup-grid|rc-my-moves-panel|rc-move-set-grid|rc-input-block|rc-side-condition-row|rc-speed-field-row|tool-stat-panel-head|tool-stat-panel-title|tool-stat-panel\b|tool-move-panel-head|tool-move-panel-title|tool-move-panel-body|tool-move-panel\b)/;
const structuralSpacingPropRe = /(?:^|\n)\s*(margin(?:-top|-bottom|-left|-right)?|gap|row-gap|column-gap)\s*:/;
const structuralSpacingHits = [];
for (const [file, css] of cssByFile) {
  if (!['pages/calculator-base.css', 'pages/calculator.css', '07-tools-redesign.css'].includes(file)) continue;
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = blockRe.exec(css))) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    const body = match[2];
    if (structuralSpacingSelectorRe.test(selector) && structuralSpacingPropRe.test(body)) {
      structuralSpacingHits.push(`${file}: ${selector}`);
    }
  }
}
check(
  structuralSpacingHits.length === 0,
  `structural panel layouts use shared margin/gap${structuralSpacingHits.length ? ` (${structuralSpacingHits.join('; ')})` : ''}`
);
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

const calcLayoutCss = cssByFile.get('pages/calculator.css') || '';
const calcBaseCss = cssByFile.get('pages/calculator-base.css') || '';
const dexPageCss = cssByFile.get('pages/dex.css') || '';
const toolPageCss = cssByFile.get('07-tools-redesign.css') || '';
const legacyPolishCss = cssByFile.get('09-product-polish.css') || '';
check(Boolean(calcLayoutCss), 'calculator page stylesheet exists');
check(Boolean(calcBaseCss), 'calculator page visual base stylesheet exists');
check(!cssByFile.has('05-calc-sample-layout.css'), 'legacy calculator layout stylesheet is removed');
check(!cssByFile.has('03-calc-redesign.css'), 'legacy calculator redesign stylesheet is removed');
check(Boolean(dexPageCss), 'dex page stylesheet exists');
check(!cssByFile.has('06-dex-redesign.css'), 'legacy dex redesign stylesheet is removed');
check(
  dexPageCss.includes('.dex-pagination') && dexPageCss.includes('.dex-page-button'),
  'dex page owns paginated list controls'
);
check(
  toolPageCss.includes('.ft-hp-panel[hidden]')
    && toolPageCss.includes('.rc-prerequisite'),
  'tool page styles own staged empty and result states'
);
check(
  !legacyPolishCss.includes('.ft-hp-panel:has(#ft-hp-body:empty)'),
  'legacy polish releases fine-tune empty panel ownership'
);
check(
  /\.tool-move-list--critical\s+\.tool-move-power-readout\s*\{[^}]*grid-column:\s*6/s.test(calcLayoutCss),
  'calculator critical layout places power readout in sixth column'
);
check(
  /\.tool-move-list--critical\s*\{[^}]*--tool-move-readout-width:\s*clamp\(96px,\s*18%,\s*116px\)/s.test(calcLayoutCss),
  'calculator critical layout reserves readable power width'
);

if (existsSync(GENERATED)) {
  const generated = read(GENERATED);
  check(
    generated.includes('@layer reset, tokens, base, legacy-pages, legacy-foundation, components, layouts, pages, utilities, themes, legacy-polish;'),
    'generated CSS declares deterministic cascade layer order'
  );
  ['tokens', 'legacy-foundation', 'pages', 'themes', 'legacy-polish'].forEach(layer => {
    check(generated.includes(`@layer ${layer} {`), `generated CSS contains ${layer} layer`);
  });
  ['ui-frame', 'ui-frame-head', 'ui-frame-body', 'ui-control-frame', 'ui-action-row'].forEach(className => {
    check(generated.includes(className), `generated HTML contains ${className}`);
  });
}

if (failed) process.exit(1);
