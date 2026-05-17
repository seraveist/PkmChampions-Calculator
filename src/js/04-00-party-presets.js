const PARTY_PRESET_STORAGE_KEY = 'pkmChampions.partyPresets.v1';
const PARTY_PRESET_MAX_PARTIES = 10;
const PARTY_PRESET_MAX_MEMBERS = 6;
const PARTY_PRESET_STAT_LABEL = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };
const PARTY_PRESET_SHOWDOWN_STAT_LABEL = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const PARTY_PRESET_SHOWDOWN_STAT_ALIAS = {
  hp: 'hp', h: 'hp',
  atk: 'atk', attack: 'atk', a: 'atk',
  def: 'def', defense: 'def', b: 'def',
  spa: 'spa', spatk: 'spa', spattack: 'spa', specialattack: 'spa', c: 'spa',
  spd: 'spd', spdef: 'spd', spdefense: 'spd', specialdefense: 'spd', d: 'spd',
  spe: 'spe', speed: 'spe', s: 'spe',
};

let partyPresetData = loadPartyPresetData();
let partyPresetModalReady = false;
let partyPresetTextState = { partyIndex: 0, mode: 'import' };
let partyPresetPickerTarget = '';
const partyPresetCollapsedParties = new Set(Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, index) => index));
const partyPresetExpandedSlots = new Set();

function partyPresetSlotCollapseKey(partyIndex, slotIndex) {
  return `${partyIndex}:${slotIndex}`;
}

function blankPartyPresetMember() {
  return {
    pokemon: '',
    ability: '',
    item: '',
    nature: 'hardy',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: ['', '', '', ''],
  };
}

function blankPartyPresetData() {
  return {
    version: 1,
    parties: Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, index) => ({
      name: `파티 ${index + 1}`,
      members: Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, blankPartyPresetMember),
    })),
  };
}

function normalizePartyPresetMember(member = {}) {
  const evs = {};
  STATS.forEach(stat => {
    const value = Number(member.evs?.[stat] ?? 0);
    evs[stat] = Math.max(0, Math.min(32, Number.isFinite(value) ? value : 0));
  });
  const moves = Array.from({ length: 4 }, (_, index) => member.moves?.[index] || '');
  return {
    pokemon: PokemonById[member.pokemon] ? member.pokemon : '',
    ability: member.ability && AbilityById[member.ability] ? member.ability : '',
    item: member.item && ItemById[member.item] ? member.item : '',
    nature: NATURE_BY_ID[member.nature] ? member.nature : 'hardy',
    evs,
    moves,
  };
}

function normalizePartyPresetData(data) {
  const fallback = blankPartyPresetData();
  const parties = Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, partyIndex) => {
    const party = data?.parties?.[partyIndex] || {};
    return {
      name: party.name || `파티 ${partyIndex + 1}`,
      members: Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, slotIndex) => (
        normalizePartyPresetMember(party.members?.[slotIndex] || fallback.parties[partyIndex].members[slotIndex])
      )),
    };
  });
  return { version: 1, parties };
}

function loadPartyPresetData() {
  try {
    const raw = localStorage.getItem(PARTY_PRESET_STORAGE_KEY);
    if (!raw) return blankPartyPresetData();
    return normalizePartyPresetData(JSON.parse(raw));
  } catch {
    return blankPartyPresetData();
  }
}

function savePartyPresetData() {
  try {
    localStorage.setItem(PARTY_PRESET_STORAGE_KEY, JSON.stringify(partyPresetData));
  } catch {
    // localStorage unavailable: keep the in-memory data for the current session.
  }
}

function setPartyPresetStatus(message = '', tone = '') {
  const status = document.getElementById('partyPresetStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone || '';
}

function partyPresetExportPayload() {
  const normalized = normalizePartyPresetData(partyPresetData);
  return {
    format: 'pokechamps-lab-party-presets',
    version: 1,
    exportedAt: new Date().toISOString(),
    parties: normalized.parties,
  };
}

function partyPresetDownloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportPartyPresetJson() {
  const payload = partyPresetExportPayload();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  partyPresetDownloadText(
    JSON.stringify(payload, null, 2),
    `pokechamps-party-presets-${date}.json`,
    'application/json;charset=utf-8'
  );
  setPartyPresetStatus('JSON 내보내기 완료', 'success');
}

async function importPartyPresetJsonFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.data?.parties ? parsed.data : parsed;
    if (!Array.isArray(data?.parties)) throw new Error('Invalid party preset JSON');
    partyPresetData = normalizePartyPresetData(data);
    savePartyPresetData();
    renderPartyPresetModal();
    setPartyPresetStatus('JSON 가져오기 완료', 'success');
  } catch {
    setPartyPresetStatus('JSON 형식을 확인해 주세요', 'error');
  }
}

async function partyPresetCopyOrDownload(text, filename) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    setPartyPresetStatus('Showdown 텍스트 복사 완료', 'success');
  } catch {
    partyPresetDownloadText(text, filename);
    setPartyPresetStatus('Showdown 텍스트 파일 저장 완료', 'success');
  }
}

function partyPresetMember(partyIndex, slotIndex) {
  return partyPresetData.parties?.[partyIndex]?.members?.[slotIndex] || blankPartyPresetMember();
}

function partyPresetMemberClone(member) {
  return normalizePartyPresetMember(member || blankPartyPresetMember());
}

function partyPresetFilledMembers(party) {
  return (party?.members || [])
    .map((member, slotIndex) => ({ member: partyPresetMemberClone(member), slotIndex }))
    .filter(entry => entry.member.pokemon && PokemonById[entry.member.pokemon]);
}

function partyPresetMemberMoves(member) {
  return Array.from({ length: 4 }, (_, index) => {
    const moveId = member?.moves?.[index] || '';
    return MoveById[moveId] ? moveId : '';
  });
}

function partyPresetAttackingMoves(member) {
  return partyPresetMemberMoves(member).map(moveId => {
    const move = MoveById[moveId];
    return move && move.cat !== 'Status' ? moveId : null;
  });
}

function partyPresetApplyMemberToSideState(side, member) {
  const data = partyPresetMemberClone(member);
  const pokemon = PokemonById[data.pokemon];
  if (!side || !pokemon) return false;
  side.pokemonIdx = data.pokemon;
  side.ability = data.ability || defaultPokemonAbilityId(pokemon);
  side.item = data.item || '';
  side.nature = data.nature || 'hardy';
  side.evs = { ...side.evs, ...data.evs };
  side.types = defaultPokemonTypes(pokemon);
  side.teraType = side.types?.[0] || 'Normal';
  side.tera = false;
  side.moves = partyPresetMemberMoves(data);
  side.moveBpOverrides = [null, null, null, null];
  side.moveTypeOverrides = [null, null, null, null];
  setSideDamageBlockActive?.(side, false);
  return true;
}

function partyPresetApplyMemberToCalc(sideKey, member) {
  const side = state?.[sideKey];
  const pokemonId = member?.pokemon;
  if (!side || !PokemonById[pokemonId]) return false;
  const result = applyPokemonToCalcSide(sideKey, pokemonId, { forceDefaults: true, resetMoves: false });
  partyPresetApplyMemberToSideState(side, member);
  renderSide(sideKey);
  if (result?.resetAutoFields) syncFieldControls?.();
  triggerCalc?.();
  return true;
}

function partyPresetApplyMemberToFineTune(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  ftApplyPokemonToFineTune(member.pokemon);
  partyPresetApplyMemberToSideState(fineTuneState.my, member);
  fineTuneState.weatherAbilityActive = false;
  renderFineTuneAll();
  return true;
}

function partyPresetApplyMemberToRevCalc(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  rcApplyMyPokemonSelection(member.pokemon);
  partyPresetApplyMemberToSideState(revCalcState.my, member);
  revCalcState.myMoveSet = partyPresetMemberMoves(member);
  revCalcState.myMove = revCalcState.myMoveSet.includes(revCalcState.myMove) ? revCalcState.myMove : '';
  revCalcState.myMoveBp = '';
  renderRevCalcAll();
  return true;
}

function partyPresetApplyPartyToMatchup(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  Array.from({ length: PARTY_PRESET_MAX_MEMBERS }).forEach((_, slotIndex) => {
    const member = partyPresetMemberClone(party.members?.[slotIndex]);
    matchupSlots[slotIndex] = member.pokemon && PokemonById[member.pokemon] ? member.pokemon : null;
    matchupCoverageMoves[slotIndex] = matchupSlots[slotIndex]
      ? partyPresetAttackingMoves(member)
      : [null, null, null, null];
  });
  renderMatchupSlots();
  renderMatchupCoverageInputs();
  renderMatchupTable();
  return true;
}

function partyPresetApplyPickerMember(target, member) {
  if (target === 'calc:atk') return partyPresetApplyMemberToCalc('atk', member);
  if (target === 'calc:def') return partyPresetApplyMemberToCalc('def', member);
  if (target === 'finetune:my') return partyPresetApplyMemberToFineTune(member);
  if (target === 'revcalc:my') return partyPresetApplyMemberToRevCalc(member);
  return false;
}

function partyPresetDefaultAbility(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  const first = Object.values(pokemon?.ab || {})[0];
  return first ? toId(first) : '';
}

function partyPresetDefaultItem(pokemonId) {
  return defaultPokemonItemId(PokemonById[pokemonId]);
}

function partyPresetLookupByText(collection, byId, text) {
  const key = toId(text);
  if (!key) return null;
  if (byId[key]) return byId[key];
  return collection.find(entry => (
    toId(entry?.id) === key ||
    toId(entry?.name) === key ||
    toId(entry?.koName) === key
  )) || null;
}

function partyPresetPokemonFromShowdownName(text) {
  let name = String(text || '').trim();
  name = name.replace(/\s+\((?:M|F)\)$/i, '').trim();
  const nicknameMatch = name.match(/\(([^()]+)\)\s*$/);
  if (nicknameMatch && !/^(?:M|F)$/i.test(nicknameMatch[1])) {
    name = nicknameMatch[1].trim();
  }
  return partyPresetLookupByText(POKEMON, PokemonById, name);
}

function partyPresetNatureFromText(text) {
  const key = toId(text);
  if (!key) return null;
  return NATURE_BY_ID[key] || NATURES.find(nature => (
    toId(nature?.id) === key ||
    toId(nature?.name) === key ||
    toId(nature?.ko) === key
  )) || null;
}

function partyPresetParseShowdownEvs(text) {
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  String(text || '').split('/').forEach(part => {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) return;
    const value = Math.max(0, Math.min(32, parseInt(match[1], 10) || 0));
    const stat = PARTY_PRESET_SHOWDOWN_STAT_ALIAS[toId(match[2])];
    if (stat) evs[stat] = value;
  });
  return evs;
}

function partyPresetParseShowdownSet(block) {
  const lines = String(block || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const member = blankPartyPresetMember();
  const firstLine = lines[0];
  const [pokemonText, itemText = ''] = firstLine.split(/\s+@\s+/, 2);
  const pokemon = partyPresetPokemonFromShowdownName(pokemonText);
  if (!pokemon) return null;

  member.pokemon = pokemon.id;
  member.ability = partyPresetDefaultAbility(pokemon.id);
  member.item = partyPresetDefaultItem(pokemon.id);

  const item = partyPresetLookupByText(ITEMS, ItemById, itemText);
  if (item) member.item = item.id;

  const moves = [];
  lines.slice(1).forEach(line => {
    const abilityMatch = line.match(/^Ability:\s*(.+)$/i);
    if (abilityMatch) {
      const ability = partyPresetLookupByText(ABILITIES, AbilityById, abilityMatch[1]);
      if (ability) member.ability = ability.id;
      return;
    }

    const evMatch = line.match(/^EVs:\s*(.+)$/i);
    if (evMatch) {
      member.evs = partyPresetParseShowdownEvs(evMatch[1]);
      return;
    }

    const natureMatch = line.match(/^(.+?)\s+Nature$/i);
    if (natureMatch) {
      const nature = partyPresetNatureFromText(natureMatch[1]);
      if (nature) member.nature = nature.id;
      return;
    }

    const moveMatch = line.match(/^-\s*(.+)$/);
    if (moveMatch && moves.length < 4) {
      const move = partyPresetLookupByText(MOVES, MoveById, moveMatch[1]);
      moves.push(move?.id || '');
    }
  });

  member.moves = Array.from({ length: 4 }, (_, index) => moves[index] || '');
  return normalizePartyPresetMember(member);
}

function partyPresetParseShowdownParty(text) {
  const blocks = String(text || '').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  return blocks
    .map(partyPresetParseShowdownSet)
    .filter(Boolean)
    .slice(0, PARTY_PRESET_MAX_MEMBERS);
}

function partyPresetNatureShowdownName(natureId) {
  const nature = NATURE_BY_ID[natureId];
  const raw = nature?.name || nature?.id || 'hardy';
  return String(raw).charAt(0).toUpperCase() + String(raw).slice(1);
}

function partyPresetExportShowdownSet(member) {
  const pokemon = PokemonById[member?.pokemon];
  if (!pokemon) return '';

  const item = member.item ? ItemById[member.item] : null;
  const ability = member.ability ? AbilityById[member.ability] : null;
  const lines = [`${pokemon.name}${item ? ` @ ${item.name}` : ''}`];
  if (ability) lines.push(`Ability: ${ability.name}`);

  const evParts = STATS
    .filter(stat => Number(member.evs?.[stat] || 0) > 0)
    .map(stat => `${member.evs[stat]} ${PARTY_PRESET_SHOWDOWN_STAT_LABEL[stat]}`);
  if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);

  lines.push(`${partyPresetNatureShowdownName(member.nature)} Nature`);
  (member.moves || []).slice(0, 4).forEach(moveId => {
    const move = MoveById[moveId];
    if (move) lines.push(`- ${move.name}`);
  });
  return lines.join('\n');
}

function partyPresetExportShowdownParty(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return '';
  return party.members
    .map(partyPresetExportShowdownSet)
    .filter(Boolean)
    .join('\n\n');
}

function importPartyPresetShowdownText(partyIndex, text) {
  const members = partyPresetParseShowdownParty(text);
  if (!members.length) {
    setPartyPresetStatus('Showdown 텍스트에서 포켓몬을 찾지 못했습니다', 'error');
    return false;
  }
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  party.members = Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, index) => (
    members[index] || blankPartyPresetMember()
  ));
  partyPresetData = normalizePartyPresetData(partyPresetData);
  savePartyPresetData();
  renderPartyPresetModal();
  setPartyPresetStatus(`파티 ${partyIndex + 1} Showdown 텍스트 가져오기 완료`, 'success');
  return true;
}

function partyPresetMovePool(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  const pool = pokemon?.ls?.length ? pokemon.ls.map(id => MoveById[id]).filter(Boolean) : MOVES;
  return sortMovesForCalcSelect(pool);
}

function partyPresetSearch(query, ...terms) {
  const needle = calcSearchText(query).trim();
  if (!needle) return true;
  return calcMatches(needle, ...terms);
}

function partyPresetOptionHtml(id, label, selected = false, extra = '') {
  return `<div class="combobox-option party-preset-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${extra}</div>`;
}

function renderPartyPresetPokemonOption(pokemon, currentId) {
  const typeHtml = (pokemon.types || []).map(type => `<span class="type-pill matchup-type-pill t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`).join('');
  return partyPresetOptionHtml(
    pokemon.id,
    pkName(pokemon),
    pokemon.id === currentId,
    `<small class="party-preset-option-types">${typeHtml}</small>`
  );
}

function renderPartyPresetMoveOption(move, currentId) {
  if (!move?.id) return partyPresetOptionHtml('', '없음', !currentId);
  return partyPresetOptionHtml(move.id, mvName(move), move.id === currentId);
}

function renderPartyPresetGenericOption(option, currentId) {
  const label = option.label || option.koName || option.name || option.id || '없음';
  return partyPresetOptionHtml(option.id || '', label, String(option.id || '') === String(currentId || ''));
}

function partyPresetOptions(type, member, query) {
  if (type === 'pokemon') {
    return sortPokemonForCalcSelect(POKEMON)
      .filter(pokemon => partyPresetSearch(query, pokemon.koName || pkName(pokemon)));
  }
  if (type === 'ability') {
    return calcAbilityOptionDataForPokemon(member.pokemon, member.ability, { includeEmpty: true })
      .filter(option => partyPresetSearch(query, option.id, option.label, option.sub));
  }
  if (type === 'item') {
    return calcItemOptionData({ includeEmpty: true })
      .filter(option => partyPresetSearch(query, option.id, option.label, option.sub));
  }
  if (type === 'nature') {
    return calcNatureOptionData()
      .filter(option => partyPresetSearch(query, option.id, option.label, option.sub));
  }
  if (type === 'move') {
    const empty = [{ id: '', label: '없음' }];
    return [...empty, ...partyPresetMovePool(member.pokemon)]
      .filter(option => partyPresetSearch(query, option.koName || option.label || mvName(option)));
  }
  return [];
}

function partyPresetCurrentLabel(type, member, moveIndex = null) {
  if (type === 'pokemon') return member.pokemon && PokemonById[member.pokemon] ? pkName(PokemonById[member.pokemon]) : '';
  if (type === 'ability') return member.ability && AbilityById[member.ability] ? abName(AbilityById[member.ability]) : '없음';
  if (type === 'item') return member.item && ItemById[member.item] ? itName(ItemById[member.item]) : '없음';
  if (type === 'nature') return calcNatureLabel(NATURE_BY_ID[member.nature]);
  if (type === 'move') {
    const id = member.moves?.[moveIndex] || '';
    return id && MoveById[id] ? mvName(MoveById[id]) : '';
  }
  return '';
}

function renderPartyPresetOptions(type, member, query, currentId) {
  const options = partyPresetOptions(type, member, query);
  if (!options.length) return '<div class="combobox-option empty" aria-disabled="true"><b>검색 결과 없음</b></div>';
  return options.map(option => {
    if (type === 'pokemon') return renderPartyPresetPokemonOption(option, currentId);
    if (type === 'move') return renderPartyPresetMoveOption(option, currentId);
    return renderPartyPresetGenericOption(option, currentId);
  }).join('');
}

function partyPresetComboboxHtml({ partyIndex, slotIndex, type, value, label = '', moveIndex = '' }) {
  const safeMoveIndex = moveIndex === '' ? '' : ` data-move-index="${moveIndex}"`;
  return `
    <div class="combobox party-preset-combobox" data-party-preset-combobox="${type}">
      <input type="text" class="cb-input party-preset-input" value="${escapeHTML(label)}"
        data-party-index="${partyIndex}" data-slot-index="${slotIndex}" data-preset-field="${type}"${safeMoveIndex}
        data-value="${escapeHTML(value || '')}" placeholder="${type === 'pokemon' ? '포켓몬 선택' : '선택'}" autocomplete="off" aria-expanded="false">
      <div class="combobox-options" role="listbox"></div>
    </div>
  `;
}

function partyPresetNatureMark(stat, natureId) {
  const nature = NATURE_BY_ID?.[natureId];
  if (nature?.up === stat) return '<span class="party-preset-nature-mark up" aria-label="상승">&#9650;</span>';
  if (nature?.down === stat) return '<span class="party-preset-nature-mark down" aria-label="하락">&#9660;</span>';
  return '<span class="party-preset-nature-mark empty" aria-hidden="true"></span>';
}

function renderPartyPresetSlot(member, partyIndex, slotIndex) {
  const pokemon = member.pokemon ? PokemonById[member.pokemon] : null;
  const evTotal = STATS.reduce((sum, stat) => sum + (member.evs?.[stat] || 0), 0);
  const slotKey = partyPresetSlotCollapseKey(partyIndex, slotIndex);
  const isCollapsed = pokemon && !partyPresetExpandedSlots.has(slotKey);
  return `
    <div class="party-preset-slot ${pokemon ? 'filled' : ''}${isCollapsed ? ' collapsed' : ''}" data-party-index="${partyIndex}" data-slot-index="${slotIndex}">
      <div class="party-preset-slot-head">
        <span class="party-preset-slot-label">슬롯 ${slotIndex + 1}</span>
        ${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'pokemon', value: member.pokemon, label: partyPresetCurrentLabel('pokemon', member) })}
        <button class="party-preset-clear" type="button" data-party-index="${partyIndex}" data-slot-index="${slotIndex}" ${pokemon ? '' : 'disabled'}>비우기</button>
      </div>
      ${pokemon ? `
        <div class="party-preset-detail">
          <div class="party-preset-divider" aria-hidden="true"></div>
          <div class="party-preset-detail-row party-preset-detail-row-3">
            <label><span>특성</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'ability', value: member.ability, label: partyPresetCurrentLabel('ability', member) })}</label>
            <label><span>성격</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'nature', value: member.nature, label: partyPresetCurrentLabel('nature', member) })}</label>
            <label><span>도구</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'item', value: member.item, label: partyPresetCurrentLabel('item', member) })}</label>
          </div>
          <div class="party-preset-divider" aria-hidden="true"></div>
          <div class="party-preset-ev-row">
            <span class="party-preset-ev-total">
              <span>총합</span>
              <span><b>${evTotal}</b>/66</span>
            </span>
            ${STATS.map(stat => `
              <label class="party-preset-ev-cell">
                <span class="party-preset-ev-head">
                  <span>${PARTY_PRESET_STAT_LABEL[stat]}</span>
                  ${partyPresetNatureMark(stat, member.nature)}
                </span>
                <input type="text" class="party-preset-ev-input" data-party-index="${partyIndex}" data-slot-index="${slotIndex}" data-preset-ev="${stat}" value="${member.evs?.[stat] || 0}" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
              </label>
            `).join('')}
          </div>
          <div class="party-preset-divider" aria-hidden="true"></div>
          <div class="party-preset-move-row">
            ${[0, 1, 2, 3].map(moveIndex => `
              <label><span>기술 ${moveIndex + 1}</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'move', value: member.moves?.[moveIndex] || '', label: partyPresetCurrentLabel('move', member, moveIndex), moveIndex })}</label>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPartyPresetModal() {
  ensurePartyPresetModal();
  const body = document.getElementById('partyPresetBody');
  if (!body) return;
  body.innerHTML = partyPresetData.parties.map((party, partyIndex) => {
    const isCollapsed = partyPresetCollapsedParties.has(partyIndex);
    const filledCount = partyPresetFilledMembers(party).length;
    return `
    <section class="party-preset-party ${isCollapsed ? 'collapsed' : ''}" data-party-index="${partyIndex}">
      <div class="party-preset-party-head">
        <div class="party-preset-party-title">
          <h3>${escapeHTML(party.name || `파티 ${partyIndex + 1}`)}</h3>
          <span class="party-preset-party-count">${filledCount}/6</span>
        </div>
        <div class="party-preset-party-actions">
          <button type="button" class="party-preset-party-action" data-party-showdown-import="${partyIndex}">텍스트 가져오기</button>
          <button type="button" class="party-preset-party-action" data-party-showdown-export="${partyIndex}">텍스트 내보내기</button>
        </div>
      </div>
      <div class="party-preset-slot-grid">
        ${party.members.map((member, slotIndex) => renderPartyPresetSlot(member, partyIndex, slotIndex)).join('')}
      </div>
    </section>
    `;
  }).join('');
  wirePartyPresetInputs();
}

function ensurePartyPresetModal() {
  if (document.getElementById('partyPresetModal')) return;
  const modal = document.createElement('div');
  modal.id = 'partyPresetModal';
  modal.className = 'party-preset-modal-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="party-preset-modal" role="dialog" aria-modal="true" aria-labelledby="partyPresetTitle">
      <div class="party-preset-modal-head">
        <div>
          <div class="party-preset-eyebrow">PARTY PRESET</div>
          <h2 id="partyPresetTitle">파티 프리셋</h2>
        </div>
        <div class="party-preset-modal-actions">
          <span class="party-preset-status" id="partyPresetStatus" aria-live="polite"></span>
          <button type="button" class="party-preset-action" id="partyPresetImport">JSON 가져오기</button>
          <button type="button" class="party-preset-action" id="partyPresetExport">JSON 내보내기</button>
          <button type="button" class="party-preset-close" id="partyPresetClose">닫기</button>
          <input type="file" id="partyPresetImportFile" accept=".json,application/json" hidden>
        </div>
      </div>
      <div class="party-preset-modal-body" id="partyPresetBody"></div>
      <div class="party-preset-text-dialog" id="partyPresetTextDialog" hidden>
        <div class="party-preset-text-card">
          <div class="party-preset-text-head">
            <h3 id="partyPresetTextTitle">Showdown 텍스트</h3>
            <button type="button" class="party-preset-close" id="partyPresetTextClose">닫기</button>
          </div>
          <textarea id="partyPresetTextArea" class="party-preset-textarea" spellcheck="false"></textarea>
          <div class="party-preset-text-actions">
            <button type="button" class="party-preset-action" id="partyPresetTextApply">가져오기 적용</button>
            <button type="button" class="party-preset-action" id="partyPresetTextCopy">복사</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openPartyPresetModal() {
  renderPartyPresetModal();
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  setPartyPresetStatus('');
  modal.hidden = false;
  document.body.classList.add('party-preset-open');
}

function closePartyPresetModal() {
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  closePartyPresetTextDialog();
  modal.hidden = true;
  document.body.classList.remove('party-preset-open');
}

function ensurePartyPresetPickerModal() {
  if (document.getElementById('partyPresetPickerModal')) return;
  const modal = document.createElement('div');
  modal.id = 'partyPresetPickerModal';
  modal.className = 'party-preset-picker-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="party-preset-picker" role="dialog" aria-modal="true" aria-labelledby="partyPresetPickerTitle">
      <div class="party-preset-picker-head">
        <div>
          <div class="party-preset-eyebrow">PARTY LOAD</div>
          <h2 id="partyPresetPickerTitle">불러오기</h2>
        </div>
        <button type="button" class="party-preset-close" id="partyPresetPickerClose">닫기</button>
      </div>
      <div class="party-preset-picker-body" id="partyPresetPickerBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function partyPresetPickerMode(target) {
  return target === 'matchup' ? 'party' : 'member';
}

function renderPartyPresetPicker() {
  ensurePartyPresetPickerModal();
  const body = document.getElementById('partyPresetPickerBody');
  const title = document.getElementById('partyPresetPickerTitle');
  if (!body || !title) return;
  const mode = partyPresetPickerMode(partyPresetPickerTarget);
  title.textContent = mode === 'party' ? '파티 불러오기' : '포켓몬 불러오기';

  if (mode === 'party') {
    body.innerHTML = `
      <div class="party-preset-picker-party-grid">
        ${partyPresetData.parties.map((party, partyIndex) => {
          const members = partyPresetFilledMembers(party);
          const labels = members.map(entry => pkName(PokemonById[entry.member.pokemon])).join(' · ');
          return `
            <button type="button" class="party-preset-picker-party ${members.length ? '' : 'empty'}" data-party-picker-party="${partyIndex}" ${members.length ? '' : 'disabled'}>
              <b>${escapeHTML(party.name || `파티 ${partyIndex + 1}`)}</b>
              <span>${members.length ? escapeHTML(labels) : '저장된 포켓몬 없음'}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
    return;
  }

  body.innerHTML = partyPresetData.parties.map((party, partyIndex) => {
    const members = partyPresetFilledMembers(party);
    return `
      <section class="party-preset-picker-section">
        <div class="party-preset-picker-section-head">${escapeHTML(party.name || `파티 ${partyIndex + 1}`)}</div>
        <div class="party-preset-picker-member-grid">
          ${members.length ? members.map(({ member, slotIndex }) => {
            const pokemon = PokemonById[member.pokemon];
            return `
              <button type="button" class="party-preset-picker-member" data-party-picker-party="${partyIndex}" data-party-picker-slot="${slotIndex}">
                <span>슬롯 ${slotIndex + 1}</span>
                <b>${escapeHTML(pkName(pokemon))}</b>
              </button>
            `;
          }).join('') : '<div class="party-preset-picker-empty">저장된 포켓몬 없음</div>'}
        </div>
      </section>
    `;
  }).join('');
}

function openPartyPresetPicker(target) {
  ensurePartyPresetPickerModal();
  partyPresetPickerTarget = target || '';
  renderPartyPresetPicker();
  const modal = document.getElementById('partyPresetPickerModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('party-preset-open');
}

function closePartyPresetPicker() {
  const modal = document.getElementById('partyPresetPickerModal');
  if (modal) modal.hidden = true;
  partyPresetPickerTarget = '';
  if (document.getElementById('partyPresetModal')?.hidden !== false) {
    document.body.classList.remove('party-preset-open');
  }
}

function applyPartyPresetPickerSelection(partyIndex, slotIndex = null) {
  let applied = false;
  if (partyPresetPickerMode(partyPresetPickerTarget) === 'party') {
    applied = partyPresetApplyPartyToMatchup(partyIndex);
  } else {
    applied = partyPresetApplyPickerMember(
      partyPresetPickerTarget,
      partyPresetMemberClone(partyPresetData.parties?.[partyIndex]?.members?.[slotIndex])
    );
  }
  if (applied) closePartyPresetPicker();
}

function openPartyPresetTextDialog(partyIndex, mode) {
  const dialog = document.getElementById('partyPresetTextDialog');
  const title = document.getElementById('partyPresetTextTitle');
  const area = document.getElementById('partyPresetTextArea');
  const applyButton = document.getElementById('partyPresetTextApply');
  const copyButton = document.getElementById('partyPresetTextCopy');
  if (!dialog || !title || !area) return;

  partyPresetTextState = { partyIndex, mode };
  const partyName = partyPresetData.parties?.[partyIndex]?.name || `파티 ${partyIndex + 1}`;
  const isExport = mode === 'export';
  title.textContent = `${partyName} Showdown 텍스트 ${isExport ? '내보내기' : '가져오기'}`;
  area.value = isExport ? partyPresetExportShowdownParty(partyIndex) : '';
  area.placeholder = 'Showdown 텍스트를 붙여넣어 주세요';
  area.readOnly = isExport;
  if (applyButton) applyButton.hidden = isExport;
  if (copyButton) copyButton.hidden = !isExport;
  dialog.hidden = false;
  requestAnimationFrame(() => {
    area.focus();
    if (isExport) area.select();
  });
}

function closePartyPresetTextDialog() {
  const dialog = document.getElementById('partyPresetTextDialog');
  if (dialog) dialog.hidden = true;
}

function applyPartyPresetTextImport() {
  const area = document.getElementById('partyPresetTextArea');
  if (!area) return;
  if (importPartyPresetShowdownText(partyPresetTextState.partyIndex, area.value)) {
    closePartyPresetTextDialog();
  }
}

function copyPartyPresetTextExport() {
  const area = document.getElementById('partyPresetTextArea');
  if (!area) return;
  const partyIndex = partyPresetTextState.partyIndex;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  partyPresetCopyOrDownload(area.value, `pokechamps-party-${partyIndex + 1}-${date}.txt`);
}

function updatePartyPresetPokemon(partyIndex, slotIndex, pokemonId) {
  const member = partyPresetMember(partyIndex, slotIndex);
  if (!pokemonId) {
    partyPresetData.parties[partyIndex].members[slotIndex] = blankPartyPresetMember();
    return;
  }
  if (member.pokemon !== pokemonId) {
    partyPresetData.parties[partyIndex].members[slotIndex] = {
      ...blankPartyPresetMember(),
      pokemon: pokemonId,
      ability: partyPresetDefaultAbility(pokemonId),
      item: partyPresetDefaultItem(pokemonId),
    };
  }
}

function updatePartyPresetField(partyIndex, slotIndex, field, value, moveIndex = null) {
  const member = partyPresetMember(partyIndex, slotIndex);
  if (field === 'pokemon') {
    updatePartyPresetPokemon(partyIndex, slotIndex, value);
  } else if (field === 'move') {
    member.moves[moveIndex] = value || '';
  } else if (field === 'ability') {
    member.ability = value || '';
  } else if (field === 'item') {
    member.item = value || '';
  } else if (field === 'nature') {
    member.nature = value || 'hardy';
  }
  savePartyPresetData();
}

function updatePartyPresetEv(input) {
  const partyIndex = Number(input.dataset.partyIndex);
  const slotIndex = Number(input.dataset.slotIndex);
  const stat = input.dataset.presetEv;
  const member = partyPresetMember(partyIndex, slotIndex);
  const requested = Math.max(0, Math.min(32, parseInt(input.value, 10) || 0));
  const otherTotal = STATS.reduce((sum, key) => sum + (key === stat ? 0 : (member.evs?.[key] || 0)), 0);
  member.evs[stat] = Math.min(requested, Math.max(0, 66 - otherTotal));
  savePartyPresetData();
  renderPartyPresetModal();
}

function closePartyPresetComboboxes(exceptInput = null) {
  document.querySelectorAll('#partyPresetModal .combobox-options.open').forEach(options => {
    const input = options.closest('.combobox')?.querySelector('.party-preset-input');
    if (input && input === exceptInput) return;
    options.classList.remove('open');
    input?.setAttribute('aria-expanded', 'false');
  });
}

function wirePartyPresetCombobox(input) {
  const wrapper = input.closest('.combobox');
  const optsEl = wrapper?.querySelector('.combobox-options');
  if (!wrapper || !optsEl) return;
  const partyIndex = Number(input.dataset.partyIndex);
  const slotIndex = Number(input.dataset.slotIndex);
  const type = input.dataset.presetField;
  const moveIndex = input.dataset.moveIndex === undefined ? null : Number(input.dataset.moveIndex);
  const member = partyPresetMember(partyIndex, slotIndex);
  const currentId = () => type === 'move' ? (member.moves?.[moveIndex] || '') : (member[type] || '');
  let pointerSelected = false;

  const showOptions = query => {
    closePartyPresetComboboxes(input);
    optsEl.innerHTML = renderPartyPresetOptions(type, member, query, currentId());
    optsEl.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  };
  const selectOption = option => {
    const id = option?.dataset?.id || '';
    optsEl.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    updatePartyPresetField(partyIndex, slotIndex, type, id, moveIndex);
    renderPartyPresetModal();
  };
  const restoreInput = () => {
    const fresh = partyPresetMember(partyIndex, slotIndex);
    input.value = partyPresetCurrentLabel(type, fresh, moveIndex);
  };
  const clearOptionalInput = () => {
    if (!['move', 'ability', 'item'].includes(type)) return false;
    updatePartyPresetField(partyIndex, slotIndex, type, '', moveIndex);
    renderPartyPresetModal();
    return true;
  };
  const handleInvalidInput = () => {
    if (!clearOptionalInput()) restoreInput();
  };

  const combo = wireSharedComboboxKeyboard(input, optsEl, {
    showOptions,
    onSelect: selectOption,
    getQuery: () => input.value || '',
    onInvalidInput: handleInvalidInput,
  });
  input.addEventListener('focus', () => {
    combo?.open('');
    requestAnimationFrame(() => input.select?.());
  });
  input.addEventListener('input', () => combo?.open(input.value || '', { activateFirst: true }));
  input.addEventListener('blur', () => setTimeout(() => {
    if (pointerSelected) {
      pointerSelected = false;
      return;
    }
    if (!String(input.value || '').trim()) {
      if (clearOptionalInput()) return;
      combo?.close();
      restoreInput();
      return;
    }
    combo?.commitTyped();
  }, 180));
  optsEl.addEventListener('mousedown', event => {
    const option = event.target.closest('.combobox-option:not(.empty)');
    if (!option) return;
    event.preventDefault();
    pointerSelected = true;
    combo?.select(option);
  });
}

function wirePartyPresetInputs() {
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  modal.querySelectorAll('.party-preset-input').forEach(wirePartyPresetCombobox);
  modal.querySelectorAll('.party-preset-ev-input').forEach(input => {
    input.addEventListener('change', () => updatePartyPresetEv(input));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
    });
  });
  modal.querySelectorAll('.party-preset-clear').forEach(button => {
    button.addEventListener('click', () => {
      const partyIndex = Number(button.dataset.partyIndex);
      const slotIndex = Number(button.dataset.slotIndex);
      partyPresetData.parties[partyIndex].members[slotIndex] = blankPartyPresetMember();
      partyPresetExpandedSlots.delete(partyPresetSlotCollapseKey(partyIndex, slotIndex));
      savePartyPresetData();
      renderPartyPresetModal();
    });
  });
  modal.querySelectorAll('[data-party-showdown-import]').forEach(button => {
    button.addEventListener('click', () => {
      openPartyPresetTextDialog(Number(button.dataset.partyShowdownImport), 'import');
    });
  });
  modal.querySelectorAll('[data-party-showdown-export]').forEach(button => {
    button.addEventListener('click', () => {
      openPartyPresetTextDialog(Number(button.dataset.partyShowdownExport), 'export');
    });
  });
}

function initPartyPresets() {
  if (partyPresetModalReady) return;
  partyPresetModalReady = true;
  ensurePartyPresetModal();
  ensurePartyPresetPickerModal();
  document.getElementById('partyPresetOpen')?.addEventListener('click', openPartyPresetModal);
  document.getElementById('partyPresetClose')?.addEventListener('click', closePartyPresetModal);
  document.getElementById('partyPresetPickerClose')?.addEventListener('click', closePartyPresetPicker);
  document.getElementById('partyPresetExport')?.addEventListener('click', exportPartyPresetJson);
  document.getElementById('partyPresetImport')?.addEventListener('click', () => {
    document.getElementById('partyPresetImportFile')?.click();
  });
  document.getElementById('partyPresetImportFile')?.addEventListener('change', event => {
    const input = event.currentTarget;
    importPartyPresetJsonFile(input.files?.[0]);
    input.value = '';
  });
  document.getElementById('partyPresetTextClose')?.addEventListener('click', closePartyPresetTextDialog);
  document.getElementById('partyPresetTextApply')?.addEventListener('click', applyPartyPresetTextImport);
  document.getElementById('partyPresetTextCopy')?.addEventListener('click', copyPartyPresetTextExport);
  document.getElementById('partyPresetModal')?.addEventListener('mousedown', event => {
    if (event.target?.id === 'partyPresetModal') closePartyPresetModal();
  });
  document.getElementById('partyPresetModal')?.addEventListener('click', event => {
    if (event.target.closest('button, input, textarea, select, .combobox, .combobox-options')) return;
    const slotHead = event.target.closest('.party-preset-slot-head');
    if (slotHead) {
      const slot = slotHead.closest('.party-preset-slot');
      const partyIndex = Number(slot?.dataset.partyIndex);
      const slotIndex = Number(slot?.dataset.slotIndex);
      const member = partyPresetMember(partyIndex, slotIndex);
      if (!member?.pokemon || !PokemonById[member.pokemon]) return;
      const key = partyPresetSlotCollapseKey(partyIndex, slotIndex);
      if (partyPresetExpandedSlots.has(key)) partyPresetExpandedSlots.delete(key);
      else partyPresetExpandedSlots.add(key);
      renderPartyPresetModal();
      return;
    }
    const partyHead = event.target.closest('.party-preset-party-head');
    if (partyHead) {
      const partyIndex = Number(partyHead.closest('.party-preset-party')?.dataset.partyIndex);
      if (!Number.isFinite(partyIndex)) return;
      if (partyPresetCollapsedParties.has(partyIndex)) partyPresetCollapsedParties.delete(partyIndex);
      else partyPresetCollapsedParties.add(partyIndex);
      renderPartyPresetModal();
    }
  });
  document.getElementById('partyPresetPickerModal')?.addEventListener('mousedown', event => {
    if (event.target?.id === 'partyPresetPickerModal') closePartyPresetPicker();
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-party-import-target]');
    if (trigger) {
      event.preventDefault();
      openPartyPresetPicker(trigger.dataset.partyImportTarget);
      return;
    }
    const partyButton = event.target.closest('[data-party-picker-party]');
    if (partyButton && document.getElementById('partyPresetPickerModal')?.contains(partyButton)) {
      event.preventDefault();
      const partyIndex = Number(partyButton.dataset.partyPickerParty);
      const slotIndex = partyButton.dataset.partyPickerSlot === undefined ? null : Number(partyButton.dataset.partyPickerSlot);
      applyPartyPresetPickerSelection(partyIndex, slotIndex);
    }
  });
  window.addEventListener('keydown', event => {
    const modal = document.getElementById('partyPresetModal');
    const picker = document.getElementById('partyPresetPickerModal');
    if (event.key === 'Escape' && modal && !modal.hidden) closePartyPresetModal();
    if (event.key === 'Escape' && picker && !picker.hidden) closePartyPresetPicker();
  });
}
