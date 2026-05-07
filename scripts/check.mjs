import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function filesIn(dir, ext) {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(ext))
    .map(entry => path.join(ROOT, dir, entry.name))
    .sort();
}

const targets = [
  path.join(ROOT, 'build.mjs'),
  ...filesIn('scripts', '.mjs'),
  ...filesIn(path.join('src', 'js'), '.js'),
];

let failed = false;
for (const file of targets) {
  const rel = path.relative(ROOT, file);
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`check failed: ${rel}`);
  } else {
    console.log(`check ok: ${rel}`);
  }
}

const engineFile = path.join(ROOT, 'src', 'js', '02-engine.js');
const engineSource = readFileSync(engineFile, 'utf8');
if (engineSource.includes('state.field')) {
  failed = true;
  console.error('check failed: src/js/02-engine.js must use the field argument, not state.field');
} else {
  console.log('check ok: src/js/02-engine.js has no state.field leak');
}

if (failed) process.exit(1);
