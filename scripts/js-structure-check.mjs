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
const PARTY_MODULE_SIZE_BUDGET = 34 * 1024;
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

if (failed) process.exit(1);
