// scripts/sync-ps-data.mjs
//
// smogon/pokemon-showdown 의 master 브랜치에서 챔피언스 빌드에 필요한 ts 파일들을
// raw.githubusercontent.com 으로 직접 fetch 해서 로컬 data/ 폴더에 저장한다.
//
// 사용:
//   node scripts/sync-ps-data.mjs            # 전체 업데이트
//   node scripts/sync-ps-data.mjs --dry-run  # 변경 미리보기 (파일 쓰기 안 함)
//
// GitHub Actions 워크플로(.github/workflows/sync-ps-data.yml)가 주기적으로 실행하며,
// 변경이 감지되면 자동 커밋·푸시한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const PS_BASE = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master';

// 챔피언스 빌드에 필요한 모든 ts 파일.
// 신규 파일이 PS 에서 추가되면 여기에만 추가하면 됨.
const FILES = [
  'data/pokedex.ts',
  'data/moves.ts',
  'data/abilities.ts',
  'data/items.ts',
  'data/learnsets.ts',
  'data/typechart.ts',
  'data/natures.ts',
  'data/formats-data.ts',
  'data/conditions.ts',
  'data/aliases.ts',
  'data/tags.ts',
  'data/rulesets.ts',
  'data/scripts.ts',
  'data/pokemongo.ts',
  // text/ 한국어/영문 서술문
  'data/text/pokedex.ts',
  'data/text/moves.ts',
  'data/text/abilities.ts',
  'data/text/items.ts',
  // mods/champions
  'data/mods/champions/formats-data.ts',
  'data/mods/champions/moves.ts',
  'data/mods/champions/abilities.ts',
  'data/mods/champions/items.ts',
  'data/mods/champions/learnsets.ts',
  'data/mods/champions/scripts.ts',
  'data/mods/champions/conditions.ts',
  'data/mods/champions/rulesets.ts',
];

const dryRun = process.argv.includes('--dry-run');

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'pkmchampions-calculator-sync/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function syncOne(relPath) {
  const url = `${PS_BASE}/${relPath}`;
  const localPath = path.join(ROOT, relPath);
  let upstream;
  try {
    upstream = await fetchText(url);
  } catch (err) {
    return { path: relPath, status: 'fetch-failed', detail: err.message };
  }
  let local = '';
  if (fs.existsSync(localPath)) {
    local = fs.readFileSync(localPath, 'utf8');
  }
  if (local === upstream) {
    return { path: relPath, status: 'unchanged', bytes: upstream.length };
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, upstream);
  }
  return {
    path: relPath,
    status: local ? 'updated' : 'created',
    bytes: upstream.length,
    delta: upstream.length - local.length,
  };
}

async function main() {
  console.log(`🔄 PS 데이터 동기화${dryRun ? ' (dry-run)' : ''}`);
  console.log(`📦 ${FILES.length}개 파일 검사`);

  // 동시성 제한 (raw.githubusercontent.com 은 관대하지만 매너상 5)
  const CONCURRENCY = 5;
  const results = new Array(FILES.length);
  let idx = 0;
  async function worker() {
    while (idx < FILES.length) {
      const i = idx++;
      results[i] = await syncOne(FILES[i]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const counts = { unchanged: 0, updated: 0, created: 0, 'fetch-failed': 0 };
  for (const r of results) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    const tag = { unchanged: '·', updated: '✏️', created: '+', 'fetch-failed': '❌' }[r.status] || '?';
    if (r.status !== 'unchanged') {
      console.log(`  ${tag} ${r.path}` + (r.delta !== undefined ? ` (${r.delta > 0 ? '+' : ''}${r.delta} bytes)` : '') + (r.detail ? ` — ${r.detail}` : ''));
    }
  }
  console.log('\n📊', JSON.stringify(counts));

  // GitHub Actions 가 후속 단계에서 결과를 활용할 수 있게 stdout 마지막 줄에 변경 여부 명시
  const hasChanges = (counts.updated || 0) + (counts.created || 0) > 0;
  console.log(`\n${hasChanges ? '✓ 변경 감지' : '· 변경 없음'}`);

  if (counts['fetch-failed'] > 0) {
    console.error('❌ 일부 파일 fetch 실패. 위 로그 확인.');
    process.exit(1);
  }
}

main().catch(err => { console.error('❌ 동기화 실패:', err); process.exit(1); });
