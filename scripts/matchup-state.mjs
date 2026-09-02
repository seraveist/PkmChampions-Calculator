import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const abilities = [
  { id: 'blaze', name: 'Blaze', koName: '맹화' },
  { id: 'magician', name: 'Magician', koName: '매지션' },
  { id: 'levitate', name: 'Levitate', koName: '부유', immunities: [{ types: ['Ground'] }] },
  { id: 'waterabsorb', name: 'Water Absorb', koName: '저수', immunities: [{ types: ['Water'] }] },
  { id: 'hydration', name: 'Hydration', koName: '촉촉바디' },
];
const pokemon = [
  { id: 'delphox', name: 'Delphox', koName: '마폭시', types: ['Fire', 'Psychic'], ab: { 0: 'Blaze', H: 'Magician' } },
  { id: 'delphoxmega', name: 'Delphox-Mega', koName: '메가마폭시', base: 'Delphox', mega: true, types: ['Fire', 'Psychic'], ab: { 0: 'Levitate' } },
  { id: 'vaporeon', name: 'Vaporeon', koName: '샤미드', types: ['Water'], ab: { 0: 'Water Absorb', H: 'Hydration' } },
  { id: 'gengar', name: 'Gengar', koName: '팬텀', types: ['Ghost', 'Poison'], ab: { 0: 'Levitate' } },
  { id: 'aegislash', name: 'Aegislash', koName: '킬가르도', types: ['Steel', 'Ghost'], ab: { 0: 'Stance Change' }, formGroup: 'aegislash', formGroupForms: ['aegislash', 'aegislashblade'] },
  { id: 'aegislashblade', name: 'Aegislash-Blade', koName: '킬가르도 블레이드폼', types: ['Steel', 'Ghost'], ab: { 0: 'Stance Change' }, formGroup: 'aegislash', formGroupForms: ['aegislash', 'aegislashblade'] },
  { id: 'itemform', name: 'Item Form', koName: '도구폼 기본', types: ['Normal'], ab: { 0: 'Hydration' } },
  { id: 'itemformactive', name: 'Item Form-Active', koName: '도구폼 변화', base: 'Item Form', requiredItem: 'formitem', types: ['Water'], ab: { 0: 'Water Absorb' } },
];
const abilityById = Object.fromEntries(abilities.map(ability => [ability.id, ability]));
abilityById.stancechange = { id: 'stancechange', name: 'Stance Change', koName: '배틀스위치' };
const pokemonById = Object.fromEntries(pokemon.map(entry => [entry.id, entry]));
const items = [
  { id: 'delphoxite', name: 'Delphoxite', ms: { Delphox: 'Delphox-Mega' } },
  { id: 'formitem', name: 'Form Item' },
];
const itemById = Object.fromEntries(items.map(item => [item.id, item]));

function toId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function typeEff(type, defenderTypes) {
  const chart = {
    Ground: { Fire: 2, Psychic: 1, Ghost: 1, Poison: 2, Water: 1, Steel: 2 },
    Water: { Water: 0.5, Fire: 2, Psychic: 1, Ghost: 1, Poison: 1, Steel: 1 },
    Normal: { Ghost: 0, Poison: 1 },
  };
  return defenderTypes.reduce((effect, defenderType) => effect * (chart[type]?.[defenderType] ?? 1), 1);
}

const context = vm.createContext({
  console,
  POKEMON: pokemon,
  PokemonById: pokemonById,
  ABILITIES: abilities,
  AbilityById: abilityById,
  ITEMS: items,
  ItemById: itemById,
  BATTLE_TYPES: ['Ground', 'Water', 'Normal'],
  toId,
  typeEff,
  abilityData(id) { return abilityById[id] || {}; },
  defaultPokemonAbilityId(entry) { return toId(entry?.ab?.['0'] || entry?.ab?.H || ''); },
  calcFormGroupForPokemon(entry) {
    if (!entry?.formGroupForms) return null;
    return { forms: entry.formGroupForms.map(id => pokemonById[id]).filter(Boolean) };
  },
});

const source = `${readFileSync(path.join(ROOT, 'src', 'js', '04-20-matchup.js'), 'utf8')}
globalThis.__matchupApi = {
  matchupSlots,
  matchupAbilities,
  matchupSetSlotPokemon,
  matchupFormOptions,
  matchupDefenseEffect,
  defenseTypeProfile,
};`;
vm.runInContext(source, context, { filename: 'matchup-state.vm.js' });
const api = context.__matchupApi;

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

api.matchupSetSlotPokemon(0, 'delphox', { itemId: 'delphoxite', abilityId: 'blaze' });
assertEqual(api.matchupSlots[0], 'delphoxmega', 'Mega Stone resolves the matchup slot to its Mega form');
assertEqual(api.matchupAbilities[0], 'levitate', 'Mega form replaces an invalid base-form ability');

const megaGround = api.matchupDefenseEffect('Ground', {
  pokemon: pokemonById[api.matchupSlots[0]],
  abilityId: api.matchupAbilities[0],
});
assertEqual(megaGround.eff, 0, 'Levitate makes Mega Delphox immune to Ground');
assertEqual(megaGround.ability.koName, '부유', 'ability immunity keeps the concise Korean display label');

api.matchupSetSlotPokemon(0, 'delphox');
const baseGround = api.matchupDefenseEffect('Ground', {
  pokemon: pokemonById[api.matchupSlots[0]],
  abilityId: api.matchupAbilities[0],
});
assertEqual(baseGround.eff, 2, 'base Delphox keeps its normal Ground weakness');
assertEqual(baseGround.ability, null, 'base Delphox does not inherit Mega Delphox Levitate');

api.matchupSetSlotPokemon(1, 'vaporeon', { abilityId: 'waterabsorb' });
const absorbedWater = api.matchupDefenseEffect('Water', {
  pokemon: pokemonById.vaporeon,
  abilityId: api.matchupAbilities[1],
});
assertEqual(absorbedWater.eff, 0, 'Water Absorb makes the selected form immune to Water');
assertEqual(absorbedWater.ability.koName, '저수', 'Water Absorb uses its Korean ability name');

api.matchupSetSlotPokemon(1, 'vaporeon', { abilityId: 'hydration' });
assertEqual(api.matchupDefenseEffect('Water', {
  pokemon: pokemonById.vaporeon,
  abilityId: api.matchupAbilities[1],
}).eff, 0.5, 'changing the selected ability removes the immunity');

const normalIntoGhost = api.matchupDefenseEffect('Normal', { pokemon: pokemonById.gengar, abilityId: '' });
assertEqual(normalIntoGhost.eff, 0, 'type-based immunity remains immune');
assertEqual(normalIntoGhost.ability, null, 'type-based immunity remains distinct from an ability label');

const formIds = api.matchupFormOptions(pokemonById.delphox).map(entry => entry.id).sort();
assertEqual(formIds.join(','), 'delphox,delphoxmega', 'base and Mega forms are selectable together');
const stanceIds = api.matchupFormOptions(pokemonById.aegislash).map(entry => entry.id).sort();
assertEqual(stanceIds.join(','), 'aegislash,aegislashblade', 'in-battle form groups remain selectable');

api.matchupSetSlotPokemon(2, 'itemform', { itemId: 'formitem' });
assertEqual(api.matchupSlots[2], 'itemformactive', 'required items resolve item-triggered forms');
const itemFormIds = api.matchupFormOptions(pokemonById.itemform).map(entry => entry.id).sort();
assertEqual(itemFormIds.join(','), 'itemform,itemformactive', 'item-triggered forms are selectable together');

const profile = api.defenseTypeProfile('Ground', [
  { pokemon: pokemonById.delphoxmega, abilityId: 'levitate' },
  { pokemon: pokemonById.delphox, abilityId: 'blaze' },
  { pokemon: pokemonById.vaporeon, abilityId: 'hydration' },
]);
assertEqual(profile.immuneCount, 1, 'defensive summary counts ability immunity');
assertEqual(profile.weakCount, 1, 'defensive summary still counts non-immune weaknesses');

if (process.exitCode) process.exit(process.exitCode);
console.log('matchup state ok');
