/* Fine-tune rendering, DOM events, and calculator handoff. */
function renderFineTuneHp() {
  const container = document.getElementById('ft-hp-body');
  if (!container) return;
  const my = fineTuneState.my;
  const hasPokemon = !!PokemonById[my.pokemonIdx];
  const panel = document.getElementById('ft-hp-panel');
  const layout = document.getElementById('ft-layout');
  if (panel) panel.hidden = !hasPokemon;
  layout?.classList.toggle('has-hp-results', hasPokemon);
  if (!hasPokemon) {
    renderTrustedHTML(container, '');
    return;
  }
  const rows = ftHpBreakpoints(my)
    .filter(info => info.rule.relevant || info.current || info.next || info.prev);
  const groups = ftGroupHpBreakpoints(my, rows).sort(ftCompareBreakpointGroups);

  renderTrustedHTML(container, `
    <section class="ft-hp-section ui-control-frame ui-subframe">
      <div class="ft-hp-title">
        <span>HP 기준점</span>
        <b>HP ${calcStats(my).hp}</b>
      </div>
      <div class="ft-breakpoint-list">
        ${groups.map(group => `
          <div class="ft-breakpoint-item ${group.current ? 'active' : ''} ${group.relevant ? '' : 'muted'}">
            <div class="ft-breakpoint-main">
              <b>${escapeHTML(ftUniqueJoin(group.entries.map(info => info.rule.rule)))}</b>
              <span>${escapeHTML(ftFormatBreakpointDescriptions(group.entries))}</span>
            </div>
            <div class="ft-breakpoint-deltas">${ftBreakpointBadges(my, group.sample)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `);
}

function renderFineTuneMy() {
  const container = document.getElementById('ft-my-body');
  if (!container) return;
  const my = fineTuneState.my;
  const p = PokemonById[my.pokemonIdx];
  const formControl = p ? renderToolFormCombobox({
    pokemonId: my.pokemonIdx,
    inputClass: 'ft-cb-input',
    pickAttr: 'data-ft-pick',
    pickValue: 'myForm',
    ariaLabel: '내 포켓몬 폼 선택',
  }) : '';
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'ft-cb-field ft-pokemon-field',
    headClass: 'ft-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    primaryActions: uiButton('불러오기', {
      class: 'party-load-button ui-label-action ui-field-action',
      'data-party-import-target': 'finetune:my',
    }),
    titleActions: `
      <div class="ft-pokemon-apply-actions tool-pokemon-actions tool-pokemon-nav-actions ui-field-actions">
        <button type="button" class="ft-apply-side-button ui-label-action ui-field-action" data-ft-apply-side="atk" title="현재 세팅을 계산기 공격측으로 적용">공격측</button>
        <button type="button" class="ft-apply-side-button ui-label-action ui-field-action" data-ft-apply-side="def" title="현재 세팅을 계산기 방어측으로 적용">방어측</button>
      </div>
    `,
    inputClass: 'ft-cb-input',
    inputAttrs: { 'data-ft-pick': 'my' },
    value: p ? pkName(p) : '',
    placeholder: '포켓몬 검색...',
    toolbarClass: 'ft-pokemon-meta-row pokemon-meta-row ui-field-meta-row ui-control-row ui-chip-row',
    toolbarActions: p ? `
      ${renderToolPokemonTypeStrip({ types: normalizeSideTypes(my), ariaLabel: '타입' })}
      ${formControl}
    ` : '',
  });
  if (!p) {
    renderTrustedHTML(container, `
      <div class="ft-setup-grid tool-settings-layout ui-control-grid">
        <div class="ft-pokemon-main-row ui-control-row">
          ${pokemonPicker}
        </div>
      </div>
      <div class="empty-state ui-empty">포켓몬 선택 필요</div>
    `);
    ftWireMyComboboxes();
    return;
  }

  const stats = calcStats(my);
  const bulk = ftBulkMetrics(my);
  const ev = ftEvSummary(my);
  const rankStats = ['atk','def','spa','spd','spe'];
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const statRows = renderToolStatRows(['hp', ...rankStats].map(stat => {
    const ev = my.evs[stat] || 0;
    const rank = my.ranks?.[stat] || 0;
    return {
      stat,
      label: STAT_LABEL?.[stat] || stat,
      base: p.bs[stat],
      point: ev,
      magicHtml: ftRenderMagicCell(my, stat, ev),
      final: stats[stat],
      rank,
      natureHtml: ftNatureMark(stat, my.nature),
      pointOptions: {
        zeroAttrs: { 'data-ft-evset': stat, 'data-ft-evval': '0', title: '0' },
        inputAttrs: { 'data-ft-ev': stat, min: '0', max: '32', 'aria-label': `${STAT_LABEL?.[stat] || stat} 포인트` },
        maxAttrs: { 'data-ft-evset': stat, 'data-ft-evval': '32', title: '32' },
      },
      rankOptions: {
        rankable: stat !== 'hp',
        decAttrs: { 'data-ft-rank': stat, 'data-ft-dir': '-1' },
        incAttrs: { 'data-ft-rank': stat, 'data-ft-dir': '1' },
      },
    };
  }), {
    columns: ['name', 'base', 'point', 'magic', 'final', 'rank'],
    rowClass: 'ft-stat-row',
    nameClass: 'ft-stat-name',
    baseClass: 'ft-stat-base',
    finalClass: 'ft-stat-final',
  });

  renderTrustedHTML(container, `
    <div class="ft-setup-grid tool-settings-layout ui-control-grid">
      <div class="ft-pokemon-main-row ui-control-row">
        ${pokemonPicker}
      </div>
      <div class="ft-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
        <div class="ft-settings-grid tool-settings-grid ui-control-grid">
          <div class="ft-cb-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="ability"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">특성</span>
            <div class="ft-ability-control tool-settings-control tool-settings-choice-control tool-settings-compound tool-settings-select-control">
              <div class="combobox tool-settings-combobox tool-settings-choice-combobox tool-settings-select-combobox">
                <input type="text" class="cb-input ft-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-ft-pick="ability" value="${escapeHTML(ftComboLabel('ability', my.ability))}" placeholder="특성 검색...">
                <div class="combobox-options"></div>
              </div>
              ${speedActivation ? `<label class="checkbox-label ft-speed-toggle ui-check" title="${escapeHTML(speedActivation.label)}"><input type="checkbox" id="ftWeatherAbility" ${fineTuneState.weatherAbilityActive ? 'checked' : ''}>${escapeHTML(speedActivation.label)}</label>` : ''}
            </div>
          </div>
          <label class="ft-cb-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="nature"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">성격</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input ft-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-ft-pick="nature" value="${escapeHTML(ftComboLabel('nature', my.nature))}" placeholder="성격 검색...">
              <div class="combobox-options"></div>
            </div>
          </label>
          <label class="ft-cb-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="item"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">도구</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input ft-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-ft-pick="item" value="${escapeHTML(ftComboLabel('item', my.item))}" placeholder="도구 검색...">
              <div class="combobox-options"></div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="tool-stat-panel tool-stat-set tool-stat-set--finetune tool-stat-has-bulk tool-stat-has-nature tool-stat-has-magic ui-control-frame ui-subframe ui-subframe-stack ui-field">
      <div class="tool-stat-panel-head ui-section-head">
        <div class="tool-stat-panel-title ui-section-title">능력 포인트</div>
        <div class="ft-stat-total tool-stat-total ui-label-action ui-metric-chip is-static ${ev.over ? 'over' : ''}">
          <span>총합</span>
          <span><b>${ev.total}</b>/66</span>
        </div>
      </div>
      <div class="tool-stat-panel-body">
        <div class="ft-stats-column tool-stat-table-frame ui-control-frame">
          <div class="ft-stats-grid tool-stat-grid ui-stat-grid ui-stat-table">
            ${renderToolStatHead(['name', 'base', 'point', 'magic', 'final', 'rank'], {
              rowClass: 'ft-stats-head',
            })}
            ${statRows}
          </div>
        </div>
      </div>
      ${renderToolStatBulkStrip(bulk, {
        physLabel: '물리 내구',
        specLabel: '특수 내구',
      })}
    </div>
  `);
  ftWireMyComboboxes();
}

function renderFineTuneOpp() {
  const container = document.getElementById('ft-opp-body');
  if (!container) return;
  const opp = fineTuneState.opp;
  const p = PokemonById[opp.pokemonIdx];
  const baseSpe = p ? ftOpponentBaseSpeed(opp) : '';
  const formControl = renderToolFormCombobox({
    pokemonId: opp.pokemonIdx,
    inputClass: 'ft-cb-input',
    pickAttr: 'data-ft-pick',
    pickValue: 'oppForm',
    ariaLabel: '상대 포켓몬 폼 선택',
  });
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'ft-cb-field ft-pokemon-field',
    headClass: 'ft-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    metaActions: `
      ${formControl}
      ${renderToolPokemonTypeStrip({
        types: p?.types,
        className: 'ft-opp-type-strip',
        ariaLabel: '상대 타입',
        empty: !p,
      })}
    `,
    inputClass: 'ft-cb-input',
    inputAttrs: { 'data-ft-pick': 'opp' },
    value: p ? pkName(p) : '',
  });

  renderTrustedHTML(container, `
    <section class="ft-opp-section ui-control-frame ui-subframe ui-subframe-stack">
      <div class="ft-opp-card-head">
        <span class="ft-section-title">상대 포켓몬</span>
      </div>
      <div class="ft-opp-config-row ui-control-row">
        <div class="ft-opp-pick-row ui-control-row">
          ${pokemonPicker}
        </div>
        <div class="ft-opp-speed-setup ui-control-frame ui-subframe">
          <label class="ft-base-speed-field ft-speed-compact-field ui-field"><span class="ui-field-label">속도</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="ftOppBaseSpe" value="${escapeHTML(baseSpe)}" placeholder="속도">
          </label>
          <div class="ft-rank-scarf-row ui-control-row">
            <div class="ft-rank-field ft-speed-compact-field ui-field"><span class="ui-field-label">랭크</span>
              <div class="ft-rank tool-stat-rank-stepper">
                <button type="button" class="ft-rank-btn tool-stat-rank-button ui-stat-button" data-ft-opprank="-1">-</button>
                <span class="ft-rank-val ${opp.speRank > 0 ? 'pos' : opp.speRank < 0 ? 'neg' : ''}">${opp.speRank > 0 ? '+' + opp.speRank : opp.speRank}</span>
                <button type="button" class="ft-rank-btn tool-stat-rank-button ui-stat-button" data-ft-opprank="1">+</button>
              </div>
            </div>
            <label class="checkbox-label ft-opp-scarf ui-check">
              <input type="checkbox" id="ftOppScarf" ${opp.scarf ? 'checked' : ''}>
              <span>구애스카프</span>
            </label>
          </div>
        </div>
      </div>
      <div class="ft-opp-speed-detail ui-control-frame ui-subframe">
        <div class="ft-opp-speed-detail-head">
          <span>속도 실수치</span>
          <i aria-hidden="true"></i>
        </div>
        <div class="ft-opp-speed-chips">
          ${ftRenderOppSpeedChipsHtml(opp)}
        </div>
      </div>
    </section>
  `);
  ftWireOppComboboxes();
}

function renderFineTuneSpeed() {
  const container = document.getElementById('ft-speed-body');
  if (!container) return;
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const myP = PokemonById[my.pokemonIdx];
  const oppP = PokemonById[opp.pokemonIdx];
  if (!myP || !oppP) {
    renderTrustedHTML(container, '<div class="empty-state ui-empty">양쪽 포켓몬 선택 필요</div>');
    return;
  }
  const rows = ftBuildSpeedTable();
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const activeSpeedNote = speedActivation && fineTuneState.weatherAbilityActive
    ? `<span class="ft-tag ok">${escapeHTML(speedActivation.label)}</span>`
    : '';
  const myCurrentSpe = ftMySpeed(my);
  const speedTags = [
    my.item === 'choicescarf' ? '<span class="ft-tag warn">스카프 적용</span>' : '',
    activeSpeedNote,
    (my.ranks?.spe || 0) !== 0 ? `<span class="ft-tag">랭크 ${my.ranks.spe > 0 ? '+' : ''}${my.ranks.spe}</span>` : '',
  ].filter(Boolean).join('');

  renderTrustedHTML(container, `
    <div class="ft-speed-summary ui-control-frame ui-subframe">
      <div class="ft-current-speed-inline">
        <span>내 현재 속도</span>
        <b>${myCurrentSpe}</b>
      </div>
      <div class="ft-speed-flags">${speedTags || '<span class="ft-speed-muted">추가 보정 없음</span>'}</div>
    </div>
    <div class="ft-speed-divider" aria-hidden="true"></div>
    <div class="ft-speed-case-grid">
      ${rows.map(row => {
        const possible = row.need !== null;
        const needHtml = possible
          ? `<span class="ft-speed-need-value"><b>${row.need}</b><span>포인트</span></span>`
          : '<span class="ft-speed-need-value impossible"><b>불가</b></span>';
        return `
          <article class="ft-speed-case ui-control-frame ui-subframe ${possible ? 'possible' : 'impossible'}" title="필요 속도 ${row.target} 이상 (상대 ${row.oppSpe} + ${margin})">
            <div class="ft-speed-case-head">
              <b>${escapeHTML(row.label)}</b>
              <small>${escapeHTML(row.sub || '')}</small>
            </div>
            <div class="ft-speed-case-spe">
              <span>상대 속도</span>
              <b>${row.oppSpe}</b>
            </div>
            <div class="ft-speed-case-need">
              <span class="ft-speed-need-label">+${margin} 추월</span>
              ${needHtml}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `);
}

function renderFineTuneAll() {
  renderFineTuneMy();
  renderFineTuneHp();
  renderFineTuneOpp();
  renderFineTuneSpeed();
}


document.getElementById('page-finetune')?.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppScarf') { fineTuneState.opp.scarf = t.checked; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  if (t.id === 'ftWeatherAbility') { fineTuneState.weatherAbilityActive = t.checked; renderFineTuneAll(); return; }
  if (t.id === 'ftOppBaseSpe') { fineTuneState.opp.baseSpe = t.value; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  const pointInputStat = t.dataset.toolStatPointInput || t.dataset.ftEv;
  if (pointInputStat) {
    const stat = pointInputStat;
    const normalized = toolStatNormalizePointInputValue(t.value);
    if (normalized !== t.value) t.value = normalized;
    ftSetEv(stat, t.value);
    if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
    renderFineTuneAll();
    return;
  }
});

document.getElementById('page-finetune')?.addEventListener('input', e => {
  const t = e.target;
  const pointInputStat = t.dataset.toolStatPointInput || t.dataset.ftEv;
  if (pointInputStat) {
    const normalized = toolStatNormalizePointInputValue(t.value);
    if (normalized !== t.value) t.value = normalized;
    ftSetEv(pointInputStat, t.value);
    if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
    renderFineTuneAll();
    return;
  }
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppBaseSpe') { fineTuneState.opp.baseSpe = t.value; ftRefreshOppSpeedChips(); renderFineTuneSpeed(); return; }
});

document.getElementById('page-finetune')?.addEventListener('click', e => {
  const t = e.target;
  const applySideButton = t.closest?.('[data-ft-apply-side]');
  if (applySideButton) {
    ftApplyToCalc(applySideButton.dataset.ftApplySide);
    return;
  }
  // EV quick set 버튼 (0/32) — 66 캡 적용
  const pointSetStat = t.dataset.toolStatPointSet || t.dataset.ftEvset;
  if (pointSetStat !== undefined) {
    const stat = pointSetStat;
    ftSetEv(stat, t.dataset.toolStatPointValue ?? t.dataset.ftEvval);
    renderFineTuneAll();
    return;
  }
  // 내 측 랭크
  const rankStat = t.dataset.toolStatRank || t.dataset.ftRank;
  if (rankStat) {
    const stat = rankStat;
    const dir = t.dataset.toolStatRankDir || t.dataset.ftDir;
    if (typeof toolStatApplyRankDelta === 'function') {
      toolStatApplyRankDelta(fineTuneState.my, stat, dir);
    } else {
      const cur = fineTuneState.my.ranks[stat] || 0;
      fineTuneState.my.ranks[stat] = Math.max(-6, Math.min(6, cur + (parseInt(dir, 10) || 0)));
    }
    renderFineTuneAll();
    return;
  }
  // 상대 측 랭크
  if (t.dataset.ftOpprank !== undefined) {
    const dir = parseInt(t.dataset.ftOpprank, 10);
    fineTuneState.opp.speRank = Math.max(-6, Math.min(6, (fineTuneState.opp.speRank || 0) + dir));
    renderFineTuneOpp(); renderFineTuneSpeed();
    return;
  }
});

// 양방향 sync — 세부조정 → 계산기
function ftApplyToCalc(targetSide) {
  // targetSide: 'atk' | 'def' (내 포켓몬이 들어갈 자리)
  const otherSide = targetSide === 'atk' ? 'def' : 'atk';
  // 내 풀세팅을 deep clone 해서 적용
  state[targetSide] = cloneCalcValue(fineTuneState.my);
  // 상대 포켓몬을 반대편에. 다른 세팅(EV/성격 등)은 새로 makeSideState 로 default.
  const oppP = PokemonById[fineTuneState.opp.pokemonIdx];
  if (oppP) {
    const otherDefault = makeSideState(fineTuneState.opp.pokemonIdx);
    // 스카프 / 랭크 정보만 transfer
    if (fineTuneState.opp.scarf) otherDefault.item = 'choicescarf';
    otherDefault.ranks.spe = fineTuneState.opp.speRank || 0;
    state[otherSide] = otherDefault;
  }
  renderSide('atk');
  renderSide('def');
  triggerCalc();
  // 계산기 탭으로 이동
  const calcNav = document.querySelector('.nav-tab[data-page="calc"]');
  if (calcNav) calcNav.click();
}


// 양방향 sync — 계산기 → 세부조정
// renderSide 가 만든 패널 헤더에 "🔧 세부조정" 버튼이 추가되어, 클릭 시 이 함수 호출.
function loadSideToFineTune(sideKey) {
  const src = state[sideKey];
  fineTuneState.my = cloneCalcValue(src);
  // 상대 자리는 계산기의 반대편 포켓몬으로
  const otherKey = sideKey === 'atk' ? 'def' : 'atk';
  fineTuneState.opp.pokemonIdx = state[otherKey].pokemonIdx;
  fineTuneState.opp.scarf = state[otherKey].item === 'choicescarf';
  fineTuneState.opp.speRank = state[otherKey].ranks?.spe || 0;
  fineTuneState.opp.baseSpe = '';
  fineTuneState.weatherAbilityActive = false;
  // 세부조정 탭 이동
  const ftNav = document.querySelector('.nav-tab[data-page="finetune"]');
  if (ftNav) ftNav.click();
  renderFineTuneAll();
}
window.loadSideToFineTune = loadSideToFineTune; // 다른 모듈에서 호출 가능
