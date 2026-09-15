import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Diagnostic review only: does not change product state or reference accuracy claims.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
const element = id => ({ textContent: data[id] || '', value: '', dataset: {}, style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
  closest() { return null; }, appendChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; } });
const document = { getElementById: element, querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {}, createElement: element };
const dir = path.join(root, 'src/js');
const source = fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => readFileSync(path.join(dir, n), 'utf8')).join('\n');
const api = new Function('document', 'window', `${source}\nreturn {PokemonById, MoveById, revCalcState, makeSideState, makeFieldState, effectiveTypes, rcAdvanceAttack, rcHp, calculateDamage, rcForecastHit, rcValidateExchangeInput, rcDefaultItemCandidatesForOpponent, rcItemCandidateMasterList, rcHpFirstSpreads, rcObservedHpMatches, rcSetHp, calcStats};`)(document, { innerWidth: 1280, addEventListener() {} });
const field = api.makeFieldState();
const report = { method: 'Current M-C product engine probes, compared with the pinned Showdown item/move effect definitions. Isolated deterministic state-transition checks; not a real battle accuracy benchmark.', probes: {} };
const side = (id, ability = '', item = '') => ({ ...api.makeSideState(id), ability, item });
const range = r => [r.damages[0], r.damages.at(-1)];
function attack(a, d, id) {
  assert(api.PokemonById[a.pokemonIdx].ls.includes(id), `${a.pokemonIdx} cannot learn ${id}`);
  const rows = api.rcAdvanceAttack(a, d, api.MoveById[id], field);
  assert(rows.length, id + ' produced no outcomes');
  return rows.find(r => api.rcHp(r.a) > 0 && api.rcHp(r.d) > 0) || rows[0];
}

{
  const hit = attack(side('garchomp'), side('snorlax', '', 'airballoon'), 'dragonclaw');
  report.probes.airBalloon = { damageTaken: hit.damage, itemAfterHit: hit.d.item,
    nextEarthquake: range(api.calculateDamage(hit.a, hit.d, api.MoveById.earthquake, field)),
    nextEarthquakeAfterRemovingBalloon: range(api.calculateDamage(hit.a, { ...hit.d, item: '' }, api.MoveById.earthquake, field)),
    expected: 'A damaging hit pops Air Balloon before the next attack.' };
}
{
  const a = side('baxcalibur', 'thermalexchange'), d = side('snorlax');
  const before = range(api.calculateDamage(d, a, api.MoveById.bodyslam, field));
  const hit = attack(a, d, 'glaiverush');
  report.probes.glaiveRush = { bodySlamBefore: before,
    bodySlamAfter: range(api.calculateDamage(hit.d, hit.a, api.MoveById.bodyslam, field)),
    bothSurvived: api.rcHp(hit.a) > 0 && api.rcHp(hit.d) > 0,
    expected: 'Incoming damage is doubled after Glaive Rush until before its user next acts.' };
}
{
  const hit = attack(side('golisopodmega', 'toughclaws'), side('snorlax'), 'firstimpression');
  const outcomes = api.rcForecastHit(hit.a, hit.d, api.MoveById.firstimpression, null, field, true, new Map());
  report.probes.firstImpression = { firstAttackDamage: hit.damage,
    nextAttackDamageRange: [Math.min(...outcomes.map(x => x.damage)), Math.max(...outcomes.map(x => x.damage))],
    nextAttackKoPossible: outcomes.some(x => x.hp <= 0),
    expected: 'First Impression fails on the following turn if the user has remained on the field.' };
}
{
  const hit = attack(side('pawmot'), side('snorlax'), 'doubleshock');
  const incoming = side('garchomp');
  report.probes.doubleShock = { typesAfterUse: api.effectiveTypes(hit.a),
    nextGroundDamage: range(api.calculateDamage(incoming, hit.a, api.MoveById.earthquake, field)),
    groundDamageAfterElectricTypeRemoval: range(api.calculateDamage(incoming, { ...hit.a, types: ['Fighting'] }, api.MoveById.earthquake, field)),
    expected: 'Double Shock removes the Electric type; the user cannot immediately reuse it without regaining that type.' };
}
for (const item of ['redcard', 'ejectbutton']) {
  const a = side('garchomp'), d = side('snorlax', '', item);
  const hit = attack(a, d, 'dragonclaw');
  Object.assign(api.revCalcState, { my: a, opp: d, oppItemKnown: item, myMove: 'dragonclaw', oppMove: 'bodyslam', observedTheirPct: '50', observedMyHp: '100' });
  report.probes[item] = { itemAfterHit: hit.d.item, sameParticipants: hit.a.pokemonIdx === a.pokemonIdx && hit.d.pokemonIdx === d.pokemonIdx,
    inputWarning: api.rcValidateExchangeInput(api.MoveById.dragonclaw, api.MoveById.bodyslam),
    expected: 'A successful activation changes the participant; the same uninterrupted duel cannot be assumed.' };
}
api.revCalcState.opp.pokemonIdx = 'archaludon';
report.probes.unknownItems = { defaultCandidates: api.rcDefaultItemCandidatesForOpponent(),
  masterHasExpertBelt: api.rcItemCandidateMasterList().some(i => i.id === 'expertbelt'),
  masterHasNormalGem: api.rcItemCandidateMasterList().some(i => i.id === 'normalgem') };
const spreads = api.rcHpFirstSpreads('def', true);
report.probes.hpPriority = { spreadCount: spreads.length, includesH32B16: spreads.some(p => p.hp === 32 && p.defense === 16),
  includesH16B16: spreads.some(p => p.hp === 16 && p.defense === 16) };
const target = api.rcSetHp(side('typhlosion'), 70);
const observed = Math.floor(api.rcHp(target) / api.calcStats(target).hp * 100);
api.revCalcState.observedTheirPct = String(observed);
const exact = api.rcObservedHpMatches(target, 'opp');
api.revCalcState.observedTheirPct = String(observed + 1);
report.probes.hpObservation = { displayedPercent: observed, exactMatches: exact, plusOnePercentMatches: api.rcObservedHpMatches(target, 'opp') };
fs.writeFileSync(path.join(root, 'docs/reverse-mc-followup-probes.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
