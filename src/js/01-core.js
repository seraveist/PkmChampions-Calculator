/* ════════════════════════════════════════════════════════════
 * 01-core.js — 데이터 로드, helper, 타입 상성, 스탯, effective-*, STAB, 타입 효과
 * (build.mjs 가 src/js/*.js 를 알파벳순 concat 후 calc-template.html 에 주입)
 * ════════════════════════════════════════════════════════════ */

const POKEMON   = JSON.parse(document.getElementById('data-pokemon').textContent);
const MOVES     = JSON.parse(document.getElementById('data-moves').textContent);
const ABILITIES = JSON.parse(document.getElementById('data-abilities').textContent);
const ITEMS     = JSON.parse(document.getElementById('data-items').textContent);
const NATURE_DATA = JSON.parse(document.getElementById('data-natures')?.textContent || '[]');
const TYPE_CHART_DATA = JSON.parse(document.getElementById('data-typechart')?.textContent || '{}');
const RULES     = JSON.parse(document.getElementById('data-rules')?.textContent || '{}');
const META_THREATS = JSON.parse(document.getElementById('data-meta-threats')?.textContent || '{"defensiveThreats":[],"coverageChecks":[]}');

const PokemonById   = Object.fromEntries(POKEMON.map(p => [p.id, p]));
const MoveById      = Object.fromEntries(MOVES.map(m => [m.id, m]));
const AbilityById   = Object.fromEntries(ABILITIES.map(a => [a.id, a]));
const ItemById      = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// XSS 및 특수문자 방지 헬퍼
function escapeHTML(str) {
  if (!str) return '';
  return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


// 렌더링 부하 최소화 디바운싱
function debounce(func, delay = 200) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Game Freak rounds DOWN on .5
function pokeRound(n) {
  return n % 1 > 0.5 ? Math.ceil(n) : Math.floor(n);
}

// Q12.12 고정소수점 modifier 상수 (4096 = ×1.0).
// 게임 내 거의 모든 곱셈 보정은 이 단위를 거친다.
const MOD = {
  x0_1: 410,        // ×0.1   (총대장 한 단계)
  x0_25: 1024,      // ×0.25  (방어 관통 + 연격의태세 / 부자유친 보조타)
  x0_5: 2048,       // ×0.5   (반감, 화상)
  x0_67: 2732,      // ×2/3   (더블 배틀 스크린)
  x0_75: 3072,      // ×0.75  (재앙)
  x0_8: 3277,       // ×0.8   (Solid Rock / Filter / Prism Armor)
  x1_1: 4505,       // ×1.1   (근육띠, 박식안경)
  x1_1g: 4506,      // ×1.1015625 (펀치글러브 정확값)
  x1_2: 4915,       // ×1.2   (Aerilate-family, 플레이트, 1.2x 도구)
  x1_3: 5325,       // ×1.3   (Tough Claws, Life Orb, terrain 부스트)
  x1_5: 6144,       // ×1.5   (테크니션, STAB, 강한턱 등)
  x2_0: 8192,       // ×2.0   (Tera STAB, Adaptability)
  x2_25: 9216,      // ×2.25  (Tera + Adaptability)
};

// Modifier 체이닝 (Q12.12 fixed-point)
function chainMods(mods, lo = 410, hi = 131172) {
  let M = 4096;
  for (const mod of mods) {
    if (mod !== 4096) {
      M = (M * mod + 2048) >> 12;
    }
  }
  return Math.max(Math.min(M, hi), lo);
}

function OF16(n) { return n > 65535 ? n % 65536 : n; }
function OF32(n) { return n > 4294967295 ? n % 4294967296 : n; }

/* ════════════════════════════════════════════════════════════
   타입 상성표 (Gen 9 기준)
   ════════════════════════════════════════════════════════════ */
const FALLBACK_TYPE_CHART = {
  "Normal":   { "Rock": 0.5, "Ghost": 0, "Steel": 0.5 },
  "Fire":     { "Fire": 0.5, "Water": 0.5, "Grass": 2, "Ice": 2, "Bug": 2, "Rock": 0.5, "Dragon": 0.5, "Steel": 2 },
  "Water":    { "Fire": 2, "Water": 0.5, "Grass": 0.5, "Ground": 2, "Rock": 2, "Dragon": 0.5 },
  "Grass":    { "Fire": 0.5, "Water": 2, "Grass": 0.5, "Poison": 0.5, "Ground": 2, "Flying": 0.5, "Bug": 0.5, "Rock": 2, "Dragon": 0.5, "Steel": 0.5 },
  "Electric": { "Water": 2, "Grass": 0.5, "Electric": 0.5, "Ground": 0, "Flying": 2, "Dragon": 0.5 },
  "Ice":      { "Fire": 0.5, "Water": 0.5, "Grass": 2, "Ice": 0.5, "Ground": 2, "Flying": 2, "Dragon": 2, "Steel": 0.5 },
  "Fighting": { "Normal": 2, "Ice": 2, "Poison": 0.5, "Flying": 0.5, "Psychic": 0.5, "Bug": 0.5, "Rock": 2, "Ghost": 0, "Dark": 2, "Steel": 2, "Fairy": 0.5 },
  "Poison":   { "Grass": 2, "Poison": 0.5, "Ground": 0.5, "Rock": 0.5, "Ghost": 0.5, "Steel": 0, "Fairy": 2 },
  "Ground":   { "Fire": 2, "Grass": 0.5, "Electric": 2, "Poison": 2, "Flying": 0, "Bug": 0.5, "Rock": 2, "Steel": 2 },
  "Flying":   { "Grass": 2, "Electric": 0.5, "Fighting": 2, "Bug": 2, "Rock": 0.5, "Steel": 0.5 },
  "Psychic":  { "Fighting": 2, "Poison": 2, "Psychic": 0.5, "Dark": 0, "Steel": 0.5 },
  "Bug":      { "Fire": 0.5, "Grass": 2, "Fighting": 0.5, "Poison": 0.5, "Flying": 0.5, "Psychic": 2, "Ghost": 0.5, "Dark": 2, "Steel": 0.5, "Fairy": 0.5 },
  "Rock":     { "Fire": 2, "Ice": 2, "Fighting": 0.5, "Ground": 0.5, "Flying": 2, "Bug": 2, "Steel": 0.5 },
  "Ghost":    { "Normal": 0, "Psychic": 2, "Ghost": 2, "Dark": 0.5 },
  "Dragon":   { "Dragon": 2, "Steel": 0.5, "Fairy": 0 },
  "Dark":     { "Fighting": 0.5, "Psychic": 2, "Ghost": 2, "Dark": 0.5, "Fairy": 0.5 },
  "Steel":    { "Fire": 0.5, "Water": 0.5, "Electric": 0.5, "Ice": 2, "Rock": 2, "Steel": 0.5, "Fairy": 2 },
  "Fairy":    { "Fire": 0.5, "Fighting": 2, "Poison": 0.5, "Dragon": 2, "Dark": 2, "Steel": 0.5 },
  "Stellar":  {}  // 테라 스텔라는 기본 1배 (테라 스텔라 전용 처리)
};
const TYPE_CHART = Object.keys(TYPE_CHART_DATA).length ? TYPE_CHART_DATA : FALLBACK_TYPE_CHART;

function typeEff(atkType, defTypes) {
  let eff = 1;
  for (const t of defTypes) {
    if (!t) continue;
    const m = TYPE_CHART[atkType]?.[t];
    if (m !== undefined) eff *= m;
  }
  return eff;
}

function toId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 타입 한국어
const TYPE_KO = {
  Normal: '노말', Fire: '불꽃', Water: '물', Grass: '풀', Electric: '전기', Ice: '얼음',
  Fighting: '격투', Poison: '독', Ground: '땅', Flying: '비행', Psychic: '에스퍼', Bug: '벌레',
  Rock: '바위', Ghost: '고스트', Dragon: '드래곤', Dark: '악', Steel: '강철', Fairy: '페어리',
  Stellar: '스텔라'
};
const BATTLE_TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

/* ════════════════════════════════════════════════════════════
   스탯 계산 (챔피언스 룰)
   챔피언스: Lv 50, IV 없음, 능력 포인트 0~32/stat, 총 66점
   ════════════════════════════════════════════════════════════ */
const STATS = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_LABEL = { hp: "HP", atk: "공격", def: "방어", spa: "특공", spd: "특방", spe: "속도" };
const RANK_STATS = ["atk", "def", "spa", "spd", "spe"];

// 25성격 데이터 (id, 한국어명, 상승 스탯, 하락 스탯)
// id 'hardy' 같은 중성 성격은 up/down null
const FALLBACK_NATURES = [
  { id: 'hardy',   ko: '노력',     up: null,  down: null  },
  { id: 'lonely',  ko: '외로움',   up: 'atk', down: 'def' },
  { id: 'brave',   ko: '용감',     up: 'atk', down: 'spe' },
  { id: 'adamant', ko: '고집',     up: 'atk', down: 'spa' },
  { id: 'naughty', ko: '개구쟁이', up: 'atk', down: 'spd' },
  { id: 'bold',    ko: '대담',     up: 'def', down: 'atk' },
  { id: 'docile',  ko: '의젓',     up: null,  down: null  },
  { id: 'relaxed', ko: '무사태평', up: 'def', down: 'spe' },
  { id: 'impish',  ko: '장난꾸러기', up: 'def', down: 'spa' },
  { id: 'lax',     ko: '촐랑',     up: 'def', down: 'spd' },
  { id: 'timid',   ko: '겁쟁이',   up: 'spe', down: 'atk' },
  { id: 'hasty',   ko: '성급',     up: 'spe', down: 'def' },
  { id: 'serious', ko: '성실',     up: null,  down: null  },
  { id: 'jolly',   ko: '명랑',     up: 'spe', down: 'spa' },
  { id: 'naive',   ko: '천진난만', up: 'spe', down: 'spd' },
  { id: 'modest',  ko: '조심',     up: 'spa', down: 'atk' },
  { id: 'mild',    ko: '냉정',     up: 'spa', down: 'def' },
  { id: 'quiet',   ko: '조용',     up: 'spa', down: 'spe' },
  { id: 'bashful', ko: '수줍음',   up: null,  down: null  },
  { id: 'rash',    ko: '덜렁',     up: 'spa', down: 'spd' },
  { id: 'calm',    ko: '차분',     up: 'spd', down: 'atk' },
  { id: 'gentle',  ko: '얌전',     up: 'spd', down: 'def' },
  { id: 'sassy',   ko: '건방',     up: 'spd', down: 'spe' },
  { id: 'careful', ko: '신중',     up: 'spd', down: 'spa' },
  { id: 'quirky',  ko: '변덕',     up: null,  down: null  },
];
const NATURE_KO = Object.fromEntries(FALLBACK_NATURES.map(n => [n.id, n.ko]));
const NATURES = Array.isArray(NATURE_DATA) && NATURE_DATA.length
  ? NATURE_DATA.map(n => ({
      id: n.id,
      ko: NATURE_KO[n.id] || n.name,
      up: n.plus || n.up || null,
      down: n.minus || n.down || null,
    }))
  : FALLBACK_NATURES;
const NATURE_BY_ID = Object.fromEntries(NATURES.map(n => [n.id, n]));

function calcStats(side) {
  const p = PokemonById[side.pokemonIdx];
  if (!p) return { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 };
  const bs = p.bs;
  const out = {};
  // 성격 → up/down 추출
  const nature = side.nature ? NATURE_BY_ID[side.nature] : null;
  const natureUp = nature?.up || null;
  const natureDown = nature?.down || null;

  // 챔피언스 능력 포인트 시스템:
  //   본가 IV 31 고정 + 챔피언스 1pt = 본가 EV 8 (4가 아니라 8)
  //   따라서 본가 공식 적용 시 EV 부분에 (pt * 8) 대입
  //
  // HP: floor((2*base + 31 + floor(EV/4)) * Lv/100) + Lv + 10
  //   Lv 50, EV = pt * 8 → floor(EV/4) = pt * 2
  //   = floor((2*base + 31 + pt*2) * 0.5) + 60
  //
  // 다른 스탯: floor((2*base + 31 + floor(EV/4)) * Lv/100) + 5, ±10% 성격 보정
  //   = floor((2*base + 31 + pt*2) * 0.5) + 5

  const hpEv = side.evs.hp || 0;
  out.hp = Math.floor((2 * bs.hp + 31 + hpEv * 2) * 0.5) + 60;

  for (const s of RANK_STATS) {
    const ev = side.evs[s] || 0;
    let raw = Math.floor((2 * bs[s] + 31 + ev * 2) * 0.5) + 5;
    if (natureUp === s && natureDown !== s) raw = Math.floor(raw * 1.1);
    else if (natureDown === s && natureUp !== s) raw = Math.floor(raw * 0.9);
    out[s] = raw;
  }
  return out;
}

// 랭크 보정 (Gen 5+)
function applyBoost(stat, boost) {
  if (boost === 0) return stat;
  if (boost > 0) return Math.floor(stat * (2 + boost) / 2);
  return Math.floor(stat * 2 / (2 - boost));
}

/* ════════════════════════════════════════════════════════════
   실효 포켓몬 / 특성 / 타입 (메가진화 및 테라스탈 반영)
   ════════════════════════════════════════════════════════════ */
function isTeraEnabled() {
  return !RULES.teraDisabled;
}

function isTeraActive(side) {
  return isTeraEnabled() && !!side.tera;
}

function selectedTypes(side) {
  const p = PokemonById[side?.pokemonIdx];
  const source = Array.isArray(side?.types) && side.types.length ? side.types : p?.types;
  const types = [];
  for (const type of source || []) {
    if (BATTLE_TYPES.includes(type) && !types.includes(type)) types.push(type);
  }
  return types.length ? types.slice(0, 2) : (p?.types || []);
}

function effectiveTypes(side) {
  const p = PokemonById[side.pokemonIdx];
  if (!p) return [];
  // 테라스탈 활성 시 타입 변경 (테라 스텔라는 원래 타입 유지)
  if (isTeraActive(side) && side.teraType && side.teraType !== 'Stellar') {
    return [side.teraType];
  }
  return selectedTypes(side);
}

function originalTypes(side) {
  const p = PokemonById[side.pokemonIdx];
  return p ? selectedTypes(side) : [];
}

function effectiveAbility(side) {
  return side.ability;
}

function effectiveItem(side) {
  return side.item;
}

const NEUTRALIZING_GAS_EXEMPT_ABILITIES = ABILITIES.filter(a => a.gasExempt).map(a => a.id);
const MOLD_BREAKER_IGNORED_ABILITIES = ABILITIES.filter(a => a.moldBreakerIgnored).map(a => a.id);

function abilityData(id) {
  return AbilityById[id] || {};
}

function hasNeutralizingGas(atkSide, defSide) {
  return effectiveAbility(atkSide) === 'neutralizinggas' || effectiveAbility(defSide) === 'neutralizinggas';
}

function suppressAbilityForGas(ability, gasActive) {
  if (!gasActive) return ability;
  return NEUTRALIZING_GAS_EXEMPT_ABILITIES.includes(ability) ? ability : '';
}

function battleAbilityContext(atkSide, defSide) {
  const gasActive = hasNeutralizingGas(atkSide, defSide);
  return {
    gasActive,
    rawAtkAb: effectiveAbility(atkSide),
    rawDefAb: effectiveAbility(defSide),
    atkAb: suppressAbilityForGas(effectiveAbility(atkSide), gasActive),
    defAb: suppressAbilityForGas(effectiveAbility(defSide), gasActive),
  };
}

function effectiveBattleItem(side, ability = effectiveAbility(side)) {
  return abilityData(ability).suppressesItem ? '' : effectiveItem(side);
}

function effectiveWeather(field, atkAb = '', defAb = '') {
  return (abilityData(atkAb).suppressesWeather || abilityData(defAb).suppressesWeather)
    ? 'none'
    : field.weather;
}

function effectiveWeight(side, ability = effectiveAbility(side)) {
  const p = PokemonById[side.pokemonIdx];
  let weight = p?.weightkg || 1;
  const weightModifier = abilityData(ability).weightModifier;
  if (weightModifier === 'double') weight *= 2;
  if (weightModifier === 'half') weight = Math.max(0.1, Math.floor(weight * 5) / 10);
  return weight;
}

/* ════════════════════════════════════════════════════════════
   Grounded (땅에 있는지) 판정
   ════════════════════════════════════════════════════════════ */
function isGrounded(side, field, abilityOverride = null, itemOverride = null) {
  const types = effectiveTypes(side);
  const ab = abilityOverride ?? effectiveAbility(side);
  const item = itemOverride ?? effectiveBattleItem(side, ab);
  // 강제 Grounded 조건
  if (field.isGravity) return true;
  const itemData = ItemById[item] || {};
  if (itemData.grounded === true) return true;
  // Ungrounded
  if (types.includes('Flying')) return false;
  if (abilityData(ab).grounded === false) return false;
  if (itemData.grounded === false) return false;
  return true;
}

/* ════════════════════════════════════════════════════════════
   STAB Modifier (테라스탈 반영)
   ════════════════════════════════════════════════════════════ */
function getStabMod(side, moveType) {
  const ab = effectiveAbility(side);
  const abData = abilityData(ab);
  const origTypes = originalTypes(side);
  const isOriginal = origTypes.includes(moveType);
  const teraActive = isTeraActive(side);
  const isTera = teraActive && side.teraType === moveType;
  const isTeraStellar = teraActive && side.teraType === 'Stellar';

  // 리베로/프로틴: 사용 기술 타입으로 변환 → STAB 항상 발동
  // (Gen 9에서는 한 턴 1회 제한, 우리는 단발 계산이라 항상 발동 가정)
  const hasVolatileStab = !!abData.volatileStab;
  const hasAdaptability = abData.stabBoost === 'adaptability';

  // 테라 스텔라: 원래 타입이면 STAB 2.0×, 아니면 1.5× 부여
  if (isTeraStellar) {
    if (isOriginal) {
      return hasAdaptability ? 9216 : 8192;
    }
    return 6144;  // 1.5× (스텔라는 모든 타입에 STAB)
  }

  // 일반 테라스탈
  if (isTera && isOriginal) {
    // 원래 타입과 테라 타입이 같음 → 2.0× STAB (Adaptability: 2.25×)
    return hasAdaptability ? 9216 : 8192;
  }
  if (isTera || isOriginal || hasVolatileStab) {
    // 테라 타입이거나 원래 타입이면 1.5× (Adaptability: 원래 타입일 때만 2×)
    if (isOriginal && hasAdaptability) return 8192;
    return 6144;
  }
  return 4096;  // STAB 없음
}

/* ════════════════════════════════════════════════════════════
   타입 효과 계산 (특성·도구 포함)
   ════════════════════════════════════════════════════════════ */
function getMoveEffectiveness(move, moveType, atkSide, defSide, field, abilityCtx = null, itemCtx = null) {
  const defTypes = effectiveTypes(defSide);
  const ctx = abilityCtx || battleAbilityContext(atkSide, defSide);
  const atkAb = ctx.atkAb;
  const defAb = ctx.defAb;
  const defItem = itemCtx?.defItem ?? effectiveBattleItem(defSide, defAb);
  
  // Mold Breaker / Teravolt / Turboblaze: 방어측 일부 특성 무시
  const ignoresAbility = !!abilityData(atkAb).ignoresTargetAbility;
  
  // Freeze-Dry: 얼음 → 물 2배
  if (move.effectivenessKind === 'freezeDry' && defTypes.includes('Water')) {
    let eff = 2;
    for (const t of defTypes) {
      if (t === 'Water') continue;
      const m = TYPE_CHART[moveType]?.[t];
      if (m !== undefined) eff *= m;
    }
    return eff;
  }
  
  // Flying Press: 격투 + 비행 동시 계산
  if (move.effectivenessKind === 'flyingPress') {
    return typeEff('Fighting', defTypes) * typeEff('Flying', defTypes);
  }
  
  let eff = typeEff(moveType, defTypes);
  
  // 면역 특성 (Mold Breaker로 무시 가능)
  if (eff > 0 && !ignoresAbility) {
    for (const immunity of abilityData(defAb).immunities || []) {
      if (immunity.types?.includes(moveType) || (immunity.flag && move.flags?.[immunity.flag])) {
        eff = 0;
        break;
      }
    }
  }
  
  // 땅 면역: 비행 타입 / 풍선 / 부유 필드 제외
  if (moveType === 'Ground' && !field.isGravity) {
    if (ItemById[defItem]?.groundImmunity) eff = 0;
    if (defTypes.includes('Flying') && !isGrounded(defSide, field, defAb, defItem)) {
      // (이미 typeEff에서 반영됨)
    }
  }
  
  // 배짱 (Scrappy): 고스트에 노말/격투 기술 사용 가능
  if (eff === 0 && abilityData(atkAb).ignoreGhostImmunity && ['Normal','Fighting'].includes(moveType) && defTypes.includes('Ghost')) {
    // eff=0이 노말 vs 고스트 때문이었다면 상성표 재계산
    let e = 1;
    for (const t of defTypes) {
      if (t === 'Ghost' && ['Normal','Fighting'].includes(moveType)) continue;
      const m = TYPE_CHART[moveType]?.[t];
      if (m !== undefined) e *= m;
    }
    eff = e;
  }
  
  // Tera Shell: full HP target turns non-immune hits into not very effective.
  if (eff > 0 && abilityData(defAb).teraShell && defSide.fullHP) eff = 0.5;
  
  return eff;
}
