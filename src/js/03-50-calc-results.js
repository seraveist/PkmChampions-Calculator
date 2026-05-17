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
    const move = baseMove ? moveWithManualBp(baseMove, calcAtk.moveBpOverrides?.[i], calcAtk.moveTypeOverrides?.[i]) : null;
    if (!move) return { empty: true, slot: i+1 };
    if (move.cat === 'Status') {
      return { empty: true, slot: i+1, move, statusMove: true };
    }
    const result = calculateDamage(calcAtk, calcDef, move, calcField);
    if (!result) return { empty: true, slot: i+1, move };
    const hko = hkoLabel(result.damages, result.defHP, calcDef, calcField);
    const defStartHp = Math.max(1, sideCurrentHp(result.defHP, calcDef) - calcHazardDamage(calcDef, calcField));
  const first = firstMover(move.pri, atkSpe, defSpe);
    return { ...result, hko, first, slot: i+1, move, defStartHp, entryMeta: calcState.entryMeta };
  });
  
  // 틀깨기 / 다능 등 공격측 특성으로 무시되는 방어측 특성 체크
  const atkAb = calcAtk.ability;
  const defAb = calcDef.ability;
  const moldBreakerActive = !!AbilityById[atkAb]?.ignoresTargetAbility;
  const ignoredAb = moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(defAb)
    ? AbilityById[defAb] : null;

  const body = document.getElementById('results-body');
  body.innerHTML = `
    ${moldBreakerActive ? `
    <div class="mold-breaker-info">
      <span class="mold-breaker-tag">${AbilityById[atkAb]?.koName || atkAb}</span>
      ${ignoredAb ? `상대 <b>${ignoredAb.koName}</b> 특성을 무시합니다` : '방어측 일부 특성을 관통할 수 있습니다'}
    </div>
    ` : ''}

    <!-- 속도 대결 -->
    <div class="speed-row">
      <div class="speed-side atk">
        <span class="speed-identity">
          <span class="speed-role">공격측</span>
          <b class="speed-pokemon">${pkName(atkP)}</b>
        </span>
        <span class="speed-value-wrap">
          <strong class="speed-value">${atkSpe}</strong>
          ${renderEntrySpeedNote(calcState, 'atk')}
        </span>
      </div>
      <div class="speed-center">
        <span class="speed-label">속도</span>
      </div>
      <div class="speed-side def">
        <span class="speed-value-wrap">
          <strong class="speed-value">${defSpe}</strong>
          ${renderEntrySpeedNote(calcState, 'def')}
        </span>
        <span class="speed-identity">
          <span class="speed-role">수비측</span>
          <b class="speed-pokemon">${pkName(defP)}</b>
        </span>
      </div>
    </div>
    
    <!-- 기술별 결과 -->
    <div class="move-results">
      ${moveResults.map(r => renderMoveCard(r)).join('')}
    </div>
  `;
}

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
  const parts = visible.map(m => `<b>${escapeHTML(m)}</b>`);
  if (hidden > 0) parts.push(`<b title="${title}">+${hidden}</b>`);
  return `<span class="mods-trace" title="${title}">${parts.join('<span class="sep">·</span>')}</span>`;
}

function renderEntrySpeedNote(calcState, sideKey) {
  const delta = calcState.entryMeta?.rankDeltas?.[sideKey]?.spe || 0;
  if (!delta) return '';
  return `<span class="speed-entry-note">${STAT_LABEL.spe} ${formatRankValue(delta)}랭크</span>`;
}

function renderMoveCard(r) {
  if (r.empty) {
    if (r.statusMove) {
      return `
        <div class="move-card none compact">
          <div class="move-card-placeholder">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name">${escapeHTML(mvName(r.move))} · 변화기</span>
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
  const originalMoveType = moveData.originalType || moveData.type;
  const typeChange = r.moveType !== originalMoveType;
  // 타입 셀은 단일 컬럼: 변환 시 작은 원본 표시는 type-pill 안에 흡수
  const typeLabel = `<span class="type-pill t-${r.moveType}" ${typeChange ? `title="원래: ${TYPE_KO[originalMoveType]}"` : ''}>${TYPE_KO[r.moveType] || r.moveType}${typeChange ? '*' : ''}</span>`;
  
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
      multihitLabel = `<span class="move-meta-note">${moveData.mh[0]}~${moveData.mh[1]}타</span>`;
    } else {
      multihitLabel = `<span class="move-meta-note">${moveData.mh}타 고정</span>`;
    }
  }
  // 부자유친 표시
  if (r.mods?.some(m => m.includes('부자유친'))) {
    multihitLabel = `<span class="move-meta-note">1타 + 0.25타</span>`;
  }
  const stabBadge = r.stab ? '<span class="stab-mark">자속</span>' : '';
  const metaHtml = multihitLabel ? `<span class="move-meta">${multihitLabel}</span>` : '';
  const hkoTone = r.hko.cls === 'no' ? 'no' :
                  r.hko.label === '난수' ? 'chance' :
                  r.hko.turns === '1타' ? 'ko-strong' : 'ko-stable';
  const hkoTitle = escapeHTML([r.hko.label, r.hko.turns, r.hko.pct, r.hko.sub].filter(Boolean).join(' · '));
  
  return `
    <div class="move-card">
      <div class="move-card-main">
        <div class="move-card-top">
          <div class="move-title-row">
            <span class="move-slot-num mono">${r.slot}</span>
            <span class="move-name">${mvName(moveData)}</span>
          </div>
          <div class="move-badges">
            <span class="cat-badge ${catCls}">${cat}</span>
            ${typeLabel}
            ${stabBadge}
            <span class="eff-badge ${effCls}">${effText}</span>
            ${metaHtml}
          </div>
        </div>
        <div class="dmg-range-box">
          <div class="dmg-summary">
            <span class="dmg-pct">${pctMin} ~ ${pctMax}%</span>
            <span class="hp-remain">잔여 HP ${hpRemMin}-${hpRemMax} / ${r.defHP}</span>
          </div>
          <div class="dmg-bar">
            <div class="dmg-bar-fill" style="width: ${barMax}%"></div>
            <div class="dmg-bar-fill min" style="width: ${barMin}%"></div>
          </div>
        </div>
        <div class="dmg-info">
          <span>실제 대미지 <b>${min}-${max}</b></span>
          ${renderModsTrace(r.mods, 6, r)}
          ${sideEffect}
        </div>
      </div>
      <div class="hko-badge ${hkoTone}" title="${hkoTitle}">
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

function triggerCalc() {
  runCalc();
}

// 접이식 패널
