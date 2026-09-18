import { uiSetPickerLabel } from './01-10-rotom-ui.js';
import { AbilityById, ITEMS, NATURES, POKEMON, PokemonById, RULES, STAT_LABEL, TYPE_KO, abName, battleAbilityContext, calcStats, chainMods, effectiveBattleItem, getStabMod, itName, pkName, renderTrustedHTML, toId } from './01-core.js';
import { applyAbilityRuleMods, calculateAttackStage, calculateBasePowerStage, fieldMechanics, firstMatchingFieldRule, fixedDamageAmount, isSpreadDamage, makeDamageContext, mechanicMod, powerAttackProfile, resolveDamagePreludeStage, specialMoveInputIssue } from './02-engine.js';
import { CALC_FIELD_OPTION_SETS, autoEntryEffects, calcDatasetForCombobox, calcItemCategoryLabel, calcMatches, calcMoveCategoryLabel, calcNatureLabel, calcSearchText, clampFallenAllies, makeSideState, sortItemsForCalcSelect, sortPokemonForCalcSelect, state } from './03-10-calc-state.js';
import { uiWirePickerDialog } from './03-19-picker-dialog.js';
import { calcPokemonOptionHeaderHtml, calcRenderPokemonOption } from './03-21-calc-combobox-options.js';
import { AUTO_ENTRY_FIELD_KEYS, autoEntryFieldState, clampRank, cloneSideForCalc, entryFieldEffectForSide } from './03-40-calc-entry-effects.js';

/* Calculator move estimation and shared combobox behavior. */
/* Damage calculator move estimation and combobox helpers. */
const ENTRY_EFFECTS = RULES.entryEffects || {};
const INTIMIDATE_BLOCKERS = RULES.entryEffectBlockers?.intimidate || [];

// 결정력은 공격측 입력만 사용한다. 상대 기본 타입은 색안경·달인의띠 등의 조건 판정용이다.
const TARGET_DEPENDENT_POWER_KINDS = new Set([
  'gyroBall', 'electroBall', 'weightRatio', 'targetWeight', 'targetHp100',
  'targetStatusDouble', 'targetPoisonDouble', 'knockOff', 'targetWasHitDouble',
  'electricTerrainTargetGroundedDouble', 'requiresTargetItem',
]);

function movePowerNeedsTarget(move, side, field, ability) {
  if (move.ohko || move.overrideOffensivePokemon === 'target') return true;
  if (['targetHalfHp', 'targetMinusSourceHp'].includes(move.fixedDamageKind)) return true;
  if (!move.manualBp && TARGET_DEPENDENT_POWER_KINDS.has(move.variableBpKind)) return true;
  const needsOrder = (!move.manualBp && ['userMovesFirstDouble', 'userMovesSecondDouble'].includes(move.variableBpKind))
    || ability?.bpBoosts?.some(rule => rule.movesSecond);
  if (needsOrder && (!side.moveOrder || side.moveOrder === 'auto')) return true;
  if (ability?.criticalOnTargetStatus && !move.willCrit && !field.isCritical) return true;
  if (ability?.id === 'rivalry' || (autoEntryEffects && ENTRY_EFFECTS[ability?.id]?.download)) return true;
  return false;
}

function makeMovePowerState(source, target, suppliedField) {
  const sideKey = source === state.atk ? 'atk' : source === state.def ? 'def' : null;
  const side = cloneSideForCalc(source);
  // A neutral placeholder supplies the shared stages' required shape; no target stats enter the index.
  const defender = makeSideState(source.pokemonIdx);
  defender.ability = '';
  defender.item = '';
  const field = { ...(suppliedField || state.field), damagePurpose: 'power', offensivePowerOnly: true,
    singleHitCalculation: true, powerHitIndex: 0,
    powerTargetTypes: [...(PokemonById[target?.pokemonIdx]?.types || [])],
    ruinTablet: false, ruinVessel: false,
    atkMovesFirst: side.moveOrder === 'first', atkMovesSecond: side.moveOrder === 'second' };
  const ability = AbilityById[battleAbilityContext(side, defender).atkAb];
  if (autoEntryEffects) {
    const entry = ENTRY_EFFECTS[ability?.id];
    for (const [stat, delta] of Object.entries(entry?.selfBoost || {})) side.ranks[stat] = clampRank((side.ranks[stat] || 0) + delta);
    if (sideKey) for (const key of AUTO_ENTRY_FIELD_KEYS) {
      const tracked = autoEntryFieldState[key];
      if (tracked.owner && tracked.owner !== sideKey && field[key] === entryFieldEffectForSide(tracked.owner, key)?.value) {
        field[key] = entry?.[key] || tracked.base;
      }
    }
  }
  side.fallenAllies = clampFallenAllies(side.fallenAllies, field.gameType);
  return { side, defender, field, ability };
}

function estimateMovePower(source, move, target = state.def, suppliedField = null) {
  const empty = { bp: '—', eff: '—' };
  if (!move || move.cat === 'Status' || !PokemonById[source?.pokemonIdx]) return empty;
  const { side, defender, field, ability } = makeMovePowerState(source, target, suppliedField);
  if (movePowerNeedsTarget(move, side, field, ability) || specialMoveInputIssue(move, side, defender)) return empty;
  const profile = powerAttackProfile(side, move, field, { atkAbility: ability?.id || '', atkItem: effectiveBattleItem(side, ability?.id || '') });
  const totalWeight = profile.variants.reduce((sum, v) => sum + v.weight, 0);
  const fixed = fixedDamageAmount(move, side, defender, calcStats(side), calcStats(defender), null);
  if (fixed !== null) {
    const hits = profile.variants.reduce((sum, v) => sum + v.hits * v.weight, 0) / totalWeight;
    return { bp: '—', eff: Math.round(fixed * hits), atkStat: 0 };
  }
  let eff = 0, atkStat = 0, firstBp = null;
  for (const variant of profile.variants) {
    let sum = 0;
    for (let index = 0; index < variant.hits; index++) {
      const hitSide = cloneSideForCalc(side);
      if (variant.fickleBeamMode) hitSide.fickleBeamMode = variant.fickleBeamMode;
      if (index && move.id === 'poweruppunch') hitSide.ranks.atk = clampRank((side.ranks.atk || 0) + index * (ability?.id === 'contrary' ? -1 : ability?.id === 'simple' ? 2 : 1));
      const hitField = { ...field, powerHitIndex: index, beatUpBaseAttack: profile.participants[index]?.bs.atk };
      const ctx = makeDamageContext(hitSide, defender, move, hitField);
      if (resolveDamagePreludeStage(ctx)?.done || calculateBasePowerStage(ctx)?.done) return empty;
      calculateAttackStage(ctx);
      firstBp ??= ctx.bp;
      atkStat = ctx.atkStat;
      let power = ctx.atkStat * ctx.bp * getStabMod(hitSide, ctx.moveType, ctx.atkAb) / 4096;
      const mods = [];
      applyAbilityRuleMods(ctx.atkAbilityData?.finalDamageBoosts, ctx, mods, '');
      const boost = ctx.atkItemData?.finalDamageBoost;
      if (boost && (boost.kind === 'always' || (boost.kind === 'superEffective' && ctx.effectiveness > 1))) mods.push(mechanicMod(boost.mod));
      power *= chainMods(mods, 41, 131072) / 4096;
      const weatherRule = firstMatchingFieldRule(fieldMechanics().weatherDamageMods, {
        ...ctx, damageWeather: ctx.atkAbilityData?.weatherDamageOverride || ctx.weather,
        ignoresWeatherDamagePenalty: !!ctx.atkAbilityData?.ignoreWeatherDamagePenalty,
      });
      if (weatherRule && !weatherRule.nullDamage && !ctx.atkItemData?.ignoresWeatherDamageModifiers) power *= mechanicMod(weatherRule.mod) / 4096;
      if (ctx.isCritical) power *= 1.5;
      if (ctx.applyBurn) power *= 0.5;
      if (isSpreadDamage(move, field, hitSide)) power *= 0.75;
      if (profile.parent && index) power *= 0.25;
      sum += power;
    }
    eff += sum * variant.weight / totalWeight;
  }
  return { bp: firstBp, eff: Math.round(eff), atkStat };
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

// Display data is fixed for one build; callers receive their own array.
let calcItemOptionsCache = null;
let calcNatureOptionsCache = null;
function calcItemOptionData({ includeEmpty = true } = {}) {
  const options = calcItemOptionsCache ||= sortItemsForCalcSelect(ITEMS).map(i => ({ id: i.id, label: itName(i), sub: i.name || i.id, raw: i }));
  return includeEmpty ? [{ id: '', label: '없음', sub: '' }, ...options] : options.slice();
}

function calcNatureOptionData() {
  const options = calcNatureOptionsCache ||= calcSortNatureOptions(NATURES).map(n => ({ id: n.id, label: calcNatureLabel(n), sub: n.up ? `${n.up}+ / ${n.down}-` : '보정 없음', raw: n }));
  return options.slice();
}

function makeCombobox(sideKey, type) {
  // Retained controls must follow Pokemon/form changes, without sorting on every keystroke.
  let dataset = null, datasetPokemonId;
  return (searchText) => {
    const pokemonId = state[sideKey]?.pokemonIdx;
    if (!dataset || datasetPokemonId !== pokemonId) {
      dataset = calcDatasetForCombobox(sideKey, type);
      datasetPokemonId = pokemonId;
    }
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
    // The item picker is a browsable catalog. Truncating an empty search makes
    // every item after the first page impossible to discover by scrolling.
    if (type === 'item') return matches;
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

// Assignment stays in the module that owns the live binding.
function setCalcSharedComboboxUid(value) { calcSharedComboboxUid = value; return value; }

export { ENTRY_EFFECTS, INTIMIDATE_BLOCKERS, TARGET_DEPENDENT_POWER_KINDS, movePowerNeedsTarget, makeMovePowerState, estimateMovePower, CALC_NATURE_SORT_STATS, calcNatureSortRank, calcSortNatureOptions, calcAbilityOptionDataForPokemon, calcItemOptionsCache, calcNatureOptionsCache, calcItemOptionData, calcNatureOptionData, makeCombobox, calcSharedComboboxUid, wireSharedComboboxKeyboard, calcPokemonComboboxMatches, wirePokemonSelectCombobox, setCalcSharedComboboxUid };
