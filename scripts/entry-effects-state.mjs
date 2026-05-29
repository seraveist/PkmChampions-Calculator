import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readCalcUiSource } from './source-utils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML_PATH = path.join(ROOT, 'pokemon-champions-calculator-v3.html');

function readJsonScript(html, id) {
  const re = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`);
  const match = html.match(re);
  if (!match) throw new Error(`Missing JSON script: ${id}`);
  return JSON.parse(match[1]);
}

function makeElement(id) {
  return {
    id,
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    insertAdjacentHTML() {},
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name]; },
    removeAttribute(name) { delete this[name]; },
  };
}

function loadUiApi() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const data = {
    'data-pokemon': JSON.stringify(readJsonScript(html, 'data-pokemon')),
    'data-moves': JSON.stringify(readJsonScript(html, 'data-moves')),
    'data-abilities': JSON.stringify(readJsonScript(html, 'data-abilities')),
    'data-items': JSON.stringify(readJsonScript(html, 'data-items')),
    'data-natures': JSON.stringify(readJsonScript(html, 'data-natures')),
    'data-typechart': JSON.stringify(readJsonScript(html, 'data-typechart')),
    'data-rules': JSON.stringify(readJsonScript(html, 'data-rules')),
  };
  const elements = new Map();
  function elementFor(id) {
    if (data[id]) return { textContent: data[id] };
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  }

  const context = vm.createContext({
    console,
    document: {
      getElementById: elementFor,
      addEventListener() {},
    },
    window: {
      innerWidth: 1280,
      addEventListener() {},
    },
    requestAnimationFrame(fn) { return fn(); },
    setTimeout,
    clearTimeout,
  });

  const source = [
    readFileSync(path.join(ROOT, 'src', 'js', '01-core.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '02-engine.js'), 'utf8'),
    readCalcUiSource(ROOT),
    `
      globalThis.__entryApi = {
        state,
        calcStats,
        effectiveTypes,
        makeCalcState,
        setSideHpPct,
        setSideDamageBlockActive,
        maxFallenAllies,
        clampFallenAllies,
        normalizeBattleConditionState,
        PokemonById,
        applyPokemonToCalcSide,
        setSideType,
        markManualAutoFieldOverride,
        resetManualAutoFieldOverrides,
        manualAutoFieldOverrides,
        resetSideManualValues,
        defaultPokemonAbilityId,
        setAutoEntry(value) { autoEntryEffects = value; },
        refresh() {
          const calc = makeCalcState();
          lastAutoEntry = calc.entryMeta;
          return calc;
        },
      };
    `,
  ].join('\n');

  vm.runInContext(source, context, { filename: 'entry-effects-state.vm.js' });
  return context.__entryApi;
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

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    console.error(`[FAIL] ${label}`);
    console.error('expected:', expectedJson);
    console.error('actual:  ', actualJson);
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] ${label}`);
}

const api = loadUiApi();
const { state } = api;

function resetScenario() {
  api.setAutoEntry(true);
  state.atk.pokemonIdx = 'charizard';
  state.def.pokemonIdx = 'venusaur';
  state.atk.ability = 'blaze';
  state.def.ability = 'effectspore';
  state.atk.hpPct = 1;
  state.def.hpPct = 1;
  state.atk.pinch = false;
  state.def.pinch = false;
  state.atk.fullHP = true;
  state.def.fullHP = true;
  state.atk.types = api.PokemonById[state.atk.pokemonIdx]?.types?.slice() || [];
  state.def.types = api.PokemonById[state.def.pokemonIdx]?.types?.slice() || [];
  state.atk.lastMoveFailed = false;
  state.atk.wasHit = false;
  state.def.wasHit = false;
  state.atk.fallenAllies = 0;
  state.atk.flashFireActive = false;
  state.atk.boosterEnergyState = 'auto';
  state.def.boosterEnergyState = 'auto';
  state.atk.damageBlockActive = false;
  state.def.damageBlockActive = false;
  state.atk.ranks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  state.def.ranks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  state.field.weather = 'none';
  state.field.terrain = 'none';
  state.field.ruinSword = false;
  state.field.ruinTablet = false;
  state.field.ruinBeads = false;
  state.field.ruinVessel = false;
  for (const key of Object.keys(api.manualAutoFieldOverrides)) {
    api.manualAutoFieldOverrides[key] = null;
  }
  api.refresh();
}

resetScenario();
let calc;
api.setSideHpPct(state.atk, 0.33);
calc = api.refresh();
assertEqual(state.atk.pinch, true, 'attacker hp pct updates source pinch');
assertEqual(calc.atk.pinch, true, 'attacker hp pct derives calc pinch');
assertEqual(calc.atk.fullHP, false, 'attacker hp pct derives not full hp');
api.setSideHpPct(state.def, 0.99);
calc = api.refresh();
assertEqual(calc.def.fullHP, false, 'defender hp pct below 100 disables full hp');

resetScenario();
state.def.pokemonIdx = 'mimikyu';
state.def.ability = 'disguise';
state.def.hpPct = 1;
api.setSideDamageBlockActive(state.def, false);
calc = api.refresh();
let mimikyuHp = api.calcStats(calc.def).hp;
let expectedDisguiseConsumedHp = mimikyuHp - Math.floor(mimikyuHp / 8);
assertEqual(Math.floor(mimikyuHp * state.def.hpPct), expectedDisguiseConsumedHp, 'disguise off updates source hp');
assertEqual(Math.floor(mimikyuHp * calc.def.hpPct), expectedDisguiseConsumedHp, 'disguise off derives consumed hp');
assertEqual(calc.def.fullHP, false, 'disguise off derives not full hp');
api.setSideDamageBlockActive(state.def, true);
calc = api.refresh();
assertEqual(state.def.hpPct, 1, 'disguise on updates source hp pct');
assertEqual(calc.def.hpPct, 1, 'disguise on keeps source hp pct');
assertEqual(calc.def.fullHP, true, 'disguise on keeps full hp flag');

resetScenario();
state.atk.types = ['Water'];
calc = api.refresh();
assertDeepEqual(api.effectiveTypes(calc.atk), ['Water'], 'manual type override is used by calc state');
state.atk.types = ['Fire', 'Flying'];
api.setSideType('atk', 0, 'Water');
assertDeepEqual(state.atk.types, ['Water'], 'manual first type change clears second type');
api.resetSideManualValues('atk');
calc = api.refresh();
assertDeepEqual(api.effectiveTypes(calc.atk), api.PokemonById[state.atk.pokemonIdx].types, 'manual reset restores default pokemon type');
assertEqual(state.atk.ability, api.defaultPokemonAbilityId(api.PokemonById[state.atk.pokemonIdx]), 'manual reset restores default ability');

resetScenario();
state.field.gameType = 'Singles';
state.atk.fallenAllies = 5;
api.normalizeBattleConditionState();
assertEqual(state.atk.fallenAllies, 2, 'fallen allies clamps to singles party max');
state.field.gameType = 'Doubles';
state.atk.fallenAllies = 5;
api.normalizeBattleConditionState();
assertEqual(state.atk.fallenAllies, 3, 'fallen allies clamps to doubles party max');

resetScenario();
state.atk.item = 'charcoal';
state.atk.moves = ['flareblitz'];
state.atk.moveBpOverrides = [120, null, null, null];
api.applyPokemonToCalcSide('atk', state.atk.pokemonIdx);
assertEqual(state.atk.item, 'charcoal', 'same pokemon apply keeps custom item');
assertDeepEqual(state.atk.moves, ['flareblitz'], 'same pokemon apply keeps selected moves');
assertDeepEqual(state.atk.moveBpOverrides, [120, null, null, null], 'same pokemon apply keeps manual move power');

resetScenario();
state.atk.ability = 'drought';
api.refresh();
api.markManualAutoFieldOverride('weather');
state.field.weather = 'Rain';
state.atk.moves = ['flareblitz'];
state.atk.moveBpOverrides = [120, null, null, null];
const alternatePokemon = Object.keys(api.PokemonById).find(id => id !== state.atk.pokemonIdx);
api.applyPokemonToCalcSide('atk', alternatePokemon);
assertEqual(state.field.weather, 'none', 'pokemon helper resets manual auto weather on species change');
assertDeepEqual(state.atk.moves, [], 'pokemon helper clears attacker moves on species change');
assertDeepEqual(state.atk.moveBpOverrides, [null, null, null, null], 'pokemon helper clears manual move power on species change');

resetScenario();
state.atk.ability = 'drought';
calc = api.refresh();
assertEqual(calc.field.weather, 'Sun', 'drought weather is derived');
assertEqual(state.field.weather, 'none', 'drought does not mutate source weather');

api.markManualAutoFieldOverride('weather');
state.field.weather = 'Rain';
calc = api.refresh();
assertEqual(calc.field.weather, 'Rain', 'manual weather overrides auto weather');
assertEqual(api.manualAutoFieldOverrides.weather.prev, 'none', 'manual weather remembers pre-auto source value');

state.atk.ability = 'blaze';
api.resetManualAutoFieldOverrides();
calc = api.refresh();
assertEqual(state.field.weather, 'none', 'pokemon change reset restores source weather');
assertEqual(calc.field.weather, 'none', 'non-weather pokemon leaves weather at source value');

resetScenario();
state.atk.ability = 'intimidate';
calc = api.refresh();
assertEqual(calc.def.ranks.atk, -1, 'intimidate is applied to derived defender ranks');
assertEqual(state.def.ranks.atk, 0, 'intimidate does not mutate source defender ranks');

resetScenario();
state.atk.ability = 'intimidate';
state.def.ability = 'intimidate';
state.atk.ranks.atk = 1;
calc = api.refresh();
assertEqual(calc.atk.ranks.atk, 0, 'opposing intimidate offsets manual attacker +1 in derived ranks');
assertEqual(state.atk.ranks.atk, 1, 'opposing intimidate keeps manual attacker +1 in source ranks');
assertEqual(calc.def.ranks.atk, -1, 'attacker intimidate lowers derived defender attack');
assertDeepEqual(calc.entryMeta.rankDeltas, { atk: { atk: -1 }, def: { atk: -1 } }, 'dual intimidate rank deltas are tracked');

resetScenario();
state.atk.ability = 'download';
const expectedDownloadStat = api.calcStats(state.def).def < api.calcStats(state.def).spd ? 'atk' : 'spa';
calc = api.refresh();
assertEqual(calc.atk.ranks[expectedDownloadStat], 1, 'download applies to derived attacker ranks');
assertEqual(state.atk.ranks[expectedDownloadStat], 0, 'download does not mutate source attacker ranks');

resetScenario();
state.atk.ability = 'swordofruin';
calc = api.refresh();
assertEqual(calc.field.ruinSword, true, 'sword of ruin is derived');
assertEqual(state.field.ruinSword, false, 'sword of ruin does not mutate source field');
api.markManualAutoFieldOverride('ruinSword');
state.field.ruinSword = false;
calc = api.refresh();
assertEqual(calc.field.ruinSword, false, 'manual ruin toggle overrides auto ruin');

resetScenario();
state.atk.ability = 'drought';
state.def.ability = 'intimidate';
api.setAutoEntry(false);
calc = api.refresh();
assertDeepEqual(calc.entryMeta.logs, [], 'auto entry off produces no logs');
assertEqual(calc.field.weather, 'none', 'auto entry off leaves weather unchanged');
assertEqual(calc.atk.ranks.atk, 0, 'auto entry off leaves ranks unchanged');
