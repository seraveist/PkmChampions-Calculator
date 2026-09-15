// Black-box checks of uninstrumented production output, including native ESM
// loading, real picker interaction, lazy pages and the unchanged Worker API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC=process.argv.includes('--public');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const candidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',path.join(process.env.PROGRAMFILES||'','Google/Chrome/Application/chrome.exe')].filter(Boolean);
const chromePath=candidates.find(fs.existsSync);
if(!chromePath)throw new Error('A real Chromium browser is required for module validation.');
const dist=path.join(ROOT,'dist');
const manifest=PUBLIC?JSON.parse(fs.readFileSync(path.join(dist,'deploy-manifest.json'),'utf8')):null;
const csp=PUBLIC?fs.readFileSync(path.join(dist,'_headers'),'utf8').match(/Content-Security-Policy:\s*([^\n]+)/)?.[1]:'';
const server=PUBLIC?http.createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  const file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){response.writeHead(404).end();return;}
  response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  response.setHeader('Content-Security-Policy',csp);response.setHeader('X-Content-Type-Options','nosniff');
  response.end(fs.readFileSync(file));
}):null;
if(server)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pkm-prod-modules-'));
const flags=['--headless=new','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'];
if(process.argv.includes('--disable-browser-sandbox'))flags.unshift('--no-sandbox');
const child=spawn(chromePath,flags,{stdio:['ignore','ignore','pipe']});
let diagnostic='';child.stderr.on('data',chunk=>diagnostic+=chunk.toString());
let socket;const pending=new Map();let serial=0;const errors=[];
async function waitFor(fn,timeout=15000){const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await fn();if(value)return value;await sleep(60);}throw new Error('Timed out waiting for production UI: '+diagnostic.slice(-1000));}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},45000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
function pass(label){console.log('[PASS] '+label);}
try {
  await waitFor(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')));
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  socket.on('message',bytes=>{const message=JSON.parse(bytes);if(message.id){const p=pending.get(message.id);if(!p)return;clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);});
  await send('Runtime.enable');await send('Page.enable');
  const url=PUBLIC?`http://127.0.0.1:${server.address().port}/`:pathToFileURL(path.join(ROOT,'pokemon-champions-calculator-v3.html')).href;
  const navigation=await send('Page.navigate',{url});assert(!navigation.errorText,navigation.errorText);
  await waitFor(()=>evaluate('document.querySelectorAll(".move-row").length===4'));
  assert.deepEqual(await evaluate('[typeof state,typeof powerUiRefresh,typeof PKM_DATA,typeof __PKM_TEST_REGISTER__]'),['undefined','undefined','undefined','undefined']);
  assert.equal(await evaluate('document.querySelectorAll(\'script[id^="data-"]\').length'),PUBLIC?0:7);
  pass('production starts without test instrumentation or application globals');
  assert.equal(await evaluate('performance.getEntriesByType("resource").filter(e=>/feature-(dex|matchup|finetune|revcalc)\\./.test(e.name)).length'),0);
  pass('optional feature code is not requested on calculator startup');
  async function choose(trigger,id){await evaluate(`document.querySelector(${JSON.stringify(trigger)}).click()`);await waitFor(()=>evaluate(`!!document.querySelector('.picker-dialog[open] [data-id="${id}"]')`));await evaluate(`document.querySelector('.picker-dialog[open] [data-id="${id}"]').click()`);}
  await choose('#atk-body [data-cb-type="pokemon"]','garchomp');
  await choose('#def-body [data-cb-type="pokemon"]','dragonite');
  await choose('[data-move-row="0"] .move-select','dragonclaw');
  const before=await evaluate('document.querySelector("[data-move-row=\\"0\\"] .damage-raw").textContent');
  const after=await evaluate(`(() => {const rows=[...document.querySelectorAll('.move-row')], input=document.querySelector('#atk-body [data-calc-ev="atk"]');input.value='32';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return {same:rows.every((row,i)=>row===document.querySelectorAll('.move-row')[i]),text:rows[0].querySelector('.damage-raw').textContent};})()`);
  assert(after.same);assert.notEqual(after.text,before);pass('real production picker/input updates damage and retains result rows');
  for(const key of ['dex','matchup','finetune','revcalc']) {
    await evaluate(`document.getElementById('nav-${key}').click()`);
    await waitFor(()=>evaluate(`document.querySelector('.nav-tab.active')?.dataset.page==='${key}'`));
    pass('native optional page loads: '+key);
  }
  if(PUBLIC) {
    const expression=`(async () => {
      const {PKM_DATA}=await import(${JSON.stringify(manifest.assets.data.path)});
      const {api}=await import(${JSON.stringify(manifest.assets.featureRevcalc.path)});
      const snapshot=structuredClone(api.revCalcState);
      Object.assign(snapshot.my,{pokemonIdx:'primarina',ability:'torrent',types:['Water','Fairy']});
      snapshot.opp.pokemonIdx='archaludon';snapshot.myMove='moonblast';snapshot.myMoveSet=['moonblast','','',''];snapshot.observedTheirPct='35';snapshot.oppMove='';snapshot.observedMyHp='';snapshot.includeForecast=true;
      return new Promise((resolve,reject)=>{
        const worker=new Worker(${JSON.stringify(manifest.assets.worker.path)});
        const timer=setTimeout(()=>{worker.terminate();reject(new Error('production worker timeout'));},30000);
        worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message));};
        worker.onmessage=event=>{const message=event.data;if(message.type==='ready')worker.postMessage({type:'analyze',id:1,state:snapshot});else if(message.type==='result'){clearTimeout(timer);worker.terminate();resolve({error:message.result.error,total:message.result.total,forecast:!!message.result.forecast});}else if(message.type==='error'){clearTimeout(timer);worker.terminate();reject(new Error(message.message));}};
        worker.postMessage({type:'init',data:PKM_DATA});
      });
    })()`;
    const result=await evaluate(expression);assert(!result.error,JSON.stringify(result));assert(result.total>0 && result.forecast,JSON.stringify(result));
    pass('production worker retains full candidate inference and forecast behavior');
  }
  assert.equal(errors.length,0,JSON.stringify(errors));pass('no production runtime exceptions');
} finally {
  for(const p of pending.values())clearTimeout(p.timer);
  socket?.close();child.kill();server?.close();
  await sleep(250);fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
