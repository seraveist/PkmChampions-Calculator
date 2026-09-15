import { RotomUI, uiStatTable } from './01-10-rotom-ui.js';
import { AbilityById, ItemById, MOVES, MoveById, NATURE_BY_ID, POKEMON, PokemonById, STATS, abName, escapeHTML, itName, mvName, pkName, pokemonSpriteSlot, renderTrustedHTML } from './01-core.js';
import { calcMatches, calcNatureLabel, calcSearchText, makeSideState, sortMovesForCalcSelect, sortPokemonForCalcSelect } from './03-10-calc-state.js';
import { renderToolTypePills } from './03-11-calc-shared-render.js';
import { uiWirePickerDialog } from './03-19-picker-dialog.js';
import { calcAbilityOptionDataForPokemon, calcItemOptionData, calcNatureOptionData } from './03-20-calc-combobox.js';
import { calcComboboxHeaderHtml, calcRenderComboboxOption } from './03-21-calc-combobox-options.js';
import { PARTY_PRESET_LABELS, PARTY_PRESET_MAX_NAME_LENGTH, blankPartyPresetMember, exportPartyPresetJson, importPartyPresetJsonFile, normalizePartyPresetName, partyPresetCollapsedParties, partyPresetCopyOrDownload, partyPresetData, partyPresetExpandedSlots, partyPresetFilledMembers, partyPresetFocusLayer, partyPresetMember, partyPresetMemberClone, partyPresetModalReady, partyPresetModalReturnFocus, partyPresetPickerReturnFocus, partyPresetPickerTarget, partyPresetRestoreFocus, partyPresetSlotCollapseKey, partyPresetTextReturnFocus, partyPresetTextState, savePartyPresetData, undoPartyPresetImport, updatePartyPresetBackupControls, setPartyPresetModalReady, setPartyPresetModalReturnFocus, setPartyPresetPickerReturnFocus, setPartyPresetPickerTarget, setPartyPresetStatus, setPartyPresetTextReturnFocus, setPartyPresetTextState } from './04-00-party-presets-state.js';
import { exportPartyPresetSummaryImage } from './04-01-party-presets-image.js';
import { importPartyPresetShowdownText, partyPresetApplyPartyToMatchup, partyPresetApplyPickerMember, partyPresetDefaultAbility, partyPresetDefaultItem, partyPresetExportShowdownParty } from './04-02-party-presets-integration.js';

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
  const options=partyPresetOptions(type,member,query);
  return calcComboboxHeaderHtml(type)+(options.length ? options.map(option=>calcRenderComboboxOption(type,option,currentId)).join('') : '<div class="combobox-option empty">검색 결과 없음</div>');
}

function partyPresetComboboxHtml({partyIndex,slotIndex,type,value,label='',moveIndex=''}) {
  const attrs={'data-party-index':partyIndex,'data-slot-index':slotIndex,'data-preset-field':type,'data-cb-type':type,'data-value':value || '',...(moveIndex!=='' ? {'data-move-index':moveIndex} : {})};
  if(type==='pokemon') return `<div class="combobox party-preset-combobox">${RotomUI.trigger(`<span class="picker-label">${escapeHTML(label || '포켓몬 선택')}</span>`,{...attrs,value:label,'aria-label':`포켓몬 ${slotIndex+1}`},'cb-input cb-trigger party-preset-input')}<div class="combobox-options" role="listbox"></div></div>`;
  const names={ability:'특성',item:'도구',nature:'성격',move:`기술 ${Number(moveIndex)+1}`};
  return RotomUI.picker(names[type],label,{...attrs,class:'party-preset-input'},'party-preset-combobox');
}


function renderPartyPresetSlot(member,partyIndex,slotIndex) {
  const p=PokemonById[member.pokemon],collapsed=p && !partyPresetExpandedSlots.has(partyPresetSlotCollapseKey(partyIndex,slotIndex));
  const total=STATS.reduce((sum,stat)=>sum+(member.evs?.[stat] || 0),0);
  const attrs=`data-party-index="${partyIndex}" data-slot-index="${slotIndex}"`;
  const detailId=`party-${partyIndex}-slot-${slotIndex}`;
  const side={...makeSideState(member.pokemon),evs:member.evs,nature:member.nature};
  return `<section class="party-preset-slot ui-surface${p ? ' filled' : ''}${collapsed ? ' collapsed' : ''}" ${attrs}>
    <div class="party-preset-slot-head">
      <span class="party-preset-slot-label">${slotIndex+1}</span>${pokemonSpriteSlot(p)}
      ${partyPresetComboboxHtml({partyIndex,slotIndex,type:'pokemon',value:member.pokemon,label:partyPresetCurrentLabel('pokemon',member)})}
      <button type="button" class="ui-button icon-button party-preset-clear" ${attrs} aria-label="포켓몬 ${slotIndex+1} 비우기" ${p ? '' : 'disabled'}>${RotomUI.icon('close')}</button>
      ${p ? `<button type="button" class="ui-button icon-button party-preset-slot-toggle" ${attrs} data-party-slot-toggle aria-label="포켓몬 ${slotIndex+1} 설정" aria-expanded="${!collapsed}" aria-controls="${detailId}">${RotomUI.icon('chevron')}</button>` : ''}
    </div>
    ${p ? `<div class="party-preset-detail" id="${detailId}" ${collapsed ? 'hidden' : ''}>
      <div class="section-heading">${renderToolTypePills(p.types)}<span class="budget">노력치 <strong>${total}</strong> / 66</span></div>
      <div class="attributes">${['ability','item','nature'].map(type=>partyPresetComboboxHtml({partyIndex,slotIndex,type,value:member[type],label:partyPresetCurrentLabel(type,member)})).join('')}</div>
      ${uiStatTable(side,{evAttr:'data-preset-ev',evAttrs:{class:'party-preset-ev-input','data-party-index':partyIndex,'data-slot-index':slotIndex},base:false,label:`포켓몬 ${slotIndex+1} 능력치`})}
      <div class="party-preset-move-row">${[0,1,2,3].map(moveIndex=>partyPresetComboboxHtml({partyIndex,slotIndex,type:'move',value:member.moves[moveIndex],label:partyPresetCurrentLabel('move',member,moveIndex),moveIndex})).join('')}</div>
    </div>` : ''}
  </section>`;
}

function renderPartyPresetModal() {
  ensurePartyPresetModal();
  const body = document.getElementById('partyPresetBody');
  if (!body) return;
  renderTrustedHTML(body, partyPresetData.parties.map((party, partyIndex) => {
    const isCollapsed = partyPresetCollapsedParties.has(partyIndex);
    const filledCount = partyPresetFilledMembers(party).length;
    const partyName = normalizePartyPresetName(party.name, partyIndex);
    return `
    <section class="party-preset-party ui-surface ${isCollapsed ? 'collapsed' : ''}" data-party-index="${partyIndex}">
      <div class="party-preset-party-head">
        <div class="party-preset-party-title"><button type="button" class="ui-button icon-button" data-party-toggle="${partyIndex}" aria-label="파티 ${partyIndex+1} 접기" aria-expanded="${!isCollapsed}" aria-controls="party-slots-${partyIndex}">${RotomUI.icon('chevron')}</button>
          <input type="text" class="ui-control party-preset-name-input" data-party-name-index="${partyIndex}" value="${escapeHTML(partyName)}" maxlength="${PARTY_PRESET_MAX_NAME_LENGTH}" aria-label="파티 ${partyIndex + 1} 이름">
          <span class="party-preset-party-count">${filledCount}/6</span>
        </div>
        <div class="party-preset-party-actions">
          <button type="button" class="ui-label-action party-preset-party-action" data-party-showdown-import="${partyIndex}">텍스트 가져오기</button>
          <button type="button" class="ui-label-action party-preset-party-action" data-party-showdown-export="${partyIndex}">텍스트 내보내기</button>
          <button type="button" class="ui-label-action party-preset-party-action" data-party-image-export="${partyIndex}">${PARTY_PRESET_LABELS.imageExport}</button>
        </div>
      </div>
      <div class="party-preset-slot-grid" id="party-slots-${partyIndex}" ${isCollapsed ? 'hidden' : ''}>
        ${party.members.map((member, slotIndex) => renderPartyPresetSlot(member, partyIndex, slotIndex)).join('')}
      </div>
    </section>
    `;
  }).join(''));
  wirePartyPresetInputs();
  updatePartyPresetBackupControls();
}

function ensurePartyPresetModal() {
  if (document.getElementById('partyPresetModal')) return;
  const modal = document.createElement('dialog');
  modal.id = 'partyPresetModal';
  modal.className = 'ui-dialog ui-surface party-preset-modal-backdrop';
  modal.setAttribute('aria-labelledby','partyPresetTitle');
  modal.hidden = true;
  renderTrustedHTML(modal, `
    <div class="party-preset-modal">
      <div class="dialog-heading party-preset-modal-head">
        <div>

          <h2 id="partyPresetTitle">파티 프리셋</h2>
        </div>
        <button type="button" class="ui-button icon-button party-preset-close" aria-label="닫기" id="partyPresetClose">${RotomUI.icon('close')}</button>
        <div class="party-preset-modal-actions">
          <span class="party-preset-status" id="partyPresetStatus" aria-live="polite"></span>
          <button type="button" class="ui-label-action party-preset-action" id="partyPresetUndoImport" disabled>가져오기 되돌리기</button>
          <button type="button" class="ui-label-action party-preset-action" id="partyPresetImport">JSON 가져오기</button>
          <button type="button" class="ui-label-action party-preset-action" id="partyPresetExport">JSON 내보내기</button>
          <input type="file" id="partyPresetImportFile" accept=".json,application/json" hidden>
        </div>
      </div>
      <div class="party-preset-backup-note" id="partyPresetBackupNote" role="note">
        이 브라우저에 자동 저장 · JSON은 전체 파티 백업 · 직전 가져오기 1회 되돌리기
      </div>
      <p class="party-preset-storage-warning" id="partyPresetStorageWarning" role="status" aria-live="polite" hidden></p>
      <div class="party-preset-modal-body ui-frame-body ui-subframe-stack" id="partyPresetBody"></div>
      <dialog class="ui-dialog ui-surface party-preset-text-dialog" id="partyPresetTextDialog" role="dialog" aria-modal="true" aria-labelledby="partyPresetTextTitle" hidden>
        <div class="party-preset-text-card">
          <div class="dialog-heading party-preset-text-head">
            <h2 id="partyPresetTextTitle">Showdown 텍스트</h2>
            <button type="button" class="ui-button icon-button party-preset-close" aria-label="닫기" id="partyPresetTextClose">${RotomUI.icon('close')}</button>
          </div>
          <textarea id="partyPresetTextArea" class="ui-control party-preset-textarea" aria-labelledby="partyPresetTextTitle" spellcheck="false"></textarea>
          <div class="party-preset-text-actions">
            <button type="button" class="ui-label-action party-preset-action" id="partyPresetTextApply">가져오기 적용</button>
            <button type="button" class="ui-label-action party-preset-action" id="partyPresetTextCopy">복사</button>
          </div>
        </div>
      </dialog>
    </div>
  `);
  document.body.appendChild(modal);
}

function confirmPartyPresetReplacement({ title, message, actionLabel }) {
  return new Promise((resolve, reject) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'partyPresetConfirm';
    dialog.className = 'ui-dialog ui-surface party-preset-confirm';
    dialog.setAttribute('aria-labelledby', 'partyPresetConfirmTitle');
    dialog.setAttribute('aria-describedby', 'partyPresetConfirmMessage');
    renderTrustedHTML(dialog, `<div class="dialog-heading"><h2 id="partyPresetConfirmTitle"></h2></div>
      <p id="partyPresetConfirmMessage" class="party-preset-confirm-message"></p>
      <div class="dialog-actions"><button type="button" class="ui-button" data-party-confirm-cancel>취소</button>
      <button type="button" class="ui-button ui-button--primary" data-party-confirm-apply></button></div>`);
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('p').textContent = message;
    const cancel = dialog.querySelector('[data-party-confirm-cancel]');
    cancel.textContent = '취소';
    const apply = dialog.querySelector('[data-party-confirm-apply]');
    apply.textContent = actionLabel;
    cancel.addEventListener('click', () => dialog.close('cancel'));
    apply.addEventListener('click', () => dialog.close('apply'));
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });
    dialog.addEventListener('close', () => {
      const accepted = dialog.returnValue === 'apply';
      dialog.remove();
      partyPresetRestoreFocus(previousFocus);
      resolve(accepted);
    }, { once: true });
    document.body.appendChild(dialog);
    try { dialog.showModal(); cancel.focus({ preventScroll: true }); }
    catch (error) { dialog.remove(); reject(error); }
  });
}

function openPartyPresetModal() {
  renderPartyPresetModal();
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  setPartyPresetModalReturnFocus(document.activeElement);
  setPartyPresetStatus('');
  modal.hidden = false;
  if(!modal.open) modal.showModal();
  modal.scrollTop = 0;
  document.getElementById('partyPresetBody')?.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('party-preset-open');
  partyPresetFocusLayer(modal.querySelector('.party-preset-modal'), document.getElementById('partyPresetClose'));
}

function closePartyPresetModal() {
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  closePartyPresetTextDialog({ restoreFocus: false });
  modal.close();
  modal.hidden = true;
  document.body.classList.remove('party-preset-open');
  const returnFocus = partyPresetModalReturnFocus;
  setPartyPresetModalReturnFocus(null);
  partyPresetRestoreFocus(returnFocus);
}

function ensurePartyPresetPickerModal() {
  if (document.getElementById('partyPresetPickerModal')) return;
  const modal = document.createElement('dialog');
  modal.id = 'partyPresetPickerModal';
  modal.className = 'ui-dialog ui-surface party-preset-picker-backdrop';
  modal.setAttribute('aria-labelledby','partyPresetPickerTitle');
  modal.hidden = true;
  renderTrustedHTML(modal, `
    <div class="party-preset-picker">
      <div class="dialog-heading party-preset-picker-head">
        <div>

          <h2 id="partyPresetPickerTitle">불러오기</h2>
        </div>
        <button type="button" class="ui-button icon-button party-preset-close" aria-label="닫기" id="partyPresetPickerClose">${RotomUI.icon('close')}</button>
      </div>
      <div class="party-preset-picker-body ui-frame-body ui-subframe-stack" id="partyPresetPickerBody"></div>
    </div>
  `);
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
    renderTrustedHTML(body, `
      <section class="party-preset-picker-section party-preset-picker-party-section ui-surface">
        <div class="party-preset-picker-party-grid">
          ${partyPresetData.parties.map((party, partyIndex) => {
            const members = partyPresetFilledMembers(party);
            const labels = members.map(entry => pkName(PokemonById[entry.member.pokemon])).join(' · ');
            return `
              <button type="button" class="ui-button party-preset-picker-party ${members.length ? '' : 'empty'}" data-party-picker-party="${partyIndex}" ${members.length ? '' : 'disabled'}>
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
    `);
    return;
  }

  renderTrustedHTML(body, partyPresetData.parties.map((party, partyIndex) => {
    const members = partyPresetFilledMembers(party);
    return `
      <section class="party-preset-picker-section ui-surface">
        <div class="party-preset-picker-section-head">${escapeHTML(normalizePartyPresetName(party.name, partyIndex))}</div>
        <div class="party-preset-picker-member-grid">
          ${members.length ? members.map(({ member, slotIndex }) => {
            const pokemon = PokemonById[member.pokemon];
            return `
              <button type="button" class="ui-button party-preset-picker-member" data-party-picker-party="${partyIndex}" data-party-picker-slot="${slotIndex}">
                ${pokemonSpriteSlot(pokemon, { className: 'party-preset-picker-member-sprite' })}
                <span>슬롯 ${slotIndex + 1}</span>
                <b>${escapeHTML(pkName(pokemon))}</b>
              </button>
            `;
          }).join('') : '<div class="party-preset-picker-empty">저장된 포켓몬 없음</div>'}
        </div>
      </section>
    `;
  }).join(''));
}

function openPartyPresetPicker(target) {
  ensurePartyPresetPickerModal();
  setPartyPresetPickerReturnFocus(document.activeElement);
  setPartyPresetPickerTarget(target || '');
  renderPartyPresetPicker();
  const modal = document.getElementById('partyPresetPickerModal');
  if (!modal) return;
  modal.hidden = false;
  if(!modal.open) modal.showModal();
  modal.scrollTop = 0;
  document.getElementById('partyPresetPickerBody')?.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('party-preset-open');
  partyPresetFocusLayer(modal.querySelector('.party-preset-picker'), document.getElementById('partyPresetPickerClose'));
}

function closePartyPresetPicker() {
  const modal = document.getElementById('partyPresetPickerModal');
  if (modal) { modal.close();modal.hidden = true; }
  setPartyPresetPickerTarget('');
  if (document.getElementById('partyPresetModal')?.hidden !== false) {
    document.body.classList.remove('party-preset-open');
  }
  const returnFocus = partyPresetPickerReturnFocus;
  setPartyPresetPickerReturnFocus(null);
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

  setPartyPresetTextReturnFocus(document.activeElement);
  setPartyPresetTextState({ partyIndex, mode });
  const partyName = partyPresetData.parties?.[partyIndex]?.name || `파티 ${partyIndex + 1}`;
  const isExport = mode === 'export';
  title.textContent = `${partyName} Showdown 텍스트 ${isExport ? '내보내기' : '가져오기'}`;
  area.value = isExport ? partyPresetExportShowdownParty(partyIndex) : '';
  area.placeholder = 'Showdown 텍스트를 붙여넣어 주세요';
  area.readOnly = isExport;
  if (applyButton) applyButton.hidden = isExport;
  if (copyButton) copyButton.hidden = !isExport;
  dialog.hidden = false;
  if(!dialog.open) dialog.showModal();
  requestAnimationFrame(() => {
    area.focus();
    if (isExport) area.select();
  });
}

function closePartyPresetTextDialog({ restoreFocus = true } = {}) {
  const dialog = document.getElementById('partyPresetTextDialog');
  if (dialog) { dialog.close();dialog.hidden = true; }
  const returnFocus = partyPresetTextReturnFocus;
  setPartyPresetTextReturnFocus(null);
  if (restoreFocus) partyPresetRestoreFocus(returnFocus);
}

async function applyPartyPresetTextImport() {
  const area = document.getElementById('partyPresetTextArea');
  if (!area) return;
  if (await importPartyPresetShowdownText(partyPresetTextState.partyIndex, area.value)) {
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


function wirePartyPresetCombobox(input) {
  const list=input.closest('.combobox')?.querySelector('.combobox-options');
  const {partyIndex,slotIndex,presetField:type}=input.dataset;
  const moveIndex=input.dataset.moveIndex===undefined ? null : Number(input.dataset.moveIndex);
  uiWirePickerDialog(input,list,{
    showOptions:query=>{
      const member=partyPresetMember(Number(partyIndex),Number(slotIndex));
      renderTrustedHTML(list,renderPartyPresetOptions(type,member,query,type==='move' ? member.moves[moveIndex] : member[type]));
    },
    onSelect:option=>{
      updatePartyPresetField(Number(partyIndex),Number(slotIndex),type,option.dataset.id || '',moveIndex);
      renderPartyPresetModal();
    }
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
  setPartyPresetModalReady(true);
  ensurePartyPresetModal();
  ensurePartyPresetPickerModal();
  document.getElementById('partyPresetOpen')?.addEventListener('click', openPartyPresetModal);
  document.getElementById('partyPresetClose')?.addEventListener('click', closePartyPresetModal);
  document.getElementById('partyPresetPickerClose')?.addEventListener('click', closePartyPresetPicker);
  document.getElementById('partyPresetExport')?.addEventListener('click', exportPartyPresetJson);
  document.getElementById('partyPresetUndoImport')?.addEventListener('click', undoPartyPresetImport);
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
  document.getElementById('partyPresetModal')?.addEventListener('click',event=>{
    const slot=event.target.closest('[data-party-slot-toggle]');
    const party=event.target.closest('[data-party-toggle]');
    if(slot) {
      const key=partyPresetSlotCollapseKey(Number(slot.dataset.partyIndex),Number(slot.dataset.slotIndex));
      if(partyPresetExpandedSlots.has(key)) partyPresetExpandedSlots.delete(key); else partyPresetExpandedSlots.add(key);
    } else if(party) {
      const key=Number(party.dataset.partyToggle);
      if(partyPresetCollapsedParties.has(key)) partyPresetCollapsedParties.delete(key); else partyPresetCollapsedParties.add(key);
    } else return;
    const selector=slot ? `[data-party-slot-toggle][data-party-index="${slot.dataset.partyIndex}"][data-slot-index="${slot.dataset.slotIndex}"]` : `[data-party-toggle="${party.dataset.partyToggle}"]`;
    renderPartyPresetModal();document.querySelector(selector)?.focus({preventScroll:true});
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
  for(const [id,close] of [['partyPresetModal',closePartyPresetModal],['partyPresetPickerModal',closePartyPresetPicker],['partyPresetTextDialog',closePartyPresetTextDialog]]) {
    document.getElementById(id)?.addEventListener('cancel',event=>{event.preventDefault();close();});
  }
}

export { confirmPartyPresetReplacement, partyPresetMovePool, partyPresetSearch, partyPresetOptions, partyPresetCurrentLabel, renderPartyPresetOptions, partyPresetComboboxHtml, renderPartyPresetSlot, renderPartyPresetModal, ensurePartyPresetModal, openPartyPresetModal, closePartyPresetModal, ensurePartyPresetPickerModal, partyPresetPickerMode, renderPartyPresetPicker, openPartyPresetPicker, closePartyPresetPicker, applyPartyPresetPickerSelection, openPartyPresetTextDialog, closePartyPresetTextDialog, applyPartyPresetTextImport, copyPartyPresetTextExport, updatePartyPresetName, updatePartyPresetPokemon, updatePartyPresetField, updatePartyPresetEv, wirePartyPresetCombobox, wirePartyPresetInputs, initPartyPresets };
