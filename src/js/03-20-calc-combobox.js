/* Damage calculator move estimation and combobox helpers. */
const ENTRY_EFFECTS = RULES.entryEffects || {};
const INTIMIDATE_BLOCKERS = RULES.entryEffectBlockers?.intimidate || [];

// 틀깨기에 무시되는 방어측 특성
// 기술 위력 / 결정력 추정
// 결정력 = 공격(특공) 실수치 × 기술 위력 × STAB × 도구 × 특성 보정
//   ※ 타입 상성, 방어측 보정은 제외
//   예: 파이어로 고집 A32 + 구애머리띠 → 브레이브버드 = 146 × 120 × 1.5 × 1.5 = 39420
function estimateMovePower(side, move, targetSide = state.def) {
  if (!move || move.cat === 'Status') return { bp: '—', eff: '—' };
  const types = effectiveTypes(side);
  const ab = side.ability;
  const abilityData = AbilityById[ab];
  const item = side.item;
  const stats = calcStats(side);
  // 가변 위력 기술 위력은 자기 자신을 상대로 가정한 추정치로 보여준다 (estimate 용도)
  const defStats = calcStats(targetSide);
  const estimateField = { ...state.field };
  const estimateAtkSpe = effectiveSpeed(side, estimateField);
  const estimateDefSpe = effectiveSpeed(targetSide, estimateField);
  estimateField.atkMovesFirst = estimateAtkSpe > estimateDefSpe;
  estimateField.atkMovesSecond = estimateAtkSpe < estimateDefSpe;
  const variableBp = computeVariableBp(move, side, targetSide, estimateField, stats, defStats);

  let moveType = move.type;
  let bp = variableBp || move.bp;
  if (!bp) return { bp: '—', eff: '—' };

  // 타입 변환 특성 + BP 보정
  let typeMult = 1.0;
  const typeChange = abilityData?.typeChange;
  if (!move.manualType && typeChange && (!typeChange.from || moveType === typeChange.from) && (!typeChange.flag || move.flags?.[typeChange.flag])) {
    moveType = typeChange.type;
    if (typeChange.mod) typeMult = mechanicMod(typeChange.mod) / 4096;
  }

  // Tera Blast Stellar: 100 BP 고정
  if (!move.manualType && move.typeChangeKind === 'teraBlast' && side.tera && side.teraType === 'Stellar') bp = 100;

  // 카테고리 결정 (Tera Blast / Photon Geyser는 동적)
  let category = move.cat;
  if (move.categoryChangeKind === 'higherOffense' && (move.typeChangeKind !== 'teraBlast' || side.tera)) {
    if (stats.atk > stats.spa) category = 'Physical';
    else category = 'Special';
  }
  const isPhysical = category === 'Physical';

  // 공격 실수치 (성격 보정 포함, calcStats가 이미 처리)
  const atkStat = isPhysical ? stats.atk : stats.spa;

  // STAB 계수
  let stabMod = 1.0;
  const isOriginal = types.includes(moveType);
  const isTera = side.tera && side.teraType === moveType;
  const isStellar = side.tera && side.teraType === 'Stellar';
  const hasAdaptability = abilityData?.stabBoost === 'adaptability';
  if (isStellar) {
    stabMod = isOriginal ? (hasAdaptability ? 2.25 : 2.0) : 1.5;
  } else if (isTera && isOriginal) {
    stabMod = hasAdaptability ? 2.25 : 2.0;
  } else if (isTera || isOriginal) {
    stabMod = (isOriginal && hasAdaptability) ? 2.0 : 1.5;
  } else if (abilityData?.volatileStab) {
    stabMod = 1.5;
  }

  // 다단 히트 / 부자유친
  let hits = 1;
  if (move.mh) {
    if (Array.isArray(move.mh)) {
      if (ItemById[item]?.multiHitModifier === 'loadedDice' && move.mh[1] === 5) hits = 4.5;
      else if (abilityData?.multiHitModifier === 'max') hits = move.mh[1];
      else if (move.mh[0] === 2 && move.mh[1] === 5) hits = 3.167;
      else hits = (move.mh[0] + move.mh[1]) / 2;
    } else {
      hits = move.mh;
    }
  }
  if (abilityData?.extraHitModifier?.singleHitOnly && !move.mh && move.cat !== 'Status') {
    hits = mechanicMod(abilityData.extraHitModifier.mod) / 4096;
  }

  // 특성 위력 보정 (BP 단계)
  let abilityMult = 1.0;
  const estimateCtx = {
    atkSide: side,
    defSide: targetSide,
    move,
    field: state.field,
    bp,
    moveType,
    weather: state.field.weather,
    effectiveness: 1,
    isCritical: false,
    isPhysical,
  };
  for (const rule of abilityData?.bpBoosts || []) {
    if (abilityRuleApplies(rule, estimateCtx)) abilityMult *= mechanicMod(rule.mod) / 4096;
  }

  // 특성 공격 보정 (Atk 단계)
  let atkMult = 1.0;
  for (const rule of abilityData?.attackStatBoosts || []) {
    if (abilityRuleApplies(rule, estimateCtx)) atkMult *= mechanicMod(rule.mod) / 4096;
  }

  // 도구 보정
  let itemMult = 1.0;
  const itemData = ItemById[item];
  if (itemData?.attackStatBoost && statBoostApplies(PokemonById[side.pokemonIdx], itemData.attackStatBoost, isPhysical ? 'atk' : 'spa')) {
    itemMult *= mechanicMod(itemData.attackStatBoost.mod) / 4096;
  }
  if (itemData?.finalDamageBoost?.kind === 'always') itemMult *= mechanicMod(itemData.finalDamageBoost.mod) / 4096;
  if (itemData?.typeBoostType === moveType) itemMult *= 1.2;
  if (itemData?.powerBoostKind === 'physical' && isPhysical) itemMult *= 1.1;
  if (itemData?.powerBoostKind === 'special' && !isPhysical) itemMult *= 1.1;
  if (itemData?.powerBoostKind === 'punch' && move.flags?.punch) itemMult *= 1.1;
  // 결정력 = 공격 실수치 × 위력 × STAB × 다단 × 특성BP × 특성Atk × 도구 × 타입변환
  const eff = Math.round(atkStat * bp * stabMod * hits * abilityMult * atkMult * itemMult * typeMult);

  return { bp, eff, atkStat };
}

const CALC_NATURE_SORT_STATS = ['atk', 'def', 'spa', 'spd', 'spe'];

function calcNatureSortRank(stat) {
  const rank = CALC_NATURE_SORT_STATS.indexOf(stat);
  return rank >= 0 ? rank : 99;
}

function calcSortNatureOptions(options) {
  return [...options].sort((a, b) => {
    const upDiff = calcNatureSortRank(a?.up) - calcNatureSortRank(b?.up);
    if (upDiff) return upDiff;
    const downDiff = calcNatureSortRank(a?.down) - calcNatureSortRank(b?.down);
    if (downDiff) return downDiff;
    return calcNatureLabel(a).localeCompare(calcNatureLabel(b), 'ko');
  });
}

function calcAbilityOptionDataForPokemon(pokemonId, currentAbility = '', { includeEmpty = true, emptySub = '특성 없음' } = {}) {
  const pokemon = PokemonById[pokemonId];
  const abilities = Object.values(pokemon?.ab || {})
    .map(name => AbilityById[toId(name)] || { id: toId(name), name })
    .filter(a => a.id);
  if (currentAbility && !abilities.some(a => a.id === currentAbility)) {
    abilities.push(AbilityById[currentAbility] || { id: currentAbility, name: currentAbility });
  }
  const options = abilities.map(a => ({ id: a.id, label: abName(a), sub: a.desc || a.descLong || a.name || a.id, raw: a }));
  return includeEmpty ? [{ id: '', label: '없음', sub: emptySub }, ...options] : options;
}

function calcItemOptionData({ includeEmpty = true } = {}) {
  const options = sortItemsForCalcSelect(ITEMS).map(i => ({ id: i.id, label: itName(i), sub: i.name || i.id, raw: i }));
  return includeEmpty ? [{ id: '', label: '없음', sub: '' }, ...options] : options;
}

function calcNatureOptionData() {
  return calcSortNatureOptions(NATURES).map(n => ({ id: n.id, label: calcNatureLabel(n), sub: n.up ? `${n.up}+ / ${n.down}-` : '보정 없음', raw: n }));
}

function makeCombobox(sideKey, type) {
  const dataset = calcDatasetForCombobox(sideKey, type);
  // 필터링 함수
  return (searchText) => {
    const s = calcSearchText(searchText).trim();
    const matches = dataset.filter(d => {
      if (type === 'pokemon') {
        return calcMatches(s, d.koName || pkName(d));
      }
      if (type === 'move') {
        return calcMatches(s, d.id, d.name, d.koName, d.type, TYPE_KO[d.type], d.cat, calcMoveCategoryLabel(d.cat), d.desc, d.descLong);
      }
      if (type === 'type1' || type === 'type2' || type === 'moveType') {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      if (type === 'ability') {
        return calcMatches(s, d.id, d.name, d.koName, d.desc, d.descLong);
      }
      if (type === 'nature') {
        return calcMatches(s, d.id, d.ko, calcNatureLabel(d), STAT_LABEL[d.up], STAT_LABEL[d.down], d.up, d.down);
      }
      if (type === 'status') {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      if (type === 'form') {
        return calcMatches(s, d.id, d.label, d.sub, d.raw?.name, d.raw?.koName, d.raw?.forme, d.raw?.baseForme);
      }
      if (CALC_FIELD_OPTION_SETS[type]) {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      // 챔피언스 빌드는 build 단계에서 이미 Past 아이템을 걸러내므로 런타임 필터 불필요.
      return calcMatches(s, d.id, d.name, d.koName, d.desc, d.descLong, calcItemCategoryLabel(d), ...(d.itemUser || []));
    });
    if (type === 'pokemon' || type === 'move') return matches;
    if (type === 'nature') return calcSortNatureOptions(matches).slice(0, 30);
    return matches.slice(0, 30);
  };
}

let calcComboboxUid = 0;
let calcSharedComboboxUid = 0;
let calcComboboxLastPointerTarget = null;
let calcComboboxLastPointerAt = 0;
let calcComboboxLastOpenedControl = null;
let calcComboboxLastOpenedAt = 0;
let calcComboboxPortalListenersBound = false;

function calcComboboxTrackPointerTarget(event) {
  calcComboboxLastPointerTarget = event.target?.closest?.('.combobox') || null;
  calcComboboxLastPointerAt = Date.now();
}

function calcComboboxMarkOpened(control) {
  calcComboboxLastOpenedControl = control || null;
  calcComboboxLastOpenedAt = Date.now();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('pointerdown', calcComboboxTrackPointerTarget, true);
  document.addEventListener('mousedown', calcComboboxTrackPointerTarget, true);
  document.addEventListener('touchstart', calcComboboxTrackPointerTarget, true);
}

function closeSiblingComboboxOptions(optsEl, control) {
  if (typeof document?.querySelectorAll !== 'function') return;
  document.querySelectorAll('.combobox-options.open').forEach(el => {
    if (el !== optsEl) el.classList.remove('open');
  });
  document.querySelectorAll('.cb-input[aria-expanded="true"]').forEach(el => {
    if (el !== control) el.setAttribute('aria-expanded', 'false');
  });
}

function calcComboboxShouldUsePortal(input, cbParent) {
  const type = input?.dataset?.cbType || '';
  return Boolean(cbParent?.closest?.('.tool-move-list-frame') && (type === 'move' || type === 'moveType'));
}

function calcComboboxPortalKey(input) {
  return [
    input?.dataset?.side || '',
    input?.dataset?.field || '',
    input?.dataset?.cbType || '',
  ].join(':');
}

function calcCleanupComboboxPortals(sideKey = null) {
  if (typeof document?.querySelectorAll !== 'function') return;
  document.querySelectorAll('.combobox-options.combobox-options-portal').forEach(el => {
    if (!sideKey || el.dataset.calcPortalSide === sideKey) el.remove();
  });
}

function calcComboboxPortalWidth(input, type) {
  const rect = input.getBoundingClientRect();
  const viewportWidth = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 0);
  const maxWidth = Math.max(120, viewportWidth - 16);
  if (type === 'move') {
    return Math.min(Math.max(rect.width, 300), 330, maxWidth);
  }
  if (type === 'moveType') {
    return Math.min(Math.max(rect.width, 92), 140, maxWidth);
  }
  return Math.min(rect.width, maxWidth);
}

function calcPositionComboboxPortal(input, optsEl, type = '') {
  if (
    typeof window === 'undefined'
    || typeof input?.getBoundingClientRect !== 'function'
    || !optsEl
  ) return;
  const rect = input.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 0);
  const viewportHeight = Math.max(240, window.innerHeight || document.documentElement.clientHeight || 0);
  const width = calcComboboxPortalWidth(input, type);
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
  const top = Math.max(margin, rect.bottom + 4);
  const maxHeight = Math.max(96, Math.min(280, viewportHeight - top - margin));
  optsEl.style.left = `${left}px`;
  optsEl.style.top = `${top}px`;
  optsEl.style.right = 'auto';
  optsEl.style.width = `${width}px`;
  optsEl.style.minWidth = `${Math.min(width, type === 'move' ? 300 : 92)}px`;
  optsEl.style.maxWidth = `${viewportWidth - margin * 2}px`;
  optsEl.style.maxHeight = `${maxHeight}px`;
}

function calcPositionOpenComboboxPortals() {
  if (typeof document?.querySelectorAll !== 'function') return;
  document.querySelectorAll('.combobox-options.combobox-options-portal.open').forEach(optsEl => {
    const controlId = optsEl.dataset.calcPortalControl || '';
    const input = controlId ? document.getElementById(controlId) : null;
    if (!input) {
      optsEl.classList.remove('open');
      return;
    }
    calcPositionComboboxPortal(input, optsEl, optsEl.dataset.calcPortalType || input.dataset.cbType || '');
  });
}

function calcEnsureComboboxPortalListeners() {
  if (calcComboboxPortalListenersBound || typeof window === 'undefined') return;
  calcComboboxPortalListenersBound = true;
  window.addEventListener('scroll', calcPositionOpenComboboxPortals, true);
  window.addEventListener('resize', calcPositionOpenComboboxPortals);
}

function calcMountComboboxPortal(input, cbParent, optsEl) {
  if (!calcComboboxShouldUsePortal(input, cbParent)) return false;
  if (typeof document?.body?.appendChild !== 'function') return false;
  const key = calcComboboxPortalKey(input);
  document.querySelectorAll('.combobox-options.combobox-options-portal').forEach(el => {
    if (el !== optsEl && el.dataset.calcPortalKey === key) el.remove();
  });
  if (!input.id) input.id = `calc-cb-control-${++calcComboboxUid}`;
  optsEl.dataset.calcPortalKey = key;
  optsEl.dataset.calcPortalSide = input.dataset.side || '';
  optsEl.dataset.calcPortalType = input.dataset.cbType || '';
  optsEl.dataset.calcPortalControl = input.id;
  optsEl.classList.add(
    'combobox-options-portal',
    input.dataset.cbType === 'move' ? 'tool-move-options-portal' : 'tool-move-type-options-portal',
  );
  if (input.dataset.side === 'atk') optsEl.style.setProperty('--tool-combo-selected', 'var(--atk)');
  if (input.dataset.side === 'def') optsEl.style.setProperty('--tool-combo-selected', 'var(--def)');
  document.body.appendChild(optsEl);
  calcEnsureComboboxPortalListeners();
  return true;
}

function calcComboboxFocusMovedToAnother(control, optsEl) {
  const currentCombobox = control?.closest?.('.combobox') || null;
  if (
    calcComboboxLastOpenedControl
    && calcComboboxLastOpenedControl !== control
    && Date.now() - calcComboboxLastOpenedAt < 700
  ) {
    return true;
  }
  if (
    calcComboboxLastPointerTarget
    && calcComboboxLastPointerTarget !== currentCombobox
    && Date.now() - calcComboboxLastPointerAt < 700
  ) {
    return true;
  }

  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return false;
  if (active === control || control?.contains?.(active) || optsEl?.contains?.(active)) return false;
  const activeCombobox = active.closest?.('.combobox');
  return !!activeCombobox && activeCombobox !== currentCombobox;
}

function calcComboboxOptionMatchesExactText(option, query) {
  const needle = calcSearchText(query).trim();
  if (!needle || !option) return false;
  const label = option.querySelector('b')?.textContent || '';
  const id = option.dataset?.id || '';
  return [label, id].some(value => calcSearchText(value).trim() === needle);
}

function wireSharedComboboxKeyboard(control, optsEl, { showOptions, onSelect, getQuery = null, onClose = null, onInvalidInput = null } = {}) {
  if (!control || !optsEl || typeof showOptions !== 'function') return null;
  const isButton = control.tagName === 'BUTTON';
  let activeIndex = -1;
  let activeByKeyboard = false;
  let justSelected = false;
  if (!optsEl.id) optsEl.id = `shared-cb-list-${++calcSharedComboboxUid}`;
  control.setAttribute('role', 'combobox');
  control.setAttribute('aria-haspopup', 'listbox');
  control.setAttribute('aria-autocomplete', isButton ? 'none' : 'list');
  control.setAttribute('aria-controls', optsEl.id);

  const queryValue = () => (getQuery ? getQuery() : (isButton ? '' : control.value || ''));
  const optionEls = () => [...optsEl.querySelectorAll('.combobox-option:not(.empty)')];
  const close = () => {
    optsEl.classList.remove('open');
    control.setAttribute('aria-expanded', 'false');
    control.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    activeByKeyboard = false;
    if (typeof onClose === 'function') onClose();
  };
  const setActive = (nextIndex, byKeyboard = false) => {
    const options = optionEls();
    activeIndex = options.length ? Math.max(-1, Math.min(nextIndex, options.length - 1)) : -1;
    activeByKeyboard = byKeyboard;
    control.removeAttribute('aria-activedescendant');
    options.forEach((option, index) => {
      const active = index === activeIndex;
      option.classList.toggle('active', active);
      if (active) {
        control.setAttribute('aria-activedescendant', option.id);
        if (typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' });
      }
    });
  };
  const open = (query = queryValue(), { activateFirst = false } = {}) => {
    justSelected = false;
    showOptions(query);
    optsEl.classList.add('open');
    control.setAttribute('aria-expanded', 'true');
    calcComboboxMarkOpened(control);
    const options = optionEls();
    options.forEach((option, index) => {
      if (!option.id) option.id = `${optsEl.id}-opt-${index}`;
    });
    const selectedIndex = options.findIndex(option => option.classList.contains('selected'));
    setActive(activateFirst ? 0 : selectedIndex);
  };
  const select = option => {
    if (!option || option.classList.contains('empty')) return;
    justSelected = true;
    close();
    if (typeof onSelect === 'function') onSelect(option);
  };
  const exactOption = () => {
    const query = queryValue();
    if (!String(query || '').trim()) return null;
    if (!optsEl.classList.contains('open')) open(query);
    return optionEls().find(option => calcComboboxOptionMatchesExactText(option, query)) || null;
  };
  const commitInvalid = () => {
    close();
    if (typeof onInvalidInput === 'function') onInvalidInput();
    return false;
  };
  const commitTyped = () => {
    if (isButton) return false;
    if (justSelected) {
      justSelected = false;
      return true;
    }
    const query = queryValue();
    if (!String(query || '').trim()) return false;
    const exact = exactOption();
    if (exact) {
      select(exact);
      return true;
    }
    return commitInvalid();
  };
  const commitActive = () => {
    if (isButton) return false;
    if (!optsEl.classList.contains('open')) open(queryValue(), { activateFirst: true });
    const option = optionEls()[activeIndex] || null;
    if (!option) return commitInvalid();
    select(option);
    return true;
  };

  control.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    const isOpen = optsEl.classList.contains('open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) open(queryValue());
      const options = optionEls();
      if (!options.length) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const start = activeIndex < 0 ? (delta > 0 ? -1 : 0) : activeIndex;
      setActive((start + delta + options.length) % options.length, true);
    } else if (e.key === 'Enter' && !isButton) {
      e.preventDefault();
      commitActive();
    } else if (e.key === 'Enter' && isOpen && activeIndex >= 0) {
      e.preventDefault();
      select(optionEls()[activeIndex]);
    } else if ((e.key === 'Enter' || e.key === ' ') && isButton && !isOpen) {
      e.preventDefault();
      open('');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  optsEl.addEventListener('mousemove', e => {
    const option = e.target.closest('.combobox-option:not(.empty)');
    if (!option || !optsEl.contains(option)) return;
    const index = optionEls().indexOf(option);
    if (index >= 0 && index !== activeIndex) setActive(index, false);
  });
  document.addEventListener('mousedown', e => {
    if (control.contains(e.target) || optsEl.contains(e.target)) return;
    close();
  });
  return { open, close, select, commitTyped, commitExact: commitTyped, commitActive };
}

function calcPokemonComboboxMatches(option, query) {
  const needle = calcSearchText(query).trim();
  const pokemon = option?.raw || option || {};
  const types = pokemon.types || option?.types || [];
  return calcMatches(
    needle,
    option?.id,
    option?.label,
    option?.sub,
    pokemon.id,
    pokemon.name,
    pokemon.koName,
    pkName(pokemon),
    ...types,
    ...types.map(type => TYPE_KO[type] || type)
  );
}

function wirePokemonSelectCombobox(input, {
  getOptions = () => sortPokemonForCalcSelect(POKEMON),
  getCurrentId = () => '',
  getDisplayLabel = null,
  onSelect = null,
  searchLimit = null,
  closeDelay = 200,
  selectTextOnFocus = false,
  wiredKey = 'pokemonWired',
  renderOption = null,
  renderHeader = null,
} = {}) {
  if (!input) return null;
  if (wiredKey && input.dataset[wiredKey] === '1') return null;
  const cb = input.closest('.combobox');
  const optsEl = cb?.querySelector('.combobox-options');
  if (!optsEl) return null;
  if (wiredKey) input.dataset[wiredKey] = '1';

  const isButtonTrigger = input.tagName === 'BUTTON';
  const currentId = () => getCurrentId(input) || '';
  const displayLabel = () => {
    if (typeof getDisplayLabel === 'function') return getDisplayLabel(input) || '';
    const id = currentId();
    return PokemonById[id] ? pkName(PokemonById[id]) : '';
  };
  const setDisplayLabel = label => {
    if (isButtonTrigger) {
      input.textContent = label;
      input.value = label;
    } else {
      input.value = label;
    }
  };
  const restoreInput = () => setDisplayLabel(displayLabel());

  const showOptions = query => {
    calcHideOptionTooltip();
    const options = (typeof getOptions === 'function' ? getOptions(input) : getOptions) || [];
    const matches = options.filter(option => calcPokemonComboboxMatches(option, query));
    const visibleMatches = calcSearchText(query).trim() && searchLimit
      ? matches.slice(0, searchLimit)
      : matches;
    const optionTemplate = typeof renderOption === 'function' ? renderOption : calcRenderPokemonOption;
    const headerHtml = typeof renderHeader === 'function'
      ? renderHeader(input)
      : renderHeader !== null
        ? renderHeader
        : calcComboboxHeaderHtml('pokemon');
    optsEl.innerHTML = visibleMatches.length
      ? headerHtml + visibleMatches.map(option => (
          optionTemplate(option, currentId())
        )).join('')
      : '<div class="combobox-option empty" aria-disabled="true"><b>검색 결과 없음</b></div>';
    closeSiblingComboboxOptions(optsEl, input);

    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (typeof window === 'undefined' || typeof optsEl.getBoundingClientRect !== 'function') return;
      const rect = optsEl.getBoundingClientRect();
      const overflowRight = rect.right > window.innerWidth - 8;
      optsEl.style.left = overflowRight ? 'auto' : '';
      optsEl.style.right = overflowRight ? '0' : '';
    });
  };

  const combo = wireSharedComboboxKeyboard(input, optsEl, {
    showOptions,
    onSelect: opt => {
      const id = opt.dataset.id || '';
      setDisplayLabel(opt.querySelector('b')?.textContent || displayLabel());
      calcHideOptionTooltip();
      if (typeof onSelect === 'function') onSelect(id, opt);
    },
    getQuery: () => isButtonTrigger ? '' : input.value || '',
    onInvalidInput: restoreInput,
  });

  input.addEventListener('focus', () => {
    if (isButtonTrigger) return;
    combo?.open('');
    if (!selectTextOnFocus) return;
    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (typeof input.select === 'function') input.select();
    });
  });
  input.addEventListener('mousedown', e => {
    if (input.readOnly || isButtonTrigger) e.stopPropagation();
  });
  input.addEventListener('click', e => {
    if (!input.readOnly && !isButtonTrigger) {
      combo?.open('');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (document.activeElement !== input && typeof input.focus === 'function') {
      input.focus({ preventScroll: true });
    }
    combo?.open('');
  });
  input.addEventListener('input', e => combo?.open(e.target.value, { activateFirst: true }));
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (isButtonTrigger) return;
      if (calcComboboxFocusMovedToAnother(input, optsEl)) {
        calcHideOptionTooltip();
        combo?.close();
        restoreInput();
        return;
      }
      if (!String(input.value || '').trim()) {
        calcHideOptionTooltip();
        combo?.close();
        restoreInput();
        return;
      }
      calcHideOptionTooltip();
      combo?.commitTyped();
    }, closeDelay);
  });

  const handleOptionSelect = e => {
    const opt = e.target.closest('.combobox-option');
    if (!opt || opt.classList.contains('empty')) return;
    e.preventDefault();
    if (isButtonTrigger && e.type === 'mousedown') return;
    combo?.select(opt);
  };

  optsEl.addEventListener('mousedown', handleOptionSelect);
  optsEl.addEventListener('click', handleOptionSelect);
  optsEl.addEventListener('touchstart', handleOptionSelect, { passive: false });
  optsEl.addEventListener('scroll', calcHideOptionTooltip);

  return combo;
}

function calcComboboxOptionLabel(type, option) {
  if (option?.label) return option.label;
  if (type === 'pokemon') return pkName(option);
  if (type === 'move') return mvName(option);
  if (type === 'ability') return abName(option);
  if (type === 'type1' || type === 'type2' || type === 'moveType') return option?.label || TYPE_KO[option?.id] || option?.id || '';
  if (type === 'form') return option?.label || calcPokemonFormLabel(option?.raw || option);
  if (type === 'nature') return calcNatureLabel(option);
  if (type === 'status') return option?.label || '';
  if (CALC_FIELD_OPTION_SETS[type]) return option?.label || '';
  return itName(option);
}

function calcComboboxOptionSub(type, option) {
  if (type === 'form') return '';
  if (type === 'type1' || type === 'type2' || type === 'moveType') return '';
  if (option?.sub) return option.sub;
  if (option?.label && !option.type && !option.ab && !option.up) return '';
  if (type === 'move') return `${TYPE_KO[option.type] || option.type} ${calcMoveCategoryLabel(option.cat)} ${option.bp || '??'}`;
  if (type === 'pokemon') return calcPokemonOptionMetaLabel(option);
  if (type === 'ability') return `${(option.desc || option.descLong || '').slice(0, 48)}`;
  if (type === 'item') return `${(option.desc || option.descLong || '').slice(0, 60)}`;
  if (type === 'nature') return option.up ? `${STAT_LABEL[option.up]} 상승 / ${STAT_LABEL[option.down]} 하락` : '능력 보정 없음';
  if (type === 'status') return option.sub || '';
  if (CALC_FIELD_OPTION_SETS[type]) return option.sub || '';
  return '';
}

function calcComboboxAttr(str) {
  return escapeHTML(str).replace(/"/g, '&quot;');
}

function calcPokemonOptionHeaderHtml() {
  return `
    <div class="pokemon-option-header" aria-hidden="true">
      <span>이름</span>
      <span>타입</span>
      <span>체력</span>
      <span>공격</span>
      <span>방어</span>
      <span>특공</span>
      <span>특방</span>
      <span>속도</span>
    </div>
  `;
}

function calcMoveOptionHeaderHtml() {
  return `
    <div class="move-option-header" aria-hidden="true">
      <span>기술명</span>
      <span>분류</span>
      <span>타입</span>
      <span>위력</span>
    </div>
  `;
}

function calcNatureOptionHeaderHtml() {
  return `
    <div class="nature-option-header" aria-hidden="true">
      <span>성격</span>
      <span>상승</span>
      <span>하락</span>
    </div>
  `;
}

function calcComboboxHeaderHtml(type) {
  if (type === 'pokemon') return calcPokemonOptionHeaderHtml();
  if (type === 'move') return calcMoveOptionHeaderHtml();
  if (type === 'nature') return calcNatureOptionHeaderHtml();
  return '';
}

function calcRenderPokemonOption(option, currentId) {
  const pokemon = option?.raw || option || {};
  const id = option?.id || pokemon.id || '';
  const label = option?.label || pkName(pokemon);
  const typeBadges = (pokemon.types || option?.types || []).map(type => (
    `<span class="badge-mini pokemon-option-type-badge t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`
  )).join('');
  const bs = pokemon.bs || option?.bs || {};
  const selected = String(id) === String(currentId);
  return `
    <div class="combobox-option pokemon-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="pokemon-option-name">${escapeHTML(label)}</b>
      <span class="pokemon-option-types">${typeBadges}</span>
      <span class="pokemon-option-stat">${bs.hp || 0}</span>
      <span class="pokemon-option-stat">${bs.atk || 0}</span>
      <span class="pokemon-option-stat">${bs.def || 0}</span>
      <span class="pokemon-option-stat">${bs.spa || 0}</span>
      <span class="pokemon-option-stat">${bs.spd || 0}</span>
      <span class="pokemon-option-stat">${bs.spe || 0}</span>
    </div>
  `;
}

function calcRenderSimplePokemonOption(option, currentId) {
  const pokemon = option?.raw || option || {};
  const id = option?.id || pokemon.id || '';
  const label = option?.label || pkName(pokemon);
  const types = pokemon.types || option?.types || [];
  const typeBadges = types.map(type => (
    `<span class="type-pill pokemon-simple-type-pill t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`
  )).join('');
  const selected = String(id) === String(currentId);
  const optionClass = ['combobox-option', 'ui-option', 'pokemon-simple-option', 'matchup-option', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <div class="${optionClass}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="pokemon-simple-option-name matchup-option-name">${escapeHTML(label)}</b>
      <small class="pokemon-simple-option-types matchup-option-types">${typeBadges}</small>
    </div>
  `;
}

function calcRenderMoveOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || option?.koName || (id ? mvName(option) : '없음');
  const selected = String(id) === String(currentId);
  const category = option?.cat ? calcMoveCategoryLabel(option.cat) : '';
  const categoryClass = option?.cat === 'Physical' ? 'cat-phys' : option?.cat === 'Special' ? 'cat-spec' : 'cat-stat';
  const typeBadge = option?.type
    ? `<span class="badge-mini move-option-type-badge t-${escapeHTML(option.type)}">${escapeHTML(TYPE_KO[option.type] || option.type)}</span>`
    : '';
  const power = option?.cat === 'Status' ? '' : (option?.bp || '');
  return `
    <div class="combobox-option move-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="move-option-name">${escapeHTML(label)}</b>
      <span class="move-option-category">${category ? `<span class="cat-badge ${categoryClass}">${escapeHTML(category)}</span>` : ''}</span>
      <span class="move-option-type">${typeBadge}</span>
      <span class="move-option-power">${escapeHTML(power)}</span>
    </div>
  `;
}

function calcRenderAbilityOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || abName(option);
  const sub = option?.sub || calcComboboxOptionSub('ability', option);
  const selected = String(id) === String(currentId);
  const tooltip = sub ? ` data-tooltip="${calcComboboxAttr(sub)}" aria-label="${calcComboboxAttr(`${label}: ${sub}`)}"` : '';
  return `<div class="combobox-option ability-option tooltip-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"${tooltip}><b>${escapeHTML(label)}</b></div>`;
}

function calcRenderItemOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || itName(option);
  const selected = String(id) === String(currentId);
  return `<div class="combobox-option item-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b></div>`;
}

function calcRenderNatureOption(option, currentId) {
  const id = option?.id || '';
  const nature = option?.raw || option || {};
  const label = option?.label || calcNatureLabel(nature);
  const up = nature.up ? (STAT_LABEL[nature.up] || nature.up) : '없음';
  const down = nature.down ? (STAT_LABEL[nature.down] || nature.down) : '없음';
  const selected = String(id) === String(currentId);
  return `
    <div class="combobox-option nature-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b>${escapeHTML(label)}</b>
      <span>${escapeHTML(up)}</span>
      <span>${escapeHTML(down)}</span>
    </div>
  `;
}

function calcRenderStatusOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || '';
  const sub = option?.sub || '';
  const selected = String(id) === String(currentId);
  const subHtml = sub ? `<small>${escapeHTML(sub)}</small>` : '<small></small>';
  return `<div class="combobox-option status-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${subHtml}</div>`;
}

function calcRenderGenericOption(type, option, currentId) {
  const id = option?.id || '';
  const label = calcComboboxOptionLabel(type, option);
  const sub = calcComboboxOptionSub(type, option);
  const selected = String(id) === String(currentId);
  const subHtml = sub ? `<small>${escapeHTML(sub)}</small>` : '';
  const typeClass = type ? `${type}-option` : '';
  return `<div class="${uiClassNames('combobox-option ui-option', typeClass, selected ? 'selected' : '')}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${subHtml}</div>`;
}

function calcRenderComboboxOption(type, option, currentId) {
  if (type === 'pokemon') return calcRenderPokemonOption(option, currentId);
  if (type === 'move') return calcRenderMoveOption(option, currentId);
  if (type === 'ability') return calcRenderAbilityOption(option, currentId);
  if (type === 'item') return calcRenderItemOption(option, currentId);
  if (type === 'nature') return calcRenderNatureOption(option, currentId);
  if (type === 'status') return calcRenderStatusOption(option, currentId);
  return calcRenderGenericOption(type, option, currentId);
}

function calcComboboxExtraOptions(type) {
  if (type === 'item') return [{ id: '', label: '없음' }];
  if (type === 'move') return [{ id: '', label: '\uC5C6\uC74C' }];
  if (type === 'ability') return [{ id: '', label: '없음', sub: '특성 효과를 적용하지 않음' }];
  return [];
}

function calcComboboxCurrentId(input) {
  const type = input.dataset.cbType;
  const sideKey = input.dataset.side;
  const field = input.dataset.field || '';
  if (CALC_FIELD_OPTION_SETS[type]) return input.dataset.value || '';
  const side = sideKey ? state[sideKey] : null;
  if (!side) return '';
  if (field === 'pokemonIdx') return side.pokemonIdx || '';
  if (field === 'ability') return side.ability || '';
  if (field === 'item') return side.item || '';
  if (field === 'types.0') return sideTypeId(side, 0);
  if (field === 'types.1') return sideTypeId(side, 1);
  if (field === 'formIdx') return side.pokemonIdx || '';
  if (field.startsWith('moveTypes.')) {
    const idx = parseInt(field.split('.')[1], 10);
    const move = MoveById[side.moves?.[idx]];
    return move ? manualTypeForSlot(side, idx, move) : '';
  }
  if (field === 'nature') return side.nature || 'hardy';
  if (field === 'status') return side.status || 'none';
  if (field.startsWith('moves.')) {
    const idx = parseInt(field.split('.')[1], 10);
    return side.moves?.[idx] || '';
  }
  return '';
}

function calcComboboxDisplayLabel(input) {
  const type = input.dataset.cbType;
  const id = calcComboboxCurrentId(input);
  const sideKey = input.dataset.side;
  if (CALC_FIELD_OPTION_SETS[type]) return calcFieldOptionLabel(type, input.dataset.value);
  if (type === 'pokemon') return PokemonById[id] ? pkName(PokemonById[id]) : '';
  if (type === 'move') return id && MoveById[id] ? mvName(MoveById[id]) : '';
  if (type === 'ability') return calcAbilityDisplayLabel(sideKey);
  if (type === 'moveType') return id ? (TYPE_KO[id] || id) : '';
  if (type === 'type1' || type === 'type2') return id ? (TYPE_KO[id] || id) : '없음';
  if (type === 'form') return PokemonById[id] ? calcPokemonFormLabel(PokemonById[id]) : '';
  if (type === 'item') return id && ItemById[id] ? itName(ItemById[id]) : '없음';
  if (type === 'nature') return calcNatureLabel(NATURE_BY_ID[id]);
  if (type === 'status') return calcStatusDisplayLabel(id);
  return id || '';
}

function calcOptionTooltipEl() {
  let el = document.getElementById('calc-combobox-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'calc-combobox-tooltip';
    el.className = 'calc-combobox-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function calcPositionOptionTooltip(option, el) {
  if (typeof window === 'undefined' || typeof option?.getBoundingClientRect !== 'function') return;
  const rect = option.getBoundingClientRect();
  const margin = 12;
  const box = el.getBoundingClientRect();
  const width = box.width || Math.min(280, window.innerWidth - margin * 2);
  const height = box.height || 44;
  const anchorX = rect.left + rect.width * 0.7;
  const anchorY = rect.top + rect.height / 2 - height / 2;
  const left = Math.max(margin, Math.min(anchorX, window.innerWidth - width - margin));
  const top = Math.max(margin, Math.min(anchorY, window.innerHeight - height - margin));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function calcShowOptionTooltip(option) {
  const text = option?.dataset?.tooltip || '';
  if (!text) return;
  const el = calcOptionTooltipEl();
  const anchorId = option.id || option.dataset.id || '';
  if (el.classList.contains('visible') && el.dataset.anchorId === anchorId && el.textContent === text) return;
  el.classList.remove('visible');
  el.textContent = text;
  el.dataset.anchorId = anchorId;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 320;
  el.style.width = `${Math.max(120, Math.min(280, viewportWidth - 24))}px`;
  calcPositionOptionTooltip(option, el);
  el.classList.add('visible');
}

function calcHideOptionTooltip() {
  const el = document.getElementById('calc-combobox-tooltip');
  if (el) {
    el.classList.remove('visible');
    delete el.dataset.anchorId;
  }
}

function wireCalcCombobox(input, { filterFn = null, onSelect = null } = {}) {
  const cbParent = input.closest('.combobox');
  const optsEl = cbParent?.querySelector('.combobox-options');
  if (!cbParent || !optsEl) return;

  const cbType = input.dataset.cbType;
  const side = input.dataset.side || null;
  const usesPortal = calcMountComboboxPortal(input, cbParent, optsEl);
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
  optsEl.addEventListener('touchstart', handleOptionSelect, { passive: false });
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
