// Dex checks against the actual public or standalone browser build.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { verifyCalculatorSampleDetails } from './calculator-sample-details.mjs';
import { verifyCalculatorSampleComponents } from './calculator-sample-components.mjs';
import { verifyCalculatorSamplePickerAlignment } from './calculator-sample-picker-alignment.mjs';
import { reviewCalculatorSampleMarkup } from './calculator-sample-final-review.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC_MODE = true;
const AD_FREE = process.argv.includes('--ad-free');
const REQUIRE_BROWSER = process.argv.includes('--require-browser') || process.env.CI === 'true';
const DISABLE_BROWSER_SANDBOX = process.argv.includes('--disable-browser-sandbox') || process.env.UI_SMOKE_DISABLE_SANDBOX === '1';
const PUBLIC_ROOT = path.join(ROOT, 'dist');
const HTML_PATH = PUBLIC_MODE
  ? path.join(PUBLIC_ROOT, 'calculator-sample.html')
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
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(dir));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Temporary browser profile is outside the expected directory.');
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
  const url = `${publicServer.url}calculator-sample.html`;
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
      () => client.evaluate(`window.calculatorSampleReady === true`),
      10000,
    ).catch(() => false);
    if (!appReady) console.error('Startup state:', await client.evaluate(`({url:location.href, title:document.title, ready:document.readyState, scripts:[...document.scripts].map(s=>s.src), body:document.body?.innerText?.slice(0,400)})`));
    check(appReady, `${PUBLIC_MODE ? 'public' : 'standalone'} app runtime initializes`, browserErrors.join(' | '));
    if (PUBLIC_MODE && AD_FREE) {
      const advertisingRailCount = await client.evaluate(`document.querySelectorAll('.ad-rail, .side-rail').length`);
      check(advertisingRailCount === 0, 'ad-free public runtime contains no advertising rails', String(advertisingRailCount));
    }



    const report = [];
    await installAxe(client);
    if (process.argv.includes('--final-review-only')) {
      const finalReview=await reviewCalculatorSampleMarkup({client,setViewport});
      writeFileSync(path.join(ROOT,'docs/calculator-sample-final-review.json'),JSON.stringify(finalReview,null,2)+'\n');
      check(!finalReview.issues.length,'final HTML and responsive-boundary review',JSON.stringify(finalReview.issues));
      return;
    }
    if (process.argv.includes('--picker-review-only')) {
      const pickerAlignment=await verifyCalculatorSamplePickerAlignment({client,check,setViewport,captureScreenshot,sleep});
      writeFileSync(path.join(ROOT,'docs/calculator-sample-picker-alignment-review.json'),JSON.stringify(pickerAlignment,null,2)+'\n');
      return;
    }
    for (const [width,height] of [[1440,1080],[1024,900],[768,1024],[700,900],[430,932],[375,900],[320,900]]) {
      await setViewport(client,width,height);
      await client.evaluate("scrollTo(0,0)");
      const layout = await client.evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,resultY:document.getElementById('damage-results').getBoundingClientRect().top,inputs:[...document.querySelectorAll('[data-ev],[data-rank]')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,visible:e.checkVisibility()})),fieldClosed:!document.getElementById('field-panel').open})`);
      check(layout.scrollWidth<=width+1, width+'px has no page overflow',JSON.stringify(layout));
      check(layout.inputs.length===22 && layout.inputs.every(e=>e.visible && e.width>=30 && e.height>=38),width+'px keeps both EV and rank tables open');
      check(layout.fieldClosed,'field controls remain collapsed at '+width);
      report.push(layout);
      await captureScreenshot(client,'calculator-sample-'+width+'-light');
      if ([1440,375,320].includes(width)) await checkAxe(client,'sample '+width+' light');
      check(await client.evaluate(`Array.from(document.querySelectorAll('.ko strong')).every(el => {
        const row=el.closest('.move-row'),damage=row.querySelector('.damage-amount'),probability=el.parentElement.querySelector('.ko-probability');
        const style=getComputedStyle(el),rect=el.getBoundingClientRect();
        const center=box=>box.top+box.height/2;
        return el.scrollWidth<=el.clientWidth && style.fontSize===getComputedStyle(damage).fontSize && Math.abs(rect.height-parseFloat(style.lineHeight))<1 && ['.move-select','.move-settings-button'].every(selector=>Math.abs(center(rect)-center(row.querySelector(selector).getBoundingClientRect()))<1) && (!probability || (parseFloat(getComputedStyle(probability).fontSize)<parseFloat(style.fontSize) && probability.getBoundingClientRect().top>=rect.bottom && probability.getBoundingClientRect().bottom<=row.getBoundingClientRect().bottom));
      })`),width+'px centers the large KO headline with selection and settings while keeping the smaller probability below and inside the row');
      if ([1440,375,320].includes(width)) {
        await client.evaluate('sampleOpenMoveSettings(0)');
        const popup = await client.evaluate(`(() => {
          const row = document.querySelector('.move-settings-primary');
          const controls = [row.querySelector('input[type=number]'),row.querySelector('select'),row.querySelector('.check')].map(el=>el.getBoundingClientRect());
          return {singleRow:Math.max(...controls.map(r=>r.top))-Math.min(...controls.map(r=>r.top))<2,overflow:row.scrollWidth>row.clientWidth,dialogHeight:document.getElementById('move-settings').getBoundingClientRect().height};
        })()`);
        check(popup.singleRow && !popup.overflow,width+'px aligns power, type and critical on one popup row',JSON.stringify(popup));
        await captureScreenshot(client,'calculator-sample-conditions-'+width);
        if (width===320) await checkAxe(client,'compact mobile conditions');
        await client.evaluate("document.getElementById('move-settings').close()");
      }
    }
    await client.evaluate("document.getElementById('damage-results').scrollIntoView()");
    await waitFor(() => client.evaluate("scrollY>0 && document.getElementById('damage-results').getBoundingClientRect().top<innerHeight*.4"),2000);
    await captureScreenshot(client,'calculator-sample-320-results');
    for (const width of [1440,375]) {
      await setViewport(client,width,1000);
      await client.evaluate("sampleTheme('dark');scrollTo(0,0)");
      await sleep(300);
      await checkAxe(client,'sample '+width+' dark');
      await captureScreenshot(client,'calculator-sample-'+width+'-dark');
    }
    await client.evaluate("sampleTheme('light')");
    const dropdownReview = [];
    for (const width of [700,375,320]) {
      await setViewport(client,width,900);
      await client.evaluate("document.getElementById('field-panel').open=true;document.getElementById('field-panel').scrollIntoView({block:'start'})");
      await sleep(80);
      dropdownReview.push(await client.evaluate(`({width:innerWidth,kind:'field',selectTops:[...document.querySelectorAll('#field-controls>label select')].map(e=>e.getBoundingClientRect().top),height:document.getElementById('field-panel').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth})`));
      await captureScreenshot(client,'calculator-sample-field-'+width);
      await client.evaluate("document.getElementById('field-panel').open=false");
      for (const kind of ['pokemon','move','item','ability','nature']) {
        await client.evaluate(`document.querySelector('[data-pick="${kind}"][data-side="atk"]').click()`);
        const detail = await client.evaluate(`(() => {
          const dialog=document.getElementById('picker');
          const list=document.getElementById('picker-options');
          const rows=[...list.querySelectorAll('.picker-option')];
          const search=document.querySelector('.picker-search');
          return {width:innerWidth,kind:dialog.dataset.kind,rows:rows.length,maxRowHeight:Math.max(...rows.map(e=>e.getBoundingClientRect().height)),overflow:list.scrollWidth>list.clientWidth,focusRadius:getComputedStyle(search).borderRadius,inputOutline:getComputedStyle(document.getElementById('picker-search')).outlineStyle};
        })()`);
        dropdownReview.push(detail);
        await captureScreenshot(client,'calculator-sample-'+kind+'-list-'+width);
        if (width===375) await checkAxe(client,'one-line '+kind+' picker');
        await client.evaluate("document.getElementById('picker').close()");
      }
    }
    writeFileSync(path.join(ROOT,'docs/calculator-sample-dropdown-review.json'),JSON.stringify(dropdownReview,null,2)+'\n');
    const hpDamage = await client.evaluate("sampleCalculateSlot(0).result.damages");
    check(hpDamage.some(n=>n>0),'ground immunity is annotated without zeroing decisive power');
    check(await client.evaluate("document.querySelector('[data-move-row=\"0\"] .move-notes').textContent.includes('무효')"),'immunity is visible in its result row');
    check(await client.evaluate("document.querySelector('[data-move-row=\"1\"] .ko').textContent.includes('타')"),'KO label includes hit count');
    check(await client.evaluate("document.querySelector('[data-move-row=\"0\"] .ko strong').textContent==='난수 2타' && document.querySelector('[data-move-row=\"0\"] .ko-probability').textContent==='18.4% 확률' && !document.querySelector('[data-move-row=\"1\"] .ko-probability')"),'random KO separates probability from its headline while certain KO omits probability');
    check(await client.evaluate("document.querySelector('[data-move-row=\"0\"] .effect-note').textContent==='땅 무효' && !document.getElementById('move-rows').textContent.includes('피해 산출 제외')"),'result tags use concise immunity wording');
    await client.evaluate(`let ev=document.querySelector('[data-side="atk"][data-ev="atk"]');ev.value='0';ev.dispatchEvent(new Event('change',{bubbles:true}));`);
    const lessDamage = await client.evaluate("sampleCalculateSlot(0).result.damages");
    check(Math.max(...lessDamage)<Math.max(...hpDamage),'editing attack EV immediately recalculates damage');
    await client.evaluate(`let he=document.querySelector('[data-side="atk"][data-ev="hp"]');he.value='32';he.dispatchEvent(new Event('change',{bubbles:true}));let ae=document.querySelector('[data-side="atk"][data-ev="atk"]');ae.value='32';ae.dispatchEvent(new Event('change',{bubbles:true}));`);
    check(await client.evaluate("Object.values(state.atk.evs).reduce((a,b)=>a+b,0)===66 && state.atk.evs.atk===2"),'EV total is capped at 66 without changing other allocations');
    await client.evaluate(`let rank=document.querySelector('[data-side="atk"][data-rank="atk"]');rank.value='2';rank.dispatchEvent(new Event('change',{bubbles:true}));`);
    check(await client.evaluate("state.atk.ranks.atk===2"),'rank editing is connected');
    await client.evaluate("document.querySelector('[data-pick=move][data-slot=\"0\"]').click();document.getElementById('picker-search').value='불꽃';document.getElementById('picker-search').dispatchEvent(new Event('input',{bubbles:true}))");
    await checkAxe(client,'mobile move search');
    await captureScreenshot(client,'calculator-sample-picker');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    check(await client.evaluate("!document.getElementById('picker').open && state.atk.moves[0]==='firefang'"),'search Enter selects a legal move and closes the picker');
    check(await client.evaluate("document.activeElement.dataset.pick==='move'"),'move picker restores keyboard focus');
    await client.evaluate("document.querySelector('[data-move-settings=\"0\"]').click();document.querySelector('[data-slot=moveCriticalOverrides]').click()");
    check(await client.evaluate("state.atk.moveCriticalOverrides[0] && document.querySelector('[data-move-row=\"0\"]').textContent.includes('급소')"),'move conditions update the result');
    await checkAxe(client,'move condition dialog');
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await waitFor(() => client.evaluate("!document.getElementById('move-settings').open && document.activeElement.dataset.moveSettings==='0'"),2000);
    check(await client.evaluate("!document.getElementById('move-settings').open && document.activeElement.dataset.moveSettings==='0'"),'Escape closes conditions and restores focus');
    await client.evaluate("document.getElementById('field-panel').open=true;document.querySelector('[data-field=weather]').value='Rain';document.querySelector('[data-field=weather]').dispatchEvent(new Event('change',{bubbles:true}))");
    check(await client.evaluate("state.field.weather==='Rain' && document.getElementById('field-summary').textContent.includes('비')"),'weather control updates field and summary');
    await checkAxe(client,'expanded field');
    await captureScreenshot(client,'calculator-sample-field');
    const recovery = await client.evaluate(`(() => { sampleSetPokemon('atk','garchomp'); sampleSetPokemon('def','dragonite'); state.atk.moves=['dragonclaw']; state.def.ability='innerfocus'; state.def.item='leftovers'; sampleRenderSides(); sampleRefresh({fields:true}); return {ko:sampleCalculateSlot(0).ko, text:document.querySelector('[data-move-row="0"]').textContent}; })()`);
    check(recovery.ko.sub.includes('회복') && recovery.text.includes('회복'),'multi-hit KO output includes observed recovery item adjustment',JSON.stringify(recovery));
    await client.evaluate("document.getElementById('swap-sides').click()");
    check(await client.evaluate("state.atk.pokemonIdx==='dragonite' && state.def.pokemonIdx==='garchomp'"),'swap exchanges full participant settings');
    await client.evaluate("document.querySelector('[data-pick=pokemon][data-side=def]').click();document.getElementById('picker-search').value='보만다';document.getElementById('picker-search').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-choice=salamence]').click()");
    check(await client.evaluate("state.def.pokemonIdx==='salamence' && !document.getElementById('picker').open && document.getElementById('entry-effects').textContent.includes('위협')"),'changing species resets its configuration and applies entry ability');
    const details=await verifyCalculatorSampleDetails({client,check,setViewport,captureScreenshot,checkAxe,sleep});
    writeFileSync(path.join(ROOT,'docs/calculator-sample-details-review.json'),JSON.stringify(details,null,2)+'\n');
    const components=await verifyCalculatorSampleComponents({client,check,setViewport,captureScreenshot,checkAxe,sleep});
    writeFileSync(path.join(ROOT,'docs/calculator-sample-components-review.json'),JSON.stringify(components,null,2)+'\n');
    const pickerAlignment=await verifyCalculatorSamplePickerAlignment({client,check,setViewport,captureScreenshot,sleep});
    writeFileSync(path.join(ROOT,'docs/calculator-sample-picker-alignment-review.json'),JSON.stringify(pickerAlignment,null,2)+'\n');
    const exceptions=browserErrors.filter(e=>!/(net::ERR|Failed to load resource|favicon|pokeapi|pokemonshowdown)/i.test(e));
    check(!exceptions.length,'no runtime exceptions',exceptions.join(' | '));
    writeFileSync(path.join(ROOT,'docs/calculator-sample-verification.json'),JSON.stringify(report,null,2)+'\n');
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
