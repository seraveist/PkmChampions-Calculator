/* One observed singles exchange. Pure transitions are shared with the next-action forecast. */
function rcSetHp(side, hp) {
  const max = calcStats(side).hp;
  const current = Math.max(0, Math.min(max, Math.floor(hp)));
  return { ...side, hpPct: current / max, fullHP: current === max, pinch: current <= Math.floor(max / 3) };
}

function rcHp(side) { return Math.max(0, Math.round(calcStats(side).hp * sideHpPct(side))); }

function rcMoveForObservation(role) {
  const id = role === 'my' ? revCalcState.myMove : revCalcState.oppMove;
  const move = MoveById[id];
  if (!move) return null;
  const options = revCalcState.observedMoveOptions?.[role] || {};
  const bp = Number(role === 'my' ? revCalcState.myMoveBp : revCalcState.oppMoveBp);
  return { ...move, ...(bp > 0 ? { bp, manualBp: true } : {}), ...(Number(options.hitCount) > 0 ? { hitCount: Number(options.hitCount) } : {}) };
}

function rcObservationSide(side, role) {
  return { ...side, ranks: { ...side.ranks }, stateEvents: [], observationEnded: false, ...(revCalcState.observedMoveOptions?.[role] || {}) };
}

function rcStateEvent(side, text) {
  side.stateEvents = [...(side.stateEvents || []), text];
}

function rcObservedBoost(side, stat, amount, source) {
  const multiplier = side.ability === 'contrary' ? -1 : side.ability === 'simple' ? 2 : 1;
  const before = side.ranks[stat] || 0;
  side.ranks[stat] = Math.max(-6, Math.min(6, before + amount * multiplier));
  const delta = side.ranks[stat] - before;
  if (delta) rcStateEvent(side, `${source} · ${{atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'스피드'}[stat]} ${delta > 0 ? '+' : ''}${delta}`);
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
  const aNumbers = AbilityById[a.ability]?.paradoxBoost ? as : [as.hp, as[rcMoveOffenseStat(move) || 'atk'], speed ? as.spe : 0];
  const dNumbers = AbilityById[d.ability]?.paradoxBoost ? ds : [ds.hp, ds[rcMoveDefenseStat(move) || 'def'], move.overrideOffensivePokemon ? ds.atk : 0, speed ? ds.spe : 0];
  return JSON.stringify([a.pokemonIdx, d.pokemonIdx, move.id, move.bp, move.manualBp, move.hitCount,
    aNumbers, dNumbers,
    a.hpPct, d.hpPct, a.ability, d.ability, a.item, d.item, a.ranks, d.ranks, a.status, d.status,
    move.variableBpKind === 'userWasHitDouble' && a.wasHit, move.variableBpKind === 'targetWasHitDouble' && d.wasHit,
    move.fixedDamageKind === 'receivedDamage' ? [a.receivedDamage, a.receivedDamageCategory] : null, a.fickleBeamMode, a.stockpileCount,
    a.boosterEnergyState, a.flashFireActive, a.unburdenActive, a.slowStartActive, a.fallenAllies,
    d.boosterEnergyState, d.damageBlockActive, a.tailwind, d.tailwind, a.paradoxActive, d.paradoxActive,
    a.types, d.types, !!a.glaiveRushExposed, !!d.glaiveRushExposed, a.tera, d.tera, a.teraType, d.teraType, field]);
}

function rcHitOutcomes(a, d, move, field, cache) {
  if (!move || move.cat === 'Status') return [{ hp: rcHp(d), item: d.item, chance: 1, damage: 0, lastDamage: 0, hits: 0, category: '', moveType: '' }];
  const key = cache && rcDamageCacheKey(a, d, move, field);
  if (cache?.has(key)) return cache.get(key);
  const first = calculateDamage(a, d, move, { ...field, singleHitCalculation: true, powerHitIndex: 0 });
  if (!first) return [];
  const model = makePowerAttackModel(a, d, move, { ...field, singleHitCalculation: true }, first);
  const variants = model.variants;
  const weightTotal = variants.reduce((n, v) => n + v.weight, 0);
  const out = [];
  for (let vi = 0; vi < variants.length; vi++) {
    let states = [{ hp: rcHp(d), used: false, damage: 0, lastDamage: 0, chance: variants[vi].weight / weightTotal, hits: 0 }];
    for (let index = 0; index < variants[vi].hits; index++) {
      const next = new Map();
      const add = row => {
        const k = `${row.hp}|${row.used}|${row.damage}|${row.lastDamage}|${row.hits}`;
        if (next.has(k)) next.get(k).chance += row.chance;
        else next.set(k, row);
      };
      for (const current of states) {
        if (current.hp <= 0) { add(current); continue; }
        const hit = model.hit(current.hp, current.used, index, vi);
        const weights = koRollWeights(hit.damages || [0]);
        const total = [...weights.values()].reduce((n, w) => n + w, 0);
        for (const [raw, weight] of weights) {
          let damage = Math.min(current.hp, Math.max(0, raw));
          let used = current.used;
          if (raw >= current.hp && current.hp === model.maxHp && current.hp > 1 &&
              ((!used && first.koContext?.defItem === 'focussash') || first.koContext?.defAbility === 'sturdy')) {
            damage = current.hp - 1;
            if (first.koContext?.defItem === 'focussash') used = true;
          }
          const recovery = koRecoveryOptions(hit.koContext || first.koContext, hit.effectiveness, hit.moveType);
          const removed = model.removeItemOnHit && damage > 0 && !recovery.consumeResistBerry;
          const before = model.flungItem ? recoverFlungBerry(model, current.hp - damage, used, recovery, damage) : { hp: current.hp - damage, used };
          const recovered = recoverPowerHit(before.hp, model.maxHp, before.used || removed, recovery, damage);
          add({ hp: Math.max(0, recovered.hp), used: recovered.used, damage: current.damage + damage,
            lastDamage: damage, chance: current.chance * weight / total, hits: current.hits + (damage > 0 ? 1 : 0) });
        }
      }
      states = [...next.values()];
    }
    for (const row of states) out.push({ ...row, item: row.used ? '' : d.item, category: first.category,
      moveType: first.moveType, defAbility: first.koContext?.defAbility, atkAbility: first.koContext?.atkAbility,
      defItem: first.koContext?.defItem, atkItem: first.koContext?.atkItem, effectiveness: first.effectiveness,
      consumesAttackItem: model.consumesAttackItem });
  }
  if (cache) cache.set(key, out);
  return out;
}

function rcAdvanceAttack(a, d, move, field, cache) {
  if (rcHp(a) <= 0) return [];
  a = { ...a, glaiveRushExposed: false };
  return rcHitOutcomes(a, d, move, field, cache).map(hit => {
    let defender = rcSetHp({ ...d, item: hit.item, ranks: { ...d.ranks }, wasHit: hit.damage > 0,
      receivedDamage: hit.lastDamage, receivedDamageCategory: hit.category || 'Physical' }, hit.hp);
    let attacker = { ...a, ranks: { ...a.ranks } };
    const nextField = { ...field };
    if (hit.damage > 0) {
      const rank = (side, stat, amount, source = abName(AbilityById[side.ability] || { name: side.ability })) => rcObservedBoost(side, stat, amount, source);
      if (hit.defAbility === 'stamina') rank(defender, 'def', hit.hits);
      if (hit.defAbility === 'weakarmor' && hit.category === 'Physical') { rank(defender, 'def', -hit.hits); rank(defender, 'spe', 2 * hit.hits); }
      if (hit.defAbility === 'watercompaction' && hit.moveType === 'Water') rank(defender, 'def', 2 * hit.hits);
      if (hit.defAbility === 'seedsower') nextField.terrain = 'Grassy';
      if (hit.defAbility === 'sandspit') nextField.weather = 'Sand';
      if (hit.moveType === 'Fire' && hit.defAbility === 'thermalexchange') rank(defender, 'atk', 1);
      if (d.item && !defender.item && d.ability === 'unburden') defender.unburdenActive = true;
      if (move?.selfBoosts) for (const [stat, amount] of Object.entries(move.selfBoosts)) rank(attacker, stat, amount * (move.id === 'poweruppunch' ? hit.hits : 1), mvName(move));
      if (hit.defAbility === 'steamengine' && ['Fire', 'Water'].includes(hit.moveType)) rank(defender, 'spe', 6);
      if (hit.defAbility === 'rattled' && ['Bug', 'Ghost', 'Dark'].includes(hit.moveType)) rank(defender, 'spe', hit.hits);
      if (hit.defItem === 'weaknesspolicy' && hit.effectiveness > 1 && rcHp(defender) > 0) {
        rank(defender, 'atk', 2, '약점보험'); rank(defender, 'spa', 2, '약점보험'); defender.item = '';
      }
      if (hit.defItem === 'airballoon') { defender.item = ''; rcStateEvent(defender, '풍선 · 소모'); }
      if (d.item && !defender.item && d.item !== 'airballoon') rcStateEvent(defender, `${itName(ItemById[d.item] || { name: d.item })} · 소모`);
      let hp = rcHp(a);
      if (move?.drain) {
        const healing = Math.max(1, Math.round(hit.damage * fractionValue(move.drain, 0) * (a.item === 'bigroot' ? 1.3 : 1)));
        hp += hit.defAbility === 'liquidooze' ? -healing : healing;
      }
      if (move?.recoil && !['rockhead', 'magicguard'].includes(hit.atkAbility)) hp -= Math.max(1, Math.round(hit.damage * fractionValue(move.recoil, 0)));
      if (a.item === 'lifeorb' && hit.atkAbility !== 'magicguard' && !(hit.atkAbility === 'sheerforce' && move?.sec)) hp -= Math.max(1, Math.floor(calcStats(a).hp / 10));
      if (move?.flags?.contact && hit.atkAbility !== 'longreach' && !(a.item === 'punchingglove' && move.flags.punch) && hit.atkAbility !== 'magicguard') {
        if (['roughskin', 'ironbarbs'].includes(hit.defAbility)) hp -= Math.max(1, Math.floor(calcStats(a).hp / 8)) * hit.hits;
        if (d.item === 'rockyhelmet') hp -= Math.max(1, Math.floor(calcStats(a).hp / 6)) * hit.hits;
      }
      attacker = rcSetHp(attacker, hp);
      if (hit.consumesAttackItem) {
        attacker.item = '';
        rcStateEvent(attacker, '노말주얼 · 소모');
        if (hit.atkAbility === 'unburden') attacker.unburdenActive = true;
      }
      if (move?.variableBpKind === 'fling') attacker.item = '';
      if (move?.variableBpKind === 'stockpile') attacker.stockpileCount = 0;
    }
    if (move?.cat === 'Status') {
      for (const [stat, amount] of Object.entries(move.statusBoosts || {})) rcObservedBoost(attacker, stat, amount, mvName(move));
      if (move.statusHeal && rcHp(attacker) > 0) {
        const before = rcHp(attacker);
        attacker = rcSetHp(attacker, before + Math.max(1, Math.round(calcStats(attacker).hp * fractionValue(move.statusHeal, 0))));
        if (rcHp(attacker) > before) rcStateEvent(attacker, `${mvName(move)} · HP +${rcHp(attacker) - before}`);
      }
    }
    if (move?.flags?.sound && effectiveBattleItem(attacker, hit.atkAbility || attacker.ability) === 'throatspray' && rcHp(attacker) > 0) {
      rcObservedBoost(attacker, 'spa', 1, '목스프레이'); attacker.item = ''; rcStateEvent(attacker, '목스프레이 · 소모');
    }
    if (move?.selfdestruct) attacker = rcSetHp(attacker, 0);
    if (move?.id === 'glaiverush' && hit.damage > 0) {
      attacker.glaiveRushExposed = true;
      rcStateEvent(attacker, '대검돌격 · 다음 행동 전까지 받는 피해 ×2');
    }
    if (move?.id === 'doubleshock' && hit.damage > 0) {
      attacker.types = (attacker.types || PokemonById[attacker.pokemonIdx].types).filter(type => type !== 'Electric');
      rcStateEvent(attacker, '전광쌍격 · 전기 타입 소실');
    }
    return { a: attacker, d: defender, field: nextField, chance: hit.chance, damage: hit.damage };
  });
}

function rcEndOfExchange(side, opposingSide, field, forceEnd = false) {
  if (side.observationEnded || rcHp(side) <= 0 || (!forceEnd && revCalcState.observationTiming === 'hit')) return side;
  side = { ...side, ranks: { ...side.ranks }, observationEnded: true };
  const max = calcStats(side).hp;
  let hp = rcHp(side);
  const { atkAb: ability, defAb: otherAbility } = battleAbilityContext(side, opposingSide);
  const itemId = effectiveBattleItem(side, ability), item = ItemById[itemId] || {};
  const weather = effectiveWeather(field, ability, otherAbility);
  const types = side.tera ? [side.teraType] : side.types || PokemonById[side.pokemonIdx]?.types || [];
  const heal = fraction => { if (hp > 0) hp = Math.min(max, hp + Math.max(1, Math.floor(max * fraction))); };
  const hurt = fraction => { if (ability !== 'magicguard') hp = Math.max(0, hp - Math.max(1, Math.floor(max * fraction))); };
  if (weather === 'Sand' && !types.some(t => ['Rock', 'Ground', 'Steel'].includes(t)) && !['overcoat', 'sandveil', 'sandrush', 'sandforce'].includes(ability) && itemId !== 'safetygoggles') hurt(1 / 16);
  if (ability === 'dryskin') { if (weather === 'Rain') heal(1 / 8); else if (weather === 'Sun') hurt(1 / 8); }
  if (ability === 'solarpower' && weather === 'Sun') hurt(1 / 8);
  if (ability === 'raindish' && weather === 'Rain') heal(1 / 16);
  if (ability === 'icebody' && ['Snow', 'Hail'].includes(weather)) heal(1 / 16);
  if (field.terrain === 'Grassy' && isGrounded(side, field, ability, itemId)) heal(1 / 16);
  if (item.residualRecovery?.kind === 'endTurn') heal(fractionValue(item.residualRecovery.fraction, 1 / 16));
  if (itemId === 'blacksludge') { if (types.includes('Poison')) heal(1 / 16); else hurt(1 / 8); }
  if (ability === 'poisonheal' && isPoisonStatus(side.status)) heal(1 / 8);
  else if (ability !== 'magicguard') {
    if (side.status === 'Burn') hurt(ability === 'heatproof' ? 1 / 32 : 1 / 16);
    if (isPoisonStatus(side.status)) hurt(side.status === 'Toxic' ? 1 / 16 : 1 / 8);
  }
  if (hp !== rcHp(side)) rcStateEvent(side, `턴 종료 HP ${hp > rcHp(side) ? '+' : ''}${hp - rcHp(side)}`);
  if (hp > 0 && ability === 'speedboost') rcObservedBoost(side, 'spe', 1, '가속');
  return rcSetHp(side, hp);
}

function rcObservedHpMatches(side, role) {
  const raw = role === 'my' ? revCalcState.observedMyHp : revCalcState.observedTheirPct;
  if (raw === '' || raw == null) return true;
  const hp = rcHp(side);
  return role === 'my' ? hp === Number(raw) : Math.abs(Math.floor(hp / calcStats(side).hp * 100 + 1e-9) - Number(raw)) <= (revCalcState.hpTolerance || 0);
}

function rcActionChangesOwnHp(move, side, target, projectLifeOrb = false) {
  return move?.recoil || move?.drain || move?.statusHeal || move?.selfdestruct || (!projectLifeOrb && side.item === 'lifeorb') ||
    (move?.flags?.contact && (['roughskin', 'ironbarbs'].includes(target.ability) || target.item === 'rockyhelmet'));
}

function rcProjectedEndHpMatches(side, other, field, followingMove, role) {
    const hpStates = [side];
    const { atkAb } = battleAbilityContext(side, other);
    // Conservatively include both a successful hit and no Orb recoil. This prefilter
    // only removes impossible HP spreads; the full exchange still verifies each path.
    if (followingMove && followingMove.cat !== 'Status' && rcHp(side) > 0 && effectiveBattleItem(side, atkAb) === 'lifeorb' && atkAb !== 'magicguard' && !(atkAb === 'sheerforce' && followingMove.sec)) {
      hpStates.push(rcSetHp(side, rcHp(side) - Math.max(1, Math.floor(calcStats(side).hp / 10))));
    }
    return hpStates.some(s => rcObservedHpMatches(rcEndOfExchange(s, other, field), role));
}

function rcFirstHitCanMatch(a, d, move, field, role, cache, followingMove = null) {
  const key = `observed:${role}:${followingMove?.id || ''}:${rcDamageCacheKey(a, d, move, field)}`;
  if (cache.has(key)) return cache.get(key);
  const match = rcAdvanceAttack(a, d, move, field, cache).some(row => rcProjectedEndHpMatches(row.d, row.a, row.field, followingMove, role));
  cache.set(key, match);
  return match;
}

function rcExchangePaths(my, opp, myMove, oppMove, order, cache, prune = true) {
  const myFirst = order === 'my-first';
  const firstMove = myFirst ? myMove : oppMove, secondMove = myFirst ? oppMove : myMove;
  const firstField = { ...rcObservedField(myFirst ? 'dealt' : 'received'), atkMovesFirst: true, atkMovesSecond: false };
  const paths = [];
  for (const first of rcAdvanceAttack(myFirst ? my : opp, myFirst ? opp : my, firstMove, firstField, cache)) {
    // Safe pruning only when the second action cannot change its user's own HP/item.
    const targetRole = myFirst ? 'opp' : 'my';
    const selfChanges = rcActionChangesOwnHp(secondMove, first.d, first.a, true) || ['sandspit', 'seedsower'].includes(first.a.ability);
    if (prune && !selfChanges && !rcProjectedEndHpMatches(first.d, first.a, first.field, secondMove, targetRole)) continue;
    const secondField = { ...first.field, ...revCalcState.observedFields?.[myFirst ? 'received' : 'dealt'], atkMovesFirst: false, atkMovesSecond: true };
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
  // These states are not yet observable through this menu; never infer ordinary damage from them.
  for (const [role, side, incoming] of [['my', revCalcState.my, oppMove], ['opp', revCalcState.opp, myMove]]) {
    const pokemon = PokemonById[side.pokemonIdx];
    const ids = role === 'my' ? [side.ability] : rcPokemonAbilityIds(pokemon);
    if (incoming && ids.some(id => {
      const block = AbilityById[id]?.damageBlock;
      return block?.manual && damageBlockApplies(block, pokemon, { ...side, damageBlockActive: true }, incoming, incoming.cat === 'Physical');
    })) return '탈·아이스페이스의 차단 상태를 아직 입력할 수 없어 이 관측은 지원하지 않습니다. 차단이 해제된 폼이라면 해당 폼을 선택해 주세요.';
  }
  for (const [raw, max, label] of [[revCalcState.observedTheirPct, 100, '상대 남은 HP %'], [revCalcState.observedMyHp, calcStats(revCalcState.my).hp, '내 남은 HP']]) {
    if (raw !== '' && raw != null && (!Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > max)) return `${label}를 0~${max}의 정수로 입력해 주세요.`;
  }
  if (!Number.isFinite(Number(revCalcState.oppStartHpPct)) || Number(revCalcState.oppStartHpPct) < 1 || Number(revCalcState.oppStartHpPct) > 100) return '상대 시작 HP %를 1~100으로 입력해 주세요.';
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
  const orders = !oppMove ? ['my-first'] : !myMove ? ['opp-first'] : revCalcState.turnOrder === 'unknown' ? ['my-first', 'opp-first'] : [revCalcState.turnOrder];
  for (const nature of RC_NATURE_IDS) for (const ability of abilities) for (const item of rcActiveItemCandidates()) {
    const sk = `${nature}|${ability}|${item}`;
    if (!speedCache.has(sk)) speedCache.set(sk, rcSpeedCandidateInfo(oppP, nature, item, field, ability));
    const speedInfo = speedCache.get(sk);
    if (!speedInfo.valid) continue;
    for (const pair of hpPairs) {
      let pairOrders = orders;
      if (orders.includes('my-first') && hasDef && !speedCoupled && !myMove.overrideOffensivePokemon && !AbilityById[ability]?.paradoxBoost && !rcActionChangesOwnHp(oppMove, { item }, my, true) && !['sandspit', 'seedsower'].includes(my.ability)) {
        let probe = rcObservationSide(rcBuildOpponentState(oppP, { evs: { hp: pair.hp, ...(defStat ? { [defStat]: pair.defense } : {}) }, nature, ability, item }), 'opp');
        probe = rcSetHp(probe, Math.floor(calcStats(probe).hp * Number(revCalcState.oppStartHpPct ?? 100) / 100));
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
          Object.assign(opp, rcSetHp(opp, Math.floor(calcStats(opp).hp * Number(revCalcState.oppStartHpPct ?? 100) / 100)));
          let candidateOrders = pairOrders;
          if (myMove && oppMove) {
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
    const key = JSON.stringify([p.my.hpPct, p.opp.hpPct, p.my.item, p.opp.item, p.my.ranks, p.opp.ranks, p.my.types, p.opp.types, p.my.glaiveRushExposed, p.opp.glaiveRushExposed, p.my.stateEvents, p.opp.stateEvents, p.my.unburdenActive, p.opp.unburdenActive, p.field.weather, p.field.terrain, p.order]);
    if (result.has(key)) result.get(key).chance += p.chance;
    else result.set(key, { ...p });
  }
  return [...result.values()];
}
