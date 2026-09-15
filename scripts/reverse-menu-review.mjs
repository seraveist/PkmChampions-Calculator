import { readSourceFileSync as readFileSync } from './source-utils.mjs';
// Read-only diagnostics for the reverse menu. Records current behavior, not desired-behavior tests.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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
const ctx = vm.createContext({ console, setTimeout, clearTimeout, document, window: { innerWidth: 1280, addEventListener() {} }, requestAnimationFrame(fn) { fn(); } });
const dir = path.join(root, 'src/js');
vm.runInContext(fs.readdirSync(dir).filter(n => n.endsWith('.js') && !n.startsWith('05') && !n.includes('theme')).sort().map(n => readFileSync(path.join(dir, n), 'utf8')).join('\n'), ctx);
const report = vm.runInContext(`(() => {
  const out = {};
  const initial = JSON.stringify(revCalcState);
  function setup(my, opp, move, item = '') {
    Object.assign(revCalcState, JSON.parse(initial));
    revCalcState.my = makeSideState(my);
    revCalcState.opp.pokemonIdx = opp;
    revCalcState.myMove = move;
    revCalcState.myMoveSet = [move, '', '', ''];
    revCalcState.oppItemKnown = item;
    return rcBuildOpponentState(PokemonById[opp], { item });
  }
  function range(r) { return r?.damages?.length ? [Math.min(...r.damages), Math.max(...r.damages)] : null; }
  function summarize(r) { return { error: r.error, total: r.total, groups: r.groupTotal, shown: r.results?.length }; }
  function knownDefMatches(target, move, pct) {
    const stat = rcMoveDefenseStat(move);
    const matches = rcBuildDefenseMatches(revCalcState.my, PokemonById[target.pokemonIdx], move, pct, makeFieldState(), stat, [target.nature], [{id: target.ability, impact: true}]).get(target.nature);
    return { candidates: matches.length, containsActual: matches.some(c => c.hpEv === target.evs.hp && c.defEv === target.evs[stat] && c.item === target.item) };
  }
  out.zeroDamageMatchers = { pct: rcMatchingRemainingPct(Array(16).fill(0), 100, 100), hp: rcMatchingRemainingHp(Array(16).fill(0), 100, 100) };
  {
    const d = setup('garchomp', 'rotomwash', 'earthquake');
    revCalcState.observedTheirPct = '100';
    out.immunity = { actualRange: range(calculateDamage(revCalcState.my, d, MoveById.earthquake, makeFieldState())), analysis: summarize(rcAnalyze()) };
  }
  {
    setup('scizor','charizard','bulletpunch');
    revCalcState.my.item='focussash';
    const m=MoveById.flamethrower, p=PokemonById.charizard;
    const a=rcBuildOpponentState(p,{nature:'modest',evs:{spa:32}});
    out.sashObservation={ myHp:calcStats(revCalcState.my).hp, rawRange:range(calculateDamage(a,revCalcState.my,m,makeFieldState())), matchingAtOneHp:rcBuildOffenseMatches(revCalcState.my,p,m,1,makeFieldState(),'spa',['modest'],[{id:a.ability,impact:false}]).get('modest').length };
  }
  {
    const d = setup('garchomp', 'scizor', 'earthquake');
    d.evs.hp = 32; d.evs.def = 20; d.nature = 'impish';
    const r = calculateDamage(revCalcState.my, d, MoveById.earthquake, makeFieldState());
    const hp = calcStats(d).hp, before = Math.floor(hp * .75), damage = r.damages[0];
    const fullPct = Math.floor((hp-damage)/hp*100), partialPct = Math.floor((before-damage)/hp*100);
    out.partialHp = { hp, before, damage, fullPct, partialPct, full: knownDefMatches(d, MoveById.earthquake, fullPct), partial: knownDefMatches(d, MoveById.earthquake, partialPct) };
  }
  {
    const d = setup('garchomp', 'snorlax', 'earthquake', 'sitrusberry');
    const hp = calcStats(d).hp;
    const r = calculateDamage(revCalcState.my, d, MoveById.earthquake, makeFieldState());
    const damage = r.damages.find(n => hp-n > 0 && hp-n <= hp/2);
    const rawRemaining = hp-damage, recovery = Math.floor(hp/4), pct = Math.floor((rawRemaining+recovery)/hp*100);
    out.sitrus = { hp, damage, rawRemaining, recovery, observedPct: pct, matches: knownDefMatches(d, MoveById.earthquake, pct) };
    d.item = 'leftovers'; revCalcState.oppItemKnown = 'leftovers';
    const smallDamage = r.damages[0], healedPct = Math.floor((hp-smallDamage+Math.floor(hp/16))/hp*100);
    out.leftovers = { hp, damage:smallDamage, recovery:Math.floor(hp/16), observedPct:healedPct, matches:knownDefMatches(d, MoveById.earthquake, healedPct) };
  }
  {
    setup('charizard', 'scizor', 'flamethrower', 'unknown');
    out.defaultItems = { selected: rcActiveItemCandidates(), offered: ['occaberry','sitrusberry','leftovers','focussash'].map(id=>({ id, offered:rcItemCandidateMasterList().some(i=>i.id===id) })) };
  }
  {
    const d = setup('hydrapple', 'snorlax', 'ficklebeam');
    const a = revCalcState.my, m = MoveById.ficklebeam, field=makeFieldState();
    const normal = calculateDamage(a,d,m,field);
    a.fickleBeamMode = 'boosted'; const boosted = calculateDamage(a,d,m,field); a.fickleBeamMode = 'auto';
    out.fickleBeam = { normal:range(normal), boosted:range(boosted), autoLegacy:range(calculateDamage(a,d,m,field)), autoPower:range(calculatePowerDamage(a,d,m,field)) };
  }
  {
    const d = setup('kangaskhanmega', 'dragonite', 'icepunch');
    d.ability = 'multiscale';
    out.parentalBond = { reverseRange:range(calculateDamage(revCalcState.my,d,MoveById.icepunch,makeFieldState())), powerRange:range(calculatePowerDamage(revCalcState.my,d,MoveById.icepunch,makeFieldState())) };
  }
  {
    out.specialInputs = ['counter','mirrorcoat','metalburst','comeuppance','spitup'].map(id=>{
      const learner=Object.values(PokemonById).find(p=>p.ls?.includes(id));
      if(!learner) return {id,learner:null};
      const d=setup(learner.id,'snorlax',id);
      revCalcState.observedTheirPct='50';
      return {id,learner:learner.id,range:range(calculateDamage(revCalcState.my,d,MoveById[id],makeFieldState())),analysis:summarize(rcAnalyze())};
    });
  }
  {
    const d=setup('garchomp','dragonite','dragonclaw');
    d.ability='multiscale';
    d.evs.hp=32; d.evs.def=20; d.nature='impish';
    const m=MoveById.dragonclaw, hp=calcStats(d).hp, first=calculateDamage(revCalcState.my,d,m,makeFieldState()).damages[0];
    revCalcState.observedTheirPct=String(Math.floor((hp-first)/hp*100));
    const candidate={nature:d.nature,item:'',ability:d.ability,defStat:'def',hpEv:32,defEv:20,atkEv:0,speEv:0};
    const follow=rcAnalyzeMyFollowupMove(candidate,'dragonclaw',false);
    setSideCurrentHp(d,hp-first);
    out.followupMultiscale={ hp, first, remaining:hp-first, menu:follow?.summary, updatedStateRange:range(calculateDamage(revCalcState.my,d,m,makeFieldState())) };
  }
  {
    const d=setup('garchomp','scizor','earthquake');
    revCalcState.oppMove='bulletpunch'; revCalcState.turnOrder='opp-first';
    out.speedOnly=summarize(rcAnalyze());
    revCalcState.oppMove='xscissor';
    out.speedOnlyEqualPriority=summarize(rcAnalyze());
  }
  {
    const d=setup('garchomp','scizor','earthquake');
    const move=MoveById.earthquake, hp=calcStats(d).hp;
    revCalcState.observedTheirPct=String(Math.floor((hp-calculateDamage(revCalcState.my,d,move,makeFieldState()).damages[0])/hp*100));
    const matches=rcBuildDefenseMatches(revCalcState.my,PokemonById.scizor,move,Number(revCalcState.observedTheirPct),makeFieldState(),'def',['impish'],[{id:'technician',impact:false}]).get('impish');
    const shaped=matches.map(c=>({...c,atkEv:0,speEv:0,totalScore:c.defScore,totalEv:c.hpEv+c.defEv,maxTotalEv:c.hpEv+c.defEv,speedInfo:{active:false}}));
    const grouped=rcGroupCandidates(shaped);
    const g=grouped.find(g=>g.hpEvMin<g.hpEvMax && g.defEvMin<g.defEvMax && !rcMatchingRemainingPct(calculateDamage(revCalcState.my,rcBuildOpponentState(PokemonById.scizor,{evs:{hp:g.hpEvMax,def:g.defEvMax},nature:g.nature,item:g.item,ability:g.ability}),move,makeFieldState()).damages,Number(revCalcState.observedTheirPct),calcStats(rcBuildOpponentState(PokemonById.scizor,{evs:{hp:g.hpEvMax},nature:g.nature})).hp));
    out.groupEnvelope=g ? { hpRange:[g.hpEvMin,g.hpEvMax],defRange:[g.defEvMin,g.defEvMax],groupCount:g.groupCount,maxHpMaxDefIsMember:false,phantomPairMatches:rcMatchingRemainingPct(calculateDamage(revCalcState.my,rcBuildOpponentState(PokemonById.scizor,{evs:{hp:g.hpEvMax,def:g.defEvMax},nature:g.nature,item:g.item,ability:g.ability}),move,makeFieldState()).damages,Number(revCalcState.observedTheirPct),calcStats(rcBuildOpponentState(PokemonById.scizor,{evs:{hp:g.hpEvMax},nature:g.nature})).hp) } : null;
  }
  {
    const d = setup('garchomp','scizor','earthquake');
    const hp=calcStats(d).hp, damage=calculateDamage(revCalcState.my,d,MoveById.earthquake,makeFieldState()).damages[0];
    revCalcState.observedTheirPct=String(Math.floor((hp-damage)/hp*100));
    const r=rcAnalyze(); revCalcState.results=r;
    const prior=revCalcState.observedTheirPct;
    const target={dataset:{rcAction:'observedTheirPct'},value:'0'};
    for(const handler of document.getElementById('page-revcalc').listeners.input||[]) handler({target,type:'input'});
    out.staleResults={ before:prior,after:revCalcState.observedTheirPct,retainedSameResult:revCalcState.results===r,analysis:summarize(r) };
  }
  out.singleExchange = {};
  for (const fixture of [
    {id:'ordinary',my:'garchomp',opp:'snorlax',myMove:'dragonclaw',oppMove:'crunch'},
    {id:'eruptionAfterHit',my:'garchomp',opp:'typhlosion',myMove:'dragonclaw',oppMove:'eruption'},
    {id:'avalancheAfterHit',my:'snorlax',opp:'swampert',myMove:'bodyslam',oppMove:'avalanche'},
    {id:'paybackMovesSecond',my:'garchomp',opp:'umbreon',myMove:'crunch',oppMove:'payback'},
  ]) {
    const d=setup(fixture.my,fixture.opp,fixture.myMove);
    const a=revCalcState.my, myMove=MoveById[fixture.myMove], oppMove=MoveById[fixture.oppMove];
    if(!myMove || !oppMove) { out.singleExchange[fixture.id]={unavailable:true}; continue; }
    revCalcState.oppMove=fixture.oppMove; revCalcState.turnOrder='my-first';
    const field=makeFieldState(), hp=calcStats(d).hp, myHp=calcStats(a).hp;
    const dealt=calculateDamage(a,d,myMove,{...field,atkMovesFirst:true}).damages[0];
    const legacy=calculateDamage(d,a,oppMove,rcObservedField('received'));
    setSideCurrentHp(d,hp-dealt); d.wasHit=true;
    const actual=calculateDamage(d,a,oppMove,{...field,atkMovesSecond:true});
    const received=actual.damages[0];
    revCalcState.observedTheirPct=String(Math.floor((hp-dealt)/hp*100));
    revCalcState.observedMyHp=String(myHp-received);
    const matches=rcBuildOffenseMatches(a,PokemonById[d.pokemonIdx],oppMove,myHp-received,rcObservedField('received'),rcMoveOffenseStat(oppMove),[d.nature],[{id:d.ability,impact:true}]).get(d.nature);
    const result=rcAnalyze();
    out.singleExchange[fixture.id]={my:fixture.my,opp:fixture.opp,myMove:fixture.myMove,oppMove:fixture.oppMove,learnable:[PokemonById[fixture.my].ls.includes(fixture.myMove),PokemonById[fixture.opp].ls.includes(fixture.oppMove)],hp,myHp,dealt,received,opponentRemaining:hp-dealt,myRemaining:myHp-received,legacyRange:range(legacy),afterHitRange:range(actual),containsActualOffense:matches.some(c=>c.atkEv===0 && c.item===''),analysis:summarize(result)};
  }
  {
    const d=setup('charizard','scizor','flamethrower','occaberry');
    d.evs.hp=32;d.evs.spd=20;d.nature='careful';
    const hp=calcStats(d).hp,m=MoveById.flamethrower,damage=calculateDamage(revCalcState.my,d,m,makeFieldState()).damages[0];
    revCalcState.observedTheirPct=String(Math.floor((hp-damage)/hp*100));
    const c={nature:d.nature,item:d.item,ability:d.ability,defStat:'spd',hpEv:32,defEv:20,atkEv:0,speEv:0};
    const next=rcAnalyzeMyFollowupMove(c,'flamethrower',false);
    d.item='';setSideCurrentHp(d,hp-damage);
    out.singleExchange.consumedOcca={hp,damage,remaining:hp-damage,menuNext:next.summary,consumedRange:range(calculateDamage(revCalcState.my,d,m,makeFieldState()))};
  }
  {
    const r=out.singleExchange;
    r.judgmentCategories={mixedForms:rcFinalizeDamageBounds({rawMin:40,rawMax:110,pctMin:40,pctMax:110,koChecks:32,koHits:16}),singleFormRandomRoll:rcFinalizeDamageBounds({rawMin:90,rawMax:110,pctMin:90,pctMax:110,koChecks:16,koHits:8})};
  }
  out.stateKeys=Object.keys(revCalcState);
  return out;
})()`, ctx, { timeout: 60000 });
fs.writeFileSync(path.join(root,'docs/reverse-menu-review-probes.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
