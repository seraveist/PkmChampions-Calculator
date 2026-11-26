import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PS_FILES } from './ps-data-source.mjs';

const workspace = mkdtempSync(path.join(tmpdir(), 'champions-sync-test-'));
const script = fileURLToPath(new URL('./sync-patch.mjs', import.meta.url));
const build = path.join(workspace, 'build'), publish = path.join(workspace, 'publish');
const remote = path.join(workspace, 'remote.git');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const run = (cwd, command, filename) => execFileSync(process.execPath, [script, command, filename], { cwd, stdio: 'pipe' });
const file = (cwd, name, text) => {
  mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
  writeFileSync(path.join(cwd, name), text);
};
try {
  git(workspace, 'init', '--bare', '--initial-branch=main', remote);
  git(workspace, 'clone', remote, build);
  for (const name of [...PS_FILES, 'data/upstream.json', 'docs/damage-calculator-coverage-matrix.md',
    'docs/power-mechanics-audit.md', 'docs/power-mechanics-audit.json', 'pokemon-champions-calculator-v3.html']) {
    file(build, name, 'original\n');
  }
  git(build, 'add', '.');
  git(build, 'commit', '-m', 'base');
  git(build, 'push', 'origin', 'main');
  git(workspace, 'clone', remote, publish);
  const empty = path.join(workspace, 'empty.patch'), change = path.join(workspace, 'change.patch');
  run(build, 'create', empty);
  assert.equal(readFileSync(empty).length, 0);
  console.log('[PASS] Unchanged sync produces an empty patch, including a missing optional cache');
  file(build, 'data/moves.ts', 'updated\n');
  file(build, 'data/ko/auto-cache.json', '{}\n');
  file(build, 'other.txt', 'unrelated\n');
  run(build, 'create', change);
  assert.equal(git(build, 'diff', '--cached', '--name-only'), '');
  run(publish, 'apply', change);
  assert.deepEqual(git(publish, 'diff', '--cached', '--name-only').trim().split('\n'), ['data/ko/auto-cache.json', 'data/moves.ts']);
  git(publish, 'commit', '-m', 'validated');
  git(publish, 'push', 'origin', 'main');
  console.log('[PASS] Changed data and first translation cache reach the local remote together');
  git(build, 'add', 'other.txt');
  const extra = path.join(workspace, 'extra.patch');
  writeFileSync(extra, git(build, 'diff', '--cached', '--', 'other.txt'));
  assert.throws(() => run(publish, 'apply', extra), /Unexpected sync output/);
  assert.equal(git(publish, 'status', '--porcelain'), '');
  console.log('[PASS] Publisher rejects files outside synchronized outputs');
  git(build, 'commit', '-m', 'concurrent result based on old revision');
  const stale = spawnSync('git', ['push', 'origin', 'HEAD:refs/heads/main'], { cwd: build, encoding: 'utf8' });
  assert.notEqual(stale.status, 0);
  assert.equal(git(remote, 'rev-parse', 'main'), git(publish, 'rev-parse', 'HEAD'));
  console.log('[PASS] Competing publication cannot overwrite a newer branch tip');
} finally { rmSync(workspace, { recursive: true, force: true }); }
