import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');
const MANIFEST = path.join(DIST, 'deploy-manifest.json');

if (!existsSync(SOURCE)) {
  console.error('Missing generated HTML. Run npm run build first.');
  process.exit(1);
}

mkdirSync(DIST, { recursive: true });
copyFileSync(SOURCE, INDEX);

const stat = statSync(INDEX);
const manifest = {
  artifact: 'index.html',
  source: path.basename(SOURCE),
  generatedAt: new Date().toISOString(),
  sizeBytes: stat.size,
  deployRoot: 'dist',
  notes: [
    'Upload the contents of dist/ to a static host.',
    'The app is a single static HTML SPA and does not require server-side routing.',
  ],
};

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`public artifact ready: ${INDEX}`);
console.log(`size: ${(stat.size / 1024).toFixed(1)} KB`);
