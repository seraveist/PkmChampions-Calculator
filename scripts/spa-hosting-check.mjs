import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE = path.join(ROOT, 'src', 'calc-template.html');
const GENERATED = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const PAGES = ['calc', 'revcalc', 'finetune', 'matchup', 'dex'];
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

function jsonScript(source, id) {
  const match = source.match(new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`));
  if (!match) return { ok: false, value: null, error: 'missing' };
  try {
    return { ok: true, value: JSON.parse(match[1]), error: null };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
  }
}

function attrValues(source, attrName) {
  const re = new RegExp(`\\s${attrName}=["']([^"']+)["']`, 'gi');
  return [...source.matchAll(re)].map(match => match[1]);
}

check(existsSync(TEMPLATE), 'template exists');
check(existsSync(GENERATED), 'generated HTML exists');

const template = existsSync(TEMPLATE) ? read(TEMPLATE) : '';
const generated = existsSync(GENERATED) ? read(GENERATED) : '';
const generatedSizeKb = generated.length / 1024;

check(generated.includes('<!DOCTYPE html>'), 'generated file is a complete HTML document');
check(generated.includes('<meta charset="UTF-8">'), 'generated file declares charset');
check(generated.includes('name="viewport"'), 'generated file declares viewport');
check(generated.includes('<style>') && !generated.includes('/* __INLINE_CSS__ */'), 'CSS is inlined into generated HTML');
check(generated.includes('"use strict";') && !generated.includes('// __INLINE_JS__'), 'JS is inlined into generated HTML');
check(!/__[A-Z0-9_]+__/.test(generated), 'generated HTML has no unresolved build placeholders');
check(generatedSizeKb > 100, `generated HTML is non-trivial (${generatedSizeKb.toFixed(1)} KB)`);

const scriptSrcs = attrValues(generated, 'src');
check(scriptSrcs.length === 0, `generated HTML has no external script dependencies${scriptSrcs.length ? ` (${scriptSrcs.join(', ')})` : ''}`);

const hrefs = attrValues(generated, 'href');
const unsafeHrefs = hrefs.filter(href => /^(file:|[a-zA-Z]:\\|\.{1,2}[\\/])/.test(href));
check(unsafeHrefs.length === 0, `generated HTML has no local filesystem hrefs${unsafeHrefs.length ? ` (${unsafeHrefs.join(', ')})` : ''}`);

const localUrlMatches = generated.match(/(?:file:\/\/|localhost|127\.0\.0\.1|C:\\Users\\|\/Users\/)/g) || [];
check(localUrlMatches.length === 0, `generated HTML has no local-only URLs${localUrlMatches.length ? ` (${localUrlMatches.join(', ')})` : ''}`);

for (const id of DATA_IDS) {
  const result = jsonScript(generated, id);
  check(result.ok, `${id} JSON script parses${result.error ? ` (${result.error})` : ''}`);
  if (result.ok && Array.isArray(result.value)) {
    check(result.value.length > 0, `${id} array has entries`);
  }
}

for (const page of PAGES) {
  const navId = `nav-${page}`;
  const pageId = `page-${page}`;
  check(generated.includes(`id="${navId}"`) && generated.includes(`aria-controls="${pageId}"`), `${navId} controls ${pageId} in generated HTML`);
  check(generated.includes(`id="${pageId}"`) && generated.includes(`aria-labelledby="${navId}"`), `${pageId} is a generated tab panel`);
}

check(generated.includes('id="dexDetailModal"'), 'global dex modal exists in generated HTML');
check(generated.includes('id="partyPresetOpen"'), 'global party preset entrypoint exists in generated HTML');
check(generated.includes('data-party-import-target="matchup"'), 'matchup party import target exists in generated HTML');
check(template.includes('class="site-shell"'), 'template keeps single shell layout');
check(template.includes('class="page page-frame'), 'template keeps tabbed page-frame layout');

const singleAppSourceContracts = [
  ['bindMainNavigation()', 'main nav binding initializes'],
  ['activateMainPage(tab.dataset.page', 'main nav activates page panels'],
  ['syncUiTabs(document.querySelectorAll(\'.nav-tab\'), tab)', 'main nav syncs tab states'],
  ['syncUiPanels(document.querySelectorAll(\'.page\'), activePage)', 'main nav syncs page panels'],
  ['activateMainPageFromHash', 'main nav supports hash entry'],
  ['ftApplyToCalc', 'fine-tune can apply state to calculator'],
  ['applyDexAction', 'dex detail can apply state to calculator'],
  ['partyPresetApplyPartyToMatchup', 'party preset can apply parties to matchup'],
];

for (const [needle, label] of singleAppSourceContracts) {
  check(generated.includes(needle), label);
}

if (failed) process.exit(1);
