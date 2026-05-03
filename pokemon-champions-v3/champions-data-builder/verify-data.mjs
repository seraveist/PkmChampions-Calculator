/**
 * 생성된 데이터 검증: 주요 포켓몬/기술/특성/아이템이 정확히 들어갔는지 샘플 체크
 */
import fs from 'fs';

const pokemon = JSON.parse(fs.readFileSync('./data/pokemon.json'));
const moves = JSON.parse(fs.readFileSync('./data/moves.json'));
const abilities = JSON.parse(fs.readFileSync('./data/abilities.json'));
const items = JSON.parse(fs.readFileSync('./data/items.json'));

console.log('=== 데이터 검증 ===\n');

// 1. 챔피언스 핵심 포켓몬 체크
console.log('▶ 챔피언스 핵심 포켓몬');
const keyPokemon = ['incineroar', 'miraidon', 'koraidon', 'gholdengo', 'urshifu', 'urshifurapidstrike', 'calyrexshadow', 'calyrexice', 'ogerponwellspring'];
keyPokemon.forEach(id => {
  const p = pokemon.find(x => x.id === id);
  if (p) console.log(`  ✓ ${id.padEnd(25)} ${p.koName || p.name} (${p.types.join('/')}) HP ${p.baseStats.hp}/${p.baseStats.atk}/${p.baseStats.def}/${p.baseStats.spa}/${p.baseStats.spd}/${p.baseStats.spe}`);
  else console.log(`  ✗ ${id} 없음`);
});

// 2. 메가폼 체크
console.log('\n▶ 메가진화 포켓몬');
const megas = pokemon.filter(p => p.isMega).slice(0, 8);
megas.forEach(p => {
  console.log(`  ${p.name.padEnd(30)} ${p.koName} · ${p.types.join('/')} · 특성 ${Object.values(p.abilities).join('/')}`);
});

// 3. 주요 기술
console.log('\n▶ 주요 기술');
['knockoff', 'flareblitz', 'earthquake', 'spiritbreak', 'iciclespear', 'suckerpunch'].forEach(id => {
  const m = moves.find(x => x.id === id);
  if (m) console.log(`  ${m.name.padEnd(20)} ${m.type.padEnd(10)} ${m.category.padEnd(10)} 위력 ${m.basePower} 명중 ${m.accuracy} 우선도 ${m.priority} ${JSON.stringify(m.flags)}`);
});

// 4. 특성 샘플
console.log('\n▶ 주요 특성');
['intimidate', 'stamina', 'prankster', 'protean', 'parentalbond', 'toughclaws'].forEach(id => {
  const a = abilities.find(x => x.id === id);
  if (a) console.log(`  ${a.name.padEnd(20)} "${a.shortDesc}"`);
});

// 5. 메가스톤 아이템
console.log('\n▶ 메가스톤 아이템');
const stones = items.filter(i => i.megaStone).slice(0, 10);
stones.forEach(i => {
  console.log(`  ${i.name.padEnd(25)} → ${JSON.stringify(i.megaStone)}`);
});

// 6. 자뭉열매 확인
console.log('\n▶ 자뭉열매');
const sitrus = items.find(i => i.id === 'sitrusberry');
if (sitrus) console.log(`  ${sitrus.name} | ${sitrus.shortDesc}`);

console.log('\n=== 검증 완료 ===');
