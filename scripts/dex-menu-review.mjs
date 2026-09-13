// Read-only behavior probes for the September 2026 Pokédex review.
// These record current gaps, not a passing regression contract for the future fix.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadTsModule, applyModOverrides } from './ts-loader.mjs';
import { applyChampionsDataOverrides } from './champions-overrides.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const embedded = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
const data = Object.fromEntries(['pokemon', 'moves', 'abilities', 'items'].map(k => [k, JSON.parse(embedded[`data-${k}`])]));
const elements = new Map();
function element(id = '') {
  if (!elements.has(id)) elements.set(id, {
    textContent: embedded[id] || '', innerHTML: '', value: '', dataset: {}, style: {},
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
  triggerCalc = () => {};
  return { state, PokemonById, MoveById, AbilityById, PokemonByMove, PokemonByAbility,
    makeSideState, makeFieldState, calcStats, calculateDamage, computeVariableBp,
    applyDexAction, calcMoveWithConditions, movePowerLabel, renderMoveDetail,
    renderAbilityDetail, VARIABLE_BP_NOTE };
`)(document, { innerWidth: 1280, addEventListener() {} });
const mergedMoves = applyChampionsDataOverrides('moves', applyModOverrides(
  loadTsModule(path.join(root, 'data/moves.ts')).Moves,
  loadTsModule(path.join(root, 'data/mods/champions/moves.ts')).Moves,
));
const missing = (entries, predicate) => entries.filter(predicate).map(e => e.id);
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const report = {
  date: '2026-09-13', basis: 'd05592c plus local fine-tune improvements',
  method: 'Local generated data and real application functions with a stub DOM; renderSide remains active. Not a browser layout test or a certification of live regulation legality.',
  inventory: Object.fromEntries(Object.entries(data).map(([k, entries]) => [k, {
    count: entries.length,
    missingKoreanName: missing(entries, e => !/[가-힣]/.test(e.koName || '')),
    ...(k !== 'pokemon' ? { missingShortDescription: missing(entries, e => !e.desc) } : {}),
  }])),
};
report.movePp = {
  emitted: data.moves.filter(m => Number.isFinite(m.pp)).length,
  sourceAvailable: data.moves.filter(m => Number.isFinite(mergedMoves[m.id]?.pp)).length,
  examples: ['thunderbolt', 'banefulbunker', 'beakblast'].map(id => ({
    id, sourcePp: mergedMoves[id]?.pp,
    rendered: api.renderMoveDetail(api.MoveById[id])[0].match(/<span class="label">PP<\/span><b>(.*?)<\/b>/)?.[1],
  })),
};
assert.equal(report.movePp.emitted, 0);
report.movePowerLabels = ['gyroball', 'electroball', 'fling', 'beatup', 'ficklebeam'].map(id => ({
  id, basePower: api.MoveById[id].bp, variableKind: api.MoveById[id].variableBpKind,
  list: api.movePowerLabel(api.MoveById[id]),
  detail: api.renderMoveDetail(api.MoveById[id])[0].match(/<span class="label">위력<\/span><b>(.*?)<\/b>/)?.[1],
  note: api.VARIABLE_BP_NOTE[id] || null,
}));
assert.equal(report.movePowerLabels.find(m => m.id === 'gyroball').list, '가변');
assert.equal(report.movePowerLabels.find(m => m.id === 'gyroball').detail, '—');
const fresh = () => {
  api.state.atk = api.makeSideState('garchomp');
  api.state.def = api.makeSideState('charizard');
  api.state.field = api.makeFieldState();
};
const bp = id => api.computeVariableBp(api.MoveById[id], api.state.atk, api.state.def,
  api.state.field, api.calcStats(api.state.atk), api.calcStats(api.state.def));
fresh();
report.solarCondition = { note: api.VARIABLE_BP_NOTE.solarbeam, noWeather: bp('solarbeam') };
api.state.field.weather = 'Rain';
report.solarCondition.rain = bp('solarbeam');
assert.equal(report.solarCondition.noWeather, 120);
assert.equal(report.solarCondition.rain, 60);
fresh();
api.state.field.terrain = 'Electric';
report.terrainCondition = { note: api.VARIABLE_BP_NOTE.risingvoltage, flyingTarget: bp('risingvoltage') };
api.state.def = api.makeSideState('garchomp');
report.terrainCondition.groundedTarget = bp('risingvoltage');
fresh();
api.state.def.item = 'charizarditex';
report.knockOffCondition = { note: api.VARIABLE_BP_NOTE.knockoff, matchingMegaStone: bp('knockoff') };
api.state.def.item = 'leftovers';
report.knockOffCondition.removableItem = bp('knockoff');
report.moveHandoff = [];
for (const route of ['move', 'same-pokemon-parent', 'same-pokemon-from-move']) {
  fresh();
  api.state.atk.moves = ['flamethrower'];
  api.state.atk.moveBpOverrides[0] = 200;
  api.state.atk.moveTypeOverrides[0] = 'Fire';
  api.state.atk.moveCriticalOverrides[0] = true;
  api.state.atk.moveHitCounts[0] = 5;
  const ctx = route === 'same-pokemon-from-move'
    ? { type: 'pokemon', id: 'garchomp', parent: { type: 'move', id: 'earthquake' } }
    : { type: 'move', id: 'earthquake', ...(route === 'same-pokemon-parent' ? { parent: { type: 'pokemon', id: 'garchomp' } } : {}) };
  api.applyDexAction(route === 'same-pokemon-from-move' ? 'pokemon-atk' : 'move-0', ctx);
  const move = api.calcMoveWithConditions(api.MoveById.earthquake, api.state.atk, 0);
  const row = { route, selected: api.state.atk.moves[0], expected: { bp: 100, type: 'Ground', critical: false }, actual: {
    bp: move.bp, type: move.type, critical: api.state.atk.moveCriticalOverrides[0],
    storedHitCount: api.state.atk.moveHitCounts[0],
  } };
  assert.equal(row.actual.bp, 200);
  assert.equal(row.actual.type, 'Fire');
  assert.equal(row.actual.critical, true);
  report.moveHandoff.push(row);
}
report.scope = {
  movesWithoutCurrentUsers: missing(data.moves, m => !(api.PokemonByMove[m.id] || []).length),
  abilitiesWithoutCurrentOwners: missing(data.abilities, a => !(api.PokemonByAbility[a.id] || []).length),
  specialSourceTags: data.moves.filter(m => mergedMoves[m.id]?.isNonstandard).map(m => ({ id: m.id, tag: mergedMoves[m.id].isNonstandard })),
  note: 'No current users does not by itself prove illegality; Struggle is one intentional special case.',
};
report.subjectiveAbilityRating = plain(api.renderAbilityDetail(api.AbilityById.hugepower)[0]);
report.moveFlagExample = plain(api.renderMoveDetail(api.MoveById.earthquake)[0]).split('설명')[0];
fs.writeFileSync(path.join(root, 'docs/dex-menu-review-probes.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, scope: {
  movesWithoutCurrentUsers: report.scope.movesWithoutCurrentUsers.length,
  abilitiesWithoutCurrentOwners: report.scope.abilitiesWithoutCurrentOwners.length,
  specialSourceTagCounts: Object.fromEntries([...new Set(report.scope.specialSourceTags.map(m => m.tag))].map(tag => [tag, report.scope.specialSourceTags.filter(m => m.tag === tag).length])),
}, subjectiveAbilityRating: report.subjectiveAbilityRating.slice(0, 120) }, null, 2));
console.log('Dex review gaps reproduced; application source was not changed.');
