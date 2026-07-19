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
import { PS_FILES, PS_REF, PS_REPOSITORY } from './ps-data-source.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const PS_COMMIT_API = `https://api.github.com/repos/${PS_REPOSITORY}/commits/${PS_REF}`;
const PS_RAW_ROOT = `https://raw.githubusercontent.com/${PS_REPOSITORY}`;
const UPSTREAM_META_PATH = path.join(DATA, 'upstream.json');

// 챔피언스 빌드에 필요한 모든 ts 파일.
// 신규 파일이 PS 에서 추가되면 여기에만 추가하면 됨.
const FILES = PS_FILES;
/* Legacy inline comment retained from the original encoded source.
  // text/ 한국어/영문 서술문
  'data/text/pokedex.ts',
*/
const dryRun = process.argv.includes('--dry-run');

async function fetchText(url) {
  const token = process.env.GITHUB_TOKEN || '';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'pkmchampions-calculator-sync/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function resolveUpstreamCommit() {
  const payload = JSON.parse(await fetchText(PS_COMMIT_API));
  if (!/^[0-9a-f]{40}$/i.test(payload?.sha || '')) {
    throw new Error('Pokemon Showdown upstream commit SHA를 확인할 수 없습니다.');
  }
  return payload.sha;
}

async function inspectOne(relPath, commit) {
  const url = `${PS_RAW_ROOT}/${commit}/${relPath}`;
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
    return { path: relPath, localPath, upstream, status: 'unchanged', bytes: upstream.length };
  }
  return {
    path: relPath,
    localPath,
    upstream,
    status: local ? 'updated' : 'created',
    bytes: upstream.length,
    delta: upstream.length - local.length,
  };
}

async function main() {
  console.log(`🔄 PS 데이터 동기화${dryRun ? ' (dry-run)' : ''}`);
  const upstreamCommit = await resolveUpstreamCommit();
  console.log(`🔒 upstream ${PS_REPOSITORY}@${upstreamCommit}`);
  console.log(`📦 ${FILES.length}개 파일 검사`);

  // 동시성 제한 (raw.githubusercontent.com 은 관대하지만 매너상 5)
  const CONCURRENCY = 5;
  const results = new Array(FILES.length);
  let idx = 0;
  async function worker() {
    while (idx < FILES.length) {
      const i = idx++;
      results[i] = await inspectOne(FILES[i], upstreamCommit);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (results.some(result => result.status === 'fetch-failed')) {
    results.filter(result => result.status === 'fetch-failed').forEach(result => {
      console.error(`  ❌ ${result.path} — ${result.detail}`);
    });
    throw new Error('일부 파일 fetch 실패로 로컬 데이터를 변경하지 않았습니다.');
  }

  const upstreamMeta = `${JSON.stringify({
    repository: PS_REPOSITORY,
    ref: PS_REF,
    commit: upstreamCommit,
    files: FILES,
  }, null, 2)}\n`;
  const currentMeta = fs.existsSync(UPSTREAM_META_PATH) ? fs.readFileSync(UPSTREAM_META_PATH, 'utf8') : '';
  results.push({
    path: path.relative(ROOT, UPSTREAM_META_PATH).split(path.sep).join('/'),
    localPath: UPSTREAM_META_PATH,
    upstream: upstreamMeta,
    status: currentMeta === upstreamMeta ? 'unchanged' : currentMeta ? 'updated' : 'created',
    bytes: upstreamMeta.length,
    delta: upstreamMeta.length - currentMeta.length,
  });

  if (!dryRun) {
    results.filter(result => result.status === 'updated' || result.status === 'created').forEach(result => {
      fs.mkdirSync(path.dirname(result.localPath), { recursive: true });
      fs.writeFileSync(result.localPath, result.upstream);
    });
  }

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

}

main().catch(err => { console.error('❌ 동기화 실패:', err); process.exit(1); });
