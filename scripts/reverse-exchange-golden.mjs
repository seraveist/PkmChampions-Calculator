// Regression checks for the one-exchange, HP-first inference contract.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1], m[2]]));
const elements = new Map();
function element(id = '') {
  return { id, textContent: data[id] || '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, listeners: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }, querySelectorAll() { return []; }, querySelector() { return null; },
    closest() { return null; }, appendChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; } };
}
const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
  querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return element(); }, addEventListener() {} };
const ctx = vm.createContext({ console, setTimeout, clearTimeout, document, window: { innerWidth: 1280, addEventListener() {} }, requestAnimationFrame(fn) { fn(); } });
const dir = path.join(root, 'src/js');
vm.runInContext(fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n'), ctx);

let passed=0;
function check(name,code){const start=Date.now();try{vm.runInContext('(()=>{'+code+'})()',ctx,{timeout:60000});passed++;console.log('[PASS] '+name+' ('+(Date.now()-start)+' ms)');}catch(e){console.error('[FAIL] '+name+': '+e.stack);process.exitCode=1;}}
vm.runInContext(`const initialReverse = JSON.stringify(revCalcState); function setupExchange(my,opp,myMove,oppMove,order='my-first',item=''){ Object.assign(revCalcState,JSON.parse(initialReverse));revCalcState.my=makeSideState(my); revCalcState.opp.pokemonIdx=opp;revCalcState.myMove=myMove;revCalcState.myMoveSet=[myMove,'','',''];revCalcState.oppMove=oppMove;revCalcState.oppItemKnown=item;revCalcState.turnOrder=order; } function requireCheck(c,message){if(!c)throw new Error(message);} `,ctx);
check('First-hit HP reaches the Eruption retaliation',`
 setupExchange('garchomp','typhlosion','dragonclaw','eruption');revCalcState.observedTheirPct='54';revCalcState.observedMyHp='154';const r=rcAnalyze();globalThis.eruptionResult=r;requireCheck(r.total>0,JSON.stringify(r));requireCheck(r.candidates.some(c=>c.nature==='hardy'&&c.hpEv===0&&c.defEv===0&&c.atkEv===0),'actual H0 C0 missing');console.log(JSON.stringify({total:r.total,groups:r.groupTotal}));
`);


check('H32 is an absolute priority before likelihood; defense below H32 is outside this assumption',`
const pairs=rcHpFirstSpreads('def',true);requireCheck(pairs[0].hp===32&&pairs[0].defense===0,'H32 B0 must be first');requireCheck(pairs.every(p=>p.hp===32||p.defense===0),'B below H32');requireCheck(rcCompareCandidates({defStat:'def',hpEv:32,defEv:0,totalScore:.01},{defStat:'def',hpEv:16,defEv:0,totalScore:1})<0,'H32 priority lost to score');requireCheck(rcCompareCandidates({defStat:'spd',hpEv:32,defEv:0,totalScore:.01},{defStat:'spd',hpEv:32,defEv:20,totalScore:1})<0,'unneeded D preferred');
`);
check('Observed Sitrus and Leftovers match their final HP and consumption',`
setupExchange('garchomp','snorlax','earthquake','', 'my-first','sitrusberry');revCalcState.observedTheirPct='74';const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.snorlax,{item:'sitrusberry'});const p=rcExchangePaths(a,d,MoveById.earthquake,null,'my-first',new Map());requireCheck(p.some(p=>rcHp(p.opp)===175&&p.opp.item===''),'Sitrus after HP missing');revCalcState.oppItemKnown='leftovers';revCalcState.observedTheirPct='63';d.item='leftovers';const l=rcExchangePaths(a,d,MoveById.earthquake,null,'my-first',new Map());requireCheck(l.some(p=>rcHp(p.opp)===149&&p.opp.item==='leftovers'),'Leftovers final HP missing');
`);
check('Hit timing does not add end-turn recovery',`
setupExchange('garchomp','snorlax','earthquake','', 'my-first','leftovers');revCalcState.observationTiming='hit';revCalcState.observedTheirPct='57';const d=rcBuildOpponentState(PokemonById.snorlax,{item:'leftovers'});requireCheck(rcExchangePaths(revCalcState.my,d,MoveById.earthquake,null,'my-first',new Map()).some(p=>rcHp(p.opp)===135),'unexpected extra recovery');
`);
check('Avalanche and Payback use the recorded hit and order',`
for(const f of [{my:'snorlax',opp:'swampert',m:'bodyslam',o:'avalanche',pct:'66',hp:'166'},{my:'garchomp',opp:'umbreon',m:'crunch',o:'payback',pct:'90',hp:'141'}]){setupExchange(f.my,f.opp,f.m,f.o);revCalcState.observedTheirPct=f.pct;revCalcState.observedMyHp=f.hp;const d=rcBuildOpponentState(PokemonById[f.opp]);const p=rcExchangePaths(revCalcState.my,d,MoveById[f.m],MoveById[f.o],'my-first',new Map());requireCheck(p.length>0,f.o+' lost observed path');}
`);
check('Independent multi-hit damage and Multiscale changes are preserved',`
setupExchange('kangaskhanmega','dragonite','icepunch','');const d=rcBuildOpponentState(PokemonById.dragonite,{ability:'multiscale'}),out=rcHitOutcomes(revCalcState.my,d,MoveById.icepunch,makeFieldState(),new Map());requireCheck(Math.abs(out.reduce((n,o)=>n+o.chance,0)-1)<1e-9,'probability mass');requireCheck(Math.max(...out.map(o=>o.damage))===130,'second hit kept Multiscale');requireCheck(out.length>16,'independent hit outcomes collapsed');
`);
check('Consumed Occa is absent from the next attack state',`
setupExchange('charizard','scizor','flamethrower','', 'my-first','occaberry');const d=rcBuildOpponentState(PokemonById.scizor,{evs:{hp:32,spd:20},nature:'careful',item:'occaberry'});revCalcState.observedTheirPct='42';const paths=rcExchangePaths(revCalcState.my,d,MoveById.flamethrower,null,'my-first',new Map());requireCheck(paths.length>0,'observed berry path missing');requireCheck(paths.every(p=>p.opp.item===''),'berry reused');
`);
check('Known immunities preserve unchanged-HP observations',`
setupExchange('garchomp','rotomwash','earthquake','');revCalcState.observedTheirPct='100';requireCheck(rcExchangePaths(revCalcState.my,rcBuildOpponentState(PokemonById.rotomwash),MoveById.earthquake,null,'my-first',new Map()).length>0,'zero damage discarded');
`);
check('Counter derives the last received hit and missing Stockpile gives an actionable error',`
setupExchange('garchomp','snorlax','dragonclaw','counter');const d=rcBuildOpponentState(PokemonById.snorlax);revCalcState.observedTheirPct='65';revCalcState.observedMyHp='21';requireCheck(rcExchangePaths(revCalcState.my,d,MoveById.dragonclaw,MoveById.counter,'my-first',new Map()).length>0,'Counter 81 x 2 failed');setupExchange('arbok','snorlax','spitup','');revCalcState.observedTheirPct='50';requireCheck(rcAnalyze().error.includes('비축'),'missing input masquerades as no candidates');
`);
check('Forecast uses consumed state and retains both speed outcomes',`
setupExchange('garchomp','snorlax','dragonclaw','crunch');const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.snorlax);revCalcState.observedTheirPct='65';revCalcState.observedMyHp='149';const paths=rcExchangePaths(a,d,MoveById.dragonclaw,MoveById.crunch,'my-first',new Map());const c={nature:'hardy',ability:d.ability,item:'',hpEv:0,defEv:0,defStat:'def',atkEv:0,atkStat:'atk',speEvMin:0,speEvMax:32,paths};const f=rcForecastDirect(c,'dragonclaw','my',false);requireCheck(!!f.summary&&f.summary.order==='내 선공','next move order absent');requireCheck(rcBattleOrder(a,rcSetHp({...a},rcHp(a)),MoveById.dragonclaw,MoveById.dragonclaw,makeFieldState()).length===2,'tie forced');
`);
check('Changes invalidate the previous observation snapshot',`
setupExchange('garchomp','snorlax','dragonclaw','crunch');revCalcState.results={inputKey:rcAnalysisCacheKey(),results:[]};revCalcState.observedTheirPct='0';requireCheck(rcInvalidateChangedObservation()&&revCalcState.results===null&&revCalcState.resultsStale,'stale result remained');
`);
check('Forecast covers every matching Eruption candidate',`
 setupExchange('garchomp','typhlosion','dragonclaw','eruption');const f=rcComputeExchangeForecast(eruptionResult, {allCandidates:true});requireCheck(f.my.length===1&&f.my[0].incoming?.summary,'forecast omitted');console.log(JSON.stringify({own:f.my[0].summary,incoming:f.my[0].incoming.summary}));
`);
check('H32 candidates and example completions obey the HP-first budget',`
 setupExchange('garchomp','typhlosion','dragonclaw','eruption');const r=eruptionResult;requireCheck(r.results[0].hpEv===32,'H32 lost first position');for(const c of r.candidates)requireCheck(c.hpEv===32||((c.defEv||0)===0),'split bulk entered main pool');for(const group of r.results){const sample=rcRoleCompletionInfo(group,r.speedActive);requireCheck(sample.evs.hp===32||(!sample.evs.def&&!sample.evs.spd),'completion introduced split bulk');requireCheck(Object.values(sample.evs).reduce((a,b)=>a+b,0)<=66,'over-budget example');requireCheck(group.members.length>0,'exact group members missing');}
`);
check('A known resist berry and ability constrain inference and the next KO',`
 setupExchange('charizard','scizor','flamethrower','','my-first','occaberry');revCalcState.oppAbilityKnown='technician';revCalcState.observedTheirPct='42';const r=rcAnalyze();requireCheck(r.total>0,'known-berry candidates missing');requireCheck(r.candidates.every(c=>c.ability==='technician'&&c.paths.every(p=>p.opp.item==='')),'known ability or spent berry lost');requireCheck(rcComputeExchangeForecast(r, {allCandidates:true}).my[0].summary.koState==='KO 확정','spent berry reduced the next attack again');
`);
check('End-turn HP includes sand, weather suppression, terrain and Leftovers once',`
 setupExchange('snorlax','altaria','tackle','');let a=revCalcState.my,d=rcBuildOpponentState(PokemonById.altaria,{ability:'naturalcure'});const max=calcStats(a).hp,half=Math.floor(max/2);a=rcSetHp({...a,item:'leftovers'},half);requireCheck(rcHp(rcEndOfExchange(a,d,{weather:'Sand',terrain:'none'}))===half,'sand and Leftovers did not offset');requireCheck(rcHp(rcEndOfExchange(a,{...d,ability:'cloudnine'},{weather:'Sand',terrain:'none'}))===half+Math.floor(max/16),'weather suppression ignored');requireCheck(rcHp(rcEndOfExchange(a,d,{weather:'none',terrain:'Grassy'}))===half+2*Math.floor(max/16),'terrain/Leftovers double-count');requireCheck(rcHp(rcEndOfExchange(rcSetHp(a,1),d,{weather:'Sand',terrain:'Grassy'}))===0,'residual damage faint revived');
`);
check('The preceding attack uses its own side of the screens',`
 setupExchange('garchomp','snorlax','counter','crunch');const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.snorlax),base=makeFieldState();const screened=rcForecastHit(a,d,MoveById.counter,MoveById.crunch,base,false,new Map(),{...base,defReflect:true});const plain=rcForecastHit(a,d,MoveById.counter,MoveById.crunch,base,false,new Map(),base);requireCheck(screened.length>0&&plain.length>0,'Counter follow-up missing');requireCheck(Math.max(...screened.map(x=>x.damage))<Math.max(...plain.map(x=>x.damage)),'preceding screen ignored');
`);
check('Fickle Beam retains ordinary and boosted observed outcomes',`
 setupExchange('hydrapple','snorlax','ficklebeam','');const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.snorlax);const normal=rcHitOutcomes({...a,fickleBeamMode:'normal'},d,MoveById.ficklebeam,makeFieldState(),new Map());const auto=rcHitOutcomes({...a,fickleBeamMode:'auto'},d,MoveById.ficklebeam,makeFieldState(),new Map());requireCheck(Math.max(...auto.map(x=>x.damage))>Math.max(...normal.map(x=>x.damage)),'boosted branch omitted');requireCheck(Math.abs(auto.reduce((n,x)=>n+x.chance,0)-1)<1e-9,'branch probabilities');
`);
check('An observation before residual healing advances once before the next turn',`
 setupExchange('garchomp','snorlax','earthquake','','my-first','leftovers');revCalcState.observationTiming='hit';revCalcState.observedTheirPct='57';const d=rcBuildOpponentState(PokemonById.snorlax,{item:'leftovers'});const p=rcExchangePaths(revCalcState.my,d,MoveById.earthquake,null,'my-first',new Map()).find(p=>rcHp(p.opp)===135);requireCheck(!!p,'pre-recovery path absent');requireCheck(rcHp(rcForecastStartState(p,'opp'))===149,'next turn lost residual recovery');revCalcState.observationTiming='end';p.opp=rcSetHp(p.opp,149);requireCheck(rcHp(rcForecastStartState(p,'opp'))===149,'end observation recovered twice');
`);
check('Untracked damage blocks are explicit and observed Weakness Policy changes final ranks',`
 setupExchange('garchomp','mimikyu','earthquake','playrough');revCalcState.observedTheirPct='87';revCalcState.observedMyHp='100';requireCheck(rcAnalyze().error.includes('차단 상태'),'Disguise treated as ordinary damage');
 setupExchange('garchomp','archaludon','earthquake','flashcannon','my-first','weaknesspolicy');
 const d=rcBuildOpponentState(PokemonById.archaludon,{evs:{hp:32},item:'weaknesspolicy'});
 const rows=rcAdvanceAttack(revCalcState.my,d,MoveById.earthquake,makeFieldState(),new Map());
 requireCheck(rows.some(p=>rcHp(p.d)>0&&p.d.ranks.atk===2&&p.d.ranks.spa===2&&p.d.item===''),'known item did not activate');
`);
check('Speed Boost is applied once after observation and reverses next-turn order', `
 setupExchange('garchomp','blaziken','dragonclaw','flamethrower');
 const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.blaziken,{ability:'speedboost'});
 requireCheck(rcBattleOrder(a,d,MoveById.dragonclaw,MoveById.flamethrower,makeFieldState())[0]==='my-first','fixture initial order');
 const p=rcExchangePaths(a,d,MoveById.dragonclaw,MoveById.flamethrower,'my-first',new Map())[0];
 requireCheck(p.opp.ranks.spe===1,'end-turn speed boost absent');
 requireCheck(rcEndOfExchange(p.opp,p.my,p.field,true).ranks.spe===1,'boost applied twice');
 const c={nature:'hardy',ability:'speedboost',item:'',hpEv:0,defEv:0,defStat:'def',atkEv:0,atkStat:'spa',speEvMin:0,speEvMax:0,paths:[p]};
 requireCheck(rcForecastDirect(c,'dragonclaw','my',false).summary.order==='상대 선공','next-turn order used old speed');
 requireCheck(rcNextStateSummary(c).opp.events.some(s=>s.includes('가속')),'state event absent');
`);
check('Stamina reaches the next card without changing the first observed hit', `
 setupExchange('garchomp','archaludon','dragonclaw','');const d=rcBuildOpponentState(PokemonById.archaludon,{ability:'stamina'});
 const plain=calculateDamage(revCalcState.my,d,MoveById.dragonclaw,makeFieldState()).damages;
 const rows=rcAdvanceAttack(revCalcState.my,d,MoveById.dragonclaw,makeFieldState(),new Map());
 requireCheck(rows.every(p=>p.d.ranks.def===1),'stamina missing');requireCheck(Math.min(...rows.map(p=>p.damage))===Math.min(...plain),'boost applied before observed damage');
 requireCheck(Math.max(...calculateDamage(revCalcState.my,rows[0].d,MoveById.dragonclaw,makeFieldState()).damages)<Math.max(...plain),'next defense unchanged');
`);
check('Cards retain uncapped damage even if either attacker would faint first', `
 setupExchange('garchomp','snorlax','earthquake','bodyslam');
 const a=rcSetHp(revCalcState.my,1),d=rcSetHp(rcBuildOpponentState(PokemonById.snorlax),1);
 const p={my:a,opp:d,field:makeFieldState(),order:'my-first'};
 const c={hpEv:0,defStat:'def',atkStat:'atk',speEvMin:0,speEvMax:0,paths:[p]};
 const own=rcForecastDirect(c,'earthquake','my',false),opp=rcForecastDirect(c,'bodyslam','opp',false);
 requireCheck(own.summary.rawMin>1&&opp.summary.rawMin>1,'damage clipped or replaced with zero');
 requireCheck(own.summary.koState==='KO 확정'&&opp.summary.koState==='KO 확정','landed move KO missing');
 requireCheck(rcRenderFollowupMoveChip(own).includes(own.summary.rawMin+'~'+own.summary.rawMax),'absolute damage missing');
`);
check('Known moves are a bounded comparison list, not extra observations', `
 setupExchange('garchomp','snorlax','earthquake','bodyslam');const before=rcAnalysisCacheKey();
 rcSetMovePickerValue('knownOppMove','crunch',0);rcSetMovePickerValue('knownOppMove','bodyslam',1);
 requireCheck(rcKnownOpponentMoves().join(',')==='bodyslam,crunch','known moves did not deduplicate');
 requireCheck(rcAnalysisCacheKey()===before,'additional known move changed observed damage');
 requireCheck(rcMovePoolForPicker('predictedOppMove').length===2,'unobserved moves offered as observed');
`);
check('Automatic unknown items include relevant offensive boosts', `
 setupExchange('garchomp','archaludon','earthquake','flashcannon','my-first','unknown');
 const ids=rcActiveItemCandidates();requireCheck(ids.includes('expertbelt')&&ids.includes('lifeorb'),'automatic special item coverage missing');
 requireCheck(!ids.includes('choiceband'),'irrelevant offensive axis included');
 revCalcState.oppItemKnown='leftovers';requireCheck(rcActiveItemCandidates().join(',')==='leftovers','observed item not fixed');
`);
check('HP approximation is explicit and does not change exact own HP', `
 setupExchange('garchomp','snorlax','earthquake','bodyslam');const d=rcSetHp(rcBuildOpponentState(PokemonById.snorlax),100);
 revCalcState.observedTheirPct=String(Math.floor(100/calcStats(d).hp*100)+1);requireCheck(!rcObservedHpMatches(d,'opp'),'exact matching broadened');
 revCalcState.hpTolerance=1;requireCheck(rcObservedHpMatches(d,'opp'),'nearby percentage omitted');
 revCalcState.observedMyHp=String(rcHp(revCalcState.my)-1);requireCheck(!rcObservedHpMatches(revCalcState.my,'my'),'own exact HP relaxed');
`);
check('New observation clears transient inputs and cancels stale work while keeping the build', `
 setupExchange('garchomp','snorlax','earthquake','bodyslam');revCalcState.my.evs.atk=32;revCalcState.my.nature='jolly';revCalcState.my.item='lifeorb';
 revCalcState.my.ranks.atk=2;revCalcState.my.tailwind=true;revCalcState.my.flashFireActive=true;revCalcState.observedMyHp='1';revCalcState.observedTheirPct='1';revCalcState.knownOppMoves=['crunch'];revCalcState.analyzing=true;revCalcState.results={total:1};
 const run=revCalcState.analysisRunId;rcNewObservation({render:false});
 requireCheck(revCalcState.my.evs.atk===32&&revCalcState.my.nature==='jolly'&&revCalcState.my.item==='lifeorb'&&revCalcState.myMoveSet[0]==='earthquake','build lost');
 requireCheck(!revCalcState.my.ranks.atk&&!revCalcState.my.tailwind&&!revCalcState.my.flashFireActive&&revCalcState.my.hpPct===1,'transient own state leaked');
 requireCheck(!revCalcState.results&&!revCalcState.analyzing&&revCalcState.analysisRunId>run&&revCalcState.observedMyHp===''&&revCalcState.opp.pokemonIdx===''&&rcKnownOpponentMoves().length===0,'old observation leaked');
`);
check('Observed self setup and recovery moves reach the final state', `
 setupExchange('garchomp','snorlax','swordsdance','bodyslam');
 const d=rcBuildOpponentState(PokemonById.snorlax);
 const p=rcExchangePaths(revCalcState.my,d,MoveById.swordsdance,MoveById.bodyslam,'my-first',new Map())[0];
 requireCheck(p.my.ranks.atk===2&&p.my.stateEvents.some(e=>e.includes('칼춤')),'observed self boost missing');
 setupExchange('garchomp','slowbro','dragonclaw','slackoff');const slow=rcSetHp(rcBuildOpponentState(PokemonById.slowbro),50);
 const rows=rcAdvanceAttack(slow,revCalcState.my,MoveById.slackoff,makeFieldState(),new Map());
 requireCheck(rcHp(rows[0].a)>50,'observed recovery not applied');
`);
check('Observed random move conditions are not reused as next-turn guarantees', `
 setupExchange('hydrapple','snorlax','ficklebeam','bodyslam');
 const a={...revCalcState.my,fickleBeamMode:'boosted'};
 requireCheck(rcNextObservedState(a,'my').fickleBeamMode==='auto'&&a.fickleBeamMode==='boosted','random observed boost leaked into next turn or mutated observation');
`);
check('Observed Balloon consumption and Double Shock type loss reach the next state', `
 setupExchange('pawmot','snorlax','doubleshock','earthquake','my-first','airballoon');
 const d=rcBuildOpponentState(PokemonById.snorlax,{evs:{hp:32},item:'airballoon'});
 const row=rcAdvanceAttack(revCalcState.my,d,MoveById.doubleshock,makeFieldState(),new Map())[0];
 requireCheck(row.d.item===''&&row.d.stateEvents.some(e=>e.includes('풍선')),'balloon remained');
 requireCheck(!row.a.types.includes('Electric')&&row.a.types.includes('Fighting'),'electric type retained');
 const plain=calculateDamage(d,revCalcState.my,MoveById.earthquake,makeFieldState()).damages;
 const changed=calculateDamage(d,row.a,MoveById.earthquake,makeFieldState()).damages;
 requireCheck(Math.max(...changed)<Math.max(...plain),'new defensive typing ignored');
 requireCheck(rcForecastDirect({paths:[]},'doubleshock','my',false).unavailable,'reused type-consuming move');
`);
check('Glaive Rush exposure applies to the later observed hit and clears on action', `
 setupExchange('baxcalibur','snorlax','glaiverush','bodyslam');const d=rcBuildOpponentState(PokemonById.snorlax,{evs:{hp:32}});
 const row=rcAdvanceAttack(revCalcState.my,d,MoveById.glaiverush,makeFieldState(),new Map())[0];
 requireCheck(row.a.glaiveRushExposed,'exposure absent');
 const normal=calculateDamage(d,revCalcState.my,MoveById.bodyslam,makeFieldState()).damages;
 const exposed=calculateDamage(d,row.a,MoveById.bodyslam,makeFieldState()).damages;
 requireCheck(exposed.every((v,i)=>v===normal[i]*2),'exposure multiplier absent');
 const cleared=rcAdvanceAttack(row.a,d,MoveById.icepunch,makeFieldState(),new Map())[0];requireCheck(!cleared.a.glaiveRushExposed,'exposure did not end on action');
`);
check('Projected Life Orb pruning preserves the exhaustive observed path distribution', `
 for (const order of ['my-first','opp-first']) {
   setupExchange('garchomp','typhlosion','dragonclaw','eruption',order,order==='my-first'?'lifeorb':'');
   if(order==='opp-first')revCalcState.my.item='lifeorb';
   const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.typhlosion,{evs:{hp:32,spa:16},item:revCalcState.oppItemKnown});
   const all=rcExchangePaths(a,d,MoveById.dragonclaw,MoveById.eruption,order,new Map(),false);
   const signature=paths=>paths.map(p=>[rcHp(p.my),rcHp(p.opp),p.chance].join('|')).sort().join(';');
   for(const index of [0,Math.floor(all.length/2),all.length-1]) {
     const sample=all[index];requireCheck(!!sample,'exhaustive fixture empty');
     revCalcState.observedMyHp=String(rcHp(sample.my));revCalcState.observedTheirPct=String(Math.floor(rcHp(sample.opp)/calcStats(sample.opp).hp*100));
     const expected=all.filter(p=>rcObservedHpMatches(p.my,'my')&&rcObservedHpMatches(p.opp,'opp'));
     const actual=rcExchangePaths(a,d,MoveById.dragonclaw,MoveById.eruption,order,new Map());
     requireCheck(signature(actual)===signature(expected),'pruning changed paths for '+order+' sample '+index);
   }
 }
`);
check('Exchange reuse preserves each build and does not accumulate probability weights', `
 setupExchange('garchomp','typhlosion','dragonclaw','eruption');
 const a=revCalcState.my,d=rcBuildOpponentState(PokemonById.typhlosion,{nature:'hardy'}),cache=new Map(),paths=new Map();
 const first=rcCachedExchangePaths(a,d,MoveById.dragonclaw,MoveById.eruption,'my-first',cache,paths);
 const weight=first.reduce((n,p)=>n+p.chance,0);rcCompactPaths(first);
 const other={...d,nature:'serious',evs:{...d.evs,atk:20,spe:8}};
 const reused=rcCachedExchangePaths(a,other,MoveById.dragonclaw,MoveById.eruption,'my-first',cache,paths);
 const fresh=rcExchangePaths(a,other,MoveById.dragonclaw,MoveById.eruption,'my-first',new Map());
 requireCheck(paths.size===1,'equivalent exchange not reused');
 requireCheck(reused.every(p=>p.opp.nature==='serious'&&p.opp.evs.atk===20&&p.opp.evs.spe===8),'cached build leaked');
 requireCheck(Math.abs(reused.reduce((n,p)=>n+p.chance,0)-weight)<1e-9&&fresh.length===reused.length,'probabilities changed during reuse');
 requireCheck(reused.every((p,i)=>rcHp(p.my)===rcHp(fresh[i].my)&&rcHp(p.opp)===rcHp(fresh[i].opp)),'cached HP differs');
`);
check('Forecast move badges reflect the effective weather type',`
 setupExchange('charizard','snorlax','weatherball','crunch');
 const c={nature:'hardy',hpEv:0,defStat:'spd',defEv:0,atkStat:'atk',atkEv:0,speEvMin:0,speEvMax:0,paths:[{my:revCalcState.my,opp:rcBuildOpponentState(PokemonById.snorlax),field:{...makeFieldState(),weather:'Rain'},order:'my-first'}]};
 const f=rcForecastDirect(c,'weatherball','my',false);
 requireCheck(f.summary.rawMin>0&&f.types.length===1&&f.types[0]==='Water','Weather Ball type did not follow rain');
 requireCheck(f.categories.length===1&&f.categories[0]==='Special','forecast category missing');
 const html=rcRenderFollowupMoveChip(f);requireCheck(html.includes('t-Water')&&!html.includes('t-Normal'),'card shows base type instead of effective type');
`);
console.log(passed+' exchange checks passed');
