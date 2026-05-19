/* Reverse calculator rendering. */
function renderRevCalcMy() {
  const container = document.getElementById('rc-my-body');
  if (!container) return;
  const my = revCalcState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) { container.innerHTML = '<div class="empty-state ui-empty">포켓몬 선택 필요</div>'; return; }
  const formControl = renderToolFormCombobox({
    pokemonId: my.pokemonIdx,
    inputClass: 'rc-cb-input',
    pickAttr: 'data-rc-pick',
    pickValue: 'myForm',
    ariaLabel: '내 포켓몬 폼 선택',
  });
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'rc-cb-field rc-pokemon-field',
    headClass: 'rc-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    primaryActions: uiButton('불러오기', {
      class: 'party-load-button ui-label-action ui-field-action',
      'data-party-import-target': 'revcalc:my',
    }),
    metaActions: `
      ${formControl}
      ${renderToolPokemonTypeStrip({ types: p.types, ariaLabel: '타입' })}
    `,
    inputClass: 'rc-cb-input',
    inputAttrs: { 'data-rc-pick': 'my' },
    value: pkName(p),
  });
  const stats = calcStats(my);
  const totalEV = ['hp','atk','def','spa','spd','spe'].reduce((a,s) => a + (my.evs[s]||0), 0);
  const overEV = totalEV > 66;
  const moveSetRows = rcMoveSet().map((moveId, idx) => `
    <div class="rc-move-slot-field">
      ${rcRenderMoveCombobox('moveslot', moveId, { slot: idx, placeholder: '기술 선택' })}
    </div>
  `).join('');

  const STAT_KO = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };
  const RANK_STATS = ['atk','def','spa','spd','spe'];
  const statRows = renderToolStatRows(['hp', ...RANK_STATS].map(s => {
    const ev = my.evs[s] || 0;
    const final = stats[s];
    const rank = my.ranks?.[s] || 0;
    return {
      stat: s,
      labelHtml: `<span class="ft-stat-label tool-stat-name-text">${escapeHTML(STAT_KO[s])}</span>`,
      base: p.bs[s],
      point: ev,
      final,
      rank,
      natureHtml: renderToolStatNatureMark(s, my.nature, {
        upClass: 'ft-nature-up',
        downClass: 'ft-nature-down',
        emptyClass: 'ft-nature-spacer',
      }),
      pointOptions: {
        zeroAttrs: { 'data-rc-evset': s, 'data-rc-evval': '0' },
        inputAttrs: { 'data-rc-ev': s, min: '0', max: '32' },
        maxAttrs: { 'data-rc-evset': s, 'data-rc-evval': '32' },
      },
      rankOptions: {
        rankable: s !== 'hp',
        decAttrs: { 'data-rc-rank': s, 'data-rc-dir': '-1' },
        incAttrs: { 'data-rc-rank': s, 'data-rc-dir': '1' },
      },
    };
  }), {
    rowClass: 'ft-stat-row',
    nameClass: 'ft-stat-name',
    baseClass: 'ft-stat-base',
    finalClass: 'ft-stat-final',
  });

  container.innerHTML = `
    <div class="rc-setup-grid tool-settings-layout ui-control-grid">
      <div class="rc-pokemon-main-row ui-control-row">
        ${pokemonPicker}
      </div>
      <div class="field rc-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
        <div class="rc-settings-grid tool-settings-grid ui-control-grid">
          <label class="field rc-cb-field rc-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="ability"><span class="field-label tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">특성</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input rc-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-rc-pick="myability" value="${escapeHTML(rcComboLabel('ability', my.ability))}" placeholder="특성 검색..." autocomplete="off">
              <div class="combobox-options"></div>
            </div>
          </label>
          <label class="field rc-cb-field rc-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="nature"><span class="field-label tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">성격</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input rc-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-rc-pick="mynature" value="${escapeHTML(rcComboLabel('nature', my.nature))}" placeholder="성격 검색..." autocomplete="off">
              <div class="combobox-options"></div>
            </div>
          </label>
          <label class="field rc-cb-field rc-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="item"><span class="field-label tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">도구</span>
            <div class="combobox rc-flex-combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input rc-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-rc-pick="myitem" value="${my.item ? escapeHTML(itName(ItemById[my.item] || { name: my.item })) : '없음'}" autocomplete="off">
              <div class="combobox-options"></div>
            </div>
          </label>
        </div>
      </div>
    </div>
      <div class="rc-my-build-row ui-control-row">
      <div class="tool-stat-panel tool-stat-set tool-stat-set--revcalc tool-stat-has-nature ui-control-frame ui-subframe ui-subframe-stack ui-field">
        <div class="tool-stat-panel-head ui-section-head">
          <div class="tool-stat-panel-title ui-section-title">능력 포인트</div>
          <div class="ft-ev-total tool-stat-total ui-metric-chip ${overEV ? 'over' : ''}">
            총합 <b>${totalEV}</b> / 66 ${overEV ? '<span class="rc-ev-over">초과</span>' : ''}
          </div>
        </div>
        <div class="tool-stat-panel-body">
          <div class="tool-stat-table-frame ui-control-frame">
            <div class="ft-stats-grid rc-stats-grid tool-stat-grid ui-stat-grid ui-stat-table">
              ${renderToolStatHead(['name', 'base', 'point', 'final', 'rank'], {
                rowClass: 'ft-stats-head',
              })}
              ${statRows}
            </div>
          </div>
        </div>
      </div>
      <div class="rc-my-moves-panel ui-control-frame ui-subframe ui-subframe-stack">
        <div class="ft-section-title">기술배치</div>
        <div class="rc-move-set-grid compact ui-control-grid">${moveSetRows}</div>
      </div>
    </div>
  `;
  rcWireMyComboboxes();
  rcWireMoveComboboxes(container);
}

function renderRevCalcOpp() {
  const container = document.getElementById('rc-opp-body');
  if (!container) return;
  const opp = revCalcState.opp;
  const p = PokemonById[opp.pokemonIdx];
  const STAT_KO = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };
  const formControl = renderToolFormCombobox({
    pokemonId: opp.pokemonIdx,
    inputClass: 'rc-cb-input',
    pickAttr: 'data-rc-pick',
    pickValue: 'oppForm',
    ariaLabel: '상대 포켓몬 폼 선택',
  });
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'rc-cb-field rc-pokemon-field',
    headClass: 'rc-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    metaActions: `
      ${formControl}
      ${renderToolPokemonTypeStrip({
        types: p?.types,
        ariaLabel: '상대 타입',
        empty: !p,
      })}
    `,
    inputClass: 'rc-cb-input',
    inputAttrs: { 'data-rc-pick': 'opp' },
    value: p ? pkName(p) : '',
  });

  const statRows = renderToolStatRows(['hp','atk','def','spa','spd','spe'].map(s => {
    const r = opp.ranks?.[s] || 0;
    return {
      stat: s,
      label: STAT_KO[s],
      base: p?.bs?.[s] ?? '-',
      rank: r,
      rankHtml: `
        <div class="rc-opp-rank-cell tool-stat-col-rank">
          ${renderToolStatRankControl(s, r, {
            rankable: s !== 'hp',
            className: 'rc-opp-rank-stepper',
            emptyClass: 'rc-opp-rank-empty',
            emptyTag: 'span',
            valueClass: 'rc-opp-rank-value',
            decAttrs: { class: 'rc-opp-rank-button', 'data-rc-opprank': s, 'data-rc-dir': '-1' },
            incAttrs: { class: 'rc-opp-rank-button', 'data-rc-opprank': s, 'data-rc-dir': '1' },
          })}
        </div>
      `,
    };
  }), {
    columns: ['name', 'base', 'rank'],
    rowClass: 'rc-opp-stat-row',
    nameClass: 'rc-opp-stat-name',
    baseClass: 'rc-opp-stat-base',
  });

  container.innerHTML = `
    <div class="rc-setup-grid rc-opp-setup tool-settings-layout ui-control-grid">
      <div class="rc-pokemon-main-row ui-control-row">
        ${pokemonPicker}
      </div>
      ${p ? `
        <div class="field rc-settings-field rc-opp-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
          <div class="rc-settings-grid rc-opp-settings-grid tool-settings-grid ui-control-grid">
            <label class="field rc-field rc-opp-status-field tool-settings-cell tool-settings-choice-cell tool-settings-condition-cell ui-control-cell ui-field" data-tool-setting="condition"><span class="field-label tool-settings-label tool-settings-choice-label ui-field-label ui-control-label">상태</span>
              <div class="combobox rc-status-combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-condition-control tool-settings-status-combobox">
                <button type="button" class="cb-input cb-trigger tool-settings-choice-surface tool-settings-choice-input" data-rc-status="opp" aria-label="상대 상태 선택" aria-expanded="false">${escapeHTML(rcStatusDisplayLabel(opp.status))}</button>
                <div class="combobox-options" role="listbox"></div>
              </div>
            </label>
          </div>
        </div>
      ` : ''}
    </div>
    ${p ? `
      <div class="rc-opp-stat-panel tool-stat-panel tool-stat-set tool-stat-set--revcalc-opponent ui-control-frame ui-subframe ui-subframe-stack ui-field">
        <div class="tool-stat-panel-head ui-section-head">
          <div class="tool-stat-panel-title ui-section-title">능력 상태</div>
        </div>
        <div class="tool-stat-panel-body">
          <div class="tool-stat-table-frame ui-control-frame">
            <div class="rc-opp-stat-table tool-stat-grid ui-stat-grid ui-stat-table">
              ${renderToolStatHead(['name', 'base', 'rank'], {
                rowClass: 'rc-opp-stat-head',
                cellClass: 'rc-opp-stat-head-cell',
              })}
              ${statRows}
            </div>
          </div>
        </div>
      </div>
    ` : ''}
  `;
  rcWireOppComboboxes();
}

function renderRevCalcInputs() {
  const container = document.getElementById('rc-input-body');
  if (!container) return;
  const my = revCalcState.my;

  // 내 관측 기술은 입력한 기술폭 4개 안에서 선택하고, 상대 기술은 변화기 관측까지 허용한다.
  rcNormalizeObservedMyMove();

  const myCurrentHp = rcCurrentHpValue(my);

  // 도구 후보 체크박스 (type-boost 도구 + 그외 사용 가능 도구)
  const itemMaster = ITEMS.filter(i => !i.ms && !i.isBerry);
  const knownOppItem = rcKnownOpponentItem();
  const itemCandidates = knownOppItem === null ? rcActiveItemCandidates() : [];
  const itemPanelOpen = !!revCalcState.itemCandidatesOpen;
  const itemBoxes = itemMaster.map(i => `
    <label class="rc-item-chk ${knownOppItem !== null ? 'disabled' : ''}">
      <input type="checkbox" data-rc-item="${i.id}" ${knownOppItem === null && itemCandidates.includes(i.id) ? 'checked' : ''} ${knownOppItem !== null ? 'disabled' : ''}>
      ${escapeHTML(itName(i))}
    </label>
  `).join('');

  container.innerHTML = `
    <div class="rc-input-grid ui-control-grid">
      <div class="rc-input-block rc-action-block ui-control-frame ui-subframe ui-subframe-stack">
        <div class="ft-section-title">내 행동</div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-observed-row rc-observed-subframe ui-control-row ui-control-frame ui-subframe">
          <label class="field rc-field-wide ui-field">
            <span class="field-label ui-field-label">사용 기술</span>
            ${rcRenderMoveCombobox('myMove', revCalcState.myMove, { placeholder: '사용 기술 선택' })}
          </label>
          <label class="field rc-field-compact ui-field">
            <span class="field-label ui-field-label">상대 남은 HP %</span>
            <input type="number" data-rc-action="observedTheirPct" value="${revCalcState.observedTheirPct}" min="0" max="100" placeholder="0~100">
          </label>
        </div>
        <div class="rc-input-divider"></div>
        <div class="rc-side-condition-row rc-observed-subframe ui-control-frame ui-subframe ui-control-grid">
          <label class="checkbox-label rc-compact-toggle ui-check"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="defReflect" ${revCalcState.observedFields.dealt.defReflect ? 'checked' : ''}> 상대 리플렉터</label>
          <label class="checkbox-label rc-compact-toggle ui-check"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="defLightScreen" ${revCalcState.observedFields.dealt.defLightScreen ? 'checked' : ''}> 상대 빛의장막</label>
          <label class="checkbox-label rc-compact-toggle ui-check"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="isCritical" ${revCalcState.observedFields.dealt.isCritical ? 'checked' : ''}> 내 공격 급소</label>
        </div>
      </div>

      <div class="rc-input-block rc-action-block ui-control-frame ui-subframe ui-subframe-stack">
        <div class="ft-section-title">상대 행동</div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-observed-row rc-observed-subframe ui-control-row ui-control-frame ui-subframe">
          <label class="field rc-field-wide ui-field">
            <span class="field-label ui-field-label">사용 기술</span>
            ${rcRenderMoveCombobox('oppMove', revCalcState.oppMove, { placeholder: '상대 기술 선택' })}
          </label>
          <label class="field rc-field-compact ui-field">
            <span class="field-label ui-field-label">내 남은 HP</span>
            <input type="number" data-rc-action="observedMyHp" value="${revCalcState.observedMyHp}" min="0" max="${myCurrentHp}" placeholder="0~${myCurrentHp}">
          </label>
        </div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-observed-row rc-opp-item-row rc-observed-subframe ui-control-row ui-control-frame ui-subframe">
          <label class="field rc-field-wide ui-field">
            <span class="field-label ui-field-label">상대 도구</span>
            ${rcRenderOppItemCombobox(revCalcState.oppItemKnown)}
          </label>
        </div>
        <div class="rc-input-divider"></div>
        <div class="rc-side-condition-row rc-observed-subframe ui-control-frame ui-subframe ui-control-grid">
          <label class="checkbox-label rc-compact-toggle ui-check"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="defReflect" ${revCalcState.observedFields.received.defReflect ? 'checked' : ''}> 내 리플렉터</label>
          <label class="checkbox-label rc-compact-toggle ui-check"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="defLightScreen" ${revCalcState.observedFields.received.defLightScreen ? 'checked' : ''}> 내 빛의장막</label>
          <label class="checkbox-label rc-compact-toggle ui-check"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="isCritical" ${revCalcState.observedFields.received.isCritical ? 'checked' : ''}> 상대 공격 급소</label>
        </div>
      </div>

      <div class="rc-input-block rc-speed-block ui-control-frame ui-subframe ui-subframe-stack">
        <div class="ft-section-title">선후공 | 필드 상태</div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-speed-field-row rc-observed-subframe ui-control-row ui-control-frame ui-subframe">
          <label class="field rc-field-compact ui-field">
            <span class="field-label ui-field-label">이번 턴 행동 순서</span>
            ${rcRenderTurnOrderCombobox(revCalcState.turnOrder)}
          </label>
          <label class="field battle-field-choice battle-weather-field ui-field ui-choice-field"><span class="field-label ui-field-label ui-choice-label">날씨</span>
            ${rcRenderFieldCombobox('weather', revCalcState.field.weather)}
          </label>
          <label class="field battle-field-choice battle-terrain-field ui-field ui-choice-field"><span class="field-label ui-field-label ui-choice-label">필드</span>
            ${rcRenderFieldCombobox('terrain', revCalcState.field.terrain)}
          </label>
        </div>
      </div>

      <div class="rc-input-block rc-item-candidates-block ui-control-frame ui-subframe ui-subframe-stack ${itemPanelOpen ? 'open' : 'collapsed'}">
        <button type="button" class="ft-section-title rc-title-with-badge rc-collapse-head" data-rc-toggle-item-candidates aria-expanded="${itemPanelOpen ? 'true' : 'false'}">
          <span>도구 후보</span>
          <span class="rc-count-badge rc-item-candidate-count">${knownOppItem === null ? `${itemCandidates.length}개` : '고정됨'}</span>
        </button>
        <div class="rc-input-divider rc-collapse-divider"></div>
        <div class="rc-item-candidates-body" ${itemPanelOpen ? '' : 'hidden'}>
          <div class="rc-item-grid rc-observed-subframe ui-control-frame ui-subframe">${itemBoxes}</div>
        </div>
      </div>
    </div>
  `;
  rcWireMoveComboboxes(container);
  rcWireOppItemComboboxes(container);
  rcWireTurnOrderComboboxes(container);
  rcWireFieldComboboxes(container);
}

function renderRevCalcResults() {
  const container = document.getElementById('rc-results-body');
  if (!container) return;
  if (revCalcState.analyzing) {
    container.innerHTML = '<div class="empty-state ui-empty">형태 분석 중...</div>';
    return;
  }
  const r = revCalcState.results;
  if (!r) {
    container.innerHTML = '<div class="empty-state ui-empty">피해량과 선후공 정보를 입력하고 형태 분석을 실행하세요.</div>';
    return;
  }
  if (r.error) {
    container.innerHTML = `<div class="empty-state error ui-empty">분석 오류: ${escapeHTML(r.error)}</div>`;
    return;
  }

  if (!r.results.length) {
    container.innerHTML = `
      <div class="empty-state ui-empty">66포인트 룰과 관측값을 동시에 만족하는 형태가 없습니다.</div>
    `;
    return;
  }

  const scarfBrief = r.speedActive
    ? (r.scarfViable && !r.nonScarfViable
        ? '속도 조건은 구애스카프 후보만 남습니다.'
        : r.scarfViable
          ? '구애스카프와 비스카프 후보가 함께 남습니다.'
          : '구애스카프 없이도 속도 조건을 만족합니다.')
    : '속도 조건은 사용하지 않았습니다.';
  const first = r.results[0];
  const topItem = first.item ? itName(ItemById[first.item] || { name: first.item }) : '도구 없음';
  const investmentBrief = rcBriefInvestmentParts(first, r.speedActive);
  const briefing = `상위 후보는 ${topItem}, ${NATURE_BY_ID[first.nature]?.ko || first.nature} 성격입니다. 관측 투자 범위는 ${investmentBrief}입니다. ${scarfBrief}`;

  const followupMoveIds = rcVisibleMoveSet();
  const openIndexes = new Set((Array.isArray(revCalcState.openResultIndexes) ? revCalcState.openResultIndexes : [])
    .map(v => parseInt(v, 10))
    .filter(v => Number.isInteger(v) && v >= 0 && v < r.results.length));
  const predictedMoveId = revCalcState.predictedOppMove || revCalcState.oppMove || '';

  const rows = r.results.map((c, i) => {
    const evDesc = rcCandidateEvParts(c, r.speedActive);
    const natureKo = NATURE_BY_ID[c.nature]?.ko || c.nature;
    const itemTag = c.item
      ? `<span class="rc-result-item ${c.item === 'choicescarf' ? 'rc-scarf-item' : ''}">${escapeHTML(itName(ItemById[c.item] || { name: c.item }))}</span>`
      : '<span class="rc-result-item rc-no-item">도구 없음</span>';
    const natureTag = `<span class="rc-result-nature-badge">${escapeHTML(natureKo)}</span>`;
    const abilityTag = rcCandidateAbilityIds(c)
      .map(id => `<span class="rc-result-ability">${escapeHTML(abName(AbilityById[id] || { name: id }))}</span>`)
      .join('');
    const speedRange = c.speedInfo?.active
      ? `S 가능범위 ${c.speEvMin ?? c.speedInfo.speMin}~${c.speEvMax ?? c.speedInfo.speMax}`
      : '속도 미사용';
    const totalMin = c.totalEvMin ?? c.totalEv;
    const totalMax = c.totalEvMax ?? c.maxTotalEv ?? c.totalEv;
    const totalRange = totalMax !== undefined && totalMax !== totalMin
      ? `${totalMin}~${totalMax}`
      : `${totalMin}`;
    const speedPlan = rcSpeedPlanLabel(c, r.speedActive);
    const roleInfo = rcRoleCompletionInfo(c, r.speedActive);
    const followupChips = followupMoveIds
      .map(moveId => rcRenderFollowupMoveChip(rcAnalyzeMyFollowupMove(c, moveId, r.speedActive)))
      .filter(Boolean)
      .join('');
    const expanded = openIndexes.has(i);
    const predictedAnalysis = expanded && predictedMoveId
      ? rcAnalyzeOpponentFollowupMove(c, predictedMoveId, r.speedActive)
      : null;
    const predictedPanel = expanded ? `
      <div class="rc-prediction-panel ui-control-frame ui-subframe">
        <label class="field ui-field">
          <span class="field-label ui-field-label">상대 다음 기술</span>
          ${rcRenderMoveCombobox('predictedOppMove', predictedMoveId, { compact: true, placeholder: '예상 기술' })}
        </label>
        <div class="rc-prediction-result">
          ${predictedMoveId
            ? (rcRenderFollowupMoveChip(predictedAnalysis) || '<span class="rc-mini-note">계산 가능한 공격 기술을 선택해 주세요.</span>')
            : '<span class="rc-mini-note">상대 다음 기술을 선택하면 내 피해 범위를 표시합니다.</span>'}
        </div>
      </div>
    ` : '';
    const followupPanel = expanded ? `
      <div class="rc-followup-panel ui-control-frame ui-subframe">
        <div class="rc-followup-head"><span>내 기술들</span><small>현재 상대 HP 기준</small></div>
        <div class="rc-followup-grid">
          ${followupChips || '<span class="rc-mini-note">내 기술폭 4개를 입력하면 후보별 다음 대미지를 표시합니다.</span>'}
        </div>
      </div>
    ` : '';
    const infoPanel = `
      <div class="rc-result-profile rc-result-info-panel ui-control-frame ui-subframe">
        ${expanded ? '<div class="rc-result-panel-label">예상 정보</div>' : ''}
        <div class="rc-result-title">
          <b>${evDesc.join(' / ') || '무투자'}</b>
          ${natureTag}
          ${itemTag}
          ${abilityTag}
        </div>
        <div class="rc-result-lines">
          <span>${escapeHTML(roleInfo.label)} · ${escapeHTML(roleInfo.parts.join(' / ') || '-')}</span>
          <span>${escapeHTML(speedPlan)} · ${escapeHTML(speedRange)} · 관측 ${escapeHTML(totalRange)} / 완성 66</span>
        </div>
      </div>
    `;
    return `
      <div class="rc-result-row rc-form-result ${expanded ? 'open' : 'collapsed'} ui-control-frame ui-subframe" data-rc-toggle-result="${i}">
        <div class="rc-result-rank">#${i + 1}</div>
        ${expanded
          ? `<div class="rc-result-expanded-body">${infoPanel}${followupPanel}${predictedPanel}</div>`
          : infoPanel}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rc-briefing ui-control-frame ui-subframe">
      <div class="rc-briefing-title">요약</div>
      <div>${escapeHTML(briefing)}</div>
    </div>
    ${rcRenderNextRankPanel()}
    <div class="rc-results-list">${rows}</div>
  `;
  rcWireMoveComboboxes(container);
}

function renderRevCalcAll() {
  renderRevCalcMy();
  renderRevCalcOpp();
  renderRevCalcInputs();
  renderRevCalcResults();
}

// === 콤보박스 / 이벤트 ===
