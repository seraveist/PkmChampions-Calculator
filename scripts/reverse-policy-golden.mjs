import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'pokemon-champions-calculator-v3.html'), 'utf8');
const data = Object.fromEntries([...html.matchAll(/<script id="(data-[^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)].map(m => [m[1],m[2]]));
function element(id='') { return {id,textContent:data[id]||'',innerHTML:'',value:'',checked:false,type:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return [];},querySelector(){return element();},closest(){return null;},appendChild(){},removeChild(){},remove(){},setAttribute(){},getAttribute(){return null;}}; }
const elements = new Map();
const document = {getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},querySelectorAll(){return [];},querySelector(){return element();},createElement(){return element();},addEventListener(){}};
const context=vm.createContext({console,setTimeout,clearTimeout,document,window:{innerWidth:1280}});
const dir=path.join(root,'src/js');
vm.runInContext(readdirSync(dir).filter(n=>n.endsWith('.js')&&!n.startsWith('05')&&!n.includes('theme')).sort().map(n=>readFileSync(path.join(dir,n),'utf8')).join('\n'),context);
function check(name,code){const result=vm.runInContext(`(()=>{${code}})()`,context);assert.equal(result,true,name);console.log('[PASS] '+name);}
check('reverse retains observed H16 B16 Bold candidate', `
  revCalcState.my=makeSideState('garchomp');revCalcState.opp.pokemonIdx='archaludon';revCalcState.oppItemKnown='';
  const p=PokemonById.archaludon;const m=MoveById.earthquake;const f=makeFieldState();
  const target=rcBuildOpponentState(p,{evs:{hp:16,def:16},nature:'bold',ability:'stamina'});
  const damage=calculateDamage(revCalcState.my,target,m,f);const hp=calcStats(target).hp;
  const pct=Math.floor((hp-damage.damages[0])/hp*100);
  const matches=rcBuildDefenseMatches(revCalcState.my,p,m,pct,f,'def',['bold'],[{id:'stamina',impact:false}]).get('bold');
  return matches.some(c=>c.hpEv===16&&c.defEv===16);
`);
check('reverse defense retains a known Occa Berry in the matching candidate', `
  revCalcState.my=makeSideState('charizard');revCalcState.opp.pokemonIdx='scizor';revCalcState.oppItemKnown='occaberry';
  const p=PokemonById.scizor;const m=MoveById.flamethrower;const f=makeFieldState();
  const target=rcBuildOpponentState(p,{evs:{hp:32,spd:20},nature:'careful',ability:'technician',item:'occaberry'});
  const damage=calculateDamage(revCalcState.my,target,m,f);const hp=calcStats(target).hp;
  const pct=Math.floor((hp-damage.damages[0])/hp*100);
  return rcBuildDefenseMatches(revCalcState.my,p,m,pct,f,'spd',['careful'],[{id:'technician',impact:false}]).get('careful').some(c=>c.hpEv===32&&c.defEv===20&&c.item==='occaberry');
`);
check('reverse searches exactly the ten requested battle natures', `
 const expected=['adamant','jolly','impish','careful','modest','timid','bold','calm','naive','brave'];
 return ['earthquake','flamethrower'].every(id=>JSON.stringify(rcNatureCandidatesForMove(MoveById[id]))===JSON.stringify(expected)) && NATURES.length===25;
`);
check('reverse speed uses Swift Swim rain, and keeps alternate speed abilities', `
  revCalcState.my=makeSideState('qwilfish');revCalcState.my.ability='swiftswim';revCalcState.field=makeFieldState({weather:'Rain'});revCalcState.turnOrder='opp-first';
  return rcMySpeedValue()===calcStats(revCalcState.my).spe*2 && rcOpponentAbilityCandidates(PokemonById.qwilfish).some(c=>c.id==='swiftswim');
`);
check('reverse accepts speed ties in either observed order and handles Trick Room', `
  revCalcState.my=makeSideState('garchomp');revCalcState.opp.pokemonIdx='garchomp';revCalcState.field=makeFieldState();
  revCalcState.myMove='earthquake';revCalcState.oppMove='earthquake';revCalcState.turnOrder='opp-first';
  const first=rcSpeedCandidateInfo(PokemonById.garchomp,'hardy','',revCalcState.field,'roughskin');
  revCalcState.turnOrder='my-first';const second=rcSpeedCandidateInfo(PokemonById.garchomp,'hardy','',revCalcState.field,'roughskin');
  revCalcState.turnOrder='opp-first';const trick=rcSpeedCandidateInfo(PokemonById.garchomp,'hardy','',{...revCalcState.field,trickRoom:true},'roughskin');
  return first.speMin===0&&second.speMin===0&&trick.speMax===0;
`);
check('priority-distorted observations do not remove speed candidates', `
  revCalcState.myMove='quickattack';return !rcSpeedCandidateInfo(PokemonById.garchomp,'hardy','').active;
`);
check('coverage removes unlearnable moves on species replacement', `
  matchupSetSlotPokemon(0,'charizard');matchupCoverageMoves[0][0]='flamethrower';matchupSetSlotPokemon(0,'vaporeon');
  return matchupCoverageMoves[0][0]===null&&coverageCountByType('Fire')===0;
`);
check('coverage follows Pixilate and Liquid Voice attack types', `
  matchupSetSlotPokemon(0,'sylveon',{abilityId:'pixilate'});matchupCoverageMoves[0][0]='hypervoice';
  const fairy=coverageCountByType('Fairy')===1&&coverageCountByType('Normal')===0;
  matchupSetSlotPokemon(0,'primarina',{abilityId:'liquidvoice'});matchupCoverageMoves[0][0]='hypervoice';
  return fairy&&coverageCountByType('Water')===1&&coverageCountByType('Normal')===0;
`);
check('Disguise state changes preserve user-entered HP', `
  const s=makeSideState('mimikyu');s.hpPct=0.75;setSideDamageBlockActive(s,true);setSideDamageBlockActive(s,false);return s.hpPct===0.75;
`);
