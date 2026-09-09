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

    const report=[];
    await client.evaluate('globalThis.__reverseUnknownItems='+process.argv.includes('--unknown-items'));
    await client.evaluate("activateMainPage('revcalc', { updateHash: false })",true);
    await client.evaluate("revCalcState.my=makeSideState('garchomp'); revCalcState.opp={pokemonIdx:'typhlosion',ranks:{atk:0,def:0,spa:0,spd:0,spe:0},status:'none'}; revCalcState.myMove='dragonclaw'; revCalcState.myMoveSet=['dragonclaw','earthquake','rockslide','firefang']; revCalcState.oppMove='eruption'; revCalcState.predictedOppMove='eruption'; revCalcState.oppItemKnown=globalThis.__reverseUnknownItems?'unknown':''; revCalcState.observedTheirPct='54'; revCalcState.observedMyHp='154'; revCalcState.turnOrder='my-first'; renderRevCalcAll(); document.getElementById('rcAnalyze').click();");
    const started=Date.now();
    check(await client.evaluate("!!revCalcState.analyzing"),'analysis runs without blocking the page');
    await waitFor(()=>client.evaluate("!revCalcState.analyzing"),60000);
    const result=await client.evaluate("({error:revCalcState.results?.error,total:revCalcState.results?.total,timings:revCalcState.results?.timings,forecast:revCalcState.results?.results?.[0]?.cardReport?.my?.[0]?.summary,h32:revCalcState.results?.results?.[0]?.hpEv})");
    check(result.total>0 && !!result.forecast,'worker returns matching candidates and the full forecast',JSON.stringify(result));
    report.push({analysisMs:Date.now()-started,unknownItems:process.argv.includes('--unknown-items'),...result});
    for(const width of [1440,375,320]) {
      await setViewport(client,width,1000);
      await client.evaluate("document.querySelector('#rc-input-panel details').open=true; document.getElementById('rc-input-panel').scrollIntoView({block:'start'})");
      await captureScreenshot(client,'reverse-exchange-inputs-'+width);
      const layout=await client.evaluate("({overflow:document.documentElement.scrollWidth-innerWidth,buttons:document.querySelectorAll('button.rc-result-rank').length,missingConditions:['myStartHp','oppStartHpPct','oppAbilityKnown'].filter(k=>!document.querySelector('[data-rc-action=\"'+k+'\"]'))})");
      check(layout.overflow<=1,'no horizontal overflow at '+width+'px',JSON.stringify(layout));
      check(layout.buttons>0 && !layout.missingConditions.length,'candidate buttons and optional observation inputs at '+width+'px');
      await client.evaluate("document.getElementById('rc-results-panel').scrollIntoView({block:'start'})");
      await captureScreenshot(client,'reverse-exchange-results-'+width);
      const clipped = await client.evaluate("[...document.querySelectorAll('.rc-reference-moves input, .rc-followup-damage')].filter(e=>e.getBoundingClientRect().width>0 && (e.scrollWidth>e.clientWidth+1 || e.getBoundingClientRect().right>e.closest('.rc-exchange-summary,.rc-followup-chip').getBoundingClientRect().right+1)).map(e=>({text:e.value||e.innerText,width:e.clientWidth,scroll:e.scrollWidth}))");
      check(clipped.length===0,'card damage and comparison controls fit at '+width+'px',JSON.stringify(clipped));
      report.push({width,...layout});
    }
    await client.evaluate("revCalcState.openResultIndexes=[];renderRevCalcResults();document.querySelector('button.rc-result-rank').focus()");
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    check(await client.evaluate("document.querySelector('button.rc-result-rank').getAttribute('aria-expanded')==='true'"),'Enter expands a candidate');
    await client.evaluate("rcSetMovePickerValue('knownOppMove','flamethrower',0);renderRevCalcResults()");
    await waitFor(()=>client.evaluate("!!revCalcState.results?.forecast && !revCalcState.results?.pendingForecastKey"),60000);
    check(await client.evaluate("revCalcState.results.results[0].cardReport.opp.some(r=>r.move.id==='flamethrower') && document.querySelector('.rc-prediction-panel').innerText.includes('화염방사')"),'known opponent moves refresh cards through the worker');
    check(await client.evaluate("!!document.querySelector('.rc-next-state') && document.querySelector('.rc-followup-damage').innerText.includes('%')"),'cards show final state and damage ranges');
    await installAxe(client);
    await checkAxe(client, 'reverse rebuilt cards');
    await client.evaluate("document.documentElement.dataset.theme='dark'");
    await checkAxe(client, 'reverse rebuilt cards in dark theme');
    await captureScreenshot(client,'reverse-exchange-dark');
    await client.evaluate("document.documentElement.dataset.theme='light'");
    await client.evaluate("const e=document.querySelector('[data-rc-action=\"observedTheirPct\"]');e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));");
    await sleep(100);
    check(await client.evaluate("revCalcState.results===null && revCalcState.resultsStale"),'editing observed HP removes stale conclusions');
    await client.evaluate("revCalcState.observedTheirPct='54';renderRevCalcInputs();document.getElementById('rcAnalyze').click();var changedInput=document.querySelector('[data-rc-action=\"observedTheirPct\"]');changedInput.value='53';changedInput.dispatchEvent(new Event('input',{bubbles:true}));");
    await sleep(100);
    check(await client.evaluate("!revCalcState.analyzing && !revCalcState.results"),'changed inputs cancel a running analysis');
    await client.evaluate("revCalcState.observedTheirPct='54';renderRevCalcInputs();document.getElementById('rcAnalyze').click();document.getElementById('rcNewObservation').click();");
    await sleep(150);
    check(await client.evaluate("!revCalcState.analyzing&&!revCalcState.results&&revCalcState.myMoveSet[0]==='dragonclaw'&&revCalcState.observedMyHp===''&&!revCalcState.opp.pokemonIdx&&rcKnownOpponentMoves().length===0"),'new observation cancels pending work, clears observations and preserves the build');
    const exceptions=browserErrors.filter(e=>!/(net::ERR|Failed to load resource|favicon|pokeapi|pokemonshowdown)/i.test(e));
    check(!exceptions.length,'no runtime exceptions',exceptions.join(' | '));
    writeFileSync(path.join(ROOT,'docs/reverse-exchange-browser-verification.json'),JSON.stringify(report,null,2)+'\n');
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
