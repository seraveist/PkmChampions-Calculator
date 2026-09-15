import { AbilityById, ItemById, MOD, MOLD_BREAKER_IGNORED_ABILITIES, OF16, OF32, PokemonById, RULES, STAT_LABEL, TYPE_KO, applyBoost, battleAbilityContext, calcStats, chainMods, effectiveAbility, effectiveBattleItem, effectiveItem, effectiveTypes, effectiveWeather, effectiveWeight, getMoveEffectiveness, getStabMod, isGrounded, isTeraActive, pokeRound, sideHpPct, sideIsFullHp, toId, typeEff } from './01-core.js';

/* ════════════════════════════════════════════════════════════
 * 02-engine.js — 계산 엔진: 가변 BP, calculateDamage, 진입 위험, simulateKO/hkoLabel, 속도
 * ES module; build entrypoints own composition and initialization.
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
  if (side?.paradoxActive) return true;
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
  if (ctx.field?.offensivePowerOnly && rule.defenderGrounded) return false;
  if (rule.gameType && ctx.field?.gameType !== rule.gameType) return false;
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


function sideCurrentHp(maxHp, side) {
  return Math.max(1, Math.floor(maxHp * sideHpPct(side) + 1e-9));
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
  if (rule.sideFlag && !ctx.atkSide?.[rule.sideFlag]) return false;
  if (rule.sideValue && ctx.atkSide?.[rule.sideValue.field] !== rule.sideValue.value) return false;
  if ((rule.pokemon || rule.baseSpecies) && !pokemonMatchesCondition(PokemonById[ctx.atkSide?.pokemonIdx], rule)) return false;
  if (rule.maxHpPct && sideHpPct(ctx.atkSide) > rule.maxHpPct) return false;
  if (!categoryMatches(rule, ctx.isPhysical)) return false;
  if (!statusMatches(rule, ctx.atkSide?.status)) return false;
  if (rule.maxBp && bp > rule.maxBp) return false;
  if (rule.flag && !move.flags?.[rule.flag]) return false;
  if (rule.flag === 'contact' && (ctx.atkAb === 'longreach' || (ctx.atkItem === 'punchingglove' && move.flags?.punch))) return false;
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
  if (rule.effectiveness === 'resisted' && !(effectiveness > 0 && effectiveness < 1)) return false;
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

function canRemovePowerItem(side) {
  const pokemon = PokemonById[side.pokemonIdx];
  const item = ItemById[effectiveItem(side)];
  if (!item) return false;
  return !Object.entries(item.ms || {}).some(([base, target]) =>
    [base, target].some(id => toId(id) === pokemon.id || toId(id) === toId(pokemon.base)));
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
    case 'receivedDamage':
      return specialMoveInputIssue(move, atkSide, defSide) ? null : Math.max(1, Math.floor(Number(atkSide.receivedDamage) * move.receivedDamageMultiplier));
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

function flingItemForMove(attacker, defender = attacker) {
  const { atkAb } = battleAbilityContext(attacker, defender);
  const item = ItemById[effectiveBattleItem(attacker, atkAb)];
  return item?.flingBp && canRemovePowerItem(attacker) ? item : null;
}

function specialMoveInputIssue(move, attacker, defender) {
  if (move.fixedDamageKind === 'receivedDamage') {
    const value = attacker.receivedDamage;
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return '이번 턴 마지막으로 받은 HP 피해량을 입력하세요. 연속기는 마지막 1회의 피해만 입력합니다.';
    if (!['Physical', 'Special'].includes(attacker.receivedDamageCategory)) return '받은 공격의 물리·특수 분류를 선택하세요.';
    if (move.receivedDamageCategory && move.receivedDamageCategory !== attacker.receivedDamageCategory) return `${move.receivedDamageCategory === 'Physical' ? '물리' : '특수'} 공격을 받은 조건에서만 사용할 수 있습니다.`;
  }
  if (move.variableBpKind === 'fling' && !flingItemForMove(attacker, defender)) return '던질 수 있는 도구를 선택하세요. 도구 없음·사용 불가·해당 포켓몬의 메가스톤은 내던질 수 없습니다.';
  if (move.variableBpKind === 'stockpile' && !(Number(attacker.stockpileCount) >= 1 && Number(attacker.stockpileCount) <= 3)) return '비축 횟수를 1~3회로 선택하세요.';
  return '';
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

  if (move.manualBp && !['fickleBeam', 'fling', 'stockpile'].includes(move.variableBpKind)) return baseBp;

  switch (move.variableBpKind) {
    case 'fickleBeam':
      return atkSide.fickleBeamMode === 'boosted' ? 160 : 80;
    case 'fling':
      return flingItemForMove(atkSide, defSide)?.flingBp || 0;
    case 'stockpile':
      return Math.max(0, Math.min(3, Math.floor(Number(atkSide.stockpileCount) || 0))) * 100;
    case 'gyroBall': {
      // 25 × defSpe / atkSpe, 최소 1, 최대 150
      const aS = effectiveSpeed(atkSide, field, defSide);
      const dS = effectiveSpeed(defSide, field, atkSide);
      if (aS <= 0) return 1;
      return Math.min(150, Math.max(1, Math.floor(25 * dS / aS) + 1));
    }
    case 'electroBall': {
      const aS = effectiveSpeed(atkSide, field, defSide);
      const dS = effectiveSpeed(defSide, field, atkSide);
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
      const hp = sideCurrentHp(atkStats.hp, atkSide) / atkStats.hp;
      return Math.max(1, Math.floor(150 * hp));
    }
    case 'lowHpFlail': {
      // 48분의 X 단위 비례
      const hp = sideCurrentHp(atkStats.hp, atkSide) / atkStats.hp;
      const p = Math.floor(hp * 48);
      if (p < 2) return 200;
      if (p < 5) return 150;
      if (p < 10) return 100;
      if (p < 17) return 80;
      if (p < 33) return 40;
      return 20;
    }
    case 'targetHp100': {
      const hp = sideCurrentHp(defStats.hp, defSide);
      return Math.floor(Math.floor((10000 * Math.floor(hp * 4096 / defStats.hp) + 2047) / 4096) / 100) || 1;
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
      return canRemovePowerItem(defSide) ? Math.floor(baseBp * 1.5) : baseBp;
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
      return field.singleHitCalculation ? 20 * ((field.powerHitIndex || 0) + 1) : 40;
    case 'beatUpApprox':
      // 동료 base atk 기반. 단순화: 기본값 유지 (실전에서 더블배틀에서만 의미)
      return 5 + Math.floor((field.beatUpBaseAttack ?? atkP.bs.atk) / 10);
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
    immunityNotes: field.damagePurpose === 'power' ? [] : null,
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
  if (!ctx.immunityNotes && damageBlockApplies(defAbilityData?.damageBlock, defP, defSide, move, move.cat === 'Physical')) {
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
  if (ctx.immunityNotes && defAbilityData?.damageBlock && pokemonMatchesCondition(defP, defAbilityData.damageBlock)
      && categoryMatches(defAbilityData.damageBlock, isPhysical)) {
    ctx.immunityNotes.push(`${displayName(defAbilityData)}: 첫 공격 차단`);
  }
  const effectiveness = getMoveEffectiveness(move, moveType, atkSide, defSide, field, { ...abilityCtx, atkAb, defAb }, itemCtx, ctx.immunityNotes);
  if (effectiveness === 0 && !field.offensivePowerOnly) {
    return finishDamageStage({
      damages: new Array(16).fill(0),
      minPct: 0, maxPct: 0,
      effectiveness: 0,
      moveType, category,
      bp, atk: 0, def: 0,
      defHP: defStats.hp,
      ...(ctx.immunityNotes ? { typeImmune: true } : {}),
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
  if (specialMoveInputIssue(move, atkSide, defSide)) return finishDamageStage(null);

  // ═══════════════════════════════════════
  // STAGE 1: BP modifiers
  // ═══════════════════════════════════════
  if (!ctx.immunityNotes && damageBlockApplies(defAbilityData?.damageBlock, defP, defSide, move, isPhysical)) {
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

  if (ctx.immunityNotes && typeof move.ohko === 'string' && effectiveTypes(defSide).includes(move.ohko)) {
    ctx.immunityNotes.push(`${displayType(move.ohko)} 타입: 일격기 무효`);
  }
  const fixedDamage = fixedDamageAmount(move, atkSide, defSide, atkStats, defStats, ctx.immunityNotes ? null : defAbilityData);
  if (fixedDamage !== null) {
    const result = fixedDamageResult(fixedDamage, move, moveType, category, defStats, ['고정 대미지']);
    if (ctx.immunityNotes && fixedDamage === 0 && typeof move.ohko === 'string') result.typeImmune = true;
    return finishDamageStage(result);
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
  if ((atkItem === 'normalgem' || field.normalGemBoost) && moveType === 'Normal' && move.id !== 'struggle') {
    bpMods.push(MOD.x1_3);
    mods.push('노말주얼×1.3 (첫 사용)');
  }
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
  if (move.ignoreOffensive || defAbilityData?.ignoreOffensiveBoosts) atkBoost = 0;
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
    if (statBoostApplies(atkP, statBoost, isPhysical ? 'atk' : 'spa')) {
      const mod = mechanicMod(statBoost.mod);
      atkMods.push(mod);
      mods.push(formatModLabel(ctx.atkItemData.koName, mod));
    }
  }

  // 화상: Facade / Guts 예외
  const isBurned = isBurnStatus(atkSide.status) && isPhysical && !atkAbilityData?.burnBypass && !move.burnBypass;
  ctx.applyBurn = isBurned;
  if (isBurned) mods.push('화상 물리½');

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
  if (move.ignoreDefensive || ctx.atkAbilityData?.ignoreDefensiveBoosts) defBoost = 0;
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
  const isSpread = isSpreadDamage(move, field, ctx.atkSide);
  if (isSpread) {
    baseDmg = pokeRound(baseDmg * 3072 / 4096);
    mods.push('광역×0.75');
  }
  if (field.parentalBondChild) baseDmg = pokeRound(baseDmg * 1024 / 4096);

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

    if (weatherRule?.nullDamage && ctx.immunityNotes) {
      ctx.immunityNotes.push(weatherRule.label);
    } else if (weatherRule?.nullDamage) {
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
    if (weatherRule && !weatherRule.nullDamage) {
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
  const stabMod = getStabMod(atkSide, moveType, atkAb);
  // STAB ×1.5는 카드 헤더의 '자속' 마크로 표시하므로 mods 추적 생략
  if (stabMod === 8192) mods.push('테라 매칭 STAB×2');
  else if (stabMod === 9216) mods.push('다능 STAB×2.25');

  const finalMods = [];
  if (defSide.glaiveRushExposed) {
    finalMods.push(8192);
    mods.push('대검돌격 이후 받는 피해×2');
  }
  applyFieldRuleMods(fieldMechanics().finalMods, ctx, finalMods);

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
    if (ctx.applyBurn) d = Math.floor(d / 2);

    // 스크린 (중복 방지: 이미 finalMod에 포함)
    // Final mod
    d = OF16(pokeRound(Math.max(1, OF32(d * finalMod) / 4096)));
    damages.push(d);
  }

  // Multi-hit 처리. 표시용 16롤은 기존 계약을 유지하고, 실제 타격 단계는
  // hitProfile에 보존해 기합의띠/옹골참/자뭉열매를 타격 사이에 판정한다.
  let multihitDamages = null;
  let parentalBondActive = false;
  let hitProfile = null;

  // 부자유친 (Parental Bond): 다단기/광역기/특정 기술 제외하고 1타 100% + 2타 25% = 평균 1.25×
  // 단, 단일 타깃 공격기에만 적용
  const extraHit = ctx.atkAbilityData?.extraHitModifier;
  if (!field.singleHitCalculation && extraHit?.singleHitOnly && !move.mh && category !== 'Status' &&
      !(field.gameType === 'Doubles' && ['allAdjacent','allAdjacentFoes'].includes(move.tgt))) {
    parentalBondActive = true;
    mods.push(`${ctx.atkAbilityData.koName || ctx.atkAbilityData.name} 추가타`);
    const extraHitMod = Math.max(0, mechanicMod(extraHit.mod) - 4096);
    const extraHitDamages = damages.map(d => Math.floor(d * extraHitMod / 4096));
    multihitDamages = damages.map((d, index) => d + extraHitDamages[index]);
    hitProfile = {
      kind: 'parentalBond',
      variants: [{ weight: 1, hitDamages: [damages, extraHitDamages] }],
    };
  }

  if (!field.singleHitCalculation && move.mh && !parentalBondActive) {
    const hitVariants = resolveMultiHitVariants(move.mh, atkItemData, ctx.atkAbilityData);
    const sampledHits = sampleMultiHitCounts(hitVariants, damages.length);
    multihitDamages = damages.map((d, index) => d * sampledHits[index]);
    hitProfile = {
      kind: 'multiHit',
      variants: hitVariants.map(({ hits, weight }) => ({
        weight,
        hitDamages: Array.from({ length: hits }, () => damages),
      })),
    };
  }

  const finalDamages = multihitDamages || damages;
  const minPct = (finalDamages[0] / defStats.hp * 100);
  const maxPct = (finalDamages[15] / defStats.hp * 100);

  return {
    damages: finalDamages,
    rawDamages: damages,
    multihitCount: move.mh,
    hitProfile,
    minPct, maxPct,
    effectiveness,
    moveType, category,
    bp, atk: atkStat, def: defStat,
    defHP: defStats.hp,
    stab: stabMod !== 4096,
    mods
  };
}

function resolveMultiHitVariants(multihit, itemData, abilityData) {
  if (!Array.isArray(multihit)) {
    return [{ hits: Math.max(1, Number(multihit) || 1), weight: 1 }];
  }

  const minHits = Math.max(1, Number(multihit[0]) || 1);
  const maxHits = Math.max(minHits, Number(multihit[1]) || minHits);
  if (abilityData?.multiHitModifier === 'max') return [{ hits: maxHits, weight: 1 }];
  if (itemData?.multiHitModifier === 'loadedDice') {
    return maxHits === 5
      ? [{ hits: 4, weight: 1 }, { hits: 5, weight: 1 }]
      : [{ hits: maxHits, weight: 1 }];
  }

  const configured = minHits === 2 && maxHits === 5 && Array.isArray(RULES.multihitDistribution25)
    ? RULES.multihitDistribution25
    : Array.from({ length: maxHits - minHits + 1 }, (_, index) => minHits + index);
  const weights = new Map();
  configured.forEach(value => {
    const hits = Math.max(minHits, Math.min(maxHits, Number(value) || minHits));
    weights.set(hits, (weights.get(hits) || 0) + 1);
  });
  return [...weights.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hits, weight]) => ({ hits, weight }));
}

function sampleMultiHitCounts(variants, sampleCount = 16) {
  const weighted = variants.flatMap(({ hits, weight }) => (
    Array.from({ length: Math.max(1, Math.round(weight || 1)) }, () => hits)
  ));
  if (!weighted.length) return Array.from({ length: sampleCount }, () => 1);
  return Array.from({ length: sampleCount }, (_, index) => {
    if (sampleCount <= 1) return weighted[0];
    const weightedIndex = Math.floor(index * (weighted.length - 1) / (sampleCount - 1));
    return weighted[weightedIndex];
  });
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
    if (outcome?.done) return attachKoContext(outcome.result, ctx);
  }

  return attachKoContext(calculateFinalDamageStage(ctx), ctx);
}

function isSpreadDamage(move, field, attacker) {
  if (field.gameType !== 'Doubles' || field.spreadTargets === 'single') return false;
  if (['allAdjacent', 'allAdjacentFoes'].includes(move.tgt)) return true;
  return move.id === 'expandingforce' && field.terrain === 'Psychic' && isGrounded(attacker, field);
}

function powerMoveField(atkSide, defSide, move, field) {
  const out = { ...field };
  const order = atkSide.moveOrder || 'auto';
  if (order !== 'auto') {
    out.atkMovesFirst = order === 'first';
    out.atkMovesSecond = order === 'second';
  } else {
    const a = effectiveSpeed(atkSide, field, defSide);
    const d = effectiveSpeed(defSide, field, atkSide);
    out.atkMovesFirst = field.trickRoom ? a < d : a > d;
    out.atkMovesSecond = field.trickRoom ? a > d : a < d;
    out.orderUncertain = a === d;
  }
  return out;
}

// HP바·N타: 타입 무효는 적용하고, 특성·도구의 무효·생존 효과는 별도로 안내한다.
// 실제 관측을 해석하는 역계산은 calculateDamage()를 그대로 사용한다.
function calculatePowerDamage(atkSide, defSide, move, field) {
  const powerField = { ...field, damagePurpose: 'power', singleHitCalculation: true, powerHitIndex: 0 };
  const result = calculateDamage(atkSide, defSide, move, powerField);
  if (!result) return result;
  const model = makePowerAttackModel(atkSide, defSide, move, powerField, result);
  const outcomes = resolvePowerMoveUse(model, sideCurrentHp(result.defHP, defSide), false, true);
  const damageWeights = new Map();
  for (const outcome of outcomes) damageWeights.set(outcome.damage, (damageWeights.get(outcome.damage) || 0) + outcome.chance);
  const distribution = [...damageWeights].sort(([a], [b]) => a - b).map(([damage, chance]) => ({ damage, chance }));
  // Only legacy display endpoints use 16 samples; probabilities use the exact weighted distribution.
  result.damages = Array.from({ length: 16 }, (_, i) => {
    let cumulative = 0;
    const quantile = i === 0 ? 0 : i === 15 ? 1 : (i + 0.5) / 16;
    return (distribution.find(row => { cumulative += row.chance; return cumulative + 1e-12 >= quantile; }) || distribution.at(-1))?.damage || 0;
  });
  result.damageDistribution = distribution;
  result.appliedBasePowers = (model.appliedBasePowers || []).map(values => [...values].sort((a, b) => a - b));
  result.bp = model.hit(sideCurrentHp(result.defHP, defSide), false, 0, 0).bp;
  result.minPct = result.damages[0] / result.defHP * 100;
  result.maxPct = result.damages[15] / result.defHP * 100;
  // HP/berry-dependent later hits cannot be represented by repeating a static roll array.
  result.hitProfile = { kind: model.kind, dynamic: true, variants: model.variants.map(v => ({ ...v })) };
  Object.defineProperty(result.hitProfile, 'powerModel', { value: model });
  result.hitCounts = model.variants.map(v => v.hits);
  if (model.kind === 'parentalBond') result.mods.push('부자유친 추가타');
  if (model.kind === 'beatUp') result.mods.push(`집단구타 ${model.variants[0].hits}마리`);
  if (model.variants.some(v => v.hits > 1)) result.mods.push('타격별 피해·열매 소비 반영');
  result.mods.push(...model.hitChanges);
  Object.defineProperties(result.koContext, {
    powerModel: { value: model },
    damageAtHp: { value: (hp, used, hitIndex = 0, variantIndex = 0) => model.hit(hp, used, hitIndex, variantIndex).damages },
    consumeResistBerry: { value: model.recovery.consumeResistBerry },
  });
  return result;
}

function koRecoveryOptions(koContext, effectiveness = 1, moveType = '') {
  const item = ItemById[koContext?.defItem];
  const ability = AbilityById[koContext?.defAbility];
  const blocked = item?.isBerry && attackerBlocksBerries(koContext?.atkAbility);
  const hpRecovery = blocked ? null : item?.hpRecovery;
  return {
    hpRecovery: hpRecovery && { ...hpRecovery, multiplier: ability?.resistBerryMod === 'x0_25' ? 2 : 1 },
    residualRecovery: item?.residualRecovery,
    consumeResistBerry: !blocked && item?.resistBerryType === moveType && (item.resistBerryRequiresWeakness === false || effectiveness > 1),
    cheekPouch: !blocked && koContext?.defAbility === 'cheekpouch',
  };
}

function recoverPowerHit(currentHp, maxHp, used, options, damage) {
  if (currentHp <= 0 || used) return { hp: currentHp, used: used || !!(options.consumeResistBerry && damage > 0) };
  const recovery = options.hpRecovery;
  const eatsRecoveryBerry = recovery?.trigger === 'halfHp' && currentHp <= Math.floor(maxHp / 2);
  const eatsResistBerry = options.consumeResistBerry && damage > 0;
  if (!eatsRecoveryBerry && !eatsResistBerry) return { hp: currentHp, used };
  let amount = 0;
  if (eatsRecoveryBerry) amount = Math.floor((recovery.amount ?? Math.floor(maxHp * fractionValue(recovery.fraction, 1 / 4))) * (recovery.multiplier || 1));
  if (options.cheekPouch) amount += Math.floor(maxHp / 3);
  return { hp: Math.min(maxHp, currentHp + amount), used: true,
    recoveryMask: amount > 0 ? (eatsRecoveryBerry ? 1 : 0) | (options.cheekPouch ? 2 : 0) : 0 };
}

function recoverFlungBerry(model, currentHp, used, options, damage) {
  // The held resist berry is consumed during damage. The thrown berry's onHit
  // effect runs before the held HP berry's subsequent Update threshold check.
  const resisted = options.consumeResistBerry
    ? recoverPowerHit(currentHp, model.maxHp, used, { ...options, hpRecovery: null }, damage)
    : { hp: currentHp, used };
  const berry = model.flungItem;
  if (!berry?.isBerry || resisted.hp <= 0 || damage <= 0) return resisted;
  const recovery = berry.hpRecovery;
  const multiplier = AbilityById[model.defAbility]?.resistBerryMod === 'x0_25' ? 2 : 1;
  let amount = recovery ? Math.floor((recovery.amount ?? Math.floor(model.maxHp * fractionValue(recovery.fraction, 1 / 4))) * multiplier) : 0;
  const pouch = model.defAbility === 'cheekpouch';
  if (pouch) amount += Math.floor(model.maxHp / 3);
  return { ...resisted, hp: Math.min(model.maxHp, resisted.hp + amount),
    recoveryMask: (resisted.recoveryMask || 0) | (recovery && amount ? 8 : 0) | (pouch ? 2 : 0) };
}

function beatUpParticipants(attacker, field) {
  const ids = [attacker.pokemonIdx, ...new Set((attacker.beatUpParty || []).filter(id => id !== attacker.pokemonIdx).slice(0, battleMaxFallenAllies(field)))];
  return ids.map(id => PokemonById[id]).filter(Boolean).map(pokemon =>
    (pokemon.mega && PokemonById[toId(pokemon.base)]) || pokemon);
}

function powerAttackProfile(attacker, move, field, context) {
  const ability = AbilityById[context.atkAbility];
  const item = ItemById[context.atkItem || effectiveBattleItem(attacker, context.atkAbility)];
  const isBeatUp = move.variableBpKind === 'beatUpApprox';
  const participants = isBeatUp ? beatUpParticipants(attacker, field) : [];
  const parent = !move.mh && !isBeatUp && !move.ohko && !move.flags?.charge && !move.flags?.noparentalbond && !move.selfdestruct
    && !['finalgambit', 'explosion', 'selfdestruct', 'mistyexplosion', 'struggle'].includes(move.id)
    && ability?.extraHitModifier?.singleHitOnly && !isSpreadDamage(move, field, attacker);
  let variants = isBeatUp ? [{ hits: Math.max(1, participants.length), weight: 1 }]
    : parent ? [{ hits: 2, weight: 1 }]
    : move.mh ? resolveMultiHitVariants(move.mh, item, ability) : [{ hits: 1, weight: 1 }];
  if (move.hitCount && move.mh) {
    const max = Array.isArray(move.mh) ? move.mh[1] : move.mh;
    variants = [{ hits: Math.max(1, Math.min(max, Math.floor(move.hitCount))), weight: 1 }];
  }
  if (move.variableBpKind === 'fickleBeam' && !['normal', 'boosted'].includes(attacker.fickleBeamMode)) {
    variants = variants.flatMap(v => [{ ...v, weight: v.weight * 7, fickleBeamMode: 'normal' }, { ...v, weight: v.weight * 3, fickleBeamMode: 'boosted' }]);
  }
  return { ability, item, isBeatUp, participants, parent, variants };
}

function makePowerAttackModel(attacker, defender, move, field, firstResult) {
  const context = firstResult.koContext;
  const { ability, item, isBeatUp, participants, parent, variants } = powerAttackProfile(attacker, move, field, context);
  const maxHp = firstResult.defHP;
  const hitCache = new Map();
  const hitChanges = [];
  const hasMultipleHits = variants.some(v => v.hits > 1);
  const consumesAttackItem = item?.id === 'normalgem' && firstResult.moveType === 'Normal'
    && firstResult.bp > 0 && move.id !== 'struggle' && !move.fixedDamageKind && !move.damage && !move.ohko;
  if (consumesAttackItem) hitChanges.push('노말주얼 첫 기술에만 적용 · 이후 소비 상태');
  if (hasMultipleHits && ['stamina', 'weakarmor', 'watercompaction'].includes(context.defAbility)) hitChanges.push(`${displayName(AbilityById[context.defAbility])} 타격별 반영`);
  if (hasMultipleHits && move.id === 'poweruppunch') hitChanges.push('그로우펀치 타격별 공격 상승');
  const needsExactHp = move.variableBpKind === 'targetHp100' || ['targetHalfHp', 'targetMinusSourceHp'].includes(move.fixedDamageKind);
  const model = {
    kind: isBeatUp ? 'beatUp' : parent ? 'parentalBond' : move.mh ? 'multiHit' : 'singleHit',
    variants, maxHp, hitChanges, consumesAttackItem,
    flungItem: move.variableBpKind === 'fling' ? flingItemForMove(attacker, defender) : null,
    defAbility: context.defAbility,
    recovery: koRecoveryOptions(context, firstResult.effectiveness, firstResult.moveType),
    outcomeCache: new Map(),
    removeItemOnHit: move.id === 'knockoff' && canRemovePowerItem(defender) && !AbilityById[context.defAbility]?.blocksItemRemoval,
    hit(hp, used, index, variantIndex, useIndex = 0) {
      const hpKey = needsExactHp ? Math.max(0, hp) : hp >= maxHp ? 'full' : hp <= Math.floor(maxHp / 3) ? 'pinch' : 'partial';
      const key = `${hpKey}|${used}|${index}|${variantIndex}|${consumesAttackItem && useIndex > 0}`;
      if (hitCache.has(key)) return hitCache.get(key);
      const atk = { ...attacker, ranks: { ...attacker.ranks } };
      if (variants[variantIndex]?.fickleBeamMode) atk.fickleBeamMode = variants[variantIndex].fickleBeamMode;
      const def = { ...defender, ranks: { ...defender.ranks }, hpPct: Math.max(0, hp) / maxHp, fullHP: hp === maxHp, pinch: hp <= Math.floor(maxHp / 3), item: used ? '' : defender.item };
      const hitField = { ...field, singleHitCalculation: true, powerHitIndex: index, parentalBondChild: !!parent && index > 0 };
      if (consumesAttackItem) {
        atk.item = '';
        hitField.normalGemBoost = useIndex === 0;
        if (context.atkAbility === 'unburden') atk.unburdenActive = true;
      }
      if (isBeatUp) hitField.beatUpBaseAttack = participants[index]?.bs.atk ?? PokemonById[attacker.pokemonIdx].bs.atk;
      if (index > 0) {
        // Only changes between hits of this move are derived; input ranks start fresh on its next use.
        const defensive = context.defAbility;
        const physical = firstResult.category === 'Physical';
        if (defensive === 'stamina') def.ranks.def = Math.min(6, (def.ranks.def || 0) + index);
        if (defensive === 'weakarmor' && physical) {
          def.ranks.def = Math.max(-6, (def.ranks.def || 0) - index);
          def.ranks.spe = Math.min(6, (def.ranks.spe || 0) + 2 * index);
        }
        if (defensive === 'watercompaction' && firstResult.moveType === 'Water') def.ranks.def = Math.min(6, (def.ranks.def || 0) + 2 * index);
        if (move.id === 'poweruppunch') atk.ranks.atk = Math.max(-6, Math.min(6, (atk.ranks.atk || 0) + index * (context.atkAbility === 'contrary' ? -1 : context.atkAbility === 'simple' ? 2 : 1)));
        if (move.flags?.contact && !['longreach'].includes(context.atkAbility) && !(item?.id === 'punchingglove' && move.flags?.punch)) {
          if (['mummy', 'lingeringaroma'].includes(defensive) && !ability?.gasExempt) atk.ability = defensive;
          if (defensive === 'wanderingspirit' && !ability?.gasExempt && index % 2) { atk.ability = defensive; def.ability = context.atkAbility; }
        }
        if (defensive === 'seedsower') hitField.terrain = 'Grassy';
        if (defensive === 'sandspit') hitField.weather = 'Sand';
      }
      const hitMove = index ? { ...move, type: firstResult.moveType, manualType: true } : move;
      // Preserve an -ate modifier when locking the move's type across subsequent hits.
      if (index && ability?.typeChange && atk.ability === attacker.ability && !move.manualType) {
        hitMove.type = move.type;
        hitMove.manualType = false;
      }
      const result = calculateDamage(atk, def, hitMove, hitField) || { damages: [0] };
      hitCache.set(key, result);
      return result;
    },
  };
  return model;
}

// Shared transition for the exact first-use damage distribution and repeated-use KO probabilities.
function resolvePowerMoveUse(model, startHp, berryUsed, collectDamage = false, useIndex = 0) {
  const cacheKey = `${startHp}|${berryUsed}|${collectDamage}|${!!model.consumesAttackItem && useIndex > 0}`;
  if (model.outcomeCache.has(cacheKey)) return model.outcomeCache.get(cacheKey);
  const outcomes = new Map();
  const totalWeight = model.variants.reduce((sum, v) => sum + v.weight, 0);
  const add = (map, row) => {
    const key = `${row.hp}|${row.used}|${collectDamage ? row.damage : 0}`;
    const previous = map.get(key);
    if (previous) { previous.chance += row.chance; previous.recoveryMask |= row.recoveryMask || 0; }
    else map.set(key, row);
  };
  model.variants.forEach((variant, variantIndex) => {
    let states = new Map();
    add(states, { hp: startHp, used: berryUsed, damage: 0, chance: variant.weight / totalWeight });
    for (let index = 0; index < variant.hits; index++) {
      const next = new Map();
      for (const current of states.values()) {
        if (current.hp <= 0 && !collectDamage) { add(next, current); continue; }
        const result = model.hit(current.hp, current.used, index, variantIndex, useIndex);
        if (collectDamage && Number.isFinite(result.bp) && result.bp > 0) {
          model.appliedBasePowers ||= [];
          (model.appliedBasePowers[index] ||= new Set()).add(result.bp);
        }
        const weights = koRollWeights(result.damages);
        const total = [...weights.values()].reduce((a, b) => a + b, 0);
        for (const [damage, weight] of weights) {
          const hitRecovery = result.koContext ? koRecoveryOptions(result.koContext, result.effectiveness, result.moveType) : model.recovery;
          // A resist berry is consumed during damage; Knock Off then removes a held
          // item before HP-triggered berries can activate in the subsequent update.
          const removed = !!(model.removeItemOnHit && damage > 0 && !hitRecovery.consumeResistBerry);
          const beforeRecovery = model.flungItem
            ? recoverFlungBerry(model, current.hp - damage, current.used, hitRecovery, damage)
            : { hp: current.hp - damage, used: current.used };
          const recovered = recoverPowerHit(beforeRecovery.hp, model.maxHp, beforeRecovery.used || removed, hitRecovery, damage);
          add(next, { ...recovered, recoveryMask: (current.recoveryMask || 0) | (beforeRecovery.recoveryMask || 0) | (recovered.recoveryMask || 0),
            damage: collectDamage ? current.damage + damage : 0, chance: current.chance * weight / total });
        }
      }
      states = next;
    }
    for (const row of states.values()) add(outcomes, row);
  });
  const result = [...outcomes.values()];
  model.outcomeCache.set(cacheKey, result);
  return result;
}

function simulatePowerKo(model, startHp, maxTurns = 10) {
  const cacheKey = `${startHp}|${maxTurns}`;
  if (model.koCache?.has(cacheKey)) return model.koCache.get(cacheKey);
  let states = new Map([[`${startHp}|false`, { hp: startHp, used: false, chance: 1 }]]);
  const cumulative = [];
  const seen = new Map();
  let total = 0, guaranteedTurn = null, stalled = false, recoveryMask = 0;
  const residual = model.recovery.residualRecovery;
  const heal = residual?.kind === 'endTurn' ? Math.floor(model.maxHp * fractionValue(residual.fraction, 1 / 16)) : 0;
  for (let turn = 1; turn <= maxTurns && states.size; turn++) {
    const next = new Map();
    for (const current of states.values()) {
      for (const outcome of resolvePowerMoveUse(model, current.hp, current.used, false, turn - 1)) {
        const chance = current.chance * outcome.chance;
        recoveryMask |= outcome.recoveryMask || 0;
        if (outcome.hp <= 0) { total += chance; continue; }
        const hp = Math.min(model.maxHp, outcome.hp + (outcome.used && model.removeItemOnHit ? 0 : heal));
        if (hp > outcome.hp) recoveryMask |= 4;
        const key = `${hp}|${outcome.used}`;
        if (next.has(key)) next.get(key).chance += chance;
        else next.set(key, { hp, used: outcome.used, chance });
      }
    }
    total = Math.max(0, Math.min(1, total));
    cumulative.push(total);
    if (!next.size) { guaranteedTurn = turn; break; }
    const signature = `${!!model.consumesAttackItem && turn > 1}|${[...next.keys()].sort().join(';')}`;
    if (seen.get(signature) === total) { stalled = true; break; }
    seen.set(signature, total);
    states = next;
  }
  const first = cumulative.findIndex(p => p > 0);
  const result = { cumulative, recoveryMask, oneMoveKoChance: cumulative[0] || 0, possibleTurn: first < 0 ? null : first + 1, guaranteedTurn, impossible: stalled && first < 0, cannotGuarantee: stalled };
  if (!model.koCache) model.koCache = new Map();
  model.koCache.set(cacheKey, result);
  return result;
}

function attachKoContext(result, ctx) {
  if (!result) return result;
  return {
    ...result,
    ...(ctx.immunityNotes ? {
      immunityNotes: [...new Set(ctx.immunityNotes)],
      survivalNotes: [
        ctx.defItemData?.koSurvival || ctx.defItem === 'focusband' ? `${displayName(ctx.defItemData)}: 생존 효과` : '',
        ctx.defAbilityData?.koSurvival ? `${displayName(ctx.defAbilityData)}: 생존 효과` : '',
      ].filter(Boolean),
    } : {}),
    koContext: {
      ...(result.typeImmune ? { typeImmune: true } : {}),
      defAbility: ctx.defAb || '',
      defItem: ctx.defItem || '',
      atkAbility: ctx.atkAb || '',
    },
  };
}

/* ════════════════════════════════════════════════════════════
   진입 위험 (스텔스록 / 압정뿌리기) 데미지 계산
   ════════════════════════════════════════════════════════════ */
function calcHazardDamage(defSide, field, koContext = null) {
  let total = 0;
  const hp = calcStats(defSide).hp;
  // 스텔스록: 바위 약점 비율 ×기본 1/8
  if (field.defStealthRock) {
    const types = effectiveTypes(defSide);
    const eff = typeEff('Rock', types); // 0/0.25/0.5/1/2/4 중 하나
    if (eff > 0) total += Math.floor(hp * eff / 8);
  }
  // 압정뿌리기: 지면에 닿은 포켓몬에게만
  const defAbility = koContext && Object.prototype.hasOwnProperty.call(koContext, 'defAbility')
    ? koContext.defAbility
    : null;
  const defItem = koContext && Object.prototype.hasOwnProperty.call(koContext, 'defItem')
    ? koContext.defItem
    : null;
  if (field.defSpikesLayers > 0 && isGrounded(defSide, field, defAbility, defItem)) {
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

function koRollWeights(damages) {
  const weights = new Map();
  (damages || []).forEach(damage => {
    const value = Math.max(0, Number(damage) || 0);
    weights.set(value, (weights.get(value) || 0) + 1);
  });
  return weights.size ? weights : new Map([[0, 1]]);
}

function simulateMoveKoDistribution(hitProfile, hp, startHp, options = {}, maxTurns = 10) {
  if (hitProfile?.powerModel) return simulatePowerKo(hitProfile.powerModel, startHp, maxTurns);
  const variants = hitProfile?.variants || [];
  const totalVariantWeight = variants.reduce((sum, variant) => sum + (variant.weight || 0), 0);
  if (!variants.length || totalVariantWeight <= 0) return null;

  const halfHP = Math.floor(hp / 2);
  const berryHeal = Math.floor((options.hpRecovery?.amount ?? Math.floor(hp * fractionValue(options.hpRecovery?.fraction, 1 / 4))) * (options.hpRecovery?.multiplier || 1));
  const startsWithBerry = !!options.hpRecovery || !!options.consumeResistBerry;
  const itemResidualHeal = options.residualRecovery?.kind === 'endTurn'
    ? Math.floor(hp * fractionValue(options.residualRecovery.fraction, 1 / 16))
    : 0;
  const abilityResidualHeal = options.abilityResidualRecovery
    ? Math.floor(hp * fractionValue(options.abilityResidualRecovery.fraction, 1 / 8))
    : 0;
  let states = new Map([[`${startHp}|${options.fullHpSurvival ? 1 : 0}|${startsWithBerry ? 0 : 1}`, 1]]);
  const cumulative = [];
  let totalKoChance = 0;
  let guaranteedTurn = null;

  for (let turn = 1; turn <= maxTurns && states.size; turn++) {
    const actionStates = new Map();
    let actionKoChance = 0;

    for (const [variantIndex, variant] of variants.entries()) {
      const variantWeight = (variant.weight || 0) / totalVariantWeight;
      if (variantWeight <= 0) continue;
      let variantStates = new Map([...states].map(([key, chance]) => [key, chance * variantWeight]));

      for (const [hitIndex, hitDamages] of (variant.hitDamages || []).entries()) {
        const nextStates = new Map();

        for (const [stateKey, stateChance] of variantStates) {
          const [currentHpRaw, survivalRaw, berryUsedRaw] = stateKey.split('|').map(Number);
          const rolls = options.damageAtHp?.(currentHpRaw, berryUsedRaw === 1, hitIndex, variantIndex) || hitDamages;
          const rollWeights = koRollWeights(rolls);
          const rollTotal = [...rollWeights.values()].reduce((sum, weight) => sum + weight, 0) || 1;
          for (const [damage, rollWeight] of rollWeights) {
            let currentHp = currentHpRaw - damage;
            let survivalAvailable = survivalRaw === 1;
            let berryUsed = berryUsedRaw === 1;
            const chance = stateChance * rollWeight / rollTotal;

            if (currentHp <= 0 && survivalAvailable && currentHpRaw === hp) {
              currentHp = 1;
              survivalAvailable = false;
            } else if (currentHp <= 0) {
              actionKoChance += chance;
              continue;
            }

            const recovered = recoverPowerHit(currentHp, hp, berryUsed, options, damage);
            currentHp = recovered.hp;
            berryUsed = recovered.used;

            const nextKey = `${currentHp}|${survivalAvailable ? 1 : 0}|${berryUsed ? 1 : 0}`;
            nextStates.set(nextKey, (nextStates.get(nextKey) || 0) + chance);
          }
        }

        variantStates = nextStates;
        if (!variantStates.size) break;
      }

      for (const [stateKey, chance] of variantStates) {
        const [currentHpRaw, survivalRaw, berryUsedRaw] = stateKey.split('|').map(Number);
        const currentHp = Math.min(hp, currentHpRaw + itemResidualHeal + abilityResidualHeal);
        const nextKey = `${currentHp}|${survivalRaw}|${berryUsedRaw}`;
        actionStates.set(nextKey, (actionStates.get(nextKey) || 0) + chance);
      }
    }

    totalKoChance = Math.max(0, Math.min(1, totalKoChance + actionKoChance));
    cumulative.push(totalKoChance);
    states = actionStates;
    if (!states.size) {
      guaranteedTurn = turn;
      break;
    }
  }

  const possibleIndex = cumulative.findIndex(chance => chance > 0);
  return {
    cumulative,
    oneMoveKoChance: cumulative[0] || 0,
    possibleTurn: possibleIndex >= 0 ? possibleIndex + 1 : null,
    guaranteedTurn,
  };
}

function simulateOneMoveKoChance(hitProfile, hp, startHp, options = {}) {
  return simulateMoveKoDistribution(hitProfile, hp, startHp, options, 1)?.oneMoveKoChance ?? null;
}

function withKoMetric(result, metric = {}) {
  Object.defineProperty(result, 'metric', {
    configurable: true,
    enumerable: false,
    value: {
      possibleTurn: metric.possibleTurn ?? null,
      guaranteedTurn: metric.guaranteedTurn ?? null,
      oneMoveKoChance: metric.oneMoveKoChance || 0,
      cumulative: metric.cumulative || [],
      impossible: !!metric.impossible,
    },
  });
  return result;
}

function hkoLabel(damages, hp, defSide, field, koContext = null, hitProfile = null) {
  if (koContext?.typeImmune) return withKoMetric({ label: '무효', turns: '', pct: '', cls: 'no', sub: '' });
  if (!damages?.some(d => d > 0)) return withKoMetric({ label: '대미지', turns: '없음', pct: '', cls: 'no' });
  const defItem = koContext?.defItem ?? effectiveBattleItem(defSide);
  const defAbility = koContext?.defAbility ?? effectiveAbility(defSide);
  const item = ItemById[defItem];
  const blockedBerry = !!item?.isBerry && attackerBlocksBerries(koContext?.atkAbility);
  let hpRecovery = blockedBerry ? null : item?.hpRecovery;
  if (hpRecovery && AbilityById[defAbility]?.resistBerryMod === 'x0_25') {
    hpRecovery = { ...hpRecovery, multiplier: 2 };
  }
  const startHp = sideCurrentHp(hp, defSide);
  const profile = hitProfile || { variants: [{ weight: 1, hitDamages: [damages] }] };
  // 각 기술 사용의 난수를 독립적으로 합산한다. 생존 효과와 진입/잔여 피해는 제외한다.
  const distribution = koContext?.powerModel ? simulatePowerKo(koContext.powerModel, startHp) : simulateMoveKoDistribution(profile, hp, startHp, {
    hpRecovery,
    residualRecovery: item?.residualRecovery,
    damageAtHp: koContext?.damageAtHp,
    consumeResistBerry: koContext?.consumeResistBerry,
    cheekPouch: !blockedBerry && defAbility === 'cheekpouch',
  });
  if (!distribution) return withKoMetric({ label: '계산', turns: '불가', pct: '', cls: 'no' });
  const possible = distribution.possibleTurn;
  const guaranteed = distribution.guaranteedTurn;
  const certain = possible !== null && guaranteed === possible;
  const chance = possible ? distribution.cumulative[possible - 1] : 0;
  const notes = [];
  const recoveryMask = distribution.recoveryMask;
  if (recoveryMask === undefined ? guaranteed !== 1 && (hpRecovery || item?.residualRecovery) : recoveryMask & 5) notes.push(`${displayName(item)} 회복 반영`);
  if (recoveryMask === undefined ? guaranteed !== 1 && defAbility === 'cheekpouch' && !blockedBerry && (hpRecovery || koContext?.consumeResistBerry) : recoveryMask & 2) notes.push('볼주머니 회복 반영');
  if (recoveryMask & 8) notes.push(`던진 ${displayName(koContext.powerModel.flungItem)} 회복 반영`);
  if (koContext?.powerModel?.removeItemOnHit && (hpRecovery || item?.residualRecovery)) notes.push(`${displayName(item)} 제거 · 이후 회복 없음`);
  if (startHp < hp) notes.push(`현재 HP ${startHp} 기준`);
  if (!certain && guaranteed) notes.push(`${guaranteed}타 이내 확정`);
  return withKoMetric({
    label: possible ? (certain ? '확정' : '난수') : distribution.impossible ? 'KO' : '초과',
    turns: possible ? `${possible}타` : distribution.impossible ? '불가' : '10타',
    pct: possible && !certain ? (chance < 0.0005 ? '0.1% 미만' : chance > 0.9995 ? '99.9% 초과' : `${(chance * 100).toFixed(1)}%`) : '',
    cls: possible && possible <= 2 ? 'ohko' : '',
    sub: notes.join(' · '),
  }, distribution);
}

/* 입력된 상태에서의 스피드 실수치. 턴 진행이나 자동 랭크 변화는 수행하지 않는다. */
function effectiveSpeed(side, field, opponent = side) {
  const stats = calcStats(side);
  let spe = applyBoost(stats.spe, side.ranks.spe || 0);
  const { atkAb: ab, defAb: otherAb } = battleAbilityContext(side, opponent);
  const abilityData = ab ? AbilityById[ab] : null;
  const item = effectiveBattleItem(side, ab);
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
      weather: effectiveWeather(field, ab, otherAb),
      effectiveness: 1,
      isCritical: false,
      isPhysical: false,
    })) {
      speMods.push(mechanicMod(rule.mod));
    }
  }
  if (activeParadoxBoost(abilityData, field, effectiveWeather(field, ab, otherAb), itemData, side)
      && highestBattleStat(stats) === 'spe') speMods.push(MOD.x1_5);
  
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

export { BERRY_BLOCKING_ABILITIES, MECHANIC_MODS, mechanicMod, formatCalcMultiplier, formatModLabel, displayName, displayType, normalizeParadoxItemState, sideParadoxItemActive, asArray, fieldMechanics, moveHasRuleFlag, fieldRuleApplies, applyFieldRuleMods, firstMatchingFieldRule, conditionListIncludes, pokemonMatchesCondition, statBoostApplies, fractionValue, categoryMatches, statusMatches, sideCurrentHp, sideIsPinch, battleMaxFallenAllies, battleFallenAllies, abilityRuleApplies, applyAbilityRuleMods, damageBlockApplies, normalizedStatus, isBurnStatus, isPoisonStatus, isToxicStatus, attackerBlocksBerries, canRemovePowerItem, fixedDamageAmount, flingItemForMove, specialMoveInputIssue, fixedDamageResult, computeVariableBp, finishDamageStage, makeDamageContext, resolveDamagePreludeStage, calculateBasePowerStage, calculateAttackStage, activeParadoxBoost, highestBattleStat, calculateDefenseStage, calculateBaseDamageStage, calculateFinalDamageStage, resolveMultiHitVariants, sampleMultiHitCounts, calculateDamage, isSpreadDamage, powerMoveField, calculatePowerDamage, koRecoveryOptions, recoverPowerHit, recoverFlungBerry, beatUpParticipants, powerAttackProfile, makePowerAttackModel, resolvePowerMoveUse, simulatePowerKo, attachKoContext, calcHazardDamage, simulateKO, koRollWeights, simulateMoveKoDistribution, simulateOneMoveKoChance, withKoMetric, hkoLabel, effectiveSpeed, firstMover };
