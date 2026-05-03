/**
 * 챔피언스 오버라이드 적용
 * dist/*.json 파일에 champions-overrides.json의 변경사항을 머지
 * 출력: dist/*.json (덮어쓰기) + dist/champions-meta.json
 */
import fs from 'fs';
import path from 'path';

const DIST = './dist';
const overrides = JSON.parse(fs.readFileSync('./data/champions-overrides.json', 'utf8'));

const pokemon = JSON.parse(fs.readFileSync(path.join(DIST, 'pokemon.json')));
const moves = JSON.parse(fs.readFileSync(path.join(DIST, 'moves.json')));
const abilities = JSON.parse(fs.readFileSync(path.join(DIST, 'abilities.json')));
const items = JSON.parse(fs.readFileSync(path.join(DIST, 'items.json')));

// ─────────────────────────────────────────────────
// 1. 신규 메가 4종 추가
// ─────────────────────────────────────────────────
const baseSpeciesAbility = {};
let newMegaCount = 0;
for (const [baseId, megaInfo] of Object.entries(overrides.newMegaEvolutions)) {
  if (baseId.startsWith('_')) continue;

  // baseId의 기존 메가가 있으면 갱신, 없으면 추가
  const newId = `${baseId}mega`;
  const existing = pokemon.findIndex(p => p.id === newId);
  const newPoke = {
    id: newId,
    name: megaInfo.name,
    koName: megaInfo.koName,
    base: pokemon.find(p => p.id === baseId)?.base || megaInfo.name.replace('-Mega', ''),
    forme: 'Mega',
    types: megaInfo.types,
    bs: megaInfo.baseStats,
    bst: Object.values(megaInfo.baseStats).reduce((s,v) => s+v, 0),
    ab: { '0': megaInfo.abilityName },
    wt: pokemon.find(p => p.id === baseId)?.wt || 100,
    mega: true,
    // req: 메가스톤 표시명 (id 변환 시 ItemById 키와 매칭)
    // 예: "Meganiumite" → toLowerCase().replace() → "meganiumite"
    req: megaInfo.stone.charAt(0).toUpperCase() + megaInfo.stone.slice(1)
  };

  if (existing >= 0) {
    pokemon[existing] = newPoke;
  } else {
    pokemon.push(newPoke);
    newMegaCount++;
  }
}

// ─────────────────────────────────────────────────
// 2. 신규 특성 4종 추가
// ─────────────────────────────────────────────────
let newAbilityCount = 0;
for (const [id, abInfo] of Object.entries(overrides.newAbilities)) {
  const existing = abilities.find(a => a.id === id);
  if (!existing) {
    abilities.push({
      id,
      name: abInfo.name,
      koName: abInfo.koName,
      desc: abInfo.shortDesc,
      _championsNew: true,
      _effects: abInfo.effects
    });
    newAbilityCount++;
  }
}

// ─────────────────────────────────────────────────
// 3. 신규 메가스톤 4종 추가
// ─────────────────────────────────────────────────
let newStoneCount = 0;
for (const [baseId, megaInfo] of Object.entries(overrides.newMegaEvolutions)) {
  if (baseId.startsWith('_')) continue;
  const stoneId = megaInfo.stone;
  const existing = items.find(i => i.id === stoneId);
  if (!existing) {
    const baseName = pokemon.find(p => p.id === baseId)?.name || megaInfo.name.replace('-Mega', '');
    items.push({
      id: stoneId,
      name: stoneId.charAt(0).toUpperCase() + stoneId.slice(1).replace('ite', 'ite'),
      koName: megaInfo.stoneKo,
      ms: { [baseName]: megaInfo.name },
      desc: `${baseName}을(를) ${megaInfo.name}로 메가진화시킨다.`,
      _championsNew: true
    });
    newStoneCount++;
  }
}

// ─────────────────────────────────────────────────
// 4. 기술 변경사항 적용
// ─────────────────────────────────────────────────
let moveChangeCount = 0;
for (const [moveId, changes] of Object.entries(overrides.moveChanges)) {
  if (moveId.startsWith('_')) continue;
  const move = moves.find(m => m.id === moveId);
  if (!move) continue;

  if (changes.basePower !== undefined) move.bp = changes.basePower;
  if (changes.accuracy !== undefined) move.acc = changes.accuracy;
  if (changes.type !== undefined) move.type = changes.type;
  if (changes.flags) {
    move.flags = { ...move.flags, ...changes.flags };
  }
  if (changes._note) move._championsNote = changes._note;
  moveChangeCount++;
}

// ─────────────────────────────────────────────────
// 5. 특성 변경사항 적용
// ─────────────────────────────────────────────────
let abilityChangeCount = 0;
for (const [abId, changes] of Object.entries(overrides.abilityChanges)) {
  const ab = abilities.find(a => a.id === abId);
  if (!ab) continue;
  if (changes._note) ab._championsNote = changes._note;
  if (changes.protectPiercingDamageMult !== undefined) {
    ab._protectPierceMult = changes.protectPiercingDamageMult;
  }
  abilityChangeCount++;
}

// ─────────────────────────────────────────────────
// 6. 도구 사용 가능/불가 마킹 (필터링은 UI에서)
// ─────────────────────────────────────────────────
let bannedItemCount = 0;
for (const itemId of Object.keys(overrides.itemsBanned)) {
  if (itemId.startsWith('_')) continue;
  const item = items.find(i => i.id === itemId);
  if (item) {
    item._championsBanned = true;
    bannedItemCount++;
  }
}

// ─────────────────────────────────────────────────
// 7. 포켓몬 기술 학습 변경사항 (메타데이터만, 실제 학습 리스트는 따로 관리)
// ─────────────────────────────────────────────────
const moveAccessChanges = {};
for (const [pokeId, changes] of Object.entries(overrides.moveAccessChanges)) {
  if (pokeId.startsWith('_')) continue;
  moveAccessChanges[pokeId] = changes;
}

// ─────────────────────────────────────────────────
// 저장
// ─────────────────────────────────────────────────
fs.writeFileSync(path.join(DIST, 'pokemon.json'), JSON.stringify(pokemon));
fs.writeFileSync(path.join(DIST, 'moves.json'), JSON.stringify(moves));
fs.writeFileSync(path.join(DIST, 'abilities.json'), JSON.stringify(abilities));
fs.writeFileSync(path.join(DIST, 'items.json'), JSON.stringify(items));
fs.writeFileSync(path.join(DIST, 'champions-meta.json'), JSON.stringify({
  statusChanges: overrides.statusChanges,
  moveAccessChanges,
  abilityChanges: overrides.abilityChanges,
  newAbilityIds: Object.keys(overrides.newAbilities),
  newMegaIds: Object.keys(overrides.newMegaEvolutions).filter(k => !k.startsWith('_')).map(k => `${k}mega`),
  itemsBanned: Object.keys(overrides.itemsBanned).filter(k => !k.startsWith('_'))
}));

console.log('✓ 챔피언스 오버라이드 적용 완료');
console.log(`  신규 메가:     ${newMegaCount}종 추가 (총 메가 ${pokemon.filter(p=>p.mega).length}종)`);
console.log(`  신규 특성:     ${newAbilityCount}개 추가`);
console.log(`  신규 메가스톤: ${newStoneCount}개 추가`);
console.log(`  기술 변경:     ${moveChangeCount}개 적용`);
console.log(`  특성 변경:     ${abilityChangeCount}개 적용`);
console.log(`  사용 불가 도구:${bannedItemCount}개 마킹`);

// 확인용
const newMegas = pokemon.filter(p => p.mega && (
  p.id === 'meganiummega' || p.id === 'feraligatrmega' ||
  p.id === 'excadrillmega' || p.id === 'scovillainmega'
));
console.log('\n신규 메가 확인:');
newMegas.forEach(p => {
  console.log(`  ${p.koName.padEnd(15)} ${p.types.join('/')} BST ${p.bst} 특성: ${Object.values(p.ab).join(', ')}`);
});
