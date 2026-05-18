/* Damage calculator side panel rendering and side-level events. */
const calcEvPresetProgress = {
  atk: { evPreset: null, nature: null },
  def: { evPreset: null, nature: null },
};

function renderDurabilityStrip(side) {
  const dStats = calcStats(side);
  const physBulk = Math.round(dStats.hp * dStats.def / 0.411);
  const specBulk = Math.round(dStats.hp * dStats.spd / 0.411);
  return `
    <div class="durability-grid compact">
      <div class="durability-card phys">
        <span class="durability-label">\uBB3C\uB9AC \uB0B4\uAD6C</span>
        <span class="durability-value">${physBulk.toLocaleString()}</span>
      </div>
      <div class="durability-card spec">
        <span class="durability-label">\uD2B9\uC218 \uB0B4\uAD6C</span>
        <span class="durability-value">${specBulk.toLocaleString()}</span>
      </div>
    </div>
  `;
}

function renderMoveList(sideKey, side) {
  return `
    <div class="moves-list">
      <div class="move-list-header" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span>\uACB0\uC815\uB825</span>
      </div>
      ${[0,1,2,3].map(i => {
        const moveId = side.moves[i];
        const move = moveId ? MoveById[moveId] : null;
        const slotBp = move ? manualBpForSlot(side, i, move) : '';
        const manualBp = normalizeManualBp(side.moveBpOverrides?.[i]);
        const slotType = move ? manualTypeForSlot(side, i, move) : '';
        const manualType = normalizeMoveType(side.moveTypeOverrides?.[i]);
        const targetSide = state[sideKey === 'atk' ? 'def' : 'atk'];
        const moveForCalc = move ? moveWithManualBp(move, manualBp, manualType) : null;
        const power = moveForCalc ? estimateMovePower(side, moveForCalc, targetSide) : null;
        return `
          <div class="move-slot" data-move-slot="${i}">
            <span class="move-slot-num">${i+1}</span>
            <div class="move-select combobox" data-cb="${sideKey}-move-${i}">
              <input type="text" class="cb-input" value="${move ? escapeHTML(mvName(move)) : ''}" data-cb-type="move" data-side="${sideKey}" data-field="moves.${i}" placeholder="\uC5C6\uC74C" autocomplete="off" aria-label="${sideKey} move ${i+1} select" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            <div class="move-type-control combobox type-pill-combobox ${slotType ? `t-${slotType}` : 'type-none'}" data-cb="${sideKey}-move-type-${i}">
              <button type="button" class="cb-input cb-trigger" data-cb-type="moveType" data-side="${sideKey}" data-field="moveTypes.${i}" aria-label="${sideKey} move ${i+1} type" aria-expanded="false" ${move ? '' : 'disabled'}>${slotType ? escapeHTML(TYPE_KO[slotType] || slotType) : ''}</button>
              <div class="combobox-options" role="listbox"></div>
            </div>
            <label class="hp-inline-control move-bp-control ui-inline-number is-plain" title="power">
              <input type="text" class="hp-percent-input move-bp-input ui-inline-number-input" data-action="moveBp" data-side="${sideKey}" data-slot="${i}" value="${move ? slotBp : ''}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${sideKey} move ${i+1} power" ${move ? '' : 'disabled'}>
            </label>
            ${move ? `<span class="move-stat-info"><b>${typeof power.eff === 'number' ? power.eff.toLocaleString() : power.eff}</b></span>` : '<span class="move-stat-info empty">-</span>'}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSide(sideKey) {
  const side = state[sideKey];
  const container = document.getElementById(`${sideKey}-body`);
  const p = PokemonById[side.pokemonIdx];
  if (!p) { container.innerHTML = '<div class="empty-state">\uD3EC\uCF13\uBAAC \uC120\uD0DD \uD544\uC694</div>'; return; }
  
  const stats = calcStats(side);
  deriveHpFlags(side);
  const currentHp = currentHpValue(stats.hp, side.hpPct);
  const totalEV = Object.values(side.evs).reduce((a,b) => a+b, 0);
  const overEV = totalEV > 66;
  const manualDamageBlockToggle = renderManualDamageBlockToggle(sideKey, side);
  const natureInfo = NATURE_BY_ID[side.nature] || {};
  const evPresetButtons = ['AS', 'HA', 'HB', 'CS', 'HC', 'HD'].map(preset =>
    `<button class="ev-preset-btn ${calcEvPresetProgress[sideKey]?.evPreset === preset ? 'active' : ''}" data-action="evPreset" data-side="${sideKey}" data-preset="${preset}">${preset}</button>`
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
    `<button class="ev-preset-btn nature-btn ${calcEvPresetProgress[sideKey]?.nature === id ? 'active' : ''}" data-action="naturePreset" data-side="${sideKey}" data-nature="${id}" data-tooltip="${calcComboboxAttr(title)}" aria-label="${calcComboboxAttr(`${label}: ${title}`)}">${label}</button>`
  ).join('');
  
  container.innerHTML = `
    <!-- ?ъ폆紐??좏깮 -->
    <div class="field pokemon-field">
      <div class="pokemon-field-head ui-field-head">
        <div class="field-label">
          <span>\uD3EC\uCF13\uBAAC \uC120\uD0DD</span>
        </div>
        <div class="pokemon-actions ui-field-actions">
          <button type="button" class="party-load-button ui-label-action ui-field-action" data-party-import-target="calc:${sideKey}">불러오기</button>
          <button type="button" class="ft-jump-btn ui-label-action ui-field-action" data-ft-from-side="${sideKey}" title="fine tune">\uC138\uBD80\uC870\uC815</button>
          <button type="button" class="ft-jump-btn ui-label-action ui-field-action" data-rc-from-side="${sideKey}" title="reverse calc">\uC5ED\uACC4\uC0B0</button>
        </div>
      </div>
      <div class="pokemon-select combobox" data-cb="${sideKey}-poke">
        <input type="text" class="cb-input" value="${escapeHTML(pkName(p))}" data-cb-type="pokemon" data-side="${sideKey}" data-field="pokemonIdx" autocomplete="off" aria-label="${sideKey} pokemon select" aria-expanded="false">
        <div class="combobox-options" role="listbox"></div>
      </div>
      <div class="pokemon-meta-row ui-field-meta-row">
        ${renderTypeControls(sideKey, side)}
        <!-- ?뚮씪?ㅽ깉? 梨뷀뵾?몄뒪 紐⑤뱶?먯꽌 鍮꾪솢?깊솕??-->
      </div>
    </div>

    ${sideKey === 'def' ? renderBattleConditions('def') : ''}

    <div class="section-divider"></div>

    <!-- ?뱀꽦/?꾧뎄 + ?깃꺽/HP/?곹깭 -->
    <div class="field">
      <div class="calc-pair-grid">
        <div class="calc-control-cell">
          <span class="calc-control-label">\uD2B9\uC131</span>
          <div class="compound-control ability-toggle-cell">
            <div class="combobox" data-cb="${sideKey}-ability">
              <input type="text" class="cb-input" value="${escapeHTML(calcAbilityDisplayLabel(sideKey))}" data-cb-type="ability" data-side="${sideKey}" data-field="ability" placeholder="Ability" autocomplete="off" aria-label="${sideKey} ability select" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            ${manualDamageBlockToggle || '<span class="manual-ability-spacer" aria-hidden="true"></span>'}
          </div>
        </div>
        <div class="calc-control-cell">
          <span class="calc-control-label">\uB3C4\uAD6C</span>
          <div class="combobox" data-cb="${sideKey}-item">
            <input type="text" class="cb-input" value="${side.item ? (ItemById[side.item] ? escapeHTML(itName(ItemById[side.item])) : '') : '없음'}" data-cb-type="item" data-side="${sideKey}" data-field="item" placeholder="Item" autocomplete="off" aria-label="${sideKey} item select" aria-expanded="false">
            <div class="combobox-options" role="listbox"></div>
          </div>
        </div>
        <div class="calc-control-cell">
          <span class="calc-control-label">\uC131\uACA9</span>
          <div class="compound-control nature-spacer-cell">
            <div class="combobox" data-cb="${sideKey}-nature">
              <input type="text" class="cb-input" value="${escapeHTML(calcNatureLabel(NATURE_BY_ID[side.nature]))}" data-cb-type="nature" data-side="${sideKey}" data-field="nature" placeholder="Nature" autocomplete="off" aria-label="${sideKey} nature select" aria-expanded="false">
              <div class="combobox-options" role="listbox"></div>
            </div>
            <span class="manual-ability-spacer" aria-hidden="true"></span>
          </div>
        </div>
        <div class="calc-control-cell">
          <span class="calc-control-label">\uC0C1\uD0DC</span>
          <div class="compound-control hp-status-cell">
            <label class="hp-inline-control ui-inline-number">
              <input type="text" class="hp-percent-input ui-inline-number-input" data-action="hpPct" data-side="${sideKey}" value="${hpPercentInputValue(side)}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${sideKey} current HP percent">
              <span class="ui-inline-number-unit">%</span>
            </label>
            <div class="combobox" data-cb="${sideKey}-status">
              <button type="button" class="cb-input cb-trigger" data-cb-type="status" data-side="${sideKey}" data-field="status" aria-label="${sideKey} status select" aria-expanded="false">${escapeHTML(calcStatusDisplayLabel(side.status))}</button>
              <div class="combobox-options" role="listbox"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-divider"></div>

    <!-- ?ㅽ꺈 (?λ젰?ъ씤??+ ??겕 + ?ㅼ닔移? -->
    <div class="field ev-field ev-preset-shell" data-ev-preset-side="${sideKey}">
      <div class="ev-field-head">
        <div class="field-label ev-title-label">
          <span>\uB2A5\uB825 \uD3EC\uC778\uD2B8 \u00B7 \uB7AD\uD06C</span>
          <button type="button" class="ev-preset-toggle ui-label-action" data-action="evPresetMenu" data-side="${sideKey}" aria-expanded="false" aria-controls="ev-presets-${sideKey}">\uD504\uB9AC\uC14B</button>
        </div>
        <div class="ev-total ui-label-action is-static ${overEV ? 'over' : ''}">
          <span>\uCD1D\uD569</span>
          <span><b>${totalEV}</b>/66</span>
        </div>
      </div>
      <div class="ev-control-layout">
        <div class="stat-grid">
          <div class="stat-table-head">\uB2A5\uB825</div>
          <div class="stat-table-head">\uC885\uC871\uAC12</div>
          <div class="stat-table-head">\uB178\uB825\uCE58</div>
          <div class="stat-table-head">\uC2E4\uC218\uCE58</div>
          <div class="stat-table-head">\uB7AD\uD06C</div>
          ${STATS.map(s => {
            const r = (side.ranks[s] || 0);
            const isRankable = s !== 'hp';
            const cls = r > 0 ? 'up' : r < 0 ? 'down' : '';
            const natureMark = natureInfo.up === s
              ? '<span class="nature-stat-mark up" aria-label="nature up">\u25B2</span>'
              : natureInfo.down === s
                ? '<span class="nature-stat-mark down" aria-label="nature down">\u25BC</span>'
                : '<span class="nature-stat-mark empty" aria-hidden="true"></span>';
            return `
              <div class="stat-name"><span class="stat-name-text">${STAT_LABEL[s]}</span>${natureMark}</div>
              <div class="stat-base">${p.bs[s]}</div>
              <div class="ev-input-group">
                <button class="ev-quick min ui-stat-button" data-action="evQuick" data-side="${sideKey}" data-stat="${s}" data-val="0" title="set 0">0</button>
                <label class="hp-inline-control ev-inline-control ui-inline-number is-plain">
                  <input type="text" class="hp-percent-input ev-input ui-inline-number-input" data-action="ev" data-side="${sideKey}" data-stat="${s}" value="${side.evs[s]}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${STAT_LABEL[s]} EV">
                </label>
                <button class="ev-quick max ui-stat-button" data-action="evQuick" data-side="${sideKey}" data-stat="${s}" data-val="32" title="set 32">32</button>
              </div>
              <div class="stat-final">${stats[s]}</div>
              ${isRankable ? `
                <div class="stat-rank-btns">
                  <button class="ui-stat-button" data-action="rank" data-side="${sideKey}" data-stat="${s}" data-dir="-1">-</button>
                  <span class="stat-rank-val ui-stat-value ${cls}">${r > 0 ? '+' + r : r}</span>
                  <button class="ui-stat-button" data-action="rank" data-side="${sideKey}" data-stat="${s}" data-dir="1">+</button>
                </div>
              ` : '<div class="stat-rank-empty" aria-hidden="true"></div>'}
            `;
          }).join('')}
        </div>
      </div>
      ${renderDurabilityStrip(side)}
      <div class="ev-preset-popover" id="ev-presets-${sideKey}" role="dialog" aria-label="${sideKey} EV presets" aria-hidden="true">
        <div class="ev-presets">
          <div class="ev-presets-label">
            <span>\uB178\uB825\uCE58 \uD504\uB9AC\uC14B</span>
            <button type="button" class="reset-btn" data-action="evReset" data-side="${sideKey}">\uCD08\uAE30\uD654</button>
          </div>
          <div class="ev-presets-row">
            ${evPresetButtons}
          </div>
          <div class="ev-presets-label secondary">
            <span>\uC131\uACA9 \uD504\uB9AC\uC14B</span>
          </div>
          <div class="ev-presets-row natures">
            ${naturePresetButtons}
          </div>
        </div>
      </div>
    </div>

    <div class="section-divider"></div>

    <!-- 湲곗닠 -->
    <div class="field move-field">
      <div class="ev-field-head move-field-head">
        <div class="field-label move-title-label">
          <span>\uAE30\uC220 \uBC30\uCE58</span>
        </div>
      </div>
      <div class="move-section">
        ${renderMoveList(sideKey, side)}
      </div>
    </div>

    ${sideKey === 'atk' ? renderBattleConditions('atk') : ''}
  `;
  
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
          state[side].moves[idx] = id || '';
          state[side].moveBpOverrides[idx] = null;
          if (!Array.isArray(state[side].moveTypeOverrides)) state[side].moveTypeOverrides = [null, null, null, null];
          state[side].moveTypeOverrides[idx] = null;
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
  container.querySelectorAll('[data-action]').forEach(el => {
    const action = el.dataset.action;
    if (action === 'moveBp') {
      el.addEventListener('input', () => applyMoveBpInput(el));
      el.addEventListener('change', () => applyMoveBpInput(el, true));
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
        const stat = el.dataset.stat;
        const requested = Math.max(0, Math.min(32, parseInt(el.value) || 0));
        // ?ㅻⅨ ?ㅽ꺈 ?⑷퀎
        const otherTotal = STATS.reduce((sum, s) => sum + (s === stat ? 0 : (side.evs[s] || 0)), 0);
        const remaining = Math.max(0, 66 - otherTotal);
        // ?붿껌媛믨낵 ?붿뿬 ?쒕룄 以??묒? 媛믪쑝濡??대옩??        const finalVal = Math.min(requested, remaining);
        side.evs[stat] = finalVal;
        // ?ъ슜?먭? ?낅젰??媛믨낵 ?ㅼ젣 ?곸슜??媛믪씠 ?ㅻⅤ硫?input.value???낅뜲?댄듃
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
        // ?щ젋?붾쭅?댁꽌 ?쒖떆 ?낅뜲?댄듃
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
  const toggle = wrapper.querySelector('.ev-preset-toggle');
  const popover = wrapper.querySelector('.ev-preset-popover');
  toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  popover?.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!open) {
    resetEvPresetProgress(wrapper.dataset.evPresetSide);
    clearEvPresetActiveButtons(wrapper);
  }
}

function closeEvPresetPopovers(except = null) {
  document.querySelectorAll('#page-calc .ev-preset-shell.is-preset-open').forEach(wrapper => {
    if (wrapper !== except) setEvPresetPopover(wrapper, false);
  });
}

function toggleEvPresetPopover(button) {
  const wrapper = button?.closest('.ev-preset-shell');
  if (!wrapper) return;
  const willOpen = !wrapper.classList.contains('is-preset-open');
  closeEvPresetPopovers(wrapper);
  resetEvPresetProgress(wrapper.dataset.evPresetSide);
  clearEvPresetActiveButtons(wrapper);
  setEvPresetPopover(wrapper, willOpen);
}

function resetEvPresetProgress(sideKey) {
  if (!calcEvPresetProgress[sideKey]) return;
  calcEvPresetProgress[sideKey].evPreset = null;
  calcEvPresetProgress[sideKey].nature = null;
}

function clearEvPresetActiveButtons(wrapper) {
  wrapper?.querySelectorAll('.ev-preset-btn.active').forEach(button => {
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
  const row = button.closest('.ev-presets-row');
  row?.querySelectorAll('.ev-preset-btn').forEach(item => {
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
