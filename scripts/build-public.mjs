import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, buildInputs, buildApplication, buildReverseWorker, DATA_FIELDS } from './build-artifacts.mjs';

export async function buildPublic({dist=path.join(ROOT,'dist'),adFree=false,privateTest=false,testMode=false}={}) {
const DIST=dist, ASSETS=path.join(DIST,'assets');
const PRIVATE_TEST=privateTest, AD_FREE=adFree, RAIL_FREE=PRIVATE_TEST || AD_FREE;
if (PRIVATE_TEST && AD_FREE) throw new Error('Choose either --private-test or --ad-free, not both.');
const {data,template,css,themeMatch}=buildInputs();
// Start from the source template and normalized object, never a standalone file.
let html=template;
rmSync(DIST,{recursive:true,force:true});mkdirSync(ASSETS,{recursive:true});
function asset(name,extension,content) {
  const normalized=content.endsWith('\n')?content:content+'\n';
  const file=`${name}.${createHash('sha256').update(normalized).digest('hex').slice(0,12)}.${extension}`;
  writeFileSync(path.join(ASSETS,file),normalized);
  return record(file,normalized);
}
function record(file,content) {
  return {file,path:`./assets/${file}`,sizeBytes:Buffer.byteLength(content),gzipBytes:gzipSync(content).byteLength};
}
function writeStaticFile(name,content) { writeFileSync(path.join(DIST,name),content.trimEnd()+'\n'); }
const dataAsset=asset('data','js',`const PKM_DATA = ${JSON.stringify(data)};\nexport { PKM_DATA };`);
const themeAsset=asset('theme','js',themeMatch[1].trim());
const styleAsset=asset('app','css',css);
const [compiled,worker]=await Promise.all([
  buildApplication({outdir:ASSETS,dataPath:`./${dataAsset.file}`,testMode}),buildReverseWorker(),
]);
const workerAsset=asset('reverse-worker','js',worker);
const assets={theme:themeAsset,style:styleAsset,data:dataAsset,worker:workerAsset};
let appAsset;
let sharedIndex=0;
for(const output of compiled.outputFiles) {
  const file=path.basename(output.path);writeFileSync(output.path,output.contents);
  const meta=compiled.metafile.outputs[path.relative(ROOT,output.path).split(path.sep).join('/')];
  const entry=meta?.entryPoint || '';
  const recordEntry=record(file,output.text);
  if(entry==='src/main.js') assets.app=appAsset=recordEntry;
  else if(/src\/features\/feature-(dex|matchup|finetune|revcalc)\.js$/.test(entry)) {
    const page=entry.match(/feature-(.+)\.js$/)[1];assets['feature'+page[0].toUpperCase()+page.slice(1)]=recordEntry;
  } else assets[`shared${++sharedIndex}`]=recordEntry;
}
if(!appAsset)throw new Error('Application module output is missing.');
html=html.replace(themeMatch[0],`<script src="${themeAsset.path}"></script>`);
html=html.replace(/<style>[\s\S]*?<\/style>/,`<link rel="stylesheet" href="${styleAsset.path}">`);
for(const id of DATA_FIELDS)html=html.replace(new RegExp(`<script id="data-${id}" type="application/json">[\\s\\S]*?<\\/script>`),'');
html=html.replace(/<script id="reverse-worker-source" type="application\/json">[\s\S]*?<\/script>/,`<script id="reverse-worker-source" type="application/json" data-worker-src="${workerAsset.path}"></script>`);
html=html.replace('<script id="page-feature-assets" type="application/json"></script>','');
html=html.replace(/<script>\s*"use strict";[\s\S]*?<\/script>/,`<script type="module" src="${appAsset.path}"></script>`);
if(RAIL_FREE) {
  html=html.replace(/\s*<aside class="(?:ad-rail|side-rail)[^"]*"[\s\S]*?<\/aside>\s*/g,'\n');
  html=html.replace('<body>','<body class="deployment-rail-free">');
}
const indexPath = path.join(DIST, 'index.html');
writeFileSync(indexPath, html, 'utf8');
writeStaticFile('404.html', `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,follow">
  <title>페이지를 찾을 수 없습니다 · Pokémon Champions Calculator</title>
  <link rel="stylesheet" href="/${styleAsset.path.replace(/^\.\//, '')}">
</head>
<body>
  <main class="app-content">
    <section class="ui-panel" aria-labelledby="notFoundTitle">
      <h1 id="notFoundTitle" class="ui-panel-title">페이지를 찾을 수 없습니다</h1>
      <p>주소를 다시 확인하거나 계산기 첫 화면으로 돌아가 주세요.</p>
      <p><a class="btn primary" href="/">계산기로 돌아가기</a></p>
    </section>
  </main>
</body>
</html>`);

writeStaticFile('robots.txt', PRIVATE_TEST
  ? `User-agent: *\nDisallow: /`
  : `User-agent: *\nAllow: /`);
writeStaticFile('_redirects', `/pokemon-champions-calculator-v3.html / 301`);

const indexingHeaders = PRIVATE_TEST
  ? `  X-Robots-Tag: noindex, noarchive, nosnippet\n`
  : '';
writeStaticFile('_headers', `/*
${indexingHeaders}  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://raw.githubusercontent.com; font-src 'self' data:; connect-src 'none'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

const deployMode = PRIVATE_TEST ? 'private-test' : AD_FREE ? 'public-ad-free' : 'public';
const manifest = {
  artifact: 'index.html',
  source: 'src/calc-template.html',
  architecture: 'esm-direct',
  mode: deployMode,
  generatedAt: new Date().toISOString(),
  sizeBytes: statSync(indexPath).size,
  deployRoot: 'dist',
  host: 'static',
  assets,
  notes: [
    'The offline standalone artifact remains pokemon-champions-calculator-v3.html.',
    'HTML, CSS, core application code, plain-object data, page features, and the lazy reverse-analysis worker are emitted as separate static assets.',
    'Hashed assets are safe to cache immutably.',
    PRIVATE_TEST
      ? 'Search indexing and advertising rails are disabled for the private test deployment.'
      : AD_FREE
        ? 'Search indexing is enabled and advertising rails are omitted from the Cloudflare Pages deployment.'
        : 'Search indexing and advertising rails remain enabled for the advertising-ready public deployment.',
  ],
};
writeStaticFile('deploy-manifest.json', JSON.stringify(manifest, null, 2));
return manifest;

}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const manifest=await buildPublic({adFree:process.argv.includes('--ad-free'),privateTest:process.argv.includes('--private-test')});
    console.log(`Direct ${manifest.mode} output: ${manifest.sizeBytes} bytes HTML, ${Object.keys(manifest.assets).length} module/assets`);
  } catch(error){console.error(error);process.exitCode=1;}
}
