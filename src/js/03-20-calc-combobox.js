/* Damage calculator move estimation and combobox helpers. */
const ENTRY_EFFECTS = RULES.entryEffects || {};
const INTIMIDATE_BLOCKERS = RULES.entryEffectBlockers?.intimidate || [];

// 틀깨기에 무시되는 방어측 특성
// 기술 위력 / 결정력 추정
// 결정력 = 공격(특공) 실수치 × 기술 위력 × STAB × 도구 × 특성 보정
//   ※ 타입 상성, 방어측 보정은 제외
//   예: 파이어로 고집 A32 + 구애머리띠 → 브레이브버드 = 146 × 120 × 1.5 × 1.5 = 39420
function estimateMovePower(side, move) {
  if (!move || move.cat === 'Status') return { bp: '—', eff: '—' };
  const types = effectiveTypes(side);
  const ab = side.ability;
  const abilityData = AbilityById[ab];
  const item = side.item;
  const stats = calcStats(side);
  // 가변 위력 기술 위력은 자기 자신을 상대로 가정한 추정치로 보여준다 (estimate 용도)
  const defStats = calcStats(state.def);
  const estimateField = { ...state.field };
  const estimateAtkSpe = effectiveSpeed(side, estimateField);
  const estimateDefSpe = effectiveSpeed(state.def, estimateField);
  estimateField.atkMovesFirst = estimateAtkSpe > estimateDefSpe;
  estimateField.atkMovesSecond = estimateAtkSpe < estimateDefSpe;
  const variableBp = computeVariableBp(move, side, state.def, estimateField, stats, defStats);

  let moveType = move.type;
  let bp = variableBp || move.bp;
  if (!bp) return { bp: '—', eff: '—' };

  // 타입 변환 특성 + BP 보정
  let typeMult = 1.0;
  const typeChange = abilityData?.typeChange;
  if (typeChange && (!typeChange.from || moveType === typeChange.from) && (!typeChange.flag || move.flags?.[typeChange.flag])) {
    moveType = typeChange.type;
    if (typeChange.mod) typeMult = mechanicMod(typeChange.mod) / 4096;
  }

  // Tera Blast Stellar: 100 BP 고정
  if (move.typeChangeKind === 'teraBlast' && side.tera && side.teraType === 'Stellar') bp = 100;

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
    defSide: state.def,
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

function makeCombobox(sideKey, type) {
  const dataset = calcDatasetForCombobox(sideKey, type);
  // 필터링 함수
  return (searchText) => {
    const s = calcSearchText(searchText).trim();
    const matches = dataset.filter(d => {
      if (type === 'pokemon') {
        const abilityTerms = calcPokemonAbilityTerms(d);
        const typeTerms = (d.types || []).map(t => TYPE_KO[t] || t);
        return calcMatches(s, d.id, d.name, d.koName, d.base, d.forme, (d.types || []).join(' '), ...typeTerms, ...abilityTerms);
      }
      if (type === 'move') {
        return calcMatches(s, d.id, d.name, d.koName, d.type, TYPE_KO[d.type], d.cat, calcMoveCategoryLabel(d.cat), d.desc, d.descLong);
      }
      if (type === 'type1' || type === 'type2') {
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
      if (CALC_FIELD_OPTION_SETS[type]) {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      // 챔피언스 빌드는 build 단계에서 이미 Past 아이템을 걸러내므로 런타임 필터 불필요.
      return calcMatches(s, d.id, d.name, d.koName, d.desc, d.descLong, calcItemCategoryLabel(d), ...(d.itemUser || []));
    });
    return type === 'pokemon' ? matches : matches.slice(0, 30);
  };
}

let calcComboboxUid = 0;

function calcComboboxOptionLabel(type, option) {
  if (option?.label) return option.label;
  if (type === 'pokemon') return pkName(option);
  if (type === 'move') return mvName(option);
  if (type === 'ability') return abName(option);
  if (type === 'type1' || type === 'type2') return option?.label || TYPE_KO[option?.id] || option?.id || '';
  if (type === 'nature') return calcNatureLabel(option);
  if (type === 'status') return option?.label || '';
  if (CALC_FIELD_OPTION_SETS[type]) return option?.label || '';
  return itName(option);
}

function calcComboboxOptionSub(type, option) {
  if (option?.sub) return option.sub;
  if (option?.label && !option.type && !option.ab && !option.up) return '';
  if (type === 'move') return `${TYPE_KO[option.type] || option.type} ${calcMoveCategoryLabel(option.cat)} ${option.bp || '??'}`;
  if (type === 'pokemon') {
    const abilities = Object.values(option.ab || {}).map(name => {
      const data = AbilityById[toId(name)];
      return data ? abName(data) : name;
    }).join(', ');
    return `${(option.types || []).map(t => TYPE_KO[t] || t).join('/')} / BST ${option.bst} / ${abilities}`;
  }
  if (type === 'type1' || type === 'type2') return option.sub || '';
  if (type === 'ability') return `${(option.desc || option.descLong || '').slice(0, 48)}`;
  if (type === 'nature') return option.up ? `${STAT_LABEL[option.up]} 상승 / ${STAT_LABEL[option.down]} 하락` : '능력 보정 없음';
  if (type === 'status') return option.sub || '';
  if (CALC_FIELD_OPTION_SETS[type]) return option.sub || '';
  return '';
}

function calcComboboxExtraOptions(type) {
  if (type === 'item') return [{ id: '', label: '없음' }];
  if (type === 'move') return [{ id: '', label: '(없음)' }];
  if (type === 'ability') return [{ id: '', label: '(없음)', sub: '특성 효과를 적용하지 않음' }];
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
  if (field === 'nature') return side.nature || 'hardy';
  if (field === 'status') return side.status || 'none';
  if (field.startsWith('moves.')) {
    const idx = parseInt(field.split('.')[1], 10);
    return state.atk.moves[idx] || '';
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
  if (type === 'type1' || type === 'type2') return id ? (TYPE_KO[id] || id) : '없음';
  if (type === 'item') return id && ItemById[id] ? itName(ItemById[id]) : '없음';
  if (type === 'nature') return calcNatureLabel(NATURE_BY_ID[id]);
  if (type === 'status') return calcStatusDisplayLabel(id);
  return id || '';
}

function wireCalcCombobox(input, { filterFn = null, onSelect = null } = {}) {
  const cbParent = input.closest('.combobox');
  const optsEl = cbParent?.querySelector('.combobox-options');
  if (!cbParent || !optsEl) return;

  const cbType = input.dataset.cbType;
  const side = input.dataset.side || null;
  const filter = filterFn || makeCombobox(side, cbType);
  let activeIndex = -1;

  if (!optsEl.id) optsEl.id = `calc-cb-list-${++calcComboboxUid}`;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', optsEl.id);

  function getOptionEls() {
    return [...optsEl.querySelectorAll('.combobox-option:not(.empty)')];
  }

  function closeOptions() {
    optsEl.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function restoreDisplayLabel() {
    input.value = calcComboboxDisplayLabel(input);
  }

  function setActiveOption(nextIndex) {
    const options = getOptionEls();
    activeIndex = options.length ? Math.max(-1, Math.min(nextIndex, options.length - 1)) : -1;
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
    const id = option?.id || '';
    const label = calcComboboxOptionLabel(cbType, option);
    const sub = calcComboboxOptionSub(cbType, option);
    const selected = String(id) === String(currentId);
    const subHtml = sub ? `<small>${escapeHTML(sub)}</small>` : '';
    return `<div class="combobox-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${subHtml}</div>`;
  }

  function showOptions(query, { activateFirst = false } = {}) {
    const matches = filter(query);
    const hasQuery = !!calcSearchText(query).trim();
    const extraOptions = hasQuery ? [] : calcComboboxExtraOptions(cbType);
    const currentId = calcComboboxCurrentId(input);
    const optionData = [...extraOptions, ...matches];
    const html = optionData.map(option => optionTemplate(option, currentId));
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
    const selectedIndex = optionData.findIndex(option => String(option?.id || '') === String(currentId));
    setActiveOption(activateFirst ? 0 : selectedIndex);

    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (typeof window === 'undefined' || typeof optsEl.getBoundingClientRect !== 'function') return;
      const rect = optsEl.getBoundingClientRect();
      const overflowRight = rect.right > window.innerWidth - 8;
      optsEl.style.left = overflowRight ? 'auto' : '';
      optsEl.style.right = overflowRight ? '0' : '';
    });
  }

  function selectOption(opt) {
    if (!opt || opt.classList.contains('empty')) return;
    const id = opt.dataset.id || '';
    closeOptions();
    if (onSelect) onSelect(id, opt);
  }

  input.addEventListener('focus', () => {
    showOptions('');
    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (typeof input.select === 'function') input.select();
    });
  });
  input.addEventListener('input', () => showOptions(input.value, { activateFirst: true }));
  input.addEventListener('keydown', e => {
    const isOpen = optsEl.classList.contains('open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) showOptions(input.value);
      const options = getOptionEls();
      if (!options.length) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const start = activeIndex < 0 ? (delta > 0 ? -1 : 0) : activeIndex;
      setActiveOption((start + delta + options.length) % options.length);
    } else if (e.key === 'Enter' && isOpen && activeIndex >= 0) {
      e.preventDefault();
      selectOption(getOptionEls()[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeOptions();
      restoreDisplayLabel();
      if (typeof input.select === 'function') input.select();
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      closeOptions();
      restoreDisplayLabel();
    }, 200);
  });

  function handleOptionSelect(e) {
    const opt = e.target.closest('.combobox-option');
    if (!opt || opt.classList.contains('empty')) return;
    e.preventDefault();
    e.stopPropagation();
    selectOption(opt);
  }

  optsEl.addEventListener('mousedown', handleOptionSelect);
  optsEl.addEventListener('touchstart', handleOptionSelect, { passive: false });
  optsEl.addEventListener('mousemove', e => {
    const opt = e.target.closest('.combobox-option:not(.empty)');
    if (!opt) return;
    const index = getOptionEls().indexOf(opt);
    if (index >= 0 && index !== activeIndex) setActiveOption(index);
  });
}

