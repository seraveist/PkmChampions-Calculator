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
  return { ...side, ranks, wasHit: false, receivedDamage: null };
}

function rcMemberList(c) { return c.members || [c]; }

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
  const cache = new Map();
  const speedCache = new Map();
  const seenEvaluations = new Set();
  const bounds = rcDamageBounds();
  let formCertain = 0, formPossible = 0, formImpossible = 0, count = 0, incomplete = false;
  const orders = new Set();
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
        for (const spe of rcForecastSpeedValues(member, path, defenderOrAttacker, move, role === 'my' ? predicted : MoveById[selectedMyMoveId || revCalcState.myMove], speedCache)) {
          const o = { ...defenderOrAttacker, evs: { ...defenderOrAttacker.evs, spe } };
          const field = { ...path.field, ...revCalcState.observedFields?.[role === 'my' ? 'dealt' : 'received'], isCritical: false };
          const myMove = role === 'my' ? move : MoveById[selectedMyMoveId || revCalcState.myMove];
          const opposingMove = role === 'my' ? predicted : move;
          for (const order of rcBattleOrder(my, o, myMove, opposingMove, field)) {
            orders.add(order);
            const a = role === 'my' ? my : o, d = role === 'my' ? o : my;
            const block = AbilityById[d.ability]?.damageBlock;
            if (block?.manual && damageBlockApplies(block, PokemonById[d.pokemonIdx], { ...d, damageBlockActive: true }, move, move.cat === 'Physical')) { incomplete = true; continue; }
            const goesFirst = (role === 'my') === (order === 'my-first');
            const f = { ...field, atkMovesFirst: goesFirst, atkMovesSecond: !goesFirst };
            const preceding = role === 'my' ? opposingMove : myMove;
            const precedingField = { ...path.field, ...revCalcState.observedFields?.[role === 'my' ? 'received' : 'dealt'], isCritical: false };
            // A different, unobserved offensive axis can change the first hit and its consequences.
            // Do not turn the zero-investment placeholder into a survival guarantee.
            const precedingStat = role === 'my' && preceding && rcMoveOffenseStat(preceding);
            if (!goesFirst && precedingStat && ![member.atkStat, member.defStat, 'hp'].includes(precedingStat)) incomplete = true;
            const evaluationKey = `${rcDamageCacheKey(a, d, move, f)}|${!goesFirst && preceding ? rcDamageCacheKey(d, a, preceding, precedingField) : ''}`;
            if (seenEvaluations.has(evaluationKey)) continue;
            seenEvaluations.add(evaluationKey);
            const outcomes = rcForecastHit(a, d, move, preceding, f, goesFirst, cache, precedingField);
            if (!outcomes.length) { incomplete = true; continue; }
            let chance = 0;
            for (const outcome of outcomes) {
              const pct = outcome.damage / calcStats(d).hp * 100;
              bounds.rawMin = Math.min(bounds.rawMin, outcome.damage); bounds.rawMax = Math.max(bounds.rawMax, outcome.damage);
              bounds.pctMin = Math.min(bounds.pctMin, pct); bounds.pctMax = Math.max(bounds.pctMax, pct);
              if (outcome.hp <= 0) chance += outcome.chance;
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
    order: orders.size > 1 ? '동속 또는 후보별 선후공 차이' : orders.has('my-first') ? '내 선공' : '상대 선공',
    formCertain, formPossible, formImpossible };
  return { move, summary, badges: ['공방 후 HP 기준', '잔여 HP 한도 내 피해', 'HP 우선 후보 기준'] };
}

function rcRenderExchangeSummary(result) {
  const forecast = result.forecast;
  if (!forecast) return result.pendingForecastKey ? '<div class="rc-exchange-summary ui-control-frame ui-subframe" role="status">다음 공격 판단을 갱신하고 있습니다.</div>' : result.forecastError ? '<p class="rc-mini-note" role="status">다음 공격 판단을 갱신하지 못했습니다. 분석을 다시 실행해 주세요.</p>' : '';
  return `<div class="rc-exchange-summary ui-control-frame ui-subframe"><strong>다음 공격 판단</strong>
    <p class="rc-mini-note">HP 우선 후보 기준 · 기술 적중 시 · 상대 예상 기술: ${escapeHTML(mvName(MoveById[forecast.opponentMove] || { name: '미입력' }))}</p>
    <div class="rc-exchange-moves">${forecast.my.map(r => `<div class="rc-exchange-move"><b>${escapeHTML(mvName(r.move))}</b><em class="${r.summary.koClass}">상대 처치: ${escapeHTML(r.summary.koState)}</em><span>${escapeHTML(r.summary.order)}</span><span>내 생존: ${escapeHTML(r.incoming?.summary?.survival || (r.incoming?.statusMove ? '변화기 효과 별도 확인' : '상대 기술 미확인'))}</span></div>`).join('')}</div>
    <p class="rc-mini-note">선택한 기술 조합의 선후공과 피격 후 변화를 반영합니다. 기술 명중·별도 급소 없음 기준이며, 미확인 기술 조건은 확정 판단에서 제외합니다.</p></div>`;
}

function rcComputeExchangeForecast(result) {
  const ids = [...new Set(rcVisibleMoveSet())];
  const opponentMove = revCalcState.predictedOppMove || revCalcState.oppMove;
  const key = JSON.stringify([ids, opponentMove, rcNextMyRanks(), rcNextOpponentRanks()]);
  if (result.forecast?.key === key) return result.forecast;
  const all = { members: result.candidates || [] };
  const my = ids.map(id => {
    const own = rcForecastDirect(all, id, 'my', result.speedActive);
    if (!own?.summary) return null;
    own.incoming = opponentMove ? rcForecastDirect(all, opponentMove, 'opp', result.speedActive, id) : null;
    return own;
  }).filter(Boolean);
  result.forecast = { key, opponentMove, my };
  return result.forecast;
}
