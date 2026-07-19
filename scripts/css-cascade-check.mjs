import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSS_LAYER_ORDER, styleLayerFor } from './css-layer-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STYLE_DIR = path.join(ROOT, 'src', 'styles');
const STRUCTURAL_THEME_PROPERTIES = new Set([
  'align-content', 'align-items', 'align-self', 'box-sizing', 'display', 'flex',
  'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-wrap',
  'font-size', 'font-weight', 'gap', 'grid', 'grid-area', 'grid-auto-columns',
  'grid-auto-flow', 'grid-auto-rows', 'grid-column', 'grid-row', 'grid-template',
  'grid-template-areas', 'grid-template-columns', 'grid-template-rows', 'height',
  'justify-content', 'justify-items', 'justify-self', 'line-height', 'margin',
  'margin-block', 'margin-block-end', 'margin-block-start', 'margin-bottom',
  'margin-inline', 'margin-inline-end', 'margin-inline-start', 'margin-left',
  'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width',
  'overflow', 'overflow-x', 'overflow-y', 'padding', 'padding-block',
  'padding-block-end', 'padding-block-start', 'padding-bottom', 'padding-inline',
  'padding-inline-end', 'padding-inline-start', 'padding-left', 'padding-right',
  'padding-top', 'position', 'text-align', 'text-overflow', 'white-space', 'width',
]);

function filesUnder(dir, relative = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(absolute, nextRelative);
    return entry.isFile() && entry.name.endsWith('.css') ? [nextRelative] : [];
  }).sort((a, b) => a.localeCompare(b));
}

function matchingBrace(source, openIndex) {
  let depth = 0;
  let quote = '';
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error('Unclosed CSS block');
}

function splitTopLevel(value, separator) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    else if (char === separator && round === 0 && square === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function parseDeclarations(body) {
  return splitTopLevel(body, ';').flatMap(part => {
    const colon = part.indexOf(':');
    if (colon < 1) return [];
    const property = part.slice(0, colon).trim().toLowerCase();
    if (!/^--[\w-]+$/.test(property) && !/^[a-z-]+$/.test(property)) return [];
    return [{ property, value: part.slice(colon + 1).trim() }];
  });
}

function parseRules(source, file, layer, start = 0, context = []) {
  const rules = [];
  let cursor = start;
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open < 0) break;
    const header = source.slice(cursor, open).trim();
    const close = matchingBrace(source, open);
    const body = source.slice(open + 1, close);
    if (header.startsWith('@media') || header.startsWith('@supports') || header.startsWith('@container')) {
      rules.push(...parseRules(body, file, layer, 0, [...context, header]));
    } else if (!header.startsWith('@')) {
      const declarations = parseDeclarations(body);
      for (const rawSelector of splitTopLevel(header, ',')) {
        const selector = rawSelector.replace(/\s+/g, ' ').trim();
        if (!selector) continue;
        rules.push({
          file,
          layer,
          selector,
          declarations,
          conditional: context.length > 0,
          context: context.join(' > '),
          line: lineAt(source, open - header.length),
        });
      }
    }
    cursor = close + 1;
  }
  return rules;
}

const files = filesUnder(STYLE_DIR);
const sourceOrder = new Map(files.map((file, index) => [file, index]));
const rules = files.flatMap(file => {
  const source = readFileSync(path.join(STYLE_DIR, ...file.split('/')), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return parseRules(source, file, styleLayerFor(file));
});

const declarations = rules.flatMap(rule => rule.declarations.map(declaration => ({ ...rule, ...declaration })));
const duplicateGroups = new Map();
for (const declaration of declarations.filter(item => !item.conditional)) {
  const key = `${declaration.layer}\n${declaration.selector}\n${declaration.property}`;
  const entries = duplicateGroups.get(key) || [];
  entries.push(declaration);
  duplicateGroups.set(key, entries);
}
const unconditionalConflicts = [...duplicateGroups.values()]
  .filter(entries => new Set(entries.map(entry => entry.file)).size > 1)
  .map(entries => ({
    layer: entries[0].layer,
    selector: entries[0].selector,
    property: entries[0].property,
    owners: entries.map(entry => `${entry.file}:${entry.line}`),
  }));

const mediaShadowing = [];
for (const conditional of declarations.filter(item => item.conditional)) {
  const laterBase = declarations.find(candidate =>
    !candidate.conditional
      && candidate.layer === conditional.layer
      && candidate.selector === conditional.selector
      && candidate.property === conditional.property
      && sourceOrder.get(candidate.file) > sourceOrder.get(conditional.file));
  if (laterBase) {
    mediaShadowing.push({
      selector: conditional.selector,
      property: conditional.property,
      mediaOwner: `${conditional.file}:${conditional.line}`,
      baseOwner: `${laterBase.file}:${laterBase.line}`,
    });
  }
}

const themeStructure = declarations
  .filter(item => item.file === 'themes.css' && STRUCTURAL_THEME_PROPERTIES.has(item.property))
  .map(item => `${item.selector} -> ${item.property} (${item.file}:${item.line})`);

const unsafeFinalLayerControls = rules
  .filter(rule => rule.file === 'themes.css' || styleLayerFor(rule.file) === 'responsive')
  .filter(rule => !rule.selector.includes(':has('))
  .filter(rule => /(^|[\s>+~,(])(?:input|select|textarea)(?=$|[\s>+~,:.#[\]])/.test(rule.selector))
  .map(rule => `${rule.selector} (${rule.file}:${rule.line})`);

const report = {
  files: files.length,
  layers: Object.fromEntries(CSS_LAYER_ORDER.map(layer => [layer, files.filter(file => styleLayerFor(file) === layer)])),
  unconditionalConflicts,
  mediaShadowing,
  themeStructure,
  unsafeFinalLayerControls,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`CSS cascade audit: ${files.length} files`);
  console.log(`Unconditional cross-file conflicts: ${unconditionalConflicts.length}`);
  for (const item of unconditionalConflicts) {
    console.log(`  ${item.selector} { ${item.property} } -> ${item.owners.join(', ')}`);
  }
  console.log(`Responsive declarations shadowed by later base rules: ${mediaShadowing.length}`);
  for (const item of mediaShadowing) {
    console.log(`  ${item.selector} { ${item.property} } -> ${item.mediaOwner} => ${item.baseOwner}`);
  }
  console.log(`Structural declarations in themes.css: ${themeStructure.length}`);
  for (const item of themeStructure) console.log(`  ${item}`);
  console.log(`Raw form-control selectors in final layers: ${unsafeFinalLayerControls.length}`);
  for (const item of unsafeFinalLayerControls) console.log(`  ${item}`);
}

if (unconditionalConflicts.length || mediaShadowing.length || themeStructure.length || unsafeFinalLayerControls.length) {
  process.exitCode = 1;
}
