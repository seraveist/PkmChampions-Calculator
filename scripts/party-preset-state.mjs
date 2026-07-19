import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadPartyPresetApi() {
  const pokemon = {
    id: 'testmon',
    name: 'Testmon',
    koName: '테스트몬',
    types: ['Normal'],
    ab: { 0: 'Test Ability' },
    ls: ['testmove'],
  };
  const ability = { id: 'testability', name: 'Test Ability', koName: '테스트 특성' };
  const move = { id: 'testmove', name: 'Test Move', koName: '테스트 기술', cat: 'Physical' };
  const nature = { id: 'hardy', name: 'Hardy', ko: '노력' };

  const context = vm.createContext({
    console,
    STATS: ['hp', 'atk', 'def', 'spa', 'spd', 'spe'],
    POKEMON: [pokemon],
    PokemonById: { [pokemon.id]: pokemon },
    ABILITIES: [ability],
    AbilityById: { [ability.id]: ability },
    ITEMS: [],
    ItemById: {},
    MOVES: [move],
    MoveById: { [move.id]: move },
    NATURES: [nature],
    NATURE_BY_ID: { [nature.id]: nature },
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    toId(value) {
      return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    defaultPokemonAbilityId() { return ability.id; },
    defaultPokemonItemId() { return ''; },
    defaultPokemonTypes() { return ['Normal']; },
    setSideDamageBlockActive() {},
  });

  const source = `${readFileSync(path.join(ROOT, 'src', 'js', '04-00-party-presets.js'), 'utf8')}
    globalThis.__partyApi = {
      normalizePartyPresetEvs,
      normalizePartyPresetMember,
      normalizePartyPresetData,
      partyPresetParseShowdownSet,
      partyPresetApplyMemberToSideState,
    };
  `;
  vm.runInContext(source, context, { filename: 'party-preset-state.vm.js' });
  return context.__partyApi;
}

function total(evs) {
  return Object.values(evs).reduce((sum, value) => sum + value, 0);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`[FAIL] ${label}`);
    console.error('expected:', expected);
    console.error('actual:  ', actual);
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] ${label}`);
}

function assertJsonEqual(actual, expected, label) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

const api = loadPartyPresetApi();

const legal = api.normalizePartyPresetEvs({ hp: 32, atk: 32, def: 2 });
assertJsonEqual(legal, { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 }, 'legal party spread is preserved');
assertEqual(total(legal), 66, 'legal party spread keeps total 66');

const overflow = api.normalizePartyPresetEvs({ hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32 });
assertJsonEqual(overflow, { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 }, 'overflow party spread is capped deterministically');
assertEqual(total(overflow), 66, 'overflow party spread is capped at total 66');

const sanitized = api.normalizePartyPresetEvs({ hp: 12.9, atk: -3, def: '20', spa: 'invalid' });
assertJsonEqual(sanitized, { hp: 12, atk: 0, def: 20, spa: 0, spd: 0, spe: 0 }, 'party spread normalizes fractional and invalid values');

const imported = api.normalizePartyPresetData({
  parties: [{
    name: 'Import',
    members: [{ pokemon: 'testmon', nature: 'hardy', evs: { hp: 32, atk: 32, def: 32 } }],
  }],
});
assertEqual(total(imported.parties[0].members[0].evs), 66, 'JSON import normalization enforces total 66');
assertEqual(imported.parties[0].members[0].evs.def, 2, 'JSON import trims the first overflowing stat');

const showdown = api.partyPresetParseShowdownSet(`Testmon
Ability: Test Ability
EVs: 32 HP / 32 Atk / 32 Def
Hardy Nature
- Test Move`);
assertEqual(total(showdown.evs), 66, 'Showdown import normalization enforces total 66');
assertJsonEqual(showdown.evs, { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 }, 'Showdown import uses deterministic overflow trimming');

const side = { evs: {}, moves: [] };
api.partyPresetApplyMemberToSideState(side, {
  pokemon: 'testmon',
  nature: 'hardy',
  evs: { hp: 32, atk: 32, def: 32 },
  moves: ['testmove'],
});
assertEqual(total(side.evs), 66, 'applying a preset to calculator state enforces total 66');
assertEqual(side.evs.def, 2, 'calculator state receives the normalized spread');

if (process.exitCode) process.exit(process.exitCode);
