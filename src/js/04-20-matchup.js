/* Team matchup and coverage table.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
const matchupSlots = [null, null, null, null, null, null];
const matchupCoverageMoves = Array.from({ length: 6 }, () => [null, null, null, null]);
let matchupMode = 'defense';

const EFF_SYMBOL = {
  4: '◎',
  2: '○',
  1: '',
  0.5: '△',
  0.25: '△△',
  0: '✕',
};
const EFF_CLASS = {
  4: 'eff-4',
  2: 'eff-2',
  1: '',           // 1× 는 클래스 부여 안 함 (색깔 변경 없음)
  0.5: 'eff-05',
  0.25: 'eff-025',
  0: 'eff-0',
};
// 매치업 테이블 고정 열 너비 (px). table-layout: fixed 와 함께 사용.
const MATCHUP_COL = { type: 124, slot: 112, score: 84, coverageSummary: 84 };
const DEFENSE_CONSISTENCY_SCORE = { 0: -1.8, 0.25: -1.3, 0.5: -0.8, 1: 0.15, 2: 1, 4: 2.5 };
const THREAT_RANK = { safe: 0, normal: 1, check: 2, caution: 3, danger: 4, max: 5 };

function matchupMetaIds(kind) {
  return Array.isArray(META_THREATS?.[kind]) ? META_THREATS[kind].filter(Boolean) : [];
}

function matchupMetaPokemon(kind) {
  return matchupMetaIds(kind).map(id => PokemonById[id]).filter(Boolean);
}

function defenseScoreLabel(score) {
  if (score <= 0.7) return { label: '안전', cls: 'safe' };
  if (score <= 1.6) return { label: '보통', cls: 'normal' };
  if (score <= 2.6) return { label: '주의', cls: 'caution' };
  return { label: '위험', cls: 'danger' };
}

function defenseTypeProfile(type, pokes) {
  const effects = pokes.map(p => typeEff(type, p.types));
  const rawScore = effects.reduce((sum, eff) => sum + (DEFENSE_CONSISTENCY_SCORE[eff] ?? 0.15), 0);
  const score = Math.max(0, rawScore);
  const weakCount = effects.filter(eff => eff > 1).length;
  const quadCount = effects.filter(eff => eff >= 4).length;
  const neutralCount = effects.filter(eff => eff === 1).length;
  const resistCount = effects.filter(eff => eff === 0.5).length;
  const quarterCount = effects.filter(eff => eff === 0.25).length;
  const immuneCount = effects.filter(eff => eff === 0).length;
  return {
    type,
    score,
    rawScore,
    weakCount,
    quadCount,
    neutralCount,
    resistCount,
    quarterCount,
    immuneCount,
    grade: defenseScoreLabel(score),
  };
}

function formatDefenseScore(score) {
  return score.toFixed(2).replace(/0$/, '').replace(/\.0$/, '.0');
}

function selectedCoverageMoves() {
  const moves = [];
  matchupCoverageMoves.forEach((slotMoves, slot) => {
    slotMoves.forEach(moveId => {
      const move = moveId ? MoveById[moveId] : null;
      if (move) moves.push({ slot, move });
    });
  });
  return moves;
}

function coverageSlotHasType(slot, type) {
  return (matchupCoverageMoves[slot] || []).some(moveId => MoveById[moveId]?.type === type);
}

function coverageCountByType(type, slot = null) {
  if (slot !== null) return coverageSlotHasType(slot, type) ? 1 : 0;
  return matchupCoverageMoves.reduce((sum, _, i) => sum + (coverageSlotHasType(i, type) ? 1 : 0), 0);
}

function coverageSlotCountForTypes(types) {
  const targets = new Set(types);
  return matchupCoverageMoves.reduce((sum, slotMoves) => {
    const hit = slotMoves.some(moveId => targets.has(MoveById[moveId]?.type));
    return sum + (hit ? 1 : 0);
  }, 0);
}

function coverageThreatGrade(has4x, quadCovered, alt2Count) {
  if (has4x && quadCovered) return { label: '안전', cls: 'safe' };
  if (alt2Count >= 3) return { label: '안전', cls: 'safe' };
  if (alt2Count === 2) return { label: '견제', cls: 'check' };
  if (alt2Count === 1) return { label: '주의', cls: 'caution' };
  return { label: '위험', cls: 'danger' };
}

function renderMatchupModeTabs() {
  const tabs = document.getElementById('matchupModeTabs');
  if (!tabs) return;
  tabs.querySelectorAll('.matchup-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.matchupMode === matchupMode);
    btn.onclick = () => {
      matchupMode = btn.dataset.matchupMode || 'defense';
      renderMatchupModeTabs();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    };
  });
}

function renderMatchupSlots() {
  const container = document.getElementById('matchupSlots');
  if (!container) return;
  container.innerHTML = matchupSlots.map((id, i) => {
    const p = id ? PokemonById[id] : null;
    return `
      <div class="matchup-slot ${p ? 'filled' : ''}" data-slot="${i}">
        <div class="matchup-slot-num">${i + 1}</div>
        <div class="combobox">
          <input type="text" class="cb-input matchup-cb-input" data-slot="${i}"
                 value="${p ? escapeHTML(pkName(p)) : ''}" placeholder="포켓몬 검색...">
          <div class="combobox-options"></div>
        </div>
        <div class="matchup-slot-types">
          ${p ? p.types.map(t => `<span class="type-pill t-${t}" style="font-size:9px;padding:1px 5px;">${TYPE_KO[t]}</span>`).join('') : ''}
        </div>
        ${p ? `<button class="matchup-slot-clear" data-slot="${i}" title="비우기">✕</button>` : ''}
      </div>
    `;
  }).join('');
  wireMatchupSlots();
}

function wireMatchupSlots() {
  const container = document.getElementById('matchupSlots');
  if (!container) return;
  container.querySelectorAll('.matchup-cb-input').forEach(input => {
    const slot = parseInt(input.dataset.slot, 10);
    const cbParent = input.closest('.combobox');
    const optsEl = cbParent.querySelector('.combobox-options');

    const showOptions = (query) => {
      const s = (query || '').toLowerCase();
      const matches = sortPokemonForCalcSelect(POKEMON).filter(p =>
        (p.koName || '').toLowerCase().includes(s) || p.name.toLowerCase().includes(s)
      );
      optsEl.innerHTML = matches.map(p =>
        `<div class="combobox-option matchup-option" data-id="${p.id}">
          <b>${escapeHTML(pkName(p))}</b>
          <small class="matchup-option-types">${p.types.map(t => `<span class="type-pill t-${t}">${TYPE_KO[t] || t}</span>`).join('')}</small>
        </div>`
      ).join('');
      optsEl.classList.add('open');
      requestAnimationFrame(() => {
        const rect = optsEl.getBoundingClientRect();
        const sw = window.innerWidth;
        if (rect.right > sw - 8) { optsEl.style.left = 'auto'; optsEl.style.right = '0'; }
        else { optsEl.style.left = ''; optsEl.style.right = ''; }
      });
    };

    input.addEventListener('focus', e => showOptions(e.target.value));
    input.addEventListener('input', e => showOptions(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));

    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      matchupSlots[slot] = opt.dataset.id;
      renderMatchupSlots();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    });
  });
  container.querySelectorAll('.matchup-slot-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot, 10);
      matchupSlots[slot] = null;
      matchupCoverageMoves[slot] = [null, null, null, null];
      renderMatchupSlots();
      renderMatchupCoverageInputs();
      renderMatchupTable();
    });
  });
}

function coverageMovePool(slot) {
  const p = matchupSlots[slot] ? PokemonById[matchupSlots[slot]] : null;
  const pool = p?.ls?.length ? p.ls.map(id => MoveById[id]).filter(Boolean) : MOVES;
  return pool.filter(m => m.cat !== 'Status' && m.type && BATTLE_TYPES.includes(m.type));
}

function renderMatchupCoverageInputs() {
  const container = document.getElementById('matchupCoverageInputs');
  if (!container) return;
  if (matchupMode !== 'coverage') {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = matchupSlots.map((id, slot) => {
    const p = id ? PokemonById[id] : null;
    const title = p ? pkName(p) : `슬롯 ${slot + 1}`;
    const rows = matchupCoverageMoves[slot].map((moveId, moveIndex) => {
      const m = moveId ? MoveById[moveId] : null;
      return `
        <div class="matchup-move-field">
          <span class="matchup-move-num">${moveIndex + 1}</span>
          <div class="combobox matchup-move-combobox">
            <input type="text" class="cb-input matchup-move-input" data-slot="${slot}" data-move-index="${moveIndex}"
                   value="${m ? escapeHTML(mvName(m)) : ''}" placeholder="기술 검색">
            <div class="combobox-options"></div>
          </div>
          ${m ? `<span class="type-pill t-${m.type}" style="font-size:9px;padding:1px 5px;">${TYPE_KO[m.type] || m.type}</span>` : ''}
        </div>
      `;
    }).join('');
    return `
      <div class="matchup-coverage-card ${p ? 'filled' : ''}">
        <div class="matchup-coverage-head">
          <span>${escapeHTML(title)}</span>
          ${p ? p.types.map(t => `<span class="type-pill t-${t}" style="font-size:9px;padding:1px 5px;">${TYPE_KO[t] || t}</span>`).join('') : ''}
        </div>
        <div class="matchup-move-grid">${rows}</div>
      </div>
    `;
  }).join('');
  wireMatchupCoverageInputs();
}

function wireMatchupCoverageInputs() {
  const container = document.getElementById('matchupCoverageInputs');
  if (!container) return;
  container.querySelectorAll('.matchup-move-input').forEach(input => {
    const slot = parseInt(input.dataset.slot, 10);
    const moveIndex = parseInt(input.dataset.moveIndex, 10);
    const cbParent = input.closest('.combobox');
    const optsEl = cbParent.querySelector('.combobox-options');
    const showOptions = (query) => {
      const s = (query || '').toLowerCase();
      const matches = coverageMovePool(slot).filter(m =>
        (m.koName || '').toLowerCase().includes(s) ||
        m.name.toLowerCase().includes(s) ||
        (TYPE_KO[m.type] || '').toLowerCase().includes(s) ||
        m.type.toLowerCase().includes(s)
      ).slice(0, 80);
      optsEl.innerHTML = matches.map(m =>
        `<div class="combobox-option" data-id="${m.id}">
          <b>${escapeHTML(mvName(m))}</b>
          <small>${m.type} · ${moveCategoryLabel(m.cat)} · ${m.bp || '-'}</small>
        </div>`
      ).join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOptions(e.target.value));
    input.addEventListener('input', e => {
      if (!e.target.value.trim()) {
        matchupCoverageMoves[slot][moveIndex] = null;
        renderMatchupTable();
      }
      showOptions(e.target.value);
    });
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      matchupCoverageMoves[slot][moveIndex] = opt.dataset.id;
      renderMatchupCoverageInputs();
      renderMatchupTable();
    });
  });
}

function renderMatchupSideGroup(label, cls, rows, renderRow) {
  if (!rows.length) return '';
  return `
    <div class="matchup-side-section ${cls}">
      <div class="matchup-side-section-title ${cls}">${label}</div>
      ${rows.map(renderRow).join('')}
    </div>
  `;
}

function renderMatchupMeta(kind, context = {}) {
  const box = document.getElementById('matchupMeta');
  if (!box) return;
  if (kind === 'defensiveThreats') {
    const pokes = context.pokes || [];
    if (pokes.length < 3) {
      box.innerHTML = '<div class="matchup-side-title">주의 포켓몬</div><div class="matchup-side-empty">3마리 이상 선택하면 메타 위협의 타입별 위험도를 표시합니다.</div>';
      return;
    }
    const rows = matchupMetaPokemon('defensiveThreats').map(p => {
      const profiles = (p.types || []).map(type => defenseTypeProfile(type, pokes));
      const visibleProfiles = profiles.filter(profile => profile.grade.cls === 'danger' || profile.grade.cls === 'caution' || profile.grade.cls === 'max');
      const maxScore = Math.max(...visibleProfiles.map(s => s.score), 0);
      const maxRank = Math.max(...visibleProfiles.map(s => THREAT_RANK[s.grade.cls] || 0), 0);
      const maxGrade = visibleProfiles.find(s => (THREAT_RANK[s.grade.cls] || 0) === maxRank)?.grade || { label: '안전', cls: 'safe' };
      return { p, profiles: visibleProfiles, maxScore, maxRank, maxGrade };
    }).filter(row => row.profiles.length)
      .sort((a, b) => b.maxRank - a.maxRank || b.maxScore - a.maxScore || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
    const dangerRows = rows.filter(row => row.maxGrade.cls === 'danger' || row.maxGrade.cls === 'max');
    const cautionRows = rows.filter(row => row.maxGrade.cls === 'caution');
    const renderDefenseRow = row => `
      <div class="matchup-side-card ${row.maxGrade.cls}">
        <div class="matchup-side-name">${escapeHTML(pkName(row.p))}</div>
        <div class="matchup-side-badges">
          ${row.profiles.map(s => `<span class="matchup-score-badge ${s.grade.cls}" title="${s.grade.label} · 약점 ${s.weakCount} · 반감 ${s.resistCount} · 1/4 ${s.quarterCount} · 무효 ${s.immuneCount}"><span class="type-pill t-${s.type}">${TYPE_KO[s.type] || s.type}</span>${formatDefenseScore(s.score)}</span>`).join('')}
        </div>
      </div>
    `;
    const sections = [
      renderMatchupSideGroup('위험', 'danger', dangerRows, renderDefenseRow),
      renderMatchupSideGroup('주의', 'caution', cautionRows, renderDefenseRow),
    ].join('');
    box.innerHTML = `
      <div class="matchup-side-title">주의 포켓몬</div>
      <div class="matchup-side-list">
        ${sections || '<div class="matchup-side-empty">현재 선택 기준으로 위험/주의 메타 포켓몬이 없습니다.</div>'}
      </div>
    `;
    return;
  }
  const coverageMoves = selectedCoverageMoves();
  if (coverageMoves.length === 0) {
    box.innerHTML = '<div class="matchup-side-title">메타 타점</div><div class="matchup-side-empty">타점 체크에서 기술을 입력하면 메타 포켓몬의 4배/2배 약점 커버를 표시합니다.</div>';
    return;
  }
  const rows = matchupMetaPokemon('coverageChecks').map(p => {
    const weaknesses = BATTLE_TYPES.map(type => {
      const eff = typeEff(type, p.types);
      if (eff <= 1) return null;
      const count = coverageCountByType(type);
      return { type, eff, count };
    }).filter(Boolean);
    const quadWeaknesses = weaknesses.filter(w => w.eff >= 4);
    const doubleWeaknesses = weaknesses.filter(w => w.eff === 2);
    const missing4 = quadWeaknesses.filter(w => w.count === 0);
    const has4x = quadWeaknesses.length > 0;
    const quadCovered = quadWeaknesses.some(w => w.count > 0);
    const alt2Count = coverageSlotCountForTypes(doubleWeaknesses.map(w => w.type));
    const grade = coverageThreatGrade(has4x, quadCovered, alt2Count);
    return { p, weaknesses, quadWeaknesses, doubleWeaknesses, missing4, has4x, quadCovered, alt2Count, grade };
  }).filter(row => row.grade.cls !== 'safe');
  const dangerRows = rows
    .filter(row => row.grade.cls === 'danger')
    .sort((a, b) => b.missing4.length - a.missing4.length || a.alt2Count - b.alt2Count || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
  const cautionRows = rows
    .filter(row => row.grade.cls === 'caution')
    .sort((a, b) => b.missing4.length - a.missing4.length || a.alt2Count - b.alt2Count || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
  const checkRows = rows
    .filter(row => row.grade.cls === 'check')
    .sort((a, b) => b.missing4.length - a.missing4.length || a.alt2Count - b.alt2Count || pkName(a.p).localeCompare(pkName(b.p), 'ko'));
  const renderCoverageRow = row => {
    const shownWeaknesses = row.missing4.length ? [...row.missing4, ...row.doubleWeaknesses] : row.doubleWeaknesses;
    const weakBadges = shownWeaknesses.map(w =>
      `<span class="matchup-weak-badge ${w.count ? 'covered' : 'missing'} x${w.eff}"><span class="type-pill t-${w.type}">${TYPE_KO[w.type] || w.type}</span>${w.count}</span>`
    ).join('');
    return `
    <div class="matchup-side-card ${row.grade.cls} matchup-coverage-threat-card">
      <div class="matchup-side-name">${escapeHTML(pkName(row.p))}</div>
      <div class="matchup-coverage-threat-body">
        <div class="matchup-side-badges matchup-weakness-list">${weakBadges}</div>
        <span class="matchup-cover-count ${row.grade.cls}"><span>${row.has4x ? '2배대체' : '2배타점'}</span><b>${row.alt2Count}</b></span>
      </div>
    </div>
  `;
  };
  const sections = [
    renderMatchupSideGroup('위험', 'danger', dangerRows, renderCoverageRow),
    renderMatchupSideGroup('주의', 'caution', cautionRows, renderCoverageRow),
    renderMatchupSideGroup('견제', 'check', checkRows, renderCoverageRow),
  ].join('');
  box.innerHTML = `
    <div class="matchup-side-title">메타 타점</div>
    <div class="matchup-side-list">
      ${sections || '<div class="matchup-side-empty">현재 기술 기준으로 미커버 위험/주의/견제 메타 포켓몬이 없습니다.</div>'}
    </div>
  `;
}

function renderDefenseScoreCell(profile) {
  const scoreText = formatDefenseScore(profile.score);
  return `
    <td class="summary score ${profile.grade.cls}" title="${profile.grade.label} · 약점 ${profile.weakCount} · 반감 ${profile.resistCount} · 1/4 ${profile.quarterCount} · 무효 ${profile.immuneCount}">
      <div class="matchup-score-main">${scoreText}</div>
    </td>
  `;
}

function renderMatchupTable() {
  if (matchupMode === 'coverage') return renderCoverageMatchupTable();
  return renderDefenseMatchupTable();
}

function renderDefenseMatchupTable() {
  const tbl = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!tbl || !head || !body) return;

  const pokes = matchupSlots.map(id => id ? PokemonById[id] : null);
  const valid = pokes.filter(Boolean);
  renderMatchupMeta('defensiveThreats', { pokes: valid });

  // colgroup 으로 고정 열 너비 강제 (table-layout: fixed 와 함께)
  // 슬롯 채워지든 비어 있든 동일한 폭을 유지한다.
  const oldCG = tbl.querySelector('colgroup');
  if (oldCG) oldCG.remove();
  const cg = document.createElement('colgroup');
  cg.innerHTML =
    `<col style="width:${MATCHUP_COL.type}px">` +
    pokes.map(() => `<col style="width:${MATCHUP_COL.slot}px">`).join('') +
    `<col style="width:${MATCHUP_COL.score}px">`;
  tbl.insertBefore(cg, tbl.firstChild);

  // 헤더: 공격 타입 컬럼 + 6 슬롯 + 무효/약점 요약
  head.innerHTML = `
    <tr>
      <th style="text-align:left;">공격 타입</th>
      ${pokes.map((p, i) => `<th title="${p ? escapeHTML(pkName(p)) : ''}">${p ? escapeHTML(pkName(p)) : `<span style="color:var(--text-faint)">슬롯 ${i+1}</span>`}</th>`).join('')}
      <th class="summary">일관성</th>
    </tr>
  `;

  if (valid.length < 3) {
    body.innerHTML = `<tr><td colspan="${pokes.length + 2}" class="empty-state-cell">3마리 이상 선택하면 방어 상성 진단을 표시합니다.</td></tr>`;
    return;
  }

  // 본문: 18 행 × 6 셀 + 요약
  body.innerHTML = BATTLE_TYPES.map(t => {
    const cells = pokes.map(p => {
      if (!p) return `<td class="empty">—</td>`;
      const eff = typeEff(t, p.types);
      const sym = EFF_SYMBOL[eff] !== undefined ? EFF_SYMBOL[eff] : eff + '×';
      const cls = EFF_CLASS[eff] || '';
      return `<td class="${cls}">${sym}</td>`;
    }).join('');

    const profile = defenseTypeProfile(t, valid);

    return `
      <tr>
        <td><span class="type-pill t-${t}" style="font-size:11px;padding:2px 8px;">${TYPE_KO[t]}</span></td>
        ${cells}
        ${renderDefenseScoreCell(profile)}
      </tr>
    `;
  }).join('');
}
/* ════════════════════════════════════════════════════════════
   도감 상세 모달 — Cross-reference 인덱스 + 렌더러
   ════════════════════════════════════════════════════════════ */
// 특성 → 보유 포켓몬 인덱스 (한 번만 빌드)
function renderCoverageMatchupTable() {
  const tbl = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!tbl || !head || !body) return;
  renderMatchupMeta('coverageChecks');

  const pokes = matchupSlots.map(id => id ? PokemonById[id] : null);
  const valid = pokes.filter(Boolean);
  const oldCG = tbl.querySelector('colgroup');
  if (oldCG) oldCG.remove();
  const cg = document.createElement('colgroup');
  cg.innerHTML =
    `<col style="width:${MATCHUP_COL.type}px">` +
    pokes.map(() => `<col style="width:${MATCHUP_COL.slot}px">`).join('') +
    `<col style="width:${MATCHUP_COL.coverageSummary}px">`;
  tbl.insertBefore(cg, tbl.firstChild);

  head.innerHTML = `
    <tr>
      <th style="text-align:left;">공격 타입</th>
      ${pokes.map((p, i) => `<th title="${p ? escapeHTML(pkName(p)) : ''}">${p ? escapeHTML(pkName(p)) : `<span style="color:var(--text-faint)">슬롯 ${i+1}</span>`}</th>`).join('')}
      <th class="summary">커버</th>
    </tr>
  `;

  if (valid.length < 3) {
    body.innerHTML = `<tr><td colspan="${pokes.length + 2}" class="empty-state-cell">3마리 이상 선택하고 타점 체크에서 기술을 입력하면 진단을 표시합니다.</td></tr>`;
    return;
  }

  body.innerHTML = BATTLE_TYPES.map(t => {
    const cells = pokes.map((p, slot) => {
      if (!p) return '<td class="empty">-</td>';
      const count = coverageCountByType(t, slot);
      return `<td class="${count ? 'coverage-hit' : 'coverage-miss'}">${count || ''}</td>`;
    }).join('');
    const total = coverageCountByType(t);
    return `
      <tr>
        <td><span class="type-pill t-${t}" style="font-size:11px;padding:2px 8px;">${TYPE_KO[t]}</span></td>
        ${cells}
        <td class="summary ${total ? 'coverage-hit' : 'coverage-miss'}">${total || ''}</td>
      </tr>
    `;
  }).join('');
}

