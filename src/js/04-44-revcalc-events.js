/* Reverse calculator DOM synchronization and events. */
function rcSyncInputsFromDom() {
  const root = document.getElementById('page-revcalc');
  if (!root) return;
  root.querySelectorAll('[data-rc-move-picker]').forEach(el => {
    const target = el.dataset.rcMovePicker;
    const pool = rcMovePoolForPicker(target);
    const id = rcFindMoveByTypedName(el.value, pool);
    if (id !== undefined) rcSetMovePickerValue(target, id, el.dataset.rcMoveSlot);
  });
  root.querySelectorAll('[data-rc-moveslot]').forEach(el => {
    const idx = parseInt(el.dataset.rcMoveslot, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < RC_MOVESET_SIZE) rcMoveSet()[idx] = el.value;
  });
  const evInputs = Array.from(root.querySelectorAll('[data-rc-ev]'));
  if (evInputs.length) {
    const requested = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    evInputs.forEach(el => {
      const stat = el.dataset.rcEv;
      if (stat in requested) requested[stat] = Math.max(0, Math.min(32, parseInt(el.value, 10) || 0));
    });
    let remaining = 66;
    ['hp','atk','def','spa','spd','spe'].forEach(stat => {
      const value = Math.min(requested[stat], remaining);
      revCalcState.my.evs[stat] = value;
      remaining -= value;
    });
  }
  root.querySelectorAll('[data-rc-action]').forEach(el => {
    const action = el.dataset.rcAction;
    if (!action) return;
    if (action === 'myMove') {
      const observedIds = rcObservedMyMoveIds();
      revCalcState.myMove = el.value && observedIds.includes(el.value)
        ? el.value
        : (revCalcState.myMove && observedIds.includes(revCalcState.myMove) ? revCalcState.myMove : '');
    }
    else if (action === 'myNature') revCalcState.my.nature = el.value;
    else if (action === 'myAbility') revCalcState.my.ability = el.value;
    else if (action === 'oppStatus') revCalcState.opp.status = el.value;
    else if (action === 'oppMove') revCalcState.oppMove = el.value;
    else if (action === 'oppItemKnown') revCalcState.oppItemKnown = el.value;
    else if (action === 'predictedOppMove') revCalcState.predictedOppMove = el.value;
    else if (action === 'myMoveBp') revCalcState.myMoveBp = el.value;
    else if (action === 'oppMoveBp') revCalcState.oppMoveBp = el.value;
    else if (action === 'observedTheirPct') revCalcState.observedTheirPct = el.value;
    else if (action === 'observedMyHp') revCalcState.observedMyHp = el.value;
    else if (action === 'turnOrder') revCalcState.turnOrder = el.value;
    else if (action === 'mySpeedOverride') revCalcState.mySpeedOverride = el.value;
  });
  const nextField = rcDefaultField();
  root.querySelectorAll('[data-rc-field]').forEach(el => {
    const key = el.dataset.rcField;
    nextField[key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  revCalcState.field = nextField;
  root.querySelectorAll('[data-rc-observed-field]').forEach(el => {
    const side = el.dataset.rcObservedField;
    const key = el.dataset.rcFieldKey;
    if (!revCalcState.observedFields[side]) revCalcState.observedFields[side] = {};
    revCalcState.observedFields[side][key] = !!el.checked;
  });
  const itemBoxes = root.querySelectorAll('[data-rc-item]');
  if (itemBoxes.length) {
    if (revCalcState.oppItemKnown === 'unknown') {
      const selectedItems = Array.from(itemBoxes).filter(el => el.checked).map(el => el.dataset.rcItem).filter(Boolean);
      revCalcState.itemCandidates = ['', ...selectedItems.filter((id, idx, arr) => arr.indexOf(id) === idx)];
    } else {
      revCalcState.itemCandidates = [];
    }
  }
}

function rcWireMyComboboxes() {
  document.getElementById('rc-my-body').querySelectorAll('.rc-cb-input').forEach(input => {
    const target = input.dataset.rcPick;
    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      const data = target === 'my' ? sortPokemonForCalcSelect(POKEMON) : ITEMS;
      const allMatches = data.filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s));
      const matches = target === 'my' ? allMatches : allMatches.slice(0, 30);
      const items = matches.map(m => {
        const label = target === 'my' ? pkName(m) : itName(m);
        const sub = target === 'my' ? `${m.types.join('/')} BST ${m.bst}` : (m.desc || '').slice(0, 30);
        return `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(label)}</b> <small>${escapeHTML(sub)}</small></div>`;
      });
      if (target === 'myitem') items.unshift('<div class="combobox-option" data-id=""><b>없음</b></div>');
      optsEl.innerHTML = items.join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOpts(e.target.value));
    input.addEventListener('input', e => showOpts(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      const id = opt.dataset.id;
      if (target === 'my') {
        rcApplyMyPokemonSelection(id);
      } else {
        revCalcState.my.item = id || '';
      }
      renderRevCalcAll();
    });
  });
}

function rcApplyMyPokemonSelection(id) {
  const p = PokemonById[id];
  revCalcState.my.pokemonIdx = id;
  if (p) {
    revCalcState.my.ability = toId(p.ab['0'] || p.ab['H'] || '');
    revCalcState.my.types = [...p.types];
    revCalcState.my.teraType = p.types[0];
  }
  revCalcState.myMove = '';
  revCalcState.myMoveSet = ['', '', '', ''];
  revCalcState.myMoveBp = '';
  revCalcState.nextMyRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

function rcWireOppComboboxes() {
  document.getElementById('rc-opp-body').querySelectorAll('.rc-cb-input').forEach(input => {
    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      const matches = sortPokemonForCalcSelect(POKEMON).filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s));
      optsEl.innerHTML = matches.map(m =>
        `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(pkName(m))}</b> <small>${m.types.join('/')} BST ${m.bst}</small></div>`
      ).join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOpts(e.target.value));
    input.addEventListener('input', e => showOpts(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      revCalcState.opp.pokemonIdx = opt.dataset.id;
      revCalcState.oppMove = '';
      revCalcState.oppMoveBp = '';
      revCalcState.nextOppRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      revCalcState.predictedOppMove = '';
      rcResetItemCandidatesForOpponent();
      renderRevCalcAll();
    });
  });
}

function rcWireMoveComboboxes(scope) {
  const root = scope || document.getElementById('page-revcalc');
  if (!root) return;
  root.querySelectorAll('[data-rc-move-picker]').forEach(input => {
    const target = input.dataset.rcMovePicker;
    const slot = input.dataset.rcMoveSlot;
    const cb = input.closest('.combobox');
    const optsEl = cb?.querySelector('.combobox-options');
    if (!optsEl) return;
    let selectingMoveOption = false;

    const showOpts = q => {
      const pool = rcMovePoolForPicker(target);
      const matches = rcFilterMovePool(pool, q);
      optsEl.innerHTML = matches.length
        ? matches.map(m => `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(rcMoveOptionLabel(m))}</b></div>`).join('')
        : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      optsEl.classList.add('open');
    };

    const applyMove = id => {
      rcSetMovePickerValue(target, id, slot);
      if (target === 'moveslot') {
        renderRevCalcMy();
        renderRevCalcInputs();
        renderRevCalcResults();
      } else if (target === 'oppMove') {
        renderRevCalcInputs();
        renderRevCalcResults();
      } else if (target === 'predictedOppMove') {
        renderRevCalcResults();
      }
    };

    input.addEventListener('focus', e => showOpts(e.target.value));
    input.addEventListener('input', e => showOpts(e.target.value));
    input.addEventListener('compositionend', e => showOpts(e.target.value));
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const pool = rcMovePoolForPicker(target);
      const id = rcBestMoveForTypedName(input.value, pool);
      if (!id) return;
      e.preventDefault();
      applyMove(id);
    });
    input.addEventListener('blur', () => {
      setTimeout(() => optsEl.classList.remove('open'), 180);
      setTimeout(() => {
        if (selectingMoveOption) {
          selectingMoveOption = false;
          return;
        }
        const pool = rcMovePoolForPicker(target);
        const id = rcFindMoveByTypedName(input.value, pool);
        if (id !== undefined) {
          rcSetMovePickerValue(target, id, slot);
        } else {
          input.value = target === 'moveslot'
            ? rcMoveLabel(rcMoveSet()[parseInt(slot, 10)] || '')
            : rcMoveLabel(revCalcState[target] || '');
        }
      }, 180);
    });
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option:not(.empty)');
      if (!opt) return;
      selectingMoveOption = true;
      e.preventDefault();
      applyMove(opt.dataset.id || '');
    });
  });
}

// 위임 이벤트 핸들러
document.getElementById('page-revcalc')?.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rcEv) {
    const stat = t.dataset.rcEv;
    const evs = revCalcState.my.evs;
    const requested = Math.max(0, Math.min(32, parseInt(t.value, 10) || 0));
    const otherSum = ['hp','atk','def','spa','spd','spe'].reduce((a, k) => k === stat ? a : a + (evs[k] || 0), 0);
    evs[stat] = Math.min(requested, Math.max(0, 66 - otherSum));
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
  if (t.dataset.rcAction === 'mySpeedOverride') { revCalcState.mySpeedOverride = t.value; renderRevCalcInputs(); return; }
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
    renderRevCalcInputs();
    return;
  }
});

document.getElementById('page-revcalc')?.addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset?.rcAction) return;
  if (t.dataset.rcAction === 'myMoveBp') revCalcState.myMoveBp = t.value;
  if (t.dataset.rcAction === 'oppMoveBp') revCalcState.oppMoveBp = t.value;
  if (t.dataset.rcAction === 'observedTheirPct') revCalcState.observedTheirPct = t.value;
  if (t.dataset.rcAction === 'observedMyHp') revCalcState.observedMyHp = t.value;
  if (t.dataset.rcAction === 'mySpeedOverride') revCalcState.mySpeedOverride = t.value;
});

document.getElementById('page-revcalc')?.addEventListener('click', e => {
  const t = e.target;
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
  if (t.dataset.rcEvset !== undefined) {
    const stat = t.dataset.rcEvset;
    const evs = revCalcState.my.evs;
    const requested = parseInt(t.dataset.rcEvval, 10) || 0;
    const otherSum = ['hp','atk','def','spa','spd','spe'].reduce((a, k) => k === stat ? a : a + (evs[k] || 0), 0);
    evs[stat] = Math.min(requested, Math.max(0, 66 - otherSum));
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcRank) {
    const stat = t.dataset.rcRank;
    const dir = parseInt(t.dataset.rcDir, 10);
    revCalcState.my.ranks[stat] = Math.max(-6, Math.min(6, (revCalcState.my.ranks[stat] || 0) + dir));
    revCalcState.nextMyRanks[stat] = revCalcState.my.ranks[stat];
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcOpprank) {
    const stat = t.dataset.rcOpprank;
    const dir = parseInt(t.dataset.rcDir, 10);
    revCalcState.opp.ranks[stat] = Math.max(-6, Math.min(6, (revCalcState.opp.ranks[stat] || 0) + dir));
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
  rcSyncInputsFromDom();
  revCalcState.analyzing = true;
  renderRevCalcResults();
  // UI 업데이트 후 분석 (heavy → 다음 frame)
  await new Promise(resolve => setTimeout(resolve, 30));
  try {
    revCalcState.results = rcAnalyze();
    revCalcState.selectedResultIndex = 0;
    revCalcState.openResultIndexes = [];
    if (!revCalcState.predictedOppMove) revCalcState.predictedOppMove = revCalcState.oppMove || '';
  } catch (e) {
    revCalcState.results = { error: '분석 실패: ' + e.message };
  }
  revCalcState.analyzing = false;
  renderRevCalcResults();
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
  state.atk = JSON.parse(JSON.stringify(revCalcState.my));
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
  revCalcState.my = JSON.parse(JSON.stringify(src));
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
  revCalcState.mySpeedOverride = '';
  revCalcState.field = rcDefaultField();
  const navBtn = document.querySelector('.nav-tab[data-page="revcalc"]');
  if (navBtn) navBtn.click();
  renderRevCalcAll();
}
window.loadSideToRevCalc = loadSideToRevCalc;

