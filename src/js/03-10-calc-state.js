/* Damage calculator state, options, and shared helpers. */
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

// 자동 진입 효과 ON/OFF
let autoEntryEffects = true;

/* ════════════════════════════════════════════════════════════
   특성별 진입 효과 정의는 data/overrides/entry-effects.json 에서 빌드된다.
   ════════════════════════════════════════════════════════════ */
