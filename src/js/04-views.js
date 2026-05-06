/* ════════════════════════════════════════════════════════════
 * 04-views.js — 도감(렌더/필터/상세 모달·풀페이지/네비게이션) + 상성표 + 탭 전환
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
// 도감 탭 및 검색 제어
let currentDex = 'pokemon';
let dexTypeFilter = [];          // 빈 배열 = 전체. 포켓몬 탭은 최대 2개, 기술 탭은 최대 1개.
let dexItemCategory = null;      // 도구 탭의 카테고리 필터 (null = 전체, 'equip'/'berry'/'mega')
const BATTLE_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

function itemCategoryOf(it) {
  if (it.ms) return 'mega';
  if (it.isBerry) return 'berry';
  return 'equip';
}
const ITEM_CATEGORY_ORDER = ['equip', 'berry', 'mega'];
const ITEM_CATEGORY_LABEL = { equip: '장착형', berry: '열매', mega: '메가스톤' };

// 타입 필터 토글 — 포켓몬은 최대 2개 (FIFO), 기술은 단일.
function toggleTypeFilter(t) {
  if (currentDex === 'pokemon') {
    const i = dexTypeFilter.indexOf(t);
    if (i >= 0) dexTypeFilter.splice(i, 1);
    else if (dexTypeFilter.length < 2) dexTypeFilter.push(t);
    else { dexTypeFilter.shift(); dexTypeFilter.push(t); } // 가장 오래된 항목 교체
  } else if (currentDex === 'moves') {
    if (dexTypeFilter.includes(t)) dexTypeFilter = [];   // 같은 타입 다시 누르면 해제 → 전체
    else dexTypeFilter = [t];                              // 다른 타입은 단일 교체
  }
}

function renderTypeFilter() {
  const el = document.getElementById('dexTypeFilter');
  if (!el) return;
  if (currentDex === 'pokemon' || currentDex === 'moves') {
    el.style.display = 'flex';
    const isAll = dexTypeFilter.length === 0;
    const all = `<button class="type-filter-btn ${isAll ? 'active' : ''}" data-filter-type="">전체</button>`;
    const buttons = BATTLE_TYPES.map(t => {
      const active = dexTypeFilter.includes(t);
      return `<button class="type-filter-btn type-pill-mini ${active ? 'active t-' + t : ''}" data-filter-type="${t}" title="${TYPE_KO[t]}">${TYPE_KO[t]}</button>`;
    }).join('');
    const limit = currentDex === 'pokemon' ? '<span class="label" style="margin-left:auto;color:var(--text-faint);">최대 2개</span>' : '';
    el.innerHTML = `<span class="label">타입</span>${all}${buttons}${limit}`;
  } else if (currentDex === 'items') {
    el.style.display = 'flex';
    const isAll = dexItemCategory === null;
    const all = `<button class="type-filter-btn ${isAll ? 'active' : ''}" data-filter-itemcat="">전체</button>`;
    const buttons = ITEM_CATEGORY_ORDER.map(cat => {
      const active = dexItemCategory === cat;
      return `<button class="type-filter-btn ${active ? 'active' : ''}" data-filter-itemcat="${cat}">${ITEM_CATEGORY_LABEL[cat]}</button>`;
    }).join('');
    el.innerHTML = `<span class="label">분류</span>${all}${buttons}`;
  } else {
    el.style.display = 'none';
  }
}

document.getElementById('dexTypeFilter')?.addEventListener('click', e => {
  const typeBtn = e.target.closest('[data-filter-type]');
  if (typeBtn) {
    const t = typeBtn.dataset.filterType;
    if (t === '') dexTypeFilter = [];   // 전체 클릭 → 모두 해제
    else toggleTypeFilter(t);
    renderTypeFilter();
    renderDexContent(dexSearchEl?.value || '');
    return;
  }
  const catBtn = e.target.closest('[data-filter-itemcat]');
  if (catBtn) {
    const c = catBtn.dataset.filterItemcat;
    // 같은 카테고리를 다시 누르면 해제 (전체로 자동 복귀)
    if (c === '' || dexItemCategory === c) dexItemCategory = null;
    else dexItemCategory = c;
    renderTypeFilter();
    renderDexContent(dexSearchEl?.value || '');
    return;
  }
});

const dexSearchEl = document.getElementById('dexSearch');
if (dexSearchEl) {
  const handleDexSearch = debounce((query) => renderDexContent(query), 200);
  dexSearchEl.addEventListener('input', e => handleDexSearch(e.target.value));
}

document.querySelectorAll('.dex-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dex-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.dex-content').forEach(c => c.classList.remove('active'));
    document.getElementById('dex-' + tab.dataset.dex).classList.add('active');
    currentDex = tab.dataset.dex;
    dexTypeFilter = [];          // 탭 전환 시 필터 초기화
    dexItemCategory = null;
    closeDexFullPage();           // 탭 전환 시 풀페이지 상세 닫기
    renderTypeFilter();
    if(dexSearchEl) dexSearchEl.value = '';
    renderDexContent('');
  });
});

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + tab.dataset.page).classList.add('active');
  });
});

// 도감 렌더링 함수들
function renderDexContent(query = '') {
  const q = query.toLowerCase();
  if (currentDex === 'pokemon') renderPokemonDex(q);
  else if (currentDex === 'moves') renderMovesDex(q);
  else if (currentDex === 'abilities') renderAbilitiesDex(q);
  else if (currentDex === 'items') renderItemsDex(q);
}

function renderPokemonDex(query) {
  let data = [...POKEMON];
  if (query) data = data.filter(p => (p.koName||'').toLowerCase().includes(query) || p.name.toLowerCase().includes(query));
  // 멀티 타입: 선택된 타입을 모두 가져야(AND)
  if (dexTypeFilter.length > 0) data = data.filter(p => dexTypeFilter.every(t => p.types.includes(t)));
  const tbody = document.getElementById('dexBodyPokemon');
  if(!tbody) return;
  tbody.innerHTML = data.slice(0, 200).map(p => `<tr data-dex-id="${p.id}"><td>${p.mega ? '<span class="badge-mega" style="color:var(--tera);font-size:10px;">[메가]</span> ' : ''}${escapeHTML(p.koName || p.name)}</td><td>${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join(' ')}</td><td class="num">${p.bs.hp}</td><td class="num">${p.bs.atk}</td><td class="num">${p.bs.def}</td><td class="num">${p.bs.spa}</td><td class="num">${p.bs.spd}</td><td class="num">${p.bs.spe}</td><td class="num" style="font-weight:700; color:var(--warn);">${p.bst}</td><td class="dim" style="font-size:10px;">${Object.values(p.ab).join(', ')}</td></tr>`).join('');
}
function renderMovesDex(query) {
  let data = [...MOVES];
  if (query) data = data.filter(m => (m.koName||'').toLowerCase().includes(query) || m.name.toLowerCase().includes(query));
  if (dexTypeFilter.length > 0) data = data.filter(m => dexTypeFilter.includes(m.type));
  const tbody = document.getElementById('dexBodyMoves');
  if(!tbody) return;
  tbody.innerHTML = data.slice(0, 300).map(m => `<tr data-dex-id="${m.id}"><td>${escapeHTML(m.koName || m.name)}</td><td><span class="type-pill t-${m.type}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[m.type] || m.type}</span></td><td>${m.cat}</td><td class="num">${m.bp || '—'}</td><td class="num">${m.acc || '—'}</td><td class="num">${m.pp || '—'}</td><td class="num">${m.pri || 0}</td><td class="desc-cell">${escapeHTML(m.desc || '')}</td></tr>`).join('');
}
function renderAbilitiesDex(query) {
  let data = [...ABILITIES];
  if (query) data = data.filter(a => (a.koName||'').toLowerCase().includes(query) || a.name.toLowerCase().includes(query));
  const tbody = document.getElementById('dexBodyAbilities');
  if(!tbody) return;
  tbody.innerHTML = data.map(a => `<tr data-dex-id="${a.id}"><td>${escapeHTML(a.koName || a.name)}</td><td class="dim">${a.name}</td><td class="desc-cell">${escapeHTML(a.desc || '')}</td></tr>`).join('');
}
function renderItemsDex(query) {
  let data = [...ITEMS];
  if (query) data = data.filter(i => (i.koName||'').toLowerCase().includes(query) || i.name.toLowerCase().includes(query));
  if (dexItemCategory) data = data.filter(i => itemCategoryOf(i) === dexItemCategory);
  // 카테고리 → 이름 정렬 (장착형 → 열매 → 메가스톤)
  data.sort((a, b) => {
    const ca = ITEM_CATEGORY_ORDER.indexOf(itemCategoryOf(a));
    const cb = ITEM_CATEGORY_ORDER.indexOf(itemCategoryOf(b));
    if (ca !== cb) return ca - cb;
    return (a.koName || a.name).localeCompare(b.koName || b.name, 'ko');
  });
  const tbody = document.getElementById('dexBodyItems');
  if(!tbody) return;
  // 카테고리별 그룹 헤더가 있는 단일 테이블 — 행 사이에 헤더 row 삽입
  const rows = [];
  let lastCat = null;
  for (const i of data) {
    const cat = itemCategoryOf(i);
    if (cat !== lastCat) {
      rows.push(`<tr class="dex-cat-header"><td colspan="4" style="background:var(--bg-elev);font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--warn);letter-spacing:0.15em;padding:6px 10px;cursor:default;">▼ ${ITEM_CATEGORY_LABEL[cat]}</td></tr>`);
      lastCat = cat;
    }
    const tag = cat === 'mega' ? '<span style="color:var(--tera);font-size:10px;">메가스톤</span>'
      : cat === 'berry' ? '<span style="color:var(--ok);font-size:10px;">열매</span>'
      : (i.isChoice ? '<span style="color:var(--warn);font-size:10px;">고집계</span>'
        : i.isGem ? '<span style="color:var(--def);font-size:10px;">젬</span>'
        : '<span style="color:var(--text-faint);font-size:10px;">장착형</span>');
    rows.push(`<tr data-dex-id="${i.id}"><td>${escapeHTML(i.koName || i.name)}</td><td class="dim">${i.name}</td><td class="desc-cell">${escapeHTML(i.desc || '')}</td><td>${tag}</td></tr>`);
  }
  tbody.innerHTML = rows.join('');
}

/* ════════════════════════════════════════════════════════════
   상성표 (matchup) — 6슬롯 포켓몬 × 18 공격 타입
   ════════════════════════════════════════════════════════════ */
const matchupSlots = [null, null, null, null, null, null];

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
const MATCHUP_COL = { type: 110, slot: 90, summary: 56 };

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
      const matches = POKEMON.filter(p =>
        (p.koName || '').toLowerCase().includes(s) || p.name.toLowerCase().includes(s)
      ).slice(0, 30);
      optsEl.innerHTML = matches.map(p =>
        `<div class="combobox-option" data-id="${p.id}">
          <b>${escapeHTML(pkName(p))}</b>
          <small>${p.types.join(', ')} · BST ${p.bst}</small>
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
      renderMatchupTable();
    });
  });
  container.querySelectorAll('.matchup-slot-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot, 10);
      matchupSlots[slot] = null;
      renderMatchupSlots();
      renderMatchupTable();
    });
  });
}

function renderMatchupTable() {
  const tbl = document.getElementById('matchupTable');
  const head = document.getElementById('matchupHead');
  const body = document.getElementById('matchupBody');
  if (!tbl || !head || !body) return;

  const pokes = matchupSlots.map(id => id ? PokemonById[id] : null);

  // colgroup 으로 고정 열 너비 강제 (table-layout: fixed 와 함께)
  // 슬롯 채워지든 비어 있든 동일한 폭을 유지한다.
  const oldCG = tbl.querySelector('colgroup');
  if (oldCG) oldCG.remove();
  const cg = document.createElement('colgroup');
  cg.innerHTML =
    `<col style="width:${MATCHUP_COL.type}px">` +
    pokes.map(() => `<col style="width:${MATCHUP_COL.slot}px">`).join('') +
    `<col style="width:${MATCHUP_COL.summary}px"><col style="width:${MATCHUP_COL.summary}px">`;
  tbl.insertBefore(cg, tbl.firstChild);

  // 헤더: 공격 타입 컬럼 + 6 슬롯 + 무효/약점 요약
  head.innerHTML = `
    <tr>
      <th style="text-align:left;">공격 타입</th>
      ${pokes.map((p, i) => `<th title="${p ? escapeHTML(pkName(p)) : ''}">${p ? escapeHTML(pkName(p)) : `<span style="color:var(--text-faint)">슬롯 ${i+1}</span>`}</th>`).join('')}
      <th class="summary">무효</th>
      <th class="summary">약점</th>
    </tr>
  `;

  // 본문: 18 행 × 6 셀 + 요약
  body.innerHTML = BATTLE_TYPES.map(t => {
    const cells = pokes.map(p => {
      if (!p) return `<td class="empty">—</td>`;
      const eff = typeEff(t, p.types);
      const sym = EFF_SYMBOL[eff] !== undefined ? EFF_SYMBOL[eff] : eff + '×';
      const cls = EFF_CLASS[eff] || '';
      return `<td class="${cls}">${sym}</td>`;
    }).join('');

    const valid = pokes.filter(Boolean);
    const immuneCount = valid.filter(p => typeEff(t, p.types) === 0).length;
    const weakCount = valid.filter(p => typeEff(t, p.types) > 1).length;

    return `
      <tr>
        <td><span class="type-pill t-${t}" style="font-size:11px;padding:2px 8px;">${TYPE_KO[t]}</span></td>
        ${cells}
        <td class="summary immune">${immuneCount > 0 ? immuneCount : ''}</td>
        <td class="summary weak">${weakCount > 0 ? weakCount : ''}</td>
      </tr>
    `;
  }).join('');
}
/* ════════════════════════════════════════════════════════════
   도감 상세 모달 — Cross-reference 인덱스 + 렌더러
   ════════════════════════════════════════════════════════════ */
function abilityIdNorm(name) { return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// 특성 → 보유 포켓몬 인덱스 (한 번만 빌드)
const PokemonByAbility = (() => {
  const idx = {};
  for (const p of POKEMON) {
    for (const abName of Object.values(p.ab || {})) {
      const aId = abilityIdNorm(abName);
      if (!aId) continue;
      (idx[aId] = idx[aId] || []).push(p);
    }
  }
  return idx;
})();

// 기술 → 사용 가능 포켓몬 인덱스 (learnset 기반)
const PokemonByMove = (() => {
  const idx = {};
  for (const p of POKEMON) {
    if (!p.ls) continue;
    for (const moveId of p.ls) {
      (idx[moveId] = idx[moveId] || []).push(p);
    }
  }
  return idx;
})();

// 컨텍스트 — 풀페이지와 모달을 분리해서 추적 (적용 버튼이 어떤 항목을 가리키는지)
let dexFullPageCtx = { type: null, id: null };
let dexModalCtx = { type: null, id: null };

// 공통: 타입+id 로 표시용 컨텐츠 생성
function buildDexContent(type, id) {
  if (type === 'pokemon') {
    const p = PokemonById[id]; if (!p) return null;
    const [body, actions] = renderPokemonDetail(p);
    return { titleKo: pkName(p), titleEn: p.name, body, actions };
  } else if (type === 'move') {
    const m = MoveById[id]; if (!m) return null;
    const [body, actions] = renderMoveDetail(m);
    return { titleKo: mvName(m), titleEn: m.name, body, actions };
  } else if (type === 'ability') {
    const a = AbilityById[id]; if (!a) return null;
    const [body, actions] = renderAbilityDetail(a);
    return { titleKo: abName(a), titleEn: a.name, body, actions };
  } else if (type === 'item') {
    const it = ItemById[id]; if (!it) return null;
    const [body, actions] = renderItemDetail(it);
    return { titleKo: itName(it), titleEn: it.name, body, actions };
  }
  return null;
}

// 모달로 상세 열기 (도구 행 / 모든 cross-reference 클릭)
// parentCtx: 모달이 풀페이지 cross-reference 로 열린 경우, 부모(풀페이지)의 항목 정보.
// 적용 액션 시 부모 항목까지 함께 가져갈지 결정하는 데 사용된다.
function openDexDetail(type, id, parentCtx = null) {
  const modal = document.getElementById('dexDetailModal');
  if (!modal) return;
  const content = buildDexContent(type, id);
  if (!content) return;
  dexModalCtx = { type, id, parent: parentCtx };
  document.getElementById('dexDetailTitle').textContent = content.titleKo;
  document.getElementById('dexDetailTitleEn').textContent = content.titleEn !== content.titleKo ? `(${content.titleEn})` : '';
  document.getElementById('dexDetailBody').innerHTML = content.body;
  document.getElementById('dexDetailActions').innerHTML = content.actions;
  if (!modal.open) modal.showModal();
}

// 풀페이지로 상세 열기 (포켓몬/기술/특성 행 클릭)
function openDexDetailPage(type, id) {
  const content = buildDexContent(type, id);
  if (!content) return;
  dexFullPageCtx = { type, id };
  const container = document.getElementById('dexFullPageDetail');
  if (!container) return;
  container.innerHTML = `
    <button class="dex-fullpage-back" id="dexFullPageBack">← 목록으로</button>
    <div class="dex-fullpage-head">
      <span class="dex-fullpage-title">${escapeHTML(content.titleKo)}</span>
      ${content.titleEn !== content.titleKo ? `<span class="dex-fullpage-title-en">${escapeHTML(content.titleEn)}</span>` : ''}
    </div>
    <div class="dex-fullpage-body" id="dexFullPageBody">${content.body}</div>
    <div class="dex-fullpage-actions" id="dexFullPageActions">${content.actions}</div>
  `;
  document.querySelectorAll('.dex-content').forEach(c => c.classList.remove('active'));
  container.classList.add('active');
}

function closeDexFullPage() {
  const container = document.getElementById('dexFullPageDetail');
  if (!container) return;
  container.innerHTML = '';
  container.classList.remove('active');
  dexFullPageCtx = { type: null, id: null };
  // currentDex 의 원래 컨텐츠 다시 표시
  const target = document.getElementById('dex-' + currentDex);
  if (target) target.classList.add('active');
}

// 모달 → 풀페이지로 이동 (현재 모달 닫고, 필요 시 서브탭 전환 후 풀페이지 표시).
// 도구는 풀페이지가 없으므로 fallback 으로 모달을 새로 띄운다.
function navigateToDexDetailPage(type, id) {
  if (type === 'item') {
    // 도구는 풀페이지가 없으므로 그대로 모달로 (parent ctx 없이)
    closeDexDetail();
    openDexDetail(type, id);
    return;
  }
  closeDexDetail();
  // dex 탭 페이지로 강제 이동 (사용자가 계산기 탭에 있더라도)
  const dexNavTab = document.querySelector('.nav-tab[data-page="dex"]');
  if (dexNavTab && !dexNavTab.classList.contains('active')) dexNavTab.click();
  // 서브탭(포켓몬/기술/특성) 동기화
  const subTabMap = { pokemon: 'pokemon', move: 'moves', ability: 'abilities' };
  const wantSub = subTabMap[type];
  if (wantSub && wantSub !== currentDex) {
    const subTabBtn = document.querySelector(`.dex-tab[data-dex="${wantSub}"]`);
    if (subTabBtn) subTabBtn.click(); // 탭 클릭 핸들러가 currentDex / 필터 / 풀페이지 정리까지 수행
  }
  openDexDetailPage(type, id);
}

// 포켓몬 상세 — 모달 내 학습기 타입 필터 상태 (포켓몬 단위로 reset)
let pokemonDetailTypeFilter = null;

function renderPokemonDetail(p) {
  pokemonDetailTypeFilter = null; // 새 포켓몬 열 때마다 초기화
  const stats = ['hp','atk','def','spa','spd','spe'];
  const STAT_KO = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };
  const maxStat = Math.max(...stats.map(s => p.bs[s]));
  const statRows = stats.map(s => {
    const v = p.bs[s];
    const pct = Math.round(v / Math.max(maxStat, 200) * 100);
    return `<div class="stat-name">${STAT_KO[s]}</div><div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div><div class="stat-val">${v}</div>`;
  }).join('');
  const totalRow = `<div class="total"><div class="stat-name">합계</div></div><div></div><div class="total"><div class="stat-val">${p.bst}</div></div>`;

  // 특성 표시 (모든 슬롯을 동일하게 표기 — 0/1/H 구분 없음)
  const abEntries = Object.entries(p.ab || {}).map(([slot, abN]) => {
    const id = abilityIdNorm(abN);
    const data = AbilityById[id];
    const label = data ? `${abName(data)}${data.koName && data.name !== data.koName ? ` <small style="color:var(--text-faint)">${data.name}</small>` : ''}` : abN;
    return `<button class="dex-link" data-dex-link="ability" data-id="${id}">${label}</button>`;
  }).join('');

  // 방어 타입 매치업 (각 공격 타입에 대한 효과 배율)
  const matchupHtml = renderDefensiveMatchup(p.types);

  // 학습 가능 기술 — 타입별 그룹화
  const learnable = (p.ls || []).map(mid => MoveById[mid]).filter(Boolean);
  const learnsetHtml = renderLearnsetByType(learnable);

  const flags = [];
  if (p.mega) flags.push('<span style="color:var(--tera)">메가진화</span>');
  if (p.primal) flags.push('<span style="color:var(--warn)">원시회귀</span>');
  if (p.weightkg) flags.push(`무게: <b>${p.weightkg}</b>kg`);

  const body = `
    <div class="dex-modal-section">
      <div class="dex-modal-row">
        ${p.types.map(t => `<span class="type-pill t-${t}">${TYPE_KO[t] || t}</span>`).join('')}
        <span style="color:var(--text-dim);font-size:12px;">${flags.join(' · ')}</span>
      </div>
    </div>
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">종족값</div>
      <div class="dex-modal-stat-grid">${statRows}${totalRow}</div>
    </div>
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">특성</div>
      <div class="dex-modal-flag-row">${abEntries || '<span style="color:var(--text-faint)">없음</span>'}</div>
    </div>
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">방어 타입 상성</div>
      ${matchupHtml}
    </div>
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">학습 가능 기술 (${learnable.length})</div>
      <div id="learnsetWrap">${learnsetHtml}</div>
    </div>
    ${p.requiredItem ? `<div class="dex-modal-section"><div class="dex-modal-row"><span class="label">필요 도구</span><b>${escapeHTML(p.requiredItem)}</b></div></div>` : ''}
  `;

  const actions = `
    <button class="dex-modal-btn atk" data-dex-apply="pokemon-atk">⚔️ 공격측으로 가져가기</button>
    <button class="dex-modal-btn def" data-dex-apply="pokemon-def">🛡️ 방어측으로 가져가기</button>
  `;
  return [body, actions];
}

// 방어 타입 매치업 (18 타입 각각의 공격이 들어왔을 때 받는 배율)
function renderDefensiveMatchup(defTypes) {
  const buckets = { x4: [], x2: [], x05: [], x025: [], x0: [] };
  // 1× (보통 효과) 는 표시 생략 (시각적 노이즈 감소)
  for (const t of BATTLE_TYPES) {
    const eff = typeEff(t, defTypes);
    if (eff === 4) buckets.x4.push(t);
    else if (eff === 2) buckets.x2.push(t);
    else if (eff === 0.5) buckets.x05.push(t);
    else if (eff === 0.25) buckets.x025.push(t);
    else if (eff === 0) buckets.x0.push(t);
  }
  const row = (label, key, types) => types.length === 0 ? '' : `
    <div class="matchup-label ${key}">${label}</div>
    <div class="matchup-types">${types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:2px 7px;">${TYPE_KO[t]}</span>`).join('')}</div>
  `;
  const html = `
    ${row('×4', 'x4', buckets.x4)}
    ${row('×2', 'x2', buckets.x2)}
    ${row('×0.5', 'x05', buckets.x05)}
    ${row('×0.25', 'x025', buckets.x025)}
    ${row('무효', 'x0', buckets.x0)}
  `;
  if (!html.trim()) return '<div style="color:var(--text-faint);font-size:12px;">모든 타입 1배 (특이 상성 없음)</div>';
  return `<div class="matchup-grid">${html}</div>`;
}

// 학습 기술을 타입별로 그룹화 + 모달 내 타입 필터
function renderLearnsetByType(learnable) {
  if (learnable.length === 0) {
    return '<div style="color:var(--text-faint);font-size:12px;">학습 정보 없음</div>';
  }
  // 타입별 분류
  const byType = {};
  for (const m of learnable) {
    (byType[m.type] = byType[m.type] || []).push(m);
  }
  // 각 타입 내부 한글 가나다순
  for (const t of Object.keys(byType)) {
    byType[t].sort((a,b) => (a.koName||a.name).localeCompare(b.koName||b.name, 'ko'));
  }
  // 표시용 타입 순서 (배틀 타입 순)
  const presentTypes = BATTLE_TYPES.filter(t => byType[t]);

  // 필터 버튼 (이 포켓몬이 학습 가능한 타입만 표시)
  const filterButtons = `
    <div class="learnset-filter-row">
      <button class="type-filter-btn ${pokemonDetailTypeFilter === null ? 'active' : ''}" data-learnset-filter="">전체 (${learnable.length})</button>
      ${presentTypes.map(t => {
        const active = pokemonDetailTypeFilter === t;
        return `<button class="type-filter-btn type-pill-mini ${active ? 'active t-' + t : ''}" data-learnset-filter="${t}" title="${TYPE_KO[t]}">${TYPE_KO[t]} ${byType[t].length}</button>`;
      }).join('')}
    </div>
  `;

  // 그룹 렌더 — 필터 적용
  const showTypes = pokemonDetailTypeFilter ? presentTypes.filter(t => t === pokemonDetailTypeFilter) : presentTypes;
  const groups = showTypes.map(t => {
    const moves = byType[t];
    return `
      <div class="learnset-type-header">
        <span class="type-pill t-${t}" style="font-size:10px;padding:2px 7px;">${TYPE_KO[t]}</span>
        <span class="count">${moves.length}개</span>
      </div>
      <div class="dex-link-list" style="max-height:none;">
        ${moves.map(m => `<button class="dex-link" data-dex-link="move" data-id="${m.id}" title="${escapeHTML(m.cat)} ${m.bp || '—'}/${m.acc || '—'}">${escapeHTML(mvName(m))}</button>`).join('')}
      </div>
    `;
  }).join('');

  return filterButtons + groups;
}

// 기술 상세
function renderMoveDetail(m) {
  const flagLabels = {
    contact: '접촉', protect: '보호 가능', mirror: '미러 카피', sound: '소리', punch: '펀치', bite: '깨물기',
    pulse: '파동', slicing: '베기', bullet: '탄환', powder: '가루', dance: '춤', wind: '바람',
    snatch: '가로채기', heal: '회복', authentic: '실체화', defrost: '해동', gravity: '중력 무효',
    metronome: '메트로놈', mustpressure: '프레셔', failmimic: '미믹 실패', allyanim: '아군 애니',
    failencore: '앙코르 실패', bypasssub: '대타출동 무시', failinstruct: 'Instruct 실패', futuremove: '미래 기술',
    nonsky: '하늘 미사용', nosleeptalk: '잠꼬대 불가', failmefirst: '미퍼스트 실패', noassist: '어시스트 불가',
    failcopycat: '카피캣 실패',
  };
  const flagsHtml = Object.entries(m.flags || {}).filter(([_, v]) => v)
    .map(([k]) => `<span class="dex-modal-flag">${flagLabels[k] || k}</span>`).join(' ');
  // 다단히트
  let multihit = '';
  if (m.mh) multihit = Array.isArray(m.mh) ? `${m.mh[0]}~${m.mh[1]}타` : `${m.mh}타`;
  // 가변 BP 안내
  const VARIABLE_BP_NOTE = {
    gyroball: '느릴수록 위력 ↑', electroball: '빠를수록 위력 ↑',
    heatcrash: '무거울수록 위력 ↑', heavyslam: '무거울수록 위력 ↑',
    lowkick: '대상이 무거울수록', grassknot: '대상이 무거울수록',
    eruption: 'HP 비율에 비례', waterspout: 'HP 비율에 비례',
    flail: 'HP 적을수록', reversal: 'HP 적을수록', hardpress: '대상 HP 적을수록 ↓',
    hex: '상태이상 시 ×2', infernalparade: '상태이상 시 ×2',
    venoshock: '독 상태 시 ×2', facade: '화상/마비/독 시 ×2',
    knockoff: '도구 보유 시 ×1.5', boltbeak: '선공 시 ×2', fishiousrend: '선공 시 ×2',
    payback: '후공 시 ×2', avalanche: '피격 시 ×2', assurance: '대상 피격 시 ×2',
    risingvoltage: '일렉트릭필드 ×2', expandingforce: '사이코필드 ×1.5',
    mistyexplosion: '미스트필드 ×1.5', gravapple: '중력장 ×1.5',
    solarbeam: '쾌청 외 ×0.5', solarblade: '쾌청 외 ×0.5',
    weatherball: '날씨 → 타입+위력 변경', terrainpulse: '필드 → 타입+위력 변경',
    storedpower: '+부스트 단계당 +20', powertrip: '+부스트 단계당 +20',
    lastrespects: '쓰러진 동료당 +50', acrobatics: '도구 미보유 시 ×2',
    tripleaxel: '1/2/3타 BP 20/40/60', temperflare: '직전 실패 시 ×2',
    stompingtantrum: '직전 실패 시 ×2',
  };
  const variableNote = VARIABLE_BP_NOTE[m.id];

  // 사용 가능 포켓몬
  const users = (PokemonByMove[m.id] || []).slice().sort((a,b) => (a.koName||a.name).localeCompare(b.koName||b.name, 'ko'));
  const userList = users.length > 0
    ? `<div class="dex-link-list">${users.map(p => `<button class="dex-link" data-dex-link="pokemon" data-id="${p.id}">${escapeHTML(pkName(p))}</button>`).join('')}</div>`
    : '<div style="color:var(--text-faint);font-size:12px;">학습 가능 포켓몬 정보 없음</div>';

  const body = `
    <div class="dex-modal-section">
      <div class="dex-modal-row">
        <span class="type-pill t-${m.type}">${TYPE_KO[m.type] || m.type}</span>
        <span class="cat-badge ${m.cat === 'Physical' ? 'cat-phys' : m.cat === 'Special' ? 'cat-spec' : 'cat-stat'}">${m.cat === 'Physical' ? '물리' : m.cat === 'Special' ? '특수' : '변화'}</span>
        ${m.pri && m.pri !== 0 ? `<span style="color:var(--warn);font-family:'JetBrains Mono';font-size:11px;">우선도 ${m.pri > 0 ? '+' : ''}${m.pri}</span>` : ''}
      </div>
    </div>
    <div class="dex-modal-section">
      <div class="dex-modal-row"><span class="label">위력</span><b>${m.bp || '—'}</b>${variableNote ? `<span style="color:var(--warn);font-size:11px;">(${variableNote})</span>` : ''}</div>
      <div class="dex-modal-row"><span class="label">명중</span><b>${m.acc === 0 || m.acc === true ? '필중' : (m.acc || '—')}</b></div>
      <div class="dex-modal-row"><span class="label">PP</span><b>${m.pp || '—'}</b></div>
      ${multihit ? `<div class="dex-modal-row"><span class="label">다단히트</span><b>${multihit}</b></div>` : ''}
    </div>
    ${flagsHtml ? `<div class="dex-modal-section"><div class="dex-modal-section-title">플래그</div><div class="dex-modal-flag-row">${flagsHtml}</div></div>` : ''}
    ${(m.desc || m.descLong) ? `<div class="dex-modal-section"><div class="dex-modal-section-title">설명</div>${m.desc ? `<div style="font-size:13px;line-height:1.5;font-weight:600;">${escapeHTML(m.desc)}</div>` : ''}${m.descLong && m.descLong !== m.desc ? `<div style="font-size:12px;line-height:1.55;color:var(--text-dim);margin-top:6px;">${escapeHTML(m.descLong)}</div>` : ''}</div>` : ''}
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">사용 가능 포켓몬 (${users.length})</div>
      ${userList}
    </div>
  `;

  const actions = m.cat === 'Status'
    ? '<button class="dex-modal-btn" disabled>변화기는 데미지 계산 불가</button>'
    : `
      <span style="color:var(--text-dim);font-size:11px;align-self:center;margin-right:auto;">공격측 슬롯에 적용:</span>
      ${[1,2,3,4].map(i => `<button class="dex-modal-btn atk" data-dex-apply="move-${i-1}">슬롯 ${i}</button>`).join('')}
    `;
  return [body, actions];
}

// 특성 상세
function renderAbilityDetail(a) {
  const owners = (PokemonByAbility[a.id] || []).slice().sort((x,y) => (x.koName||x.name).localeCompare(y.koName||y.name, 'ko'));
  const ownerList = owners.length > 0
    ? `<div class="dex-link-list">${owners.map(p => `<button class="dex-link" data-dex-link="pokemon" data-id="${p.id}">${escapeHTML(pkName(p))}</button>`).join('')}</div>`
    : '<div style="color:var(--text-faint);font-size:12px;">보유 포켓몬 없음</div>';

  // 평가 (Pokemon Showdown rating: -1~5)
  const ratingHtml = (typeof a.rating === 'number')
    ? (() => {
        const r = a.rating;
        const label = r < 0 ? '해로움' : r === 0 ? '효과 없음' : r <= 1 ? '제한적' : r <= 2 ? '유용' : r <= 3 ? '효과적' : r <= 4 ? '매우 유용' : '필수급';
        const color = r < 0 ? '#ff4766' : r >= 4 ? 'var(--ok)' : r >= 3 ? 'var(--warn)' : 'var(--text-dim)';
        return `<div class="dex-modal-row"><span class="label">평가</span><b style="color:${color}">${r.toFixed(1)} / 5</b><span style="color:var(--text-dim);font-size:11px;">— ${label}</span></div>`;
      })()
    : '';

  // 긴 설명이 있으면 짧은 설명과 함께 표시
  const descBlock = (() => {
    if (!a.desc && !a.descLong) {
      return '<div style="color:var(--text-faint);font-size:12px;">설명 데이터 없음</div>';
    }
    let html = '';
    if (a.desc) html += `<div style="font-size:13px;line-height:1.5;font-weight:600;">${escapeHTML(a.desc)}</div>`;
    if (a.descLong && a.descLong !== a.desc) {
      html += `<div style="font-size:12px;line-height:1.55;color:var(--text-dim);margin-top:6px;">${escapeHTML(a.descLong)}</div>`;
    }
    return html;
  })();

  const body = `
    ${ratingHtml ? `<div class="dex-modal-section">${ratingHtml}</div>` : ''}
    <div class="dex-modal-section"><div class="dex-modal-section-title">설명</div>${descBlock}</div>
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">보유 포켓몬 (${owners.length})</div>
      ${ownerList}
    </div>
  `;
  // 현재 양측 포켓몬이 이 특성을 가질 수 있는지 체크
  const atkP = PokemonById[state.atk.pokemonIdx];
  const defP = PokemonById[state.def.pokemonIdx];
  const atkCanHave = atkP && Object.values(atkP.ab || {}).some(n => abilityIdNorm(n) === a.id);
  const defCanHave = defP && Object.values(defP.ab || {}).some(n => abilityIdNorm(n) === a.id);
  const actions = `
    <button class="dex-modal-btn atk" data-dex-apply="ability-atk" ${atkCanHave ? '' : 'disabled'} title="${atkCanHave ? '' : '현재 공격측 포켓몬이 이 특성을 가질 수 없음'}">⚔️ 공격측에 적용</button>
    <button class="dex-modal-btn def" data-dex-apply="ability-def" ${defCanHave ? '' : 'disabled'} title="${defCanHave ? '' : '현재 방어측 포켓몬이 이 특성을 가질 수 없음'}">🛡️ 방어측에 적용</button>
  `;
  return [body, actions];
}

// 도구 상세
function renderItemDetail(it) {
  // 카테고리 / 서브타입 배지
  const cat = itemCategoryOf(it);
  const subTags = [];
  if (cat === 'mega') subTags.push('<span class="dex-modal-flag" style="color:var(--tera);border-color:var(--tera);">메가스톤</span>');
  if (cat === 'berry') subTags.push('<span class="dex-modal-flag" style="color:var(--ok);border-color:var(--ok);">열매</span>');
  if (it.isChoice) subTags.push('<span class="dex-modal-flag" style="color:var(--warn);">고집계</span>');
  if (it.isGem) subTags.push('<span class="dex-modal-flag" style="color:var(--def);">젬</span>');
  if (it.isPrimalOrb) subTags.push('<span class="dex-modal-flag" style="color:var(--warn);">원시구슬</span>');
  if (cat === 'equip' && subTags.length === 0) subTags.push('<span class="dex-modal-flag">장착형</span>');

  let megaInfo = '';
  if (it.ms) {
    // ms = { "Charizard": "Charizard-Mega-X" } 형태
    const targets = Object.entries(it.ms);
    megaInfo = `
      <div class="dex-modal-section">
        <div class="dex-modal-section-title">메가스톤 — 변환 대상</div>
        <div class="dex-link-list">
          ${targets.map(([orig, mega]) => {
            const megaId = mega.toLowerCase().replace(/[^a-z0-9]/g, '');
            return PokemonById[megaId]
              ? `<button class="dex-link" data-dex-link="pokemon" data-id="${megaId}">${escapeHTML(orig)} → ${escapeHTML(mega)}</button>`
              : `<span class="dex-modal-flag">${escapeHTML(orig)} → ${escapeHTML(mega)}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 베리 자연의은혜 정보
  let berryInfo = '';
  if (it.isBerry && it.naturalGift) {
    berryInfo = `<div class="dex-modal-row"><span class="label">자연의은혜</span><span class="type-pill t-${it.naturalGift.type}" style="font-size:10px;padding:2px 7px;">${TYPE_KO[it.naturalGift.type] || it.naturalGift.type}</span> <b>${it.naturalGift.basePower || '—'}</b></div>`;
  }

  const descBlock = (() => {
    if (!it.desc && !it.descLong) {
      return '<div style="color:var(--text-faint);font-size:12px;">설명 데이터 없음</div>';
    }
    let html = '';
    if (it.desc) html += `<div style="font-size:13px;line-height:1.5;font-weight:600;">${escapeHTML(it.desc)}</div>`;
    if (it.descLong && it.descLong !== it.desc) {
      html += `<div style="font-size:12px;line-height:1.55;color:var(--text-dim);margin-top:6px;">${escapeHTML(it.descLong)}</div>`;
    }
    return html;
  })();

  const body = `
    <div class="dex-modal-section">
      <div class="dex-modal-flag-row">${subTags.join(' ')}</div>
    </div>
    <div class="dex-modal-section"><div class="dex-modal-section-title">설명</div>${descBlock}</div>
    ${berryInfo ? `<div class="dex-modal-section">${berryInfo}</div>` : ''}
    ${it.flingBp ? `<div class="dex-modal-section"><div class="dex-modal-row"><span class="label">던지기 위력</span><b>${it.flingBp}</b></div></div>` : ''}
    ${megaInfo}
    ${it.itemUser ? `<div class="dex-modal-section"><div class="dex-modal-row"><span class="label">전용</span>${it.itemUser.map(u => `<span class="dex-modal-flag">${escapeHTML(u)}</span>`).join(' ')}</div></div>` : ''}
  `;
  const actions = `
    <button class="dex-modal-btn atk" data-dex-apply="item-atk">⚔️ 공격측에 장착</button>
    <button class="dex-modal-btn def" data-dex-apply="item-def">🛡️ 방어측에 장착</button>
  `;
  return [body, actions];
}

// 헬퍼: 포켓몬을 한 사이드에 적용 (기본 특성 / 테라타입 자동 설정, atk 면 기존 기술 슬롯 초기화)
function applyPokemonToSide(pokemonId, sideKey) {
  const p = PokemonById[pokemonId]; if (!p) return false;
  state[sideKey].pokemonIdx = pokemonId;
  state[sideKey].ability = abilityIdNorm(p.ab['0'] || p.ab['H'] || '');
  state[sideKey].teraType = p.types[0];
  if (sideKey === 'atk') state[sideKey].moves = [];
  return true;
}

// 적용 액션 처리 — ctx 는 풀페이지/모달 어느 곳의 항목인지 명시.
// ctx.parent (풀페이지 → 모달로 열린 경우) 가 있으면 부모 항목도 함께 가져온다.
function applyDexAction(action, ctx) {
  const { type, id, parent } = ctx || {};
  if (!type || !id) return;
  let touched = false;
  const sidesTouched = new Set();

  if (action === 'pokemon-atk' || action === 'pokemon-def') {
    const sk = action === 'pokemon-atk' ? 'atk' : 'def';
    if (applyPokemonToSide(id, sk)) {
      sidesTouched.add(sk); touched = true;
      // 부모가 기술이고 공격측에 적용 중이면 → 기술도 슬롯 1 에 함께 배치
      // (수비측은 기술 의미 없으므로 공격측 한정 — 사용자 요청사항 #3)
      if (sk === 'atk' && parent && parent.type === 'move') {
        state.atk.moves[0] = parent.id;
      }
    }
  } else if (action.startsWith('move-')) {
    const slot = parseInt(action.split('-')[1], 10);
    state.atk.moves[slot] = id;
    sidesTouched.add('atk'); touched = true;
    // 부모가 포켓몬이면 → 공격측에도 포켓몬 함께 배치 (사용자 요청사항 #2)
    if (parent && parent.type === 'pokemon') {
      // 단, 이미 같은 포켓몬이면 기술 슬롯이 초기화되지 않도록 가드
      if (state.atk.pokemonIdx !== parent.id) {
        // applyPokemonToSide 가 atk.moves 를 비우니, 우리가 방금 넣은 슬롯 값을 보존해서 복원
        const savedMove = state.atk.moves[slot];
        applyPokemonToSide(parent.id, 'atk');
        state.atk.moves[slot] = savedMove;
      }
    }
  } else if (action === 'ability-atk' || action === 'ability-def') {
    const sk = action === 'ability-atk' ? 'atk' : 'def';
    state[sk].ability = id;
    sidesTouched.add(sk); touched = true;
  } else if (action === 'item-atk' || action === 'item-def') {
    const sk = action === 'item-atk' ? 'atk' : 'def';
    state[sk].item = id;
    sidesTouched.add(sk); touched = true;
  }

  if (touched) {
    sidesTouched.forEach(sk => renderSide(sk));
    triggerCalc();
    closeDexDetail();
    switchToCalcTab();
  }
}

function closeDexDetail() {
  const modal = document.getElementById('dexDetailModal');
  if (modal && modal.open) modal.close();
}

function switchToCalcTab() {
  const calcTab = document.querySelector('.nav-tab[data-page="calc"]');
  if (calcTab) calcTab.click();
}

// 도감 행 클릭 — 포켓몬/기술/특성은 풀페이지, 도구는 모달
document.querySelectorAll('.dex-content tbody').forEach(tbody => {
  tbody.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-dex-id]');
    if (!tr) return;
    const id = tr.dataset.dexId;
    const typeMap = { pokemon: 'pokemon', moves: 'move', abilities: 'ability', items: 'item' };
    const t = typeMap[currentDex];
    if (currentDex === 'items') openDexDetail(t, id);
    else openDexDetailPage(t, id);
  });
});

// 학습기 타입 필터 — 풀페이지/모달 어느 쪽이든 처리 (학습기 영역만 다시 그림)
function handleLearnsetFilterClick(e, scopeRoot, ctx) {
  const filterBtn = e.target.closest('[data-learnset-filter]');
  if (!filterBtn) return false;
  const t = filterBtn.dataset.learnsetFilter;
  pokemonDetailTypeFilter = t === '' ? null : t;
  const p = PokemonById[ctx.id];
  if (p) {
    const learnable = (p.ls || []).map(mid => MoveById[mid]).filter(Boolean);
    const wrap = scopeRoot.querySelector('#learnsetWrap');
    if (wrap) wrap.innerHTML = renderLearnsetByType(learnable);
  }
  return true;
}

// 모달 내부 — cross-link / 학습기 필터 / 적용 버튼
document.getElementById('dexDetailBody')?.addEventListener('click', e => {
  if (handleLearnsetFilterClick(e, document.getElementById('dexDetailBody'), dexModalCtx)) return;
  const link = e.target.closest('[data-dex-link]');
  if (!link) return;
  // 모달의 cross-reference 클릭 → 모달을 닫고 풀페이지 상세로 이동
  // (사용자 요청: 모달→모달이 아닌 모달→풀페이지)
  navigateToDexDetailPage(link.dataset.dexLink, link.dataset.id);
});
document.getElementById('dexDetailActions')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-dex-apply]');
  if (!btn || btn.disabled) return;
  applyDexAction(btn.dataset.dexApply, dexModalCtx);
});
document.getElementById('dexDetailClose')?.addEventListener('click', closeDexDetail);
document.getElementById('dexDetailModal')?.addEventListener('click', e => {
  if (e.target.id === 'dexDetailModal') closeDexDetail();
});

// 풀페이지 — 뒤로 가기 / cross-link / 학습기 필터 / 적용 버튼 (이벤트 위임)
document.getElementById('dexFullPageDetail')?.addEventListener('click', e => {
  if (e.target.closest('#dexFullPageBack')) { closeDexFullPage(); return; }
  if (handleLearnsetFilterClick(e, document.getElementById('dexFullPageDetail'), dexFullPageCtx)) return;
  const link = e.target.closest('[data-dex-link]');
  if (link) {
    // 풀페이지 내부 cross-reference 는 모달로 띄움 + 부모(풀페이지) 컨텍스트 전달
    openDexDetail(link.dataset.dexLink, link.dataset.id, { ...dexFullPageCtx });
    return;
  }
  const btn = e.target.closest('[data-dex-apply]');
  if (btn && !btn.disabled) {
    applyDexAction(btn.dataset.dexApply, dexFullPageCtx);
  }
});



/* ════════════════════════════════════════════════════════════
   세부조정 (Fine-tune) 탭
   ────────────────────────────────────────────────────────────
   목적: 노력치/성격/도구/특성 세팅 + HP 브레이크포인트 힌트 +
        매직넘버(+1pt → +2 점프) 표시 + 스피드 추월 EV 산출.
   계산기 탭과 양방향 sync (atk/def 어느 한쪽으로 적용 가능).
   ════════════════════════════════════════════════════════════ */

// 내 측은 makeSideState 와 같은 형태(전체 세팅 보유), 상대는 최소 정보만.
const fineTuneState = {
  my: makeSideState('incineroar'),
  opp: {
    pokemonIdx: PokemonById['amoonguss'] ? 'amoonguss' : (PokemonById['azumarill'] ? 'azumarill' : Object.keys(PokemonById)[0]),
    scarf: false,
    speRank: 0,  // 상대 스피드 랭크 (-6 ~ +6)
  },
  margin: 1,                 // 추월 +n
  weatherAbilityActive: false, // 내 쪽 SwiftSwim/Chlorophyll 등 발동 체크
};

// 스피드 부스트 특성 매핑 (체크박스 켤 때만 ×2)
const FT_SPEED_X2_ABILITIES = new Set(['swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'surgesurfer']);

// HP 브레이크포인트 힌트
function ftHpHints(side) {
  const hp = calcStats(side).hp;
  if (!hp) return [];
  const tags = [];
  if (hp % 16 === 1)  tags.push({ rule: '16n+1',  desc: '도트 대미지 +1턴 버팀',     color: 'var(--ok)' });
  if (hp % 16 === 15) tags.push({ rule: '16n-1',  desc: '도트 대미지 최소',          color: 'var(--text-dim)' });
  if (hp % 10 === 9)  tags.push({ rule: '10n-1',  desc: '생명의구슬 반동 최소',      color: 'var(--text-dim)' });
  if (hp % 8 === 1)   tags.push({ rule: '8n+1',   desc: '씨뿌리기 +1턴 버팀',        color: 'var(--ok)' });
  if (hp % 8 === 7)   tags.push({ rule: '8n-1',   desc: '씨뿌리기 최소',             color: 'var(--text-dim)' });
  if (hp % 4 === 1)   tags.push({ rule: '4n+1',   desc: '대타출동 +1회 가능',         color: 'var(--ok)' });
  // 스텔스록: 자기 포켓몬의 바위 약점 배율 기준
  const types = effectiveTypes(side);
  const rockEff = typeEff('Rock', types);
  if (rockEff === 2 && hp % 4 === 1) tags.push({ rule: '4n+1',  desc: '스텔스록(×2) +1턴 버팀',  color: 'var(--ok)' });
  if (rockEff === 4 && hp % 2 === 1) tags.push({ rule: '2n+1',  desc: '스텔스록(×4) +1턴 버팀',  color: 'var(--ok)' });
  return tags;
}

// 매직넘버 정보 (상승 성격 ×1.1 의 stat 만 의미 있음)
// 챔피언스 공식: raw_before = base + 20 + pt, final = floor(raw × 1.1)
// 매직 진입 pt: (base + 20 + pt) % 10 == 0
function ftMagicNumbers(side, stat) {
  if (stat === 'hp') return null;
  const nature = (typeof NATURE_BY_ID !== 'undefined') ? NATURE_BY_ID[side.nature] : null;
  if (!nature || nature.up !== stat) return null;     // 상승 stat 만
  const p = PokemonById[side.pokemonIdx];
  if (!p) return null;
  const base = p.bs[stat];
  // pt at which (base + 20 + pt) % 10 == 0 → pt % 10 == (-base - 20) % 10
  let firstMagic = (10 - (base + 20) % 10) % 10;
  if (firstMagic === 0) firstMagic = 10;  // pt=0 은 transition 아님
  const magicEvs = [];
  for (let m = firstMagic; m <= 32; m += 10) magicEvs.push(m);

  const cur = side.evs[stat] || 0;
  const next = magicEvs.find(m => m > cur) ?? null;
  const prev = [...magicEvs].reverse().find(m => m <= cur) ?? null;
  return { magicEvs, cur, next, prev };
}

// 한 측의 스피드 실수치 계산 (도구·특성 기반 자동 보정 포함)
function ftMySpeed(my) {
  const p = PokemonById[my.pokemonIdx];
  if (!p) return 0;
  const stats = calcStats(my);
  let s = applyBoost(stats.spe, my.ranks?.spe || 0);
  // 도구
  if (my.item === 'choicescarf') s = Math.floor(s * 1.5);
  if (my.item === 'ironball')    s = Math.floor(s * 0.5);
  // 특성 (체크박스로 발동 시에만)
  if (fineTuneState.weatherAbilityActive && FT_SPEED_X2_ABILITIES.has(my.ability)) s = Math.floor(s * 2);
  return s;
}

// 상대 한 케이스 스피드 (최속/준속/무보정)
function ftOppSpeedCase(opp, ev, natureMul) {
  const p = PokemonById[opp.pokemonIdx];
  if (!p) return 0;
  let raw = Math.floor((p.bs.spe + 20 + ev) * natureMul);
  raw = applyBoost(raw, opp.speRank || 0);
  if (opp.scarf) raw = Math.floor(raw * 1.5);
  return raw;
}

// 추월에 필요한 최소 EV 산출 (32 EV 로도 못 따라잡으면 null)
function ftFindMinSpeedEv(my, targetSpeed) {
  // my 의 spe EV 만 0..32 변동시키며 계산. 다른 stat 영향 없음.
  for (let ev = 0; ev <= 32; ev++) {
    const tmp = { ...my, evs: { ...my.evs, spe: ev } };
    if (ftMySpeed(tmp) >= targetSpeed) return ev;
  }
  return null;
}

// 스피드 비교 표 결과 빌드
function ftBuildSpeedTable() {
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);

  const cases = [
    { label: '최속',  ev: 32, natureMul: 1.1 },
    { label: '준속',  ev: 32, natureMul: 1.0 },
    { label: '무보정', ev: 0,  natureMul: 1.0 },
  ];

  return cases.map(c => {
    const oppSpe = ftOppSpeedCase(opp, c.ev, c.natureMul);
    const target = oppSpe + margin;
    const need = ftFindMinSpeedEv(my, target);
    return { ...c, oppSpe, target, need };
  });
}

// === UI 렌더링 ===

function renderFineTuneMy() {
  const container = document.getElementById('ft-my-body');
  if (!container) return;
  const my = fineTuneState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) {
    container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>';
    return;
  }
  const stats = calcStats(my);
  const totalEV = (typeof STATS !== 'undefined' ? STATS : ['hp','atk','def','spa','spd','spe']).reduce((a,s) => a + (my.evs[s]||0), 0);
  const overEV = totalEV > 66;

  // 특성 옵션
  const abOptions = Object.values(p.ab || {}).map(abN => {
    const id = abilityIdNorm(abN);
    const data = AbilityById[id];
    return data ? `<option value="${id}" ${my.ability === id ? 'selected' : ''}>${escapeHTML(abName(data))}</option>`
                : `<option value="${id}" ${my.ability === id ? 'selected' : ''}>${escapeHTML(abN)}</option>`;
  }).join('');

  // HP 힌트
  const hpHints = ftHpHints(my);
  const hpHintsHtml = hpHints.length > 0
    ? hpHints.map(t => `<span class="ft-tag" style="color:${t.color}; border-color:${t.color}; opacity:0.85;">${t.rule} · ${t.desc}</span>`).join(' ')
    : '<span style="color:var(--text-faint);font-size:11px;">매칭되는 브레이크포인트 없음</span>';

  // 스탯 그리드 — 각 stat 마다 매직넘버 정보 함께 표시
  const STAT_KO = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };
  const RANK_STATS = ['atk','def','spa','spd','spe'];
  const statRows = ['hp', ...RANK_STATS].map(s => {
    const ev = my.evs[s] || 0;
    const final = stats[s];
    const nature = NATURE_BY_ID?.[my.nature];
    const isUp = nature?.up === s;
    const isDown = nature?.down === s;
    const natureMark = isUp ? '<span style="color:#ff6b85;">▲</span>' : isDown ? '<span style="color:#7e9eff;">▼</span>' : '';
    const rank = my.ranks?.[s] || 0;
    const rankCtrl = s === 'hp' ? '' : `
      <div class="ft-rank">
        <button class="ft-rank-btn" data-ft-rank="${s}" data-ft-dir="-1">−</button>
        <span class="ft-rank-val ${rank > 0 ? 'pos' : rank < 0 ? 'neg' : ''}">${rank > 0 ? '+' + rank : rank}</span>
        <button class="ft-rank-btn" data-ft-rank="${s}" data-ft-dir="1">+</button>
      </div>
    `;
    // 매직넘버 (있을 때만)
    const magic = ftMagicNumbers(my, s);
    const magicHtml = magic ? `
      <div class="ft-magic">
        ${magic.prev !== null ? `<span class="ft-magic-prev">←${magic.prev}pt</span>` : '<span class="ft-magic-prev empty"></span>'}
        ${magic.next !== null ? `<span class="ft-magic-next">${magic.next}pt→</span>` : '<span class="ft-magic-next empty"></span>'}
      </div>
    ` : '<div class="ft-magic empty"></div>';
    return `
      <div class="ft-stat-row">
        <div class="ft-stat-name">${STAT_KO[s]} ${natureMark}</div>
        <div class="ft-stat-base">${p.bs[s]}</div>
        <div class="ft-stat-ev">
          <button class="ft-ev-quick" data-ft-evset="${s}" data-ft-evval="0" title="0">0</button>
          <input type="number" class="ft-ev-input" data-ft-ev="${s}" value="${ev}" min="0" max="32">
          <button class="ft-ev-quick" data-ft-evset="${s}" data-ft-evval="32" title="32">32</button>
        </div>
        <div class="ft-stat-final">${final}</div>
        ${rankCtrl}
        ${magicHtml}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="ft-poke-row">
      <div class="ft-pickname">
        <span class="ft-section-title">포켓몬</span>
        <div class="combobox" style="flex:1;">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="my" value="${escapeHTML(pkName(p))}" placeholder="검색...">
          <div class="combobox-options"></div>
        </div>
        <div class="types-display" style="margin-left:8px;">
          ${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join('')}
          ${p.mega ? '<span class="badge-mega" style="color:var(--tera);">[메가]</span>' : ''}
        </div>
      </div>
    </div>

    <div class="ft-controls-row">
      <label class="field"><span class="field-label">성격</span>
        <select data-ft-action="nature">
          ${(typeof NATURES !== 'undefined' ? NATURES : []).map(n => `<option value="${n.id}" ${my.nature === n.id ? 'selected' : ''}>${n.ko}${n.up ? ` (${({atk:'공',def:'방',spa:'특공',spd:'특방',spe:'속'})[n.up]}↑/${({atk:'공',def:'방',spa:'특공',spd:'특방',spe:'속'})[n.down]}↓)` : ''}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span class="field-label">특성</span>
        <select data-ft-action="ability">${abOptions}</select>
      </label>
      <label class="field"><span class="field-label">도구</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="item" value="${my.item ? escapeHTML(itName(ItemById[my.item] || { name: my.item })) : '없음'}" placeholder="도구 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      <label class="checkbox-label" title="SwiftSwim·Chlorophyll·SandRush·SlushRush·SurgeSurfer 의 발동 여부 (날씨/필드 자동 감지 X, 수동)">
        <input type="checkbox" id="ftWeatherAbility" ${fineTuneState.weatherAbilityActive ? 'checked' : ''}>
        ⚡ 속도 특성 발동
      </label>
    </div>

    <div class="ft-stats-grid">
      <div class="ft-stats-head">
        <div>스탯</div>
        <div>종족값</div>
        <div>노력치 (0-32)</div>
        <div>실수치</div>
        <div>랭크</div>
        <div>매직넘버</div>
      </div>
      ${statRows}
    </div>

    <div class="ft-ev-total ${overEV ? 'over' : ''}">
      노력치 합계: <b>${totalEV}</b> / 66 ${overEV ? '<span style="color:var(--atk);"> 초과!</span>' : ''}
    </div>

    <div class="ft-section-title">HP 브레이크포인트</div>
    <div class="ft-tag-row">${hpHintsHtml}</div>
  `;

  // 콤보박스 와이어링
  ftWireMyComboboxes();
}

function renderFineTuneOpp() {
  const container = document.getElementById('ft-opp-body');
  if (!container) return;
  const opp = fineTuneState.opp;
  const p = PokemonById[opp.pokemonIdx];

  container.innerHTML = `
    <div class="ft-poke-row">
      <div class="ft-pickname">
        <span class="ft-section-title">포켓몬</span>
        <div class="combobox" style="flex:1;">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="opp" value="${p ? escapeHTML(pkName(p)) : ''}" placeholder="검색...">
          <div class="combobox-options"></div>
        </div>
        ${p ? `<div class="types-display" style="margin-left:8px;">
          ${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join('')}
        </div>` : ''}
      </div>
    </div>
    <div class="ft-controls-row">
      <label class="checkbox-label">
        <input type="checkbox" id="ftOppScarf" ${opp.scarf ? 'checked' : ''}>
        💠 구애스카프
      </label>
      <label class="field"><span class="field-label">상대 속도 랭크</span>
        <div class="ft-rank">
          <button class="ft-rank-btn" data-ft-opprank="-1">−</button>
          <span class="ft-rank-val ${opp.speRank > 0 ? 'pos' : opp.speRank < 0 ? 'neg' : ''}">${opp.speRank > 0 ? '+' + opp.speRank : opp.speRank}</span>
          <button class="ft-rank-btn" data-ft-opprank="1">+</button>
        </div>
      </label>
    </div>
    <div class="ft-section-title">참고: 상대 스피드 실수치</div>
    <div class="ft-tag-row">
      ${(() => {
        if (!p) return '';
        const cases = [
          { label: '최속(N+/E32)', ev: 32, n: 1.1 },
          { label: '준속(N0/E32)', ev: 32, n: 1.0 },
          { label: '무보정(N0/E0)', ev: 0,  n: 1.0 },
        ];
        return cases.map(c => `<span class="ft-tag">${c.label}: <b>${ftOppSpeedCase(opp, c.ev, c.n)}</b></span>`).join(' ');
      })()}
    </div>
  `;
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
    container.innerHTML = '<div class="empty-state">양측 포켓몬 선택 필요</div>';
    return;
  }
  const rows = ftBuildSpeedTable();
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);

  // 내 측 추가 정보
  const myCurrentSpe = ftMySpeed(my);
  const myInfo = `
    <div class="ft-myspe-info">
      <span>내 현재 스피드 실수치: <b>${myCurrentSpe}</b></span>
      ${my.item === 'choicescarf' ? '<span class="ft-tag" style="color:var(--warn);">스카프 적용</span>' : ''}
      ${fineTuneState.weatherAbilityActive && FT_SPEED_X2_ABILITIES.has(my.ability) ? '<span class="ft-tag" style="color:var(--ok);">속도 특성 발동</span>' : ''}
      ${(my.ranks?.spe || 0) !== 0 ? `<span class="ft-tag">랭크 ${my.ranks.spe > 0 ? '+' : ''}${my.ranks.spe}</span>` : ''}
    </div>
  `;

  const cells = rows.map(r => {
    const cls = r.need === null ? 'ft-cell-impossible' : 'ft-cell-possible';
    const valHtml = r.need === null ? '<b>불가</b>' : `<b>${r.need}</b> EV`;
    return `<td class="${cls}" title="필요 스피드 ${r.target} 이상 (상대 ${r.oppSpe} + ${margin})">${valHtml}</td>`;
  }).join('');

  container.innerHTML = `
    ${myInfo}
    <div class="ft-speed-table-wrap">
      <table class="ft-speed-table">
        <thead>
          <tr>
            <th>구분</th>
            <th>최속<small>N+/E32</small></th>
            <th>준속<small>N0/E32</small></th>
            <th>무보정<small>N0/E0</small></th>
          </tr>
        </thead>
        <tbody>
          <tr><th>상대 실수치</th>${rows.map(r => `<td>${r.oppSpe}</td>`).join('')}</tr>
          <tr><th>+${margin} 추월 필요 EV</th>${cells}</tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderFineTuneAll() {
  renderFineTuneMy();
  renderFineTuneOpp();
  renderFineTuneSpeed();
}

// === 콤보박스 / 이벤트 ===

function ftWireMyComboboxes() {
  const container = document.getElementById('ft-my-body');
  container.querySelectorAll('.ft-cb-input').forEach(input => {
    const target = input.dataset.ftPick; // 'my' (포켓몬) | 'item'
    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOptions = (q) => {
      const s = (q || '').toLowerCase();
      const data = target === 'my' ? POKEMON : ITEMS;
      const matches = data.filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s)).slice(0, 30);
      const items = matches.map(m => {
        const label = target === 'my' ? pkName(m) : itName(m);
        const sub = target === 'my' ? `${m.types.join('/')} · BST ${m.bst}` : (m.desc || '').slice(0, 30);
        return `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(label)}</b> <small>${escapeHTML(sub)}</small></div>`;
      });
      if (target === 'item') items.unshift('<div class="combobox-option" data-id=""><b>없음</b></div>');
      optsEl.innerHTML = items.join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOptions(e.target.value));
    input.addEventListener('input', e => showOptions(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      const id = opt.dataset.id;
      if (target === 'my') {
        // 포켓몬 변경 시 ability/item/moves 초기화 (계산기와 동일 로직)
        const p = PokemonById[id];
        fineTuneState.my.pokemonIdx = id;
        if (p) {
          fineTuneState.my.ability = abilityIdNorm(p.ab['0'] || p.ab['H'] || '');
          fineTuneState.my.teraType = p.types[0];
        }
      } else {
        fineTuneState.my.item = id || '';
      }
      renderFineTuneAll();
    });
  });
}

function ftWireOppComboboxes() {
  const container = document.getElementById('ft-opp-body');
  container.querySelectorAll('.ft-cb-input').forEach(input => {
    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOptions = (q) => {
      const s = (q || '').toLowerCase();
      const matches = POKEMON.filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s)).slice(0, 30);
      optsEl.innerHTML = matches.map(m =>
        `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(pkName(m))}</b> <small>${m.types.join('/')} · BST ${m.bst}</small></div>`
      ).join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOptions(e.target.value));
    input.addEventListener('input', e => showOptions(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      fineTuneState.opp.pokemonIdx = opt.dataset.id;
      renderFineTuneAll();
    });
  });
}

// 위임된 입력 핸들러 (페이지 전체)
document.getElementById('page-finetune')?.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppScarf') { fineTuneState.opp.scarf = t.checked; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  if (t.id === 'ftWeatherAbility') { fineTuneState.weatherAbilityActive = t.checked; renderFineTuneSpeed(); return; }
  if (t.dataset.ftEv) {
    const stat = t.dataset.ftEv;
    fineTuneState.my.evs[stat] = Math.max(0, Math.min(32, parseInt(t.value, 10) || 0));
    renderFineTuneMy(); renderFineTuneSpeed();
    return;
  }
  if (t.dataset.ftAction === 'nature') { fineTuneState.my.nature = t.value; renderFineTuneMy(); renderFineTuneSpeed(); return; }
  if (t.dataset.ftAction === 'ability') { fineTuneState.my.ability = t.value; renderFineTuneSpeed(); return; }
});

document.getElementById('page-finetune')?.addEventListener('click', e => {
  const t = e.target;
  // EV quick set 버튼 (0/32)
  if (t.dataset.ftEvset !== undefined) {
    fineTuneState.my.evs[t.dataset.ftEvset] = parseInt(t.dataset.ftEvval, 10) || 0;
    renderFineTuneMy(); renderFineTuneSpeed();
    return;
  }
  // 내 측 랭크
  if (t.dataset.ftRank) {
    const stat = t.dataset.ftRank;
    const dir = parseInt(t.dataset.ftDir, 10);
    const cur = fineTuneState.my.ranks[stat] || 0;
    fineTuneState.my.ranks[stat] = Math.max(-6, Math.min(6, cur + dir));
    renderFineTuneMy(); renderFineTuneSpeed();
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
  state[targetSide] = JSON.parse(JSON.stringify(fineTuneState.my));
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

document.getElementById('ftApplyAtk')?.addEventListener('click', () => ftApplyToCalc('atk'));
document.getElementById('ftApplyDef')?.addEventListener('click', () => ftApplyToCalc('def'));

// 양방향 sync — 계산기 → 세부조정
// renderSide 가 만든 패널 헤더에 "🔧 세부조정" 버튼이 추가되어, 클릭 시 이 함수 호출.
function loadSideToFineTune(sideKey) {
  const src = state[sideKey];
  fineTuneState.my = JSON.parse(JSON.stringify(src));
  // 상대 자리는 계산기의 반대편 포켓몬으로
  const otherKey = sideKey === 'atk' ? 'def' : 'atk';
  fineTuneState.opp.pokemonIdx = state[otherKey].pokemonIdx;
  fineTuneState.opp.scarf = state[otherKey].item === 'choicescarf';
  fineTuneState.opp.speRank = state[otherKey].ranks?.spe || 0;
  // 세부조정 탭 이동
  const ftNav = document.querySelector('.nav-tab[data-page="finetune"]');
  if (ftNav) ftNav.click();
  renderFineTuneAll();
}
window.loadSideToFineTune = loadSideToFineTune; // 다른 모듈에서 호출 가능
