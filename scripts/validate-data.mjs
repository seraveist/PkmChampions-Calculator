import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule, applyModOverrides } from './ts-loader.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const CHAMP = path.join(DATA, 'mods', 'champions');
const HTML_PATH = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const UNOFFICIAL_NONSTANDARD = new Set(['CAP', 'Custom']);
const KINDS = ['pokemon', 'moves', 'abilities', 'items'];

function readJson(fp, fallback = {}) {
  if (!existsSync(fp)) return fallback;
  return JSON.parse(readFileSync(fp, 'utf8'));
}

function readJsonScript(html, id) {
  const re = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`);
  const match = html.match(re);
  if (!match) throw new Error(`Missing JSON script: ${id}`);
  return JSON.parse(match[1]);
}

function readBase(file, exportName) {
  return loadTsModule(path.join(DATA, file))[exportName] || {};
}

function readChamp(file, exportName) {
  const fp = path.join(CHAMP, file);
  return existsSync(fp) ? loadTsModule(fp)[exportName] || {} : {};
}

function normalizeId(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanManual(name) {
  const raw = readJson(path.join(DATA, 'ko', `${name}.manual.json`), {});
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => (
    !key.startsWith('_') && typeof value === 'string' && value.trim()
  )));
}

function filterSets() {
  const raw = readJson(path.join(DATA, 'overrides', 'filters.json'), {});
  const toSets = group => Object.fromEntries(KINDS.map(kind => [
    kind,
    new Set(Array.isArray(group?.[kind]) ? group[kind].filter(Boolean) : []),
  ]));
  return { exclude: toSets(raw.exclude), include: toSets(raw.include) };
}

function isPast(entry) {
  return entry?.isNonstandard === 'Past' || entry?.isNonstandard === 'Future';
}

function isAvailable(entry, kind, id, filters) {
  if (filters.include[kind].has(id)) return !isPast(entry);
  if (filters.exclude[kind].has(id)) return false;
  return !isPast(entry) && !UNOFFICIAL_NONSTANDARD.has(entry?.isNonstandard);
}

const html = readFileSync(HTML_PATH, 'utf8');
const finalData = {
  pokemon: readJsonScript(html, 'data-pokemon'),
  moves: readJsonScript(html, 'data-moves'),
  abilities: readJsonScript(html, 'data-abilities'),
  items: readJsonScript(html, 'data-items'),
  natures: readJsonScript(html, 'data-natures'),
  typechart: readJsonScript(html, 'data-typechart'),
  rules: readJsonScript(html, 'data-rules'),
};

const finalSets = Object.fromEntries(KINDS.map(kind => [kind, new Set(finalData[kind].map(entry => entry.id))]));
const byId = Object.fromEntries(KINDS.map(kind => [kind, Object.fromEntries(finalData[kind].map(entry => [entry.id, entry]))]));

const source = {
  pokemon: applyModOverrides(readBase('pokedex.ts', 'Pokedex'), readChamp('pokedex.ts', 'Pokedex')),
  moves: applyModOverrides(readBase('moves.ts', 'Moves'), readChamp('moves.ts', 'Moves')),
  abilities: applyModOverrides(readBase('abilities.ts', 'Abilities'), readChamp('abilities.ts', 'Abilities')),
  items: applyModOverrides(readBase('items.ts', 'Items'), readChamp('items.ts', 'Items')),
};
const filters = filterSets();
const entryEffects = readJson(path.join(DATA, 'overrides', 'entry-effects.json'), { effects: {}, blockers: {} });
const formGroupsRaw = readJson(path.join(DATA, 'overrides', 'form-groups.json'), {});
const formGroups = [];
for (const [mode, groups] of Object.entries(formGroupsRaw || {})) {
  if (mode.startsWith('_') || !groups || typeof groups !== 'object') continue;
  for (const [key, group] of Object.entries(groups)) {
    formGroups.push({
      key: normalizeId(key),
      mode,
      forms: Array.isArray(group?.forms) ? group.forms.map(normalizeId).filter(Boolean) : [],
    });
  }
}

let failed = false;
function fail(message) {
  failed = true;
  console.error(`data invalid: ${message}`);
}

for (const [kind, entries] of Object.entries(finalData)) {
  if (!Array.isArray(entries) && kind !== 'typechart' && kind !== 'rules') fail(`${kind} is not an array`);
  if (Array.isArray(entries) && entries.length === 0) fail(`${kind} is empty`);
}

for (const kind of KINDS) {
  for (const [id, entry] of Object.entries(source[kind])) {
    if (!entry?.name) continue;
    if (!isAvailable(entry, kind, id, filters) && finalSets[kind].has(id)) {
      fail(`${kind}.${id} should be filtered out (${entry.isNonstandard || 'manual exclude'})`);
    }
  }
}

for (const [category, kind] of [['pokemon', 'pokemon'], ['moves', 'moves'], ['abilities', 'abilities'], ['items', 'items']]) {
  const manual = cleanManual(category);
  for (const [id, value] of Object.entries(manual)) {
    if (finalSets[kind].has(id) && byId[kind][id].koName !== value) {
      fail(`${kind}.${id} koName should prefer manual override`);
    }
  }
}

for (const [category, kind] of [['desc-moves', 'moves'], ['desc-abilities', 'abilities'], ['desc-items', 'items']]) {
  const manual = cleanManual(category);
  for (const [id, value] of Object.entries(manual)) {
    if (finalSets[kind].has(id) && byId[kind][id].desc !== value) {
      fail(`${kind}.${id} desc should prefer manual override`);
    }
  }
}

for (const pokemon of finalData.pokemon) {
  if (!Array.isArray(pokemon.ls) || pokemon.ls.length === 0) {
    fail(`pokemon.${pokemon.id} has empty learnset`);
  }
  for (const ability of Object.values(pokemon.ab || {})) {
    const id = normalizeId(ability);
    if (id && !finalSets.abilities.has(id)) fail(`pokemon.${pokemon.id} references missing ability ${id}`);
  }
  if (pokemon.requiredItem) {
    const id = normalizeId(pokemon.requiredItem);
    if (!finalSets.items.has(id)) fail(`pokemon.${pokemon.id} references missing required item ${id}`);
  }
  for (const moveId of pokemon.ls || []) {
    if (!finalSets.moves.has(moveId)) fail(`pokemon.${pokemon.id} learnset references missing move ${moveId}`);
  }
}

const bannedFormGroupIds = new Set(['greninjabond', 'greninjaash']);
const regionalFormTokens = ['alola', 'galar', 'hisui', 'paldea'];
for (const group of formGroups) {
  if (!group.key) fail('form group has empty key');
  if (group.forms.length < 2) fail(`form group ${group.key} must include at least two forms`);
  if (!group.forms.includes(group.key)) fail(`form group ${group.key} must include its base id`);
  for (const formId of group.forms) {
    const sourcePokemon = source.pokemon[formId];
    const builtPokemon = byId.pokemon[formId];
    if (!sourcePokemon) fail(`form group ${group.key} references missing source pokemon ${formId}`);
    if (!finalSets.pokemon.has(formId)) fail(`form group ${group.key} references missing built pokemon ${formId}`);
    if (bannedFormGroupIds.has(formId)) fail(`form group ${group.key} must not include Battle Bond Greninja form ${formId}`);
    if (/mega|primal/.test(formId) || sourcePokemon?.forme?.startsWith('Mega') || sourcePokemon?.forme?.startsWith('Primal')) {
      fail(`form group ${group.key} must not include Mega/Primal form ${formId}`);
    }
    if (regionalFormTokens.some(token => normalizeId(sourcePokemon?.forme).includes(token))) {
      fail(`form group ${group.key} must not include regional form ${formId}`);
    }
    if (builtPokemon) {
      if (builtPokemon.formGroup !== group.key) fail(`pokemon.${formId} has mismatched formGroup`);
      if (!Array.isArray(builtPokemon.formGroupForms) || builtPokemon.formGroupForms.length !== group.forms.length) {
        fail(`pokemon.${formId} has incomplete formGroupForms`);
      }
      if (!builtPokemon.bs || !builtPokemon.types?.length || !builtPokemon.ab) {
        fail(`pokemon.${formId} is missing form switch battle data`);
      }
    }
  }
}

for (const move of finalData.moves) {
  const original = source.moves[move.id] || {};
  if ((original.secondary || original.secondaries) && move.sec !== true) {
    fail(`move.${move.id} is missing sec flag`);
  }
  if (original.recoil && !move.recoil) fail(`move.${move.id} is missing recoil data`);
  if (original.target && move.tgt !== original.target) fail(`move.${move.id} has mismatched tgt`);
  if (original.willCrit === true && move.willCrit !== true) {
    fail(`move.${move.id} is missing willCrit flag`);
  }
}

for (const abilityId of Object.keys(entryEffects.effects || {})) {
  if (!finalSets.abilities.has(abilityId)) fail(`entry-effects.${abilityId} references missing ability`);
}
for (const [group, abilityIds] of Object.entries(entryEffects.blockers || {})) {
  if (!Array.isArray(abilityIds)) {
    fail(`entry-effects.blockers.${group} must be an array`);
    continue;
  }
  for (const abilityId of abilityIds) {
    if (!finalSets.abilities.has(abilityId)) fail(`entry-effects.blockers.${group} references missing ability ${abilityId}`);
  }
}
if (Object.keys(entryEffects.effects || {}).length && !finalData.rules.entryEffects) {
  fail('rules.entryEffects is missing from built data');
}

if (!Object.keys(finalData.typechart || {}).length) fail('typechart is empty');
if (!finalData.natures.some(nature => nature.id === 'adamant' && nature.plus === 'atk' && nature.minus === 'spa')) {
  fail('natures data does not include adamant plus/minus');
}

if (failed) process.exit(1);
console.log('data validate ok');
