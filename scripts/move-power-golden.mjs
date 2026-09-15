import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Regression cases for the separate offensive index and HP/KO policy.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1],m[2]]));
const elements = new Map();
function element(id = '') { return { id, textContent:data[id] || '', innerHTML:'', value:'', checked:false, dataset:{}, style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},querySelectorAll(){return [];},
  querySelector(){return null;},closest(){return null;},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null;} }; }
const document = {getElementById(id){if(!elements.has(id)) elements.set(id,element(id));return elements.get(id);},querySelectorAll(){return [];},querySelector(){return null;},createElement:element,addEventListener(){}};
const ctx = vm.createContext({console,assert,document,setTimeout,clearTimeout,window:{innerWidth:1280,addEventListener(){}},requestAnimationFrame(fn){fn();}});
const dir = path.join(root,'src/js');
vm.runInContext(fs.readdirSync(dir).filter(n=>n.endsWith('.js')&&!n.startsWith('05')&&!n.includes('theme')).sort().map(n=>readFileSync(path.join(dir,n),'utf8')).join('\n'),ctx);
vm.runInContext(`
function side(id) { assert(PokemonById[id]);const s=makeSideState(id);s.ability='';s.item='';return s; }
function index(a,d,id,f=makeFieldState()) {const m=typeof id==='string'?MoveById[id]:id;assert(m);return estimateMovePower(a,m,d,f).eff;}
function damage(a,d,id,f=makeFieldState()) {return calculatePowerDamage(a,d,MoveById[id],f);}
function label(r,d) {return hkoLabel(r.damages,r.defHP,d,makeFieldState(),r.koContext,r.hitProfile);}
function range(r) {return JSON.stringify([r.damages[0],r.damages.at(-1)]);}
`,ctx);
let passed=0;
function test(name,code) {
  try {vm.runInContext(`(()=>{autoEntryEffects=false;${code}})()`,ctx,{timeout:20000});passed++;console.log('[PASS] '+name);}
  catch(error){console.error('[FAIL] '+name+': '+error.stack);process.exitCode=1;}
}
test('Own Attack, ranks, status, ability, held item and critical all contribute', `
 const a=side('machamp'),d=side('snorlax');a.evs.atk=32;a.nature='adamant';
 assert.equal(index(a,d,'closecombat'),36000);a.ranks.atk=2;assert.equal(index(a,d,'closecombat'),72000);
 a.ranks.atk=0;a.status='Burn';assert.equal(index(a,d,'closecombat'),18000);
 a.ability='guts';assert.equal(index(a,d,'closecombat'),54000);a.status='none';a.ability='';a.item='blackbelt';assert.equal(index(a,d,'closecombat'),43200);
 a.item='';assert.equal(index(a,d,'closecombat',makeFieldState({isCritical:true})),54000);
 a.ranks.atk=-2;assert.equal(index(a,d,'closecombat',makeFieldState({isCritical:true})),54000);
`);
test('Opponent EVs, ranks, nature, item, HP, manual types and Unaware never change the index', `
 const a=side('machamp'),d=side('clefable');a.ranks.atk=2;const base=index(a,d,'closecombat');
 d.evs={hp:32,atk:0,def:32,spa:0,spd:0,spe:2};d.nature='bold';d.ranks.def=6;d.ranks.atk=6;d.item='leftovers';d.ability='unaware';d.types=['Ghost'];setSideHpPct(d,.2);
 assert.equal(index(a,d,'closecombat'),base);assert.equal(damage(a,d,'closecombat').damages[0],0);
`);
test('Water Bubble, Neutralizing Gas and Cloud Nine cannot suppress own index modifiers (controlled abilities)', `
 const a=side('charizard'),d=side('araquanid'),f=makeFieldState({weather:'Sun'});a.ability='solarpower';const base=index(a,d,'flamethrower',f);
 for(const ability of ['waterbubble','neutralizinggas','cloudnine']){d.ability=ability;assert.equal(index(a,d,'flamethrower',f),base);}
 d.ability='waterbubble';const reduced=damage(a,d,'flamethrower',f);d.ability='';assert(reduced.damages.at(-1)<damage(a,d,'flamethrower',f).damages.at(-1));
`);
test('Automatic opposing Intimidate is excluded; own automatic entry rank is retained (controlled self boost)', `
 state.atk=side('machamp');state.atk.moves=['closecombat'];state.def=side('gyarados');state.def.ability='intimidate';state.field=makeFieldState();autoEntryEffects=true;
 const base=index(state.atk,state.def,'closecombat');assert.equal(makeCalcState().atk.ranks.atk,-1);assert.equal(powerUiCalculateSlot(0).movePower.eff,base);
 state.atk.ability='intrepidsword';assert(ENTRY_EFFECTS.intrepidsword.selfBoost);const expected=applyBoost(calcStats(state.atk).atk,1)*120*1.5;assert.equal(index(state.atk,state.def,'closecombat'),expected);
`);
test('Own HP, weather, terrain, Helping Hand and spread modifiers remain active', `
 const a=side('typhlosion'),d=side('snorlax');const full=index(a,d,'eruption');setSideHpPct(a,.5);assert(index(a,d,'eruption')<full);
 const c=side('charizard'),base=index(c,d,'flamethrower');assert.equal(index(c,d,'flamethrower',makeFieldState({weather:'Sun'})),Math.round(base*1.5));
 assert.equal(index(c,d,'flamethrower',makeFieldState({atkHelpingHand:true})),Math.round(base*1.5));
 const p=side('pikachu');assert.equal(index(p,d,'thunderbolt',makeFieldState({terrain:'Electric'})),12285);
 const g=side('garchomp');assert.equal(index(g,d,'earthquake',makeFieldState({gameType:'Doubles'})),16875);
`);
test('Tinted Lens sees only base types and never treats 0x as resistance (controlled move type)', `
 const a=side('scizor'),d=side('snorlax');a.ability='tintedlens';const base=index(a,d,'bugbuzz');
 const resistant=side('charizard');assert.equal(index(a,resistant,'bugbuzz'),base*2);
 resistant.types=['Water'];resistant.ability='terashell';resistant.ranks.spd=6;assert.equal(index(a,resistant,'bugbuzz'),base*2);
 const ghost=side('gengar'),normal={...MoveById.bugbuzz,type:'Normal',manualType:true};a.ability='';const plain=index(a,ghost,normal);a.ability='tintedlens';assert.equal(index(a,ghost,normal),plain);
`);
test('Expert Belt uses base weakness solely to trigger its own multiplier', `
 const a=side('garchomp'),normal=side('snorlax'),weak=side('pikachu');assert(ItemById.expertbelt);a.item='expertbelt';
 assert.equal(index(a,normal,'earthquake'),22500);assert.equal(index(a,weak,'earthquake'),26999); // 22500 * 4915 / 4096, engine's fixed-point multiplier
 weak.types=['Flying'];weak.ability='levitate';assert.equal(index(a,weak,'earthquake'),26999);
`);
test('Target-dependent moves are unavailable; explicit own power/order inputs resolve only those dependencies', `
 const a=side('machamp'),d=side('snorlax');
 for(const id of ['foulplay','gyroball','electroball','grassknot','heavyslam','hardpress','hex','venoshock','knockoff','poltergeist','superfang','endeavor','fissure','payback']) if(MoveById[id]) assert.equal(index(a,d,id),'—',id);
 assert.equal(index(a,d,{...MoveById.knockoff,bp:65,manualBp:true}),calcStats(a).atk*65);
 a.moveOrder='second';assert.equal(index(a,d,'payback'),calcStats(a).atk*100);
 a.ability='analytic';a.moveOrder='auto';assert.equal(index(a,d,'closecombat'),'—');
 a.ability='merciless';assert.equal(index(a,d,'closecombat'),'—');assert.equal(typeof index(a,d,'closecombat',makeFieldState({isCritical:true})),'number');
`);
test('Fixed damage is numeric even against an immune target; received damage needs explicit input', `
 const a=side('machamp'),d=side('gengar');assert.equal(index(a,d,'seismictoss'),50);
 let r=damage(a,d,'seismictoss');assert.equal(range(r),'[0,0]');assert.equal(label(r,d).label,'무효');
 assert.equal(index(a,d,'counter'),'—');a.receivedDamage=51;a.receivedDamageCategory='Physical';assert.equal(index(a,d,'counter'),102);
 assert.equal(index(a,d,'finalgambit'),calcStats(a).hp);
 const parent=side('kangaskhanmega');parent.ability='parentalbond';assert.equal(index(parent,d,'seismictoss'),100);
`);
test('Multi-hit totals and variable power use own per-hit modifiers and configured hit counts', `
 const a=side('ninetalesalola'),d=side('snorlax');assert.equal(index(a,d,'tripleaxel'),15660);assert.equal(index(a,d,{...MoveById.tripleaxel,hitCount:2}),7830);
 const h=side('hydrapple');h.fickleBeamMode='normal';const normal=index(h,d,'ficklebeam');h.fickleBeamMode='auto';assert.equal(index(h,d,'ficklebeam'),Math.round(normal*1.3));
 const s=side('scizor');s.ability='technician';const plain=index(s,d,'dualwingbeat');d.ability='mummy';assert.equal(index(s,d,'dualwingbeat'),plain);
`);
test('Survival and blocking effects are badges while HP damage and KO keep their firepower meaning', `
 const a=side('machamp'),d=side('snorlax');a.evs.atk=32;a.nature='adamant';const plain=damage(a,d,'closecombat');d.item='focussash';const sash=damage(a,d,'closecombat');assert.equal(range(sash),range(plain));assert.equal(label(sash,d).turns,'1타');
 const s=side('scizor'),m=side('mimikyu');const bare=damage(s,m,'ironhead');m.ability='disguise';assert.equal(range(damage(s,m,'ironhead')),range(bare));
 assert.equal(powerUiResultNote('기합의띠: 생존 효과'),'기합의띠');assert.equal(powerUiResultNote('탈: 첫 공격 차단'),'탈');assert.equal(powerUiResultNote('먹다남은음식 회복 반영'),'먹다남은음식');
`);
test('Leftovers heals only between surviving move uses: 7 uses and 6 recoveries for HP235/damage50', `
 const a=side('machamp'),d=side('snorlax');assert.equal(calcStats(d).hp,235);assert.equal(label(damage(a,d,'seismictoss'),d).turns,'5타');d.item='leftovers';assert.equal(label(damage(a,d,'seismictoss'),d).turns,'7타');
 const model={maxHp:100,recovery:{residualRecovery:{kind:'endTurn',fraction:[1,16]}},variants:[{hits:1,weight:1}],outcomeCache:new Map(),hit(){return {damages:[38]};}};
 assert.equal(simulatePowerKo(model,100).guaranteedTurn,3);
 const lower={...model,outcomeCache:new Map(),koCache:new Map(),hit(){return {damages:[37]};}};assert.equal(simulatePowerKo(lower,100).guaranteedTurn,4);
`);
test('Aura Guard halves physical AND special contact damage, leaves noncontact and index untouched', `
 const a=side('garchomp'),d=side('lucariomegaz');assert(PokemonById.lucariomegaz.ab[0]==='Aura Guard');assert.equal(AbilityById.auraguard.koName,'파동의방호');
 for(const id of ['firepunch','drainingkiss']){assert(MoveById[id].flags.contact);d.ability='';const plain=damage(a,d,id),p=index(a,d,id);d.ability='auraguard';const guarded=damage(a,d,id);assert.equal(guarded.damages.at(-1),Math.floor(plain.damages.at(-1)/2));assert.equal(index(a,d,id),p);assert(guarded.mods.some(m=>m.startsWith('파동의방호')));}
 for(const id of ['earthquake','flamethrower','seismictoss']){d.ability='';const plain=damage(a,d,id);d.ability='auraguard';assert.equal(range(damage(a,d,id)),range(plain));}
`);
test('Aura Guard contact bypass and suppression work through the same final damage rules (controlled abilities)', `
 const a=side('garchomp'),d=side('lucariomegaz');
 for(const ability of ['longreach','moldbreaker','neutralizinggas']){a.ability=ability;d.ability='';const plain=damage(a,d,'firepunch');d.ability='auraguard';assert.equal(range(damage(a,d,'firepunch')),range(plain));}
 a.ability='';a.item='punchingglove';d.ability='';const plain=damage(a,d,'firepunch');d.ability='auraguard';assert.equal(range(damage(a,d,'firepunch')),range(plain));
`);
test('Actual result markup contains the numeric index, name-only badge and type immunity outcome', `
 state.atk=side('machamp');state.atk.moves=['seismictoss','closecombat'];state.def=side('gengar');state.field=makeFieldState();
 const markup=powerUiMoveMarkup(0,makeCalcState());assert(markup.includes('class="move-power-value">50<'));assert(markup.includes('>무효<'));assert(!markup.includes('고정 50'));assert(markup.includes('class="move-comparison"'));
 state.def=side('snorlax');state.def.item='focussash';const sash=powerUiMoveMarkup(1,makeCalcState());assert(sash.includes('>기합의띠<'));assert(!sash.includes('기합의띠 생존'));
 setMainPageLoadState(null,'loading');assert(document.getElementById('pageLoadStatus').hidden);setMainPageLoadState(null,'error','불러오기 실패');assert(!document.getElementById('pageLoadStatus').hidden);
`);
console.log(`Move power policy: ${passed} checks passed${process.exitCode ? ', failures above' : ''}.`);
