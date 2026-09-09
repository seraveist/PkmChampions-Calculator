/* Reverse calculator rendering. */
function rcSetStagePanelState(panelId, state, label) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.dataset.stageState = state;
  panel.setAttribute('aria-disabled', state === 'locked' ? 'true' : 'false');
  const status = panel.querySelector('.rc-stage-status');
  if (status) status.textContent = label;
}

function renderRevCalcMy() {
  const container = document.getElementById('rc-my-body');
  if (!container) return;
  const my = revCalcState.my;
  const p = PokemonById[my.pokemonIdx];
  const formControl = p ? renderToolFormCombobox({
    pokemonId: my.pokemonIdx,
    inputClass: 'rc-cb-input',
    pickAttr: 'data-rc-pick',
    pickValue: 'myForm',
    ariaLabel: '내 포켓몬 폼 선택',
  }) : '';
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'rc-cb-field rc-pokemon-field',
    headClass: 'rc-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    primaryActions: uiButton('불러오기', {
      class: 'party-load-button ui-label-action ui-field-action',
      'data-party-import-target': 'revcalc:my',
    }),
    metaActions: p ? `
      ${formControl}
      ${renderToolPokemonTypeStrip({ types: p.types, ariaLabel: '타입' })}
    ` : '',
    inputClass: 'rc-cb-input',
    inputAttrs: { 'data-rc-pick': 'my' },
    value: p ? pkName(p) : '',
    placeholder: '포켓몬 검색...',
  });
  if (!p) {
    renderTrustedHTML(container, `
      <div class="rc-setup-grid tool-settings-layout ui-control-grid">
        <div class="rc-pokemon-main-row ui-control-row">
          ${pokemonPicker}
        </div>
      </div>
      <div class="empty-state ui-empty ui-empty--compact ui-empty--guide">포켓몬 선택 필요</div>
    `);
    rcWireMyComboboxes();
    return;
  }
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
      labelHtml: `<span class="rc-stat-label tool-stat-name-text">${escapeHTML(STAT_KO[s])}</span>`,
      base: p.bs[s],
      point: ev,
      final,
      rank,
      natureHtml: renderToolStatNatureMark(s, my.nature, {
        upClass: 'rc-nature-up',
        downClass: 'rc-nature-down',
        emptyClass: 'rc-nature-spacer',
      }),
      pointOptions: {
        zeroAttrs: { 'data-rc-evset': s, 'data-rc-evval': '0' },
        inputAttrs: { 'data-rc-ev': s, min: '0', max: '32', 'aria-label': `내 ${STAT_KO[s]} 능력 포인트` },
        maxAttrs: { 'data-rc-evset': s, 'data-rc-evval': '32' },
      },
      rankOptions: {
        rankable: s !== 'hp',
        decAttrs: { 'data-rc-rank': s, 'data-rc-dir': '-1' },
        incAttrs: { 'data-rc-rank': s, 'data-rc-dir': '1' },
      },
    };
  }), {
    rowClass: 'rc-stat-row',
    nameClass: 'rc-stat-name',
    baseClass: 'rc-stat-base',
    finalClass: 'rc-stat-final',
  });

  renderTrustedHTML(container, `
    <div class="rc-setup-grid tool-settings-layout ui-control-grid">
      <div class="rc-pokemon-main-row ui-control-row">
        ${pokemonPicker}
      </div>
      <div class="rc-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
        <div class="rc-settings-grid tool-settings-grid ui-control-grid">
          <label class="rc-cb-field rc-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="ability"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">특성</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input rc-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-rc-pick="myability" value="${escapeHTML(rcComboLabel('ability', my.ability))}" placeholder="특성 검색..." autocomplete="off">
              <div class="combobox-options"></div>
            </div>
          </label>
          <label class="rc-cb-field rc-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="nature"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">성격</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input rc-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-rc-pick="mynature" value="${escapeHTML(rcComboLabel('nature', my.nature))}" placeholder="성격 검색..." autocomplete="off">
              <div class="combobox-options"></div>
            </div>
          </label>
          <label class="rc-cb-field rc-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="item"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">도구</span>
            <div class="combobox rc-flex-combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input rc-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-rc-pick="myitem" value="${my.item ? escapeHTML(itName(ItemById[my.item] || { name: my.item })) : '없음'}" autocomplete="off">
              <div class="combobox-options"></div>
            </div>
          </label>
        </div>
      </div>
    </div>
      <label class="rc-start-hp ui-field"><span class="ui-field-label">관측 시작 내 HP</span><input type="number" data-rc-action="myStartHp" min="1" max="${stats.hp}" value="${rcHp(my)}"><small>최대 ${stats.hp} · 아래 랭크도 관측 시작 시점 기준</small></label>
      <div class="rc-my-build-row ui-control-row">
      <div class="tool-stat-panel tool-stat-set tool-stat-set--revcalc tool-stat-has-nature ui-control-frame ui-subframe ui-subframe-stack ui-field">
        <div class="tool-stat-panel-head ui-section-head">
          <div class="tool-stat-panel-title ui-section-title">능력 포인트</div>
          <div class="rc-stat-total tool-stat-total ui-metric-chip ${overEV ? 'over' : ''}">
            총합 <b>${totalEV}</b> / 66 ${overEV ? '<span class="rc-ev-over">초과</span>' : ''}
          </div>
        </div>
        <div class="tool-stat-panel-body">
          <div class="tool-stat-table-frame ui-control-frame">
            <div class="rc-stats-grid rc-stat-grid tool-stat-grid ui-stat-grid ui-stat-table">
              ${renderToolStatHead(['name', 'base', 'point', 'final', 'rank'], {
                rowClass: 'rc-stat-head-row',
              })}
              ${statRows}
            </div>
          </div>
        </div>
      </div>
      <div class="rc-my-moves-panel tool-move-panel tool-move-no-type tool-move-no-power tool-move-no-readout ui-control-frame ui-subframe ui-subframe-stack ui-field">
        <div class="tool-move-panel-head ui-section-head">
          <div class="tool-move-panel-title ui-section-title">기술배치</div>
        </div>
        <div class="tool-move-panel-body">
          <div class="tool-move-list-frame ui-control-frame">
            <div class="rc-move-set-grid compact tool-move-list ui-control-grid">${moveSetRows}</div>
          </div>
        </div>
      </div>
    </div>
  `);
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
      labelHtml: `<span class="rc-stat-label tool-stat-name-text">${escapeHTML(STAT_KO[s])}</span>`,
      natureHtml: '<span class="rc-nature-spacer tool-stat-nature-mark tool-stat-nature-empty" aria-hidden="true"></span>',
      base: p?.bs?.[s] ?? '-',
      rank: r,
      rankOptions: {
        rankable: s !== 'hp',
        emptyTag: 'span',
        decAttrs: { 'data-rc-opprank': s, 'data-rc-dir': '-1' },
        incAttrs: { 'data-rc-opprank': s, 'data-rc-dir': '1' },
      },
    };
  }), {
    columns: ['name', 'base', 'rank'],
    rowClass: 'rc-opp-stat-row',
    nameClass: 'rc-stat-name rc-opp-stat-name',
    baseClass: 'rc-opp-stat-base',
  });

  renderTrustedHTML(container, `
    <div class="rc-setup-grid rc-opp-setup tool-settings-layout ui-control-grid">
      <div class="rc-pokemon-main-row ui-control-row">
        ${pokemonPicker}
      </div>
      ${p ? `
        <div class="rc-settings-field rc-opp-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
          <div class="rc-settings-grid rc-opp-settings-grid tool-settings-grid ui-control-grid">
            <label class="rc-field rc-opp-status-field tool-settings-cell tool-settings-choice-cell tool-settings-condition-cell ui-control-cell ui-field" data-tool-setting="condition"><span class="tool-settings-label tool-settings-choice-label ui-field-label ui-control-label">상태</span>
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
      <label class="rc-start-hp ui-field"><span class="ui-field-label">관측 시작 상대 HP %</span><input type="number" data-rc-action="oppStartHpPct" min="1" max="100" value="${revCalcState.oppStartHpPct ?? 100}"><small>아래 랭크도 관측 시작 시점 기준</small></label>
      <div class="rc-opp-stat-panel tool-stat-panel tool-stat-set tool-stat-set--revcalc-opponent ui-control-frame ui-subframe ui-subframe-stack ui-field">
        <div class="tool-stat-panel-head ui-section-head">
          <div class="tool-stat-panel-title ui-section-title">능력 상태</div>
        </div>
        <div class="tool-stat-panel-body">
          <div class="tool-stat-table-frame ui-control-frame">
            <div class="rc-opp-stat-table rc-stat-grid tool-stat-grid ui-stat-grid ui-stat-table">
              ${renderToolStatHead(['name', 'base', 'rank'], {
                rowClass: 'rc-opp-stat-head',
              })}
              ${statRows}
            </div>
          </div>
        </div>
      </div>
    ` : ''}
  `);
  rcWireOppComboboxes();
}

function rcRenderObservationMoveOptions(role) {
  const move = MoveById[role === 'my' ? revCalcState.myMove : revCalcState.oppMove];
  if (!move) return '';
  const options = revCalcState.observedMoveOptions?.[role] || {};
  const select = (key, label, choices, current) => `<label class="ui-field"><span class="ui-field-label">${label}</span><select data-rc-move-option="${key}" data-rc-role="${role}">${choices.map(([value, text]) => `<option value="${value}" ${String(current ?? '') === String(value) ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
  const controls = [];
  if (move.mh) {
    const min = Array.isArray(move.mh) ? move.mh[0] : move.mh, max = Array.isArray(move.mh) ? move.mh[1] : move.mh;
    controls.push(select('hitCount', '관측 적중 횟수', [['', '미확인'], ...Array.from({ length: max - min + 1 }, (_, i) => [min + i, `${min + i}회`])], options.hitCount));
  }
  if (move.variableBpKind === 'fickleBeam') controls.push(select('fickleBeamMode', '변덕레이저 강화', [['auto','미확인'],['normal','일반'],['boosted','강화 관측']], options.fickleBeamMode || 'auto'));
  if (move.variableBpKind === 'stockpile') controls.push(select('stockpileCount', '비축 횟수', [['','선택'],[1,'1회'],[2,'2회'],[3,'3회']], options.stockpileCount));
  if (move.fixedDamageKind === 'receivedDamage') controls.push('<p class="rc-mini-note">먼저 받은 공격의 마지막 적중 피해로 반격을 계산합니다.</p>');
  return controls.length ? `<div class="rc-toggle-grid ui-control-grid">${controls.join('')}</div>` : '';
}

function renderRevCalcInputs() {
  const container = document.getElementById('rc-input-body');
  if (!container) return;
  const my = revCalcState.my, oppP = PokemonById[revCalcState.opp.pokemonIdx];
  const ready = !!PokemonById[my.pokemonIdx] && !!oppP;
  rcSetStagePanelState('rc-input-panel', ready ? 'ready' : 'locked', ready ? '입력 가능' : '선택 필요');
  if (!ready) {
    renderTrustedHTML(container, '<div class="rc-prerequisite empty-state ui-empty ui-empty--compact ui-empty--guide">내 포켓몬과 상대 포켓몬을 먼저 선택해 주세요.</div>');
    return;
  }
  rcNormalizeObservedMyMove();
  const conditions = (role, title) => `<div class="rc-observation-conditions"><strong>${title}</strong>${rcRenderObservationMoveOptions(role === 'dealt' ? 'my' : 'opp')}<div class="rc-toggle-grid ui-control-grid">${[['defReflect','피격 측 리플렉터'],['defLightScreen','피격 측 빛의장막'],['isCritical','공격 급소']].map(([key,label]) => `<label class="checkbox-label ui-check"><input type="checkbox" data-rc-observed-field="${role}" data-rc-field-key="${key}" ${revCalcState.observedFields[role][key] ? 'checked' : ''}>${label}</label>`).join('')}</div></div>`;
  renderTrustedHTML(container, `
    <p class="rc-mini-note">회복·열매 발동까지 끝난 턴 종료 HP를 입력하세요. 내구는 H32를 우선하고 필요한 B/D를 추가해 추정합니다.</p>
    <div class="rc-input-grid ui-control-grid">
      <div class="rc-input-block rc-action-block ui-control-frame ui-subframe ui-subframe-stack">
        <div class="rc-section-title ui-section-title">내가 한 행동</div>
        <div class="rc-control-row rc-observed-row ui-control-row">
          <label class="ui-field rc-field-wide"><span class="ui-field-label">내가 사용한 기술</span>${rcRenderMoveCombobox('myMove', revCalcState.myMove, {placeholder:'기술배치에서 선택'})}</label>
          <label class="ui-field rc-field-compact"><span class="ui-field-label">상대 남은 HP %</span><input type="number" data-rc-action="observedTheirPct" value="${revCalcState.observedTheirPct}" min="0" max="100" placeholder="0~100"></label>
        </div>
      </div>
      <div class="rc-input-block rc-action-block ui-control-frame ui-subframe ui-subframe-stack">
        <div class="rc-section-title ui-section-title">상대가 한 행동</div>
        <div class="rc-control-row rc-observed-row ui-control-row">
          <label class="ui-field rc-field-wide"><span class="ui-field-label">상대가 사용한 기술</span>${rcRenderMoveCombobox('oppMove', revCalcState.oppMove, {placeholder:'관측한 기술 선택'})}</label>
          <label class="ui-field rc-field-compact"><span class="ui-field-label">내 남은 HP</span><input type="number" data-rc-action="observedMyHp" value="${revCalcState.observedMyHp}" min="0" max="${calcStats(my).hp}" placeholder="실수치 입력"></label>
        </div>
      </div>
      <div class="rc-input-block rc-observed-facts ui-control-frame ui-subframe ui-subframe-stack">
        <div class="rc-section-title ui-section-title">관측한 정보</div>
        <div class="rc-facts-grid ui-control-grid">
          <label class="ui-field"><span class="ui-field-label">이번 턴 행동 순서</span>${rcRenderTurnOrderCombobox(revCalcState.turnOrder)}</label>
          <label class="ui-field"><span class="ui-field-label">관측한 상대 도구</span>${rcRenderOppItemCombobox(revCalcState.oppItemKnown)}</label>
          <label class="ui-field"><span class="ui-field-label">관측한 상대 특성</span><select data-rc-action="oppAbilityKnown"><option value="unknown">미관측</option>${rcPokemonAbilityIds(oppP).map(id => `<option value="${id}" ${revCalcState.oppAbilityKnown === id ? 'selected' : ''}>${escapeHTML(abName(AbilityById[id] || {name:id}))}</option>`).join('')}</select></label>
        </div>
        <p class="rc-mini-note">도구가 미관측이면 피해·속도에 영향을 주는 관련 도구를 자동 검토합니다.</p>
      </div>
      <details class="rc-input-block rc-extra-observation ui-control-frame ui-subframe"><summary>날씨·필드·추가 관측</summary>
        <div class="rc-extra-body ui-subframe-stack">
          <div class="rc-facts-grid ui-control-grid">
            <label class="ui-field"><span class="ui-field-label">날씨</span>${rcRenderFieldCombobox('weather', revCalcState.field.weather)}</label>
            <label class="ui-field"><span class="ui-field-label">필드</span>${rcRenderFieldCombobox('terrain', revCalcState.field.terrain)}</label>
            <label class="checkbox-label ui-check"><input type="checkbox" data-rc-field="trickRoom" ${revCalcState.field.trickRoom ? 'checked' : ''}>트릭룸</label>
            <label class="ui-field"><span class="ui-field-label">내 상태</span><select data-rc-action="myStatus">${rcStatusOptions().map(s => `<option value="${s.id}" ${my.status === s.id ? 'selected' : ''}>${escapeHTML(s.label)}</option>`).join('')}</select></label>
          </div>
          ${conditions('dealt','내 공격의 관측 조건')}${conditions('received','상대 공격의 관측 조건')}
          <div class="rc-known-moves"><strong>추가로 확인한 상대 기술</strong><p class="rc-mini-note">알고 있는 기술만 선택하세요. 이번 턴의 피해 추정에는 위에서 선택한 사용 기술만 쓰고, 추가 기술은 결과 카드에서 비교합니다.</p><div class="rc-facts-grid ui-control-grid">${[0,1,2].map(i => `<label class="ui-field"><span class="ui-field-label">추가 기술 ${i+1}</span>${rcRenderMoveCombobox('knownOppMove', revCalcState.knownOppMoves?.[i] || '', {slot:i,placeholder:'선택 사항'})}</label>`).join('')}</div></div>
        </div>
      </details>
    </div>`);
  rcWireMoveComboboxes(container);
  rcWireOppItemComboboxes(container);
  rcWireTurnOrderComboboxes(container);
  rcWireFieldComboboxes(container);
}

function rcRenderNextStateSummary(summary) {
  const labels = {atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'스피드'};
  const range = (a,b) => a === b ? String(a) : `${a}~${b}`;
  return `<div class="rc-next-state ui-control-frame ui-subframe"><div class="rc-followup-head"><span>다음 턴 시작 상태</span><small>공방·턴 종료 변화 반영</small></div><div class="rc-state-grid">${['my','opp'].map(role => {
    const row = summary[role];
    const ranks = Object.entries(row.ranks).filter(([,v]) => v.some(n => n !== 0)).map(([s,v]) => `${labels[s]} ${v.map(n => n > 0 ? '+'+n : n).join(' / ')}`);
    return `<div class="rc-state-side"><strong>${role === 'my' ? '내 포켓몬' : '상대 포켓몬'}</strong><span>HP ${range(row.hpMin,row.hpMax)} (${range(Number(row.pctMin.toFixed(1)),Number(row.pctMax.toFixed(1)))}%)</span><span>${escapeHTML(ranks.join(' · ') || '랭크 변화 없음')}</span><span>도구: ${escapeHTML(row.items.map(id => id ? itName(ItemById[id] || {name:id}) : row.unknownItem ? '미확인 · 피해 보정 없음' : '없음').join(' / '))}</span>${row.events.length ? `<ul>${[...new Set(row.events)].map(event => `<li>${escapeHTML(event)}</li>`).join('')}</ul>` : ''}</div>`;
  }).join('')}</div></div>`;
}

function renderRevCalcResults() {
  rcInvalidateChangedObservation();
  rcScheduleForecastRefresh();
  const container = document.getElementById('rc-results-body');
  if (!container) return;
  const analyzeButton = document.getElementById('rcAnalyze');
  const participantsReady = !!PokemonById[revCalcState.my.pokemonIdx]
    && !!PokemonById[revCalcState.opp.pokemonIdx];
  const resultState = !participantsReady
    ? ['locked', '대기']
    : revCalcState.analyzing
      ? ['working', '분석 중']
      : revCalcState.results
        ? ['complete', '분석 완료']
        : ['ready', '분석 준비'];
  rcSetStagePanelState('rc-results-panel', resultState[0], resultState[1]);
  if (analyzeButton) {
    analyzeButton.textContent = revCalcState.analyzing ? '분석 취소' : '형태 분석';
    analyzeButton.classList.toggle('is-analyzing', !!revCalcState.analyzing);
    analyzeButton.setAttribute('aria-pressed', revCalcState.analyzing ? 'true' : 'false');
    analyzeButton.disabled = !participantsReady && !revCalcState.analyzing;
    analyzeButton.title = participantsReady ? '' : '내 포켓몬과 상대 포켓몬을 먼저 선택해 주세요.';
  }
  container.setAttribute('aria-busy', revCalcState.analyzing ? 'true' : 'false');
  if (revCalcState.analyzing) {
    renderTrustedHTML(container, `
      <div class="rc-analysis-progress ui-control-frame ui-subframe" role="status" aria-live="polite">
        <span class="rc-analysis-spinner" aria-hidden="true"></span>
        <span class="rc-analysis-copy"><strong>형태 분석 중</strong><span>후보 조합을 계산하고 있습니다.</span></span>
        <span class="rc-analysis-track" aria-hidden="true"><span></span></span>
      </div>
    `);
    return;
  }
  const r = revCalcState.results;
  if (revCalcState.resultsStale && !r) {
    rcSetStagePanelState('rc-results-panel', 'ready', '재분석 필요');
    renderTrustedHTML(container, '<div class="empty-state ui-empty" role="status">입력 조건이 바뀌었습니다. 형태 분석을 다시 실행해 주세요.</div>');
    return;
  }
  if (!r) {
    renderTrustedHTML(container, participantsReady
      ? '<div class="empty-state ui-empty ui-empty--compact ui-empty--guide">피해량과 선후공 정보를 입력하고 형태 분석을 실행하세요.</div>'
      : '<div class="empty-state ui-empty ui-empty--compact ui-empty--guide">참가 포켓몬을 선택하면 형태 분석을 준비합니다.</div>');
    return;
  }
  if (r.error) {
    renderTrustedHTML(container, `<div class="empty-state error ui-empty">분석 오류: ${escapeHTML(r.error)}</div>`);
    return;
  }

  if (!r.results.length) {
    renderTrustedHTML(container, `
      <div class="empty-state ui-empty">HP 우선 배분과 현재 관측을 함께 만족하는 형태가 없습니다. 최종 HP, 행동 순서, 관측 도구와 기술 조건을 확인해 주세요.</div>
    `);
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
  const topItem = first.item ? itName(ItemById[first.item] || { name: first.item }) : rcKnownOpponentItem() === null ? '도구 미확인(피해 보정 없음 가정)' : '도구 없음';
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
      : `<span class="rc-result-item rc-no-item">${rcKnownOpponentItem() === null ? '도구 미확인 · 피해 보정 없음' : '도구 없음'}</span>`;
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
    const expanded = openIndexes.has(i);
    const report = c.cardReport?.key === rcForecastKey() ? c.cardReport : null;
    const followupChips = (expanded ? report?.my || [] : [])
      .map(rcRenderFollowupMoveChip)
      .filter(Boolean)
      .join('');
    const predictedPanel = expanded ? `
      <div class="rc-prediction-panel ui-control-frame ui-subframe">
        <div class="rc-followup-head"><span>상대 관측 기술</span><small>내 최대 HP 대비 피해</small></div>
        <div class="rc-followup-grid">${(report?.opp || []).map(rcRenderFollowupMoveChip).join('') || '<span class="rc-mini-note">관측한 상대 기술을 입력하면 피해 범위를 표시합니다.</span>'}</div>
      </div>
    ` : '';
    const followupPanel = expanded ? `
      <div class="rc-followup-panel ui-control-frame ui-subframe">
        <div class="rc-followup-head"><span>내 기술들</span><small>상대 최대 HP 대비 피해</small></div>
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
          <span>예시 배분 · ${escapeHTML(roleInfo.label)} · ${escapeHTML(roleInfo.parts.join(' / ') || '-')}</span>
          <span>${escapeHTML(speedPlan)} · ${escapeHTML(speedRange)} · 관측 ${escapeHTML(totalRange)} / 완성 66</span>
        </div>
      </div>
    `;
    return `
      <div class="rc-result-row rc-form-result ${expanded ? 'open' : 'collapsed'} ui-control-frame ui-subframe" data-rc-toggle-result="${i}">
        <button type="button" class="rc-result-rank" data-rc-toggle-result="${i}" aria-label="후보 ${i + 1} ${expanded ? '접기' : '펼치기'}" aria-expanded="${expanded}">#${i + 1}</button>
        ${expanded
          ? `<div class="rc-result-expanded-body">${infoPanel}${report ? rcRenderNextStateSummary(report.state) : '<p class="rc-mini-note">다음 턴 정보를 계산하고 있습니다.</p>'}${followupPanel}${predictedPanel}</div>`
          : infoPanel}
      </div>
    `;
  }).join('');

  renderTrustedHTML(container, `
    ${r.hpTolerance ? '<p class="rc-hp-approx ui-control-frame ui-subframe" role="status">HP 근사 일치 · 입력한 상대 HP의 ±1%p 범위에서 찾은 후보입니다. 아래 결과도 이 범위를 포함합니다.</p>' : ''}
    ${rcRenderExchangeSummary(r)}
    <div class="rc-briefing ui-control-frame ui-subframe">
      <div class="rc-briefing-title">요약</div>
      <div>${escapeHTML(briefing)}</div><p class="rc-mini-note">H32 → B/D 추가 우선 · ${r.total}개 후보 / ${r.groupTotal}개 그룹 중 대표 ${r.results.length}개 · 미관측 도구는 없음으로 확정하지 않습니다.</p>
    </div>
    <div class="rc-results-list">${rows}</div>
  `);
  rcWireMoveComboboxes(container);
}

function renderRevCalcAll() {
  renderRevCalcMy();
  renderRevCalcOpp();
  renderRevCalcInputs();
  renderRevCalcResults();
}

// === 콤보박스 / 이벤트 ===
