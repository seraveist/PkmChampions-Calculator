/* Reverse calculator rendering. */
function renderRevCalcMy() {
  const container = document.getElementById('rc-my-body');
  if (!container) return;
  const my = revCalcState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) { container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>'; return; }
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
  const statRows = ['hp', ...RANK_STATS].map(s => {
    const ev = my.evs[s] || 0;
    const final = stats[s];
    const nature = NATURE_BY_ID?.[my.nature];
    const isUp = nature?.up === s, isDown = nature?.down === s;
    const natureMark = isUp ? '<span class="ft-nature-up">▲</span>' : isDown ? '<span class="ft-nature-down">▼</span>' : '<span class="ft-nature-spacer"></span>';
    const rank = my.ranks?.[s] || 0;
    const rankCtrl = s === 'hp' ? '<div class="ft-rank-empty"></div>' : `
      <div class="ft-rank">
        <button class="ft-rank-btn" data-rc-rank="${s}" data-rc-dir="-1">−</button>
        <span class="ft-rank-val ${rank > 0 ? 'pos' : rank < 0 ? 'neg' : ''}">${rank > 0 ? '+' + rank : rank}</span>
        <button class="ft-rank-btn" data-rc-rank="${s}" data-rc-dir="1">+</button>
      </div>
    `;
    return `
      <div class="ft-stat-row">
        <div class="ft-stat-name"><span class="ft-stat-label">${STAT_KO[s]}</span>${natureMark}</div>
        <div class="ft-stat-base">${p.bs[s]}</div>
        <div class="ft-stat-ev">
          <button class="ft-ev-quick" data-rc-evset="${s}" data-rc-evval="0">0</button>
          <input type="number" class="ft-ev-input" data-rc-ev="${s}" value="${ev}" min="0" max="32">
          <button class="ft-ev-quick" data-rc-evset="${s}" data-rc-evval="32">32</button>
        </div>
        <div class="ft-stat-final">${final}</div>
        ${rankCtrl}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rc-setup-grid">
      <div class="rc-pokemon-main-row">
        <div class="field rc-cb-field rc-pokemon-field">
          <div class="ui-field-head rc-pokemon-head">
            <span class="field-label">포켓몬</span>
            <div class="party-load-head-actions">
              <button type="button" class="party-load-button ui-label-action" data-party-import-target="revcalc:my">불러오기</button>
              <div class="types-display rc-types-display rc-type-strip">
                ${p.types.map(t => `<span class="type-pill rc-type-pill t-${t}">${TYPE_KO[t] || t}</span>`).join('')}
              </div>
            </div>
          </div>
          <div class="combobox pokemon-select rc-flex-combobox">
            <input type="text" class="cb-input rc-cb-input" data-rc-pick="my" value="${escapeHTML(pkName(p))}" autocomplete="off">
            <div class="combobox-options"></div>
          </div>
        </div>
      </div>
      <label class="field rc-cb-field rc-field rc-ability-field"><span class="field-label">특성</span>
        <div class="combobox">
          <input type="text" class="cb-input rc-cb-input" data-rc-pick="myability" value="${escapeHTML(rcComboLabel('ability', my.ability))}" placeholder="특성 검색..." autocomplete="off">
          <div class="combobox-options"></div>
        </div>
      </label>
      <label class="field rc-cb-field rc-field rc-nature-field"><span class="field-label">성격</span>
        <div class="combobox pokemon-select">
          <input type="text" class="cb-input rc-cb-input" data-rc-pick="mynature" value="${escapeHTML(rcComboLabel('nature', my.nature))}" placeholder="성격 검색..." autocomplete="off">
          <div class="combobox-options"></div>
        </div>
      </label>
      <label class="field rc-cb-field rc-field rc-item-field"><span class="field-label">도구</span>
        <div class="combobox rc-flex-combobox">
          <input type="text" class="cb-input rc-cb-input" data-rc-pick="myitem" value="${my.item ? escapeHTML(itName(ItemById[my.item] || { name: my.item })) : '없음'}" autocomplete="off">
          <div class="combobox-options"></div>
        </div>
      </label>
    </div>
    <div class="rc-my-build-row">
      <div class="rc-my-stats-block">
        <div class="rc-table-headline">
          <div class="ft-table-title">능력 포인트</div>
          <div class="ft-ev-total ${overEV ? 'over' : ''}">
            총합 <b>${totalEV}</b> / 66 ${overEV ? '<span class="rc-ev-over">초과</span>' : ''}
          </div>
        </div>
        <div class="rc-table-section">
          <div class="ft-stats-grid rc-stats-grid">
            <div class="ft-stats-head"><div>능력</div><div>종족값</div><div>포인트</div><div>실수치</div><div>랭크</div></div>
            ${statRows}
          </div>
        </div>
      </div>
      <div class="rc-my-moves-panel">
        <div class="ft-section-title">기술배치</div>
        <div class="rc-move-set-grid compact">${moveSetRows}</div>
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

  const statRows = ['hp','atk','def','spa','spd','spe'].map(s => {
    const r = opp.ranks?.[s] || 0;
    return `
      <div class="rc-opp-stat-row">
        <div class="rc-opp-stat-name">${STAT_KO[s]}</div>
        <div class="rc-opp-stat-base">${p?.bs?.[s] ?? '-'}</div>
        <div class="rc-opp-rank-cell">
          ${s === 'hp' ? '<span class="rc-opp-rank-empty"></span>' : `
            <div class="ft-rank">
              <button class="ft-rank-btn" data-rc-opprank="${s}" data-rc-dir="-1">−</button>
              <span class="ft-rank-val ${r > 0 ? 'pos' : r < 0 ? 'neg' : ''}">${r > 0 ? '+' + r : r}</span>
              <button class="ft-rank-btn" data-rc-opprank="${s}" data-rc-dir="1">+</button>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rc-setup-grid rc-opp-setup">
      <div class="rc-pokemon-main-row">
        <div class="field rc-cb-field rc-pokemon-field">
          <div class="ui-field-head rc-pokemon-head">
            <span class="field-label">포켓몬</span>
            ${p ? `<div class="types-display rc-types-display rc-type-strip">
              ${p.types.map(t => `<span class="type-pill rc-type-pill t-${t}">${TYPE_KO[t] || t}</span>`).join('')}
            </div>` : '<div class="types-display rc-types-display rc-type-strip empty" aria-hidden="true"></div>'}
          </div>
          <div class="combobox pokemon-select rc-flex-combobox">
            <input type="text" class="cb-input rc-cb-input" data-rc-pick="opp" value="${p ? escapeHTML(pkName(p)) : ''}" autocomplete="off">
            <div class="combobox-options"></div>
          </div>
        </div>
      </div>
      ${p ? `
        <label class="field rc-field rc-opp-status-field"><span class="field-label">상태</span>
          <div class="combobox rc-status-combobox">
            <button type="button" class="cb-input cb-trigger" data-rc-status="opp" aria-label="상대 상태 선택" aria-expanded="false">${escapeHTML(rcStatusDisplayLabel(opp.status))}</button>
            <div class="combobox-options" role="listbox"></div>
          </div>
        </label>
      ` : ''}
    </div>
    ${p ? `
      <div class="ft-section-title rc-opp-stat-title">능력 상태</div>
      <div class="rc-opp-stat-table">
        <div class="rc-opp-stat-head">
          <span>능력</span>
          <span>종족값</span>
          <span>랭크</span>
        </div>
        ${statRows}
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
    <div class="rc-input-grid">
      <div class="rc-input-block rc-action-block">
        <div class="ft-section-title">내 행동</div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-observed-row">
          <label class="field rc-field-wide">
            <span class="field-label">사용 기술</span>
            ${rcRenderMoveCombobox('myMove', revCalcState.myMove, { placeholder: '사용 기술 선택' })}
          </label>
          <label class="field rc-field-compact">
            <span class="field-label">상대 남은 HP %</span>
            <input type="number" data-rc-action="observedTheirPct" value="${revCalcState.observedTheirPct}" min="0" max="100" placeholder="0~100">
          </label>
        </div>
        <div class="rc-input-divider"></div>
        <div class="rc-side-condition-row">
          <label class="checkbox-label rc-compact-toggle"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="defReflect" ${revCalcState.observedFields.dealt.defReflect ? 'checked' : ''}> 상대 리플렉터</label>
          <label class="checkbox-label rc-compact-toggle"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="defLightScreen" ${revCalcState.observedFields.dealt.defLightScreen ? 'checked' : ''}> 상대 빛의장막</label>
          <label class="checkbox-label rc-compact-toggle"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="isCritical" ${revCalcState.observedFields.dealt.isCritical ? 'checked' : ''}> 내 공격 급소</label>
        </div>
      </div>

      <div class="rc-input-block rc-action-block">
        <div class="ft-section-title">상대 행동</div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-observed-row">
          <label class="field rc-field-wide">
            <span class="field-label">사용 기술</span>
            ${rcRenderMoveCombobox('oppMove', revCalcState.oppMove, { placeholder: '상대 기술 선택' })}
          </label>
          <label class="field rc-field-compact">
            <span class="field-label">내 남은 HP</span>
            <input type="number" data-rc-action="observedMyHp" value="${revCalcState.observedMyHp}" min="0" max="${myCurrentHp}" placeholder="0~${myCurrentHp}">
          </label>
        </div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-observed-row rc-opp-item-row">
          <label class="field rc-field-wide">
            <span class="field-label">상대 도구</span>
            ${rcRenderOppItemCombobox(revCalcState.oppItemKnown)}
          </label>
        </div>
        <div class="rc-input-divider"></div>
        <div class="rc-side-condition-row">
          <label class="checkbox-label rc-compact-toggle"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="defReflect" ${revCalcState.observedFields.received.defReflect ? 'checked' : ''}> 내 리플렉터</label>
          <label class="checkbox-label rc-compact-toggle"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="defLightScreen" ${revCalcState.observedFields.received.defLightScreen ? 'checked' : ''}> 내 빛의장막</label>
          <label class="checkbox-label rc-compact-toggle"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="isCritical" ${revCalcState.observedFields.received.isCritical ? 'checked' : ''}> 상대 공격 급소</label>
        </div>
      </div>

      <div class="rc-input-block rc-speed-block">
        <div class="ft-section-title">선후공 | 필드 상태</div>
        <div class="rc-input-divider"></div>
        <div class="ft-controls-row rc-speed-field-row">
          <label class="field rc-field-compact">
            <span class="field-label">이번 턴 행동 순서</span>
            ${rcRenderTurnOrderCombobox(revCalcState.turnOrder)}
          </label>
          <label class="field"><span class="field-label">날씨</span>
            ${rcRenderFieldCombobox('weather', revCalcState.field.weather)}
          </label>
          <label class="field"><span class="field-label">필드</span>
            ${rcRenderFieldCombobox('terrain', revCalcState.field.terrain)}
          </label>
        </div>
      </div>

      <div class="rc-input-block rc-item-candidates-block ${itemPanelOpen ? 'open' : 'collapsed'}">
        <button type="button" class="ft-section-title rc-title-with-badge rc-collapse-head" data-rc-toggle-item-candidates aria-expanded="${itemPanelOpen ? 'true' : 'false'}">
          <span>도구 후보</span>
          <span class="rc-count-badge rc-item-candidate-count">${knownOppItem === null ? `${itemCandidates.length}개` : '고정됨'}</span>
        </button>
        <div class="rc-input-divider rc-collapse-divider"></div>
        <div class="rc-item-candidates-body" ${itemPanelOpen ? '' : 'hidden'}>
          <div class="rc-item-grid">${itemBoxes}</div>
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
    container.innerHTML = '<div class="empty-state">형태 분석 중...</div>';
    return;
  }
  const r = revCalcState.results;
  if (!r) {
    container.innerHTML = '<div class="empty-state">피해량과 선후공 정보를 입력하고 형태 분석을 실행하세요.</div>';
    return;
  }
  if (r.error) {
    container.innerHTML = `<div class="empty-state error">분석 오류: ${escapeHTML(r.error)}</div>`;
    return;
  }

  if (!r.results.length) {
    container.innerHTML = `
      <div class="empty-state">66포인트 룰과 관측값을 동시에 만족하는 형태가 없습니다.</div>
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
      <div class="rc-prediction-panel">
        <label class="field">
          <span class="field-label">상대 다음 기술</span>
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
      <div class="rc-followup-panel">
        <div class="rc-followup-head"><span>내 기술들</span><small>현재 상대 HP 기준</small></div>
        <div class="rc-followup-grid">
          ${followupChips || '<span class="rc-mini-note">내 기술폭 4개를 입력하면 후보별 다음 대미지를 표시합니다.</span>'}
        </div>
      </div>
    ` : '';
    const infoPanel = `
      <div class="rc-result-profile rc-result-info-panel">
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
      <div class="rc-result-row rc-form-result ${expanded ? 'open' : 'collapsed'}" data-rc-toggle-result="${i}">
        <div class="rc-result-rank">#${i + 1}</div>
        ${expanded
          ? `<div class="rc-result-expanded-body">${infoPanel}${followupPanel}${predictedPanel}</div>`
          : infoPanel}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rc-briefing">
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
