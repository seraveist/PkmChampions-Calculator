/* Calculator-specific combobox event wiring. */
function wireCalcCombobox(input, { filterFn = null, onSelect = null } = {}) {
  const cbParent = input.closest('.combobox');
  const optsEl = cbParent?.querySelector('.combobox-options');
  if (!cbParent || !optsEl) return;

  const cbType = input.dataset.cbType;
  const side = input.dataset.side || null;
  if (cbType === 'pokemon') {
    return wirePokemonSelectCombobox(input, {
      getOptions: () => calcDatasetForCombobox(side, 'pokemon'),
      getCurrentId: () => calcComboboxCurrentId(input),
      getDisplayLabel: () => calcComboboxDisplayLabel(input),
      onSelect,
      selectTextOnFocus: true,
      wiredKey: 'calcPokemonWired',
    });
  }

  const usesPortal = calcMountComboboxPortal(input, cbParent, optsEl);
  const filter = filterFn || makeCombobox(side, cbType);
  const isButtonTrigger = input.tagName === 'BUTTON';
  let activeIndex = -1;
  let activeByKeyboard = false;
  let justSelected = false;

  if (!optsEl.id) optsEl.id = `calc-cb-list-${++calcComboboxUid}`;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-autocomplete', isButtonTrigger ? 'none' : 'list');
  input.setAttribute('aria-controls', optsEl.id);
  const showOptionTooltip = calcShowOptionTooltip;
  const hideOptionTooltip = calcHideOptionTooltip;

  function getOptionEls() {
    return [...optsEl.querySelectorAll('.combobox-option:not(.empty)')];
  }

  function closeOptions() {
    hideOptionTooltip();
    optsEl.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    activeByKeyboard = false;
  }

  function restoreDisplayLabel() {
    setDisplayLabel(calcComboboxDisplayLabel(input));
  }

  function applyOptionalEmptyValue() {
    if (!['move', 'item', 'ability'].includes(cbType)) return false;
    closeOptions();
    if (onSelect) onSelect('', null);
    if (cbType === 'move') setDisplayLabel('');
    else setDisplayLabel('없음');
    return true;
  }

  function handleInvalidTypedInput() {
    if (applyOptionalEmptyValue()) return false;
    closeOptions();
    restoreDisplayLabel();
    return false;
  }

  function applyEmptyItemIfBlank() {
    if (isButtonTrigger || cbType !== 'item' || String(input.value || '').trim()) return false;
    closeOptions();
    if (onSelect) onSelect('', null);
    setDisplayLabel('없음');
    return true;
  }

  function setDisplayLabel(label) {
    if (isButtonTrigger) {
      input.textContent = label;
      input.value = label;
    } else {
      input.value = label;
    }
  }

  function queryValue() {
    return isButtonTrigger ? '' : input.value;
  }

  function setActiveOption(nextIndex, byKeyboard = false) {
    const options = getOptionEls();
    activeIndex = options.length ? Math.max(-1, Math.min(nextIndex, options.length - 1)) : -1;
    activeByKeyboard = byKeyboard;
    input.removeAttribute('aria-activedescendant');
    options.forEach((option, index) => {
      const active = index === activeIndex;
      option.classList.toggle('active', active);
      if (active) {
        input.setAttribute('aria-activedescendant', option.id);
        if (typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function optionTemplate(option, currentId) {
    return calcRenderComboboxOption(cbType, option, currentId);
  }

  function showOptions(query, { activateFirst = false } = {}) {
    justSelected = false;
    hideOptionTooltip();
    const matches = filter(query);
    const hasQuery = !!calcSearchText(query).trim();
    const extraOptions = calcComboboxExtraOptions(cbType)
      .filter(option => !hasQuery || calcMatches(query, option.id, option.label, option.sub));
    const currentId = calcComboboxCurrentId(input);
    const optionData = [...extraOptions, ...matches];
    const html = [];
    const header = calcComboboxHeaderHtml(cbType);
    if (header) html.push(header);
    html.push(...optionData.map(option => optionTemplate(option, currentId)));
    if (!matches.length) {
      html.push('<div class="combobox-option empty" aria-disabled="true"><b>검색 결과 없음</b></div>');
    }
    optsEl.innerHTML = html.join('');
    getOptionEls().forEach((option, index) => {
      option.id = `${optsEl.id}-opt-${index}`;
    });

    if (typeof document.querySelectorAll === 'function') {
      document.querySelectorAll('.combobox-options.open').forEach(el => {
        if (el !== optsEl) el.classList.remove('open');
      });
      document.querySelectorAll('.cb-input[aria-expanded="true"]').forEach(el => {
        if (el !== input) el.setAttribute('aria-expanded', 'false');
      });
    }

    optsEl.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
    calcComboboxMarkOpened(input);
    const selectedIndex = optionData.findIndex(option => String(option?.id || '') === String(currentId));
    setActiveOption(activateFirst ? 0 : selectedIndex);
    if (usesPortal) calcPositionComboboxPortal(input, optsEl, cbType);

    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (typeof window === 'undefined' || typeof optsEl.getBoundingClientRect !== 'function') return;
      if (usesPortal) {
        calcPositionComboboxPortal(input, optsEl, cbType);
        return;
      }
      const rect = optsEl.getBoundingClientRect();
      const overflowRight = rect.right > window.innerWidth - 8;
      optsEl.style.left = overflowRight ? 'auto' : '';
      optsEl.style.right = overflowRight ? '0' : '';
    });
  }

  function selectOption(opt) {
    if (!opt || opt.classList.contains('empty')) return;
    const id = opt.dataset.id || '';
    justSelected = true;
    setDisplayLabel(opt.querySelector('b')?.textContent || calcComboboxDisplayLabel(input));
    closeOptions();
    if (onSelect) onSelect(id, opt);
  }
  const touchOptions = calcWireComboboxTouchOptions(optsEl, option => selectOption(option));

  function findExactOptionForInput() {
    const query = queryValue();
    if (!String(query || '').trim()) return null;
    if (!optsEl.classList.contains('open')) showOptions(query);
    return getOptionEls().find(option => calcComboboxOptionMatchesExactText(option, query)) || null;
  }

  function commitTypedInput() {
    if (isButtonTrigger) return false;
    if (justSelected) {
      justSelected = false;
      return true;
    }
    const query = queryValue();
    if (!String(query || '').trim()) return false;
    const exact = findExactOptionForInput();
    if (exact) {
      selectOption(exact);
      return true;
    }
    return handleInvalidTypedInput();
  }

  input.addEventListener('focus', () => {
    if (isButtonTrigger) return;
    showOptions('');
    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (!isButtonTrigger && typeof input.select === 'function') input.select();
    });
  });
  input.addEventListener('mousedown', e => {
    if (input.readOnly || isButtonTrigger) e.stopPropagation();
  });
  input.addEventListener('click', e => {
    if (!input.readOnly && !isButtonTrigger) {
      showOptions('');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (document.activeElement !== input && typeof input.focus === 'function') {
      input.focus({ preventScroll: true });
    }
    showOptions('');
  });
  input.addEventListener('input', () => showOptions(queryValue(), { activateFirst: true }));
  input.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    const isOpen = optsEl.classList.contains('open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) showOptions(queryValue());
      const options = getOptionEls();
      if (!options.length) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const start = activeIndex < 0 ? (delta > 0 ? -1 : 0) : activeIndex;
      setActiveOption((start + delta + options.length) % options.length, true);
    } else if (e.key === 'Enter' && !isButtonTrigger) {
      e.preventDefault();
      if (!isOpen) showOptions(queryValue(), { activateFirst: true });
      const activeOption = getOptionEls()[activeIndex] || null;
      if (activeOption) selectOption(activeOption);
      else if (!applyEmptyItemIfBlank()) handleInvalidTypedInput();
    } else if (e.key === 'Enter' && applyEmptyItemIfBlank()) {
      e.preventDefault();
    } else if ((e.key === 'Enter' || e.key === ' ') && isButtonTrigger && !isOpen) {
      e.preventDefault();
      showOptions('');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeOptions();
      restoreDisplayLabel();
      if (!isButtonTrigger && typeof input.select === 'function') input.select();
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (calcComboboxFocusMovedToAnother(input, optsEl)) {
        closeOptions();
        restoreDisplayLabel();
        return;
      }
      if (justSelected) {
        justSelected = false;
        closeOptions();
        return;
      }
      if (applyEmptyItemIfBlank()) return;
      if (!isButtonTrigger && !String(queryValue() || '').trim() && applyOptionalEmptyValue()) return;
      if (commitTypedInput()) return;
      closeOptions();
      restoreDisplayLabel();
    }, 200);
  });

  function handleOptionSelect(e) {
    if (touchOptions.shouldIgnoreMouseEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const opt = e.target.closest('.combobox-option');
    if (!opt || opt.classList.contains('empty')) return;
    e.preventDefault();
    e.stopPropagation();
    if (isButtonTrigger && (e.type === 'mousedown' || e.type === 'touchstart')) return;
    selectOption(opt);
  }

  optsEl.addEventListener('mousedown', handleOptionSelect);
  optsEl.addEventListener('click', e => {
    if (!isButtonTrigger) return;
    handleOptionSelect(e);
  });
  optsEl.addEventListener('mouseover', e => {
    const opt = e.target.closest('.tooltip-option[data-tooltip]');
    if (opt && optsEl.contains(opt)) showOptionTooltip(opt);
  });
  optsEl.addEventListener('mouseout', e => {
    const opt = e.target.closest('.tooltip-option[data-tooltip]');
    if (opt && !opt.contains(e.relatedTarget)) hideOptionTooltip();
  });
  optsEl.addEventListener('scroll', hideOptionTooltip);
  optsEl.addEventListener('mousemove', e => {
    const opt = e.target.closest('.combobox-option:not(.empty)');
    if (!opt) return;
    const index = getOptionEls().indexOf(opt);
    if (index >= 0 && index !== activeIndex) setActiveOption(index, false);
  });
}
