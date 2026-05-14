/* ════════════════════════════════════════════════════════════
 * 03-calc-ui.js — 계산기 페이지 UI: state, ENTRY_EFFECTS, renderSide, runCalc, 필드 이벤트, swap, autoCalc
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   State
   ════════════════════════════════════════════════════════════ */
function makeSideState(defaultIdx) {
  const p = PokemonById[defaultIdx];
  return {
    pokemonIdx: defaultIdx,
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
    moveBpOverrides: [null, null, null, null]
  };
}

const state = {
  atk: makeSideState('incineroar'),
  def: makeSideState('amoonguss'),  // 화뭉시
  field: {
    weather: "none", terrain: "none", gameType: "Singles",
    isCritical: false, isTrickRoom: false, isGravity: false,
    defReflect: false, defLightScreen: false,
    atkHelpingHand: false, defProtect: false,
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

// 기본 세팅
state.atk.evs = { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 };
state.atk.nature = 'adamant';  // 고집 (atk↑/spa↓)
state.atk.moves = ['flareblitz','knockoff','uturn','earthquake'].filter(id => MoveById[id]);
state.def.evs = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
state.def.nature = 'bold';  // 대담 (def↑/atk↓)

// Amoonguss가 없으면 마릴리로 폴백
if (!PokemonById['amoonguss']) {
  state.def = makeSideState('azumarill');
  state.def.evs = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };
  state.def.nature = 'bold';
}

/* ════════════════════════════════════════════════════════════
   렌더링
   ════════════════════════════════════════════════════════════ */

// 한국어 이름 헬퍼
function pkName(p) { return p.koName || p.name; }
function mvName(m) { return m.koName || m.name; }
function abName(a) { return a ? (a.koName || a.name) : '없음'; }
function itName(i) { return i ? (i.koName || i.name) : '없음'; }

const CALC_MOVE_CATEGORY_LABEL = { Physical: '물리', Special: '특수', Status: '변화' };
const CALC_STATUS_OPTIONS = [
  { id: 'none', label: '건강', sub: '상태 이상 없음' },
  { id: 'Burn', label: '화상', sub: '물리 공격 약화' },
  { id: 'Paralysis', label: '마비', sub: '속도 약화' },
  { id: 'Poison', label: '독', sub: '독 상태' },
  { id: 'Badly Poison', label: '맹독', sub: '턴마다 독 누적' },
  { id: 'Sleep', label: '잠듦', sub: '수면 상태' },
  { id: 'Freeze', label: '얼음', sub: '얼음 상태' },
];
const CALC_STATUS_BY_ID = Object.fromEntries(CALC_STATUS_OPTIONS.map(s => [s.id, s]));
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
  { id: 'Singles', label: '싱글배틀', sub: '63 싱글' },
  { id: 'Doubles', label: '더블배틀', sub: '64 더블' },
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
function calcFieldOptionSub(type, id) {
  return CALC_FIELD_OPTION_BY_TYPE[type]?.[id]?.sub || '';
}
function setComboboxValue(inputId, value, type) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.dataset.value = value;
  input.value = calcFieldOptionLabel(type, value);
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
  return moves.slice().sort((a, b) => {
    const typeA = BATTLE_TYPES.indexOf(a.type);
    const typeB = BATTLE_TYPES.indexOf(b.type);
    if (typeA !== typeB) return typeA - typeB;
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
  return pokemon.slice().sort((a, b) => pkName(a).localeCompare(pkName(b), 'ko', { numeric: true, sensitivity: 'base' }));
}
function defaultPokemonTypes(pokemon) {
  return Array.isArray(pokemon?.types) ? pokemon.types.slice(0, 2) : [];
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
function calcPokemonAbilityTerms(pokemon) {
  return Object.values(pokemon?.ab || {}).flatMap(name => {
    const data = AbilityById[toId(name)];
    return [name, data?.name, data?.koName, data?.desc, data?.descLong];
  });
}
function calcDatasetForCombobox(sideKey, type) {
  if (type === 'pokemon') return sortPokemonForCalcSelect(POKEMON);
  if (type === 'type1') return CALC_TYPE_OPTIONS;
  if (type === 'type2') return CALC_SECOND_TYPE_OPTIONS;
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
  return itemId && ItemById[itemId] ? itemId : '';
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
    side.damageBlockActive = false;
    if (sideKey === 'atk' && options.resetMoves !== false) {
      side.moves = [];
      side.moveBpOverrides = [null, null, null, null];
    }
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

function moveWithManualBp(move, manualBp) {
  const bp = normalizeManualBp(manualBp);
  return bp === null ? move : { ...move, bp, manualBp: true };
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

function applyManualDamageBlockHpAdjustment(side) {
  const block = sideManualDamageBlock(side);
  if (!block?.consumedHpFraction || side.damageBlockActive) return side;
  const maxHp = calcStats(side).hp;
  const loss = fractionHpLoss(maxHp, block.consumedHpFraction);
  if (loss <= 0) return side;
  const currentHp = currentHpValue(maxHp, side.hpPct);
  const adjustedHp = Math.max(1, currentHp - loss);
  side.hpPct = adjustedHp / maxHp;
  side.fullHP = false;
  side.pinch = side.hpPct <= (1 / 3);
  return side;
}

function setSideHpPct(side, value) {
  side.hpPct = normalizeHpPct(value);
  deriveHpFlags(side);
}

function renderHpConditionPills(side) {
  const hpPct = normalizeHpPct(side.hpPct);
  const pills = [];
  if (hpPct >= 1) pills.push('<span class="hp-state-pill full">풀피</span>');
  if (hpPct <= (1 / 3)) pills.push('<span class="hp-state-pill pinch">핀치</span>');
  return pills.length ? pills.join('') : '<span class="hp-state-pill neutral">일반</span>';
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

function sideNeedsBoosterEnergyControl(sideKey) {
  const side = state[sideKey];
  return !!sideAbilityData(sideKey)?.paradoxBoost || !!ItemById[side?.item]?.paradoxActivation;
}

function attackerNeedsFallenAllies() {
  return selectedMoveHasVariableKind('fallenAllies') || !!attackerAbilityData()?.supremeOverlord;
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

function speedConditionInfo() {
  const calcState = makeCalcState();
  const atkSpe = effectiveSpeed(calcState.atk, calcState.field);
  const defSpe = effectiveSpeed(calcState.def, calcState.field);
  const first = atkSpe > defSpe;
  const second = atkSpe < defSpe;
  return {
    atkSpe,
    defSpe,
    first,
    second,
    verdict: first ? '공격측 선공' : second ? '공격측 후공' : '동속',
  };
}

function renderConditionToggle({ sideKey, field, checked, label, detail }) {
  return `
    <label class="condition-toggle">
      <input type="checkbox" data-action="conditionFlag" data-side="${sideKey}" data-field="${field}" ${checked ? 'checked' : ''}>
      <span>${label}</span>
      ${detail ? `<em>${detail}</em>` : ''}
    </label>
  `;
}

function renderBattleConditions(sideKey = 'atk') {
  normalizeBattleConditionState();
  const side = state[sideKey];
  const isAttacker = sideKey === 'atk';
  const needsFirst = isAttacker && selectedMoveHasVariableKind('userMovesFirstDouble');
  const needsSecond = isAttacker && (selectedMoveHasVariableKind('userMovesSecondDouble') || !!attackerAbilityData()?.bpBoosts?.some(rule => rule.movesSecond));
  const needsLastMoveFailed = isAttacker && selectedMoveHasVariableKind('lastMoveFailedDouble');
  const needsAttackerWasHit = isAttacker && selectedMoveHasVariableKind('userWasHitDouble');
  const needsTargetWasHit = isAttacker && selectedMoveHasVariableKind('targetWasHitDouble');
  const needsFallenAllies = isAttacker && attackerNeedsFallenAllies();
  const needsFlashFire = isAttacker && attackerNeedsFlashFireToggle();
  const needsBoosterEnergy = sideNeedsBoosterEnergyControl(sideKey);
  const hasConditions = needsFirst || needsSecond || needsLastMoveFailed || needsAttackerWasHit ||
    needsTargetWasHit || needsFallenAllies || needsFlashFire || needsBoosterEnergy;
  if (!hasConditions) return '';

  const rows = [];
  if (needsBoosterEnergy) {
    const mode = normalizeBoosterEnergyState(side.boosterEnergyState);
    const ab = sideAbilityData(sideKey);
    rows.push(`
      <label class="condition-number condition-select">
        <span>부스트 에너지</span>
        <select data-action="conditionMode" data-side="${sideKey}" data-field="boosterEnergyState">
          <option value="auto" ${mode === 'auto' ? 'selected' : ''}>자동</option>
          <option value="active" ${mode === 'active' ? 'selected' : ''}>활성</option>
          <option value="inactive" ${mode === 'inactive' ? 'selected' : ''}>비활성</option>
        </select>
        <em>${ab?.koName || ab?.name || 'Paradox'} · 도구 보유/소모 상태</em>
      </label>
    `);
  }
  if (needsFirst || needsSecond) {
    const info = speedConditionInfo();
    const active = (needsFirst && info.first) || (needsSecond && info.second);
    const reason = [
      needsFirst ? '선공 시 위력 상승' : '',
      needsSecond ? '후공 시 위력 상승' : '',
    ].filter(Boolean).join(' · ');
    rows.push(`
      <div class="condition-auto ${active ? 'active' : ''}">
        <div>
          <span>실속도 기준 자동 적용</span>
          <b>${info.verdict}</b>
        </div>
        <em>${info.atkSpe} : ${info.defSpe}${reason ? ` · ${reason}` : ''}</em>
      </div>
    `);
  }
  if (needsLastMoveFailed) {
    rows.push(renderConditionToggle({
      sideKey: 'atk',
      field: 'lastMoveFailed',
      checked: state.atk.lastMoveFailed,
      label: '직전 기술 실패',
      detail: '열불내기/분함의발구르기',
    }));
  }
  if (needsAttackerWasHit) {
    rows.push(renderConditionToggle({
      sideKey: 'atk',
      field: 'wasHit',
      checked: state.atk.wasHit,
      label: '공격측이 먼저 피격',
      detail: '눈사태',
    }));
  }
  if (needsTargetWasHit) {
    rows.push(renderConditionToggle({
      sideKey: 'def',
      field: 'wasHit',
      checked: state.def.wasHit,
      label: '방어측이 이미 피격',
      detail: '승부굳히기',
    }));
  }
  if (needsFlashFire) {
    rows.push(renderConditionToggle({
      sideKey: 'atk',
      field: 'flashFireActive',
      checked: state.atk.flashFireActive,
      label: '타오르는불꽃 활성',
      detail: '불꽃 공격 강화',
    }));
  }
  if (needsFallenAllies) {
    const max = maxFallenAllies();
    rows.push(`
      <label class="condition-number">
        <span>쓰러진 아군 수</span>
        <input type="number" data-action="fallenAllies" data-side="atk" value="${clampFallenAllies(state.atk.fallenAllies)}" min="0" max="${max}" step="1">
        <em>0~${max} · ${state.field.gameType === 'Doubles' ? '64 더블' : '63 싱글'}</em>
      </label>
    `);
  }

  return `
    <div class="battle-conditions">
      <div class="field-label">
        <span>조건</span>
        <span class="hint">선택 기술/특성에 필요한 값만 표시</span>
      </div>
      <div class="condition-grid">${rows.join('')}</div>
    </div>
  `;
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
    <button type="button" class="manual-ability-toggle ${active ? 'active' : ''}" data-action="damageBlockToggle" data-side="${sideKey}" title="${escapeHTML(title)}">
      ${escapeHTML(label)} ${active ? 'ON' : 'OFF'}
    </button>
  `;
}

function sideCalcHpInfo(side, stats = null) {
  if (!side) return null;
  const sourceStats = stats || calcStats(side);
  const inputHp = currentHpValue(sourceStats.hp, side.hpPct);
  const calcSide = cloneSideForCalc(side);
  const calcStatsForSide = calcStats(calcSide);
  const calcHp = currentHpValue(calcStatsForSide.hp, calcSide.hpPct);
  if (inputHp === calcHp && sourceStats.hp === calcStatsForSide.hp) return null;
  return {
    inputHp,
    inputMaxHp: sourceStats.hp,
    calcHp,
    calcMaxHp: calcStatsForSide.hp,
    calcPct: Number((calcHp / calcStatsForSide.hp * 100).toFixed(1)).toString(),
  };
}

function renderCalcHpNote(side, stats) {
  const info = sideCalcHpInfo(side, stats);
  if (!info) return '';
  return `
    <div class="calc-hp-note">
      <span>계산 HP</span>
      <b>${info.calcHp} / ${info.calcMaxHp}</b>
      <em>입력 ${info.inputHp} / ${info.inputMaxHp} → ${info.calcPct}%</em>
    </div>
  `;
}

function renderTypeControls(sideKey, side) {
  const type1 = sideTypeId(side, 0);
  const type2 = sideTypeId(side, 1);
  return `
    <div class="type-edit-row">
      <div class="combobox type-combobox type-pill-combobox t-${type1 || 'Normal'}" data-cb="${sideKey}-type-1">
        <input type="text" class="cb-input" value="${escapeHTML(TYPE_KO[type1] || type1)}" data-cb-type="type1" data-side="${sideKey}" data-field="types.0" placeholder="타입1" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 타입1 선택" aria-expanded="false">
        <div class="combobox-options" role="listbox"></div>
      </div>
      <div class="combobox type-combobox type-pill-combobox ${type2 ? `t-${type2}` : 'type-none'}" data-cb="${sideKey}-type-2">
        <input type="text" class="cb-input" value="${escapeHTML(type2 ? (TYPE_KO[type2] || type2) : '없음')}" data-cb-type="type2" data-side="${sideKey}" data-field="types.1" placeholder="타입2" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 타입2 선택" aria-expanded="false">
        <div class="combobox-options" role="listbox"></div>
      </div>
      <button type="button" class="type-reset-btn" data-action="typeReset" data-side="${sideKey}" title="포켓몬 기본 타입으로 복구">기본</button>
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
  side.damageBlockActive = false;
  if (sideKey === 'atk') side.moveBpOverrides = [null, null, null, null];
  deriveHpFlags(side);
}

function resetFieldManualValues() {
  Object.keys(manualAutoFieldOverrides).forEach(key => { manualAutoFieldOverrides[key] = null; });
  state.field.weather = 'none';
  state.field.terrain = 'none';
  state.field.isCritical = false;
  state.field.isTrickRoom = false;
  state.field.isGravity = false;
  state.field.defReflect = false;
  state.field.defLightScreen = false;
  state.field.atkHelpingHand = false;
  state.field.defProtect = false;
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

// 챔피언스 모드 (사용 불가 도구 필터링)
let championsMode = true;

// 자동 진입 효과 ON/OFF
let autoEntryEffects = true;

/* ════════════════════════════════════════════════════════════
   특성별 진입 효과 정의는 data/overrides/entry-effects.json 에서 빌드된다.
   ════════════════════════════════════════════════════════════ */
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

function renderSide(sideKey) {
  const side = state[sideKey];
  const container = document.getElementById(`${sideKey}-body`);
  const p = PokemonById[side.pokemonIdx];
  if (!p) { container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>'; return; }
  
  const stats = calcStats(side);
  deriveHpFlags(side);
  const currentHp = currentHpValue(stats.hp, side.hpPct);
  const totalEV = Object.values(side.evs).reduce((a,b) => a+b, 0);
  const overEV = totalEV > 66;
  const manualDamageBlockToggle = renderManualDamageBlockToggle(sideKey, side);
  
  container.innerHTML = `
    <!-- 포켓몬 선택 -->
    <div class="field">
      <div class="field-label">
        <span>포켓몬</span>
        <span class="hint mono">${p.bs.hp}/${p.bs.atk}/${p.bs.def}/${p.bs.spa}/${p.bs.spd}/${p.bs.spe}</span>
      </div>
      <div class="pokemon-select combobox" data-cb="${sideKey}-poke">
        <input type="text" class="cb-input" value="${escapeHTML(pkName(p))}" data-cb-type="pokemon" data-side="${sideKey}" data-field="pokemonIdx" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 포켓몬 선택" aria-expanded="false">
        <div class="combobox-options" role="listbox"></div>
      </div>
      <div class="types-display">
        ${renderTypeControls(sideKey, side)}
        <button type="button" class="ft-jump-btn" data-ft-from-side="${sideKey}" title="이 포켓몬의 세팅을 세부조정 탭으로 가져가기">🔧 세부조정</button>
        <button type="button" class="ft-jump-btn" data-rc-from-side="${sideKey}" title="이 포켓몬의 세팅을 형태 역계산 탭으로 가져가기">🔎 역계산</button>
        <!-- 테라스탈은 챔피언스 모드에서 비활성화됨 -->
      </div>
    </div>

    ${sideKey === 'def' ? renderBattleConditions('def') : ''}

    <div class="section-divider"></div>

    <!-- 특성/도구 + 성격/HP/상태 -->
    <div class="field">
      <div class="calc-pair-grid">
        <div class="calc-control-cell">
          <span class="calc-control-label">특성</span>
          <div class="compound-control ability-toggle-cell">
            <div class="combobox" data-cb="${sideKey}-ability">
              <input type="text" class="cb-input" value="${escapeHTML(calcAbilityDisplayLabel(sideKey))}" data-cb-type="ability" data-side="${sideKey}" data-field="ability" placeholder="특성 선택" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 특성 선택" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            ${manualDamageBlockToggle || '<span class="manual-ability-spacer" aria-hidden="true"></span>'}
          </div>
        </div>
        <div class="calc-control-cell">
          <span class="calc-control-label">도구</span>
          <div class="combobox" data-cb="${sideKey}-item">
            <input type="text" class="cb-input" value="${side.item ? (ItemById[side.item] ? escapeHTML(itName(ItemById[side.item])) : '') : '없음'}" data-cb-type="item" data-side="${sideKey}" data-field="item" placeholder="도구 선택" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 도구 선택" aria-expanded="false">
            <div class="combobox-options" role="listbox"></div>
          </div>
        </div>
        <div class="calc-control-cell">
          <span class="calc-control-label">성격</span>
          <div class="compound-control nature-spacer-cell">
            <div class="combobox" data-cb="${sideKey}-nature">
              <input type="text" class="cb-input" value="${escapeHTML(calcNatureLabel(NATURE_BY_ID[side.nature]))}" data-cb-type="nature" data-side="${sideKey}" data-field="nature" placeholder="성격 선택" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 성격 선택" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            <span class="manual-ability-spacer" aria-hidden="true"></span>
          </div>
        </div>
        <div class="calc-control-cell">
          <span class="calc-control-label">상태</span>
          <div class="compound-control hp-status-cell">
            <label class="hp-inline-control">
              <input type="text" class="hp-percent-input" data-action="hpPct" data-side="${sideKey}" value="${hpPercentInputValue(side)}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 현재 HP 퍼센트">
              <span>%</span>
            </label>
            <div class="combobox" data-cb="${sideKey}-status">
              <input type="text" class="cb-input" value="${escapeHTML(calcStatusDisplayLabel(side.status))}" data-cb-type="status" data-side="${sideKey}" data-field="status" placeholder="상태 선택" autocomplete="off" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 상태 및 조건 선택" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
          </div>
        </div>
      </div>
      ${renderCalcHpNote(side, stats)}
    </div>

    <div class="section-divider"></div>

    <!-- 스탯 (능력포인트 + 랭크 + 실수치) -->
    <div class="field">
      <div class="field-label">
        <span>능력 포인트 · 랭크</span>
        <span class="hint">최대 32/스탯</span>
      </div>
      <div class="ev-total ${overEV ? 'over' : ''}" style="margin-top: 0; margin-bottom: 8px;">
        <span>투자 합계</span>
        <span><b>${totalEV}</b> / 66</span>
      </div>
      <div class="stat-grid">
        ${STATS.map(s => {
          const r = (side.ranks[s] || 0);
          const isRankable = s !== 'hp';
          const cls = r > 0 ? 'up' : r < 0 ? 'down' : '';
          return `
            <div class="stat-name">${STAT_LABEL[s]}</div>
            <div class="ev-input-group">
              <button class="ev-quick min" data-action="evQuick" data-side="${sideKey}" data-stat="${s}" data-val="0" title="0으로">최소</button>
              <input type="number" class="ev-input" data-action="ev" data-side="${sideKey}" data-stat="${s}" value="${side.evs[s]}" min="0" max="32">
              <button class="ev-quick max" data-action="evQuick" data-side="${sideKey}" data-stat="${s}" data-val="32" title="32로">최대</button>
            </div>
            ${isRankable ? `
              <div class="stat-rank-btns">
                <button data-action="rank" data-side="${sideKey}" data-stat="${s}" data-dir="-1">−</button>
                <span class="stat-rank-val ${cls}">${r > 0 ? '+' + r : r}</span>
                <button data-action="rank" data-side="${sideKey}" data-stat="${s}" data-dir="1">+</button>
              </div>
            ` : '<div></div>'}
            <div class="stat-final">${stats[s]}</div>
          `;
        }).join('')}
      </div>

      <div class="ev-presets">
        <div class="ev-presets-label">
          <span>${sideKey === 'atk' ? '공격형 프리셋' : '방어형 프리셋'}</span>
          <span class="reset-btn" data-action="evReset" data-side="${sideKey}">↺ 초기화</span>
        </div>
        <div class="ev-presets-row">
          ${sideKey === 'atk' ? `
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="AS">AS</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="CS">CS</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="HA">HA</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="atk" data-preset="HC">HC</button>
          ` : `
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HA">HA</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HB">HB</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HC">HC</button>
            <button class="ev-preset-btn" data-action="evPreset" data-side="def" data-preset="HD">HD</button>
          `}
        </div>
        <div class="ev-presets-label" style="margin-top: 8px;">
          <span>성격 프리셋</span>
        </div>
        <div class="ev-presets-row natures">
          ${sideKey === 'atk' ? `
            <button class="ev-preset-btn nature-btn ${side.nature === 'adamant' ? 'active' : ''}" data-action="naturePreset" data-side="atk" data-nature="adamant" title="공격↑ 특공↓">고집</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'jolly' ? 'active' : ''}"   data-action="naturePreset" data-side="atk" data-nature="jolly"   title="속도↑ 특공↓">명랑</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'modest' ? 'active' : ''}"  data-action="naturePreset" data-side="atk" data-nature="modest"  title="특공↑ 공격↓">조심</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'timid' ? 'active' : ''}"   data-action="naturePreset" data-side="atk" data-nature="timid"   title="속도↑ 공격↓">겁쟁이</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'hardy' ? 'active' : ''}"   data-action="naturePreset" data-side="atk" data-nature="hardy"   title="보정 없음">무보정</button>
          ` : `
            <button class="ev-preset-btn nature-btn ${side.nature === 'impish' ? 'active' : ''}"  data-action="naturePreset" data-side="def" data-nature="impish"  title="방어↑ 특공↓">장난꾸러기</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'bold' ? 'active' : ''}"    data-action="naturePreset" data-side="def" data-nature="bold"    title="방어↑ 공격↓">대담</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'careful' ? 'active' : ''}" data-action="naturePreset" data-side="def" data-nature="careful" title="특방↑ 특공↓">신중</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'calm' ? 'active' : ''}"    data-action="naturePreset" data-side="def" data-nature="calm"    title="특방↑ 공격↓">차분</button>
            <button class="ev-preset-btn nature-btn ${side.nature === 'hardy' ? 'active' : ''}"   data-action="naturePreset" data-side="def" data-nature="hardy"   title="보정 없음">무보정</button>
          `}
        </div>
      </div>
    </div>

    ${sideKey === 'atk' ? `
    <div class="section-divider"></div>

    <!-- 기술 -->
    <div class="field">
      <div class="field-label">
        <span>기술 배치</span>
        <span class="hint">HP 조건은 현재 HP에서 자동 파생</span>
      </div>
      <div class="moves-list">
        ${[0,1,2,3].map(i => {
          const moveId = side.moves[i];
          const move = moveId ? MoveById[moveId] : null;
          const slotBp = move ? manualBpForSlot(side, i, move) : '';
          const manualBp = normalizeManualBp(side.moveBpOverrides?.[i]);
          const moveForCalc = move ? moveWithManualBp(move, manualBp) : null;
          const power = moveForCalc ? estimateMovePower(side, moveForCalc) : null;
          return `
            <div class="move-slot" data-move-slot="${i}">
              <span class="move-slot-num">${i+1}</span>
              <div class="move-select combobox" data-cb="${sideKey}-move-${i}">
                <input type="text" class="cb-input" value="${move ? escapeHTML(mvName(move)) : ''}" data-cb-type="move" data-side="atk" data-field="moves.${i}" placeholder="기술 검색..." autocomplete="off" aria-label="기술 ${i+1} 선택" aria-expanded="false">
                <div class="combobox-options" role="listbox"></div>
              </div>
              <label class="move-bp-control" title="계산용 위력">
                <span>위력</span>
                <input type="number" class="move-bp-input" data-action="moveBp" data-side="atk" data-slot="${i}" value="${move ? slotBp : ''}" min="0" max="999" ${move ? '' : 'disabled'}>
              </label>
              ${move ? `<span class="move-stat-info">${power.bp || '—'}<span class="move-stat-sep">/</span><b>${typeof power.eff === 'number' ? power.eff.toLocaleString() : power.eff}</b></span>` : '<span class="move-stat-info empty">—</span>'}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    ${renderBattleConditions('atk')}
    ` : ''}

    ${sideKey === 'def' ? `
    <div class="section-divider"></div>

    <!-- 내구력 -->
    <div class="field">
      <div class="field-label"><span>내구력</span><span class="hint">HP × 방어/특방</span></div>
      <div class="durability-grid">
        ${(() => {
          const dStats = calcStats(side);
          const physBulk = Math.round(dStats.hp * dStats.def / 0.411);
          const specBulk = Math.round(dStats.hp * dStats.spd / 0.411);
          return `
            <div class="durability-card phys">
              <div class="durability-label">물리 내구</div>
              <div class="durability-value">${physBulk.toLocaleString()}</div>
              <div class="durability-sub">HP ${dStats.hp} × 방어 ${dStats.def}</div>
            </div>
            <div class="durability-card spec">
              <div class="durability-label">특수 내구</div>
              <div class="durability-value">${specBulk.toLocaleString()}</div>
              <div class="durability-sub">HP ${dStats.hp} × 특방 ${dStats.spd}</div>
            </div>
          `;
        })()}
      </div>
    </div>
    ` : ''}
  `;
  
  wireSide(sideKey);
}

/* ════════════════════════════════════════════════════════════
   이벤트 바인딩
   ════════════════════════════════════════════════════════════ */
function wireSide(sideKey) {
  const container = document.getElementById(`${sideKey}-body`);
  
  // Combobox 입력
  container.querySelectorAll('.cb-input').forEach(input => {
    const side = input.dataset.side;
    const field = input.dataset.field || '';
    wireCalcCombobox(input, {
      onSelect(id) {
        let resetAutoFields = false;

        if (field === 'pokemonIdx') {
          resetAutoFields = applyPokemonToCalcSide(side, id).resetAutoFields;
        } else if (field === 'ability') {
          state[side].ability = id || '';
          state[side].damageBlockActive = false;
        } else if (field === 'item') {
          state[side].item = id || '';
        } else if (field === 'types.0') {
          setSideType(side, 0, id);
        } else if (field === 'types.1') {
          setSideType(side, 1, id);
        } else if (field === 'nature') {
          state[side].nature = id || 'hardy';
        } else if (field === 'status') {
          state[side].status = id || 'none';
        } else if (field.startsWith('moves.')) {
          const idx = parseInt(field.split('.')[1], 10);
          state.atk.moves[idx] = id || '';
          state.atk.moveBpOverrides[idx] = null;
        }

        renderSide(side);
        if (resetAutoFields) syncFieldControls();
        triggerCalc();
      },
    });
  });
  
  // 일반 input/select
  container.querySelectorAll('[data-action]').forEach(el => {
    const action = el.dataset.action;
    if (action === 'moveBp') {
      el.addEventListener('input', () => applyMoveBpInput(el));
      el.addEventListener('change', () => applyMoveBpInput(el, true));
      return;
    }
    const evt = el.tagName === 'BUTTON' ? 'click' : 'change';
    el.addEventListener(evt, () => {
      const side = state[el.dataset.side];
      if (action === 'hpPct') {
        setSideHpPct(side, el.value);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'conditionFlag') {
        side[el.dataset.field] = el.checked;
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'damageBlockToggle') {
        side.damageBlockActive = !side.damageBlockActive;
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'conditionMode') {
        side[el.dataset.field] = el.value;
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'typeReset') {
        resetSideTypes(el.dataset.side);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'fallenAllies') {
        side.fallenAllies = clampFallenAllies(el.value);
        renderSide('atk');
        triggerCalc();
        return;
      }
      else if (action === 'teraToggle') { side.tera = !side.tera; renderSide(el.dataset.side); return; }
      else if (action === 'teraType') side.teraType = el.value;
      else if (action === 'ev') {
        const stat = el.dataset.stat;
        const requested = Math.max(0, Math.min(32, parseInt(el.value) || 0));
        // 다른 스탯 합계
        const otherTotal = STATS.reduce((sum, s) => sum + (s === stat ? 0 : (side.evs[s] || 0)), 0);
        const remaining = Math.max(0, 66 - otherTotal);
        // 요청값과 잔여 한도 중 작은 값으로 클램프
        const finalVal = Math.min(requested, remaining);
        side.evs[stat] = finalVal;
        // 사용자가 입력한 값과 실제 적용된 값이 다르면 input.value도 업데이트
        if (finalVal !== requested) {
          el.value = finalVal;
        }
      }
      else if (action === 'evQuick') {
        const stat = el.dataset.stat;
        const requested = parseInt(el.dataset.val);
        const otherTotal = STATS.reduce((sum, s) => sum + (s === stat ? 0 : (side.evs[s] || 0)), 0);
        const remaining = Math.max(0, 66 - otherTotal);
        side.evs[stat] = Math.min(requested, remaining);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'rank') {
        const dir = parseInt(el.dataset.dir);
        const curr = side.ranks[el.dataset.stat] || 0;
        side.ranks[el.dataset.stat] = Math.max(-6, Math.min(6, curr + dir));
        // 재렌더링해서 표시 업데이트
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'evPreset') {
        applyEvPreset(el.dataset.side, el.dataset.preset);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'naturePreset') {
        side.nature = el.dataset.nature;
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'evReset') {
        side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      // 실수치 표시 갱신
      if (action === 'ev' || action === 'nature') {
        renderSide(el.dataset.side);
      }
      triggerCalc();
    });
  });
}

/* ════════════════════════════════════════════════════════════
   EV 프리셋 적용 (EV만 변경, 성격은 건드리지 않음)
   ════════════════════════════════════════════════════════════ */
function applyEvPreset(sideKey, preset) {
  const side = state[sideKey];
  const p = PokemonById[side.pokemonIdx];
  if (!p) return;

  // 모든 EV 0으로 리셋
  side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  // 프리셋별 두 스탯에 32 투자 (성격은 사용자가 별도로 선택)
  const presetMap = {
    AS: ['atk', 'spe'],
    CS: ['spa', 'spe'],
    HA: ['hp', 'atk'],
    HC: ['hp', 'spa'],
    HB: ['hp', 'def'],
    HD: ['hp', 'spd'],
  };
  const stats = presetMap[preset];
  if (!stats) return;
  stats.forEach(s => { side.evs[s] = 32; });
}

/* ════════════════════════════════════════════════════════════
   자동 진입 효과 적용
   - 원본 state는 유지하고 계산용 복사본에만 자동 효과를 적용
   - 자동으로 켜진 필드는 사용자가 수동 변경하면 다음 포켓몬 변경 전까지 덮어쓰지 않음
   ════════════════════════════════════════════════════════════ */

let lastAutoEntry = emptyEntryMeta();

const manualAutoFieldOverrides = {
  weather: null,
  terrain: null,
  ruinSword: null,
  ruinTablet: null,
  ruinBeads: null,
  ruinVessel: null,
};

function defaultAutoFieldValue(fieldKey) {
  return fieldKey === 'weather' || fieldKey === 'terrain' ? 'none' : false;
}

function emptyEntryMeta() {
  return {
    logs: [],
    fields: {},
    rankDeltas: { atk: {}, def: {} },
    blocked: [],
  };
}

function cloneSideForCalc(side) {
  return applyManualDamageBlockHpAdjustment(deriveHpFlags({
    ...side,
    evs: { ...side.evs },
    ranks: { ...side.ranks },
    types: Array.isArray(side.types) ? [...side.types] : [],
    moves: Array.isArray(side.moves) ? [...side.moves] : [],
    moveBpOverrides: Array.isArray(side.moveBpOverrides) ? [...side.moveBpOverrides] : [null, null, null, null],
  }));
}

function cloneFieldForCalc(field) {
  return { ...field };
}

function clampRank(value) {
  return Math.max(-6, Math.min(6, value));
}

function addRankDelta(meta, sideKey, stat, delta) {
  if (!delta) return;
  meta.rankDeltas[sideKey][stat] = (meta.rankDeltas[sideKey][stat] || 0) + delta;
}

function applyRankDelta(side, meta, sideKey, stat, delta) {
  const before = side.ranks[stat] || 0;
  const after = clampRank(before + delta);
  side.ranks[stat] = after;
  addRankDelta(meta, sideKey, stat, after - before);
  return after - before;
}

function sideEntryLabel(sideKey) {
  return sideKey === 'atk' ? '공격측' : '방어측';
}

function applyAutoField(calcState, meta, fieldKey, value, sideKey, label) {
  if (manualAutoFieldOverrides[fieldKey]) return false;
  if (calcState.field[fieldKey] === value) return false;
  calcState.field[fieldKey] = value;
  meta.fields[fieldKey] = { sideKey, value, label };
  meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${label}`);
  return true;
}

function applyEntryEffectsToCalcState(calcState) {
  const meta = emptyEntryMeta();
  if (!autoEntryEffects) return meta;

  for (const sideKey of ['atk', 'def']) {
    const side = calcState[sideKey];
    const otherKey = sideKey === 'atk' ? 'def' : 'atk';
    const other = calcState[otherKey];
    const effect = ENTRY_EFFECTS[side.ability];
    if (!effect) continue;

    if (effect.weather) applyAutoField(calcState, meta, 'weather', effect.weather, sideKey, effect.label);
    if (effect.terrain) applyAutoField(calcState, meta, 'terrain', effect.terrain, sideKey, effect.label);

    if (effect.selfBoost) {
      let changed = false;
      for (const [stat, n] of Object.entries(effect.selfBoost)) {
        changed = applyRankDelta(side, meta, sideKey, stat, n) !== 0 || changed;
      }
      if (changed) meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${effect.label}`);
    }

    if (effect.opponentBoost) {
      const otherAb = other.ability;
      if (effect.blockable && INTIMIDATE_BLOCKERS.includes(otherAb)) {
        const log = `${sideEntryLabel(sideKey)} 위협 무효 (${AbilityById[otherAb]?.koName || otherAb})`;
        meta.blocked.push(log);
        meta.logs.push(log);
      } else {
        let changed = false;
        for (const [stat, n] of Object.entries(effect.opponentBoost)) {
          changed = applyRankDelta(other, meta, otherKey, stat, n) !== 0 || changed;
        }
        if (changed) meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${effect.label}`);
      }
    }

    if (effect.download) {
      const otherStats = calcStats(other);
      const stat = otherStats.def < otherStats.spd ? 'atk' : 'spa';
      if (applyRankDelta(side, meta, sideKey, stat, 1) !== 0) {
        meta.logs.push(`${sideEntryLabel(sideKey)} 다운로드: 자기 ${STAT_LABEL[stat]} +1`);
      }
    }

    if (effect.ruin) {
      const RUIN_MAP = { spd: 'ruinBeads', atk: 'ruinTablet', def: 'ruinSword', spa: 'ruinVessel' };
      const fieldKey = RUIN_MAP[effect.ruin];
      if (fieldKey && !manualAutoFieldOverrides[fieldKey] && !calcState.field[fieldKey]) {
        calcState.field[fieldKey] = true;
        meta.fields[fieldKey] = { sideKey, value: true, label: effect.label };
        meta.logs.push(`${sideEntryLabel(sideKey)} 진입: ${effect.label}`);
      }
    }
  }

  return meta;
}

function makeCalcState() {
  const calcState = {
    atk: cloneSideForCalc(state.atk),
    def: cloneSideForCalc(state.def),
    field: cloneFieldForCalc(state.field),
  };
  calcState.atk.fallenAllies = clampFallenAllies(calcState.atk.fallenAllies, calcState.field.gameType);
  calcState.entryMeta = applyEntryEffectsToCalcState(calcState);
  return calcState;
}

function activeAutoFieldBase(fieldKey) {
  const prev = state.field[fieldKey] ?? defaultAutoFieldValue(fieldKey);
  if (lastAutoEntry.fields?.[fieldKey]) return { active: true, prev };
  return { active: false, prev };
}

function markManualAutoFieldOverride(fieldKey) {
  if (!(fieldKey in manualAutoFieldOverrides) || manualAutoFieldOverrides[fieldKey]) return;
  const auto = activeAutoFieldBase(fieldKey);
  if (auto.active) manualAutoFieldOverrides[fieldKey] = { prev: auto.prev };
}

function resetManualAutoFieldOverrides() {
  let changed = false;
  for (const fieldKey of Object.keys(manualAutoFieldOverrides)) {
    const override = manualAutoFieldOverrides[fieldKey];
    if (!override) continue;
    const nextValue = override.prev ?? defaultAutoFieldValue(fieldKey);
    if (state.field[fieldKey] !== nextValue) {
      state.field[fieldKey] = nextValue;
      changed = true;
    }
    manualAutoFieldOverrides[fieldKey] = null;
  }
  return changed;
}

function syncFieldControls(fieldState = null) {
  const f = fieldState || makeCalcState().field;
  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  };
  setComboboxValue('weather', f.weather, 'weather');
  setComboboxValue('terrain', f.terrain, 'terrain');
  setComboboxValue('gameType', f.gameType || state.field.gameType, 'gameType');
  setChecked('critHit', f.isCritical);
  setChecked('defReflect', f.defReflect);
  setChecked('defLightScreen', f.defLightScreen);
  setChecked('atkHelpingHand', f.atkHelpingHand);
  setChecked('defProtect', f.defProtect);
  setChecked('defStealthRock', f.defStealthRock);
  setChecked('defSpikes', f.defSpikesLayers > 0);
  setComboboxValue('defSpikesLayers', String(Math.max(1, f.defSpikesLayers || 1)), 'spikesLayers');
  setChecked('trickRoom', f.isTrickRoom);
  setChecked('gravity', f.isGravity);
  if (typeof updateFieldSummary === 'function') updateFieldSummary(f, lastAutoEntry);
  if (typeof updateRuinCheckboxes === 'function') updateRuinCheckboxes(f);
}

function applyEntryEffects() {
  const calcState = makeCalcState();
  lastAutoEntry = calcState.entryMeta;
  return lastAutoEntry.logs;
}

function formatRankValue(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function renderEntryRankSummary(calcState) {
  const meta = calcState.entryMeta;
  const rows = [];
  for (const sideKey of ['atk', 'def']) {
    for (const stat of ['atk', 'def', 'spa', 'spd', 'spe']) {
      const delta = meta.rankDeltas?.[sideKey]?.[stat] || 0;
      if (!delta) continue;
      const base = state[sideKey].ranks[stat] || 0;
      const final = calcState[sideKey].ranks[stat] || 0;
      rows.push(`
        <div class="entry-rank-item ${sideKey}">
          <span>${sideEntryLabel(sideKey)} ${STAT_LABEL[stat]}</span>
          <b>${formatRankValue(base)}</b>
          <em>${formatRankValue(delta)}</em>
          <strong>${formatRankValue(final)}</strong>
        </div>
      `);
    }
  }
  if (!rows.length) return '';
  return `
    <div class="entry-rank-summary">
      <div class="entry-rank-label">계산 적용 랭크</div>
      <div class="entry-rank-list">${rows.join('')}</div>
    </div>
  `;
}


/* ════════════════════════════════════════════════════════════
   결과 렌더링
   ════════════════════════════════════════════════════════════ */
function runCalc() {
  const calcState = makeCalcState();
  lastAutoEntry = calcState.entryMeta;
  const entryLog = lastAutoEntry.logs;
  const calcAtk = calcState.atk;
  const calcDef = calcState.def;
  const calcField = calcState.field;
  syncFieldControls(calcField);

  const atkP = PokemonById[state.atk.pokemonIdx];
  const defP = PokemonById[state.def.pokemonIdx];
  if (!atkP || !defP) return;
  
  const atkSpe = effectiveSpeed(calcAtk, calcField);
  const defSpe = effectiveSpeed(calcDef, calcField);

  // 가변 위력 기술이 참조하는 행동 순서 플래그를 필드에 복사 (priority 0 기준)
  // 우선도가 다른 기술은 기술별로 calculateDamage 가 firstMover 결과로 보정해야 정확하지만
  // 대부분의 가변 위력 기술 (boltbeak, fishiousrend, payback) 은 priority 0 이므로 단순화.
  calcField.atkMovesFirst = atkSpe > defSpe;
  calcField.atkMovesSecond = atkSpe < defSpe;

  // 각 기술 계산
  const moveResults = state.atk.moves.map((mvId, i) => {
    if (!mvId) return { empty: true, slot: i+1 };
    const baseMove = MoveById[mvId];
    const move = baseMove ? moveWithManualBp(baseMove, calcAtk.moveBpOverrides?.[i]) : null;
    if (!move) return { empty: true, slot: i+1 };
    if (move.cat === 'Status') {
      return { empty: true, slot: i+1, move, statusMove: true };
    }
    const result = calculateDamage(calcAtk, calcDef, move, calcField);
    if (!result) return { empty: true, slot: i+1, move };
    const hko = hkoLabel(result.damages, result.defHP, calcDef, calcField);
    const defStartHp = Math.max(1, sideCurrentHp(result.defHP, calcDef) - calcHazardDamage(calcDef, calcField));
    const first = firstMover(move.pri, atkSpe, defSpe, calcField);
    return { ...result, hko, first, slot: i+1, move, defStartHp };
  });
  
  // 틀깨기 / 다능 등 공격측 특성으로 무시되는 방어측 특성 체크
  const atkAb = calcAtk.ability;
  const defAb = calcDef.ability;
  const moldBreakerActive = !!AbilityById[atkAb]?.ignoresTargetAbility;
  const ignoredAb = moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(defAb)
    ? AbilityById[defAb] : null;

  // 재앙 효과 정보
  const ruinActive = [];
  if (calcField.ruinSword)  ruinActive.push('검의재앙(방어 ×0.75)');
  if (calcField.ruinTablet) ruinActive.push('목간의재앙(공격 ×0.75)');
  if (calcField.ruinBeads)  ruinActive.push('구슬의재앙(특방 ×0.75)');
  if (calcField.ruinVessel) ruinActive.push('그릇의재앙(특공 ×0.75)');

  const body = document.getElementById('results-body');
  body.innerHTML = `
    ${entryLog.length > 0 ? `
    <div class="entry-effects">
      <div class="entry-effects-label">📋 진입 효과 자동 적용</div>
      ${entryLog.map(e => `<div class="entry-effect-item">${e}</div>`).join('')}
    </div>
    ` : ''}

    ${renderEntryRankSummary(calcState)}

    ${moldBreakerActive ? `
    <div class="mold-breaker-info">
      <span class="mold-breaker-tag">${AbilityById[atkAb]?.koName || atkAb}</span>
      ${ignoredAb ? `상대 <b>${ignoredAb.koName}</b> 특성을 무시합니다` : '방어측 일부 특성을 관통할 수 있습니다'}
    </div>
    ` : ''}

    ${ruinActive.length > 0 ? `
    <div class="ruin-info">
      <span class="ruin-tag">⚔️ 재앙 활성</span>
      ${ruinActive.join(' · ')}
    </div>
    ` : ''}

    <!-- 속도 대결 -->
    <div class="speed-row">
      <div class="speed-side atk">
        <div class="speed-name-card">
          <span>공격측</span>
          <b>${pkName(atkP)}</b>
        </div>
        <div class="speed-value">
          <span>속도</span>
          <b>${atkSpe}</b>
        </div>
      </div>
      <div class="speed-vs">VS</div>
      <div class="speed-side def">
        <div class="speed-value">
          <span>속도</span>
          <b>${defSpe}</b>
        </div>
        <div class="speed-name-card">
          <span>방어측</span>
          <b>${pkName(defP)}</b>
        </div>
      </div>
      <div class="speed-verdict">
        ${atkSpe > defSpe ? `공격측이 <b>${atkSpe - defSpe}</b> 더 빠름 ${calcField.isTrickRoom ? '→ 트릭룸: 방어측 선공' : '→ 동우선도시 공격측 선공'}` :
          atkSpe < defSpe ? `방어측이 <b>${defSpe - atkSpe}</b> 더 빠름 ${calcField.isTrickRoom ? '→ 트릭룸: 공격측 선공' : '→ 동우선도시 방어측 선공'}` :
          `속도 동일 (스피드 타이 50%)`}
      </div>
    </div>
    
    <!-- 기술별 결과 -->
    <div class="move-results">
      ${moveResults.map(r => renderMoveCard(r)).join('')}
    </div>
  `;
}

function renderModsTrace(mods, limit = 6) {
  const labels = [...new Set((mods || []).filter(Boolean).map(m => m.toString()))];
  if (!labels.length) return '';
  const visible = labels.slice(0, limit);
  const hidden = labels.length - visible.length;
  const title = escapeHTML(labels.join(' · '));
  const parts = visible.map(m => `<b>${escapeHTML(m)}</b>`);
  if (hidden > 0) parts.push(`<b title="${title}">+${hidden}</b>`);
  return `<span class="mods-trace" title="${title}">${parts.join('<span class="sep">·</span>')}</span>`;
}

function renderMoveCard(r) {
  if (r.empty) {
    if (r.statusMove) {
      return `
        <div class="move-card none compact">
          <div class="move-card-placeholder">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name">${mvName(r.move)} (변화기)</span>
            <span class="move-meta"><span class="cat-stat">STAT</span>${r.move.desc ? ` · ${r.move.desc}` : ''}</span>
          </div>
        </div>
      `;
    }
    return `
      <div class="move-card none compact">
        <div class="move-card-placeholder">
          <span class="move-slot-num mono">${r.slot}</span>
          <span class="move-name">기술 미설정</span>
        </div>
      </div>
    `;
  }
  
  const pctMin = r.minPct.toFixed(1);
  const pctMax = r.maxPct.toFixed(1);
  const barMax = Math.min(100, r.maxPct);
  const barMin = Math.min(100, r.minPct);
  
  const eff = r.effectiveness;
  const effCls = eff === 0 ? 'eff-0' : eff === 0.25 ? 'eff-0-25' : eff === 0.5 ? 'eff-0-5' :
                 eff === 2 ? 'eff-2' : eff === 4 ? 'eff-4' : 'eff-1';
  const effText = eff === 0 ? '효과없음' : eff === 0.25 ? '1/4배' : eff === 0.5 ? '1/2배' :
                  eff === 2 ? '2배' : eff === 4 ? '4배' : '1배';
  
  const cat = r.category === 'Physical' ? '물리' : '특수';
  const catCls = r.category === 'Physical' ? 'cat-phys' : 'cat-spec';
  
  const min = r.damages[0];
  const max = r.damages[15];
  const startHp = r.defStartHp || r.defHP;
  const hpRemMin = Math.max(0, startHp - max);
  const hpRemMax = Math.max(0, startHp - min);
  
  const moveData = r.move;
  const typeChange = r.moveType !== moveData.type;
  // 타입 셀은 단일 컬럼: 변환 시 작은 원본 표시는 type-pill 안에 흡수
  const typeLabel = `<span class="type-pill t-${r.moveType}" ${typeChange ? `title="원래: ${TYPE_KO[moveData.type]}"` : ''}>${TYPE_KO[r.moveType] || r.moveType}${typeChange ? '*' : ''}</span>`;
  
  // 반동/회복 계산
  let sideEffect = '';
  if (moveData.recoil) {
    const [num, den] = moveData.recoil;
    const atkHP = calcStats(state.atk).hp;
    const recoilMin = Math.floor(min * num / den);
    const recoilMax = Math.floor(max * num / den);
    const recoilMinPct = (recoilMin / atkHP * 100).toFixed(1);
    const recoilMaxPct = (recoilMax / atkHP * 100).toFixed(1);
    sideEffect += `<span class="side-effect"><span>반동</span><b>${recoilMinPct}% ~ ${recoilMaxPct}%</b><span>(${recoilMin}~${recoilMax})</span></span>`;
  }
  if (moveData.drain) {
    const [num, den] = moveData.drain;
    const atkHP = calcStats(state.atk).hp;
    const healMin = Math.floor(min * num / den);
    const healMax = Math.floor(max * num / den);
    const healMinPct = (healMin / atkHP * 100).toFixed(1);
    const healMaxPct = (healMax / atkHP * 100).toFixed(1);
    sideEffect += `<span class="side-effect"><span>흡수</span><b>${healMinPct}% ~ ${healMaxPct}%</b><span>(${healMin}~${healMax})</span></span>`;
  }

  // 다단 히트 표시
  let multihitLabel = '';
  if (moveData.mh) {
    if (Array.isArray(moveData.mh)) {
      multihitLabel = `<span style="color:var(--warn)">· ${moveData.mh[0]}~${moveData.mh[1]}타</span>`;
    } else {
      multihitLabel = `<span style="color:var(--warn)">· ${moveData.mh}타 고정</span>`;
    }
  }
  // 부자유친 표시
  if (r.mods?.some(m => m.includes('부자유친'))) {
    multihitLabel = `<span style="color:var(--warn)">· 1타 + 0.25타</span>`;
  }
  const stabBadge = r.stab ? '<span class="stab-mark">자속</span>' : '';
  const metaHtml = multihitLabel ? `<span class="move-meta">${multihitLabel}</span>` : '';
  const hkoTone = r.hko.cls === 'no' ? 'no' :
                  r.hko.label === '난수' ? 'chance' :
                  r.hko.turns === '1타' ? 'ko-strong' : 'ko-stable';
  
  return `
    <div class="move-card">
      <div class="move-card-main">
        <div class="move-card-top">
          <div class="move-title-row">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name">${mvName(moveData)}</span>
          </div>
          <div class="move-badges">
            ${typeLabel}
            <span class="cat-badge ${catCls}">${cat}</span>
            ${stabBadge}
            <span class="eff-badge ${effCls}">${effText}</span>
            ${metaHtml}
          </div>
        </div>
        <div class="dmg-summary">
          <span class="dmg-pct">${pctMin} ~ ${pctMax}%</span>
          <span class="hp-remain">잔여 HP ${hpRemMin}-${hpRemMax} / ${r.defHP}</span>
        </div>
        <div class="dmg-bar">
          <div class="dmg-bar-fill" style="width: ${barMax}%"></div>
          <div class="dmg-bar-fill min" style="width: ${barMin}%"></div>
        </div>
        <div class="dmg-info">
          <span>실제 대미지 <b>${min}–${max}</b></span>
          ${renderModsTrace(r.mods)}
          ${sideEffect}
        </div>
      </div>
      <div class="hko-badge ${hkoTone}">
        <div class="hko-main ${r.hko.cls}">
          <span class="hko-label">${r.hko.label}</span>
          <span class="hko-turns">${r.hko.turns}</span>
          <span class="hko-pct">${r.hko.pct || ''}</span>
        </div>
        ${r.hko.sub ? `<div class="hko-sub">${r.hko.sub}</div>` : ''}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   자동/수동 계산 모드
   ════════════════════════════════════════════════════════════ */
let autoCalcMode = true;

function triggerCalc() {
  if (autoCalcMode) {
    runCalc();
  } else {
    const calcState = makeCalcState();
    lastAutoEntry = calcState.entryMeta;
    syncFieldControls(calcState.field);
  }
}

function updateFieldSummary(fieldState = null, entryMeta = null) {
  const f = fieldState || state.field;
  const meta = entryMeta || lastAutoEntry;
  const parts = [];
  const sourceMark = fieldKey => {
    if (manualAutoFieldOverrides[fieldKey]) return '<span class="field-source-mark manual">수동</span>';
    if (meta?.fields?.[fieldKey]) return '<span class="field-source-mark auto">자동</span>';
    return '';
  };

  if (f.weather && f.weather !== 'none') {
    const wMap = { Sun: '쾌청', Rain: '비', Sand: '모래바람', Snow: '눈', 'Harsh Sunshine': '대쾌청', 'Heavy Rain': '강한비' };
    parts.push(`<b>${wMap[f.weather] || f.weather}</b>${sourceMark('weather')}`);
  } else if (manualAutoFieldOverrides.weather) {
    parts.push(`<b>날씨 없음</b>${sourceMark('weather')}`);
  }
  if (f.terrain && f.terrain !== 'none') {
    const tMap = { Electric: '일렉트릭', Grassy: '그래스', Psychic: '사이코', Misty: '미스트' };
    parts.push(`<b>${tMap[f.terrain] || f.terrain}필드</b>${sourceMark('terrain')}`);
  } else if (manualAutoFieldOverrides.terrain) {
    parts.push(`<b>필드 없음</b>${sourceMark('terrain')}`);
  }
  if (f.gameType === 'Doubles') parts.push('더블');
  if (f.isCritical) parts.push('급소');
  if (f.defReflect) parts.push('리플렉터');
  if (f.defLightScreen) parts.push('빛의장막');
  if (f.atkHelpingHand) parts.push('도우미');
  if (f.defProtect) parts.push('방어');
  const ruins = [];
  if (f.ruinSword) ruins.push(`검${sourceMark('ruinSword')}`);
  if (f.ruinTablet) ruins.push(`목간${sourceMark('ruinTablet')}`);
  if (f.ruinBeads) ruins.push(`구슬${sourceMark('ruinBeads')}`);
  if (f.ruinVessel) ruins.push(`그릇${sourceMark('ruinVessel')}`);
  if (ruins.length) parts.push(`<span style="color:var(--tera)">⚔️${ruins.join('/')}</span>`);
  document.getElementById('field-summary').innerHTML =
    parts.length ? parts.join(' · ') : '기본값';
}

// 접이식 패널
document.getElementById('field-head').addEventListener('click', () => {
  document.getElementById('field-panel').classList.toggle('collapsed');
});

// 계산 버튼
document.getElementById('btnCalculate').addEventListener('click', () => {
  runCalc();
});

// 자동/수동 토글
document.getElementById('btnAutoCalc').addEventListener('click', e => {
  autoCalcMode = !autoCalcMode;
  e.target.textContent = `자동 계산: ${autoCalcMode ? 'ON' : 'OFF'}`;
  e.target.classList.toggle('active', autoCalcMode);
  if (autoCalcMode) runCalc();
});
// 초기 활성 표시
document.getElementById('btnAutoCalc').classList.add('active');
document.getElementById('btnResetManual').addEventListener('click', resetCalcManualValues);

/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
function wireFieldComboboxes() {
  if (typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll('#field-panel .cb-input').forEach(input => {
    const cbType = input.dataset.cbType;
    const field = input.dataset.field;
    wireCalcCombobox(input, {
      filterFn: makeCombobox(null, cbType),
      onSelect(id) {
        if (field === 'weather') {
          markManualAutoFieldOverride('weather');
          state.field.weather = id || 'none';
          setComboboxValue('weather', state.field.weather, 'weather');
        } else if (field === 'terrain') {
          markManualAutoFieldOverride('terrain');
          state.field.terrain = id || 'none';
          setComboboxValue('terrain', state.field.terrain, 'terrain');
        } else if (field === 'gameType') {
          state.field.gameType = id || 'Singles';
          setComboboxValue('gameType', state.field.gameType, 'gameType');
          state.atk.fallenAllies = clampFallenAllies(state.atk.fallenAllies);
          renderSide('atk');
        } else if (field === 'defSpikesLayers') {
          const layers = Math.max(1, Math.min(3, parseInt(id, 10) || 1));
          setComboboxValue('defSpikesLayers', String(layers), 'spikesLayers');
          if (document.getElementById('defSpikes')?.checked) {
            state.field.defSpikesLayers = layers;
          }
        }
        triggerCalc();
      },
    });
  });
}

wireFieldComboboxes();
document.getElementById('critHit').addEventListener('change', e => { state.field.isCritical = e.target.checked; triggerCalc(); });
document.getElementById('defReflect').addEventListener('change', e => { state.field.defReflect = e.target.checked; triggerCalc(); });
document.getElementById('defLightScreen').addEventListener('change', e => { state.field.defLightScreen = e.target.checked; triggerCalc(); });
document.getElementById('atkHelpingHand').addEventListener('change', e => { state.field.atkHelpingHand = e.target.checked; triggerCalc(); });
document.getElementById('defProtect').addEventListener('change', e => { state.field.defProtect = e.target.checked; triggerCalc(); });
// 재앙 토글
document.getElementById('ruinSword').addEventListener('change', e => { markManualAutoFieldOverride('ruinSword'); state.field.ruinSword = e.target.checked; triggerCalc(); });
document.getElementById('ruinTablet').addEventListener('change', e => { markManualAutoFieldOverride('ruinTablet'); state.field.ruinTablet = e.target.checked; triggerCalc(); });
document.getElementById('ruinBeads').addEventListener('change', e => { markManualAutoFieldOverride('ruinBeads'); state.field.ruinBeads = e.target.checked; triggerCalc(); });
document.getElementById('ruinVessel').addEventListener('change', e => { markManualAutoFieldOverride('ruinVessel'); state.field.ruinVessel = e.target.checked; triggerCalc(); });
// 진입 위험 (스텔스록 / 압정뿌리기)
document.getElementById('defStealthRock').addEventListener('change', e => { state.field.defStealthRock = e.target.checked; triggerCalc(); });
document.getElementById('defSpikes').addEventListener('change', e => {
  const layerInput = document.getElementById('defSpikesLayers');
  const layers = parseInt(layerInput?.dataset.value || layerInput?.value, 10) || 1;
  state.field.defSpikesLayers = e.target.checked ? layers : 0;
  triggerCalc();
});
// 트릭룸 / 중력장
document.getElementById('trickRoom').addEventListener('change', e => { state.field.isTrickRoom = e.target.checked; triggerCalc(); });
document.getElementById('gravity').addEventListener('change', e => { state.field.isGravity = e.target.checked; triggerCalc(); });
// 자동 진입 효과 토글
document.getElementById('autoEntry').addEventListener('change', e => {
  autoEntryEffects = e.target.checked;
  lastAutoEntry = emptyEntryMeta();
  triggerCalc();
});

// 재앙 체크박스 동기화 (자동 진입 효과로 변경됐을 때)
function updateRuinCheckboxes(fieldState = null) {
  const f = fieldState || state.field;
  document.getElementById('ruinSword').checked = f.ruinSword;
  document.getElementById('ruinTablet').checked = f.ruinTablet;
  document.getElementById('ruinBeads').checked = f.ruinBeads;
  document.getElementById('ruinVessel').checked = f.ruinVessel;
}
document.getElementById('championsMode').addEventListener('change', e => {
  championsMode = e.target.checked;
  renderSide('atk');
  renderSide('def');
  triggerCalc();
});

// 공격측 ↔ 방어측 교대 (사이드 객체 전체를 통째로 교환)
// 사이드 패널 점프 버튼 위임 — 04-views.js 의 loadSideToFineTune / loadSideToRevCalc 호출
document.addEventListener('click', e => {
  const ftBtn = e.target.closest('.ft-jump-btn[data-ft-from-side]');
  if (ftBtn && typeof loadSideToFineTune === 'function') {
    loadSideToFineTune(ftBtn.dataset.ftFromSide);
    return;
  }
  const rcBtn = e.target.closest('.ft-jump-btn[data-rc-from-side]');
  if (rcBtn && typeof loadSideToRevCalc === 'function') {
    loadSideToRevCalc(rcBtn.dataset.rcFromSide);
    return;
  }
});

document.getElementById('btnSwapSides')?.addEventListener('click', () => {
  const tmp = state.atk;
  state.atk = state.def;
  state.def = tmp;
  lastAutoEntry = emptyEntryMeta();
  renderSide('atk');
  renderSide('def');
  triggerCalc();
});
/* ════════════════════════════════════════════════════════════
   ⬆️ 원본 로직 끝 ⬆️
   ════════════════════════════════════════════════════════════ */
