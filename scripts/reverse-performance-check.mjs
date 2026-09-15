import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Compare exact candidate/path/card output against a pinned pre-optimization revision.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseline=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11) || '9bac1b3';
const inferenceNatures=['adamant','jolly','impish','careful','modest','timid','bold','calm','naive','brave'];
const html=readFileSync(path.join(root,'pokemon-champions-calculator-v3.html'),'utf8');
const data=Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m=>[m[1],m[2]]));
const el=id=>({textContent:data[id]||'',value:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;},closest(){return null;},appendChild(){},remove(){},setAttribute(){},getAttribute(){return null;}});
const document={getElementById:el,querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},createElement:el};
function api(ref){
 const files=ref?execFileSync('git',['ls-tree','-r','--name-only',ref,'src/js'],{cwd:root,encoding:'utf8'}).trim().split('\n'):fs.readdirSync(path.join(root,'src/js')).map(n=>'src/js/'+n);
 const source=files.filter(n=>n.endsWith('.js')&&!path.basename(n).startsWith('05')&&!n.includes('theme')).sort().map(n=>ref?execFileSync('git',['show',ref+':'+n],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}):readFileSync(path.join(root,n),'utf8')).join('\n');
 return new Function('document','window',source+(ref ? '\nRC_NATURE_IDS.splice(0,RC_NATURE_IDS.length,...'+JSON.stringify(inferenceNatures)+');' : '')+`\nconst initial=JSON.stringify(revCalcState);return {run(kind){
 Object.assign(revCalcState,JSON.parse(initial));
 revCalcState.my=makeSideState(kind==='eruption'?'garchomp':'kangaskhanmega');
 if(kind!=='eruption')Object.assign(revCalcState.my,{nature:'adamant',evs:{hp:32,atk:32,def:0,spa:0,spd:0,spe:2},ability:'parentalbond',item:'kangaskhanite'});
 revCalcState.opp={pokemonIdx:kind==='eruption'?'typhlosion':'azumarill',ranks:{atk:0,def:0,spa:0,spd:0,spe:0},status:'none'};
 Object.assign(revCalcState,{myMove:kind==='eruption'?'dragonclaw':'thunderpunch',myMoveSet:kind==='eruption'?['dragonclaw','earthquake','rockslide','firefang']:['thunderpunch','icepunch','earthquake','doubleedge'],oppMove:kind==='eruption'?'eruption':'playrough',predictedOppMove:kind==='eruption'?'eruption':'playrough',observedTheirPct:kind==='eruption'?'54':'28',observedMyHp:kind==='eruption'?'154':'109',turnOrder:'my-first',oppItemKnown:kind==='eruption'?'':kind==='orb'?'lifeorb':'unknown'});
 const start=performance.now(),r=rcAnalyze(),inferenceMs=performance.now()-start;
 const cardStart=performance.now();rcComputeExchangeForecast(r);return {r,inferenceMs,cardsMs:performance.now()-cardStart};
 }};`)(document,{innerWidth:1280,addEventListener(){}});
}
function summarize({r,inferenceMs,cardsMs}){
 const digest=createHash('sha256');
 const canonical=(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value;
 for(const c of r.candidates)digest.update(JSON.stringify(c,canonical));
 for(const g of r.results)digest.update(JSON.stringify(g,canonical));
 return {total:r.total,groups:r.groupTotal,hash:digest.digest('hex'),inferenceMs:Math.round(inferenceMs),cardsMs:Math.round(cardsMs)};
}
const report={baseline,inferenceNatures,cases:[]},old=api(baseline),current=api(null);
for(const fixture of ['eruption','orb','unknown']){
 const before=summarize(old.run(fixture));console.log('[BASELINE] '+fixture+' '+JSON.stringify(before));
 const after=summarize(current.run(fixture));
 const identical=before.hash===after.hash&&before.total===after.total&&before.groups===after.groups;
 report.cases.push({fixture,before,after,identical,speedup:Number((before.inferenceMs/Math.max(after.inferenceMs,1)).toFixed(2))});
 console.log((identical?'[PASS] ':'[FAIL] ')+fixture+' '+JSON.stringify(report.cases.at(-1)));
 if(!identical)process.exitCode=1;
}
fs.writeFileSync(path.join(root,'docs/reverse-ten-nature-performance.json'),JSON.stringify(report,null,2)+'\n');
