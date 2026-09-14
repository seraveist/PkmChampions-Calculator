/* Forecasts retain exact members instead of crossing grouped EV ranges. */
function rcHpPriority(c) {
  if (!c.defStat) return 0;
  return c.hpEv === 32 ? 2 : (c.defEv || 0) === 0 ? 1 : 0;
}

function rcCompareHpFirst(a, b) {
  return rcHpPriority(b) - rcHpPriority(a) || ((a.defStat && b.defStat) ? (a.defEv || 0) - (b.defEv || 0) : 0) || (b.hpEv || 0) - (a.hpEv || 0);
}

function rcNextObservedState(side, role) {
  const initial = role === 'my' ? revCalcState.my.ranks : revCalcState.opp.ranks;
  const controls = role === 'my' ? rcNextMyRanks() : rcNextOpponentRanks();
  const ranks = { ...side.ranks };
  for (const stat of ['atk','def','spa','spd','spe']) ranks[stat] = Math.max(-6, Math.min(6, (ranks[stat] || 0) + (controls[stat] || 0) - (initial?.[stat] || 0)));
  return { ...side, ranks, wasHit: false, receivedDamage: null, fickleBeamMode: 'auto' };
}

function rcMemberList(c) { return c.members || [c]; }

// A card reports the damage of a landed move at the next turn's starting state.
// Observation replay still uses capped HP and real survival effects separately.
function rcCardHitOutcomes(a, d, move, field, cache) {
  const key = `card:${rcDamageCacheKey(a, d, move, field)}`;
  if (cache.has(key)) return cache.get(key);
  const first = calculateDamage(a, d, move, { ...field, singleHitCalculation: true, powerHitIndex: 0 });
  if (!first?.koContext) return [];
  const model = makePowerAttackModel(a, d, move, { ...field, singleHitCalculation: true }, first);
  const result = resolvePowerMoveUse(model, rcHp(d), false, true);
  cache.set(key, result);
  return result;
}

function rcForecastStartState(path, role) {
  const side = path[role], other = path[role === 'my' ? 'opp' : 'my'];
  return rcNextObservedState(revCalcState.observationTiming === 'hit' ? rcEndOfExchange(side, other, path.field, true) : side, role);
}

function rcForecastSpeedValues(member, path, opp, move, precedingMove, cache) {
  const min = member.speEvMin || 0;
  const max = Math.min(member.speEvMax || 0, 66 - Object.entries(opp.evs).filter(([s]) => s !== 'spe').reduce((n, [, v]) => n + v, 0));
  if (max < min) return [];
  const exact = [move, precedingMove].some(m => ['gyroBall', 'electroBall'].includes(m?.variableBpKind));
  let valid = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  if (revCalcState.turnOrder === 'unknown' && revCalcState.myMove && revCalcState.oppMove) {
    const key = JSON.stringify([opp.pokemonIdx, opp.nature, opp.ability, member.item, min, max, path.order]);
    if (cache.has(key)) valid = cache.get(key);
    else {
      const original = rcBuildOpponentState(PokemonById[opp.pokemonIdx], { nature: opp.nature, ability: opp.ability, item: member.item, evs: opp.evs });
      valid = valid.filter(spe => rcBattleOrder(revCalcState.my, { ...original, evs: { ...original.evs, spe } }, rcMoveForObservation('my'), rcMoveForObservation('opp'), rcAnalysisField()).includes(path.order));
      cache.set(key, valid);
    }
  }
  return exact ? valid : valid.length ? [...new Set([valid[0], valid[valid.length - 1]])] : [];
}

function rcForecastHit(a, d, move, precedingMove, field, goesFirst, cache, precedingField = field) {
  if (goesFirst || !precedingMove || precedingMove.cat === 'Status') return rcHitOutcomes(a, d, move, field, cache);
  const outcomes = [];
  for (const first of rcAdvanceAttack(d, a, precedingMove, { ...precedingField, atkMovesFirst: true, atkMovesSecond: false, isCritical: false }, cache)) {
    if (rcHp(first.d) <= 0) {
      outcomes.push({ hp: rcHp(first.a), damage: 0, chance: first.chance, cannotAct: true });
      continue;
    }
    for (const next of rcHitOutcomes(first.d, first.a, move, { ...field, weather: first.field.weather, terrain: first.field.terrain, atkMovesFirst: false, atkMovesSecond: true }, cache)) outcomes.push({ ...next, chance: next.chance * first.chance });
  }
  return outcomes;
}

function rcForecastDirect(c, moveId, role, speedActive, selectedMyMoveId = null) {
  const move = MoveById[moveId];
  if (!move || move.cat === 'Status') return move ? { move, statusMove: true, badges: ['직접 피해 없음'] } : null;
  if (!c.paths && !c.members) return null;
  if (['firstimpression', 'fakeout'].includes(moveId)) return { move, unavailable: true, badges: ['이 대면의 첫 행동 이후 사용 불가'] };
  if (moveId === 'doubleshock' && (role === 'my' ? revCalcState.myMove : revCalcState.oppMove) === moveId) return { move, unavailable: true, badges: ['전기 타입 소실로 재사용 불가'] };
  if (move.fixedDamageKind === 'receivedDamage') return { move, unavailable: true, badges: ['다음 턴 피격에 따라 결정되는 기술'] };
  const cache = new Map();
  const speedCache = new Map();
  const seenEvaluations = new Set();
  const bounds = rcDamageBounds();
  let formCertain = 0, formPossible = 0, formImpossible = 0, count = 0, incomplete = false;
  let allTied = true;
  const orders = new Set(), moveTypes = new Set(), categories = new Set();
  const predicted = MoveById[revCalcState.predictedOppMove || revCalcState.oppMove];
  for (const member of rcMemberList(c)) {
    for (const path of member.paths || []) {
      const my = rcForecastStartState(path, 'my'), opp = rcForecastStartState(path, 'opp');
      const stat = role === 'my' ? rcMoveDefenseStat(move) : rcMoveOffenseStat(move);
      const known = stat && (stat === member.defStat || stat === member.atkStat || stat === 'hp');
      const used = Object.values(opp.evs).reduce((n, v) => n + v, 0);
      const max = stat && !(member.hpFirst && ['def', 'spd'].includes(stat) && member.hpEv < 32) ? Math.min(32, (opp.evs[stat] || 0) + 66 - used) : 0;
      const values = !stat || known ? [stat ? opp.evs[stat] || 0 : 0] : Array.from({ length: max + 1 }, (_, i) => i);
      for (const value of values) {
        const defenderOrAttacker = { ...opp, evs: { ...opp.evs, ...(stat ? { [stat]: value } : {}) } };
        for (const spe of rcForecastSpeedValues(member, path, defenderOrAttacker, move, role === 'my' ? predicted : MoveById[selectedMyMoveId || revCalcState.nextMyMove || revCalcState.myMove], speedCache)) {
          const o = { ...defenderOrAttacker, evs: { ...defenderOrAttacker.evs, spe } };
          const field = { ...path.field, ...revCalcState.observedFields?.[role === 'my' ? 'dealt' : 'received'], isCritical: false };
          const myMove = role === 'my' ? move : MoveById[selectedMyMoveId || revCalcState.nextMyMove || revCalcState.myMove];
          const opposingMove = role === 'my' ? predicted : move;
          const possibleOrders = rcBattleOrder(my, o, myMove, opposingMove, field);
          if (possibleOrders.length === 1) allTied = false;
          for (const order of possibleOrders) {
            orders.add(order);
            const goesFirst = (role === 'my') === (order === 'my-first');
            const a = role === 'my' ? my : o;
            let d = role === 'my' ? o : my;
            // Glaive Rush ends when its user acts, before a slower opponent's hit.
            if (d.glaiveRushExposed && !goesFirst) d = { ...d, glaiveRushExposed: false };
            const block = AbilityById[d.ability]?.damageBlock;
            if (block?.manual && damageBlockApplies(block, PokemonById[d.pokemonIdx], { ...d, damageBlockActive: true }, move, move.cat === 'Physical')) { incomplete = true; continue; }
            const f = { ...field, atkMovesFirst: goesFirst, atkMovesSecond: !goesFirst };
            const evaluationKey = rcDamageCacheKey(a, d, move, f);
            if (seenEvaluations.has(evaluationKey)) continue;
            seenEvaluations.add(evaluationKey);
            const outcomes = rcCardHitOutcomes(a, d, move, f, cache);
            if (!outcomes.length) { incomplete = true; continue; }
            let chance = 0;
            for (const outcome of outcomes) {
              const pct = outcome.damage / calcMaxHp(d) * 100;
              bounds.rawMin = Math.min(bounds.rawMin, outcome.damage); bounds.rawMax = Math.max(bounds.rawMax, outcome.damage);
              bounds.pctMin = Math.min(bounds.pctMin, pct); bounds.pctMax = Math.max(bounds.pctMax, pct);
            }
            // Survival effects and in-move recovery determine KO without clipping the displayed damage.
            for (const outcome of rcHitOutcomes(a, d, move, f, cache)) {
              if (outcome.hp <= 0) chance += outcome.chance;
              if (outcome.moveType) moveTypes.add(outcome.moveType);
              if (outcome.category) categories.add(outcome.category);
            }
            count++;
            if (chance >= 1 - 1e-9) formCertain++;
            else if (chance > 1e-9) formPossible++;
            else formImpossible++;
          }
        }
      }
    }
  }
  if (!count) return { move, badges: ['기술·차단 상태 확인 필요'], summary: { rawMin: 0, rawMax: 0, pctMin: 0, pctMax: 0, koClass: 'ko-roll', koState: '조건 확인 필요', survival: '조건 확인 필요', order: '선후공 확인 필요' } };
  const kinds = [formCertain, formPossible, formImpossible].filter(n => n > 0).length;
  const state = incomplete ? '조건 확인 필요' : kinds > 1 ? '형태에 따라 다름' : formCertain ? 'KO 확정' : formPossible ? 'KO 난수' : 'KO 불가';
  const summary = { rawMin: bounds.rawMin, rawMax: bounds.rawMax, pctMin: bounds.pctMin, pctMax: bounds.pctMax,
    koClass: state === 'KO 확정' ? 'ko-certain' : state === 'KO 불가' ? 'ko-none' : 'ko-roll', koState: state,
    survival: state === 'KO 확정' ? '확정으로 쓰러짐' : state === 'KO 불가' ? '확정 생존' : state === 'KO 난수' ? '난수로 쓰러짐' : state,
    order: !predicted && role === 'my' ? '상대 기술 미확인' : orders.size > 1 ? (allTied ? '동속' : '후보에 따라 선후공 다름') : orders.has('my-first') ? '내 선공' : '상대 선공',
    formCertain, formPossible, formImpossible };
  return { move, summary, types: [...moveTypes], categories: [...categories], badges: ['다음 턴 시작 상태 · 적중 시', 'HP 우선 후보 기준'] };
}

function rcRenderExchangeSummary(result) {
  const forecast=result.forecast;
  if(!forecast) return result.pendingForecastKey ? '<div class="rc-exchange-summary" role="status">다음 턴 정보 갱신 중</div>' : result.forecastError ? '<p class="rc-mini-note" role="status">갱신 실패 · 다시 분석하세요.</p>' : '';
  return `<section class="rc-exchange-summary"><h3>다음 턴 비교</h3><div class="rc-reference-moves"><div class="form-field"><span>내 기준 기술</span>${rcRenderMoveCombobox('nextMyMove',revCalcState.nextMyMove || revCalcState.myMove,{compact:true})}</div><div class="form-field"><span>상대 기준 기술</span>${rcRenderMoveCombobox('predictedOppMove',forecast.opponentMove,{compact:true})}</div></div></section>`;
}

function rcComputeExchangeForecast(result, { allCandidates = false } = {}) {
  const started = Date.now();
  const ids = [...new Set(rcVisibleMoveSet())];
  const opponentMove = revCalcState.predictedOppMove || revCalcState.oppMove;
  const key = rcForecastKey();
  if (result.forecast?.key === key && (!allCandidates || result.forecast.allCandidates)) return result.forecast;
  const all = { members: result.candidates || [] };
  const my = (allCandidates ? ids : []).map(id => {
    const own = rcForecastDirect(all, id, 'my', result.speedActive);
    if (!own?.summary) return null;
    own.incoming = opponentMove ? rcForecastDirect(all, opponentMove, 'opp', result.speedActive, id) : null;
    return own;
  }).filter(Boolean);
  result.forecast = { key, opponentMove, my, allCandidates };
  for (const group of result.results || []) {
    group.cardReport = {
      key,
      my: ids.map(id => rcForecastDirect(group, id, 'my', result.speedActive)).filter(Boolean),
      opp: rcKnownOpponentMoves().map(id => rcForecastDirect(group, id, 'opp', result.speedActive)).filter(Boolean),
      state: rcNextStateSummary(group),
    };
  }
  result.timings = { ...result.timings, cardsMs: Date.now() - started };
  return result.forecast;
}

function rcNextStateSummary(c) {
  const summary = {};
  for (const role of ['my', 'opp']) {
    const ranks = Object.fromEntries(['atk','def','spa','spd','spe'].map(s => [s, new Set()]));
    const events = new Map(), items = new Set();
    let pathCount = 0;
    let unknownItem = false;
    let hpMin = Infinity, hpMax = 0, pctMin = Infinity, pctMax = 0;
    for (const member of rcMemberList(c)) for (const path of member.paths || []) {
      const side = rcForecastStartState(path, role), hp = rcHp(side), pct = hp / calcMaxHp(side) * 100;
      pathCount++;
      hpMin = Math.min(hpMin, hp); hpMax = Math.max(hpMax, hp); pctMin = Math.min(pctMin, pct); pctMax = Math.max(pctMax, pct);
      for (const s of Object.keys(ranks)) ranks[s].add(side.ranks[s] || 0);
      for (const event of new Set(side.stateEvents || [])) events.set(event, (events.get(event) || 0) + 1);
      items.add(side.item || '');
      if (role === 'opp' && !member.item && rcKnownOpponentItem() === null) unknownItem = true;
    }
    summary[role] = { hpMin, hpMax, pctMin, pctMax, unknownItem, ranks: Object.fromEntries(Object.entries(ranks).map(([s,v]) => [s, [...v].sort((a,b) => a-b)])), events: [...events].map(([event,n]) => event + (n < pathCount ? ' (일부 후보)' : '')), items: [...items] };
  }
  return summary;
}
