import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
function element(id = '') {
  return { id, textContent: data[id] || '', innerHTML: '', value: '', checked: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
    closest() { return null; }, appendChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; } };
}
const elements = new Map();
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
  querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return element(); }, addEventListener() {} };
const ctx = vm.createContext({ console, assert, setTimeout, clearTimeout, document, window: { innerWidth: 1280, addEventListener() {} }, requestAnimationFrame(fn) { fn(); } });
const dir = path.join(root, 'src/js');
vm.runInContext(fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n'), ctx);
vm.runInContext(`
  function range(result) { return [result.damages[0], result.damages.at(-1)]; }
  function power(a, d, move, field = makeFieldState()) { assert(PokemonById[a.pokemonIdx] && PokemonById[d.pokemonIdx], 'test species must be available'); assert(typeof move !== 'string' || MoveById[move], 'test move must be available'); return calculatePowerDamage(a, d, typeof move === 'string' ? MoveById[move] : move, field); }
  function ko(result, defender, field = makeFieldState()) { return hkoLabel(result.damages, result.defHP, defender, field, result.koContext, result.hitProfile); }
  function equal(a, b) { assert.equal(JSON.stringify(a), JSON.stringify(b)); }
  function controlledModel(damages, recovery = {}, hits = 1) {
    return { maxHp: 100, recovery, variants: [{hits,weight:1}], outcomeCache: new Map(), hit() { return {damages}; } };
  }
`, ctx);
let passed = 0;
function test(name, code) {
  try { vm.runInContext(`(() => { ${code} })()`, ctx, { timeout: 20000 }); passed++; console.log(`[PASS] ${name}`); }
  catch (error) { process.exitCode = 1; console.error(`[FAIL] ${name}: ${error.stack}`); }
}

test('Unaware ignores both positive and negative offensive ranks', `
  const a=makeSideState('garchomp'),d=makeSideState('clefable');d.ability='unaware';
  const normal=range(power(a,d,'earthquake'));
  for (const rank of [-6,-2,2,6]) { a.ranks.atk=rank;equal(range(power(a,d,'earthquake')),normal); }
`);
test('Unaware ignores both positive and negative defensive ranks', `
  const a=makeSideState('clefable'),d=makeSideState('snorlax');a.ability='unaware';
  const normal=range(power(a,d,'moonblast'));
  for (const rank of [-6,-2,2,6]) { d.ranks.spd=rank;equal(range(power(a,d,'moonblast')),normal); }
`);
test('Burn applies after STAB and effectiveness: 100-118 becomes 50-59', `
  const a=makeSideState('garchomp'),d=makeSideState('snorlax'); equal(range(power(a,d,'earthquake')),[100,118]);
  a.status='Burn';equal(range(power(a,d,'earthquake')),[50,59]);
`);
test('Body Press uses Defense and generic Attack item modifiers (fixture, not available Choice Band)', `
  assert.equal(ItemById.choiceband,undefined);
  ItemById.testattackitem={id:'testattackitem',koName:'검증 도구',attackStatBoost:{stat:'atk',mod:'x1_5'}};
  try {
    const a=makeSideState('slowbro'),d=makeSideState('snorlax');a.item='testattackitem';
    assert.equal(power(a,d,'bodypress').atk,195);
    a.item='';const before=estimateMovePower(a,MoveById.bodypress,d);a.evs.def=32;
    assert.equal(before.eff,10400); assert.equal(estimateMovePower(a,MoveById.bodypress,d).eff,12960);
  } finally { delete ItemById.testattackitem; }
`);
test('Knock Off boosts through Sticky Hold, but matching Mega Stones are exempt', `
  const a=makeSideState('garchomp'),d=makeSideState('snorlax');d.item='leftovers';d.ability='stickyhold';
  assert.equal(power(a,d,'knockoff').bp,97);
  d.pokemonIdx='kangaskhan';d.item='kangaskhanite';assert.equal(power(a,d,'knockoff').bp,65);
  d.item='charizarditex';assert.equal(power(a,d,'knockoff').bp,97);
`);
test('Knock Off stops subsequent Leftovers recovery, while Sticky Hold preserves the item', `
  const a=makeSideState('garchomp'),d=makeSideState('snorlax');d.item='leftovers';d.ability='';
  const r=power(a,d,'knockoff'),m=r.koContext.powerModel;
  assert(m.removeItemOnHit);assert(resolvePowerMoveUse(m,r.defHP,false).every(o=>o.used));
  assert.equal(m.hit(100,true,0,0).bp,65);
  d.ability='stickyhold';assert.equal(power(a,d,'knockoff').koContext.powerModel.removeItemOnHit,false);
`);
test('HP 1 is representable; Eruption uses floor(153 * 50%) = 76, BP 74', `
  const a=makeSideState('typhlosion'),d=makeSideState('snorlax');setSideHpPct(a,.5);
  assert.equal(sideCurrentHp(calcStats(a).hp,a),76);assert.equal(power(a,d,'eruption').bp,74);
  setSideCurrentHp(d,1);assert.equal(sideCurrentHp(calcStats(d).hp,d),1);assert(!d.fullHP);
`);
test('Hard Press matches fixed-point source specification at all 235 integer HP values', `
  const a=makeSideState('garchomp'),d=makeSideState('snorlax'),max=calcStats(d).hp;assert.equal(max,235);
  for(let hp=1;hp<=max;hp++) {
    setSideCurrentHp(d,hp);
    const expected=Math.floor(Math.floor((10000*Math.floor(hp*4096/max)+2047)/4096)/100)||1;
    assert.equal(computeVariableBp(MoveById.hardpress,a,d,makeFieldState(),calcStats(a),calcStats(d)),expected);
  }
`);
test('Triple Axel uses 20/40/60 independently and supports selecting partial hits', `
  const a=makeSideState('ninetalesalola'),d=makeSideState('snorlax');
  equal(range(power(a,d,'tripleaxel')),[74,89]);
  const two=power(a,d,{...MoveById.tripleaxel,hitCount:2});equal(two.hitCounts,[2]);
  const expected=[20,40].map(bp=>power(a,d,{...MoveById.tripleaxel,bp,manualBp:true,mh:undefined}));
  equal(range(two),[expected.reduce((s,r)=>s+r.damages[0],0),expected.reduce((s,r)=>s+r.damages.at(-1),0)]);
`);
test('Beat Up uses each participant base Attack and format participant limit', `
  const a=makeSideState('charizard'),d=makeSideState('snorlax');a.beatUpParty=['dragonite','snorlax','pikachu'];
  const r=power(a,d,'beatup'),m=r.koContext.powerModel;equal(r.hitCounts,[3]);
  equal([0,1,2].map(i=>m.hit(235,false,i,0).bp),[13,18,16]);
  equal(power(a,d,'beatup',makeFieldState({gameType:'Doubles'})).hitCounts,[4]);
  a.beatUpParty=['dragonite','dragonite'];equal(power(a,d,'beatup').hitCounts,[2]);
`);
test('Skill Link, Loaded Dice and manual counts update the displayed hit count', `
  const a=makeSideState('heracrossmega'),d=makeSideState('snorlax');a.ability='skilllink';
  const r=power(a,d,'rockblast');equal(r.hitCounts,[5]);
  state.atk=a;state.def=d;
  const card=renderMoveCard({...r,move:MoveById.rockblast,slot:1,hko:ko(r,d)});assert(card.includes('5회 적중'));assert(!card.includes('2~5'));
  // Loaded Dice is not in the current item selector: exercise the metadata rule with a fixture.
  a.ability='';a.item='testdice';ItemById.testdice={id:'testdice',multiHitModifier:'loadedDice'};
  try { equal(power(a,d,'rockblast').hitCounts,[4,5]); } finally { delete ItemById.testdice; a.item=''; }
  equal(power(a,d,{...MoveById.rockblast,hitCount:3}).hitCounts,[3]);
`);
test('Parental Bond fixed damage remains two full fixed hits', `
  const a=makeSideState('kangaskhanmega'),d=makeSideState('snorlax');a.ability='parentalbond';
  equal(range(power(a,d,'seismictoss')),[100,100]);
`);
test('Displayed multihit endpoints and exact distribution agree after Multiscale and berry consumption', `
  const a=makeSideState('kangaskhanmega');a.ability='parentalbond';
  for (const [id,ability,item,move] of [['dragonite','multiscale','','icepunch'],['scizor','','occaberry','firepunch']]) {
    const d=makeSideState(id);d.ability=ability;d.item=item;const snapshot=JSON.stringify([a,d]);
    const r=power(a,d,move);const total=r.damageDistribution.reduce((s,v)=>s+v.chance,0);
    assert(Math.abs(total-1)<1e-10);equal(range(r),[r.damageDistribution[0].damage,r.damageDistribution.at(-1).damage]);
    const m=r.koContext.powerModel;const first=m.hit(r.defHP,false,0,0),second=m.hit(r.defHP-first.damages[0],!!item,1,0);
    assert(second.damages[0]>Math.floor(first.damages[0]/4));
    assert.equal(JSON.stringify([a,d]),snapshot);
    equal(simulateMoveKoDistribution(r.hitProfile,r.defHP,r.defHP).cumulative,ko(r,d).metric.cumulative);
  }
`);
test('Stamina and Weak Armor alter the subsequent hit, not the editable ranks', `
  const a=makeSideState('heracrossmega'),d=makeSideState('snorlax');a.ability='skilllink';
  d.ability='stamina';const stamina=power(a,d,'rockblast').koContext.powerModel;
  assert(stamina.hit(200,false,1,0).def>stamina.hit(235,false,0,0).def);
  d.ability='weakarmor';const weak=power(a,d,'rockblast').koContext.powerModel;
  assert(weak.hit(200,false,1,0).def<weak.hit(235,false,0,0).def);assert.equal(d.ranks.def,0);
`);
test('Independent rolls: 45/55 gives 75% at two uses; minimum 50 guarantees two', `
  const random=simulatePowerKo(controlledModel([45,55]),100);equal([random.possibleTurn,random.guaranteedTurn,random.cumulative[1]],[2,3,.75]);
  assert.equal(simulatePowerKo(controlledModel([50,55]),100).guaranteedTurn,2);
`);
test('Leftovers reduces 45/55 two-use chance to 25%, and 50 damage requires three', `
  const recovery={residualRecovery:{kind:'endTurn',fraction:[1,16]}};
  assert.equal(simulatePowerKo(controlledModel([45,55],recovery),100).cumulative[1],.25);
  assert.equal(simulatePowerKo(controlledModel([50],recovery),100).guaranteedTurn,3);
`);
test('Sitrus + Cheek Pouch: 100 -> 88 -> 18 -> KO; one-use KO never heals', `
  const recovery={hpRecovery:{trigger:'halfHp',fraction:[1,4]},cheekPouch:true};
  const m=controlledModel([70],recovery);assert.equal(resolvePowerMoveUse(m,100,false)[0].hp,88);
  assert.equal(simulatePowerKo(m,100).guaranteedTurn,3);
  equal(resolvePowerMoveUse(controlledModel([100],recovery),100,false).map(o=>[o.hp,o.used]),[[0,false]]);
`);
test('Recovery boundaries, rounding, cap, Ripen, Unnerve and Klutz', `
  const opts={hpRecovery:{trigger:'halfHp',fraction:[1,4]},cheekPouch:true};
  equal(recoverPowerHit(51,100,false,opts,49),{hp:51,used:false});equal(recoverPowerHit(50,100,false,opts,50),{hp:100,used:true,recoveryMask:3});
  equal(recoverPowerHit(10,101,false,opts,50),{hp:68,used:true,recoveryMask:3});equal(recoverPowerHit(10,100,true,opts,50),{hp:10,used:true});
  assert.equal(koRecoveryOptions({defItem:'sitrusberry',defAbility:'ripen'}).hpRecovery.multiplier,2);
  assert.equal(koRecoveryOptions({defItem:'sitrusberry',defAbility:'cheekpouch',atkAbility:'unnerve'}).hpRecovery,null);
  const a=makeSideState('garchomp'),d=makeSideState('dedenne');d.item='sitrusberry';d.ability='klutz';assert(!power(a,d,'bodyslam').koContext.powerModel.recovery.hpRecovery);
`);
test('Multihit recovery happens between hits; Leftovers only after the move', `
  const m=controlledModel([50],{hpRecovery:{trigger:'halfHp',fraction:[1,4]}},2);
  assert.equal(resolvePowerMoveUse(m,100,false)[0].hp,25);
  const l=controlledModel([50],{residualRecovery:{kind:'endTurn',fraction:[1,16]}},2);
  assert.equal(simulatePowerKo(l,100).guaranteedTurn,1);
`);
test('Overkill damage still consumes a resist berry once without healing after KO', `
  equal(recoverPowerHit(-10,100,false,{consumeResistBerry:true,cheekPouch:true},110),{hp:-10,used:true});
  const a=makeSideState('heracrossmega'),d=makeSideState('snorlax');a.ability='skilllink';d.item='chilanberry';setSideCurrentHp(d,1);
  const m={...MoveById.rockblast,type:'Normal',manualType:true};const r=power(a,d,m);
  const model=r.koContext.powerModel,first=model.hit(1,false,0,0),later=model.hit(0,true,1,0);
  assert(later.damages[0]>first.damages[0]);
`);
test('Stalled recovery is KO impossible, while >10-use search remains a limit', `
  assert(simulatePowerKo(controlledModel([6],{residualRecovery:{kind:'endTurn',fraction:[1,16]}}),100).impossible);
  const limited=simulatePowerKo(controlledModel([9]),100);assert.equal(limited.possibleTurn,null);assert(!limited.impossible);
`);
test('KO model cache respects starting HP and requested search depth', `
  const m=controlledModel([45]);assert.equal(simulatePowerKo(m,100).guaranteedTurn,3);assert.equal(simulatePowerKo(m,40).guaranteedTurn,1);
  assert.equal(simulatePowerKo(m,100,1).possibleTurn,null);
`);
test('Rain Swift Swim, Trick Room and explicit move order drive variable power', `
  const a=makeSideState('qwilfish'),d=makeSideState('garchomp');a.ability='swiftswim';
  const dry=makeFieldState(),rain=makeFieldState({weather:'Rain'});
  assert.equal(effectiveSpeed(a,rain,d),2*effectiveSpeed(a,dry,d));
  assert(powerMoveField(a,d,MoveById.payback,rain).atkMovesFirst);
  assert(powerMoveField(a,d,MoveById.payback,{...rain,trickRoom:true}).atkMovesSecond);
  a.moveOrder='second';assert(powerMoveField(a,d,MoveById.payback,rain).atkMovesSecond);
`);
test('Intimidate reactions are derived once without editing base ranks', `
  state.def=makeSideState('gyarados');state.def.ability='intimidate';state.field=makeFieldState();autoEntryEffects=true;
  for(const [ability,stat,value] of [['defiant','atk',1],['competitive','spa',2],['contrary','atk',1],['simple','atk',-2],['rattled','spe',1],['guarddog','atk',1]]) {
    state.atk=makeSideState('passimian');state.atk.ability=ability;assert.equal(makeCalcState().atk.ranks[stat],value);assert.equal(state.atk.ranks[stat],0);
  }
`);
test('Damp, priority blockers and Psychic Terrain annotate rather than zero power damage', `
  const a=makeSideState('garchomp'),d=makeSideState('snorlax');a.ability='';
  for(const ability of ['armortail','dazzling','queenlymajesty']) {
    d.ability=ability;const r=power(a,d,{...MoveById.bodyslam,pri:1});assert(r.damages[0]>0);assert(r.immunityNotes.some(n=>n.includes('선제')));
    a.ability='moldbreaker';assert(!power(a,d,{...MoveById.bodyslam,pri:1}).immunityNotes.some(n=>n.includes('선제')));a.ability='';
  }
  d.ability='damp';const damp=power(a,d,'explosion');assert(damp.damages[0]>0);assert(damp.immunityNotes.some(n=>n.includes('습기')));
  d.ability='';assert(power(a,d,{...MoveById.bodyslam,pri:1},makeFieldState({terrain:'Psychic'})).immunityNotes.some(n=>n.includes('사이코필드')));
`);
test('Doubles spread targets include grounded Expanding Force and can select one remaining target', `
  const a=makeSideState('alakazam'),d=makeSideState('snorlax');const f=makeFieldState({gameType:'Doubles',terrain:'Psychic'});
  assert(power(a,d,'expandingforce',f).mods.includes('광역×0.75'));
  assert(!power(a,d,'expandingforce',{...f,spreadTargets:'single'}).mods.includes('광역×0.75'));
`);
test('Recommendation prefers 99.6% over 12.1% random two-use KO despite lower minimum damage', `
  const d=makeSideState('snorlax');const rows=[[...Array(15).fill(49),51],[45,...Array(15).fill(55)]].map((damages,i)=>({slot:i+1,minPct:Math.min(...damages),maxPct:Math.max(...damages),hko:hkoLabel(damages,100,d,makeFieldState())}));
  assert.equal([...rows].sort(compareCalcMoveRecommendations)[0].slot,2);
`);
test('Relevant conditions and failed move reasons are retained in result cards', `
  state.atk=makeSideState('garchomp');state.def=makeSideState('snorlax');state.atk.moves=['payback','tripleaxel','stompingtantrum','beatup'];
  const ui=renderCalcMoveConditions('atk',state.atk);assert(ui.includes('moveOrder'));assert(ui.includes('hitCount'));assert(ui.includes('lastMoveFailed'));assert(ui.includes('beatUpMember'));
  state.def=makeSideState('gengar');state.def.ability='';state.atk.moves=['poltergeist'];runCalc();const card=document.getElementById('calc-results-body').innerHTML;assert(card.includes('폴터가이스트'));assert(card.includes('상대 도구 필요'));assert(!card.includes('기술 미설정'));
`);

test('Legal Machamp Knock Off removes Sitrus before healing: HP 150 -> 73-85 and guaranteed 3 uses', `
  const a=makeSideState('machamp'),d=makeSideState('snorlax');assert(PokemonById.machamp.ls.includes('knockoff'));
  d.ability='';d.item='sitrusberry';setSideCurrentHp(d,150);
  const r=power(a,d,'knockoff'),out=resolvePowerMoveUse(r.koContext.powerModel,150,false);
  equal(range(r),[65,77]);equal([Math.min(...out.map(o=>o.hp)),Math.max(...out.map(o=>o.hp))],[73,85]);
  const label=ko(r,d);assert.equal(label.label,'확정');assert.equal(label.turns,'3타');assert(!label.sub.includes('회복 반영'));assert(label.sub.includes('제거'));
`);
test('Sticky Hold retains the berry; Unnerve prevents its recovery (controlled ability fixture)', `
  const a=makeSideState('machamp'),d=makeSideState('snorlax');d.ability='stickyhold';d.item='sitrusberry';setSideCurrentHp(d,150);
  let r=power(a,d,'knockoff');assert(ko(r,d).sub.includes('자뭉열매 회복 반영'));
  assert(resolvePowerMoveUse(r.koContext.powerModel,150,false).every(o=>o.hp>=131&&o.hp<=143));
  a.ability='unnerve';r=power(a,d,'knockoff');assert(!ko(r,d).sub.includes('회복 반영'));
`);
test('Knock Off preserves damage-time resist berry and Cheek Pouch consumption (controlled type fixture)', `
  const m=controlledModel([30],{consumeResistBerry:true,cheekPouch:true});m.removeItemOnHit=true;
  const out=resolvePowerMoveUse(m,80,false);equal(out.map(o=>[o.hp,o.used]),[[83,true]]);assert(out[0].recoveryMask&2);
  equal(resolvePowerMoveUse(m,20,false).map(o=>[o.hp,o.used]),[[-10,true]]);
`);
test('Fixed damage index states actual damage including Parental Bond', `
  const a=makeSideState('machamp'),d=makeSideState('snorlax');assert.equal(estimateMovePower(a,MoveById.seismictoss,d).eff,50);
  assert.equal(estimateMovePower(a,MoveById.nightshade,d).eff,50);
  const parent=makeSideState('kangaskhanmega');parent.ability='parentalbond';assert.equal(estimateMovePower(parent,MoveById.seismictoss,d).eff,100);
`);
test('Mega Beat Up metadata uses base species Attack; Triple Axel reports per-hit power', `
  const p=POKEMON.find(p=>p.mega&&p.ls.includes('beatup'));assert(p);
  const a=makeSideState(p.id),d=makeSideState('snorlax'),r=power(a,d,'beatup');
  const expected=Math.floor(beatUpParticipants(a,makeFieldState())[0].bs.atk/10)+5;assert.equal(r.bp,expected);equal(r.appliedBasePowers,[[expected]]);
  a.ability='';const triple=power(a,d,'tripleaxel');equal(triple.appliedBasePowers,[[20],[40],[60]]);
  assert(calcAppliedPowerLabel({...triple,move:MoveById.tripleaxel}).includes('20 → 40 → 60'));
`);
test('Both sides expose fallen allies and Tailwind, clamp by format, and reset conditions', `
  state.atk=makeSideState('kingambit');state.atk.ability='supremeoverlord';state.atk.moves=['kowtowcleave'];
  state.def=makeSideState('basculegion');state.def.moves=['lastrespects'];state.field=makeFieldState();autoEntryEffects=false;
  for(const key of ['atk','def']){assert(renderCalcMoveConditions(key,state[key]).includes('data-action="fallenAllies"'));assert(renderCalcMoveConditions(key,state[key]).includes('tailwind'));state[key].fallenAllies=3;state[key].tailwind=true;}
  equal([makeCalcState().atk.fallenAllies,makeCalcState().def.fallenAllies],[2,2]);state.field.gameType='Doubles';equal([makeCalcState().atk.fallenAllies,makeCalcState().def.fallenAllies],[3,3]);
  const speed=effectiveSpeed(state.atk,state.field,state.def);state.atk.tailwind=false;assert.equal(speed,effectiveSpeed(state.atk,state.field,state.def)*2);
  state.def.moveBpOverrides=[70];resetSideManualValues('def');assert.equal(state.def.tailwind,false);assert.equal(state.def.fallenAllies,0);assert.equal(state.def.moveBpOverrides[0],null);
`);
test('Power editing explicitly switches modes even at base BP; empty input restores automatic BP', `
  state.atk=makeSideState('typhlosion');state.atk.moves=['eruption'];state.def=makeSideState('snorlax');state.field=makeFieldState();autoEntryEffects=false;setSideHpPct(state.atk,.5);
  const el={dataset:{side:'atk',slot:'0'},value:'150'};applyMoveBpInput(el);assert.equal(state.atk.moveBpOverrides[0],150);
  assert(document.getElementById('calc-results-body').innerHTML.includes('위력 150'));
  el.value='';applyMoveBpInput(el);assert.equal(state.atk.moveBpOverrides[0],null);assert(document.getElementById('calc-results-body').innerHTML.includes('위력 74'));
`);
test('Result cards show exact random KO chance, immunity and healing without the removed summary button', `
  state.atk=makeSideState('pikachu');state.atk.moves=['thunderbolt'];state.def=makeSideState('garchomp');state.def.item='sitrusberry';state.field=makeFieldState();autoEntryEffects=false;
  runCalc();const summary=document.getElementById('calc-results-body').innerHTML;assert(summary.includes('무효'));assert(!summary.includes('회복'));assert(summary.includes('>무효<'));assert.equal(document.getElementById('calcMobileSummary').innerHTML,'');
  const derived=makeCalcState(),r=power(derived.atk,derived.def,'thunderbolt',derived.field),label=ko(r,derived.def);
  state.def=makeSideState('snorlax');state.def.ability='';setSideCurrentHp(state.def,power(state.atk,state.def,'thunderbolt').damages[0]+1);runCalc();const random=ko(power(state.atk,state.def,'thunderbolt'),state.def);assert(random.pct);assert(document.getElementById('calc-results-body').innerHTML.includes(random.pct));
  state.field.weather='Rain';state.atk.tailwind=true;runCalc();assert(document.getElementById('calc-field-summary').textContent.includes('비'));assert(makeCalcState().atk.tailwind);
`);


test('Fickle Beam auto combines 70:30 branches: 49-115 damage and 24.375% OHKO at HP 100', `
 const a=makeSideState('hydrapple'),d=makeSideState('snorlax');assert(PokemonById.hydrapple.ls.includes('ficklebeam'));setSideCurrentHp(d,100);
 const auto=power(a,d,'ficklebeam');equal(range(auto),[49,115]);assert(Math.abs(ko(auto,d).metric.oneMoveKoChance-.24375)<1e-12);
 assert(Math.abs(auto.damageDistribution.reduce((s,v)=>s+v.chance,0)-1)<1e-12);
 a.fickleBeamMode='normal';const normal=power(a,d,'ficklebeam');equal(range(normal),[49,58]);assert.equal(ko(normal,d).turns,'2타');const normalIndex=estimateMovePower(a,MoveById.ficklebeam,d).eff;
 a.fickleBeamMode='boosted';equal(range(power(a,d,'ficklebeam')),[97,115]);a.fickleBeamMode='auto';assert.equal(estimateMovePower(a,MoveById.ficklebeam,d).eff,Math.round(normalIndex*1.3));
`);
test('Fickle Beam independently rerolls its branch across uses, including recovery', `
 const a=makeSideState('hydrapple'),d=makeSideState('snorlax');d.item='leftovers';const r=power(a,d,'ficklebeam'),m=r.koContext.powerModel;
 const start=120,heal=Math.floor(r.defHP/16);let reference=0;
 for(const first of resolvePowerMoveUse(m,start,false)) {if(first.hp<=0){reference+=first.chance;continue;}for(const second of resolvePowerMoveUse(m,Math.min(r.defHP,first.hp+heal),first.used))if(second.hp<=0)reference+=first.chance*second.chance;}
 assert(Math.abs(simulatePowerKo(m,start).cumulative[1]-reference)<1e-12);
`);
test('Counter family uses received HP damage, category gating, zero and integer rounding', `
 const d=makeSideState('snorlax');for(const [id,species,category,mult] of [['counter','charizard','Physical',2],['mirrorcoat','blastoise','Special',2],['metalburst','sableye','Physical',1.5],['comeuppance','houndoom','Special',1.5]]) {
  assert(PokemonById[species].ls.includes(id));const a=makeSideState(species);assert.equal(power(a,d,id),null);a.receivedDamage=51;a.receivedDamageCategory=category;
  equal(range(power(a,d,id)),[Math.floor(51*mult),Math.floor(51*mult)]);
  a.ranks.atk=6;a.ranks.spa=-6;d.ranks.def=6;d.ranks.spd=-6;equal(range(power(a,d,id)),[Math.floor(51*mult),Math.floor(51*mult)]);
  a.receivedDamage=0;equal(range(power(a,d,id)),[1,1]);
  if(id==='counter'||id==='mirrorcoat'){a.receivedDamageCategory=category==='Physical'?'Special':'Physical';assert.equal(power(a,d,{...MoveById[id],bp:100,manualBp:true}),null);}
 }
`);
test('Counter index stays numeric while HP damage respects type immunity and cannot accept manual BP', `
 state.atk=makeSideState('charizard');state.atk.moves=['counter'];state.def=makeSideState('gengar');state.field=makeFieldState();autoEntryEffects=false;state.atk.receivedDamage=50;state.atk.receivedDamageCategory='Physical';
 applyMoveBpInput({dataset:{side:'atk',slot:'0'},value:'100'});assert.equal(state.atk.moveBpOverrides[0],null);
 const r=power(state.atk,state.def,'counter');equal(range(r),[0,0]);assert.equal(ko(r,state.def).label,'무효');assert(r.immunityNotes.length);assert.equal(estimateMovePower(state.atk,MoveById.counter,state.def).eff,100);
 assert(document.getElementById('calc-results-body').innerHTML.includes('0 HP'));
`);
test('Fling derives item power and rejects missing, suppressed and matching Mega items', `
 const a=makeSideState('charizard'),d=makeSideState('snorlax');assert(PokemonById.charizard.ls.includes('fling'));
 assert.equal(power(a,d,'fling'),null);a.item='ironball';assert.equal(ItemById.ironball.flingBp,130);const r=power(a,d,'fling');assert.equal(r.bp,130);assert(r.damages[0]>0);
 a.ability='klutz';assert.equal(power(a,d,'fling'),null);a.ability='blaze';a.item='charizarditex';assert.equal(power(a,d,'fling'),null);
 a.item='sitrusberry';assert.equal(power(a,d,'fling').bp,10);
 a.pokemonIdx='kangaskhanmega';a.ability='parentalbond';a.item='ironball';equal(power(a,d,'fling').hitCounts,[1]);
`);
test('Thrown healing berries act before held HP berries and do not heal after KO', `
 const m=controlledModel([30],{hpRecovery:{trigger:'halfHp',fraction:[1,4]}});m.flungItem=ItemById.sitrusberry;m.defAbility='';
 const rows=resolvePowerMoveUse(m,75,false);equal(rows.map(o=>[o.hp,o.used]),[[70,false]]);assert(rows[0].recoveryMask&8);
 equal(resolvePowerMoveUse(m,20,false).map(o=>[o.hp,o.used]),[[-10,false]]);
 const pouch=controlledModel([30]);pouch.flungItem=ItemById.sitrusberry;pouch.defAbility='cheekpouch';equal(resolvePowerMoveUse(pouch,75,false).map(o=>o.hp),[100]);
 const ripen=controlledModel([30]);ripen.flungItem=ItemById.oranberry;ripen.defAbility='ripen';equal(resolvePowerMoveUse(ripen,75,false).map(o=>o.hp),[65]);
`);
test('Spit Up requires stockpile count and applies 100, 200, 300 BP without manual bypass', `
 const a=makeSideState('arbok'),d=makeSideState('snorlax');assert(PokemonById.arbok.ls.includes('spitup'));assert.equal(power(a,d,'spitup'),null);
 assert.equal(power(a,d,{...MoveById.spitup,manualBp:true,bp:200}),null);
 for(const count of [1,2,3]){a.stockpileCount=count;assert.equal(power(a,d,'spitup').bp,count*100);}a.stockpileCount=4;assert.equal(power(a,d,'spitup'),null);
`);
test('Special conditions render distinct modes, preserve invalid messages and reset both sides', `
 state.atk=makeSideState('hydrapple');state.atk.moves=['ficklebeam'];state.def=makeSideState('snorlax');state.field=makeFieldState();autoEntryEffects=false;setSideCurrentHp(state.def,100);
 runCalc();assert(document.getElementById('calc-results-body').innerHTML.includes('49–115 HP'));assert(document.getElementById('calc-results-body').innerHTML.includes('24.4%'));
 state.atk.fickleBeamMode='boosted';runCalc();assert(document.getElementById('calc-results-body').innerHTML.includes('97–115 HP'));assert(!document.getElementById('calc-results-body').innerHTML.includes('24.4%'));
 for(const side of ['atk','def']){state[side].receivedDamage=51;state[side].stockpileCount=3;state[side].fickleBeamMode='boosted';resetSideManualValues(side);assert.equal(state[side].receivedDamage,null);assert.equal(state[side].stockpileCount,0);assert.equal(state[side].fickleBeamMode,'auto');}
`);

console.log(`Calculator completion: ${passed} checks passed${process.exitCode ? ', failures above' : ''}.`);
