import { readFileSync } from 'node:fs';

const corrections = JSON.parse(readFileSync(new URL('../data/overrides/champions-data.json', import.meta.url), 'utf8'));
const kinds = new Set(['pokemon', 'moves', 'abilities', 'items', 'learnsets', 'formats']);
for (const kind of Object.keys(corrections)) {
  if (!kind.startsWith('_') && !kinds.has(kind)) throw new Error(`Unknown Champions correction category: ${kind}`);
}

// Shallow field replacement is intentional (e.g. replacing a form's ability slots).
// Unlike mod inheritance, unrelated patches never implicitly change availability.
export function applyChampionsDataOverrides(kind, source) {
  if (!kinds.has(kind)) throw new Error(`Unknown Champions data category: ${kind}`);
  const result = { ...source };
  for (const [id, patch] of Object.entries(corrections[kind] || {})) {
    if (!/^[a-z0-9]+$/.test(id) || !Object.hasOwn(source, id)) throw new Error(`Missing Champions correction target: ${kind}.${id}`);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error(`Invalid Champions correction: ${kind}.${id}`);
    result[id] = { ...source[id], ...patch };
  }
  return result;
}
