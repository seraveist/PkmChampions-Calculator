import { sourceMoveFailure } from './02-damage-events.js';
import { AbilityById, ItemById, abName, calcMaxHp } from './01-core.js';
import { calculateDamage, hkoLabel, powerMoveField, withKoMetric } from './02-engine.js';
import { hitStateKey, actualHitOutcomes, advanceDamageMove, battleHp, finishDamageTurn } from './02-hit-state.js';

// This projection repeats the selected move against the same target. The target
// takes no discretionary action. Conditions that require an opponent's choice
// or a switch remain explicit in the result.
function repeatLimit(move) {
  if (move.fixedDamageKind === 'receivedDamage') return '다음 사용에 새 피격 필요';
  if (move.selfdestruct || move.id === 'finalgambit') return '사용 후 공격자 기절';
  if (['gigatonhammer','bloodmoon'].includes(move.id)) return '연속 선택 불가';
  if (['firstimpression','fakeout'].includes(move.id)) return '등장 첫 행동에만 사용';
  if (['doubleshock','burnup'].includes(move.id)) return '사용 후 해당 타입 소실';
  if (['fling','stockpile','requiresTerrain'].includes(move.variableBpKind)) return '다음 사용에 조건 복구 필요';
  return '';
}

function repeatCondition(move, a) {
  if (move.id === 'upperhand' && !a.targetPriorityAttack) return '상대가 선제 공격기를 준비 중인 조건 필요';
  if (move.id === 'lastresort' && !a.usedOtherMoves) return '다른 보유 기술을 모두 사용한 조건 필요';
  if (['suckerpunch','thunderclap'].includes(move.id) && !a.targetAttacking) return '상대가 공격을 준비 중인 조건 필요';
  return sourceMoveFailure(move,a);
}

function needsHitState(a, d, move, field, context) {
  const ability = AbilityById[context?.defAbility], item = ItemById[context?.defItem];
  return ability?.damageBlock || ability?.koSurvival || item?.koSurvival || item?.id === 'focusband' || move.selfBoosts || move.targetHitBoosts
    || move.hitStatus || move.bindsTarget || ['syrupbomb','healblock'].includes(move.hitVolatile)
    || (['userWasHitDouble','targetWasHitDouble'].includes(move.variableBpKind) && (a.wasHit || d.wasHit))
    || (move.variableBpKind === 'lastMoveFailedDouble' && a.lastMoveFailed && !move.manualBp)
    || move.flags?.charge || move.flags?.recharge || ['futuresight','doomdesire','icespinner'].includes(move.id) || move.recoil || move.drain || move.selfdestruct || repeatLimit(move) || move.ohko
    || ['steelbeam','chloroblast','saltcure','psychicnoise','electroshot','meteorbeam','aurawheel'].includes(move.id)
    || ['lifeorb','metronome','throatspray','shellbell'].includes(a.item)
    || ['roughskin','ironbarbs','stamina','weakarmor','spicyspray','watercompaction','rattled','steamengine','seedsower','sandspit','thermalexchange','liquidooze','gooey','tanglinghair','mummy','lingeringaroma','wanderingspirit','justified','berserk','competitive','defiant','opportunist','pickpocket','cudchew','aftermath','innardsout'].includes(d.ability)
    || ['rockyhelmet','weaknesspolicy','blacksludge'].includes(d.item) || ['hungerswitch','speedboost','magician','cudchew'].includes(a.ability)
    || ['Sand','Snow','Rain','Sun'].includes(field.weather) || field.terrain === 'Grassy'
    || [a,d].some(side => ['Burn','Poison','Toxic'].includes(side.status) || side.saltCure || side.healBlock);
}

function repeatDamageKo(a, d, move, field, result) {
  const damp = move.selfdestruct && (result.koContext?.defAbility === 'damp' || result.koContext?.atkAbility === 'damp');
  const stop = repeatLimit(move);
  const pivot = ['uturn','voltswitch','flipturn','dragontail','circlethrow'].includes(move.id);
  const switchItem = ['redcard','ejectbutton'].includes(result.koContext?.defItem) ? result.koContext.defItem : '';
  const switchOnHit = !a.preventSwitch && (pivot || switchItem);
  const issue = repeatCondition(move,a);
  const labelled = (label, turns = '', sub = '', metric = {}) =>
    withKoMetric({ label, turns, sub, pct: '', cls: 'no' }, metric);
  if (damp) return labelled('무효','','습기',{impossible:true});
  if (issue) return labelled('조건 확인','',issue);
  // Determine immunity under battle rules. Display badges are translated output.
  const firstHit = calculateDamage(a,d,move,{...field, damagePurpose:'observed', resolveHitState:true, singleHitCalculation:true});
  const immune = firstHit?.effectiveness === 0;
  // Test the threshold after the entire move, including recovery between hits.
  const exitCondition = (side, abilityId) => !side.noReserve && AbilityById[abilityId]?.switchAtHalfHp
    ? { half: Math.floor(calcMaxHp(side) / 2), name: abName(AbilityById[abilityId]) } : null;
  const atkExit = exitCondition(a,result.koContext?.atkAbility), defExit = exitCondition(d,result.koContext?.defAbility);
  const exitNames = new Set();
  const exitsAtHalf = (rule, startedAbove, after) => {
    if (!rule || !startedAbove) return false;
    const remaining = battleHp(after);
    if (remaining <= 0 || remaining > rule.half) return false;
    exitNames.add(rule.name);
    return true;
  };
  const crossesHalf = (rule, before, after) => rule && exitsAtHalf(rule,battleHp(before) > rule.half,after);
  if (!immune && !atkExit && !defExit && !switchOnHit && !needsHitState(a,d,move,field,result.koContext))
    return hkoLabel(result.damages,result.defHP,d,field,result.koContext,result.hitProfile);

  let active = [{ a, d, field, chance: 1 }];
  const cumulative = [], hitCache = new Map();
  let total = 0, ended = 0, possibleTurn = null, guaranteedTurn = null, endReason = '', doubleFaint = false;
  const seen = new Set();
  const delayed = ['futuresight','doomdesire'].includes(move.id);
  const charge = move.flags?.charge && !(move.id === 'electroshot' && ['Rain','Heavy Rain'].includes(field.weather))
    && !(['solarbeam','solarblade'].includes(move.id) && ['Sun','Harsh Sunshine'].includes(field.weather));
  const impactTurn = n => delayed ? n * 3 : charge ? n * 2 - (a.item === 'powerherb' ? 1 : 0) : move.flags?.recharge ? n * 2 - 1 : n;
  let work = 0, residualKo = false, exitChance = 0;
  for (let turn = 1; turn <= 10 && active.length; turn++) {
    const next = new Map();
    for (let state of active) {
      const wait = delayed ? 2 : (charge && state.a.item !== 'powerherb') || (move.flags?.recharge && turn > 1) ? 1 : 0;
      let exited = false;
      for (let idle = 0; idle < wait; idle++) {
        const before = state;
        state = { ...state, a:finishDamageTurn(state.a,state.d,state.field), d:finishDamageTurn(state.d,state.a,state.field) };
        if (!battleHp(state.a) || !battleHp(state.d)) break;
        exited = crossesHalf(defExit,before.d,state.d) || crossesHalf(atkExit,before.a,state.a);
        if (exited) break;
      }
      if (!battleHp(state.d)) { total += state.chance; continue; }
      if (!battleHp(state.a)) { ended += state.chance; endReason = '공격자 기절'; continue; }
      if (exited) { ended += state.chance; exitChance += state.chance; continue; }
      const order = powerMoveField(state.a,state.d,move,state.field);
      const cachePrefix = JSON.stringify([hitStateKey(state.a), hitStateKey(state.d), order]);
      const resolve = (atk,def,m,f) => {
        if (!hitCache.has(cachePrefix)) hitCache.set(cachePrefix,actualHitOutcomes(atk,def,m,f));
        return hitCache.get(cachePrefix);
      };
      for (const path of advanceDamageMove(state.a,state.d,move,order,resolve)) {
        const chance = state.chance * path.chance;
        if (battleHp(path.d) <= 0) { total += chance; doubleFaint ||= battleHp(path.a) <= 0; continue; }
        if (battleHp(path.a) <= 0 || (switchOnHit && path.landed && (pivot || path.d.item === switchItem))) {
          ended += chance; endReason = battleHp(path.a) <= 0 ? (stop || '공격자 기절') : '교체 가능 여부에 따라 대면 종료'; continue;
        }
        if (exitsAtHalf(defExit,path.exitThresholdCrossed,path.d) || crossesHalf(atkExit,state.a,path.a)) {
          ended += chance; exitChance += chance; continue;
        }
        const defender = finishDamageTurn(path.d,path.a,path.field);
        const attacker = finishDamageTurn(path.a,path.d,path.field);
        if (battleHp(defender) <= 0) { total += chance; residualKo = true; continue; }
        if (battleHp(attacker) <= 0) { ended += chance; endReason = '공격자 기절'; continue; }
        if (crossesHalf(defExit,path.d,defender) || crossesHalf(atkExit,path.a,attacker)) {
          ended += chance; exitChance += chance; continue;
        }
        if (stop) { ended += chance; endReason = stop; continue; }
        // Events and last-hit annotations are observation details. They do not
        // distinguish sample states when repeating an ordinary damaging move.
        attacker.stateEvents = []; defender.stateEvents = [];
        const key = JSON.stringify([hitStateKey(attacker),hitStateKey(defender),path.field.weather,path.field.terrain,
          !!path.field.defReflect,!!path.field.defLightScreen]);
        if (next.has(key)) next.get(key).chance += chance;
        else next.set(key,{a:attacker,d:defender,field:path.field,chance});
      }
      if (++work > 8000) return labelled('조건 확인','','복합 상태의 10회 확률 계산 한도');
    }
    cumulative.push(Math.min(1,total));
    if (possibleTurn === null && total > 0) possibleTurn = turn;
    if (!next.size && ended === 0 && total > 0) guaranteedTurn = turn;
    if (!possibleTurn && !ended && next.size > 0) {
      const signature = [...next.keys()].sort().join('|');
      if (seen.has(signature)) return labelled(immune ? '무효' : 'KO 불가','','',{impossible:true,cumulative});
      seen.add(signature);
    }
    active = [...next.values()];
  }
  const metric = { possibleTurn, guaranteedTurn, oneMoveKoChance:cumulative[0] || 0, cumulative, impossible:!active.length && !possibleTurn };
  const notes = [];
  if (exitChance > 0) {
    notes.push([...exitNames].join('·')+'로 교체');
    const withoutReserve = repeatDamageKo(atkExit ? {...a,noReserve:true} : a,
      defExit ? {...d,noReserve:true} : d,move,field,result);
    const { possibleTurn: earliest, guaranteedTurn: latest } = withoutReserve.metric;
    const alternative = latest && latest !== earliest ? latest+'타 이내 확정'
      : [withoutReserve.label,withoutReserve.turns,withoutReserve.pct].filter(Boolean).join(' ');
    notes.push('교체할 포켓몬이 없으면 '+alternative);
  }
  if (endReason) notes.push(endReason);
  if (residualKo) notes.push('턴 종료 피해로 KO되는 경로 포함');
  if (doubleFaint) notes.push('동시 기절 경로 포함');
  if (move.ohko) notes.push('명중 시');
  if (possibleTurn && impactTurn(possibleTurn) !== possibleTurn) notes.push('첫 KO 가능 시점 '+impactTurn(possibleTurn)+'턴째');
  if (field.weather !== 'none' || field.terrain !== 'none') notes.push('현재 필드 유지 기준');
  if (a.hangry || a.ability === 'hungerswitch') notes.push('턴 종료 폼 변화');
  if (!possibleTurn && !active.length && exitChance > 0 && exitChance === ended) return labelled('교체로 대면 종료','',notes.join(' · '),metric);
  if (!possibleTurn) return labelled(ended && !active.length ? '연속 KO 불가' : '10타 초과','',notes.join(' · '),metric);
  const certain = possibleTurn === guaranteedTurn;
  if (!certain && guaranteedTurn) notes.push(guaranteedTurn + '타 이내 확정');
  const ko = labelled(certain ? '확정' : '난수',possibleTurn+'타',notes.join(' · '),metric);
  const chance = cumulative[possibleTurn-1];
  if (!certain) ko.pct = chance < .0005 ? '0.1% 미만' : chance > .9995 ? '99.9% 초과' : (chance*100).toFixed(1)+'%';
  return ko;
}

export { repeatDamageKo, repeatCondition, repeatLimit };
