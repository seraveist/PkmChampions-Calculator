/* Reverse calculator candidate generation and analysis orchestration. */
function rcRelevantOffenseItems(move) {
  const known = rcKnownOpponentItem();
  if (known !== null) return [known];
  return rcActiveItemCandidates().filter(item => {
    if (!item || item === 'choicescarf') return true;
    const itemData = ItemById[item];
    if (!itemData?.typeBoostType) return true;
    return itemData.typeBoostType === move.type;
  });
}

const RC_ANALYSIS_CACHE_LIMIT = 2;
const rcAnalysisCache = new Map();
let rcAnalysisWorker = null;
let rcAnalysisWorkerUrl = '';
let rcAnalysisWorkerPending = null;
let rcAnalysisRequestId = 0;

function rcAnalysisCacheKey() {
  return JSON.stringify({
    my: revCalcState.my,
    opp: revCalcState.opp,
    myMove: revCalcState.myMove,
    myMoveBp: revCalcState.myMoveBp,
    observedTheirPct: revCalcState.observedTheirPct,
    oppMove: revCalcState.oppMove,
    oppMoveBp: revCalcState.oppMoveBp,
    observedMyHp: revCalcState.observedMyHp,
    oppItemKnown: revCalcState.oppItemKnown,
    itemCandidates: revCalcState.itemCandidates,
    turnOrder: revCalcState.turnOrder,
    field: revCalcState.field,
    observedFields: revCalcState.observedFields,
    observationTiming: revCalcState.observationTiming,
    oppStartHpPct: revCalcState.oppStartHpPct,
    oppAbilityKnown: revCalcState.oppAbilityKnown,
    observedMoveOptions: revCalcState.observedMoveOptions,
  });
}

function rcReadAnalysisCache(key) {
  if (rcAnalysisCache.has(key)) {
    const cached = rcAnalysisCache.get(key);
    rcAnalysisCache.delete(key);
    rcAnalysisCache.set(key, cached);
    return cloneCalcValue(cached);
  }
  return null;
}

function rcWriteAnalysisCache(key, result) {
  if (!result?.error) {
    rcAnalysisCache.set(key, cloneCalcValue(result));
    while (rcAnalysisCache.size > RC_ANALYSIS_CACHE_LIMIT) {
      rcAnalysisCache.delete(rcAnalysisCache.keys().next().value);
    }
  }
}

function rcAnalyzeCached() {
  const key = rcAnalysisCacheKey();
  const cached = rcReadAnalysisCache(key);
  if (cached) {
    if (revCalcState.includeForecast && cached.candidates?.length) rcComputeExchangeForecast(cached);
    return cached;
  }
  const result = rcAnalyze();
  rcWriteAnalysisCache(key, result);
  if (revCalcState.includeForecast && result.candidates?.length) rcComputeExchangeForecast(result);
  return result;
}

function rcAnalysisWorkerData() {
  return {
    'data-pokemon': POKEMON,
    'data-moves': MOVES,
    'data-abilities': ABILITIES,
    'data-items': ITEMS,
    'data-natures': NATURE_DATA,
    'data-typechart': TYPE_CHART_DATA,
    'data-rules': RULES,
    'data-meta-threats': META_THREATS,
  };
}

function rcTerminateAnalysisWorker(reason = null) {
  if (rcAnalysisWorker) rcAnalysisWorker.terminate();
  if (rcAnalysisWorkerUrl) URL.revokeObjectURL(rcAnalysisWorkerUrl);
  rcAnalysisWorker = null;
  rcAnalysisWorkerUrl = '';
  if (rcAnalysisWorkerPending) {
    const pending = rcAnalysisWorkerPending;
    rcAnalysisWorkerPending = null;
    if (reason) pending.reject(reason);
  }
}

function rcCreateAnalysisWorker() {
  if (rcAnalysisWorker) return rcAnalysisWorker;
  if (typeof Worker !== 'function') return null;
  const sourceElement = document.getElementById('reverse-worker-source');
  if (!sourceElement) return null;

  const externalUrl = sourceElement.dataset.workerSrc || '';
  if (externalUrl) {
    rcAnalysisWorker = new Worker(externalUrl, { name: 'pkmchampions-reverse-analysis' });
  } else {
    if (!sourceElement.textContent || typeof Blob !== 'function' || typeof URL?.createObjectURL !== 'function') return null;
    let source = '';
    try {
      source = JSON.parse(sourceElement.textContent);
    } catch (_) {
      return null;
    }
    if (!source) return null;
    rcAnalysisWorkerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    rcAnalysisWorker = new Worker(rcAnalysisWorkerUrl, { name: 'pkmchampions-reverse-analysis' });
  }
  rcAnalysisWorker.addEventListener('message', event => {
    const message = event.data || {};
    const pending = rcAnalysisWorkerPending;
    if (!pending || (message.id != null && message.id !== pending.id)) return;
    if (message.type === 'result') {
      rcAnalysisWorkerPending = null;
      pending.resolve(message.result);
    } else if (message.type === 'error') {
      rcAnalysisWorkerPending = null;
      pending.reject(new Error(message.message || '역계산 Worker 오류'));
    }
  });
  rcAnalysisWorker.addEventListener('error', event => {
    const error = new Error(event.message || '역계산 Worker를 실행하지 못했습니다.');
    rcTerminateAnalysisWorker(error);
  });
  rcAnalysisWorker.postMessage({ type: 'init', dataScripts: rcAnalysisWorkerData() });
  return rcAnalysisWorker;
}

function rcAnalysisSnapshot() {
  const snapshot = cloneCalcValue({ ...revCalcState, results: null });
  snapshot.results = null;
  snapshot.analyzing = false;
  snapshot.includeForecast = true;
  return snapshot;
}

function rcAnalyzeInWorker() {
  const worker = rcCreateAnalysisWorker();
  if (!worker) {
    return new Promise(resolve => setTimeout(() => { const result = rcAnalyze(); if (result.candidates?.length) rcComputeExchangeForecast(result); resolve(result); }, 0));
  }
  if (rcAnalysisWorkerPending) {
    rcTerminateAnalysisWorker(new Error('RC_ANALYSIS_CANCELLED'));
    return rcAnalyzeInWorker();
  }
  const id = ++rcAnalysisRequestId;
  return new Promise((resolve, reject) => {
    rcAnalysisWorkerPending = { id, resolve, reject };
    worker.postMessage({ type: 'analyze', id, state: rcAnalysisSnapshot() });
  });
}

async function rcAnalyzeCachedAsync() {
  const key = `${rcAnalysisCacheKey()}|${rcForecastKey()}`;
  const cached = rcReadAnalysisCache(key);
  if (cached) return cached;
  const result = await rcAnalyzeInWorker();
  rcWriteAnalysisCache(key, result);
  return result;
}

function rcCancelAnalysis() {
  rcTerminateAnalysisWorker(new Error('RC_ANALYSIS_CANCELLED'));
}

// 베이스 defender state 빌드 (역계산 검색 중간 단계용)
function rcBuildOpponentState(oppP, oppOverrides = {}) {
  const hasAbilityOverride = Object.prototype.hasOwnProperty.call(oppOverrides, 'ability');
  return {
    pokemonIdx: oppP.id,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(oppOverrides.evs || {}) },
    nature: oppOverrides.nature || 'hardy',
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(oppOverrides.ranks || revCalcState.opp.ranks || {}) },
    status: revCalcState.opp.status || 'none',
    ability: hasAbilityOverride ? (oppOverrides.ability || '') : (toId(oppP.ab && (oppP.ab['0'] || oppP.ab['H'])) || ''),
    item: oppOverrides.item || '',
    types: [...(oppP.types || [])],
    tera: false,
    teraType: oppP.types[0],
    hpPct: 1,
    pinch: false,
    fullHP: true,
    boosterEnergyState: 'auto',
    damageBlockActive: false,
    fallenAllies: 0,
    moves: [],
    moveBpOverrides: [null, null, null, null],
  };
}

function rcDefenseItemGroups(move) {
  const groups = new Map();
  for (const id of rcActiveItemCandidates()) {
    const item = ItemById[id] || {};
    const key = JSON.stringify(move.variableBpKind ? item : [
      item.defenseStatBoost, item.resistBerryType, item.resistBerryRequiresWeakness,
      item.groundImmunity, item.grounded, item.ignoresWeatherDamageModifiers, item.paradoxActivation,
    ]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return [...groups.values()];
}

function rcBuildDefenseMatches(my, oppP, myMove, observedPct, field, defStat, natureIds, abilityCandidates = null) {
  const damageCache = new Map();
  if (!myMove) {
    return new Map(natureIds.map(nature => [nature, [{
      nature,
      hpEv: 0,
      defEv: 0,
      defStat: null,
      defScore: 1,
      oppHp: 0,
      oppDef: 0,
      damages: [],
    }]]));
  }

  const byNature = new Map(natureIds.map(nature => [nature, []]));
  const itemGroups = rcDefenseItemGroups(myMove);
  abilityCandidates = abilityCandidates || rcOpponentAbilityCandidates(oppP, [{ role: 'def', move: myMove, field }]);
  for (const natureId of natureIds) {
    for (const abilityCandidate of abilityCandidates) {
      for (const items of itemGroups) {
      const item = items[0];
      for (let hpEv = 0; hpEv <= 32; hpEv++) {
        for (let defEv = 0; defEv <= 32; defEv++) {
          if (hpEv + defEv > 66) continue;
          const oppState = rcBuildOpponentState(oppP, {
            evs: { hp: hpEv, [defStat]: defEv },
            nature: natureId,
            ability: abilityCandidate.id,
            item,
          });
          const stats = calcStats(oppState);
          const coupledStats = AbilityById[oppState.ability]?.paradoxBoost || myMove.variableBpKind || myMove.overrideOffensivePokemon;
          const key = JSON.stringify([abilityCandidate.id, item, coupledStats ? stats : [stats.hp, stats[defStat]]]);
          if (!damageCache.has(key)) damageCache.set(key, calculateDamage(my, oppState, myMove, field));
          const result = damageCache.get(key);
          if (!result || !result.damages) continue;
          const oppHp = stats.hp;
          const matches = rcMatchingRemainingPct(result.damages, observedPct, oppHp);
          if (matches > 0) {
            for (const matchedItem of items) byNature.get(natureId).push({
              nature: natureId,
              ability: abilityCandidate.id,
              item: matchedItem,
              abilityImpact: !!abilityCandidate.impact,
              hpEv,
              defEv,
              defStat,
              defScore: matches / 16,
              oppHp,
              oppDef: stats[defStat],
              damages: result.damages,
            });
          }
        }
      }
      }
    }
  }
  return byNature;
}

function rcBuildOffenseMatches(my, oppP, oppMove, observedHp, field, atkStat, natureIds, abilityCandidates = null) {
  if (!oppMove) {
    return new Map(natureIds.map(nature => [nature, [{
      nature,
      atkEv: 0,
      atkStat: null,
      item: null,
      atkScore: 1,
      oppAtk: 0,
      myDamages: [],
    }]]));
  }

  const myHp = rcCurrentHpValue(my);
  const byNature = new Map(natureIds.map(nature => [nature, []]));
  abilityCandidates = abilityCandidates || rcOpponentAbilityCandidates(oppP, [{ role: 'atk', move: oppMove, field }]);
  for (const natureId of natureIds) {
    for (const abilityCandidate of abilityCandidates) {
      for (let atkEv = 0; atkEv <= 32; atkEv++) {
        for (const item of rcRelevantOffenseItems(oppMove)) {
          const oppState = rcBuildOpponentState(oppP, {
            evs: { [atkStat]: atkEv },
            nature: natureId,
            item,
            ability: abilityCandidate.id,
          });
          const result = calculateDamage(oppState, my, oppMove, field);
          if (!result || !result.damages) continue;
          const matches = rcMatchingRemainingHp(result.damages, observedHp, myHp);
          if (matches > 0) {
            byNature.get(natureId).push({
              nature: natureId,
              ability: abilityCandidate.id,
              abilityImpact: !!abilityCandidate.impact,
              atkEv,
              atkStat,
              item: item || '',
              atkScore: matches / 16,
              oppAtk: calcStats(oppState)[atkStat],
              myDamages: result.damages,
            });
          }
        }
      }
    }
  }
  return byNature;
}

function rcCombineReverseCandidates(defByNature, atkByNature, oppP, oppMove, field, speedActive, debug) {
  const shaped = [];
  const speedCache = new Map();
  for (const [nature, defMatches] of defByNature.entries()) {
    const atkMatches = atkByNature.get(nature) || [];
    for (const defMatch of defMatches) {
      for (const atkMatch of atkMatches) {
        if (defMatch.item != null && atkMatch.item != null && defMatch.item !== atkMatch.item) continue;
        if (defMatch.defStat && atkMatch.atkStat && defMatch.defStat === atkMatch.atkStat && defMatch.defEv !== atkMatch.atkEv) {
          debug.statConflictRemoved++;
          continue;
        }
        if (defMatch.ability && atkMatch.ability && defMatch.ability !== atkMatch.ability) {
          debug.abilityConflictRemoved++;
          continue;
        }

        const ability = atkMatch.ability || defMatch.ability || '';
        const abilityImpact = !!(atkMatch.abilityImpact || defMatch.abilityImpact);
        const baseCandidate = {
          ...defMatch,
          ...atkMatch,
          nature,
          ability,
          abilityImpact,
          item: atkMatch.item ?? defMatch.item ?? rcKnownOpponentItem() ?? '',
          totalScore: (defMatch.defScore || 1) * (atkMatch.atkScore || 1),
        };

        if (!speedActive && baseCandidate.item === 'choicescarf' && rcKnownOpponentItem() !== 'choicescarf') {
          debug.scarfSkipped++;
          continue;
        }

        const speedKey = `${nature}|${baseCandidate.item}|${ability}`;
        if (!speedCache.has(speedKey)) speedCache.set(speedKey, rcSpeedCandidateInfo(oppP, nature, baseCandidate.item || '', field, ability));
        const speedInfo = speedCache.get(speedKey);
        if (!speedInfo.valid) {
          debug.speedRemoved++;
          continue;
        }

        const knownEv = rcCandidateKnownPointSum(baseCandidate);
        const speMin = speedInfo.active ? (speedInfo.speMin ?? 33) : 0;
        const speMaxRaw = speedInfo.active ? (speedInfo.speMax ?? speMin) : 32;
        const speMax = Math.min(speMaxRaw, Math.max(0, 66 - knownEv));
        if (speMin > speMax) {
          debug.budgetRemoved++;
          continue;
        }

        const withSpeed = {
          ...baseCandidate,
          speedInfo,
          knownEv,
          speEv: speMin,
          speEvMin: speMin,
          speEvMax: speMax,
          totalEv: knownEv + speMin,
          maxTotalEv: knownEv + speMax,
        };

        const practical = oppMove ? rcApplyNatureInvestmentPreset(withSpeed, oppP, oppMove, speedActive) : withSpeed;
        if (!practical) {
          debug.presetRemoved++;
          continue;
        }

        shaped.push(practical);
      }
    }
  }
  return shaped;
}

function rcNatureMapFromCandidates(candidates, natureIds = RC_NATURE_IDS) {
  const byNature = new Map(natureIds.map(nature => [nature, []]));
  for (const candidate of candidates || []) {
    const nature = candidate.nature || 'hardy';
    if (!byNature.has(nature)) byNature.set(nature, []);
    byNature.get(nature).push(candidate);
  }
  return byNature;
}

function rcStage1Defense(my, oppP, myMove, observedPct, field, defStat) {
  const defByNature = rcBuildDefenseMatches(my, oppP, myMove, observedPct, field, defStat, RC_NATURE_IDS);
  return [...defByNature.values()].flat();
}

function rcStage3OffenseRefine(defCandidates, my, oppP, oppMove, observedHp, field, atkStat) {
  const natureIds = rcNatureCandidatesForMove(oppMove);
  const defByNature = rcNatureMapFromCandidates(defCandidates, natureIds);
  const atkByNature = rcBuildOffenseMatches(my, oppP, oppMove, observedHp, field, atkStat, natureIds);
  const debug = {
    speedRemoved: 0,
    budgetRemoved: 0,
    scarfSkipped: 0,
    statConflictRemoved: 0,
    abilityConflictRemoved: 0,
    presetRemoved: 0,
  };
  return rcCombineReverseCandidates(defByNature, atkByNature, oppP, oppMove, field, revCalcState.turnOrder !== 'unknown', debug);
}

// 분석 메인
function rcAnalyze() {
  revCalcState.hpTolerance = 0;
  const exact = rcAnalyzeExchange();
  if (exact.error || exact.total || !revCalcState.observedTheirPct || Number(revCalcState.observedTheirPct) >= 100 || Number(revCalcState.observedTheirPct) <= 0) return exact;
  try {
    revCalcState.hpTolerance = 1;
    const nearby = rcAnalyzeExchange();
    if (nearby.total) return { ...nearby, hpTolerance: 1 };
    return exact;
  } finally {
    revCalcState.hpTolerance = 0;
  }
}

// Retained for focused legacy-stage diagnostics; the UI uses the linked exchange.
function rcAnalyzeIndependent() {
  const my = revCalcState.my;
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (!oppP) return { error: '상대 포켓몬을 선택해주세요.' };
  if (!PokemonById[my.pokemonIdx]) return { error: '내 포켓몬을 선택해주세요.' };

  const myMoveData = revCalcState.myMove ? MoveById[revCalcState.myMove] : null;
  const oppMoveData = revCalcState.oppMove ? MoveById[revCalcState.oppMove] : null;
  const observedTheir = parseInt(revCalcState.observedTheirPct, 10);
  const observedMy = parseInt(revCalcState.observedMyHp, 10);
  const myCurrentHp = rcCurrentHpValue(my);
  const myStatsForDebug = calcStats(my);

  const hasDef = myMoveData && myMoveData.cat !== 'Status' && observedTheir >= 0 && observedTheir <= 100;
  const hasAtk = oppMoveData && oppMoveData.cat !== 'Status' && observedMy >= 0 && observedMy <= myCurrentHp;
  const field = rcAnalysisField();
  const dealtField = rcObservedField('dealt');
  const receivedField = rcObservedField('received');

  if (!hasDef && !hasAtk) {
    return { error: '내 기술 또는 상대 기술 중 하나는 입력해야 합니다 (변화기 제외).' };
  }

  // 위력 override 적용
  const myMove = hasDef ? { ...myMoveData, bp: parseInt(revCalcState.myMoveBp, 10) || myMoveData.bp } : null;
  const oppMove = hasAtk ? { ...oppMoveData, bp: parseInt(revCalcState.oppMoveBp, 10) || oppMoveData.bp } : null;
  const abilityObservations = [
    hasDef ? { role: 'def', move: myMove, field: dealtField } : null,
    hasAtk ? { role: 'atk', move: oppMove, field: receivedField } : null,
  ].filter(Boolean);
  const abilityCandidates = rcOpponentAbilityCandidates(oppP, abilityObservations);

  let candidates = [];
  let mode = 'unknown';
  const debug = {
    myPokemon: my.pokemonIdx,
    oppPokemon: oppP.id,
    myNature: my.nature,
    myEvs: { ...(my.evs || {}) },
    myStats: { ...myStatsForDebug },
    myMove: myMoveData?.id || '',
    oppMove: oppMoveData?.id || '',
    observedTheir,
    observedMy,
    myCurrentHp,
    field: rcActiveFieldSummary(field),
    dealtField: rcActiveFieldSummary(dealtField),
    receivedField: rcActiveFieldSummary(receivedField),
    turnOrder: revCalcState.turnOrder,
    itemCount: rcActiveItemCandidates().length,
    hasNoItem: rcActiveItemCandidates().includes(''),
    hasDef: !!hasDef,
    hasAtk: !!hasAtk,
    stage1: 0,
    stage1Trimmed: 0,
    refined: 0,
    speedRemoved: 0,
    budgetRemoved: 0,
    scarfSkipped: 0,
    statConflictRemoved: 0,
    abilityConflictRemoved: 0,
    presetRemoved: 0,
  };

  const speedActive = rcSpeedCandidateInfo(oppP, 'hardy', '', field).active;
  const natureIds = hasAtk ? rcNatureCandidatesForMove(oppMove) : RC_NATURE_IDS;
  debug.natureCandidates = natureIds.join(',');

  if (hasDef && hasAtk) {
    mode = 'full';
    const defStat = rcMoveDefenseStat(myMove) || (myMove.cat === 'Physical' ? 'def' : 'spd');
    const atkStat = rcMoveOffenseStat(oppMove) || (oppMove.cat === 'Physical' ? 'atk' : 'spa');
    const defByNature = rcBuildDefenseMatches(my, oppP, myMove, observedTheir, dealtField, defStat, natureIds, abilityCandidates);
    const atkByNature = rcBuildOffenseMatches(my, oppP, oppMove, observedMy, receivedField, atkStat, natureIds, abilityCandidates);
    debug.stage1 = [...defByNature.values()].reduce((sum, list) => sum + list.length, 0);
    debug.stage1Trimmed = debug.stage1;
    debug.offenseMatches = [...atkByNature.values()].reduce((sum, list) => sum + list.length, 0);
    candidates = rcCombineReverseCandidates(defByNature, atkByNature, oppP, oppMove, field, speedActive, debug);
    debug.refined = candidates.length;
  } else if (hasDef) {
    mode = 'def-only';
    const defStat = rcMoveDefenseStat(myMove) || (myMove.cat === 'Physical' ? 'def' : 'spd');
    const defByNature = rcBuildDefenseMatches(my, oppP, myMove, observedTheir, dealtField, defStat, natureIds, abilityCandidates);
    const atkByNature = rcBuildOffenseMatches(my, oppP, null, null, field, null, natureIds, abilityCandidates);
    debug.stage1 = [...defByNature.values()].reduce((sum, list) => sum + list.length, 0);
    debug.stage1Trimmed = debug.stage1;
    candidates = rcCombineReverseCandidates(defByNature, atkByNature, oppP, null, field, speedActive, debug);
    debug.refined = candidates.length;
  } else {
    mode = 'atk-only';
    const atkStat = rcMoveOffenseStat(oppMove) || (oppMove.cat === 'Physical' ? 'atk' : 'spa');
    const defByNature = rcBuildDefenseMatches(my, oppP, null, null, field, null, natureIds, abilityCandidates);
    const atkByNature = rcBuildOffenseMatches(my, oppP, oppMove, observedMy, receivedField, atkStat, natureIds, abilityCandidates);
    debug.stage1 = [...defByNature.values()].reduce((sum, list) => sum + list.length, 0);
    debug.stage1Trimmed = debug.stage1;
    debug.offenseMatches = [...atkByNature.values()].reduce((sum, list) => sum + list.length, 0);
    candidates = rcCombineReverseCandidates(defByNature, atkByNature, oppP, oppMove, field, speedActive, debug);
    debug.refined = candidates.length;
  }

  const rawTotal = candidates.length
    + debug.speedRemoved
    + debug.budgetRemoved
    + debug.scarfSkipped
    + debug.statConflictRemoved
    + debug.abilityConflictRemoved
    + debug.presetRemoved;
  debug.afterFilter = candidates.length;
  const hasNonScarfAlternative = candidates.some(c => c.item !== 'choicescarf');
  candidates.forEach(c => { c.hasNonScarfAlternative = hasNonScarfAlternative; });

  // 정렬 + Top 5
  // 그룹에서 최상위 대표를 선택한 뒤 그룹만 정렬한다.
  const groupedResults = rcGroupCandidates(candidates);

  return {
    results: groupedResults.slice(0, 5),
    total: candidates.length,
    groupTotal: groupedResults.length,
    rawTotal,
    filteredByRule: Math.max(0, rawTotal - candidates.length),
    mode,
    speedActive,
    myCurrentHp,
    mySpeed: rcMySpeedValue(),
    scarfViable: candidates.some(c => c.item === 'choicescarf'),
    nonScarfViable: candidates.some(c => c.item !== 'choicescarf'),
    debug,
  };
}

// === UI 렌더링 ===
