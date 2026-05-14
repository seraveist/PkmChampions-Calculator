/* ════════════════════════════════════════════════════════════
 * 04-views.js — 도감(렌더/필터/상세 모달·풀페이지/네비게이션) + 상성표 + 탭 전환
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
// 도감 탭 및 검색 제어
let currentDex = 'pokemon';
let dexTypeFilter = [];          // 빈 배열 = 전체. 포켓몬 탭은 최대 2개, 기술 탭은 최대 1개.
let dexItemCategory = null;      // 도구 탭의 카테고리 필터 (null = 전체, 'equip'/'berry'/'mega')
const DEX_TABS = ['pokemon', 'moves', 'abilities', 'items'];
const dexViewState = Object.fromEntries(DEX_TABS.map(tab => [tab, {
  query: '',
  typeFilter: [],
  itemCategory: null,
  scrollTop: 0,
  scrollLeft: 0,
}]));
const dexSortState = Object.fromEntries(DEX_TABS.map(tab => [tab, { key: null, dir: 'asc' }]));

const MOVE_CATEGORY_LABEL = { Physical: '물리', Special: '특수', Status: '변화' };
const FORM_LABEL_KO = {
  Alola: '알로라', Galar: '가라르', Hisui: '히스이', Paldea: '팔데아',
  Blade: '블레이드 폼', Shield: '실드 폼', Sunny: '태양의 모습', Rainy: '빗방울의 모습', Snowy: '설운의 모습',
  Busted: '들킨 모습', Hangry: '배고픈 모양', Hero: '마이티 폼',
  Mega: '메가', 'Mega-X': '메가 X', 'Mega-Y': '메가 Y', Primal: '원시',
};
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

function dexSearchText(value) {
  return String(value || '').toLowerCase();
}
function dexMatches(query, ...values) {
  if (!query) return true;
  return values.some(value => dexSearchText(value).includes(query));
}
function dexTypeTerms(types = []) {
  return types.flatMap(t => [t, TYPE_KO[t] || '']);
}
function moveCategoryLabel(cat) {
  return MOVE_CATEGORY_LABEL[cat] || cat || '';
}
function moveAccuracyLabel(move) {
  return move.acc === 0 || move.acc === true ? '필중' : (move.acc || '—');
}
function movePowerLabel(move) {
  if (VARIABLE_BP_NOTE[move.id] && (!move.bp || move.bp === 1)) return '가변';
  return move.bp || '—';
}
function pokemonFormLabel(p) {
  if (!p?.forme) return '';
  return FORM_LABEL_KO[p.forme] || p.forme;
}
function pokemonListName(p) {
  const name = pkName(p);
  const form = pokemonFormLabel(p);
  const hasVisibleForm = !form || name.includes('(') || name.includes(form) || (p.mega && name.includes('메가'));
  const formBadge = form && !hasVisibleForm ? ` <span class="dex-form-badge">${escapeHTML(form)}</span>` : '';
  return `${p.mega ? '<span class="badge-mega">[메가]</span> ' : ''}${escapeHTML(name)}${formBadge}`;
}

function itemCategoryOf(it) {
  if (it.ms) return 'mega';
  if (it.isBerry) return 'berry';
  return 'equip';
}
const ITEM_CATEGORY_ORDER = ['equip', 'berry', 'mega'];
const ITEM_CATEGORY_LABEL = { equip: '장착형', berry: '열매', mega: '메가스톤' };

function dexPokemonByLooseName(name) {
  return PokemonById[toId(name)];
}

function dexItemUserTerms(item) {
  return (item.itemUser || []).flatMap(user => {
    const p = dexPokemonByLooseName(user);
    return [user, p?.id, p?.name, p?.koName, p ? pkName(p) : ''];
  });
}

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

function dexTableWrap(tab = currentDex) {
  return document.querySelector(`#dex-${tab} .dex-table-wrap`);
}
function saveDexViewState(tab = currentDex) {
  const state = dexViewState[tab];
  if (!state) return;
  if (tab === currentDex) {
    state.query = dexSearchEl?.value || '';
    state.typeFilter = [...dexTypeFilter];
    state.itemCategory = dexItemCategory;
  }
  const wrap = dexTableWrap(tab);
  if (wrap) {
    state.scrollTop = wrap.scrollTop;
    state.scrollLeft = wrap.scrollLeft;
  }
}
function restoreDexViewState(tab = currentDex) {
  const state = dexViewState[tab] || dexViewState.pokemon;
  dexTypeFilter = [...(state.typeFilter || [])];
  dexItemCategory = state.itemCategory || null;
  if (dexSearchEl) dexSearchEl.value = state.query || '';
  renderTypeFilter();
  renderDexContent(state.query || '');
  restoreDexScroll(tab);
}
function restoreDexScroll(tab = currentDex) {
  const state = dexViewState[tab];
  if (!state) return;
  requestAnimationFrame(() => {
    const wrap = dexTableWrap(tab);
    if (!wrap) return;
    wrap.scrollTop = state.scrollTop || 0;
    wrap.scrollLeft = state.scrollLeft || 0;
  });
}
function updateDexSortIndicators(tab = currentDex) {
  const sort = dexSortState[tab] || {};
  document.querySelectorAll(`#dex-${tab} th.sortable`).forEach(th => {
    th.classList.toggle('sorted-asc', sort.key === th.dataset.sort && sort.dir === 'asc');
    th.classList.toggle('sorted-desc', sort.key === th.dataset.sort && sort.dir === 'desc');
  });
}
function updateDexCount(count, total) {
  const el = document.getElementById('dexCount');
  if (!el) return;
  const sort = dexSortState[currentDex];
  const sortText = sort?.key ? ` · 정렬 ${sort.dir === 'asc' ? '오름차순' : '내림차순'}` : '';
  el.textContent = count === total ? `${total}개${sortText}` : `${count}/${total}개${sortText}`;
}
function compareDexValues(a, b, dir) {
  const av = a ?? '';
  const bv = b ?? '';
  const result = (typeof av === 'number' && typeof bv === 'number')
    ? av - bv
    : String(av).localeCompare(String(bv), 'ko', { numeric: true, sensitivity: 'base' });
  return dir === 'desc' ? -result : result;
}
function dexSortValue(entry, tab, key) {
  if (!entry || !key) return '';
  if (tab === 'pokemon') {
    if (['hp','atk','def','spa','spd','spe'].includes(key)) return entry.bs?.[key] ?? 0;
    if (key === 'bst') return entry.bst ?? 0;
    if (key === 'koName') return pkName(entry);
  }
  if (tab === 'moves') {
    if (key === 'koName') return mvName(entry);
    if (key === 'bp') return entry.bp || 0;
    if (key === 'acc') return entry.acc === true ? 0 : (entry.acc || 0);
    if (key === 'pp') return entry.pp || 0;
    if (key === 'pri') return entry.pri || 0;
  }
  if (tab === 'abilities') {
    if (key === 'koName') return abName(entry);
  }
  if (tab === 'items') {
    if (key === 'koName') return itName(entry);
  }
  return entry[key] ?? '';
}
function applyDexSort(data, tab = currentDex) {
  const sort = dexSortState[tab];
  if (!sort?.key) return data;
  return data.sort((a, b) => {
    if (tab === 'items') {
      const ca = ITEM_CATEGORY_ORDER.indexOf(itemCategoryOf(a));
      const cb = ITEM_CATEGORY_ORDER.indexOf(itemCategoryOf(b));
      if (ca !== cb) return ca - cb;
    }
    const primary = compareDexValues(dexSortValue(a, tab, sort.key), dexSortValue(b, tab, sort.key), sort.dir);
    if (primary !== 0) return primary;
    return pkName(a).localeCompare(pkName(b), 'ko');
  });
}

document.getElementById('dexTypeFilter')?.addEventListener('click', e => {
  const typeBtn = e.target.closest('[data-filter-type]');
  if (typeBtn) {
    closeDexDetail();
    closeDexFullPage();
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
    saveDexViewState(currentDex);
    document.querySelectorAll('.dex-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.dex-content').forEach(c => c.classList.remove('active'));
    document.getElementById('dex-' + tab.dataset.dex).classList.add('active');
    currentDex = tab.dataset.dex;
    closeDexFullPage();           // 탭 전환 시 풀페이지 상세 닫기
    restoreDexViewState(currentDex);
  });
});

document.querySelectorAll('.dex-content .dex-table-wrap').forEach(wrap => {
  wrap.addEventListener('scroll', () => {
    const tab = wrap.closest('.dex-content')?.id?.replace('dex-', '');
    if (!tab || !dexViewState[tab]) return;
    dexViewState[tab].scrollTop = wrap.scrollTop;
    dexViewState[tab].scrollLeft = wrap.scrollLeft;
  });
});

document.querySelectorAll('.dex-table th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const tab = th.closest('.dex-content')?.id?.replace('dex-', '');
    if (!tab || !dexSortState[tab]) return;
    saveDexViewState(tab);
    const sort = dexSortState[tab];
    if (sort.key === th.dataset.sort) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    else {
      sort.key = th.dataset.sort;
      sort.dir = th.classList.contains('num') ? 'desc' : 'asc';
    }
    renderDexContent(dexSearchEl?.value || '');
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
  const q = dexSearchText(query).trim();
  if (dexViewState[currentDex]) {
    dexViewState[currentDex].query = query || '';
    dexViewState[currentDex].typeFilter = [...dexTypeFilter];
    dexViewState[currentDex].itemCategory = dexItemCategory;
  }
  if (currentDex === 'pokemon') renderPokemonDex(q);
  else if (currentDex === 'moves') renderMovesDex(q);
  else if (currentDex === 'abilities') renderAbilitiesDex(q);
  else if (currentDex === 'items') renderItemsDex(q);
  updateDexSortIndicators(currentDex);
}

function renderPokemonDex(query) {
  let data = [...POKEMON];
  if (query) data = data.filter(p => {
    const abilityTerms = Object.values(p.ab || {}).flatMap(abN => {
      const data = AbilityById[toId(abN)];
      return [abN, data?.koName, data?.name, data?.desc, data?.descLong];
    });
    return dexMatches(query, p.id, p.name, p.koName, p.base, p.forme, p.tier, ...dexTypeTerms(p.types), ...abilityTerms);
  });
  // 멀티 타입: 선택된 타입을 모두 가져야(AND)
  if (dexTypeFilter.length > 0) data = data.filter(p => dexTypeFilter.every(t => p.types.includes(t)));
  applyDexSort(data, 'pokemon');
  updateDexCount(data.length, POKEMON.length);
  const tbody = document.getElementById('dexBodyPokemon');
  if(!tbody) return;
  tbody.innerHTML = data.map(p => {
    // 특성 한글명 매핑 — toId 로 ID 변환 후 AbilityById lookup
    const abLabels = Object.values(p.ab || {}).map(abN => {
      const data = AbilityById[toId(abN)];
      return escapeHTML(data ? abName(data) : abN);
    }).join(', ');
    return `<tr data-dex-id="${p.id}"><td>${pokemonListName(p)}</td><td>${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join(' ')}</td><td class="num">${p.bs.hp}</td><td class="num">${p.bs.atk}</td><td class="num">${p.bs.def}</td><td class="num">${p.bs.spa}</td><td class="num">${p.bs.spd}</td><td class="num">${p.bs.spe}</td><td class="num" style="font-weight:700; color:var(--warn);">${p.bst}</td><td class="dim" style="font-size:10px;">${abLabels}</td></tr>`;
  }).join('');
}
function renderMovesDex(query) {
  let data = [...MOVES];
  if (query) data = data.filter(m => dexMatches(query, m.id, m.name, m.koName, m.desc, m.descLong, m.type, TYPE_KO[m.type], m.cat, moveCategoryLabel(m.cat), VARIABLE_BP_NOTE[m.id], Object.keys(m.flags || {}).join(' ')));
  if (dexTypeFilter.length > 0) data = data.filter(m => dexTypeFilter.includes(m.type));
  applyDexSort(data, 'moves');
  updateDexCount(data.length, MOVES.length);
  const tbody = document.getElementById('dexBodyMoves');
  if(!tbody) return;
  tbody.innerHTML = data.map(m => {
    const powerLabel = movePowerLabel(m);
    const variableBadge = VARIABLE_BP_NOTE[m.id] && powerLabel !== '가변' ? '<span class="dex-var-badge">가변</span>' : '';
    return `<tr data-dex-id="${m.id}"><td>${escapeHTML(mvName(m))}</td><td><span class="type-pill t-${m.type}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[m.type] || m.type}</span></td><td><span class="cat-badge ${m.cat === 'Physical' ? 'cat-phys' : m.cat === 'Special' ? 'cat-spec' : 'cat-stat'}">${moveCategoryLabel(m.cat)}</span></td><td class="num">${powerLabel}${variableBadge}</td><td class="num">${moveAccuracyLabel(m)}</td><td class="num">${m.pp || '—'}</td><td class="num">${m.pri || 0}</td><td class="desc-cell">${escapeHTML(m.desc || '')}</td></tr>`;
  }).join('');
}
function renderAbilitiesDex(query) {
  let data = [...ABILITIES];
  if (query) data = data.filter(a => dexMatches(query, a.id, a.name, a.koName, a.desc, a.descLong, ...(PokemonByAbility[a.id] || []).map(p => pkName(p))));
  applyDexSort(data, 'abilities');
  updateDexCount(data.length, ABILITIES.length);
  const tbody = document.getElementById('dexBodyAbilities');
  if(!tbody) return;
  tbody.innerHTML = data.map(a => `<tr data-dex-id="${a.id}"><td>${escapeHTML(abName(a))}</td><td class="dim">${escapeHTML(a.name)}</td><td class="desc-cell">${escapeHTML(a.desc || '')}</td></tr>`).join('');
}
function renderItemsDex(query) {
  let data = [...ITEMS];
  if (query) data = data.filter(i => dexMatches(query, i.id, i.name, i.koName, i.desc, i.descLong, ITEM_CATEGORY_LABEL[itemCategoryOf(i)], ...dexItemUserTerms(i)));
  if (dexItemCategory) data = data.filter(i => itemCategoryOf(i) === dexItemCategory);
  // 카테고리 → 이름 정렬 (장착형 → 열매 → 메가스톤)
  if (dexSortState.items.key) applyDexSort(data, 'items');
  else data.sort((a, b) => {
    const ca = ITEM_CATEGORY_ORDER.indexOf(itemCategoryOf(a));
    const cb = ITEM_CATEGORY_ORDER.indexOf(itemCategoryOf(b));
    if (ca !== cb) return ca - cb;
    return (a.koName || a.name).localeCompare(b.koName || b.name, 'ko');
  });
  updateDexCount(data.length, ITEMS.length);
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
    rows.push(`<tr data-dex-id="${i.id}"><td>${escapeHTML(itName(i))}</td><td class="dim">${escapeHTML(i.name)}</td><td class="desc-cell">${escapeHTML(i.desc || '')}</td><td>${tag}</td></tr>`);
  }
  tbody.innerHTML = rows.join('');
}

/* ════════════════════════════════════════════════════════════
   상성표 (matchup) — 6슬롯 포켓몬 × 18 공격 타입
   ════════════════════════════════════════════════════════════ */
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

function defensiveThreatsByStab(type) {
  return matchupMetaPokemon('defensiveThreats').filter(p => p.types?.includes(type));
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

function defenseTypeScore(type, pokes) {
  return defenseTypeProfile(type, pokes).score;
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

const PokemonByAbility = (() => {
  const idx = {};
  for (const p of POKEMON) {
    for (const abName of Object.values(p.ab || {})) {
      const aId = toId(abName);
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

const PokemonFormsByBase = (() => {
  const idx = {};
  for (const p of POKEMON) {
    const baseId = toId(p.base) || p.id;
    (idx[baseId] = idx[baseId] || []).push(p);
  }
  return idx;
})();

function relatedPokemonForms(p) {
  const baseId = toId(p.base) || p.id;
  return (PokemonFormsByBase[baseId] || []).filter(form => form.id !== p.id);
}

// 컨텍스트 — 풀페이지와 모달을 분리해서 추적 (적용 버튼이 어떤 항목을 가리키는지)
let dexFullPageCtx = { type: null, id: null };
let dexModalCtx = { type: null, id: null, parent: null };

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
  saveDexViewState(currentDex);
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
  restoreDexScroll(currentDex);
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
    const id = toId(abN);
    const data = AbilityById[id];
    const label = data
      ? `${escapeHTML(abName(data))}${data.koName && data.name !== data.koName ? ` <small style="color:var(--text-faint)">${escapeHTML(data.name)}</small>` : ''}`
      : escapeHTML(abN);
    return `<button class="dex-link" data-dex-link="ability" data-id="${id}">${label}</button>`;
  }).join('');

  // 방어 타입 매치업 (각 공격 타입에 대한 효과 배율)
  const matchupHtml = renderDefensiveMatchup(p.types);

  // 학습 가능 기술 — 타입별 그룹화
  const learnable = (p.ls || []).map(mid => MoveById[mid]).filter(Boolean);
  const learnsetHtml = renderLearnsetByType(learnable);

  const relatedForms = relatedPokemonForms(p);
  const relatedFormsHtml = relatedForms.length > 0 ? `
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">다른 폼</div>
      <div class="dex-link-list">
        ${relatedForms.map(form => `<button class="dex-link" data-dex-link="pokemon" data-id="${form.id}">${pokemonListName(form)}</button>`).join('')}
      </div>
    </div>
  ` : '';

  const flags = [];
  if (p.mega) flags.push('<span style="color:var(--tera)">메가진화</span>');
  if (p.primal) flags.push('<span style="color:var(--warn)">원시회귀</span>');
  if (p.forme && !p.mega && !p.primal) flags.push(`폼: <b>${escapeHTML(pokemonFormLabel(p))}</b>`);
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
    ${relatedFormsHtml}
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">방어 타입 상성</div>
      ${matchupHtml}
    </div>
    <div class="dex-modal-section">
      <div class="dex-modal-section-title">학습 가능 기술 (${learnable.length})</div>
      <div id="learnsetWrap">${learnsetHtml}</div>
    </div>
    ${p.requiredItem ? (() => {
      // requiredItem 은 영문명 ("Charizardite X" 등) — id 정규화 후 한글 매핑
      const reqId = toId(p.requiredItem);
      const reqData = ItemById[reqId];
      const label = reqData ? itName(reqData) : p.requiredItem;
      return `<div class="dex-modal-section"><div class="dex-modal-row"><span class="label">필요 도구</span><b>${escapeHTML(label)}</b>${reqData ? ` <small style="color:var(--text-faint);">${escapeHTML(reqData.name)}</small>` : ''}</div></div>`;
    })() : ''}
  `;

  const actions = `
    <button class="dex-modal-btn atk" data-dex-apply="pokemon-atk">⚔️ 공격측으로 가져가기</button>
    <button class="dex-modal-btn def" data-dex-apply="pokemon-def">🛡️ 방어측으로 가져가기</button>
  `;
  return [body, actions];
}

// 방어 타입 매치업 (18 타입 각각의 공격이 들어왔을 때 받는 배율)
function renderDefensiveMatchup(defTypes) {
  const buckets = { x4: [], x2: [], x1: [], x05: [], x025: [], x0: [] };
  for (const t of BATTLE_TYPES) {
    const eff = typeEff(t, defTypes);
    if (eff === 4) buckets.x4.push(t);
    else if (eff === 2) buckets.x2.push(t);
    else if (eff === 1) buckets.x1.push(t);
    else if (eff === 0.5) buckets.x05.push(t);
    else if (eff === 0.25) buckets.x025.push(t);
    else if (eff === 0) buckets.x0.push(t);
  }
  const row = (label, key, types) => types.length === 0 ? '' : `
    <div class="matchup-label ${key}">${label}</div>
    <div class="matchup-types">${types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:2px 7px;">${TYPE_KO[t]}</span>`).join('')}</div>
  `;
  const html = `
    ${row('4배', 'x4', buckets.x4)}
    ${row('2배', 'x2', buckets.x2)}
    ${row('1배', 'x1', buckets.x1)}
    ${row('1/2배', 'x05', buckets.x05)}
    ${row('1/4배', 'x025', buckets.x025)}
    ${row('무효', 'x0', buckets.x0)}
  `;
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
  const atkCanHave = atkP && Object.values(atkP.ab || {}).some(n => toId(n) === a.id);
  const defCanHave = defP && Object.values(defP.ab || {}).some(n => toId(n) === a.id);
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
    // ms = { "Charizard": "Charizard-Mega-X" } 형태 — 영문 포켓몬 이름. 한글 매핑 시도.
    const targets = Object.entries(it.ms);
    megaInfo = `
      <div class="dex-modal-section">
        <div class="dex-modal-section-title">메가스톤 — 변환 대상</div>
        <div class="dex-link-list">
          ${targets.map(([orig, mega]) => {
            const origId = toId(orig);
            const megaId = toId(mega);
            const origData = PokemonById[origId];
            const megaData = PokemonById[megaId];
            const origLabel = origData ? pkName(origData) : orig;
            const megaLabel = megaData ? pkName(megaData) : mega;
            return megaData
              ? `<button class="dex-link" data-dex-link="pokemon" data-id="${megaId}">${escapeHTML(origLabel)} → ${escapeHTML(megaLabel)}</button>`
              : `<span class="dex-modal-flag">${escapeHTML(origLabel)} → ${escapeHTML(megaLabel)}</span>`;
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
    ${it.itemUser ? `<div class="dex-modal-section"><div class="dex-modal-row"><span class="label">전용</span>${it.itemUser.map(u => {
      const ud = dexPokemonByLooseName(u);
      return ud
        ? `<button class="dex-link" data-dex-link="pokemon" data-id="${ud.id}">${escapeHTML(pkName(ud))}</button>`
        : `<span class="dex-modal-flag">${escapeHTML(u)}</span>`;
    }).join(' ')}</div></div>` : ''}
  `;
  const actions = `
    <button class="dex-modal-btn atk" data-dex-apply="item-atk">⚔️ 공격측에 장착</button>
    <button class="dex-modal-btn def" data-dex-apply="item-def">🛡️ 방어측에 장착</button>
  `;
  return [body, actions];
}

// 도감에서 계산기 사이드로 포켓몬 적용. 실제 상태 변경 규칙은 03-calc-ui.js의 공통 헬퍼에 위임한다.
function applyPokemonToSide(pokemonId, sideKey) {
  return !!applyPokemonToCalcSide(sideKey, pokemonId).applied;
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
  dexModalCtx = { type: null, id: null, parent: null };
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
    saveDexViewState(currentDex);
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
    manualSpeed: '',
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
  // 대타출동: 1/4 max HP 소모. 4n+1, 4n+2, 4n+3 모두 한 번 더 가능 (4n 보다)
  const hpMod4 = hp % 4;
  if (hpMod4 === 1) tags.push({ rule: '4n+1', desc: '대타출동 +1회 가능', color: 'var(--ok)' });
  if (hpMod4 === 2) tags.push({ rule: '4n+2', desc: '대타출동 +1회 가능', color: 'var(--ok)' });
  if (hpMod4 === 3) tags.push({ rule: '4n+3', desc: '대타출동 +1회 가능', color: 'var(--ok)' });
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
    const id = toId(abN);
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
    const rankCtrl = s === 'hp' ? '<div class="ft-rank-empty"></div>' : `
      <div class="ft-rank">
        <button class="ft-rank-btn" data-ft-rank="${s}" data-ft-dir="-1">−</button>
        <span class="ft-rank-val ${rank > 0 ? 'pos' : rank < 0 ? 'neg' : ''}">${rank > 0 ? '+' + rank : rank}</span>
        <button class="ft-rank-btn" data-ft-rank="${s}" data-ft-dir="1">+</button>
      </div>
    `;
    // 매직넘버 — 현재 EV 대비 상대값으로 표시 (-Npt / +Npt)
    const magic = ftMagicNumbers(my, s);
    const magicHtml = magic ? `
      <div class="ft-magic">
        ${magic.prev !== null ? `<span class="ft-magic-prev" title="이전 매직 위치: ${magic.prev}pt">-${ev - magic.prev}pt</span>` : '<span class="ft-magic-prev empty"></span>'}
        ${magic.next !== null ? `<span class="ft-magic-next" title="다음 매직 위치: ${magic.next}pt">+${magic.next - ev}pt</span>` : '<span class="ft-magic-next empty"></span>'}
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
      const data = target === 'my' ? sortPokemonForCalcSelect(POKEMON) : ITEMS;
      const allMatches = data.filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s));
      const matches = target === 'my' ? allMatches : allMatches.slice(0, 30);
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
          fineTuneState.my.ability = toId(p.ab['0'] || p.ab['H'] || '');
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
      const matches = sortPokemonForCalcSelect(POKEMON).filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s));
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
// Fine-tune logic v2: keep this tab aligned with the calculator engine.
function ftStatKeys() {
  return typeof STATS !== 'undefined' ? STATS : ['hp','atk','def','spa','spd','spe'];
}

function ftClampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ftClampEvValue(stat, requested, evs = fineTuneState.my.evs) {
  const wanted = ftClampInt(requested, 0, 32);
  const otherSum = ftStatKeys().reduce((a, key) => key === stat ? a : a + (evs[key] || 0), 0);
  return Math.min(wanted, Math.max(0, 66 - otherSum));
}

function ftSetEv(stat, requested) {
  if (!ftStatKeys().includes(stat)) return;
  fineTuneState.my.evs[stat] = ftClampEvValue(stat, requested, fineTuneState.my.evs);
}

function ftDefaultField() {
  return {
    weather: 'none',
    terrain: 'none',
    gameType: state?.field?.gameType || 'Singles',
    isCritical: false,
    isTrickRoom: false,
    isGravity: false,
  };
}

function ftAbilitySpeedActivation(abilityId) {
  const id = toId(abilityId || '');
  const map = {
    swiftswim: { label: '비/강한비 속도 특성', field: { weather: 'Rain' } },
    chlorophyll: { label: '쾌청 속도 특성', field: { weather: 'Sun' } },
    sandrush: { label: '모래바람 속도 특성', field: { weather: 'Sand' } },
    slushrush: { label: '눈 속도 특성', field: { weather: 'Snow' } },
    surgesurfer: { label: '일렉트릭필드 속도 특성', field: { terrain: 'Electric' } },
    unburden: { label: '곡예 발동', side: { unburdenActive: true } },
    quickfeet: { label: '속보 발동', side: { status: 'Paralysis' } },
  };
  return map[id] || null;
}

function ftSpeedFieldFor(side) {
  const field = ftDefaultField();
  const activation = fineTuneState.weatherAbilityActive ? ftAbilitySpeedActivation(side?.ability) : null;
  if (activation?.field) Object.assign(field, activation.field);
  return field;
}

function ftSpeedSideFor(side) {
  const out = JSON.parse(JSON.stringify(side || {}));
  const activation = fineTuneState.weatherAbilityActive ? ftAbilitySpeedActivation(out.ability) : null;
  if (activation?.side) Object.assign(out, activation.side);
  if (!out.ranks) out.ranks = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (!out.evs) out.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (typeof deriveHpFlags === 'function') deriveHpFlags(out);
  return out;
}

function ftMySpeedV2(my) {
  if (!PokemonById[my?.pokemonIdx]) return 0;
  return effectiveSpeed(ftSpeedSideFor(my), ftSpeedFieldFor(my));
}

function ftOpponentManualSpeed(opp = fineTuneState.opp) {
  const text = String(opp.manualSpeed ?? '').trim();
  if (!text) return null;
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(9999, n)) : null;
}

function ftNatureForSpeedCase(natureSpec) {
  if (typeof natureSpec === 'string') return natureSpec;
  return Number(natureSpec) > 1 ? 'jolly' : 'hardy';
}

function ftOpponentSideForCase(opp, ev, natureSpec) {
  const side = makeSideState(opp.pokemonIdx);
  side.evs.spe = ftClampInt(ev, 0, 32);
  side.nature = ftNatureForSpeedCase(natureSpec);
  side.item = opp.scarf ? 'choicescarf' : '';
  side.ranks.spe = opp.speRank || 0;
  return side;
}

function ftOppSpeedCaseV2(opp, ev, natureSpec, options = {}) {
  const manual = ftOpponentManualSpeed(opp);
  if (!options.ignoreManual && manual !== null) return manual;
  if (!PokemonById[opp?.pokemonIdx]) return 0;
  return effectiveSpeed(ftOpponentSideForCase(opp, ev, natureSpec), ftDefaultField());
}

function ftFindMinSpeedEvV2(my, targetSpeed) {
  const otherSum = ftStatKeys().reduce((a, key) => key === 'spe' ? a : a + (my.evs?.[key] || 0), 0);
  const maxSpeEv = Math.min(32, Math.max(0, 66 - otherSum));
  for (let ev = 0; ev <= maxSpeEv; ev++) {
    const tmp = { ...my, evs: { ...my.evs, spe: ev } };
    if (ftMySpeed(tmp) >= targetSpeed) return ev;
  }
  return null;
}

function ftSpeedCases() {
  const manual = ftOpponentManualSpeed();
  const cases = [
    { label: '최속', sub: 'N+/E32', ev: 32, nature: 'jolly' },
    { label: '준속', sub: 'N0/E32', ev: 32, nature: 'hardy' },
    { label: '무보정', sub: 'N0/E0', ev: 0, nature: 'hardy' },
  ];
  return manual === null ? cases : [{ label: '직접', sub: '입력값', manual: true }, ...cases];
}

function ftBuildSpeedTableV2() {
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);
  const manual = ftOpponentManualSpeed(opp);
  return ftSpeedCases().map(c => {
    const oppSpe = c.manual ? manual : ftOppSpeedCase(opp, c.ev, c.nature, { ignoreManual: true });
    const target = oppSpe + margin;
    const need = ftFindMinSpeedEv(my, target);
    return { ...c, oppSpe, target, need };
  });
}

function ftAbilityOptionsForCurrentPokemon() {
  const pokemon = PokemonById[fineTuneState.my.pokemonIdx];
  const abilities = Object.values(pokemon?.ab || {})
    .map(name => AbilityById[toId(name)] || { id: toId(name), name })
    .filter(a => a.id);
  if (fineTuneState.my.ability && !abilities.some(a => a.id === fineTuneState.my.ability)) {
    abilities.push(AbilityById[fineTuneState.my.ability] || { id: fineTuneState.my.ability, name: fineTuneState.my.ability });
  }
  return [{ id: '', label: '(없음)', sub: '특성 없음' }, ...abilities.map(a => ({ id: a.id, label: abName(a), sub: a.name || a.id }))];
}

function sortPokemonForFineTuneSelect(pokemon) {
  return pokemon.slice().sort((a, b) => {
    const speedDiff = (b.bs?.spe || 0) - (a.bs?.spe || 0);
    if (speedDiff !== 0) return speedDiff;
    return pkName(a).localeCompare(pkName(b), 'ko', { numeric: true, sensitivity: 'base' });
  });
}

function ftComboData(target) {
  if (target === 'my' || target === 'opp') {
    return sortPokemonForFineTuneSelect(POKEMON).map(p => ({ id: p.id, label: pkName(p), sub: `SPE ${p.bs?.spe || 0} · ${p.types.join('/')} · BST ${p.bst}`, raw: p }));
  }
  if (target === 'item') {
    return [{ id: '', label: '(없음)', sub: '' }, ...sortItemsForCalcSelect(ITEMS).map(i => ({ id: i.id, label: itName(i), sub: i.name || i.id, raw: i }))];
  }
  if (target === 'nature') {
    return NATURES.map(n => ({ id: n.id, label: calcNatureLabel(n), sub: n.up ? `${n.up}+ / ${n.down}-` : '보정 없음', raw: n }));
  }
  if (target === 'ability') return ftAbilityOptionsForCurrentPokemon();
  return [];
}

function ftComboLabel(target, id) {
  if (target === 'my' || target === 'opp') return pkName(PokemonById[id] || { name: '' });
  if (target === 'item') return id ? itName(ItemById[id] || { name: id }) : '(없음)';
  if (target === 'nature') return calcNatureLabel(NATURE_BY_ID[id]) || id;
  if (target === 'ability') return id ? abName(AbilityById[id] || { name: id }) : '(없음)';
  return id || '';
}

function ftSearchMatches(query, option) {
  const q = String(query || '').toLowerCase();
  if (!q) return true;
  return [option.id, option.label, option.sub, option.raw?.name, option.raw?.koName]
    .some(value => String(value || '').toLowerCase().includes(q));
}

function ftApplyPokemonToFineTune(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  if (!pokemon) return;
  const changed = fineTuneState.my.pokemonIdx !== pokemonId;
  fineTuneState.my.pokemonIdx = pokemonId;
  if (changed) {
    fineTuneState.my.ability = defaultPokemonAbilityId(pokemon);
    fineTuneState.my.types = defaultPokemonTypes(pokemon);
    fineTuneState.my.teraType = fineTuneState.my.types?.[0] || 'Normal';
    fineTuneState.my.tera = false;
    fineTuneState.my.item = defaultPokemonItemId(pokemon);
    fineTuneState.my.damageBlockActive = false;
    fineTuneState.my.boosterEnergyState = 'auto';
    fineTuneState.my.moves = [];
    fineTuneState.my.moveBpOverrides = [null, null, null, null];
  }
  if (!ftAbilitySpeedActivation(fineTuneState.my.ability)) fineTuneState.weatherAbilityActive = false;
}

function ftSelectCombo(target, id) {
  if (target === 'my') ftApplyPokemonToFineTune(id);
  if (target === 'opp' && PokemonById[id]) fineTuneState.opp.pokemonIdx = id;
  if (target === 'item') fineTuneState.my.item = id || '';
  if (target === 'nature') fineTuneState.my.nature = id || 'hardy';
  if (target === 'ability') {
    fineTuneState.my.ability = id || '';
    if (!ftAbilitySpeedActivation(fineTuneState.my.ability)) fineTuneState.weatherAbilityActive = false;
  }
}

function ftWireComboboxes(rootId) {
  const container = document.getElementById(rootId);
  if (!container) return;
  container.querySelectorAll('.ft-cb-input').forEach(input => {
    if (input.dataset.ftWired === '1') return;
    input.dataset.ftWired = '1';
    const target = input.dataset.ftPick;
    const cb = input.closest('.combobox');
    const optsEl = cb?.querySelector('.combobox-options');
    if (!optsEl) return;
    const showOptions = q => {
      const query = String(q || '').trim();
      const allMatches = ftComboData(target).filter(option => ftSearchMatches(query, option));
      const matches = query ? allMatches.slice(0, target === 'item' ? 50 : 80) : allMatches;
      optsEl.innerHTML = matches.length ? matches.map(option =>
        `<div class="combobox-option" data-id="${escapeHTML(option.id)}"><b>${escapeHTML(option.label)}</b>${option.sub ? ` <small>${escapeHTML(option.sub)}</small>` : ''}</div>`
      ).join('') : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', () => showOptions(''));
    input.addEventListener('click', () => showOptions(''));
    input.addEventListener('input', e => showOptions(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 180));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      ftSelectCombo(target, opt.dataset.id || '');
      renderFineTuneAll();
    });
  });
}

function ftWireMyComboboxesV2() { ftWireComboboxes('ft-my-body'); }
function ftWireOppComboboxesV2() { ftWireComboboxes('ft-opp-body'); }

function ftHpAtEv(side, ev) {
  const tmp = { ...side, evs: { ...side.evs, hp: ev } };
  return calcStats(tmp).hp;
}

function ftMultiplierLabel(value) {
  if (value === 0) return '무효';
  if (value === 0.25) return '1/4배';
  if (value === 0.5) return '1/2배';
  return `${value}배`;
}

function ftHpBreakpointRules(side) {
  const rules = [
    { id: 'dot-plus', rule: '16n+1', desc: '도트 대미지 +1턴', predicate: hp => hp % 16 === 1, relevant: true },
    { id: 'dot-min', rule: '16n-1', desc: '도트 대미지 최소', predicate: hp => hp % 16 === 15, relevant: true },
    { id: 'seed-plus', rule: '8n+1', desc: '씨뿌리기 +1턴', predicate: hp => hp % 8 === 1, relevant: true },
    { id: 'seed-min', rule: '8n-1', desc: '씨뿌리기 최소', predicate: hp => hp % 8 === 7, relevant: true },
    { id: 'sub', rule: '4n+1~3', desc: '대타출동 HP 잔여', predicate: hp => hp % 4 !== 0, relevant: true },
  ];
  if (ItemById.lifeorb) rules.push({ id: 'lifeorb', rule: '10n-1', desc: '생명의구슬 반동 최소', predicate: hp => hp % 10 === 9, relevant: side.item === 'lifeorb' });
  if (ItemById.leftovers) rules.push({ id: 'leftovers', rule: '16n', desc: '먹다남은음식 회복 극대', predicate: hp => hp % 16 === 0, relevant: side.item === 'leftovers' });
  if (ItemById.sitrusberry) rules.push({ id: 'sitrus', rule: '2n', desc: '자뭉열매 50% 기준', predicate: hp => hp % 2 === 0, relevant: side.item === 'sitrusberry' });
  if (AbilityById.poisonheal) rules.push({ id: 'poisonheal', rule: '8n', desc: '포이즌힐 회복 극대', predicate: hp => hp % 8 === 0, relevant: side.ability === 'poisonheal' });

  const rockEff = typeEff('Rock', effectiveTypes(side));
  if (rockEff > 0) {
    const denom = Math.max(1, Math.round(8 / rockEff));
    rules.push({
      id: `sr-${denom}`,
      rule: `${denom}n+1`,
      desc: `스텔스록 ${ftMultiplierLabel(rockEff)} +1턴`,
      predicate: hp => hp % denom === 1,
      relevant: true,
    });
  }

  if (isGrounded(side, ftDefaultField())) {
    [
      { layer: 1, denom: 8 },
      { layer: 2, denom: 6 },
      { layer: 3, denom: 4 },
    ].forEach(({ layer, denom }) => {
      rules.push({
        id: `spikes-${layer}`,
        rule: `${denom}n+1`,
        desc: `압정뿌리기 ${layer}중첩 +1턴`,
        predicate: hp => hp % denom === 1,
        relevant: true,
      });
    });
  }
  return rules;
}

function ftHpBreakpointDeltas(side, rule) {
  const curEv = side.evs?.hp || 0;
  const otherSum = ftStatKeys().reduce((a, key) => key === 'hp' ? a : a + (side.evs?.[key] || 0), 0);
  const maxEv = Math.min(32, Math.max(0, 66 - otherSum));
  const hits = [];
  for (let ev = 0; ev <= maxEv; ev++) {
    const hp = ftHpAtEv(side, ev);
    if (rule.predicate(hp)) hits.push({ ev, hp });
  }
  const current = hits.find(hit => hit.ev === curEv) || null;
  const prev = [...hits].reverse().find(hit => hit.ev < curEv) || null;
  const next = hits.find(hit => hit.ev > curEv) || null;
  return { rule, current, prev, next, currentHp: ftHpAtEv(side, curEv), maxEv };
}

function ftHpBreakpoints(side) {
  return ftHpBreakpointRules(side).map(rule => ftHpBreakpointDeltas(side, rule));
}

function ftRenderHpBreakpoints(side) {
  const rows = ftHpBreakpoints(side);
  return rows.map(info => {
    const badges = [];
    if (info.current) badges.push(`<span class="ft-breakpoint-delta current">충족</span>`);
    if (!info.current && info.next) badges.push(`<span class="ft-breakpoint-delta next">+${info.next.ev - (side.evs.hp || 0)}pt</span>`);
    if (!info.current && info.prev) badges.push(`<span class="ft-breakpoint-delta prev">-${(side.evs.hp || 0) - info.prev.ev}pt</span>`);
    if (!badges.length) badges.push(`<span class="ft-breakpoint-delta none">불가</span>`);
    const targetBits = [
      info.current ? `HP ${info.current.hp}` : null,
      !info.current && info.next ? `+ HP ${info.next.hp}` : null,
      !info.current && info.prev ? `- HP ${info.prev.hp}` : null,
    ].filter(Boolean).join(' · ');
    return `
      <div class="ft-breakpoint-item ${info.current ? 'active' : ''} ${info.rule.relevant ? '' : 'muted'}">
        <div class="ft-breakpoint-main">
          <b>${escapeHTML(info.rule.rule)}</b>
          <span>${escapeHTML(info.rule.desc)}</span>
        </div>
        <div class="ft-breakpoint-target">${targetBits || `현재 HP ${info.currentHp}`}</div>
        <div class="ft-breakpoint-deltas">${badges.join('')}</div>
      </div>
    `;
  }).join('');
}

function ftBreakpointDeltaText(side, info) {
  const curEv = side.evs?.hp || 0;
  if (info.current) return '충족';
  const parts = [];
  if (info.next) parts.push(`+${info.next.ev - curEv}pt`);
  if (info.prev) parts.push(`-${curEv - info.prev.ev}pt`);
  return parts.join(' / ') || '불가';
}

function ftBreakpointTargetText(info) {
  const targets = [
    info.current ? `HP ${info.current.hp}` : null,
    !info.current && info.next ? `+ HP ${info.next.hp}` : null,
    !info.current && info.prev ? `- HP ${info.prev.hp}` : null,
  ].filter(Boolean);
  return targets.join(' · ') || `현재 HP ${info.currentHp}`;
}

function ftRenderHpPointChips(side) {
  const rows = ftHpBreakpoints(side).filter(info => info.rule.relevant || info.current);
  return rows.map(info => {
    const cls = info.current ? 'active' : info.next ? 'next' : info.prev ? 'prev' : 'none';
    const title = `${info.rule.desc} · ${ftBreakpointTargetText(info)}`;
    return `
      <span class="ft-point-chip ${cls}" title="${escapeHTML(title)}">
        <b>${escapeHTML(info.rule.rule)}</b>
        <em>${escapeHTML(ftBreakpointDeltaText(side, info))}</em>
      </span>
    `;
  }).join('');
}

function ftMagicNumbersV2(side, stat) {
  if (stat === 'hp') return null;
  const nature = NATURE_BY_ID?.[side.nature];
  if (!nature || nature.up !== stat) return null;
  const p = PokemonById[side.pokemonIdx];
  if (!p) return null;
  const base = p.bs[stat];
  let firstMagic = (10 - (base + 20) % 10) % 10;
  if (firstMagic === 0) firstMagic = 10;
  const magicEvs = [];
  for (let m = firstMagic; m <= 32; m += 10) magicEvs.push(m);
  const cur = side.evs[stat] || 0;
  return {
    magicEvs,
    cur,
    current: magicEvs.includes(cur) ? cur : null,
    prev: [...magicEvs].reverse().find(m => m < cur) ?? null,
    next: magicEvs.find(m => m > cur) ?? null,
  };
}

function renderFineTuneMyV2() {
  const container = document.getElementById('ft-my-body');
  if (!container) return;
  const my = fineTuneState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) {
    container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>';
    return;
  }
  const stats = calcStats(my);
  const totalEV = ftStatKeys().reduce((a, s) => a + (my.evs[s] || 0), 0);
  const overEV = totalEV > 66;
  const STAT_KO = { hp: 'HP', atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '속도' };
  const RANK_STATS = ['atk','def','spa','spd','spe'];
  const typeBadges = normalizeSideTypes(my).map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join('');
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const statRows = ['hp', ...RANK_STATS].map(s => {
    const ev = my.evs[s] || 0;
    const nature = NATURE_BY_ID?.[my.nature];
    const natureMark = nature?.up === s ? '<span class="ft-nature-up">▲</span>' : nature?.down === s ? '<span class="ft-nature-down">▼</span>' : '';
    const rank = my.ranks?.[s] || 0;
    const rankCtrl = s === 'hp' ? '<div class="ft-rank-empty"></div>' : `
      <div class="ft-rank">
        <button class="ft-rank-btn" data-ft-rank="${s}" data-ft-dir="-1">−</button>
        <span class="ft-rank-val ${rank > 0 ? 'pos' : rank < 0 ? 'neg' : ''}">${rank > 0 ? '+' + rank : rank}</span>
        <button class="ft-rank-btn" data-ft-rank="${s}" data-ft-dir="1">+</button>
      </div>
    `;
    const magic = ftMagicNumbers(my, s);
    const pointHtml = s === 'hp' ? `
      <div class="ft-magic ft-hp-points">${ftRenderHpPointChips(my)}</div>
    ` : magic ? `
      <div class="ft-magic">
        ${magic.current !== null ? `<span class="ft-magic-current" title="현재 매직 넘버">현재</span>` : ''}
        ${magic.prev !== null ? `<span class="ft-magic-prev" title="이전 매직 포인트: ${magic.prev}pt">-${ev - magic.prev}pt</span>` : '<span class="ft-magic-prev empty"></span>'}
        ${magic.next !== null ? `<span class="ft-magic-next" title="다음 매직 포인트: ${magic.next}pt">+${magic.next - ev}pt</span>` : '<span class="ft-magic-next empty"></span>'}
      </div>
    ` : '<div class="ft-magic empty"></div>';
    return `
      <div class="ft-stat-row">
        <div class="ft-stat-name">${STAT_KO[s]} ${natureMark}</div>
        <div class="ft-stat-base">${p.bs[s]}</div>
        <div class="ft-stat-ev">
          <button class="ft-ev-quick" data-ft-evset="${s}" data-ft-evval="0" title="0">0</button>
          <div class="ft-ev-stepper">
            <input type="text" inputmode="numeric" pattern="[0-9]*" class="ft-ev-input" data-ft-ev="${s}" value="${ev}" aria-label="${STAT_KO[s]} 노력치">
            <div class="ft-ev-spin">
              <button type="button" class="ft-ev-spin-btn" data-ft-evstep="${s}" data-ft-dir="1" title="+1">+</button>
              <button type="button" class="ft-ev-spin-btn" data-ft-evstep="${s}" data-ft-dir="-1" title="-1">−</button>
            </div>
          </div>
          <button class="ft-ev-quick" data-ft-evset="${s}" data-ft-evval="32" title="32">32</button>
        </div>
        <div class="ft-stat-final">${stats[s]}</div>
        ${rankCtrl}
        ${pointHtml}
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
          ${typeBadges}
          ${p.mega ? '<span class="badge-mega" style="color:var(--tera);">[메가]</span>' : ''}
        </div>
      </div>
    </div>

    <div class="ft-controls-row ft-controls-grid">
      <label class="field ft-cb-field"><span class="field-label">성격</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="nature" value="${escapeHTML(ftComboLabel('nature', my.nature))}" placeholder="성격 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      <label class="field ft-cb-field"><span class="field-label">특성</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="ability" value="${escapeHTML(ftComboLabel('ability', my.ability))}" placeholder="특성 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      ${speedActivation ? `<label class="checkbox-label ft-speed-toggle" title="${escapeHTML(speedActivation.label)}"><input type="checkbox" id="ftWeatherAbility" ${fineTuneState.weatherAbilityActive ? 'checked' : ''}>${escapeHTML(speedActivation.label)}</label>` : '<div></div>'}
      <label class="field ft-cb-field"><span class="field-label">도구</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="item" value="${escapeHTML(ftComboLabel('item', my.item))}" placeholder="도구 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
    </div>

    <div class="ft-stats-grid">
      <div class="ft-stats-head">
        <div>스탯</div>
        <div>종족값</div>
        <div>노력치(0-32)</div>
        <div>실수치</div>
        <div>랭크</div>
        <div>조정 포인트</div>
      </div>
      ${statRows}
    </div>

    <div class="ft-ev-total ${overEV ? 'over' : ''}">
      노력치 합계: <b>${totalEV}</b> / 66 ${overEV ? '<span style="color:var(--atk);">초과!</span>' : ''}
    </div>

  `;
  ftWireMyComboboxes();
}

function renderFineTuneOppV2() {
  const container = document.getElementById('ft-opp-body');
  if (!container) return;
  const opp = fineTuneState.opp;
  const p = PokemonById[opp.pokemonIdx];
  const refCases = [
    { label: '최속(N+/E32)', ev: 32, nature: 'jolly' },
    { label: '준속(N0/E32)', ev: 32, nature: 'hardy' },
    { label: '무보정(N0/E0)', ev: 0, nature: 'hardy' },
  ];
  const manual = ftOpponentManualSpeed(opp);

  container.innerHTML = `
    <div class="ft-poke-row">
      <div class="ft-pickname">
        <span class="ft-section-title">포켓몬</span>
        <div class="combobox" style="flex:1;">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="opp" value="${p ? escapeHTML(pkName(p)) : ''}" placeholder="검색...">
          <div class="combobox-options"></div>
        </div>
        ${p ? `<div class="types-display" style="margin-left:8px;">${p.types.map(t => `<span class="type-pill t-${t}" style="font-size:10px;padding:1px 6px;">${TYPE_KO[t] || t}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="ft-controls-row">
      <label class="checkbox-label">
        <input type="checkbox" id="ftOppScarf" ${opp.scarf ? 'checked' : ''}>
        구애스카프
      </label>
      <div class="field ft-rank-field"><span class="field-label">상대 속도 랭크</span>
        <div class="ft-rank">
          <button class="ft-rank-btn" data-ft-opprank="-1">−</button>
          <span class="ft-rank-val ${opp.speRank > 0 ? 'pos' : opp.speRank < 0 ? 'neg' : ''}">${opp.speRank > 0 ? '+' + opp.speRank : opp.speRank}</span>
          <button class="ft-rank-btn" data-ft-opprank="1">+</button>
        </div>
      </div>
      <label class="field ft-direct-speed-field"><span class="field-label">직접 속도</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" id="ftOppManualSpeed" value="${escapeHTML(opp.manualSpeed || '')}" placeholder="자동">
      </label>
    </div>
    <div class="ft-section-title">참고: 상대 속도 실수치</div>
    <div class="ft-tag-row">
      ${manual !== null ? `<span class="ft-tag">직접 입력: <b>${manual}</b></span>` : ''}
      ${p ? refCases.map(c => `<span class="ft-tag">${c.label}: <b>${ftOppSpeedCase(opp, c.ev, c.nature, { ignoreManual: true })}</b></span>`).join(' ') : ''}
    </div>
  `;
  ftWireOppComboboxes();
}

function renderFineTuneSpeedV2() {
  const container = document.getElementById('ft-speed-body');
  if (!container) return;
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const myP = PokemonById[my.pokemonIdx];
  const oppP = PokemonById[opp.pokemonIdx];
  if (!myP || !oppP) {
    container.innerHTML = '<div class="empty-state">양쪽 포켓몬 선택 필요</div>';
    return;
  }
  const rows = ftBuildSpeedTable();
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const activeSpeedNote = speedActivation && fineTuneState.weatherAbilityActive
    ? `<span class="ft-tag" style="color:var(--ok);">${escapeHTML(speedActivation.label)}</span>`
    : '';
  const myCurrentSpe = ftMySpeed(my);

  container.innerHTML = `
    <div class="ft-myspe-info">
      <span>내 현재 속도 실수치 <b>${myCurrentSpe}</b></span>
      ${my.item === 'choicescarf' ? '<span class="ft-tag" style="color:var(--warn);">스카프 적용</span>' : ''}
      ${activeSpeedNote}
      ${(my.ranks?.spe || 0) !== 0 ? `<span class="ft-tag">랭크 ${my.ranks.spe > 0 ? '+' : ''}${my.ranks.spe}</span>` : ''}
    </div>
    <div class="ft-speed-table-wrap">
      <table class="ft-speed-table">
        <colgroup>
          <col class="ft-speed-row-label-col">
          ${rows.map(() => '<col class="ft-speed-value-col">').join('')}
        </colgroup>
        <thead>
          <tr>
            <th>구분</th>
            ${rows.map(r => `<th>${escapeHTML(r.label)}<small>${escapeHTML(r.sub || '')}</small></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr><th>상대 실수치</th>${rows.map(r => `<td>${r.oppSpe}</td>`).join('')}</tr>
          <tr><th>+${margin} 추월 필요 EV</th>${rows.map(r => {
            const cls = r.need === null ? 'ft-cell-impossible' : 'ft-cell-possible';
            const valHtml = r.need === null ? '<b>불가</b>' : `<b>${r.need}</b> EV`;
            return `<td class="${cls}" title="필요 속도 ${r.target} 이상 (상대 ${r.oppSpe} + ${margin})">${valHtml}</td>`;
          }).join('')}</tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderFineTuneAllV2() {
  renderFineTuneMy();
  renderFineTuneOpp();
  renderFineTuneSpeed();
}

function ftEvSummaryV3(side) {
  const total = ftStatKeys().reduce((sum, stat) => sum + (side.evs?.[stat] || 0), 0);
  return {
    total,
    remaining: Math.max(0, 66 - total),
    over: total > 66,
  };
}

function ftRenderTypePillsV3(types) {
  return (types || [])
    .filter(Boolean)
    .map(type => `<span class="type-pill t-${type}">${TYPE_KO[type] || type}</span>`)
    .join('');
}

function ftNatureMarkV3(stat, natureId) {
  const nature = NATURE_BY_ID?.[natureId];
  if (nature?.up === stat) return '<span class="ft-nature-up">+</span>';
  if (nature?.down === stat) return '<span class="ft-nature-down">-</span>';
  return '';
}

function ftRenderMagicCellV3(side, stat, ev) {
  const magic = ftMagicNumbers(side, stat);
  if (!magic) return '<div class="ft-magic empty"></div>';
  return `
    <div class="ft-magic">
      ${magic.current !== null ? '<span class="ft-magic-current" title="현재 매직 포인트">현재</span>' : ''}
      ${magic.prev !== null ? `<span class="ft-magic-prev" title="이전 매직 포인트: ${magic.prev}pt">-${ev - magic.prev}pt</span>` : '<span class="ft-magic-prev empty"></span>'}
      ${magic.next !== null ? `<span class="ft-magic-next" title="다음 매직 포인트: ${magic.next}pt">+${magic.next - ev}pt</span>` : '<span class="ft-magic-next empty"></span>'}
    </div>
  `;
}

function ftBulkMetricsV3(side) {
  const stats = calcStats(side);
  return {
    stats,
    phys: Math.round(stats.hp * stats.def / 0.411),
    spec: Math.round(stats.hp * stats.spd / 0.411),
  };
}

function ftBaseStatsMiniV3(p) {
  if (!p?.bs) return '';
  const labels = { hp: 'HP', atk: '공', def: '방', spa: '특공', spd: '특방', spe: '속' };
  return `
    <div class="ft-base-mini">
      ${['hp','atk','def','spa','spd','spe'].map(stat => `
        <span><em>${labels[stat]}</em><b>${p.bs[stat]}</b></span>
      `).join('')}
    </div>
  `;
}

function renderFineTuneSummaryV3() {
  const container = document.getElementById('ft-summary-body');
  if (!container) return;
  const my = fineTuneState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) {
    container.innerHTML = '';
    return;
  }
  const ev = ftEvSummaryV3(my);
  const pct = Math.min(100, Math.round(ev.total / 66 * 100));
  const chips = ftStatKeys()
    .filter(stat => (my.evs?.[stat] || 0) > 0)
    .map(stat => `<span class="ft-ev-chip"><b>${STAT_LABEL?.[stat] || stat}</b>${my.evs[stat]}</span>`)
    .join('');

  container.innerHTML = `
    <section class="ft-analysis-section ft-summary-section">
      <div class="ft-ev-footer-head">
        <span>EV 합계 <b class="${ev.over ? 'over' : ''}">${ev.total}/66</b></span>
        <span>남은 <b>${ev.remaining}</b></span>
      </div>
      <div class="ft-ev-meter ${ev.over ? 'over' : ''}"><span style="width:${pct}%"></span></div>
      <div class="ft-ev-chip-row">${chips || '<span class="ft-muted">분배 없음</span>'}</div>
    </section>
  `;
}

function ftBreakpointDistanceV3(side, info) {
  const curEv = side.evs?.hp || 0;
  if (info.current) return 0;
  const candidates = [];
  if (info.next) candidates.push(info.next.ev - curEv);
  if (info.prev) candidates.push(curEv - info.prev.ev);
  return candidates.length ? Math.min(...candidates) : 999;
}

function ftBreakpointTargetTextV3(side, info) {
  const curEv = side.evs?.hp || 0;
  if (info.current) return `HP ${info.current.hp}`;
  const parts = [];
  if (info.next) parts.push(`+${info.next.ev - curEv}pt / HP ${info.next.hp}`);
  if (info.prev) parts.push(`-${curEv - info.prev.ev}pt / HP ${info.prev.hp}`);
  return parts.join(' · ') || `현재 HP ${info.currentHp}`;
}

function ftBreakpointBadgesV3(side, info) {
  const curEv = side.evs?.hp || 0;
  const badges = [];
  if (info.current) badges.push('<span class="ft-breakpoint-delta current">충족</span>');
  if (!info.current && info.next) badges.push(`<span class="ft-breakpoint-delta next">+${info.next.ev - curEv}pt</span>`);
  if (!info.current && info.prev) badges.push(`<span class="ft-breakpoint-delta prev">-${curEv - info.prev.ev}pt</span>`);
  if (!badges.length) badges.push('<span class="ft-breakpoint-delta none">불가</span>');
  return badges.join('');
}

function ftBreakpointGroupKeyV3(info) {
  return info.rule.rule;
}

function ftUniqueJoinV3(values, separator = ' · ') {
  return [...new Set(values.filter(Boolean))].join(separator);
}

function ftGroupHpBreakpointsV3(side, rows) {
  const groups = new Map();
  rows.forEach(info => {
    const key = ftBreakpointGroupKeyV3(info);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        entries: [],
        current: false,
        relevant: false,
        distance: 999,
        sample: info,
      });
    }
    const group = groups.get(key);
    group.entries.push(info);
    group.current ||= !!info.current;
    group.relevant ||= !!info.rule.relevant;
    group.distance = Math.min(group.distance, ftBreakpointDistanceV3(side, info));
    if (info.current || !group.sample.current) group.sample = info;
  });
  return [...groups.values()];
}

function renderFineTuneHpV3() {
  const container = document.getElementById('ft-hp-body');
  if (!container) return;
  const my = fineTuneState.my;
  if (!PokemonById[my.pokemonIdx]) {
    container.innerHTML = '';
    return;
  }
  const rows = ftHpBreakpoints(my)
    .filter(info => info.rule.relevant || info.current || info.next || info.prev);
  const groups = ftGroupHpBreakpointsV3(my, rows);

  container.innerHTML = `
    <section class="ft-analysis-section ft-hp-section">
      <div class="ft-analysis-title">
        <span>HP 기준점</span>
        <b>HP ${calcStats(my).hp}</b>
      </div>
      <div class="ft-breakpoint-list">
        ${groups.map(group => `
          <div class="ft-breakpoint-item ${group.current ? 'active' : ''} ${group.relevant ? '' : 'muted'}">
            <div class="ft-breakpoint-main">
              <b>${escapeHTML(ftUniqueJoinV3(group.entries.map(info => info.rule.rule)))}</b>
              <span>${escapeHTML(ftUniqueJoinV3(group.entries.map(info => info.rule.desc), ' / '))}</span>
            </div>
            <div class="ft-breakpoint-deltas">${ftBreakpointBadgesV3(my, group.sample)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderFineTuneMyV3() {
  const container = document.getElementById('ft-my-body');
  if (!container) return;
  const my = fineTuneState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) {
    container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>';
    return;
  }

  const stats = calcStats(my);
  const bulk = ftBulkMetricsV3(my);
  const rankStats = ['atk','def','spa','spd','spe'];
  const typeBadges = ftRenderTypePillsV3(normalizeSideTypes(my));
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const statRows = ['hp', ...rankStats].map(stat => {
    const ev = my.evs[stat] || 0;
    const rank = my.ranks?.[stat] || 0;
    const rankCtrl = stat === 'hp' ? '<div class="ft-rank-empty"></div>' : `
      <div class="ft-rank">
        <button class="ft-rank-btn" data-ft-rank="${stat}" data-ft-dir="-1">-</button>
        <span class="ft-rank-val ${rank > 0 ? 'pos' : rank < 0 ? 'neg' : ''}">${rank > 0 ? '+' + rank : rank}</span>
        <button class="ft-rank-btn" data-ft-rank="${stat}" data-ft-dir="1">+</button>
      </div>
    `;
    return `
      <div class="ft-stat-row">
        <div class="ft-stat-name">${STAT_LABEL?.[stat] || stat} ${ftNatureMarkV3(stat, my.nature)}</div>
        <div class="ft-stat-base">${p.bs[stat]}</div>
        <div class="ft-stat-ev">
          <button class="ft-ev-quick" data-ft-evset="${stat}" data-ft-evval="0" title="0">0</button>
          <div class="ft-ev-stepper">
            <input type="text" inputmode="numeric" pattern="[0-9]*" class="ft-ev-input" data-ft-ev="${stat}" value="${ev}" aria-label="${STAT_LABEL?.[stat] || stat} 노력치">
            <div class="ft-ev-spin">
              <button type="button" class="ft-ev-spin-btn" data-ft-evstep="${stat}" data-ft-dir="1" title="+1">+</button>
              <button type="button" class="ft-ev-spin-btn" data-ft-evstep="${stat}" data-ft-dir="-1" title="-1">-</button>
            </div>
          </div>
          <button class="ft-ev-quick" data-ft-evset="${stat}" data-ft-evval="32" title="32">32</button>
        </div>
        ${ftRenderMagicCellV3(my, stat, ev)}
        <div class="ft-stat-final">${stats[stat]}</div>
        ${rankCtrl}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="ft-setup-grid">
      <label class="field ft-cb-field ft-pokemon-field"><span class="field-label">포켓몬</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="my" value="${escapeHTML(pkName(p))}" placeholder="검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      <div class="ft-type-strip" aria-label="타입">${typeBadges}${p.mega ? '<span class="badge-mega">[메가]</span>' : ''}</div>
      <label class="field ft-cb-field"><span class="field-label">성격</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="nature" value="${escapeHTML(ftComboLabel('nature', my.nature))}" placeholder="성격 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      <label class="field ft-cb-field"><span class="field-label">특성</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="ability" value="${escapeHTML(ftComboLabel('ability', my.ability))}" placeholder="특성 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      ${speedActivation ? `<label class="checkbox-label ft-speed-toggle" title="${escapeHTML(speedActivation.label)}"><input type="checkbox" id="ftWeatherAbility" ${fineTuneState.weatherAbilityActive ? 'checked' : ''}>${escapeHTML(speedActivation.label)}</label>` : '<div class="ft-speed-toggle-placeholder"></div>'}
      <label class="field ft-cb-field"><span class="field-label">도구</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="item" value="${escapeHTML(ftComboLabel('item', my.item))}" placeholder="도구 검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
    </div>

    <div class="ft-table-section">
      <div class="ft-table-title">노력치 편집</div>
      <div class="ft-edit-layout">
        <div class="ft-stats-column">
          <div class="ft-stats-grid">
            <div class="ft-stats-head">
              <div>스탯</div>
              <div>종족값</div>
              <div>노력치</div>
              <div>매직넘버</div>
              <div>실수치</div>
              <div>랭크</div>
            </div>
            ${statRows}
          </div>
          <div id="ft-summary-body"></div>
        </div>
        <div class="ft-side-metrics">
          <div class="ft-bulk-panel">
            <div class="ft-bulk-title">내구력</div>
            <div class="ft-bulk-card phys">
              <span>물리내구</span>
              <b>${bulk.phys.toLocaleString()}</b>
              <em>HP ${bulk.stats.hp} × 방어 ${bulk.stats.def}</em>
            </div>
            <div class="ft-bulk-card spec">
              <span>특수내구</span>
              <b>${bulk.spec.toLocaleString()}</b>
              <em>HP ${bulk.stats.hp} × 특방 ${bulk.stats.spd}</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  ftWireMyComboboxes();
}

function renderFineTuneOppV3() {
  const container = document.getElementById('ft-opp-body');
  if (!container) return;
  const opp = fineTuneState.opp;
  const p = PokemonById[opp.pokemonIdx];
  const refCases = [
    { label: '최속', ev: 32, nature: 'jolly' },
    { label: '준속', ev: 32, nature: 'hardy' },
    { label: '무보정', ev: 0, nature: 'hardy' },
  ];
  const manual = ftOpponentManualSpeed(opp);

  container.innerHTML = `
    <section class="ft-analysis-section ft-opp-section">
      <div class="ft-analysis-title">
        <span>상대 기준</span>
        <em>스카프 · 랭크 반영</em>
      </div>
      <label class="field ft-cb-field"><span class="field-label">포켓몬</span>
        <div class="combobox">
          <input type="text" class="cb-input ft-cb-input" data-ft-pick="opp" value="${p ? escapeHTML(pkName(p)) : ''}" placeholder="검색...">
          <div class="combobox-options"></div>
        </div>
      </label>
      ${p ? `<div class="ft-type-strip">${ftRenderTypePillsV3(p.types)}</div>${ftBaseStatsMiniV3(p)}` : ''}
      <div class="ft-opp-control-grid">
        <label class="checkbox-label ft-opp-scarf">
          <input type="checkbox" id="ftOppScarf" ${opp.scarf ? 'checked' : ''}>
          구애스카프
        </label>
        <div class="field ft-rank-field"><span class="field-label">속도 랭크</span>
          <div class="ft-rank">
            <button class="ft-rank-btn" data-ft-opprank="-1">-</button>
            <span class="ft-rank-val ${opp.speRank > 0 ? 'pos' : opp.speRank < 0 ? 'neg' : ''}">${opp.speRank > 0 ? '+' + opp.speRank : opp.speRank}</span>
            <button class="ft-rank-btn" data-ft-opprank="1">+</button>
          </div>
        </div>
        <label class="field ft-direct-speed-field"><span class="field-label">직접 속도</span>
          <input type="text" inputmode="numeric" pattern="[0-9]*" id="ftOppManualSpeed" value="${escapeHTML(opp.manualSpeed || '')}" placeholder="자동">
        </label>
      </div>
      <div class="ft-tag-row">
        ${manual !== null ? `<span class="ft-tag">직접 입력 <b>${manual}</b></span>` : ''}
        ${p ? refCases.map(c => `<span class="ft-tag">${c.label} <b>${ftOppSpeedCase(opp, c.ev, c.nature, { ignoreManual: true })}</b></span>`).join('') : ''}
      </div>
    </section>
  `;
  ftWireOppComboboxes();
}

function renderFineTuneSpeedV3() {
  const container = document.getElementById('ft-speed-body');
  if (!container) return;
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const myP = PokemonById[my.pokemonIdx];
  const oppP = PokemonById[opp.pokemonIdx];
  if (!myP || !oppP) {
    container.innerHTML = '<div class="empty-state">양쪽 포켓몬 선택 필요</div>';
    return;
  }
  const rows = ftBuildSpeedTable();
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const activeSpeedNote = speedActivation && fineTuneState.weatherAbilityActive
    ? `<span class="ft-tag ok">${escapeHTML(speedActivation.label)}</span>`
    : '';
  const myCurrentSpe = ftMySpeed(my);

  container.innerHTML = `
    <div class="ft-myspe-info">
      <span>현재 속도 <b>${myCurrentSpe}</b></span>
      ${my.item === 'choicescarf' ? '<span class="ft-tag warn">스카프 적용</span>' : ''}
      ${activeSpeedNote}
      ${(my.ranks?.spe || 0) !== 0 ? `<span class="ft-tag">랭크 ${my.ranks.spe > 0 ? '+' : ''}${my.ranks.spe}</span>` : ''}
    </div>
    <div class="ft-speed-table-wrap">
      <table class="ft-speed-table">
        <colgroup>
          <col class="ft-speed-row-label-col">
          ${rows.map(() => '<col class="ft-speed-value-col">').join('')}
        </colgroup>
        <thead>
          <tr>
            <th>구분</th>
            ${rows.map(row => `<th>${escapeHTML(row.label)}<small>${escapeHTML(row.sub || '')}</small></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr><th>상대 실수치</th>${rows.map(row => `<td>${row.oppSpe}</td>`).join('')}</tr>
          <tr><th>+${margin} 추월 EV</th>${rows.map(row => {
            const cls = row.need === null ? 'ft-cell-impossible' : 'ft-cell-possible';
            const valHtml = row.need === null ? '<b>불가</b>' : `<b>${row.need}</b> EV`;
            return `<td class="${cls}" title="필요 속도 ${row.target} 이상 (상대 ${row.oppSpe} + ${margin})">${valHtml}</td>`;
          }).join('')}</tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderFineTuneAllV3() {
  renderFineTuneMyV3();
  renderFineTuneSummaryV3();
  renderFineTuneHpV3();
  renderFineTuneOppV3();
  renderFineTuneSpeedV3();
}

ftMySpeed = ftMySpeedV2;
ftOppSpeedCase = ftOppSpeedCaseV2;
ftFindMinSpeedEv = ftFindMinSpeedEvV2;
ftBuildSpeedTable = ftBuildSpeedTableV2;
ftWireMyComboboxes = ftWireMyComboboxesV2;
ftWireOppComboboxes = ftWireOppComboboxesV2;
ftMagicNumbers = ftMagicNumbersV2;
renderFineTuneMy = renderFineTuneMyV3;
renderFineTuneOpp = renderFineTuneOppV3;
renderFineTuneSpeed = renderFineTuneSpeedV3;
renderFineTuneAll = renderFineTuneAllV3;

document.getElementById('page-finetune')?.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppScarf') { fineTuneState.opp.scarf = t.checked; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  if (t.id === 'ftWeatherAbility') { fineTuneState.weatherAbilityActive = t.checked; renderFineTuneAll(); return; }
  if (t.id === 'ftOppManualSpeed') { fineTuneState.opp.manualSpeed = t.value; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  if (t.dataset.ftEv) {
    const stat = t.dataset.ftEv;
    ftSetEv(stat, t.value);
    renderFineTuneAll();
    return;
  }
  if (t.dataset.ftAction === 'nature') { fineTuneState.my.nature = t.value; renderFineTuneAll(); return; }
  if (t.dataset.ftAction === 'ability') {
    fineTuneState.my.ability = t.value;
    if (!ftAbilitySpeedActivation(fineTuneState.my.ability)) fineTuneState.weatherAbilityActive = false;
    renderFineTuneAll();
    return;
  }
});

document.getElementById('page-finetune')?.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppManualSpeed') { fineTuneState.opp.manualSpeed = t.value; renderFineTuneSpeed(); return; }
});

document.getElementById('page-finetune')?.addEventListener('click', e => {
  const t = e.target;
  // EV quick set 버튼 (0/32) — 66 캡 적용
  if (t.dataset.ftEvset !== undefined) {
    const stat = t.dataset.ftEvset;
    ftSetEv(stat, t.dataset.ftEvval);
    renderFineTuneAll();
    return;
  }
  if (t.dataset.ftEvstep !== undefined) {
    const stat = t.dataset.ftEvstep;
    const dir = parseInt(t.dataset.ftDir, 10) || 0;
    ftSetEv(stat, (fineTuneState.my.evs[stat] || 0) + dir);
    renderFineTuneAll();
    return;
  }
  // 내 측 랭크
  if (t.dataset.ftRank) {
    const stat = t.dataset.ftRank;
    const dir = parseInt(t.dataset.ftDir, 10);
    const cur = fineTuneState.my.ranks[stat] || 0;
    fineTuneState.my.ranks[stat] = Math.max(-6, Math.min(6, cur + dir));
    renderFineTuneAll();
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
  fineTuneState.opp.manualSpeed = '';
  fineTuneState.weatherAbilityActive = false;
  // 세부조정 탭 이동
  const ftNav = document.querySelector('.nav-tab[data-page="finetune"]');
  if (ftNav) ftNav.click();
  renderFineTuneAll();
}
window.loadSideToFineTune = loadSideToFineTune; // 다른 모듈에서 호출 가능


/* ════════════════════════════════════════════════════════════
   형태 역계산 (Reverse Form) 탭
   ────────────────────────────────────────────────────────────
   알고리즘:
     Stage 1 (def): 내가 친 기술 + 관측 → 상대 HP+Def(or SpD) 추정
     Stage 2     : 잔존 EV 계산 (66 - 내구합)
     Stage 3 (atk): 상대 친 기술 + 관측 → 상대 Atk(or SpA), 잔존 내에서
     Stage 4     : 선후공 조건과 스카프 여부를 결합해 66포인트 룰 검증
   부분 입력:
     - 내 기술만 입력 → Stage 1 결과만
     - 상대 기술만 입력 → Stage 3 결과만 (HP/Def 검색 안 함)
   ════════════════════════════════════════════════════════════ */

function rcDefaultField() {
  return {
    weather: 'none', terrain: 'none', isCritical: false,
    defReflect: false, defLightScreen: false, gameType: 'Singles',
    isTrickRoom: false, isGravity: false,
    ruinSword: false, ruinTablet: false, ruinBeads: false, ruinVessel: false,
    defStealthRock: false, defSpikesLayers: 0,
    atkHelpingHand: false, defProtect: false,
  };
}

const revCalcState = {
  my: makeSideState('incineroar'),
  opp: {
    pokemonIdx: PokemonById['amoonguss'] ? 'amoonguss' : (PokemonById['azumarill'] ? 'azumarill' : Object.keys(PokemonById)[0]),
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: 'none',
  },
  myMove: '',
  myMoveBp: '',         // 빈 문자열 = move data의 default 사용
  observedTheirPct: '',
  oppMove: '',
  oppMoveBp: '',
  observedMyPct: '',
  turnOrder: 'unknown',
  mySpeedOverride: '',
  field: rcDefaultField(),
  // 도구 후보 — 기본은 빈 도구, 구애스카프, type-boost 도구. 사용자가 추가/제거 가능.
  itemCandidates: ['', 'choicescarf', 'silkscarf', 'charcoal', 'mysticwater', 'magnet', 'miracleseed',
                   'nevermeltice', 'blackbelt', 'poisonbarb', 'softsand', 'sharpbeak',
                   'twistedspoon', 'silverpowder', 'hardstone', 'spelltag', 'dragonfang',
                   'blackglasses', 'metalcoat', 'fairyfeather'],
  results: null,
  analyzing: false,
};

function rcAnalysisField() {
  return {
    ...rcDefaultField(),
    weather: revCalcState.field.weather || 'none',
    terrain: revCalcState.field.terrain || 'none',
    isCritical: !!revCalcState.field.isCritical,
    defReflect: !!revCalcState.field.defReflect,
    defLightScreen: !!revCalcState.field.defLightScreen,
    isTrickRoom: !!revCalcState.field.isTrickRoom,
  };
}

function rcActiveFieldSummary(field) {
  const parts = [];
  if (field.weather && field.weather !== 'none') parts.push(`weather=${field.weather}`);
  if (field.terrain && field.terrain !== 'none') parts.push(`terrain=${field.terrain}`);
  if (field.isCritical) parts.push('critical');
  if (field.defReflect) parts.push('reflect');
  if (field.defLightScreen) parts.push('lightscreen');
  if (field.isTrickRoom) parts.push('trickroom');
  return parts.join(',') || 'none';
}

// 방어 nature 7개 (Hardy = 무보정)
const RC_DEF_NATURES = ['bold', 'impish', 'calm', 'careful', 'relaxed', 'sassy', 'hardy'];
// 공격 nature 7개 (Atk 또는 SpA 보정 + 무보정)
const RC_ATK_NATURES = ['adamant', 'naive', 'lonely', 'brave', 'modest', 'rash', 'mild', 'quiet', 'hardy'];

function rcMatchingRemainingPct(rolls, observedPct, defenderHp) {
  let matches = 0;
  for (const d of rolls) {
    if (d <= 0) continue;
    const remaining = Math.max(0, defenderHp - d);
    const remainingPct = Math.floor(remaining / defenderHp * 100);
    if (remainingPct === observedPct) matches++;
  }
  return matches;
}

function rcMatchingRemainingHp(rolls, observedHp, startingHp) {
  let matches = 0;
  for (const d of rolls) {
    if (d <= 0) continue;
    const remaining = Math.max(0, startingHp - d);
    if (remaining === observedHp) matches++;
  }
  return matches;
}

function rcCurrentHpValue(side) {
  const stats = calcStats(side);
  const rawPct = Number(side.hpPct ?? 1);
  const hpPct = Number.isFinite(rawPct) ? Math.max(0.01, Math.min(1, rawPct > 1 ? rawPct / 100 : rawPct)) : 1;
  return Math.max(1, Math.floor(stats.hp * hpPct));
}

function rcStageModifiedStat(value, stage) {
  const rank = Math.max(-6, Math.min(6, parseInt(stage, 10) || 0));
  if (rank >= 0) return Math.floor(value * (2 + rank) / 2);
  return Math.floor(value * 2 / (2 - rank));
}

function rcSpeedWithMods(baseSpeed, rank, item, status) {
  let speed = rcStageModifiedStat(baseSpeed, rank);
  if (item === 'choicescarf') speed = Math.floor(speed * 1.5);
  if (status === 'Paralysis') speed = Math.floor(speed * 0.5);
  return Math.max(1, speed);
}

function rcMySpeedValue() {
  const manual = parseInt(revCalcState.mySpeedOverride, 10);
  if (Number.isFinite(manual) && manual > 0) return manual;
  const stats = calcStats(revCalcState.my);
  return rcSpeedWithMods(
    stats.spe,
    revCalcState.my.ranks?.spe || 0,
    revCalcState.my.item || '',
    revCalcState.my.status || 'none'
  );
}

function rcOpponentSpeedValue(oppP, nature, item, speEv) {
  const oppState = rcBuildDefState(oppP, {
    evs: { spe: speEv },
    nature,
    item,
  });
  const baseSpeed = calcStats(oppState).spe;
  return rcSpeedWithMods(baseSpeed, revCalcState.opp.ranks?.spe || 0, item || '', revCalcState.opp.status || 'none');
}

function rcSpeedCandidateInfo(oppP, nature, item, field = rcAnalysisField()) {
  const order = revCalcState.turnOrder || 'unknown';
  const mySpeed = rcMySpeedValue();
  if (order === 'unknown') {
    return {
      active: false,
      valid: true,
      speEv: 0,
      speMin: 0,
      speMax: 32,
      mySpeed,
      oppSpeed: rcOpponentSpeedValue(oppP, nature, item, 0),
      label: '속도 조건 없음',
    };
  }

  const ok = [];
  for (let speEv = 0; speEv <= 32; speEv++) {
    const oppSpeed = rcOpponentSpeedValue(oppP, nature, item, speEv);
    let matches = false;
    if (order === 'opp-first') {
      matches = field.isTrickRoom ? oppSpeed < mySpeed : oppSpeed > mySpeed;
    } else if (order === 'my-first') {
      matches = field.isTrickRoom ? oppSpeed > mySpeed : oppSpeed < mySpeed;
    } else if (order === 'speed-tie') {
      matches = oppSpeed === mySpeed;
    }
    if (matches) ok.push({ speEv, oppSpeed });
  }

  if (!ok.length) {
    return { active: true, valid: false, speEv: 33, speMin: null, speMax: null, mySpeed, oppSpeed: null, label: '속도 조건 불일치' };
  }

  const chosen = ok[0];
  return {
    active: true,
    valid: true,
    speEv: chosen.speEv,
    speMin: ok[0].speEv,
    speMax: ok[ok.length - 1].speEv,
    mySpeed,
    oppSpeed: chosen.oppSpeed,
    label: item === 'choicescarf' ? '구애스카프 속도 조건 충족' : '속도 조건 충족',
  };
}

function rcCandidatePointSum(c) {
  return (c.hpEv || 0) + (c.defEv || 0) + (c.atkEv || 0) + (c.speEv || 0);
}

function rcRelevantOffenseItems(move) {
  return revCalcState.itemCandidates.filter(item => {
    if (!item || item === 'choicescarf') return true;
    const itemData = ItemById[item];
    if (!itemData?.typeBoostType) return true;
    return itemData.typeBoostType === move.type;
  });
}

// 베이스 defender state 빌드 (역계산 검색 중간 단계용)
function rcBuildDefState(oppP, oppOverrides) {
  return {
    pokemonIdx: oppP.id,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(oppOverrides.evs || {}) },
    nature: oppOverrides.nature || 'hardy',
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(revCalcState.opp.ranks || {}) },
    status: revCalcState.opp.status || 'none',
    ability: oppOverrides.ability || toId(oppP.ab && (oppP.ab['0'] || oppP.ab['H'])) || '',
    item: oppOverrides.item || '',
    tera: false,
    teraType: oppP.types[0],
    pinch: false, fullHP: true,
    moves: [],
  };
}

// Stage 1: 내구 검색
function rcStage1Defense(my, oppP, myMove, observedPct, field, defStat) {
  const candidates = [];
  for (const natureId of RC_DEF_NATURES) {
    const nature = NATURE_BY_ID[natureId];
    // 방어 nature 검증: nature.up 이 검색 대상 stat 또는 무보정만
    if (nature.up && nature.up !== defStat) {
      // 다른 방어 stat 보정도 허용 (Bold→Def, Calm→SpD, ...)
      // 단 검색 대상 stat 의 보정이 아니라도 nature 자체는 가능 (분리해서 본 후보)
      // 예: 검색이 def 인데 nature 가 calm(spd+) 이면 def 에는 보정 없음 = neutral 처리
    }
    for (let hpEv = 0; hpEv <= 32; hpEv++) {
      for (let defEv = 0; defEv <= 32; defEv++) {
        if (hpEv + defEv > 64) continue;
        const oppState = rcBuildDefState(oppP, {
          evs: { hp: hpEv, [defStat]: defEv },
          nature: natureId,
        });
        const result = calculateDamage(my, oppState, myMove, field);
        if (!result || !result.damages) continue;
        const oppHp = calcStats(oppState).hp;
        const matches = rcMatchingRemainingPct(result.damages, observedPct, oppHp);
        if (matches > 0) {
          candidates.push({
            nature: natureId,
            hpEv, defEv, defStat,
            defScore: matches / 16,
            oppHp,
            oppDef: calcStats(oppState)[defStat],
            damages: result.damages,
          });
        }
      }
    }
  }
  return candidates;
}

// Stage 3: 공격 검색 (Stage 1 candidates 와 함께 정제)
function rcStage3OffenseRefine(defCandidates, my, oppP, oppMove, observedPct, field, atkStat) {
  const refined = [];
  const myHp = rcCurrentHpValue(my);

  for (const c of defCandidates) {
    const remainingEv = 66 - c.hpEv - c.defEv;

    for (let atkEv = 0; atkEv <= Math.min(32, remainingEv); atkEv++) {
      for (const item of rcRelevantOffenseItems(oppMove)) {
        const oppState = rcBuildDefState(oppP, {
          evs: { hp: c.hpEv, [c.defStat]: c.defEv, [atkStat]: atkEv },
          nature: c.nature,
          item,
        });
        const result = calculateDamage(oppState, my, oppMove, field);
        if (!result || !result.damages) continue;
        const matches = rcMatchingRemainingHp(result.damages, observedPct, myHp);
        if (matches > 0) {
          const atkScore = matches / 16;
          const totalScore = c.defScore * atkScore;
          const cand = {
            ...c,
            atkEv, atkStat, item: item || '',
            atkScore, totalScore,
            oppAtk: calcStats(oppState)[atkStat],
            myDamages: result.damages,
          };
          refined.push(cand);
        }
      }
    }
  }
  return refined;
}

// 공격만 입력된 경우 — defensive 정보 없이 Atk 만 검색
function rcStage3OffenseOnly(my, oppP, oppMove, observedPct, field, atkStat) {
  const candidates = [];
  const myHp = rcCurrentHpValue(my);
  for (const natureId of RC_ATK_NATURES) {
    for (let atkEv = 0; atkEv <= 32; atkEv++) {
      for (const item of rcRelevantOffenseItems(oppMove)) {
        const oppState = rcBuildDefState(oppP, {
          evs: { [atkStat]: atkEv },
          nature: natureId, item,
        });
        const result = calculateDamage(oppState, my, oppMove, field);
        if (!result || !result.damages) continue;
        const matches = rcMatchingRemainingHp(result.damages, observedPct, myHp);
        if (matches > 0) {
          candidates.push({
            nature: natureId,
            hpEv: 0, defEv: 0, defStat: null,
            atkEv, atkStat, item: item || '',
            atkScore: matches / 16, totalScore: matches / 16,
            oppAtk: calcStats(oppState)[atkStat],
          });
        }
      }
    }
  }
  return candidates;
}

// 분석 메인
function rcAnalyze() {
  const my = revCalcState.my;
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (!oppP) return { error: '상대 포켓몬을 선택해주세요.' };
  if (!PokemonById[my.pokemonIdx]) return { error: '내 포켓몬을 선택해주세요.' };

  const myMoveData = revCalcState.myMove ? MoveById[revCalcState.myMove] : null;
  const oppMoveData = revCalcState.oppMove ? MoveById[revCalcState.oppMove] : null;
  const observedTheir = parseInt(revCalcState.observedTheirPct, 10);
  const observedMy = parseInt(revCalcState.observedMyPct, 10);
  const myCurrentHp = rcCurrentHpValue(my);
  const myStatsForDebug = calcStats(my);

  const hasDef = myMoveData && myMoveData.cat !== 'Status' && observedTheir >= 0 && observedTheir <= 100;
  const hasAtk = oppMoveData && oppMoveData.cat !== 'Status' && observedMy >= 0 && observedMy <= myCurrentHp;
  const field = rcAnalysisField();

  if (!hasDef && !hasAtk) {
    return { error: '내 기술 또는 상대 기술 중 하나는 입력해야 합니다 (변화기 제외).' };
  }

  // 위력 override 적용
  const myMove = hasDef ? { ...myMoveData, bp: parseInt(revCalcState.myMoveBp, 10) || myMoveData.bp } : null;
  const oppMove = hasAtk ? { ...oppMoveData, bp: parseInt(revCalcState.oppMoveBp, 10) || oppMoveData.bp } : null;

  let candidates = [];
  let mode = 'unknown';
  const debug = {
    myPokemon: my.pokemonIdx,
    oppPokemon: oppP.id,
    myNature: my.nature,
    myEvs: { ...(my.evs || {}) },
    myStats: { ...myStatsForDebug },
    myMove: myMoveData?.id || '',
    oppMove: oppMoveData?.id || '',
    observedTheir,
    observedMy,
    myCurrentHp,
    field: rcActiveFieldSummary(field),
    turnOrder: revCalcState.turnOrder,
    itemCount: revCalcState.itemCandidates.length,
    hasNoItem: revCalcState.itemCandidates.includes(''),
    hasDef: !!hasDef,
    hasAtk: !!hasAtk,
    stage1: 0,
    stage1Trimmed: 0,
    refined: 0,
    speedRemoved: 0,
    budgetRemoved: 0,
    scarfSkipped: 0,
  };

  if (hasDef && hasAtk) {
    // Full 모드
    mode = 'full';
    const defStat = myMove.cat === 'Physical' ? 'def' : 'spd';
    const atkStat = oppMove.cat === 'Physical' ? 'atk' : 'spa';
    const stage1Raw = rcStage1Defense(my, oppP, myMove, observedTheir, field, defStat);
    debug.stage1 = stage1Raw.length;
    const stage1 = stage1Raw
      .sort((a, b) => (b.defScore - a.defScore) || ((b.hpEv >= b.defEv) - (a.hpEv >= a.defEv)) || (a.hpEv + a.defEv - b.hpEv - b.defEv))
      .slice(0, 1200);
    debug.stage1Trimmed = stage1.length;
    candidates = rcStage3OffenseRefine(stage1, my, oppP, oppMove, observedMy, field, atkStat);
    debug.refined = candidates.length;
  } else if (hasDef) {
    mode = 'def-only';
    const defStat = myMove.cat === 'Physical' ? 'def' : 'spd';
    const stage1 = rcStage1Defense(my, oppP, myMove, observedTheir, field, defStat);
    debug.stage1 = stage1.length;
    debug.stage1Trimmed = stage1.length;
    const speedItems = revCalcState.turnOrder === 'unknown' ? [''] : ['', 'choicescarf'].filter(item => revCalcState.itemCandidates.includes(item));
    candidates = stage1.flatMap(c => speedItems.map(item => ({ ...c, item, totalScore: c.defScore })));
    debug.refined = candidates.length;
  } else {
    mode = 'atk-only';
    const atkStat = oppMove.cat === 'Physical' ? 'atk' : 'spa';
    candidates = rcStage3OffenseOnly(my, oppP, oppMove, observedMy, field, atkStat);
    debug.refined = candidates.length;
  }

  const rawTotal = candidates.length;
  const speedActive = revCalcState.turnOrder !== 'unknown';
  const shaped = [];
  for (const c of candidates) {
    if (!speedActive && c.item === 'choicescarf') {
      debug.scarfSkipped++;
      continue;
    }
    const speedInfo = rcSpeedCandidateInfo(oppP, c.nature || 'hardy', c.item || '', field);
    if (!speedInfo.valid) {
      debug.speedRemoved++;
      continue;
    }
    const withSpeed = { ...c, speedInfo, speEv: speedInfo.speEv };
    withSpeed.totalEv = rcCandidatePointSum(withSpeed);
    if (withSpeed.totalEv > 66) {
      debug.budgetRemoved++;
      continue;
    }
    shaped.push(withSpeed);
  }
  debug.afterFilter = shaped.length;
  candidates = shaped;

  // 정렬 + Top 8
  candidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // tie-break: EV 합 작은 우선 (단순한 spread 우선)
    return (a.totalEv || rcCandidatePointSum(a)) - (b.totalEv || rcCandidatePointSum(b));
  });

  return {
    results: candidates.slice(0, 8),
    total: candidates.length,
    rawTotal,
    filteredByRule: Math.max(0, rawTotal - candidates.length),
    mode,
    speedActive,
    myCurrentHp,
    mySpeed: rcMySpeedValue(),
    scarfViable: candidates.some(c => c.item === 'choicescarf'),
    nonScarfViable: candidates.some(c => c.item !== 'choicescarf'),
    debug,
  };
}

// === UI 렌더링 ===

function renderRevCalcMy() {
  const container = document.getElementById('rc-my-body');
  if (!container) return;
  const my = revCalcState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) { container.innerHTML = '<div class="empty-state">포켓몬 선택 필요</div>'; return; }
  const stats = calcStats(my);
  const totalEV = ['hp','atk','def','spa','spd','spe'].reduce((a,s) => a + (my.evs[s]||0), 0);
  const overEV = totalEV > 66;

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
    <div class="ft-stats-grid" style="grid-template-columns: 64px 56px 168px 60px 96px;">
      <div class="ft-stats-head"><div>스탯</div><div>종족값</div><div>노력치</div><div>실수치</div><div>랭크</div></div>
      ${statRows}
    </div>
    <div class="ft-ev-total ${overEV ? 'over' : ''}">
      노력치 합계: <b>${totalEV}</b> / 66 ${overEV ? '<span style="color:var(--atk);"> 초과!</span>' : ''}
    </div>
  `;
  rcWireMyComboboxes();
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

  // 내 포켓몬의 learnset 으로 기술 필터 (가능한 경우)
  const myLearnable = myP?.ls?.length > 0
    ? MOVES.filter(m => myP.ls.includes(m.id) && m.cat !== 'Status')
    : MOVES.filter(m => m.cat !== 'Status');
  const oppLearnable = oppP?.ls?.length > 0
    ? MOVES.filter(m => oppP.ls.includes(m.id) && m.cat !== 'Status')
    : MOVES.filter(m => m.cat !== 'Status');

  const myMoveData = revCalcState.myMove ? MoveById[revCalcState.myMove] : null;
  const oppMoveData = revCalcState.oppMove ? MoveById[revCalcState.oppMove] : null;

  const myMoveBpValue = revCalcState.myMoveBp !== '' ? revCalcState.myMoveBp : (myMoveData?.bp || '');
  const oppMoveBpValue = revCalcState.oppMoveBp !== '' ? revCalcState.oppMoveBp : (oppMoveData?.bp || '');
  const myStats = calcStats(my);
  const myCurrentHp = rcCurrentHpValue(my);
  const autoMySpeed = rcSpeedWithMods(myStats.spe, my.ranks?.spe || 0, my.item || '', my.status || 'none');

  // 도구 후보 체크박스 (type-boost 도구 + 그외 사용 가능 도구)
  const itemMaster = ITEMS.filter(i => !i.ms && !i.isBerry);
  const itemBoxes = itemMaster.map(i => `
    <label class="rc-item-chk">
      <input type="checkbox" data-rc-item="${i.id}" ${revCalcState.itemCandidates.includes(i.id) ? 'checked' : ''}>
      ${escapeHTML(itName(i))}
    </label>
  `).join('');

  container.innerHTML = `
    <div class="rc-input-grid">
      <div class="rc-input-block">
        <div class="ft-section-title">내 기술 (상대에게 줌)</div>
        <div class="ft-controls-row">
          <label class="field" style="flex:2;">
            <span class="field-label">기술</span>
            <select data-rc-action="myMove">
              <option value="">선택…</option>
              ${myLearnable.map(m => `<option value="${m.id}" ${revCalcState.myMove === m.id ? 'selected' : ''}>${escapeHTML(mvName(m))} (${m.type}/${m.cat}/${m.bp || '-'})</option>`).join('')}
            </select>
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">위력 (자동)</span>
            <input type="number" data-rc-action="myMoveBp" value="${myMoveBpValue}" min="0" max="999" placeholder="자동">
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">상대 남은 HP %</span>
            <input type="number" data-rc-action="observedTheirPct" value="${revCalcState.observedTheirPct}" min="0" max="100" placeholder="0~100">
          </label>
        </div>
      </div>

      <div class="rc-input-block">
        <div class="ft-section-title">상대 기술 (내가 받음)</div>
        <div class="ft-controls-row">
          <label class="field" style="flex:2;">
            <span class="field-label">기술</span>
            <select data-rc-action="oppMove">
              <option value="">선택…</option>
              ${oppLearnable.map(m => `<option value="${m.id}" ${revCalcState.oppMove === m.id ? 'selected' : ''}>${escapeHTML(mvName(m))} (${m.type}/${m.cat}/${m.bp || '-'})</option>`).join('')}
            </select>
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">위력 (자동)</span>
            <input type="number" data-rc-action="oppMoveBp" value="${oppMoveBpValue}" min="0" max="999" placeholder="자동">
          </label>
          <label class="field" style="flex:1;">
            <span class="field-label">내 남은 HP</span>
            <input type="number" data-rc-action="observedMyPct" value="${revCalcState.observedMyPct}" min="0" max="${myCurrentHp}" placeholder="0~${myCurrentHp}">
          </label>
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
          <label class="checkbox-label"><input type="checkbox" data-rc-field="defReflect" ${revCalcState.field.defReflect ? 'checked' : ''}> 리플렉터</label>
          <label class="checkbox-label"><input type="checkbox" data-rc-field="defLightScreen" ${revCalcState.field.defLightScreen ? 'checked' : ''}> 빛의장막</label>
          <label class="checkbox-label"><input type="checkbox" data-rc-field="isCritical" ${revCalcState.field.isCritical ? 'checked' : ''}> 급소</label>
        </div>
      </div>

      <div class="rc-input-block">
        <div class="ft-section-title">도구 후보 (분석 시 시도할 상대 보유 도구) — ${revCalcState.itemCandidates.length}개 선택됨</div>
        <div class="rc-item-grid">${itemBoxes}</div>
      </div>
    </div>
  `;
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

  const modeLabel = {
    full: '3중 교차 검증',
    'def-only': '내구 역산 + 속도',
    'atk-only': '화력 역산 + 속도',
  }[r.mode] || r.mode;

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
      `내 남은 HP ${escapeHTML(revCalcState.observedMyPct || '-')}`,
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
        ? '속도 조건까지 합치면 구애스카프 후보만 66포인트 안에 남습니다.'
        : r.scarfViable
          ? '구애스카프와 비스카프 후보가 함께 남아 있어 추가 관측이 필요합니다.'
          : '현재 조건에서는 구애스카프 없이도 속도 조건을 만족할 수 있습니다.')
    : '속도 조건은 사용하지 않았습니다.';
  const first = r.results[0];
  const topItem = first.item ? itName(ItemById[first.item] || { name: first.item }) : '도구 없음';
  const briefing = `상위 후보는 ${topItem}, ${NATURE_BY_ID[first.nature]?.ko || first.nature} 성격, 총 ${first.totalEv}포인트 사용 형태입니다. ${scarfBrief}`;
  const STAT_LABEL = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };

  const rows = r.results.map((c, i) => {
    const evDesc = [];
    if (c.hpEv > 0) evDesc.push(`H${c.hpEv}`);
    if (c.defEv > 0) evDesc.push(`${STAT_LABEL[c.defStat]}${c.defEv}`);
    if (c.atkEv > 0) evDesc.push(`${STAT_LABEL[c.atkStat]}${c.atkEv}`);
    if ((c.speEv || 0) > 0 || r.speedActive) evDesc.push(`S${c.speEv || 0}`);
    const natureKo = NATURE_BY_ID[c.nature]?.ko || c.nature;
    const itemTag = c.item
      ? `<span class="rc-result-item ${c.item === 'choicescarf' ? 'rc-scarf-item' : ''}">${escapeHTML(itName(ItemById[c.item] || { name: c.item }))}</span>`
      : '<span class="rc-result-item rc-no-item">도구 없음</span>';
    const scorePct = Math.round((c.totalScore || 0) * 100);
    const defHit = c.defScore ? `${Math.round(c.defScore * 16)}/16` : '-';
    const atkHit = c.atkScore ? `${Math.round(c.atkScore * 16)}/16` : '-';
    const statsLine = [];
    if (c.oppHp) statsLine.push(`HP ${c.oppHp}`);
    if (c.oppDef) statsLine.push(`${STAT_LABEL[c.defStat]} ${c.oppDef}`);
    if (c.oppAtk) statsLine.push(`${STAT_LABEL[c.atkStat]} ${c.oppAtk}`);
    if (c.speedInfo?.active) statsLine.push(`속도 ${c.speedInfo.oppSpeed} (내 ${c.speedInfo.mySpeed})`);
    const speedRange = c.speedInfo?.active
      ? `S 가능범위 ${c.speedInfo.speMin}~${c.speedInfo.speMax}`
      : '속도 미사용';
    return `
      <div class="rc-result-row rc-form-result">
        <div class="rc-result-rank">#${i + 1}</div>
        <div class="rc-result-stars"><b>${scorePct}%</b><small>난수 ${defHit} / ${atkHit}</small></div>
        <div class="rc-result-spread">
          <b>${evDesc.join(' / ') || '무투자'}</b>
          <span class="rc-result-nature">(${natureKo})</span>
          ${itemTag}
        </div>
        <div class="rc-result-stats">
          <span>${statsLine.join(' · ') || '실수치 정보 없음'}</span>
          <small>${speedRange} · 총 ${c.totalEv}/66</small>
        </div>
        <div class="rc-result-action">
          <button class="rc-apply-btn" data-rc-applyresult="${i}" title="이 후보를 계산기 방어측에 적용">계산기 적용</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rc-briefing">
      <div class="rc-briefing-title">인텔리전스 브리핑</div>
      <div>${escapeHTML(briefing)}</div>
    </div>
    <div class="rc-results-summary">
      모드: <b>${modeLabel}</b> · 생존 후보 <b>${r.total}</b>개 · 제거 후보 <b>${r.filteredByRule || 0}</b>개 · 내 속도 기준 <b>${r.mySpeed}</b>
    </div>
    <div class="rc-results-list">${rows}</div>
    <div class="rc-hint">상대는 남은 HP%의 정수 내림값, 내 포켓몬은 남은 HP 실수치를 기준으로 16단계 난수 중 일치한 횟수를 표시합니다.</div>
  `;
}

function renderRevCalcAll() {
  renderRevCalcMy();
  renderRevCalcOpp();
  renderRevCalcInputs();
  renderRevCalcResults();
}

// === 콤보박스 / 이벤트 ===

function rcSyncInputsFromDom() {
  const root = document.getElementById('page-revcalc');
  if (!root) return;
  const evInputs = Array.from(root.querySelectorAll('[data-rc-ev]'));
  if (evInputs.length) {
    const requested = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    evInputs.forEach(el => {
      const stat = el.dataset.rcEv;
      if (stat in requested) requested[stat] = Math.max(0, Math.min(32, parseInt(el.value, 10) || 0));
    });
    let remaining = 66;
    ['hp','atk','def','spa','spd','spe'].forEach(stat => {
      const value = Math.min(requested[stat], remaining);
      revCalcState.my.evs[stat] = value;
      remaining -= value;
    });
  }
  root.querySelectorAll('[data-rc-action]').forEach(el => {
    const action = el.dataset.rcAction;
    if (!action) return;
    if (action === 'myMove') revCalcState.myMove = el.value;
    else if (action === 'myNature') revCalcState.my.nature = el.value;
    else if (action === 'myAbility') revCalcState.my.ability = el.value;
    else if (action === 'oppStatus') revCalcState.opp.status = el.value;
    else if (action === 'oppMove') revCalcState.oppMove = el.value;
    else if (action === 'myMoveBp') revCalcState.myMoveBp = el.value;
    else if (action === 'oppMoveBp') revCalcState.oppMoveBp = el.value;
    else if (action === 'observedTheirPct') revCalcState.observedTheirPct = el.value;
    else if (action === 'observedMyPct') revCalcState.observedMyPct = el.value;
    else if (action === 'turnOrder') revCalcState.turnOrder = el.value;
    else if (action === 'mySpeedOverride') revCalcState.mySpeedOverride = el.value;
  });
  const nextField = rcDefaultField();
  root.querySelectorAll('[data-rc-field]').forEach(el => {
    const key = el.dataset.rcField;
    nextField[key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  revCalcState.field = nextField;
  const itemBoxes = root.querySelectorAll('[data-rc-item]');
  if (itemBoxes.length) {
    const selectedItems = Array.from(itemBoxes).filter(el => el.checked).map(el => el.dataset.rcItem).filter(Boolean);
    revCalcState.itemCandidates = ['', ...selectedItems.filter((id, idx, arr) => arr.indexOf(id) === idx)];
  }
}

function rcWireMyComboboxes() {
  document.getElementById('rc-my-body').querySelectorAll('.rc-cb-input').forEach(input => {
    const target = input.dataset.rcPick;
    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      const data = target === 'my' ? sortPokemonForCalcSelect(POKEMON) : ITEMS;
      const allMatches = data.filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s));
      const matches = target === 'my' ? allMatches : allMatches.slice(0, 30);
      const items = matches.map(m => {
        const label = target === 'my' ? pkName(m) : itName(m);
        const sub = target === 'my' ? `${m.types.join('/')} BST ${m.bst}` : (m.desc || '').slice(0, 30);
        return `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(label)}</b> <small>${escapeHTML(sub)}</small></div>`;
      });
      if (target === 'myitem') items.unshift('<div class="combobox-option" data-id=""><b>없음</b></div>');
      optsEl.innerHTML = items.join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOpts(e.target.value));
    input.addEventListener('input', e => showOpts(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      const id = opt.dataset.id;
      if (target === 'my') {
        const p = PokemonById[id];
        revCalcState.my.pokemonIdx = id;
        if (p) {
          revCalcState.my.ability = toId(p.ab['0'] || p.ab['H'] || '');
          revCalcState.my.teraType = p.types[0];
        }
        revCalcState.myMove = '';
        revCalcState.myMoveBp = '';
      } else {
        revCalcState.my.item = id || '';
      }
      renderRevCalcAll();
    });
  });
}

function rcWireOppComboboxes() {
  document.getElementById('rc-opp-body').querySelectorAll('.rc-cb-input').forEach(input => {
    const cb = input.closest('.combobox');
    const optsEl = cb.querySelector('.combobox-options');
    const showOpts = q => {
      const s = (q || '').toLowerCase();
      const matches = sortPokemonForCalcSelect(POKEMON).filter(d => (d.koName||'').toLowerCase().includes(s) || d.name.toLowerCase().includes(s));
      optsEl.innerHTML = matches.map(m =>
        `<div class="combobox-option" data-id="${m.id}"><b>${escapeHTML(pkName(m))}</b> <small>${m.types.join('/')} BST ${m.bst}</small></div>`
      ).join('');
      optsEl.classList.add('open');
    };
    input.addEventListener('focus', e => showOpts(e.target.value));
    input.addEventListener('input', e => showOpts(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => optsEl.classList.remove('open'), 200));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt) return;
      e.preventDefault();
      revCalcState.opp.pokemonIdx = opt.dataset.id;
      revCalcState.oppMove = '';
      revCalcState.oppMoveBp = '';
      renderRevCalcAll();
    });
  });
}

// 위임 이벤트 핸들러
document.getElementById('page-revcalc')?.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rcEv) {
    const stat = t.dataset.rcEv;
    const evs = revCalcState.my.evs;
    const requested = Math.max(0, Math.min(32, parseInt(t.value, 10) || 0));
    const otherSum = ['hp','atk','def','spa','spd','spe'].reduce((a, k) => k === stat ? a : a + (evs[k] || 0), 0);
    evs[stat] = Math.min(requested, Math.max(0, 66 - otherSum));
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcAction === 'myNature') { revCalcState.my.nature = t.value; renderRevCalcMy(); renderRevCalcInputs(); return; }
  if (t.dataset.rcAction === 'myAbility') { revCalcState.my.ability = t.value; return; }
  if (t.dataset.rcAction === 'oppStatus') { revCalcState.opp.status = t.value; return; }
  if (t.dataset.rcAction === 'myMove') {
    revCalcState.myMove = t.value;
    revCalcState.myMoveBp = '';   // 자동 채움
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcAction === 'oppMove') {
    revCalcState.oppMove = t.value;
    revCalcState.oppMoveBp = '';
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcAction === 'myMoveBp') { revCalcState.myMoveBp = t.value; return; }
  if (t.dataset.rcAction === 'oppMoveBp') { revCalcState.oppMoveBp = t.value; return; }
  if (t.dataset.rcAction === 'observedTheirPct') { revCalcState.observedTheirPct = t.value; return; }
  if (t.dataset.rcAction === 'observedMyPct') { revCalcState.observedMyPct = t.value; return; }
  if (t.dataset.rcAction === 'turnOrder') { revCalcState.turnOrder = t.value; renderRevCalcInputs(); return; }
  if (t.dataset.rcAction === 'mySpeedOverride') { revCalcState.mySpeedOverride = t.value; renderRevCalcInputs(); return; }
  if (t.dataset.rcField) {
    const k = t.dataset.rcField;
    const v = t.type === 'checkbox' ? t.checked : t.value;
    revCalcState.field[k] = v;
    return;
  }
  if (t.dataset.rcItem !== undefined) {
    const id = t.dataset.rcItem;
    if (t.checked && !revCalcState.itemCandidates.includes(id)) revCalcState.itemCandidates.push(id);
    if (!t.checked) revCalcState.itemCandidates = revCalcState.itemCandidates.filter(x => x !== id);
    renderRevCalcInputs();
    return;
  }
});

document.getElementById('page-revcalc')?.addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset?.rcAction) return;
  if (t.dataset.rcAction === 'myMoveBp') revCalcState.myMoveBp = t.value;
  if (t.dataset.rcAction === 'oppMoveBp') revCalcState.oppMoveBp = t.value;
  if (t.dataset.rcAction === 'observedTheirPct') revCalcState.observedTheirPct = t.value;
  if (t.dataset.rcAction === 'observedMyPct') revCalcState.observedMyPct = t.value;
  if (t.dataset.rcAction === 'mySpeedOverride') revCalcState.mySpeedOverride = t.value;
});

document.getElementById('page-revcalc')?.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.rcEvset !== undefined) {
    const stat = t.dataset.rcEvset;
    const evs = revCalcState.my.evs;
    const requested = parseInt(t.dataset.rcEvval, 10) || 0;
    const otherSum = ['hp','atk','def','spa','spd','spe'].reduce((a, k) => k === stat ? a : a + (evs[k] || 0), 0);
    evs[stat] = Math.min(requested, Math.max(0, 66 - otherSum));
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcRank) {
    const stat = t.dataset.rcRank;
    const dir = parseInt(t.dataset.rcDir, 10);
    revCalcState.my.ranks[stat] = Math.max(-6, Math.min(6, (revCalcState.my.ranks[stat] || 0) + dir));
    renderRevCalcMy();
    renderRevCalcInputs();
    return;
  }
  if (t.dataset.rcOpprank) {
    const stat = t.dataset.rcOpprank;
    const dir = parseInt(t.dataset.rcDir, 10);
    revCalcState.opp.ranks[stat] = Math.max(-6, Math.min(6, (revCalcState.opp.ranks[stat] || 0) + dir));
    renderRevCalcOpp();
    return;
  }
  if (t.dataset.rcApplyresult !== undefined) {
    rcApplyResultToCalc(parseInt(t.dataset.rcApplyresult, 10));
    return;
  }
});

// 분석 시작
document.getElementById('rcAnalyze')?.addEventListener('click', async () => {
  rcSyncInputsFromDom();
  revCalcState.analyzing = true;
  renderRevCalcResults();
  // UI 업데이트 후 분석 (heavy → 다음 frame)
  await new Promise(resolve => setTimeout(resolve, 30));
  try {
    revCalcState.results = rcAnalyze();
  } catch (e) {
    revCalcState.results = { error: '분석 실패: ' + e.message };
  }
  revCalcState.analyzing = false;
  renderRevCalcResults();
});

// 결과 spread 를 계산기 방어측에 적용
function rcApplyResultToCalc(idx) {
  const r = revCalcState.results;
  if (!r || !r.results || !r.results[idx]) return;
  const c = r.results[idx];
  const oppP = PokemonById[revCalcState.opp.pokemonIdx];
  if (!oppP) return;
  // 새 def state 빌드
  const defState = makeSideState(oppP.id);
  defState.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (c.hpEv) defState.evs.hp = c.hpEv;
  if (c.defEv) defState.evs[c.defStat] = c.defEv;
  if (c.atkEv) defState.evs[c.atkStat] = c.atkEv;
  if (c.speEv) defState.evs.spe = c.speEv;
  defState.nature = c.nature;
  if (c.item) defState.item = c.item;
  defState.ranks = { ...revCalcState.opp.ranks };
  defState.status = revCalcState.opp.status || 'none';
  // 적용
  state.def = defState;
  state.atk = JSON.parse(JSON.stringify(revCalcState.my));
  // 필드 상태 적용
  Object.assign(state.field, revCalcState.field);
  renderSide('atk');
  renderSide('def');
  triggerCalc();
  const calcNav = document.querySelector('.nav-tab[data-page="calc"]');
  if (calcNav) calcNav.click();
}

// 계산기 → 형태 역계산 sync
function loadSideToRevCalc(sideKey) {
  const src = state[sideKey];
  revCalcState.my = JSON.parse(JSON.stringify(src));
  const otherKey = sideKey === 'atk' ? 'def' : 'atk';
  revCalcState.opp.pokemonIdx = state[otherKey].pokemonIdx;
  revCalcState.opp.ranks = { ...state[otherKey].ranks };
  revCalcState.opp.status = state[otherKey].status || 'none';
  revCalcState.mySpeedOverride = '';
  revCalcState.field = rcDefaultField();
  const navBtn = document.querySelector('.nav-tab[data-page="revcalc"]');
  if (navBtn) navBtn.click();
  renderRevCalcAll();
}
window.loadSideToRevCalc = loadSideToRevCalc;
