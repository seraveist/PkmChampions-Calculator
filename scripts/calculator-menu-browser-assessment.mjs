// Calculator regression checks derived from the original read-only assessment.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC_MODE = process.argv.includes('--public');
const AD_FREE = process.argv.includes('--ad-free');
const REQUIRE_BROWSER = process.argv.includes('--require-browser') || process.env.CI === 'true';
const DISABLE_BROWSER_SANDBOX = process.argv.includes('--disable-browser-sandbox') || process.env.UI_SMOKE_DISABLE_SANDBOX === '1';
const PUBLIC_ROOT = path.join(ROOT, 'dist');
const HTML_PATH = PUBLIC_MODE
  ? path.join(PUBLIC_ROOT, 'index.html')
  : path.join(ROOT, 'pokemon-champions-calculator-v3.html');
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

async function startPublicServer() {
  const headersSource = readFileSync(path.join(PUBLIC_ROOT, '_headers'), 'utf8');
  const csp = headersSource.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]?.trim();
  if (!csp) throw new Error('Public build CSP header was not found.');

  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(PUBLIC_ROOT, relative);
    if (!file.startsWith(`${path.resolve(PUBLIC_ROOT)}${path.sep}`) || !existsSync(file)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType(file),
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(readFileSync(file));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

function chromeCandidates() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return [
      process.env.CHROME_PATH,
      path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    ];
  }
  return [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

function findChrome() {
  return chromeCandidates().filter(Boolean).find(existsSync) || '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeTempProfile(dir) {
  if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()))) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`[WARN] Could not remove temporary Chrome profile: ${error.message}`);
        return;
      }
      await sleep(250 * (attempt + 1));
    }
  }
}

async function waitForFile(file, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(file)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function waitFor(predicate, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(80);
  }
  throw new Error('Timed out waiting for browser state');
}

class CdpClient {
  constructor(url, timeoutMs = 12000) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closedError = null;
  }

  rejectPending(error) {
    if (this.closedError) return;
    this.closedError = error;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', async event => {
      try {
        const raw = typeof event.data === 'string'
          ? event.data
          : typeof event.data?.text === 'function'
            ? await event.data.text()
            : Buffer.from(event.data).toString('utf8');
        const message = JSON.parse(raw);
        if (!message.id) {
          for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
          return;
        }
        if (!this.pending.has(message.id)) return;
        const { resolve, reject, timer } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } catch (error) {
        this.rejectPending(new Error(`Invalid browser debugging message: ${error.message}`));
      }
    });
    this.socket.addEventListener('close', () => {
      this.rejectPending(new Error('Browser debugging connection closed unexpectedly'));
    });
    this.socket.addEventListener('error', event => {
      const detail = event?.error?.message || event?.message || '';
      this.rejectPending(new Error(`Browser debugging connection failed${detail ? `: ${detail}` : ''}`));
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
      this.socket.addEventListener('close', () => reject(new Error('Browser debugging connection closed before opening')), { once: true });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    if (this.closedError) return Promise.reject(this.closedError);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`Browser debugging connection is unavailable for ${method}`));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Browser command timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result?.value;
  }

  close() {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error('Browser debugging client closed'));
    }
    this.pending.clear();
    this.socket?.close();
  }
}

function check(condition, label, detail = '') {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  console.log(`[PASS] ${label}`);
}

async function setViewport(client, width, height) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 760,
  });
  await sleep(80);
}

async function captureScreenshot(client, name) {
  const outputDir = process.env.UI_SMOKE_SCREENSHOT_DIR;
  if (!outputDir) return;
  mkdirSync(outputDir, { recursive: true });
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function installAxe(client) {
  await client.evaluate(AXE_SOURCE);
  check(await client.evaluate(`typeof axe?.run === 'function'`), 'axe accessibility runtime is available');
}

async function checkAxe(client, label) {
  const violations = await client.evaluate(`axe.run(document, { resultTypes: ['violations'] }).then(result => (
    result.violations
      .filter(violation => ['critical', 'serious', 'moderate'].includes(violation.impact))
      .map(violation => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.slice(0, 3).map(node => ({
          target: node.target.join(' '),
          summary: node.failureSummary,
        })),
      }))
  ))`, true);
  check(violations.length === 0, `${label} has no critical, serious, or moderate accessibility violations`, JSON.stringify(violations));
}

async function main() {
  check(existsSync(HTML_PATH), `${PUBLIC_MODE ? 'public index' : 'generated HTML'} exists`);
  const chrome = findChrome();
  if (!chrome) {
    if (REQUIRE_BROWSER) throw new Error('Chrome/Edge executable is required but was not found.');
    console.log('[SKIP] Chrome/Edge executable was not found; browser layout smoke did not run.');
    return;
  }

  const publicServer = PUBLIC_MODE ? await startPublicServer() : null;
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'pkmchampions-ui-'));
  const activePortFile = path.join(userDataDir, 'DevToolsActivePort');
  const url = `${publicServer?.url || pathToFileURL(HTML_PATH).href}#calc`;
  const browserArgs = [
    '--headless=new',
    '--disable-gpu-sandbox',
    '--disable-gpu-shader-disk-cache',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
  ];
  if (DISABLE_BROWSER_SANDBOX) browserArgs.push('--no-sandbox');
  browserArgs.push('about:blank');
  const browser = spawn(chrome, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let browserDiagnostics = '';
  browser.stderr?.on('data', chunk => {
    if (browserDiagnostics.length < 16000) browserDiagnostics += chunk.toString();
  });

  let client;
  try {
    await waitForFile(activePortFile);
    const [port] = readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
    const targets = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        return response.ok ? response.json() : null;
      } catch (_) {
        return null;
      }
    });
    const target = targets.find(item => item.type === 'page');
    check(target?.webSocketDebuggerUrl, 'browser page target is available');

    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    const browserErrors = [];
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Runtime exception');
    });
    client.on('Log.entryAdded', ({ entry }) => {
      if (entry?.level === 'error') browserErrors.push(`${entry.text}${entry.url ? ` (${entry.url})` : ''}`);
    });
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Log.enable');
    await client.send('Page.navigate', { url });
    await sleep(200);
    await waitFor(() => client.evaluate(`document.readyState === 'complete'`));
    const appReady = await waitFor(
      () => client.evaluate(`typeof applyPokemonToCalcSide === 'function'`),
      10000,
    ).catch(() => false);
    if (!appReady) console.error('Startup state:', await client.evaluate(`({url:location.href, title:document.title, ready:document.readyState, scripts:[...document.scripts].map(s=>s.src), body:document.body?.innerText?.slice(0,400)})`));
    check(appReady, `${PUBLIC_MODE ? 'public' : 'standalone'} app runtime initializes`, browserErrors.join(' | '));
    if (PUBLIC_MODE && AD_FREE) {
      const advertisingRailCount = await client.evaluate(`document.querySelectorAll('.ad-rail, .side-rail').length`);
      check(advertisingRailCount === 0, 'ad-free public runtime contains no advertising rails', String(advertisingRailCount));
    }

    const findings=[];
    for(const width of [1440,375,320]) {
      await setViewport(client,width,1000);
      for(const scenario of ['immuneRecovery','multihitRecovery','plain','randomImmune','manyModifiers','fourMoves','fickleAuto','fickleBoost','counter','fling','spitup','mcAura','mcGem','mcSeed']) {
        const observation=await client.evaluate('('+async function(scenario){
          state.field=makeFieldState();autoEntryEffects=false;
          if(scenario==='multihitRecovery'){
            state.atk=makeSideState('kangaskhanmega');state.atk.ability='parentalbond';state.atk.moves=['icepunch'];
            state.def=makeSideState('dragonite');state.def.ability='multiscale';state.def.item='sitrusberry';
          } else {
            state.atk=makeSideState('pikachu');state.atk.moves=['thunderbolt'];state.def=makeSideState(scenario==='plain'?'snorlax':'garchomp');
            if(scenario!=='plain')state.def.item='sitrusberry';
          }
          if(scenario==='randomImmune')setSideCurrentHp(state.def,20);
          if(scenario==='manyModifiers') {
            state.atk=makeSideState('kingambit');state.atk.ability='supremeoverlord';state.atk.fallenAllies=2;state.atk.moves=['kowtowcleave'];state.atk.ranks.atk=2;state.atk.item='lifeorb';
            state.def=makeSideState('snorlax');state.def.item='leftovers';state.def.ranks.def=2;state.field.atkHelpingHand=true;state.field.defReflect=true;state.field.allyFriendGuard=true;state.field.ruinSword=true;
          }
          if(scenario==='fourMoves') {
            state.atk=makeSideState('typhlosion');state.atk.moves=['eruption','flamethrower','solarbeam','willowisp'];setSideHpPct(state.atk,.5);
          }
          if(scenario==='fickleAuto'||scenario==='fickleBoost') {
            state.atk=makeSideState('hydrapple');state.atk.moves=['ficklebeam'];state.atk.fickleBeamMode=scenario==='fickleAuto'?'auto':'boosted';state.def=makeSideState('snorlax');setSideCurrentHp(state.def,100);
          }
          if(scenario==='counter') {state.atk=makeSideState('charizard');state.atk.moves=['counter'];state.atk.receivedDamage=51;state.atk.receivedDamageCategory='Physical';state.def=makeSideState('snorlax');}
          if(scenario==='fling') {state.atk=makeSideState('charizard');state.atk.moves=['fling'];state.atk.item='sitrusberry';state.def=makeSideState('snorlax');}
          if(scenario==='spitup') {state.atk=makeSideState('arbok');state.atk.moves=['spitup'];state.atk.stockpileCount=3;state.def=makeSideState('snorlax');}
          if(scenario==='mcAura') {state.atk=makeSideState('golisopodmega');state.atk.ability='toughclaws';state.atk.moves=['firstimpression'];state.def=makeSideState('lucariomegaz');state.def.ability='auraguard';}
          if(scenario==='mcGem') {state.atk=makeSideState('thievul');state.atk.ability='unburden';state.atk.item='normalgem';state.atk.moves=['hypervoice'];state.def=makeSideState('baxcalibur');}
          if(scenario==='mcSeed') {state.atk=makeSideState('rillaboom');state.atk.item='grassyseed';state.atk.moves=['grassyglide'];state.def=makeSideState('persianalola');state.field.terrain='Grassy';}
          renderSide('atk');renderSide('def');runCalc();
          if(scenario==='mcAura' && !document.body.textContent.includes('파동의방호')) throw new Error('M-C Aura Guard Korean name not rendered');
          if(scenario==='mcGem' && !document.body.textContent.includes('이후 소비 상태')) throw new Error('M-C Normal Gem consumption condition not rendered');
          if(scenario==='mcSeed' && !document.body.textContent.includes('시드 발동은 자동 적용하지 않습니다')) throw new Error('M-C seed input guidance not rendered');
          const card=document.querySelector('.calc-result-card');card.scrollIntoView({block:'center'});
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          const box=card.getBoundingClientRect();const children=[...card.querySelectorAll('.calc-result-card-head,.calc-effect-notes,.calc-ko-details,.calc-damage-range,.calc-damage-meta,.calc-ko-badge')].map(node=>{
            const r=node.getBoundingClientRect();return {className:node.className,text:node.textContent.replace(/\s+/g,' ').trim(),top:r.top-box.top,bottom:r.bottom-box.top,height:r.height,withinCard:r.bottom<=box.bottom+1&&r.top>=box.top-1,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,overflow:getComputedStyle(node).overflow};
          });
          const geometryIssues=[];
          for(const c of document.querySelectorAll('.calc-result-card')) {
            const bounds=c.getBoundingClientRect();
            const nodes=[...c.querySelectorAll('.calc-result-card-head,.calc-effect-notes,.calc-ko-details,.calc-damage-range,.calc-damage-meta,.calc-ko-badge')];
            for(const node of nodes) {
              const r=node.getBoundingClientRect();
              if(r.bottom>bounds.bottom+1||r.top<bounds.top-1||r.right>bounds.right+1||r.left<bounds.left-1)geometryIssues.push(node.className+' outside card');
              if(node.scrollHeight>node.clientHeight+1)geometryIssues.push(node.className+' overflows its own height');
            }
            for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++) {
              const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();
              if(Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1)geometryIssues.push('overlap '+nodes[i].className+' / '+nodes[j].className);
            }
          }
          const head=document.querySelector('.calc-results-head').getBoundingClientRect();
          for(const button of document.querySelectorAll('.calc-results-actions button'))if(button.getBoundingClientRect().bottom>head.bottom+1)geometryIssues.push('result actions outside header');
          for(const row of document.querySelectorAll('#atk-body .tool-move-row')) {
            const input=row.querySelector('[data-action="moveBp"]');if(input&&input.getBoundingClientRect().width<30)geometryIssues.push('power input is too narrow');
            const b=row.getBoundingClientRect();for(const node of row.children){const r=node.getBoundingClientRect();if(r.bottom>b.bottom+1||r.right>b.right+1)geometryIssues.push('move input outside row '+node.className);}
          }
          return {geometryIssues, chance:document.querySelector('.calc-ko-percent')?.textContent, pageOverflow:document.documentElement.scrollWidth-window.innerWidth, height:box.height,scrollHeight:card.scrollHeight,clientHeight:card.clientHeight,overflow:getComputedStyle(card).overflow,children,
            fieldScopeHidden:document.querySelector('.calc-field-scope-note').getClientRects().length===0,
            fallenAlliesInputs:document.querySelectorAll('[data-action="fallenAllies"]').length,
            summary:document.querySelector('#calcMobileSummary').textContent.replace(/\s+/g,' ').trim()};
        }.toString()+')('+JSON.stringify(scenario)+')',true);
        findings.push({width,scenario,...observation});
        check(!observation.geometryIssues.length, width+'px '+scenario+' card and input geometry',JSON.stringify(observation.geometryIssues));
        check(!observation.fieldScopeHidden&&observation.pageOverflow<=1,width+'px '+scenario+' policy visible and no horizontal overflow');
        if(scenario==='randomImmune')check(observation.chance&&observation.summary.includes(observation.chance),width+'px mobile summary preserves random KO probability');
        if(scenario==='immuneRecovery')check(observation.summary.includes('무효 조건 제외'),width+'px mobile summary preserves immunity condition');
        if(scenario==='immuneRecovery')await captureScreenshot(client,'completed-result-'+width);
        if(scenario==='fickleAuto')await captureScreenshot(client,'special-fickle-'+width);
      }
    }
    writeFileSync(path.join(ROOT,'docs/calculator-menu-browser-verification.json'),JSON.stringify(findings,null,2)+'\n');
    await setViewport(client,320,1000);
    const inputs=await client.evaluate('('+async function(){
      const change=(selector,value)=>{const el=document.querySelector(selector);if(!el||!el.getClientRects().length)throw Error('Unreachable input '+selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
      state.atk=makeSideState('kingambit');state.atk.ability='supremeoverlord';state.atk.moves=['kowtowcleave'];state.def=makeSideState('basculegion');state.def.moves=['lastrespects'];state.field=makeFieldState();autoEntryEffects=false;
      renderSide('atk');renderSide('def');runCalc();
      const before=document.querySelector('.calc-damage-actual-value').textContent;
      change('[data-action="fallenAllies"][data-side="atk"]','2');change('[data-action="fallenAllies"][data-side="def"]','2');
      const after=document.querySelector('.calc-damage-actual-value').textContent;
      const speed=effectiveSpeed(state.atk,state.field,state.def);change('[data-field="tailwind"][data-side="atk"]',true);change('[data-field="tailwind"][data-side="def"]',true);
      const wind=effectiveSpeed(state.atk,state.field,state.def)===speed*2;
      const fallen=state.atk.fallenAllies===2&&state.def.fallenAllies===2&&before!==after;
      // Use the actual field combobox and its delegated option-selection event.
      document.querySelector('#calc-field-panel').classList.remove('collapsed');
      const selectFormat=async(id)=>{
        document.querySelector('[data-cb-type="gameType"]').click();await new Promise(r=>requestAnimationFrame(r));
        const option=document.querySelector('.combobox-options-portal.open [data-id="'+id+'"]')||document.querySelector('.combobox-options.open [data-id="'+id+'"]');
        if(!option)throw Error('Missing format option '+id);option.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));option.click();
      };
      await selectFormat('Doubles');change('[data-action="fallenAllies"][data-side="atk"]','3');change('[data-action="fallenAllies"][data-side="def"]','3');
      const doubles=state.atk.fallenAllies===3&&state.def.fallenAllies===3;
      await selectFormat('Singles');const clamped=state.atk.fallenAllies===2&&state.def.fallenAllies===2;
      document.getElementById('btnResetManual').click();const reset=!state.atk.tailwind&&!state.def.tailwind&&!state.atk.fallenAllies&&!state.def.fallenAllies;
      state.atk=makeSideState('typhlosion');state.atk.moves=['eruption'];state.def=makeSideState('snorlax');setSideHpPct(state.atk,.5);renderSide('atk');renderSide('def');runCalc();
      change('[data-action="moveBp"][data-side="atk"][data-slot="0"]','150');
      const manual=document.querySelector('.calc-applied-power').textContent.includes('수동 · 입력 150 → 보정 위력 150');
      const button=document.querySelector('[data-action="moveBpAuto"][data-side="atk"][data-slot="0"]');const reachable=!!button.getClientRects().length&&!button.disabled;button.click();
      const restored=state.atk.moveBpOverrides[0]===null&&document.querySelector('.calc-applied-power').textContent.includes('보정 위력 74');
      state.atk=makeSideState('machamp');state.atk.moves=['seismictoss'];renderSide('atk');runCalc();const fixed=document.querySelector('#atk-body .tool-move-power-readout b').textContent==='고정 50'&&document.querySelector('[data-action="moveBp"][data-side="atk"]').disabled;
      const inputWidth=document.querySelector('[data-action="moveBp"][data-side="atk"]').getBoundingClientRect().width>=30;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      state.atk=makeSideState('hydrapple');state.atk.moves=['ficklebeam'];state.def=makeSideState('snorlax');setSideCurrentHp(state.def,100);renderSide('atk');renderSide('def');runCalc();
      const autoChance=document.querySelector('.calc-ko-percent').textContent==='24.4%';
      change('[data-field="fickleBeamMode"][data-side="atk"]','boosted');const boosted=document.querySelector('.calc-damage-actual-value').textContent==='97-115'&&document.getElementById('calcMobileSummary').textContent.includes('강화 조건 고정');
      change('[data-field="fickleBeamMode"][data-side="atk"]','normal');const normal=document.querySelector('.calc-damage-actual-value').textContent==='49-58';
      state.atk=makeSideState('charizard');state.atk.moves=['counter'];state.def=makeSideState('snorlax');renderSide('atk');renderSide('def');runCalc();
      const missingDamage=document.getElementById('calc-results-body').textContent.includes('피해량을 입력');
      change('[data-action="receivedDamage"][data-side="atk"]','51');const returnedDamage=document.querySelector('.calc-damage-actual-value').textContent==='102-102';
      change('[data-field="receivedDamageCategory"][data-side="atk"]','Special');const categoryGate=document.getElementById('calc-results-body').textContent.includes('물리 공격을 받은 조건');
      change('[data-field="receivedDamageCategory"][data-side="atk"]','Physical');change('[data-action="receivedDamage"][data-side="atk"]','');const emptyInput=state.atk.receivedDamage===null&&document.getElementById('calc-results-body').textContent.includes('피해량을 입력');
      const counterPowerBlocked=document.querySelector('[data-action="moveBp"][data-side="atk"]').disabled;
      state.atk=makeSideState('arbok');state.atk.moves=['spitup'];renderSide('atk');runCalc();const stockpileGate=document.getElementById('calc-results-body').textContent.includes('비축 횟수');
      change('[data-field="stockpileCount"][data-side="atk"]','3');const stockpile=document.querySelector('.calc-applied-power').textContent.includes('300');
      state.atk=makeSideState('charizard');state.atk.moves=['fling'];state.atk.item='ironball';renderSide('atk');runCalc();const fling=document.querySelector('.calc-applied-power').textContent.includes('130')&&document.querySelector('.calc-special-conditions').textContent.includes('다시 보유');
      document.getElementById('btnResetManual').click();const specialReset=state.atk.receivedDamage===null&&state.atk.stockpileCount===0&&state.atk.fickleBeamMode==='auto';
      return {fallen,wind,doubles,clamped,reset,manual,reachable,restored,fixed,inputWidth,autoChance,boosted,normal,missingDamage,returnedDamage,categoryGate,emptyInput,counterPowerBlocked,stockpileGate,stockpile,fling,specialReset};
    }.toString()+')()',true);
    for(const [name,passed] of Object.entries(inputs))check(passed,'320px UI control '+name,JSON.stringify(inputs));
    await installAxe(client);await checkAxe(client,'calculator repaired inputs 320px');
    await client.evaluate("document.querySelector('#atk-body .tool-move-panel').scrollIntoView({block:'center'})");
    await captureScreenshot(client,'completed-inputs-320');

  } catch (error) {
    const detail = browserDiagnostics.trim().split(/\r?\n/).slice(-6).join(' | ');
    if (detail) error.message = `${error.message} (${detail})`;
    throw error;
  } finally {
    if (client) {
      try {
        await Promise.race([client.send('Browser.close'), sleep(500)]);
      } catch (_) {}
    }
    client?.close();
    const browserExited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill();
    await Promise.race([browserExited, sleep(1500)]);
    await removeTempProfile(userDataDir);
    if (publicServer) await new Promise(resolve => publicServer.server.close(resolve));
  }
}

main().catch(error => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
