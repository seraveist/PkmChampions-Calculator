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
const RESIST_BERRY_TYPES = {
  occaberry: 'Fire',
  passhoberry: 'Water',
  wacanberry: 'Electric',
  rindoberry: 'Grass',
  yacheberry: 'Ice',
  chopleberry: 'Fighting',
  kebiaberry: 'Poison',
  shucaberry: 'Ground',
  cobaberry: 'Flying',
  payapaberry: 'Psychic',
  tangaberry: 'Bug',
  chartiberry: 'Rock',
  kasibberry: 'Ghost',
  habanberry: 'Dragon',
  colburberry: 'Dark',
  babiriberry: 'Steel',
  chilanberry: 'Normal',
  roseliberry: 'Fairy',
};

const BERRY_BLOCKING_ABILITIES = ['unnerve', 'asoneglastrier', 'asonespectrier'];
const PHYSICAL_DEFENSE_SPECIAL_MOVES = ['psyshock', 'psystrike', 'secretsword'];

function normalizedStatus(status) {
  return (status || 'none').toString().toLowerCase();
}

function isBurnStatus(status) {
  return ['burn', 'brn'].includes(normalizedStatus(status));
}

function isPoisonStatus(status) {
  return ['poison', 'toxic', 'psn', 'tox'].includes(normalizedStatus(status));
}

function attackerBlocksBerries(atkAb) {
  return BERRY_BLOCKING_ABILITIES.includes(atkAb);
}

function fixedDamageAmount(move, atkSide, defSide, atkStats, defStats, defAb) {
  const atkHp = Math.max(1, Math.floor(atkStats.hp * (atkSide.hpPct ?? 1)));
  const defHp = Math.max(1, Math.floor(defStats.hp * (defSide.hpPct ?? 1)));

  switch (move.id) {
    case 'seismictoss':
    case 'nightshade':
      return 50;
    case 'dragonrage':
      return 40;
    case 'sonicboom':
      return 20;
    case 'superfang':
    case 'naturesmadness':
      return Math.max(1, Math.floor(defHp / 2));
    case 'finalgambit':
      return atkHp;
    case 'endeavor':
      return defHp > atkHp ? defHp - atkHp : 0;
    case 'fissure':
    case 'guillotine':
    case 'horndrill':
    case 'sheercold':
      if (move.id === 'sheercold' && effectiveTypes(defSide).includes('Ice')) return 0;
      return defAb === 'sturdy' ? 0 : defStats.hp;
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
  const id = move.id;
  const atkP = PokemonById[atkSide.pokemonIdx];
  const defP = PokemonById[defSide.pokemonIdx];
  const baseBp = move.bp || 0;
  const abilityCtx = battleAbilityContext(atkSide, defSide);
  const atkAb = abilityCtx.atkAb;
  const moldBreakerActive = ['moldbreaker', 'teravolt', 'turboblaze'].includes(atkAb);
  const defAb = (moldBreakerActive && MOLD_BREAKER_IGNORED_ABILITIES.includes(abilityCtx.defAb))
    ? ''
    : abilityCtx.defAb;
  const atkItem = effectiveBattleItem(atkSide, atkAb);
  const defItem = effectiveBattleItem(defSide, defAb);
  const rawDefItem = effectiveItem(defSide);
  const weather = effectiveWeather(field, atkAb, defAb);

  if (move.manualBp) return baseBp;

  switch (id) {
    case 'gyroball': {
      // 25 × defSpe / atkSpe, 최소 1, 최대 150
      const aS = applyBoost(atkStats.spe, atkSide.ranks?.spe || 0);
      const dS = applyBoost(defStats.spe, defSide.ranks?.spe || 0);
      if (aS <= 0) return 1;
      return Math.min(150, Math.max(1, Math.floor(25 * dS / aS)));
    }
    case 'electroball': {
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
    case 'heatcrash':
    case 'heavyslam': {
      const aw = effectiveWeight(atkSide, atkAb);
      const dw = Math.max(0.1, effectiveWeight(defSide, defAb));
      const r = aw / dw;
      if (r >= 5) return 120;
      if (r >= 4) return 100;
      if (r >= 3) return 80;
      if (r >= 2) return 60;
      return 40;
    }
    case 'lowkick':
    case 'grassknot': {
      const w = effectiveWeight(defSide, defAb);
      if (w >= 200) return 120;
      if (w >= 100) return 100;
      if (w >= 50) return 80;
      if (w >= 25) return 60;
      if (w >= 10) return 40;
      return 20;
    }
    case 'eruption':
    case 'waterspout': {
      // 150 × HP / maxHP. 기본 가정: 풀피
      const hp = atkSide.hpPct ?? 1.0;
      return Math.max(1, Math.floor(150 * hp));
    }
    case 'flail':
    case 'reversal': {
      // 48분의 X 단위 비례
      const hp = atkSide.hpPct ?? 1.0;
      const p = Math.floor(hp * 48);
      if (p < 2) return 200;
      if (p < 5) return 150;
      if (p < 10) return 100;
      if (p < 17) return 80;
      if (p < 33) return 40;
      return 20;
    }
    case 'hardpress': {
      // 1 + floor(99 × targetHP / maxHP). 풀피 기본: 100
      const hp = defSide.hpPct ?? 1.0;
      return Math.max(1, 1 + Math.floor(99 * hp));
    }
    case 'hex':
    case 'infernalparade':
    case 'barbbarrage': {
      // 대상이 상태이상이면 ×2
      const st = defSide.status;
      return (st && st !== 'none') ? baseBp * 2 : baseBp;
    }
    case 'venoshock': {
      // 대상이 독/맹독이면 ×2
      return ['Poison','Toxic','poison','toxic','psn','tox'].includes(defSide.status) ? baseBp * 2 : baseBp;
    }
    case 'facade': {
      // 사용자가 화상/마비/독/맹독이면 ×2 (수면 제외)
      // 화상 페널티는 별도로 calculateDamage 에서 면제 처리됨
      const st = atkSide.status;
      const dbl = st && !['none','Sleep','sleep','slp'].includes(st);
      return dbl ? baseBp * 2 : baseBp;
    }
    case 'knockoff': {
      // 대상이 도구를 보유하면 ×1.5 (Z아이템/메가스톤 등은 제외해야 정확하지만 단순화)
      const hasItem = !!rawDefItem;
      // 메가스톤은 떼낼 수 없으므로 보너스 없음
      const defItemData = rawDefItem ? ItemById[rawDefItem] : null;
      const removable = hasItem && !defItemData?.ms && defAb !== 'stickyhold';
      return removable ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'boltbeak':
    case 'fishiousrend': {
      // 사용자가 먼저 행동하면 ×2
      return field.atkMovesFirst ? baseBp * 2 : baseBp;
    }
    case 'payback': {
      // 사용자가 나중에 행동하면 ×2
      return field.atkMovesSecond ? baseBp * 2 : baseBp;
    }
    case 'avalanche':
      return atkSide.wasHit ? baseBp * 2 : baseBp;
    case 'assurance':
      return defSide.wasHit ? baseBp * 2 : baseBp;
    case 'risingvoltage': {
      const grounded = (typeof isGrounded === 'function') ? isGrounded(defSide, field, defAb, defItem) : true;
      return field.terrain === 'Electric' && grounded ? baseBp * 2 : baseBp;
    }
    case 'expandingforce': {
      // 사이코필드 + 사용자 그라운드 시 ×1.5
      const grounded = (typeof isGrounded === 'function') ? isGrounded(atkSide, field, atkAb, atkItem) : true;
      return field.terrain === 'Psychic' && grounded ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'mistyexplosion': {
      // 미스트필드 + 사용자 그라운드 시 ×1.5
      const grounded = (typeof isGrounded === 'function') ? isGrounded(atkSide, field, atkAb, atkItem) : true;
      return field.terrain === 'Misty' && grounded ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'gravapple': {
      // 중력장 시 ×1.5
      return field.isGravity ? Math.floor(baseBp * 1.5) : baseBp;
    }
    case 'solarbeam':
    case 'solarblade': {
      // 쾌청/대쾌청 외 날씨에서 ×0.5 (모래/비/눈/눈보라/none → 0.5×)
      const w = weather;
      if (w === 'Rain' || w === 'Heavy Rain' || w === 'Sand' || w === 'Snow') {
        return Math.floor(baseBp * 0.5);
      }
      return baseBp;
    }
    case 'weatherball': {
      // 날씨가 있으면 BP 100 (타입은 calculateDamage 에서 별도 처리)
      const w = weather;
      if (w && w !== 'none') return 100;
      return baseBp;
    }
    case 'terrainpulse': {
      // 필드 활성 + 사용자 그라운드 시 BP 100 (타입 별도)
      const grounded = (typeof isGrounded === 'function') ? isGrounded(atkSide, field, atkAb, atkItem) : true;
      const t = field.terrain;
      if (t && t !== 'none' && grounded) return 100;
      return baseBp;
    }
    case 'storedpower':
    case 'powertrip': {
      let total = 0;
      for (const k of ['atk','def','spa','spd','spe','accuracy','evasion']) {
        const r = atkSide.ranks?.[k] || 0;
        if (r > 0) total += r;
      }
      return 20 + 20 * total;
    }
    case 'lastrespects': {
      const fa = atkSide.fallenAllies || 0;
      return Math.min(350, 50 + 50 * fa);
    }
    case 'temperflare':
    case 'stompingtantrum':
      return atkSide.lastMoveFailed ? baseBp * 2 : baseBp;
    case 'acrobatics':
      // 도구 미보유 시 ×2 (55 → 110)
      return !atkSide.item ? baseBp * 2 : baseBp;
    case 'poltergeist':
      return rawDefItem ? baseBp : 0;
    case 'steelroller':
      return field.terrain && field.terrain !== 'none' ? baseBp : 0;
    case 'tripleaxel':
      // 1/2/3타에 BP 20/40/60 누적. 다단히트 평균 처리에선 (20+40+60)/3 = 40
      return 40;
    case 'beatup':
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
  const moldBreakerActive = ['moldbreaker', 'teravolt', 'turboblaze'].includes(atkAb);
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
    abilityCtx, itemCtx, weather, atkStats, defStats,
  } = ctx;

  // ─ 디스가이즈 (Mimikyu / Mimikyu-Totem): 풀피일 때 첫 공격 무효 ─
  // 챔피언스 사양: onEffectiveness 가 0 반환 → 데미지 0
  // 다단히트도 first hit 에 neutral 플래그가 set 되어 모든 hit 가 차단됨 (champions/abilities.ts:14-32)
  if (defAb === 'disguise' && defSide.fullHP) {
    const defPokeId = defP?.id || '';
    if (['mimikyu', 'mimikyutotem'].includes(defPokeId) && move.cat !== 'Status') {
      return finishDamageStage({
        damages: new Array(16).fill(0),
        minPct: 0, maxPct: 0,
        effectiveness: 0,
        moveType: move.type, category: move.cat,
        bp: move.bp, atk: 0, def: 0,
        defHP: defStats.hp,
        mods: ['디스가이즈로 차단']
      });
    }
  }

  // ─ 기술 타입 결정 ─
  let moveType = move.type;
  // 가변 위력 기술은 callback 으로 실제 BP 계산
  let bp = computeVariableBp(move, atkSide, defSide, field, atkStats, defStats);
  let category = move.cat;

  // Weather Ball: 날씨에 따라 타입 변경 (BP는 computeVariableBp 에서 처리됨)
  if (move.id === 'weatherball') {
    const wt = weather;
    if (wt === 'Sun' || wt === 'Harsh Sunshine') moveType = 'Fire';
    else if (wt === 'Rain' || wt === 'Heavy Rain') moveType = 'Water';
    else if (wt === 'Sand') moveType = 'Rock';
    else if (wt === 'Snow') moveType = 'Ice';
    if (wt && wt !== 'none') mods.push(`웨더볼 → ${moveType}`);
  }
  // Terrain Pulse: 필드에 따라 타입 변경 (그라운드 시)
  if (move.id === 'terrainpulse') {
    const grounded = isGrounded(atkSide, field, atkAb, atkItem);
    if (grounded) {
      if (field.terrain === 'Electric') moveType = 'Electric';
      else if (field.terrain === 'Grassy') moveType = 'Grass';
      else if (field.terrain === 'Misty') moveType = 'Fairy';
      else if (field.terrain === 'Psychic') moveType = 'Psychic';
      if (field.terrain && field.terrain !== 'none') mods.push(`테레인펄스 → ${moveType}`);
    }
  }

  // Aerilate / Refrigerate / Pixilate / Galvanize / Dragonize: 노말 → 타입 변경
  if (atkAb === 'liquidvoice' && move.flags?.sound) {
    moveType = 'Water';
    mods.push('Liquid Voice');
  }

  let typeChangeMod = null;
  if (moveType === 'Normal') {
    if (atkAb === 'aerilate') { moveType = 'Flying'; typeChangeMod = 4915; mods.push('에어레이트'); }
    else if (atkAb === 'refrigerate') { moveType = 'Ice'; typeChangeMod = 4915; mods.push('프리즈스킨'); }
    else if (atkAb === 'pixilate') { moveType = 'Fairy'; typeChangeMod = 4915; mods.push('페어리스킨'); }
    else if (atkAb === 'galvanize') { moveType = 'Electric'; typeChangeMod = 4915; mods.push('일렉트릭스킨'); }
    else if (atkAb === 'dragonize') { moveType = 'Dragon'; typeChangeMod = 4915; mods.push('드래고나이즈'); }
  }

  // Tera Blast: 테라스탈 시 공격 > 특공이면 물리
  if (move.id === 'terablast' && isTeraActive(atkSide)) {
    moveType = atkSide.teraType;
    const physAtk = applyBoost(atkStats.atk, atkSide.ranks.atk || 0);
    const specAtk = applyBoost(atkStats.spa, atkSide.ranks.spa || 0);
    if (physAtk > specAtk) category = 'Physical';
    // Stellar Tera Blast: 고정 100 BP
    if (atkSide.teraType === 'Stellar') bp = 100;
  }

  // Tera Starstorm (Terapagos-Stellar): 스텔라 타입
  if (move.id === 'terastarstorm' && atkP.id === 'terapagosstellar') {
    moveType = 'Stellar';
  }

  // Photon Geyser: 공격 > 특공이면 물리
  if (move.id === 'photongeyser') {
    const physAtk = applyBoost(atkStats.atk, atkSide.ranks.atk || 0);
    const specAtk = applyBoost(atkStats.spa, atkSide.ranks.spa || 0);
    if (physAtk > specAtk) category = 'Physical';
  }

  const isPhysical = category === 'Physical';
  const usesDefStat = isPhysical || PHYSICAL_DEFENSE_SPECIAL_MOVES.includes(move.id);
  let isCritical = !!field.isCritical || (atkAb === 'merciless' && isPoisonStatus(defSide.status));
  if (isCritical && (defAb === 'battlearmor' || defAb === 'shellarmor')) {
    isCritical = false;
    mods.push('critical blocked');
  } else if (atkAb === 'merciless' && isPoisonStatus(defSide.status)) {
    mods.push('Merciless critical');
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
    atkP, defP, atkAb, defAb, atkItem, defItem, atkItemData,
    weather, atkStats, defStats, isPhysical, effectiveness, category,
  } = ctx;
  let { moveType, bp, typeChangeMod } = ctx;

  // ═══════════════════════════════════════
  // STAGE 1: BP modifiers
  // ═══════════════════════════════════════
  if (defAb === 'iceface' && defP.id === 'eiscue' && defSide.fullHP && isPhysical) {
    return finishDamageStage({
      damages: new Array(16).fill(0),
      minPct: 0, maxPct: 0,
      effectiveness,
      moveType, category,
      bp, atk: 0, def: 0,
      defHP: defStats.hp,
      mods: ['Ice Face blocked']
    });
  }

  const fixedDamage = fixedDamageAmount(move, atkSide, defSide, atkStats, defStats, defAb);
  if (fixedDamage !== null) {
    return finishDamageStage(fixedDamageResult(fixedDamage, move, moveType, category, defStats, ['fixed damage']));
  }
  if (bp === 0) return finishDamageStage(null);

  const bpMods = [];

  // 특성 BP modifiers
  if (atkAb === 'technician' && bp <= 60) { bpMods.push(MOD.x1_5); mods.push('테크니션×1.5'); }
  if (atkAb === 'toughclaws' && move.flags?.contact) { bpMods.push(MOD.x1_3); mods.push('단단한발톱×1.3'); }
  if (atkAb === 'ironfist' && move.flags?.punch) { bpMods.push(MOD.x1_2); mods.push('철주먹×1.2'); }
  if (atkAb === 'strongjaw' && move.flags?.bite) { bpMods.push(MOD.x1_5); mods.push('강한턱×1.5'); }
  if (atkAb === 'megalauncher' && move.flags?.pulse) { bpMods.push(MOD.x1_5); mods.push('메가런처×1.5'); }
  if (atkAb === 'sharpness' && move.flags?.slicing) { bpMods.push(MOD.x1_5); mods.push('예리함×1.5'); }
  if (atkAb === 'reckless' && (move.recoil || move.id === 'jumpkick' || move.id === 'highjumpkick')) {
    bpMods.push(MOD.x1_2); mods.push('이판사판×1.2');
  }
  if (atkAb === 'punkrock' && move.flags?.sound) { bpMods.push(MOD.x1_3); mods.push('펑크록×1.3'); }
  if (atkAb === 'steelworker' && moveType === 'Steel') { bpMods.push(MOD.x1_5); mods.push('강철술사×1.5'); }
  if (atkAb === 'steelyspirit' && moveType === 'Steel') { bpMods.push(MOD.x1_5); mods.push('강철의의지×1.5'); }
  if (atkAb === 'dragonsmaw' && moveType === 'Dragon') { bpMods.push(MOD.x1_5); mods.push('용의턱×1.5'); }
  if (atkAb === 'transistor' && moveType === 'Electric') { bpMods.push(MOD.x1_3); mods.push('트랜지스터×1.3'); }
  if (atkAb === 'rockypayload' && moveType === 'Rock') { bpMods.push(MOD.x1_5); mods.push('바위적재×1.5'); }
  if (atkAb === 'sheerforce' && move.sec) { bpMods.push(MOD.x1_3); mods.push('우격다짐×1.3'); }
  if (atkAb === 'flareboost' && isBurnStatus(atkSide.status) && !isPhysical) { bpMods.push(MOD.x1_5); mods.push('Flare Boost×1.5'); }
  if (atkAb === 'toxicboost' && isPoisonStatus(atkSide.status) && isPhysical) { bpMods.push(MOD.x1_5); mods.push('Toxic Boost×1.5'); }
  if (atkAb === 'sandforce' && weather === 'Sand' && ['Rock','Ground','Steel'].includes(moveType)) {
    bpMods.push(MOD.x1_3); mods.push('모래의힘×1.3');
  }
  if (atkAb === 'normalize') { moveType = 'Normal'; bpMods.push(MOD.x1_2); mods.push('노말스킨×1.2'); }
  if (typeChangeMod) bpMods.push(typeChangeMod);  // Aerilate 등
  if (atkAb === 'analytic' && field.atkMovesSecond) { bpMods.push(MOD.x1_3); mods.push('애널라이즈×1.3'); }

  // 총대장 (Supreme Overlord): 쓰러진 동료 수에 따라 1.1~1.5× (state.atk.fallenAllies 사용)
  const auraBreakActive = atkAb === 'aurabreak' || defAb === 'aurabreak';
  if ((atkAb === 'darkaura' || defAb === 'darkaura') && moveType === 'Dark') {
    bpMods.push(auraBreakActive ? MOD.x0_75 : 5448);
    mods.push(auraBreakActive ? 'Dark Aura reversedx0.75' : 'Dark Aurax1.33');
  }
  if ((atkAb === 'fairyaura' || defAb === 'fairyaura') && moveType === 'Fairy') {
    bpMods.push(auraBreakActive ? MOD.x0_75 : 5448);
    mods.push(auraBreakActive ? 'Fairy Aura reversedx0.75' : 'Fairy Aurax1.33');
  }

  if (atkAb === 'supremeoverlord' && atkSide.fallenAllies) {
    const mod = 4096 + Math.min(5, atkSide.fallenAllies) * 410;  // 1.1~1.5×
    bpMods.push(mod);
    mods.push(`총대장 (동료 ${atkSide.fallenAllies}명 쓰러짐 ×${(mod/4096).toFixed(2)})`);
  }

  // 재앙 효과는 Atk/Def 스탯 단계에서 처리됨 (아래 STAGE 2/3 참조)

  // 진홍빛고동 (Orichalcum Pulse): 자기 진입시 쾌청 + 공격 1.33×
  // 하드론엔진 (Hadron Engine): 자기 진입시 일렉트릭 필드 + 특공 1.33×
  // 이건 Atk 단계로 이동

  // 아이템 BP modifiers
  if (atkItemData) {
    // 타입 강화 아이템
    const typeBoostItems = {
      'charcoal': 'Fire', 'mysticwater': 'Water', 'miracleseed': 'Grass',
      'magnet': 'Electric', 'nevermeltice': 'Ice', 'blackbelt': 'Fighting',
      'poisonbarb': 'Poison', 'softsand': 'Ground', 'sharpbeak': 'Flying',
      'twistedspoon': 'Psychic', 'silverpowder': 'Bug', 'hardstone': 'Rock',
      'spelltag': 'Ghost', 'dragonfang': 'Dragon', 'blackglasses': 'Dark',
      'metalcoat': 'Steel', 'fairyfeather': 'Fairy', 'silkscarf': 'Normal'
    };
    if (typeBoostItems[atkItem] === moveType) { bpMods.push(MOD.x1_2); mods.push(`${atkItemData.koName}×1.2`); }

    // Plate
    if (atkItem.endsWith('plate')) {
      const plateType = {
        'flameplate':'Fire','splashplate':'Water','zapplate':'Electric','meadowplate':'Grass',
        'icicleplate':'Ice','fistplate':'Fighting','toxicplate':'Poison','earthplate':'Ground',
        'skyplate':'Flying','mindplate':'Psychic','insectplate':'Bug','stoneplate':'Rock',
        'spookyplate':'Ghost','dracoplate':'Dragon','dreadplate':'Dark','ironplate':'Steel',
        'pixieplate':'Fairy'
      };
      if (plateType[atkItem] === moveType) { bpMods.push(MOD.x1_2); mods.push(`${atkItemData.koName}×1.2`); }
    }

    // Muscle Band (물리 ×1.1) / Wise Glasses (특수 ×1.1)
    if (atkItem === 'muscleband' && isPhysical) { bpMods.push(MOD.x1_1); mods.push('근육띠×1.1'); }
    if (atkItem === 'wiseglasses' && !isPhysical) { bpMods.push(MOD.x1_1); mods.push('박식안경×1.1'); }

    // Punching Glove
    if (atkItem === 'punchingglove' && move.flags?.punch) { bpMods.push(MOD.x1_1g); mods.push('펀치글러브×1.1'); }

    // Primal Orbs (원시회귀 전용)
    if (atkItem === 'redorb' && atkP.id === 'groudonprimal' && moveType === 'Fire') { bpMods.push(MOD.x1_2); }
    if (atkItem === 'blueorb' && atkP.id === 'kyogreprimal' && moveType === 'Water') { bpMods.push(MOD.x1_2); }

    // Adamant/Lustrous/Griseous Orb (조건부)
    if (atkItem === 'adamant orb' && atkP.id === 'dialga' && (moveType === 'Dragon' || moveType === 'Steel')) {
      bpMods.push(MOD.x1_2); mods.push('아다만트구슬×1.2');
    }
    if (atkItem === 'lustrous orb' && atkP.id === 'palkia' && (moveType === 'Dragon' || moveType === 'Water')) {
      bpMods.push(MOD.x1_2); mods.push('하얀구슬×1.2');
    }
    if (atkItem === 'griseousorb' && atkP.baseSpecies === 'Giratina' && (moveType === 'Dragon' || moveType === 'Ghost')) {
      bpMods.push(MOD.x1_2); mods.push('깨어진구슬×1.2');
    }
  }

  // Field BP modifiers
  if (field.terrain === 'Electric' && moveType === 'Electric' && isGrounded(atkSide, field, atkAb, atkItem)) {
    bpMods.push(MOD.x1_3); mods.push('일렉트릭필드×1.3');
  }
  if (field.terrain === 'Grassy' && moveType === 'Grass' && isGrounded(atkSide, field, atkAb, atkItem)) {
    bpMods.push(MOD.x1_3); mods.push('그래스필드×1.3');
  }
  if (field.terrain === 'Psychic' && moveType === 'Psychic' && isGrounded(atkSide, field, atkAb, atkItem)) {
    bpMods.push(MOD.x1_3); mods.push('사이코필드×1.3');
  }
  if (field.terrain === 'Misty' && moveType === 'Dragon' && isGrounded(defSide, field, defAb, defItem)) {
    bpMods.push(MOD.x0_5); mods.push('미스트필드 드래곤×0.5');
  }
  if (field.terrain === 'Grassy' && ['earthquake','bulldoze','magnitude'].includes(move.id)) {
    bpMods.push(MOD.x0_5); mods.push('그래스필드 지진×0.5');
  }

  // 도우미 (Helping Hand)
  if (field.atkHelpingHand) { bpMods.push(MOD.x1_5); mods.push('도우미×1.5'); }

  // 응용: 챔피언스 신규 메가 특성 "메가솔라" — 항상 쾌청 효과로 간주
  // 이건 실제 날씨를 세팅하지 않으므로 BP 단계에서 불꽃 ×1.5 추가하지 않고 Weather에서 처리

  ctx.moveType = moveType;
  ctx.bp = OF16(Math.max(1, pokeRound(bp * chainMods(bpMods, 1, 65535) / 4096)));
  return null;
}

function calculateAttackStage(ctx) {
  const {
    atkSide, defSide, move, field, mods,
    atkP, atkAb, defAb, atkItem, weather, atkStats, defStats,
    isPhysical, isCritical, moveType,
  } = ctx;

  // ═══════════════════════════════════════
  // STAGE 2: Attack modifiers
  // ═══════════════════════════════════════
  const usesTargetAttack = move.id === 'foulplay';
  let atkStat = usesTargetAttack ? defStats.atk : (isPhysical ? atkStats.atk : atkStats.spa);
  let atkBoost = usesTargetAttack
    ? (defSide.ranks.atk || 0)
    : (isPhysical ? (atkSide.ranks.atk || 0) : (atkSide.ranks.spa || 0));

  // Unaware: 상대 부스트 무시
  if (defAb === 'unaware' && atkBoost > 0) atkBoost = 0;
  // 급소 시 공격 하락 무시
  if (isCritical && atkBoost < 0) atkBoost = 0;

  atkStat = applyBoost(atkStat, atkBoost);
  if (atkBoost !== 0) mods.push(`공격랭크${atkBoost > 0 ? '+' : ''}${atkBoost}`);

  const atkMods = [];

  // 특성 공격 modifiers
  if (atkAb === 'hugepower' || atkAb === 'purepower') {
    if (isPhysical) { atkMods.push(MOD.x2_0); mods.push('순수한힘×2'); }
  }
  if (atkAb === 'guts' && atkSide.status !== 'none' && isPhysical) {
    atkMods.push(MOD.x1_5); mods.push('의기양양×1.5');
  }
  if (atkAb === 'waterbubble' && moveType === 'Water') {
    atkMods.push(MOD.x2_0); mods.push('Water Bubblex2');
  }
  if (defAb === 'purifyingsalt' && moveType === 'Ghost') {
    atkMods.push(MOD.x0_5); mods.push('Purifying Saltx0.5');
  }
  if (defAb === 'waterbubble' && moveType === 'Fire') {
    atkMods.push(MOD.x0_5); mods.push('Water Bubble Firex0.5');
  }
  if (atkAb === 'solarpower' && weather === 'Sun' && !isPhysical) {
    atkMods.push(MOD.x1_5); mods.push('선파워×1.5');
  }
  if (atkAb === 'flowergift' && weather === 'Sun' && isPhysical) {
    atkMods.push(MOD.x1_5); mods.push('꽃선물×1.5');
  }

  // 챔피언스 핵심: 진홍빛고동 (코라이돈) / 하드론엔진 (미라이돈)
  if (atkAb === 'orichalcumpulse' && isPhysical) {
    // 진입 시 쾌청 효과 (자기만) + 공격 4/3
    atkMods.push(5461); mods.push('진홍빛고동×1.33');
  }
  if (atkAb === 'hadronengine' && !isPhysical) {
    // 진입 시 일렉트릭 필드 + 특공 4/3
    atkMods.push(5461); mods.push('하드론엔진×1.33');
  }

  // 고대활성 / 쿼크차지: 쾌청-or-부에가 / 일렉트릭-or-부에가 발동 시 최고 스탯 ×1.3 (HP는 ×1.5)
  // 어떤 스탯이 부스트 받는지 결정: 가장 높은 실수치 스탯
  const isProtoActive = atkAb === 'protosynthesis' && (weather === 'Sun' || atkItem === 'boosterenergy');
  const isQuarkActive = atkAb === 'quarkdrive' && (field.terrain === 'Electric' || atkItem === 'boosterenergy');

  if (isProtoActive || isQuarkActive) {
    // 가장 높은 base+EV+nature 스탯 결정 (HP 제외)
    const candidates = ['atk', 'def', 'spa', 'spd', 'spe'].map(s => ({ stat: s, val: atkStats[s] }));
    candidates.sort((a, b) => b.val - a.val);
    const boostStat = candidates[0].stat;

    if ((isPhysical && boostStat === 'atk') || (!isPhysical && boostStat === 'spa')) {
      atkMods.push(MOD.x1_3); // ×1.3
      const name = isProtoActive ? '고대활성' : '쿼크차지';
      mods.push(`${name}×1.3 (${STAT_LABEL[boostStat]})`);
    }
  }

  // 맹화/격류/심록/벌레의알림 (저HP 조건)
  const pinchAbilities = {'blaze':'Fire','torrent':'Water','overgrow':'Grass','swarm':'Bug'};
  if (pinchAbilities[atkAb] === moveType && atkSide.pinch) {
    atkMods.push(MOD.x1_5); mods.push(`${pinchAbilities[atkAb] === 'Fire' ? '맹화' : pinchAbilities[atkAb] === 'Water' ? '격류' : pinchAbilities[atkAb] === 'Grass' ? '심록' : '벌레의알림'}×1.5`);
  }
  if (atkAb === 'defeatist' && atkSide.pinch) {
    atkMods.push(MOD.x0_5); mods.push('약한마음×0.5');
  }
  if (atkAb === 'flashfire' && atkSide.flashFireActive && moveType === 'Fire') {
    atkMods.push(MOD.x1_5); mods.push('불꽃몸×1.5');
  }
  if (atkAb === 'hustle' && isPhysical) { atkMods.push(MOD.x1_5); mods.push('근성×1.5'); }
  if (atkAb === 'gorillatactics' && isPhysical) { atkMods.push(MOD.x1_5); mods.push('고릴라전법×1.5'); }

  // 재앙 적용 (Atk 단계)
  // 목간의재앙: 자기가 아닌 타 포켓몬의 공격 ×0.75 (자기 자신 효과 X)
  // 그릇의재앙: 자기가 아닌 타 포켓몬의 특공 ×0.75
  if (field.ruinTablet && atkAb !== 'tabletsofruin' && isPhysical) {
    atkMods.push(MOD.x0_75); mods.push('목간의재앙×0.75');
  }
  if (field.ruinVessel && atkAb !== 'vesselofruin' && !isPhysical) {
    atkMods.push(MOD.x0_75); mods.push('그릇의재앙×0.75');
  }

  // 챔피언스 신규: 메가장크로다일 드래곤스킨 (노말→드래곤)
  // (데이터 레이어에서 처리되어야 하지만 여기서도 핸들링)

  // 능력치 rank 감소 없음 특성
  // (별도 적용 필요 없음, 단순 rank 처리)

  // 아이템 공격 modifiers
  if (atkItem === 'choiceband' && isPhysical) { atkMods.push(MOD.x1_5); mods.push('구애머리띠×1.5'); }
  if (atkItem === 'choicespecs' && !isPhysical) { atkMods.push(MOD.x1_5); mods.push('구애안경×1.5'); }
  if (atkItem === 'thickclub' && ['cubone','marowak','marowakalola'].includes(atkP.id) && isPhysical) {
    atkMods.push(MOD.x2_0); mods.push('두꺼운뼈×2');
  }
  if (atkItem === 'lightball' && atkP.baseSpecies === 'Pikachu') {
    atkMods.push(MOD.x2_0); mods.push('전기구슬×2');
  }
  if (atkItem === 'deepseatooth' && atkP.id === 'clamperl' && !isPhysical) {
    atkMods.push(MOD.x2_0); mods.push('심해의이빨×2');
  }

  // 화상: Facade / Guts 예외
  const isBurned = isBurnStatus(atkSide.status) && isPhysical && atkAb !== 'guts' && move.id !== 'facade';
  if (isBurned) { atkMods.push(MOD.x0_5); mods.push('화상 물리½'); }

  ctx.atkStat = OF16(Math.max(1, pokeRound(atkStat * chainMods(atkMods, 410, 131072) / 4096)));
  return null;
}

function calculateDefenseStage(ctx) {
  const {
    defSide, field, mods,
    defP, atkAb, defAb, defItem, weather, defStats, defTypes,
    isPhysical, isCritical, usesDefStat,
  } = ctx;

  // ═══════════════════════════════════════
  // STAGE 3: Defense modifiers
  // ═══════════════════════════════════════
  let defStat = usesDefStat ? defStats.def : defStats.spd;
  let defBoost = usesDefStat ? (defSide.ranks.def || 0) : (defSide.ranks.spd || 0);

  // Unaware (공격측이)
  if (atkAb === 'unaware' && defBoost > 0) defBoost = 0;
  // 급소 시 방어 상승 무시
  if (isCritical && defBoost > 0) defBoost = 0;

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

  // 특성 방어 modifiers
  if (defAb === 'marvelscale' && defSide.status !== 'none' && usesDefStat) {
    defMods.push(MOD.x1_5); mods.push('이상한비늘×1.5');
  }
  if (defAb === 'grasspelt' && field.terrain === 'Grassy' && usesDefStat) {
    defMods.push(MOD.x1_5); mods.push('털가죽(풀)×1.5');
  }
  if (defAb === 'furcoat' && usesDefStat) { defMods.push(MOD.x2_0); mods.push('털가죽×2'); }
  if (defAb === 'icescales' && !isPhysical) { defMods.push(MOD.x2_0); mods.push('얼음비늘×2'); }

  // 고대활성/쿼크차지 방어 부스트 (방어/특방이 최고 스탯일 때)
  const defIsProtoActive = defAb === 'protosynthesis' && (weather === 'Sun' || defItem === 'boosterenergy');
  const defIsQuarkActive = defAb === 'quarkdrive' && (field.terrain === 'Electric' || defItem === 'boosterenergy');
  if (defIsProtoActive || defIsQuarkActive) {
    const dCandidates = ['atk', 'def', 'spa', 'spd', 'spe'].map(s => ({ stat: s, val: defStats[s] }));
    dCandidates.sort((a, b) => b.val - a.val);
    const boostStat = dCandidates[0].stat;
    if ((usesDefStat && boostStat === 'def') || (!usesDefStat && boostStat === 'spd')) {
      defMods.push(MOD.x1_3);
      const name = defIsProtoActive ? '고대활성' : '쿼크차지';
      mods.push(`${name}(방어)×1.3 (${STAT_LABEL[boostStat]})`);
    }
  }

  // 재앙 (Def 단계)
  // 검의재앙: 자기가 아닌 타 포켓몬의 방어 ×0.75
  // 구슬의재앙: 자기가 아닌 타 포켓몬의 특방 ×0.75
  if (field.ruinSword && defAb !== 'swordofruin' && usesDefStat) {
    defMods.push(MOD.x0_75); mods.push('검의재앙×0.75');
  }
  if (field.ruinBeads && defAb !== 'beadsofruin' && !usesDefStat) {
    defMods.push(MOD.x0_75); mods.push('구슬의재앙×0.75');
  }

  // 아이템 방어 modifiers
  if (defItem === 'eviolite' && defP.nfe) { defMods.push(MOD.x1_5); mods.push('진화의휘석×1.5'); }
  if (defItem === 'assaultvest' && !usesDefStat) { defMods.push(MOD.x1_5); mods.push('돌격조끼×1.5'); }
  if (defItem === 'metalpowder' && defP.id === 'ditto' && usesDefStat) {
    defMods.push(MOD.x2_0); mods.push('메탈파우더×2');
  }
  if (defItem === 'deepseascale' && defP.id === 'clamperl' && !usesDefStat) {
    defMods.push(MOD.x2_0); mods.push('심해의비늘×2');
  }

  ctx.defStat = OF16(Math.max(1, pokeRound(defStat * chainMods(defMods, 410, 131072) / 4096)));
  return null;
}

function calculateBaseDamageStage(ctx) {
  const {
    move, field, mods, atkAb, atkItem, defItem, weather, defStats,
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
  const atkSelfSun = atkAb === 'megasol';
  const damageWeather = atkSelfSun ? 'Sun' : weather;

  if (atkItem !== 'utilityumbrella' && defItem !== 'utilityumbrella') {
    if (atkSelfSun && moveType === 'Fire') {
      baseDmg = pokeRound(baseDmg * 6144 / 4096);
      mods.push('메가솔 불꽃×1.5');
    } else if ((damageWeather === 'Sun' || damageWeather === 'Harsh Sunshine') && moveType === 'Fire') {
      baseDmg = pokeRound(baseDmg * 6144 / 4096);
      mods.push('쾌청 불꽃×1.5');
    } else if ((damageWeather === 'Rain' || damageWeather === 'Heavy Rain') && moveType === 'Water') {
      baseDmg = pokeRound(baseDmg * 6144 / 4096);
      mods.push('비 물×1.5');
    } else if (damageWeather === 'Sun' && moveType === 'Water' && !atkSelfSun) {
      baseDmg = pokeRound(baseDmg * 2048 / 4096);
      mods.push('쾌청 물×0.5');
    } else if (damageWeather === 'Rain' && moveType === 'Fire' && !atkSelfSun) {
      baseDmg = pokeRound(baseDmg * 2048 / 4096);
      mods.push('비 불꽃×0.5');
    } else if (damageWeather === 'Harsh Sunshine' && moveType === 'Water') {
      return finishDamageStage({ damages: new Array(16).fill(0), minPct: 0, maxPct: 0, effectiveness: 0, moveType, category, bp, atk: atkStat, def: defStat, defHP: defStats.hp, mods: ['대쾌청: 물 기술 무효'] });
    } else if (damageWeather === 'Heavy Rain' && moveType === 'Fire') {
      return finishDamageStage({ damages: new Array(16).fill(0), minPct: 0, maxPct: 0, effectiveness: 0, moveType, category, bp, atk: atkStat, def: defStat, defHP: defStats.hp, mods: ['강한비: 불꽃 기술 무효'] });
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
    atkAb, defAb, atkItem, defItem, defItemData, defStats,
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

  // Screens
  const screenActive = (
    (field.defReflect && isPhysical) ||
    (field.defLightScreen && !isPhysical)
  );
  if (screenActive && !isCritical && atkAb !== 'infiltrator') {
    finalMods.push(field.gameType === 'Doubles' ? 2732 : 2048);
    mods.push(isPhysical ? '리플렉터×0.5' : '빛의장막×0.5');
  }

  // Multiscale / Shadow Shield (HP 풀일 때)
  if ((defAb === 'multiscale' || defAb === 'shadowshield') && defSide.fullHP) {
    finalMods.push(MOD.x0_5); mods.push(defAb === 'multiscale' ? '멀티스케일×0.5' : '섀도실드×0.5');
  }

  // Fluffy: 접촉기 0.5× / 불꽃 2×
  if (defAb === 'fluffy') {
    if (move.flags?.contact) { finalMods.push(MOD.x0_5); mods.push('플러피 접촉×0.5'); }
    if (moveType === 'Fire') { finalMods.push(MOD.x2_0); mods.push('플러피 불꽃×2'); }
  }

  // Punk Rock (방어): 소리 기술 0.5×
  if (defAb === 'punkrock' && move.flags?.sound) {
    finalMods.push(MOD.x0_5); mods.push('펑크록 방어×0.5');
  }

  // Ice Scales: 특수 0.5× (이미 Def에서 처리했지만 공식은 Final)
  // → 여기선 Def stage에서 처리했으므로 스킵

  // Thick Fat (공격 타입이 불꽃/얼음이면 공격 절반, 여기선 defMod 대신 final로 처리해도 됨)
  if (defAb === 'thickfat' && (moveType === 'Fire' || moveType === 'Ice')) {
    finalMods.push(MOD.x0_5); mods.push('두꺼운지방×0.5');
  }

  // Heatproof: 불꽃 0.5×
  if (defAb === 'heatproof' && moveType === 'Fire') {
    finalMods.push(MOD.x0_5); mods.push('내열×0.5');
  }

  // Dry Skin: 불꽃 1.25×
  if (defAb === 'dryskin' && moveType === 'Fire') {
    finalMods.push(5120); mods.push('건조피부 불꽃×1.25');
  }

  // Filter / Prism Armor / Solid Rock: 효과굉장 0.75×
  if ((defAb === 'filter' || defAb === 'prismarmor' || defAb === 'solidrock') && effectiveness > 1) {
    finalMods.push(MOD.x0_75);
    const name = defAb === 'filter' ? '필터' : defAb === 'prismarmor' ? '프리즘아머' : '단단한바위';
    mods.push(`${name}×0.75`);
  }

  // Neuroforce: 효과굉장 1.25×
  if (atkAb === 'neuroforce' && effectiveness > 1) {
    finalMods.push(5120); mods.push('뇌장×1.25');
  }

  // Sniper (급소 시 추가 1.5×)
  if (atkAb === 'sniper' && isCritical) {
    finalMods.push(MOD.x1_5); mods.push('스나이퍼×1.5');
  }

  // Tinted Lens: 반감 이하일 때 2×
  if (atkAb === 'tintedlens' && effectiveness < 1) {
    finalMods.push(MOD.x2_0); mods.push('색안경×2');
  }

  // Aerilate/Refrigerate etc. already applied in BP stage

  // 아이템
  if (atkItem === 'lifeorb') { finalMods.push(5324); mods.push('생명의구슬×1.3'); }
  if (atkItem === 'expertbelt' && effectiveness > 1) { finalMods.push(MOD.x1_2); mods.push('달인의띠×1.2'); }
  if (atkItem === 'metronome') { /* 기술 연속 사용 카운트, 생략 */ }

  // 여보먹열매 (효과굉장 시 0.5×) — 단발 계산이라 단순 적용
  const resistBerryType = RESIST_BERRY_TYPES[defItem];
  const resistBerryApplies = resistBerryType === moveType && (defItem === 'chilanberry' || effectiveness > 1);
  if (resistBerryApplies && !attackerBlocksBerries(atkAb)) {
    const ripenActive = defAb === 'ripen';
    finalMods.push(ripenActive ? MOD.x0_25 : MOD.x0_5);
    const berryName = defItemData?.koName || defItem;
    mods.push(`${berryName}${ripenActive ? '+Ripen' : ''}x${ripenActive ? '0.25' : '0.5'}`);
  }

  // ─ 방어 관통 메커니즘 ─
  // 방어/막아내기는 모든 공격 차단 (단, 일부 기술은 무시)
  if (field.defProtect) {
    const protectIgnoringMoves = ['feint', 'hyperspacehole', 'hyperspacefury', 'phantomforce', 'shadowforce'];
    const ignoresProtect = protectIgnoringMoves.includes(move.id);

    if (!ignoresProtect) {
      // 피어싱드릴 (메가몰드비스트): 접촉기로 방어 관통, 25% 대미지
      // 연격의태세 (Unseen Fist): 접촉기로 방어 관통, 25% 대미지 (챔피언스 너프)
      if ((atkAb === 'piercingdrill' || atkAb === 'unseenfist') && move.flags?.contact) {
        finalMods.push(MOD.x0_25);
        const abName = atkAb === 'piercingdrill' ? '피어싱드릴' : '연격의태세';
        mods.push(`${abName} ×0.25 (방어 관통)`);
      } else {
        // 일반 공격은 방어막에 막힘 → 대미지 0
        return { damages: new Array(16).fill(0), minPct: 0, maxPct: 0, effectiveness, moveType, category, bp, atk: atkStat, def: defStat, defHP: defStats.hp, mods: ['방어/막아내기로 차단'] };
      }
    }
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
  if (atkAb === 'parentalbond' && !move.mh && category !== 'Status' &&
      !(field.gameType === 'Doubles' && ['allAdjacent','allAdjacentFoes'].includes(move.tgt))) {
    parentalBondActive = true;
    mods.push('부자유친 (1타 + 0.25타)');
    // 1타 100% + 2타 25% = 1.25× 합산
    multihitDamages = damages.map(d => d + Math.floor(d * 0.25));
  }

  if (move.mh && !parentalBondActive) {
    let hits;
    if (Array.isArray(move.mh)) {
      // [min, max] 범위 → 평균 hit 수 사용 (기본 3.167 for 2~5)
      // Loaded Dice 가 있으면 최대치에 가까움
      if (atkItem === 'loadeddice') {
        hits = move.mh[1] === 5 ? 4.5 : move.mh[1];  // 2~5 → 4.5, 그 외 최대
      } else if (atkAb === 'skilllink') {
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
function simulateKO(dmg, hp, defItem, defAb, startHp) {
  let cur = (typeof startHp === 'number' && startHp > 0) ? startHp : hp;
  if (cur <= 0) return 1;
  const halfHP = Math.floor(hp / 2);
  const sitrusHeal = Math.floor(hp / 4);
  const lefto = Math.floor(hp / 16);
  let berryUsed = !(defItem === 'sitrusberry');
  for (let n = 1; n <= 10; n++) {
    cur -= dmg;
    if (cur <= 0) return n;
    if (!berryUsed && cur <= halfHP) { cur = Math.min(hp, cur + sitrusHeal); berryUsed = true; }
    if (defItem === 'leftovers') cur = Math.min(hp, cur + lefto);
    if (defAb === 'poisonheal') cur = Math.min(hp, cur + Math.floor(hp / 8));
  }
  return 11;
}

function hkoLabel(damages, hp, defSide, field) {
  const max = damages[15];
  const min = damages[0];
  if (max <= 0) return { label: "대미지", turns: "없음", pct: "", cls: "no" };
  const defItem = effectiveItem(defSide);
  const defAb = effectiveAbility(defSide);

  // 진입 위험 (스텔스록/압정뿌리기) 데미지를 시작 HP 에서 차감
  const hazardDmg = field ? calcHazardDamage(defSide, field) : 0;
  const startHp = Math.max(1, hp - hazardDmg);
  const hazardActive = hazardDmg > 0;

  // 기합의띠/옹골참은 HP 풀피일 때만 발동. 진입 위험으로 1HP 라도 깎였다면 무효.
  const hasFocusSash = defItem === 'focussash' && defSide.fullHP && !hazardActive;
  const hasSturdy = defAb === 'sturdy' && defSide.fullHP && !hazardActive;
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

  const hasSitrus = defItem === 'sitrusberry';

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
      const minKOs = simulateKO(min, hp, defItem, defAb, startHp);
      subParts.push(`자뭉 시 확정 ${minKOs}타`);
    }
    return { label: "난수", turns: "1타", pct: `${pct}%`, cls: "ohko", sub: subParts.join(' · ') };
  }

  // 자뭉/회복 아이템 반영한 N타 (진입 위험 후 startHp 기준)
  const minKOs = simulateKO(min, hp, defItem, defAb, startHp);
  const maxKOs = simulateKO(max, hp, defItem, defAb, startHp);

  const isFixed = (minKOs === maxKOs);
  const label = isFixed ? "확정" : "난수";
  const turns = `${maxKOs}타`;

  const subParts = [];
  if (hazardActive) {
    const pct = Math.round(hazardDmg / hp * 100);
    subParts.push(`진입 위험 -${pct}%`);
  }
  if (defItem === 'sitrusberry') subParts.push('자뭉 반영');
  else if (defItem === 'leftovers') subParts.push('먹남 반영');
  else if (defAb === 'poisonheal') subParts.push('포이즌힐 반영');

  return { label, turns, pct: "", cls: minKOs <= 2 ? "ohko" : "", sub: subParts.join(' · ') };
}

/* ════════════════════════════════════════════════════════════
   속도 계산
   ════════════════════════════════════════════════════════════ */
function effectiveSpeed(side, field) {
  const stats = calcStats(side);
  let spe = applyBoost(stats.spe, side.ranks.spe || 0);
  const ab = effectiveAbility(side);
  const item = effectiveItem(side);
  
  const speMods = [];
  
  // 특성
  if (ab === 'swiftswim' && (field.weather === 'Rain' || field.weather === 'Heavy Rain')) speMods.push(MOD.x2_0);
  if (ab === 'chlorophyll' && (field.weather === 'Sun' || field.weather === 'Harsh Sunshine')) speMods.push(MOD.x2_0);
  if (ab === 'sandrush' && field.weather === 'Sand') speMods.push(MOD.x2_0);
  if (ab === 'slushrush' && field.weather === 'Snow') speMods.push(MOD.x2_0);
  if (ab === 'surgesurfer' && field.terrain === 'Electric') speMods.push(MOD.x2_0);
  if (ab === 'unburden' && side.unburdenActive) speMods.push(MOD.x2_0);
  if (ab === 'quickfeet' && side.status !== 'none') speMods.push(MOD.x1_5);
  
  // 아이템
  if (item === 'choicescarf') speMods.push(MOD.x1_5);
  if (item === 'ironball') speMods.push(MOD.x0_5);
  if (item === 'quickpowder' && side.pokemonIdx === 'ditto') speMods.push(MOD.x2_0);
  
  spe = pokeRound(spe * chainMods(speMods, 410, 131172) / 4096);
  
  // 마비 (Gen 7+: 0.5×)
  if (side.status === 'Paralysis' && ab !== 'quickfeet') {
    spe = Math.floor(spe * 0.5);
  }
  
  // Tailwind
  if (side.tailwind) spe *= 2;
  
  // Trick Room은 실제 속도 뒤집기는 아니지만 표시용으로 반영 안함
  
  return spe;
}

function firstMover(movePri, atkSpe, defSpe, field) {
  // Trick Room이면 느린 쪽이 선공
  if (field.isTrickRoom) {
    if (movePri > 0) return "atk";
    if (movePri < 0) return "def";
    if (atkSpe < defSpe) return "atk";
    if (atkSpe > defSpe) return "def";
    return "tie";
  }
  if (movePri > 0) return "atk";
  if (movePri < 0) return "def";
  if (atkSpe > defSpe) return "atk";
  if (atkSpe < defSpe) return "def";
  return "tie";
}

