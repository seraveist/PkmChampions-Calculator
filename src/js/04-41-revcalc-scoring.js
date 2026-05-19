/* Reverse calculator scoring, grouping, completion, and follow-up helpers. */
function rcNatureCandidatesForMove(move) {
  if (!move || move.cat === 'Status') return RC_NATURE_IDS;
  if (move.cat === 'Physical') return ['adamant', 'jolly', 'impish', 'bold', 'careful', 'calm'];
  if (move.cat === 'Special') return ['modest', 'timid', 'impish', 'bold', 'careful', 'calm'];
  return RC_NATURE_IDS;
}

function rcMagicEvsForStat(oppP, stat) {
  if (!oppP?.bs?.[stat] || stat === 'hp') return [];
  const out = [];
  let first = (10 - ((oppP.bs[stat] + 20) % 10)) % 10;
  if (first === 0) first = 10;
  for (let ev = first; ev <= 32; ev += 10) out.push(ev);
  return out;
}

function rcSecondMagicEv(oppP, stat) {
  const magic = rcMagicEvsForStat(oppP, stat);
  return magic[1] ?? magic[0] ?? 0;
}

function rcCandidateObservedEvs(c, speedActive, useSpeedMax = false) {
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (c.defStat) {
    evs.hp = Math.max(evs.hp, c.hpEv || 0);
    evs[c.defStat] = Math.max(evs[c.defStat], c.defEv || 0);
  }
  if (c.atkStat) evs[c.atkStat] = Math.max(evs[c.atkStat], c.atkEv || 0);
  if (speedActive) evs.spe = Math.max(evs.spe, useSpeedMax ? (c.speEvMax ?? c.speEv ?? 0) : (c.speEvMin ?? c.speEv ?? 0));
  return evs;
}

function rcCandidatePointSum(c) {
  const evs = rcCandidateObservedEvs(c, true);
  return ['hp','atk','def','spa','spd','spe'].reduce((sum, stat) => sum + (evs[stat] || 0), 0);
}

function rcCandidateKnownPointSum(c) {
  const evs = rcCandidateObservedEvs(c, false);
  return ['hp','atk','def','spa','spd','spe'].reduce((sum, stat) => sum + (evs[stat] || 0), 0);
}

function rcItemAssumptionScore(c) {
  if (!c.item) return 3;
  const itemData = ItemById[c.item];
  if (itemData?.typeBoostType && rcKnownOpponentItem() !== c.item) return -1;
  if (c.item === 'choicescarf') return 0;
  return 1;
}

function rcOppAttackProfile(c) {
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  const atkBase = oppP?.bs?.atk || 0;
  const spaBase = oppP?.bs?.spa || 0;
  const diff = Math.abs(atkBase - spaBase);
  const mixed = diff <= 20;
  const favored = mixed ? null : (atkBase > spaBase ? 'atk' : 'spa');
  const used = c.atkStat || null;
  const opposite = used === 'spa' ? 'atk' : used === 'atk' ? 'spa' : null;
  return { atkBase, spaBase, diff, mixed, favored, used, opposite };
}

function rcNatureFitScore(c) {
  const nature = NATURE_BY_ID[c.nature];
  if (!nature) return 0;
  const profile = rcOppAttackProfile(c);
  let score = 0;
  if (profile.used) {
    if (nature.up === profile.used) score += profile.favored === profile.used || profile.mixed ? 5 : 3;
    if (nature.down === profile.used) score -= 12;

    if (nature.down === profile.opposite) score += profile.mixed ? 0 : 4;
    if (!profile.mixed && profile.favored && profile.used !== profile.favored) score -= 2;
    if (!profile.mixed && profile.favored && nature.up === profile.favored && profile.used !== profile.favored) score -= 2;
  }
  if (c.defStat) {
    if (nature.down === c.defStat) score -= 4;
  }
  if (nature.down === 'def' || nature.down === 'spd') score -= profile.mixed ? 3 : 6;
  if (nature.down === 'spe' && revCalcState.turnOrder !== 'my-first') score -= 2;
  return score;
}

function rcEvRangeForStat(c, stat, speedActive = !!c.speedInfo?.active) {
  if (stat === 'hp') return [c.hpEvMin ?? c.hpEv ?? 0, c.hpEvMax ?? c.hpEv ?? 0];
  if (stat === 'spe') {
    const min = speedActive ? (c.speEvMin ?? c.speEv ?? 0) : 0;
    const max = speedActive ? (c.speEvMax ?? min) : 32;
    return [min, max];
  }
  if (c.defStat === stat) return [c.defEvMin ?? c.defEv ?? 0, c.defEvMax ?? c.defEv ?? 0];
  if (c.atkStat === stat) return [c.atkEvMin ?? c.atkEv ?? 0, c.atkEvMax ?? c.atkEv ?? 0];
  return [0, 32];
}

function rcCandidateRangeSum(c, stats, speedActive = !!c.speedInfo?.active) {
  let min = 0;
  let max = 0;
  for (const stat of stats) {
    const range = rcEvRangeForStat(c, stat, speedActive);
    min += range[0];
    max += range[1];
  }
  return [min, max];
}

function rcRolePriority(c, speedActive = !!c.speedInfo?.active) {
  const usedAtk = c.atkStat || 'spa';
  const defStats = usedAtk === 'atk' ? ['def', 'spd'] : ['spd', 'def'];
  const fastByObservation = speedActive && (c.speEvMin ?? c.speEv ?? 0) >= rcSecondMagicEv(PokemonById[revCalcState.opp.pokemonIdx], 'spe');
  const isScarf = c.item === 'choicescarf';

  if (c.nature === 'bold' || c.nature === 'impish') {
    return {
      label: '물리막이형',
      priority: ['hp', 'def', usedAtk, 'spd', 'spe'].filter((v, i, arr) => arr.indexOf(v) === i),
    };
  }
  if (c.nature === 'calm' || c.nature === 'careful') {
    return {
      label: '특수막이형',
      priority: ['hp', 'spd', usedAtk, 'def', 'spe'].filter((v, i, arr) => arr.indexOf(v) === i),
    };
  }
  if (c.nature === 'timid' || c.nature === 'jolly') {
    return {
      label: isScarf ? '스카프 어태커형' : '고속 어태커형',
      priority: [usedAtk, 'spe', 'hp', ...defStats].filter((v, i, arr) => arr.indexOf(v) === i),
    };
  }
  if (c.nature === 'modest' || c.nature === 'adamant') {
    return {
      label: isScarf ? '스카프 어태커형' : (fastByObservation ? '고속 어태커형' : '딜탱형'),
      priority: fastByObservation
        ? [usedAtk, 'spe', 'hp', ...defStats].filter((v, i, arr) => arr.indexOf(v) === i)
        : [usedAtk, 'hp', ...defStats, 'spe'].filter((v, i, arr) => arr.indexOf(v) === i),
    };
  }
  return {
    label: '혼합형',
    priority: [usedAtk, 'hp', 'spe', ...defStats].filter((v, i, arr) => arr.indexOf(v) === i),
  };
}

function rcRoleCompletionInfo(c, speedActive = !!c.speedInfo?.active) {
  const stats = ['hp','atk','def','spa','spd','spe'];
  const role = rcRolePriority(c, speedActive);
  const evs = {};
  const maxes = {};
  for (const stat of stats) {
    const [min, max] = rcEvRangeForStat(c, stat, speedActive);
    evs[stat] = min;
    maxes[stat] = max;
  }

  let remaining = Math.max(0, 66 - stats.reduce((sum, stat) => sum + (evs[stat] || 0), 0));
  const fillOrder = [...role.priority, ...stats].filter((stat, idx, arr) => stats.includes(stat) && arr.indexOf(stat) === idx);
  for (const stat of fillOrder) {
    if (remaining <= 0) break;
    const room = Math.max(0, Math.min(32, maxes[stat] ?? 32) - (evs[stat] || 0));
    const add = Math.min(room, remaining);
    evs[stat] += add;
    remaining -= add;
  }

  const labels = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };
  const parts = stats
    .filter(stat => evs[stat] > 0)
    .map(stat => `${labels[stat]}${evs[stat]}`);
  return { label: role.label, priority: role.priority, evs, parts, remaining };
}

function rcRolePresetScore(c) {
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  const nature = NATURE_BY_ID[c.nature];
  if (!oppP || !nature) return 0;

  const speedActive = !!c.speedInfo?.active;
  const usedAtk = c.atkStat;
  const offenseMagicList = usedAtk ? rcMagicEvsForStat(oppP, usedAtk) : [];
  const speedMagicList = rcMagicEvsForStat(oppP, 'spe');
  const firstOffenseMagic = offenseMagicList[0] ?? 0;
  const secondOffenseMagic = offenseMagicList[1] ?? firstOffenseMagic;
  const firstSpeedMagic = speedMagicList[0] ?? 0;
  const secondSpeedMagic = speedMagicList[1] ?? firstSpeedMagic;
  const [atkMin, atkMax] = usedAtk ? rcEvRangeForStat(c, usedAtk, speedActive) : [0, 0];
  const [speMin, speMax] = rcEvRangeForStat(c, 'spe', speedActive);
  const [physBulkMin, physBulkMax] = rcCandidateRangeSum(c, ['hp', 'def'], speedActive);
  const [specBulkMin, specBulkMax] = rcCandidateRangeSum(c, ['hp', 'spd'], speedActive);

  let score = 0;
  const isScarf = c.item === 'choicescarf';
  const isSpeedNature = c.nature === 'timid' || c.nature === 'jolly';
  const isDefNature = ['bold', 'impish', 'calm', 'careful'].includes(c.nature);
  const isOffNature = c.nature === 'modest' || c.nature === 'adamant';
  const matchingOffNature = usedAtk && nature.up === usedAtk;
  const matchingSpeedNature = isSpeedNature && nature.up === 'spe';
  const wantedBulkMin = (c.nature === 'bold' || c.nature === 'impish') ? physBulkMin : specBulkMin;
  const wantedBulkMax = (c.nature === 'bold' || c.nature === 'impish') ? physBulkMax : specBulkMax;
  const observedBulkMin = c.defStat ? (c.hpEvMin ?? c.hpEv ?? 0) + (c.defEvMin ?? c.defEv ?? 0) : 0;
  const observedBulkMax = c.defStat ? (c.hpEvMax ?? c.hpEv ?? 0) + (c.defEvMax ?? c.defEv ?? 0) : 0;
  const completion = rcRoleCompletionInfo(c, speedActive);
  const completedAtk = usedAtk ? completion.evs[usedAtk] || 0 : 0;
  const completedSpeed = completion.evs.spe || 0;
  const completedPhysBulk = (completion.evs.hp || 0) + (completion.evs.def || 0);
  const completedSpecBulk = (completion.evs.hp || 0) + (completion.evs.spd || 0);
  const completedWantedBulk = (c.nature === 'bold' || c.nature === 'impish') ? completedPhysBulk : completedSpecBulk;

  if (usedAtk) {
    if (atkMin >= secondOffenseMagic) score += 8;
    else if (atkMax >= secondOffenseMagic) score += 4;
    else if (atkMax >= firstOffenseMagic) score += 2;
    if (matchingOffNature) score += 5;
    if (isOffNature && !matchingOffNature) score -= 5;
  }

  if (matchingSpeedNature) {
    if (isScarf) {
      if (revCalcState.turnOrder === 'my-first') score -= 8;
      if (speMax < firstSpeedMagic) score -= 8;
      else if (speMin >= firstSpeedMagic) score += 2;
    } else if (speMin >= secondSpeedMagic) {
      score += 9;
    } else if (speMax >= secondSpeedMagic) {
      score += 4;
    } else {
      score -= 7;
    }
  }

  if (isDefNature) {
    if (isScarf) score -= 18;
    if (speMin === 0) score += 5;
    else if (speMin <= firstSpeedMagic) score += 2;
    if (speMin >= secondSpeedMagic) score -= 8;
    else if (speMin >= firstSpeedMagic) score -= 3;

    if (wantedBulkMin >= 40) score += 12;
    else if (wantedBulkMax >= 40) score += 7;
    else score -= 6;

    if (observedBulkMin >= 40) score += 4;
    else if (observedBulkMax >= 40) score += 2;

    if (usedAtk) {
      if (atkMax >= secondOffenseMagic) score += 2;
      else if (atkMax < firstOffenseMagic) score -= 2;
    }

    if (completedWantedBulk >= 52) score += 8;
    else if (completedWantedBulk >= 40) score += 5;
    if (completedSpeed === 0) score += 3;
    else if (completedSpeed >= secondSpeedMagic) score -= 6;
  }

  if (isOffNature && usedAtk) {
    const bulkyAttacker = Math.max(physBulkMax, specBulkMax) >= 32 && speMin < secondSpeedMagic;
    const fastAttacker = speMin >= secondSpeedMagic;
    if (atkMin >= secondOffenseMagic) score += 5;
    else if (atkMax >= secondOffenseMagic) score += 3;
    if (bulkyAttacker) score += 5;
    if (fastAttacker) score += 4;
    if (!bulkyAttacker && !fastAttacker) score -= 2;

    if (completedAtk >= secondOffenseMagic) score += 5;
    if (completion.label === '딜탱형' && (completedPhysBulk >= 40 || completedSpecBulk >= 40)) score += 4;
    if (completion.label === '고속 어태커형' && completedSpeed >= secondSpeedMagic) score += 4;
  }

  if (isScarf && usedAtk) {
    if (atkMax < secondOffenseMagic) score -= 8;
    else score += 1;
    if (revCalcState.turnOrder === 'opp-first') score += c.hasNonScarfAlternative ? 2 : 8;
    if (revCalcState.turnOrder === 'my-first') score -= 5;
  }

  if (!isScarf) score += 2;

  const itemData = ItemById[c.item];
  if (itemData?.typeBoostType && revCalcState.oppMove && MoveById[revCalcState.oppMove]?.type === itemData.typeBoostType) {
    score += rcKnownOpponentItem() === c.item ? 1 : -4;
  }

  return score;
}

function rcPracticalProfileScore(c) {
  return rcNatureFitScore(c) + rcRolePresetScore(c);
}

function rcCompareCandidates(a, b) {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  const practicalDiff = rcPracticalProfileScore(b) - rcPracticalProfileScore(a);
  if (practicalDiff) return practicalDiff;
  const itemDiff = rcItemAssumptionScore(b) - rcItemAssumptionScore(a);
  if (itemDiff) return itemDiff;
  if ((b.atkEv || 0) !== (a.atkEv || 0)) return (b.atkEv || 0) - (a.atkEv || 0);
  if ((b.hpEv || 0) !== (a.hpEv || 0)) return (b.hpEv || 0) - (a.hpEv || 0);
  return (a.totalEv || rcCandidatePointSum(a)) - (b.totalEv || rcCandidatePointSum(b));
}

function rcRangeLabel(min, max) {
  return min === max ? `${min}` : `${min}~${max}`;
}

function rcCandidateEvParts(c, speedActive) {
  const parts = [];
  const ranges = {
    hp: [c.hpEvMin ?? c.hpEv ?? 0, c.hpEvMax ?? c.hpEv ?? 0],
    atk: [0, 0],
    def: [0, 0],
    spa: [0, 0],
    spd: [0, 0],
    spe: [0, 0],
  };
  if (c.defStat && ranges[c.defStat]) {
    ranges[c.defStat] = [
      c.defEvMin ?? c.defEv ?? 0,
      c.defEvMax ?? c.defEv ?? 0,
    ];
  }
  if (c.atkStat && ranges[c.atkStat]) {
    const atkRange = [
      c.atkEvMin ?? c.atkEv ?? 0,
      c.atkEvMax ?? c.atkEv ?? 0,
    ];
    ranges[c.atkStat] = [
      Math.max(ranges[c.atkStat][0], atkRange[0]),
      Math.max(ranges[c.atkStat][1], atkRange[1]),
    ];
  }
  if (speedActive) {
    const speMin = c.speEvMin ?? c.speEv ?? 0;
    const speMax = c.speEvMax ?? speMin;
    ranges.spe = [speMin, speMax];
  } else if (c.speEv > 0) {
    ranges.spe = [c.speEv, c.speEv];
  }
  const labels = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };
  for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
    const [min, max] = ranges[stat];
    if (min > 0 || max > 0 || (stat === 'spe' && speedActive)) {
      parts.push(`${labels[stat]}${rcRangeLabel(min, max)}`);
    }
  }
  return parts;
}

function rcPointRangeLabel(min, max) {
  return min === max ? `${min}포인트` : `${min}~${max}포인트`;
}

function rcSpeedPlanLabel(c, speedActive) {
  if (!speedActive) return '속도 미사용';
  return c.item === 'choicescarf' ? '스카프 속도형' : '비스카프 고속형';
}

function rcBriefInvestmentParts(c, speedActive) {
  const roleLabel = { atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };
  const hpMin = c.hpEvMin ?? c.hpEv ?? 0;
  const hpMax = c.hpEvMax ?? c.hpEv ?? 0;
  const defMinEv = c.defEvMin ?? c.defEv ?? 0;
  const defMaxEv = c.defEvMax ?? c.defEv ?? 0;
  const defRole = c.defStat ? `H+${roleLabel[c.defStat] || c.defStat}` : 'H';
  const defMin = hpMin + defMinEv;
  const defMax = hpMax + defMaxEv;
  const atkRole = c.atkStat ? roleLabel[c.atkStat] || c.atkStat : 'A/C';
  const atkMin = c.atkEvMin ?? c.atkEv ?? 0;
  const atkMax = c.atkEvMax ?? c.atkEv ?? 0;
  const speMin = speedActive ? (c.speEvMin ?? c.speEv ?? 0) : (c.speEv || 0);
  const speMax = speedActive ? (c.speEvMax ?? speMin) : speMin;
  return [
    `${defRole} ${rcPointRangeLabel(defMin, defMax)}`,
    `${atkRole} ${rcPointRangeLabel(atkMin, atkMax)}`,
    `S ${rcPointRangeLabel(speMin, speMax)}`,
  ].join(', ');
}

function rcMoveDefenseStat(move) {
  if (!move || move.cat === 'Status') return null;
  if (move.overrideDefensiveStat) return move.overrideDefensiveStat;
  return move.cat === 'Physical' ? 'def' : 'spd';
}

function rcMoveOffenseStat(move) {
  if (!move || move.cat === 'Status') return null;
  if (move.overrideOffensivePokemon === 'target') return null;
  if (move.overrideOffensiveStat) return move.overrideOffensiveStat;
  return move.cat === 'Physical' ? 'atk' : 'spa';
}

function rcCandidateEvRange(c, stat, speedActive) {
  if (stat === 'hp') {
    if (c.defStat) return { min: c.hpEvMin ?? c.hpEv ?? 0, max: c.hpEvMax ?? c.hpEv ?? 0, known: true };
    return { min: 0, max: 32, known: false };
  }
  if (stat === 'spe') {
    if (speedActive) return { min: c.speEvMin ?? c.speEv ?? 0, max: c.speEvMax ?? c.speEv ?? 0, known: true };
    return { min: 0, max: 32, known: false };
  }
  if (stat === c.defStat) return { min: c.defEvMin ?? c.defEv ?? 0, max: c.defEvMax ?? c.defEv ?? 0, known: true };
  if (stat === c.atkStat) return { min: c.atkEvMin ?? c.atkEv ?? 0, max: c.atkEvMax ?? c.atkEv ?? 0, known: true };
  return { min: 0, max: Math.max(0, Math.min(32, rcMaxAllocatableEvForStat(c, stat, speedActive))), known: false };
}

function rcForEachEvInRange(range, fn) {
  const min = Math.max(0, Math.min(32, range.min ?? 0));
  const max = Math.max(min, Math.min(32, range.max ?? min));
  for (let ev = min; ev <= max; ev++) fn(ev);
}

function rcObservedOpponentRemainingValues(oppState, field) {
  const observedPct = parseInt(revCalcState.observedTheirPct, 10);
  const move = revCalcState.myMove ? MoveById[revCalcState.myMove] : null;
  const hp = calcStats(oppState).hp;
  if (!move || move.cat === 'Status' || !Number.isFinite(observedPct)) {
    return [Math.max(1, Math.floor(hp * Math.max(1, Math.min(100, observedPct || 100)) / 100))];
  }
  const moveData = { ...move, bp: parseInt(revCalcState.myMoveBp, 10) || move.bp };
  const result = calculateDamage(revCalcState.my, oppState, moveData, field);
  const values = new Set();
  for (const damage of result?.damages || []) {
    const remaining = Math.max(0, hp - damage);
    if (Math.floor(remaining / hp * 100) === observedPct) values.add(remaining);
  }
  if (values.size) return [...values];
  return [Math.max(0, Math.floor(hp * Math.max(0, Math.min(100, observedPct)) / 100))];
}

function rcUpdateDamageBounds(bounds, damages, hp, currentHpValues) {
  for (const damage of damages || []) {
    bounds.rawMin = Math.min(bounds.rawMin, damage);
    bounds.rawMax = Math.max(bounds.rawMax, damage);
    bounds.pctMin = Math.min(bounds.pctMin, damage / hp * 100);
    bounds.pctMax = Math.max(bounds.pctMax, damage / hp * 100);
    for (const currentHp of currentHpValues) {
      bounds.koChecks++;
      if (damage >= currentHp) bounds.koHits++;
    }
  }
}

function rcFinalizeDamageBounds(bounds) {
  if (!bounds.koChecks || bounds.rawMin === Infinity) return null;
  const koClass = bounds.koHits === bounds.koChecks
    ? 'ko-certain'
    : bounds.koHits > 0
      ? 'ko-roll'
      : 'ko-none';
  const koState = koClass === 'ko-certain'
    ? 'KO 확정'
    : koClass === 'ko-roll'
      ? 'KO 난수'
      : 'KO 불가';
  return {
    rawMin: bounds.rawMin,
    rawMax: bounds.rawMax,
    pctMin: bounds.pctMin,
    pctMax: bounds.pctMax,
    koState,
    koClass,
  };
}

function rcDamageBounds() {
  return { rawMin: Infinity, rawMax: 0, pctMin: Infinity, pctMax: 0, koChecks: 0, koHits: 0 };
}

function rcSpeedUnconfirmed() {
  if (revCalcState.turnOrder === 'unknown') return false;
  const myMove = revCalcState.myMove ? MoveById[revCalcState.myMove] : null;
  const oppMove = revCalcState.oppMove ? MoveById[revCalcState.oppMove] : null;
  return !!((myMove && (myMove.pri || 0) !== 0) || (oppMove && (oppMove.pri || 0) !== 0));
}

function rcAnalyzeMyFollowupMove(c, moveId, speedActive) {
  const move = MoveById[moveId];
  if (!move || move.cat === 'Status') return null;
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (!oppP) return null;
  const field = rcAnalysisField();
  const observedField = rcObservedField('dealt');
  const nextRanks = rcNextOpponentRanks();
  const myNext = rcBuildMyNextState();
  const moveData = { ...move };
  const defStat = rcMoveDefenseStat(move);
  const hpRange = rcCandidateEvRange(c, 'hp', speedActive);
  const defRange = defStat ? rcCandidateEvRange(c, defStat, speedActive) : { min: 0, max: 0, known: true };
  const badges = [];
  if (!hpRange.known || !defRange.known) badges.push('내구 미확인');
  const bounds = rcDamageBounds();
  rcForEachEvInRange(hpRange, hpEv => {
    rcForEachEvInRange(defRange, defEv => {
      const evs = { hp: hpEv };
      if (defStat) evs[defStat] = defEv;
      const oppState = rcBuildOpponentState(oppP, { evs, nature: c.nature, item: c.item || '', ability: c.ability || '', ranks: nextRanks });
      const hp = calcStats(oppState).hp;
      const currentHpValues = rcObservedOpponentRemainingValues(oppState, observedField);
      const result = calculateDamage(myNext, oppState, moveData, field);
      rcUpdateDamageBounds(bounds, result?.damages || [], hp, currentHpValues);
    });
  });
  const summary = rcFinalizeDamageBounds(bounds);
  if (!summary) return null;
  return { move, summary, badges };
}

function rcAnalyzeOpponentFollowupMove(c, moveId, speedActive) {
  const move = MoveById[moveId];
  if (!move) return null;
  if (move.cat === 'Status') {
    const badges = ['공격축 미확인'];
    if (rcSpeedUnconfirmed()) badges.push('속도 미확인');
    return { move, statusMove: true, badges };
  }
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (!oppP) return null;
  const field = rcAnalysisField();
  const nextRanks = rcNextOpponentRanks();
  const myNext = rcBuildMyNextState();
  const atkStat = rcMoveOffenseStat(move);
  const atkRange = atkStat ? rcCandidateEvRange(c, atkStat, speedActive) : { min: 0, max: 32, known: false };
  const hpRange = rcCandidateEvRange(c, 'hp', speedActive);
  const badges = [];
  if (!atkRange.known) badges.push('공격축 미확인');
  if (rcSpeedUnconfirmed()) badges.push('속도 미확인');
  const myMaxHp = calcStats(revCalcState.my).hp;
  const observedMyHp = parseInt(revCalcState.observedMyHp, 10);
  const currentMyHp = Number.isFinite(observedMyHp) && observedMyHp >= 0 ? observedMyHp : myMaxHp;
  const bounds = rcDamageBounds();
  rcForEachEvInRange(hpRange, hpEv => {
    rcForEachEvInRange(atkRange, atkEv => {
      const evs = { hp: hpEv };
      if (atkStat) evs[atkStat] = atkEv;
      const oppState = rcBuildOpponentState(oppP, { evs, nature: c.nature, item: c.item || '', ability: c.ability || '', ranks: nextRanks });
      const result = calculateDamage(oppState, myNext, move, field);
      rcUpdateDamageBounds(bounds, result?.damages || [], myMaxHp, [currentMyHp]);
    });
  });
  const summary = rcFinalizeDamageBounds(bounds);
  if (!summary) return null;
  return { move, summary, badges };
}

function rcFormatPct(value) {
  return `${value.toFixed(1)}%`;
}

function rcFormatDamage(summary) {
  const pct = `${rcFormatPct(summary.pctMin)}~${rcFormatPct(summary.pctMax)}`;
  return pct;
}

function rcRenderInfoBadges(badges) {
  const unique = [...new Set((badges || []).filter(Boolean))];
  if (!unique.length) return '';
  return `<span class="rc-info-badges">${unique.map(b => `<span class="rc-info-badge">${escapeHTML(b)}</span>`).join('')}</span>`;
}

function rcRenderFollowupMoveChip(analysis) {
  if (!analysis) return '';
  const badgeHtml = rcRenderInfoBadges(analysis.badges);
  if (analysis.statusMove) {
    return `
      <div class="rc-followup-chip status">
        <b>${escapeHTML(mvName(analysis.move))}</b>
        <span class="rc-followup-damage status">변화기</span>
        ${badgeHtml || '<span></span>'}
        <em>직접 피해 없음</em>
      </div>
    `;
  }
  const koClass = analysis.summary.koClass || 'ko-none';
  return `
    <div class="rc-followup-chip">
      <em class="${koClass}">${escapeHTML(analysis.summary.koState)}</em>
      <b>${escapeHTML(mvName(analysis.move))}</b>
      <span class="rc-followup-damage ${koClass}">${rcFormatDamage(analysis.summary)}</span>
      ${badgeHtml || '<span></span>'}
    </div>
  `;
}

function rcRenderNextRankCells(ranks, action) {
  return ['atk','def','spa','spd','spe'].map(stat => {
    const value = ranks[stat] || 0;
    return `
      <div class="rc-next-rank-cell">
        <button type="button" data-rc-${action}="${stat}" data-rc-dir="-1">-</button>
        <b class="${value > 0 ? 'pos' : value < 0 ? 'neg' : ''}">${value > 0 ? '+' + value : value}</b>
        <button type="button" data-rc-${action}="${stat}" data-rc-dir="1">+</button>
      </div>
    `;
  }).join('');
}

function rcRenderNextRankPanel() {
  const myRanks = rcNextMyRanks();
  const oppRanks = rcNextOpponentRanks();
  const isOpen = !!revCalcState.nextRankOpen;
  return `
    <div class="rc-next-rank-panel ui-control-frame ui-subframe ${isOpen ? 'open' : 'collapsed'}">
      <button type="button" class="rc-next-rank-title" data-rc-toggle-next-ranks aria-expanded="${isOpen ? 'true' : 'false'}">
        <b>다음 행동 랭크</b>
        <span>${isOpen ? '접기' : '펼치기'}</span>
      </button>
      <div class="rc-next-rank-table" ${isOpen ? '' : 'hidden'}>
        <div class="rc-next-rank-head" aria-hidden="true">
          <span></span><span>공격</span><span>방어</span><span>특공</span><span>특방</span><span>속도</span>
        </div>
        <div class="rc-next-rank-row">
          <span class="rc-next-rank-group-label">내 랭크</span>
          ${rcRenderNextRankCells(myRanks, 'nextmyrank')}
        </div>
        <div class="rc-next-rank-row">
          <span class="rc-next-rank-group-label">상대 랭크</span>
          ${rcRenderNextRankCells(oppRanks, 'nextrank')}
        </div>
      </div>
    </div>
  `;
}

function rcObservedEvStats(c, speedActive) {
  const observed = new Set();
  if (c.defStat) {
    observed.add('hp');
    observed.add(c.defStat);
  }
  if (c.atkStat) observed.add(c.atkStat);
  if (speedActive) observed.add('spe');
  return observed;
}

function rcCandidateCompletionInfo(c, speedActive) {
  const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const evs = rcCandidateObservedEvs(c, speedActive, false);
  const observed = rcObservedEvStats(c, speedActive);
  const speMin = speedActive ? (c.speEvMin ?? c.speEv ?? 0) : 0;
  const speMax = speedActive ? (c.speEvMax ?? speMin) : 32;
  evs.spe = Math.max(evs.spe, speMin);

  const minTotal = stats.reduce((sum, stat) => sum + (evs[stat] || 0), 0);
  let capacityTotal = 0;
  for (const stat of stats) {
    if (stat === 'spe') capacityTotal += Math.max(evs.spe || 0, speMax);
    else capacityTotal += observed.has(stat) ? (evs[stat] || 0) : 32;
  }
  const canComplete = minTotal <= 66 && capacityTotal >= 66;
  return {
    canComplete,
    minTotal,
    maxTotal: Math.min(66, capacityTotal),
    capacityTotal,
    remainingMin: Math.max(0, 66 - capacityTotal),
    remainingMax: Math.max(0, 66 - minTotal),
    speMin,
    speMax,
  };
}

function rcMaxAllocatableEvForStat(c, stat, speedActive) {
  if (c.defStat === stat) return c.defEv || 0;
  if (c.atkStat === stat) return c.atkEv || 0;
  const evs = rcCandidateObservedEvs(c, speedActive, false);
  const used = ['hp','atk','def','spa','spd','spe'].reduce((sum, key) => sum + (evs[key] || 0), 0);
  return Math.max(0, Math.min(32, 66 - used));
}

function rcMaxPossibleBulk(c, bulkStat, speedActive) {
  const evs = rcCandidateObservedEvs(c, speedActive, false);
  const hpFixed = !!c.defStat;
  const bulkFixed = c.defStat === bulkStat || c.atkStat === bulkStat;
  const usedOther = ['hp','atk','def','spa','spd','spe']
    .filter(stat => stat !== 'hp' && stat !== bulkStat)
    .reduce((sum, stat) => sum + (evs[stat] || 0), 0);
  const hpMax = hpFixed ? (c.hpEv || 0) : 32;
  const bulkMax = bulkFixed ? (evs[bulkStat] || 0) : 32;
  return Math.max(0, Math.min(hpMax + bulkMax, 66 - usedOther));
}

function rcApplyNatureInvestmentPreset(candidate, oppP, oppMove, speedActive) {
  const nature = candidate.nature || 'hardy';
  const next = { ...candidate };

  if (nature === 'modest') {
    const required = rcSecondMagicEv(oppP, 'spa');
    if (candidate.atkStat !== 'spa' || (candidate.atkEv || 0) < required) return null;
  } else if (nature === 'adamant') {
    const required = rcSecondMagicEv(oppP, 'atk');
    if (candidate.atkStat !== 'atk' || (candidate.atkEv || 0) < required) return null;
  }

  if ((nature === 'timid' || nature === 'jolly') && candidate.item !== 'choicescarf') {
    const required = rcSecondMagicEv(oppP, 'spe');
    if ((candidate.speEvMax ?? candidate.speEv ?? 0) < required) return null;
    next.speEvMin = Math.max(candidate.speEvMin ?? candidate.speEv ?? 0, required);
    next.speEv = next.speEvMin;
  }

  if (nature === 'bold' || nature === 'impish') {
    if (rcMaxPossibleBulk(next, 'def', speedActive) < 40) return null;
  } else if (nature === 'calm' || nature === 'careful') {
    if (rcMaxPossibleBulk(next, 'spd', speedActive) < 40) return null;
  }

  const knownEv = rcCandidateKnownPointSum(next);
  const speMin = speedActive ? (next.speEvMin ?? next.speEv ?? 0) : 0;
  const speMaxRaw = speedActive ? (next.speEvMax ?? speMin) : 32;
  const speMax = Math.min(speMaxRaw, Math.max(0, 66 - knownEv));
  if (speMin > speMax) return null;
  next.knownEv = knownEv;
  next.speEv = speMin;
  next.speEvMin = speMin;
  next.speEvMax = speMax;
  next.totalEv = knownEv + speMin;
  next.maxTotalEv = knownEv + speMax;

  const completion = rcCandidateCompletionInfo(next, speedActive);
  if (!completion.canComplete) return null;
  next.completion = completion;
  return next;
}

function rcIsBetterGroupRepresentative(candidate, group) {
  if ((candidate.totalScore || 0) !== (group.totalScore || 0)) return (candidate.totalScore || 0) > (group.totalScore || 0);
  const practicalDiff = rcPracticalProfileScore(candidate) - rcPracticalProfileScore(group);
  if (practicalDiff) return practicalDiff > 0;
  if ((candidate.hpEv || 0) !== (group.hpEv || 0)) return (candidate.hpEv || 0) > (group.hpEv || 0);
  if ((candidate.defEv || 0) !== (group.defEv || 0)) return (candidate.defEv || 0) < (group.defEv || 0);
  if ((candidate.atkEv || 0) !== (group.atkEv || 0)) return (candidate.atkEv || 0) > (group.atkEv || 0);
  return (candidate.speEvMin ?? candidate.speEv ?? 0) < (group.speEvMin ?? group.speEv ?? 0);
}

function rcBulkPriorityGroup(c) {
  if (!c.defStat) return 'none';
  return (c.defEv || 0) > 0 ? `${c.defStat}:hp32` : `${c.defStat}:hp-only`;
}

function rcCandidateGroupKey(c) {
  return [
    c.nature || '',
    c.item || '',
    c.defStat || '',
    c.atkStat || '',
    rcBulkPriorityGroup(c),
    Math.round((c.defScore || 0) * 16),
    Math.round((c.atkScore || 0) * 16),
    rcSpeedPlanLabel(c, !!c.speedInfo?.active),
  ].join('|');
}

function rcCandidateAbilityIds(c) {
  const ids = Array.isArray(c.abilityIds)
    ? c.abilityIds
    : (c.abilityImpact && c.ability ? [c.ability] : []);
  return ids.filter((id, idx, arr) => id && arr.indexOf(id) === idx)
    .sort((a, b) => {
      const aName = abName(AbilityById[a] || { name: a });
      const bName = abName(AbilityById[b] || { name: b });
      return RC_MOVE_COLLATOR ? RC_MOVE_COLLATOR.compare(aName, bName) : aName.localeCompare(bName);
    });
}

function rcAddCandidateAbilityToGroup(group, c) {
  if (!c.abilityImpact || !c.ability) return;
  if (!Array.isArray(group.abilityIds)) group.abilityIds = [];
  if (!group.abilityIds.includes(c.ability)) group.abilityIds.push(c.ability);
  group.abilityImpact = true;
}

function rcGroupCandidates(candidates) {
  const groups = [];
  const byKey = new Map();
  for (const c of candidates) {
    const key = rcCandidateGroupKey(c);
    let group = byKey.get(key);
    if (!group) {
      group = {
        ...c,
        groupCount: 0,
        hpEvMin: c.hpEv || 0,
        hpEvMax: c.hpEv || 0,
        defEvMin: c.defEv || 0,
        defEvMax: c.defEv || 0,
        atkEvMin: c.atkEv || 0,
        atkEvMax: c.atkEv || 0,
        speEvMin: c.speEvMin ?? c.speEv ?? 0,
        speEvMax: c.speEvMax ?? c.speEv ?? 0,
        oppHpMin: c.oppHp || 0,
        oppHpMax: c.oppHp || 0,
        totalEvMin: c.totalEv || 0,
        totalEvMax: c.maxTotalEv ?? c.totalEv ?? 0,
        bestTotalScore: c.totalScore || 0,
        bestPracticalScore: rcPracticalProfileScore(c),
        defHitMin: Math.round((c.defScore || 0) * 16),
        defHitMax: Math.round((c.defScore || 0) * 16),
        atkHitMin: Math.round((c.atkScore || 0) * 16),
        atkHitMax: Math.round((c.atkScore || 0) * 16),
        completionMinTotal: c.completion?.minTotal ?? c.totalEv ?? 0,
        completionMaxTotal: c.completion?.maxTotal ?? c.maxTotalEv ?? c.totalEv ?? 0,
        abilityIds: [],
      };
      byKey.set(key, group);
      groups.push(group);
    } else if (rcIsBetterGroupRepresentative(c, group)) {
      Object.assign(group, {
        nature: c.nature,
        ability: c.ability,
        abilityImpact: c.abilityImpact,
        item: c.item,
        defStat: c.defStat,
        atkStat: c.atkStat,
        hpEv: c.hpEv,
        defEv: c.defEv,
        atkEv: c.atkEv,
        speEv: c.speEv,
        oppHp: c.oppHp,
        oppDef: c.oppDef,
        oppAtk: c.oppAtk,
        totalScore: c.totalScore,
        defScore: c.defScore,
        atkScore: c.atkScore,
        speedInfo: c.speedInfo,
        completion: c.completion,
        knownEv: c.knownEv,
        totalEv: c.totalEv,
        maxTotalEv: c.maxTotalEv,
      });
    }
    rcAddCandidateAbilityToGroup(group, c);
    group.groupCount++;
    group.hpEvMin = Math.min(group.hpEvMin, c.hpEv || 0);
    group.hpEvMax = Math.max(group.hpEvMax, c.hpEv || 0);
    group.defEvMin = Math.min(group.defEvMin, c.defEv || 0);
    group.defEvMax = Math.max(group.defEvMax, c.defEv || 0);
    group.atkEvMin = Math.min(group.atkEvMin, c.atkEv || 0);
    group.atkEvMax = Math.max(group.atkEvMax, c.atkEv || 0);
    group.speEvMin = Math.min(group.speEvMin, c.speEvMin ?? c.speEv ?? 0);
    group.speEvMax = Math.max(group.speEvMax, c.speEvMax ?? c.speEv ?? 0);
    if (c.oppHp) {
      group.oppHpMin = Math.min(group.oppHpMin || c.oppHp, c.oppHp);
      group.oppHpMax = Math.max(group.oppHpMax || c.oppHp, c.oppHp);
    }
    group.totalEvMin = Math.min(group.totalEvMin, c.totalEv || 0);
    group.totalEvMax = Math.max(group.totalEvMax, c.maxTotalEv ?? c.totalEv ?? 0);
    group.bestTotalScore = Math.max(group.bestTotalScore, c.totalScore || 0);
    group.bestPracticalScore = Math.max(group.bestPracticalScore, rcPracticalProfileScore(c));
    group.defHitMin = Math.min(group.defHitMin, Math.round((c.defScore || 0) * 16));
    group.defHitMax = Math.max(group.defHitMax, Math.round((c.defScore || 0) * 16));
    group.atkHitMin = Math.min(group.atkHitMin, Math.round((c.atkScore || 0) * 16));
    group.atkHitMax = Math.max(group.atkHitMax, Math.round((c.atkScore || 0) * 16));
    group.completionMinTotal = Math.min(group.completionMinTotal, c.completion?.minTotal ?? c.totalEv ?? 0);
    group.completionMaxTotal = Math.max(group.completionMaxTotal, c.completion?.maxTotal ?? c.maxTotalEv ?? c.totalEv ?? 0);
  }
  groups.forEach(group => {
    group.abilityIds = rcCandidateAbilityIds(group);
    group.ability = group.abilityIds[0] || group.ability || '';
    group.abilityImpact = group.abilityIds.length > 0;
    group.totalScore = group.bestTotalScore;
    group.practicalScore = group.bestPracticalScore;
  });
  return groups.sort((a, b) => {
    if ((b.bestTotalScore || 0) !== (a.bestTotalScore || 0)) return (b.bestTotalScore || 0) - (a.bestTotalScore || 0);
    if ((b.bestPracticalScore || 0) !== (a.bestPracticalScore || 0)) return (b.bestPracticalScore || 0) - (a.bestPracticalScore || 0);
    const itemDiff = rcItemAssumptionScore(b) - rcItemAssumptionScore(a);
    if (itemDiff) return itemDiff;
    return (b.groupCount || 0) - (a.groupCount || 0);
  });
}
