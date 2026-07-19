import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCalcUiSource, readViewSource } from './source-utils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const htmlPath = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const templatePath = path.join(ROOT, 'src', 'calc-template.html');
const stylesDir = path.join(ROOT, 'src', 'styles');

const html = readFileSync(htmlPath, 'utf8');
const template = readFileSync(templatePath, 'utf8');
const viewSource = readViewSource(ROOT);
const calcUiSource = readCalcUiSource(ROOT);
function listCssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .flatMap(entry => entry.isDirectory()
      ? listCssFiles(path.join(dir, entry.name))
      : (entry.isFile() && entry.name.endsWith('.css') ? [path.join(dir, entry.name)] : []))
    .sort((a, b) => a.localeCompare(b));
}
const css = listCssFiles(stylesDir)
  .map(file => readFileSync(file, 'utf8'))
  .join('\n\n');

let failed = false;

function fail(message) {
  failed = true;
  console.error(`dex smoke invalid: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function expectText(source, text, message) {
  assert(source.includes(text), message);
}

function expectPattern(source, pattern, message) {
  assert(pattern.test(source), message);
}

function readJsonScript(source, id) {
  const re = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`);
  const match = source.match(re);
  if (!match) {
    fail(`missing JSON script ${id}`);
    return [];
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    fail(`invalid JSON script ${id}: ${error.message}`);
    return [];
  }
}

function toId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function duplicates(entries) {
  const seen = new Set();
  const dupes = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) dupes.add(entry.id);
    seen.add(entry.id);
  }
  return [...dupes];
}

const data = {
  pokemon: readJsonScript(html, 'data-pokemon'),
  moves: readJsonScript(html, 'data-moves'),
  abilities: readJsonScript(html, 'data-abilities'),
  items: readJsonScript(html, 'data-items'),
};

for (const placeholder of ['__POKEMON_DATA__', '__MOVES_DATA__', '__ABILITIES_DATA__', '__ITEMS_DATA__', '__INLINE_JS__']) {
  assert(!html.includes(placeholder), `built HTML still contains ${placeholder}`);
}

for (const [kind, entries] of Object.entries(data)) {
  assert(Array.isArray(entries) && entries.length > 0, `${kind} data is empty`);
  const dupes = duplicates(entries);
  assert(dupes.length === 0, `${kind} has duplicate ids: ${dupes.join(', ')}`);
  const missingKo = entries.filter(entry => !entry.koName).map(entry => entry.id);
  assert(missingKo.length === 0, `${kind} has missing koName: ${missingKo.slice(0, 10).join(', ')}`);
}

const pokemonById = new Map(data.pokemon.map(entry => [entry.id, entry]));
const moveIds = new Set(data.moves.map(entry => entry.id));
const abilityIds = new Set(data.abilities.map(entry => entry.id));

assert(pokemonById.has('aegislash') && pokemonById.has('aegislashblade'), 'Aegislash shield/blade forms must both be visible in dex data');
assert(pokemonById.get('castformsunny')?.koName?.includes('태양'), 'Castform sunny Korean override must be present');

const missingLearnsets = data.pokemon.filter(entry => !Array.isArray(entry.ls) || entry.ls.length === 0).map(entry => entry.id);
assert(missingLearnsets.length === 0, `pokemon with empty learnsets: ${missingLearnsets.slice(0, 10).join(', ')}`);

const rotomFormLearnsets = [
  ['rotomheat', 'overheat'],
  ['rotomwash', 'hydropump'],
  ['rotomfrost', 'blizzard'],
  ['rotomfan', 'airslash'],
  ['rotommow', 'leafstorm'],
];
for (const [pokemonId, signatureMove] of rotomFormLearnsets) {
  const learnset = pokemonById.get(pokemonId)?.ls || [];
  assert(learnset.includes(signatureMove), `${pokemonId} must keep its form move ${signatureMove}`);
  for (const baseMove of ['thunderbolt', 'voltswitch', 'willowisp']) {
    assert(learnset.includes(baseMove), `${pokemonId} must inherit rotom base move ${baseMove}`);
  }
}

const floetteMegaLearnset = pokemonById.get('floettemega')?.ls || [];
assert(floetteMegaLearnset.includes('lightofruin'), 'Floette Mega must keep Light of Ruin');
assert(floetteMegaLearnset.length > 1, 'Floette Mega must inherit a usable base learnset');

const missingMoves = [];
const missingAbilities = [];
for (const pokemon of data.pokemon) {
  for (const moveId of pokemon.ls || []) {
    if (!moveIds.has(moveId)) missingMoves.push(`${pokemon.id}.${moveId}`);
  }
  for (const abilityName of Object.values(pokemon.ab || {})) {
    const abilityId = toId(abilityName);
    if (abilityId && !abilityIds.has(abilityId)) missingAbilities.push(`${pokemon.id}.${abilityId}`);
  }
}
assert(missingMoves.length === 0, `learnset references missing moves: ${missingMoves.slice(0, 10).join(', ')}`);
assert(missingAbilities.length === 0, `pokemon references missing abilities: ${missingAbilities.slice(0, 10).join(', ')}`);

const hasMoveUsers = data.moves.some(move => data.pokemon.some(pokemon => (pokemon.ls || []).includes(move.id)));
const hasAbilityOwners = data.abilities.some(ability => data.pokemon.some(pokemon => Object.values(pokemon.ab || {}).some(name => toId(name) === ability.id)));
const hasResolvableItemUsers = data.items.some(item => (item.itemUser || []).some(user => pokemonById.has(toId(user))));
assert(hasMoveUsers, 'move detail user links have no source data');
assert(hasAbilityOwners, 'ability detail owner links have no source data');
assert(hasResolvableItemUsers, 'item detail dedicated-user links have no resolvable source data');

expectText(template, 'id="dexFullPageDetail"', 'template is missing dex full-page detail container');
expectText(template, 'id="dexDetailModal"', 'template is missing dex modal dialog');
expectText(template, 'id="dexDetailBody"', 'template is missing dex modal body');
expectText(template, 'id="dexDetailActions"', 'template is missing dex modal actions');
expectText(template, 'id="dexPagination-pokemon"', 'template is missing Pokemon pagination');
expectText(template, 'id="partyPresetOpen"', 'template is missing party preset open button');
expectText(template, 'data-party-import-target="matchup"', 'template is missing matchup party import target');
expectPattern(calcUiSource, /['"]data-party-import-target['"]:\s*`calc:\$\{sideKey\}`/, 'damage calculator is missing side party import targets');
expectPattern(viewSource, /['"]data-party-import-target['"]:\s*['"]finetune:my['"]/, 'fine-tune page is missing party import target');
expectPattern(viewSource, /['"]data-party-import-target['"]:\s*['"]revcalc:my['"]/, 'reverse-calc page is missing party import target');

expectPattern(viewSource, /if \(currentDex === 'items'\) openDexDetail\(t, id\);\s*else openDexDetailPage\(t, id\);/s, 'dex row click should route items to modal and other dex rows to full-page detail');
expectPattern(viewSource, /navigateToDexDetailPage\(link\.dataset\.dexLink, link\.dataset\.id\);/, 'modal cross-links should navigate to detail pages');
expectPattern(viewSource, /openDexDetail\(link\.dataset\.dexLink, link\.dataset\.id, \{ \.\.\.dexFullPageCtx \}\);/, 'full-page cross-links should open modal with parent context');
expectPattern(viewSource, /handleLearnsetFilterClick\(e, document\.getElementById\('dexDetailBody'\), dexModalCtx\)/, 'modal learnset filter handler is missing');
expectPattern(viewSource, /handleLearnsetFilterClick\(e, document\.getElementById\('dexFullPageDetail'\), dexFullPageCtx\)/, 'full-page learnset filter handler is missing');
expectPattern(viewSource, /applyDexAction\(btn\.dataset\.dexApply, dexModalCtx\);/, 'modal apply buttons are not wired');
expectPattern(viewSource, /applyDexAction\(btn\.dataset\.dexApply, dexFullPageCtx\);/, 'full-page apply buttons are not wired');
expectPattern(viewSource, /dexModalCtx = \{ type: null, id: null, parent: null \};/, 'modal context should reset on close');
expectPattern(viewSource, /row\('1배', 'x1', buckets\.x1\)/, 'defensive matchup should include neutral 1x row');
expectText(viewSource, 'dexItemUserTerms', 'item search should include dedicated-user aliases');
expectText(viewSource, 'const DEX_PAGE_SIZE = 24', 'dex should cap each rendered page at 24 rows');
expectPattern(viewSource, /data\.slice\(startIndex, startIndex \+ DEX_PAGE_SIZE\)/, 'dex pagination should slice filtered data before rendering');
expectText(viewSource, 'partyPresetExportPayload', 'party preset JSON export helper is missing');
expectText(viewSource, 'importPartyPresetJsonFile', 'party preset JSON import helper is missing');
expectText(viewSource, 'partyPresetParseShowdownSet', 'party preset Showdown parser is missing');
expectText(viewSource, "if (target === 'calc:atk')", 'party preset should load attacker side');
expectText(viewSource, "if (target === 'calc:def')", 'party preset should load defender side');
expectText(viewSource, "if (target === 'finetune:my')", 'party preset should load fine-tune side');
expectText(viewSource, "if (target === 'revcalc:my')", 'party preset should load reverse-calc side');
expectText(viewSource, 'partyPresetApplyPartyToMatchup', 'party preset should load matchup parties');
expectText(viewSource, 'partyPresetCollapsedParties', 'party preset party collapse state is missing');
expectText(viewSource, 'partyPresetExpandedSlots', 'party preset slot expand state is missing');

for (const selector of ['.dex-modal', '.dex-modal .ui-frame-body', '.dex-fullpage-head', '.dex-fullpage-body', '.dex-link', '.learnset-filter-row', '.dex-pagination', '.matchup-grid', '.matchup-label.x1']) {
  expectText(css, selector, `CSS is missing ${selector}`);
}
expectPattern(css, /#page-dex \.dex-content\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}/, 'inactive dex tab pages should be hidden');
expectPattern(css, /#page-dex \.dex-content\.active\s*\{[\s\S]*?display:\s*block;[\s\S]*?\}/, 'active dex tab page should be visible');
expectPattern(css, /\.dex-modal\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?transform:\s*translate\(-50%, -50%\);[\s\S]*?\}/, 'dex modal should be anchored to the viewport center');
expectPattern(css, /\.dex-modal-actions:has\(\.dex-action-label\)[\s\S]*grid-template-columns:\s*auto repeat\(4,/, 'move detail modal slot buttons should stay in one row');
expectPattern(css, /\.party-preset-party\.collapsed\s*>\s*\.party-preset-slot-grid\s*\{[\s\S]*?display:\s*none;/, 'collapsed party should hide slot grid');
expectPattern(css, /\.party-preset-slot\.collapsed\s*>\s*\.party-preset-detail\s*\{[\s\S]*?display:\s*none;/, 'collapsed slot should hide detail');
expectPattern(css, /@media \(max-width: 760px\)[\s\S]*\.dex-fullpage-title[\s\S]*\.dex-modal \.ui-frame-head/, 'tablet CSS should cover dex modal and full-page detail');
expectPattern(css, /@media \(max-width: 520px\)[\s\S]*#page-dex \.dex-type-filter[\s\S]*\.matchup-grid/, 'mobile CSS should cover dex filters and matchup grid');

if (failed) process.exit(1);
console.log('dex smoke ok');
