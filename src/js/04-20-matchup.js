import { RotomUI } from './01-10-rotom-ui.js';
import { bindUiTabKeyboard, syncUiTabs } from './01-20-html-structure.js';
import { AbilityById, BATTLE_TYPES, ItemById, MOD, MoveById, POKEMON, PokemonById, TYPE_KO, abName, abilityData, escapeHTML, mvName, pkName, pokemonSpriteSlot, renderTrustedHTML, toId, typeEff } from './01-core.js';
import { calcFormGroupForPokemon, calcMatches, calcMoveCategoryLabel, calcSearchText, defaultPokemonAbilityId, sortMovesForCalcSelect, sortPokemonForCalcSelect } from './03-10-calc-state.js';
import { renderToolTypePills } from './03-11-calc-shared-render.js';
import { wirePokemonSelectCombobox, wireSharedComboboxKeyboard } from './03-20-calc-combobox.js';
import { calcRenderMoveOption, calcRenderSimpleMoveOption, calcRenderSimplePokemonOption } from './03-21-calc-combobox-options.js';

/* Team matchup and coverage table.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
const matchupSlots = [null, null, null, null, null, null];
const matchupAbilities = ['', '', '', '', '', ''];
const matchupCoverageMoves = Array.from({ length: 6 }, () => [null, null, null, null]);
let matchupMode = 'defense';
const matchupCoverageField = { weather: 'none', terrain: 'none' };
const MATCHUP_COL = { type: 72, slot: 112, summary: 112, coverageSummary: 84 };


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
  const previousId = matchupSlots[slot];
  const resolvedId = matchupResolveItemForm(pokemonId, itemId);
  const pokemon = PokemonById[resolvedId];
  if (!pokemon) {
    matchupSlots[slot] = null;
    matchupAbilities[slot] = '';
    matchupCoverageMoves[slot] = [null, null, null, null];
    return;
  }
  matchupSlots[slot] = pokemon.id;
  if (previousId !== pokemon.id) {
    matchupCoverageMoves[slot] = matchupCoverageMoves[slot].map(id => pokemon.ls?.includes(id) ? id : null);
  }
  const abilityIds = matchupAbilityIds(pokemon);
  matchupAbilities[slot] = abilityIds.includes(abilityId)
    ? abilityId
    : matchupDefaultAbilityId(pokemon);
}

// Only rules decidable from the attack type belong in a static type table.
function matchupTypeRule(rule) {
  return Object.keys(rule).every(key => ['types', 'effectiveness', 'mod'].includes(key))
    && (!rule.effectiveness || rule.effectiveness === 'superEffective');
}

function matchupDefenseEffect(type, entry) {
  const pokemon = entry?.pokemon || entry;
  const typeEffect = pokemon ? typeEff(type, pokemon.types) : 1;
  const data = abilityData(entry?.abilityId || '');
  if (typeEffect === 0) return { eff: 0, typeEffect, ability: null };
  const immune = (data.immunities || []).some(rule => matchupTypeRule(rule) && rule.types?.includes(type));
  if (immune || (data.superEffectiveOnly && typeEffect <= 1)) return { eff: 0, typeEffect, ability: data };
  let eff = typeEffect;
  for (const rule of [...(data.defensiveAttackMods || []), ...(data.defensiveFinalMods || [])]) {
    if (!matchupTypeRule(rule) || (rule.types && !rule.types.includes(type))) continue;
    if (rule.effectiveness === 'superEffective' && typeEffect <= 1) continue;
    const mod = typeof rule.mod === 'number' ? rule.mod : MOD[rule.mod];
    if (Number.isFinite(mod)) eff *= mod / 4096;
  }
  return { eff, typeEffect, ability: eff !== typeEffect ? data : null };
}

function defenseTypeProfile(type, entries) {
  const effects = entries.map(entry => matchupDefenseEffect(type, entry).eff);
  return {
    type,
    weakCount: effects.filter(eff => eff > 1).length,
    neutralCount: effects.filter(eff => eff === 1).length,
    resistCount: effects.filter(eff => eff > 0 && eff < 1).length,
    immuneCount: effects.filter(eff => eff === 0).length,
  };
}

function coverageSlotMoves(slot) {
  const pokemon = PokemonById[matchupSlots[slot]];
  if (!pokemon) return [];
  return (matchupCoverageMoves[slot] || []).map(id => MoveById[id]).filter(move =>
    move && move.cat !== 'Status' && pokemon.ls?.includes(move.id));
}

function coverageSlotHasType(slot, type) {
  return coverageSlotMoves(slot).some(move => coverageMoveType(slot, move) === type);
}

function coverageMoveType(slot, move) {
  const pokemon = PokemonById[matchupSlots[slot]];
  if (!pokemon || !move || move.cat === 'Status') return '';
  const ability = abilityData(matchupSelectedAbilityId(slot, pokemon));
  let type = move.type;
  // Apply the field before ability conversion, in the same order as the calculator.
  const weather = ability.suppressesWeather ? 'none' : matchupCoverageField.weather;
  if (move.typeChangeKind === 'weatherBall') {
    type = ({ Sun: 'Fire', 'Harsh Sunshine': 'Fire', Rain: 'Water', 'Heavy Rain': 'Water', Sand: 'Rock', Snow: 'Ice' })[weather] || type;
  }
  if (move.typeChangeKind === 'terrainPulse' && !pokemon.types.includes('Flying') && ability.grounded !== false) {
    type = ({ Electric: 'Electric', Grassy: 'Grass', Misty: 'Fairy', Psychic: 'Psychic' })[matchupCoverageField.terrain] || type;
  }
  const change = ability.typeChange;
  if (change && (!change.from || change.from === type) && (!change.flag || move.flags?.[change.flag])) type = change.type;
  return type;
}

function coverageCountByType(type, slot = null) {
  if (slot !== null) return coverageSlotHasType(slot, type) ? 1 : 0;
  return matchupCoverageMoves.reduce((sum, _, i) => sum + (coverageSlotHasType(i, type) ? 1 : 0), 0);
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

function renderMatchupSlots() {
  const container=document.getElementById('matchupSlots');
  if(!container) return;
  renderTrustedHTML(container,matchupSlots.map((id,slot)=>{
    const p=PokemonById[id], forms=matchupFormOptions(p), abilities=matchupAbilityIds(p).map(id=>AbilityById[id]).filter(Boolean);
    return `<section class="matchup-slot ui-surface ${p ? 'filled' : ''}" data-slot="${slot}"><div class="matchup-slot-head"><span class="eyebrow">${String(slot+1).padStart(2,'0')}</span><div class="type-list">${p ? renderToolTypePills(p.types) : ''}</div>${p ? `<button type="button" class="ui-button icon-button matchup-slot-clear" data-slot="${slot}" aria-label="${slot+1}번 포켓몬 비우기">${RotomUI.icon('close')}</button>` : ''}</div>
      <div class="combobox">${RotomUI.trigger(`${pokemonSpriteSlot(p,{size:'md'})}<strong class="picker-label">${escapeHTML(p ? pkName(p) : '포켓몬 선택')}</strong>`,{'data-slot':slot,'data-cb-type':'pokemon','data-field':`matchup-pokemon-${slot}`,value:p ? pkName(p) : '','aria-label':`${slot+1}번 포켓몬 선택`},'cb-input cb-trigger matchup-cb-input')}<div class="combobox-options" role="listbox"></div></div>
      ${p ? `<div class="matchup-slot-config">${forms.length>1 ? RotomUI.field('폼',RotomUI.select(forms.map(form=>[form.id,pkName(form)]),p.id,{class:'matchup-form-select','data-slot':slot,'aria-label':`${slot+1}번 폼`})) : ''}${RotomUI.field('특성',RotomUI.select(abilities.map(a=>[a.id,abName(a)]),matchupSelectedAbilityId(slot,p),{class:'matchup-ability-select','data-slot':slot,'aria-label':`${slot+1}번 특성`}))}</div>` : ''}</section>`;
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
      renderMatchupCoverageInputs();
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
  const pool = (p?.ls || []).map(id => MoveById[id]).filter(Boolean);
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
  const container=document.getElementById('matchupCoverageInputs');
  if(!container) return;
  renderMatchupCoverageField();
  if(matchupMode!=='coverage') { renderTrustedHTML(container,''); return; }
  renderTrustedHTML(container,matchupSlots.map((id,slot)=>{
    const p=PokemonById[id];
    if(!p) return '';
    return `<section class="matchup-coverage-card ui-surface"><div class="section-heading"><h3>${escapeHTML(pkName(p))}</h3><span class="type-list">${renderToolTypePills(p.types)}</span></div><div class="matchup-move-grid">${matchupCoverageMoves[slot].map((id,moveIndex)=>{
      const m=MoveById[id];
      return `<div class="matchup-move-field"><span class="matchup-move-num">${moveIndex+1}</span><div class="combobox">${RotomUI.trigger(`<span class="picker-label">${escapeHTML(m ? mvName(m) : '기술 선택')}</span><span class="matchup-move-type-slot">${m ? renderToolTypePills([coverageMoveType(slot,m)]) : ''}</span>`,{'data-slot':slot,'data-move-index':moveIndex,'data-cb-type':'move','data-field':`matchup-move-${slot}-${moveIndex}`,value:m ? mvName(m) : '','aria-label':`${pkName(p)} ${moveIndex+1}번 기술`},'cb-input cb-trigger matchup-move-input')}<div class="combobox-options" role="listbox"></div></div><button type="button" class="ui-button icon-button matchup-move-clear" data-slot="${slot}" data-move-index="${moveIndex}" aria-label="${moveIndex+1}번 기술 비우기" ${m ? '' : 'disabled'}>${RotomUI.icon('close')}</button></div>`;
    }).join('')}</div></section>`;
  }).join(''));
  wireMatchupCoverageInputs();
}

function wireMatchupCoverageInputs() {
  const container=document.getElementById('matchupCoverageInputs');
  if(!container) return;
  container.querySelectorAll('.matchup-move-input').forEach(input=>{
    const slot=Number(input.dataset.slot),index=Number(input.dataset.moveIndex),list=input.closest('.combobox')?.querySelector('.combobox-options');
    if(!list) return;
    const combo=wireSharedComboboxKeyboard(input,list,{
      showOptions:query=>renderTrustedHTML(list,matchupMoveOptionRows(slot,index,query) || '<div class="combobox-option empty">검색 결과 없음</div>'),
      onSelect:option=>{
        const id=option.dataset.id || '';
        matchupCoverageMoves[slot][index]=coverageMovePool(slot).some(m=>m.id===id) ? id : null;
        renderMatchupCoverageInputs();renderMatchupTable();
      },
    });
    input.addEventListener('click',()=>combo.open(''));
  });
  container.querySelectorAll('.matchup-move-clear').forEach(button=>button.addEventListener('click',()=>{
    matchupCoverageMoves[Number(button.dataset.slot)][Number(button.dataset.moveIndex)]=null;
    renderMatchupCoverageInputs();renderMatchupTable();
  }));
}

function renderMatchupCoverageField() {
  const box = document.getElementById('matchupCoverageField');
  if (!box) return;
  box.hidden = matchupMode !== 'coverage';
  for (const key of ['weather', 'terrain']) {
    const select = document.getElementById(`matchup-${key}`);
    if (!select) continue;
    select.value = matchupCoverageField[key];
    select.onchange = () => {
      matchupCoverageField[key] = select.value;
      renderMatchupCoverageInputs();
      renderMatchupTable();
    };
  }
}

function renderMatchupLegend() {
  const box=document.getElementById('matchupLegend');
  if(!box) return;
  if(matchupMode==='coverage') {
    const entries=selectedMatchupEntries(),entered=entries.filter(({slot})=>coverageSlotMoves(slot).length).length;
    renderTrustedHTML(box,`<span>기술 입력 ${entered} / ${entries.length}</span><span>1 보유 · 0 없음 · — 미입력</span><span>타입당 포켓몬 수 · 특성·날씨·필드 반영</span>`);
    return;
  }
  const conditional=[...new Set(selectedMatchupEntries().filter(({abilityId})=>{
    const data=abilityData(abilityId);
    return data.defenseStatBoosts?.length || [...(data.defensiveAttackMods || []),...(data.defensiveFinalMods || []),...(data.immunities || [])].some(rule=>!matchupTypeRule(rule));
  }).map(({abilityId})=>abName(abilityData(abilityId))))];
  renderTrustedHTML(box,`<span>타입·선택 특성 반영</span><span>마릿수: 약점 / 반감 / 무효</span>${conditional.length ? `<span>조건부 효과 제외: ${escapeHTML(conditional.join(', '))}</span>` : ''}`);
}

function renderMatchupTable() {
  if (matchupMode === 'coverage') renderCoverageMatchupTable();
  else renderDefenseMatchupTable();
  renderMatchupLegend();
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
  table.style.minWidth = `${MATCHUP_COL.type + entries.length * MATCHUP_COL.slot + summaryWidth}px`;
  table.dataset.selectedCount = String(entries.length);
  table.classList.toggle('matchup-table-compact', entries.length <= 3);
}

function renderDefenseMatchupTable() {
  const table = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!table || !head || !body) return;
  const entries = selectedMatchupEntries();
  configureMatchupTable(table, entries, MATCHUP_COL.summary);
  renderTrustedHTML(head, `<tr><th scope="col" class="matchup-type-head">공격 타입</th>
    ${entries.map(({ pokemon }) => `<th scope="col" title="${escapeHTML(pkName(pokemon))}">${escapeHTML(pkName(pokemon))}</th>`).join('')}
    <th scope="col" class="summary">마릿수<small>약점 / 반감 / 무효</small></th></tr>`);
  if (!entries.length) {
    renderTrustedHTML(body, '<tr><td colspan="2" class="empty-state-cell">포켓몬을 선택하면 방어 상성을 표시합니다.</td></tr>');
    return;
  }
  renderTrustedHTML(body, BATTLE_TYPES.map(type => {
    const cells = entries.map(entry => {
      const { eff, typeEffect, ability } = matchupDefenseEffect(type, entry);
      const cls = eff === 0 ? 'eff-0' : eff >= 4 ? 'eff-4' : eff > 1 ? 'eff-2' : eff <= 0.25 ? 'eff-025' : eff < 1 ? 'eff-05' : '';
      return `<td class="${cls}" title="타입 ${typeEffect}배${ability ? ` · ${escapeHTML(abName(ability))} 반영` : ''}">${eff}×${ability ? `<small class="matchup-ability-note">${escapeHTML(abName(ability))}</small>` : ''}</td>`;
    }).join('');
    const profile = defenseTypeProfile(type, entries);
    return `<tr><th scope="row"><span class="type-pill matchup-table-type t-${type}">${TYPE_KO[type]}</span></th>${cells}
      <td class="summary" aria-label="약점 ${profile.weakCount}마리, 반감 ${profile.resistCount}마리, 무효 ${profile.immuneCount}마리">${profile.weakCount} / ${profile.resistCount} / ${profile.immuneCount}</td></tr>`;
  }).join(''));
}

function renderCoverageMatchupTable() {
  const table = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!table || !head || !body) return;
  const entries = selectedMatchupEntries();
  const entered = entries.filter(({ slot }) => coverageSlotMoves(slot).length).length;
  configureMatchupTable(table, entries, MATCHUP_COL.coverageSummary);
  renderTrustedHTML(head, `<tr><th scope="col" class="matchup-type-head">기술 타입</th>
    ${entries.map(({ pokemon }) => `<th scope="col" title="${escapeHTML(pkName(pokemon))}">${escapeHTML(pkName(pokemon))}</th>`).join('')}
    <th scope="col" class="summary">보유 수</th></tr>`);
  if (!entered) {
    renderTrustedHTML(body, `<tr><td colspan="${entries.length + 2}" class="empty-state-cell">${entries.length ? '사용할 공격 기술을 입력하면 타입별 보유 수를 표시합니다.' : '포켓몬을 선택하고 공격 기술을 입력하세요.'}</td></tr>`);
    return;
  }
  renderTrustedHTML(body, BATTLE_TYPES.map(type => {
    const cells = entries.map(({ slot }) => {
      if (!coverageSlotMoves(slot).length) return '<td class="coverage-pending" aria-label="기술 입력 전">—</td>';
      const count = coverageCountByType(type, slot);
      return `<td class="${count ? 'coverage-hit' : 'coverage-none'}">${count}</td>`;
    }).join('');
    const total = coverageCountByType(type);
    return `<tr><th scope="row"><span class="type-pill matchup-table-type t-${type}">${TYPE_KO[type]}</span></th>${cells}
      <td class="summary ${total ? 'coverage-hit' : 'coverage-none'}">${total}</td></tr>`;
  }).join(''));
}



let bind0420MatchupBound = false;
function bind0420Matchup() {
  if (bind0420MatchupBound) return;
  bind0420MatchupBound = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', updateMatchupScrollHint);
  }
}

export { matchupSlots, matchupAbilities, matchupCoverageMoves, matchupMode, matchupCoverageField, MATCHUP_COL, matchupAbilityIds, matchupDefaultAbilityId, matchupSelectedAbilityId, matchupFormOptions, matchupSameFormFamily, matchupResolveItemForm, matchupSetSlotPokemon, matchupTypeRule, matchupDefenseEffect, defenseTypeProfile, coverageSlotMoves, coverageSlotHasType, coverageMoveType, coverageCountByType, renderMatchupModeTabs, renderMatchupSlots, wireMatchupSlots, coverageMovePool, matchupMoveMatchesQuery, matchupMoveOptionRows, renderMatchupCoverageInputs, wireMatchupCoverageInputs, renderMatchupCoverageField, renderMatchupLegend, renderMatchupTable, updateMatchupScrollHint, wireMatchupScrollHint, replaceMatchupColgroup, selectedMatchupEntries, configureMatchupTable, renderDefenseMatchupTable, renderCoverageMatchupTable, bind0420MatchupBound, bind0420Matchup };
