/* Damage calculator execution and result rendering. */
function runCalc() {
  const calcState = makeCalcState();
  lastAutoEntry = calcState.entryMeta;
  const entryLog = lastAutoEntry.logs;
  const calcAtk = calcState.atk;
  const calcDef = calcState.def;
  const calcField = calcState.field;
  syncFieldControls(calcField);

  const atkP = PokemonById[state.atk.pokemonIdx];
  const defP = PokemonById[state.def.pokemonIdx];
  if (!atkP || !defP) return;
  
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
    const move = baseMove ? moveWithManualBp(baseMove, calcAtk.moveBpOverrides?.[i]) : null;
    if (!move) return { empty: true, slot: i+1 };
    if (move.cat === 'Status') {
      return { empty: true, slot: i+1, move, statusMove: true };
    }
    const result = calculateDamage(calcAtk, calcDef, move, calcField);
    if (!result) return { empty: true, slot: i+1, move };
    const hko = hkoLabel(result.damages, result.defHP, calcDef, calcField);
    const defStartHp = Math.max(1, sideCurrentHp(result.defHP, calcDef) - calcHazardDamage(calcDef, calcField));
    const first = firstMover(move.pri, atkSpe, defSpe, calcField);
    return { ...result, hko, first, slot: i+1, move, defStartHp };
  });
  
  // 틀깨기 / 다능 등 공격측 특성으로 무시되는 방어측 특성 체크
  const atkAb = calcAtk.ability;
  const defAb = calcDef.ability;
  const moldBreakerActive = !!AbilityById[atkAb]?.ignoresTargetAbility;
  const ignoredAb = moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(defAb)
    ? AbilityById[defAb] : null;

  // 재앙 효과 정보
  const ruinActive = [];
  if (calcField.ruinSword)  ruinActive.push('검의재앙(방어 ×0.75)');
  if (calcField.ruinTablet) ruinActive.push('목간의재앙(공격 ×0.75)');
  if (calcField.ruinBeads)  ruinActive.push('구슬의재앙(특방 ×0.75)');
  if (calcField.ruinVessel) ruinActive.push('그릇의재앙(특공 ×0.75)');

  const body = document.getElementById('results-body');
  body.innerHTML = `
    ${entryLog.length > 0 ? `
    <div class="entry-effects">
      <div class="entry-effects-label">📋 진입 효과 자동 적용</div>
      ${entryLog.map(e => `<div class="entry-effect-item">${e}</div>`).join('')}
    </div>
    ` : ''}

    ${renderEntryRankSummary(calcState)}

    ${moldBreakerActive ? `
    <div class="mold-breaker-info">
      <span class="mold-breaker-tag">${AbilityById[atkAb]?.koName || atkAb}</span>
      ${ignoredAb ? `상대 <b>${ignoredAb.koName}</b> 특성을 무시합니다` : '방어측 일부 특성을 관통할 수 있습니다'}
    </div>
    ` : ''}

    ${ruinActive.length > 0 ? `
    <div class="ruin-info">
      <span class="ruin-tag">⚔️ 재앙 활성</span>
      ${ruinActive.join(' · ')}
    </div>
    ` : ''}

    <!-- 속도 대결 -->
    <div class="speed-row">
      <div class="speed-side atk">
        <div class="speed-name-card">
          <span>공격측</span>
          <b>${pkName(atkP)}</b>
        </div>
        <div class="speed-value">
          <span>속도</span>
          <b>${atkSpe}</b>
        </div>
      </div>
      <div class="speed-vs">VS</div>
      <div class="speed-side def">
        <div class="speed-value">
          <span>속도</span>
          <b>${defSpe}</b>
        </div>
        <div class="speed-name-card">
          <span>방어측</span>
          <b>${pkName(defP)}</b>
        </div>
      </div>
      <div class="speed-verdict">
        ${atkSpe > defSpe ? `공격측이 <b>${atkSpe - defSpe}</b> 더 빠름 ${calcField.isTrickRoom ? '→ 트릭룸: 방어측 선공' : '→ 동우선도시 공격측 선공'}` :
          atkSpe < defSpe ? `방어측이 <b>${defSpe - atkSpe}</b> 더 빠름 ${calcField.isTrickRoom ? '→ 트릭룸: 공격측 선공' : '→ 동우선도시 방어측 선공'}` :
          `속도 동일 (스피드 타이 50%)`}
      </div>
    </div>
    
    <!-- 기술별 결과 -->
    <div class="move-results">
      ${moveResults.map(r => renderMoveCard(r)).join('')}
    </div>
  `;
}

function renderModsTrace(mods, limit = 6) {
  const labels = [...new Set((mods || []).filter(Boolean).map(m => m.toString()))];
  if (!labels.length) return '';
  const visible = labels.slice(0, limit);
  const hidden = labels.length - visible.length;
  const title = escapeHTML(labels.join(' · '));
  const parts = visible.map(m => `<b>${escapeHTML(m)}</b>`);
  if (hidden > 0) parts.push(`<b title="${title}">+${hidden}</b>`);
  return `<span class="mods-trace" title="${title}">${parts.join('<span class="sep">·</span>')}</span>`;
}

function renderMoveCard(r) {
  if (r.empty) {
    if (r.statusMove) {
      return `
        <div class="move-card none compact">
          <div class="move-card-placeholder">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name">${mvName(r.move)} (변화기)</span>
            <span class="move-meta"><span class="cat-stat">STAT</span>${r.move.desc ? ` · ${r.move.desc}` : ''}</span>
          </div>
        </div>
      `;
    }
    return `
      <div class="move-card none compact">
        <div class="move-card-placeholder">
          <span class="move-slot-num mono">${r.slot}</span>
          <span class="move-name">기술 미설정</span>
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
  const typeChange = r.moveType !== moveData.type;
  // 타입 셀은 단일 컬럼: 변환 시 작은 원본 표시는 type-pill 안에 흡수
  const typeLabel = `<span class="type-pill t-${r.moveType}" ${typeChange ? `title="원래: ${TYPE_KO[moveData.type]}"` : ''}>${TYPE_KO[r.moveType] || r.moveType}${typeChange ? '*' : ''}</span>`;
  
  // 반동/회복 계산
  let sideEffect = '';
  if (moveData.recoil) {
    const [num, den] = moveData.recoil;
    const atkHP = calcStats(state.atk).hp;
    const recoilMin = Math.floor(min * num / den);
    const recoilMax = Math.floor(max * num / den);
    const recoilMinPct = (recoilMin / atkHP * 100).toFixed(1);
    const recoilMaxPct = (recoilMax / atkHP * 100).toFixed(1);
    sideEffect += `<span class="side-effect"><span>반동</span><b>${recoilMinPct}% ~ ${recoilMaxPct}%</b><span>(${recoilMin}~${recoilMax})</span></span>`;
  }
  if (moveData.drain) {
    const [num, den] = moveData.drain;
    const atkHP = calcStats(state.atk).hp;
    const healMin = Math.floor(min * num / den);
    const healMax = Math.floor(max * num / den);
    const healMinPct = (healMin / atkHP * 100).toFixed(1);
    const healMaxPct = (healMax / atkHP * 100).toFixed(1);
    sideEffect += `<span class="side-effect"><span>흡수</span><b>${healMinPct}% ~ ${healMaxPct}%</b><span>(${healMin}~${healMax})</span></span>`;
  }

  // 다단 히트 표시
  let multihitLabel = '';
  if (moveData.mh) {
    if (Array.isArray(moveData.mh)) {
      multihitLabel = `<span style="color:var(--warn)">· ${moveData.mh[0]}~${moveData.mh[1]}타</span>`;
    } else {
      multihitLabel = `<span style="color:var(--warn)">· ${moveData.mh}타 고정</span>`;
    }
  }
  // 부자유친 표시
  if (r.mods?.some(m => m.includes('부자유친'))) {
    multihitLabel = `<span style="color:var(--warn)">· 1타 + 0.25타</span>`;
  }
  const stabBadge = r.stab ? '<span class="stab-mark">자속</span>' : '';
  const metaHtml = multihitLabel ? `<span class="move-meta">${multihitLabel}</span>` : '';
  const hkoTone = r.hko.cls === 'no' ? 'no' :
                  r.hko.label === '난수' ? 'chance' :
                  r.hko.turns === '1타' ? 'ko-strong' : 'ko-stable';
  
  return `
    <div class="move-card">
      <div class="move-card-main">
        <div class="move-card-top">
          <div class="move-title-row">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name">${mvName(moveData)}</span>
          </div>
          <div class="move-badges">
            ${typeLabel}
            <span class="cat-badge ${catCls}">${cat}</span>
            ${stabBadge}
            <span class="eff-badge ${effCls}">${effText}</span>
            ${metaHtml}
          </div>
        </div>
        <div class="dmg-summary">
          <span class="dmg-pct">${pctMin} ~ ${pctMax}%</span>
          <span class="hp-remain">잔여 HP ${hpRemMin}-${hpRemMax} / ${r.defHP}</span>
        </div>
        <div class="dmg-bar">
          <div class="dmg-bar-fill" style="width: ${barMax}%"></div>
          <div class="dmg-bar-fill min" style="width: ${barMin}%"></div>
        </div>
        <div class="dmg-info">
          <span>실제 대미지 <b>${min}–${max}</b></span>
          ${renderModsTrace(r.mods)}
          ${sideEffect}
        </div>
      </div>
      <div class="hko-badge ${hkoTone}">
        <div class="hko-main ${r.hko.cls}">
          <span class="hko-label">${r.hko.label}</span>
          <span class="hko-turns">${r.hko.turns}</span>
          <span class="hko-pct">${r.hko.pct || ''}</span>
        </div>
        ${r.hko.sub ? `<div class="hko-sub">${r.hko.sub}</div>` : ''}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════
   필드 이벤트
   ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   자동/수동 계산 모드
   ════════════════════════════════════════════════════════════ */
let autoCalcMode = true;

function triggerCalc() {
  if (autoCalcMode) {
    runCalc();
  } else {
    const calcState = makeCalcState();
    lastAutoEntry = calcState.entryMeta;
    syncFieldControls(calcState.field);
  }
}

function updateFieldSummary(fieldState = null, entryMeta = null) {
  const f = fieldState || state.field;
  const meta = entryMeta || lastAutoEntry;
  const parts = [];
  const sourceMark = fieldKey => {
    if (manualAutoFieldOverrides[fieldKey]) return '<span class="field-source-mark manual">수동</span>';
    if (meta?.fields?.[fieldKey]) return '<span class="field-source-mark auto">자동</span>';
    return '';
  };

  if (f.weather && f.weather !== 'none') {
    const wMap = { Sun: '쾌청', Rain: '비', Sand: '모래바람', Snow: '눈', 'Harsh Sunshine': '대쾌청', 'Heavy Rain': '강한비' };
    parts.push(`<b>${wMap[f.weather] || f.weather}</b>${sourceMark('weather')}`);
  } else if (manualAutoFieldOverrides.weather) {
    parts.push(`<b>날씨 없음</b>${sourceMark('weather')}`);
  }
  if (f.terrain && f.terrain !== 'none') {
    const tMap = { Electric: '일렉트릭', Grassy: '그래스', Psychic: '사이코', Misty: '미스트' };
    parts.push(`<b>${tMap[f.terrain] || f.terrain}필드</b>${sourceMark('terrain')}`);
  } else if (manualAutoFieldOverrides.terrain) {
    parts.push(`<b>필드 없음</b>${sourceMark('terrain')}`);
  }
  if (f.gameType === 'Doubles') parts.push('더블');
  if (f.isCritical) parts.push('급소');
  if (f.defReflect) parts.push('리플렉터');
  if (f.defLightScreen) parts.push('빛의장막');
  if (f.atkHelpingHand) parts.push('도우미');
  if (f.defProtect) parts.push('방어');
  const ruins = [];
  if (f.ruinSword) ruins.push(`검${sourceMark('ruinSword')}`);
  if (f.ruinTablet) ruins.push(`목간${sourceMark('ruinTablet')}`);
  if (f.ruinBeads) ruins.push(`구슬${sourceMark('ruinBeads')}`);
  if (f.ruinVessel) ruins.push(`그릇${sourceMark('ruinVessel')}`);
  if (ruins.length) parts.push(`<span style="color:var(--tera)">⚔️${ruins.join('/')}</span>`);
  document.getElementById('field-summary').innerHTML =
    parts.length ? parts.join(' · ') : '기본값';
}

// 접이식 패널
