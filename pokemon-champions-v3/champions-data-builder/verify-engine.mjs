/**
 * 계산 엔진 검증: HTML에서 JS 로직만 추출해서 Node에서 테스트
 */
import fs from 'fs';

const html = fs.readFileSync('./pokemon-champions-calculator-v3.html', 'utf8');

// JS 코드 추출
const scripts = [];
const re = /<script(?:\s+id="([^"]+)"[^>]*)?>([\s\S]*?)<\/script>/g;
let match;
while ((match = re.exec(html)) !== null) {
  scripts.push({ id: match[1], code: match[2] });
}

const dataPokemon = scripts.find(s => s.id === 'data-pokemon').code;
const dataMoves = scripts.find(s => s.id === 'data-moves').code;
const dataAbilities = scripts.find(s => s.id === 'data-abilities').code;
const dataItems = scripts.find(s => s.id === 'data-items').code;

const engineScript = scripts.find(s => !s.id);

// 가짜 document 환경
global.document = {
  getElementById: (id) => {
    if (id === 'data-pokemon') return { textContent: dataPokemon };
    if (id === 'data-moves') return { textContent: dataMoves };
    if (id === 'data-abilities') return { textContent: dataAbilities };
    if (id === 'data-items') return { textContent: dataItems };
    return { 
      textContent: '', innerHTML: '', classList: { add: () => {}, remove: () => {} },
      addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null,
      style: {}, dataset: {}
    };
  }
};

// engine을 별도 모듈로 평가하기 위해, return문 추가
const wrapped = `
${engineScript.code.replace(/^"use strict";\s*/, '')}
return {
  POKEMON, MOVES, ABILITIES, ITEMS,
  PokemonById, MoveById, AbilityById, ItemById,
  pokeRound, chainMods, applyMod, OF16, OF32,
  TYPE_CHART, typeEff, getMoveEffectiveness,
  calcStats, applyBoost, effectiveTypes, isGrounded,
  getStabMod, calculateDamage, hkoLabel, simulateKO,
  effectiveSpeed, firstMover,
  state, renderSide: () => {}, runCalc: () => {}
};
`;

const fn = new Function(wrapped);
const engine = fn();

const { calculateDamage, calcStats, PokemonById, MoveById, ItemById, pokeRound, chainMods, state } = engine;

// ─────────────────────────────────────────────────
// 테스트 케이스
// ─────────────────────────────────────────────────
console.log('═══════════════════════════════════════');
console.log('계산 엔진 검증');
console.log('═══════════════════════════════════════\n');

console.log('▶ 유틸리티 함수 검증');
console.log(`pokeRound(2.5) = ${pokeRound(2.5)} (기대: 2 — Game Freak 0.5 내림)`);
console.log(`pokeRound(2.51) = ${pokeRound(2.51)} (기대: 3)`);
console.log(`pokeRound(2.49) = ${pokeRound(2.49)} (기대: 2)`);
console.log(`chainMods([6144]) = ${chainMods([6144])} (기대: ~6144 — STAB 1.5×)`);
console.log(`chainMods([6144, 5324]) = ${chainMods([6144, 5324])} (기대: ~7986 — STAB × LO)`);
console.log();

// 테스트 1: 어흥염 플레어드라이브 vs 마릴리
console.log('▶ TEST 1: 어흥염 플레어드라이브 vs 마릴리');
const incin = PokemonById['incineroar'];
const azu = PokemonById['azumarill'];
console.log(`공격측: ${incin?.koName} (${incin?.types})`);
console.log(`방어측: ${azu?.koName} (${azu?.types})`);

const atkSide = {
  pokemonIdx: 'incineroar',
  evs: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
  natureUp: 'atk', natureDown: 'spa',
  ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: 'none', ability: 'intimidate', item: '',
  tera: false, teraType: 'Fire', pinch: false, fullHP: true, moves: []
};
const defSide = {
  pokemonIdx: 'azumarill',
  evs: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 },
  natureUp: 'def', natureDown: 'atk',
  ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: 'none', ability: 'thickfat', item: '',
  tera: false, teraType: 'Water', pinch: false, fullHP: true, moves: []
};
const field = {
  weather: 'none', terrain: 'none', gameType: 'Singles',
  isCritical: false, isTrickRoom: false, isGravity: false,
  defReflect: false, defLightScreen: false, atkHelpingHand: false
};

const flareBlitz = MoveById['flareblitz'];
const r1 = calculateDamage(atkSide, defSide, flareBlitz, field);
console.log(`기술: 플레어드라이브 (${flareBlitz.bp} BP, ${flareBlitz.cat})`);
console.log(`공격 실수치: ${r1.atk}, 방어 실수치: ${r1.def}, HP: ${r1.defHP}`);
console.log(`상성: ${r1.effectiveness}배`);
console.log(`대미지 16롤:`, r1.damages);
console.log(`최소~최대: ${r1.damages[0]}~${r1.damages[15]} (${r1.minPct.toFixed(1)}~${r1.maxPct.toFixed(1)}%)`);
console.log(`적용된 mod:`, r1.mods);
console.log(`두꺼운지방 마릴리 + 플레어드라이브: 반감 적용 확인`);
console.log();

// 테스트 2: 같은 케이스 + 두꺼운지방 비활성화 (다른 특성)
console.log('▶ TEST 2: 위 케이스 + 마릴리 특성 huge power로 변경 (방어 불꽃 반감 X)');
const defSide2 = { ...defSide, ability: 'hugepower' };
const r2 = calculateDamage(atkSide, defSide2, flareBlitz, field);
console.log(`최소~최대: ${r2.damages[0]}~${r2.damages[15]} (${r2.minPct.toFixed(1)}~${r2.maxPct.toFixed(1)}%)`);
console.log(`적용된 mod:`, r2.mods);
console.log();

// 테스트 3: 테라스탈 페어리 + 어흥염 깨물어부수기
console.log('▶ TEST 3: 어흥염 깨물어부수기 vs 테라 페어리 마릴리');
const knockOff = MoveById['crunch'];  // 깨물어부수기
const teraDef = { ...defSide, tera: true, teraType: 'Fairy' };
if (knockOff) {
  const r3 = calculateDamage(atkSide, teraDef, knockOff, field);
  console.log(`기술: 깨물어부수기 (${knockOff.bp} BP)`);
  console.log(`상성: ${r3.effectiveness}배 (페어리 vs 악 = 0.5×)`);
  console.log(`최소~최대: ${r3.damages[0]}~${r3.damages[15]} (${r3.minPct.toFixed(1)}~${r3.maxPct.toFixed(1)}%)`);
  console.log(`적용된 mod:`, r3.mods);
} else {
  console.log('crunch 데이터 없음');
}
console.log();

// 테스트 4: 테라스탈 STAB 2× 검증
console.log('▶ TEST 4: 테라 불꽃 어흥염 화염방사 vs 마릴리');
const flame = MoveById['flamethrower'];
const teraAtk = { ...atkSide, tera: true, teraType: 'Fire' };
if (flame) {
  const r4 = calculateDamage(teraAtk, defSide, flame, field);
  console.log(`기술: 화염방사 (${flame.bp} BP, ${flame.cat})`);
  console.log(`공격 실수치: ${r4.atk}, 방어 실수치: ${r4.def}`);
  console.log(`상성: ${r4.effectiveness}배 (불꽃 vs 물 = 0.5×)`);
  console.log(`최소~최대: ${r4.damages[0]}~${r4.damages[15]} (${r4.minPct.toFixed(1)}~${r4.maxPct.toFixed(1)}%)`);
  console.log(`적용된 mod:`, r4.mods);
  console.log(`> 테라 불꽃 + 원래 불꽃 = STAB 2× 확인`);
}
console.log();

// 테스트 5: 메가가디안 페어리스킨
console.log('▶ TEST 5: 메가가디안(페어리스킨) 이판사판태클 vs 마릴리');
const gardevoirMega = PokemonById['gardevoirmega'];
console.log(`메가가디안: ${gardevoirMega?.koName}, 종족값:`, gardevoirMega?.bs);
const dEdge = MoveById['doubleedge'];
if (gardevoirMega && dEdge) {
  const megaAtk = {
    ...atkSide,
    pokemonIdx: 'gardevoirmega',
    ability: 'pixilate',
    natureUp: 'spa',  // 특공 보정
    evs: { hp: 0, atk: 0, def: 0, spa: 32, spd: 2, spe: 32 }
  };
  const r5 = calculateDamage(megaAtk, defSide, dEdge, field);
  console.log(`기술: 이판사판태클 (${dEdge.bp} BP, ${dEdge.cat})`);
  console.log(`타입 변환: ${dEdge.type} → ${r5.moveType}`);
  console.log(`상성: ${r5.effectiveness}배 (페어리 vs 물/페어리 = 0.5×)`);
  console.log(`최소~최대: ${r5.damages[0]}~${r5.damages[15]} (${r5.minPct.toFixed(1)}~${r5.maxPct.toFixed(1)}%)`);
  console.log(`적용된 mod:`, r5.mods);
}
console.log();

// 테스트 6: Multi-hit 기술 (고드름침 5타)
console.log('▶ TEST 6: Multi-hit 검증 (고드름침)');
const iciSpear = MoveById['iciclespear'];
if (iciSpear) {
  console.log(`고드름침 multihit:`, iciSpear.mh);
  const buffAtk = {
    ...atkSide,
    pokemonIdx: 'baxcalibur',
    ability: 'thermalexchange',
    evs: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
    natureUp: 'atk', natureDown: 'spa'
  };
  const r6 = calculateDamage(buffAtk, defSide2, iciSpear, field);
  if (r6) {
    console.log(`raw damages (1타):`, r6.rawDamages);
    console.log(`다단 평균 hits:`, iciSpear.mh);
    console.log(`최종 16롤:`, r6.damages);
    console.log(`최소~최대: ${r6.damages[0]}~${r6.damages[15]} (${r6.minPct.toFixed(1)}~${r6.maxPct.toFixed(1)}%)`);
  }
}
console.log();

// 테스트 7: 자뭉열매 효과 검증
console.log('▶ TEST 7: 자뭉열매 효과 검증');
const r7 = calculateDamage(atkSide, defSide, flareBlitz, field);
const sitrusDef = { ...defSide, item: 'sitrusberry' };
const r7b = calculateDamage(atkSide, sitrusDef, flareBlitz, field);

import('./node_modules/@smogon/calc/dist/index.js').then(({ Generations, calculate, Pokemon, Move, Field }) => {
  console.log('자뭉 없을 때:', engine.hkoLabel(r7.damages, r7.defHP, defSide));
  console.log('자뭉 있을 때:', engine.hkoLabel(r7b.damages, r7b.defHP, sitrusDef));
}).catch(() => {
  console.log('자뭉 없을 때:', engine.hkoLabel(r7.damages, r7.defHP, defSide));
  console.log('자뭉 있을 때:', engine.hkoLabel(r7b.damages, r7b.defHP, sitrusDef));
});
