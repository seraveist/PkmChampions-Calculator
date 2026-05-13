import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML_PATH = path.join(ROOT, 'pokemon-champions-calculator-v3.html');

function readJsonScript(html, id) {
  const re = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`);
  const match = html.match(re);
  if (!match) throw new Error(`Missing JSON script: ${id}`);
  return JSON.parse(match[1]);
}

function makeClassList() {
  const set = new Set();
  return {
    add(...names) { names.forEach(name => set.add(name)); },
    remove(...names) { names.forEach(name => set.delete(name)); },
    toggle(name, force) {
      const next = force === undefined ? !set.has(name) : !!force;
      if (next) set.add(name);
      else set.delete(name);
      return next;
    },
    contains(name) { return set.has(name); },
  };
}

function makeElement(id = '') {
  return {
    id,
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    classList: makeClassList(),
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    appendChild() {},
    remove() {},
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name]; },
    insertAdjacentHTML() {},
  };
}

function loadFineTuneApi() {
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
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement: makeElement,
      addEventListener() {},
    },
    window: {
      innerWidth: 1280,
      addEventListener() {},
      loadSideToFineTune: null,
    },
    requestAnimationFrame(fn) { return fn(); },
    setTimeout,
    clearTimeout,
  });

  const source = [
    readFileSync(path.join(ROOT, 'src', 'js', '01-core.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '02-engine.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '03-calc-ui.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '04-views.js'), 'utf8'),
    `
      globalThis.__ftApi = {
        elements,
        state,
        POKEMON,
        PokemonById,
        ItemById,
        AbilityById,
        calcStats,
        effectiveSpeed,
        makeSideState,
        defaultPokemonTypes,
        defaultPokemonAbilityId,
        defaultPokemonItemId,
        fineTuneState,
        ftApplyPokemonToFineTune,
        ftMySpeed,
        ftSpeedFieldFor,
        ftSpeedSideFor,
        ftSetEv,
        ftHpBreakpoints,
        ftBuildSpeedTable,
        ftOppSpeedCase,
        ftOpponentManualSpeed,
        ftMagicNumbers,
        ftComboData,
        renderFineTuneMy,
        renderFineTuneOpp,
        renderFineTuneAll,
      };
    `,
  ].join('\n');

  context.elements = elements;
  vm.runInContext(source, context, { filename: 'fine-tune-state.vm.js' });
  return context.__ftApi;
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

function assertOk(value, label) {
  if (!value) {
    console.error(`[FAIL] ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] ${label}`);
}

const api = loadFineTuneApi();

const fineTunePokemonOptions = api.ftComboData('opp');
assertEqual(fineTunePokemonOptions.length, api.POKEMON.length, 'fine-tune pokemon dropdown includes all filtered pokemon');
assertOk(fineTunePokemonOptions.every((option, index, arr) => index === 0 || (arr[index - 1].raw.bs?.spe || 0) >= (option.raw.bs?.spe || 0)), 'fine-tune pokemon dropdown sorts by base Speed descending');

const secondPokemon = api.PokemonById.amoonguss ? 'amoonguss' : Object.keys(api.PokemonById).find(id => id !== api.fineTuneState.my.pokemonIdx);
api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.types = ['Water'];
api.fineTuneState.my.moves = ['flareblitz'];
api.fineTuneState.my.moveBpOverrides = [120, null, null, null];
api.fineTuneState.weatherAbilityActive = true;
api.ftApplyPokemonToFineTune(secondPokemon);
assertDeepEqual(api.fineTuneState.my.types, api.defaultPokemonTypes(api.PokemonById[secondPokemon]), 'pokemon change resets manual types');
assertEqual(api.fineTuneState.my.ability, api.defaultPokemonAbilityId(api.PokemonById[secondPokemon]), 'pokemon change resets ability');
assertDeepEqual(api.fineTuneState.my.moves, [], 'pokemon change clears selected moves');

api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.ability = 'swiftswim';
api.fineTuneState.my.evs.spe = 12;
api.fineTuneState.weatherAbilityActive = false;
const baseSpeed = api.ftMySpeed(api.fineTuneState.my);
api.fineTuneState.weatherAbilityActive = true;
const boostedSpeed = api.ftMySpeed(api.fineTuneState.my);
const directBoosted = api.effectiveSpeed(api.ftSpeedSideFor(api.fineTuneState.my), api.ftSpeedFieldFor(api.fineTuneState.my));
assertOk(boostedSpeed > baseSpeed, 'weather speed toggle boosts speed');
assertEqual(boostedSpeed, directBoosted, 'fine-tune speed delegates to engine');

api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.evs = { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 };
api.ftSetEv('def', 32);
const totalEv = Object.values(api.fineTuneState.my.evs).reduce((a, b) => a + b, 0);
assertEqual(api.fineTuneState.my.evs.def, 2, 'EV setter respects remaining cap');
assertEqual(totalEv, 66, 'EV setter keeps total at 66');

api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.item = 'leftovers';
const breakpoints = api.ftHpBreakpoints(api.fineTuneState.my);
const leftovers = breakpoints.find(row => row.rule.id === 'leftovers');
assertOk(leftovers, 'leftovers HP breakpoint is available from item data');
assertOk(!!leftovers.current || !!leftovers.next || !!leftovers.prev, 'HP breakpoint exposes reachable delta');
assertOk(breakpoints.some(row => row.rule.id.startsWith('sr-')), 'stealth rock HP breakpoint uses type effectiveness');

api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.nature = 'adamant';
api.fineTuneState.my.evs.atk = 5;
let magic = api.ftMagicNumbers(api.fineTuneState.my, 'atk');
assertEqual(magic.current, 5, 'magic number marks current point exactly');
api.fineTuneState.my.evs.atk = 6;
magic = api.ftMagicNumbers(api.fineTuneState.my, 'atk');
assertEqual(magic.prev, 5, 'magic number previous point is strictly below current');
assertOk(magic.next > 6, 'magic number next point is strictly above current');

api.fineTuneState.opp.manualSpeed = '123';
const speedRows = api.ftBuildSpeedTable();
assertEqual(speedRows[0].label, '직접', 'manual opponent speed adds direct comparison case');
assertEqual(speedRows[0].oppSpe, 123, 'manual opponent speed is used directly');

api.renderFineTuneAll();
assertOk(api.elements.get('ft-summary-body').innerHTML.includes('ft-ev-meter'), 'fine-tune render includes EV summary panel');
assertOk(!api.elements.get('ft-summary-body').innerHTML.includes('<span>HP</span>'), 'fine-tune EV summary omits duplicate HP stat');
assertOk(!api.elements.get('ft-summary-body').innerHTML.includes('<span>속도</span>'), 'fine-tune EV summary omits duplicate speed stat');
assertOk(api.elements.get('ft-hp-body').innerHTML.includes('ft-breakpoint-list'), 'fine-tune render includes HP breakpoint panel');
assertOk(api.elements.get('ft-hp-body').innerHTML.includes('스텔스록 2배 +1턴 / 압정뿌리기 3중첩 +1턴'), 'fine-tune HP breakpoints merge identical rule rows');
assertOk(!api.elements.get('ft-hp-body').innerHTML.includes('ft-breakpoint-target'), 'fine-tune HP breakpoint panel omits target HP subline');
assertOk(api.elements.get('ft-my-body').innerHTML.includes('data-ft-pick="nature"'), 'fine-tune nature uses combobox markup');
assertOk(api.elements.get('ft-my-body').innerHTML.includes('ft-bulk-panel'), 'fine-tune render includes durability metrics');
assertOk(api.elements.get('ft-my-body').innerHTML.indexOf('ft-magic') < api.elements.get('ft-my-body').innerHTML.indexOf('ft-stat-final'), 'fine-tune stat rows place magic before final stat');
assertOk(api.elements.get('ft-opp-body').innerHTML.includes('ftOppManualSpeed'), 'opponent render includes direct speed input');
assertOk(api.elements.get('ft-opp-body').innerHTML.includes('ft-base-mini'), 'opponent render includes base stats summary');
