/* Dex navigation, filtering, sorting, pagination, and list rendering. */
/* Dex navigation, lists, details, and calculator handoff.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
// 도감 탭 및 검색 제어
let currentDex = 'pokemon';
let dexTypeFilter = [];          // 빈 배열 = 전체. 포켓몬 탭은 최대 2개, 기술 탭은 최대 1개.
let dexItemCategory = null;      // 도구 탭의 카테고리 필터 (null = 전체, 'equip'/'berry'/'mega')
const DEX_TABS = ['pokemon', 'moves', 'abilities', 'items'];
const DEX_PAGE_SIZE = 24;
const dexViewState = Object.fromEntries(DEX_TABS.map(tab => [tab, {
  query: '',
  typeFilter: [],
  itemCategory: null,
  scope: 'current',
  page: 1,
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
// Conditions use the same mechanic keys as the calculator, rather than a second move ID list.
const DEX_POWER_NOTES = {
  gyroBall: '상대보다 느릴수록 위력 증가',
  electroBall: '상대보다 빠를수록 위력 증가',
  weightRatio: '상대보다 무거울수록 위력 증가', targetWeight: '상대가 무거울수록 위력 증가',
  userHp150: '자신의 남은 HP 비율에 비례', lowHpFlail: '자신의 남은 HP 비율이 낮을수록 위력 증가',
  targetHp100: '상대의 남은 HP 비율이 낮을수록 위력 감소',
  targetStatusDouble: '상대가 상태이상이면 ×2', targetPoisonDouble: '상대가 독·맹독이면 ×2',
  userStatusDouble: '자신이 화상·마비·독·맹독이면 ×2',
  knockOff: '상대가 제거 가능한 도구를 지니면 ×1.5 · 해당 포켓몬의 메가스톤 제외',
  userMovesFirstDouble: '상대보다 먼저 행동하면 ×2', userMovesSecondDouble: '상대보다 나중에 행동하면 ×2',
  userWasHitDouble: '이번 턴 상대의 공격으로 피해를 받았으면 ×2', targetWasHitDouble: '상대가 이번 턴 이미 피해를 받았으면 ×2',
  electricTerrainTargetGroundedDouble: '일렉트릭필드에서 상대가 땅에 있으면 ×2',
  psychicTerrainUserGroundedBoost: '사이코필드에서 자신이 땅에 있으면 ×1.5',
  mistyTerrainUserGroundedBoost: '미스트필드에서 자신이 땅에 있으면 ×1.5', gravityBoost: '중력 상태에서 ×1.5',
  weatherWeakenedSolar: '비·모래바람·눈에서 ×0.5 · 날씨가 없으면 원래 위력',
  weatherBall: '날씨가 있으면 위력 100 · 날씨에 따라 타입 변경',
  terrainPulse: '필드에서 자신이 땅에 있으면 위력 100 · 필드에 따라 타입 변경',
  positiveBoostCount: '상승한 능력치 랭크 합계당 위력 +20', fallenAllies: '쓰러진 동료 수에 따라 위력 증가',
  noItemDouble: '도구를 지니지 않았으면 ×2', lastMoveFailedDouble: '직전 기술이 실패했으면 ×2',
  tripleAxelAverage: '1·2·3타 위력 20·40·60', beatUpApprox: '참가하는 동료의 공격 종족값에 따라 각 타격의 위력 결정',
  fickleBeam: '기본 위력 80 · 강화 발동 시 160', fling: '던지는 도구에 따라 위력 결정',
  stockpile: '비축 1·2·3회에 따라 위력 100·200·300',
  requiresTargetItem: '상대가 도구를 지니고 있어야 사용 가능', requiresTerrain: '필드가 있어야 사용 가능',
};
function movePowerNote(move) {
  if (move.ohko) return '명중하면 상대를 쓰러뜨리는 일격기';
  if (move.damage === 'level') return '자신의 레벨만큼 고정 피해';
  if (typeof move.damage === 'number') return `${move.damage} 고정 피해`;
  const fixed = {
    targetHalfHp: '상대의 현재 HP 절반만큼 피해', sourceCurrentHp: '자신의 현재 HP만큼 피해',
    targetMinusSourceHp: '상대의 현재 HP를 자신의 현재 HP와 같게 만듦',
    receivedDamage: `받은 ${move.receivedDamageCategory === 'Physical' ? '물리 ' : move.receivedDamageCategory === 'Special' ? '특수 ' : ''}피해의 ${move.receivedDamageMultiplier || 1}배`,
  };
  if (move.fixedDamageKind) return fixed[move.fixedDamageKind] || '조건에 따른 고정 피해';
  if (move.id === 'ragefist') return '공격을 받은 횟수에 따라 위력 증가';
  return DEX_POWER_NOTES[move.variableBpKind] || '';
}

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
  if (move.cat === 'Status') return '—';
  if (move.ohko) return '일격';
  if (move.damage || move.fixedDamageKind) return '고정 피해';
  if (move.variableBpKind === 'fickleBeam') return '80/160';
  if (movePowerNote(move) && (!move.bp || move.bp === 1)) return '가변';
  return move.bp || '—';
}
function dexMoveIsVariable(move) {
  return move.cat !== 'Status' && !move.damage && !move.fixedDamageKind && !move.ohko
    && !!movePowerNote(move) && !['requiresTargetItem', 'requiresTerrain'].includes(move.variableBpKind);
}
function dexEntryIsCurrent(entry, tab) {
  if (tab === 'moves') return entry.id === 'struggle' || !!PokemonByMove[entry.id]?.length;
  if (tab === 'abilities') return !!PokemonByAbility[entry.id]?.length;
  return true;
}
function dexScopeEntries(entries, tab) {
  return dexViewState[tab].scope === 'all' ? [...entries] : entries.filter(entry => dexEntryIsCurrent(entry, tab));
}
function dexReferenceLabel(entry, tab) {
  return dexEntryIsCurrent(entry, tab) ? '' : '참고 · 수록 포켓몬 중 대상 없음';
}
function renderDexScopeFilter() {
  const el = document.getElementById('dexScopeFilter');
  if (!el) return;
  el.hidden = !['moves', 'abilities'].includes(currentDex);
  if (el.hidden) return;
  const scope = dexViewState[currentDex].scope;
  renderTrustedHTML(el, [['current', '수록 포켓몬 기준'], ['all', '전체 참고']].map(([value, label]) => uiButton(label, {
    class: `ui-button ui-button--filter type-filter-btn ${scope === value ? 'active' : ''}`, 'data-dex-scope': value, 'aria-pressed': String(scope === value),
  })).join(''));
}
function dexTypePill(type, extraClass = '') {
  return `<span class="type-pill dex-type-pill t-${type} ${extraClass}">${TYPE_KO[type] || type}</span>`;
}
function dexMoveCategoryBadge(cat) {
  const cls = cat === 'Physical' ? 'cat-phys' : cat === 'Special' ? 'cat-spec' : 'cat-stat';
  return `<span class="cat-badge dex-cat-badge ${cls}">${moveCategoryLabel(cat)}</span>`;
}
function dexTag(label, variant = '') {
  const variantClass = {
    mega: 'dex-tag-mega',
    berry: 'dex-tag-berry',
    choice: 'dex-tag-choice',
    gem: 'dex-tag-gem',
    equip: 'dex-tag-equip',
  }[variant] || '';
  return `<span class="dex-tag ${variantClass}">${escapeHTML(label)}</span>`;
}
function dexAttr(text) {
  return escapeHTML(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function dexEmptyText(text) {
  return `<div class="dex-empty-text">${escapeHTML(text)}</div>`;
}
function dexDescriptionBlock(shortDesc, longDesc) {
  if (!shortDesc && !longDesc) return dexEmptyText('설명 데이터 없음');
  let html = '';
  if (shortDesc) html += `<div class="dex-desc-main">${escapeHTML(shortDesc)}</div>`;
  if (longDesc && longDesc !== shortDesc) html += `<div class="dex-desc-long">${escapeHTML(longDesc)}</div>`;
  return html;
}
function pokemonFormLabel(p) {
  if (!p?.forme) return '';
  return FORM_LABEL_KO[p.forme] || p.forme;
}
function pokemonListName(p) {
  const name = pkName(p);
  const megaBadge = p.mega ? ' <span class="badge-mega">메가</span>' : '';
  return `${escapeHTML(name)}${megaBadge}`;
}

function dexAbilityLabel(abilityName) {
  if (!abilityName) return '<span class="dex-empty-inline">—</span>';
  const data = AbilityById[toId(abilityName)];
  return escapeHTML(data ? abName(data) : abilityName);
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
  renderDexScopeFilter();
  const el = document.getElementById('dexTypeFilter');
  if (!el) return;
  if (currentDex === 'pokemon' || currentDex === 'moves') {
    el.style.display = 'flex';
    const isAll = dexTypeFilter.length === 0;
    const all = uiButton('전체', {
      class: `ui-button ui-button--filter type-filter-btn ${isAll ? 'active' : ''}`,
      'data-filter-type': '', 'aria-pressed': String(isAll),
    });
    const buttons = BATTLE_TYPES.map(t => {
      const active = dexTypeFilter.includes(t);
      return uiButton(TYPE_KO[t], {
        class: `ui-button ui-button--filter type-filter-btn type-pill-mini ${active ? 'active' : ''}`,
        'data-filter-type': t, 'aria-pressed': String(active),
        title: TYPE_KO[t],
      });
    }).join('');
    const limit = currentDex === 'pokemon' ? '<span class="dex-filter-limit">최대 2개</span>' : '';
    renderTrustedHTML(el, `${all}${buttons}${limit}`);
  } else if (currentDex === 'items') {
    el.style.display = 'flex';
    const isAll = dexItemCategory === null;
    const all = uiButton('전체', {
      class: `ui-button ui-button--filter type-filter-btn ${isAll ? 'active' : ''}`,
      'data-filter-itemcat': '', 'aria-pressed': String(isAll),
    });
    const buttons = ITEM_CATEGORY_ORDER.map(cat => {
      const active = dexItemCategory === cat;
      return uiButton(ITEM_CATEGORY_LABEL[cat], {
        class: `ui-button ui-button--filter type-filter-btn ${active ? 'active' : ''}`,
        'data-filter-itemcat': cat, 'aria-pressed': String(active),
      });
    }).join('');
    renderTrustedHTML(el, `${all}${buttons}`);
  } else {
    el.style.display = 'none';
  }
}

function dexTableWrap(tab = currentDex) {
  return document.querySelector(`#dex-${tab} .dex-table-wrap`);
}
function setDexFullPageMode(active) {
  document.getElementById('page-dex')?.classList.toggle('dex-fullpage-mode', !!active);
  const filterFrame = document.querySelector('#page-dex .dex-filter-frame');
  if (filterFrame) filterFrame.hidden = !!active;
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

function resetDexListPosition(tab = currentDex, { reveal = false } = {}) {
  const state = dexViewState[tab];
  if (state) {
    state.scrollTop = 0;
    state.scrollLeft = 0;
  }
  requestAnimationFrame(() => {
    const wrap = dexTableWrap(tab);
    if (!wrap) return;
    wrap.scrollTop = 0;
    wrap.scrollLeft = 0;
    if (reveal && window.matchMedia('(max-width: 760px)').matches) {
      wrap.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  });
}
function updateDexSortIndicators(tab = currentDex) {
  const sort = dexSortState[tab] || {};
  document.querySelectorAll(`#dex-${tab} th.sortable`).forEach(th => {
    const ascending = sort.key === th.dataset.sort && sort.dir === 'asc';
    const descending = sort.key === th.dataset.sort && sort.dir === 'desc';
    th.classList.toggle('sorted-asc', ascending);
    th.classList.toggle('sorted-desc', descending);
    th.setAttribute('aria-sort', ascending ? 'ascending' : descending ? 'descending' : 'none');
  });
}

function dexRowOpenButton(label, content) {
  return `<button type="button" class="dex-row-open" aria-label="${dexAttr(`${label} 상세 보기`)}">${content}</button>`;
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
    if (key === 'type') {
      const primaryType = entry.types?.[0] || '';
      const order = BATTLE_TYPES.indexOf(primaryType);
      return order >= 0 ? order : 999;
    }
    if (key === 'koName') return pkName(entry);
  }
  if (tab === 'moves') {
    if (key === 'koName') return mvName(entry);
    if (key === 'type') {
      const order = BATTLE_TYPES.indexOf(entry.type);
      return order >= 0 ? order : 999;
    }
    if (key === 'cat') {
      const order = { Physical: 0, Special: 1, Status: 2 };
      return order[entry.cat] ?? 999;
    }
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

function resetDexPage(tab = currentDex) {
  if (dexViewState[tab]) dexViewState[tab].page = 1;
}

function paginateDex(data, tab = currentDex) {
  const state = dexViewState[tab] || { page: 1 };
  const pageCount = Math.max(1, Math.ceil(data.length / DEX_PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(state.page) || 1), pageCount);
  state.page = page;
  const startIndex = (page - 1) * DEX_PAGE_SIZE;
  return {
    items: data.slice(startIndex, startIndex + DEX_PAGE_SIZE),
    page,
    pageCount,
    total: data.length,
    start: data.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + DEX_PAGE_SIZE, data.length),
  };
}

function renderDexPagination(tab, pageData) {
  const pagination = document.getElementById(`dexPagination-${tab}`);
  if (!pagination) return;
  const { page, pageCount, total, start, end } = pageData;
  renderTrustedHTML(pagination, `
    <span class="dex-page-status">${total ? `${start}-${end} / ${total}` : '검색 결과 없음'}</span>
    <span class="dex-page-actions">
      <button type="button" class="ui-label-action dex-page-button" data-dex-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>이전</button>
      <span class="dex-page-current" aria-label="전체 ${pageCount}페이지 중 ${page}페이지">${page} / ${pageCount}</span>
      <button type="button" class="ui-label-action dex-page-button" data-dex-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>다음</button>
    </span>
  `);
}

document.getElementById('dexTypeFilter')?.addEventListener('click', e => {
  const typeBtn = e.target.closest('[data-filter-type]');
  if (typeBtn) {
    closeDexDetail();
    closeDexFullPage();
    const t = typeBtn.dataset.filterType;
    if (t === '') dexTypeFilter = [];   // 전체 클릭 → 모두 해제
    else toggleTypeFilter(t);
    resetDexPage();
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
    resetDexPage();
    renderTypeFilter();
    renderDexContent(dexSearchEl?.value || '');
    return;
  }
});

const dexSearchEl = document.getElementById('dexSearch');
if (dexSearchEl) {
  const handleDexSearch = debounce((query) => {
    resetDexPage();
    renderDexContent(query);
  }, 200);
  dexSearchEl.addEventListener('input', e => handleDexSearch(e.target.value));
}

document.getElementById('dexResetFilters')?.addEventListener('click', () => {
  closeDexDetail();
  closeDexFullPage();
  dexTypeFilter = [];
  dexItemCategory = null;
  if (dexSortState[currentDex]) dexSortState[currentDex] = { key: null, dir: 'asc' };
  if (dexViewState[currentDex]) {
    dexViewState[currentDex].query = '';
    dexViewState[currentDex].typeFilter = [];
    dexViewState[currentDex].itemCategory = null;
    dexViewState[currentDex].scope = 'current';
    dexViewState[currentDex].page = 1;
    dexViewState[currentDex].scrollTop = 0;
    dexViewState[currentDex].scrollLeft = 0;
  }
  if (dexSearchEl) dexSearchEl.value = '';
  const wrap = dexTableWrap(currentDex);
  if (wrap) {
    wrap.scrollTop = 0;
    wrap.scrollLeft = 0;
  }
  renderTypeFilter();
  renderDexContent('');
});

document.getElementById('dexScopeFilter')?.addEventListener('click', e => {
  const button = e.target.closest('[data-dex-scope]');
  if (!button || !['current', 'all'].includes(button.dataset.dexScope)) return;
  dexViewState[currentDex].scope = button.dataset.dexScope;
  resetDexPage();
  renderDexScopeFilter();
  renderDexContent(dexSearchEl?.value || '');
  document.querySelector(`#dexScopeFilter [data-dex-scope="${button.dataset.dexScope}"]`)?.focus();
});

document.querySelectorAll('.dex-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    saveDexViewState(currentDex);
    const dexTabs = document.querySelectorAll('.dex-tab');
    const dexPanels = document.querySelectorAll('.dex-content');
    const activePanel = document.getElementById('dex-' + tab.dataset.dex);
    syncUiTabs(dexTabs, tab);
    syncUiPanels(dexPanels, activePanel);
    currentDex = tab.dataset.dex;
    closeDexFullPage();           // 탭 전환 시 풀페이지 상세 닫기
    restoreDexViewState(currentDex);
  });
});

const dexNav = document.querySelector('.dex-nav');
if (dexNav) {
  const dexTabs = document.querySelectorAll('.dex-tab');
  syncUiTabs(dexTabs, document.querySelector('.dex-tab.active'));
  bindUiTabKeyboard(dexNav);
}

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
    resetDexPage(tab);
    renderDexContent(dexSearchEl?.value || '');
  });
});

document.getElementById('page-dex')?.addEventListener('click', e => {
  const button = e.target.closest('[data-dex-page]');
  if (!button || button.disabled) return;
  const tab = button.closest('.dex-content')?.id?.replace('dex-', '');
  if (!tab || tab !== currentDex || !dexViewState[tab]) return;
  dexViewState[tab].page = Number(button.dataset.dexPage) || 1;
  renderDexContent(dexSearchEl?.value || '');
  resetDexListPosition(tab, { reveal: true });
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
      return [abN, data?.koName, data?.name];
    });
    return dexMatches(query, p.id, p.name, p.koName, p.base, p.forme, p.tier, ...dexTypeTerms(p.types), ...abilityTerms);
  });
  // 멀티 타입: 선택된 타입을 모두 가져야(AND)
  if (dexTypeFilter.length > 0) data = data.filter(p => dexTypeFilter.every(t => p.types.includes(t)));
  applyDexSort(data, 'pokemon');
  const tbody = document.getElementById('dexBodyPokemon');
  if(!tbody) return;
  const pageData = paginateDex(data, 'pokemon');
  renderTrustedHTML(tbody, pageData.items.map(p => {
    const ab = p.ab || {};
    const nameCell = `<span class="dex-pokemon-name-wrap">${pokemonSpriteSlot(p, { size: 'md', className: 'dex-list-sprite' })}<span class="dex-pokemon-name-text">${pokemonListName(p)}</span></span>`;
    return `<tr data-dex-id="${p.id}"><td class="dex-name-cell" data-label="이름">${dexRowOpenButton(pkName(p), nameCell)}</td><td class="dex-type-cell" data-label="타입">${p.types.map(t => dexTypePill(t)).join(' ')}</td><td class="num" data-label="HP">${p.bs.hp}</td><td class="num" data-label="공격">${p.bs.atk}</td><td class="num" data-label="방어">${p.bs.def}</td><td class="num" data-label="특공">${p.bs.spa}</td><td class="num" data-label="특방">${p.bs.spd}</td><td class="num" data-label="스피드">${p.bs.spe}</td><td class="num dex-bst" data-label="합계">${p.bst}</td><td class="dim dex-ability-cell" data-label="특성 1">${dexAbilityLabel(ab[0])}</td><td class="dim dex-ability-cell" data-label="특성 2">${dexAbilityLabel(ab[1])}</td><td class="dim dex-ability-cell" data-label="숨겨진 특성">${dexAbilityLabel(ab.H)}</td></tr>`;
  }).join(''));
  renderDexPagination('pokemon', pageData);
}
function renderMovesDex(query) {
  let data = dexScopeEntries(MOVES, 'moves');
  if (query) data = data.filter(m => dexMatches(query, m.id, m.name, m.koName, m.desc, m.descLong, m.type, TYPE_KO[m.type], m.cat, moveCategoryLabel(m.cat), movePowerNote(m), dexMoveTraits(m).join(' ')));
  if (dexTypeFilter.length > 0) data = data.filter(m => dexTypeFilter.includes(m.type));
  applyDexSort(data, 'moves');
  const tbody = document.getElementById('dexBodyMoves');
  if(!tbody) return;
  const pageData = paginateDex(data, 'moves');
  renderTrustedHTML(tbody, pageData.items.map(m => {
    const powerLabel = movePowerLabel(m);
    const variableBadge = dexMoveIsVariable(m) && powerLabel !== '가변' ? '<span class="dex-var-badge">가변</span>' : '';
    const reference = dexReferenceLabel(m, 'moves');
    return `<tr data-dex-id="${m.id}"><td class="dex-name-cell" data-label="이름">${dexRowOpenButton(mvName(m), escapeHTML(mvName(m)))}</td><td class="dex-type-cell" data-label="타입">${dexTypePill(m.type)}</td><td data-label="분류">${dexMoveCategoryBadge(m.cat)}</td><td class="num dex-power" data-label="위력">${powerLabel}${variableBadge}</td><td class="num" data-label="명중">${moveAccuracyLabel(m)}</td><td class="num" data-label="PP">${m.pp ?? '—'}</td><td class="num" data-label="우선도">${m.pri || 0}</td><td class="desc-cell" data-label="설명">${reference ? `<span class="dex-reference-note">${reference}</span>` : ''}${escapeHTML(m.desc || '')}</td></tr>`;
  }).join(''));
  renderDexPagination('moves', pageData);
}
function renderAbilitiesDex(query) {
  let data = dexScopeEntries(ABILITIES, 'abilities');
  if (query) data = data.filter(a => dexMatches(query, a.id, a.name, a.koName, a.desc, a.descLong, ...(PokemonByAbility[a.id] || []).map(p => pkName(p))));
  applyDexSort(data, 'abilities');
  const tbody = document.getElementById('dexBodyAbilities');
  if(!tbody) return;
  const pageData = paginateDex(data, 'abilities');
  renderTrustedHTML(tbody, pageData.items.map(a => `<tr data-dex-id="${a.id}"><td class="dex-name-cell" data-label="이름">${dexRowOpenButton(abName(a), escapeHTML(abName(a)))}</td><td class="dim dex-en-cell" data-label="영문명">${escapeHTML(a.name)}</td><td class="desc-cell" data-label="설명">${dexEntryIsCurrent(a, 'abilities') ? '' : `<span class="dex-reference-note">${dexReferenceLabel(a, 'abilities')}</span>`}${escapeHTML(a.desc || '')}</td></tr>`).join(''));
  renderDexPagination('abilities', pageData);
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
  const tbody = document.getElementById('dexBodyItems');
  if(!tbody) return;
  const pageData = paginateDex(data, 'items');
  // 카테고리별 그룹 헤더가 있는 단일 테이블 — 행 사이에 헤더 row 삽입
  const rows = [];
  let lastCat = null;
  for (const i of pageData.items) {
    const cat = itemCategoryOf(i);
    if (cat !== lastCat) {
      rows.push(`<tr class="dex-cat-header"><td colspan="4">${ITEM_CATEGORY_LABEL[cat]}</td></tr>`);
      lastCat = cat;
    }
    const tag = cat === 'mega' ? dexTag('메가스톤', 'mega')
      : cat === 'berry' ? dexTag('열매', 'berry')
      : (i.isChoice ? dexTag('고집계', 'choice')
        : i.isGem ? dexTag('젬', 'gem')
        : dexTag('장착형', 'equip'));
    rows.push(`<tr data-dex-id="${i.id}"><td class="dex-name-cell" data-label="이름">${dexRowOpenButton(itName(i), escapeHTML(itName(i)))}</td><td class="dim dex-en-cell" data-label="영문명">${escapeHTML(i.name)}</td><td class="desc-cell" data-label="설명">${escapeHTML(i.desc || '')}</td><td data-label="분류">${tag}</td></tr>`);
  }
  renderTrustedHTML(tbody, rows.join(''));
  renderDexPagination('items', pageData);
}
