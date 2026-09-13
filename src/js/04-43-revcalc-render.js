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
  const my = revCalcState.my, p = PokemonById[my.pokemonIdx];
  const picker = renderToolPokemonSelectSubframe({pokemonId:my.pokemonIdx,value:p ? pkName(p) : '',inputClass:'rc-cb-input',inputAttrs:{'data-rc-pick':'my','aria-label':'내 포켓몬'},primaryActions:'<button type="button" class="ui-label-action" data-party-import-target="revcalc:my">불러오기</button>',metaActions:renderToolFormCombobox({pokemonId:my.pokemonIdx,inputClass:'rc-cb-input',pickAttr:'data-rc-pick',pickValue:'myForm'})});
  const total = Object.values(my.evs).reduce((a,b)=>a+b,0);
  renderTrustedHTML(container,`${picker}${p ? `
    <div class="attributes">${['ability','item','nature'].map(key=>RotomUI.picker({ability:'특성',item:'도구',nature:'성격'}[key],rcComboLabel(key,my[key]),{class:'rc-cb-input','data-rc-pick':'my'+key})).join('')}</div>
    <div class="section-heading stat-heading"><h3>관측 시작 능력치</h3><span class="budget">노력치 <strong>${total}</strong> / 66</span></div>
    ${uiStatTable(my,{evAttr:'data-rc-ev',rankAttr:'data-rc-rank-select'})}
    <div class="rc-start-row">${RotomUI.field(`시작 HP / ${calcStats(my).hp}`,RotomUI.number({'data-rc-action':'myStartHp',min:1,max:calcStats(my).hp,value:rcHp(my)}))}${RotomUI.field('상태',RotomUI.select(rcStatusOptions().map(s=>[s.id,s.label]),my.status,{'data-rc-action':'myStatus'}))}</div>
    <section class="rc-moves-section"><div class="section-heading"><h3>내 기술배치</h3></div><div class="rc-move-set-grid">${rcMoveSet().map((id,slot)=>rcRenderMoveCombobox('moveslot',id,{slot})).join('')}</div></section>` : '<div class="empty-state">포켓몬을 선택하세요.</div>'}`);
  rcWireMyComboboxes();
  rcWireMoveComboboxes(container);
}

function renderRevCalcOpp() {
  const container = document.getElementById('rc-opp-body');
  if (!container) return;
  const opp = revCalcState.opp, p = PokemonById[opp.pokemonIdx];
  const picker = renderToolPokemonSelectSubframe({pokemonId:opp.pokemonIdx,value:p ? pkName(p) : '',inputClass:'rc-cb-input',inputAttrs:{'data-rc-pick':'opp','aria-label':'상대 포켓몬'},metaActions:renderToolFormCombobox({pokemonId:opp.pokemonIdx,inputClass:'rc-cb-input',pickAttr:'data-rc-pick',pickValue:'oppForm'})});
  const keys=['hp','atk','def','spa','spd','spe'],names=['HP','공격','방어','특공','특방','속도'];
  renderTrustedHTML(container,`${picker}${p ? `<div class="rc-start-row">${RotomUI.field('시작 HP %',RotomUI.number({'data-rc-action':'oppStartHpPct',min:1,max:100,value:revCalcState.oppStartHpPct ?? 100}))}${RotomUI.field('상태',RotomUI.select(rcStatusOptions().map(s=>[s.id,s.label]),opp.status,{'data-rc-action':'oppStatus'}))}</div>
    <div class="section-heading stat-heading"><h3>관측 시작 랭크</h3></div>
    <table class="stat-table" aria-label="상대 관측 시작 능력치"><colgroup><col>${keys.map(()=>'<col>').join('')}</colgroup><thead><tr><th scope="col"><span class="sr-only">구분</span></th>${names.map(name=>`<th scope="col">${name}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">종족값</th>${keys.map(key=>`<td class="stat-base">${p.bs[key]}</td>`).join('')}</tr><tr><th scope="row">랭크</th>${keys.map((key,i)=>`<td>${key==='hp' ? '—' : RotomUI.select(Array.from({length:13},(_,j)=>[j-6,j>6 ? `+${j-6}` : j-6]),opp.ranks?.[key] || 0,{'data-rc-opp-rank-select':key,'aria-label':`상대 ${names[i]} 랭크`},'ui-select--rank')}</td>`).join('')}</tr></tbody></table>` : '<div class="empty-state">포켓몬을 선택하세요.</div>'}`);
  rcWireOppComboboxes();
}

function rcRenderObservationMoveOptions(role) {
  const move = MoveById[role === 'my' ? revCalcState.myMove : revCalcState.oppMove];
  if (!move) return '';
  const options = revCalcState.observedMoveOptions?.[role] || {};
  const select = (key,label,choices,current) => RotomUI.field(label,RotomUI.select(choices,current,{'data-rc-move-option':key,'data-rc-role':role}));
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
  rcSetStagePanelState('rc-input-panel',ready ? 'ready' : 'locked',ready ? '입력 가능' : '선택 필요');
  if (!ready) { renderTrustedHTML(container,'<div class="empty-state">양쪽 포켓몬을 선택하세요.</div>'); return; }
  rcNormalizeObservedMyMove();
  const conditions=(role,title)=>`<div class="rc-observation-conditions"><h4>${title}</h4>${rcRenderObservationMoveOptions(role === 'dealt' ? 'my' : 'opp')}<div class="field-checks">${[['defReflect','리플렉터'],['defLightScreen','빛의장막'],['isCritical','급소']].map(([key,label])=>RotomUI.check(label,{'data-rc-observed-field':role,'data-rc-field-key':key,checked:revCalcState.observedFields[role][key]})).join('')}</div></div>`;
  renderTrustedHTML(container,`
    <div class="rc-input-grid">
      <section class="rc-action-block"><h3>내 공격</h3><div class="rc-observed-row"><div class="form-field"><span>사용 기술</span>${rcRenderMoveCombobox('myMove',revCalcState.myMove)}</div>${RotomUI.field('상대 남은 HP %',RotomUI.number({'data-rc-action':'observedTheirPct',value:revCalcState.observedTheirPct,min:0,max:100,placeholder:'0~100'}))}</div></section>
      <section class="rc-action-block"><h3>상대 공격</h3><div class="rc-observed-row"><div class="form-field"><span>사용 기술</span>${rcRenderMoveCombobox('oppMove',revCalcState.oppMove)}</div>${RotomUI.field('내 남은 HP',RotomUI.number({'data-rc-action':'observedMyHp',value:revCalcState.observedMyHp,min:0,max:calcStats(my).hp,placeholder:'실수치'}))}</div></section>
    </div>
    <div class="rc-facts-grid">${RotomUI.field('행동 순서',RotomUI.select(rcTurnOrderOptions().map(s=>[s.id,s.label]),revCalcState.turnOrder,{'data-rc-action':'turnOrder'}))}<div class="form-field"><span>관측 도구</span>${rcRenderOppItemCombobox(revCalcState.oppItemKnown)}</div>${RotomUI.field('관측 특성',RotomUI.select([['unknown','미관측'],...rcPokemonAbilityIds(oppP).map(id=>[id,abName(AbilityById[id] || {name:id})])],revCalcState.oppAbilityKnown,{'data-rc-action':'oppAbilityKnown'}))}</div>
    <p class="rc-timing-note">HP는 회복·열매 발동 후 기준</p>
    <details class="field-panel ui-surface rc-extra-observation"><summary class="ui-disclosure"><span class="field-label">${RotomUI.icon('settings')}필드 · 추가 관측</span>${RotomUI.icon('chevron')}</summary><div class="rc-extra-body">
      <div class="form-grid form-grid--three">${RotomUI.field('날씨',RotomUI.select(CALC_WEATHER_OPTIONS.map(s=>[s.id,s.label]),revCalcState.field.weather,{'data-rc-field':'weather'}))}${RotomUI.field('필드',RotomUI.select(CALC_TERRAIN_OPTIONS.map(s=>[s.id,s.label]),revCalcState.field.terrain,{'data-rc-field':'terrain'}))}${RotomUI.check('트릭룸',{'data-rc-field':'trickRoom',checked:revCalcState.field.trickRoom})}</div>
      <div class="rc-input-grid">${conditions('dealt','내 공격 조건')}${conditions('received','상대 공격 조건')}</div>
      <section class="rc-known-moves"><h4>추가로 확인한 상대 기술</h4><div class="rc-facts-grid">${[0,1,2].map(slot=>rcRenderMoveCombobox('knownOppMove',revCalcState.knownOppMoves?.[slot] || '',{slot})).join('')}</div></section>
    </div></details>`);
  rcWireMoveComboboxes(container);
  rcWireOppItemComboboxes(container);
}

function rcResultRange(min, max, digits = null) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '—';
  const format = value => digits === null ? String(value) : value.toFixed(digits);
  return min === max ? format(min) : format(min) + '~' + format(max);
}

function rcRenderFollowupMoveChip(analysis) {
  if (!analysis?.move) return '';
  const move = analysis.move, summary = analysis.summary;
  const types = analysis.types?.length ? analysis.types : [move.type];
  const category = analysis.categories?.length === 1 ? analysis.categories[0] : move.cat;
  const typeBadges = renderToolTypePills(types.filter(Boolean));
  const order = summary?.order || '';
  const orderLabel = ({'후보에 따라 선후공 다름':'후보별 선후공','상대 기술 미확인':'상대 기술 미확인','선후공 확인 필요':'선후공 미확인'})[order] || order;
  const orderClass = order === '내 선공' ? 'my' : order === '상대 선공' ? 'opp' : 'mixed';
  const name = '<div class="rc-followup-move"><b>' + escapeHTML(mvName(move)) + '</b><span class="rc-followup-meta">' + typeBadges + '<span>' + escapeHTML(calcMoveCategoryLabel(category)) + '</span></span></div>';
  if (analysis.statusMove || analysis.unavailable || !summary) {
    const reason = analysis.statusMove ? '변화기' : (analysis.badges || []).join(' · ')
      .replace('이 대면의 첫 행동 이후 사용 불가','첫 턴 전용').replace('전기 타입 소실로 재사용 불가','재사용 불가').replace('다음 턴 피격에 따라 결정되는 기술','피격량에 따라 결정');
    return '<div class="rc-followup-chip status">' + name + '<span class="rc-move-unavailable">' + escapeHTML(reason || '조건 확인') + '</span></div>';
  }
  const koClass = summary.koClass || 'ko-none';
  const koText = ({'KO 확정':'확정 KO','KO 난수':'난수 KO','형태에 따라 다름':'형태별 차이','조건 확인 필요':'조건 확인'})[summary.koState] || summary.koState;
  const unresolved = summary.koState === '조건 확인 필요' && summary.rawMin === 0 && summary.rawMax === 0;
  const damage = unresolved ? '<strong>—</strong>' : '<strong>' + rcResultRange(summary.pctMin,summary.pctMax,1) + '<small>%</small></strong><span class="rc-damage-raw">' + rcResultRange(summary.rawMin,summary.rawMax) + ' HP</span>';
  return '<div class="rc-followup-chip">' + name +
    (orderLabel ? '<span class="rc-move-order rc-order--' + orderClass + '">' + escapeHTML(orderLabel) + '</span>' : '') +
    '<div class="rc-followup-damage">' + damage + '</div><span class="rc-followup-ko ' + koClass + '">' + escapeHTML(koText) + '</span></div>';
}

function rcRenderNextStateSummary(summary) {
  if (!summary) return '';
  const labels = {atk:'공격',def:'방어',spa:'특공',spd:'특방',spe:'속도'};
  const signed = n => n > 0 ? '+' + n : String(n);
  const sides = ['my','opp'].map(role => {
    const row = summary[role];
    if (!row) return '';
    const pokemon = PokemonById[revCalcState[role].pokemonIdx];
    const events = [...new Set(row.events || [])];
    const rankPattern = /^(.*?) · (공격|방어|특공|특방|스피드) [+-]\d+/;
    const changedRanks = Object.entries(row.ranks || {}).filter(([,values]) => values.some(n => n !== 0));
    const ranks = changedRanks.map(([stat,values]) => {
      const sources = [...new Set(events.map(event=>event.match(rankPattern)).filter(match=>match && match[2] === (stat === 'spe' ? '스피드' : labels[stat])).map(match=>match[1]))];
      const value = values.length === 1 ? signed(values[0]) : signed(Math.min(...values)) + '~' + signed(Math.max(...values));
      return (sources.length ? sources.join('/') + ' · ' : '') + labels[stat] + ' ' + value;
    });
    const otherEvents = events.filter(event=>!rankPattern.test(event)).map(event=>event.replace(' (일부 후보)',' (일부)').replace('대검돌격 · 다음 행동 전까지 받는 피해 ×2','대검돌격 · 받는 피해 ×2'));
    const tags = [...ranks,...otherEvents];
    const clamp = n => Number.isFinite(n) ? Math.max(0,Math.min(100,n)) : 0;
    return '<div class="rc-state-side rc-state-side--' + role + '"><div class="rc-state-identity"><span>' + (role === 'my' ? '내' : '상대') + '</span><strong>' + escapeHTML(pokemon ? pkName(pokemon) : '포켓몬') + '</strong></div>' +
      '<div class="rc-state-hp"><span>HP</span><strong>' + rcResultRange(row.hpMin,row.hpMax) + '</strong><small>' + rcResultRange(row.pctMin,row.pctMax,1) + '%</small></div>' +
      '<div class="ui-meter rc-state-meter" aria-hidden="true"><span class="ui-meter-fill rc-state-max" data-rc-hp-fill="' + clamp(row.pctMax) + '"></span><span class="ui-meter-fill rc-state-min" data-rc-hp-fill="' + clamp(row.pctMin) + '"></span></div>' +
      (tags.length ? '<div class="rc-state-events">' + tags.map(tag=>'<span class="ui-tag">' + escapeHTML(tag) + '</span>').join('') + '</div>' : '') + '</div>';
  }).join('');
  return '<section class="rc-next-state"><div class="rc-followup-head"><h4>다음 턴 시작 상태</h4></div><div class="rc-state-grid">' + sides + '</div></section>';
}

function rcRenderCandidateHeader(c, i, speedActive, expanded) {
  const parts = rcCandidateEvParts(c,speedActive);
  const example = rcRoleCompletionInfo(c,speedActive).parts.join(' · ');
  const nature = NATURE_BY_ID[c.nature]?.ko || c.nature;
  const item = c.item ? itName(ItemById[c.item] || {name:c.item}) : rcKnownOpponentItem() === null ? '도구 미관측' : '';
  const abilities = rcCandidateAbilityIds(c).map(id=>abName(AbilityById[id] || {name:id}));
  const label = ['후보 ' + (i+1),nature,item,...abilities,expanded ? '접기' : '펼치기'].filter(Boolean).join(' · ');
  const tags = (item ? '<span class="rc-result-item">' + escapeHTML(item) + '</span>' : '') + abilities.map(name=>'<span class="rc-result-ability">' + escapeHTML(name) + '</span>').join('');
  const evs = parts.map(part=>'<span class="rc-result-ev"><small>' + escapeHTML(part[0]) + '</small><b>' + escapeHTML(part.slice(1)) + '</b></span>').join('');
  return '<button type="button" class="ui-button rc-result-rank" data-rc-toggle-result="' + i + '" aria-label="' + escapeHTML(label) + '" aria-describedby="rc-candidate-values-' + i + '" aria-expanded="' + expanded + '" aria-controls="rc-candidate-details-' + i + '">' +
    '<span class="rc-candidate-index">' + String(i+1).padStart(2,'0') + '</span><span class="rc-result-title"><b class="rc-result-nature-badge">' + escapeHTML(nature) + '</b>' + tags + '</span>' + RotomUI.icon('chevron') +
    '<span class="rc-profile-values" id="rc-candidate-values-' + i + '"><span class="rc-result-evs"><span class="sr-only">추정 노력치 </span>' + (evs || '무투자') + '</span><span class="rc-result-example"><span>예시</span><b>' + escapeHTML(example || '—') + '</b></span></span></button>';
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

  const openIndexes = new Set((Array.isArray(revCalcState.openResultIndexes) ? revCalcState.openResultIndexes : [])
    .map(v => parseInt(v,10)).filter(v => Number.isInteger(v) && v >= 0 && v < r.results.length));
  const rows = r.results.map((c,i) => {
    const expanded = openIndexes.has(i), report = c.cardReport?.key === rcForecastKey() ? c.cardReport : null;
    const moves = (role,title,note) => '<section class="' + (role === 'my' ? 'rc-followup-panel' : 'rc-prediction-panel') + '"><div class="rc-followup-head"><h4><span>' + title + '</span></h4><small>' + note + '</small></div><div class="rc-followup-grid">' +
      ((report?.[role] || []).map(rcRenderFollowupMoveChip).join('') || '<span class="rc-mini-note">기술 미입력</span>') + '</div></section>';
    return '<article class="rc-result-row rc-form-result ' + (expanded ? 'open' : 'collapsed') + '">' +
      rcRenderCandidateHeader(c,i,r.speedActive,expanded) +
      '<div class="rc-result-expanded-body" id="rc-candidate-details-' + i + '" ' + (expanded ? '' : 'hidden') + '>' +
      (expanded ? (report ? rcRenderNextStateSummary(report.state) + '<div class="rc-damage-columns">' + moves('my','내 기술','상대 최대 HP 기준') + moves('opp','상대 관측 기술','내 최대 HP 기준') + '</div>' : '<p class="rc-mini-note" role="status">다음 턴 정보 갱신 중</p>') : '') +
      '</div></article>';
  }).join('');
  renderTrustedHTML(container,
    (r.hpTolerance ? '<p class="rc-hp-approx" role="status">HP 근사 일치 · ±1%p</p>' : '') +
    rcRenderExchangeSummary(r) +
    '<div class="rc-briefing"><div class="section-heading"><h3>예상 형태</h3><span class="rc-candidate-count">대표 ' + r.results.length + ' / ' + r.groupTotal + '그룹</span></div><p class="rc-mini-note">H32 우선 · ' + r.total + '개 후보</p></div><div class="rc-results-list">' + rows + '</div>');
  container.querySelectorAll('[data-rc-hp-fill]').forEach(el => { el.style.width = el.dataset.rcHpFill + '%'; });
  rcWireMoveComboboxes(container);
}

function renderRevCalcAll() {
  renderRevCalcMy();
  renderRevCalcOpp();
  renderRevCalcInputs();
  renderRevCalcResults();
}

// === 콤보박스 / 이벤트 ===
