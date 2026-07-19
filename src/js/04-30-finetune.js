/* Fine-tune EV planner.
 * Loaded before 05-init.js by build.mjs alphabetical concatenation.
 */
// 내 측은 makeSideState 와 같은 형태(전체 세팅 보유), 상대는 최소 정보만.
const fineTuneState = {
  my: makeSideState(),
  opp: {
    pokemonIdx: '',
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
  return makeFieldState({ gameType: state?.field?.gameType || 'Singles' });
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
  const out = cloneCalcValue(side || {});
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

function ftRenderOpponentPokemonOption(option, currentId) {
  const pokemon = option?.raw || option || {};
  const id = option?.id || pokemon.id || '';
  const label = option?.label || pkName(pokemon);
  const types = pokemon.types || option?.types || [];
  const speed = pokemon.bs?.spe || option?.bs?.spe || 0;
  const typeBadges = types.map(type => (
    `<span class="type-pill pokemon-simple-type-pill ft-opp-pokemon-type-pill t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`
  )).join('');
  const selected = String(id) === String(currentId);
  const optionClass = ['combobox-option', 'ui-option', 'pokemon-simple-option', 'ft-opp-pokemon-option', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <div class="${optionClass}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="pokemon-simple-option-name ft-opp-pokemon-name">${escapeHTML(label)}</b>
      <small class="pokemon-simple-option-types ft-opp-pokemon-types">${typeBadges}</small>
      <span class="ft-opp-pokemon-speed" title="SPE ${escapeHTML(speed)}">${escapeHTML(speed)}</span>
    </div>
  `;
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
      const renderPokemonOption = target === 'opp'
        ? ftRenderOpponentPokemonOption
        : null;
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
        renderOption: renderPokemonOption,
        renderHeader: renderPokemonOption ? '' : null,
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
