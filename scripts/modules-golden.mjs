import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse } from 'acorn';
import { ROOT, STANDALONE_NAME } from './build-artifacts.mjs';
import { tmpdir } from 'node:os';
const files=fs.readdirSync(path.join(ROOT,'src/js')).filter(name=>name.endsWith('.js'));
const graph=new Map();
function visit(node,callback){if(!node||typeof node!=='object')return;callback(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(x=>visit(x,callback));else if(value&&typeof value==='object')visit(value,callback);}}
for(const file of files) {
  const full=path.join(ROOT,'src/js',file),source=fs.readFileSync(full,'utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  const imported=new Set(),dependencies=[];
  for(const node of ast.body)if(node.type==='ImportDeclaration'){
    assert(node.source.value.startsWith('.'),'local imports must be explicit');
    const dependency=path.resolve(path.dirname(full),node.source.value);assert(fs.existsSync(dependency),dependency);dependencies.push(dependency);
    node.specifiers.forEach(specifier=>imported.add(specifier.local.name));
  }
  assert(ast.body.some(node=>node.type==='ExportNamedDeclaration'),file+' exports its module API');
  visit(ast,node=>{
    const target=node.type==='AssignmentExpression'?node.left:node.type==='UpdateExpression'?node.argument:null;
    if(target?.type==='Identifier')assert(!imported.has(target.name),file+' writes an imported binding '+target.name);
  });
  graph.set(full,dependencies);
}
console.log(`[PASS] ${files.length} application files are native ES modules with valid imports and owned writes`);
const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
for(const page of ['dex','matchup','finetune','revcalc'])assert(main.includes(`import('./features/feature-${page}.js')`));
const seen=new Set();function trace(file){if(seen.has(file))return;seen.add(file);assert(!/04-[1234]/.test(path.basename(file)),'core eagerly imports optional page '+file);for(const dep of graph.get(file)||[])trace(dep);}
for(const node of parse(main,{ecmaVersion:'latest',sourceType:'module'}).body)if(node.type==='ImportDeclaration')trace(path.resolve(ROOT,'src',node.source.value));
console.log('[PASS] core has no static dependency on optional page implementations');
const temp = fs.mkdtempSync(path.join(tmpdir(), 'pkm-direct-build-'));
try {
  for (const entry of ['package.json', 'build.mjs', 'src', 'scripts', 'data']) {
    fs.cpSync(path.join(ROOT, entry), path.join(temp, entry), { recursive: true });
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(temp, 'node_modules'), 'junction');
  execFileSync(process.execPath, ['scripts/build-public.mjs', '--ad-free'], { cwd: temp });
  assert(!fs.existsSync(path.join(temp, STANDALONE_NAME)), 'public build must neither require nor generate standalone');
  const manifest = JSON.parse(fs.readFileSync(path.join(temp, 'dist/deploy-manifest.json'), 'utf8'));
  assert.equal(manifest.architecture,'esm-direct');
  const html=fs.readFileSync(path.join(temp,'dist/index.html'),'utf8');
  assert(/<script type="module"/.test(html));assert(!/id="data-/.test(html));
  for(const entry of Object.values(manifest.assets))assert(!fs.readFileSync(path.join(temp,'dist/assets',entry.file),'utf8').includes('__PKM_TEST_REGISTER__'));
  const {publicAssets} = JSON.parse(execFileSync(process.execPath, [
    path.join(ROOT, 'scripts/ui-architecture-audit.mjs'), '--json', '--dist=' + path.join(temp, 'dist'),
  ], {encoding: 'utf8'}));
  const entries = Object.entries(manifest.assets);
  const initial = new Set(publicAssets.initialFiles);
  const hints = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(hints,[manifest.assets.app.path,manifest.assets.data.path].sort());
  for (const role of ['app','theme','style','data']) assert(initial.has(manifest.assets[role].file), role);
  assert(entries.some(([role, entry]) => role.startsWith('shared') && initial.has(entry.file)));
  for (const [role, entry] of entries) {
    if (role === 'partyImage' || role === 'worker' || role.startsWith('feature')) assert(!initial.has(entry.file), role);
  }
  const initialBytes = entries.filter(([, entry]) => initial.has(entry.file)).reduce((sum, [, entry]) => sum + entry.gzipBytes, 0);
  assert.equal(publicAssets.initialGzipBytes, initialBytes);
  console.log('[PASS] initial asset size includes shared static imports and excludes lazy features and the reverse worker');
  console.log('[PASS] isolated public build works with no standalone input and never writes it');
  console.log('[PASS] production artifacts contain no test bridge or embedded game-data tags');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
