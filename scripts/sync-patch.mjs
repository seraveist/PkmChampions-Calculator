// Only validated regular files from the data sync may reach the publication job.
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PS_FILES } from './ps-data-source.mjs';

const optionalCache = 'data/ko/auto-cache.json';
const outputs = new Set([...PS_FILES, 'data/upstream.json', optionalCache,
  'docs/damage-calculator-coverage-matrix.md', 'docs/power-mechanics-audit.md',
  'docs/power-mechanics-audit.json', 'pokemon-champions-calculator-v3.html']);
const [operation, patch] = process.argv.slice(2);
if (!patch || !['create', 'apply'].includes(operation)) throw new Error('Supply create or apply and a patch path.');
if (operation === 'apply' && execFileSync('git', ['diff', '--cached', '--name-only']).length) {
  throw new Error('Expected a clean index before publication.');
}

const temp = mkdtempSync(path.join(tmpdir(), 'pkm-sync-index-'));
const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, 'index') };
const git = (...args) => execFileSync('git', args, { env, encoding: 'utf8' });
try {
  git('read-tree', 'HEAD');
  if (operation === 'create') {
    // The first failed translation refresh may legitimately leave the cache absent.
    git('add', '--', ...[...outputs].filter(file => file !== optionalCache || existsSync(file)));
  } else {
    git('apply', '--cached', '--whitespace=nowarn', '--', patch);
  }
  const changes = git('diff', '--cached', '--raw', '--no-renames', '-z').split('\0');
  for (let i = 0; i < changes.length - 1; i += 2) {
    const [, mode, , , status] = changes[i].split(' ');
    if (mode !== '100644' || !['A', 'M'].includes(status) || !outputs.has(changes[i + 1])) {
      throw new Error('Unexpected sync output: ' + changes[i + 1]);
    }
  }
  if (operation === 'create') {
    const fd = openSync(patch, 'wx');
    try {
      execFileSync('git', ['diff', '--cached', '--binary', '--no-renames', '--no-ext-diff'], { env, stdio: ['ignore', fd, 'inherit'] });
    } finally { closeSync(fd); }
  } else {
    execFileSync('git', ['apply', '--index', '--whitespace=nowarn', '--', patch]);
  }
} finally { rmSync(temp, { recursive: true, force: true }); }
