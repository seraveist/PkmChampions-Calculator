/* Damage calculator side panel rendering and side-level events. */
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

