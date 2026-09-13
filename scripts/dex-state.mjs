// Behavioral checks for Dex data, filtering, and calculator handoff.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadTsModule, applyModOverrides } from './ts-loader.mjs';
import { applyChampionsDataOverrides } from './champions-overrides.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const embedded = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
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
  return { state, MOVES, ABILITIES, PokemonById, MoveById, AbilityById, dexViewState,
    makeSideState, makeFieldState, calcStats, computeVariableBp, applyMoveToCalcSlot,
    applyDexAction, calcMoveWithConditions, movePowerLabel, movePowerNote, renderMoveDetail,
    renderAbilityDetail, renderPokemonDetail, renderLearnsetByType, handleLearnsetFilterClick,
    dexScopeEntries, dexMoveTraits };
`)(document, { innerWidth: 1280, addEventListener() {} });
const mergedMoves = applyChampionsDataOverrides('moves', applyModOverrides(
  loadTsModule(path.join(root, 'data/moves.ts')).Moves,
  loadTsModule(path.join(root, 'data/mods/champions/moves.ts')).Moves,
));
let passed = 0;
function test(label, body) { body(); passed++; console.log(`[PASS] ${label}`); }
const fresh = () => {
  api.state.atk = api.makeSideState('garchomp');
  api.state.def = api.makeSideState('charizard');
  api.state.field = api.makeFieldState({ weather: 'Rain' });
};
test('All emitted move PP values match merged Champions source data', () => {
  for (const move of api.MOVES) {
    assert(Number.isInteger(move.pp) && move.pp > 0, move.id);
    assert.equal(move.pp, mergedMoves[move.id].pp, move.id);
  }
  assert.equal(api.MoveById.banefulbunker.pp, 5);
  assert.equal(api.MoveById.beakblast.pp, 5);
});
test('G-Max source moves remain available for future rules but are excluded from current output', () => {
  const gmax = Object.entries(mergedMoves).filter(([, m]) => m.isNonstandard === 'Gmax');
  assert(gmax.length >= 33);
  for (const [id] of gmax) assert(!api.MoveById[id], id);
  for (const p of Object.values(api.PokemonById)) assert(!p.ls.some(id => id.startsWith('gmax')), p.id);
});
test('Move list and detail agree on variable, fixed-damage, OHKO and status labels', () => {
  for (const [id, expected] of Object.entries({ gyroball: '가변', electroball: '가변', fling: '가변', beatup: '가변', ficklebeam: '80/160' })) {
    assert.equal(api.movePowerLabel(api.MoveById[id]), expected);
    assert(api.renderMoveDetail(api.MoveById[id])[0].includes(`<b>${expected}</b>`), id);
  }
  assert.equal(api.movePowerLabel(api.MoveById.seismictoss), '고정 피해');
  assert.equal(api.movePowerLabel(api.MoveById.fissure), '일격');
  assert.equal(api.movePowerLabel(api.MoveById.protect), '—');
});
test('Every emitted variable mechanic has a useful condition note', () => {
  for (const move of api.MOVES.filter(m => m.variableBpKind)) assert(api.movePowerNote(move), move.id);
  assert(api.movePowerNote(api.MoveById.solarbeam).includes('날씨가 없으면 원래 위력'));
  assert(api.movePowerNote(api.MoveById.risingvoltage).includes('상대가 땅에'));
  assert(api.movePowerNote(api.MoveById.expandingforce).includes('자신이 땅에'));
  assert(api.movePowerNote(api.MoveById.knockoff).includes('메가스톤 제외'));
});
for (const route of ['move', 'same-pokemon-parent', 'same-pokemon-from-move']) {
  test(`${route}: imported move resets only its slot and keeps the build and field`, () => {
    fresh();
    api.state.atk.moves = ['flamethrower', 'rockslide'];
    api.state.atk.evs.hp = 32;
    api.state.atk.nature = 'jolly';
    api.state.atk.moveBpOverrides = [200, 150, null, null];
    api.state.atk.moveTypeOverrides = ['Fire', 'Ice', null, null];
    api.state.atk.moveCriticalOverrides = [true, true, false, false];
    api.state.atk.moveHitCounts = [5, 3, null, null];
    const defBefore = structuredClone(api.state.def);
    api.applyDexAction(route === 'same-pokemon-from-move' ? 'pokemon-atk' : 'move-0',
      route === 'same-pokemon-from-move' ? { type: 'pokemon', id: 'garchomp', parent: { type: 'move', id: 'earthquake' } }
        : { type: 'move', id: 'earthquake', ...(route === 'same-pokemon-parent' ? { parent: { type: 'pokemon', id: 'garchomp' } } : {}) });
    const adjusted = api.calcMoveWithConditions(api.MoveById.earthquake, api.state.atk, 0);
    assert.equal(adjusted.bp, 100);
    assert.equal(adjusted.type, 'Ground');
    assert.equal(api.state.atk.moveCriticalOverrides[0], false);
    assert.equal(api.state.atk.moveHitCounts[0], null);
    assert.equal(api.state.atk.moveBpOverrides[1], 150);
    assert.equal(api.state.atk.moveTypeOverrides[1], 'Ice');
    assert.equal(api.state.atk.moveCriticalOverrides[1], true);
    assert.equal(api.state.atk.moveHitCounts[1], 3);
    assert.equal(api.state.atk.evs.hp, 32);
    assert.equal(api.state.atk.nature, 'jolly');
    assert.equal(api.state.field.weather, 'Rain');
    assert.deepEqual(api.state.def, defBefore);
  });
}
test('Changing the parent Pokemon installs the move in the requested slot', () => {
  fresh();
  api.applyDexAction('move-2', { type: 'move', id: 'thunderbolt', parent: { type: 'pokemon', id: 'pikachu' } });
  assert.equal(api.state.atk.pokemonIdx, 'pikachu');
  assert.equal(api.state.atk.moves[2], 'thunderbolt');
});
test('Invalid slot and stale excluded move IDs cannot alter calculator state', () => {
  fresh();
  const before = structuredClone(api.state);
  for (const slot of [-1, 4, 1.5, NaN]) assert.equal(api.applyMoveToCalcSlot('atk', slot, 'earthquake'), false);
  assert.equal(api.applyMoveToCalcSlot('atk', 0, 'gmaxwildfire'), false);
  api.applyDexAction('move-20', { type: 'move', id: 'earthquake' });
  assert.deepEqual(api.state, before);
});
const learnable = api.PokemonById.charizard.ls.map(id => api.MoveById[id]);
const idsIn = html => [...html.matchAll(/data-dex-link="move" data-id="([^"]+)"/g)].map(m => m[1]).sort();
for (const category of [null, 'Physical', 'Special', 'Status']) {
  test(`Learnset ${category || 'all'} filter combines with the Fire type`, () => {
    for (const type of [null, 'Fire']) {
      const expected = learnable.filter(m => (!type || m.type === type) && (!category || m.cat === category)).map(m => m.id).sort();
      assert.deepEqual(idsIn(api.renderLearnsetByType(learnable, { type, category })), expected);
    }
  });
}
test('Empty combinations retain both filter controls and show a clear empty state', () => {
  const rendered = api.renderLearnsetByType([api.MoveById.earthquake], { type: 'Ground', category: 'Special' });
  assert(rendered.includes('해당하는 기술이 없습니다'));
  assert(rendered.includes('data-learnset-category="Physical"'));
  assert(rendered.includes('data-learnset-filter="Ground"'));
});
test('Detail and modal filter contexts are independent, and changing category keeps type', () => {
  const full = { type: 'pokemon', id: 'charizard', learnsetFilter: { type: 'Fire', category: 'Physical' } };
  const modal = { type: 'pokemon', id: 'garchomp', learnsetFilter: { type: null, category: null } };
  const click = (ctx, dataset) => api.handleLearnsetFilterClick({ target: { closest() { return { dataset }; } } }, { querySelector() { return element('probe-wrap'); } }, ctx);
  click(modal, { learnsetCategory: 'Special' });
  assert.deepEqual(full.learnsetFilter, { type: 'Fire', category: 'Physical' });
  click(full, { learnsetCategory: 'Status' });
  assert.deepEqual(full.learnsetFilter, { type: 'Fire', category: 'Status' });
  click(full, { learnsetFilter: '' });
  assert.deepEqual(full.learnsetFilter, { type: null, category: 'Status' });
});
test('Default scope includes Struggle and connected entries; other reference entries remain explicitly accessible', () => {
  const moves = api.dexScopeEntries(api.MOVES, 'moves');
  assert(moves.some(m => m.id === 'struggle'));
  assert(!moves.some(m => m.id === 'baddybad'));
  assert(!api.dexScopeEntries(api.ABILITIES, 'abilities').some(a => a.id === 'airlock'));
  api.dexViewState.moves.scope = 'all';
  assert(api.dexScopeEntries(api.MOVES, 'moves').some(m => m.id === 'baddybad'));
  assert(api.renderMoveDetail(api.MoveById.baddybad)[0].includes('현재 수록 포켓몬 중 학습 대상 없음'));
  assert(api.renderAbilityDetail(api.AbilityById.airlock)[0].includes('현재 수록 포켓몬 중 보유 대상 없음'));
});
test('Basic descriptions omit generic ratings and technical flags, and label type-only matchups', () => {
  assert(!api.renderAbilityDetail(api.AbilityById.hugepower)[0].includes('필수급'));
  assert(!api.renderMoveDetail(api.MoveById.earthquake)[0].includes('미러 카피'));
  assert(api.dexMoveTraits(api.MoveById.earthquake).includes('방어에 막힘'));
  assert(api.renderPokemonDetail(api.PokemonById.gengar)[0].includes('특성·도구 제외'));
});
console.log(`Dex state: ${passed} PASS, 0 FAIL`);
