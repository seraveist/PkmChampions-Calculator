import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function readJsGroup(root, prefix) {
  const jsDir = path.join(root, 'src', 'js');
  return readdirSync(jsDir)
    .filter(file => file.endsWith('.js') && file.startsWith(prefix))
    .sort()
    .map(file => readFileSync(path.join(jsDir, file), 'utf8'))
    .join('\n');
}

export function readViewSource(root) {
  return readJsGroup(root, '04-');
}

export function readCalcUiSource(root) {
  return readJsGroup(root, '03-');
}
