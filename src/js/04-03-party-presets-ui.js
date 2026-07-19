/* Party presets: modal UI and events. */
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
    <div class="party-preset-slot ui-control-frame ui-subframe ${pokemon ? 'filled' : ''}${isCollapsed ? ' collapsed' : ''}" data-party-index="${partyIndex}" data-slot-index="${slotIndex}">
      <div class="party-preset-slot-head">
        <span class="party-preset-slot-label">${slotIndex + 1}</span>
        ${pokemonSpriteSlot(pokemon, { className: 'party-preset-slot-sprite' })}
        ${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'pokemon', value: member.pokemon, label: partyPresetCurrentLabel('pokemon', member) })}
        <button class="party-preset-clear" type="button" data-party-index="${partyIndex}" data-slot-index="${slotIndex}" aria-label="비우기" title="비우기" ${pokemon ? '' : 'disabled'}>&times;</button>
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
    const partyName = normalizePartyPresetName(party.name, partyIndex);
    return `
    <section class="party-preset-party ui-control-frame ui-subframe ${isCollapsed ? 'collapsed' : ''}" data-party-index="${partyIndex}">
      <div class="party-preset-party-head">
        <div class="party-preset-party-title">
          <input type="text" class="party-preset-name-input" data-party-name-index="${partyIndex}" value="${escapeHTML(partyName)}" maxlength="${PARTY_PRESET_MAX_NAME_LENGTH}" aria-label="party ${partyIndex + 1} name">
          <span class="party-preset-party-count">${filledCount}/6</span>
        </div>
        <div class="party-preset-party-actions">
          <button type="button" class="party-preset-party-action" data-party-showdown-import="${partyIndex}">텍스트 가져오기</button>
          <button type="button" class="party-preset-party-action" data-party-showdown-export="${partyIndex}">텍스트 내보내기</button>
          <button type="button" class="party-preset-party-action" data-party-image-export="${partyIndex}">${PARTY_PRESET_LABELS.imageExport}</button>
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
    <div class="party-preset-modal ui-frame" role="dialog" aria-modal="true" aria-labelledby="partyPresetTitle" aria-describedby="partyPresetBackupNote">
      <div class="party-preset-modal-head ui-frame-head">
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
      <div class="party-preset-backup-note" id="partyPresetBackupNote" role="note">
        프리셋은 현재 브라우저에 저장됩니다. 기기 변경이나 브라우저 초기화 전에 JSON 내보내기로 백업하세요.
      </div>
      <div class="party-preset-modal-body ui-frame-body ui-subframe-stack" id="partyPresetBody"></div>
      <div class="party-preset-text-dialog" id="partyPresetTextDialog" role="dialog" aria-modal="true" aria-labelledby="partyPresetTextTitle" hidden>
        <div class="party-preset-text-card ui-frame">
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
  partyPresetModalReturnFocus = document.activeElement;
  setPartyPresetStatus('');
  modal.hidden = false;
  modal.scrollTop = 0;
  document.getElementById('partyPresetBody')?.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('party-preset-open');
  partyPresetFocusLayer(modal.querySelector('.party-preset-modal'), document.getElementById('partyPresetClose'));
}

function closePartyPresetModal() {
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  closePartyPresetTextDialog({ restoreFocus: false });
  modal.hidden = true;
  document.body.classList.remove('party-preset-open');
  const returnFocus = partyPresetModalReturnFocus;
  partyPresetModalReturnFocus = null;
  partyPresetRestoreFocus(returnFocus);
}

function ensurePartyPresetPickerModal() {
  if (document.getElementById('partyPresetPickerModal')) return;
  const modal = document.createElement('div');
  modal.id = 'partyPresetPickerModal';
  modal.className = 'party-preset-picker-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="party-preset-picker ui-frame" role="dialog" aria-modal="true" aria-labelledby="partyPresetPickerTitle">
      <div class="party-preset-picker-head ui-frame-head">
        <div>
          <div class="party-preset-eyebrow">PARTY LOAD</div>
          <h2 id="partyPresetPickerTitle">불러오기</h2>
        </div>
        <button type="button" class="party-preset-close" id="partyPresetPickerClose">닫기</button>
      </div>
      <div class="party-preset-picker-body ui-frame-body ui-subframe-stack" id="partyPresetPickerBody"></div>
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
      <section class="party-preset-picker-section party-preset-picker-party-section ui-control-frame ui-subframe">
        <div class="party-preset-picker-party-grid">
          ${partyPresetData.parties.map((party, partyIndex) => {
            const members = partyPresetFilledMembers(party);
            const labels = members.map(entry => pkName(PokemonById[entry.member.pokemon])).join(' · ');
            return `
              <button type="button" class="party-preset-picker-party ${members.length ? '' : 'empty'}" data-party-picker-party="${partyIndex}" ${members.length ? '' : 'disabled'}>
                <span class="party-preset-picker-sprite-row" aria-hidden="true">
                  ${members.map(entry => pokemonSpriteSlot(PokemonById[entry.member.pokemon], { size: 'sm', className: 'party-preset-picker-sprite' })).join('')}
                </span>
                <b>${escapeHTML(normalizePartyPresetName(party.name, partyIndex))}</b>
                <span>${members.length ? escapeHTML(labels) : '저장된 포켓몬 없음'}</span>
              </button>
            `;
          }).join('')}
        </div>
      </section>
    `;
    return;
  }

  body.innerHTML = partyPresetData.parties.map((party, partyIndex) => {
    const members = partyPresetFilledMembers(party);
    return `
      <section class="party-preset-picker-section ui-control-frame ui-subframe">
        <div class="party-preset-picker-section-head">${escapeHTML(normalizePartyPresetName(party.name, partyIndex))}</div>
        <div class="party-preset-picker-member-grid">
          ${members.length ? members.map(({ member, slotIndex }) => {
            const pokemon = PokemonById[member.pokemon];
            return `
              <button type="button" class="party-preset-picker-member" data-party-picker-party="${partyIndex}" data-party-picker-slot="${slotIndex}">
                ${pokemonSpriteSlot(pokemon, { className: 'party-preset-picker-member-sprite' })}
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
  partyPresetPickerReturnFocus = document.activeElement;
  partyPresetPickerTarget = target || '';
  renderPartyPresetPicker();
  const modal = document.getElementById('partyPresetPickerModal');
  if (!modal) return;
  modal.hidden = false;
  modal.scrollTop = 0;
  document.getElementById('partyPresetPickerBody')?.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('party-preset-open');
  partyPresetFocusLayer(modal.querySelector('.party-preset-picker'), document.getElementById('partyPresetPickerClose'));
}

function closePartyPresetPicker() {
  const modal = document.getElementById('partyPresetPickerModal');
  if (modal) modal.hidden = true;
  partyPresetPickerTarget = '';
  if (document.getElementById('partyPresetModal')?.hidden !== false) {
    document.body.classList.remove('party-preset-open');
  }
  const returnFocus = partyPresetPickerReturnFocus;
  partyPresetPickerReturnFocus = null;
  partyPresetRestoreFocus(returnFocus);
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

  partyPresetTextReturnFocus = document.activeElement;
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

function closePartyPresetTextDialog({ restoreFocus = true } = {}) {
  const dialog = document.getElementById('partyPresetTextDialog');
  if (dialog) dialog.hidden = true;
  const returnFocus = partyPresetTextReturnFocus;
  partyPresetTextReturnFocus = null;
  if (restoreFocus) partyPresetRestoreFocus(returnFocus);
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

function updatePartyPresetName(input, { normalize = false } = {}) {
  const partyIndex = Number(input.dataset.partyNameIndex);
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return;
  const nextName = normalize
    ? normalizePartyPresetName(input.value, partyIndex)
    : String(input.value || '').slice(0, PARTY_PRESET_MAX_NAME_LENGTH);
  party.name = nextName;
  input.value = nextName;
  savePartyPresetData();
}

function updatePartyPresetPokemon(partyIndex, slotIndex, pokemonId) {
  const member = partyPresetMember(partyIndex, slotIndex);
  if (!pokemonId) {
    partyPresetData.parties[partyIndex].members[slotIndex] = blankPartyPresetMember();
    partyPresetExpandedSlots.delete(partyPresetSlotCollapseKey(partyIndex, slotIndex));
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
  partyPresetCollapsedParties.delete(partyIndex);
  partyPresetExpandedSlots.add(partyPresetSlotCollapseKey(partyIndex, slotIndex));
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
  modal.querySelectorAll('.party-preset-name-input').forEach(input => {
    input.addEventListener('input', () => updatePartyPresetName(input));
    input.addEventListener('blur', () => updatePartyPresetName(input, { normalize: true }));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
      event.stopPropagation();
    });
  });
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
  modal.querySelectorAll('[data-party-image-export]').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await exportPartyPresetSummaryImage(Number(button.dataset.partyImageExport));
      } catch {
        setPartyPresetStatus(`${PARTY_PRESET_LABELS.imageExport} \uC2E4\uD328`, 'error');
      } finally {
        button.disabled = false;
      }
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
    const textDialog = document.getElementById('partyPresetTextDialog');
    if (event.key === 'Escape') {
      if (textDialog && !textDialog.hidden) {
        event.preventDefault();
        closePartyPresetTextDialog();
        return;
      }
      if (picker && !picker.hidden) {
        event.preventDefault();
        closePartyPresetPicker();
        return;
      }
      if (modal && !modal.hidden) {
        event.preventDefault();
        closePartyPresetModal();
      }
      return;
    }
    if (textDialog && !textDialog.hidden) {
      partyPresetTrapFocus(event, textDialog.querySelector('.party-preset-text-card'));
    } else if (picker && !picker.hidden) {
      partyPresetTrapFocus(event, picker.querySelector('.party-preset-picker'));
    } else if (modal && !modal.hidden) {
      partyPresetTrapFocus(event, modal.querySelector('.party-preset-modal'));
    }
  });
}
