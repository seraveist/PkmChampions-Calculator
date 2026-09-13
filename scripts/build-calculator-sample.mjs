// An isolated UI entry sharing the production dataset, tokens and damage engine.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = file => readFileSync(path.join(root, file), 'utf8');
const output = path.join(root, 'dist/samples/calculator');
mkdirSync(output, { recursive: true });
const source = read('pokemon-champions-calculator-v3.html');
const ids = ['pokemon', 'moves', 'abilities', 'items', 'natures', 'typechart', 'rules'];
const data = ids.map(id => {
  const block = source.match(new RegExp(`<script id="data-${id}" type="application/json">([\\s\\S]*?)<\\/script>`));
  if (!block) throw new Error(`Missing dataset: ${id}`);
  JSON.parse(block[1]);
  return block[0];
}).join('\n');
const runtime = ['01-core.js', '02-engine.js', '03-10-calc-state.js', '03-40-calc-entry-effects.js'].map(file => read(`src/js/${file}`)).join('\n');
writeFileSync(path.join(output, 'engine.js'), runtime + '\nconst ENTRY_EFFECTS = RULES.entryEffects || {};\nconst INTIMIDATE_BLOCKERS = RULES.entryEffectBlockers?.intimidate || [];\n');
writeFileSync(path.join(output, 'calculator.js'), read('samples/calculator/calculator.js'));
writeFileSync(path.join(output, 'ui.js'), read('samples/calculator/ui.js'));
const typeStyles = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy','stellar'].map(type => `.type-${type} { --type-bg:var(--type-${type}-bg); --type-fg:var(--type-${type}-fg); }`).join('\n');
writeFileSync(path.join(output, 'calculator.css'), read('src/styles/00-tokens.css') + '\n' + read('samples/calculator/ui.css') + '\n' + read('samples/calculator/calculator.css') + '\n' + typeStyles);
writeFileSync(path.join(root, 'dist/calculator-sample.html'), read('samples/calculator/index.html').replace('<!-- SAMPLE_DATA -->', data));
console.log('Calculator sample: dist/calculator-sample.html');
