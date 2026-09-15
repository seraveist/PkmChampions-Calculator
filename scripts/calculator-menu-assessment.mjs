import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Read-only behavior probes for the calculator-menu assessment. No application edits.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html=readFileSync(path.join(root,'pokemon-champions-calculator-v3.html'),'utf8');
const data=Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m=>[m[1],m[2]]));
const elements=new Map();
function el(id='') { return {id,textContent:data[id]||'',innerHTML:'',value:'',checked:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;},closest(){return null;},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null;}}; }
const document={getElementById(id){if(!elements.has(id))elements.set(id,el(id));return elements.get(id);},querySelectorAll(){return [];},querySelector(){return null;},createElement(){return el();},addEventListener(){}};
const context=vm.createContext({console,setTimeout,clearTimeout,document,window:{innerWidth:1280,addEventListener(){}},requestAnimationFrame(fn){fn();}});
const dir=path.join(root,'src/js');
vm.runInContext(fs.readdirSync(dir).filter(n=>n.endsWith('.js')&&!n.startsWith('05')&&!n.includes('theme')).sort().map(n=>readFileSync(path.join(dir,n),'utf8')).join('\n'),context);
vm.runInContext(`
  function bounds(r){return r?[r.damages[0],r.damages.at(-1)]:null;}
  function power(a,d,id,f=makeFieldState()){if(!PokemonById[a.pokemonIdx]||!PokemonById[d.pokemonIdx]||!MoveById[id])throw new Error('Unavailable probe input');if(!PokemonById[a.pokemonIdx].ls?.includes(id))throw new Error('Move not in this species learnset');return calculatePowerDamage(a,d,MoveById[id],f);}
  function hko(r,d,f=makeFieldState()){const h=hkoLabel(r.damages,r.defHP,d,f,r.koContext,r.hitProfile);return {...h,metric:h.metric};}
`,context);
const results=[];
function probe(name,code){try{const result=vm.runInContext(`(()=>{${code}})()`,context,{timeout:20000});results.push({name,result});console.log(name,JSON.stringify(result));}catch(error){results.push({name,error:error.message});console.log(name,error.message);}}
probe('Available fixed-damage learners and conditions inventory',`
  return {fixed:MOVES.filter(m=>m.damage||m.fixedDamageKind||m.ohko).map(m=>({id:m.id,damage:m.damage,kind:m.fixedDamageKind,learners:POKEMON.filter(p=>p.ls?.includes(m.id)).map(p=>p.id).slice(0,4)})),variable:MOVES.filter(m=>m.variableBpKind).map(m=>({id:m.id,kind:m.variableBpKind})),countConditions:POKEMON.filter(p=>p.ls?.includes('lastrespects')||Object.values(p.ab).some(a=>toId(a)==='supremeoverlord')).map(p=>p.id)};
`);
probe('Fixed level damage in move-list power estimate',`
  const p=POKEMON.find(p=>p.ls?.includes('seismictoss')),a=makeSideState(p.id),d=makeSideState('snorlax');
  return {attacker:p.id,availableMove:MoveById.seismictoss,estimate:estimateMovePower(a,MoveById.seismictoss,d),damage:bounds(power(a,d,'seismictoss'))};
`);
probe('Beat Up Mega user species and base Attack',`
  const p=POKEMON.find(p=>p.mega&&p.ls?.includes('beatup'));if(!p)return {unavailable:true};
  const a=makeSideState(p.id),d=makeSideState('snorlax'),r=power(a,d,'beatup');
  return {pokemon:p,participant:beatUpParticipants(a,makeFieldState())[0],power:r.bp,hits:r.hitCounts,damage:bounds(r),estimate:estimateMovePower(a,MoveById.beatup,d)};
`);
probe('Knock Off plus Sitrus recovery order',`
  const a=makeSideState('machamp'),d=makeSideState('snorlax');d.ability='';d.item='sitrusberry';
  const r=power(a,d,'knockoff'),m=r.koContext.powerModel,hit=m.hit(r.defHP,false,0,0),out=resolvePowerMoveUse(m,r.defHP,false);
  return {maxHp:r.defHP,range:bounds(r),raw:hit.damages,outcomes:out,ko:hko(r,d)};
`);
probe('Displayed move base power versus applied power',`
  const a=makeSideState('typhlosion'),d=makeSideState('snorlax');setSideHpPct(a,.5);a.moves=['eruption'];
  const r=power(a,d,'eruption');return {hp:sideCurrentHp(calcStats(a).hp,a),displayedBp:manualBpForSlot(a,0,MoveById.eruption),appliedBp:r.bp,estimate:estimateMovePower(a,MoveById.eruption,d),mods:r.mods};
`);
probe('Fallen allies UI reachability',`
  return ['kingambit','basculegion'].filter(id=>PokemonById[id]).map(id=>{const s=makeSideState(id);if(id==='kingambit')s.ability='supremeoverlord';s.moves=PokemonById[id].ls.includes('lastrespects')?['lastrespects']:['kowtowcleave'];state.atk=s;state.def=makeSideState('snorlax');renderSide('atk');const ui=document.getElementById('atk-body').innerHTML;const values=[0,2].map(f=>{s.fallenAllies=f;const r=power(s,state.def,s.moves[0]);return {fallen:f,bp:r.bp,damage:bounds(r)};});return {id,ability:s.ability,moves:s.moves,containsFallenAllies:ui.includes('data-action="fallenAllies"'),values};});
`);
probe('Knock Off crossing Sitrus trigger at current HP 150',`
  const a=makeSideState('machamp'),d=makeSideState('snorlax');d.ability='';d.item='sitrusberry';setSideCurrentHp(d,150);
  const r=power(a,d,'knockoff'),m=r.koContext.powerModel;const hit=m.hit(150,false,0,0),after=resolvePowerMoveUse(m,150,false);
  // Counterfactual changes only recovery: Knock Off removes this berry before its Update event.
  const ref={...m,outcomeCache:new Map(),koCache:new Map(),hit(...args){const h=m.hit(...args);return {...h,koContext:{...h.koContext,defItem:''}};}};
  return {start:150,hp:r.defHP,raw:hit.damages,actualHpRange:[Math.min(...after.map(o=>o.hp)),Math.max(...after.map(o=>o.hp))],hpRangeIfRemovalPrecedesHealing:[150-hit.damages.at(-1),150-hit.damages[0]],ko:hko(r,d),koIfRemovalPrecedesHealing:simulatePowerKo(ref,150)};
`);
probe('Excluded direct multi-hit modifiers on later hits remain a distinct estimate',`
  const a=makeSideState('kangaskhanmega'),d=makeSideState('cofagrigus');if(!PokemonById[d.pokemonIdx])return {unavailable:true};
  a.ability='parentalbond';d.ability='mummy';const r=power(a,d,'icepunch');return {damage:bounds(r),estimate:estimateMovePower(a,MoveById.icepunch,d),modifiers:r.mods};
`);
probe('Power index with Parental Bond Power-Up Punch changes',`
  const a=makeSideState('kangaskhanmega'),d=makeSideState('snorlax');if(!PokemonById[a.pokemonIdx].ls.includes('poweruppunch'))return {unavailable:true};
  a.ability='parentalbond';const r=power(a,d,'poweruppunch'),m=r.koContext.powerModel;
  return {estimate:estimateMovePower(a,MoveById.poweruppunch,d),hits:[0,1].map(i=>{const h=m.hit(200,false,i,0);return {atk:h.atk,bp:h.bp,damage:bounds(h)}}),indexWithActualHitAttack:m.hit(200,false,0,0).atk*40+m.hit(200,false,1,0).atk*40*.25};
`);
probe('Manual power override visual discoverability',`
  state.atk=makeSideState('typhlosion');state.def=makeSideState('snorlax');state.atk.moves=['eruption'];state.atk.moveBpOverrides=[150];setSideHpPct(state.atk,.5);
  const m=calcMoveWithConditions(MoveById.eruption,state.atk,0),r=calculatePowerDamage(state.atk,state.def,m,makeFieldState());const list=renderMoveList('atk',state.atk);const card=renderMoveCard({...r,move:m,hko:hko(r,state.def),slot:1});
  return {appliedBp:r.bp,listShowsManual:/수동|직접|고정|override/.test(list),cardShowsManual:/수동|직접|고정|override/.test(card),mods:r.mods};
`);
probe('Mobile summary misses KO probability and immunity condition',`
  state.atk=makeSideState('pikachu');state.def=makeSideState('garchomp');state.atk.moves=['thunderbolt'];state.field=makeFieldState();runCalc();
  return {summary:document.getElementById('calcMobileSummary').innerHTML,cardHasImmunity:document.getElementById('calc-results-body').innerHTML.includes('무효'),summaryHasImmunity:document.getElementById('calcMobileSummary').innerHTML.includes('무효')};
`);
probe('Single-hit range and KO stability performance representative cases',`
  const pairs=[['garchomp','snorlax','earthquake'],['heracrossmega','snorlax','rockblast'],['ninetalesalola','snorlax','tripleaxel'],['kangaskhanmega','dragonite','icepunch']];
  return pairs.map(([aId,dId,m])=>{const a=makeSideState(aId),d=makeSideState(dId);if(dId==='dragonite')d.ability='multiscale';const start=Date.now();let r,h;for(let i=0;i<5;i++){r=power(a,d,m);h=hko(r,d);}return {aId,dId,m,averageMs:(Date.now()-start)/5,range:bounds(r),label:h.label,turns:h.turns};});
`);
fs.writeFileSync(path.join(root,'docs/calculator-menu-assessment-probes.json'),JSON.stringify(results,null,2)+'\n');
