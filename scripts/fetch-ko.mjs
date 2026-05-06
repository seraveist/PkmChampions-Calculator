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

// CSV 파서 — 따옴표 안의 콤마 처리. PokéAPI CSV 는 따옴표를 거의 안 쓰지만 안전하게.
function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.length > 0);
  const header = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    if (cols.length === 0) continue;
    const obj = {};
    header.forEach((h, j) => { obj[h] = cols[j] ?? ''; });
    rows.push(obj);
  }
  return rows;
}
function parseRow(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
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
    { key: 'pokemon',   total: targets.pokemon.length,   run: () => fetchKoPokemon(targets.pokemon) },
    { key: 'moves',     total: targets.moves.length,     run: () => fetchKoSimple(targets.moves, { tableCsv: 'moves.csv', namesCsv: 'move_names.csv', idColumn: 'move_id' }) },
    { key: 'abilities', total: targets.abilities.length, run: () => fetchKoSimple(targets.abilities, { tableCsv: 'abilities.csv', namesCsv: 'ability_names.csv', idColumn: 'ability_id' }) },
    { key: 'items',     total: targets.items.length,     run: () => fetchKoSimple(targets.items, { tableCsv: 'items.csv', namesCsv: 'item_names.csv', idColumn: 'item_id' }) },
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
