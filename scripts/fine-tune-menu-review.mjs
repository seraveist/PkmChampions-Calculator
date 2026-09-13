// Read-only product probes for the fine-tune review; no application source is changed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
const elements = new Map();
function element(id = '') {
  if (!elements.has(id)) elements.set(id, {
    textContent: data[id] || '', innerHTML: '', value: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
    closest() { return null; }, appendChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
  });
  return elements.get(id);
}
const document = { getElementById: element, querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {}, createElement: element };
const dir = path.join(root, 'src/js');
const source = fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n');
const api = new Function('document', 'window', `${source}\n
  renderSide = () => {}; triggerCalc = () => {};
  return { state, PokemonById, fineTuneState, makeSideState, makeFieldState, calcStats, effectiveSpeed,
    ftMySpeed, ftApplyToCalc, loadSideToFineTune, ftOppSpeedCase, ftBuildSpeedTable, ftFindMinSpeedEv,
    ftHpBreakpoints, ftBulkMetrics, ftApplyPokemonToFineTune, ftSelectCombo, ftOpponentBaseSpeed,
    renderFineTuneMy, renderFineTuneSpeed, renderFineTuneHp };
`)(document, { innerWidth: 1280, addEventListener() {} });
const report = { basis: 'd05592c', method: 'Current application behavior probes, not a battle-accuracy benchmark.', probes: {} };
const fresh = () => {
  api.state.atk = api.makeSideState('qwilfish');
  api.state.def = api.makeSideState('garchomp');
  api.state.field = api.makeFieldState();
  api.fineTuneState.my = api.makeSideState('qwilfish');
  api.fineTuneState.opp = { pokemonIdx: 'garchomp', scarf: false, speRank: 0, baseSpe: '' };
  api.fineTuneState.weatherAbilityActive = false;
  api.fineTuneState.margin = 1;
};
fresh();
api.fineTuneState.my.ability = 'swiftswim';
api.fineTuneState.weatherAbilityActive = true;
const exportSpeed = api.ftMySpeed(api.fineTuneState.my);
api.ftApplyToCalc('atk');
report.probes.weatherExport = { fineTuneSpeed: exportSpeed, calculatorSpeed: api.effectiveSpeed(api.state.atk, api.state.field, api.state.def), exportedWeather: api.state.field.weather };
assert.notEqual(report.probes.weatherExport.fineTuneSpeed, report.probes.weatherExport.calculatorSpeed);

fresh();
api.state.atk.ability = 'swiftswim';
api.state.field.weather = 'Rain';
const importSpeed = api.effectiveSpeed(api.state.atk, api.state.field, api.state.def);
api.loadSideToFineTune('atk');
report.probes.weatherImport = { calculatorSpeed: importSpeed, fineTuneSpeed: api.ftMySpeed(api.fineTuneState.my), activation: api.fineTuneState.weatherAbilityActive };
assert.notEqual(report.probes.weatherImport.calculatorSpeed, report.probes.weatherImport.fineTuneSpeed);

fresh();
api.fineTuneState.opp.pokemonIdx = 'qwilfish';
const rainyOpponent = api.makeSideState('qwilfish');
rainyOpponent.ability = 'swiftswim';
rainyOpponent.evs.spe = 32;
report.probes.opponentWeather = { fineTuneNeutralMax: api.ftOppSpeedCase(api.fineTuneState.opp, 32, 'hardy'), engineWithRain: api.effectiveSpeed(rainyOpponent, api.makeFieldState({ weather: 'Rain' })) };
assert.notEqual(report.probes.opponentWeather.fineTuneNeutralMax, report.probes.opponentWeather.engineWithRain);

fresh();
api.state.def.evs = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
api.state.def.nature = 'impish';
api.state.def.item = 'leftovers';
api.state.def.moves = ['earthquake'];
const beforeOpponent = structuredClone(api.state.def);
api.loadSideToFineTune('atk');
api.fineTuneState.my.evs.spe = 1;
api.ftApplyToCalc('atk');
const picked = side => ({ pokemon: side.pokemonIdx, evs: side.evs, nature: side.nature, item: side.item, moves: side.moves });
report.probes.opponentRoundTrip = { before: picked(beforeOpponent), after: picked(api.state.def) };
assert.notDeepEqual(report.probes.opponentRoundTrip.before, report.probes.opponentRoundTrip.after);

fresh();
api.fineTuneState.margin = 0;
report.probes.zeroMargin = api.ftBuildSpeedTable().map(row => ({ label: row.label, opponent: row.oppSpe, target: row.target, difference: row.target - row.oppSpe }));
assert(report.probes.zeroMargin.every(row => row.difference === 1));

fresh();
api.fineTuneState.my = api.makeSideState('garchomp');
api.fineTuneState.my.evs = { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 };
api.fineTuneState.opp.pokemonIdx = 'qwilfish';
const target = api.ftOppSpeedCase(api.fineTuneState.opp, 32, 'jolly') + 1;
const withCurrentAllocation = api.ftFindMinSpeedEv(api.fineTuneState.my, target);
api.fineTuneState.my.evs.hp = 0;
const afterReallocation = api.ftFindMinSpeedEv(api.fineTuneState.my, target);
report.probes.speedBudget = { target, withCurrentAllocation, afterReallocation };
assert.equal(withCurrentAllocation, null);
assert.notEqual(afterReallocation, null);

fresh();
api.fineTuneState.my.item = 'sitrusberry';
report.probes.sitrusHpRules = api.ftHpBreakpoints(api.fineTuneState.my).map(row => ({ id: row.rule.id, rule: row.rule.rule, description: row.rule.desc }));
assert(!report.probes.sitrusHpRules.some(row => row.id.includes('sitrus')));

fresh();
api.fineTuneState.my = api.makeSideState('clefable');
api.fineTuneState.my.ability = 'magicguard';
report.probes.magicGuardHpRules = api.ftHpBreakpoints(api.fineTuneState.my).filter(row => row.rule.relevant).map(row => ({ id: row.rule.id, description: row.rule.desc }));
assert(report.probes.magicGuardHpRules.some(row => row.id.startsWith('sr-')));

fresh();
api.state.atk.status = 'Paralysis';
api.loadSideToFineTune('atk');
api.ftApplyPokemonToFineTune('garchomp');
api.renderFineTuneMy();
api.renderFineTuneSpeed();
report.probes.hiddenInheritedConditions = { pokemon: api.fineTuneState.my.pokemonIdx, status: api.fineTuneState.my.status, tailwind: api.fineTuneState.my.tailwind, speed: api.ftMySpeed(api.fineTuneState.my), displayedFlags: elements.get('ft-speed-body').innerHTML.match(/<div class="ft-speed-flags">(.*?)<\/div>/s)?.[1] };
assert.equal(report.probes.hiddenInheritedConditions.status, 'Paralysis');
assert(report.probes.hiddenInheritedConditions.displayedFlags.includes('추가 보정 없음'));

fs.writeFileSync(path.join(root, 'docs/fine-tune-menu-review-probes.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
console.log('9 fine-tune review scenarios reproduced.');
