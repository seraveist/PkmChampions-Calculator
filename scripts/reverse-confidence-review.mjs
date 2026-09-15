import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Read-only synthetic confidence review of the current inference module.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
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
const context = { console, setTimeout, clearTimeout, document, window: { innerWidth: 1280, addEventListener() {} }, requestAnimationFrame(fn) { fn(); } };
const dir = path.join(root, 'src/js');
const source=fs.readdirSync(dir).filter(n=>n.endsWith('.js')&&!n.startsWith('05')&&!n.includes('theme')).sort().map(n=>readFileSync(path.join(dir,n),'utf8')).join('\n');
const api=new Function(...Object.keys(context), source+'\nreturn {PokemonById,MoveById,ItemById,revCalcState,makeSideState,rcHp,rcSetHp,rcBuildOpponentState,rcAnalyze,rcComputeExchangeForecast,rcExchangePaths,rcBattleOrder,rcForecastHit,rcAnalysisField,rcGroupCandidates,rcDefaultItemCandidatesForOpponent,rcMoveDefenseStat,rcMoveOffenseStat,calcStats,rcRoleCompletionInfo};')(...Object.values(context));
const initial=JSON.stringify(api.revCalcState);

// Synthetic inversion study, not measured accuracy on real games or an independent engine oracle.
const fixtures = [
 {id:'multiscale', my:'garchomp', myNature:'adamant', myEvs:{hp:32,atk:16,def:16,spe:2}, myAbility:'sandveil', opp:'dragonite', nature:'adamant', evs:{hp:32,atk:32,spe:2}, ability:'multiscale', item:'', myMove:'dragonclaw', oppMove:'dragonclaw', next:['dragonclaw','earthquake']},
 {id:'leftovers-bulk', my:'garchomp', myNature:'adamant', myEvs:{hp:32,atk:32,spe:2}, myAbility:'sandveil', opp:'snorlax', nature:'impish', evs:{hp:32,def:20,atk:14}, ability:'thickfat', item:'leftovers', myMove:'earthquake', oppMove:'bodyslam', next:['earthquake','dragonclaw']},
 {id:'fast-eruption', my:'garchomp', myNature:'jolly', myEvs:{hp:2,atk:32,spe:32}, myAbility:'sandveil', opp:'typhlosion', nature:'timid', evs:{hp:2,spa:32,spe:32}, ability:'flashfire', item:'', myMove:'dragonclaw', oppMove:'eruption', next:['dragonclaw','earthquake']},
 {id:'consumed-berry', my:'charizard', myNature:'modest', myEvs:{hp:32,spa:32,spe:2}, myAbility:'blaze', opp:'scizor', nature:'careful', evs:{hp:32,spd:20,atk:14}, ability:'technician', item:'occaberry', myMove:'flamethrower', oppMove:'ironhead', next:['flamethrower','airslash']},
 {id:'fast-archaludon', my:'primarina', myNature:'bold', myEvs:{hp:32,def:16,spa:14,spe:4}, myAbility:'torrent', opp:'archaludon', nature:'modest', evs:{hp:2,spa:32,spe:32}, ability:'stamina', item:'', myMove:'moonblast', oppMove:'thunderbolt', next:['moonblast','hydropump']},
 {id:'outside-split-bulk', my:'garchomp', myNature:'adamant', myEvs:{hp:32,atk:32,spe:2}, myAbility:'sandveil', opp:'snorlax', nature:'impish', evs:{hp:16,def:16,atk:32,spe:2}, ability:'thickfat', item:'leftovers', myMove:'earthquake', oppMove:'bodyslam', next:['earthquake','dragonclaw']},
 {id:'hidden-expert-belt', my:'primarina', myNature:'bold', myEvs:{hp:32,def:16,spa:14,spe:4}, myAbility:'torrent', opp:'archaludon', nature:'modest', evs:{hp:32,spa:32,spe:2}, ability:'stamina', item:'expertbelt', unknownItem:true, myMove:'moonblast', oppMove:'thunderbolt', next:['moonblast','hydropump']},
];
const selectedId=process.argv.find(a=>a.startsWith('--fixture='))?.slice(10);
const selected=selectedId?fixtures.filter(f=>f.id===selectedId):fixtures;
const report={method:'Known synthetic builds; low/central/high joint damage observations; same forward and inverse engine; no metagame sampling or accuracy calibration.',fixtures:[],rows:[]};
const file=path.join(root,'docs/reverse-confidence-probes'+(selectedId?'-'+selectedId:'')+'.json');
function save(){fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
const pct=s=>Math.floor(api.rcHp(s)/api.calcStats(s).hp*100+1e-9);
function setup(f){
 Object.assign(api.revCalcState,JSON.parse(initial));
 const s=api.revCalcState;
 s.my={...api.makeSideState(f.my),nature:f.myNature,evs:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0,...f.myEvs},ability:f.myAbility};
 s.opp.pokemonIdx=f.opp;s.myMove=f.myMove;s.oppMove=f.oppMove;s.myMoveSet=[...f.next,'',''].slice(0,4);s.predictedOppMove=f.oppMove;
 s.oppItemKnown=f.unknownItem?'unknown':f.item;
 const opp=api.rcBuildOpponentState(api.PokemonById[f.opp],{nature:f.nature,evs:f.evs,ability:f.ability,item:f.item});
 const order=api.rcBattleOrder(s.my,opp,api.MoveById[f.myMove],api.MoveById[f.oppMove],api.rcAnalysisField())[0];s.turnOrder=order;
 return {s,opp,order};
}
function fixtureObservations(f){
 const {s,opp,order}=setup(f);
 for(const [id,moves] of [[f.my,[f.myMove,...f.next]],[f.opp,[f.oppMove]]])for(const move of moves)if(!api.PokemonById[id].ls.includes(move))throw new Error(id+' cannot learn '+move);
 const paths=api.rcExchangePaths(s.my,opp,api.MoveById[f.myMove],api.MoveById[f.oppMove],order,new Map(),false);
 const cells=new Map();
 for(const p of paths){if(!api.rcHp(p.my)||!api.rcHp(p.opp))continue;const their=pct(p.opp),my=api.rcHp(p.my),key=their+'|'+my;if(!cells.has(key))cells.set(key,{their,my,paths:[],chance:0});const c=cells.get(key);c.paths.push(p);c.chance+=p.chance;}
 const sorted=[...cells.values()].sort((a,b)=>(200-a.their-a.my/api.calcStats(s.my).hp*100)-(200-b.their-b.my/api.calcStats(s.my).hp*100));
 if(!sorted.length)throw new Error(f.id+': no completed surviving exchange');
 const mass=sorted.reduce((n,c)=>n+c.chance,0);let sum=0;const central=sorted.find(c=>(sum+=c.chance)>=mass/2);
 return {cells:sorted,samples:[['low-damage',sorted[0]],['central',central],['high-damage',sorted.at(-1)]],mass,order};
}
function matches(c,f){
 return c.nature===f.nature&&c.ability===f.ability&&c.item===f.item&&c.hpEv===(f.evs.hp||0)&&
 (!c.defStat||c.defEv===(f.evs[c.defStat]||0))&&(!c.atkStat||c.atkEv===(f.evs[c.atkStat]||0))&&
 (f.evs.spe||0)>=(c.speEvMin||0)&&(f.evs.spe||0)<=(c.speEvMax||0);
}
function topSummary(g){if(!g)return null;return {nature:g.nature,item:g.item,abilities:g.abilityIds,hp:[g.hpEvMin,g.hpEvMax],defStat:g.defStat,def:[g.defEvMin,g.defEvMax],atkStat:g.atkStat,atk:[g.atkEvMin,g.atkEvMax],spe:[g.speEvMin,g.speEvMax]};}
function actualNext(paths,myMoveId,oppMoveId){
 const own=[],incoming=[];
 for(const path of paths){
  const my={...path.my,wasHit:false,receivedDamage:null},opp={...path.opp,wasHit:false,receivedDamage:null};
  const move=api.MoveById[myMoveId],other=api.MoveById[oppMoveId],field={...path.field,isCritical:false};
  for(const order of api.rcBattleOrder(my,opp,move,other,field)){
   const first=order==='my-first';
   const out=api.rcForecastHit(my,opp,move,other,{...field,atkMovesFirst:first,atkMovesSecond:!first},first,new Map());
   const inc=api.rcForecastHit(opp,my,other,move,{...field,atkMovesFirst:!first,atkMovesSecond:first},!first,new Map());
   own.push(out.filter(x=>x.hp<=0).reduce((n,x)=>n+x.chance,0));incoming.push(inc.filter(x=>x.hp<=0).reduce((n,x)=>n+x.chance,0));
  }
 }
 const range=xs=>[Math.min(...xs),Math.max(...xs)];return {ko:range(own),death:range(incoming)};
}
function falseCertain(label,range){return label==='KO 확정'?range[0]<1-1e-9:label==='KO 불가'?range[1]>1e-9:false;}
function measure(f,label,cell,options={}){
 const {s}=setup(f);s.observedTheirPct=String(cell.their+(options.pctDelta||0));s.observedMyHp=String(cell.my);
 if(options.unknownItem){s.oppItemKnown='unknown';s.itemCandidates=[];}
 if(options.forceItem){s.oppItemKnown=options.forceItem;}
 if(options.dealtOnly){s.oppMove='';s.predictedOppMove='';s.observedMyHp='';s.turnOrder='unknown';}
 const start=Date.now(),r=api.rcAnalyze();
 const included=r.candidates?.some(c=>matches(c,f))||false;
 const top1=r.results?.[0]?.members?.some(c=>matches(c,f))||false;
 const top5=r.results?.some(g=>g.members?.some(c=>matches(c,f)))||false;
 const forecast=r.total&&!options.noForecast?api.rcComputeExchangeForecast(r, {allCandidates:true}):null;
 const actions=(forecast?.my||[]).map(row=>{const truth=actualNext(cell.paths,row.move.id,f.oppMove);const own=row.summary.koState,inc=row.incoming?.summary?.koState;return {move:row.move.id,own,death:row.incoming?.summary?.survival,order:row.summary.order,truth,unsupportedCertain:falseCertain(own,truth.ko)||falseCertain(inc,truth.death)};});
 const candidates=r.candidates||[];
 const range=key=>candidates.length?[Math.min(...candidates.map(c=>c[key]||0)),Math.max(...candidates.map(c=>c[key]||0))]:null;
 const row={fixture:f.id,label,options,observed:{theirPct:s.observedTheirPct,myHp:s.observedMyHp},order:s.turnOrder,assumedItems:s.oppItemKnown==='unknown'?api.rcDefaultItemCandidatesForOpponent():[s.oppItemKnown],error:r.error,total:r.total||0,groups:r.groupTotal||0,truthRetained:included,top1ContainsTruth:top1,top5ContainsTruth:top5,top:topSummary(r.results?.[0]),ranges:{hp:range('hpEv'),def:range('defEv'),atk:range('atkEv'),natures:new Set(candidates.map(c=>c.nature)).size},actions,ms:Date.now()-start};
 report.rows.push(row);save();console.log(JSON.stringify({fixture:f.id,label,total:row.total,groups:row.groups,truth:included,top1,top5,topNature:row.top?.nature,actions:row.actions.map(a=>[a.move,a.own,a.death,a.unsupportedCertain]),ms:row.ms}));
}
for(const f of selected){
 const observations=fixtureObservations(f);report.fixtures.push({...f,observationCells:observations.cells.length,survivingProbability:observations.mass,order:observations.order});
 for(const [label,cell] of observations.samples)measure(f,label,cell);
 const central=observations.samples[1][1];
 if(f.id==='fast-eruption'){
  measure(f,'central-item-unknown',central,{unknownItem:true});
  measure(f,'central-dealt-only',central,{dealtOnly:true,noForecast:true});
  measure(f,'central-minus-1pct',central,{pctDelta:-1});measure(f,'central-plus-1pct',central,{pctDelta:1});
 }
 if(f.id==='hidden-expert-belt')measure(f,'central-belt-confirmed',central,{forceItem:'expertbelt'});
}
report.summary={rows:report.rows.length,truthRetained:report.rows.filter(r=>r.truthRetained).length,top1ContainsTruth:report.rows.filter(r=>r.top1ContainsTruth).length,top5ContainsTruth:report.rows.filter(r=>r.top5ContainsTruth).length,empty:report.rows.filter(r=>!r.total).length,actions:report.rows.flatMap(r=>r.actions).length,falseCertainActions:report.rows.flatMap(r=>r.actions).filter(a=>a.unsupportedCertain).length};save();console.log(JSON.stringify(report.summary));
