/* Damage calculator execution and result rendering. */
function runCalc() {
  const calcState = makeCalcState();
  lastAutoEntry = calcState.entryMeta;
  const calcAtk = calcState.atk;
  const calcDef = calcState.def;
  const calcField = calcState.field;
  syncFieldControls(calcField);

  const atkP = PokemonById[state.atk.pokemonIdx];
  const defP = PokemonById[state.def.pokemonIdx];
  const body = document.getElementById('calc-results-body');
  const mobileSummary = document.getElementById('calcMobileSummary');
  if (!atkP || !defP) {
    if (body) body.innerHTML = '<div class="empty-state ui-empty">공격측과 방어측 포켓몬을 선택하면 계산 결과가 표시됩니다.</div>';
    if (mobileSummary) mobileSummary.hidden = true;
    return;
  }
  
  const atkSpe = effectiveSpeed(calcAtk, calcField);
  const defSpe = effectiveSpeed(calcDef, calcField);

  // 가변 위력 기술이 참조하는 행동 순서 플래그를 필드에 복사 (priority 0 기준)
  // 우선도가 다른 기술은 기술별로 calculateDamage 가 firstMover 결과로 보정해야 정확하지만
  // 대부분의 가변 위력 기술 (boltbeak, fishiousrend, payback) 은 priority 0 이므로 단순화.
  calcField.atkMovesFirst = atkSpe > defSpe;
  calcField.atkMovesSecond = atkSpe < defSpe;

  // 각 기술 계산
  const moveResults = state.atk.moves.map((mvId, i) => {
    if (!mvId) return { empty: true, slot: i+1 };
    const baseMove = MoveById[mvId];
    const move = baseMove ? moveWithManualBp(baseMove, calcAtk.moveBpOverrides?.[i], calcAtk.moveTypeOverrides?.[i]) : null;
    if (!move) return { empty: true, slot: i+1 };
    if (move.cat === 'Status') {
      return { empty: true, slot: i+1, move, statusMove: true };
    }
    const moveField = {
      ...calcField,
      isCritical: !!calcAtk.moveCriticalOverrides?.[i],
    };
    const result = calculateDamage(calcAtk, calcDef, move, moveField);
    if (!result) return { empty: true, slot: i+1, move };
    const hko = hkoLabel(result.damages, result.defHP, calcDef, calcField, result.koContext, result.hitProfile);
    const defStartHp = Math.max(1, sideCurrentHp(result.defHP, calcDef) - calcHazardDamage(calcDef, calcField, result.koContext));
    const first = firstMover(move.pri, atkSpe, defSpe);
    const timingPowerLabel = timingPowerConditionLabel(move, calcAtk, calcDef, calcField);
    return { ...result, hko, first, slot: i+1, move, defStartHp, entryMeta: calcState.entryMeta, timingPowerLabel };
  });
  
  // 틀깨기 / 다능 등 공격측 특성으로 무시되는 방어측 특성 체크
  const atkAb = calcAtk.ability;
  const defAb = calcDef.ability;
  const moldBreakerActive = !!AbilityById[atkAb]?.ignoresTargetAbility;
  const ignoredAb = moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(defAb)
    ? AbilityById[defAb] : null;

  const recommendedResult = moveResults
    .filter(result => !result.empty && result.move)
    .sort(compareCalcMoveRecommendations)[0];
  if (mobileSummary) {
    mobileSummary.hidden = !recommendedResult;
    mobileSummary.innerHTML = recommendedResult ? `
      <span class="calc-mobile-summary-label">추천 기술</span>
      <strong>${escapeHTML(mvName(recommendedResult.move))}</strong>
      <span class="calc-mobile-summary-range">${recommendedResult.minPct.toFixed(1)}~${recommendedResult.maxPct.toFixed(1)}%</span>
      <b class="calc-mobile-summary-ko">${escapeHTML(`${recommendedResult.hko.label} ${recommendedResult.hko.turns}`)}</b>
    ` : '';
  }

  body.innerHTML = `
    ${moldBreakerActive ? `
    <div class="calc-mold-breaker-info ui-control-frame ui-subframe ui-meta-row">
      <span class="calc-mold-breaker-tag">${AbilityById[atkAb]?.koName || atkAb}</span>
      ${ignoredAb ? `상대 <b>${ignoredAb.koName}</b> 특성을 무시합니다` : '방어측 일부 특성을 관통할 수 있습니다'}
    </div>
    ` : ''}

    <!-- 속도 대결 -->
    <div class="calc-speed-row ui-control-frame ui-subframe ui-summary-row">
      <div class="calc-speed-side calc-speed-side--atk ui-summary-card">
        <span class="calc-speed-identity">
          <span class="calc-speed-role">공격측</span>
          <b class="calc-speed-pokemon">${pkName(atkP)}</b>
        </span>
        <span class="calc-speed-value-wrap">
          <strong class="calc-speed-value ui-stat-readout">${atkSpe}</strong>
          ${renderEntrySpeedNote(calcState, 'atk')}
        </span>
      </div>
      <div class="calc-speed-center">
        <span class="calc-speed-label ui-section-title">속도</span>
      </div>
      <div class="calc-speed-side calc-speed-side--def ui-summary-card">
        <span class="calc-speed-value-wrap">
          <strong class="calc-speed-value ui-stat-readout">${defSpe}</strong>
          ${renderEntrySpeedNote(calcState, 'def')}
        </span>
        <span class="calc-speed-identity">
          <span class="calc-speed-role">수비측</span>
          <b class="calc-speed-pokemon">${pkName(defP)}</b>
        </span>
      </div>
    </div>
    
    <!-- 기술별 결과 -->
    <div class="calc-result-grid ui-control-frame ui-subframe ui-card-grid">
      ${moveResults.map(r => renderMoveCard(r)).join('')}
    </div>
  `;
  body.querySelectorAll('[data-meter-percent]').forEach((meter) => {
    const percent = Math.max(0, Math.min(100, Number(meter.dataset.meterPercent) || 0));
    meter.style.width = `${percent}%`;
  });
}

function calcMoveRecommendationRank(result) {
  const metric = result?.hko?.metric || {};
  const oneMoveChance = Number(metric.oneMoveKoChance) || 0;
  const guaranteedTurn = Number(metric.guaranteedTurn) || null;
  const possibleTurn = Number(metric.possibleTurn) || null;

  if (guaranteedTurn === 1) return [6, 1, result.minPct, result.maxPct];
  if (oneMoveChance > 0) return [5, oneMoveChance, result.minPct, result.maxPct];
  if (guaranteedTurn === 2) return [4, 1, result.minPct, result.maxPct];
  if (possibleTurn === 2) return [3, 1 / (guaranteedTurn || 10), result.minPct, result.maxPct];
  if (guaranteedTurn) return [2, 1 / guaranteedTurn, result.minPct, result.maxPct];
  return [1, 0, result.minPct, result.maxPct];
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
  return /랭크|진홍빛고동|하드론엔진/.test(label) ? 0 : 1;
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
  const visible = ordered.slice(0, limit);
  const hidden = labels.length - visible.length;
  const title = escapeHTML(ordered.join(' · '));
  const parts = visible.map(m => `<b class="calc-mod-badge ui-status-badge">${escapeHTML(m)}</b>`);
  if (hidden > 0) parts.push(`<b class="calc-mod-badge ui-status-badge" title="${title}">+${hidden}</b>`);
  return `<span class="calc-mods-trace" title="${title}">${parts.join('<span class="calc-mod-separator">·</span>')}</span>`;
}

function renderEntrySpeedNote(calcState, sideKey) {
  const delta = calcState.entryMeta?.rankDeltas?.[sideKey]?.spe || 0;
  if (!delta) return '';
  return `<span class="calc-speed-entry-note ui-status-badge">${STAT_LABEL.spe} ${formatRankValue(delta)}랭크</span>`;
}

function timingPowerConditionLabel(move, atkSide, defSide, field) {
  if (!move || move.cat === 'Status') return '';
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
  
  // 반동/회복 계산
  let sideEffect = '';
  if (moveData.recoil) {
    const [num, den] = moveData.recoil;
    const atkHP = calcStats(state.atk).hp;
    const recoilMin = Math.floor(min * num / den);
    const recoilMax = Math.floor(max * num / den);
    const recoilMinPct = (recoilMin / atkHP * 100).toFixed(1);
    const recoilMaxPct = (recoilMax / atkHP * 100).toFixed(1);
    sideEffect += `<span class="calc-side-effect-badge ui-status-badge"><span>반동</span><b>${recoilMinPct}% ~ ${recoilMaxPct}%</b><span>(${recoilMin}~${recoilMax})</span></span>`;
  }
  if (moveData.drain) {
    const [num, den] = moveData.drain;
    const atkHP = calcStats(state.atk).hp;
    const healMin = Math.floor(min * num / den);
    const healMax = Math.floor(max * num / den);
    const healMinPct = (healMin / atkHP * 100).toFixed(1);
    const healMaxPct = (healMax / atkHP * 100).toFixed(1);
    sideEffect += `<span class="calc-side-effect-badge ui-status-badge"><span>흡수</span><b>${healMinPct}% ~ ${healMaxPct}%</b><span>(${healMin}~${healMax})</span></span>`;
  }

  // 다단 히트 표시
  let multihitLabel = '';
  if (moveData.mh) {
    if (Array.isArray(moveData.mh)) {
      multihitLabel = `<span class="calc-move-meta-badge">${moveData.mh[0]}~${moveData.mh[1]}타</span>`;
    } else {
      multihitLabel = `<span class="calc-move-meta-badge">${moveData.mh}타 고정</span>`;
    }
  }
  // 부자유친 표시
  if (r.mods?.some(m => m.includes('부자유친'))) {
    multihitLabel = `<span class="calc-move-meta-badge">1타 + 0.25타</span>`;
  }
  const stabBadge = r.stab ? '<span class="calc-stab-badge">자속</span>' : '';
  const metaHtml = multihitLabel ? `<span class="calc-move-meta">${multihitLabel}</span>` : '';
  const hkoTone = r.hko.cls === 'no' ? 'no' :
                  r.hko.label === '난수' ? 'chance' :
                  r.hko.turns === '1타' ? 'ko-strong' : 'ko-stable';
  const hkoTitle = escapeHTML([r.hko.label, r.hko.turns, r.hko.pct, r.hko.sub].filter(Boolean).join(' · '));
  
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
            <span class="calc-effectiveness-badge ${effCls}">${effText}</span>
            ${metaHtml}
          </div>
        </div>
        <div class="calc-damage-range ui-meter-card">
          <div class="calc-damage-summary">
            <span class="calc-damage-percent">${pctMin} ~ ${pctMax}%</span>
            <span class="calc-hp-remain"><span class="calc-hp-remain-label">잔여 HP</span><b class="calc-hp-remain-value">${hpRemMin}-${hpRemMax} / ${r.defHP}</b></span>
          </div>
          <div class="calc-damage-meter ui-meter">
            <div class="calc-damage-meter-fill ui-meter-fill" data-meter-percent="${barMax}"></div>
            <div class="calc-damage-meter-fill min ui-meter-fill" data-meter-percent="${barMin}"></div>
          </div>
        </div>
        <div class="calc-damage-meta ui-meta-row">
          <span class="calc-damage-actual"><span class="calc-damage-actual-label">실제 대미지</span><b class="calc-damage-actual-value">${min}-${max}</b></span>
          ${timingPowerBadge}
          ${renderModsTrace(r.mods, 6, r)}
          ${sideEffect}
        </div>
      </div>
      <div class="calc-ko-badge ui-status-badge ${hkoTone}" title="${hkoTitle}">
        <div class="calc-ko-main ${r.hko.cls} ${r.hko.pct ? 'has-percent' : ''}">
          <span class="calc-ko-label">${r.hko.label}</span>
          <span class="calc-ko-turns">${r.hko.turns}</span>
          <span class="calc-ko-percent">${r.hko.pct || ''}</span>
        </div>
        ${r.hko.sub ? `<div class="calc-ko-sub">${r.hko.sub}</div>` : ''}
      </div>
    </div>
  `;
}

function triggerCalc() {
  runCalc();
}

// 접이식 패널
