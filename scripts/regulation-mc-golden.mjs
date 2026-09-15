import { readSourceFileSync as readFileSync } from './source-utils.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { applyChampionsDataOverrides } from './champions-overrides.mjs';
import { PS_FILES } from './ps-data-source.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const json = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
const element = id => ({ textContent: json[id] || '', value: '', dataset: {}, style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
  closest() { return null; }, appendChild() {}, remove() {},
  setAttribute() {}, getAttribute() { return null; } });
const document = { getElementById: element, querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {}, createElement: element };
const dir = path.join(root, 'src/js');
const source = fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => readFileSync(path.join(dir, n), 'utf8')).join('\n');
let passed = 0;
const run = new Function('document', 'window', 'assert', 'test', `${source}\n
function damage(a, d, move, field = makeFieldState()) { return calculatePowerDamage(a, d, MoveById[move], field); }
function range(r) { return [r.damages[0], r.damages.at(-1)]; }
test('M-C roster: 29 normal/regional/sex/color forms plus six Mega forms', () => {
  const ids = 'wigglytuff persian persianalola farfetchd mrmime swalot salamence gogoat golisopod rillaboom cinderace inteleon thievul toxtricity toxtricitylowkey grapploct perrserker sirfetchd pincurchin indeedee indeedeef pawmot arboliva squawkabilly squawkabillyblue squawkabillyyellow squawkabillywhite mabosstiff baxcalibur salamencemega golisopodmega baxcaliburmega absolmegaz garchompmegaz lucariomegaz'.split(' ');
  assert.equal(ids.length, 35);
  for (const id of ids) { const p = PokemonById[id]; assert(p, id); assert(/[가-힣]/.test(p.koName), id + ' Korean name'); assert(p.ls.length > 0, id + ' learnset'); }
  for (const id of ['mewtwo', 'heatranmega', 'rillaboomgmax', 'toxtricitylowkeygmax', 'farfetchdgalar']) assert(!PokemonById[id], id + ' remains excluded');
});
test('All 18 requested items and six Mega Stone links are selectable', () => {
  for (const id of 'leek rockyhelmet airballoon redcard bindingband ejectbutton normalgem terrainextender electricseed psychicseed mistyseed grassyseed salamencite golisopite baxcalibrite absolitez garchompitez lucarionitez'.split(' ')) { assert(ItemById[id], id); assert(/[가-힣]/.test(ItemById[id].koName), id); }
  for (const id of 'salamencemega golisopodmega baxcaliburmega absolmegaz garchompmegaz lucariomegaz'.split(' ')) { const p = PokemonById[id], item = ItemById[toId(p.requiredItem)]; assert(Object.values(item.ms).includes(p.name), id + ' stone'); }
  for (const id of ['choiceband', 'choicespecs', 'assaultvest']) assert(!ItemById[id], id + ' remains excluded');
});
test('Champions signature moves are linked to their new users', () => {
  for (const [p, m] of [['rillaboom','drumbeating'],['rillaboom','grassyglide'],['cinderace','pyroball'],['inteleon','snipeshot'],['grapploct','octolock'],['sirfetchd','closecombat'],['pawmot','doubleshock'],['baxcalibur','glaiverush'],['toxtricity','overdrive']]) assert(PokemonById[p].ls.includes(m) && MoveById[m], p + ':' + m);
  assert.equal(MoveById.firstimpression.bp, 100);
});
test('Mega identities and abilities match M-C', () => {
  assert.deepEqual(PokemonById.golisopodmega.types, ['Bug','Steel']);
  assert.equal(PokemonById.golisopodmega.ab[0], 'Tough Claws');
  assert.deepEqual(PokemonById.baxcaliburmega.ab, {0:'Thermal Exchange'});
  assert.deepEqual(PokemonById.garchompmegaz.types, ['Dragon']);
  assert.equal(PokemonById.lucariomegaz.bs.spa, 164);
  assert.equal(AbilityById.auraguard.koName, '파동의방호');
});
test('Aura Guard halves contact damage, with no Fluffy fire penalty; respects contact bypass', () => {
  const a=makeSideState('garchomp'), d=makeSideState('lucariomegaz'); d.ability='';
  const contact=damage(a,d,'firepunch'), noncontact=damage(a,d,'earthquake');
  d.ability='auraguard'; const guarded=damage(a,d,'firepunch');
  assert.equal(guarded.damages.at(-1), Math.floor(contact.damages.at(-1)/2));
  assert.deepEqual(range(damage(a,d,'earthquake')),range(noncontact));
  for (const ability of ['longreach','moldbreaker']) { a.ability=ability; assert.deepEqual(range(damage(a,d,'firepunch')),range(contact)); }
  a.ability=''; a.item='punchingglove'; d.ability=''; const glove=damage(a,d,'firepunch'); d.ability='auraguard'; assert.deepEqual(range(damage(a,d,'firepunch')),range(glove));
});
test('Normal Gem boosts one move, including both Parental Bond hits, then stays consumed', () => {
  const a=makeSideState('kangaskhanmega'), d=makeSideState('snorlax'); a.ability='parentalbond'; a.item='normalgem';
  const r=damage(a,d,'quickattack'), model=r.koContext.powerModel;
  assert.equal(model.hit(r.defHP,false,0,0).bp,52);
  assert.equal(model.hit(r.defHP,false,1,0).bp,52);
  assert.equal(model.hit(r.defHP,false,0,0,1).bp,40);
  assert.equal(model.hit(r.defHP,false,0,0,9).bp,40);
  a.item=''; const plain=damage(a,d,'quickattack');
  assert.deepEqual(resolvePowerMoveUse(model,r.defHP,false,true,1).map(x=>x.damage).sort((a,b)=>a-b),resolvePowerMoveUse(plain.koContext.powerModel,r.defHP,false,true).map(x=>x.damage).sort((a,b)=>a-b));
  a.item='normalgem'; assert(!damage(a,d,'earthquake').koContext.powerModel.consumesAttackItem);
  assert(!damage(a,d,'seismictoss').koContext.powerModel.consumesAttackItem);
  a.ability='klutz'; assert.equal(damage(a,d,'quickattack').bp,40);
});
test('Normal Gem is removed in the observed exchange and Unburden becomes active', () => {
  const a=makeSideState('thievul'),d=makeSideState('snorlax');a.item='normalgem';a.ability='unburden';
  const results=rcAdvanceAttack(a,d,MoveById.quickattack,makeFieldState());
  assert(results.length>0 && results.every(r=>r.a.item==='' && r.a.unburdenActive));
});
test('Ground immunity keeps calculator power visible, but blocks actual observed damage', () => {
  const a=makeSideState('garchomp'),d=makeSideState('lucario');d.item='airballoon';
  const p=damage(a,d,'earthquake');assert(p.damages[0]>0);assert(p.immunityNotes.some(n=>n.includes('풍선')));
  assert.equal(calculateDamage(a,d,MoveById.earthquake,makeFieldState()).damages[0],0);
});
test('New field item and Leek controls explain the required observation inputs', () => {
  const a=makeSideState('rillaboom'); a.item='grassyseed'; assert(renderCalcMoveConditions('atk',a).includes('자동 적용하지 않습니다'));
  a.item='leek'; assert(renderCalcMoveConditions('atk',a).includes('급소 확률'));
});
`);
function test(name, fn) { try { fn(); passed++; console.log(`[PASS] ${name}`); } catch (e) { process.exitCode=1; console.error(`[FAIL] ${name}: ${e.stack}`); } }
run(document, { innerWidth: 1280, addEventListener() {} }, assert, test);
test('Manual corrections survive sync and never mutate source data', () => {
  assert(!PS_FILES.includes('data/overrides/champions-data.json'));
  const source = { auraguard: { name: 'Aura Guard', isNonstandard: 'Future' } };
  assert.equal(applyChampionsDataOverrides('abilities', source).auraguard.isNonstandard, null);
  assert.equal(source.auraguard.isNonstandard, 'Future');
  assert.throws(() => applyChampionsDataOverrides('abilities', {}), /Missing Champions correction target/);
});
console.log(`${passed} M-C checks passed`);
