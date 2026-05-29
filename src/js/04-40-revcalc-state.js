/* Reverse calculator state, field, move picker, item, ability, and speed helpers. */
function rcDefaultField() {
  return {
    weather: 'none', terrain: 'none', isCritical: false,
    defReflect: false, defLightScreen: false, gameType: 'Singles',
    isGravity: false,
    ruinSword: false, ruinTablet: false, ruinBeads: false, ruinVessel: false,
    defStealthRock: false, defSpikesLayers: 0,
    atkHelpingHand: false,
  };
}

const revCalcState = {
  my: makeSideState(),
  opp: {
    pokemonIdx: '',
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: 'none',
  },
  myMove: '',
  myMoveSet: ['', '', '', ''],
  myMoveBp: '',         // 빈 문자열 = move data의 default 사용
  observedTheirPct: '',
  oppMove: '',
  oppMoveBp: '',
  oppItemKnown: 'unknown',
  predictedOppMove: '',
  selectedResultIndex: 0,
  openResultIndexes: [],
  nextRankOpen: false,
  nextMyRanks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  nextOppRanks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  observedMyHp: '',
  turnOrder: 'unknown',
  field: rcDefaultField(),
  observedFields: {
    dealt: { defReflect: false, defLightScreen: false, isCritical: false },
    received: { defReflect: false, defLightScreen: false, isCritical: false },
  },
  // 도구 후보 — 기본은 빈 도구, 구애스카프, type-boost 도구. 사용자가 추가/제거 가능.
  itemCandidates: [],
  itemCandidatesOpen: false,
  results: null,
  analyzing: false,
};

function rcAnalysisField() {
  return {
    ...rcDefaultField(),
    weather: revCalcState.field.weather || 'none',
    terrain: revCalcState.field.terrain || 'none',
    isCritical: !!revCalcState.field.isCritical,
    defReflect: !!revCalcState.field.defReflect,
    defLightScreen: !!revCalcState.field.defLightScreen,
  };
}

function rcActiveFieldSummary(field) {
  const parts = [];
  if (field.weather && field.weather !== 'none') parts.push(`weather=${field.weather}`);
  if (field.terrain && field.terrain !== 'none') parts.push(`terrain=${field.terrain}`);
  if (field.isCritical) parts.push('critical');
  if (field.defReflect) parts.push('reflect');
  if (field.defLightScreen) parts.push('lightscreen');
  return parts.join(',') || 'none';
}

const RC_NATURE_IDS = [...new Set((Array.isArray(NATURES) && NATURES.length)
  ? NATURES.map(n => n.id).filter(Boolean)
  : Object.keys(NATURE_BY_ID || {}))];
const RC_MOVESET_SIZE = 4;
const RC_MOVE_COLLATOR = typeof Intl !== 'undefined'
  ? new Intl.Collator('ko-KR', { sensitivity: 'base', numeric: true })
  : null;

function rcSortMovesByName(moves) {
  return [...moves].sort((a, b) => {
    const byKo = RC_MOVE_COLLATOR
      ? RC_MOVE_COLLATOR.compare(mvName(a), mvName(b))
      : mvName(a).localeCompare(mvName(b));
    if (byKo) return byKo;
    return a.id.localeCompare(b.id);
  });
}

function rcMoveSearchTokens(m) {
  return [mvName(m), m.name || '', m.id || '']
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
}

function rcMoveNoneOption() {
  return { id: '', name: 'None', koName: '없음', cat: '', type: '', bp: '' };
}

function rcMoveMatchesQuery(m, query, mode = 'contains') {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) return true;
  const idQuery = toId(raw);
  return rcMoveSearchTokens(m).some(token => {
    const idToken = toId(token);
    if (mode === 'prefix') {
      return token.startsWith(raw) || (!!idQuery && idToken.startsWith(idQuery));
    }
    return token.includes(raw) || (!!idQuery && idToken.includes(idQuery));
  });
}

function rcFilterMovePool(pool, query) {
  const raw = String(query || '').trim();
  if (!raw) return pool.slice(0, 40);
  const prefixMatches = pool.filter(m => rcMoveMatchesQuery(m, raw, 'prefix'));
  const matches = prefixMatches.length ? prefixMatches : pool.filter(m => rcMoveMatchesQuery(m, raw, 'contains'));
  return matches.slice(0, 40);
}

function rcFindMoveByTypedName(raw, pool) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (toId(text) === 'none' || text === '없음') return '';
  const id = toId(text);
  const lowerText = text.toLowerCase();
  const exact = pool.find(m => {
    const tokens = rcMoveSearchTokens(m);
    return tokens.includes(lowerText) || (!!id && (m.id === id || toId(m.name) === id || toId(mvName(m)) === id));
  });
  if (exact) return exact.id;
  return undefined;
}

function rcBestMoveForTypedName(raw, pool) {
  const exact = rcFindMoveByTypedName(raw, pool);
  if (exact !== undefined) return exact;
  const matches = rcFilterMovePool(pool, raw);
  return matches[0]?.id;
}

function rcMoveLabel(moveId) {
  return moveId && MoveById[moveId] ? mvName(MoveById[moveId]) : '';
}

function rcMoveSet() {
  if (!Array.isArray(revCalcState.myMoveSet)) revCalcState.myMoveSet = ['', '', '', ''];
  while (revCalcState.myMoveSet.length < RC_MOVESET_SIZE) revCalcState.myMoveSet.push('');
  if (revCalcState.myMoveSet.length > RC_MOVESET_SIZE) revCalcState.myMoveSet = revCalcState.myMoveSet.slice(0, RC_MOVESET_SIZE);
  return revCalcState.myMoveSet;
}

function rcEnsureMoveInSet(moveId) {
  if (!moveId) return;
  const moves = rcMoveSet();
  if (moves.includes(moveId)) return;
  const empty = moves.findIndex(id => !id);
  moves[empty >= 0 ? empty : 0] = moveId;
}

function rcVisibleMoveSet() {
  const moves = rcMoveSet().filter(id => MoveById[id] && MoveById[id].cat !== 'Status');
  if (revCalcState.myMove && MoveById[revCalcState.myMove]?.cat !== 'Status' && !moves.includes(revCalcState.myMove)) {
    moves.unshift(revCalcState.myMove);
  }
  return moves.slice(0, RC_MOVESET_SIZE);
}

function rcLearnableMovesForPokemon(p, includeStatus = false) {
  const pool = p?.ls?.length > 0
    ? MOVES.filter(m => p.ls.includes(m.id))
    : MOVES;
  return rcSortMovesByName(pool.filter(m => includeStatus || m.cat !== 'Status'));
}

function rcMoveOptionLabel(m) {
  if (!m?.id) return m?.koName || '없음';
  return mvName(m);
}

function rcRenderSimpleMoveOption(option, currentId) {
  const id = option?.id || '';
  const selected = String(id) === String(currentId || '');
  const optionClass = ['combobox-option', 'ui-option', 'rc-move-simple-option', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return `<div class="${optionClass}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(rcMoveOptionLabel(option))}</b></div>`;
}

function rcObservedMyMoveIds() {
  const ids = rcMoveSet().filter(id => MoveById[id]);
  return ids.filter((id, idx, arr) => arr.indexOf(id) === idx);
}

function rcNormalizeObservedMyMove() {
  const ids = rcObservedMyMoveIds();
  if (revCalcState.myMove && !ids.includes(revCalcState.myMove)) {
    revCalcState.myMove = ids.find(id => MoveById[id]?.cat !== 'Status') || ids[0] || '';
  }
}

function rcMovePoolForPicker(target) {
  const myP = PokemonById[revCalcState.my.pokemonIdx];
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (target === 'moveslot') return rcLearnableMovesForPokemon(myP, true);
  if (target === 'oppMove' || target === 'predictedOppMove') return rcLearnableMovesForPokemon(oppP, true);
  if (target === 'myMove') return rcObservedMyMoveIds().map(id => MoveById[id]).filter(Boolean);
  return MOVES;
}

function rcRenderMoveCombobox(target, value, options = {}) {
  const slotAttr = Number.isInteger(options.slot) ? ` data-rc-move-slot="${options.slot}"` : '';
  const compactClass = options.compact ? ' compact' : '';
  const placeholder = options.placeholder || '기술 선택';
  return `
    <div class="combobox rc-move-combobox tool-move-combobox${compactClass}">
      <input type="text" class="cb-input rc-move-input tool-move-input" data-rc-move-picker="${target}"${slotAttr} value="${escapeHTML(rcMoveLabel(value))}" placeholder="${escapeHTML(placeholder)}" autocomplete="off">
      <div class="combobox-options"></div>
    </div>
  `;
}

function rcSetMovePickerValue(target, id, slot = null) {
  const moveId = id && MoveById[id] ? id : '';
  if (target === 'moveslot') {
    const idx = parseInt(slot, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < RC_MOVESET_SIZE) {
      rcMoveSet()[idx] = moveId;
      if (!revCalcState.myMove && moveId && MoveById[moveId]?.cat !== 'Status') revCalcState.myMove = moveId;
      rcNormalizeObservedMyMove();
    }
    return;
  }
  if (target === 'myMove') {
    revCalcState.myMove = moveId;
    revCalcState.myMoveBp = '';
    return;
  }
  if (target === 'oppMove') {
    revCalcState.oppMove = moveId;
    revCalcState.oppMoveBp = '';
    if (!revCalcState.predictedOppMove) revCalcState.predictedOppMove = moveId;
    return;
  }
  if (target === 'predictedOppMove') {
    revCalcState.predictedOppMove = moveId;
  }
}

function rcTypeBoostItemIdsForTypes(types = []) {
  const wanted = new Set(types || []);
  return ITEMS
    .filter(item => item.typeBoostType && wanted.has(item.typeBoostType))
    .map(item => item.id);
}

const RC_ITEM_CANDIDATE_EXTRA_IDS = new Set([
  'leftovers',
]);

const RC_ITEM_CANDIDATE_EXCLUDED_IDS = new Set([
  'brightpowder',
  'cherishball',
  'focusband',
  'focussash',
  'kingsrock',
  'mentalherb',
  'quickclaw',
  'whiteherb',
]);

function rcItemAffectsObservedNumbers(item) {
  if (!item?.id) return false;
  if (RC_ITEM_CANDIDATE_EXCLUDED_IDS.has(item.id)) return false;
  if (RC_ITEM_CANDIDATE_EXTRA_IDS.has(item.id)) return true;
  return !!(
    item.typeBoostType ||
    item.powerBoostKind ||
    item.attackStatBoost ||
    item.defenseStatBoost ||
    item.finalDamageBoost ||
    item.speciesTypeBoost ||
    item.speedStatBoost ||
    item.residualRecovery ||
    item.hpRecovery ||
    item.multiHitModifier ||
    item.groundImmunity ||
    item.grounded !== undefined ||
    item.ignoresWeatherDamageModifiers ||
    item.paradoxActivation
  );
}

function rcItemCandidateMasterList() {
  return ITEMS
    .filter(item => !item.ms && !item.isBerry && rcItemAffectsObservedNumbers(item))
    .filter((item, idx, arr) => arr.findIndex(other => other.id === item.id) === idx);
}

function rcSanitizeItemCandidateIds(ids = []) {
  const allowed = new Set(rcItemCandidateMasterList().map(item => item.id));
  return ids
    .filter(id => !id || allowed.has(id))
    .filter((id, idx, arr) => arr.indexOf(id) === idx);
}

function rcDefaultItemCandidatesForOpponent() {
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  return rcSanitizeItemCandidateIds(['', 'choicescarf', ...rcTypeBoostItemIdsForTypes(oppP?.types || [])]);
}

function rcResetItemCandidatesForOpponent() {
  if (revCalcState.oppItemKnown !== 'unknown') {
    revCalcState.itemCandidates = [];
    return;
  }
  revCalcState.itemCandidates = rcDefaultItemCandidatesForOpponent();
}

function rcKnownOpponentItem() {
  if (revCalcState.oppItemKnown === undefined || revCalcState.oppItemKnown === 'unknown') return null;
  return revCalcState.oppItemKnown || '';
}

function rcActiveItemCandidates() {
  const known = rcKnownOpponentItem();
  if (known !== null) return [known];
  const candidates = revCalcState.itemCandidates?.length ? revCalcState.itemCandidates : rcDefaultItemCandidatesForOpponent();
  const normalized = rcSanitizeItemCandidateIds(candidates);
  if (revCalcState.itemCandidates?.length && normalized.length !== candidates.length) {
    revCalcState.itemCandidates = normalized;
  }
  return normalized.includes('') ? normalized : ['', ...normalized];
}

function rcItemCandidateCountLabel(candidates = rcActiveItemCandidates()) {
  const ids = candidates || [];
  const visibleCount = ids.filter(Boolean).length;
  return ids.includes('') ? `${visibleCount}개 + 없음` : `${visibleCount}개`;
}

function rcObservedField(kind) {
  const sideField = revCalcState.observedFields?.[kind] || {};
  return {
    ...rcAnalysisField(),
    defReflect: !!sideField.defReflect,
    defLightScreen: !!sideField.defLightScreen,
    isCritical: !!sideField.isCritical,
  };
}

function rcDefaultOpponentAbility(oppP) {
  return toId(oppP?.ab && (oppP.ab['0'] || oppP.ab['H']) || '');
}

function rcPokemonAbilityIds(oppP) {
  const ids = Object.values(oppP?.ab || {}).map(abN => toId(abN)).filter(Boolean);
  return ids.filter((id, idx, arr) => arr.indexOf(id) === idx);
}

function rcDamageSignature(result) {
  if (!result) return 'none';
  return JSON.stringify({
    damages: result.damages || [],
    effectiveness: result.effectiveness,
    moveType: result.moveType,
    bp: result.bp,
  });
}

function rcAbilityAffectsObservedDamage(oppP, abilityId, role, move, field) {
  if (!abilityId || !move || move.cat === 'Status') return false;
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const withAbility = rcBuildOpponentState(oppP, { evs, nature: 'hardy', item: '', ability: abilityId });
  const withoutAbility = rcBuildOpponentState(oppP, { evs, nature: 'hardy', item: '', ability: '' });
  const resultWith = role === 'atk'
    ? calculateDamage(withAbility, revCalcState.my, move, field)
    : calculateDamage(revCalcState.my, withAbility, move, field);
  const resultWithout = role === 'atk'
    ? calculateDamage(withoutAbility, revCalcState.my, move, field)
    : calculateDamage(revCalcState.my, withoutAbility, move, field);
  return rcDamageSignature(resultWith) !== rcDamageSignature(resultWithout);
}

function rcOpponentAbilityCandidates(oppP, observations = []) {
  const obsList = Array.isArray(observations)
    ? observations.filter(obs => obs?.role && obs?.move)
    : [];
  const defaultId = rcDefaultOpponentAbility(oppP);
  const byId = new Map([[defaultId || '', { id: defaultId || '', impact: false }]]);
  for (const id of rcPokemonAbilityIds(oppP)) {
    if (!id) continue;
    const impact = obsList.some(obs => rcAbilityAffectsObservedDamage(oppP, id, obs.role, obs.move, obs.field));
    if (id === defaultId) {
      byId.get(defaultId || '').impact = impact;
    } else if (impact) {
      byId.set(id, { id, impact: true });
    }
  }
  return [...byId.values()];
}

function rcMatchingRemainingPct(rolls, observedPct, defenderHp) {
  let matches = 0;
  for (const d of rolls) {
    if (d <= 0) continue;
    const remaining = Math.max(0, defenderHp - d);
    const remainingPct = Math.floor(remaining / defenderHp * 100);
    if (remainingPct === observedPct) matches++;
  }
  return matches;
}

function rcMatchingRemainingHp(rolls, observedHp, startingHp) {
  let matches = 0;
  for (const d of rolls) {
    if (d <= 0) continue;
    const remaining = Math.max(0, startingHp - d);
    if (remaining === observedHp) matches++;
  }
  return matches;
}

function rcCurrentHpValue(side) {
  const stats = calcStats(side);
  const rawPct = Number(side.hpPct ?? 1);
  const hpPct = Number.isFinite(rawPct) ? Math.max(0.01, Math.min(1, rawPct > 1 ? rawPct / 100 : rawPct)) : 1;
  return Math.max(1, Math.floor(stats.hp * hpPct));
}

function rcStageModifiedStat(value, stage) {
  const rank = Math.max(-6, Math.min(6, parseInt(stage, 10) || 0));
  if (rank >= 0) return Math.floor(value * (2 + rank) / 2);
  return Math.floor(value * 2 / (2 - rank));
}

function rcNextOpponentRanks() {
  if (!revCalcState.nextOppRanks) revCalcState.nextOppRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const stat of ['atk','def','spa','spd','spe']) {
    revCalcState.nextOppRanks[stat] = Math.max(-6, Math.min(6, parseInt(revCalcState.nextOppRanks[stat], 10) || 0));
  }
  return revCalcState.nextOppRanks;
}

function rcNextMyRanks() {
  if (!revCalcState.nextMyRanks) revCalcState.nextMyRanks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const stat of ['atk','def','spa','spd','spe']) {
    revCalcState.nextMyRanks[stat] = Math.max(-6, Math.min(6, parseInt(revCalcState.nextMyRanks[stat], 10) || 0));
  }
  return revCalcState.nextMyRanks;
}

function rcBuildMyNextState() {
  return {
    ...revCalcState.my,
    evs: { ...(revCalcState.my.evs || {}) },
    ranks: { ...rcNextMyRanks() },
  };
}

function rcSpeedWithMods(baseSpeed, rank, item, status) {
  let speed = rcStageModifiedStat(baseSpeed, rank);
  if (item === 'choicescarf') speed = Math.floor(speed * 1.5);
  if (status === 'Paralysis') speed = Math.floor(speed * 0.5);
  return Math.max(1, speed);
}

function rcMySpeedValue() {
  const stats = calcStats(revCalcState.my);
  return rcSpeedWithMods(
    stats.spe,
    revCalcState.my.ranks?.spe || 0,
    revCalcState.my.item || '',
    revCalcState.my.status || 'none'
  );
}

function rcOpponentSpeedValue(oppP, nature, item, speEv) {
  const oppState = rcBuildOpponentState(oppP, {
    evs: { spe: speEv },
    nature,
    item,
  });
  const baseSpeed = calcStats(oppState).spe;
  return rcSpeedWithMods(baseSpeed, revCalcState.opp.ranks?.spe || 0, item || '', revCalcState.opp.status || 'none');
}

function rcSpeedCandidateInfo(oppP, nature, item, field = rcAnalysisField()) {
  const rawOrder = revCalcState.turnOrder || 'unknown';
  const order = rawOrder === 'opp-first' || rawOrder === 'my-first' ? rawOrder : 'unknown';
  const mySpeed = rcMySpeedValue();
  if (order === 'unknown') {
    return {
      active: false,
      valid: true,
      speEv: 0,
      speMin: 0,
      speMax: 32,
      mySpeed,
      oppSpeed: rcOpponentSpeedValue(oppP, nature, item, 0),
      label: '속도 조건 없음',
    };
  }

  const ok = [];
  for (let speEv = 0; speEv <= 32; speEv++) {
    const oppSpeed = rcOpponentSpeedValue(oppP, nature, item, speEv);
    let matches = false;
    if (order === 'opp-first') {
      matches = oppSpeed > mySpeed;
    } else if (order === 'my-first') {
      matches = oppSpeed < mySpeed;
    }
    if (matches) ok.push({ speEv, oppSpeed });
  }

  if (!ok.length) {
    return { active: true, valid: false, speEv: 33, speMin: null, speMax: null, mySpeed, oppSpeed: null, label: '속도 조건 불일치' };
  }

  const chosen = ok[0];
  return {
    active: true,
    valid: true,
    speEv: chosen.speEv,
    speMin: ok[0].speEv,
    speMax: ok[ok.length - 1].speEv,
    mySpeed,
    oppSpeed: chosen.oppSpeed,
    label: item === 'choicescarf' ? '구애스카프 속도 조건 충족' : '속도 조건 충족',
  };
}
