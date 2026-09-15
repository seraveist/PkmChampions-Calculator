import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function readJsGroup(root, prefix) {
  const jsDir = path.join(root, 'src', 'js');
  return readdirSync(jsDir)
    .filter(file => file.endsWith('.js') && file.startsWith(prefix))
    .sort()
    .map(file => readSourceFileSync(path.join(jsDir, file), 'utf8'))
    .join('\n');
}

export function readViewSource(root) {
  return readJsGroup(root, '04-');
}

export function readCalcUiSource(root) {
  return readJsGroup(root, '03-');
}

// Compatibility adapter ONLY for the established, isolated vm golden fixtures.
// It removes module syntax (not function bodies) and invokes explicit DOM
// binders against each fixture's stubs. Production always bundles native ESM.
export function readSourceFileSync(file, encoding) {
  const raw=readFileSync(file,encoding);
  if(typeof raw!=='string' || !/[\\/]src[\\/]js[\\/].*\.js$/.test(String(file)))return raw;
  return toFixtureScript(raw);
}
export function toFixtureScript(source) {
  let result=source.replace(/^import .*?;\s*$/gm,'').replace(/^export \{.*?\};\s*$/gm,'');
  result=result.replace(/featureApis\.\w+\??\./g,'');
  // Fixture execution is synchronous; network-level module behavior is covered
  // independently by the real-browser and native-module checks.
  result=result.replace('return loadPageFeature(pageKey);','return Promise.resolve();')
    .replace('pageFeatureNeedsLoad(pageKey)','false');
  const binders=[...result.matchAll(/^function (bind\d+\w+)\(/gm)].map(m=>m[1]);
  return result+'\n'+binders.map(name=>`${name}();`).join('\n');
}
