import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Regression checks using the generated Champions data and actual menu functions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const embedded = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
const elements = new Map();
function element(id = '') {
  if (!elements.has(id)) elements.set(id, {
    textContent: embedded[id] || '', innerHTML: '', value: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
    closest() { return null; }, appendChild() {}, insertBefore() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
  });
  return elements.get(id);
}
const document = { getElementById: element, querySelectorAll() { return []; }, querySelector() { return null; }, addEventListener() {}, createElement: element };
const dir = path.join(root, 'src/js');
const source = fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => readFileSync(path.join(dir, n), 'utf8')).join('\n');
const api = new Function('document', 'window', `${source}\n
  return { PokemonById, MoveById, matchupSlots, matchupAbilities, matchupCoverageMoves, matchupCoverageField,
    matchupSetSlotPokemon, matchupDefenseEffect, defenseTypeProfile, coverageMoveType, coverageCountByType,
    renderDefenseMatchupTable, renderCoverageMatchupTable, renderMatchupLegend, selectedMatchupEntries,
    setMode: mode => matchupMode = mode };
`)(document, { innerWidth: 1280, addEventListener() {} });
let passed = 0;
function test(label, fn) { fn(); passed++; console.log(`[PASS] ${label}`); }
const effect = (type, types, abilityId) => api.matchupDefenseEffect(type, { pokemon: { types }, abilityId }).eff;
const fresh = () => { for (let slot = 0; slot < 6; slot++) api.matchupSetSlotPokemon(slot, null); Object.assign(api.matchupCoverageField, {weather:'none',terrain:'none'}); };
test('Fixed-opponent data, UI and grade functions are absent from the built application', () => {
  for (const marker of ['data-meta-threats', 'matchupMeta', 'META_THREATS', 'defenseScoreLabel', 'coverageThreatGrade']) assert(!html.includes(marker), marker);
  assert(!fs.existsSync(path.join(root, 'data/overrides/meta-threats.json')));
});
test('Type-only defensive modifiers include resistances, vulnerabilities and non-power-of-two multipliers', () => {
  for (const [ability, type, types, expected] of [
    ['thickfat','Ice',['Grass'],1], ['heatproof','Fire',['Steel'],1], ['waterbubble','Fire',['Water'],0.25],
    ['purifyingsalt','Ghost',['Ghost'],1], ['dryskin','Fire',['Grass'],2.5], ['fluffy','Fire',['Normal'],2],
    ['filter','Fire',['Grass','Steel'],3], ['prismarmor','Dark',['Psychic'],1.5], ['solidrock','Water',['Water'],0.5],
  ]) assert.equal(effect(type,types,ability),expected,ability);
});
test('Type immunity and ability immunity remain separate and Wonder Guard uses raw effectiveness', () => {
  assert.equal(effect('Water',['Fire'],'waterabsorb'),0);
  assert.equal(effect('Ground',['Fire'],'levitate'),0);
  assert.equal(effect('Normal',['Ghost'],'thickfat'),0);
  assert.equal(effect('Fire',['Normal'],'wonderguard'),0);
  assert.equal(effect('Fire',['Grass'],'wonderguard'),2);
});
test('HP, category, contact and defense-stat conditions do not enter a static type table', () => {
  for (const ability of ['multiscale','shadowshield','icescales','auraguard','furcoat','punkrock']) assert.equal(effect('Ice',['Normal'],ability),1,ability);
  assert.equal(effect('Ice',['Normal'],'fluffy'),1);
});
test('Summary remains factual at any party size and counts fractional resistance', () => {
  for (const count of [1,3,6]) {
    const p = api.defenseTypeProfile('Fire',Array.from({length:count},()=>({pokemon:{types:['Normal']}})));
    assert.equal(p.neutralCount,count); assert.equal(p.weakCount,0); assert(!('grade' in p)); assert(!('score' in p));
  }
  const p = api.defenseTypeProfile('Fire',[{pokemon:{types:['Bug','Steel']},abilityId:'filter'},{pokemon:{types:['Fire']},abilityId:'thickfat'}]);
  assert.equal(p.weakCount,1); assert.equal(p.resistCount,1);
});
test('Weather Ball follows each explicitly chosen weather', () => {
  fresh(); api.matchupSetSlotPokemon(0,'charizard');
  for (const [weather,type] of Object.entries({none:'Normal',Sun:'Fire',Rain:'Water',Sand:'Rock',Snow:'Ice'})) {
    api.matchupCoverageField.weather=weather; assert.equal(api.coverageMoveType(0,api.MoveById.weatherball),type);
  }
});
test('Terrain Pulse requires grounding and ability conversion follows field conversion', () => {
  fresh(); api.matchupSetSlotPokemon(0,'snorlax');
  for (const [terrain,type] of Object.entries({Electric:'Electric',Grassy:'Grass',Misty:'Fairy',Psychic:'Psychic'})) {
    api.matchupCoverageField.terrain=terrain; assert.equal(api.coverageMoveType(0,api.MoveById.terrainpulse),type);
  }
  api.matchupSetSlotPokemon(0,'charizard'); assert.equal(api.coverageMoveType(0,api.MoveById.terrainpulse),'Normal');
  api.matchupSetSlotPokemon(0,'delphoxmega'); assert.equal(api.coverageMoveType(0,api.MoveById.terrainpulse),'Normal');
  api.matchupSetSlotPokemon(0,'sylveon',{abilityId:'pixilate'});
  assert.equal(api.coverageMoveType(0,api.MoveById.weatherball),'Fairy');
  api.matchupCoverageField.weather='Rain'; assert.equal(api.coverageMoveType(0,api.MoveById.weatherball),'Water');
});
test('Own weather suppression applies without treating the whole party as active', () => {
  fresh(); api.matchupSetSlotPokemon(0,'altaria',{abilityId:'cloudnine'}); api.matchupSetSlotPokemon(1,'charizard');
  api.matchupCoverageField.weather='Rain';
  assert.equal(api.coverageMoveType(0,api.MoveById.weatherball),'Normal');
  assert.equal(api.coverageMoveType(1,api.MoveById.weatherball),'Water');
});
test('Coverage counts Pokemon, rejects stale or status moves, and clears removed slots', () => {
  fresh(); api.matchupSetSlotPokemon(0,'charizard'); api.matchupSetSlotPokemon(1,'charizard');
  api.matchupCoverageMoves[0]=['flamethrower','fireblast','swordsdance','surf'];
  api.matchupCoverageMoves[1]=['flamethrower',null,null,null];
  assert.equal(api.coverageCountByType('Fire'),2); assert.equal(api.coverageCountByType('Water'),0); assert.equal(api.coverageCountByType('Normal'),0);
  api.matchupCoverageMoves[4][0]='flamethrower'; assert.equal(api.coverageCountByType('Fire'),2);
  api.matchupSetSlotPokemon(0,'blastoise'); assert.equal(api.coverageCountByType('Fire'),1);
  api.matchupSetSlotPokemon(1,null); assert.equal(api.coverageCountByType('Fire'),0); assert(api.matchupCoverageMoves[1].every(m=>m===null));
});
test('One Pokemon produces a defense table and empty move input is not a coverage failure', () => {
  fresh(); api.matchupSetSlotPokemon(0,'charizard'); api.renderDefenseMatchupTable();
  assert.equal((element('matchupBody').innerHTML.match(/<tr>/g)||[]).length,18);
  api.renderCoverageMatchupTable(); assert(element('matchupBody').innerHTML.includes('공격 기술을 입력')); assert(!element('matchupBody').innerHTML.includes('coverage-miss'));
  api.matchupSetSlotPokemon(1,'blastoise'); api.matchupCoverageMoves[0][0]='flamethrower'; api.renderCoverageMatchupTable();
  assert.equal((element('matchupBody').innerHTML.match(/coverage-pending/g)||[]).length,18);
  assert(element('matchupBody').innerHTML.includes('coverage-none'));
  api.setMode('coverage'); api.renderMatchupLegend(); assert(element('matchupLegend').innerHTML.includes('입력 1 / 2'));
});
test('Conditional defense effects are disclosed for the selected ability', () => {
  fresh(); api.setMode('defense'); api.matchupSetSlotPokemon(0,'dragonite',{abilityId:'multiscale'}); api.renderMatchupLegend();
  assert(element('matchupLegend').innerHTML.includes('멀티스케일')); assert(element('matchupLegend').innerHTML.includes('제외'));
});
console.log(`matchup behavior: ${passed} checks passed`);
