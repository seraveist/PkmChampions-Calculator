// scripts/fetch-ko.mjs
//
// PokéAPI 의 공개 CSV (raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv)
// 에서 한국어 이름을 일괄 수집해 data/ko/*.json 캐시 파일로 저장한다.
//
// 사용법:
//   node scripts/fetch-ko.mjs            # 4 카테고리 모두
//
// 캐시 파일은 git 에 커밋되어, build.mjs 가 koName 으로 매핑한다.
// PokéAPI REST 엔드포인트는 일부 환경에서 차단될 수 있어, CSV 직접 다운로드 방식을 사용.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsModule, applyModOverrides } from './ts-loader.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const KO_DIR = path.join(DATA, 'ko');
const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const KO_LANG_ID = '3';  // PokéAPI languages.csv 에서 ko=3

// PS id ↔ identifier 정규화
function psNorm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

// CSV 파서 — RFC 4180 기준. 따옴표 안의 콤마/줄바꿈 처리, "" 이스케이프 처리.
// flavor text 류는 한 셀이 여러 줄에 걸치므로 line-split 우선 방식으로는 안 된다.
function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQ = false;
  // 첫 row 는 header 로 사용
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip CR */ }
      else field += c;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const header = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === '') continue;
    const obj = {};
    header.forEach((h, j) => { obj[h] = r[j] ?? ''; });
    out.push(obj);
  }
  return out;
}

// 다중 라인 flavor text 를 단일 줄로 정리: 줄바꿈 → 공백, 연속 공백 압축.
function cleanFlavor(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// version_groups.csv 에서 id → order 맵을 만든다.
// flavor text 여러 버전 중 가장 최신 (order 큰) 것을 고르기 위해.
let _versionOrderCache = null;
async function getVersionOrder() {
  if (_versionOrderCache) return _versionOrderCache;
  const rows = parseCsv(await fetchText(`${CSV_BASE}/version_groups.csv`));
  _versionOrderCache = new Map(rows.map(r => [r.id, parseInt(r.order, 10) || 0]));
  return _versionOrderCache;
}

// 한 카테고리의 flavor text(한국어) 를 PS id 키로 매핑해서 반환.
// opts: { tableCsv, flavorCsv, idColumn (e.g. 'ability_id'/'move_id'/'item_id') }
async function fetchKoFlavor(targetIds, opts) {
  console.log(`   ${opts.tableCsv} ...`);
  const items = parseCsv(await fetchText(`${CSV_BASE}/${opts.tableCsv}`));
  console.log(`   ${opts.flavorCsv} ...`);
  const flavors = parseCsv(await fetchText(`${CSV_BASE}/${opts.flavorCsv}`));

  const idToIdent = new Map(items.map(r => [r.id, r.identifier]));
  const versionOrder = await getVersionOrder();

  // {pokeapi_id} → { latestOrder, flavor_text }
  const bestPerId = new Map();
  for (const r of flavors) {
    if (r.language_id !== KO_LANG_ID) continue;
    const id = r[opts.idColumn];
    if (!id) continue;
    const ord = versionOrder.get(r.version_group_id) ?? 0;
    const cur = bestPerId.get(id);
    if (!cur || ord > cur.order) {
      bestPerId.set(id, { order: ord, text: r.flavor_text });
    }
  }

  // identifier → flavor 맵으로 변환 (정규화된 키)
  const koByPsId = new Map();
  for (const [pokeId, { text }] of bestPerId) {
    const ident = idToIdent.get(pokeId);
    if (!ident) continue;
    koByPsId.set(psNorm(ident), cleanFlavor(text));
  }
  console.log(`   PokéAPI 한국어 flavor ${koByPsId.size}개 (최신 버전 우선)`);

  // 우리 ID 와 매칭
  const cache = {};
  const missing = [];
  for (const id of targetIds) {
    const flavor = koByPsId.get(psNorm(id));
    if (flavor) cache[id] = flavor;
    else missing.push(id);
  }
  return { cache, missing };
}

// === 카테고리별 fetcher ===

// 포켓몬: pokemon_species + pokemon_forms (메가/지역폼) 합치기
async function fetchKoPokemon(targetIds) {
  console.log('   pokemon_species.csv ...');
  const species = parseCsv(await fetchText(`${CSV_BASE}/pokemon_species.csv`));        // id, identifier
  console.log('   pokemon_species_names.csv ...');
  const speciesNames = parseCsv(await fetchText(`${CSV_BASE}/pokemon_species_names.csv`));
  console.log('   pokemon_forms.csv ...');
  const forms = parseCsv(await fetchText(`${CSV_BASE}/pokemon_forms.csv`));            // id, identifier
  console.log('   pokemon_form_names.csv ...');
  const formNames = parseCsv(await fetchText(`${CSV_BASE}/pokemon_form_names.csv`));

  // PS_id → ko_name 매핑 빌드
  const koByPsId = new Map();

  // 1) 종 (base species)
  const speciesIdToIdent = new Map(species.map(r => [r.id, r.identifier]));
  for (const r of speciesNames) {
    if (r.local_language_id !== KO_LANG_ID) continue;
    const ident = speciesIdToIdent.get(r.pokemon_species_id);
    if (!ident) continue;
    koByPsId.set(psNorm(ident), r.name);
  }
  // 2) 폼 (메가/지역폼 등)
  const formIdToIdent = new Map(forms.map(r => [r.id, r.identifier]));
  for (const r of formNames) {
    if (r.local_language_id !== KO_LANG_ID) continue;
    const ident = formIdToIdent.get(r.pokemon_form_id);
    if (!ident) continue;
    if (r.form_name) koByPsId.set(psNorm(ident), r.form_name);
  }
  console.log(`   PokéAPI 한국어 이름 ${koByPsId.size}개 매핑됨 (종 + 폼)`);

  // 우리 ID 와 매칭
  const cache = {};
  const missing = [];
  for (const id of targetIds) {
    const ko = koByPsId.get(psNorm(id));
    if (ko) cache[id] = ko;
    else missing.push(id);
  }
  return { cache, missing };
}

// 일반 카테고리: <table>.csv (id, identifier) + <table>_names.csv (id, lang, name)
async function fetchKoSimple(targetIds, opts) {
  console.log(`   ${opts.tableCsv} ...`);
  const items = parseCsv(await fetchText(`${CSV_BASE}/${opts.tableCsv}`));
  console.log(`   ${opts.namesCsv} ...`);
  const names = parseCsv(await fetchText(`${CSV_BASE}/${opts.namesCsv}`));

  const idToIdent = new Map(items.map(r => [r.id, r.identifier]));
  const koByPsId = new Map();
  for (const r of names) {
    if (r.local_language_id !== KO_LANG_ID) continue;
    const idCol = r[opts.idColumn];
    const ident = idToIdent.get(idCol);
    if (!ident) continue;
    koByPsId.set(psNorm(ident), r.name);
  }
  console.log(`   PokéAPI 한국어 이름 ${koByPsId.size}개`);

  const cache = {};
  const missing = [];
  for (const id of targetIds) {
    const ko = koByPsId.get(psNorm(id));
    if (ko) cache[id] = ko;
    else missing.push(id);
  }
  return { cache, missing };
}

// === 우리 데이터에서 fetch 대상 ID 추출 ===
function loadTargetIds() {
  const Pokedex = loadTsModule(path.join(DATA, 'pokedex.ts')).Pokedex;
  const Moves = loadTsModule(path.join(DATA, 'moves.ts')).Moves;
  const Abilities = loadTsModule(path.join(DATA, 'abilities.ts')).Abilities;
  const Items = loadTsModule(path.join(DATA, 'items.ts')).Items;
  const FormatsData = loadTsModule(path.join(DATA, 'mods', 'champions', 'formats-data.ts')).FormatsData;
  const champMoves = loadTsModule(path.join(DATA, 'mods', 'champions', 'moves.ts')).Moves;
  const champAbilities = loadTsModule(path.join(DATA, 'mods', 'champions', 'abilities.ts')).Abilities;
  const champItems = loadTsModule(path.join(DATA, 'mods', 'champions', 'items.ts')).Items;

  const isPast = e => e?.isNonstandard === 'Past' || e?.isNonstandard === 'Future';
  const legalPokemon = Object.entries(FormatsData)
    .filter(([_, f]) => f && f.tier !== 'Illegal' && !isPast(f))
    .map(([id]) => id)
    .filter(id => Pokedex[id]);

  return {
    pokemon: legalPokemon,
    moves: Object.entries(applyModOverrides(Moves, champMoves)).filter(([_, m]) => m?.name && !isPast(m)).map(([id]) => id),
    abilities: Object.entries(applyModOverrides(Abilities, champAbilities)).filter(([_, a]) => a?.name && !isPast(a)).map(([id]) => id),
    items: Object.entries(applyModOverrides(Items, champItems)).filter(([_, i]) => i?.name && !isPast(i)).map(([id]) => id),
  };
}

async function main() {
  console.log('🇰🇷 PokéAPI CSV 한국어 이름 fetcher');
  fs.mkdirSync(KO_DIR, { recursive: true });
  const targets = loadTargetIds();

  const tasks = [
    // 이름
    { key: 'pokemon',   total: targets.pokemon.length,   run: () => fetchKoPokemon(targets.pokemon) },
    { key: 'moves',     total: targets.moves.length,     run: () => fetchKoSimple(targets.moves, { tableCsv: 'moves.csv', namesCsv: 'move_names.csv', idColumn: 'move_id' }) },
    { key: 'abilities', total: targets.abilities.length, run: () => fetchKoSimple(targets.abilities, { tableCsv: 'abilities.csv', namesCsv: 'ability_names.csv', idColumn: 'ability_id' }) },
    { key: 'items',     total: targets.items.length,     run: () => fetchKoSimple(targets.items, { tableCsv: 'items.csv', namesCsv: 'item_names.csv', idColumn: 'item_id' }) },
    // 설명 (flavor text 의 한국어 — 최신 게임 버전 우선)
    { key: 'desc-moves',     total: targets.moves.length,     run: () => fetchKoFlavor(targets.moves, { tableCsv: 'moves.csv', flavorCsv: 'move_flavor_text.csv', idColumn: 'move_id' }) },
    { key: 'desc-abilities', total: targets.abilities.length, run: () => fetchKoFlavor(targets.abilities, { tableCsv: 'abilities.csv', flavorCsv: 'ability_flavor_text.csv', idColumn: 'ability_id' }) },
    { key: 'desc-items',     total: targets.items.length,     run: () => fetchKoFlavor(targets.items, { tableCsv: 'items.csv', flavorCsv: 'item_flavor_text.csv', idColumn: 'item_id' }) },
  ];

  const summary = {};
  for (const t of tasks) {
    console.log(`\n📦 [${t.key}] 대상 ${t.total}개`);
    const { cache, missing } = await t.run();
    fs.writeFileSync(path.join(KO_DIR, `${t.key}.json`),
      JSON.stringify(cache, null, 2) + '\n');
    if (missing.length > 0) {
      fs.writeFileSync(path.join(KO_DIR, `${t.key}.missing.json`),
        JSON.stringify(missing, null, 2) + '\n');
    } else {
      // 이전 missing 파일 삭제
      const f = path.join(KO_DIR, `${t.key}.missing.json`);
      if (fs.existsSync(f)) fs.rmSync(f);
    }
    summary[t.key] = { ok: Object.keys(cache).length, missing: missing.length, total: t.total };
    console.log(`   ✓ ${t.key}.json: ${Object.keys(cache).length}/${t.total} 매칭${missing.length ? `, 누락 ${missing.length}개` : ''}`);
  }

  console.log('\n📊 요약');
  console.table(summary);
  console.log('\n💡 누락된 항목은 data/ko/<카테고리>.missing.json 에 기록되어 있습니다.');
  console.log('   수동 번역해서 data/ko/<카테고리>.json 에 직접 추가해도 됩니다.');
}

main().catch(err => { console.error('❌ fetcher 실패:', err); process.exit(1); });
