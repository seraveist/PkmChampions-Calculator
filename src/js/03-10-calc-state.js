/* Damage calculator state, options, and shared helpers. */
function makeSideState(defaultIdx = '') {
  const p = PokemonById[defaultIdx];
  return {
    pokemonIdx: p ? defaultIdx : '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    nature: 'hardy',  // 25성격 중 하나 (기본값: 노력 - 보정 없음)
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: "none",
    ability: p ? toId(p.ab['0'] || p.ab['H']) : "",
    item: "",
    types: p ? [...p.types] : [],
    tera: false,
    teraType: p ? p.types[0] : 'Normal',
    hpPct: 1,
    pinch: false,
    fullHP: true,
    lastMoveFailed: false,
    wasHit: false,
    fallenAllies: 0,
    flashFireActive: false,
    boosterEnergyState: 'auto',
    damageBlockActive: false,
    moves: [],
    moveBpOverrides: [null, null, null, null],
    moveTypeOverrides: [null, null, null, null],
    moveCriticalOverrides: [false, false, false, false]
  };
}

const state = {
  atk: makeSideState(),
  def: makeSideState(),
  field: {
    weather: "none", terrain: "none", gameType: "Singles",
    isCritical: false, isGravity: false,
    defReflect: false, defLightScreen: false,
    atkHelpingHand: false,
    // 재앙 시리즈 (수동 토글, 진입 효과로도 자동 활성화 가능)
    ruinSword: false,    // 검의재앙 (방어측 방어 0.75×)
    ruinTablet: false,   // 목간의재앙 (방어측 공격 0.75×) ← 공격측 입장에선 자기 공격 0.75×
    ruinBeads: false,    // 구슬의재앙 (방어측 특방 0.75×)
    ruinVessel: false,   // 그릇의재앙 (방어측 특공 0.75×)
    // 진입 위험 (방어측이 교체 진입 시 받는 데미지). HKO 시뮬레이션의 시작 HP 에 반영.
    defStealthRock: false,
    defSpikesLayers: 0,  // 0~3
  }
};

/* ════════════════════════════════════════════════════════════
   렌더링
   ════════════════════════════════════════════════════════════ */

// 한국어 이름 헬퍼
function pkName(p) { return p.koName || p.name; }
function mvName(m) { return m.koName || m.name; }
function abName(a) { return a ? (a.koName || a.name) : '없음'; }
function itName(i) { return i ? (i.koName || i.name) : '없음'; }

function calcPokemonAbilityLabels(pokemon) {
  const ab = pokemon?.ab || {};
  const orderedKeys = ['0', '1', 'H', 'S'];
  const keys = [
    ...orderedKeys.filter(key => ab[key]),
    ...Object.keys(ab).filter(key => !orderedKeys.includes(key)),
  ];
  return keys.map(key => {
    const ability = AbilityById[toId(ab[key])];
    return ability ? abName(ability) : ab[key];
  }).filter(Boolean);
}

function calcPokemonBst(pokemon) {
  if (pokemon?.bst) return pokemon.bst;
  return Object.values(pokemon?.bs || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function calcPokemonOptionMetaLabel(pokemon) {
  if (!pokemon) return '';
  const types = (pokemon.types || []).map(type => TYPE_KO[type] || type).join(' ');
  const abilities = calcPokemonAbilityLabels(pokemon).join(' | ');
  return [types, `총합 ${calcPokemonBst(pokemon)}`, abilities].filter(Boolean).join(' | ');
}

const CALC_MOVE_CATEGORY_LABEL = { Physical: '물리', Special: '특수', Status: '변화' };
const CALC_STATUS_OPTIONS = [
  { id: 'none', label: '건강', sub: '상태 이상 없음' },
  { id: 'Burn', label: '화상', sub: '물리 공격 약화' },
  { id: 'Paralysis', label: '마비', sub: '속도 약화' },
  { id: 'Poison', label: '독', sub: '독 상태' },
  { id: 'Toxic', label: '맹독', sub: '턴마다 독 누적' },
  { id: 'Sleep', label: '잠듦', sub: '수면 상태' },
  { id: 'Freeze', label: '얼음', sub: '얼음 상태' },
];
const CALC_STATUS_BY_ID = Object.fromEntries(CALC_STATUS_OPTIONS.map(s => [s.id, s]));
CALC_STATUS_BY_ID['Badly Poison'] = CALC_STATUS_BY_ID.Toxic;
const CALC_WEATHER_OPTIONS = [
  { id: 'none', label: '없음' },
  { id: 'Sun', label: '쾌청' },
  { id: 'Rain', label: '비' },
  { id: 'Sand', label: '모래바람' },
  { id: 'Snow', label: '눈' },
  { id: 'Harsh Sunshine', label: '대쾌청' },
  { id: 'Heavy Rain', label: '강한비' },
];
const CALC_TERRAIN_OPTIONS = [
  { id: 'none', label: '없음' },
  { id: 'Electric', label: '일렉트릭필드' },
  { id: 'Grassy', label: '그래스필드' },
  { id: 'Psychic', label: '사이코필드' },
  { id: 'Misty', label: '미스트필드' },
];
const CALC_GAME_TYPE_OPTIONS = [
  { id: 'Singles', label: '싱글' },
  { id: 'Doubles', label: '더블' },
];
const CALC_SPIKES_LAYER_OPTIONS = [
  { id: '1', label: '1중첩' },
  { id: '2', label: '2중첩' },
  { id: '3', label: '3중첩' },
];
const CALC_FIELD_OPTION_SETS = {
  weather: CALC_WEATHER_OPTIONS,
  terrain: CALC_TERRAIN_OPTIONS,
  gameType: CALC_GAME_TYPE_OPTIONS,
  spikesLayers: CALC_SPIKES_LAYER_OPTIONS,
};
const CALC_FIELD_OPTION_BY_TYPE = Object.fromEntries(
  Object.entries(CALC_FIELD_OPTION_SETS).map(([type, options]) => [type, Object.fromEntries(options.map(option => [option.id, option]))])
);
const CALC_TYPE_OPTIONS = BATTLE_TYPES.map(type => ({ id: type, label: TYPE_KO[type] || type, sub: type }));
const CALC_SECOND_TYPE_OPTIONS = [{ id: '', label: '없음', sub: '단일 타입' }, ...CALC_TYPE_OPTIONS];
const CALC_FORM_LABEL_KO = {
  Shield: '실드 폼',
  Blade: '블레이드 폼',
  Zero: '나이브 폼',
  Hero: '마이티 폼',
  Sunny: '태양의 모습',
  Rainy: '빗방울의 모습',
  Snowy: '설운의 모습',
};

function calcSearchText(value) {
  return String(value || '').toLowerCase();
}
function calcMatches(query, ...values) {
  if (!query) return true;
  return values.some(value => calcSearchText(value).includes(query));
}
function calcMoveCategoryLabel(cat) {
  return CALC_MOVE_CATEGORY_LABEL[cat] || cat || '';
}
function calcNatureLabel(nature) {
  if (!nature) return '';
  return nature.ko || nature.name || nature.id;
}
function calcAbilityDisplayLabel(sideKey) {
  const side = state[sideKey];
  const data = AbilityById[side?.ability];
  if (data) return abName(data);
  const pokemon = PokemonById[side?.pokemonIdx];
  return Object.values(pokemon?.ab || {}).find(name => toId(name) === side?.ability) || '없음';
}
function calcStatusDisplayLabel(statusId) {
  return CALC_STATUS_BY_ID[statusId]?.label || statusId || '건강';
}
function calcFieldOptionLabel(type, id) {
  return CALC_FIELD_OPTION_BY_TYPE[type]?.[id]?.label || id || '';
}
function setComboboxValue(inputId, value, type) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const label = calcFieldOptionLabel(type, value);
  input.dataset.value = value;
  if (input.tagName === 'BUTTON') {
    input.textContent = label;
    input.value = label;
  } else {
    input.value = label;
  }
}
function calcItemCategoryLabel(item) {
  if (item?.ms) return '메가스톤';
  if (item?.isBerry) return '열매';
  if (item?.isChoice) return '고집계';
  if (item?.isGem) return '젬';
  return '장착형';
}
function calcItemCategoryRank(item) {
  if (item?.ms) return 2;
  if (item?.isBerry) return 1;
  return 0;
}
function sortMovesForCalcSelect(moves) {
  const categoryRank = { Physical: 0, Special: 1, Status: 2 };
  return moves.slice().sort((a, b) => {
    const catA = categoryRank[a?.cat] ?? 99;
    const catB = categoryRank[b?.cat] ?? 99;
    if (catA !== catB) return catA - catB;
    const typeA = BATTLE_TYPES.indexOf(a.type);
    const typeB = BATTLE_TYPES.indexOf(b.type);
    if (typeA !== typeB) return typeA - typeB;
    const bpA = typeof a?.bp === 'number' ? a.bp : 0;
    const bpB = typeof b?.bp === 'number' ? b.bp : 0;
    if (bpA !== bpB) return bpB - bpA;
    return mvName(a).localeCompare(mvName(b), 'ko', { numeric: true, sensitivity: 'base' });
  });
}
function sortItemsForCalcSelect(items) {
  return items.slice().sort((a, b) => {
    const catA = calcItemCategoryRank(a);
    const catB = calcItemCategoryRank(b);
    if (catA !== catB) return catA - catB;
    return itName(a).localeCompare(itName(b), 'ko', { numeric: true, sensitivity: 'base' });
  });
}
function sortPokemonForCalcSelect(pokemon) {
  return pokemon.slice().sort((a, b) => {
    const numA = typeof a?.num === 'number' && a.num > 0 ? a.num : Number.MAX_SAFE_INTEGER;
    const numB = typeof b?.num === 'number' && b.num > 0 ? b.num : Number.MAX_SAFE_INTEGER;
    if (numA !== numB) return numA - numB;
    return pkName(a).localeCompare(pkName(b), 'ko', { numeric: true, sensitivity: 'base' });
  });
}
function defaultPokemonTypes(pokemon) {
  return Array.isArray(pokemon?.types) ? pokemon.types.slice(0, 2) : [];
}
function sameTypeList(left = [], right = []) {
  const a = left.filter(Boolean);
  const b = right.filter(Boolean);
  return a.length === b.length && a.every((type, index) => type === b[index]);
}
function calcPokemonFormLabel(pokemon) {
  if (!pokemon) return '';
  const raw = pokemon.forme || pokemon.baseForme || '';
  return CALC_FORM_LABEL_KO[raw] || raw || '기본';
}
function calcFormGroupForPokemon(pokemon) {
  if (!pokemon?.formGroup || !Array.isArray(pokemon.formGroupForms)) return null;
  const forms = pokemon.formGroupForms
    .map(id => PokemonById[id])
    .filter(Boolean);
  if (forms.length < 2) return null;
  return {
    key: pokemon.formGroup,
    mode: pokemon.formGroupMode || 'battle',
    label: pokemon.formGroupLabel || '폼',
    trigger: pokemon.formGroupTrigger || '',
    forms,
  };
}
function calcFormGroupForSide(side) {
  return calcFormGroupForPokemon(PokemonById[side?.pokemonIdx]);
}
function calcFormOptionDataForPokemon(pokemonId) {
  const group = calcFormGroupForPokemon(PokemonById[pokemonId]);
  if (!group) return [];
  return group.forms.map(form => ({
    id: form.id,
    label: calcPokemonFormLabel(form),
    sub: pkName(form),
    raw: form,
  }));
}
function renderToolFormCombobox({
  pokemonId,
  inputClass,
  pickAttr,
  pickValue,
  ariaLabel = '폼 선택',
  comboboxClass = '',
  comboboxAttrs = {},
  buttonAttrs = {},
} = {}) {
  const group = calcFormGroupForPokemon(PokemonById[pokemonId]);
  if (!group || !inputClass || !pickAttr || !pickValue) return '';
  const currentForm = PokemonById[pokemonId];
  const currentLabel = calcPokemonFormLabel(currentForm);
  const { class: buttonClass = '', ...extraButtonAttrs } = buttonAttrs;
  const attrs = {
    class: toolClassNames('cb-input cb-trigger form-switch-btn', inputClass, buttonClass),
    'data-cb-type': 'form',
    'aria-label': ariaLabel,
    'aria-expanded': 'false',
    ...extraButtonAttrs,
  };
  attrs[pickAttr] = pickValue;
  return `
    <div ${htmlAttrs({
      class: toolClassNames('combobox tool-form-combobox', comboboxClass),
      ...comboboxAttrs,
    })}>
      <button type="button" ${htmlAttrs(attrs)}>${escapeHTML(currentLabel)}</button>
      <div class="combobox-options" role="listbox"></div>
    </div>
  `;
}
function toolClassNames(...parts) {
  return parts.flat(Infinity)
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}
function renderToolTypePills(types, extraClass = '') {
  return (types || [])
    .filter(Boolean)
    .map(type => `<span class="${toolClassNames('type-pill tool-pokemon-type-pill', extraClass, `t-${type}`)}">${TYPE_KO[type] || type}</span>`)
    .join('');
}
function renderToolPokemonTypeStrip({ types, html, className = '', ariaLabel = '타입', empty = false } = {}) {
  const content = html ?? renderToolTypePills(types);
  const isEmpty = empty || !content;
  return `<div ${htmlAttrs({
    class: toolClassNames('tool-pokemon-type-strip', className, isEmpty && 'empty'),
    'aria-label': isEmpty ? null : ariaLabel,
    'aria-hidden': isEmpty ? 'true' : null,
  })}>${isEmpty ? '' : content}</div>`;
}
function renderToolPokemonSelectSubframe({
  fieldClass = '',
  headClass = '',
  title = '포켓몬',
  labelClass = '',
  primaryActions = '',
  titleActions = '',
  metaActions = '',
  comboboxClass = '',
  comboboxAttrs = {},
  inputClass = '',
  inputAttrs = {},
  value = '',
  placeholder = '검색...',
  autocomplete = 'off',
  optionsRole = '',
  toolbarActions = '',
  toolbarClass = '',
} = {}) {
  const primaryHtml = primaryActions
    ? `<div class="tool-pokemon-primary-actions ui-field-actions">${primaryActions}</div>`
    : '';
  const titleExtraHtml = titleActions || '';
  const metaHtml = metaActions
    ? `<div class="tool-pokemon-meta-actions tool-pokemon-secondary-actions">${metaActions}</div>`
    : '';
  const toolbarHtml = toolbarActions
    ? `<div class="${toolClassNames('tool-pokemon-meta-actions tool-pokemon-secondary-actions tool-pokemon-row tool-pokemon-toolbar-row', toolbarClass)}">${toolbarActions}</div>`
    : '';
  return `
    <div class="tool-pokemon-subframe ui-control-frame ui-subframe">
      <div class="${toolClassNames('tool-pokemon-field ui-field', fieldClass)}">
        <div class="${toolClassNames('ui-field-head tool-pokemon-head tool-pokemon-row tool-pokemon-head-row', headClass)}">
          <div class="tool-pokemon-title-actions">
            <div class="tool-pokemon-label-actions">
              <span class="${toolClassNames('ui-field-label', labelClass)}">${escapeHTML(title)}</span>
              ${primaryHtml}
            </div>
            ${titleExtraHtml}
          </div>
          ${metaHtml}
        </div>
        <div ${htmlAttrs({
          class: toolClassNames('combobox pokemon-select tool-pokemon-combobox tool-pokemon-control-row', comboboxClass),
          ...comboboxAttrs,
        })}>
          <input ${htmlAttrs({
            type: 'text',
            class: toolClassNames('cb-input tool-pokemon-input', inputClass),
            value,
            placeholder,
            autocomplete,
            'aria-expanded': 'false',
            ...inputAttrs,
          })}>
          <div ${htmlAttrs({ class: 'combobox-options', role: optionsRole || null })}></div>
        </div>
        ${toolbarHtml}
      </div>
    </div>
  `;
}
function normalizeSideTypes(side) {
  const pokemon = PokemonById[side?.pokemonIdx];
  const fallback = defaultPokemonTypes(pokemon);
  const source = Array.isArray(side?.types) && side.types.length ? side.types : fallback;
  const types = [];
  for (const type of source || []) {
    if (BATTLE_TYPES.includes(type) && !types.includes(type)) types.push(type);
  }
  return types.length ? types.slice(0, 2) : fallback;
}
function sideTypeId(side, slot) {
  return normalizeSideTypes(side)[slot] || '';
}
function setSideType(sideKey, slot, value) {
  const side = state[sideKey];
  if (!side) return;
  const pokemon = PokemonById[side.pokemonIdx];
  const fallback = defaultPokemonTypes(pokemon);
  const current = normalizeSideTypes(side);
  const first = slot === 0 ? (BATTLE_TYPES.includes(value) ? value : (fallback[0] || 'Normal')) : (current[0] || fallback[0] || 'Normal');
  const secondCandidate = slot === 0 ? '' : value;
  const second = BATTLE_TYPES.includes(secondCandidate) && secondCandidate !== first ? secondCandidate : '';
  side.types = [first, second].filter(Boolean);
  if (!side.teraType || !BATTLE_TYPES.includes(side.teraType)) side.teraType = first;
}
function resetSideTypes(sideKey) {
  const side = state[sideKey];
  const pokemon = PokemonById[side?.pokemonIdx];
  side.types = defaultPokemonTypes(pokemon);
  side.teraType = side.types[0] || 'Normal';
}
function applyPokemonFormToSideState(side, targetPokemonId) {
  const currentPokemon = PokemonById[side?.pokemonIdx];
  const targetPokemon = PokemonById[targetPokemonId];
  const group = calcFormGroupForPokemon(currentPokemon);
  if (!side || !currentPokemon || !targetPokemon || !group) return { applied: false, changed: false };
  if (!group.forms.some(form => form.id === targetPokemonId)) return { applied: false, changed: false };

  const changed = side.pokemonIdx !== targetPokemonId;
  if (!changed) return { applied: true, changed: false };

  const currentDefaultTypes = defaultPokemonTypes(currentPokemon);
  const currentTypes = normalizeSideTypes(side);
  const usesDefaultTypes = sameTypeList(currentTypes, currentDefaultTypes);
  const usesDefaultTeraType = !side.teraType || side.teraType === currentDefaultTypes[0];
  const targetDefaultTypes = defaultPokemonTypes(targetPokemon);

  side.pokemonIdx = targetPokemonId;

  const targetAbilities = Object.values(targetPokemon.ab || {}).map(toId);
  if (side.ability && !targetAbilities.includes(side.ability)) {
    side.ability = defaultPokemonAbilityId(targetPokemon);
    setSideDamageBlockActive(side, false);
  }
  if (usesDefaultTypes) {
    side.types = targetDefaultTypes;
  } else {
    side.types = normalizeSideTypes(side);
  }
  if (usesDefaultTeraType || !BATTLE_TYPES.includes(side.teraType)) {
    side.teraType = targetDefaultTypes[0] || 'Normal';
  }

  return { applied: true, changed: true };
}
function applyPokemonFormToCalcSide(sideKey, targetPokemonId) {
  return applyPokemonFormToSideState(state[sideKey], targetPokemonId);
}
function calcPokemonAbilityTerms(pokemon) {
  return Object.values(pokemon?.ab || {}).flatMap(name => {
    const data = AbilityById[toId(name)];
    return [name, data?.name, data?.koName, data?.desc, data?.descLong];
  });
}
function calcDatasetForCombobox(sideKey, type) {
  if (type === 'form') {
    return calcFormOptionDataForPokemon(state[sideKey]?.pokemonIdx);
  }
  if (type === 'pokemon') return sortPokemonForCalcSelect(POKEMON);
  if (type === 'type1') return CALC_TYPE_OPTIONS;
  if (type === 'type2') return CALC_SECOND_TYPE_OPTIONS;
  if (type === 'moveType') return CALC_TYPE_OPTIONS;
  if (type === 'move') {
    const p = PokemonById[state[sideKey]?.pokemonIdx];
    const learnset = (p?.ls || []).map(id => MoveById[id]).filter(Boolean);
    return sortMovesForCalcSelect(learnset.length > 0 ? learnset : MOVES);
  }
  if (type === 'ability') {
    const p = PokemonById[state[sideKey]?.pokemonIdx];
    const abilities = Object.values(p?.ab || {})
      .map(name => AbilityById[toId(name)] || { id: toId(name), name })
      .filter(a => a.id);
    return abilities.length > 0 ? abilities : ABILITIES;
  }
  if (type === 'nature') return NATURES;
  if (type === 'status') return CALC_STATUS_OPTIONS;
  if (CALC_FIELD_OPTION_SETS[type]) return CALC_FIELD_OPTION_SETS[type];
  return sortItemsForCalcSelect(ITEMS);
}

function defaultPokemonAbilityId(pokemon) {
  return toId(pokemon?.ab?.['0'] || pokemon?.ab?.['H'] || '');
}

function defaultPokemonItemId(pokemon) {
  const itemId = toId(pokemon?.requiredItem || '');
  if (itemId && ItemById[itemId]) return itemId;
  if (!pokemon?.mega) return '';
  const pokemonIds = new Set([
    pokemon.id,
    toId(pokemon.name),
    toId(pokemon.base),
    toId(pokemon.baseSpecies),
  ].filter(Boolean));
  const item = ITEMS.find(candidate => {
    const megaStone = candidate?.ms || candidate?.megaStone;
    if (!megaStone) return false;
    return Object.values(megaStone).some(target => pokemonIds.has(toId(target)));
  });
  return item?.id || '';
}

function applyPokemonToCalcSide(sideKey, pokemonId, options = {}) {
  const side = state[sideKey];
  const pokemon = PokemonById[pokemonId];
  if (!side || !pokemon) return { applied: false, changed: false, resetAutoFields: false };

  const changed = side.pokemonIdx !== pokemonId;
  let resetAutoFields = false;
  if (changed && autoEntryEffects) {
    resetAutoFields = resetManualAutoFieldOverrides();
  }

  side.pokemonIdx = pokemonId;
  if (changed || options.forceDefaults) {
    side.ability = defaultPokemonAbilityId(pokemon);
    side.types = defaultPokemonTypes(pokemon);
    side.teraType = side.types?.[0] || 'Normal';
    side.tera = false;
    side.item = defaultPokemonItemId(pokemon);
    setSideDamageBlockActive(side, false);
    if (options.resetMoves !== false) {
      side.moves = [];
      side.moveBpOverrides = [null, null, null, null];
      side.moveTypeOverrides = [null, null, null, null];
      side.moveCriticalOverrides = [false, false, false, false];
    }
  }

  if (!options.deferEntryEffects) {
    resetAutoFields = applyEntryFieldsFromSide(sideKey) || resetAutoFields;
  }

  return { applied: true, changed, resetAutoFields };
}

function normalizeManualBp(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(999, Math.floor(n)));
}

function manualBpForSlot(side, slot, move) {
  const manual = normalizeManualBp(side.moveBpOverrides?.[slot]);
  return manual === null ? (move?.bp || 0) : manual;
}

function normalizeMoveType(value) {
  return BATTLE_TYPES.includes(value) ? value : null;
}

function manualTypeForSlot(side, slot, move) {
  const manual = normalizeMoveType(side.moveTypeOverrides?.[slot]);
  return manual || move?.type || '';
}

function moveWithManualBp(move, manualBp, manualType = null) {
  const bp = normalizeManualBp(manualBp);
  const type = normalizeMoveType(manualType);
  const hasBpOverride = bp !== null;
  const hasTypeOverride = !!type && type !== move?.type;
  if (!hasBpOverride && !hasTypeOverride) return move;
  return {
    ...move,
    ...(hasBpOverride ? { bp, manualBp: true } : {}),
    ...(hasTypeOverride ? { type, manualType: true, originalType: move.type } : {}),
  };
}

function normalizeHpPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const raw = n > 1 ? n / 100 : n;
  return Math.max(0.01, Math.min(1, raw));
}

function hpPercentInputValue(side) {
  return Number((normalizeHpPct(side.hpPct) * 100).toFixed(1)).toString();
}

function currentHpValue(maxHp, hpPct) {
  return Math.max(1, Math.floor(maxHp * normalizeHpPct(hpPct)));
}

function deriveHpFlags(side) {
  const hpPct = normalizeHpPct(side.hpPct);
  side.hpPct = hpPct;
  side.fullHP = hpPct >= 1;
  side.pinch = hpPct <= (1 / 3);
  return side;
}

function calcPokemonMatchesBlock(pokemon, block) {
  if (!pokemon || !block) return false;
  if (block.pokemon && !block.pokemon.includes(pokemon.id)) return false;
  if (block.baseSpecies && !block.baseSpecies.includes(pokemon.base || pokemon.name)) return false;
  return true;
}

function sideManualDamageBlock(side) {
  const pokemon = PokemonById[side?.pokemonIdx];
  const block = AbilityById[side?.ability]?.damageBlock;
  if (!block?.manual || !calcPokemonMatchesBlock(pokemon, block)) return null;
  return block;
}

function fractionHpLoss(maxHp, fraction) {
  if (!Array.isArray(fraction) || fraction.length !== 2) return 0;
  const [num, den] = fraction.map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return Math.floor(maxHp * num / den);
}

function consumedDamageBlockHpPct(side) {
  const block = sideManualDamageBlock(side);
  if (!block?.consumedHpFraction) return null;
  const maxHp = calcStats(side).hp;
  const loss = fractionHpLoss(maxHp, block.consumedHpFraction);
  if (loss <= 0) return null;
  return Math.max(1, maxHp - loss) / maxHp;
}

function setSideDamageBlockActive(side, active) {
  if (!side) return;
  side.damageBlockActive = !!active;
  const consumedHpPct = consumedDamageBlockHpPct(side);
  if (consumedHpPct !== null) {
    side.hpPct = side.damageBlockActive ? 1 : consumedHpPct;
  }
  deriveHpFlags(side);
}

function setSideHpPct(side, value) {
  side.hpPct = normalizeHpPct(value);
  deriveHpFlags(side);
}

function selectedAttackMoves() {
  return (state.atk.moves || []).map(id => MoveById[id]).filter(Boolean);
}

function selectedMoveHasVariableKind(kinds) {
  const wanted = Array.isArray(kinds) ? kinds : [kinds];
  return selectedAttackMoves().some(move => wanted.includes(move.variableBpKind));
}

function attackerAbilityData() {
  return state.atk.ability ? AbilityById[state.atk.ability] : null;
}

function sideAbilityData(sideKey) {
  const side = state[sideKey];
  return side?.ability ? AbilityById[side.ability] : null;
}

function attackerNeedsFlashFireToggle() {
  return !!attackerAbilityData()?.attackStatBoosts?.some(rule => rule.flashFireActive);
}

function normalizeBoosterEnergyState(value) {
  return ['auto', 'active', 'inactive'].includes(value) ? value : 'auto';
}

function maxFallenAllies(gameType = state.field.gameType) {
  return gameType === 'Doubles' ? 3 : 2;
}

function clampFallenAllies(value, gameType = state.field.gameType) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(maxFallenAllies(gameType), n));
}

function normalizeBattleConditionState() {
  state.atk.fallenAllies = clampFallenAllies(state.atk.fallenAllies);
  state.atk.lastMoveFailed = !!state.atk.lastMoveFailed;
  state.atk.wasHit = !!state.atk.wasHit;
  state.def.wasHit = !!state.def.wasHit;
  state.atk.flashFireActive = !!state.atk.flashFireActive;
  state.atk.boosterEnergyState = normalizeBoosterEnergyState(state.atk.boosterEnergyState);
  state.def.boosterEnergyState = normalizeBoosterEnergyState(state.def.boosterEnergyState);
  state.atk.damageBlockActive = !!state.atk.damageBlockActive;
  state.def.damageBlockActive = !!state.def.damageBlockActive;
}

function renderManualDamageBlockToggle(sideKey, side) {
  const block = sideManualDamageBlock(side);
  if (!block) return '';
  const ability = AbilityById[side.ability];
  const label = abName(ability);
  const active = !!side.damageBlockActive;
  const title = active
    ? `${label} ON: 이번 공격을 차단`
    : `${label} OFF: 소모된 상태로 계산`;
  return `
    <button type="button" class="manual-ability-toggle ui-label-action ${active ? 'active' : ''}" data-action="damageBlockToggle" data-side="${sideKey}" title="${escapeHTML(title)}">
      ${escapeHTML(label)} ${active ? 'ON' : 'OFF'}
    </button>
  `;
}

function renderTypeControls(sideKey, side) {
  const type1 = sideTypeId(side, 0);
  const type2 = sideTypeId(side, 1);
  return `
    <div class="type-edit-row ui-chip-row">
      <div class="combobox type-combobox type-pill-combobox t-${type1 || 'Normal'}" data-cb="${sideKey}-type-1">
        <button type="button" class="cb-input cb-trigger" data-cb-type="type1" data-side="${sideKey}" data-field="types.0" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 타입1 선택" aria-expanded="false">${escapeHTML(TYPE_KO[type1] || type1)}</button>
        <div class="combobox-options" role="listbox"></div>
      </div>
      <div class="combobox type-combobox type-pill-combobox ${type2 ? `t-${type2}` : 'type-none'}" data-cb="${sideKey}-type-2">
        <button type="button" class="cb-input cb-trigger" data-cb-type="type2" data-side="${sideKey}" data-field="types.1" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 타입2 선택" aria-expanded="false">${escapeHTML(type2 ? (TYPE_KO[type2] || type2) : '없음')}</button>
        <div class="combobox-options" role="listbox"></div>
      </div>
      <button type="button" class="type-reset-btn" data-action="typeReset" data-side="${sideKey}" title="포켓몬 기본 타입으로 복구">초기화</button>
    </div>
  `;
}
function renderFormSwitchControls(sideKey, side) {
  const group = calcFormGroupForSide(side);
  if (!group) return '';
  const trigger = group.trigger ? ` · ${group.trigger}` : '';
  const sideLabel = sideKey === 'atk' ? '공격측' : '방어측';
  const formControl = renderToolFormCombobox({
    pokemonId: side?.pokemonIdx,
    inputClass: 'calc-cb-input',
    pickAttr: 'data-field',
    pickValue: 'formIdx',
    ariaLabel: `${sideLabel} ${group.label} 선택`,
    comboboxAttrs: { 'data-cb': `${sideKey}-form` },
    buttonAttrs: {
      'data-side': sideKey,
    },
  });
  return `
    <div class="form-switch-row ui-chip-row" aria-label="${escapeHTML(group.label + trigger)}">
      ${formControl}
    </div>
  `;
}

function resetSideManualValues(sideKey) {
  const side = state[sideKey];
  const pokemon = PokemonById[side?.pokemonIdx];
  if (!side || !pokemon) return;
  side.ability = defaultPokemonAbilityId(pokemon);
  side.types = defaultPokemonTypes(pokemon);
  side.tera = false;
  side.teraType = side.types[0] || 'Normal';
  side.hpPct = 1;
  side.status = 'none';
  side.ranks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  side.lastMoveFailed = false;
  side.wasHit = false;
  side.fallenAllies = 0;
  side.flashFireActive = false;
  side.boosterEnergyState = 'auto';
  setSideDamageBlockActive(side, false);
  if (sideKey === 'atk') {
    side.moveBpOverrides = [null, null, null, null];
    side.moveTypeOverrides = [null, null, null, null];
    side.moveCriticalOverrides = [false, false, false, false];
  }
  deriveHpFlags(side);
}

function resetFieldManualValues() {
  Object.keys(manualAutoFieldOverrides).forEach(key => { manualAutoFieldOverrides[key] = null; });
  state.field.weather = 'none';
  state.field.terrain = 'none';
  state.field.isCritical = false;
  state.field.isGravity = false;
  state.field.defReflect = false;
  state.field.defLightScreen = false;
  state.field.atkHelpingHand = false;
  state.field.ruinSword = false;
  state.field.ruinTablet = false;
  state.field.ruinBeads = false;
  state.field.ruinVessel = false;
  state.field.defStealthRock = false;
  state.field.defSpikesLayers = 0;
}

function resetCalcManualValues() {
  resetSideManualValues('atk');
  resetSideManualValues('def');
  resetFieldManualValues();
  resetAutoEntryFieldState();
  lastAutoEntry = emptyEntryMeta();
  renderSide('atk');
  renderSide('def');
  syncFieldControls(state.field);
  triggerCalc();
}

function applyMoveBpInput(el, renderAfter = false) {
  const side = state[el.dataset.side];
  const slot = parseInt(el.dataset.slot);
  const moveId = side.moves?.[slot];
  const move = moveId ? MoveById[moveId] : null;
  const normalized = normalizeManualBp(el.value);
  const defaultBp = move?.bp || 0;
  if (!Array.isArray(side.moveBpOverrides)) side.moveBpOverrides = [null, null, null, null];
  side.moveBpOverrides[slot] = normalized === null || normalized === defaultBp ? null : normalized;
  if (renderAfter) renderSide(el.dataset.side);
  triggerCalc();
}

function applyMoveTypeOverride(sideKey, slot, typeId) {
  const side = state[sideKey];
  const moveId = side?.moves?.[slot];
  const move = moveId ? MoveById[moveId] : null;
  if (!side || !move) return;
  const normalized = normalizeMoveType(typeId);
  if (!Array.isArray(side.moveTypeOverrides)) side.moveTypeOverrides = [null, null, null, null];
  side.moveTypeOverrides[slot] = !normalized || normalized === move.type ? null : normalized;
}

// 자동 진입 효과 ON/OFF
let autoEntryEffects = true;

/* ════════════════════════════════════════════════════════════
   특성별 진입 효과 정의는 data/overrides/entry-effects.json 에서 빌드된다.
   ════════════════════════════════════════════════════════════ */
