/* Calculator move estimation and shared combobox behavior. */
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
const calcComboboxOutsideClosers = new Map();
let calcComboboxOutsideListenerBound = false;
const CALC_COMBOBOX_TOUCH_TAP_SLOP = 10;
const CALC_PAGE_PORTAL_COMBOBOX_TYPES = new Set([
  'pokemon',
  'move',
  'moveType',
  'ability',
  'item',
  'nature',
  'status',
  'type1',
  'type2',
  'form',
  'weather',
  'terrain',
  'gameType',
  'spikesLayers',
]);
const CALC_COMBOBOX_PORTAL_WIDTHS = {
  pokemon: { min: 420, max: 540, minWidth: 360 },
  move: { min: 300, max: 330, minWidth: 300, compactMin: 220, compactMax: 280, compactMinWidth: 220 },
  moveType: { min: 92, max: 140, minWidth: 92 },
  type1: { min: 116, max: 160, minWidth: 104 },
  type2: { min: 116, max: 160, minWidth: 104 },
  nature: { min: 188, max: 220, minWidth: 168 },
  status: { min: 180, max: 220, minWidth: 160 },
  ability: { min: 220, max: 300, minWidth: 200 },
  item: { min: 220, max: 300, minWidth: 200 },
  form: { min: 180, max: 280, minWidth: 160 },
  weather: { min: 128, max: 180, minWidth: 116 },
  terrain: { min: 128, max: 180, minWidth: 116 },
  gameType: { min: 128, max: 180, minWidth: 116 },
  spikesLayers: { min: 112, max: 150, minWidth: 104 },
};

function calcComboboxTouchPoint(event) {
  const touch = event?.changedTouches?.[0] || event?.touches?.[0] || null;
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function calcWireComboboxTouchOptions(optsEl, selectOption) {
  let touchStart = null;
  let lastTouchSelectAt = 0;

  const shouldIgnoreMouseEvent = event => (
    (event.type === 'mousedown' || event.type === 'click')
    && lastTouchSelectAt
    && Date.now() - lastTouchSelectAt < 700
  );

  const handleTouchStart = event => {
    const option = event.target?.closest?.('.combobox-option:not(.empty)');
    if (!option || !optsEl.contains(option)) {
      touchStart = null;
      return;
    }
    const point = calcComboboxTouchPoint(event);
    touchStart = point ? { option, x: point.x, y: point.y, moved: false } : null;
  };

  const handleTouchMove = event => {
    if (!touchStart) return;
    const point = calcComboboxTouchPoint(event);
    if (!point) {
      touchStart.moved = true;
      return;
    }
    if (
      Math.abs(point.x - touchStart.x) > CALC_COMBOBOX_TOUCH_TAP_SLOP
      || Math.abs(point.y - touchStart.y) > CALC_COMBOBOX_TOUCH_TAP_SLOP
    ) {
      touchStart.moved = true;
    }
  };

  const handleTouchEnd = event => {
    if (!touchStart) return;
    const start = touchStart;
    touchStart = null;
    const point = calcComboboxTouchPoint(event);
    const moved = start.moved || (
      point && (
        Math.abs(point.x - start.x) > CALC_COMBOBOX_TOUCH_TAP_SLOP
        || Math.abs(point.y - start.y) > CALC_COMBOBOX_TOUCH_TAP_SLOP
      )
    );
    if (moved || !optsEl.contains(start.option)) return;
    event.preventDefault();
    event.stopPropagation();
    lastTouchSelectAt = Date.now();
    selectOption(start.option, event);
  };

  optsEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  optsEl.addEventListener('touchmove', handleTouchMove, { passive: true });
  optsEl.addEventListener('touchend', handleTouchEnd, { passive: false });
  optsEl.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  return { shouldIgnoreMouseEvent };
}

function calcComboboxTrackPointerTarget(event) {
  calcComboboxLastPointerTarget = event.target?.closest?.('.combobox') || null;
  calcComboboxLastPointerAt = Date.now();
}

function calcComboboxMarkOpened(control) {
  calcComboboxLastOpenedControl = control || null;
  calcComboboxLastOpenedAt = Date.now();
}

function calcHandleComboboxOutsidePointer(event) {
  for (const [optsEl, entry] of calcComboboxOutsideClosers) {
    const { control, close } = entry;
    if (control?.isConnected === false || optsEl?.isConnected === false) {
      calcComboboxOutsideClosers.delete(optsEl);
      continue;
    }
    if (control?.contains?.(event.target) || optsEl?.contains?.(event.target)) continue;
    close();
  }
}

function calcPruneComboboxOutsideClosers() {
  for (const [optsEl, entry] of calcComboboxOutsideClosers) {
    if (entry.control?.isConnected === false || optsEl?.isConnected === false) {
      calcComboboxOutsideClosers.delete(optsEl);
    }
  }
}

function calcRegisterComboboxOutsideClose(control, optsEl, close) {
  if (!control || !optsEl || typeof close !== 'function') return;
  calcPruneComboboxOutsideClosers();
  calcComboboxOutsideClosers.set(optsEl, { control, close });
  if (calcComboboxOutsideListenerBound || typeof document?.addEventListener !== 'function') return;
  calcComboboxOutsideListenerBound = true;
  document.addEventListener('mousedown', calcHandleComboboxOutsidePointer);
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
  if (input?.dataset?.cbPortal === 'true') return true;
  if (input?.closest?.('#page-calc') && CALC_PAGE_PORTAL_COMBOBOX_TYPES.has(type)) return true;
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
    if (!sideKey || el.dataset.calcPortalSide === sideKey) {
      calcComboboxOutsideClosers.delete(el);
      el.remove();
    }
  });
  calcPruneComboboxOutsideClosers();
}

function calcComboboxPortalWidth(input, type) {
  const rect = input.getBoundingClientRect();
  const viewportWidth = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 0);
  const maxWidth = Math.max(120, viewportWidth - 16);
  const compact = input?.dataset?.cbPortalSize === 'compact';
  const sizing = CALC_COMBOBOX_PORTAL_WIDTHS[type];
  if (sizing) {
    const min = compact && sizing.compactMin ? sizing.compactMin : sizing.min;
    const max = compact && sizing.compactMax ? sizing.compactMax : sizing.max;
    return Math.min(Math.max(rect.width, min), max, maxWidth);
  }
  return Math.min(rect.width, maxWidth);
}

function calcComboboxPortalMinWidth(type, width, input) {
  const compact = input?.dataset?.cbPortalSize === 'compact';
  const sizing = CALC_COMBOBOX_PORTAL_WIDTHS[type];
  const fallback = Math.min(width, 120);
  if (!sizing) return fallback;
  const minWidth = compact && sizing.compactMinWidth ? sizing.compactMinWidth : sizing.minWidth;
  return Math.min(width, minWidth || fallback);
}

function calcPositionComboboxPortal(input, optsEl, type = '') {
  if (
    typeof window === 'undefined'
    || typeof input?.getBoundingClientRect !== 'function'
    || !optsEl
  ) return;
  const rect = input.getBoundingClientRect();
  const margin = 8;
  const gap = 4;
  const viewportWidth = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 0);
  const viewportHeight = Math.max(240, window.innerHeight || document.documentElement.clientHeight || 0);
  const width = calcComboboxPortalWidth(input, type);
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
  const preferredMaxHeight = input?.dataset?.cbPortalSize === 'compact' ? 220 : 280;
  const minUsefulHeight = 72;
  const spaceBelow = viewportHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openAbove = spaceBelow < minUsefulHeight && spaceAbove > spaceBelow;
  const availableHeight = Math.max(minUsefulHeight, openAbove ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(preferredMaxHeight, availableHeight);
  const rawTop = openAbove ? rect.top - gap - maxHeight : rect.bottom + gap;
  const top = Math.max(margin, Math.min(rawTop, viewportHeight - maxHeight - margin));
  optsEl.style.left = `${left}px`;
  optsEl.style.top = `${top}px`;
  optsEl.style.right = 'auto';
  optsEl.style.width = `${width}px`;
  optsEl.style.minWidth = `${calcComboboxPortalMinWidth(type, width, input)}px`;
  optsEl.style.maxWidth = `${viewportWidth - margin * 2}px`;
  optsEl.style.maxHeight = `${maxHeight}px`;
  optsEl.dataset.calcPortalPlacement = openAbove ? 'top' : 'bottom';
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
  optsEl.classList.add('combobox-options-portal');
  const portalClass = input.dataset.cbPortalClass || (
    input.dataset.cbType === 'move'
      ? 'tool-move-options-portal'
      : input.dataset.cbType === 'moveType'
        ? 'tool-move-type-options-portal'
        : CALC_PAGE_PORTAL_COMBOBOX_TYPES.has(input.dataset.cbType || '')
          ? 'calc-page-options-portal'
          : ''
  );
  if (portalClass) optsEl.classList.add(portalClass);
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
    if (optsEl.classList.contains('combobox-options-portal')) {
      calcPositionComboboxPortal(control, optsEl, optsEl.dataset.calcPortalType || control.dataset.cbType || '');
    }
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
  calcRegisterComboboxOutsideClose(control, optsEl, close);
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
  const usesPortal = calcMountComboboxPortal(input, cb, optsEl);

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
    renderTrustedHTML(optsEl, visibleMatches.length
      ? headerHtml + visibleMatches.map(option => (
          optionTemplate(option, currentId())
        )).join('')
      : '<div class="combobox-option empty" aria-disabled="true"><b>검색 결과 없음</b></div>');
    closeSiblingComboboxOptions(optsEl, input);

    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
    schedule(() => {
      if (typeof window === 'undefined' || typeof optsEl.getBoundingClientRect !== 'function') return;
      if (usesPortal) {
        calcPositionComboboxPortal(input, optsEl, optsEl.dataset.calcPortalType || input.dataset.cbType || '');
        return;
      }
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
  const touchOptions = calcWireComboboxTouchOptions(optsEl, option => combo?.select(option));

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

  const handleOptionMouseDown = e => {
    if (touchOptions.shouldIgnoreMouseEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const opt = e.target.closest('.combobox-option');
    if (!opt || opt.classList.contains('empty')) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleOptionSelect = e => {
    if (touchOptions.shouldIgnoreMouseEvent(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const opt = e.target.closest('.combobox-option');
    if (!opt || opt.classList.contains('empty')) return;
    e.preventDefault();
    e.stopPropagation();
    combo?.select(opt);
  };

  optsEl.addEventListener('mousedown', handleOptionMouseDown);
  optsEl.addEventListener('click', handleOptionSelect);
  optsEl.addEventListener('scroll', calcHideOptionTooltip);

  return combo;
}
