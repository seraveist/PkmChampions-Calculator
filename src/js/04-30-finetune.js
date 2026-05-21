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
    baseSpe: '',
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
  if (typeof toolStatApplyPointValue === 'function') {
    toolStatApplyPointValue(fineTuneState.my, stat, requested, { stats: ftStatKeys(), maxTotal: 66 });
    return;
  }
  fineTuneState.my.evs[stat] = ftClampEvValue(stat, requested, fineTuneState.my.evs);
}

function ftDefaultField() {
  return {
    weather: 'none',
    terrain: 'none',
    gameType: state?.field?.gameType || 'Singles',
    isCritical: false,
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

function ftOpponentBaseSpeed(opp = fineTuneState.opp) {
  const text = String(opp?.baseSpe ?? '').trim();
  const manual = parseInt(text, 10);
  if (Number.isFinite(manual)) return Math.max(1, Math.min(255, manual));
  const pokemon = PokemonById[opp?.pokemonIdx];
  return Math.max(1, Math.min(255, pokemon?.bs?.spe || 1));
}

function ftNatureForSpeedCase(natureSpec) {
  if (typeof natureSpec === 'string') return natureSpec;
  return Number(natureSpec) > 1 ? 'jolly' : 'hardy';
}

function ftSpeedStatFromBase(baseSpe, ev, natureSpec) {
  const nature = NATURE_BY_ID[ftNatureForSpeedCase(natureSpec)] || null;
  const natureUp = nature?.up || null;
  const natureDown = nature?.down || null;
  let raw = Math.floor((2 * ftClampInt(baseSpe, 1, 255) + 31 + ftClampInt(ev, 0, 32) * 2) * 0.5) + 5;
  if (natureUp === 'spe' && natureDown !== 'spe') raw = Math.floor(raw * 1.1);
  else if (natureDown === 'spe' && natureUp !== 'spe') raw = Math.floor(raw * 0.9);
  return raw;
}

function ftOppSpeedCase(opp, ev, natureSpec) {
  if (!PokemonById[opp?.pokemonIdx]) return 0;
  let spe = ftSpeedStatFromBase(ftOpponentBaseSpeed(opp), ev, natureSpec);
  spe = applyBoost(spe, opp.speRank || 0);
  if (opp.scarf) spe = Math.floor(spe * 1.5);
  return spe;
}

function ftOppSpeedRefCases() {
  return [
    { label: '최속', ev: 32, nature: 'jolly' },
    { label: '준속', ev: 32, nature: 'hardy' },
    { label: '무보정', ev: 0, nature: 'hardy' },
  ];
}

function ftRenderOppSpeedChipsHtml(opp = fineTuneState.opp) {
  if (!PokemonById[opp?.pokemonIdx]) return '';
  return ftOppSpeedRefCases().map(c => `
    <span class="ft-speed-chip ${c.label === '최속' ? 'fastest' : c.label === '준속' ? 'neutral-fast' : ''}">
      <em>${c.label}</em>
      <b>${ftOppSpeedCase(opp, c.ev, c.nature)}</b>
    </span>
  `).join('');
}

function ftRefreshOppSpeedChips() {
  const el = document.querySelector?.('#ft-opp-body .ft-opp-speed-chips');
  if (el) el.innerHTML = ftRenderOppSpeedChipsHtml();
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
  return [
    { label: '최속', sub: 'N+/E32', ev: 32, nature: 'jolly' },
    { label: '준속', sub: 'N0/E32', ev: 32, nature: 'hardy' },
    { label: '무보정', sub: 'N0/E0', ev: 0, nature: 'hardy' },
  ];
}

function ftBuildSpeedTable() {
  const my = fineTuneState.my;
  const opp = fineTuneState.opp;
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);
  return ftSpeedCases().map(c => {
    const oppSpe = ftOppSpeedCase(opp, c.ev, c.nature);
    const target = oppSpe + margin;
    const need = ftFindMinSpeedEv(my, target);
    return { ...c, oppSpe, target, need };
  });
}

function ftAbilityOptionsForCurrentPokemon() {
  return calcAbilityOptionDataForPokemon(fineTuneState.my.pokemonIdx, fineTuneState.my.ability);
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
  if (target === 'myForm') return calcFormOptionDataForPokemon(fineTuneState.my.pokemonIdx);
  if (target === 'oppForm') return calcFormOptionDataForPokemon(fineTuneState.opp.pokemonIdx);
  if (target === 'item') {
    return calcItemOptionData();
  }
  if (target === 'nature') {
    return calcNatureOptionData();
  }
  if (target === 'ability') return ftAbilityOptionsForCurrentPokemon();
  return [];
}

function ftComboLabel(target, id) {
  if (target === 'my' || target === 'opp') return pkName(PokemonById[id] || { name: '' });
  if (target === 'myForm' || target === 'oppForm') return PokemonById[id] ? calcPokemonFormLabel(PokemonById[id]) : '';
  if (target === 'item') return id ? itName(ItemById[id] || { name: id }) : '없음';
  if (target === 'nature') return calcNatureLabel(NATURE_BY_ID[id]) || id;
  if (target === 'ability') return id ? abName(AbilityById[id] || { name: id }) : '없음';
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
  if (target === 'myForm') {
    applyPokemonFormToSideState(fineTuneState.my, id);
    if (!ftAbilitySpeedActivation(fineTuneState.my.ability)) fineTuneState.weatherAbilityActive = false;
  }
  if (target === 'opp' && PokemonById[id]) {
    fineTuneState.opp.pokemonIdx = id;
    fineTuneState.opp.baseSpe = '';
  }
  if (target === 'oppForm') {
    applyPokemonFormToSideState(fineTuneState.opp, id);
  }
  if (target === 'item') fineTuneState.my.item = id || '';
  if (target === 'nature') fineTuneState.my.nature = id || 'hardy';
  if (target === 'ability') {
    fineTuneState.my.ability = id || '';
    if (!ftAbilitySpeedActivation(fineTuneState.my.ability)) fineTuneState.weatherAbilityActive = false;
  }
}

function ftCurrentComboId(target) {
  if (target === 'my') return fineTuneState.my.pokemonIdx || '';
  if (target === 'opp') return fineTuneState.opp.pokemonIdx || '';
  if (target === 'myForm') return fineTuneState.my.pokemonIdx || '';
  if (target === 'oppForm') return fineTuneState.opp.pokemonIdx || '';
  if (target === 'item') return fineTuneState.my.item || '';
  if (target === 'nature') return fineTuneState.my.nature || 'hardy';
  if (target === 'ability') return fineTuneState.my.ability || '';
  return '';
}

function ftWireComboboxes(rootId) {
  const container = document.getElementById(rootId);
  if (!container) return;
  container.querySelectorAll('.ft-cb-input').forEach(input => {
    if (input.dataset.ftWired === '1') return;
    const target = input.dataset.ftPick;
    if (target === 'my' || target === 'opp') {
      const useSimplePokemonOption = target === 'opp' && typeof calcRenderSimplePokemonOption === 'function';
      wirePokemonSelectCombobox(input, {
        wiredKey: 'ftWired',
        getOptions: () => ftComboData(target),
        getCurrentId: () => ftCurrentComboId(target),
        getDisplayLabel: () => ftComboLabel(target, ftCurrentComboId(target)),
        onSelect: id => {
          ftSelectCombo(target, id);
          renderFineTuneAll();
        },
        searchLimit: 80,
        closeDelay: 180,
        renderOption: useSimplePokemonOption ? calcRenderSimplePokemonOption : null,
        renderHeader: useSimplePokemonOption ? '' : null,
      });
      return;
    }

    input.dataset.ftWired = '1';
    const cb = input.closest('.combobox');
    const optsEl = cb?.querySelector('.combobox-options');
    if (!optsEl) return;
    const isButtonTrigger = input.tagName === 'BUTTON';
    const showOptions = q => {
      calcHideOptionTooltip();
      const query = String(q || '').trim();
      const allMatches = ftComboData(target).filter(option => ftSearchMatches(query, option));
      const matches = query ? allMatches.slice(0, target === 'item' ? 50 : 80) : allMatches;
      const currentId = ftCurrentComboId(target);
      const renderType = (target === 'myForm' || target === 'oppForm') ? 'form' : target;
      const header = target === 'nature'
        ? (typeof calcComboboxHeaderHtml === 'function' ? calcComboboxHeaderHtml('nature') : '')
        : '';
      optsEl.innerHTML = matches.length ? header + matches.map(option =>
        calcRenderComboboxOption(renderType, option, currentId)
      ).join('') : '<div class="combobox-option empty"><b>검색 결과 없음</b></div>';
      closeSiblingComboboxOptions(optsEl, input);
      optsEl.classList.add('open');
    };
    const restoreInput = () => {
      input.value = ftComboLabel(target, ftCurrentComboId(target));
    };
    const clearOptionalInput = () => {
      if (!['item', 'ability'].includes(target)) return false;
      calcHideOptionTooltip();
      combo?.close();
      ftSelectCombo(target, '');
      renderFineTuneAll();
      return true;
    };
    const handleInvalidInput = () => {
      if (!clearOptionalInput()) restoreInput();
    };
    const combo = wireSharedComboboxKeyboard(input, optsEl, {
      showOptions,
      onSelect: opt => {
        calcHideOptionTooltip();
        ftSelectCombo(target, opt.dataset.id || '');
        renderFineTuneAll();
      },
      getQuery: () => input.value || '',
      onInvalidInput: handleInvalidInput,
    });
    input.addEventListener('focus', () => combo?.open(''));
    input.addEventListener('click', () => combo?.open(''));
    input.addEventListener('input', e => combo?.open(e.target.value, { activateFirst: true }));
    input.addEventListener('blur', () => setTimeout(() => {
      if (isButtonTrigger) {
        return;
      }
      if (typeof calcComboboxFocusMovedToAnother === 'function' && calcComboboxFocusMovedToAnother(input, optsEl)) {
        calcHideOptionTooltip();
        combo?.close();
        restoreInput();
        return;
      }
      if (!String(input.value || '').trim()) {
        if (clearOptionalInput()) return;
        calcHideOptionTooltip();
        combo?.close();
        restoreInput();
        return;
      }
      calcHideOptionTooltip();
      combo?.commitTyped();
    }, 180));
    optsEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      if (isButtonTrigger) return;
      combo?.select(opt);
    });
    optsEl.addEventListener('click', e => {
      const opt = e.target.closest('.combobox-option');
      if (!opt || opt.classList.contains('empty')) return;
      e.preventDefault();
      combo?.select(opt);
    });
    optsEl.addEventListener('mouseover', e => {
      const opt = e.target.closest('.tooltip-option[data-tooltip]');
      if (opt && optsEl.contains(opt)) calcShowOptionTooltip(opt);
    });
    optsEl.addEventListener('mouseout', e => {
      const opt = e.target.closest('.tooltip-option[data-tooltip]');
      if (opt && !opt.contains(e.relatedTarget)) calcHideOptionTooltip();
    });
    optsEl.addEventListener('scroll', calcHideOptionTooltip);
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
        desc: `압정 ${layer}중 +1턴`,
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

function ftBreakpointRuleDenom(ruleText) {
  const match = String(ruleText || '').match(/^(\d+)n/);
  return match ? Number(match[1]) : 0;
}

function ftCompareBreakpointGroups(a, b) {
  const denomA = Math.max(...a.entries.map(info => ftBreakpointRuleDenom(info.rule.rule)));
  const denomB = Math.max(...b.entries.map(info => ftBreakpointRuleDenom(info.rule.rule)));
  if (denomA !== denomB) return denomB - denomA;
  return String(a.key).localeCompare(String(b.key), 'ko');
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

function ftNatureMark(stat, natureId) {
  return renderToolStatNatureMark(stat, natureId, {
    upClass: 'ft-nature-up',
    downClass: 'ft-nature-down',
    emptyClass: 'ft-nature-spacer',
  });
}

function ftRenderMagicCell(side, stat, ev) {
  const magic = ftMagicNumbers(side, stat);
  if (!magic) return renderToolStatMagicCell(null, { className: 'ft-magic', empty: true });
  return renderToolStatMagicCell({
    prev: magic.prev,
    prevLabel: magic.prev !== null ? `-${ev - magic.prev}` : null,
    prevTitle: magic.prev !== null ? `이전 매직 포인트: ${magic.prev}pt` : null,
    current: magic.current,
    currentLabel: magic.current !== null ? '현재' : null,
    currentTitle: magic.current !== null ? '현재 매직 포인트' : null,
    next: magic.next,
    nextLabel: magic.next !== null ? `+${magic.next - ev}` : null,
    nextTitle: magic.next !== null ? `다음 매직 포인트: ${magic.next}pt` : null,
  }, {
    className: 'ft-magic',
    prevClass: 'ft-magic-prev',
    currentClass: 'ft-magic-current',
    nextClass: 'ft-magic-next',
    currentSlotClass: 'ft-magic-current-slot',
  });
}

function ftBulkMetrics(side) {
  const stats = calcStats(side);
  return {
    stats,
    phys: Math.round(stats.hp * stats.def / 0.411),
    spec: Math.round(stats.hp * stats.spd / 0.411),
  };
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

function ftFormatBreakpointDescriptions(entries) {
  const labels = [...new Set(entries.map(info => info.rule.desc).filter(Boolean))];
  if (!labels.length) return '';
  if (labels.every(label => /\s*\+1턴$/.test(label))) {
    return `${labels.map(label => label.replace(/\s*\+1턴$/, '')).join(', ')} +1턴`;
  }
  return labels.join(', ');
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
  const groups = ftGroupHpBreakpoints(my, rows).sort(ftCompareBreakpointGroups);

  container.innerHTML = `
    <section class="ft-hp-section ui-control-frame ui-subframe">
      <div class="ft-hp-title">
        <span>HP 기준점</span>
        <b>HP ${calcStats(my).hp}</b>
      </div>
      <div class="ft-breakpoint-list">
        ${groups.map(group => `
          <div class="ft-breakpoint-item ${group.current ? 'active' : ''} ${group.relevant ? '' : 'muted'}">
            <div class="ft-breakpoint-main">
              <b>${escapeHTML(ftUniqueJoin(group.entries.map(info => info.rule.rule)))}</b>
              <span>${escapeHTML(ftFormatBreakpointDescriptions(group.entries))}</span>
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
    container.innerHTML = '<div class="empty-state ui-empty">포켓몬 선택 필요</div>';
    return;
  }

  const stats = calcStats(my);
  const bulk = ftBulkMetrics(my);
  const ev = ftEvSummary(my);
  const rankStats = ['atk','def','spa','spd','spe'];
  const formControl = renderToolFormCombobox({
    pokemonId: my.pokemonIdx,
    inputClass: 'ft-cb-input',
    pickAttr: 'data-ft-pick',
    pickValue: 'myForm',
    ariaLabel: '내 포켓몬 폼 선택',
  });
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'ft-cb-field ft-pokemon-field',
    headClass: 'ft-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    primaryActions: uiButton('불러오기', {
      class: 'party-load-button ui-label-action ui-field-action',
      'data-party-import-target': 'finetune:my',
    }),
    titleActions: `
      <div class="ft-pokemon-apply-actions tool-pokemon-actions tool-pokemon-nav-actions ui-field-actions">
        <button type="button" class="ft-apply-side-button ui-label-action ui-field-action" data-ft-apply-side="atk" title="현재 세팅을 계산기 공격측으로 적용">공격측</button>
        <button type="button" class="ft-apply-side-button ui-label-action ui-field-action" data-ft-apply-side="def" title="현재 세팅을 계산기 방어측으로 적용">방어측</button>
      </div>
    `,
    inputClass: 'ft-cb-input',
    inputAttrs: { 'data-ft-pick': 'my' },
    value: pkName(p),
    toolbarClass: 'ft-pokemon-meta-row pokemon-meta-row ui-field-meta-row ui-control-row ui-chip-row',
    toolbarActions: `
      ${renderToolPokemonTypeStrip({ types: normalizeSideTypes(my), ariaLabel: '타입' })}
      ${formControl}
    `,
  });
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const statRows = renderToolStatRows(['hp', ...rankStats].map(stat => {
    const ev = my.evs[stat] || 0;
    const rank = my.ranks?.[stat] || 0;
    return {
      stat,
      label: STAT_LABEL?.[stat] || stat,
      base: p.bs[stat],
      point: ev,
      magicHtml: ftRenderMagicCell(my, stat, ev),
      final: stats[stat],
      rank,
      natureHtml: ftNatureMark(stat, my.nature),
      pointOptions: {
        zeroAttrs: { 'data-ft-evset': stat, 'data-ft-evval': '0', title: '0' },
        inputAttrs: { 'data-ft-ev': stat, min: '0', max: '32', 'aria-label': `${STAT_LABEL?.[stat] || stat} 포인트` },
        maxAttrs: { 'data-ft-evset': stat, 'data-ft-evval': '32', title: '32' },
      },
      rankOptions: {
        rankable: stat !== 'hp',
        decAttrs: { 'data-ft-rank': stat, 'data-ft-dir': '-1' },
        incAttrs: { 'data-ft-rank': stat, 'data-ft-dir': '1' },
      },
    };
  }), {
    columns: ['name', 'base', 'point', 'magic', 'final', 'rank'],
    rowClass: 'ft-stat-row',
    nameClass: 'ft-stat-name',
    baseClass: 'ft-stat-base',
    finalClass: 'ft-stat-final',
  });

  container.innerHTML = `
    <div class="ft-setup-grid tool-settings-layout ui-control-grid">
      <div class="ft-pokemon-main-row ui-control-row">
        ${pokemonPicker}
      </div>
      <div class="ft-settings-field tool-settings-subframe ui-control-frame ui-subframe ui-field">
        <div class="ft-settings-grid tool-settings-grid ui-control-grid">
          <div class="ft-cb-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="ability"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">특성</span>
            <div class="ft-ability-control tool-settings-control tool-settings-choice-control tool-settings-compound tool-settings-select-control">
              <div class="combobox tool-settings-combobox tool-settings-choice-combobox tool-settings-select-combobox">
                <input type="text" class="cb-input ft-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-ft-pick="ability" value="${escapeHTML(ftComboLabel('ability', my.ability))}" placeholder="특성 검색...">
                <div class="combobox-options"></div>
              </div>
              ${speedActivation ? `<label class="checkbox-label ft-speed-toggle ui-check" title="${escapeHTML(speedActivation.label)}"><input type="checkbox" id="ftWeatherAbility" ${fineTuneState.weatherAbilityActive ? 'checked' : ''}>${escapeHTML(speedActivation.label)}</label>` : ''}
            </div>
          </div>
          <label class="ft-cb-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="nature"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">성격</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input ft-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-ft-pick="nature" value="${escapeHTML(ftComboLabel('nature', my.nature))}" placeholder="성격 검색...">
              <div class="combobox-options"></div>
            </div>
          </label>
          <label class="ft-cb-field tool-settings-cell tool-settings-choice-cell tool-settings-select-cell ui-control-cell ui-field" data-tool-setting="item"><span class="tool-settings-label tool-settings-choice-label tool-settings-select-label ui-field-label ui-control-label">도구</span>
            <div class="combobox tool-settings-combobox tool-settings-choice-control tool-settings-choice-combobox tool-settings-select-combobox">
              <input type="text" class="cb-input ft-cb-input tool-settings-choice-surface tool-settings-choice-input tool-settings-select-input" data-ft-pick="item" value="${escapeHTML(ftComboLabel('item', my.item))}" placeholder="도구 검색...">
              <div class="combobox-options"></div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="tool-stat-panel tool-stat-set tool-stat-set--finetune tool-stat-has-bulk tool-stat-has-nature tool-stat-has-magic ui-control-frame ui-subframe ui-subframe-stack ui-field">
      <div class="tool-stat-panel-head ui-section-head">
        <div class="tool-stat-panel-title ui-section-title">능력 포인트</div>
        <div class="ft-stat-total tool-stat-total ui-label-action ui-metric-chip is-static ${ev.over ? 'over' : ''}">
          <span>총합</span>
          <span><b>${ev.total}</b>/66</span>
        </div>
      </div>
      <div class="tool-stat-panel-body">
        <div class="ft-stats-column tool-stat-table-frame ui-control-frame">
          <div class="ft-stats-grid tool-stat-grid ui-stat-grid ui-stat-table">
            ${renderToolStatHead(['name', 'base', 'point', 'magic', 'final', 'rank'], {
              rowClass: 'ft-stats-head',
            })}
            ${statRows}
          </div>
        </div>
      </div>
      ${renderToolStatBulkStrip(bulk, {
        physLabel: '물리 내구',
        specLabel: '특수 내구',
      })}
    </div>
  `;
  ftWireMyComboboxes();
}

function renderFineTuneOpp() {
  const container = document.getElementById('ft-opp-body');
  if (!container) return;
  const opp = fineTuneState.opp;
  const p = PokemonById[opp.pokemonIdx];
  const baseSpe = p ? ftOpponentBaseSpeed(opp) : '';
  const formControl = renderToolFormCombobox({
    pokemonId: opp.pokemonIdx,
    inputClass: 'ft-cb-input',
    pickAttr: 'data-ft-pick',
    pickValue: 'oppForm',
    ariaLabel: '상대 포켓몬 폼 선택',
  });
  const pokemonPicker = renderToolPokemonSelectSubframe({
    fieldClass: 'ft-cb-field ft-pokemon-field',
    headClass: 'ft-pokemon-head ui-section-head',
    labelClass: 'ui-section-title',
    metaActions: `
      ${formControl}
      ${renderToolPokemonTypeStrip({
        types: p?.types,
        className: 'ft-opp-type-strip',
        ariaLabel: '상대 타입',
        empty: !p,
      })}
    `,
    inputClass: 'ft-cb-input',
    inputAttrs: { 'data-ft-pick': 'opp' },
    value: p ? pkName(p) : '',
  });

  container.innerHTML = `
    <section class="ft-opp-section ui-control-frame ui-subframe ui-subframe-stack">
      <div class="ft-opp-card-head">
        <span class="ft-section-title">상대 포켓몬</span>
      </div>
      <div class="ft-opp-config-row ui-control-row">
        <div class="ft-opp-pick-row ui-control-row">
          ${pokemonPicker}
        </div>
        <div class="ft-opp-speed-setup ui-control-frame ui-subframe">
          <label class="ft-base-speed-field ft-speed-compact-field ui-field"><span class="ui-field-label">속도</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="ftOppBaseSpe" value="${escapeHTML(baseSpe)}" placeholder="속도">
          </label>
          <div class="ft-rank-scarf-row ui-control-row">
            <div class="ft-rank-field ft-speed-compact-field ui-field"><span class="ui-field-label">랭크</span>
              <div class="ft-rank tool-stat-rank-stepper">
                <button type="button" class="ft-rank-btn tool-stat-rank-button ui-stat-button" data-ft-opprank="-1">-</button>
                <span class="ft-rank-val ${opp.speRank > 0 ? 'pos' : opp.speRank < 0 ? 'neg' : ''}">${opp.speRank > 0 ? '+' + opp.speRank : opp.speRank}</span>
                <button type="button" class="ft-rank-btn tool-stat-rank-button ui-stat-button" data-ft-opprank="1">+</button>
              </div>
            </div>
            <label class="checkbox-label ft-opp-scarf ui-check">
              <input type="checkbox" id="ftOppScarf" ${opp.scarf ? 'checked' : ''}>
              <span>구애스카프</span>
            </label>
          </div>
        </div>
      </div>
      <div class="ft-opp-speed-detail ui-control-frame ui-subframe">
        <div class="ft-opp-speed-detail-head">
          <span>속도 실수치</span>
          <i aria-hidden="true"></i>
        </div>
        <div class="ft-opp-speed-chips">
          ${ftRenderOppSpeedChipsHtml(opp)}
        </div>
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
    container.innerHTML = '<div class="empty-state ui-empty">양쪽 포켓몬 선택 필요</div>';
    return;
  }
  const rows = ftBuildSpeedTable();
  const margin = Math.max(0, parseInt(fineTuneState.margin, 10) || 1);
  const speedActivation = ftAbilitySpeedActivation(my.ability);
  const activeSpeedNote = speedActivation && fineTuneState.weatherAbilityActive
    ? `<span class="ft-tag ok">${escapeHTML(speedActivation.label)}</span>`
    : '';
  const myCurrentSpe = ftMySpeed(my);
  const speedTags = [
    my.item === 'choicescarf' ? '<span class="ft-tag warn">스카프 적용</span>' : '',
    activeSpeedNote,
    (my.ranks?.spe || 0) !== 0 ? `<span class="ft-tag">랭크 ${my.ranks.spe > 0 ? '+' : ''}${my.ranks.spe}</span>` : '',
  ].filter(Boolean).join('');

  container.innerHTML = `
    <div class="ft-speed-summary ui-control-frame ui-subframe">
      <div class="ft-current-speed-inline">
        <span>내 현재 속도</span>
        <b>${myCurrentSpe}</b>
      </div>
      <div class="ft-speed-flags">${speedTags || '<span class="ft-speed-muted">추가 보정 없음</span>'}</div>
    </div>
    <div class="ft-speed-divider" aria-hidden="true"></div>
    <div class="ft-speed-case-grid">
      ${rows.map(row => {
        const possible = row.need !== null;
        const needHtml = possible
          ? `<span class="ft-speed-need-value"><b>${row.need}</b><span>포인트</span></span>`
          : '<span class="ft-speed-need-value impossible"><b>불가</b></span>';
        return `
          <article class="ft-speed-case ui-control-frame ui-subframe ${possible ? 'possible' : 'impossible'}" title="필요 속도 ${row.target} 이상 (상대 ${row.oppSpe} + ${margin})">
            <div class="ft-speed-case-head">
              <b>${escapeHTML(row.label)}</b>
              <small>${escapeHTML(row.sub || '')}</small>
            </div>
            <div class="ft-speed-case-spe">
              <span>상대 속도</span>
              <b>${row.oppSpe}</b>
            </div>
            <div class="ft-speed-case-need">
              <span class="ft-speed-need-label">+${margin} 추월</span>
              ${needHtml}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderFineTuneAll() {
  renderFineTuneMy();
  renderFineTuneHp();
  renderFineTuneOpp();
  renderFineTuneSpeed();
}


document.getElementById('page-finetune')?.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppScarf') { fineTuneState.opp.scarf = t.checked; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  if (t.id === 'ftWeatherAbility') { fineTuneState.weatherAbilityActive = t.checked; renderFineTuneAll(); return; }
  if (t.id === 'ftOppBaseSpe') { fineTuneState.opp.baseSpe = t.value; renderFineTuneOpp(); renderFineTuneSpeed(); return; }
  const pointInputStat = t.dataset.toolStatPointInput || t.dataset.ftEv;
  if (pointInputStat) {
    const stat = pointInputStat;
    const normalized = toolStatNormalizePointInputValue(t.value);
    if (normalized !== t.value) t.value = normalized;
    ftSetEv(stat, t.value);
    if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
    renderFineTuneAll();
    return;
  }
});

document.getElementById('page-finetune')?.addEventListener('input', e => {
  const t = e.target;
  const pointInputStat = t.dataset.toolStatPointInput || t.dataset.ftEv;
  if (pointInputStat) {
    const normalized = toolStatNormalizePointInputValue(t.value);
    if (normalized !== t.value) t.value = normalized;
    ftSetEv(pointInputStat, t.value);
    if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
    renderFineTuneAll();
    return;
  }
  if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
  if (t.id === 'ftOppBaseSpe') { fineTuneState.opp.baseSpe = t.value; ftRefreshOppSpeedChips(); renderFineTuneSpeed(); return; }
});

document.getElementById('page-finetune')?.addEventListener('click', e => {
  const t = e.target;
  const applySideButton = t.closest?.('[data-ft-apply-side]');
  if (applySideButton) {
    ftApplyToCalc(applySideButton.dataset.ftApplySide);
    return;
  }
  // EV quick set 버튼 (0/32) — 66 캡 적용
  const pointSetStat = t.dataset.toolStatPointSet || t.dataset.ftEvset;
  if (pointSetStat !== undefined) {
    const stat = pointSetStat;
    ftSetEv(stat, t.dataset.toolStatPointValue ?? t.dataset.ftEvval);
    renderFineTuneAll();
    return;
  }
  // 내 측 랭크
  const rankStat = t.dataset.toolStatRank || t.dataset.ftRank;
  if (rankStat) {
    const stat = rankStat;
    const dir = t.dataset.toolStatRankDir || t.dataset.ftDir;
    if (typeof toolStatApplyRankDelta === 'function') {
      toolStatApplyRankDelta(fineTuneState.my, stat, dir);
    } else {
      const cur = fineTuneState.my.ranks[stat] || 0;
      fineTuneState.my.ranks[stat] = Math.max(-6, Math.min(6, cur + (parseInt(dir, 10) || 0)));
    }
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
  fineTuneState.opp.baseSpe = '';
  fineTuneState.weatherAbilityActive = false;
  // 세부조정 탭 이동
  const ftNav = document.querySelector('.nav-tab[data-page="finetune"]');
  if (ftNav) ftNav.click();
  renderFineTuneAll();
}
window.loadSideToFineTune = loadSideToFineTune; // 다른 모듈에서 호출 가능
