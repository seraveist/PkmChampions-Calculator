// scripts/fetch-ko.mjs
//
// PokéAPI 의 공개 CSV (raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv)
// 에서 한국어 이름을 일괄 수집해 data/ko/auto-cache.json 스냅샷으로 저장한다.
//
// 사용법:
//   node scripts/fetch-ko.mjs            # 4 카테고리 모두
//
// 캐시 파일은 git 에 커밋되어, build.mjs 가 koName 으로 매핑한다.
// PokéAPI REST 엔드포인트는 일부 환경에서 차단될 수 있어, CSV 직접 다운로드 방식을 사용.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from './build-game-data.mjs';
import { randomUUID } from 'node:crypto';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const KO_DIR = path.join(DATA, 'ko');

const KO_LANG_ID = '3';  // PokéAPI languages.csv 에서 ko=3


// PS id ↔ identifier 정규화
function psNorm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }


async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url);
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

// 한 카테고리의 flavor text(한국어) 를 PS id 키로 매핑해서 반환.
// opts: { tableCsv, flavorCsv, idColumn (e.g. 'ability_id'/'move_id'/'item_id') }
async function fetchKoFlavor(targetIds, opts, readCsv) {
  console.log(`   ${opts.tableCsv} ...`);
  const items = await readCsv(opts.tableCsv);
  console.log(`   ${opts.flavorCsv} ...`);
  const flavors = await readCsv(opts.flavorCsv);

  const idToIdent = new Map(items.map(r => [r.id, r.identifier]));
  const orderRows = await readCsv('version_groups.csv');
  const versionOrder = new Map(orderRows.map(row => [row.id, Number(row.order)]));

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
async function fetchKoPokemon(targetIds, readCsv) {
  console.log('   pokemon_species.csv ...');
  const species = await readCsv('pokemon_species.csv');        // id, identifier
  console.log('   pokemon_species_names.csv ...');
  const speciesNames = await readCsv('pokemon_species_names.csv');
  console.log('   pokemon_forms.csv ...');
  const forms = await readCsv('pokemon_forms.csv');            // id, identifier
  console.log('   pokemon_form_names.csv ...');
  const formNames = await readCsv('pokemon_form_names.csv');

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
async function fetchKoSimple(targetIds, opts, readCsv) {
  console.log(`   ${opts.tableCsv} ...`);
  const items = await readCsv(opts.tableCsv);
  console.log(`   ${opts.namesCsv} ...`);
  const names = await readCsv(opts.namesCsv);

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
export function loadTargetIds() {
  const data = buildGameData();
  return Object.fromEntries(['pokemon', 'moves', 'abilities', 'items'].map(kind => [kind, data[kind].map(row => row.id)]));
}

export async function refreshKoreanCache({ directory = KO_DIR, targets = loadTargetIds(), commit, fetchImpl = fetch } = {}) {
  if (commit === undefined) commit = JSON.parse(await fetchText('https://api.github.com/repos/PokeAPI/pokeapi/commits/master', fetchImpl)).sha;
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('PokéAPI 커밋 SHA를 확인해 주세요.');
  const csvBase = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${commit}/data/v2/csv`;
  const smallTables = new Map();
  async function readCsv(file) {
    if (smallTables.has(file)) return smallTables.get(file);
    const rows = parseCsv(await fetchText(csvBase + '/' + file, fetchImpl));
    if (!rows.length) throw new Error(file + ' CSV에 데이터가 없습니다.');
    if (['moves.csv','abilities.csv','items.csv','version_groups.csv'].includes(file)) smallTables.set(file, rows);
    return rows;
  }
  fs.mkdirSync(directory, { recursive: true });

  const tasks = [
    // 이름
    { key: 'pokemon',   total: targets.pokemon.length,   run: () => fetchKoPokemon(targets.pokemon, readCsv) },
    { key: 'moves',     total: targets.moves.length,     run: () => fetchKoSimple(targets.moves, { tableCsv: 'moves.csv', namesCsv: 'move_names.csv', idColumn: 'move_id' }, readCsv) },
    { key: 'abilities', total: targets.abilities.length, run: () => fetchKoSimple(targets.abilities, { tableCsv: 'abilities.csv', namesCsv: 'ability_names.csv', idColumn: 'ability_id' }, readCsv) },
    { key: 'items',     total: targets.items.length,     run: () => fetchKoSimple(targets.items, { tableCsv: 'items.csv', namesCsv: 'item_names.csv', idColumn: 'item_id' }, readCsv) },
    // 설명 (flavor text 의 한국어 — 최신 게임 버전 우선)
    { key: 'desc-moves',     total: targets.moves.length,     run: () => fetchKoFlavor(targets.moves, { tableCsv: 'moves.csv', flavorCsv: 'move_flavor_text.csv', idColumn: 'move_id' }, readCsv) },
    { key: 'desc-abilities', total: targets.abilities.length, run: () => fetchKoFlavor(targets.abilities, { tableCsv: 'abilities.csv', flavorCsv: 'ability_flavor_text.csv', idColumn: 'ability_id' }, readCsv) },
    { key: 'desc-items',     total: targets.items.length,     run: () => fetchKoFlavor(targets.items, { tableCsv: 'items.csv', flavorCsv: 'item_flavor_text.csv', idColumn: 'item_id' }, readCsv) },
  ];

  // 수동 번역 파일을 미리 읽어서, missing 목록에서 빼기 위한 set 으로 보관.
  // 우선순위는 build.mjs 에서 적용 (manual > auto). 여기선 진단용 missing 만 정확히 산출.
  function readManual(key) {
    const fp = path.join(directory, `${key}.manual.json`);
    if (!fs.existsSync(fp)) return {};
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      // _README, _NOTE 등 메타 키는 무시
      const clean = {};
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith('_')) continue;
        if (v && typeof v === 'string' && v.trim()) clean[k] = v;
      }
      return clean;
    } catch (e) {
      throw new Error(`수동 번역을 읽지 못했습니다 · ${fp}`, { cause: e });
    }
  }

  const summary = {};
  const categories = {};
  const missing = {};
  for (const t of tasks) {
    console.log(`\n📦 [${t.key}] 대상 ${t.total}개`);
    const { cache, missing: rawMissing } = await t.run();
    if (!Object.keys(cache).length || Object.keys(cache).length + rawMissing.length !== t.total) {
      throw new Error(t.key + ' 번역 결과를 검증하지 못했습니다.');
    }
    categories[t.key] = cache;

    // 수동 번역 적용 후 진짜 missing 만 남김
    const manual = readManual(t.key);
    const stillMissing = rawMissing.filter(id => !manual[id]);
    const filledByManual = rawMissing.length - stillMissing.length;

    missing[t.key] = stillMissing;

    summary[t.key] = {
      auto: Object.keys(cache).length,
      manual: filledByManual,
      missing: stillMissing.length,
      total: t.total,
    };
    const detail = filledByManual > 0 ? ` (수동 ${filledByManual}개)` : '';
    console.log(`   ✓ ${t.key}.json: ${Object.keys(cache).length}/${t.total} 자동 매칭${detail}${stillMissing.length ? `, 누락 ${stillMissing.length}개` : ''}`);
  }

  console.log('\n📊 요약');
  console.table(summary);
  const output = path.join(directory, 'auto-cache.json');
  const temp = output + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify({ version: 1, commit, categories, missing }, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temp, output);
  } finally {
    fs.rmSync(temp, { force: true });
  }
  console.log('번역 캐시 갱신 완료 · ' + commit);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) refreshKoreanCache({
  commit: process.argv.find(arg => arg.startsWith('--commit='))?.slice(9),
}).catch(err => { console.error('❌ fetcher 실패:', err); process.exit(1); });
