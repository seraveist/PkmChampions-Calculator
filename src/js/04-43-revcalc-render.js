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

  const abOptions = Object.values(p.ab || {}).map(abN => {
    const id = toId(abN);
    return `<option value="${id}" ${my.ability === id ? 'selected' : ''}>${escapeHTML(abName(AbilityById[id] || { name: abN }))}</option>`;
  }).join('');

  const STAT_KO = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };
  const RANK_STATS = ['atk','def','spa','spd','spe'];
  const statRows = ['hp', ...RANK_STATS].map(s => {
    const ev = my.evs[s] || 0;
    const final = stats[s];
    const nature = NATURE_BY_ID?.[my.nature];
    const isUp = nature?.up === s, isDown = nature?.down === s;
    const natureMark = isUp ? '<span style="color:#ff6b85;">▲</span>' : isDown ? '<span style="color:#7e9eff;">▼</span>' : '';
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
        <div class="ft-stat-name">${STAT_KO[s]} ${natureMark}</div>
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
    <div class="ft-poke-row">
      <div class="ft-pickname">
        <span class="ft-section-title">포켓몬</span>
        <div class="combobox" style="flex:1;">
          <input type="text" class="cb-input rc-cb-input" data-rc-pick="my" value="${escapeHTML(pkName(p))}">
          <div class="combobox-options"></div>
        </div>
        <div class="types-display" style="margin-left:8px;">
          ${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join('')}
        </div>
      </div>
    </div>
    <div class="ft-controls-row">
      <label class="field"><span class="field-label">성격</span>
        <select data-rc-action="myNature">
          ${(typeof NATURES !== 'undefined' ? NATURES : []).map(n => `<option value="${n.id}" ${my.nature === n.id ? 'selected' : ''}>${n.ko}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span class="field-label">특성</span>
        <select data-rc-action="myAbility">${abOptions}</select>
      </label>
      <label class="field"><span class="field-label">도구</span>
        <div class="combobox">
          <input type="text" class="cb-input rc-cb-input" data-rc-pick="myitem" value="${my.item ? escapeHTML(itName(ItemById[my.item] || { name: my.item })) : '없음'}">
          <div class="combobox-options"></div>
        </div>
      </label>
    </div>
    <div class="rc-my-build-row">
      <div class="ft-stats-grid" style="grid-template-columns: 64px 56px 168px 60px 96px;">
        <div class="ft-stats-head"><div>스탯</div><div>종족값</div><div>노력치</div><div>실수치</div><div>랭크</div></div>
        ${statRows}
      </div>
      <div class="rc-my-moves-panel">
        <div class="ft-section-title">기술배치</div>
        <div class="rc-move-set-grid compact">${moveSetRows}</div>
      </div>
    </div>
    <div class="ft-ev-total ${overEV ? 'over' : ''}">
      노력치 합계: <b>${totalEV}</b> / 66 ${overEV ? '<span style="color:var(--atk);"> 초과!</span>' : ''}
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
  const STAT_KO = { atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };

  const rankRows = ['atk','def','spa','spd','spe'].map(s => {
    const r = opp.ranks?.[s] || 0;
    return `
      <div class="rc-opp-rank">
        <span>${STAT_KO[s]}</span>
        <div class="ft-rank">
          <button class="ft-rank-btn" data-rc-opprank="${s}" data-rc-dir="-1">−</button>
          <span class="ft-rank-val ${r > 0 ? 'pos' : r < 0 ? 'neg' : ''}">${r > 0 ? '+' + r : r}</span>
          <button class="ft-rank-btn" data-rc-opprank="${s}" data-rc-dir="1">+</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="ft-poke-row">
      <div class="ft-pickname">
        <span class="ft-section-title">포켓몬</span>
        <div class="combobox" style="flex:1;">
          <input type="text" class="cb-input rc-cb-input" data-rc-pick="opp" value="${p ? escapeHTML(pkName(p)) : ''}">
          <div class="combobox-options"></div>
        </div>
        ${p ? `<div class="types-display" style="margin-left:8px;">
          ${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join('')}
        </div>` : ''}
      </div>
    </div>
    ${p ? `
      <div class="ft-section-title">종족값</div>
      <div class="rc-base-stats">
        ${['hp','atk','def','spa','spd','spe'].map(s => `<span class="rc-base"><small>${({hp:'HP',atk:'공',def:'방',spa:'특공',spd:'특방',spe:'속'})[s]}</small><b>${p.bs[s]}</b></span>`).join('')}
      </div>
      <div class="ft-section-title">상대 측 랭크 (위협 받음, 자가 부스트 등)</div>
      <div class="rc-opp-ranks">${rankRows}</div>
      <div class="ft-controls-row" style="margin-top: 8px;">
        <label class="field"><span class="field-label">상대 상태이상</span>
          <select data-rc-action="oppStatus">
            <option value="none" ${opp.status === 'none' ? 'selected' : ''}>없음</option>
            <option value="Burn" ${opp.status === 'Burn' ? 'selected' : ''}>화상</option>
            <option value="Paralysis" ${opp.status === 'Paralysis' ? 'selected' : ''}>마비</option>
            <option value="Poison" ${opp.status === 'Poison' ? 'selected' : ''}>독</option>
            <option value="Toxic" ${opp.status === 'Toxic' ? 'selected' : ''}>맹독</option>
            <option value="Sleep" ${opp.status === 'Sleep' ? 'selected' : ''}>수면</option>
            <option value="Freeze" ${opp.status === 'Freeze' ? 'selected' : ''}>동결</option>
          </select>
        </label>
      </div>
    ` : ''}
  `;
  rcWireOppComboboxes();
}

function renderRevCalcInputs() {
  const container = document.getElementById('rc-input-body');
  if (!container) return;
  const my = revCalcState.my;
  const myP = PokemonById[my.pokemonIdx];
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];

  // 내 관측 기술은 입력한 기술폭 4개 안에서 선택하고, 상대 기술은 변화기 관측까지 허용한다.
  rcNormalizeObservedMyMove();
  const observedMyMoves = rcObservedMyMoveIds();

  const myMoveData = revCalcState.myMove ? MoveById[revCalcState.myMove] : null;
  const oppMoveData = revCalcState.oppMove ? MoveById[revCalcState.oppMove] : null;

  const myStats = calcStats(my);
  const myCurrentHp = rcCurrentHpValue(my);
  const autoMySpeed = rcSpeedWithMods(myStats.spe, my.ranks?.spe || 0, my.item || '', my.status || 'none');
  const myMoveOptions = selected => `
    <option value="">선택…</option>
    ${observedMyMoves.map(id => {
      const m = MoveById[id];
      return `<option value="${m.id}" ${selected === m.id ? 'selected' : ''}>${escapeHTML(mvName(m))}</option>`;
    }).join('')}
  `;

  // 도구 후보 체크박스 (type-boost 도구 + 그외 사용 가능 도구)
  const itemMaster = ITEMS.filter(i => !i.ms && !i.isBerry);
  const knownOppItem = rcKnownOpponentItem();
  const itemCandidates = knownOppItem === null ? rcActiveItemCandidates() : [];
  const oppItemOptions = `
    <option value="unknown" ${revCalcState.oppItemKnown === 'unknown' ? 'selected' : ''}>미관측</option>
    <option value="" ${revCalcState.oppItemKnown === '' ? 'selected' : ''}>없음 확인</option>
    ${itemMaster.map(i => `<option value="${i.id}" ${revCalcState.oppItemKnown === i.id ? 'selected' : ''}>${escapeHTML(itName(i))}</option>`).join('')}
  `;
  const itemBoxes = itemMaster.map(i => `
    <label class="rc-item-chk ${knownOppItem !== null ? 'disabled' : ''}">
      <input type="checkbox" data-rc-item="${i.id}" ${knownOppItem === null && itemCandidates.includes(i.id) ? 'checked' : ''} ${knownOppItem !== null ? 'disabled' : ''}>
      ${escapeHTML(itName(i))}
    </label>
  `).join('');

  container.innerHTML = `
    <div class="rc-input-grid">
      <div class="rc-input-block">
        <div class="ft-section-title">관측 기술 (상대에게 줌)</div>
        <div class="ft-controls-row">
          <label class="field" style="flex:2;">
            <span class="field-label">기술</span>
            <select data-rc-action="myMove">
              ${myMoveOptions(revCalcState.myMove)}
            </select>
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">상대 남은 HP %</span>
            <input type="number" data-rc-action="observedTheirPct" value="${revCalcState.observedTheirPct}" min="0" max="100" placeholder="0~100">
          </label>
        </div>
        <div class="rc-side-condition-row">
          <label class="checkbox-label"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="defReflect" ${revCalcState.observedFields.dealt.defReflect ? 'checked' : ''}> 상대 리플렉터</label>
          <label class="checkbox-label"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="defLightScreen" ${revCalcState.observedFields.dealt.defLightScreen ? 'checked' : ''}> 상대 빛의장막</label>
          <label class="checkbox-label"><input type="checkbox" data-rc-observed-field="dealt" data-rc-field-key="isCritical" ${revCalcState.observedFields.dealt.isCritical ? 'checked' : ''}> 내 공격 급소</label>
        </div>
      </div>

      <div class="rc-input-block">
        <div class="ft-section-title">상대 기술 (내가 받음)</div>
        <div class="ft-controls-row">
          <label class="field" style="flex:1;">
            <span class="field-label">상대 도구</span>
            <select data-rc-action="oppItemKnown">${oppItemOptions}</select>
          </label>
          <label class="field" style="flex:2;">
            <span class="field-label">기술</span>
            ${rcRenderMoveCombobox('oppMove', revCalcState.oppMove, { placeholder: '상대 기술 선택' })}
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">내 남은 HP</span>
            <input type="number" data-rc-action="observedMyHp" value="${revCalcState.observedMyHp}" min="0" max="${myCurrentHp}" placeholder="0~${myCurrentHp}">
          </label>
        </div>
        <div class="rc-side-condition-row">
          <label class="checkbox-label"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="defReflect" ${revCalcState.observedFields.received.defReflect ? 'checked' : ''}> 내 리플렉터</label>
          <label class="checkbox-label"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="defLightScreen" ${revCalcState.observedFields.received.defLightScreen ? 'checked' : ''}> 내 빛의장막</label>
          <label class="checkbox-label"><input type="checkbox" data-rc-observed-field="received" data-rc-field-key="isCritical" ${revCalcState.observedFields.received.isCritical ? 'checked' : ''}> 상대 공격 급소</label>
        </div>
      </div>

      <div class="rc-input-block rc-speed-block">
        <div class="ft-section-title">선후공 / 속도 조건</div>
        <div class="ft-controls-row">
          <label class="field" style="flex:1;">
            <span class="field-label">이번 턴 행동 순서</span>
            <select data-rc-action="turnOrder">
              <option value="unknown" ${revCalcState.turnOrder === 'unknown' ? 'selected' : ''}>사용 안 함</option>
              <option value="opp-first" ${revCalcState.turnOrder === 'opp-first' ? 'selected' : ''}>상대가 먼저 행동</option>
              <option value="my-first" ${revCalcState.turnOrder === 'my-first' ? 'selected' : ''}>내가 먼저 행동</option>
              <option value="speed-tie" ${revCalcState.turnOrder === 'speed-tie' ? 'selected' : ''}>동속 확인</option>
            </select>
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">내 속도 실수치</span>
            <input type="number" data-rc-action="mySpeedOverride" value="${revCalcState.mySpeedOverride}" min="1" max="999" placeholder="${autoMySpeed}">
          </label>
          <div class="rc-speed-readout">
            <span>자동 기준</span>
            <b>${autoMySpeed}</b>
          </div>
        </div>
        <div class="rc-hint">상대 체력은 전투 UI의 남은 HP%를, 내 체력은 전투 UI에 보이는 남은 HP 실수치를 입력합니다. 속도 조건을 켜면 상대 S 투자와 구애스카프 후보가 같은 66포인트 예산 안에서 함께 검증됩니다.</div>
      </div>

      <div class="rc-input-block">
        <div class="ft-section-title">필드 상태</div>
        <div class="ft-controls-row">
          <label class="field"><span class="field-label">날씨</span>
            <select data-rc-field="weather">
              <option value="none">없음</option><option value="Sun" ${revCalcState.field.weather === 'Sun' ? 'selected' : ''}>쾌청</option>
              <option value="Rain" ${revCalcState.field.weather === 'Rain' ? 'selected' : ''}>비</option>
              <option value="Sand" ${revCalcState.field.weather === 'Sand' ? 'selected' : ''}>모래</option>
              <option value="Snow" ${revCalcState.field.weather === 'Snow' ? 'selected' : ''}>눈</option>
            </select>
          </label>
          <label class="field"><span class="field-label">필드</span>
            <select data-rc-field="terrain">
              <option value="none">없음</option><option value="Electric" ${revCalcState.field.terrain === 'Electric' ? 'selected' : ''}>일렉트릭</option>
              <option value="Grassy" ${revCalcState.field.terrain === 'Grassy' ? 'selected' : ''}>그래스</option>
              <option value="Psychic" ${revCalcState.field.terrain === 'Psychic' ? 'selected' : ''}>사이코</option>
              <option value="Misty" ${revCalcState.field.terrain === 'Misty' ? 'selected' : ''}>미스트</option>
            </select>
          </label>
        </div>
      </div>

      <div class="rc-input-block">
        <div class="ft-section-title">도구 후보 (상대 도구 미관측 시만 사용) — ${knownOppItem === null ? `${itemCandidates.length}개 선택됨` : '상대 도구 선택됨'}</div>
        <div class="rc-item-grid">${itemBoxes}</div>
      </div>
    </div>
  `;
  rcWireMoveComboboxes(container);
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
    container.innerHTML = `<div class="empty-state" style="color:var(--atk);">⚠ ${escapeHTML(r.error)}</div>`;
    return;
  }

  if (!r.results.length) {
    const d = r.debug || {};
    const debugBits = [
      `내 ${escapeHTML(d.myPokemon || '-')}`,
      `상대 ${escapeHTML(d.oppPokemon || '-')}`,
      `내 성격 ${escapeHTML(d.myNature || '-')}`,
      `내 EV H${d.myEvs?.hp ?? '-'} C${d.myEvs?.spa ?? '-'} S${d.myEvs?.spe ?? '-'}`,
      `내 실수치 C${d.myStats?.spa ?? '-'} S${d.myStats?.spe ?? '-'}`,
      `기술 ${escapeHTML(d.myMove || '-')} / ${escapeHTML(d.oppMove || '-')}`,
      `필드 ${escapeHTML(d.field || 'none')}`,
      `내 공격조건 ${escapeHTML(d.dealtField || 'none')}`,
      `상대 공격조건 ${escapeHTML(d.receivedField || 'none')}`,
      `도구후보 ${d.itemCount ?? '-'}개${d.hasNoItem ? '+없음' : ''}`,
      `내구후보 ${d.stage1 ?? '-'}`,
      `정제대상 ${d.stage1Trimmed ?? '-'}`,
      `화력후보 ${d.refined ?? '-'}`,
      `속도제거 ${d.speedRemoved ?? '-'}`,
      `예산제거 ${d.budgetRemoved ?? '-'}`,
      `후보 생성 ${r.rawTotal || 0}개`,
      `최종 생존 ${r.total || 0}개`,
      `규칙 제거 ${r.filteredByRule || 0}개`,
      `내 HP 기준 ${r.myCurrentHp || '-'}`,
      `내 속도 기준 ${r.mySpeed || '-'}`,
      `상대 남은 HP ${escapeHTML(revCalcState.observedTheirPct || '-')}%`,
      `내 남은 HP ${escapeHTML(revCalcState.observedMyHp || '-')}`,
    ];
    container.innerHTML = `
      <div class="empty-state">66포인트 룰과 관측값을 동시에 만족하는 형태가 없습니다.</div>
      <div class="rc-results-summary">${debugBits.join(' · ')}</div>
      <div class="rc-hint">상대 쪽 입력은 남은 HP%, 내 쪽 입력은 남은 HP 실수치 기준입니다. 기술 위력/필드/랭크/도구 후보/선후공 조건도 함께 확인해 주세요.</div>
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
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
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
        <div class="rc-result-panel-label">상대 다음 예상 기술</div>
        <label class="field">
          <span class="field-label">기술</span>
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
        <div class="rc-followup-head"><span>내 다음 기술 대미지</span><small>현재 상대 HP 기준</small></div>
        <div class="rc-followup-grid">
          ${followupChips || '<span class="rc-mini-note">내 기술폭 4개를 입력하면 후보별 다음 대미지를 표시합니다.</span>'}
        </div>
      </div>
    ` : '';
    const infoPanel = `
      <div class="rc-result-profile rc-result-info-panel">
        ${expanded ? '<div class="rc-result-panel-label">상대 예상 정보</div>' : ''}
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
          ? `<div class="rc-result-expanded-body">${infoPanel}${predictedPanel}${followupPanel}</div>`
          : infoPanel}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rc-briefing">
      <div class="rc-briefing-title">인텔리전스 브리핑</div>
      <div>${escapeHTML(briefing)}</div>
    </div>
    ${rcRenderNextRankPanel()}
    <div class="rc-results-list">${rows}</div>
    <div class="rc-hint">상대는 남은 HP%의 정수 내림값, 내 포켓몬은 남은 HP 실수치를 기준으로 16단계 난수 중 일치한 횟수를 표시합니다.</div>
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

