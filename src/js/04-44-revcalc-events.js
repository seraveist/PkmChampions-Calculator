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
  const evInputs = Array.from(root.querySelectorAll('[data-rc-ev], [data-tool-stat-point-input]'));
  if (evInputs.length) {
    const requested = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    evInputs.forEach(el => {
      const stat = el.dataset.toolStatPointInput || el.dataset.rcEv;
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
    rcReadExtraObservationInput(el);
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
  });
  root.querySelectorAll('[data-rc-move-option]').forEach(rcReadExtraObservationInput);
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

function rcWireComboboxKeyboard(control, optsEl, { showOptions, onSelect, getQuery = null, onInvalidInput = null } = {}) {
  // Shared helper owns aria-activedescendant and active option movement.
  if (!control.getAttribute('aria-expanded')) control.setAttribute('aria-expanded', 'false');
  return wireSharedComboboxKeyboard(control, optsEl, { showOptions, onSelect, getQuery, onInvalidInput });
}

function rcWireMyComboboxes() {
  document.getElementById('rc-my-body').querySelectorAll('.rc-cb-input').forEach(input => {
    const target = input.dataset.rcPick;
    if (target === 'my') {
      wirePokemonSelectCombobox(input, {
        wiredKey: 'rcPokemonWired',
        getOptions: () => sortPokemonForCalcSelect(POKEMON),
        getCurrentId: () => revCalcState.my.pokemonIdx || '',
        getDisplayLabel: () => pkName(PokemonById[revCalcState.my.pokemonIdx] || { name: '' }),
        onSelect: id => {
          rcNewObservation({ opponentId: revCalcState.opp.pokemonIdx, keepField: true, render: false });
          rcApplyMyPokemonSelection(id);
          renderRevCalcAll();
        },
        renderOption: calcRenderSimplePokemonOption,
        renderHeader: '',
      });
      return;
    }

    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      if (target === 'my') {
        const matches = sortPokemonForCalcSelect(POKEMON).filter(d => calcMatches(s, d.koName || pkName(d)));
        renderTrustedHTML(optsEl, calcComboboxHeaderHtml('pokemon') + matches.map(m => calcRenderPokemonOption(m, revCalcState.my.pokemonIdx)).join(''));
      } else if (target === 'myForm') {
        const matches = calcFormOptionDataForPokemon(revCalcState.my.pokemonIdx).filter(option => rcComboSearchMatches(s, option));
        renderTrustedHTML(optsEl, matches.length
          ? matches.map(option => calcRenderComboboxOption('form', option, revCalcState.my.pokemonIdx)).join('')
          : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>');
      } else {
        const kind = rcComboKind(target);
        const allMatches = rcComboData(kind).filter(option => rcComboSearchMatches(s, option));
        const matches = s ? allMatches.slice(0, kind === 'item' ? 50 : 80) : allMatches;
        const header = kind === 'nature' ? calcComboboxHeaderHtml('nature') : '';
        renderTrustedHTML(optsEl, matches.length
          ? header + matches.map(option => calcRenderComboboxOption(kind, option, rcCurrentComboId(kind))).join('')
          : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>');
      }
      optsEl.classList.add('open');
    };
    const applyOption = opt => {
      const id = opt.dataset.id;
      if (target === 'my') {
        rcApplyMyPokemonSelection(id);
      } else if (target === 'myForm') {
        applyPokemonFormToSideState(revCalcState.my, id);
      } else if (target === 'myitem') {
        revCalcState.my.item = id || '';
      } else if (target === 'mynature') {
        revCalcState.my.nature = id || 'hardy';
      } else if (target === 'myability') {
        revCalcState.my.ability = id || '';
      }
      renderRevCalcAll();
    };
    const combo = rcWireComboboxKeyboard(input, optsEl, {
      showOptions: showOpts,
      onSelect: applyOption,
    });
  });
}

function rcApplyMyPokemonSelection(id) {
  revCalcState.observedMoveOptions = { my: {}, opp: {} };
  const p = PokemonById[id];
  revCalcState.my.pokemonIdx = id;
  if (p) {
    revCalcState.my.ability = toId(p.ab['0'] || p.ab['H'] || '');
    revCalcState.my.types = [...p.types];
    revCalcState.my.teraType = p.types[0];
    revCalcState.my.item = defaultPokemonItemId(p);
  }
  revCalcState.myMove = '';
  revCalcState.myMoveSet = ['', '', '', ''];
  revCalcState.myMoveBp = '';
  revCalcState.nextMyRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

function rcDefaultKnownOpponentItemForPokemon(pokemon) {
  if (!pokemon) return 'unknown';
  const itemId = defaultPokemonItemId(pokemon);
  return itemId || 'unknown';
}

function rcWireOppComboboxes() {
  document.getElementById('rc-opp-body').querySelectorAll('.rc-cb-input').forEach(input => {
    const target = input.dataset.rcPick || 'opp';
    if (target === 'opp') {
      wirePokemonSelectCombobox(input, {
        wiredKey: 'rcPokemonWired',
        getOptions: () => sortPokemonForCalcSelect(POKEMON),
        getCurrentId: () => revCalcState.opp.pokemonIdx || '',
        getDisplayLabel: () => pkName(PokemonById[revCalcState.opp.pokemonIdx] || { name: '' }),
        onSelect: id => {
          revCalcState.opp.pokemonIdx = id;
          rcNewObservation({ opponentId: id, keepField: true, render: false });
          revCalcState.oppAbilityKnown = 'unknown';
          revCalcState.observedMoveOptions = { my: {}, opp: {} };
          const pokemon = PokemonById[revCalcState.opp.pokemonIdx];
          revCalcState.opp.item = defaultPokemonItemId(pokemon);
          revCalcState.oppItemKnown = rcDefaultKnownOpponentItemForPokemon(pokemon);
          revCalcState.oppMove = '';
          revCalcState.oppMoveBp = '';
          revCalcState.nextOppRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
          revCalcState.predictedOppMove = '';
          rcResetItemCandidatesForOpponent();
          renderRevCalcAll();
        },
        renderOption: calcRenderSimplePokemonOption,
        renderHeader: '',
      });
      return;
    }

    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      if (target === 'oppForm') {
        const matches = calcFormOptionDataForPokemon(revCalcState.opp.pokemonIdx).filter(option => rcComboSearchMatches(s, option));
        renderTrustedHTML(optsEl, matches.length
          ? matches.map(option => calcRenderComboboxOption('form', option, revCalcState.opp.pokemonIdx)).join('')
          : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>');
      } else {
        const matches = sortPokemonForCalcSelect(POKEMON).filter(d => calcMatches(s, d.koName || pkName(d)));
        renderTrustedHTML(optsEl, calcComboboxHeaderHtml('pokemon') + matches.map(m =>
          calcRenderPokemonOption(m, revCalcState.opp.pokemonIdx)
        ).join(''));
      }
      optsEl.classList.add('open');
    };
    const applyOption = opt => {
      if (target === 'oppForm') {
        applyPokemonFormToSideState(revCalcState.opp, opt.dataset.id);
        renderRevCalcAll();
        return;
      }
      rcNewObservation({ opponentId: opt.dataset.id, keepField: true, render: false });
      revCalcState.opp.pokemonIdx = opt.dataset.id;
      revCalcState.oppAbilityKnown = 'unknown';
      revCalcState.observedMoveOptions = { my: {}, opp: {} };
      const pokemon = PokemonById[revCalcState.opp.pokemonIdx];
      revCalcState.opp.item = defaultPokemonItemId(pokemon);
      revCalcState.oppItemKnown = rcDefaultKnownOpponentItemForPokemon(pokemon);
      revCalcState.oppMove = '';
      revCalcState.oppMoveBp = '';
      revCalcState.nextOppRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      revCalcState.predictedOppMove = '';
      rcResetItemCandidatesForOpponent();
      renderRevCalcAll();
    };
    const combo = rcWireComboboxKeyboard(input, optsEl, {
      showOptions: showOpts,
      onSelect: applyOption,
    });
  });
}

function rcStatusOptions() {
  const source = typeof CALC_STATUS_OPTIONS !== 'undefined' && Array.isArray(CALC_STATUS_OPTIONS) && CALC_STATUS_OPTIONS.length
    ? CALC_STATUS_OPTIONS
    : [
        { id: 'none', label: '건강', sub: '상태 이상 없음' },
        { id: 'Burn', label: '화상', sub: '물리 공격 약화' },
        { id: 'Paralysis', label: '마비', sub: '속도 약화' },
        { id: 'Poison', label: '독', sub: '독 상태' },
        { id: 'Toxic', label: '맹독', sub: '턴마다 독 누적' },
        { id: 'Sleep', label: '잠듦', sub: '수면 상태' },
        { id: 'Freeze', label: '얼음', sub: '얼음 상태' },
      ];
  return source.map(option => option.id === 'Badly Poison' ? { ...option, id: 'Toxic' } : option);
}

function rcStatusDisplayLabel(statusId) {
  const id = statusId === 'Badly Poison' ? 'Toxic' : (statusId || 'none');
  const calcLabel = typeof calcStatusDisplayLabel === 'function' ? calcStatusDisplayLabel(statusId) : '';
  return rcStatusOptions().find(option => option.id === id)?.label || calcLabel || statusId || '건강';
}

function rcStatusOptionTemplate(option, currentId) {
  const normalizedCurrent = currentId === 'Badly Poison' ? 'Toxic' : (currentId || 'none');
  const selected = String(option.id || '') === String(normalizedCurrent);
  const subHtml = option.sub ? `<small>${escapeHTML(option.sub)}</small>` : '<small></small>';
  return `<div class="combobox-option status-option${selected ? ' selected' : ''}" data-id="${escapeHTML(option.id || '')}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(option.label || '')}</b>${subHtml}</div>`;
}

function rcWireOppStatusComboboxes() {
  document.getElementById('rc-opp-body')?.querySelectorAll('[data-rc-status="opp"]').forEach(button => {
    const cb = button.closest('.combobox');
    const optsEl = cb?.querySelector('.combobox-options');
    if (!optsEl) return;

    const show = () => {
      renderTrustedHTML(optsEl, rcStatusOptions()
        .map(option => rcStatusOptionTemplate(option, revCalcState.opp.status))
        .join(''));
      optsEl.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    };
    const applyOption = opt => {
      revCalcState.opp.status = opt.dataset.id || 'none';
      uiSetPickerLabel(button,rcStatusDisplayLabel(revCalcState.opp.status));
    };
    const combo = rcWireComboboxKeyboard(button, optsEl, {
      showOptions: show,
      onSelect: applyOption,
      getQuery: () => '',
    });

    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (optsEl.classList.contains('open')) combo?.close();
      else combo?.open('');
    });

    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option:not(.empty)');
      if (!opt) return;
      e.preventDefault();
      combo?.select(opt);
    });
  });
}

function rcTurnOrderOptions() {
  return [
    { id: 'unknown', label: '미설정' },
    { id: 'opp-first', label: '상대 선공' },
    { id: 'my-first', label: '내 선공' },
  ];
}

function rcNormalizeTurnOrderValue(id) {
  return rcTurnOrderOptions().some(option => option.id === id) ? id : 'unknown';
}

function rcTurnOrderLabel(id) {
  return rcTurnOrderOptions().find(option => option.id === rcNormalizeTurnOrderValue(id))?.label || '미설정';
}

function rcRenderTurnOrderCombobox(value) {
  const current = rcNormalizeTurnOrderValue(value || 'unknown');
  if (revCalcState.turnOrder !== current) revCalcState.turnOrder = current;
  return `
    <div class="combobox rc-field-combobox rc-turn-order-combobox">
      <button type="button" class="cb-input cb-trigger" data-rc-turn-order="true" data-rc-action="turnOrder" value="${escapeHTML(current)}" aria-expanded="false">${escapeHTML(rcTurnOrderLabel(current))}</button>
      <div class="combobox-options"></div>
    </div>
  `;
}

function rcTurnOrderOptionTemplate(option, currentId) {
  const selected = String(option.id || '') === String(rcNormalizeTurnOrderValue(currentId || 'unknown'));
  return `<div class="combobox-option ui-option${selected ? ' selected' : ''}" data-id="${escapeHTML(option.id || '')}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(option.label || '')}</b></div>`;
}

function rcWireTurnOrderComboboxes(scope) {
  const root = scope || document.getElementById('page-revcalc');
  if (!root) return;
  root.querySelectorAll('[data-rc-turn-order]').forEach(button => {
    const cb = button.closest('.combobox');
    const optsEl = cb?.querySelector('.combobox-options');
    if (!optsEl) return;

    const show = () => {
      document.querySelectorAll('#page-revcalc .combobox-options.open').forEach(el => {
        if (el !== optsEl) el.classList.remove('open');
      });
      document.querySelectorAll('#page-revcalc .cb-input[aria-expanded="true"]').forEach(el => {
        if (el !== button) el.setAttribute('aria-expanded', 'false');
      });
      renderTrustedHTML(optsEl, rcTurnOrderOptions()
        .map(option => rcTurnOrderOptionTemplate(option, revCalcState.turnOrder))
        .join(''));
      optsEl.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    };
    const applyOption = opt => {
      revCalcState.turnOrder = rcNormalizeTurnOrderValue(opt.dataset.id || 'unknown');
      button.value = revCalcState.turnOrder;
      uiSetPickerLabel(button,rcTurnOrderLabel(revCalcState.turnOrder));
      renderRevCalcResults();
    };
    const combo = rcWireComboboxKeyboard(button, optsEl, {
      showOptions: show,
      onSelect: applyOption,
      getQuery: () => '',
    });

    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (optsEl.classList.contains('open')) combo?.close();
      else combo?.open('');
    });

    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option:not(.empty)');
      if (!opt) return;
      e.preventDefault();
      combo?.select(opt);
    });
  });
}

function rcFieldComboboxLabel(kind, value) {
  if (typeof calcFieldOptionLabel === 'function') return calcFieldOptionLabel(kind, value || 'none');
  const options = {
    weather: [
      { id: 'none', label: '없음' },
      { id: 'Sun', label: '쾌청' },
      { id: 'Rain', label: '비' },
      { id: 'Sand', label: '모래바람' },
      { id: 'Snow', label: '눈' },
      { id: 'Harsh Sunshine', label: '대쾌청' },
      { id: 'Heavy Rain', label: '강한비' },
    ],
    terrain: [
      { id: 'none', label: '없음' },
      { id: 'Electric', label: '일렉트릭필드' },
      { id: 'Grassy', label: '그래스필드' },
      { id: 'Psychic', label: '사이코필드' },
      { id: 'Misty', label: '미스트필드' },
    ],
  };
  return options[kind]?.find(option => option.id === value)?.label || value || '없음';
}

function rcRenderFieldCombobox(kind, value) {
  const current = value || 'none';
  const battleKindClass = kind === 'weather'
    ? ' battle-field-combobox battle-weather-combobox ui-choice-combobox'
    : kind === 'terrain'
      ? ' battle-field-combobox battle-terrain-combobox ui-choice-combobox'
      : '';
  const battleSurfaceClass = kind === 'weather' || kind === 'terrain' ? ' ui-choice-surface' : '';
  return `
    <div class="combobox rc-field-combobox rc-${escapeHTML(kind)}-combobox${battleKindClass}">
      <button type="button" class="cb-input cb-trigger${battleSurfaceClass}" data-rc-field-combobox="${escapeHTML(kind)}" data-rc-field="${escapeHTML(kind)}" data-cb-type="${escapeHTML(kind)}" data-value="${escapeHTML(current)}" value="${escapeHTML(current)}" aria-expanded="false">${escapeHTML(rcFieldComboboxLabel(kind, current))}</button>
      <div class="combobox-options"></div>
    </div>
  `;
}

function rcWireFieldComboboxes(scope) {
  const root = scope || document.getElementById('page-revcalc');
  if (!root || typeof wireCalcCombobox !== 'function') return;
  root.querySelectorAll('[data-rc-field-combobox]').forEach(button => {
    wireCalcCombobox(button, {
      onSelect: id => {
        const kind = button.dataset.rcFieldCombobox;
        const next = id || 'none';
        revCalcState.field[kind] = next;
        button.dataset.value = next;
        button.value = next;
        button.textContent = rcFieldComboboxLabel(kind, next);
        renderRevCalcResults();
      },
    });
  });
}

function rcWireMoveComboboxes(scope) {
  const root = scope || document.getElementById('page-revcalc');
  root?.querySelectorAll('[data-rc-move-picker]').forEach(input => {
    const target = input.dataset.rcMovePicker, slot = input.dataset.rcMoveSlot;
    const list = input.closest('.combobox')?.querySelector('.combobox-options');
    if (!list || input.dataset.pickerWired) return;
    input.dataset.pickerWired='1';
    const current=()=>target==='moveslot' ? rcMoveSet()[Number(slot)] || '' : target==='knownOppMove' ? revCalcState.knownOppMoves?.[Number(slot)] || '' : revCalcState[target] || '';
    const combo=wireSharedComboboxKeyboard(input,list,{
      showOptions:query=>{
        const rows=[rcMoveNoneOption(),...rcMovePoolForPicker(target)].filter(move=>rcMoveMatchesQuery(move,query));
        renderTrustedHTML(list,rows.map(move=>calcRenderMoveOption(move,current())).join('') || '<div class="combobox-option empty">검색 결과 없음</div>');
      },
      onSelect:option=>{
        const id=option.dataset.id || '';
        rcSetMovePickerValue(target,id,slot);
        uiSetPickerLabel(input,rcMoveLabel(id));
        if(target==='moveslot') renderRevCalcMy();
        if(['moveslot','myMove','oppMove'].includes(target)) renderRevCalcInputs();
        renderRevCalcResults();
      },
    });
    input.addEventListener('click',()=>combo.open(''));
  });
}

function rcOppItemOptions() {
  return [
    { id: 'unknown', label: '미관측', sub: '상대 도구를 알 수 없음' },
    { id: '', label: '없음', sub: '도구 없음 확인' },
    ...sortItemsForCalcSelect(ITEMS).map(item => ({
      id: item.id,
      label: itName(item),
      sub: item.name || item.id,
      raw: item,
    })),
  ];
}

function rcOppItemLabel(itemId) {
  if (itemId === 'unknown' || itemId === undefined || itemId === null) return '미관측';
  if (itemId === '') return '없음';
  return ItemById[itemId] ? itName(ItemById[itemId]) : itemId;
}

function rcRenderOppItemCombobox(itemId) {
  return `
    <div class="combobox rc-opp-item-combobox">
      <button type="button" class="ui-button ui-select-trigger cb-trigger cb-input rc-opp-item-input" data-rc-opp-item="known" value="${escapeHTML(rcOppItemLabel(itemId))}"><span class="ui-select-content picker-label">${escapeHTML(rcOppItemLabel(itemId))}</span>${RotomUI.icon('chevron')}</button>
      <div class="combobox-options"></div>
    </div>
  `;
}

function rcWireOppItemComboboxes(scope) {
  const root=scope || document.getElementById('page-revcalc');
  root?.querySelectorAll('[data-rc-opp-item="known"]').forEach(input=>{
    const list=input.closest('.combobox')?.querySelector('.combobox-options');
    if(!list) return;
    const combo=wireSharedComboboxKeyboard(input,list,{
      showOptions:query=>{
        const rows=rcOppItemOptions().filter(option=>calcMatches(query,option.id,option.label,option.sub,option.raw?.name));
        renderTrustedHTML(list,rows.map(option=>calcRenderItemOption(option,revCalcState.oppItemKnown)).join('') || '<div class="combobox-option empty">검색 결과 없음</div>');
      },
      onSelect:option=>{
        revCalcState.oppItemKnown=option.dataset.id || '';
        rcResetItemCandidatesForOpponent();renderRevCalcInputs();renderRevCalcResults();
      },
    });
    input.addEventListener('click',()=>combo.open(''));
  });
}
