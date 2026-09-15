// Shared inputs; public output never reads or produces the standalone artifact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as bundle } from 'esbuild';
import { parse } from 'acorn';
import { buildGameData } from './build-game-data.mjs';
import { CSS_LAYER_ORDER, styleLayerFor } from './css-layer-contract.mjs';
export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const STANDALONE_NAME = 'pokemon-champions-calculator-v3.html';
export const DATA_FIELDS = ['pokemon','moves','abilities','items','natures','typechart','rules'];
const DATA_TOKENS = ['__POKEMON_DATA__','__MOVES_DATA__','__ABILITIES_DATA__','__ITEMS_DATA__','__NATURES_DATA__','__TYPECHART_DATA__','__CHAMP_RULES__'];
export const inlineJson = value => JSON.stringify(value).replace(/</g,'\\u003c');
function styleFiles(dir, prefix='') {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    if(entry.name.startsWith('.')) return [];
    const name=prefix+entry.name;
    return entry.isDirectory() ? styleFiles(path.join(dir,entry.name),name+'/') : name.endsWith('.css') ? [name] : [];
  }).sort((a,b)=>a.localeCompare(b));
}
export function buildInputs() {
  const data=buildGameData();
  const template=fs.readFileSync(path.join(ROOT,'src/calc-template.html'),'utf8');
  const themeMatch=template.match(/<script>\s*(\(function \(\) \{[\s\S]*?pkchamps-theme[\s\S]*?)<\/script>/);
  if(!themeMatch) throw new Error('Theme bootstrap is missing from the source template.');
  const css=['@layer '+CSS_LAYER_ORDER.join(', ')+';', ...styleFiles(path.join(ROOT,'src/styles')).map(file=>
    `@layer ${styleLayerFor(file)} {\n${fs.readFileSync(path.join(ROOT,'src/styles',file),'utf8')}\n}`
  )].join('\n\n').replace(/\/\*[\s\S]*?\*\//g,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).join('\n');
  return {data,template,themeMatch,css};
}
// Isolated browser-test builds opt in to writable test bindings. Production
// artifacts never contain this bridge and never expose application globals.
function testBindingSource(source) {
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  const names=[];
  for(const n of ast.body) {
    if(n.type==='FunctionDeclaration') names.push([n.id.name,true]);
    if(n.type==='VariableDeclaration') for(const d of n.declarations) if(d.id.type==='Identifier') names.push([d.id.name,n.kind!=='const']);
  }
  if(!names.length)return source;
  return source+'\nif (globalThis.__PKM_TEST_REGISTER__) globalThis.__PKM_TEST_REGISTER__(Object.getOwnPropertyDescriptors({\n'+
    names.map(([name,writable])=>`get ${name}(){return ${name};}${writable?`, set ${name}(value){${name}=value;}`:''}`).join(',\n')+'\n}));\n';
}
function sourcePlugin({dataPath,worker=false,testMode=false}={}) {
  return {name:'application-inputs',setup(build){
    build.onLoad({filter:/[\\/]runtime[\\/]game-data\.js$/},()=>({contents:worker ? 'export const PKM_DATA = WORKER_GAME_DATA;'
      : dataPath ? `export { PKM_DATA } from '${dataPath}';` : 'export const PKM_DATA = undefined;',loader:'js'}));
    if(dataPath)build.onResolve({filter:/data\.[a-f0-9]{12}\.js$/},args=>({path:args.path,external:true}));
    if(testMode) build.onLoad({filter:/[\\/]src[\\/]js[\\/].*\.js$/},args=>({contents:testBindingSource(fs.readFileSync(args.path,'utf8')),loader:'js'}));
  }};
}
export async function buildApplication({outdir,dataPath,standalone=false,testMode=false}={}) {
  return bundle({absWorkingDir:ROOT,entryPoints:['src/main.js'],outdir:outdir || path.join(ROOT,'dist/assets'),
    bundle:true,splitting:!standalone,format:standalone?'iife':'esm',platform:'browser',target:'es2020',charset:'utf8',
    entryNames:'app.[hash]',chunkNames:'[name].[hash]',write:false,metafile:true,
    // Preserve readable function names; tree shaking still follows actual imports.
    minify:false,legalComments:'inline',plugins:[sourcePlugin({dataPath,testMode})]});
}
export async function buildReverseWorker() {
  const built=await bundle({absWorkingDir:ROOT,stdin:{contents:`
    import { revCalcState } from './src/js/04-40-revcalc-state.js';
    import { cloneCalcValue } from './src/js/03-10-calc-state.js';
    import { rcAnalyzeCached } from './src/js/04-42-revcalc-candidates.js';
    export function analyze(snapshot) {
      Object.assign(revCalcState,cloneCalcValue(snapshot));
      return rcAnalyzeCached();
    }`,resolveDir:ROOT,sourcefile:'reverse-entry.js'},bundle:true,format:'iife',globalName:'ReverseAnalyzer',platform:'browser',target:'es2020',charset:'utf8',write:false,plugins:[sourcePlugin({worker:true})]});
  // Keep the existing init/analyze protocol and inference/caching behavior.
  return `function createReverseAnalyzer(WORKER_GAME_DATA) {\n${built.outputFiles[0].text}\nreturn ReverseAnalyzer.analyze;\n}\n
let reverseAnalyze = null;
self.onmessage = event => {
  const message = event.data || {};
  if (message.type === 'init') {
    try { reverseAnalyze = createReverseAnalyzer(message.data); self.postMessage({type:'ready'}); }
    catch(error) { self.postMessage({type:'error',id:message.id,message:error?.message || String(error)}); }
    return;
  }
  if(message.type !== 'analyze') return;
  try {
    if(!reverseAnalyze) throw new Error('역계산 Worker가 초기화되지 않았습니다.');
    const result=reverseAnalyze(message.state || {});
    self.postMessage({type:'result',id:message.id,result});
  } catch(error) { self.postMessage({type:'error',id:message.id,message:error?.message || String(error)}); }
};\n`;
}
export async function buildStandalone({output=path.join(ROOT,STANDALONE_NAME),inputs=null,testMode=false}={}) {
  const {data,template,css}=inputs || buildInputs();
  const [app,worker]=await Promise.all([buildApplication({standalone:true,testMode}),buildReverseWorker()]);
  const replacements={'/* __INLINE_CSS__ */':css,'// __INLINE_JS__':app.outputFiles[0].text,
    '__REVERSE_WORKER_SOURCE__':inlineJson(worker)};
  DATA_FIELDS.forEach((field,i)=>replacements[DATA_TOKENS[i]]=inlineJson(data[field]));
  let html=template;
  for(const [token,value]of Object.entries(replacements))html=html.split(token).join(value);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
  return {html,data,worker,output};
}
