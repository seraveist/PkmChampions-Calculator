/**
 * 오버라이드 적용 검증: 신규 메가, 신규 특성, 기술 변경, 트리거 아이템
 */
import fs from 'fs';

const html = fs.readFileSync('./pokemon-champions-calculator-v3.html', 'utf8');
const re = /<script(?:\s+id="([^"]+)"[^>]*)?>([\s\S]*?)<\/script>/g;
const scripts = [];
let m;
while ((m = re.exec(html)) !== null) scripts.push({ id: m[1], code: m[2] });

const dataPokemon = scripts.find(s => s.id === 'data-pokemon').code;
const dataMoves = scripts.find(s => s.id === 'data-moves').code;
const dataAbilities = scripts.find(s => s.id === 'data-abilities').code;
const dataItems = scripts.find(s => s.id === 'data-items').code;
const engineScript = scripts.find(s => !s.id);

global.document = {
  getElementById: (id) => {
    if (id === 'data-pokemon') return { textContent: dataPokemon };
    if (id === 'data-moves') return { textContent: dataMoves };
    if (id === 'data-abilities') return { textContent: dataAbilities };
    if (id === 'data-items') return { textContent: dataItems };
    return {
      textContent: '', innerHTML: '',
      classList: { add: ()=>{}, remove: ()=>{} },
      addEventListener: ()=>{}, querySelectorAll: ()=>[], querySelector: ()=>null,
      style: {}, dataset: {}, checked: false, value: '',
      insertAdjacentHTML: ()=>{}
    };
  }
};

const wrapped = `
${engineScript.code.replace(/^"use strict";\s*/, '')}
return { POKEMON, MOVES, ABILITIES, ITEMS, PokemonById, MoveById, AbilityById, ItemById,
  pokeRound, chainMods, calcStats, calculateDamage, hkoLabel, simulateKO,
  effectiveSpeed, effectiveAbility, effectiveItem };
`;

const engine = (new Function(wrapped))();
const { calculateDamage, hkoLabel, PokemonById, MoveById, ItemById, AbilityById } = engine;

console.log('═══════════════════════════════════════');
console.log('챔피언스 오버라이드 검증');
console.log('═══════════════════════════════════════\n');

// ─── 1. 신규 메가 4종 데이터 확인 ───
console.log('▶ 신규 메가 4종 데이터');
['meganiummega', 'feraligatrmega', 'excadrillmega', 'scovillainmega'].forEach(id => {
  const p = PokemonById[id];
  if (p) {
    console.log(`  ✓ ${p.koName.padEnd(15)} ${p.types.join('/').padEnd(15)} BST ${p.bst} 특성 ${Object.values(p.ab).join(',')}`);
  } else {
    console.log(`  ✗ ${id} 없음`);
  }
});
console.log();

// ─── 2. 신규 특성 4종 ───
console.log('▶ 신규 특성 4종');
['megasol', 'dragonize', 'piercingdrill', 'spicyspray'].forEach(id => {
  const a = AbilityById[id];
  if (a) console.log(`  ✓ ${a.koName.padEnd(20)} - ${a.desc.slice(0, 50)}`);
  else console.log(`  ✗ ${id} 없음`);
});
console.log();

// ─── 3. 신규 메가스톤 ───
console.log('▶ 신규 메가스톤');
['meganiumite', 'feraligatrite', 'excadrillite', 'scovillainite'].forEach(id => {
  const i = ItemById[id];
  if (i) console.log(`  ✓ ${i.koName.padEnd(20)} ${i._championsNew ? '[신규]' : ''}`);
  else console.log(`  ✗ ${id} 없음`);
});
console.log();

// ─── 4. 기술 변경 적용 확인 ───
console.log('▶ 기술 변경사항');
[
  ['hurricane', '폭풍', { bp: 120 }],
  ['psyshock', '사이코쇼크', { bp: 90 }],
  ['iciclecrash', '고드름떨구기', { bp: 120 }],
  ['lavaplume', '분연', { bp: 90 }],
  ['shadowclaw', '섀도크루', { flags: { slicing: true } }]
].forEach(([id, ko, expected]) => {
  const m = MoveById[id];
  if (!m) { console.log(`  ✗ ${id} 없음`); return; }
  let pass = true;
  if (expected.bp && m.bp !== expected.bp) pass = false;
  if (expected.flags?.slicing && !m.flags?.slicing) pass = false;
  console.log(`  ${pass ? '✓' : '✗'} ${ko}: bp ${m.bp}${m.flags?.slicing ? ', slicing' : ''}`);
});
console.log();

// ─── 5. 사용 불가 도구 ───
console.log('▶ 챔피언스 사용 불가 도구');
['lifeorb', 'rockyhelmet', 'weaknesspolicy', 'powerherb'].forEach(id => {
  const i = ItemById[id];
  if (i) console.log(`  ${i._championsBanned ? '✓' : '✗'} ${i.koName} _championsBanned=${i._championsBanned}`);
});
console.log();

// ─── 6. 신규 특성 실제 작동 테스트 ───
console.log('▶ TEST: 메가장크로다일(드래고나이즈) 이판사판태클 vs 한카리아스');
const feralAtk = {
  pokemonIdx: 'feraligatrmega',
  evs: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
  natureUp: 'atk', natureDown: 'spa',
  ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: 'none', ability: 'dragonize', item: '',
  tera: false, teraType: 'Water', pinch: false, fullHP: true, moves: []
};
const garchompDef = {
  pokemonIdx: 'garchomp',
  evs: { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 },
  natureUp: 'def', natureDown: 'atk',
  ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: 'none', ability: 'roughskin', item: '',
  tera: false, teraType: 'Dragon', pinch: false, fullHP: true, moves: []
};
const field = {
  weather: 'none', terrain: 'none', gameType: 'Singles',
  isCritical: false, isTrickRoom: false, isGravity: false,
  defReflect: false, defLightScreen: false, atkHelpingHand: false, defProtect: false
};

const dEdge = MoveById['doubleedge'];
if (dEdge) {
  const r = calculateDamage(feralAtk, garchompDef, dEdge, field);
  console.log(`  기본 타입: ${dEdge.type} → 실제 타입: ${r.moveType}`);
  console.log(`  상성: ${r.effectiveness}배 (드래곤 vs 드래곤/땅)`);
  console.log(`  대미지: ${r.damages[0]}~${r.damages[15]} (${r.minPct.toFixed(1)}~${r.maxPct.toFixed(1)}%)`);
  console.log(`  적용 mod:`, r.mods);
  const dragonized = r.moveType === 'Dragon';
  const has2x = r.effectiveness === 2;
  console.log(`  ${dragonized ? '✓' : '✗'} 노말→드래곤 변환`);
  console.log(`  ${has2x ? '✓' : '✗'} 드래곤 vs 드래곤/땅 = 2배`);
}
console.log();

// ─── 7. 메가솔 (메가메가니움) 화염방사 테스트 ───
console.log('▶ TEST: 메가메가니움(메가솔) 화염방사 vs 한카리아스 (날씨 없음에서도 쾌청 효과)');
const meganAtk = {
  ...feralAtk,
  pokemonIdx: 'meganiummega',
  ability: 'megasol',
  natureUp: 'spa', natureDown: 'atk',
  evs: { hp: 0, atk: 0, def: 0, spa: 32, spd: 2, spe: 32 }
};
const fThrower = MoveById['flamethrower'];
if (fThrower) {
  const rNoSun = calculateDamage(meganAtk, garchompDef, fThrower, field);
  const noSunVal = rNoSun.damages[15];

  // 비교: 일반 포켓몬 (메가솔 X) 같은 스탯
  const noMegSol = { ...meganAtk, ability: 'overgrow' };
  const rNoSol = calculateDamage(noMegSol, garchompDef, fThrower, field);

  console.log(`  메가솔 어흥염 화염방사: ${rNoSun.damages[0]}~${noSunVal}`);
  console.log(`  적용 mod:`, rNoSun.mods);
  console.log(`  일반 특성 비교: ${rNoSol.damages[0]}~${rNoSol.damages[15]}`);

  if (rNoSun.mods.some(s => s.includes('메가솔'))) console.log('  ✓ 메가솔 ×1.5 불꽃 적용됨');
  else console.log('  ✗ 메가솔 미적용');
}
console.log();

// ─── 8. 피어싱드릴 + 방어 ───
console.log('▶ TEST: 메가몰드비스트(피어싱드릴) 지진 vs 한카리아스 (방어 중)');
const excAtk = {
  ...feralAtk,
  pokemonIdx: 'excadrillmega',
  ability: 'piercingdrill',
  natureUp: 'atk', natureDown: 'spa'
};
const earthquake = MoveById['earthquake'];
const fieldProtect = { ...field, defProtect: true };
if (earthquake) {
  const rNormal = calculateDamage(excAtk, garchompDef, earthquake, field);
  const rProtect = calculateDamage(excAtk, garchompDef, earthquake, fieldProtect);
  console.log(`  방어 없음: ${rNormal.damages[0]}~${rNormal.damages[15]}`);
  console.log(`  방어 있음: ${rProtect.damages[0]}~${rProtect.damages[15]}`);
  console.log(`  적용 mod (방어):`, rProtect.mods);
  // 피어싱드릴이면 0.25배 대미지
  if (rProtect.damages[15] > 0 && rProtect.mods.some(s => s.includes('피어싱드릴'))) {
    console.log('  ✓ 피어싱드릴 방어 관통 ×0.25 적용');
  }
}
console.log();

// ─── 9. 기합의띠 ───
console.log('▶ TEST: 기합의띠 (HP 풀, 1타 받을 때 HP 1 잔여)');
const fragile = {
  pokemonIdx: 'gengar',
  evs: { hp: 0, atk: 0, def: 0, spa: 32, spd: 2, spe: 32 },
  natureUp: 'spa', natureDown: 'atk',
  ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: 'none', ability: 'cursedbody', item: 'focussash',
  tera: false, teraType: 'Ghost', pinch: false, fullHP: true, moves: []
};
const heavyHit = {
  pokemonIdx: 'incineroar',
  evs: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
  natureUp: 'atk', natureDown: 'spa',
  ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: 'none', ability: 'intimidate', item: '',
  tera: false, teraType: 'Fire', pinch: false, fullHP: true, moves: []
};
const flareBlitz = MoveById['flareblitz'];
const r9 = calculateDamage(heavyHit, fragile, flareBlitz, field);
console.log(`  대미지: ${r9.damages[0]}~${r9.damages[15]} (HP ${r9.defHP})`);
console.log(`  hkoLabel:`, hkoLabel(r9.damages, r9.defHP, fragile));
console.log();

// ─── 10. 기술 학습 변경 ───
console.log('▶ 어흥염 탁쳐서떨구기 박탈 메타 확인');
// 우리는 학습 리스트를 따로 관리하지 않으므로 champions-meta.json에서 확인
const meta = JSON.parse(fs.readFileSync('./dist/champions-meta.json', 'utf8'));
console.log('  champions-meta.json에서:');
console.log('   ', JSON.stringify(meta.moveAccessChanges.incineroar, null, 2).split('\n').join('\n    '));

console.log('\n═══ 검증 완료 ═══');
