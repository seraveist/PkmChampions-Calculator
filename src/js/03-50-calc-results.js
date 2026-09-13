/* Damage calculator execution and result rendering. */
function runCalc() { powerUiRefresh(); }

function calcMoveRecommendationRank(result) {
  const metric = result?.hko?.metric || {};
  const oneMoveChance = Number(metric.oneMoveKoChance) || 0;
  const guaranteedTurn = Number(metric.guaranteedTurn) || null;
  const possibleTurn = Number(metric.possibleTurn) || null;

  if (guaranteedTurn === 1) return [6, 1, 0, 0, result.minPct, result.maxPct];
  if (oneMoveChance > 0) return [5, oneMoveChance, 0, 0, result.minPct, result.maxPct];
  if (guaranteedTurn === 2) return [4, 1, 0, 0, result.minPct, result.maxPct];
  if (possibleTurn === 2) return [3, metric.cumulative?.[1] || 0, 1 / (guaranteedTurn || 100), 0, result.minPct, result.maxPct];
  if (possibleTurn) return [2, 1 / possibleTurn, metric.cumulative?.[possibleTurn - 1] || 0, 1 / (guaranteedTurn || 100), result.minPct, result.maxPct];
  return [1, 0, 0, 0, result.minPct, result.maxPct];
}

function compareCalcMoveRecommendations(a, b) {
  const aRank = calcMoveRecommendationRank(a);
  const bRank = calcMoveRecommendationRank(b);
  for (let index = 0; index < aRank.length; index++) {
    if (aRank[index] !== bRank[index]) return bRank[index] - aRank[index];
  }
  return (a.slot || 0) - (b.slot || 0);
}

document.getElementById('calcMobileSummary')?.addEventListener('click', () => {
  document.querySelector('#page-calc .calc-results-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function resultOffensiveStat(r) {
  return r?.move?.overrideOffensiveStat || (r?.category === 'Physical' ? 'atk' : 'spa');
}

function prettifyResultModLabel(label, result) {
  const text = String(label);
  const atkRank = text.match(/^공격랭크([+-]\d+)$/);
  if (atkRank && result) {
    const stat = resultOffensiveStat(result);
    return `${STAT_LABEL[stat] || '공격'} ${atkRank[1]}랭크`;
  }
  const defRank = text.match(/^방어랭크([+-]\d+)$/);
  if (defRank) return `방어 ${defRank[1]}랭크`;
  return text;
}

function resultModPriority(label) {
  return /멀티스케일|열매|필터|하드록|팬텀가드|두꺼운지방|퍼코트|얼음인분|테라셸/.test(label) ? -1 : /랭크|진홍빛고동|하드론엔진/.test(label) ? 0 : 1;
}

function renderModsTrace(mods, limit = 6, result = null) {
  const labels = [...new Set((mods || [])
    .filter(Boolean)
    .map(m => prettifyResultModLabel(m, result)))];
  if (!labels.length) return '';
  const ordered = labels
    .map((label, index) => ({ label, index }))
    .sort((a, b) => resultModPriority(a.label) - resultModPriority(b.label) || a.index - b.index)
    .map(item => item.label);
  const title = escapeHTML(ordered.join(' · '));
  const parts = ordered.map(m => `<b class="calc-mod-badge ui-status-badge">${escapeHTML(m)}</b>`);
  return `<span class="calc-mods-trace" title="${title}">${parts.join('<span class="calc-mod-separator">·</span>')}</span>`;
}

function renderCalcAppliedConditions(calcState) {
  const f = calcState.field;
  const abilities = battleAbilityContext(calcState.atk, calcState.def);
  const weather = effectiveWeather(f, abilities.atkAb, abilities.defAb);
  const labels = [calcFieldOptionLabel('gameType', f.gameType),
    weather && weather !== 'none' ? calcFieldOptionLabel('weather', weather) : '날씨 보정 없음',
    f.terrain && f.terrain !== 'none' ? calcFieldOptionLabel('terrain', f.terrain) : '필드 없음'];
  if (f.weather !== 'none' && weather !== f.weather) labels.push('날씨 효과 무시');
  for (const [key, label] of Object.entries({ trickRoom: '트릭룸', isGravity: '중력', defReflect: '리플렉터', defLightScreen: '빛의장막', atkHelpingHand: '도우미', allyBattery: '배터리', allyPowerSpot: '파워스폿', allyFriendGuard: '프렌드가드', ruinSword: '재앙의검', ruinTablet: '재앙의목간', ruinBeads: '재앙의구슬', ruinVessel: '재앙의그릇' })) if (f[key]) labels.push(label);
  if (f.gameType === 'Doubles') labels.push(f.spreadTargets === 'single' ? '광역기 대상 1마리' : '광역기 여러 대상');
  for (const key of ['atk', 'def']) {
    const side = calcState[key], role = key === 'atk' ? '공격측' : '수비측';
    if (side.tailwind) labels.push(`${role} 순풍`);
    if (side.fallenAllies) labels.push(`${role} 쓰러진 아군 ${side.fallenAllies}`);
  }
  labels.push(...(calcState.entryMeta?.logs || []));
  return `<div class="calc-applied-conditions ui-control-frame ui-subframe"><b>적용 조건</b><div class="ui-meta-row">${[...new Set(labels)].filter(Boolean).map(label => `<span class="ui-status-badge">${escapeHTML(label)}</span>`).join('')}</div></div>`;
}

function calcAppliedPowerLabel(result) {
  const move = result.move;
  if (isFixedPowerMove(move)) return move.ohko ? '일격 기술 · 명중 가정' : `고정 피해 ${result.damages[0] === result.damages.at(-1) ? result.damages[0] : `${result.damages[0]}~${result.damages.at(-1)}`}`;
  const values = (result.appliedBasePowers || []).map(row => row.length === 1 ? String(row[0]) : `${row[0]}~${row.at(-1)}`);
  const applied = values.length && new Set(values).size > 1 ? values.join(' → ') : values[0] || result.bp;
  return `${move.manualBp ? '수동' : '자동'} · ${move.manualBp ? '입력' : '기본'} ${move.bp} → 보정 위력 ${applied}`;
}

function renderEntrySpeedNote(calcState, sideKey) {
  const delta = calcState.entryMeta?.rankDeltas?.[sideKey]?.spe || 0;
  if (!delta) return '';
  return `<span class="calc-speed-entry-note ui-status-badge">${STAT_LABEL.spe} ${formatRankValue(delta)}랭크</span>`;
}

function timingPowerConditionLabel(move, atkSide, defSide, field) {
  if (!move || move.cat === 'Status') return '';
  if (field.orderUncertain && (['userMovesFirstDouble', 'userMovesSecondDouble'].includes(move.variableBpKind) || AbilityById[atkSide.ability]?.bpBoosts?.some(rule => rule.movesSecond))) return '동속 · 행동 순서 지정 필요';
  if (move.variableBpKind === 'userMovesFirstDouble' && field.atkMovesFirst) return '선공 시 위력';
  if (move.variableBpKind === 'userMovesSecondDouble' && field.atkMovesSecond) return '후공 시 위력';

  const ability = AbilityById[atkSide?.ability];
  const moveType = move.originalType || move.type;
  const isPhysical = move.cat === 'Physical';
  const analyticBoostActive = !!ability?.bpBoosts?.some(rule => rule.movesSecond && abilityRuleApplies(rule, {
    atkSide,
    defSide,
    move,
    field,
    bp: move.bp || 0,
    moveType,
    weather: field.weather,
    effectiveness: 1,
    isCritical: false,
    isPhysical,
  }));

  return analyticBoostActive ? '후공 시 위력' : '';
}

function renderMoveCard(r) {
  if (r.empty) {
    if (r.move && !r.statusMove) return `
      <div class="calc-result-card none ui-card ui-result-card"><div class="calc-result-card-placeholder ui-card-body">
        <span class="calc-result-slot ui-index mono">${r.slot}</span>
        <span class="calc-result-move-name">${escapeHTML(mvName(r.move))}</span>
        <span class="calc-condition-message" role="status">${escapeHTML(r.conditionIssue || '현재 조건에서 피해를 계산할 수 없습니다.')}</span>
      </div></div>`;
    if (r.statusMove) {
      return `
        <div class="calc-result-card none compact ui-card ui-result-card">
          <div class="calc-result-card-placeholder ui-card-body">
            <span class="calc-result-slot ui-index mono">${r.slot}</span>
            <span class="calc-result-move-name">${escapeHTML(mvName(r.move))} · 변화기</span>
          </div>
        </div>
      `;
    }
    return `
      <div class="calc-result-card none compact ui-card ui-result-card">
        <div class="calc-result-card-placeholder ui-card-body">
          <span class="calc-result-slot ui-index mono">${r.slot}</span>
          <span class="calc-result-move-name">기술 미설정</span>
        </div>
      </div>
    `;
  }
  
  const pctMin = r.minPct.toFixed(1);
  const pctMax = r.maxPct.toFixed(1);
  const barMax = Math.min(100, r.maxPct);
  const barMin = Math.min(100, r.minPct);
  
  const eff = r.effectiveness;
  const effCls = eff === 0 ? 'eff-0' : eff === 0.25 ? 'eff-0-25' : eff === 0.5 ? 'eff-0-5' :
                 eff === 2 ? 'eff-2' : eff === 4 ? 'eff-4' : 'eff-1';
  const effText = eff === 0 ? '효과없음' : eff === 0.25 ? '1/4배' : eff === 0.5 ? '1/2배' :
                  eff === 2 ? '2배' : eff === 4 ? '4배' : '1배';
  
  const cat = r.category === 'Physical' ? '물리' : '특수';
  const catCls = r.category === 'Physical' ? 'cat-phys' : 'cat-spec';
  
  const min = r.damages[0];
  const max = r.damages[15];
  const startHp = r.defStartHp || r.defHP;
  const hpRemMin = Math.max(0, startHp - max);
  const hpRemMax = Math.max(0, startHp - min);
  
  const moveData = r.move;
  const originalMoveType = moveData.originalType || moveData.type;
  const typeChange = r.moveType !== originalMoveType;
  // 타입 셀은 단일 컬럼: 변환 시 작은 원본 표시는 type-pill 안에 흡수
  const typeLabel = `<span class="type-pill calc-move-type-badge t-${r.moveType}" ${typeChange ? `title="원래: ${TYPE_KO[originalMoveType]}"` : ''}>${TYPE_KO[r.moveType] || r.moveType}${typeChange ? '*' : ''}</span>`;
  
  // 부수 효과의 실제 HP 변화는 상대 행동·무효·생존을 포함하는 별도 범위다.
  // 피해를 단순 비례한 수치를 실제 회복량처럼 표시하지 않는다.
  const sideEffect = [moveData.recoil ? '반동 기술' : '', moveData.drain ? 'HP 흡수 기술' : '']
    .filter(Boolean).map(label => '<span class="calc-side-effect-badge ui-status-badge">' + label + '</span>').join('');

  // 다단 히트 표시
  let multihitLabel = '';
  if (r.hitCounts?.length) {
    const counts = [...new Set(r.hitCounts)].sort((a, b) => a - b);
    if (counts.at(-1) > 1 || moveData.mh) multihitLabel = `<span class="calc-move-meta-badge">${counts.length === 1 ? `${counts[0]}회 적중` : `${counts[0]}~${counts.at(-1)}회 적중`}</span>`;
  } else if (moveData.mh) {
    if (Array.isArray(moveData.mh)) {
      multihitLabel = `<span class="calc-move-meta-badge">${moveData.mh[0]}~${moveData.mh[1]}타</span>`;
    } else {
      multihitLabel = `<span class="calc-move-meta-badge">${moveData.mh}타 고정</span>`;
    }
  }
  // 부자유친 표시
  if (r.mods?.some(m => m.includes('부자유친'))) {
    multihitLabel = `<span class="calc-move-meta-badge">2회 적중 · 부자유친</span>`;
  }
  const stabBadge = r.stab ? '<span class="calc-stab-badge">자속</span>' : '';
  const metaHtml = multihitLabel ? `<span class="calc-move-meta">${multihitLabel}</span>` : '';
  const hkoTone = r.hko.cls === 'no' ? 'no' :
                  r.hko.label === '난수' ? 'chance' :
                  r.hko.turns === '1타' ? 'ko-strong' : 'ko-stable';
  const hkoTitle = escapeHTML([r.hko.label, r.hko.turns, r.hko.pct, r.hko.sub].filter(Boolean).join(' · '));
  const effectNotes = [...(r.immunityNotes || []), ...(r.survivalNotes || [])];
  const effectNotesHtml = effectNotes.length
    ? `<div class="calc-effect-notes ui-meta-row">${effectNotes.map(note => `<span class="ui-status-badge">${escapeHTML(note)} · 피해 산출에서 제외</span>`).join('')}</div>`
    : '';
  
  const timingPowerBadge = r.timingPowerLabel
    ? `<span class="calc-timing-power-badge ui-status-badge">${escapeHTML(r.timingPowerLabel)}</span>`
    : '';

  return `
    <div class="calc-result-card ui-card ui-result-card">
      <div class="calc-result-card-main ui-card-body">
        <div class="calc-result-card-head ui-card-head">
          <div class="calc-result-title-row ui-title-row">
            <span class="calc-result-slot ui-index mono">${r.slot}</span>
            <span class="calc-result-move-name">${mvName(moveData)}</span>
          </div>
          <div class="calc-move-badges ui-chip-row">
            <span class="cat-badge calc-move-cat-badge ${catCls}">${cat}</span>
            ${typeLabel}
            ${stabBadge}
            <span class="calc-effectiveness-badge ${effCls}">${r.immunityNotes?.length ? '계산상 ' : ''}${effText}</span>
            ${metaHtml}
          </div>
        </div>
        ${effectNotesHtml}
        ${r.specialCondition ? `<div class="calc-special-conditions calc-ko-details">${escapeHTML(r.specialCondition)}</div>` : ''}
        ${r.hko.sub ? `<div class="calc-ko-details ui-meta-row">${escapeHTML(r.hko.sub)}</div>` : ''}
        <div class="calc-damage-range ui-meter-card">
          <div class="calc-damage-summary">
            <span class="calc-damage-percent">${pctMin} ~ ${pctMax}%</span>
            <span class="calc-hp-remain"><span class="calc-hp-remain-label">회복 제외 HP</span><b class="calc-hp-remain-value">${hpRemMin}-${hpRemMax} / ${r.defHP}</b></span>
          </div>
          <div class="calc-damage-meter ui-meter">
            <div class="calc-damage-meter-fill ui-meter-fill" data-meter-percent="${barMax}"></div>
            <div class="calc-damage-meter-fill min ui-meter-fill" data-meter-percent="${barMin}"></div>
          </div>
        </div>
        <div class="calc-damage-meta ui-meta-row">
          <span class="calc-applied-power ui-status-badge">${escapeHTML(calcAppliedPowerLabel(r))}</span>
          <span class="calc-damage-actual"><span class="calc-damage-actual-label">계산 대미지</span><b class="calc-damage-actual-value">${min}-${max}</b></span>
          ${timingPowerBadge}
          ${renderModsTrace(r.mods, 6, r)}
          ${sideEffect}
        </div>
      </div>
      <div class="calc-ko-badge ui-status-badge ${hkoTone}" title="${hkoTitle} · 1타는 기술 1회 사용, 명중 가정">
        <div class="calc-ko-main ${r.hko.cls} ${r.hko.pct ? 'has-percent' : ''}">
          <span class="calc-ko-label">${r.hko.label}</span>
          <span class="calc-ko-turns">${r.hko.turns}</span>
          <span class="calc-ko-percent">${r.hko.pct || ''}</span>
        </div>
      </div>
    </div>
  `;
}

function triggerCalc() {
  runCalc();
}

// 접이식 패널
