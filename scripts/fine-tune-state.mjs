import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readCalcUiSource, readViewSource } from './source-utils.mjs';

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
    readFileSync(path.join(ROOT, 'src', 'js', '01-10-rotom-ui.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '01-20-html-structure.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '02-engine.js'), 'utf8'),
    readCalcUiSource(ROOT),
    readViewSource(ROOT),
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
        ftOpponentBaseSpeed,
        ftMagicNumbers,
        ftComboData,
        ftRenderOpponentPokemonOption,
        loadSideToFineTune,
        ftSaveBaseline,
        ftRestoreBaseline,
        ftApplyTarget,
        ftHpEffectText,
        makeFieldState,
        ftClearConditions,
        ftSelectCombo,
        ftFindMinSpeedEv,
        applyQuietly(target) {
          const oldRender = renderSide, oldCalc = triggerCalc, oldSync = syncFieldControls;
          renderSide = () => {}; triggerCalc = () => {}; syncFieldControls = () => {};
          try { ftApplyToCalc(target); } finally { renderSide = oldRender; triggerCalc = oldCalc; syncFieldControls = oldSync; }
        },
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

api.renderFineTuneAll();
assertOk(api.elements.get('ft-hp-panel').hidden, 'fine-tune hides HP breakpoints before Pokemon selection');
assertOk(api.elements.get('ft-hp-body').innerHTML === '', 'fine-tune initial layout omits empty HP contents');

const fineTunePokemonOptions = api.ftComboData('opp');
assertEqual(fineTunePokemonOptions.length, api.POKEMON.length, 'fine-tune pokemon dropdown includes all filtered pokemon');
assertOk(fineTunePokemonOptions.every((option, index, arr) => index === 0 || (arr[index - 1].raw.bs?.spe || 0) >= (option.raw.bs?.spe || 0)), 'fine-tune pokemon dropdown sorts by base Speed descending');
const opponentOptionHtml = api.ftRenderOpponentPokemonOption(fineTunePokemonOptions[0], fineTunePokemonOptions[0].id);
assertOk(opponentOptionHtml.includes('ft-opp-pokemon-speed'), 'fine-tune opponent pokemon dropdown renders speed column');
assertOk(opponentOptionHtml.includes(`>${fineTunePokemonOptions[0].raw.bs?.spe || 0}</span>`), 'fine-tune opponent pokemon dropdown renders base Speed value');

const secondPokemon = api.PokemonById.amoonguss ? 'amoonguss' : Object.keys(api.PokemonById).find(id => id !== api.fineTuneState.my.pokemonIdx);
api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.types = ['Water'];
api.fineTuneState.my.moves = ['flareblitz'];
api.fineTuneState.my.moveBpOverrides = [120, null, null, null];
api.ftApplyPokemonToFineTune(secondPokemon);
assertDeepEqual(api.fineTuneState.my.types, api.defaultPokemonTypes(api.PokemonById[secondPokemon]), 'pokemon change resets manual types');
assertEqual(api.fineTuneState.my.ability, api.defaultPokemonAbilityId(api.PokemonById[secondPokemon]), 'pokemon change resets ability');
assertDeepEqual(api.fineTuneState.my.moves, [], 'pokemon change clears selected moves');

api.fineTuneState.my = api.makeSideState('incineroar');
api.fineTuneState.my.ability = 'swiftswim';
api.fineTuneState.my.evs.spe = 12;
api.fineTuneState.field.weather = 'none';
const baseSpeed = api.ftMySpeed(api.fineTuneState.my);
api.fineTuneState.field.weather = 'Rain';
const boostedSpeed = api.ftMySpeed(api.fineTuneState.my);
const directBoosted = api.effectiveSpeed(api.ftSpeedSideFor(api.fineTuneState.my), api.ftSpeedFieldFor(api.fineTuneState.my));
assertOk(boostedSpeed > baseSpeed, 'shared rain field activates weather speed ability');
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

api.fineTuneState.opp.pokemonIdx = secondPokemon;
const speedRows = api.ftBuildSpeedTable();
assertOk(speedRows.length > 0, 'speed table still renders comparison cases');
assertEqual(api.ftOpponentBaseSpeed(api.fineTuneState.opp), api.PokemonById[secondPokemon].bs.spe, 'opponent base Speed uses species data');
assertEqual(api.ftOppSpeedCase(api.fineTuneState.opp, 0, 'hardy'), api.PokemonById[secondPokemon].bs.spe + 20, 'neutral opponent speed case uses species data');

api.renderFineTuneAll();
const ftMyHtml = api.elements.get('ft-my-body').innerHTML;
assertOk(!api.elements.get('ft-hp-panel').hidden, 'fine-tune reveals HP breakpoints after Pokemon selection');
assertOk(api.elements.get('ft-hp-body').innerHTML.includes('ft-breakpoint-list'), 'fine-tune selected layout supplies HP results');
assertOk(!ftMyHtml.includes('ft-summary-body'), 'fine-tune render omits standalone EV summary panel');
assertOk(ftMyHtml.includes('class="budget"'), 'fine-tune render uses the common stat budget');
assertOk(ftMyHtml.includes(' / 66'), 'fine-tune stat budget labels point total');
assertOk(api.elements.get('ft-hp-body').innerHTML.includes('ft-breakpoint-list'), 'fine-tune render includes HP breakpoint panel');
assertOk(api.elements.get('ft-hp-body').innerHTML.includes('스텔스록 2배, 압정 3중'), 'fine-tune HP breakpoints merge identical rule rows');
assertOk(!api.elements.get('ft-hp-body').innerHTML.includes('ft-breakpoint-target'), 'fine-tune HP breakpoint panel omits target HP subline');
assertOk(ftMyHtml.includes('data-ft-pick="nature"'), 'fine-tune nature uses combobox markup');
assertOk(ftMyHtml.includes('metric-strip'), 'fine-tune render includes common durability metrics');
assertOk(!ftMyHtml.includes('ft-bulk-panel'), 'fine-tune render omits legacy durability wrapper');
assertOk(!ftMyHtml.includes(' field-label ') && !ftMyHtml.includes('"field-label '), 'fine-tune settings omit legacy field-label classes');
assertOk(ftMyHtml.includes('class="stat-table"') && ftMyHtml.includes('data-ft-rank-select'), 'fine-tune uses the shared always-visible stat and rank table');
assertOk(api.elements.get('ft-opp-body').innerHTML.includes('readonly'), 'opponent base Speed is visibly read-only');
assertOk(api.elements.get('ft-opp-body').innerHTML.includes('metric-strip'), 'opponent render includes speed stat detail row');

// Round trips must preserve complete builds, including when my side is the defender.
for (const key of ['atk', 'def']) {
  const other = key === 'atk' ? 'def' : 'atk';
  api.state[key] = api.makeSideState('qwilfish');
  api.state[key].ability = 'swiftswim';
  api.state[other] = api.makeSideState('garchomp');
  Object.assign(api.state[other], { nature: 'impish', item: 'leftovers', moves: ['earthquake'], hpPct: 0.7 });
  api.state[other].evs = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
  api.state.field = api.makeFieldState({ weather: 'Rain', terrain: 'Grassy', defReflect: true });
  const opponentBefore = JSON.parse(JSON.stringify(api.state[other]));
  api.loadSideToFineTune(key);
  assertEqual(api.ftMySpeed(api.fineTuneState.my), 210, `${key} import retains rain speed`);
  api.ftSetEv('spe', 1);
  api.applyQuietly(key);
  assertEqual(api.effectiveSpeed(api.state[key], api.state.field, api.state[other]), 212, `${key} export retains adjusted rain speed`);
  assertDeepEqual(api.state[other], opponentBefore, `${key} round trip preserves complete opponent build`);
  assertOk(api.state.field.defReflect && api.state.field.terrain === 'Grassy', `${key} round trip preserves unrelated field conditions`);
}

api.fineTuneState.my = api.makeSideState('garchomp');
api.fineTuneState.opp = api.makeSideState('qwilfish');
api.fineTuneState.opp.ability = 'swiftswim';
api.fineTuneState.field = api.makeFieldState({ weather: 'Rain' });
assertEqual(api.ftOppSpeedCase(api.fineTuneState.opp, 32, 'hardy'), 274, 'opposing Swift Swim uses the shared rain field');
api.fineTuneState.opp.status = 'Paralysis';
api.fineTuneState.opp.tailwind = true;
api.fineTuneState.opp.item = 'choicescarf';
api.fineTuneState.opp.ranks.spe = 1;
const reference = { ...api.fineTuneState.opp, nature: 'jolly', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 } };
assertEqual(api.ftOppSpeedCase(api.fineTuneState.opp, 32, 'jolly'), api.effectiveSpeed(reference, api.fineTuneState.field, api.fineTuneState.my), 'combined opposing speed modifiers use engine rounding');
api.fineTuneState.my = api.makeSideState('weezing');
api.fineTuneState.my.ability = 'neutralizinggas';
assertEqual(api.ftOppSpeedCase(api.fineTuneState.opp, 32, 'jolly'), api.effectiveSpeed(reference, api.fineTuneState.field, api.fineTuneState.my), 'opposing ability suppression is included in speed references');

api.fineTuneState.my = api.makeSideState('garchomp');
api.fineTuneState.my.evs = { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 };
api.fineTuneState.opp = api.makeSideState('qwilfish');
api.fineTuneState.field = api.makeFieldState();
api.fineTuneState.margin = 1;
api.fineTuneState.targetSpeed = '';
let fastest = api.ftBuildSpeedTable()[0];
assertEqual(fastest.need, 29, 'minimum speed investment remains visible beyond remaining budget');
assertEqual(fastest.available, 2, 'speed goal shows currently assignable points');
assertEqual(fastest.shortfall, 27, 'speed goal shows required reallocation');
const blockedEvs = JSON.stringify(api.fineTuneState.my.evs);
assertEqual(api.ftApplyTarget('spe', 29), false, 'applying an over-budget speed goal is refused');
assertEqual(JSON.stringify(api.fineTuneState.my.evs), blockedEvs, 'refused goal does not take points from other stats');
api.ftSetEv('hp', 5);
assertEqual(api.ftApplyTarget('spe', 29), true, 'goal applies after the user frees enough points');
assertEqual(Object.values(api.fineTuneState.my.evs).reduce((sum, n) => sum + n, 0), 66, 'speed goal application preserves total cap');
api.fineTuneState.margin = 0;
assertOk(api.ftBuildSpeedTable().every(row => row.oppSpe === row.target), 'zero margin explicitly permits a speed tie');
api.fineTuneState.targetSpeed = '999';
assertEqual(api.ftBuildSpeedTable().at(-1).need, null, 'unreachable manual speed target is distinct from budget shortage');
api.fineTuneState.opp = api.makeSideState();
api.fineTuneState.targetSpeed = '150';
assertEqual(api.ftBuildSpeedTable().length, 1, 'manual speed target works without selecting an opponent');

api.fineTuneState.my = api.makeSideState('qwilfish');
api.fineTuneState.my.item = 'sitrusberry';
api.fineTuneState.my.evs.hp = 16;
const berryRow = api.ftHpBreakpoints(api.fineTuneState.my).find(row => row.rule.id === 'sitrusberry');
assertOk(berryRow, 'selected Sitrus Berry supplies an HP breakpoint');
assertEqual(api.ftHpEffectText(api.fineTuneState.my, berryRow.rule, 156), 'HP 78 이하 발동 · 회복 39', 'Sitrus effect shows actual trigger and rounded recovery');
assertOk(api.ftHpEffectText(api.fineTuneState.my, berryRow.rule, 157).includes('회복 39'), 'HP adjustment does not invent a recovery increase between rounding thresholds');
api.fineTuneState.my.item = 'leftovers';
const leftRow = api.ftHpBreakpoints(api.fineTuneState.my).find(row => row.rule.id === 'leftovers');
assertEqual(api.ftHpEffectText(api.fineTuneState.my, leftRow.rule, 160), '회복 10', 'Leftovers effect shows actual recovery at a breakpoint');
assertEqual(api.ftHpEffectText(api.fineTuneState.my, leftRow.rule, 159), '회복 9', 'Leftovers comparison exposes the recovery tradeoff');
api.fineTuneState.my = api.makeSideState('clefable');
api.fineTuneState.my.ability = 'magicguard';
assertOk(!api.ftHpBreakpoints(api.fineTuneState.my).some(row => row.rule.kind === 'damage'), 'Magic Guard removes inapplicable indirect damage breakpoints');
api.fineTuneState.my = api.makeSideState('garchomp');
api.fineTuneState.my.item = 'leftovers';
api.fineTuneState.my.evs = { hp: 0, atk: 32, def: 32, spa: 0, spd: 2, spe: 0 };
const overHp = api.ftHpBreakpoints(api.fineTuneState.my).find(row => row.rule.id === 'leftovers');
assertOk(overHp.next && overHp.next.shortfall > 0, 'HP goals remain visible with an explicit point shortage');
assertEqual(api.ftApplyTarget('hp', overHp.next.ev), false, 'HP goal refuses an over-budget application');

api.fineTuneState.my = api.makeSideState('qwilfish');
api.fineTuneState.my.evs.hp = 16;
api.fineTuneState.my.nature = 'jolly';
api.ftSaveBaseline();
api.fineTuneState.my.evs.hp = 31;
api.fineTuneState.my.nature = 'impish';
api.fineTuneState.my.item = 'leftovers';
api.fineTuneState.field.weather = 'Rain';
api.renderFineTuneAll();
assertOk(api.elements.get('ft-my-body').innerHTML.includes('기준 배분과 비교'), 'baseline comparison is rendered');
api.ftRestoreBaseline();
assertEqual(api.fineTuneState.my.evs.hp, 16, 'restoring baseline restores points');
assertEqual(api.fineTuneState.my.nature, 'jolly', 'restoring baseline restores nature');
assertOk(api.fineTuneState.my.item === 'leftovers' && api.fineTuneState.field.weather === 'Rain', 'restoring allocation keeps current item and field');
api.fineTuneState.my.status = 'Paralysis';
api.fineTuneState.my.tailwind = true;
api.fineTuneState.my.ranks.spe = 2;
api.ftApplyPokemonToFineTune('garchomp');
assertOk(api.fineTuneState.my.status === 'none' && !api.fineTuneState.my.tailwind && api.fineTuneState.my.ranks.spe === 0, 'new species clears hidden inherited battle conditions');
assertEqual(api.fineTuneState.baseline.pokemonIdx, 'garchomp', 'new species resets the baseline');
api.fineTuneState.my.status = 'Paralysis';
api.ftClearConditions('my');
assertEqual(api.fineTuneState.my.status, 'none', 'explicit condition reset clears status');
