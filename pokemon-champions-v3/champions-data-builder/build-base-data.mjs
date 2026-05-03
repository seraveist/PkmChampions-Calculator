/**
 * 빌드 단계 1: @pkmn/dex에서 Gen 9 기본 데이터 추출
 * Gen 9 기본 + 메가진화(Past 표시된 것) 포함
 * 출력: data/raw-{pokemon,moves,abilities,items}.json
 */
import { Dex } from '@pkmn/dex';
import fs from 'fs';
import path from 'path';

const OUT_DIR = './data';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// 유효한 데이터인지 판별 - "Past"는 허용, "CAP"/"Future" 등은 제외
function isValidNonstandard(v) {
  if (!v) return true;
  return v === 'Past';  // 메가진화, 구세대 기술 등 챔피언스 복귀 가능성 있는 것
}

// ─────────────────────────────────────────────────────
// 1. 포켓몬 (메가·리전폼 포함)
// ─────────────────────────────────────────────────────
const pokemonData = [];
for (const species of Dex.species.all()) {
  if (!isValidNonstandard(species.isNonstandard)) continue;
  if (species.num <= 0) continue;  // Missingno 등 제외

  const forme = species.forme || '';
  const isMega = /^Mega/.test(forme);
  const isPrimal = /^Primal/.test(forme);
  const isGmax = /Gmax/.test(forme);

  // 챔피언스엔 G-Max 없음
  if (isGmax) continue;

  pokemonData.push({
    id: species.id,
    num: species.num,
    name: species.name,
    baseSpecies: species.baseSpecies || species.name,
    forme: forme || null,
    types: species.types,
    baseStats: species.baseStats,
    bst: species.bst,
    abilities: species.abilities,
    weightkg: species.weightkg,
    prevo: species.prevo || null,
    nfe: species.nfe,
    gen: species.gen,
    isMega,
    isPrimal,
    requiredItem: species.requiredItem || null
  });
}

// ─────────────────────────────────────────────────────
// 2. 기술
// ─────────────────────────────────────────────────────
const moveData = [];
for (const move of Dex.moves.all()) {
  if (!isValidNonstandard(move.isNonstandard)) continue;
  if (move.isZ || move.isMax) continue;
  if (move.num <= 0) continue;

  moveData.push({
    id: move.id,
    num: move.num,
    name: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy === true ? 0 : move.accuracy,  // true(무조건 명중) → 0으로 표기
    priority: move.priority,
    pp: move.pp,
    target: move.target,
    flags: move.flags || {},
    multihit: move.multihit || null,
    drain: move.drain || null,
    recoil: move.recoil || null,
    critRatio: move.critRatio || 1,
    secondary: move.secondary || null,
    shortDesc: move.shortDesc || '',
    desc: move.desc || ''
  });
}

// ─────────────────────────────────────────────────────
// 3. 특성
// ─────────────────────────────────────────────────────
const abilityData = [];
for (const ab of Dex.abilities.all()) {
  if (!isValidNonstandard(ab.isNonstandard)) continue;
  if (ab.num < 0) continue;  // 0은 '특성 없음'

  abilityData.push({
    id: ab.id,
    num: ab.num,
    name: ab.name,
    shortDesc: ab.shortDesc || '',
    desc: ab.desc || '',
    flags: ab.flags || {},
    gen: ab.gen
  });
}

// ─────────────────────────────────────────────────────
// 4. 아이템
// ─────────────────────────────────────────────────────
const itemData = [];
for (const item of Dex.items.all()) {
  if (!isValidNonstandard(item.isNonstandard)) continue;
  if (item.num <= 0) continue;

  itemData.push({
    id: item.id,
    num: item.num,
    name: item.name,
    shortDesc: item.shortDesc || item.desc || '',
    desc: item.desc || '',
    fling: item.fling || null,
    megaStone: item.megaStone || null,    // { "Charizard": "Charizard-Mega-Y" } 형태
    zMove: item.zMove || null,
    naturalGift: item.naturalGift || null,
    gen: item.gen,
    itemUser: item.itemUser || null
  });
}

// 저장
fs.writeFileSync(path.join(OUT_DIR, 'raw-pokemon.json'), JSON.stringify(pokemonData, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'raw-moves.json'), JSON.stringify(moveData, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'raw-abilities.json'), JSON.stringify(abilityData, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'raw-items.json'), JSON.stringify(itemData, null, 2));

const megaPokemon = pokemonData.filter(p => p.isMega);
const megaStones = itemData.filter(i => i.megaStone);

console.log('✓ 기본 데이터 추출 완료');
console.log(`  포켓몬: ${pokemonData.length}종 (메가 ${megaPokemon.length}종 포함)`);
console.log(`  기술:   ${moveData.length}개`);
console.log(`  특성:   ${abilityData.length}개`);
console.log(`  아이템: ${itemData.length}개 (메가스톤 ${megaStones.length}개 포함)`);
