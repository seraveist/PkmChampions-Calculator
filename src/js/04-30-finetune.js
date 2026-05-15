/* Fine-tune EV planner.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
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

// Fine-tune helpers: keep this tab aligned with the calculator engine.
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

function ftMySpeed(my) {
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

function ftOppSpeedCase(opp, ev, natureSpec, options = {}) {
  const manual = ftOpponentManualSpeed(opp);
  if (!options.ignoreManual && manual !== null) return manual;
  if (!PokemonById[opp?.pokemonIdx]) return 0;
  return effectiveSpeed(ftOpponentSideForCase(opp, ev, natureSpec), ftDefaultField());
}

function ftFindMinSpeedEv(my, targetSpeed) {
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

function ftBuildSpeedTable() {
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

function ftWireMyComboboxes() { ftWireComboboxes('ft-my-body'); }
function ftWireOppComboboxes() { ftWireComboboxes('ft-opp-body'); }

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

function ftMagicNumbers(side, stat) {
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

function ftEvSummary(side) {
  const total = ftStatKeys().reduce((sum, stat) => sum + (side.evs?.[stat] || 0), 0);
  return {
    total,
    remaining: Math.max(0, 66 - total),
    over: total > 66,
  };
}

function ftRenderTypePills(types) {
  return (types || [])
    .filter(Boolean)
    .map(type => `<span class="type-pill t-${type}">${TYPE_KO[type] || type}</span>`)
    .join('');
}

function ftNatureMark(stat, natureId) {
  const nature = NATURE_BY_ID?.[natureId];
  if (nature?.up === stat) return '<span class="ft-nature-up">+</span>';
  if (nature?.down === stat) return '<span class="ft-nature-down">-</span>';
  return '';
}

function ftRenderMagicCell(side, stat, ev) {
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

function ftBulkMetrics(side) {
  const stats = calcStats(side);
  return {
    stats,
    phys: Math.round(stats.hp * stats.def / 0.411),
    spec: Math.round(stats.hp * stats.spd / 0.411),
  };
}

function ftBaseStatsMini(p) {
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

function renderFineTuneSummary() {
  const container = document.getElementById('ft-summary-body');
  if (!container) return;
  const my = fineTuneState.my;
  const p = PokemonById[my.pokemonIdx];
  if (!p) {
    container.innerHTML = '';
    return;
  }
  const ev = ftEvSummary(my);
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

function ftBreakpointDistance(side, info) {
  const curEv = side.evs?.hp || 0;
  if (info.current) return 0;
  const candidates = [];
  if (info.next) candidates.push(info.next.ev - curEv);
  if (info.prev) candidates.push(curEv - info.prev.ev);
  return candidates.length ? Math.min(...candidates) : 999;
}

function ftBreakpointBadges(side, info) {
  const curEv = side.evs?.hp || 0;
  const badges = [];
  if (info.current) badges.push('<span class="ft-breakpoint-delta current">충족</span>');
  if (!info.current && info.next) badges.push(`<span class="ft-breakpoint-delta next">+${info.next.ev - curEv}pt</span>`);
  if (!info.current && info.prev) badges.push(`<span class="ft-breakpoint-delta prev">-${curEv - info.prev.ev}pt</span>`);
  if (!badges.length) badges.push('<span class="ft-breakpoint-delta none">불가</span>');
  return badges.join('');
}

function ftBreakpointGroupKey(info) {
  return info.rule.rule;
}

function ftUniqueJoin(values, separator = ' · ') {
  return [...new Set(values.filter(Boolean))].join(separator);
}

function ftGroupHpBreakpoints(side, rows) {
  const groups = new Map();
  rows.forEach(info => {
    const key = ftBreakpointGroupKey(info);
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
    group.distance = Math.min(group.distance, ftBreakpointDistance(side, info));
    if (info.current || !group.sample.current) group.sample = info;
  });
  return [...groups.values()];
}

function renderFineTuneHp() {
  const container = document.getElementById('ft-hp-body');
  if (!container) return;
  const my = fineTuneState.my;
  if (!PokemonById[my.pokemonIdx]) {
    container.innerHTML = '';
    return;
  }
  const rows = ftHpBreakpoints(my)
    .filter(info => info.rule.relevant || info.current || info.next || info.prev);
  const groups = ftGroupHpBreakpoints(my, rows);

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
              <b>${escapeHTML(ftUniqueJoin(group.entries.map(info => info.rule.rule)))}</b>
              <span>${escapeHTML(ftUniqueJoin(group.entries.map(info => info.rule.desc), ' / '))}</span>
            </div>
            <div class="ft-breakpoint-deltas">${ftBreakpointBadges(my, group.sample)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

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
  const bulk = ftBulkMetrics(my);
  const rankStats = ['atk','def','spa','spd','spe'];
  const typeBadges = ftRenderTypePills(normalizeSideTypes(my));
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
        <div class="ft-stat-name">${STAT_LABEL?.[stat] || stat} ${ftNatureMark(stat, my.nature)}</div>
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
        ${ftRenderMagicCell(my, stat, ev)}
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

function renderFineTuneOpp() {
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
      ${p ? `<div class="ft-type-strip">${ftRenderTypePills(p.types)}</div>${ftBaseStatsMini(p)}` : ''}
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

function renderFineTuneSpeed() {
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

function renderFineTuneAll() {
  renderFineTuneMy();
  renderFineTuneSummary();
  renderFineTuneHp();
  renderFineTuneOpp();
  renderFineTuneSpeed();
}


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


