// The sample calculator conditions on a landed move, without an unselected reply.
// These counts are numbers of independent two-roll pairs, not rounded UI percentages.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/sample-ko.json',import.meta.url),'utf8'));
const weather = {Rain:'raindance',Sand:'sandstorm',Snow:'snowscape'};
const terrains = new Set(['Electric','Grassy','Misty','Psychic']);

function sides(api, c) {
  const a = api.makeSideState(c.attacker);
  const d = api.makeSideState(c.defender);
  assert.ok(api.PokemonById[c.attacker].ls.includes(c.move));
  a.ability = c.ability;
  d.ability = c.defAbility;
  a.item = c.aItem || '';
  d.item = c.item || '';
  a.moves = [c.move];
  d.moves = ['amnesia'];
  a.wasHit = !!c.attacked;
  d.wasHit = !!c.wasHit;
  a.noReserve = d.noReserve = true;
  if (c.st) d.status = {brn:'Burn',psn:'Poison'}[c.st];
  if (c.aStart) api.setSideCurrentHp(a,c.aStart);
  api.setSideCurrentHp(d,c.start);
  return {a,d};
}

function simulateUsePair(Battle, api, c, a, d, rolls) {
  const b = new Battle({formatid:'gen9championsou',seed:[1,2,3,4]});
  try {
    for (const [id,side] of [['p1',a],['p2',d]]) {
      const set = {species:side.pokemonIdx,ability:side.ability,item:side.item,moves:side.moves,
        nature:side.nature,evs:side.evs,level:50};
      b.setPlayer(id,{name:id,team:[set]});
    }
    if (b.requestState === 'teampreview') b.makeChoices('team 1','team 1');
    const user = b.p1.active[0], target = b.p2.active[0];
    user.hp = api.battleHp(a); target.hp = api.battleHp(d);
    if (c.st) target.setStatus(c.st);
    if (weather[c.field]) b.field.setWeather(weather[c.field],user);
    if (terrains.has(c.field)) b.field.setTerrain(c.field.toLowerCase()+'terrain',user);
    if (c.wasHit) target.hurtThisTurn = target.hp;
    if (c.attacked) {
      user.hurtThisTurn = user.hp;
      user.attackedBy.push({source:target,damage:1,thisTurn:true,move:'tackle',slot:target.getSlot()});
    }
    b.randomChance = (n,k) => n >= k;
    const execute = b.actions.runMove.bind(b.actions);
    b.actions.runMove = (id,source,...rest) => {
      if (source !== user) return;
      const move = b.dex.getActiveMove(id);
      move.accuracy = true;
      move.willCrit = !!move.willCrit;
      if (move.secondaries) move.secondaries = move.secondaries.filter(effect => (effect.chance ?? 100) === 100);
      return execute(move,source,...rest);
    };
    const ko = [];
    for (const roll of rolls) {
      if (!b.ended && user.hp && target.hp && b.requestState === 'move') {
        b.randomizer = value => Math.floor(value*roll/100);
        b.makeChoices('move 1','move 1');
      }
      ko.push(Number(target.hp===0));
    }
    return ko;
  } finally { b.destroy(); }
}

export function checkStateReference(api, Battle) {
  const seedTests = [
    ['Electric','electricseed',true],['Grassy','grassyseed',true],
    ['Misty','mistyseed',false],['Psychic','psychicseed',false],
  ];
  for (const [terrain,item,physical] of seedTests) {
    const a = api.makeSideState(physical?'garchomp':'jolteon'), d=api.makeSideState('snorlax');
    a.moves=[physical?'dragonclaw':'thunderbolt']; d.item=item;
    Object.assign(api.state,{atk:a,def:d,field:api.makeFieldState({terrain})});
    const slot=api.powerUiCalculateSlot(0);
    assert.deepEqual([slot.result.damages[0],slot.result.damages.at(-1)],physical?[54,64]:[34,42],item);
    assert.equal(slot.calc.def.item,'');assert.equal(d.item,item);
  }
  for (const id of ['meowsticmmega','meowsticfmega']) assert.equal(api.PokemonById[id].mega,true,id);
  for (const c of cases) {
    const {a,d} = sides(api,c);
    const field = api.makeFieldState({weather:weather[c.field] ? c.field : 'none',terrain:terrains.has(c.field) ? c.field : 'none'});
    Object.assign(api.state,{atk:a,def:d,field});
    const {ko} = api.powerUiCalculateSlot(0);
    const label = JSON.stringify(c);
    assert.ok(ko?.metric?.cumulative?.length,label);
    const cumulative = ko.metric.cumulative;
    const counts = [0,1].map(i => (cumulative[i] ?? cumulative.at(-1))*256);
    counts.forEach((value,i) => assert.ok(Math.abs(value-c.ko[i]) < 1e-9,label+' / '+value));
    if (Battle) {
      const expected = [0,0];
      for (let first=85;first<=100;first++) for (let second=85;second<=100;second++) {
        const result = simulateUsePair(Battle,api,c,a,d,[first,second]);
        expected[0] += result[0]; expected[1] += result[1];
      }
      assert.deepEqual(expected,c.ko,label);
    }
  }
  console.log('PASS '+cases.length+' sample KO conditions'+(Battle?' against 19,456 two-roll Showdown battles.':' against pinned integer counts.'));
}
