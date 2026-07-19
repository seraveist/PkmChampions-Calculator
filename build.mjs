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
const OVERRIDES = path.join(DATA, 'overrides');

const UNOFFICIAL_NONSTANDARD = new Set(['CAP', 'Custom']);
const ROTOM_LEARNSET_FORM_IDS = new Set(['rotomheat', 'rotomwash', 'rotomfrost', 'rotomfan', 'rotommow']);

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
function isUnofficial(entry) {
  return UNOFFICIAL_NONSTANDARD.has(entry?.isNonstandard);
}
function readJsonFile(fp, fallback = {}) {
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { console.warn(`  ⚠️ ${fp} parse 실패:`, e.message); return fallback; }
}
function normalizeFilterList(raw, kind) {
  return new Set(Array.isArray(raw?.[kind]) ? raw[kind].filter(Boolean) : []);
}
function readDataFilters() {
  const raw = readJsonFile(path.join(OVERRIDES, 'filters.json'), {});
  const kinds = ['pokemon', 'moves', 'abilities', 'items'];
  return {
    exclude: Object.fromEntries(kinds.map(kind => [kind, normalizeFilterList(raw.exclude, kind)])),
    include: Object.fromEntries(kinds.map(kind => [kind, normalizeFilterList(raw.include, kind)])),
  };
}
function isAvailable(entry, kind, id, filters) {
  if (filters?.include?.[kind]?.has(id)) return !isPast(entry);
  if (filters?.exclude?.[kind]?.has(id)) return false;
  return !isPast(entry) && !isUnofficial(entry);
}
function toId(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function battleOnlyBaseIds(pokemon) {
  const value = pokemon?.battleOnly;
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map(toId).filter(Boolean);
}
function normalizeFormGroups(raw) {
  const groups = [];
  for (const [mode, modeGroups] of Object.entries(raw || {})) {
    if (mode.startsWith('_') || !modeGroups || typeof modeGroups !== 'object') continue;
    for (const [key, group] of Object.entries(modeGroups)) {
      const forms = Array.isArray(group?.forms) ? group.forms.map(toId).filter(Boolean) : [];
      if (!forms.length) continue;
      groups.push({
        key: toId(key),
        mode,
        label: group.label || '폼',
        trigger: group.trigger || '',
        forms: [...new Set(forms)],
      });
    }
  }
  return groups;
}
function formGroupMaps(groups) {
  const byForm = new Map();
  for (const group of groups) {
    for (const formId of group.forms) byForm.set(formId, group);
  }
  return { byForm };
}
function moveMechanicFlags(id, move, moveMechanics) {
  const flags = { ...(moveMechanics[id] || {}) };
  if ((move.damage || move.ohko) && flags.fixedDamageKind) delete flags.fixedDamageKind;
  return flags;
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
  function readKoJsonRaw(name) {
    const fp = path.join(koDir, `${name}.json`);
    if (!fs.existsSync(fp)) return {};
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (e) { console.warn(`  ⚠️ ${fp} parse 실패:`, e.message); return {}; }
  }
  // 수동 번역 파일 (사용자 편집). 메타 키(_README, _NOTE 등) 와 빈 문자열은 무시.
  function readManualKo(name) {
    const raw = readKoJsonRaw(`${name}.manual`);
    const clean = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue;
      if (v && typeof v === 'string' && v.trim()) clean[k] = v;
    }
    return clean;
  }
  // manual > auto 우선. PokéAPI 자동값이 있어도 사용자가 보정한 수동값을 마지막에 덮어쓴다.
  // (Object spread 는 뒤쪽이 이김 → ...auto 먼저, ...manual 나중)
  function loadKo(name) {
    return { ...readKoJsonRaw(name), ...readManualKo(name) };
  }
  const koPokemon = loadKo('pokemon');
  const koMoves = loadKo('moves');
  const koAbilities = loadKo('abilities');
  const koItems = loadKo('items');
  // 설명 (PokéAPI flavor text 한국어 — 최신 게임 버전 우선)
  const koDescMoves = loadKo('desc-moves');
  const koDescAbilities = loadKo('desc-abilities');
  const koDescItems = loadKo('desc-items');
  // 진단 출력 (auto / manual 분리 표시)
  function manualCount(name) { return Object.keys(readManualKo(name)).length; }
  const m1 = manualCount('pokemon'), m2 = manualCount('moves'), m3 = manualCount('abilities'), m4 = manualCount('items');
  const d1 = manualCount('desc-moves'), d2 = manualCount('desc-abilities'), d3 = manualCount('desc-items');
  const fmt = (auto, manual) => manual > 0 ? `${auto}+${manual}` : `${auto}`;
  console.log(`  이름  포켓몬:${fmt(Object.keys(readKoJsonRaw('pokemon')).length, m1)} 기술:${fmt(Object.keys(readKoJsonRaw('moves')).length, m2)} 특성:${fmt(Object.keys(readKoJsonRaw('abilities')).length, m3)} 도구:${fmt(Object.keys(readKoJsonRaw('items')).length, m4)}`);
  console.log(`  설명  기술:${fmt(Object.keys(readKoJsonRaw('desc-moves')).length, d1)} 특성:${fmt(Object.keys(readKoJsonRaw('desc-abilities')).length, d2)} 도구:${fmt(Object.keys(readKoJsonRaw('desc-items')).length, d3)}`);
  if (m1+m2+m3+m4+d1+d2+d3 > 0) console.log(`  (형식: 자동+수동, 수동 우선 적용)`);

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
  const dataFilters = readDataFilters();
  const formGroups = normalizeFormGroups(readJsonFile(path.join(OVERRIDES, 'form-groups.json'), {}));
  const { byForm: formGroupByForm } = formGroupMaps(formGroups);
  const moveMechanics = readJsonFile(path.join(OVERRIDES, 'move-mechanics.json'), {});
  const itemMechanics = readJsonFile(path.join(OVERRIDES, 'item-mechanics.json'), {});
  const abilityMechanics = readJsonFile(path.join(OVERRIDES, 'ability-mechanics.json'), {});
  const fieldMechanics = readJsonFile(path.join(OVERRIDES, 'field-mechanics.json'), {});
  const entryEffects = readJsonFile(path.join(OVERRIDES, 'entry-effects.json'), { effects: {}, blockers: {} });
  const metaThreats = readJsonFile(path.join(OVERRIDES, 'meta-threats.json'), { defensiveThreats: [], coverageChecks: [] });
  const pokemonSpriteOverrides = readJsonFile(path.join(OVERRIDES, 'pokemon-sprites.json'), { spriteIds: {} });
  const pokemonSpriteIds = pokemonSpriteOverrides.spriteIds || {};

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
    if (!isAvailable(fd, 'pokemon', id, dataFilters)) continue;
    legalPokemonIds.add(id);
  }
  const battleOnlyBaseById = new Map();
  for (const [id, fd] of Object.entries(mergedFormats)) {
    if (legalPokemonIds.has(id)) continue;
    if (dataFilters?.exclude?.pokemon?.has(id)) continue;
    if (!fd || fd.tier === 'Illegal' || isUnofficial(fd)) continue;
    const p = mergedPokedex[id];
    if (!p?.name) continue;
    const legalBaseId = battleOnlyBaseIds(p).find(baseId => legalPokemonIds.has(baseId));
    if (!legalBaseId) continue;
    legalPokemonIds.add(id);
    battleOnlyBaseById.set(id, legalBaseId);
  }
  const formGroupBaseById = new Map();
  for (const group of formGroups) {
    const legalBaseId = group.forms.find(formId => legalPokemonIds.has(formId));
    if (!legalBaseId) continue;
    for (const formId of group.forms) {
      if (legalPokemonIds.has(formId)) continue;
      if (dataFilters?.exclude?.pokemon?.has(formId)) continue;
      const p = mergedPokedex[formId];
      if (!p?.name || isUnofficial(p)) continue;
      legalPokemonIds.add(formId);
      formGroupBaseById.set(formId, legalBaseId);
    }
  }

  const finalPokemon = [];
  for (const id of Object.keys(mergedPokedex).filter(id => legalPokemonIds.has(id))) {
    const p = mergedPokedex[id];
    if (!p) continue;
    const fd = mergedFormats[id] || {};
    const inheritedBaseId = battleOnlyBaseById.get(id) || formGroupBaseById.get(id);
    const inheritedFd = inheritedBaseId ? (mergedFormats[inheritedBaseId] || {}) : {};
    const battleOnlyLearnsetId = battleOnlyBaseIds(p)[0];
    const ownLearnset = mergedLearnsets[id]?.learnset;
    const fallbackLearnset = mergedLearnsets[battleOnlyLearnsetId]?.learnset
      || mergedLearnsets[toId(p.baseSpecies)]?.learnset;
    const rotomBaseLearnset = ROTOM_LEARNSET_FORM_IDS.has(id) ? mergedLearnsets.rotom?.learnset : undefined;
    const ls = rotomBaseLearnset
      ? { ...rotomBaseLearnset, ...(ownLearnset || {}) }
      : (ownLearnset || fallbackLearnset);
    const learnset = ls ? Object.keys(ls).filter(moveId => isAvailable(mergedMoves[moveId], 'moves', moveId, dataFilters)) : undefined;
    const formGroup = formGroupByForm.get(id);
    const spriteId = Number(pokemonSpriteIds[id] || p.num || 0) || undefined;
    const baseSpriteId = Number(p.num || 0) || undefined;
    finalPokemon.push({
      id,
      num: p.num,
      spriteId,
      spriteFallbackId: spriteId && baseSpriteId && spriteId !== baseSpriteId ? baseSpriteId : undefined,
      name: p.name,
      koName: koPokemon[id] || p.name,
      base: p.baseSpecies,
      baseForme: p.baseForme,
      forme: p.forme,
      types: p.types,
      bs: p.baseStats,
      bst: Object.values(p.baseStats || {}).reduce((a, b) => a + b, 0),
      ab: p.abilities,
      weightkg: p.weightkg,
      mega: /^Mega/.test(p.forme || '') || undefined,
      primal: /^Primal/.test(p.forme || '') || undefined,
      tier: fd.tier || inheritedFd.tier,
      requiredItem: p.requiredItem,
      requiredAbility: p.requiredAbility,
      requiredMove: p.requiredMove,
      battleOnly: p.battleOnly,
      changesFrom: p.changesFrom,
      ...(formGroup ? {
        formGroup: formGroup.key,
        formGroupMode: formGroup.mode,
        formGroupLabel: formGroup.label,
        formGroupTrigger: formGroup.trigger,
        formGroupForms: formGroup.forms,
      } : {}),
      ls: learnset,
    });
  }

  // 기술: Status 또는 BP > 0 이면서 Past 가 아닌 것
  const finalMoves = [];
  for (const [id, m] of Object.entries(mergedMoves)) {
    if (!m || !m.name) continue;
    if (!isAvailable(m, 'moves', id, dataFilters)) continue;
    if (m.category === 'Status' || (typeof m.basePower === 'number' && m.basePower > 0) || m.category === 'Physical' || m.category === 'Special') {
      const enShort = pickText(m, MovesText[id]);
      const enLong = pickLongText(m, MovesText[id]);
      const ko = koDescMoves[id];
      const mechanicFlags = moveMechanicFlags(id, m, moveMechanics);
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
        sec: (m.secondary || m.secondaries) ? true : undefined,
        recoil: m.recoil || undefined,
        damage: m.damage || undefined,
        ohko: m.ohko || undefined,
        willCrit: m.willCrit || undefined,
        fixedDamageKind: mechanicFlags.fixedDamageKind,
        breaksProtect: m.breaksProtect || undefined,
        hasCrashDamage: m.hasCrashDamage || undefined,
        ...mechanicFlags,
        overrideOffensiveStat: m.overrideOffensiveStat || undefined,
        overrideDefensiveStat: m.overrideDefensiveStat || undefined,
        overrideOffensivePokemon: m.overrideOffensivePokemon || undefined,
        overrideDefensivePokemon: m.overrideDefensivePokemon || undefined,
        ignoreOffensive: m.ignoreOffensive || undefined,
        ignoreDefensive: m.ignoreDefensive || undefined,
        ignoreNegativeOffensive: m.ignoreNegativeOffensive || undefined,
        ignorePositiveDefensive: m.ignorePositiveDefensive || undefined,
        target: m.target,
        tgt: m.target,
        // 한글 우선 (없으면 영문 short). descLong 은 항상 영문 long 보존 → 모달에서 한글+영문 함께 표시.
        desc: ko || enShort,
        descLong: ko ? enLong : (enLong !== enShort ? enLong : ''),
      });
    }
  }

  // 특성: Past 가 아닌 것
  const finalAbilities = [];
  for (const [id, a] of Object.entries(mergedAbilities)) {
    if (!a || !a.name) continue;
    if (!isAvailable(a, 'abilities', id, dataFilters)) continue;
    const enShort = pickText(a, AbilitiesText[id]);
    const enLong = pickLongText(a, AbilitiesText[id]);
    const ko = koDescAbilities[id];
    const mechanics = abilityMechanics[id] || {};
    finalAbilities.push({
      id,
      name: a.name,
      koName: koAbilities[id] || a.name,
      rating: typeof a.rating === 'number' ? a.rating : undefined,
      ...mechanics,
      desc: ko || enShort,
      descLong: ko ? enLong : (enLong !== enShort ? enLong : ''),
    });
  }

  // 아이템: Past 가 아닌 것
  const finalItems = [];
  for (const [id, it] of Object.entries(mergedItems)) {
    if (!it || !it.name) continue;
    if (!isAvailable(it, 'items', id, dataFilters)) continue;
    const enShort = pickText(it, ItemsText[id]);
    const enLong = pickLongText(it, ItemsText[id]);
    const ko = koDescItems[id];
    const mechanics = itemMechanics[id] || {};
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
      typeBoostType: mechanics.typeBoostType || it.onPlate || undefined,
      powerBoostKind: mechanics.powerBoostKind || undefined,
      powerBoostMod: mechanics.powerBoostMod || undefined,
      speciesTypeBoost: mechanics.speciesTypeBoost || undefined,
      attackStatBoost: mechanics.attackStatBoost || undefined,
      defenseStatBoost: mechanics.defenseStatBoost || undefined,
      finalDamageBoost: mechanics.finalDamageBoost || undefined,
      paradoxActivation: mechanics.paradoxActivation || undefined,
      multiHitModifier: mechanics.multiHitModifier || undefined,
      koSurvival: mechanics.koSurvival || undefined,
      hpRecovery: mechanics.hpRecovery || undefined,
      residualRecovery: mechanics.residualRecovery || undefined,
      speedStatBoost: mechanics.speedStatBoost || undefined,
      grounded: mechanics.grounded,
      groundImmunity: mechanics.groundImmunity || undefined,
      ignoresWeatherDamageModifiers: mechanics.ignoresWeatherDamageModifiers || undefined,
      resistBerryType: mechanics.resistBerryType || undefined,
      resistBerryRequiresWeakness: mechanics.resistBerryRequiresWeakness,
      desc: ko || enShort,
      descLong: ko ? enLong : (enLong !== enShort ? enLong : ''),
    });
  }

  // 성격
  const finalNatures = Object.entries(Natures).map(([id, n]) => ({
    id, name: n.name, plus: n.plus, minus: n.minus,
  }));

  // 타입 상성: damageTaken 코드 (0=neutral, 1=resist, 2=immune, 3=weak) → 배율로 변환된 맵
  // 키는 공격 타입 이름(PascalCase), 값은 맵.
  const finalTypeChart = {};
  const typeCodeToMult = { 0: 1, 1: 2, 2: 0.5, 3: 0 };
  for (const [defType, info] of Object.entries(TypeChart)) {
    const defTypeName = defType.charAt(0).toUpperCase() + defType.slice(1);
    for (const [atkType, code] of Object.entries(info.damageTaken || {})) {
      // Pokemon Showdown 표기:
      //   0: 일반 (1x)
      //   1: 반감 (0.5x)
      //   2: 면역 (0x)
      //   3: 효과적 (2x)
      // 우리는 atkType 이 대문자 시작인 경우만 (상태이상/날씨 키워드 제외)
      if (/^[A-Z]/.test(atkType)) {
        const mult = typeCodeToMult[code] ?? 1;
        if (mult !== 1) {
          finalTypeChart[atkType] ||= {};
          finalTypeChart[atkType][defTypeName] = mult;
        }
      }
    }
  }
  finalTypeChart.Stellar ||= {};

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
    fieldMechanics,
    entryEffects: entryEffects.effects || {},
    entryEffectBlockers: entryEffects.blockers || {},
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
  // CSS 는 페이지 단위 이전을 지원하도록 명시적인 cascade layer 로 감싼다.
  // legacy layer 는 현재 파일 간 우선순위를 그대로 보존하며, 이전이 끝나면 제거한다.
  function concatDir(dir, ext) {
    if (!fs.existsSync(dir)) return '';
    const files = fs.readdirSync(dir).filter(f => f.endsWith(ext) && !f.startsWith('.')).sort();
    return files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n\n');
  }
  const CSS_LAYER_ORDER = [
    'reset',
    'tokens',
    'base',
    'legacy-pages',
    'legacy-foundation',
    'components',
    'layouts',
    'pages',
    'utilities',
    'themes',
    'legacy-polish',
  ];
  const CSS_LEGACY_LAYERS = new Map([
    ['02-pages.css', 'base'],
    ['04-ui-foundation.css', 'legacy-foundation'],
    ['06-dex-redesign.css', 'pages'],
    ['07-tools-redesign.css', 'pages'],
    ['08-theme-bridge.css', 'themes'],
    ['09-product-polish.css', 'legacy-polish'],
  ]);
  function listFilesRecursive(dir, ext, relativeDir = '') {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.'))
      .flatMap(entry => {
        const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          return listFilesRecursive(path.join(dir, entry.name), ext, relativePath);
        }
        return entry.isFile() && entry.name.endsWith(ext) ? [relativePath] : [];
      })
      .sort((a, b) => a.localeCompare(b));
  }
  function styleLayerFor(relativePath) {
    if (relativePath === '00-tokens.css') return 'tokens';
    if (relativePath === '01-reset.css') return 'reset';
    if (relativePath === '02-base.css') return 'base';
    if (relativePath.startsWith('components/')) return 'components';
    if (relativePath.startsWith('layouts/')) return 'layouts';
    if (relativePath.startsWith('pages/')) return 'pages';
    if (relativePath === 'utilities.css') return 'utilities';
    if (relativePath === 'themes.css') return 'themes';
    return CSS_LEGACY_LAYERS.get(relativePath) || 'legacy-polish';
  }
  function concatStyles(dir) {
    const files = listFilesRecursive(dir, '.css');
    const prelude = `@layer ${CSS_LAYER_ORDER.join(', ')};`;
    const layeredFiles = files.map(relativePath => {
      const layer = styleLayerFor(relativePath);
      const source = fs.readFileSync(path.join(dir, ...relativePath.split('/')), 'utf8');
      return `@layer ${layer} {\n${source}\n}`;
    });
    return [prelude, ...layeredFiles].join('\n\n');
  }
  function compactCssForInline(source) {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n');
  }
  function reverseWorkerSource(jsDir) {
    const workerFiles = [
      '01-core.js',
      '02-engine.js',
      '03-10-calc-state.js',
      '04-40-revcalc-state.js',
      '04-41-revcalc-scoring.js',
      '04-42-revcalc-candidates.js',
    ];
    const workerBody = workerFiles
      .map(file => fs.readFileSync(path.join(jsDir, file), 'utf8'))
      .join('\n\n');
    return `
function createReverseAnalyzer(dataScripts) {
  const document = {
    getElementById(id) {
      const value = dataScripts[id];
      return value === undefined ? null : { textContent: JSON.stringify(value) };
    },
  };
  ${workerBody}
  return function analyzeReverseState(snapshot) {
    Object.assign(revCalcState, cloneCalcValue(snapshot));
    return rcAnalyzeCached();
  };
}

let reverseAnalyze = null;
self.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'init') {
    try {
      reverseAnalyze = createReverseAnalyzer(message.dataScripts || {});
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', id: message.id, message: error?.message || String(error) });
    }
    return;
  }
  if (message.type !== 'analyze') return;
  try {
    if (!reverseAnalyze) throw new Error('역계산 Worker가 초기화되지 않았습니다.');
    const result = reverseAnalyze(message.state || {});
    self.postMessage({ type: 'result', id: message.id, result });
  } catch (error) {
    self.postMessage({ type: 'error', id: message.id, message: error?.message || String(error) });
  }
};
`;
  }

  const styleSource = concatStyles(path.join(ROOT, 'src', 'styles'));
  const inlineCss = compactCssForInline(styleSource);
  const jsDir = path.join(ROOT, 'src', 'js');
  const inlineJs = concatDir(jsDir, '.js');
  const reverseWorker = JSON.stringify(reverseWorkerSource(jsDir)).replace(/</g, '\\u003c');
  console.log(`  styles: ${styleSource.length} -> ${inlineCss.length} bytes, js: ${inlineJs.length} bytes`);

  const replacements = {
    '/* __INLINE_CSS__ */': inlineCss,
    '// __INLINE_JS__': inlineJs,
    '__REVERSE_WORKER_SOURCE__': reverseWorker,
    '__POKEMON_DATA__': JSON.stringify(finalPokemon),
    '__MOVES_DATA__': JSON.stringify(finalMoves),
    '__ABILITIES_DATA__': JSON.stringify(finalAbilities),
    '__ITEMS_DATA__': JSON.stringify(finalItems),
    '__NATURES_DATA__': JSON.stringify(finalNatures),
    '__TYPECHART_DATA__': JSON.stringify(finalTypeChart),
    '__CHAMP_RULES__': JSON.stringify(champRules),
    '__META_THREATS_DATA__': JSON.stringify(metaThreats),
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
