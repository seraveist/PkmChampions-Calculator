/**
 * 빌드 단계 2: 한국어 이름 매핑
 */
import fs from 'fs';
import path from 'path';
import pokemon from 'pokemon';

const OUT_DIR = './data';

// ─────────────────────────────────────────────────────
// 특수 포켓몬 수동 매핑 (특수문자 문제)
// ─────────────────────────────────────────────────────
const MANUAL_POKEMON_KO = {
  'Nidoran-F': '니드런♀',
  'Nidoran-M': '니드런♂',
  'Farfetch\u2019d': '파오리',
  'Farfetch\u2019d': '파오리',
  'Flabebe': '플라베베',
  'Sirfetch\u2019d': '창파나이트',
  'Farfetchd': '파오리',
  'Sirfetchd': '창파나이트'
};

// 폼별 한국어 매핑
const FORME_KO = {
  'Alola': '알로라',
  'Galar': '가라르',
  'Hisui': '히스이',
  'Paldea': '팔데아',
  'Paldea-Combat': '팔데아 컴뱃종',
  'Paldea-Blaze': '팔데아 블레이즈종',
  'Paldea-Aqua': '팔데아 아쿠아종',
  'Therian': '영수폼',
  'Incarnate': '화신폼',
  'Origin': '기원폼',
  'Altered': '어나더폼',
  'Sky': '스카이폼',
  'Heat': '히트',
  'Wash': '워시',
  'Frost': '프로스트',
  'Fan': '스핀',
  'Mow': '커터',
  'Crowned': '왕관',
  'Dusk-Mane': '황혼의갈기',
  'Dawn-Wings': '새벽의날개',
  'Ice': '백마',
  'Shadow': '흑마',
  'Ice-Rider': '백마폼',
  'Shadow-Rider': '흑마폼',
  'Hero': '마스코드',
  'Teal': '벽록마스크',
  'Wellspring': '우물마스크',
  'Hearthflame': '화덕마스크',
  'Cornerstone': '초석마스크',
  'Blade': '블레이드폼',
  'Shield': '실드폼',
  '10%': '10%폼',
  '50%': '50%폼',
  'Complete': '퍼펙트폼',
  'Zen': '달마모드',
  'Unbound': '해방폼',
  'Pirouette': '스텝폼',
  'Aria': '보이스폼',
  'School': '무리폼',
  'Solo': '단독폼',
  'Low-Key': '로우키폼',
  'Amped': '하이폼',
  'Rapid-Strike': '연격의태세',
  'Single-Strike': '일격의태세',
  'Gorging': '꿀꺽꿀꺽폼',
  'Gulping': '한입꺽폼'
};

function formeToKo(forme) {
  if (!forme) return '';
  return FORME_KO[forme] || forme;
}

// 포켓몬 매핑
const rawPokemon = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'raw-pokemon.json')));
let mappedCount = 0, unmappedCount = 0;
const unmappedList = [];

const pokemonWithKo = rawPokemon.map(p => {
  const baseName = p.baseSpecies;
  let baseKo = null;

  // 수동 매핑 먼저
  if (MANUAL_POKEMON_KO[baseName]) {
    baseKo = MANUAL_POKEMON_KO[baseName];
  } else {
    // 특수문자 제거 버전으로도 시도
    const cleanName = baseName.replace(/[\u2019'é]/g, c => {
      if (c === '\u2019' || c === "'") return '';
      if (c === 'é') return 'e';
      return c;
    });
    if (MANUAL_POKEMON_KO[cleanName]) {
      baseKo = MANUAL_POKEMON_KO[cleanName];
    } else {
      try {
        const id = pokemon.getId(baseName, 'en');
        if (id) baseKo = pokemon.getName(id, 'ko');
      } catch (e) {
        // 실패
      }
    }
  }

  let koName = baseKo;
  if (baseKo && p.forme) {
    if (p.isMega) {
      if (p.forme === 'Mega-X') koName = `메가${baseKo}X`;
      else if (p.forme === 'Mega-Y') koName = `메가${baseKo}Y`;
      else koName = `메가${baseKo}`;
    } else if (p.isPrimal) {
      koName = `원시${baseKo}`;
    } else {
      const suffix = formeToKo(p.forme);
      koName = `${baseKo}(${suffix})`;
    }
  }

  if (koName) mappedCount++;
  else {
    unmappedCount++;
    unmappedList.push(p.name);
  }
  return { ...p, koName };
});

fs.writeFileSync(path.join(OUT_DIR, 'pokemon.json'), JSON.stringify(pokemonWithKo, null, 2));
console.log(`✓ 포켓몬 한국어 매핑: ${mappedCount}/${pokemonWithKo.length} (미매핑 ${unmappedCount})`);
if (unmappedList.length) {
  console.log(`  미매핑: ${unmappedList.join(', ')}`);
}

// 샘플 출력
console.log(`\n샘플 매핑 결과:`);
const samples = ['incineroar', 'miraidon', 'charizardmegay', 'urshifu', 'urshifurapidstrike', 'calyrexshadow', 'zaciancrowned'];
samples.forEach(id => {
  const p = pokemonWithKo.find(x => x.id === id);
  if (p) console.log(`  ${p.name.padEnd(30)} → ${p.koName}`);
});
