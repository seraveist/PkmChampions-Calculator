/* Damage calculator side panel rendering and side-level events. */
const calcEvPresetProgress = {
  atk: { evPreset: null, nature: null },
  def: { evPreset: null, nature: null },
};
const calcDetailExpanded = { atk: false, def: false };
let calcDetailTogglesBound = false;

function syncCalcDetailState(sideKey) {
  const expanded = !!calcDetailExpanded[sideKey];
  const body = document.getElementById(`${sideKey}-body`);
  const button = document.querySelector(`[data-calc-detail-toggle="${sideKey}"]`);
  body?.classList.toggle('is-detail-expanded', expanded);
  if (button) {
    button.classList.toggle('active', expanded);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.textContent = expanded ? '접기' : '상세';
  }
}

function initCalcDetailToggles() {
  if (calcDetailTogglesBound) return;
  calcDetailTogglesBound = true;
  document.querySelectorAll('[data-calc-detail-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const sideKey = button.dataset.calcDetailToggle;
      if (!Object.prototype.hasOwnProperty.call(calcDetailExpanded, sideKey)) return;
      calcDetailExpanded[sideKey] = !calcDetailExpanded[sideKey];
      syncCalcDetailState(sideKey);
    });
  });
}

function renderCalcCompactStats(stats) {
  return `
    <div class="calc-compact-stats ui-control-frame ui-subframe" aria-label="현재 능력치">
      ${STATS.map(stat => `
        <span class="calc-compact-stat">
          <span>${escapeHTML(STAT_LABEL[stat])}</span>
          <b>${escapeHTML(String(stats[stat]))}</b>
        </span>
      `).join('')}
    </div>
  `;
}

function renderDurabilityStrip(side) {
  const dStats = calcStats(side);
  const physBulk = Math.round(dStats.hp * dStats.def / 0.411);
  const specBulk = Math.round(dStats.hp * dStats.spd / 0.411);
  return renderToolStatBulkStrip({ phys: physBulk, spec: specBulk }, {
    className: 'calc-stat-bulk-strip calc-stat-bulk-strip--compact',
    cardClass: 'calc-stat-bulk-card',
    physClass: 'calc-stat-bulk-phys',
    specClass: 'calc-stat-bulk-spec',
    labelClass: 'calc-stat-bulk-label',
    valueClass: 'calc-stat-bulk-value',
  });
}

function renderMoveList(sideKey, side) {
  const rows = [0,1,2,3].map(i => {
    const moveId = side.moves[i];
    const move = moveId ? MoveById[moveId] : null;
    const slotBp = move ? manualBpForSlot(side, i, move) : '';
    const manualBp = normalizeManualBp(side.moveBpOverrides?.[i]);
    const slotType = move ? manualTypeForSlot(side, i, move) : '';
    const manualType = normalizeMoveType(side.moveTypeOverrides?.[i]);
    const targetSide = state[sideKey === 'atk' ? 'def' : 'atk'];
    const moveForCalc = move ? moveWithManualBp(move, manualBp, manualType) : null;
    const power = moveForCalc ? estimateMovePower(side, moveForCalc, targetSide) : null;
    const fixedCritical = !!move?.willCrit;
    const manualCritical = !!side.moveCriticalOverrides?.[i];
    const criticalDisabled = !move || move.cat === 'Status' || fixedCritical;
    return {
      index: i + 1,
      attrs: { 'data-move-slot': i },
      nameHtml: `
        <div class="tool-move-combobox combobox" data-cb="${sideKey}-move-${i}">
          <input type="text" class="cb-input tool-move-input" value="${move ? escapeHTML(mvName(move)) : ''}" data-cb-type="move" data-side="${sideKey}" data-field="moves.${i}" placeholder="\uC5C6\uC74C" autocomplete="off" aria-label="${sideKey} move ${i+1} select" aria-expanded="false">
          <div class="combobox-options" role="listbox"></div>
        </div>
      `,
      typeHtml: `
        <div class="tool-move-type-control combobox type-pill-combobox ${slotType ? `t-${slotType}` : 'type-none'}" data-cb="${sideKey}-move-type-${i}">
          <button type="button" class="cb-input cb-trigger tool-move-type-input" data-cb-type="moveType" data-side="${sideKey}" data-field="moveTypes.${i}" aria-label="${sideKey} move ${i+1} type" aria-expanded="false" ${move ? '' : 'disabled'}>${slotType ? escapeHTML(TYPE_KO[slotType] || slotType) : ''}</button>
          <div class="combobox-options" role="listbox"></div>
        </div>
      `,
      powerHtml: `
        <label class="tool-move-power-control ui-inline-number is-plain" title="power">
          <input type="text" class="tool-move-power-input ui-inline-number-input" data-action="moveBp" data-side="${sideKey}" data-slot="${i}" value="${move ? slotBp : ''}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${sideKey} move ${i+1} power" ${move ? '' : 'disabled'}>
        </label>
      `,
      critical: `
        <span class="tool-move-col-critical">
          <input type="checkbox" class="calc-move-critical-input" data-action="moveCritical" data-side="${sideKey}" data-slot="${i}" aria-label="${i + 1}번 기술 급소" title="${fixedCritical ? '확정 급소 기술' : '이 기술을 급소로 계산'}" ${fixedCritical || manualCritical ? 'checked' : ''} ${criticalDisabled ? 'disabled' : ''}>
        </span>
      `,
      readoutHtml: move
        ? `<span class="tool-move-power-readout ui-stat-readout"><b>${typeof power.eff === 'number' ? power.eff.toLocaleString() : power.eff}</b></span>`
        : '<span class="tool-move-power-readout empty ui-stat-readout">-</span>',
    };
  });

  const showCritical = sideKey === 'atk';
  return renderToolMoveList(rows, {
    className: `tool-move-list--full${showCritical ? ' tool-move-list--critical' : ''}`,
    columns: showCritical
      ? ['index', 'name', 'type', 'power', 'critical', 'readout']
      : ['index', 'name', 'type', 'power', 'readout'],
    labels: { critical: '급소' },
  });
}

function renderSide(sideKey) {
  const side = state[sideKey];
  const container = document.getElementById(`${sideKey}-body`);
  if (typeof calcCleanupComboboxPortals === 'function') calcCleanupComboboxPortals(sideKey);
  const p = PokemonById[side.pokemonIdx];
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'pokemon-field',
    headClass: 'calc-pokemon-field-head ui-section-head',
    labelClass: 'ui-section-title',
    primaryActions: uiButton('불러오기', {
      class: 'party-load-button ui-label-action ui-field-action',
      'data-party-import-target': `calc:${sideKey}`,
    }),
    titleActions: `
      <div class="pokemon-actions tool-pokemon-actions tool-pokemon-nav-actions ui-field-actions">
        <button type="button" class="calc-page-jump-button ui-label-action ui-field-action" data-ft-from-side="${sideKey}" title="fine tune">세부조정</button>
        <button type="button" class="calc-page-jump-button ui-label-action ui-field-action" data-rc-from-side="${sideKey}" title="reverse calc">역계산</button>
      </div>
    `,
    comboboxAttrs: { 'data-cb': `${sideKey}-poke` },
    inputAttrs: {
      'data-cb-type': 'pokemon',
      'data-side': sideKey,
      'data-field': 'pokemonIdx',
      'aria-label': `${sideKey} pokemon select`,
    },
    value: p ? pkName(p) : '',
    placeholder: '포켓몬 검색...',
    optionsRole: 'listbox',
    toolbarClass: 'pokemon-meta-row ui-field-meta-row ui-control-row ui-chip-row',
    toolbarActions: p ? `
      ${renderTypeControls(sideKey, side)}
      ${renderFormSwitchControls(sideKey, side)}
      <!-- 테라스탈은 챔피언스 모드에서 비활성화됨 -->
    ` : '',
  });
  if (!p) {
    renderTrustedHTML(container, `
      ${pokemonPicker}
      <div class="empty-state ui-empty">포켓몬 선택 필요</div>
    `);
    syncCalcDetailState(sideKey);
    wireSide(sideKey);
    return;
  }
  
  const stats = calcStats(side);
  deriveHpFlags(side);
  const currentHp = currentHpValue(stats.hp, side.hpPct);
  const totalEV = Object.values(side.evs).reduce((a,b) => a+b, 0);
  const overEV = totalEV > 66;
  const manualDamageBlockToggle = renderManualDamageBlockToggle(sideKey, side);
  const evPresetButtons = ['AS', 'HA', 'HB', 'CS', 'HC', 'HD'].map(preset =>
    uiButton(preset, {
      class: `calc-stat-preset-option tool-stat-preset-option ${calcEvPresetProgress[sideKey]?.evPreset === preset ? 'active' : ''}`,
      'data-action': 'evPreset',
      'data-side': sideKey,
      'data-preset': preset,
    })
  ).join('');
  const naturePresets = [
    ['adamant', '\uACE0\uC9D1', '\uACF5\uACA9 \uC0C1\uC2B9 / \uD2B9\uACF5 \uD558\uB77D'],
    ['jolly', '\uBA85\uB791', '\uC18D\uB3C4 \uC0C1\uC2B9 / \uD2B9\uACF5 \uD558\uB77D'],
    ['impish', '\uC7A5\uB09C\uAFB8\uB7EC\uAE30', '\uBC29\uC5B4 \uC0C1\uC2B9 / \uD2B9\uACF5 \uD558\uB77D'],
    ['careful', '\uC2E0\uC911', '\uD2B9\uBC29 \uC0C1\uC2B9 / \uD2B9\uACF5 \uD558\uB77D'],
    ['modest', '\uC870\uC2EC', '\uD2B9\uACF5 \uC0C1\uC2B9 / \uACF5\uACA9 \uD558\uB77D'],
    ['timid', '\uAC81\uC7C1\uC774', '\uC18D\uB3C4 \uC0C1\uC2B9 / \uACF5\uACA9 \uD558\uB77D'],
    ['bold', '\uB300\uB2F4', '\uBC29\uC5B4 \uC0C1\uC2B9 / \uACF5\uACA9 \uD558\uB77D'],
    ['calm', '\uCC28\uBD84', '\uD2B9\uBC29 \uC0C1\uC2B9 / \uACF5\uACA9 \uD558\uB77D'],
  ];
  const naturePresetButtons = naturePresets.map(([id, label, title]) =>
    uiButton(label, {
      class: `calc-stat-preset-option tool-stat-preset-option calc-stat-nature-option ${calcEvPresetProgress[sideKey]?.nature === id ? 'active' : ''}`,
      'data-action': 'naturePreset',
      'data-side': sideKey,
      'data-nature': id,
      'data-tooltip': title,
      'aria-label': `${label}: ${title}`,
    })
  ).join('');
  const statRows = renderToolStatRows(STATS.map(s => {
    const r = side.ranks[s] || 0;
    return {
      stat: s,
      label: STAT_LABEL[s],
      base: p.bs[s],
      point: side.evs[s],
      final: stats[s],
      natureHtml: renderToolStatNatureMark(s, side.nature, {
        upClass: 'nature-stat-mark up',
        downClass: 'nature-stat-mark down',
        emptyClass: 'nature-stat-mark empty',
      }),
      pointOptions: {
        inputType: 'number',
        zeroAttrs: { 'data-action': 'evQuick', 'data-side': sideKey, 'data-stat': s, 'data-val': '0', title: 'set 0' },
        inputAttrs: { 'data-action': 'ev', 'data-side': sideKey, 'data-stat': s, autocomplete: 'off', 'aria-label': `${STAT_LABEL[s]} EV` },
        maxAttrs: { 'data-action': 'evQuick', 'data-side': sideKey, 'data-stat': s, 'data-val': '32', title: 'set 32' },
      },
      rank: r,
      rankOptions: {
        rankable: s !== 'hp',
        decAttrs: { 'data-action': 'rank', 'data-side': sideKey, 'data-stat': s, 'data-dir': '-1' },
        incAttrs: { 'data-action': 'rank', 'data-side': sideKey, 'data-stat': s, 'data-dir': '1' },
      },
    };
  }), {
    rowClass: 'calc-stat-row',
    nameClass: 'calc-stat-name',
    nameTextClass: 'calc-stat-name-text',
    baseClass: 'calc-stat-base',
    finalClass: 'calc-stat-final',
  });

  renderTrustedHTML(container, `
    <!-- 포켓몬 선택 -->
    ${pokemonPicker}

    <!-- ?뱀꽦/?꾧뎄 + ?깃꺽/HP/?곹깭 -->
    <div class="calc-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
      <div class="calc-pair-grid tool-settings-grid ui-control-grid">
        <div class="calc-control-cell tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell" data-tool-setting="ability">
          <span class="calc-control-label tool-settings-label tool-settings-choice-label tool-settings-select-label ui-control-label">\uD2B9\uC131</span>
          <div class="compound-control ability-toggle-cell tool-settings-control tool-settings-choice-control tool-settings-compound tool-settings-select-control">
            <div class="combobox tool-settings-combobox tool-settings-choice-combobox tool-settings-select-combobox" data-cb="${sideKey}-ability">
              <input type="text" class="cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" value="${escapeHTML(calcAbilityDisplayLabel(sideKey))}" data-cb-type="ability" data-side="${sideKey}" data-field="ability" placeholder="Ability" autocomplete="off" aria-label="${sideKey} ability select" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            ${manualDamageBlockToggle || '<span class="manual-ability-spacer" aria-hidden="true"></span>'}
          </div>
        </div>
        <div class="calc-control-cell tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell" data-tool-setting="item">
          <span class="calc-control-label tool-settings-label tool-settings-choice-label tool-settings-select-label ui-control-label">\uB3C4\uAD6C</span>
          <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox" data-cb="${sideKey}-item">
            <input type="text" class="cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" value="${side.item ? (ItemById[side.item] ? escapeHTML(itName(ItemById[side.item])) : '') : '없음'}" data-cb-type="item" data-side="${sideKey}" data-field="item" placeholder="Item" autocomplete="off" aria-label="${sideKey} item select" aria-expanded="false">
            <div class="combobox-options" role="listbox"></div>
          </div>
        </div>
        <div class="calc-control-cell tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell" data-tool-setting="nature">
          <span class="calc-control-label tool-settings-label tool-settings-choice-label tool-settings-select-label ui-control-label">\uC131\uACA9</span>
          <div class="compound-control nature-spacer-cell tool-settings-control tool-settings-choice-control tool-settings-compound tool-settings-select-control">
            <div class="combobox tool-settings-combobox tool-settings-choice-combobox tool-settings-select-combobox" data-cb="${sideKey}-nature">
              <input type="text" class="cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" value="${escapeHTML(calcNatureLabel(NATURE_BY_ID[side.nature]))}" data-cb-type="nature" data-side="${sideKey}" data-field="nature" placeholder="Nature" autocomplete="off" aria-label="${sideKey} nature select" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            <span class="manual-ability-spacer" aria-hidden="true"></span>
          </div>
        </div>
        <div class="calc-control-cell tool-settings-cell tool-settings-choice-cell tool-settings-condition-cell ui-control-cell" data-tool-setting="condition">
          <span class="calc-control-label tool-settings-label tool-settings-choice-label ui-control-label">\uC0C1\uD0DC</span>
          <div class="compound-control hp-status-cell tool-settings-control tool-settings-choice-control tool-settings-compound tool-settings-hp-status-control">
            <label class="hp-inline-control tool-settings-choice-surface tool-settings-condition-control tool-settings-hp-control ui-inline-number">
              <input type="text" class="hp-percent-input tool-settings-choice-input tool-settings-hp-input ui-inline-number-input" data-action="hpPct" data-side="${sideKey}" value="${hpPercentInputValue(side)}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${sideKey} current HP percent">
              <span class="ui-inline-number-unit">%</span>
            </label>
            <div class="combobox tool-settings-combobox tool-settings-choice-combobox tool-settings-condition-control tool-settings-status-combobox" data-cb="${sideKey}-status">
              <button type="button" class="cb-input cb-trigger tool-settings-choice-surface tool-settings-choice-input" data-cb-type="status" data-side="${sideKey}" data-field="status" aria-label="${sideKey} status select" aria-expanded="false">${escapeHTML(calcStatusDisplayLabel(side.status))}</button>
              <div class="combobox-options" role="listbox"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${renderCalcCompactStats(stats)}

    <!-- ?ㅽ꺈 (?λ젰?ъ씤??+ ??겕 + ?ㅼ닔移? -->
    <div class="calc-stat-panel calc-stat-preset-shell tool-stat-panel tool-stat-set tool-stat-set--calc tool-stat-has-preset tool-stat-has-bulk tool-stat-has-nature ui-control-frame ui-subframe ui-subframe-stack ui-field" data-calc-stat-preset-side="${sideKey}">
      <div class="calc-stat-panel-head tool-stat-panel-head ui-section-head">
        <div class="tool-stat-panel-title ui-section-title">
          <span>\uB2A5\uB825 \uD3EC\uC778\uD2B8 \u00B7 \uB7AD\uD06C</span>
          <button type="button" class="calc-stat-preset-toggle tool-stat-preset-button ui-popover-trigger" data-action="evPresetMenu" data-side="${sideKey}" aria-expanded="false" aria-controls="calc-stat-preset-menu-${sideKey}">\uD504\uB9AC\uC14B</button>
        </div>
        <div class="calc-stat-total tool-stat-total ui-label-action ui-metric-chip is-static ${overEV ? 'over' : ''}">
          <span>\uCD1D\uD569</span>
          <span><b>${totalEV}</b>/66</span>
        </div>
      </div>
      <div class="calc-stat-body tool-stat-panel-body">
        <div class="tool-stat-table-frame ui-control-frame">
          <div class="calc-stat-grid tool-stat-grid ui-stat-grid ui-stat-table">
            ${renderToolStatHead(['name', 'base', 'point', 'final', 'rank'], {
              rowClass: 'calc-stat-head-row',
              cellClass: 'calc-stat-head',
              labels: { point: '\uB178\uB825\uCE58' },
            })}
            ${statRows}
          </div>
        </div>
      </div>
      ${renderDurabilityStrip(side)}
      <div class="calc-stat-preset-popover tool-stat-preset-popover ui-popover" id="calc-stat-preset-menu-${sideKey}" role="dialog" aria-label="${sideKey} EV presets" aria-hidden="true">
        <div class="calc-stat-preset-menu tool-stat-preset-menu">
          <div class="calc-stat-preset-label tool-stat-preset-label">
            <span>\uB178\uB825\uCE58 \uD504\uB9AC\uC14B</span>
            <button type="button" class="calc-stat-reset-button" data-action="evReset" data-side="${sideKey}">\uCD08\uAE30\uD654</button>
          </div>
          <div class="calc-stat-preset-row tool-stat-preset-row">
            ${evPresetButtons}
          </div>
          <div class="calc-stat-preset-label calc-stat-preset-label--secondary tool-stat-preset-label">
            <span>\uC131\uACA9 \uD504\uB9AC\uC14B</span>
          </div>
          <div class="calc-stat-preset-row calc-stat-preset-row--natures tool-stat-preset-row">
            ${naturePresetButtons}
          </div>
        </div>
      </div>
    </div>

    <!-- 湲곗닠 -->
    <div class="tool-move-panel ui-control-frame ui-subframe ui-subframe-stack ui-field">
      <div class="tool-move-panel-head ui-section-head">
        <div class="tool-move-panel-title ui-section-title">
          <span>\uAE30\uC220 \uBC30\uCE58</span>
        </div>
      </div>
      <div class="tool-move-panel-body">
        <div class="tool-move-list-frame ui-control-frame">
          ${renderMoveList(sideKey, side)}
        </div>
      </div>
    </div>

  `);

  syncCalcDetailState(sideKey);
  wireSide(sideKey);
}

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
   ?대깽??諛붿씤??   ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
function wireSide(sideKey) {
  const container = document.getElementById(`${sideKey}-body`);
  
  // Combobox ?낅젰
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
          setSideDamageBlockActive(state[side], false);
          resetAutoFields = applyEntryFieldsFromSide(side) || resetAutoFields;
        } else if (field === 'item') {
          state[side].item = id || '';
        } else if (field === 'types.0') {
          setSideType(side, 0, id);
        } else if (field === 'types.1') {
          setSideType(side, 1, id);
        } else if (field === 'formIdx') {
          applyPokemonFormToCalcSide(side, id);
          resetAutoFields = applyEntryFieldsFromSide(side) || resetAutoFields;
        } else if (field === 'nature') {
          state[side].nature = id || 'hardy';
        } else if (field === 'status') {
          state[side].status = id || 'none';
        } else if (field.startsWith('moves.')) {
          const idx = parseInt(field.split('.')[1], 10);
          state[side].moves[idx] = id || '';
          state[side].moveBpOverrides[idx] = null;
          if (!Array.isArray(state[side].moveTypeOverrides)) state[side].moveTypeOverrides = [null, null, null, null];
          state[side].moveTypeOverrides[idx] = null;
          if (!Array.isArray(state[side].moveCriticalOverrides)) state[side].moveCriticalOverrides = [false, false, false, false];
          state[side].moveCriticalOverrides[idx] = false;
        } else if (field.startsWith('moveTypes.')) {
          const idx = parseInt(field.split('.')[1], 10);
          applyMoveTypeOverride(side, idx, id);
        }

        renderSide(side);
        if (resetAutoFields) syncFieldControls();
        triggerCalc();
      },
    });
  });
  
  // ?쇰컲 input/select
  container.querySelectorAll('[data-action], [data-tool-stat-point-input], [data-tool-stat-point-set], [data-tool-stat-rank]').forEach(el => {
    const action = el.dataset.action;
    if (action === 'moveBp') {
      el.addEventListener('input', () => applyMoveBpInput(el));
      el.addEventListener('change', () => applyMoveBpInput(el, true));
      return;
    }
    if (action === 'moveCritical') {
      el.addEventListener('change', () => {
        const side = state[el.dataset.side];
        const slot = parseInt(el.dataset.slot, 10);
        if (!side || !Number.isInteger(slot)) return;
        if (!Array.isArray(side.moveCriticalOverrides)) side.moveCriticalOverrides = [false, false, false, false];
        side.moveCriticalOverrides[slot] = !!el.checked;
        triggerCalc();
      });
      return;
    }
    if (el.dataset.toolStatPointInput && action === 'ev') {
      const applyPointInput = event => {
        const side = state[el.dataset.side];
        const stat = el.dataset.toolStatPointInput || el.dataset.stat;
        const normalized = toolStatNormalizePointInputValue(el.value);
        if (normalized !== el.value) el.value = normalized;
        const finalVal = toolStatApplyPointValue(side, stat, el.value);
        if (!toolStatShouldCommitPointInput(el.value, event.type)) return;
        if (String(finalVal) !== String(el.value)) el.value = finalVal;
        renderSide(el.dataset.side);
        triggerCalc();
      };
      el.addEventListener('input', applyPointInput);
      el.addEventListener('change', applyPointInput);
      return;
    }
    const evt = el.tagName === 'BUTTON' ? 'click' : 'change';
    el.addEventListener(evt, event => {
      if (['evPresetMenu', 'evPreset', 'naturePreset', 'evReset'].includes(action)) {
        event.stopPropagation();
      }
      if (action === 'evPresetMenu') {
        toggleEvPresetPopover(el);
        return;
      }
      const side = state[el.dataset.side];
      if (action === 'formSwitch') {
        const result = applyPokemonFormToCalcSide(el.dataset.side, el.dataset.formId);
        if (result.changed) {
          renderSide(el.dataset.side);
          triggerCalc();
        }
        return;
      }
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
        setSideDamageBlockActive(side, !side.damageBlockActive);
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
        const stat = el.dataset.toolStatPointInput || el.dataset.stat;
        const finalVal = toolStatApplyPointValue(side, stat, el.value);
        if (String(finalVal) !== String(el.value)) {
          el.value = finalVal;
        }
      }
      else if (action === 'evQuick') {
        const stat = el.dataset.toolStatPointSet || el.dataset.stat;
        const requested = el.dataset.toolStatPointValue ?? el.dataset.val;
        toolStatApplyPointValue(side, stat, requested);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'rank') {
        const stat = el.dataset.toolStatRank || el.dataset.stat;
        const dir = el.dataset.toolStatRankDir || el.dataset.dir;
        toolStatApplyRankDelta(side, stat, dir);
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      else if (action === 'evPreset') {
        if (stageEvPresetSelection(el, 'ev')) {
          applyStagedEvPreset(el.dataset.side);
          renderSide(el.dataset.side);
          triggerCalc();
        }
        return;
      }
      else if (action === 'naturePreset') {
        if (stageEvPresetSelection(el, 'nature')) {
          applyStagedEvPreset(el.dataset.side);
          renderSide(el.dataset.side);
          triggerCalc();
        }
        return;
      }
      else if (action === 'evReset') {
        side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        renderSide(el.dataset.side);
        triggerCalc();
        return;
      }
      // ?ㅼ닔移??쒖떆 媛깆떊
      if (action === 'ev' || action === 'nature') {
        renderSide(el.dataset.side);
      }
      triggerCalc();
    });
  });
}

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
   EV ?꾨━???곸슜 (EV留?蹂寃? ?깃꺽? 嫄대뱶由ъ? ?딆쓬)
   ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
function setEvPresetPopover(wrapper, open) {
  if (!wrapper) return;
  wrapper.classList.toggle('is-preset-open', open);
  const toggle = wrapper.querySelector('.calc-stat-preset-toggle');
  const popover = wrapper.querySelector('.calc-stat-preset-popover');
  toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  popover?.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!open) {
    resetEvPresetProgress(wrapper.dataset.calcStatPresetSide);
    clearEvPresetActiveButtons(wrapper);
  }
}

function closeEvPresetPopovers(except = null) {
  document.querySelectorAll('#page-calc .calc-stat-preset-shell.is-preset-open').forEach(wrapper => {
    if (wrapper !== except) setEvPresetPopover(wrapper, false);
  });
}

function toggleEvPresetPopover(button) {
  const wrapper = button?.closest('.calc-stat-preset-shell');
  if (!wrapper) return;
  const willOpen = !wrapper.classList.contains('is-preset-open');
  closeEvPresetPopovers(wrapper);
  resetEvPresetProgress(wrapper.dataset.calcStatPresetSide);
  clearEvPresetActiveButtons(wrapper);
  setEvPresetPopover(wrapper, willOpen);
}

function resetEvPresetProgress(sideKey) {
  if (!calcEvPresetProgress[sideKey]) return;
  calcEvPresetProgress[sideKey].evPreset = null;
  calcEvPresetProgress[sideKey].nature = null;
}

function clearEvPresetActiveButtons(wrapper) {
  wrapper?.querySelectorAll('.calc-stat-preset-option.active').forEach(button => {
    button.classList.remove('active');
  });
}

function stageEvPresetSelection(button, kind) {
  const sideKey = button?.dataset.side;
  const pending = calcEvPresetProgress[sideKey];
  if (!pending) return true;
  if (kind === 'ev') {
    pending.evPreset = button.dataset.preset;
  } else {
    pending.nature = button.dataset.nature;
  }
  const row = button.closest('.calc-stat-preset-row');
  row?.querySelectorAll('.calc-stat-preset-option').forEach(item => {
    item.classList.toggle('active', item === button);
  });
  return Boolean(pending.evPreset && pending.nature);
}

function applyStagedEvPreset(sideKey) {
  const pending = calcEvPresetProgress[sideKey];
  if (!pending?.evPreset || !pending?.nature) return;
  applyEvPreset(sideKey, pending.evPreset);
  state[sideKey].nature = pending.nature;
  resetEvPresetProgress(sideKey);
}

function applyEvPreset(sideKey, preset) {
  const side = state[sideKey];
  const p = PokemonById[side.pokemonIdx];
  if (!p) return;

  // 紐⑤뱺 EV 0?쇰줈 由ъ뀑
  side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  // ?꾨━?뗫퀎 ???ㅽ꺈??32 ?ъ옄 (?깃꺽? ?ъ슜?먭? 蹂꾨룄濡??좏깮)
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

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
   ?먮룞 吏꾩엯 ?④낵 ?곸슜
   - ?먮낯 state???좎??섍퀬 怨꾩궛??蹂듭궗蹂몄뿉留??먮룞 ?④낵瑜??곸슜
   - ?먮룞?쇰줈 耳쒖쭊 ?꾨뱶???ъ슜?먭? ?섎룞 蹂寃쏀븯硫??ㅼ쓬 ?ъ폆紐?蹂寃??꾧퉴吏 ??뼱?곗? ?딆쓬
   ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
