import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Behavioral contracts for plain-object data and retained calculator controls.
import assert from 'node:assert/strict';
import {  readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = name => readFileSync(path.join(ROOT, name), 'utf8');
const html = read('pokemon-champions-calculator-v3.html');
const embedded = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)]
  .map(match => [match[1], match[2]]));
const payload = Object.fromEntries(Object.entries(embedded).map(([id, raw]) => [id.slice(5), JSON.parse(raw)]));
let passed = 0;
function test(name, run) {
  try { run(); passed++; console.log(`[PASS] ${name}`); }
  catch (error) { console.error(`[FAIL] ${name}: ${error.stack}`); process.exitCode = 1; }
}
const core = read('src/js/01-core.js');
test('core initializes directly from a data object with no document', () => {
  const context = vm.createContext({ PKM_DATA: payload });
  vm.runInContext(core, context);
  assert.equal(vm.runInContext('POKEMON', context), payload.pokemon);
  assert.equal(vm.runInContext('PokemonById[POKEMON[0].id]', context), payload.pokemon[0]);
  assert.equal(vm.runInContext('GAME_DATA', context), payload);
});
test('standalone adapter produces exactly the same seven datasets', () => {
  const context = vm.createContext({ document: { getElementById: id => ({ textContent: embedded[id] }) } });
  vm.runInContext(core, context);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(GAME_DATA)', context)), payload);
});
test('missing required standalone data fails explicitly', () => {
  assert.throws(() => vm.runInNewContext(core, { document: { getElementById: () => null } }), /Missing game data: pokemon/);
});
test('reverse worker initializes with the same object, without a fake document or JSON round trip', () => {
  const source = JSON.parse(html.match(/<script id="reverse-worker-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const messages = [];
  const self = { postMessage: message => messages.push(message) };
  const context = vm.createContext({ self, console });
  vm.runInContext(source, context);
  self.onmessage({ data: { type: 'init', data: payload } });
  assert.equal(messages[0]?.type, 'ready', JSON.stringify(messages));
  assert.equal(vm.runInContext('typeof document', context), 'undefined');
});

const elements = new Map();
function element(id = '') {
  const listeners = new Map();
  return { id, textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, listeners,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, callback) { const list = listeners.get(type) || []; list.push(callback); listeners.set(type, list); },
    querySelectorAll() { return []; }, querySelector() { return null; }, closest() { return null; },
    appendChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
  };
}
const document = {
  getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
  querySelectorAll() { return []; }, querySelector() { return null; }, createElement: element, addEventListener() {},
};
const context = vm.createContext({ PKM_DATA: payload, console, assert, document, setTimeout, clearTimeout,
  window: { innerWidth: 1280, addEventListener() {} }, requestAnimationFrame(fn) { fn(); } });
const source = readdirSync(path.join(ROOT, 'src/js')).filter(name => name.endsWith('.js') && !name.startsWith('05') && !name.includes('theme'))
  .sort().map(name => read(`src/js/${name}`)).join('\n');
vm.runInContext(source, context);
const run = source => vm.runInContext(`(() => { ${source} })()`, context, { timeout: 20000 });
test('effect names are built once while compact labels stay unchanged', () => run(`
  const original = displayName; let calls = 0;
  displayName = (...args) => { calls++; return original(...args); };
  powerUiEffectNames = null;
  try {
    for (let i=0; i<20; i++) {
      assert.equal(powerUiResultNote('기합의띠: 생존 효과'),'기합의띠');
      assert.equal(powerUiResultNote('탈: 첫 공격 차단'),'탈');
      assert.equal(powerUiResultNote('먹다남은음식 회복 반영'),'먹다남은음식');
    }
    assert.equal(calls, ABILITIES.length + ITEMS.length);
    assert.equal(powerUiNamedEffects(), powerUiNamedEffects());
  } finally { displayName = original; }
`));
test('item/nature option sorts are cached and caller array mutations are isolated', () => run(`
  const itemSort = sortItemsForCalcSelect, natureSort = calcSortNatureOptions;
  let items = 0, natures = 0;
  sortItemsForCalcSelect = (...args) => { items++; return itemSort(...args); };
  calcSortNatureOptions = (...args) => { natures++; return natureSort(...args); };
  calcItemOptionsCache = null; calcNatureOptionsCache = null;
  try {
    const first = calcItemOptionData({includeEmpty:false}); const count = first.length; first.pop();
    assert.equal(calcItemOptionData({includeEmpty:false}).length, count);
    assert.equal(calcItemOptionData().length, count+1);
    assert.equal(calcItemOptionData()[0].id, '');
    const ns = calcNatureOptionData(); const nc = ns.length; ns.reverse(); ns.pop();
    assert.equal(calcNatureOptionData().length, nc);
    assert.equal(items, 1); assert.equal(natures, 1);
  } finally { sortItemsForCalcSelect = itemSort; calcSortNatureOptions = natureSort; }
`));
test('a retained move filter follows Pokemon changes and does not re-sort per query', () => run(`
  state.atk = makeSideState('garchomp');
  const original = calcDatasetForCombobox; let calls = 0;
  calcDatasetForCombobox = (...args) => { calls++; return original(...args); };
  try {
    const filter = makeCombobox('atk','move');
    assert.deepEqual(filter('').map(m=>m.id), original('atk','move').map(m=>m.id));
    filter('드래곤'); filter('dragon'); assert.equal(calls, 1);
    state.atk = makeSideState('charizard');
    assert.deepEqual(filter('').map(m=>m.id), original('atk','move').map(m=>m.id));
    assert.equal(calls, 2);
    const move = original('atk','move').find(m=>m.desc && m.desc.trim());
    if(move) assert(filter(move.desc).some(m=>m.id===move.id), 'description search is preserved');
  } finally { calcDatasetForCombobox = original; }
`));
test('presentation accepts an existing calculation instead of calculating twice', () => run(`
  state.atk = makeSideState('garchomp'); state.def = makeSideState('dragonite');
  state.atk.moves = ['earthquake','dragonclaw','rockslide','firefang'];
  const calc = makeCalcState(), result = powerUiCalculateSlot(1,calc), original = powerUiCalculateSlot;
  powerUiCalculateSlot = () => { throw new Error('unexpected second calculation'); };
  try {
    const view = powerUiMovePresentation(1,calc,result);
    const markup = powerUiMoveMarkup(1,calc,view);
    assert(markup.includes('data-move-row="1"')); assert(markup.includes(view.powerMarkup));
    assert(markup.includes(view.damage)); assert.equal(view.settingsDisabled,false);
  } finally { powerUiCalculateSlot = original; }
`));
test('effort input/change deduplicates updates while preserving clamps and blank normalization', () => {
  run(`state.atk = makeSideState('garchomp'); globalThis.refreshCount = 0;
    globalThis.originalRefresh = powerUiRefresh; powerUiRefresh = () => refreshCount++;`);
  const input = { dataset: {calcEv:'atk'}, value:'20', closest: () => ({dataset:{calcSide:'atk'}}) };
  const dispatch = type => document.getElementById('page-calc').listeners.get(type).forEach(callback => callback({target:input}));
  try {
    dispatch('input'); dispatch('change'); dispatch('input'); dispatch('change');
    assert.equal(context.refreshCount, 1); assert.equal(run('return state.atk.evs.atk;'),20);
    input.value = ''; dispatch('input'); dispatch('change');
    assert.equal(context.refreshCount, 2); assert.equal(Number(input.value),0);
    input.value = '-1'; dispatch('input'); dispatch('change');
    assert.equal(context.refreshCount, 2); assert.equal(Number(input.value),0);
    run('state.atk.evs.hp=32; state.atk.evs.def=32;');
    input.value = '32'; dispatch('input'); dispatch('change');
    assert.equal(run('return state.atk.evs.atk;'),2); assert.equal(context.refreshCount,3);
  } finally { run('powerUiRefresh = originalRefresh;'); }
});
test('slot cache invalidates only a changed slot and remains bounded', () => run(`
  state.atk=makeSideState('garchomp');state.def=makeSideState('dragonite');state.field=makeFieldState();
  state.atk.moves=['earthquake','dragonclaw','rockslide','firefang'];autoEntryEffects=false;
  powerUiSlotViews.clear();
  const original=powerUiCalculateSlot; const calls=[];
  powerUiCalculateSlot=(slot,...args)=>{calls.push(slot);return original(slot,...args);};
  const check=(expected)=>{
    calls.length=0;const calc=makeCalcState();const views=powerUiCachedMoveViews(calc);
    assert.deepEqual([...calls],expected);
    for(let slot=0;slot<4;slot++) assert.deepEqual(views[slot],powerUiMovePresentation(slot,calc,original(slot,calc)));
    assert.equal(powerUiSlotViews.size,4);
  };
  try {
    check([0,1,2,3]);check([]);
    state.atk.moveCriticalOverrides[1]=true;check([1]);check([]);
    state.atk.moveBpOverrides[2]=95;check([2]);
    state.atk.moveTypeOverrides[3]='Ice';check([3]);
    state.atk.moveHitCounts[0]=3;check([0]);
    state.atk.moves[2]='protect';check([2]);
    state.atk.moves[2]='';check([2]);
    state.def.evs.hp=10;check([0,1,2,3]);
    state.atk.nature='jolly';check([0,1,2,3]);
    state.field.weather='Rain';check([0,1,2,3]);
    autoEntryEffects=true;check([0,1,2,3]);
    state.atk=makeSideState('charizard');check([0,1,2,3]);
  } finally {powerUiCalculateSlot=original;powerUiSlotViews.clear();}
`));
test('presentation updates never construct structural picker markup', () => run(`
  state.atk=makeSideState('garchomp');state.def=makeSideState('dragonite');state.atk.moves=['earthquake'];
  const original=powerUiMovePickerMarkup;let calls=0;
  powerUiMovePickerMarkup=(...args)=>{calls++;return original(...args);};
  try {
    const calc=makeCalcState(),view=powerUiMovePresentation(0,calc);
    assert.equal(calls,0);assert(!('moveButton' in view));
    assert(powerUiMoveMarkup(0,calc,view).includes('move-select'));assert.equal(calls,1);
  } finally {powerUiMovePickerMarkup=original;}
`));
console.log(`Client performance contracts: ${passed} passed.`);
