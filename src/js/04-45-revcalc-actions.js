/* Reverse calculator input actions, analysis trigger, and calculator handoff. */
function rcComboKind(target) {
  if (target === 'mynature') return 'nature';
  if (target === 'myability') return 'ability';
  if (target === 'myitem') return 'item';
  return target;
}

function rcAbilityOptionsForCurrentPokemon() {
  return calcAbilityOptionDataForPokemon(revCalcState.my.pokemonIdx, revCalcState.my.ability);
}

function rcComboData(kind) {
  if (kind === 'item') {
    return calcItemOptionData();
  }
  if (kind === 'nature') {
    return calcNatureOptionData();
  }
  if (kind === 'ability') return rcAbilityOptionsForCurrentPokemon();
  return [];
}

function rcCurrentComboId(kind) {
  if (kind === 'item') return revCalcState.my.item || '';
  if (kind === 'nature') return revCalcState.my.nature || 'hardy';
  if (kind === 'ability') return revCalcState.my.ability || '';
  return '';
}

function rcComboLabel(kind, id) {
  if (kind === 'item') return id ? itName(ItemById[id] || { name: id }) : '없음';
  if (kind === 'nature') return calcNatureLabel(NATURE_BY_ID[id]) || id;
  if (kind === 'ability') return id ? abName(AbilityById[id] || { name: id }) : '없음';
  return id || '';
}

function rcComboSearchMatches(query, option) {
  const q = String(query || '').toLowerCase();
  if (!q) return true;
  return [option.id, option.label, option.sub, option.raw?.name, option.raw?.koName]
    .some(value => String(value || '').toLowerCase().includes(q));
}

// 위임 이벤트 핸들러
document.getElementById('page-revcalc')?.addEventListener('change', e => {
  const t = e.target;
  const pointInputStat = t.dataset.toolStatPointInput || t.dataset.rcEv;
  if (pointInputStat) {
    const stat = pointInputStat;
    const normalized = toolStatNormalizePointInputValue(t.value);
    if (normalized !== t.value) t.value = normalized;
    const finalVal = toolStatApplyPointValue(revCalcState.my, stat, t.value);
    if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
    if (String(finalVal) !== String(t.value)) t.value = finalVal;
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcAction === 'myNature') { revCalcState.my.nature = t.value; renderRevCalcMy(); renderRevCalcInputs(); return; }
  if (t.dataset.rcAction === 'myAbility') { revCalcState.my.ability = t.value; return; }
  if (t.dataset.rcAction === 'oppItemKnown') {
    revCalcState.oppItemKnown = t.value;
    rcResetItemCandidatesForOpponent();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcAction === 'oppStatus') { revCalcState.opp.status = t.value; return; }
  if (t.dataset.rcAction === 'myMove') {
    revCalcState.myMove = t.value;
    rcEnsureMoveInSet(t.value);
    revCalcState.myMoveBp = '';   // 자동 채움
    renderRevCalcInputs();
    renderRevCalcResults();
    return;
  }
  if (t.dataset.rcAction === 'oppMove') {
    revCalcState.oppMove = t.value;
    revCalcState.oppMoveBp = '';
    if (!revCalcState.predictedOppMove) revCalcState.predictedOppMove = t.value;
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcAction === 'predictedOppMove') {
    revCalcState.predictedOppMove = t.value;
    renderRevCalcResults();
    return;
  }
  if (t.dataset.rcMoveslot !== undefined) {
    const idx = parseInt(t.dataset.rcMoveslot, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < RC_MOVESET_SIZE) {
      rcMoveSet()[idx] = t.value;
      if (!revCalcState.myMove && t.value) revCalcState.myMove = t.value;
      renderRevCalcInputs();
      renderRevCalcResults();
    }
    return;
  }
  if (t.dataset.rcAction === 'myMoveBp') { revCalcState.myMoveBp = t.value; return; }
  if (t.dataset.rcAction === 'oppMoveBp') { revCalcState.oppMoveBp = t.value; return; }
  if (t.dataset.rcAction === 'observedTheirPct') { revCalcState.observedTheirPct = t.value; return; }
  if (t.dataset.rcAction === 'observedMyHp') { revCalcState.observedMyHp = t.value; return; }
  if (t.dataset.rcAction === 'turnOrder') { revCalcState.turnOrder = t.value; renderRevCalcInputs(); return; }
  if (t.dataset.rcField) {
    const k = t.dataset.rcField;
    const v = t.type === 'checkbox' ? t.checked : t.value;
    revCalcState.field[k] = v;
    return;
  }
  if (t.dataset.rcObservedField) {
    const side = t.dataset.rcObservedField;
    const key = t.dataset.rcFieldKey;
    if (!revCalcState.observedFields[side]) revCalcState.observedFields[side] = {};
    revCalcState.observedFields[side][key] = !!t.checked;
    return;
  }
  if (t.dataset.rcItem !== undefined) {
    const id = t.dataset.rcItem;
    if (t.checked && !revCalcState.itemCandidates.includes(id)) revCalcState.itemCandidates.push(id);
    if (!t.checked) revCalcState.itemCandidates = revCalcState.itemCandidates.filter(x => x !== id);
    const badge = document.querySelector('#page-revcalc .rc-item-candidate-count');
    if (badge) badge.textContent = rcItemCandidateCountLabel();
    return;
  }
});

document.getElementById('page-revcalc')?.addEventListener('input', e => {
  const t = e.target;
  const pointInputStat = t.dataset.toolStatPointInput || t.dataset.rcEv;
  if (pointInputStat) {
    const normalized = toolStatNormalizePointInputValue(t.value);
    if (normalized !== t.value) t.value = normalized;
    const finalVal = toolStatApplyPointValue(revCalcState.my, pointInputStat, t.value);
    if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
    if (String(finalVal) !== String(t.value)) t.value = finalVal;
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (!t.dataset?.rcAction) return;
  if (t.dataset.rcAction === 'myMoveBp') revCalcState.myMoveBp = t.value;
  if (t.dataset.rcAction === 'oppMoveBp') revCalcState.oppMoveBp = t.value;
  if (t.dataset.rcAction === 'observedTheirPct') revCalcState.observedTheirPct = t.value;
  if (t.dataset.rcAction === 'observedMyHp') revCalcState.observedMyHp = t.value;
});

document.getElementById('page-revcalc')?.addEventListener('click', e => {
  const t = e.target;
  const itemToggle = t.closest?.('[data-rc-toggle-item-candidates]');
  if (itemToggle) {
    e.preventDefault();
    revCalcState.itemCandidatesOpen = !revCalcState.itemCandidatesOpen;
    renderRevCalcInputs();
    return;
  }
  const nextRankToggle = t.closest?.('[data-rc-toggle-next-ranks]');
  if (nextRankToggle) {
    e.preventDefault();
    revCalcState.nextRankOpen = !revCalcState.nextRankOpen;
    renderRevCalcResults();
    return;
  }
  const toggledRow = t.closest?.('[data-rc-toggle-result]');
  if (toggledRow && !t.closest('button, select, input, label, .combobox-options')) {
    const idx = parseInt(toggledRow.dataset.rcToggleResult, 10);
    const opened = new Set(Array.isArray(revCalcState.openResultIndexes) ? revCalcState.openResultIndexes : []);
    if (opened.has(idx)) opened.delete(idx);
    else opened.add(idx);
    revCalcState.openResultIndexes = [...opened].sort((a, b) => a - b);
    if (!revCalcState.predictedOppMove) revCalcState.predictedOppMove = revCalcState.oppMove || '';
    renderRevCalcResults();
    return;
  }
  const pointSetStat = t.dataset.toolStatPointSet || t.dataset.rcEvset;
  if (pointSetStat !== undefined) {
    const stat = pointSetStat;
    toolStatApplyPointValue(revCalcState.my, stat, t.dataset.toolStatPointValue ?? t.dataset.rcEvval);
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  const myRankStat = t.dataset.rcRank || (t.dataset.rcOpprank ? '' : t.dataset.toolStatRank);
  if (myRankStat) {
    const stat = myRankStat;
    const dir = t.dataset.toolStatRankDir || t.dataset.rcDir;
    toolStatApplyRankDelta(revCalcState.my, stat, dir);
    revCalcState.nextMyRanks[stat] = revCalcState.my.ranks[stat];
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  const oppRankStat = t.dataset.rcOpprank;
  if (oppRankStat) {
    const stat = oppRankStat;
    const dir = t.dataset.toolStatRankDir || t.dataset.rcDir;
    toolStatApplyRankDelta(revCalcState.opp, stat, dir);
    revCalcState.nextOppRanks[stat] = revCalcState.opp.ranks[stat];
    renderRevCalcOpp();
    return;
  }
  if (t.dataset.rcNextrank) {
    const stat = t.dataset.rcNextrank;
    const dir = parseInt(t.dataset.rcDir, 10);
    const ranks = rcNextOpponentRanks();
    ranks[stat] = Math.max(-6, Math.min(6, (ranks[stat] || 0) + dir));
    renderRevCalcResults();
    return;
  }
  if (t.dataset.rcNextmyrank) {
    const stat = t.dataset.rcNextmyrank;
    const dir = parseInt(t.dataset.rcDir, 10);
    const ranks = rcNextMyRanks();
    ranks[stat] = Math.max(-6, Math.min(6, (ranks[stat] || 0) + dir));
    renderRevCalcResults();
    return;
  }
  if (t.dataset.rcApplyresult !== undefined) {
    rcApplyResultToCalc(parseInt(t.dataset.rcApplyresult, 10));
    return;
  }
});

// 분석 시작
document.getElementById('rcAnalyze')?.addEventListener('click', async () => {
  if (revCalcState.analyzing) {
    revCalcState.analysisRunId++;
    rcCancelAnalysis();
    revCalcState.analyzing = false;
    renderRevCalcResults();
    return;
  }

  rcSyncInputsFromDom();
  const runId = ++revCalcState.analysisRunId;
  revCalcState.analyzing = true;
  renderRevCalcResults();
  try {
    const result = await rcAnalyzeCachedAsync();
    if (runId !== revCalcState.analysisRunId) return;
    revCalcState.results = result;
    revCalcState.selectedResultIndex = 0;
    revCalcState.openResultIndexes = [];
    if (!revCalcState.predictedOppMove) revCalcState.predictedOppMove = revCalcState.oppMove || '';
  } catch (e) {
    if (runId !== revCalcState.analysisRunId || e?.message === 'RC_ANALYSIS_CANCELLED') return;
    revCalcState.results = { error: '분석 실패: ' + e.message };
  } finally {
    if (runId !== revCalcState.analysisRunId) return;
    revCalcState.analyzing = false;
    renderRevCalcResults();
  }
});

// 결과 spread 를 계산기 방어측에 적용
function rcApplyResultToCalc(idx) {
  const r = revCalcState.results;
  if (!r || !r.results || !r.results[idx]) return;
  const c = r.results[idx];
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (!oppP) return;
  // 새 def state 빌드
  const defState = makeSideState(oppP.id);
  defState.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (c.hpEv) defState.evs.hp = c.hpEv;
  if (c.defEv) defState.evs[c.defStat] = c.defEv;
  if (c.atkEv) defState.evs[c.atkStat] = c.atkEv;
  if (c.speEv) defState.evs.spe = c.speEv;
  defState.nature = c.nature;
  if (c.item) defState.item = c.item;
  defState.ranks = { ...revCalcState.opp.ranks };
  defState.status = revCalcState.opp.status || 'none';
  // 적용
  state.def = defState;
  state.atk = cloneCalcValue(revCalcState.my);
  // 필드 상태 적용
  Object.assign(state.field, revCalcState.field);
  renderSide('atk');
  renderSide('def');
  triggerCalc();
  const calcNav = document.querySelector('.nav-tab[data-page="calc"]');
  if (calcNav) calcNav.click();
}

// 계산기 → 형태 역계산 sync
function loadSideToRevCalc(sideKey) {
  const src = state[sideKey];
  revCalcState.my = cloneCalcValue(src);
  revCalcState.nextMyRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(src.ranks || {}) };
  revCalcState.myMoveSet = [...(src.moves || [])].slice(0, RC_MOVESET_SIZE);
  while (revCalcState.myMoveSet.length < RC_MOVESET_SIZE) revCalcState.myMoveSet.push('');
  revCalcState.myMove = revCalcState.myMoveSet.find(id => MoveById[id]?.cat !== 'Status') || '';
  revCalcState.myMoveBp = '';
  const otherKey = sideKey === 'atk' ? 'def' : 'atk';
  revCalcState.opp.pokemonIdx = state[otherKey].pokemonIdx;
  revCalcState.opp.ranks = { ...state[otherKey].ranks };
  revCalcState.nextOppRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(state[otherKey].ranks || {}) };
  revCalcState.opp.status = state[otherKey].status || 'none';
  revCalcState.oppItemKnown = 'unknown';
  rcResetItemCandidatesForOpponent();
  revCalcState.field = rcDefaultField();
  const navBtn = document.querySelector('.nav-tab[data-page="revcalc"]');
  if (navBtn) navBtn.click();
  renderRevCalcAll();
}
window.loadSideToRevCalc = loadSideToRevCalc;
