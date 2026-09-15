import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parse } from 'acorn';
import { ROOT, STANDALONE_NAME } from './build-artifacts.mjs';
import { buildPublic } from './build-public.mjs';
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
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pkm-direct-build-'));
const standalone=path.join(ROOT,STANDALONE_NAME),backup=path.join(temp,STANDALONE_NAME);
const existed=fs.existsSync(standalone);
if(existed)fs.renameSync(standalone,backup);
try {
  const manifest=await buildPublic({dist:path.join(temp,'dist'),adFree:true});
  assert(!fs.existsSync(standalone),'public build must neither read nor regenerate standalone');
  assert.equal(manifest.architecture,'esm-direct');
  const html=fs.readFileSync(path.join(temp,'dist/index.html'),'utf8');
  assert(/<script type="module"/.test(html));assert(!/id="data-/.test(html));
  for(const entry of Object.values(manifest.assets))assert(!fs.readFileSync(path.join(temp,'dist/assets',entry.file),'utf8').includes('__PKM_TEST_REGISTER__'));
  console.log('[PASS] direct public build works with standalone removed and never writes it');
  console.log('[PASS] production artifacts contain no test bridge or embedded game-data tags');
} finally {
  if(existed){if(fs.existsSync(standalone))fs.unlinkSync(standalone);fs.renameSync(backup,standalone);}
  fs.rmSync(temp,{recursive:true,force:true});
}
