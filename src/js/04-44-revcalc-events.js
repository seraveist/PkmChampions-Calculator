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

function rcWireComboboxKeyboard(control, optsEl, { showOptions, onSelect, getQuery = null, onInvalidInput = null } = {}) {
  // Shared helper owns aria-activedescendant and active option movement.
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
          rcApplyMyPokemonSelection(id);
          renderRevCalcAll();
        },
      });
      return;
    }

    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const isButtonTrigger = input.tagName === 'BUTTON';
    const showOpts = q => {
      calcHideOptionTooltip();
      const s = (q || '').toLowerCase();
      if (target === 'my') {
        const matches = sortPokemonForCalcSelect(POKEMON).filter(d => calcMatches(s, d.koName || pkName(d)));
        optsEl.innerHTML = calcComboboxHeaderHtml('pokemon') + matches.map(m => calcRenderPokemonOption(m, revCalcState.my.pokemonIdx)).join('');
      } else if (target === 'myForm') {
        const matches = calcFormOptionDataForPokemon(revCalcState.my.pokemonIdx).filter(option => rcComboSearchMatches(s, option));
        optsEl.innerHTML = matches.length
          ? matches.map(option => calcRenderComboboxOption('form', option, revCalcState.my.pokemonIdx)).join('')
          : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      } else {
        const kind = rcComboKind(target);
        const allMatches = rcComboData(kind).filter(option => rcComboSearchMatches(s, option));
        const matches = s ? allMatches.slice(0, kind === 'item' ? 50 : 80) : allMatches;
        const header = kind === 'nature' ? calcComboboxHeaderHtml('nature') : '';
        optsEl.innerHTML = matches.length
          ? header + matches.map(option => calcRenderComboboxOption(kind, option, rcCurrentComboId(kind))).join('')
          : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      }
      closeSiblingComboboxOptions(optsEl, input);
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
      calcHideOptionTooltip();
      renderRevCalcAll();
    };
    const restoreInput = () => {
      input.value = target === 'my'
        ? pkName(PokemonById[revCalcState.my.pokemonIdx] || { name: '' })
        : target === 'myForm'
          ? calcPokemonFormLabel(PokemonById[revCalcState.my.pokemonIdx])
        : rcComboLabel(rcComboKind(target), rcCurrentComboId(rcComboKind(target)));
    };
    const clearOptionalInput = () => {
      if (!['myitem', 'myability'].includes(target)) return false;
      calcHideOptionTooltip();
      combo?.close();
      if (target === 'myitem') revCalcState.my.item = '';
      if (target === 'myability') revCalcState.my.ability = '';
      renderRevCalcAll();
      return true;
    };
    const handleInvalidInput = () => {
      if (!clearOptionalInput()) restoreInput();
    };
    const combo = rcWireComboboxKeyboard(input, optsEl, {
      showOptions: showOpts,
      onSelect: applyOption,
      getQuery: () => input.value || '',
      onInvalidInput: handleInvalidInput,
    });
    input.addEventListener('focus', () => combo?.open(''));
    input.addEventListener('click', () => combo?.open(''));
    input.addEventListener('input', e => combo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('blur', () => setTimeout(() => {
      if (isButtonTrigger) {
        return;
      }
      if (!String(input.value || '').trim()) {
        if (clearOptionalInput()) return;
        calcHideOptionTooltip();
        combo?.close();
        restoreInput();
        return;
      }
      calcHideOptionTooltip();
      combo?.commitTyped();
    }, 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      if (isButtonTrigger) return;
      combo?.select(opt);
    });
    optsEl.addEventListener('click', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      combo?.select(opt);
    });
    optsEl.addEventListener('mouseover', e => {
      const opt = e.target.closest('.tooltip-option[data-tooltip]');
      if (opt && optsEl.contains(opt)) calcShowOptionTooltip(opt);
    });
    optsEl.addEventListener('mouseout', e => {
      const opt = e.target.closest('.tooltip-option[data-tooltip]');
      if (opt && !opt.contains(e.relatedTarget)) calcHideOptionTooltip();
    });
    optsEl.addEventListener('scroll', calcHideOptionTooltip);
  });
}

function rcApplyMyPokemonSelection(id) {
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
      });
      return;
    }

    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const isButtonTrigger = input.tagName === 'BUTTON';
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      if (target === 'oppForm') {
        const matches = calcFormOptionDataForPokemon(revCalcState.opp.pokemonIdx).filter(option => rcComboSearchMatches(s, option));
        optsEl.innerHTML = matches.length
          ? matches.map(option => calcRenderComboboxOption('form', option, revCalcState.opp.pokemonIdx)).join('')
          : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      } else {
        const matches = sortPokemonForCalcSelect(POKEMON).filter(d => calcMatches(s, d.koName || pkName(d)));
        optsEl.innerHTML = calcComboboxHeaderHtml('pokemon') + matches.map(m =>
          calcRenderPokemonOption(m, revCalcState.opp.pokemonIdx)
        ).join('');
      }
      closeSiblingComboboxOptions(optsEl, input);
      optsEl.classList.add('open');
    };
    const applyOption = opt => {
      if (target === 'oppForm') {
        applyPokemonFormToSideState(revCalcState.opp, opt.dataset.id);
        renderRevCalcAll();
        return;
      }
      revCalcState.opp.pokemonIdx = opt.dataset.id;
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
      getQuery: () => input.value || '',
      onInvalidInput: () => {
        input.value = target === 'oppForm'
          ? calcPokemonFormLabel(PokemonById[revCalcState.opp.pokemonIdx])
          : pkName(PokemonById[revCalcState.opp.pokemonIdx] || { name: '' });
      },
    });
    input.addEventListener('focus', () => combo?.open(''));
    input.addEventListener('click', () => combo?.open(''));
    input.addEventListener('input', e => combo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('blur', () => setTimeout(() => {
      if (isButtonTrigger) {
        return;
      }
      if (!String(input.value || '').trim()) {
        combo?.close();
        input.value = pkName(PokemonById[revCalcState.opp.pokemonIdx] || { name: '' });
        return;
      }
      combo?.commitTyped();
    }, 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      if (isButtonTrigger) return;
      combo?.select(opt);
    });
    optsEl.addEventListener('click', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      combo?.select(opt);
    });
  });
  rcWireOppStatusComboboxes();
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
      optsEl.innerHTML = rcStatusOptions()
        .map(option => rcStatusOptionTemplate(option, revCalcState.opp.status))
        .join('');
      optsEl.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    };
    const applyOption = opt => {
      revCalcState.opp.status = opt.dataset.id || 'none';
      button.textContent = rcStatusDisplayLabel(revCalcState.opp.status);
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
    button.addEventListener('blur', () => setTimeout(() => combo?.close(), 160));
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
  return `<div class="combobox-option rc-turn-order-option${selected ? ' selected' : ''}" data-id="${escapeHTML(option.id || '')}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(option.label || '')}</b></div>`;
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
      optsEl.innerHTML = rcTurnOrderOptions()
        .map(option => rcTurnOrderOptionTemplate(option, revCalcState.turnOrder))
        .join('');
      optsEl.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    };
    const applyOption = opt => {
      revCalcState.turnOrder = rcNormalizeTurnOrderValue(opt.dataset.id || 'unknown');
      button.value = revCalcState.turnOrder;
      button.textContent = rcTurnOrderLabel(revCalcState.turnOrder);
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
    button.addEventListener('blur', () => setTimeout(() => combo?.close(), 160));
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
  return `
    <div class="combobox rc-field-combobox rc-${escapeHTML(kind)}-combobox">
      <button type="button" class="cb-input cb-trigger" data-rc-field-combobox="${escapeHTML(kind)}" data-rc-field="${escapeHTML(kind)}" data-cb-type="${escapeHTML(kind)}" data-value="${escapeHTML(current)}" value="${escapeHTML(current)}" aria-expanded="false">${escapeHTML(rcFieldComboboxLabel(kind, current))}</button>
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
      const noneOption = rcMoveNoneOption();
      const noneMatches = rcMoveMatchesQuery(noneOption, q) ? [noneOption] : [];
      const matches = [...noneMatches, ...rcFilterMovePool(pool, q)];
      const currentId = target === 'moveslot'
        ? rcMoveSet()[parseInt(slot, 10)] || ''
        : (revCalcState[target] || '');
      optsEl.innerHTML = matches.length
        ? calcComboboxHeaderHtml('move') + matches.map(m => calcRenderMoveOption(m, currentId)).join('')
        : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      optsEl.classList.add('open');
    };

    const applyMove = id => {
      rcSetMovePickerValue(target, id, slot);
      if (target === 'moveslot') {
        renderRevCalcMy();
        renderRevCalcInputs();
        renderRevCalcResults();
      } else if (target === 'myMove') {
        renderRevCalcInputs();
        renderRevCalcResults();
      } else if (target === 'oppMove') {
        renderRevCalcInputs();
        renderRevCalcResults();
      } else if (target === 'predictedOppMove') {
        renderRevCalcResults();
      }
    };
    const combo = rcWireComboboxKeyboard(input, optsEl, {
      showOptions: showOpts,
      onSelect: opt => applyMove(opt.dataset.id || ''),
      getQuery: () => input.value || '',
      onInvalidInput: () => applyMove(''),
    });

    input.addEventListener('focus', () => combo?.open(''));
    input.addEventListener('click', () => combo?.open(''));
    input.addEventListener('input', e => combo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('compositionend', e => combo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (e.key !== 'Enter') return;
      const pool = rcMovePoolForPicker(target);
      const id = rcBestMoveForTypedName(input.value, pool);
      if (id === undefined) return;
      e.preventDefault();
      applyMove(id);
    });
    input.addEventListener('blur', () => {
      setTimeout(() => combo?.close(), 180);
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
          applyMove('');
        }
      }, 180);
    });
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option:not(.empty)');
      if (!opt) return;
      selectingMoveOption = true;
      e.preventDefault();
      combo?.select(opt);
    });
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
      <input type="text" class="cb-input rc-opp-item-input" data-rc-opp-item="known" value="${escapeHTML(rcOppItemLabel(itemId))}" placeholder="도구 선택" autocomplete="off">
      <div class="combobox-options"></div>
    </div>
  `;
}

function rcWireOppItemComboboxes(scope) {
  const root = scope || document.getElementById('page-revcalc');
  if (!root) return;
  root.querySelectorAll('[data-rc-opp-item="known"]').forEach(input => {
    const cb = input.closest('.combobox');
    const optsEl = cb?.querySelector('.combobox-options');
    if (!optsEl) return;
    let selectingItemOption = false;

    const matchesFor = query => {
      const q = String(query || '').trim().toLowerCase();
      const options = rcOppItemOptions();
      if (!q) return options;
      return options.filter(option => [option.id, option.label, option.sub, option.raw?.name, option.raw?.koName]
        .some(value => String(value || '').toLowerCase().includes(q)));
    };
    const restore = () => { input.value = rcOppItemLabel(revCalcState.oppItemKnown); };
    const showOpts = query => {
      const matches = matchesFor(query);
      optsEl.innerHTML = matches.length
        ? matches.map(option => calcRenderComboboxOption('item', option, revCalcState.oppItemKnown || '')).join('')
        : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      optsEl.classList.add('open');
    };
    const applyItem = id => {
      revCalcState.oppItemKnown = id === undefined ? 'unknown' : id;
      rcResetItemCandidatesForOpponent();
      renderRevCalcInputs();
      renderRevCalcResults();
    };
    const combo = rcWireComboboxKeyboard(input, optsEl, {
      showOptions: showOpts,
      onSelect: opt => applyItem(opt.dataset.id || ''),
      getQuery: () => input.value || '',
      onInvalidInput: () => applyItem(''),
    });

    input.addEventListener('focus', () => combo?.open(''));
    input.addEventListener('click', () => combo?.open(''));
    input.addEventListener('input', e => combo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (e.key !== 'Enter') return;
      if (!String(input.value || '').trim()) {
        e.preventDefault();
        applyItem('');
        return;
      }
      const first = matchesFor(input.value)[0];
      if (!first) return;
      e.preventDefault();
      applyItem(first.id || '');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => combo?.close(), 180);
      setTimeout(() => {
        if (selectingItemOption) {
          selectingItemOption = false;
          return;
        }
        if (!String(input.value || '').trim()) {
          applyItem('');
          return;
        }
        const exact = matchesFor(input.value)
          .find(option => calcSearchText(option.label).trim() === calcSearchText(input.value).trim()
            || calcSearchText(option.id).trim() === calcSearchText(input.value).trim());
        if (exact) applyItem(exact.id || '');
        else applyItem('');
      }, 180);
    });
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option:not(.empty)');
      if (!opt) return;
      selectingItemOption = true;
      e.preventDefault();
      combo?.select(opt);
    });
  });
}

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
    if (badge) badge.textContent = `${rcActiveItemCandidates().length}개`;
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
  revCalcState.field = rcDefaultField();
  const navBtn = document.querySelector('.nav-tab[data-page="revcalc"]');
  if (navBtn) navBtn.click();
  renderRevCalcAll();
}
window.loadSideToRevCalc = loadSideToRevCalc;
