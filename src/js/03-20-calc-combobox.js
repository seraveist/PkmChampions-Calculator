/* Calculator move estimation and shared combobox behavior. */
/* Damage calculator move estimation and combobox helpers. */
const ENTRY_EFFECTS = RULES.entryEffects || {};
const INTIMIDATE_BLOCKERS = RULES.entryEffectBlockers?.intimidate || [];

// 결정력: 현재 조건의 공격 능력치 × 보정 위력 × 자속·공격 보정.
// 피해 공식과 능력치/위력 단계를 공유하며 방어 실수치·타입 상성 배율은 곱하지 않는다.
function estimateMovePower(side, move, targetSide = state.def, suppliedField = null) {
  if (!move || move.cat === 'Status') return { bp: '—', eff: '—' };
  let field = suppliedField || state.field;
  if (!suppliedField && (side === state.atk || side === state.def)) {
    const derived = makeCalcState();
    const key = side === state.atk ? 'atk' : 'def';
    side = derived[key];
    targetSide = derived[key === 'atk' ? 'def' : 'atk'];
    field = derived.field;
  }
  if (!PokemonById[side.pokemonIdx]) return { bp: '—', eff: '—' };
  if (!PokemonById[targetSide?.pokemonIdx]) targetSide = side;
  const moveField = { ...powerMoveField(side, targetSide, move, field), damagePurpose: 'power', singleHitCalculation: true };
  const first = calculateDamage(side, targetSide, move, moveField);
  if (!first) return { bp: '—', eff: '—' };
  if (isFixedPowerMove(move)) {
    const fixed = calculatePowerDamage(side, targetSide, move, moveField);
    const min = fixed.damages[0], max = fixed.damages.at(-1);
    return { bp: '—', eff: move.ohko ? '일격' : `고정 ${min === max ? min : `${min}~${max}`}`, atkStat: 0 };
  }
  const model = makePowerAttackModel(side, targetSide, move, moveField, first);
  let eff = 0, atkStat = 0;
  const totalWeight = model.variants.reduce((sum, v) => sum + v.weight, 0);
  model.variants.forEach(variant => {
    const variantSide = variant.fickleBeamMode ? { ...side, fickleBeamMode: variant.fickleBeamMode } : side;
    let sum = 0;
    for (let index = 0; index < variant.hits; index++) {
      const hitField = { ...moveField, powerHitIndex: index, beatUpBaseAttack: beatUpParticipants(side, field)[index]?.bs.atk };
      const ctx = makeDamageContext(variantSide, targetSide, move, hitField);
      if (resolveDamagePreludeStage(ctx)?.done || calculateBasePowerStage(ctx)?.done) continue;
      calculateAttackStage(ctx);
      atkStat = ctx.atkStat;
      let power = ctx.atkStat * ctx.bp * getStabMod(side, ctx.moveType, ctx.atkAb) / 4096;
      const mods = [];
      applyAbilityRuleMods(ctx.atkAbilityData?.finalDamageBoosts, ctx, mods, '');
      const boost = ctx.atkItemData?.finalDamageBoost;
      if (boost && (boost.kind === 'always' || (boost.kind === 'superEffective' && ctx.effectiveness > 1))) mods.push(mechanicMod(boost.mod));
      power *= chainMods(mods, 41, 131072) / 4096;
      const weatherRule = firstMatchingFieldRule(fieldMechanics().weatherDamageMods, {
        ...ctx, damageWeather: ctx.atkAbilityData?.weatherDamageOverride || ctx.weather,
        ignoresWeatherDamagePenalty: !!ctx.atkAbilityData?.ignoreWeatherDamagePenalty,
      });
      if (weatherRule && !weatherRule.nullDamage && !ctx.atkItemData?.ignoresWeatherDamageModifiers && !ctx.defItemData?.ignoresWeatherDamageModifiers) power *= mechanicMod(weatherRule.mod) / 4096;
      if (ctx.applyBurn) power *= 0.5;
      if (isSpreadDamage(move, field, side)) power *= 0.75;
      if (model.kind === 'parentalBond' && index) power *= 0.25;
      sum += power;
    }
    eff += sum * variant.weight / totalWeight;
  });
  return { bp: first.bp, eff: Math.round(eff), atkStat };
}

const CALC_NATURE_SORT_STATS = ['atk', 'def', 'spa', 'spd', 'spe'];

function calcNatureSortRank(stat) {
  const rank = CALC_NATURE_SORT_STATS.indexOf(stat);
  return rank >= 0 ? rank : 99;
}

function calcSortNatureOptions(options) {
  return [...options].sort((a, b) => {
    const upDiff = calcNatureSortRank(a?.up) - calcNatureSortRank(b?.up);
    if (upDiff) return upDiff;
    const downDiff = calcNatureSortRank(a?.down) - calcNatureSortRank(b?.down);
    if (downDiff) return downDiff;
    return calcNatureLabel(a).localeCompare(calcNatureLabel(b), 'ko');
  });
}

function calcAbilityOptionDataForPokemon(pokemonId, currentAbility = '', { includeEmpty = true, emptySub = '특성 없음' } = {}) {
  const pokemon = PokemonById[pokemonId];
  const abilities = Object.values(pokemon?.ab || {})
    .map(name => AbilityById[toId(name)] || { id: toId(name), name })
    .filter(a => a.id);
  if (currentAbility && !abilities.some(a => a.id === currentAbility)) {
    abilities.push(AbilityById[currentAbility] || { id: currentAbility, name: currentAbility });
  }
  const options = abilities.map(a => ({ id: a.id, label: abName(a), sub: a.desc || a.descLong || a.name || a.id, raw: a }));
  return includeEmpty ? [{ id: '', label: '없음', sub: emptySub }, ...options] : options;
}

function calcItemOptionData({ includeEmpty = true } = {}) {
  const options = sortItemsForCalcSelect(ITEMS).map(i => ({ id: i.id, label: itName(i), sub: i.name || i.id, raw: i }));
  return includeEmpty ? [{ id: '', label: '없음', sub: '' }, ...options] : options;
}

function calcNatureOptionData() {
  return calcSortNatureOptions(NATURES).map(n => ({ id: n.id, label: calcNatureLabel(n), sub: n.up ? `${n.up}+ / ${n.down}-` : '보정 없음', raw: n }));
}

function makeCombobox(sideKey, type) {
  const dataset = calcDatasetForCombobox(sideKey, type);
  // 필터링 함수
  return (searchText) => {
    const s = calcSearchText(searchText).trim();
    const matches = dataset.filter(d => {
      if (type === 'pokemon') {
        return calcMatches(s, d.koName || pkName(d));
      }
      if (type === 'move') {
        return calcMatches(s, d.id, d.name, d.koName, d.type, TYPE_KO[d.type], d.cat, calcMoveCategoryLabel(d.cat), d.desc, d.descLong);
      }
      if (type === 'type1' || type === 'type2' || type === 'moveType') {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      if (type === 'ability') {
        return calcMatches(s, d.id, d.name, d.koName, d.desc, d.descLong);
      }
      if (type === 'nature') {
        return calcMatches(s, d.id, d.ko, calcNatureLabel(d), STAT_LABEL[d.up], STAT_LABEL[d.down], d.up, d.down);
      }
      if (type === 'status') {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      if (type === 'form') {
        return calcMatches(s, d.id, d.label, d.sub, d.raw?.name, d.raw?.koName, d.raw?.forme, d.raw?.baseForme);
      }
      if (CALC_FIELD_OPTION_SETS[type]) {
        return calcMatches(s, d.id, d.label, d.sub);
      }
      // 챔피언스 빌드는 build 단계에서 이미 Past 아이템을 걸러내므로 런타임 필터 불필요.
      return calcMatches(s, d.id, d.name, d.koName, d.desc, d.descLong, calcItemCategoryLabel(d), ...(d.itemUser || []));
    });
    if (type === 'pokemon' || type === 'move') return matches;
    if (type === 'nature') return calcSortNatureOptions(matches).slice(0, 30);
    return matches.slice(0, 30);
  };
}

let calcSharedComboboxUid = 0;

function wireSharedComboboxKeyboard(control, optsEl, options = {}) {
  return uiWirePickerDialog(control, optsEl, options);
}

function calcPokemonComboboxMatches(option, query) {
  const needle = calcSearchText(query).trim();
  const pokemon = option?.raw || option || {};
  const types = pokemon.types || option?.types || [];
  return calcMatches(
    needle,
    option?.id,
    option?.label,
    option?.sub,
    pokemon.id,
    pokemon.name,
    pokemon.koName,
    pkName(pokemon),
    ...types,
    ...types.map(type => TYPE_KO[type] || type)
  );
}

function wirePokemonSelectCombobox(input, {
  getOptions = () => sortPokemonForCalcSelect(POKEMON),
  getCurrentId = () => '', getDisplayLabel = null, onSelect = null,
  searchLimit = null, wiredKey = 'pokemonWired',
} = {}) {
  if (!input || (wiredKey && input.dataset[wiredKey] === '1')) return null;
  const list = input.closest('.combobox')?.querySelector('.combobox-options');
  if (!list) return null;
  if (wiredKey) input.dataset[wiredKey] = '1';
  input.dataset.cbType = 'pokemon';
  const combo = wireSharedComboboxKeyboard(input,list,{
    showOptions: query => {
      const all = (typeof getOptions === 'function' ? getOptions(input) : getOptions) || [];
      const matches = all.filter(option => calcPokemonComboboxMatches(option,query));
      const rows = query && searchLimit ? matches.slice(0,searchLimit) : matches;
      renderTrustedHTML(list,rows.length ? calcPokemonOptionHeaderHtml() + rows.map(option => calcRenderPokemonOption(option,getCurrentId(input))).join('') : '<div class="combobox-option empty">검색 결과 없음</div>');
    },
    onSelect: option => {
      uiSetPickerLabel(input,option.querySelector('b')?.textContent || '');
      if (onSelect) onSelect(option.dataset.id || '',option);
    },
  });
  return combo;
}
