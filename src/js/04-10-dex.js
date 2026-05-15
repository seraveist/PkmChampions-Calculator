/* Dex navigation, lists, details, and calculator handoff.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
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

// 도감에서 계산기 사이드로 포켓몬 적용. 실제 상태 변경 규칙은 calc state helper에 위임한다.
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


