// Exercise the bundled production modules. The offline assertions run in npm test.
// The sync workflow additionally builds the exact simulator that supplied the data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { checkStateReference } from './damage-state-reference.mjs';
import { checkDamageMatrix } from './damage-reference-matrix.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const embedded = fs.readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = new Map(
  [...embedded.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(
    ([, id, json]) => [id, json],
  ),
);
const entry = [
  ['01-core', 'AbilityById, ItemById, MoveById, PokemonById, calcMaxHp, calcStats, toId'],
  ['02-engine', 'calculateDamage, effectiveSpeed, powerMoveField'],
  ['03-40-calc-entry-effects', 'makeCalcState'],
  ['02-hit-state', 'actualHitOutcomes, advanceDamageMove, battleHp'],
  ['03-10-calc-state', 'makeSideState, makeFieldState, setSideCurrentHp, state'],
  ['03-32-calc-ui', 'powerUiCalculateSlot'],
  ['04-20-matchup', 'matchupDefenseEffect'],
]
  .map(([module, names]) => `export { ${names} } from './src/js/${module}.js';`)
  .join('\n');
const bundle = await build({
  stdin: { contents: entry, resolveDir: root },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'API',
  platform: 'node',
});
const api = vm.runInNewContext(bundle.outputFiles[0].text + '\nAPI', {
  document: { getElementById: (id) => ({ textContent: data.get(id) }) },
  window: {},
  console,
});
function makeSide(id, ability, options = {}) {
  const side = Object.assign(api.makeSideState(id), options, { ability });
  assert.ok(Object.values(api.PokemonById[id].ab).map(api.toId).includes(ability), id + '/' + ability);
  return side;
}
const excadrill = (ability) =>
  makeSide('excadrill', ability, { nature: 'adamant', item: 'choicescarf', evs: { atk: 32, spe: 32 } });
const mimikyu = (broken = false) =>
  makeSide('mimikyu', 'disguise', { nature: 'jolly', evs: { atk: 32, spe: 32 }, disguiseBroken: broken });
const garchomp = () => makeSide('garchomp', 'roughskin');
const mega = () => makeSide('eelektrossmega', 'eelevate', { item: 'eelektrossite' });
const field = (options) => api.makeFieldState(options);
const cases = [];
function verify(name, a, d, moveId, options, expected) {
  const f = field(options),
    move = api.MoveById[moveId];
  assert.ok(api.PokemonById[a.pokemonIdx].ls.includes(moveId), a.pokemonIdx + '/' + moveId);
  a.moves = [moveId];
  Object.assign(api.state, { atk: a, def: d, field: f });
  const card = api.powerUiCalculateSlot(0);
  if (expected.ko)
    assert.equal([card.ko?.label, card.ko?.turns].filter(Boolean).join(' '), expected.ko, name);
  const outcomes = api.actualHitOutcomes(a, d, move, f);
  const hp = [...new Set(outcomes.map((o) => o.hp))].sort((x, y) => x - y);
  assert.ok(Math.abs(outcomes.reduce((s, o) => s + o.chance, 0) - 1) < 1e-9, name);
  if (expected.hp) assert.deepEqual([hp[0], hp.at(-1)], expected.hp, name);
  if (expected.raw)
    assert.deepEqual([card.result.damages[0], card.result.damages.at(-1)], expected.raw, name);
  if (expected.chance) assert.ok(Math.abs(card.ko.metric.oneMoveKoChance - expected.chance) < 1e-10, name);
  if (expected.badge)
    assert.ok(
      card.result.immunityNotes.some((note) => note.includes(expected.badge)),
      name,
    );
  if (expected.post) {
    const paths = api.advanceDamageMove(a, d, move, f);
    assert.ok(paths.length, name);
    for (const path of paths) {
      const actual = { spa: path.a.ranks.spa, atkItem: path.a.item, defItem: path.d.item,
        flashFire: !!path.d.flashFireActive, times: Number(path.d.timesAttacked || 0), spe: path.d.ranks.spe, defAtk: path.d.ranks.atk };
      for (const [key, value] of Object.entries(expected.post)) assert.equal(actual[key], value, name + '/' + key);
    }
  }
  cases.push({ name, a, d, moveId, f, hp, post: expected.post, reference: expected.reference !== false });
}
verify(
  '틀깨기 / 온전한 탈',
  excadrill('moldbreaker'),
  mimikyu(),
  'ironhead',
  {},
  { ko: '확정 1타', hp: [0, 0], raw: [186, 222] },
);
verify(
  '모래헤치기 / 온전한 탈',
  excadrill('sandrush'),
  mimikyu(),
  'ironhead',
  {},
  { ko: '확정 2타', hp: [114, 114], raw: [186, 222], badge: '탈' },
);
verify('이미 깨진 탈', excadrill('sandrush'), mimikyu(true), 'ironhead', {}, { ko: '확정 1타', hp: [0, 0] });
verify(
  '첫 타격에서 탈 소비',
  makeSide('salamence', 'moxie'),
  mimikyu(),
  'dualwingbeat',
  {},
  { ko: '난수 2타', hp: [71, 78] },
);
verify(
  '천정부지',
  garchomp(),
  mega(),
  'bulldoze',
  {},
  { ko: '무효', hp: [160, 160], raw: [102, 122], badge: '천정부지' },
);
verify(
  '중력 / 천정부지',
  garchomp(),
  mega(),
  'bulldoze',
  { isGravity: true },
  { ko: '확정 2타', hp: [38, 58] },
);
verify(
  '틀깨기 / 천정부지',
  makeSide('excadrill', 'moldbreaker'),
  mega(),
  'bulldoze',
  {},
  { ko: '확정 2타', hp: [34, 56] },
);
verify(
  '부유',
  garchomp(),
  makeSide('eelektross', 'levitate'),
  'bulldoze',
  {},
  { ko: '무효', hp: [160, 160] },
);
verify(
  '타오르는불꽃',
  garchomp(),
  makeSide('arcanine', 'flashfire'),
  'flamethrower',
  {},
  { ko: '무효', hp: [165, 165], raw: [17, 20], post:{flashFire:true} },
);
const injured = makeSide('vaporeon', 'waterabsorb');
api.setSideCurrentHp(injured, 100);
verify(
  '저수 회복',
  makeSide('blastoise', 'torrent'),
  injured,
  'waterpulse',
  {},
  { ko: '무효', hp: [151, 151] },
);
for (const [item, ko, hp, chance] of [
  ['focussash', '확정 2타', [1, 1], 0],
  ['focusband', '난수 1타', [0, 1], 0.9],
]) {
  verify(
    item,
    makeSide('garchomp', 'roughskin', { nature: 'modest', evs: { spa: 32 } }),
    makeSide('scizor', 'technician', { item }),
    'flamethrower',
    {},
    { ko, hp, chance, reference: item !== 'focusband' },
  );
}
verify(
  '습기',
  makeSide('forretress', 'sturdy'),
  makeSide('swampert', 'damp'),
  'explosion',
  {},
  { ko: '무효', hp: [175, 175] },
);
const snorlax = () => makeSide('snorlax', 'immunity');
for (const [count, raw] of [
  [0, [15, 18]],
  [1, [29, 35]],
  [6, [102, 120]],
]) {
  verify(
    '분노의주먹 피격 ' + count,
    makeSide('annihilape', 'defiant', { timesAttacked: count }),
    makeSide('umbreon', 'synchronize'),
    'ragefist',
    {},
    { raw },
  );
}
const grounded = mega();
grounded.forcedGrounded = true;
verify('떨어뜨리기 / 천정부지', garchomp(), grounded, 'bulldoze', {}, { ko: '확정 2타', hp: [38, 58] });
verify('두꺼운지방', garchomp(), makeSide('snorlax', 'thickfat'), 'flamethrower', {}, { raw: [14, 17] });
verify('내열', garchomp(), makeSide('sinistcha', 'heatproof'), 'flamethrower', {}, { raw: [34, 42] });
verify('건조피부', garchomp(), makeSide('toxicroak', 'dryskin'), 'flamethrower', {}, { raw: [50, 59] });
verify('깨뜨리다 / 리플렉터', garchomp(), snorlax(), 'brickbreak', { defReflect: true }, { raw: [102, 120] });
verify(
  '공격 직전 배틀스위치',
  makeSide('aegislash', 'stancechange'),
  snorlax(),
  'flashcannon',
  {},
  { raw: [57, 67] },
);
verify('셸암즈 분류', makeSide('slowbrogalar', 'owntempo'), snorlax(), 'shellsidearm', {}, { raw: [72, 85] });
verify(
  '플레어송 누적 특공',
  makeSide('skeledirge', 'blaze'),
  snorlax(),
  'torchsong',
  {},
  { ko: '난수 3타', raw: [46, 55] },
);
verify(
  '하양허브 / 오버히트',
  makeSide('charizard', 'blaze', { item: 'whiteherb' }),
  snorlax(),
  'overheat',
  {},
  { ko: '난수 4타', raw: [73, 87] },
);
verify(
  '반동으로 사용자가 기절',
  makeSide('forretress', 'overcoat'),
  snorlax(),
  'explosion',
  {},
  { ko: '연속 KO 불가', raw: [122, 144] },
);
for (const [id, ability] of [
  ['eelektrossmega', 'eelevate'],
  ['eelektross', 'levitate'],
]) {
  assert.equal(
    api.matchupDefenseEffect('Ground', { pokemon: api.PokemonById[id], abilityId: ability }).eff,
    0,
  );
}
const singer = () => makeSide('skeledirge', 'blaze', { item: 'throatspray' });
verify('탈 / 플레어송과 목스프레이', singer(), mimikyu(), 'torchsong', {},
  { hp: [114,114], post: { spa:2, atkItem:'', times:1 } });
verify('방음 / 플레어송과 목스프레이', singer(), makeSide('abomasnow','soundproof'), 'torchsong', {},
  { post: { spa:0, atkItem:'throatspray', times:0 } });
verify('탈 / 오버히트', makeSide('charizard','blaze'), mimikyu(), 'overheat', {},
  { hp: [114,114], post: { spa:-2, times:1 } });
verify('탈 / 탁쳐서떨구기', makeSide('weavile','pressure'), Object.assign(mimikyu(), {item:'leftovers'}), 'knockoff', {},
  { hp: [114,114], post: { defItem:'', times:1 } });
verify('탈 / 유턴', makeSide('scizor','technician'), mimikyu(), 'uturn', {},
  { hp: [114,114], ko:'연속 KO 불가', post:{times:1} });
verify('탈 / 부가효과', garchomp(), mimikyu(), 'bulldoze', {}, { post:{spe:-1} });
verify('탈 / 은밀망토', garchomp(), Object.assign(mimikyu(), {item:'covertcloak'}), 'bulldoze', {}, { post:{spe:0} });
verify('탈 / 약점보험', excadrill('sandrush'), Object.assign(mimikyu(), {item:'weaknesspolicy'}), 'ironhead', {},
  { post:{defAtk:0, defItem:'weaknesspolicy'} });
const absorber = makeSide('vaporeon','waterabsorb');
api.setSideCurrentHp(absorber,100);
verify('저수 / 여러 번 맞는 물수리검', makeSide('greninja','torrent'),absorber,'watershuriken',{},
  { hp:[151,151],post:{times:0} });
assert.equal(api.battleHp({...mimikyu(), hpPct: .001}), 1);
assert.equal(api.battleHp({...mimikyu(), hpPct: 0}), 0);
verify('틀깨기 화염방사 / 타오르는불꽃',makeSide('rampardos','moldbreaker'),
  makeSide('arcanine','flashfire'),'flamethrower',{}, { post:{flashFire:false,times:1} });
verify('위협으로 특성 교체 / 화염방사',garchomp(),makeSide('arcanine','intimidate'),'flamethrower',{},
  { post:{flashFire:false,times:1} });
verify('사이코필드 우선 차단 / 저수 회복 없음',makeSide('greninja','torrent'),absorber,'watershuriken',
  {terrain:'Psychic'}, {hp:[100,100],post:{times:0}});
const contactUser = makeSide('salamence', 'moxie');
api.setSideCurrentHp(contactUser, 1);
const helmet = mimikyu();
helmet.item = 'rockyhelmet';
const contact = api.advanceDamageMove(contactUser, helmet, api.MoveById.dualwingbeat, field());
assert.ok(contact.length && contact.every((p) => api.battleHp(p.a) === 0 && api.battleHp(p.d) === 114));
console.log('PASS bundled card, actual HP, contact interruption and party matchup regressions.');

const flag = process.argv.indexOf('--showdown');
if (flag < 0) checkStateReference(api);
if (flag >= 0) {
  assert.ok(process.argv[flag + 1], 'Pass a built Showdown checkout after --showdown.');
  const reference = path.resolve(process.argv[flag + 1]);
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'data/upstream.json')));
  assert.equal(
    execFileSync('git', ['-C', reference, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    lock.commit,
  );
  const { Battle } = createRequire(import.meta.url)(path.join(reference, 'dist/sim/battle.js'));
  const dexBattle = new Battle({ formatid: 'gen9championsou' });
  try {
    for (const m of Object.values(api.MoveById)) {
      const source = dexBattle.dex.moves.get(m.id);
      for (const [local, upstream] of [
        ['id', 'id'],
        ['cat', 'category'],
        ['type', 'type'],
        ['bp', 'basePower'],
        ['pri', 'priority'],
        ['tgt', 'target'],
      ]) {
        assert.equal(m[local], source[upstream], m.id + '/' + local);
      }
      assert.equal(m.pp, dexBattle.calculatePP(source, 3), m.id + '/PP');
      assert.equal(m.acc, source.accuracy === true ? 0 : source.accuracy, m.id + '/accuracy');
      assert.deepEqual({ ...m.flags }, { ...source.flags }, m.id + '/flags');
      assert.equal(!!m.multiaccuracy, !!source.multiaccuracy, m.id + '/multiaccuracy');
      assert.equal(JSON.stringify(m.mh ?? null), JSON.stringify(source.multihit ?? null), m.id + '/hits');
    }
  } finally {
    dexBattle.destroy();
  }
  function set(side, move) {
    const species = api.PokemonById[side.pokemonIdx];
    const base = species.mega ? api.PokemonById[api.toId(species.base)] : species;
    return {
      species: base.name,
      ability: species.mega ? base.ab['0'] : side.ability,
      item: side.item,
      moves: [move],
      evs: side.evs,
      nature: side.nature,
      level: 50,
    };
  }
  let battles = 0;
  for (const test of cases.filter((c) => c.reference)) {
    const hp = new Set();
    for (let roll = 85; roll <= 100; roll++) {
      const battle = new Battle({ formatid: 'gen9championsou', seed: [3, 4, 5, 6] });
      try {
        battle.setPlayer('p1', { name: 'Attacker', team: [set(test.a, test.moveId)] });
        battle.setPlayer('p2', { name: 'Defender', team: [set(test.d, 'protect')] });
        if (battle.requestState === 'teampreview') battle.makeChoices('team 1', 'team 1');
        const a = battle.p1.active[0],
          d = battle.p2.active[0];
        if (api.PokemonById[test.d.pokemonIdx].mega) assert.ok(battle.actions.runMegaEvo(d));
        assert.equal(d.ability, test.d.ability, test.name);
        if (test.d.disguiseBroken) d.formeChange('Mimikyu-Busted');
        a.timesAttacked = test.a.timesAttacked || 0;
        if (test.d.forcedGrounded) d.addVolatile('smackdown', a);
        if (test.f.defReflect) battle.p2.addSideCondition('reflect', d);
        if (test.f.terrain === 'Psychic') battle.field.setTerrain('psychicterrain',a);
        if (test.f.isGravity) battle.field.addPseudoWeather('gravity', a);
        d.hp = api.battleHp(test.d);
        const move = battle.dex.getActiveMove(test.moveId);
        move.accuracy = true;
        move.willCrit = false;
        battle.randomizer = (base) => Math.floor((base * roll) / 100);
        battle.actions.runMove(move, a, 1);
        hp.add(d.hp);
        if (test.post) {
          const actual = { spa: a.boosts.spa, atkItem: a.item, defItem: d.item,
            flashFire: !!d.volatiles.flashfire, times: d.timesAttacked, spe: d.boosts.spe, defAtk: d.boosts.atk };
          for (const [key, value] of Object.entries(test.post)) assert.equal(actual[key], value, test.name + '/PS/' + key);
        }
        battles++;
      } finally {
        battle.destroy();
      }
    }
    assert.deepEqual(
      [...hp].sort((a, b) => a - b),
      test.hp,
      test.name + ' / Showdown HP support',
    );
  }
  checkDamageMatrix(api, Battle);
  checkStateReference(api, Battle);
  console.log(
    `PASS ${battles} Showdown battles, ${Object.keys(api.MoveById).length} moves, revision ${lock.commit}.`,
  );
}
