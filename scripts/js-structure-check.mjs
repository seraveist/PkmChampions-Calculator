import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JS_DIR = path.join(ROOT, 'src', 'js');
const PARTY_MODULES = [
  ['04-00-party-presets-state.js', 'normalizePartyPresetData'],
  ['04-01-party-presets-image.js', 'partyPresetDrawSummaryImage'],
  ['04-02-party-presets-integration.js', 'partyPresetParseShowdownParty'],
  ['04-03-party-presets-ui.js', 'renderPartyPresetModal'],
];
const CALC_COMBOBOX_MODULES = [
  ['03-20-calc-combobox.js', 'wireSharedComboboxKeyboard'],
  ['03-21-calc-combobox-options.js', 'calcRenderComboboxOption'],
  ['03-22-calc-combobox-events.js', 'wireCalcCombobox'],
];
const DEX_MODULES = [
  ['04-10-dex.js', 'renderDexContent'],
  ['04-11-dex-detail.js', 'buildDexContent'],
];
const FINE_TUNE_MODULES = [
  ['04-30-finetune.js', 'ftHpBreakpointRules'],
  ['04-31-finetune-render.js', 'renderFineTuneHp'],
];
const REVERSE_EVENT_MODULES = [
  ['04-44-revcalc-events.js', 'rcSyncInputsFromDom'],
  ['04-45-revcalc-actions.js', 'rcApplyResultToCalc'],
];
const PARTY_MODULE_SIZE_BUDGET = 34 * 1024;
const CALC_COMBOBOX_MODULE_SIZE_BUDGET = 34 * 1024;
const DEX_MODULE_SIZE_BUDGET = 32 * 1024;
const FEATURE_UI_MODULE_SIZE_BUDGET = 36 * 1024;
let failed = false;

function check(condition, label) {
  if (condition) console.log(`[PASS] ${label}`);
  else {
    failed = true;
    console.error(`[FAIL] ${label}`);
  }
}

check(!existsSync(path.join(JS_DIR, '04-00-party-presets.js')), 'legacy party preset monolith is removed');
for (const [file, ownershipNeedle] of PARTY_MODULES) {
  const filePath = path.join(JS_DIR, file);
  check(existsSync(filePath), `${file} exists`);
  if (!existsSync(filePath)) continue;
  const source = readFileSync(filePath, 'utf8');
  check(source.includes(ownershipNeedle), `${file} owns ${ownershipNeedle}`);
  check(statSync(filePath).size <= PARTY_MODULE_SIZE_BUDGET, `${file} stays within module size budget`);
}

for (const [file, ownershipNeedle] of CALC_COMBOBOX_MODULES) {
  const filePath = path.join(JS_DIR, file);
  check(existsSync(filePath), `${file} exists`);
  if (!existsSync(filePath)) continue;
  const source = readFileSync(filePath, 'utf8');
  check(source.includes(ownershipNeedle), `${file} owns ${ownershipNeedle}`);
  check(
    statSync(filePath).size <= CALC_COMBOBOX_MODULE_SIZE_BUDGET,
    `${file} stays within module size budget`,
  );
}

for (const [file, ownershipNeedle] of DEX_MODULES) {
  const filePath = path.join(JS_DIR, file);
  check(existsSync(filePath), `${file} exists`);
  if (!existsSync(filePath)) continue;
  const source = readFileSync(filePath, 'utf8');
  check(source.includes(ownershipNeedle), `${file} owns ${ownershipNeedle}`);
  check(statSync(filePath).size <= DEX_MODULE_SIZE_BUDGET, `${file} stays within module size budget`);
}

for (const [file, ownershipNeedle] of [...FINE_TUNE_MODULES, ...REVERSE_EVENT_MODULES]) {
  const filePath = path.join(JS_DIR, file);
  check(existsSync(filePath), `${file} exists`);
  if (!existsSync(filePath)) continue;
  const source = readFileSync(filePath, 'utf8');
  check(source.includes(ownershipNeedle), `${file} owns ${ownershipNeedle}`);
  check(statSync(filePath).size <= FEATURE_UI_MODULE_SIZE_BUDGET, `${file} stays within module size budget`);
}

if (failed) process.exit(1);
