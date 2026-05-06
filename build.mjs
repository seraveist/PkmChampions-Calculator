// Pokemon Champions 계산기 빌드 스크립트.
//
// 데이터 소스: 로컬 `data/` 폴더 (Pokemon Showdown 형식의 ts 파일).
// `data/` 가 base, `data/mods/champions/` 가 챔피언스 모드 오버라이드 (`inherit: true` 패턴).
//
// 절차:
//   1. base + mod 데이터를 vm으로 평가
//   2. inherit 병합 (applyModOverrides)
//   3. champions formats-data 기준으로 합법 포켓몬 필터링
//   4. isNonstandard: "Past" 필터로 금지 콘텐츠 제거
//   5. calc-template.html 의 placeholder 에 JSON 주입

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule, applyModOverrides } from './scripts/ts-loader.mjs';

// Windows 호환: file:// URL → 네이티브 경로 변환을 fileURLToPath 로 처리.
// (URL.pathname 만 사용하면 Windows 에서 'C:\C:\...' 처럼 드라이브가 중복된다)
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const CHAMP = path.join(DATA, 'mods', 'champions');

function readBase(file, exportName) {
  const mod = loadTsModule(path.join(DATA, file));
  return mod[exportName] || {};
}
function readChamp(file, exportName) {
  const fp = path.join(CHAMP, file);
  if (!fs.existsSync(fp)) return {};
  const mod = loadTsModule(fp);
  return mod[exportName] || {};
}

function isPast(entry) {
  return entry?.isNonstandard === 'Past' || entry?.isNonstandard === 'Future';
}
function isAvailable(entry) {
  // null, undefined, 'CAP' 등은 사용 가능. 'Past'/'Future' 만 차단.
  return !isPast(entry);
}

async function build() {
  console.log('🚀 Pokemon Champions 빌드 시작');
  console.log('📦 base 데이터 로드');
  const Pokedex = readBase('pokedex.ts', 'Pokedex');
  const Moves = readBase('moves.ts', 'Moves');
  const Abilities = readBase('abilities.ts', 'Abilities');
  const Items = readBase('items.ts', 'Items');
  const Learnsets = readBase('learnsets.ts', 'Learnsets');
  const TypeChart = readBase('typechart.ts', 'TypeChart');
  const Natures = readBase('natures.ts', 'Natures');
  const FormatsData = readBase('formats-data.ts', 'FormatsData');

  console.log('📚 텍스트 설명(text/) 로드');
  const textDir = path.join(DATA, 'text');
  const hasText = fs.existsSync(textDir);
  const MovesText = hasText ? loadTsModule(path.join(textDir, 'moves.ts')).MovesText || {} : {};
  const AbilitiesText = hasText ? loadTsModule(path.join(textDir, 'abilities.ts')).AbilitiesText || {} : {};
  const ItemsText = hasText ? loadTsModule(path.join(textDir, 'items.ts')).ItemsText || {} : {};
  if (!hasText) console.log('  (data/text/ 폴더가 없어 설명을 비웁니다)');

  console.log('🇰🇷 한국어 캐시(data/ko/) 로드');
  const koDir = path.join(DATA, 'ko');
  function readKoJson(name) {
    const fp = path.join(koDir, `${name}.json`);
    if (!fs.existsSync(fp)) return {};
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (e) { console.warn(`  ⚠️ ${fp} parse 실패:`, e.message); return {}; }
  }
  const koPokemon = readKoJson('pokemon');
  const koMoves = readKoJson('moves');
  const koAbilities = readKoJson('abilities');
  const koItems = readKoJson('items');
  console.log(`  포켓몬:${Object.keys(koPokemon).length} 기술:${Object.keys(koMoves).length} 특성:${Object.keys(koAbilities).length} 도구:${Object.keys(koItems).length}`);

  console.log('📦 champions 모드 오버라이드 로드');
  const champPokedex = readChamp('pokedex.ts', 'Pokedex'); // 보통 비어 있음
  const champMoves = readChamp('moves.ts', 'Moves');
  const champAbilities = readChamp('abilities.ts', 'Abilities');
  const champItems = readChamp('items.ts', 'Items');
  const champLearnsets = readChamp('learnsets.ts', 'Learnsets');
  const champFormatsData = readChamp('formats-data.ts', 'FormatsData');

  console.log('🔀 inherit 병합');
  const mergedPokedex = applyModOverrides(Pokedex, champPokedex);
  const mergedMoves = applyModOverrides(Moves, champMoves);
  const mergedAbilities = applyModOverrides(Abilities, champAbilities);
  const mergedItems = applyModOverrides(Items, champItems);
  const mergedLearnsets = applyModOverrides(Learnsets, champLearnsets);
  // formats-data 는 base 가 9세대 본가 기준이라 champions 쪽이 진실의 원천.
  // champions formats-data 에 명시된 항목만 사용한다.
  const mergedFormats = champFormatsData;

  // 설명 우선순위: 모드 오버라이드 → 베이스 text/ → 빈 문자열
  // text/ 항목엔 desc(긴 설명) 와 shortDesc(짧은 설명) 가 모두 존재. shortDesc 우선.
  function pickText(modEntry, textEntry) {
    return modEntry?.shortDesc || modEntry?.desc
      || textEntry?.shortDesc || textEntry?.desc
      || '';
  }
  function pickLongText(modEntry, textEntry) {
    return modEntry?.desc || textEntry?.desc
      || modEntry?.shortDesc || textEntry?.shortDesc
      || '';
  }

  console.log('⚙️ 챔피언스 필터링');

  // 합법 포켓몬: champions formats-data 에 등재되어 있고 tier 가 'Illegal' 이 아닌 항목
  const legalPokemonIds = new Set();
  for (const [id, fd] of Object.entries(mergedFormats)) {
    if (!fd) continue;
    if (fd.tier === 'Illegal') continue;
    if (isPast(fd)) continue;
    legalPokemonIds.add(id);
  }

  const finalPokemon = [];
  for (const id of legalPokemonIds) {
    const p = mergedPokedex[id];
    if (!p) continue;
    const fd = mergedFormats[id] || {};
    const ls = mergedLearnsets[id]?.learnset || mergedLearnsets[(p.baseSpecies || '').toLowerCase().replace(/[^a-z0-9]/g, '')]?.learnset;
    finalPokemon.push({
      id,
      name: p.name,
      koName: koPokemon[id] || p.name,
      base: p.baseSpecies,
      forme: p.forme,
      types: p.types,
      bs: p.baseStats,
      bst: Object.values(p.baseStats || {}).reduce((a, b) => a + b, 0),
      ab: p.abilities,
      weightkg: p.weightkg,
      mega: /^Mega/.test(p.forme || '') || undefined,
      primal: /^Primal/.test(p.forme || '') || undefined,
      tier: fd.tier,
      requiredItem: p.requiredItem,
      requiredMove: p.requiredMove,
      changesFrom: p.changesFrom,
      ls: ls ? Object.keys(ls) : undefined,
    });
  }

  // 기술: Status 또는 BP > 0 이면서 Past 가 아닌 것
  const finalMoves = [];
  for (const [id, m] of Object.entries(mergedMoves)) {
    if (!m || !m.name) continue;
    if (isPast(m)) continue;
    if (m.category === 'Status' || (typeof m.basePower === 'number' && m.basePower > 0) || m.category === 'Physical' || m.category === 'Special') {
      finalMoves.push({
        id,
        name: m.name,
        koName: koMoves[id] || m.name,
        type: m.type,
        cat: m.category,
        bp: m.basePower,
        acc: m.accuracy === true ? 0 : m.accuracy,
        pri: m.priority,
        flags: m.flags || {},
        mh: m.multihit || undefined,
        target: m.target,
        desc: pickText(m, MovesText[id]),
        descLong: pickLongText(m, MovesText[id]),
      });
    }
  }

  // 특성: Past 가 아닌 것
  const finalAbilities = [];
  for (const [id, a] of Object.entries(mergedAbilities)) {
    if (!a || !a.name) continue;
    if (isPast(a)) continue;
    finalAbilities.push({
      id,
      name: a.name,
      koName: koAbilities[id] || a.name,
      rating: typeof a.rating === 'number' ? a.rating : undefined,
      desc: pickText(a, AbilitiesText[id]),
      descLong: pickLongText(a, AbilitiesText[id]),
    });
  }

  // 아이템: Past 가 아닌 것
  const finalItems = [];
  for (const [id, it] of Object.entries(mergedItems)) {
    if (!it || !it.name) continue;
    if (isPast(it)) continue;
    finalItems.push({
      id,
      name: it.name,
      koName: koItems[id] || it.name,
      ms: it.megaStone || undefined,
      itemUser: it.itemUser || undefined,
      isBerry: it.isBerry || undefined,
      isChoice: it.isChoice || undefined,
      isGem: it.isGem || undefined,
      isPrimalOrb: it.isPrimalOrb || undefined,
      flingBp: it.fling?.basePower || undefined,
      naturalGift: it.naturalGift || undefined,
      desc: pickText(it, ItemsText[id]),
      descLong: pickLongText(it, ItemsText[id]),
    });
  }

  // 성격
  const finalNatures = Object.entries(Natures).map(([id, n]) => ({
    id, name: n.name, plus: n.plus, minus: n.minus,
  }));

  // 타입 상성: damageTaken 코드 (0=neutral, 1=resist, 2=immune, 3=weak) → 배율로 변환된 맵
  // 키는 공격 타입 이름(PascalCase), 값은 맵.
  const finalTypeChart = {};
  for (const [defType, info] of Object.entries(TypeChart)) {
    const row = {};
    for (const [atkType, code] of Object.entries(info.damageTaken || {})) {
      // Pokemon Showdown 표기:
      //   0: 일반 (1x)
      //   1: 반감 (0.5x)
      //   2: 면역 (0x)
      //   3: 효과적 (2x)
      // 우리는 atkType 이 대문자 시작인 경우만 (상태이상/날씨 키워드 제외)
      if (/^[A-Z]/.test(atkType)) {
        row[atkType] = code;
      }
    }
    finalTypeChart[defType] = row;
  }

  // 챔피언스 룰/공식 상수 (data/mods/champions/scripts.ts 분석 결과)
  const champRules = {
    level: 50,
    statHpAdd: 75,
    statOtherAdd: 20,
    pccap: 20,
    multihitDistribution25: [2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,5,5,5],
    spreadModifierDoubles: 0.75,
    spreadModifierFreeForAll: 0.5,
    parChance: 1/8,
    teraDisabled: true,
  };

  console.log(`  포켓몬: ${finalPokemon.length}`);
  console.log(`  기술: ${finalMoves.length}`);
  console.log(`  특성: ${finalAbilities.length}`);
  console.log(`  아이템: ${finalItems.length}`);
  console.log(`  성격: ${finalNatures.length}`);

  console.log('🏗️ HTML 주입');
  const templatePath = path.join(ROOT, 'src', 'calc-template.html');
  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);
  const template = fs.readFileSync(templatePath, 'utf8');

  // 분할된 src/styles/*.css, src/js/*.js 를 알파벳순으로 concat 한다.
  // 파일명 접두사(01-, 02-, ...)가 곧 의존성 순서를 결정하므로 Array.sort() 면 충분.
  function concatDir(dir, ext) {
    if (!fs.existsSync(dir)) return '';
    const files = fs.readdirSync(dir).filter(f => f.endsWith(ext) && !f.startsWith('.')).sort();
    return files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n\n');
  }
  const inlineCss = concatDir(path.join(ROOT, 'src', 'styles'), '.css');
  const inlineJs = concatDir(path.join(ROOT, 'src', 'js'), '.js');
  console.log(`  styles: ${inlineCss.length} bytes, js: ${inlineJs.length} bytes`);

  const replacements = {
    '/* __INLINE_CSS__ */': inlineCss,
    '// __INLINE_JS__': inlineJs,
    '__POKEMON_DATA__': JSON.stringify(finalPokemon),
    '__MOVES_DATA__': JSON.stringify(finalMoves),
    '__ABILITIES_DATA__': JSON.stringify(finalAbilities),
    '__ITEMS_DATA__': JSON.stringify(finalItems),
    '__NATURES_DATA__': JSON.stringify(finalNatures),
    '__TYPECHART_DATA__': JSON.stringify(finalTypeChart),
    '__CHAMP_RULES__': JSON.stringify(champRules),
  };

  let outHTML = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (outHTML.includes(placeholder)) {
      outHTML = outHTML.split(placeholder).join(value);
    }
  }

  const outPath = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
  fs.writeFileSync(outPath, outHTML);
  console.log(`🎉 빌드 성공: ${outPath} (${(outHTML.length / 1024).toFixed(1)} KB)`);
}

build().catch((err) => {
  console.error('❌ 빌드 실패:', err);
  process.exit(1);
});
