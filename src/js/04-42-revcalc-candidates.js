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

function rcBuildDefenseMatches(my, oppP, myMove, observedPct, field, defStat, natureIds, abilityCandidates = null) {
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
  abilityCandidates = abilityCandidates || rcOpponentAbilityCandidates(oppP, [{ role: 'def', move: myMove, field }]);
  for (const natureId of natureIds) {
    for (const abilityCandidate of abilityCandidates) {
      for (let hpEv = 0; hpEv <= 32; hpEv++) {
        for (let defEv = 0; defEv <= 32; defEv++) {
          if (hpEv + defEv > 66) continue;
          if (defEv > 0 && hpEv < 32) continue;
          const oppState = rcBuildOpponentState(oppP, {
            evs: { hp: hpEv, [defStat]: defEv },
            nature: natureId,
            ability: abilityCandidate.id,
          });
          const result = calculateDamage(my, oppState, myMove, field);
          if (!result || !result.damages) continue;
          const oppHp = calcStats(oppState).hp;
          const matches = rcMatchingRemainingPct(result.damages, observedPct, oppHp);
          if (matches > 0) {
            byNature.get(natureId).push({
              nature: natureId,
              ability: abilityCandidate.id,
              abilityImpact: !!abilityCandidate.impact,
              hpEv,
              defEv,
              defStat,
              defScore: matches / 16,
              oppHp,
              oppDef: calcStats(oppState)[defStat],
              damages: result.damages,
            });
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
      item: '',
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
  for (const [nature, defMatches] of defByNature.entries()) {
    const atkMatches = atkByNature.get(nature) || [];
    for (const defMatch of defMatches) {
      for (const atkMatch of atkMatches) {
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
          totalScore: (defMatch.defScore || 1) * (atkMatch.atkScore || 1),
        };

        if (!speedActive && baseCandidate.item === 'choicescarf' && rcKnownOpponentItem() !== 'choicescarf') {
          debug.scarfSkipped++;
          continue;
        }

        const speedInfo = rcSpeedCandidateInfo(oppP, nature, baseCandidate.item || '', field);
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

// Stage 1: 내구 검색
function rcStage1Defense(my, oppP, myMove, observedPct, field, defStat) {
  const candidates = [];
  for (const natureId of RC_NATURE_IDS) {
    for (let hpEv = 0; hpEv <= 32; hpEv++) {
      for (let defEv = 0; defEv <= 32; defEv++) {
        if (hpEv + defEv > 64) continue;
        const oppState = rcBuildOpponentState(oppP, {
          evs: { hp: hpEv, [defStat]: defEv },
          nature: natureId,
        });
        const result = calculateDamage(my, oppState, myMove, field);
        if (!result || !result.damages) continue;
        const oppHp = calcStats(oppState).hp;
        const matches = rcMatchingRemainingPct(result.damages, observedPct, oppHp);
        if (matches > 0) {
          candidates.push({
            nature: natureId,
            hpEv, defEv, defStat,
            defScore: matches / 16,
            oppHp,
            oppDef: calcStats(oppState)[defStat],
            damages: result.damages,
          });
        }
      }
    }
  }
  return candidates;
}

// Stage 3: 공격 검색 (Stage 1 candidates 와 함께 정제)
function rcStage3OffenseRefine(defCandidates, my, oppP, oppMove, observedPct, field, atkStat) {
  const refined = [];
  const myHp = rcCurrentHpValue(my);

  for (const c of defCandidates) {
    const remainingEv = 66 - c.hpEv - c.defEv;

    for (let atkEv = 0; atkEv <= Math.min(32, remainingEv); atkEv++) {
      for (const item of rcRelevantOffenseItems(oppMove)) {
        const oppState = rcBuildOpponentState(oppP, {
          evs: { hp: c.hpEv, [c.defStat]: c.defEv, [atkStat]: atkEv },
          nature: c.nature,
          item,
        });
        const result = calculateDamage(oppState, my, oppMove, field);
        if (!result || !result.damages) continue;
        const matches = rcMatchingRemainingHp(result.damages, observedPct, myHp);
        if (matches > 0) {
          const atkScore = matches / 16;
          const totalScore = c.defScore * atkScore;
          const cand = {
            ...c,
            atkEv, atkStat, item: item || '',
            atkScore, totalScore,
            oppAtk: calcStats(oppState)[atkStat],
            myDamages: result.damages,
          };
          refined.push(cand);
        }
      }
    }
  }
  return refined;
}

// 분석 메인
function rcAnalyze() {
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

  const speedActive = revCalcState.turnOrder !== 'unknown';
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
  candidates.sort(rcCompareCandidates);
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

