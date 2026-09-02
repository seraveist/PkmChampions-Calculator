/* Team matchup and coverage table.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
const matchupSlots = [null, null, null, null, null, null];
const matchupAbilities = ['', '', '', '', '', ''];
const matchupCoverageMoves = Array.from({ length: 6 }, () => [null, null, null, null]);
let matchupMode = 'defense';

const EFF_SYMBOL = {
  4: '◎',
  2: '○',
  1: '',
  0.5: '△',
  0.25: '△△',
  0: '✕',
};
const EFF_CLASS = {
  4: 'eff-4',
  2: 'eff-2',
  1: '',           // 1× 는 클래스 부여 안 함 (색깔 변경 없음)
  0.5: 'eff-05',
  0.25: 'eff-025',
  0: 'eff-0',
};
// 매치업 테이블 고정 열 너비 (px). table-layout: fixed 와 함께 사용.
const MATCHUP_COL = { type: 72, slot: 112, score: 84, coverageSummary: 84 };
const DEFENSE_CONSISTENCY_SCORE = { 0: 0, 0.25: 0.25, 0.5: 0.5, 1: 1, 2: 2, 4: 4 };
const THREAT_RANK = { safe: 0, normal: 1, check: 2, caution: 3, danger: 4, max: 5 };

function matchupMetaIds(kind) {
  return Array.isArray(META_THREATS?.[kind]) ? META_THREATS[kind].filter(Boolean) : [];
}

function matchupMetaPokemon(kind) {
  return matchupMetaIds(kind).map(id => PokemonById[id]).filter(Boolean);
}

function defenseScoreLabel(score) {
  if (score >= 10) return { label: 'MAX', cls: 'max' };
  if (score >= 8) return { label: '위험', cls: 'danger' };
  if (score >= 6) return { label: '일관성', cls: 'caution' };
  if (score >= 5) return { label: '보통', cls: 'normal' };
  return { label: '안전', cls: 'safe' };
}

function matchupAbilityIds(pokemon) {
  return [...new Set(Object.values(pokemon?.ab || {})
    .map(name => toId(name))
    .filter(id => id && AbilityById[id]))];
}

function matchupDefaultAbilityId(pokemon) {
  const ids = matchupAbilityIds(pokemon);
  const defaultId = defaultPokemonAbilityId(pokemon);
  return ids.includes(defaultId) ? defaultId : (ids[0] || '');
}

function matchupSelectedAbilityId(slot, pokemon) {
  const abilityIds = matchupAbilityIds(pokemon);
  return abilityIds.includes(matchupAbilities[slot])
    ? matchupAbilities[slot]
    : matchupDefaultAbilityId(pokemon);
}

function matchupFormOptions(pokemon) {
  if (!pokemon) return [];
  const forms = new Map([[pokemon.id, pokemon]]);
  const group = calcFormGroupForPokemon(pokemon);
  group?.forms?.forEach(form => forms.set(form.id, form));

  const isSwitchableForm = pokemon.mega || pokemon.primal || pokemon.battleOnly || pokemon.changesFrom || pokemon.requiredItem;
  const baseId = isSwitchableForm
    ? toId(pokemon.base || pokemon.battleOnly || pokemon.changesFrom)
    : pokemon.id;
  const base = PokemonById[baseId];
  if (base) forms.set(base.id, base);
  POKEMON.forEach(candidate => {
    const candidateSwitches = candidate.mega || candidate.primal || candidate.battleOnly || candidate.changesFrom || candidate.requiredItem;
    if (candidateSwitches && matchupSameFormFamily(pokemon, candidate)) {
      forms.set(candidate.id, candidate);
    }
  });
  return [...forms.values()];
}

function matchupSameFormFamily(left, right) {
  if (!left || !right) return false;
  const familyId = pokemon => toId(
    (pokemon.mega || pokemon.primal || pokemon.battleOnly || pokemon.changesFrom)
      ? (pokemon.base || pokemon.battleOnly || pokemon.changesFrom)
      : (pokemon.base || pokemon.name)
  );
  return familyId(left) === familyId(right);
}

function matchupResolveItemForm(pokemonId, itemId) {
  const pokemon = PokemonById[pokemonId];
  const item = ItemById[itemId];
  if (!pokemon || !item) return pokemonId;

  const megaTarget = Object.values(item.ms || item.megaStone || {})
    .map(target => PokemonById[toId(target)])
    .find(Boolean);
  if (megaTarget && matchupSameFormFamily(pokemon, megaTarget)) return megaTarget.id;

  const requiredForm = POKEMON.find(candidate => (
    toId(candidate.requiredItem) === itemId
    && matchupSameFormFamily(pokemon, candidate)
  ));
  return requiredForm?.id || pokemonId;
}

function matchupSetSlotPokemon(slot, pokemonId, { abilityId = '', itemId = '' } = {}) {
  const resolvedId = matchupResolveItemForm(pokemonId, itemId);
  const pokemon = PokemonById[resolvedId];
  if (!pokemon) {
    matchupSlots[slot] = null;
    matchupAbilities[slot] = '';
    return;
  }
  matchupSlots[slot] = pokemon.id;
  const abilityIds = matchupAbilityIds(pokemon);
  matchupAbilities[slot] = abilityIds.includes(abilityId)
    ? abilityId
    : matchupDefaultAbilityId(pokemon);
}

function matchupAbilityTypeImmunity(type, abilityId) {
  const ability = abilityData(abilityId);
  const blocksType = (ability.immunities || []).some(immunity => immunity.types?.includes(type));
  return blocksType ? ability : null;
}

function matchupDefenseEffect(type, entry) {
  const pokemon = entry?.pokemon || entry;
  const typeEffect = pokemon ? typeEff(type, pokemon.types) : 1;
  if (typeEffect === 0) return { eff: 0, ability: null };
  const ability = matchupAbilityTypeImmunity(type, entry?.abilityId || '');
  return ability ? { eff: 0, ability } : { eff: typeEffect, ability: null };
}

function defenseTypeProfile(type, entries) {
  const effects = entries.map(entry => matchupDefenseEffect(type, entry).eff);
  const rawScore = effects.reduce((sum, eff) => sum + (DEFENSE_CONSISTENCY_SCORE[eff] ?? 0.15), 0);
  const score = Math.max(0, rawScore);
  const weakCount = effects.filter(eff => eff > 1).length;
  const quadCount = effects.filter(eff => eff >= 4).length;
  const neutralCount = effects.filter(eff => eff === 1).length;
  const resistCount = effects.filter(eff => eff === 0.5).length;
  const quarterCount = effects.filter(eff => eff === 0.25).length;
  const immuneCount = effects.filter(eff => eff === 0).length;
  return {
    type,
    score,
    rawScore,
    weakCount,
    quadCount,
    neutralCount,
    resistCount,
    quarterCount,
    immuneCount,
    grade: defenseScoreLabel(score),
  };
}

function formatDefenseScore(score) {
  if (score >= 10) return '10+';
  return score.toFixed(2).replace(/0$/, '').replace(/\.0$/, '.0');
}

function selectedCoverageMoves() {
  const moves = [];
  matchupCoverageMoves.forEach((slotMoves, slot) => {
    slotMoves.forEach(moveId => {
      const move = moveId ? MoveById[moveId] : null;
      if (move) moves.push({ slot, move });
    });
  });
  return moves;
}

function coverageSlotHasType(slot, type) {
  return (matchupCoverageMoves[slot] || []).some(moveId => MoveById[moveId]?.type === type);
}

function coverageCountByType(type, slot = null) {
  if (slot !== null) return coverageSlotHasType(slot, type) ? 1 : 0;
  return matchupCoverageMoves.reduce((sum, _, i) => sum + (coverageSlotHasType(i, type) ? 1 : 0), 0);
}

function coverageSlotCountForTypes(types) {
  const targets = new Set(types);
  return matchupCoverageMoves.reduce((sum, slotMoves) => {
    const hit = slotMoves.some(moveId => targets.has(MoveById[moveId]?.type));
    return sum + (hit ? 1 : 0);
  }, 0);
}

function coverageThreatGrade(has4x, quadCovered, alt2Count) {
  if (has4x && quadCovered) return { label: '안전', cls: 'safe' };
  if (alt2Count >= 3) return { label: '안전', cls: 'safe' };
  if (alt2Count === 2) return { label: '견제', cls: 'check' };
  if (alt2Count === 1) return { label: '주의', cls: 'caution' };
  return { label: '위험', cls: 'danger' };
}

function renderMatchupModeTabs() {
  const tabs = document.getElementById('matchupModeTabs');
  if (!tabs) return;
  const buttons = tabs.querySelectorAll('.matchup-mode-btn');
  const activeButton = [...buttons].find(btn => btn.dataset.matchupMode === matchupMode) || null;
  syncUiTabs(buttons, activeButton);
  bindUiTabKeyboard(tabs, { selector: '.matchup-mode-btn' });
  buttons.forEach(btn => {
    btn.onclick = () => {
      matchupMode = btn.dataset.matchupMode || 'defense';
      renderMatchupModeTabs();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    };
  });
}

function syncMatchupMetaHeight() {
  const layout = document.querySelector('#page-matchup .matchup-result-layout');
  const main = document.querySelector('#page-matchup .matchup-main');
  const meta = document.getElementById('matchupMeta');
  if (!layout || !main || !meta) return;
  if (window.matchMedia('(max-width: 1280px)').matches) {
    meta.style.maxHeight = '';
    return;
  }
  requestAnimationFrame(() => {
    meta.style.maxHeight = `${Math.max(260, main.offsetHeight)}px`;
  });
}

function renderMatchupSlots() {
  const container = document.getElementById('matchupSlots');
  if (!container) return;
  renderTrustedHTML(container, matchupSlots.map((id, i) => {
    const p = id ? PokemonById[id] : null;
    const forms = matchupFormOptions(p);
    const abilities = matchupAbilityIds(p).map(abilityId => AbilityById[abilityId]).filter(Boolean);
    return `
      <div class="matchup-slot ui-control-frame ui-subframe ui-control-grid ${p ? 'filled' : ''}" data-slot="${i}">
        <div class="matchup-slot-num">${i + 1}</div>
        ${pokemonSpriteSlot(p, { size: 'md', className: 'matchup-slot-sprite' })}
        <div class="combobox">
          <input type="text" class="cb-input matchup-cb-input" data-slot="${i}" data-cb-type="pokemon" data-cb-portal="true" data-field="matchup-pokemon-${i}"
                 value="${p ? escapeHTML(pkName(p)) : ''}" placeholder="포켓몬 검색..." aria-label="${i + 1}번 슬롯 포켓몬 선택" aria-expanded="false">
          <div class="combobox-options"></div>
        </div>
        <div class="matchup-slot-types">
          ${p ? p.types.map(t => `<span class="type-pill matchup-type-pill t-${t}">${TYPE_KO[t]}</span>`).join('') : ''}
        </div>
        ${p ? `<button type="button" class="matchup-slot-clear" data-slot="${i}" title="비우기">✕</button>` : ''}
        ${p ? `<div class="matchup-slot-config">
          ${forms.length > 1 ? `<select class="matchup-form-select" data-slot="${i}" aria-label="${i + 1}번 슬롯 폼 선택">
            ${forms.map(form => `<option value="${escapeHTML(form.id)}" ${form.id === p.id ? 'selected' : ''}>${escapeHTML(pkName(form))}</option>`).join('')}
          </select>` : ''}
          <select class="matchup-ability-select" data-slot="${i}" aria-label="${i + 1}번 슬롯 특성 선택">
            ${abilities.map(ability => `<option value="${escapeHTML(ability.id)}" ${ability.id === matchupSelectedAbilityId(i, p) ? 'selected' : ''}>${escapeHTML(abName(ability))}</option>`).join('')}
          </select>
        </div>` : ''}
      </div>
    `;
  }).join(''));
  wireMatchupSlots();
}

function wireMatchupSlots() {
  const container = document.getElementById('matchupSlots');
  if (!container) return;
  container.querySelectorAll('.matchup-cb-input').forEach(input => {
    const slot = parseInt(input.dataset.slot, 10);
    wirePokemonSelectCombobox(input, {
      getOptions: () => sortPokemonForCalcSelect(POKEMON),
      getCurrentId: () => matchupSlots[slot] || '',
      getDisplayLabel: () => {
        const id = matchupSlots[slot] || '';
        return id && PokemonById[id] ? pkName(PokemonById[id]) : '';
      },
      renderOption: typeof calcRenderSimplePokemonOption === 'function' ? calcRenderSimplePokemonOption : null,
      renderHeader: '',
      wiredKey: 'matchupPokemonWired',
      onSelect: id => {
        if (!id || !PokemonById[id]) return;
        matchupSetSlotPokemon(slot, id);
        renderMatchupSlots();
        renderMatchupCoverageInputs();
        renderMatchupTable();
      },
    });
  });
  container.querySelectorAll('.matchup-form-select').forEach(select => {
    select.addEventListener('change', () => {
      const slot = parseInt(select.dataset.slot, 10);
      matchupSetSlotPokemon(slot, select.value);
      renderMatchupSlots();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    });
  });
  container.querySelectorAll('.matchup-ability-select').forEach(select => {
    select.addEventListener('change', () => {
      const slot = parseInt(select.dataset.slot, 10);
      const pokemon = PokemonById[matchupSlots[slot]];
      matchupAbilities[slot] = matchupAbilityIds(pokemon).includes(select.value)
        ? select.value
        : matchupDefaultAbilityId(pokemon);
      renderMatchupTable();
    });
  });
  container.querySelectorAll('.matchup-slot-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot, 10);
      matchupSlots[slot] = null;
      matchupAbilities[slot] = '';
      matchupCoverageMoves[slot] = [null, null, null, null];
      renderMatchupSlots();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    });
  });
}

function coverageMovePool(slot) {
  const p = matchupSlots[slot] ? PokemonById[matchupSlots[slot]] : null;
  const pool = p?.ls?.length ? p.ls.map(id => MoveById[id]).filter(Boolean) : MOVES;
  return sortMovesForCalcSelect(pool.filter(m => m.cat !== 'Status' && m.type && BATTLE_TYPES.includes(m.type)));
}

function matchupMoveMatchesQuery(move, search) {
  return calcMatches(
    search,
    move.id,
    move.name,
    move.koName,
    mvName(move),
    move.type,
    TYPE_KO[move.type],
    calcMoveCategoryLabel(move.cat),
    String(move.bp || '')
  );
}

function matchupMoveOptionRows(slot, moveIndex, query) {
  const search = calcSearchText(query);
  const noneOption = { id: '', label: '\uC5C6\uC74C' };
  const noneMatches = calcMatches(search, noneOption.label, 'none') ? [noneOption] : [];
  const matches = coverageMovePool(slot).filter(move => matchupMoveMatchesQuery(move, search));
  const currentId = matchupCoverageMoves[slot]?.[moveIndex] || '';
  return [...noneMatches, ...matches]
    .map(option => (
      typeof calcRenderSimpleMoveOption === 'function'
        ? calcRenderSimpleMoveOption(option, currentId)
        : calcRenderMoveOption(option, currentId)
    ))
    .join('');
}

function renderMatchupCoverageInputs() {
  const container = document.getElementById('matchupCoverageInputs');
  if (!container) return;
  if (matchupMode !== 'coverage') {
    renderTrustedHTML(container, '');
    return;
  }
  renderTrustedHTML(container, matchupSlots.map((id, slot) => {
    const p = id ? PokemonById[id] : null;
    const title = p ? pkName(p) : `슬롯 ${slot + 1}`;
    const rows = p ? matchupCoverageMoves[slot].map((moveId, moveIndex) => {
      const m = moveId ? MoveById[moveId] : null;
      return `
        <div class="matchup-move-field ui-control-row">
          <span class="matchup-move-num">${moveIndex + 1}</span>
          <div class="combobox matchup-move-combobox">
            <input type="text" class="cb-input matchup-move-input" data-slot="${slot}" data-move-index="${moveIndex}" data-cb-type="move" data-cb-portal="true" data-cb-portal-size="compact" data-field="matchup-move-${slot}-${moveIndex}"
                   value="${m ? escapeHTML(mvName(m)) : ''}" placeholder="기술 검색">
            <div class="combobox-options"></div>
          </div>
          <span class="matchup-move-type-slot">
            ${m ? `<span class="type-pill matchup-type-pill t-${m.type}">${TYPE_KO[m.type] || m.type}</span>` : ''}
          </span>
          <button type="button" class="matchup-move-clear" data-slot="${slot}" data-move-index="${moveIndex}" title="비우기" ${m ? '' : 'disabled'}>✕</button>
        </div>
      `;
    }).join('') : '';
    return `
      <div class="matchup-coverage-card ui-control-frame ui-subframe ui-subframe-stack ${p ? 'filled' : ''}">
        <div class="matchup-coverage-head ui-chip-row">
          <span>${escapeHTML(title)}</span>
          ${p ? p.types.map(t => `<span class="type-pill matchup-type-pill t-${t}">${TYPE_KO[t] || t}</span>`).join('') : ''}
        </div>
        ${p ? `<div class="matchup-move-grid ui-control-grid">${rows}</div>` : '<div class="matchup-coverage-empty">포켓몬 선택 후 기술 입력</div>'}
      </div>
    `;
  }).join(''));
  wireMatchupCoverageInputs();
}

function wireMatchupCoverageInputs() {
  const container = document.getElementById('matchupCoverageInputs');
  if (!container) return;
  container.querySelectorAll('.matchup-move-input').forEach(input => {
    const slot = parseInt(input.dataset.slot, 10);
    const moveIndex = parseInt(input.dataset.moveIndex, 10);
    const cbParent = input.closest('.combobox');
    const optsEl = cbParent?.querySelector('.combobox-options');
    if (!optsEl) return;
    const usesPortal = typeof calcMountComboboxPortal === 'function'
      ? calcMountComboboxPortal(input, cbParent, optsEl)
      : false;

    let selectingOption = false;
    const selectedMoveId = () => matchupCoverageMoves[slot]?.[moveIndex] || '';
    const restoreInput = () => {
      const moveId = selectedMoveId();
      input.value = moveId && MoveById[moveId] ? mvName(MoveById[moveId]) : '';
    };
    const applyMoveId = id => {
      matchupCoverageMoves[slot][moveIndex] = id && MoveById[id] ? id : null;
      renderMatchupCoverageInputs();
      renderMatchupTable();
    };
    const showMoveOptions = query => {
      const rows = matchupMoveOptionRows(slot, moveIndex, query);
      renderTrustedHTML(optsEl, rows
        ? rows
        : '<div class="combobox-option empty" aria-disabled="true"><span>\uAC80\uC0C9 \uACB0\uACFC \uC5C6\uC74C</span></div>');
      if (typeof closeSiblingComboboxOptions === 'function') {
        closeSiblingComboboxOptions(optsEl, input);
      }
      if (usesPortal && typeof calcPositionComboboxPortal === 'function') {
        requestAnimationFrame(() => calcPositionComboboxPortal(input, optsEl, optsEl.dataset.calcPortalType || input.dataset.cbType || ''));
      }
    };
    const moveCombo = wireSharedComboboxKeyboard(input, optsEl, {
      showOptions: showMoveOptions,
      onSelect: opt => {
        selectingOption = true;
        applyMoveId(opt.dataset.id || '');
      },
      getQuery: () => input.value || '',
      onInvalidInput: restoreInput,
    });

    input.addEventListener('focus', () => moveCombo?.open(input.value || ''));
    input.addEventListener('click', () => moveCombo?.open(input.value || ''));
    input.addEventListener('input', e => {
      if (!e.target.value.trim()) {
        matchupCoverageMoves[slot][moveIndex] = null;
        renderMatchupTable();
      }
      moveCombo?.open(e.target.value, { activateFirst: true });
    });
    input.addEventListener('compositionend', e => moveCombo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('blur', () => setTimeout(() => {
      if (typeof calcComboboxFocusMovedToAnother === 'function' && calcComboboxFocusMovedToAnother(input, optsEl)) {
        selectingOption = false;
        restoreInput();
        moveCombo?.close();
        return;
      }
      if (selectingOption) {
        selectingOption = false;
        return;
      }
      if (!String(input.value || '').trim()) {
        applyMoveId('');
        return;
      }
      moveCombo?.commitTyped();
    }, 180));

    const handleOptionSelect = e => {
      const opt = e.target.closest('.combobox-option:not(.empty)');
      if (!opt || opt.classList.contains('empty')) return;
      selectingOption = true;
      e.preventDefault();
      moveCombo?.select(opt);
    };
    optsEl.addEventListener('mousedown', handleOptionSelect);
    optsEl.addEventListener('click', handleOptionSelect);
    optsEl.addEventListener('touchstart', handleOptionSelect, { passive: false });
  });
  container.querySelectorAll('.matchup-move-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot, 10);
      const moveIndex = parseInt(btn.dataset.moveIndex, 10);
      matchupCoverageMoves[slot][moveIndex] = null;
      renderMatchupCoverageInputs();
      renderMatchupTable();
    });
  });
}

function renderMatchupSideGroup(label, cls, rows, renderRow) {
  if (!rows.length) return '';
  return `
    <div class="matchup-side-section ${cls}">
      <div class="matchup-side-section-title ${cls}">${label}</div>
      <div class="matchup-side-section-cards">
        ${rows.map(renderRow).join('')}
      </div>
    </div>
  `;
}

function renderMatchupMetaTypeBadges(types) {
  return types.map(entry => {
    const type = typeof entry === 'string' ? entry : entry.type;
    const state = typeof entry === 'string' ? '' : (entry.state || '');
    return `<span class="matchup-meta-type-badge ${state}"><span class="type-pill t-${type}">${TYPE_KO[type] || type}</span></span>`;
  }).join('');
}

function renderMatchupMetaCard(pokemon, gradeClass, types) {
  return `
    <div class="matchup-side-card ${gradeClass}">
      <div class="matchup-side-name">${escapeHTML(pkName(pokemon))}</div>
      <div class="matchup-side-badges matchup-weakness-list">${renderMatchupMetaTypeBadges(types)}</div>
    </div>
  `;
}

function renderMatchupMeta(kind, context = {}) {
  const box = document.getElementById('matchupMeta');
  if (!box) return;
  if (kind === 'defensiveThreats') {
    const entries = context.entries || [];
    if (entries.length < 3) {
      renderTrustedHTML(box, '<div class="matchup-side-title">주의 포켓몬</div><div class="matchup-side-empty">3마리 이상 선택하면 메타 위협의 타입별 위험도를 표시합니다.</div>');
      return;
    }
    const rows = matchupMetaPokemon('defensiveThreats').map(p => {
      const profiles = (p.types || []).map(type => defenseTypeProfile(type, entries));
      const visibleProfiles = profiles.filter(profile => profile.grade.cls === 'danger' || profile.grade.cls === 'caution' || profile.grade.cls === 'max');
      const maxScore = Math.max(...visibleProfiles.map(s => s.score), 0);
      const maxRank = Math.max(...visibleProfiles.map(s => THREAT_RANK[s.grade.cls] || 0), 0);
      const maxGrade = visibleProfiles.find(s => (THREAT_RANK[s.grade.cls] || 0) === maxRank)?.grade || { label: '안전', cls: 'safe' };
      return { p, profiles: visibleProfiles, maxScore, maxRank, maxGrade };
    }).filter(row => row.profiles.length)
      .sort((a, b) => b.maxRank - a.maxRank || b.maxScore - a.maxScore || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
    const dangerRows = rows.filter(row => row.maxGrade.cls === 'danger' || row.maxGrade.cls === 'max');
    const cautionRows = rows.filter(row => row.maxGrade.cls === 'caution');
    const renderDefenseRow = row => renderMatchupMetaCard(row.p, row.maxGrade.cls, row.profiles.map(s => ({ type: s.type, state: s.grade.cls })));
    const sections = [
      renderMatchupSideGroup('위험', 'danger', dangerRows, renderDefenseRow),
      renderMatchupSideGroup('주의', 'caution', cautionRows, renderDefenseRow),
    ].join('');
    renderTrustedHTML(box, `
      <div class="matchup-side-title">주의 포켓몬</div>
      <div class="matchup-side-list">
        ${sections || '<div class="matchup-side-empty">현재 선택 기준으로 위험/주의 메타 포켓몬이 없습니다.</div>'}
      </div>
    `);
    return;
  }
  const coverageMoves = selectedCoverageMoves();
  if (coverageMoves.length === 0) {
    renderTrustedHTML(box, '<div class="matchup-side-title">메타 타점</div><div class="matchup-side-empty">타점 체크에서 기술을 입력하면 메타 포켓몬의 4배/2배 약점 커버를 표시합니다.</div>');
    return;
  }
  const rows = matchupMetaPokemon('coverageChecks').map(p => {
    const weaknesses = BATTLE_TYPES.map(type => {
      const eff = typeEff(type, p.types);
      if (eff <= 1) return null;
      const count = coverageCountByType(type);
      return { type, eff, count };
    }).filter(Boolean);
    const quadWeaknesses = weaknesses.filter(w => w.eff >= 4);
    const doubleWeaknesses = weaknesses.filter(w => w.eff === 2);
    const missing4 = quadWeaknesses.filter(w => w.count === 0);
    const has4x = quadWeaknesses.length > 0;
    const quadCovered = quadWeaknesses.some(w => w.count > 0);
    const alt2Count = coverageSlotCountForTypes(doubleWeaknesses.map(w => w.type));
    const grade = coverageThreatGrade(has4x, quadCovered, alt2Count);
    return { p, weaknesses, quadWeaknesses, doubleWeaknesses, missing4, has4x, quadCovered, alt2Count, grade };
  }).filter(row => row.grade.cls !== 'safe');
  const dangerRows = rows
    .filter(row => row.grade.cls === 'danger')
    .sort((a, b) => b.missing4.length - a.missing4.length || a.alt2Count - b.alt2Count || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
  const cautionRows = rows
    .filter(row => row.grade.cls === 'caution')
    .sort((a, b) => b.missing4.length - a.missing4.length || a.alt2Count - b.alt2Count || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
  const checkRows = rows
    .filter(row => row.grade.cls === 'check')
    .sort((a, b) => b.missing4.length - a.missing4.length || a.alt2Count - b.alt2Count || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
  const renderCoverageRow = row => {
    const shownWeaknesses = row.missing4.length ? [...row.missing4, ...row.doubleWeaknesses] : row.doubleWeaknesses;
    return renderMatchupMetaCard(row.p, row.grade.cls, shownWeaknesses.map(w => ({ type: w.type, state: w.count ? 'covered' : 'missing' })));
  };
  const sections = [
    renderMatchupSideGroup('위험', 'danger', dangerRows, renderCoverageRow),
    renderMatchupSideGroup('주의', 'caution', cautionRows, renderCoverageRow),
    renderMatchupSideGroup('견제', 'check', checkRows, renderCoverageRow),
  ].join('');
  renderTrustedHTML(box, `
    <div class="matchup-side-title">메타 타점</div>
    <div class="matchup-side-list">
      ${sections || '<div class="matchup-side-empty">현재 기술 기준으로 미커버 위험/주의/견제 메타 포켓몬이 없습니다.</div>'}
    </div>
  `);
}

function renderDefenseScoreCell(profile) {
  const scoreText = formatDefenseScore(profile.score);
  return `
    <td class="summary score ${profile.grade.cls}" title="${profile.grade.label} · 약점 ${profile.weakCount} · 반감 ${profile.resistCount} · 1/4 ${profile.quarterCount} · 무효 ${profile.immuneCount}">
      <div class="matchup-score-main">${scoreText}</div>
    </td>
  `;
}

function renderMatchupTable() {
  if (matchupMode === 'coverage') renderCoverageMatchupTable();
  else renderDefenseMatchupTable();
  wireMatchupScrollHint();
  requestAnimationFrame(updateMatchupScrollHint);
}

function updateMatchupScrollHint() {
  const wrap = document.querySelector('#page-matchup .matchup-table-wrap');
  const hint = document.getElementById('matchupScrollHint');
  if (!wrap || !hint) return;
  const hasOverflow = wrap.scrollWidth > wrap.clientWidth + 1;
  hint.hidden = !hasOverflow;
  hint.classList.toggle('has-scrolled', wrap.scrollLeft > 4);
}

function wireMatchupScrollHint() {
  const wrap = document.querySelector('#page-matchup .matchup-table-wrap');
  if (!wrap || wrap.dataset.scrollHintWired === 'true') return;
  wrap.dataset.scrollHintWired = 'true';
  wrap.addEventListener('scroll', updateMatchupScrollHint, { passive: true });
}

function replaceMatchupColgroup(table, widths) {
  table.querySelector('colgroup')?.remove();
  const colgroup = document.createElement('colgroup');
  widths.forEach((width) => {
    const col = document.createElement('col');
    col.style.width = `${width}px`;
    colgroup.appendChild(col);
  });
  table.insertBefore(colgroup, table.firstChild);
}

function selectedMatchupEntries() {
  return matchupSlots
    .map((id, slot) => ({
      slot,
      pokemon: id ? PokemonById[id] : null,
      abilityId: matchupSelectedAbilityId(slot, PokemonById[id]),
    }))
    .filter(entry => entry.pokemon);
}

function configureMatchupTable(table, entries, summaryWidth) {
  replaceMatchupColgroup(table, [
    MATCHUP_COL.type,
    ...entries.map(() => MATCHUP_COL.slot),
    summaryWidth,
  ]);
  table.dataset.selectedCount = String(entries.length);
  table.classList.toggle('matchup-table-compact', entries.length <= 3);
}

function renderDefenseMatchupTable() {
  const tbl = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!tbl || !head || !body) return;

  const entries = selectedMatchupEntries();
  const valid = entries.map(entry => entry.pokemon);
  renderMatchupMeta('defensiveThreats', { entries });

  // colgroup 으로 고정 열 너비 강제 (table-layout: fixed 와 함께)
  // 슬롯 채워지든 비어 있든 동일한 폭을 유지한다.
  configureMatchupTable(tbl, entries, MATCHUP_COL.score);

  // 헤더: 공격 타입 컬럼 + 6 슬롯 + 무효/약점 요약
  renderTrustedHTML(head, `
    <tr>
      <th class="matchup-type-head">타입</th>
      ${entries.map(({ pokemon }) => `<th title="${escapeHTML(pkName(pokemon))}">${escapeHTML(pkName(pokemon))}</th>`).join('')}
      <th class="summary">일관성</th>
    </tr>
  `);

  if (valid.length < 3) {
    renderTrustedHTML(body, `<tr><td colspan="${entries.length + 2}" class="empty-state-cell">3마리 이상 선택하면 방어 상성 진단을 표시합니다.</td></tr>`);
    return;
  }

  // 본문: 18 행 × 6 셀 + 요약
  renderTrustedHTML(body, BATTLE_TYPES.map(t => {
    const cells = entries.map(entry => {
      const { eff, ability } = matchupDefenseEffect(t, entry);
      const sym = ability ? abName(ability) : (EFF_SYMBOL[eff] !== undefined ? EFF_SYMBOL[eff] : eff + '×');
      const cls = EFF_CLASS[eff] || '';
      return `<td class="${cls} ${ability ? 'ability-immune' : ''}">${escapeHTML(sym)}</td>`;
    }).join('');

    const profile = defenseTypeProfile(t, entries);

    return `
      <tr>
        <td><span class="type-pill matchup-table-type t-${t}">${TYPE_KO[t]}</span></td>
        ${cells}
        ${renderDefenseScoreCell(profile)}
      </tr>
    `;
  }).join(''));
  syncMatchupMetaHeight();
}
/* ════════════════════════════════════════════════════════════
   도감 상세 모달 — Cross-reference 인덱스 + 렌더러
   ════════════════════════════════════════════════════════════ */
// 특성 → 보유 포켓몬 인덱스 (한 번만 빌드)
function renderCoverageMatchupTable() {
  const tbl = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!tbl || !head || !body) return;
  renderMatchupMeta('coverageChecks');

  const entries = selectedMatchupEntries();
  const valid = entries.map(entry => entry.pokemon);
  configureMatchupTable(tbl, entries, MATCHUP_COL.coverageSummary);

  renderTrustedHTML(head, `
    <tr>
      <th class="matchup-type-head">타입</th>
      ${entries.map(({ pokemon }) => `<th title="${escapeHTML(pkName(pokemon))}">${escapeHTML(pkName(pokemon))}</th>`).join('')}
      <th class="summary">커버</th>
    </tr>
  `);

  if (valid.length < 3) {
    renderTrustedHTML(body, `<tr><td colspan="${entries.length + 2}" class="empty-state-cell">3마리 이상 선택하고 타점 체크에서 기술을 입력하면 진단을 표시합니다.</td></tr>`);
    return;
  }

  renderTrustedHTML(body, BATTLE_TYPES.map(t => {
    const cells = entries.map(({ slot }) => {
      const count = coverageCountByType(t, slot);
      return `<td class="${count ? 'coverage-hit' : 'coverage-miss'}">${count || ''}</td>`;
    }).join('');
    const total = coverageCountByType(t);
    return `
      <tr>
        <td><span class="type-pill matchup-table-type t-${t}">${TYPE_KO[t]}</span></td>
        ${cells}
        <td class="summary ${total ? 'coverage-hit' : 'coverage-miss'}">${total || ''}</td>
      </tr>
    `;
  }).join(''));
  syncMatchupMetaHeight();
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('resize', () => {
    syncMatchupMetaHeight();
    updateMatchupScrollHint();
  });
}
