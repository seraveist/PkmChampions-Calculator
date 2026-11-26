import { prepareDamageSide, hitStateKey, actualHitOutcomes, advanceDamageMove, finishDamageTurn, battleHp, withBattleHp, applyHitRank, recordHitEvent } from './02-hit-state.js';
import { validMoveHitCount, AbilityById, MoveById, PokemonById, battleAbilityContext, calcMaxHp, calcStats, effectiveBattleItem, isGrounded, sideIsFullHp } from './01-core.js';
import { moveWithManualBp } from './03-10-calc-state.js';
import { effectiveSpeed } from './02-engine.js';
import { RC_NATURE_IDS, rcActiveItemCandidates, rcAnalysisField, rcObservedField, rcPokemonAbilityIds, rcSpeedCandidateInfo, revCalcState } from './04-40-revcalc-state.js';
import { rcCandidateCompletionInfo, rcGroupCandidates, rcMoveDefenseStat, rcMoveOffenseStat } from './04-41-revcalc-scoring.js';
import { rcAnalysisCacheKey, rcBuildOpponentState } from './04-42-revcalc-candidates.js';

const rcHp = battleHp, rcSetHp = withBattleHp, rcObservedBoost = applyHitRank, rcStateEvent = recordHitEvent;

/* One observed singles exchange. Pure transitions are shared with the next-action forecast. */

function rcMoveForObservation(role) {
  const id = role === 'my' ? revCalcState.myMove : revCalcState.oppMove;
  const move = MoveById[id];
  if (!move) return null;
  const options = revCalcState.observedMoveOptions?.[role] || {};
  const bp = role === 'my' ? revCalcState.myMoveBp : revCalcState.oppMoveBp;
  const adjusted = { ...moveWithManualBp(move, bp, options.moveType), observedAction:options.actionResult || 'auto',
    observedTargetMove:role === 'my' ? revCalcState.oppMove : revCalcState.myMove };
  const hits = validMoveHitCount(move, options.hitCount);
  return hits ? { ...adjusted, hitCount: hits } : adjusted;
}

function rcObservationSide(side, role) {
  return { ...side, ranks: { ...side.ranks }, stateEvents: [], observationEnded: false, ...(revCalcState.observedMoveOptions?.[role] || {}) };
}

function rcMovePriority(side, m, field) {
    if (!m) return 0;
    let p = m.pri || 0;
    if (side.ability === 'prankster' && m.cat === 'Status') p++;
    if (side.ability === 'galewings' && m.type === 'Flying' && sideIsFullHp(side)) p++;
    if (side.ability === 'triage' && (m.drain || m.flags?.heal)) p += 3;
    if (m.id === 'grassyglide' && field.terrain === 'Grassy' && isGrounded(side, field)) p++;
    return p;
}

function rcBattleOrder(a, d, move, opposingMove, field) {
  const diff = rcMovePriority(a, move, field) - rcMovePriority(d, opposingMove, field);
  if (diff) return diff > 0 ? ['my-first'] : ['opp-first'];
  const speed = effectiveSpeed(a, field, d) - effectiveSpeed(d, field, a);
  return !speed ? ['my-first', 'opp-first'] : [(field.trickRoom ? speed < 0 : speed > 0) ? 'my-first' : 'opp-first'];
}

function rcDamageCacheKey(a, d, move, field) {
  const as = calcStats(a), ds = calcStats(d);
  const speed = ['gyroBall', 'electroBall'].includes(move.variableBpKind);
  const aNumbers = move.id === 'shellsidearm' || AbilityById[a.ability]?.paradoxBoost ? as : [as.hp, as[rcMoveOffenseStat(move) || 'atk'], speed ? as.spe : 0];
  const dNumbers = move.id === 'shellsidearm' || AbilityById[d.ability]?.paradoxBoost ? ds : [ds.hp, ds[rcMoveDefenseStat(move) || 'def'], move.overrideOffensivePokemon ? ds.atk : 0, speed ? ds.spe : 0];
  return JSON.stringify([a.pokemonIdx, d.pokemonIdx, move.id, move.bp, move.manualBp, move.type, move.manualType, move.hitCount, move.observedAction, move.observedTargetMove, a.soundBlockTurns, !!a.flinched, !!a.ateBerry,
    aNumbers, dNumbers,
    a.hpPct, d.hpPct, a.ability, d.ability, a.item, d.item, a.ranks, d.ranks, a.status, d.status,
    move.variableBpKind === 'lastMoveFailedDouble' && !!a.lastMoveFailed,
    move.variableBpKind === 'userWasHitDouble' && a.wasHit, move.variableBpKind === 'targetWasHitDouble' && d.wasHit,
    move.fixedDamageKind === 'receivedDamage' ? [a.receivedDamage, a.receivedDamageCategory] : null, a.fickleBeamMode, a.stockpileCount,
    a.boosterEnergyState, a.flashFireActive, a.unburdenActive, a.slowStartActive, a.fallenAllies,
    d.boosterEnergyState, d.damageBlockActive, d.disguiseBroken, d.healBlock, a.hangry, a.tailwind, d.tailwind, a.paradoxActive, d.paradoxActive,
    a.timesAttacked, a.forcedGrounded, d.forcedGrounded, a.metronomeUses, a.types, d.types, !!a.glaiveRushExposed, !!d.glaiveRushExposed, a.tera, d.tera, a.teraType, d.teraType, field]);
}

function rcHitOutcomes(a, d, move, field, cache) {
  const key = cache && rcDamageCacheKey(a, d, move, field);
  if (cache?.has(key)) return cache.get(key);
  const outcomes = actualHitOutcomes(a, d, move, field);
  if (cache) cache.set(key, outcomes);
  return outcomes;
}

function rcFailsAgainstAction(a, d, move, field) {
  if (move?.id === 'focuspunch' && a.wasHit) return true;
  if (!['suckerpunch','thunderclap','upperhand'].includes(move?.id)) return false;
  const chosen = MoveById[move.observedTargetMove];
  if (field.atkMovesSecond) return true;
  if (!chosen) return false;
  return chosen.cat === 'Status' || (move.id === 'upperhand' && rcMovePriority(d,chosen,field) <= 0);
}

function rcAdvanceAttack(a, d, move, field, cache) {
  a = prepareDamageSide(a,d,field);
  d = prepareDamageSide(d,a,field);
  const action = move?.observedAction;
  const instantCharge = effectiveBattleItem(a) === 'powerherb' || (move?.id === 'electroshot' && ['Rain','Heavy Rain'].includes(field.weather)) ||
    (['solarbeam','solarblade'].includes(move?.id) && ['Sun','Harsh Sunshine'].includes(field.weather));
  const preparing = move?.flags?.charge && !instantCharge || ['futuresight','doomdesire'].includes(move?.id);
  const skipped = !move || !battleHp(a) || !battleHp(d) || ['skipped','switched'].includes(action) || a.flinched || (a.soundBlockTurns && move.flags?.sound)
    || rcFailsAgainstAction(a,d,move,field);
  if (skipped || action === 'charging' || (preparing && action !== 'landed')) {
    const next = {...a,ranks:{...a.ranks}};
    if (!skipped && ['meteorbeam','electroshot'].includes(move.id)) applyHitRank(next,'spa',1,'충전');
    return [{a:next,d,field,chance:1,damage:0,landed:false}];
  }
  return advanceDamageMove(a, d, move, field, (a, d, move, field) => rcHitOutcomes(a, d, move, field, cache));
}

function rcEndOfExchange(side, opposingSide, field, forceEnd = false) {
  if (side.observationEnded || rcHp(side) <= 0 || (!forceEnd && revCalcState.observationTiming === 'hit')) return side;
  return { ...finishDamageTurn(side, opposingSide, field), observationEnded: true };
}

function rcObservedHpMatches(side, role) {
  const raw = role === 'my' ? revCalcState.observedMyHp : revCalcState.observedTheirPct;
  if (raw === '' || raw == null) return true;
  const hp = rcHp(side);
  return role === 'my' ? hp === Number(raw) : Math.abs(Math.floor(hp / calcMaxHp(side) * 100 + 1e-9) - Number(raw)) <= (revCalcState.hpTolerance || 0);
}

function rcActionChangesOwnHp(move, side, target, projectLifeOrb = false) {
  return move?.observedAction === 'switched' || side.item === 'shellbell' || ['aftermath','innardsout','spicyspray','pickpocket','mummy','wanderingspirit'].includes(target.ability) ||
      ['supercellslam','highjumpkick','jumpkick','axekick'].includes(move?.id) || ['steelbeam','chloroblast','finalgambit'].includes(move?.id) || move?.recoil || move?.drain || move?.statusHeal || move?.selfdestruct || (!projectLifeOrb && side.item === 'lifeorb') ||
    (move?.flags?.contact && (['roughskin', 'ironbarbs'].includes(target.ability) || target.item === 'rockyhelmet'));
}

function rcProjectedEndHpMatches(side, other, field, followingMove, role) {
    const hpStates = [side];
    const { atkAb } = battleAbilityContext(side, other);
    // Conservatively include both a successful hit and no Orb recoil. This prefilter
    // only removes impossible HP spreads; the full exchange still verifies each path.
    if (followingMove && followingMove.cat !== 'Status' && rcHp(side) > 0 && effectiveBattleItem(side, atkAb) === 'lifeorb' && atkAb !== 'magicguard' && !(atkAb === 'sheerforce' && followingMove.sec)) {
      hpStates.push(rcSetHp(side, rcHp(side) - Math.max(1, Math.floor(calcMaxHp(side) / 10))));
    }
    return hpStates.some(s => rcObservedHpMatches(rcEndOfExchange(s, other, field), role));
}

function rcFirstHitCanMatch(a, d, move, field, role, cache, followingMove = null) {
  const key = `observed:${role}:${followingMove?.id || ''}:${followingMove?.observedAction || ''}:${rcDamageCacheKey(a, d, move, field)}`;
  if (cache.has(key)) return cache.get(key);
  const match = rcAdvanceAttack(a, d, move, field, cache).some(row => rcProjectedEndHpMatches(row.d, row.a, row.field, followingMove, role));
  cache.set(key, match);
  return match;
}

function rcExchangePaths(my, opp, myMove, oppMove, order, cache, prune = true) {
  const myFirst = order === 'my-first';
  if (myMove && !myMove.observedTargetMove) myMove = {...myMove,observedTargetMove:oppMove?.id};
  if (oppMove && !oppMove.observedTargetMove) oppMove = {...oppMove,observedTargetMove:myMove?.id};
  const firstMove = myFirst ? myMove : oppMove, secondMove = myFirst ? oppMove : myMove;
  const firstField = { ...rcObservedField(myFirst ? 'dealt' : 'received'), atkMovesFirst: true, atkMovesSecond: false };
  const paths = [];
  if (firstMove?.observedAction === 'switched') return paths;
  for (const first of rcAdvanceAttack(myFirst ? my : opp, myFirst ? opp : my, firstMove, firstField, cache)) {
    // Safe pruning only when the second action cannot change its user's own HP/item.
    if (secondMove?.observedAction === 'switched') {
      const myEnd = myFirst ? first.a : first.d, oppEnd = myFirst ? first.d : first.a;
      if (!prune || (rcObservedHpMatches(myEnd,'my') && rcObservedHpMatches(oppEnd,'opp')))
        paths.push({my:{...myEnd,observationEnded:true},opp:{...oppEnd,observationEnded:true},field:first.field,chance:first.chance,order,encounterEnded:true});
      continue;
    }
    const targetRole = myFirst ? 'opp' : 'my';
    const selfChanges = rcActionChangesOwnHp(secondMove, first.d, first.a, true) || ['sandspit', 'seedsower'].includes(first.a.ability);
    if (prune && !selfChanges && !rcProjectedEndHpMatches(first.d, first.a, first.field, secondMove, targetRole)) continue;
    const secondField = { ...first.field, ...revCalcState.observedFields?.[myFirst ? 'received' : 'dealt'], atkMovesFirst: false, atkMovesSecond: true };
    // Reuse the final receiver-HP feasibility result before materializing both sides
    // for every second-hit roll. The full exchange still verifies all accepted paths.
    if (prune && secondMove && cache && !rcFirstHitCanMatch(first.d, first.a, secondMove, secondField, myFirst ? 'my' : 'opp', cache)) continue;
    const seconds = !secondMove
      ? [{ a: first.d, d: first.a, field: secondField, chance: 1 }]
      : rcAdvanceAttack(first.d, first.a, secondMove, secondField, cache);
    for (const second of seconds) {
      const endedA = rcEndOfExchange(second.a, second.d, second.field);
      const endedD = rcEndOfExchange(second.d, second.a, second.field);
      const myEnd = myFirst ? endedD : endedA, oppEnd = myFirst ? endedA : endedD;
      if (!prune || (rcObservedHpMatches(myEnd, 'my') && rcObservedHpMatches(oppEnd, 'opp'))) {
        paths.push({ my: myEnd, opp: oppEnd, field: { ...second.field, isCritical: false }, chance: first.chance * second.chance, order });
      }
    }
  }
  return paths;
}

function rcHpFirstSpreads(defStat, hasDefense) {
  if (!hasDefense || !defStat) return Array.from({ length: 33 }, (_, i) => ({ hp: 32 - i, defense: 0 }));
  const spreads = [];
  for (let defense = 0; defense <= 32; defense++) spreads.push({ hp: 32, defense });
  for (let hp = 31; hp >= 0; hp--) spreads.push({ hp, defense: 0 });
  return spreads;
}

function rcCachedExchangePaths(my, opp, myMove, oppMove, order, damageCache, pathCache) {
  const empty = { id: '', cat: 'Status' };
  const key = `${order}|${rcDamageCacheKey(my, opp, myMove || empty, rcObservedField('dealt'))}|${rcDamageCacheKey(opp, my, oppMove || empty, rcObservedField('received'))}`;
  let paths = pathCache.get(key);
  if (!paths) {
    paths = rcExchangePaths(my, opp, myMove, oppMove, order, damageCache);
    if (pathCache.size < 20000) pathCache.set(key, paths);
  }
  // Equal observed damage stats can come from different natures/EVs. Reuse the
  // numerical paths, retaining each candidate's actual build for the next card.
  return paths.map(p => ({ ...p, opp: { ...p.opp, nature: opp.nature, evs: { ...opp.evs } } }));
}

function rcValidateExchangeInput(myMove, oppMove) {
  if (!PokemonById[revCalcState.my.pokemonIdx] || !PokemonById[revCalcState.opp.pokemonIdx]) return '내 포켓몬과 상대 포켓몬을 선택해 주세요.';
  if (rcHp(revCalcState.my) <= 0) return '내 시작 HP는 1 이상이어야 합니다.';
  for (const [raw, max, label] of [[revCalcState.observedTheirPct, 100, '상대 남은 HP %'], [revCalcState.observedMyHp, calcMaxHp(revCalcState.my), '내 남은 HP']]) {
    if (raw !== '' && raw != null && (!Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > max)) return `${label}를 0~${max}의 정수로 입력해 주세요.`;
  }
  if (!Number.isFinite(Number(revCalcState.oppStartHpPct)) || Number(revCalcState.oppStartHpPct) < 0.01 || Number(revCalcState.oppStartHpPct) > 100) return '상대 시작 HP %를 0.01~100으로 입력해 주세요.';
  if (myMove?.overrideOffensivePokemon && oppMove && revCalcState.observedMyHp !== '' && rcMoveOffenseStat(oppMove) !== 'atk') return '속임수와 상대의 별도 공격축을 함께 추정하는 조합은 아직 지원하지 않습니다. 상대 피격 HP만으로 먼저 추정해 주세요.';
  if (!(myMove && revCalcState.observedTheirPct !== '') && !(oppMove && revCalcState.observedMyHp !== '')) return '사용 기술과 최종 남은 HP를 한쪽 이상 입력해 주세요.';
  const spent = revCalcState.oppItemKnown === 'focussash' && Number(revCalcState.observedTheirPct) <= 1 && revCalcState.observedTheirPct !== '';
  if (spent) return '기합의띠 발동으로 HP 1이 된 상대는 내구 형태 추정 대상에서 제외합니다.';
  for (const [role, move] of [['my', myMove], ['opp', oppMove]]) {
    if (move?.variableBpKind === 'stockpile' && !Number(revCalcState.observedMoveOptions?.[role]?.stockpileCount)) return `${role === 'my' ? '내' : '상대'} 토해내기의 비축 횟수를 입력해 주세요.`;
  }
  return '';
}

function rcAnalyzeExchange() {
  const started = Date.now();
  const myMove = rcMoveForObservation('my'), oppMove = rcMoveForObservation('opp');
  const error = rcValidateExchangeInput(myMove, oppMove);
  if (error) return { error };
  const my = rcObservationSide(revCalcState.my, 'my'), oppP = PokemonById[revCalcState.opp.pokemonIdx];
  const hasDef = myMove?.cat !== 'Status' && !!myMove && revCalcState.observedTheirPct !== '';
  const hasAtk = oppMove?.cat !== 'Status' && !!oppMove && revCalcState.observedMyHp !== '';
  const defStat = hasDef ? rcMoveDefenseStat(myMove) : null;
  const atkStat = hasAtk ? rcMoveOffenseStat(oppMove) : hasDef && myMove.overrideOffensivePokemon ? 'atk' : null;
  const field = rcAnalysisField(), candidates = [], cache = new Map(), speedCache = new Map(), pathCache = new Map();
  const debug = { stage1: 0, stage1Trimmed: 0, refined: 0, afterFilter: 0, hasDef, hasAtk, observedTheir: Number(revCalcState.observedTheirPct), observedMy: Number(revCalcState.observedMyHp), hpPolicy: 'hp-first' };
  const abilities = rcPokemonAbilityIds(oppP).filter(id => !revCalcState.oppAbilityKnown || revCalcState.oppAbilityKnown === 'unknown' || revCalcState.oppAbilityKnown === id);
  // H32 first; defensive investment below H32 is outside the displayed HP-first assumption.
  const hpPairs = rcHpFirstSpreads(defStat, hasDef);
  const speedCoupled = [myMove, oppMove].some(m => ['gyroBall', 'electroBall'].includes(m?.variableBpKind));
  const orders = oppMove?.observedAction === 'switched' ? ['my-first'] : myMove?.observedAction === 'switched' ? ['opp-first'] : !oppMove ? ['my-first'] : !myMove ? ['opp-first'] : revCalcState.turnOrder === 'unknown' ? ['my-first', 'opp-first'] : [revCalcState.turnOrder];
  for (const nature of RC_NATURE_IDS) for (const ability of abilities) for (const item of rcActiveItemCandidates()) {
    const sk = `${nature}|${ability}|${item}`;
    if (!speedCache.has(sk)) speedCache.set(sk, rcSpeedCandidateInfo(oppP, nature, item, field, ability));
    const speedInfo = speedCache.get(sk);
    if (!speedInfo.valid) continue;
    for (const pair of hpPairs) {
      let pairOrders = orders;
      if (orders.includes('my-first') && hasDef && !speedCoupled && !myMove.overrideOffensivePokemon && !AbilityById[ability]?.paradoxBoost && !rcActionChangesOwnHp(oppMove, { item }, my, true) && !['sandspit', 'seedsower'].includes(my.ability)) {
        let probe = rcObservationSide(rcBuildOpponentState(oppP, { evs: { hp: pair.hp, ...(defStat ? { [defStat]: pair.defense } : {}) }, nature, ability, item }), 'opp');
        probe = rcSetHp(probe, battleHp({ ...probe, hpPct: Number(revCalcState.oppStartHpPct ?? 100) / 100 }));
        const f = { ...rcObservedField('dealt'), atkMovesFirst: true, atkMovesSecond: false };
        if (!rcFirstHitCanMatch(my, probe, myMove, f, 'opp', cache, oppMove)) pairOrders = orders.filter(order => order !== 'my-first');
      }
      if (!pairOrders.length) continue;
      const atkValues = !atkStat ? [0] : atkStat === defStat ? [pair.defense] : Array.from({ length: 33 }, (_, i) => 32 - i);
      for (const atkEv of atkValues) {
        const evs = { hp: pair.hp, ...(defStat ? { [defStat]: pair.defense } : {}), ...(atkStat ? { [atkStat]: atkEv } : {}) };
        if (pair.hp < 32 && ((evs.def || 0) > 0 || (evs.spd || 0) > 0)) continue;
        const used = Object.values(evs).reduce((n, v) => n + v, 0);
        const speMin = speedInfo.active ? speedInfo.speMin : 0, speMax = Math.min(speedInfo.active ? speedInfo.speMax : 32, 66 - used);
        if (speMin > speMax) continue;
        for (const spe of speedCoupled ? Array.from({ length: speMax - speMin + 1 }, (_, i) => speMin + i) : [speMin]) {
          const opp = rcObservationSide(rcBuildOpponentState(oppP, { evs: { ...evs, spe }, nature, ability, item }), 'opp');
          Object.assign(opp, rcSetHp(opp, battleHp({ ...opp, hpPct: Number(revCalcState.oppStartHpPct ?? 100) / 100 })));
          let candidateOrders = pairOrders;
          if (myMove && oppMove && ![myMove,oppMove].some(m => ['switched','skipped'].includes(m.observedAction))) {
            const possibleOrders = new Set(rcBattleOrder(my, opp, myMove, oppMove, field));
            if (!speedCoupled && speMax > spe) for (const order of rcBattleOrder(my, { ...opp, evs: { ...opp.evs, spe: speMax } }, myMove, oppMove, field)) possibleOrders.add(order);
            candidateOrders = candidateOrders.filter(order => possibleOrders.has(order));
          }
          if (oppMove && pairOrders.includes('opp-first') && hasAtk && !rcActionChangesOwnHp(myMove, my, opp, true) && !['sandspit', 'seedsower'].includes(ability)) {
            const f = { ...rcObservedField('received'), atkMovesFirst: true, atkMovesSecond: false };
            if (!rcFirstHitCanMatch(opp, my, oppMove, f, 'my', cache, myMove)) candidateOrders = candidateOrders.filter(order => order !== 'opp-first');
          }
          debug.stage1++;
          const matched = candidateOrders.flatMap(order => rcCachedExchangePaths(my, opp, myMove, oppMove, order, cache, pathCache));
          if (!matched.length) continue;
          const stats = calcStats(opp), likelihood = matched.reduce((n, p) => n + p.chance, 0) / orders.length;
          const c = { nature, ability, abilityImpact: true, item, hpEv: pair.hp, defEv: pair.defense, defStat, atkEv, atkStat,
            speEv: spe, speEvMin: spe, speEvMax: speedCoupled ? spe : speMax, speedInfo: { ...speedInfo },
            oppHp: stats.hp, oppDef: stats[defStat] || 0, oppAtk: stats[atkStat] || 0,
            totalEv: used + spe, maxTotalEv: used + (speedCoupled ? spe : speMax), knownEv: used,
            defScore: likelihood, atkScore: 1, totalScore: likelihood, paths: rcCompactPaths(matched), hpFirst: true };
          candidates.push(c);
        }
      }
    }
  }
  debug.stage1Trimmed = debug.stage1; debug.refined = candidates.length; debug.afterFilter = candidates.length;
  const speedActive = [...speedCache.values()].some(v => v.active);
  const hasNonScarfAlternative = candidates.some(c => c.item !== 'choicescarf');
  candidates.forEach(c => { c.hasNonScarfAlternative = hasNonScarfAlternative; c.completion = rcCandidateCompletionInfo(c, speedActive); });
  const groups = rcGroupCandidates(candidates);
  return { results: groups.slice(0, 5), candidates, total: candidates.length, groupTotal: groups.length, rawTotal: candidates.length,
    filteredByRule: 0, mode: hasDef && hasAtk ? 'full' : hasDef ? 'def-only' : 'atk-only', speedActive,
    myCurrentHp: rcHp(my), mySpeed: effectiveSpeed(my, field), scarfViable: candidates.some(c => c.item === 'choicescarf'), nonScarfViable: hasNonScarfAlternative,
    inputKey: rcAnalysisCacheKey(), hpPolicy: 'hp-first', timings: { inferenceMs: Date.now() - started }, debug };
}

function rcCompactPaths(paths) {
  const result = new Map();
  for (const p of paths) {
    const key = JSON.stringify([hitStateKey(p.my), hitStateKey(p.opp), p.my.stateEvents, p.opp.stateEvents, p.field, p.order]);
    if (result.has(key)) result.get(key).chance += p.chance;
    else result.set(key, { ...p });
  }
  return [...result.values()];
}

export { rcSetHp, rcHp, rcMoveForObservation, rcObservationSide, rcStateEvent, rcObservedBoost, rcMovePriority, rcBattleOrder, rcDamageCacheKey, rcHitOutcomes, rcAdvanceAttack, rcEndOfExchange, rcObservedHpMatches, rcActionChangesOwnHp, rcProjectedEndHpMatches, rcFirstHitCanMatch, rcExchangePaths, rcHpFirstSpreads, rcCachedExchangePaths, rcValidateExchangeInput, rcAnalyzeExchange, rcCompactPaths };
