/* ════════════════════════════════════════════════════════════
 * 02-engine.js — 계산 엔진: 가변 BP, calculateDamage, 진입 위험, simulateKO/hkoLabel, 속도
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   가변 위력 기술 (basePowerCallback)
   본가의 callback 로직을 챔피언스 환경에 맞게 재현.
   side.hpPct (0~1, 기본 1.0), side.lastMoveFailed, side.wasHit, side.fallenAllies,
   side.timesHit, field.atkMovesFirst, field.atkMovesSecond 등의 보조 플래그를 읽는다.
   ════════════════════════════════════════════════════════════ */
const BERRY_BLOCKING_ABILITIES = ['unnerve', 'asoneglastrier', 'asonespectrier'];
const MECHANIC_MODS = {
  x0_25: MOD.x0_25,
  x0_5: MOD.x0_5,
  x0_75: MOD.x0_75,
  x1_1: MOD.x1_1,
  x1_1g: MOD.x1_1g,
  x1_2: MOD.x1_2,
  x1_25: 5120,
  x1_3: MOD.x1_3,
  x1_5: MOD.x1_5,
  x2_0: MOD.x2_0,
};

function mechanicMod(key) {
  if (typeof key === 'number') return key;
  return MECHANIC_MODS[key] || 4096;
}

function formatCalcMultiplier(mod) {
  const value = typeof mod === 'number' && Math.abs(mod) > 16 ? mod / 4096 : Number(mod);
  if (!Number.isFinite(value)) return '';
  const rounded = (Math.round(value * 100) / 100)
    .toFixed(2)
    .replace(/\.?0+$/, '');
  return `×${rounded}`;
}

function formatModLabel(name, mod, detail = '') {
  const prefix = name || '보정';
  return `${prefix}${formatCalcMultiplier(mod)}${detail ? ` (${detail})` : ''}`;
}

function displayName(data, fallback = '') {
  return data?.koName || data?.name || fallback || '';
}

function displayType(type) {
  return TYPE_KO[type] || type || '';
}

function normalizeParadoxItemState(value) {
  return ['auto', 'active', 'inactive'].includes(value) ? value : 'auto';
}

function sideParadoxItemActive(side, itemData) {
  const mode = normalizeParadoxItemState(side?.boosterEnergyState);
  if (mode === 'active') return true;
  if (mode === 'inactive') return false;
  return !!itemData?.paradoxActivation;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function fieldMechanics() {
  return RULES.fieldMechanics || {};
}

function moveHasRuleFlag(move, flag) {
  if (!flag) return true;
  return !!move?.[flag] || !!move?.flags?.[flag];
}

function fieldRuleApplies(rule, ctx) {
  if (!rule) return false;
  if (rule.field && !ctx.field?.[rule.field]) return false;
  if (rule.weather && !asArray(rule.weather).includes(ctx.damageWeather ?? ctx.weather)) return false;
  if (rule.terrain && ctx.field?.terrain !== rule.terrain) return false;
  if (rule.types && !rule.types.includes(ctx.moveType)) return false;
  if (rule.category && rule.category !== ctx.category) return false;
  if (rule.moveFlag && !moveHasRuleFlag(ctx.move, rule.moveFlag)) return false;
  if (rule.attackerGrounded && !isGrounded(ctx.atkSide, ctx.field, ctx.atkAb, ctx.atkItem)) return false;
  if (rule.defenderGrounded && !isGrounded(ctx.defSide, ctx.field, ctx.defAb, ctx.defItem)) return false;
  if (rule.skipWhen && ctx[rule.skipWhen]) return false;
  return true;
}

function applyFieldRuleMods(rules, ctx, outMods) {
  for (const rule of rules || []) {
    if (!fieldRuleApplies(rule, ctx)) continue;
    outMods.push(mechanicMod(rule.mod));
    if (rule.label) ctx.mods.push(rule.label);
  }
}

function firstMatchingFieldRule(rules, ctx) {
  return (rules || []).find(rule => fieldRuleApplies(rule, ctx)) || null;
}

function conditionListIncludes(values, candidates) {
  const ids = new Set(candidates.filter(Boolean).map(toId));
  return asArray(values).some(value => ids.has(toId(value)));
}

function pokemonMatchesCondition(pokemon, condition) {
  if (!condition) return false;
  if (!condition.pokemon && !condition.baseSpecies) return true;
  if (condition.pokemon && conditionListIncludes(condition.pokemon, [pokemon.id, pokemon.name])) return true;
  if (condition.baseSpecies && conditionListIncludes(condition.baseSpecies, [
    pokemon.baseSpecies,
    pokemon.base,
    pokemon.name,
    pokemon.id,
  ])) return true;
  return false;
}

function statBoostApplies(pokemon, boost, statId) {
  if (!boost || !pokemonMatchesCondition(pokemon, boost)) return false;
  if (boost.requiresNfe && !pokemon.nfe) return false;
  if (boost.stats?.includes(statId)) return true;
  return boost.stat === statId;
}

function fractionValue(fraction, fallback = 0) {
  return Array.isArray(fraction) && fraction[1] ? fraction[0] / fraction[1] : fallback;
}

function categoryMatches(rule, isPhysical) {
  if (!rule.category) return true;
  return rule.category === (isPhysical ? 'Physical' : 'Special');
}

function statusMatches(rule, status) {
  if (!rule.status) return true;
  if (rule.status === 'any') return status && status !== 'none';
  if (rule.status === 'burn') return isBurnStatus(status);
  if (rule.status === 'poison') return isPoisonStatus(status);
  if (rule.status === 'toxic') return isToxicStatus(status);
  return false;
}

function sideHpPct(side) {
  const n = Number(side?.hpPct);
  if (!Number.isFinite(n)) return 1;
  const raw = n > 1 ? n / 100 : n;
  return Math.max(0.01, Math.min(1, raw));
}

function sideCurrentHp(maxHp, side) {
  return Math.max(1, Math.floor(maxHp * sideHpPct(side)));
}

function sideIsFullHp(side) {
  if (side?.fullHP !== undefined) return !!side.fullHP;
  return sideHpPct(side) >= 1;
}

function sideIsPinch(side) {
  if (side?.pinch !== undefined) return !!side.pinch;
  return sideHpPct(side) <= (1 / 3);
}

function battleMaxFallenAllies(field) {
  return field?.gameType === 'Doubles' ? 3 : 2;
}

function battleFallenAllies(side, field) {
  const n = Math.floor(Number(side?.fallenAllies || 0));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(battleMaxFallenAllies(field), n));
}

function abilityRuleApplies(rule, ctx) {
  if (!rule) return false;
  const { move, field, bp, moveType, weather, effectiveness, isCritical } = ctx;
  if (!categoryMatches(rule, ctx.isPhysical)) return false;
  if (!statusMatches(rule, ctx.atkSide?.status)) return false;
  if (rule.maxBp && bp > rule.maxBp) return false;
  if (rule.flag && !move.flags?.[rule.flag]) return false;
  if (rule.stat && rule.stat !== moveType) return false;
  if (rule.types && !rule.types.includes(moveType)) return false;
  if (rule.weather) {
    const weathers = Array.isArray(rule.weather) ? rule.weather : [rule.weather];
    if (!weathers.includes(weather)) return false;
  }
  if (rule.terrain && field.terrain !== rule.terrain) return false;
  if (rule.movesSecond && !field.atkMovesSecond) return false;
  if (rule.secondary && !move.sec) return false;
  if (rule.recoilOrCrash && !(move.recoil || move.hasCrashDamage)) return false;
  if (rule.pinch && !sideIsPinch(ctx.atkSide)) return false;
  if (rule.flashFireActive && !ctx.atkSide?.flashFireActive) return false;
  if (rule.unburdenActive && !ctx.atkSide?.unburdenActive) return false;
  if (rule.fullHP && !sideIsFullHp(ctx.defSide)) return false;
  if (rule.critical && !isCritical) return false;
  if (rule.effectiveness === 'superEffective' && !(effectiveness > 1)) return false;
  if (rule.effectiveness === 'resisted' && !(effectiveness < 1)) return false;
  return true;
}

function applyAbilityRuleMods(rules, ctx, outMods, label) {
  for (const rule of rules || []) {
    if (!abilityRuleApplies(rule, ctx)) continue;
    const mod = mechanicMod(rule.mod);
    outMods.push(mod);
    ctx.mods.push(formatModLabel(label, mod));
  }
}

function damageBlockApplies(block, pokemon, side, move, isPhysical) {
  if (!block) return false;
  if (block.manual && !side?.damageBlockActive) return false;
  if (block.fullHP && !sideIsFullHp(side)) return false;
  if (block.nonStatus && move.cat === 'Status') return false;
  if (block.category && block.category !== (isPhysical ? 'Physical' : 'Special')) return false;
  return pokemonMatchesCondition(pokemon, block);
}

function normalizedStatus(status) {
  const normalized = (status || 'none').toString().toLowerCase();
  if (['badly poison', 'badly poisoned', 'badlypoison', 'badlypoisoned'].includes(normalized)) return 'toxic';
  return normalized;
}

function isBurnStatus(status) {
  return ['burn', 'brn'].includes(normalizedStatus(status));
}

function isPoisonStatus(status) {
  return ['poison', 'toxic', 'psn', 'tox'].includes(normalizedStatus(status));
}

function isToxicStatus(status) {
  return ['toxic', 'tox'].includes(normalizedStatus(status));
}

function attackerBlocksBerries(atkAb) {
  return !!AbilityById[atkAb]?.blocksBerries;
}

function fixedDamageAmount(move, atkSide, defSide, atkStats, defStats, defAbilityData) {
  const atkHp = sideCurrentHp(atkStats.hp, atkSide);
  const defHp = sideCurrentHp(defStats.hp, defSide);

  if (move.damage === 'level') return RULES.level || 50;
  if (typeof move.damage === 'number') return move.damage;
  if (move.ohko) {
    if (typeof move.ohko === 'string' && effectiveTypes(defSide).includes(move.ohko)) return 0;
    return defAbilityData?.ohkoBlock ? 0 : defStats.hp;
  }

  switch (move.fixedDamageKind) {
    case 'targetHalfHp':
      return Math.max(1, Math.floor(defHp / 2));
    case 'sourceCurrentHp':
      return atkHp;
    case 'targetMinusSourceHp':
      return defHp > atkHp ? defHp - atkHp : 0;
    default:
      return null;
  }
}

function fixedDamageResult(damage, move, moveType, category, defStats, mods) {
  const dmg = Math.max(0, Math.floor(damage));
  const damages = new Array(16).fill(dmg);
  return {
    damages,
    rawDamages: damages,
    minPct: dmg / defStats.hp * 100,
    maxPct: dmg / defStats.hp * 100,
    effectiveness: dmg > 0 ? 1 : 0,
    moveType,
    category,
    bp: move.bp || 0,
    atk: 0,
    def: 0,
    defHP: defStats.hp,
    stab: false,
    mods,
  };
}

function computeVariableBp(move, atkSide, defSide, field, atkStats, defStats) {
  if (!move) return 0;
  const atkP = PokemonById[atkSide.pokemonIdx];
  const defP = PokemonById[defSide.pokemonIdx];
  const baseBp = move.bp || 0;
  const abilityCtx = battleAbilityContext(atkSide, defSide);
  const atkAb = abilityCtx.atkAb;
  const moldBreakerActive = !!AbilityById[atkAb]?.ignoresTargetAbility;
  const defAb = (moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(abilityCtx.defAb))
    ? ''
    : abilityCtx.defAb;
  const atkItem = effectiveBattleItem(atkSide, atkAb);
  const defItem = effectiveBattleItem(defSide, defAb);
  const rawDefItem = effectiveItem(defSide);
  const defAbilityData = AbilityById[defAb] || {};
  const weather = effectiveWeather(field, atkAb, defAb);

  if (move.manualBp) return baseBp;

  switch (move.variableBpKind) {
    case 'gyroBall': {
      // 25 × defSpe / atkSpe, 최소 1, 최대 150
      const aS = applyBoost(atkStats.spe, atkSide.ranks?.spe || 0);
      const dS = applyBoost(defStats.spe, defSide.ranks?.spe || 0);
      if (aS <= 0) return 1;
      return Math.min(150, Math.max(1, Math.floor(25 * dS / aS)));
    }
    case 'electroBall': {
      const aS = applyBoost(atkStats.spe, atkSide.ranks?.spe || 0);
      const dS = applyBoost(defStats.spe, defSide.ranks?.spe || 0);
      if (dS <= 0) return 150;
      const r = aS / dS;
      if (r >= 4) return 150;
      if (r >= 3) return 120;
      if (r >= 2) return 80;
      if (r >= 1) return 60;
      return 40;
    }
    case 'weightRatio': {
      const aw = effectiveWeight(atkSide, atkAb);
      const dw = Math.max(0.1, effectiveWeight(defSide, defAb));
      const r = aw / dw;
      if (r >= 5) return 120;
      if (r >= 4) return 100;
      if (r >= 3) return 80;
      if (r >= 2) return 60;
      return 40;
    }
    case 'targetWeight': {
      const w = effectiveWeight(defSide, defAb);
      if (w >= 200) return 120;
      if (w >= 100) return 100;
      if (w >= 50) return 80;
      if (w >= 25) return 60;
      if (w >= 10) return 40;
      return 20;
    }
    case 'userHp150': {
      // 150 × HP / maxHP. 기본 가정: 풀피
      const hp = sideHpPct(atkSide);
      return Math.max(1, Math.floor(150 * hp));
    }
    case 'lowHpFlail': {
      // 48분의 X 단위 비례
      const hp = sideHpPct(atkSide);
      const p = Math.floor(hp * 48);
      if (p < 2) return 200;
      if (p < 5) return 150;
      if (p < 10) return 100;
      if (p < 17) return 80;
      if (p < 33) return 40;
      return 20;
    }
    case 'targetHp100': {
      // 1 + floor(99 × targetHP / maxHP). 풀피 기본: 100
      const hp = sideHpPct(defSide);
      return Math.max(1, 1 + Math.floor(99 * hp));
    }
    case 'targetStatusDouble': {
      // 대상이 상태이상이면 ×2
      const st = defSide.status;
      return (st && st !== 'none') ? baseBp * 2 : baseBp;
    }
    case 'targetPoisonDouble': {
      // 대상이 독/맹독이면 ×2
      return isPoisonStatus(defSide.status) ? baseBp * 2 : baseBp;
    }
    case 'userStatusDouble': {
      // 사용자가 화상/마비/독/맹독이면 ×2 (수면 제외)
      // 화상 페널티는 별도로 calculateDamage 에서 면제 처리됨
      const st = atkSide.status;
      const dbl = st && !['none','Sleep','sleep','slp'].includes(st);
      return dbl ? baseBp * 2 : baseBp;
    }
    case 'knockOff': {
      // 대상이 도구를 보유하면 ×1.5 (Z아이템/메가스톤 등은 제외해야 정확하지만 단순화)
      const hasItem = !!rawDefItem;
      // 메가스톤은 떼낼 수 없으므로 보너스 없음
      const defItemData = rawDefItem ? ItemById[rawDefItem] : null;
      const removable = hasItem && !defItemData?.ms && !defAbilityData.blocksItemRemoval;
      return removable ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'userMovesFirstDouble': {
      // 사용자가 먼저 행동하면 ×2
      return field.atkMovesFirst ? baseBp * 2 : baseBp;
    }
    case 'userMovesSecondDouble': {
      // 사용자가 나중에 행동하면 ×2
      return field.atkMovesSecond ? baseBp * 2 : baseBp;
    }
    case 'userWasHitDouble':
      return atkSide.wasHit ? baseBp * 2 : baseBp;
    case 'targetWasHitDouble':
      return defSide.wasHit ? baseBp * 2 : baseBp;
    case 'electricTerrainTargetGroundedDouble': {
      const grounded = (typeof isGrounded === 'function') ? isGrounded(defSide, field, defAb, defItem) : true;
      return field.terrain === 'Electric' && grounded ? baseBp * 2 : baseBp;
    }
    case 'psychicTerrainUserGroundedBoost': {
      // 사이코필드 + 사용자 그라운드 시 ×1.5
      const grounded = (typeof isGrounded === 'function') ? isGrounded(atkSide, field, atkAb, atkItem) : true;
      return field.terrain === 'Psychic' && grounded ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'mistyTerrainUserGroundedBoost': {
      // 미스트필드 + 사용자 그라운드 시 ×1.5
      const grounded = (typeof isGrounded === 'function') ? isGrounded(atkSide, field, atkAb, atkItem) : true;
      return field.terrain === 'Misty' && grounded ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'gravityBoost': {
      // 중력장 시 ×1.5
      return field.isGravity ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'weatherWeakenedSolar': {
      // 쾌청/대쾌청 외 날씨에서 ×0.5 (모래/비/눈/눈보라/none → 0.5×)
      const w = weather;
      if (w === 'Rain' || w === 'Heavy Rain' || w === 'Sand' || w === 'Snow') {
        return Math.floor(baseBp * 0.5);
      }
      return baseBp;
    }
    case 'weatherBall': {
      // 날씨가 있으면 BP 100 (타입은 calculateDamage 에서 별도 처리)
      const w = weather;
      if (w && w !== 'none') return 100;
      return baseBp;
    }
    case 'terrainPulse': {
      // 필드 활성 + 사용자 그라운드 시 BP 100 (타입 별도)
      const grounded = (typeof isGrounded === 'function') ? isGrounded(atkSide, field, atkAb, atkItem) : true;
      const t = field.terrain;
      if (t && t !== 'none' && grounded) return 100;
      return baseBp;
    }
    case 'positiveBoostCount': {
      let total = 0;
      for (const k of ['atk','def','spa','spd','spe','accuracy','evasion']) {
        const r = atkSide.ranks?.[k] || 0;
        if (r > 0) total += r;
      }
      return 20 + 20 * total;
    }
    case 'fallenAllies': {
      const fa = battleFallenAllies(atkSide, field);
      return Math.min(350, 50 + 50 * fa);
    }
    case 'lastMoveFailedDouble':
      return atkSide.lastMoveFailed ? baseBp * 2 : baseBp;
    case 'noItemDouble':
      // 도구 미보유 시 ×2 (55 → 110)
      return !atkSide.item ? baseBp * 2 : baseBp;
    case 'requiresTargetItem':
      return rawDefItem ? baseBp : 0;
    case 'requiresTerrain':
      return field.terrain && field.terrain !== 'none' ? baseBp : 0;
    case 'tripleAxelAverage':
      // 1/2/3타에 BP 20/40/60 누적. 다단히트 평균 처리에선 (20+40+60)/3 = 40
      return 40;
    case 'beatUpApprox':
      // 동료 base atk 기반. 단순화: 기본값 유지 (실전에서 더블배틀에서만 의미)
      return 10;
    default:
      return baseBp;
  }
}

/* ════════════════════════════════════════════════════════════
   메인 대미지 계산 (Gen 9 공식 방식)
   ────────────────────────────────────────────────────────────
   처리 순서 (각 STAGE 는 함수 본문에 그대로 표기되어 있음):

     prelude  : 입력 검증, 디스가이즈 / 무효 타입 / 방어 등 조기 종료 분기
                기술 타입 결정 (Aerilate-family, Weather Ball 등)
     STAGE 1  : BP modifiers
                  - 특성 (Technician, Tough Claws 등)
                  - 도구 (1.2× 도구, 플레이트, 펀치글러브 등)
                  - 필드 (Electric / Grassy / Psychic 부스트 등)
     STAGE 2  : Atk 보정 (스탯 단계, 위협, Huge Power, Choice Band 등)
                + 화상 ×0.5 (Facade / Guts 예외)
     STAGE 3  : Def 보정 (스탯 단계, 모래/눈 weather defense, 도구, Ruin)
     STAGE 4  : Base Damage = floor(((2*Lv/5+2) * BP * Atk / Def) / 50 + 2)
                + 날씨 / 도우미 / 부자유친 / 스프레드 등 baseDamage 직접 보정
     STAGE 5  : Final modifiers + 16-roll randomizer
                STAB → 타입 효과 → final mod → 다단/부자유친 hit 수 곱

   반환: { damages[16], rawDamages, multihitCount, minPct, maxPct,
           effectiveness, moveType, category, bp, atk, def, defHP, mods }
   ════════════════════════════════════════════════════════════ */
function finishDamageStage(result) {
  return { done: true, result };
}

function makeDamageContext(atkSide, defSide, move, field) {
  const atkP = PokemonById[atkSide.pokemonIdx];
  const defP = PokemonById[defSide.pokemonIdx];
  if (!atkP || !defP) return { invalid: true };

  const abilityCtx = battleAbilityContext(atkSide, defSide);
  const atkAb = abilityCtx.atkAb;
  const rawDefAb = abilityCtx.defAb;
  const moldBreakerActive = !!AbilityById[atkAb]?.ignoresTargetAbility;
  const defAb = (moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(rawDefAb)) ? '' : rawDefAb;
  const atkItem = effectiveBattleItem(atkSide, atkAb);
  const defItem = effectiveBattleItem(defSide, defAb);

  return {
    atkSide,
    defSide,
    move,
    field,
    mods: [],
    atkP,
    defP,
    abilityCtx,
    atkAb,
    defAb,
    atkAbilityData: atkAb ? AbilityById[atkAb] : null,
    defAbilityData: defAb ? AbilityById[defAb] : null,
    atkItem,
    defItem,
    atkItemData: atkItem ? ItemById[atkItem] : null,
    defItemData: defItem ? ItemById[defItem] : null,
    weather: effectiveWeather(field, atkAb, defAb),
    itemCtx: { atkItem, defItem },
    defTypes: effectiveTypes(defSide),
    atkStats: calcStats(atkSide),
    defStats: calcStats(defSide),
    moveType: move.type,
    bp: 0,
    category: move.cat,
    typeChangeMod: null,
    isPhysical: false,
    usesDefStat: false,
    isCritical: false,
    effectiveness: 1,
    atkStat: 0,
    defStat: 0,
    baseDmg: 0,
  };
}

function resolveDamagePreludeStage(ctx) {
  const {
    atkSide, defSide, move, field, mods,
    atkP, defP, atkAb, defAb, atkItem,
    atkAbilityData, defAbilityData, abilityCtx, itemCtx, weather, atkStats, defStats,
  } = ctx;

  // ─ 디스가이즈 (Mimikyu / Mimikyu-Totem): 풀피일 때 첫 공격 무효 ─
  // 챔피언스 사양: onEffectiveness 가 0 반환 → 데미지 0
  // 다단히트도 first hit 에 neutral 플래그가 set 되어 모든 hit 가 차단됨 (champions/abilities.ts:14-32)
  if (damageBlockApplies(defAbilityData?.damageBlock, defP, defSide, move, move.cat === 'Physical')) {
    return finishDamageStage({
      damages: new Array(16).fill(0),
      minPct: 0, maxPct: 0,
      effectiveness: 0,
      moveType: move.type, category: move.cat,
      bp: move.bp, atk: 0, def: 0,
      defHP: defStats.hp,
      mods: [`${displayName(defAbilityData)} 차단`]
    });
  }

  // ─ 기술 타입 결정 ─
  let moveType = move.type;
  // 가변 위력 기술은 callback 으로 실제 BP 계산
  let bp = computeVariableBp(move, atkSide, defSide, field, atkStats, defStats);
  let category = move.cat;

  // Weather Ball: 날씨에 따라 타입 변경 (BP는 computeVariableBp 에서 처리됨)
  if (!move.manualType && move.typeChangeKind === 'weatherBall') {
    const wt = weather;
    if (wt === 'Sun' || wt === 'Harsh Sunshine') moveType = 'Fire';
    else if (wt === 'Rain' || wt === 'Heavy Rain') moveType = 'Water';
    else if (wt === 'Sand') moveType = 'Rock';
    else if (wt === 'Snow') moveType = 'Ice';
    if (wt && wt !== 'none') mods.push(`웨더볼 → ${displayType(moveType)}`);
  }
  // Terrain Pulse: 필드에 따라 타입 변경 (그라운드 시)
  if (!move.manualType && move.typeChangeKind === 'terrainPulse') {
    const grounded = isGrounded(atkSide, field, atkAb, atkItem);
    if (grounded) {
      if (field.terrain === 'Electric') moveType = 'Electric';
      else if (field.terrain === 'Grassy') moveType = 'Grass';
      else if (field.terrain === 'Misty') moveType = 'Fairy';
      else if (field.terrain === 'Psychic') moveType = 'Psychic';
      if (field.terrain && field.terrain !== 'none') mods.push(`테레인펄스 → ${displayType(moveType)}`);
    }
  }

  let typeChangeMod = null;
  const abilityTypeChange = atkAbilityData?.typeChange;
  if (!move.manualType && abilityTypeChange && (!abilityTypeChange.flag || move.flags?.[abilityTypeChange.flag])) {
    if (!abilityTypeChange.from || moveType === abilityTypeChange.from) {
      moveType = abilityTypeChange.type;
      typeChangeMod = abilityTypeChange.mod || null;
      mods.push(atkAbilityData.koName || atkAbilityData.name);
    }
  }

  // Tera Blast: 테라스탈 시 공격 > 특공이면 물리
  if (!move.manualType && move.typeChangeKind === 'teraBlast' && isTeraActive(atkSide)) {
    moveType = atkSide.teraType;
    const physAtk = applyBoost(atkStats.atk, atkSide.ranks.atk || 0);
    const specAtk = applyBoost(atkStats.spa, atkSide.ranks.spa || 0);
    if (physAtk > specAtk) category = 'Physical';
    // Stellar Tera Blast: 고정 100 BP
    if (atkSide.teraType === 'Stellar') bp = 100;
  }

  // Tera Starstorm (Terapagos-Stellar): 스텔라 타입
  if (!move.manualType && move.typeChangeKind === 'teraStarstorm' && atkP.id === 'terapagosstellar') {
    moveType = 'Stellar';
  }

  // Tera Blast / Photon Geyser: 공격 > 특공이면 물리
  if (move.categoryChangeKind === 'higherOffense' && (move.typeChangeKind !== 'teraBlast' || isTeraActive(atkSide))) {
    const physAtk = applyBoost(atkStats.atk, atkSide.ranks.atk || 0);
    const specAtk = applyBoost(atkStats.spa, atkSide.ranks.spa || 0);
    if (physAtk > specAtk) category = 'Physical';
  }

  const isPhysical = category === 'Physical';
  const usesDefStat = move.overrideDefensiveStat
    ? move.overrideDefensiveStat === 'def'
    : isPhysical;
  const criticalOnStatus = atkAbilityData?.criticalOnTargetStatus;
  let isCritical = !!move.willCrit
    || !!field.isCritical
    || (criticalOnStatus === 'poison' && isPoisonStatus(defSide.status));
  if (isCritical && defAbilityData?.blocksCritical) {
    isCritical = false;
    mods.push('급소 차단');
  } else if (criticalOnStatus === 'poison' && isPoisonStatus(defSide.status)) {
    mods.push(`${displayName(atkAbilityData)} 급소`);
  }

  // ─ 타입 상성 먼저 계산 (0배면 조기 종료) ─
  const effectiveness = getMoveEffectiveness(move, moveType, atkSide, defSide, field, { ...abilityCtx, atkAb, defAb }, itemCtx);
  if (effectiveness === 0) {
    return finishDamageStage({
      damages: new Array(16).fill(0),
      minPct: 0, maxPct: 0,
      effectiveness: 0,
      moveType, category,
      bp, atk: 0, def: 0,
      defHP: defStats.hp,
      mods: ['효과 없음']
    });
  }

  ctx.moveType = moveType;
  ctx.bp = bp;
  ctx.category = category;
  ctx.typeChangeMod = typeChangeMod;
  ctx.isPhysical = isPhysical;
  ctx.usesDefStat = usesDefStat;
  ctx.isCritical = isCritical;
  ctx.effectiveness = effectiveness;
  return null;
}

function calculateBasePowerStage(ctx) {
  const {
    atkSide, defSide, move, field, mods,
    atkP, defP, atkAb, defAb, atkItem, defItem, atkItemData, atkAbilityData, defAbilityData,
    weather, atkStats, defStats, isPhysical, effectiveness, category,
  } = ctx;
  let { moveType, bp, typeChangeMod } = ctx;

  // ═══════════════════════════════════════
  // STAGE 1: BP modifiers
  // ═══════════════════════════════════════
  if (damageBlockApplies(defAbilityData?.damageBlock, defP, defSide, move, isPhysical)) {
    return finishDamageStage({
      damages: new Array(16).fill(0),
      minPct: 0, maxPct: 0,
      effectiveness,
      moveType, category,
      bp, atk: 0, def: 0,
      defHP: defStats.hp,
      mods: [`${displayName(defAbilityData)} 차단`]
    });
  }

  const fixedDamage = fixedDamageAmount(move, atkSide, defSide, atkStats, defStats, defAbilityData);
  if (fixedDamage !== null) {
    return finishDamageStage(fixedDamageResult(fixedDamage, move, moveType, category, defStats, ['고정 대미지']));
  }
  if (bp === 0) return finishDamageStage(null);

  const bpMods = [];

  applyAbilityRuleMods(atkAbilityData?.bpBoosts, ctx, bpMods, atkAbilityData?.koName || atkAbilityData?.name || atkAb);
  if (typeChangeMod) bpMods.push(typeChangeMod);  // Aerilate 등

  const auraBreakActive = atkAbilityData?.reversesAura || defAbilityData?.reversesAura;
  for (const abilityData of [atkAbilityData, defAbilityData]) {
    const aura = abilityData?.aura;
    if (!aura || aura.type !== moveType) continue;
    const mod = auraBreakActive ? aura.reversedMod : aura.mod;
    const auraMod = mechanicMod(mod);
    bpMods.push(auraMod);
    mods.push(formatModLabel(displayName(abilityData), auraMod));
  }

  const fallenAllies = battleFallenAllies(atkSide, field);
  if (atkAbilityData?.supremeOverlord && fallenAllies) {
    const mod = 4096 + fallenAllies * 410;  // Champions: 63 singles max 2, 64 doubles max 3
    bpMods.push(mod);
    mods.push(`총대장 ${formatCalcMultiplier(mod)} (쓰러진 아군 ${fallenAllies})`);
  }

  // 재앙 효과는 Atk/Def 스탯 단계에서 처리됨 (아래 STAGE 2/3 참조)

  // 진홍빛고동 (Orichalcum Pulse): 자기 진입시 쾌청 + 공격 1.33×
  // 하드론엔진 (Hadron Engine): 자기 진입시 일렉트릭 필드 + 특공 1.33×
  // 이건 Atk 단계로 이동

  // 아이템 BP modifiers
  if (atkItemData) {
    if (atkItemData.typeBoostType === moveType) {
      bpMods.push(MOD.x1_2);
      mods.push(formatModLabel(atkItemData.koName, MOD.x1_2));
    }

    const powerBoostKind = atkItemData.powerBoostKind;
    const powerBoostApplies =
      (powerBoostKind === 'physical' && isPhysical) ||
      (powerBoostKind === 'special' && !isPhysical) ||
      (powerBoostKind === 'punch' && move.flags?.punch);
    if (powerBoostApplies) {
      const mod = mechanicMod(atkItemData.powerBoostMod);
      bpMods.push(mod);
      mods.push(formatModLabel(atkItemData.koName, mod));
    }

    const speciesTypeBoost = atkItemData.speciesTypeBoost;
    if (speciesTypeBoost && pokemonMatchesCondition(atkP, speciesTypeBoost) && speciesTypeBoost.types?.includes(moveType)) {
      const mod = mechanicMod(speciesTypeBoost.mod);
      bpMods.push(mod);
      mods.push(formatModLabel(atkItemData.koName, mod));
    }
  }

  applyFieldRuleMods(fieldMechanics().bpMods, ctx, bpMods);

  // 응용: 챔피언스 신규 메가 특성 "메가솔라" — 항상 쾌청 효과로 간주
  // 이건 실제 날씨를 세팅하지 않으므로 BP 단계에서 불꽃 ×1.5 추가하지 않고 Weather에서 처리

  ctx.moveType = moveType;
  ctx.bp = OF16(Math.max(1, pokeRound(bp * chainMods(bpMods, 1, 65535) / 4096)));
  return null;
}

function calculateAttackStage(ctx) {
  const {
    atkSide, defSide, move, field, mods,
    atkP, atkAb, defAb, atkItem, atkAbilityData, defAbilityData, weather, atkStats, defStats,
    isPhysical, isCritical, moveType,
  } = ctx;

  // ═══════════════════════════════════════
  // STAGE 2: Attack modifiers
  // ═══════════════════════════════════════
  const attackSource = move.overrideOffensivePokemon === 'target' ? defSide : atkSide;
  const attackStats = move.overrideOffensivePokemon === 'target' ? defStats : atkStats;
  const attackStatId = move.overrideOffensiveStat || (isPhysical ? 'atk' : 'spa');
  let atkStat = attackStats[attackStatId];
  let atkBoost = attackSource.ranks?.[attackStatId] || 0;

  // Unaware: 상대 부스트 무시
  if ((move.ignoreOffensive || defAbilityData?.ignoreOffensiveBoosts) && atkBoost > 0) atkBoost = 0;
  // 급소 시 공격 하락 무시
  if ((isCritical || move.ignoreNegativeOffensive) && atkBoost < 0) atkBoost = 0;

  atkStat = applyBoost(atkStat, atkBoost);
  if (atkBoost !== 0) mods.push(`공격랭크${atkBoost > 0 ? '+' : ''}${atkBoost}`);

  const atkMods = [];

  applyAbilityRuleMods(atkAbilityData?.attackStatBoosts, ctx, atkMods, atkAbilityData?.koName || atkAbilityData?.name || atkAb);
  applyAbilityRuleMods(defAbilityData?.defensiveAttackMods, ctx, atkMods, defAbilityData?.koName || defAbilityData?.name || defAb);

  // 고대활성 / 쿼크차지: 쾌청-or-부에가 / 일렉트릭-or-부에가 발동 시 최고 스탯 ×1.3 (HP는 ×1.5)
  // 어떤 스탯이 부스트 받는지 결정: 가장 높은 실수치 스탯
  const atkParadoxBoost = activeParadoxBoost(atkAbilityData, field, weather, ctx.atkItemData, atkSide);

  if (atkParadoxBoost) {
    // 가장 높은 base+EV+nature 스탯 결정 (HP 제외)
    const boostStat = highestBattleStat(atkStats);

    if ((isPhysical && boostStat === 'atk') || (!isPhysical && boostStat === 'spa')) {
      const mod = mechanicMod(atkParadoxBoost.mod);
      atkMods.push(mod);
      const name = atkAbilityData?.koName || atkAbilityData?.name || atkAb;
      mods.push(formatModLabel(name, mod, STAT_LABEL[boostStat]));
    }
  }

  // 재앙 적용 (Atk 단계)
  // 목간의재앙: 자기가 아닌 타 포켓몬의 공격 ×0.75 (자기 자신 효과 X)
  // 그릇의재앙: 자기가 아닌 타 포켓몬의 특공 ×0.75
  if (field.ruinTablet && atkAbilityData?.ruinExemption !== 'ruinTablet' && isPhysical) {
    atkMods.push(MOD.x0_75); mods.push('목간의재앙×0.75');
  }
  if (field.ruinVessel && atkAbilityData?.ruinExemption !== 'ruinVessel' && !isPhysical) {
    atkMods.push(MOD.x0_75); mods.push('그릇의재앙×0.75');
  }

  // 챔피언스 신규: 메가장크로다일 드래곤스킨 (노말→드래곤)
  // (데이터 레이어에서 처리되어야 하지만 여기서도 핸들링)

  // 능력치 rank 감소 없음 특성
  // (별도 적용 필요 없음, 단순 rank 처리)

  // 아이템 공격 modifiers
  if (ctx.atkItemData?.attackStatBoost) {
    const statBoost = ctx.atkItemData.attackStatBoost;
    if (statBoostApplies(atkP, statBoost, attackStatId)) {
      const mod = mechanicMod(statBoost.mod);
      atkMods.push(mod);
      mods.push(formatModLabel(ctx.atkItemData.koName, mod));
    }
  }

  // 화상: Facade / Guts 예외
  const isBurned = isBurnStatus(atkSide.status) && isPhysical && !atkAbilityData?.burnBypass && !move.burnBypass;
  if (isBurned) { atkMods.push(MOD.x0_5); mods.push('화상 물리½'); }

  ctx.atkStat = OF16(Math.max(1, pokeRound(atkStat * chainMods(atkMods, 410, 131072) / 4096)));
  return null;
}

function activeParadoxBoost(abilityData, field, weather, itemData, side) {
  const boost = abilityData?.paradoxBoost;
  if (!boost) return null;
  const weatherMatches = boost.weather && asArray(boost.weather).includes(weather);
  const terrainMatches = boost.terrain && field.terrain === boost.terrain;
  const itemMatches = boost.itemActivation && sideParadoxItemActive(side, itemData);
  return (weatherMatches || terrainMatches || itemMatches) ? boost : null;
}

function highestBattleStat(stats) {
  return ['atk', 'def', 'spa', 'spd', 'spe']
    .map(stat => ({ stat, val: stats[stat] }))
    .sort((a, b) => b.val - a.val)[0].stat;
}

function calculateDefenseStage(ctx) {
  const {
    atkSide, defSide, move, field, mods,
    defP, atkAb, defAb, defItem, defAbilityData, weather, atkStats, defStats, defTypes,
    isPhysical, isCritical, usesDefStat,
  } = ctx;

  // ═══════════════════════════════════════
  // STAGE 3: Defense modifiers
  // ═══════════════════════════════════════
  const defenseSource = move.overrideDefensivePokemon === 'source' ? atkSide : defSide;
  const defenseStats = move.overrideDefensivePokemon === 'source' ? atkStats : defStats;
  const defenseStatId = move.overrideDefensiveStat || (isPhysical ? 'def' : 'spd');
  let defStat = defenseStats[defenseStatId];
  let defBoost = defenseSource.ranks?.[defenseStatId] || 0;

  // Unaware (공격측이)
  if ((move.ignoreDefensive || ctx.atkAbilityData?.ignoreDefensiveBoosts) && defBoost > 0) defBoost = 0;
  // 급소 시 방어 상승 무시
  if ((isCritical || move.ignorePositiveDefensive) && defBoost > 0) defBoost = 0;

  defStat = applyBoost(defStat, defBoost);
  if (defBoost !== 0) mods.push(`방어랭크${defBoost > 0 ? '+' : ''}${defBoost}`);

  // 모래바람 바위 특방 ×1.5
  if (weather === 'Sand' && defTypes.includes('Rock') && !usesDefStat) {
    defStat = Math.floor(defStat * 1.5);
    mods.push('모래 바위 특방×1.5');
  }
  // 눈 얼음 방어 ×1.5
  if (weather === 'Snow' && defTypes.includes('Ice') && usesDefStat) {
    defStat = Math.floor(defStat * 1.5);
    mods.push('눈 얼음 방어×1.5');
  }

  const defMods = [];

  applyAbilityRuleMods(defAbilityData?.defenseStatBoosts, {
    ...ctx,
    atkSide: defSide,
    isPhysical: usesDefStat,
    moveType: usesDefStat ? 'def' : 'spd',
  }, defMods, defAbilityData?.koName || defAbilityData?.name || defAb);

  // 고대활성/쿼크차지 방어 부스트 (방어/특방이 최고 스탯일 때)
  const defParadoxBoost = activeParadoxBoost(defAbilityData, field, weather, ctx.defItemData, defSide);
  if (defParadoxBoost) {
    const boostStat = highestBattleStat(defStats);
    if ((usesDefStat && boostStat === 'def') || (!usesDefStat && boostStat === 'spd')) {
      const mod = mechanicMod(defParadoxBoost.mod);
      defMods.push(mod);
      const name = defAbilityData?.koName || defAbilityData?.name || defAb;
      mods.push(formatModLabel(`${name} 방어`, mod, STAT_LABEL[boostStat]));
    }
  }

  // 재앙 (Def 단계)
  // 검의재앙: 자기가 아닌 타 포켓몬의 방어 ×0.75
  // 구슬의재앙: 자기가 아닌 타 포켓몬의 특방 ×0.75
  if (field.ruinSword && defAbilityData?.ruinExemption !== 'ruinSword' && usesDefStat) {
    defMods.push(MOD.x0_75); mods.push('검의재앙×0.75');
  }
  if (field.ruinBeads && defAbilityData?.ruinExemption !== 'ruinBeads' && !usesDefStat) {
    defMods.push(MOD.x0_75); mods.push('구슬의재앙×0.75');
  }

  // 아이템 방어 modifiers
  if (ctx.defItemData?.defenseStatBoost) {
    const statBoost = ctx.defItemData.defenseStatBoost;
    if (statBoostApplies(defP, statBoost, defenseStatId)) {
      const mod = mechanicMod(statBoost.mod);
      defMods.push(mod);
      mods.push(formatModLabel(ctx.defItemData.koName, mod));
    }
  }

  ctx.defStat = OF16(Math.max(1, pokeRound(defStat * chainMods(defMods, 410, 131072) / 4096)));
  return null;
}

function calculateBaseDamageStage(ctx) {
  const {
    move, field, mods, atkAb, atkAbilityData, atkItem, atkItemData, defItem, defItemData, weather, defStats,
    moveType, category, bp, atkStat, defStat, effectiveness, isCritical,
  } = ctx;

  // ═══════════════════════════════════════
  // STAGE 4: Base Damage
  // ═══════════════════════════════════════
  const level = 50;
  let baseDmg = Math.floor(
    Math.floor(
      Math.floor((2 * level) / 5 + 2) * bp * atkStat / defStat
    ) / 50 + 2
  );

  // Spread (더블배틀 광역기)
  const isSpread = field.gameType === 'Doubles' &&
    ['allAdjacent','allAdjacentFoes'].includes(move.tgt);
  if (isSpread) {
    baseDmg = pokeRound(baseDmg * 3072 / 4096);
    mods.push('광역×0.75');
  }

  // 날씨 (Base damage에 적용, 특성 해제: Utility Umbrella)
  // 메가솔(Mega Sol): 자기 공격은 쾌청 효과 (실제 날씨 무시)
  // - 자기 불꽃 ×1.5
  // - 자기 물 ×0.5는 적용 안됨 (메가솔은 일방향 효과)
  const damageWeather = atkAbilityData?.weatherDamageOverride || weather;
  const ignoresWeatherDamagePenalty = !!atkAbilityData?.ignoreWeatherDamagePenalty;

  if (!atkItemData?.ignoresWeatherDamageModifiers && !defItemData?.ignoresWeatherDamageModifiers) {
    const weatherRule = firstMatchingFieldRule(fieldMechanics().weatherDamageMods, {
      ...ctx,
      damageWeather,
      ignoresWeatherDamagePenalty,
    });

    if (weatherRule?.nullDamage) {
      return finishDamageStage({
        damages: new Array(16).fill(0),
        minPct: 0,
        maxPct: 0,
        effectiveness: 0,
        moveType,
        category,
        bp,
        atk: atkStat,
        def: defStat,
        defHP: defStats.hp,
        mods: [weatherRule.label],
      });
    }
    if (weatherRule) {
      baseDmg = pokeRound(baseDmg * mechanicMod(weatherRule.mod) / 4096);
      if (atkAbilityData?.weatherDamageOverride && weatherRule.types?.includes(moveType)) {
        const name = atkAbilityData?.koName || atkAbilityData?.name || atkAb;
        mods.push(formatModLabel(`${name} ${displayType(moveType)}`, weatherRule.mod));
      } else {
        mods.push(weatherRule.label);
      }
    }
  }

  // Critical
  if (isCritical) {
    baseDmg = Math.floor(baseDmg * 1.5);
    mods.push('급소×1.5');
  }

  ctx.baseDmg = baseDmg;
  return null;
}

function calculateFinalDamageStage(ctx) {
  const {
    atkSide, defSide, move, field, mods,
    atkAb, defAb, atkItem, atkItemData, defItem, defItemData, defStats,
    moveType, category, bp, atkStat, defStat, baseDmg,
    effectiveness, isPhysical, isCritical,
  } = ctx;

  // ═══════════════════════════════════════
  // STAGE 5: Final modifiers & 16 rolls
  // ═══════════════════════════════════════
  const stabMod = getStabMod(atkSide, moveType);
  // STAB ×1.5는 카드 헤더의 '자속' 마크로 표시하므로 mods 추적 생략
  if (stabMod === 8192) mods.push('테라 매칭 STAB×2');
  else if (stabMod === 9216) mods.push('다능 STAB×2.25');

  const finalMods = [];

  if (!isCritical && !ctx.atkAbilityData?.ignoresScreens) {
    for (const rule of fieldMechanics().screenFinalMods || []) {
      if (!fieldRuleApplies(rule, ctx)) continue;
      const mod = field.gameType === 'Doubles' ? rule.doublesMod : rule.singlesMod;
      finalMods.push(mechanicMod(mod));
      mods.push(rule.label);
    }
  }

  applyAbilityRuleMods(ctx.defAbilityData?.defensiveFinalMods, ctx, finalMods, ctx.defAbilityData?.koName || ctx.defAbilityData?.name || defAb);
  applyAbilityRuleMods(ctx.atkAbilityData?.finalDamageBoosts, ctx, finalMods, ctx.atkAbilityData?.koName || ctx.atkAbilityData?.name || atkAb);

  // Aerilate/Refrigerate etc. already applied in BP stage

  // 아이템
  if (atkItemData?.finalDamageBoost) {
    const boost = atkItemData.finalDamageBoost;
    const applies = boost.kind === 'always' || (boost.kind === 'superEffective' && effectiveness > 1);
    if (applies) {
      const mod = mechanicMod(boost.mod);
      finalMods.push(mod);
      mods.push(formatModLabel(atkItemData.koName, mod));
    }
  }
  // Metronome item requires consecutive-move context and is intentionally omitted for one-shot damage.

  // 여보먹열매 (효과굉장 시 0.5×) — 단발 계산이라 단순 적용
  const resistBerryType = defItemData?.resistBerryType;
  const resistBerryRequiresWeakness = defItemData?.resistBerryRequiresWeakness !== false;
  const resistBerryApplies = resistBerryType === moveType && (!resistBerryRequiresWeakness || effectiveness > 1);
  if (resistBerryApplies && !attackerBlocksBerries(atkAb)) {
    const ripenMod = ctx.defAbilityData?.resistBerryMod;
    finalMods.push(ripenMod ? mechanicMod(ripenMod) : MOD.x0_5);
    const berryName = defItemData?.koName || defItem;
    const ripenName = ctx.defAbilityData?.koName || ctx.defAbilityData?.name || defAb;
    mods.push(`${berryName}${ripenMod ? `+${ripenName}` : ''}${formatCalcMultiplier(ripenMod ? mechanicMod(ripenMod) : MOD.x0_5)}`);
  }

  const finalMod = chainMods(finalMods, 41, 131072);

  // ═ 16개 롤 계산 ═
  const damages = [];
  for (let i = 0; i < 16; i++) {
    // 85 + i 퍼센트 랜덤
    let d = Math.floor(OF32(baseDmg * (85 + i)) / 100);

    // STAB
    if (stabMod !== 4096) d = OF32(d * stabMod) / 4096;
    d = Math.floor(OF32(pokeRound(d) * effectiveness));

    // 화상은 공격 스탯에서 이미 처리됨

    // 스크린 (중복 방지: 이미 finalMod에 포함)
    // Final mod
    d = OF16(pokeRound(Math.max(1, OF32(d * finalMod) / 4096)));
    damages.push(d);
  }

  // Multi-hit 처리
  let multihitDamages = null;
  let parentalBondActive = false;

  // 부자유친 (Parental Bond): 다단기/광역기/특정 기술 제외하고 1타 100% + 2타 25% = 평균 1.25×
  // 단, 단일 타깃 공격기에만 적용
  const extraHit = ctx.atkAbilityData?.extraHitModifier;
  if (extraHit?.singleHitOnly && !move.mh && category !== 'Status' &&
      !(field.gameType === 'Doubles' && ['allAdjacent','allAdjacentFoes'].includes(move.tgt))) {
    parentalBondActive = true;
    mods.push(`${ctx.atkAbilityData.koName || ctx.atkAbilityData.name} 추가타`);
    multihitDamages = damages.map(d => Math.floor(d * mechanicMod(extraHit.mod) / 4096));
  }

  if (move.mh && !parentalBondActive) {
    let hits;
    if (Array.isArray(move.mh)) {
      // [min, max] 범위 → 평균 hit 수 사용 (기본 3.167 for 2~5)
      // Loaded Dice 가 있으면 최대치에 가까움
      if (atkItemData?.multiHitModifier === 'loadedDice') {
        hits = move.mh[1] === 5 ? 4.5 : move.mh[1];  // 2~5 → 4.5, 그 외 최대
      } else if (ctx.atkAbilityData?.multiHitModifier === 'max') {
        hits = move.mh[1];  // 최대
      } else {
        hits = (move.mh[0] + move.mh[1]) / 2;  // 평균 (근사)
        // 2~5 공식값: 3.167 (Gen 5+)
        if (move.mh[0] === 2 && move.mh[1] === 5) hits = 3.167;
      }
    } else {
      hits = move.mh;
    }
    multihitDamages = damages.map(d => Math.floor(d * hits));
  }

  const finalDamages = multihitDamages || damages;
  const minPct = (finalDamages[0] / defStats.hp * 100);
  const maxPct = (finalDamages[15] / defStats.hp * 100);

  return {
    damages: finalDamages,
    rawDamages: damages,
    multihitCount: move.mh,
    minPct, maxPct,
    effectiveness,
    moveType, category,
    bp, atk: atkStat, def: defStat,
    defHP: defStats.hp,
    stab: stabMod !== 4096,
    mods
  };
}

function calculateDamage(atkSide, defSide, move, field) {
  if (!move || move.cat === 'Status') return null;

  const ctx = makeDamageContext(atkSide, defSide, move, field);
  if (ctx.invalid) return null;

  const stages = [
    resolveDamagePreludeStage,
    calculateBasePowerStage,
    calculateAttackStage,
    calculateDefenseStage,
    calculateBaseDamageStage,
  ];

  for (const stage of stages) {
    const outcome = stage(ctx);
    if (outcome?.done) return outcome.result;
  }

  return calculateFinalDamageStage(ctx);
}

/* ════════════════════════════════════════════════════════════
   진입 위험 (스텔스록 / 압정뿌리기) 데미지 계산
   ════════════════════════════════════════════════════════════ */
function calcHazardDamage(defSide, field) {
  let total = 0;
  const hp = calcStats(defSide).hp;
  // 스텔스록: 바위 약점 비율 ×기본 1/8
  if (field.defStealthRock) {
    const types = effectiveTypes(defSide);
    const eff = typeEff('Rock', types); // 0/0.25/0.5/1/2/4 중 하나
    if (eff > 0) total += Math.floor(hp * eff / 8);
  }
  // 압정뿌리기: 지면에 닿은 포켓몬에게만
  if (field.defSpikesLayers > 0 && isGrounded(defSide, field)) {
    const layerDmg = [0, 1/8, 1/6, 1/4][field.defSpikesLayers] || 0;
    total += Math.floor(hp * layerDmg);
  }
  return Math.max(0, total);
}

/* ════════════════════════════════════════════════════════════
   확정 N타 계산 (자뭉열매 반영)
   startHp: 시뮬레이션 시작 HP (스텔스록 등 반영). 미지정 시 풀피.
   ════════════════════════════════════════════════════════════ */
function simulateKO(dmg, hp, defItemData, defAbilityData, startHp) {
  let cur = (typeof startHp === 'number' && startHp > 0) ? startHp : hp;
  if (cur <= 0) return 1;
  const halfHP = Math.floor(hp / 2);
  const hpRecovery = defItemData?.hpRecovery;
  const residualRecovery = defItemData?.residualRecovery;
  const berryHeal = Math.floor(hp * fractionValue(hpRecovery?.fraction, 1 / 4));
  const residualHeal = Math.floor(hp * fractionValue(residualRecovery?.fraction, 1 / 16));
  let berryUsed = hpRecovery?.kind !== 'sitrus';
  for (let n = 1; n <= 10; n++) {
    cur -= dmg;
    if (cur <= 0) return n;
    if (!berryUsed && hpRecovery?.trigger === 'halfHp' && cur <= halfHP) {
      cur = Math.min(hp, cur + berryHeal);
      berryUsed = true;
    }
    if (residualRecovery?.kind === 'endTurn') cur = Math.min(hp, cur + residualHeal);
    if (defAbilityData?.residualRecovery) {
      cur = Math.min(hp, cur + Math.floor(hp * fractionValue(defAbilityData.residualRecovery.fraction, 1 / 8)));
    }
  }
  return 11;
}

function hkoLabel(damages, hp, defSide, field) {
  const max = damages[15];
  const min = damages[0];
  if (max <= 0) return { label: "대미지", turns: "없음", pct: "", cls: "no" };
  const defItem = effectiveItem(defSide);
  const defItemData = defItem ? ItemById[defItem] : null;
  const defAb = effectiveAbility(defSide);
  const defAbilityData = defAb ? AbilityById[defAb] : null;

  // 진입 위험 (스텔스록/압정뿌리기) 데미지를 시작 HP 에서 차감
  const hazardDmg = field ? calcHazardDamage(defSide, field) : 0;
  const currentHp = sideCurrentHp(hp, defSide);
  const startHp = Math.max(1, currentHp - hazardDmg);
  const hazardActive = hazardDmg > 0;

  // 기합의띠/옹골참은 HP 풀피일 때만 발동. 진입 위험으로 1HP 라도 깎였다면 무효.
  const hasFocusSash = defItemData?.koSurvival === 'fullHpNoHazards' && sideIsFullHp(defSide) && !hazardActive;
  const hasSturdy = defAbilityData?.koSurvival === 'fullHpNoHazards' && sideIsFullHp(defSide) && !hazardActive;
  const survives1HKO = hasFocusSash || hasSturdy;

  // 1타 판정은 진입 위험 후의 startHp 기준
  const oneHits = damages.filter(d => d >= startHp).length;

  // 확정 1타 (기합의띠 없을 때만)
  if (oneHits === 16 && !survives1HKO) {
    return { label: "확정", turns: "1타", pct: "", cls: "ohko" };
  }
  // 기합의띠/옹골참으로 1타 회피
  if (oneHits === 16 && survives1HKO) {
    const reason = hasFocusSash ? '기합의띠' : '옹골참';
    return { label: "확정", turns: "2타", pct: "", cls: "ohko", sub: `${reason}로 1타 회피` };
  }

  const hasSitrus = defItemData?.hpRecovery?.kind === 'sitrus';

  if (oneHits > 0) {
    const pct = (oneHits / 16 * 100).toFixed(1);
    const subParts = [];
    if (hazardActive) {
      const hpct = Math.round(hazardDmg / hp * 100);
      subParts.push(`진입 위험 -${hpct}%`);
    }
    if (survives1HKO) {
      subParts.push(hasFocusSash ? '기합의띠로 1타 회피 가능' : '옹골참으로 1타 회피 가능');
    } else if (hasSitrus) {
      const minKOs = simulateKO(min, hp, defItemData, defAbilityData, startHp);
      subParts.push(`자뭉 시 확정 ${minKOs}타`);
    }
    return { label: "난수", turns: "1타", pct: `${pct}%`, cls: "ohko", sub: subParts.join(' · ') };
  }

  // 자뭉/회복 아이템 반영한 N타 (진입 위험 후 startHp 기준)
  const minKOs = simulateKO(min, hp, defItemData, defAbilityData, startHp);
  const maxKOs = simulateKO(max, hp, defItemData, defAbilityData, startHp);

  const isFixed = (minKOs === maxKOs);
  const label = isFixed ? "확정" : "난수";
  const turns = `${maxKOs}타`;

  const subParts = [];
  if (hazardActive) {
    const pct = Math.round(hazardDmg / hp * 100);
    subParts.push(`진입 위험 -${pct}%`);
  }
  if (defItemData?.hpRecovery?.kind === 'sitrus') subParts.push('자뭉 반영');
  else if (defItemData?.residualRecovery?.kind === 'endTurn') subParts.push('먹남 반영');
  else if (defAbilityData?.residualRecovery) subParts.push(`${defAbilityData.koName || defAbilityData.name} 반영`);

  return { label, turns, pct: "", cls: minKOs <= 2 ? "ohko" : "", sub: subParts.join(' · ') };
}

/* ════════════════════════════════════════════════════════════
   속도 계산
   ════════════════════════════════════════════════════════════ */
function effectiveSpeed(side, field) {
  const stats = calcStats(side);
  let spe = applyBoost(stats.spe, side.ranks.spe || 0);
  const ab = effectiveAbility(side);
  const abilityData = ab ? AbilityById[ab] : null;
  const item = effectiveItem(side);
  const itemData = item ? ItemById[item] : null;
  const pokemon = PokemonById[side.pokemonIdx];
  
  const speMods = [];
  
  for (const rule of abilityData?.speedStatBoosts || []) {
    if (abilityRuleApplies(rule, {
      atkSide: side,
      defSide: side,
      move: { flags: {} },
      field,
      bp: 0,
      moveType: 'spe',
      weather: field.weather,
      effectiveness: 1,
      isCritical: false,
      isPhysical: false,
    })) {
      speMods.push(mechanicMod(rule.mod));
    }
  }
  
  // 아이템
  if (statBoostApplies(pokemon, itemData?.speedStatBoost, 'spe')) {
    speMods.push(mechanicMod(itemData.speedStatBoost.mod));
  }
  
  spe = pokeRound(spe * chainMods(speMods, 410, 131172) / 4096);
  
  // 마비 (Gen 7+: 0.5×)
  if (side.status === 'Paralysis' && !abilityData?.ignoresParalysisSpeedDrop) {
    spe = Math.floor(spe * 0.5);
  }
  
  // Tailwind
  if (side.tailwind) spe *= 2;
  
  return spe;
}

function firstMover(movePri, atkSpe, defSpe) {
  if (movePri > 0) return "atk";
  if (movePri < 0) return "def";
  if (atkSpe > defSpe) return "atk";
  if (atkSpe < defSpe) return "def";
  return "tie";
}
