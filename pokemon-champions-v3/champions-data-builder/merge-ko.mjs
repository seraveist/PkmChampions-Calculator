/**
 * 빌드 단계 4: 한국어 이름과 원본 데이터 병합
 * ko-names.json이 있으면 raw-*.json에 koName 필드 추가해 최종 파일 생성
 */
import fs from 'fs';
import path from 'path';

const OUT_DIR = './data';

// ko-names.json 로드
let koNames = { moves: {}, abilities: {}, items: {} };
const koPath = path.join(OUT_DIR, 'ko-names.json');
if (fs.existsSync(koPath)) {
  koNames = JSON.parse(fs.readFileSync(koPath));
} else {
  console.log('⚠️  ko-names.json 없음. 한국어 이름 없이 저장됩니다.');
  console.log('   브라우저에서 fetch-ko-browser.html을 실행하면 생성됩니다.');
}

// 기술 병합
const rawMoves = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'raw-moves.json')));
const moves = rawMoves.map(m => ({ ...m, koName: koNames.moves[m.id] || null }));
fs.writeFileSync(path.join(OUT_DIR, 'moves.json'), JSON.stringify(moves, null, 2));

// 특성 병합
const rawAb = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'raw-abilities.json')));
const abilities = rawAb.map(a => ({ ...a, koName: koNames.abilities[a.id] || null }));
fs.writeFileSync(path.join(OUT_DIR, 'abilities.json'), JSON.stringify(abilities, null, 2));

// 아이템 병합
const rawItems = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'raw-items.json')));
const items = rawItems.map(i => ({ ...i, koName: koNames.items[i.id] || null }));
fs.writeFileSync(path.join(OUT_DIR, 'items.json'), JSON.stringify(items, null, 2));

const movesKo = moves.filter(m => m.koName).length;
const abilitiesKo = abilities.filter(a => a.koName).length;
const itemsKo = items.filter(i => i.koName).length;

console.log('✓ 데이터 병합 완료');
console.log(`  기술:   ${moves.length}개 (한국어 ${movesKo})`);
console.log(`  특성:   ${abilities.length}개 (한국어 ${abilitiesKo})`);
console.log(`  아이템: ${items.length}개 (한국어 ${itemsKo})`);
