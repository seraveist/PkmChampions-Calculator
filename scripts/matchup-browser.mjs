// Dex checks against the actual public or standalone browser build.
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


    const report = [];
    await client.evaluate("activateMainPage('matchup', {updateHash:true})",true);
    check(await client.evaluate("!document.getElementById('matchupMeta') && !document.getElementById('data-meta-threats') && typeof META_THREATS==='undefined'"),'fixed-opponent evaluation is absent');
    await client.evaluate("matchupSetSlotPokemon(0,'charizard');renderMatchupSlots();renderMatchupTable()");
    check(await client.evaluate("document.querySelectorAll('#matchupBody tr').length===18 && document.querySelectorAll('#matchupHead th').length===3"),'one Pokemon shows all 18 defense rows');
    await client.evaluate("document.querySelector('[data-matchup-mode=coverage]').click()");
    check(await client.evaluate("document.getElementById('matchupBody').innerText.includes('공격 기술을 입력') && !document.querySelector('.coverage-miss') && document.querySelectorAll('.matchup-coverage-card').length===1"),'empty moves display an input prompt and only selected Pokemon get move cards');
    await client.evaluate("(() => {document.querySelector('.matchup-move-input').click();const input=document.querySelector('.picker-dialog input');input.value='웨더볼';input.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await sleep(100);
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await sleep(150);
    check(await client.evaluate("matchupCoverageMoves[0][0]==='weatherball' && coverageCountByType('Normal')===1"),'keyboard search selects Weather Ball and updates the table',JSON.stringify(await client.evaluate("({moves:matchupCoverageMoves[0],legal:PokemonById[matchupSlots[0]].ls.includes('weatherball'),focus:document.activeElement.outerHTML,options:[...document.querySelectorAll('.combobox-option')].slice(-5).map(e=>e.textContent)})")));
    check(await client.evaluate("document.activeElement.matches('.matchup-move-input') && document.activeElement.value==='웨더볼'"),'selecting a move preserves keyboard focus');
    await client.evaluate("(() => {const select=document.getElementById('matchup-weather');select.value='Rain';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    check(await client.evaluate("coverageCountByType('Water')===1 && coverageCountByType('Normal')===0 && document.querySelector('.matchup-move-type-slot').innerText==='물'"),'weather selector updates the move badge and type distribution');
    await client.evaluate("document.querySelector('.matchup-move-clear').click()");
    check(await client.evaluate("!matchupCoverageMoves[0][0] && !document.querySelector('.matchup-move-type-slot').innerText && document.querySelector('.matchup-move-clear').disabled"),'clearing the selected move clears its type badge');
    await client.evaluate("matchupCoverageMoves[0][0]='weatherball';renderMatchupCoverageInputs();renderMatchupTable()");
    await client.evaluate("matchupSetSlotPokemon(1,'blastoise');renderMatchupSlots();renderMatchupCoverageInputs();renderMatchupTable()");
    check(await client.evaluate("document.querySelectorAll('.coverage-pending').length===18 && document.getElementById('matchupLegend').innerText.includes('입력 1 / 2')"),'partially entered party distinguishes unknown from zero');
    await client.evaluate("document.querySelector('.matchup-move-clear:not(:disabled)').click()");
    check(await client.evaluate("!matchupCoverageMoves[0][0] && document.getElementById('matchupBody').innerText.includes('공격 기술을 입력')"),'clearing the last move restores the prompt');
    await client.evaluate("['charizard','blastoise','venusaur','snorlax','delphoxmega','vaporeon'].forEach((id,i)=>matchupSetSlotPokemon(i,id));matchupSetSlotPokemon(3,'snorlax',{abilityId:'thickfat'});matchupCoverageMoves[0]=['weatherball','flamethrower',null,null];matchupCoverageMoves[1]=['surf',null,null,null];renderMatchupSlots();renderMatchupCoverageInputs();renderMatchupTable()");
    for (const width of [1440,375,320]) {
      await setViewport(client,width,1000);
      for (const mode of ['defense','coverage']) {
        await client.evaluate(`document.querySelector('[data-matchup-mode=${mode}]').click();document.querySelector('#matchupSlots').scrollIntoView({block:'start'})`);
        await sleep(100);
        const layout=await client.evaluate(`(() => ({
          width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
          controls:[...document.querySelectorAll('#matchupSlots select')].map(el=>({
            label:el.selectedOptions[0]?.textContent,width:el.getBoundingClientRect().width,
            textWidth:el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight),
            left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right
          })),columns:document.querySelectorAll('#matchupHead th').length,
          hint:!document.getElementById('matchupScrollHint').hidden
        }))()`);
        check(layout.overflow<=1,'no page overflow for '+mode+' at '+width+'px',JSON.stringify(layout));
        check(layout.controls.every(c=>c.textWidth>=55&&c.left>=0&&c.right<=width+1),'form and ability controls have readable text space at '+width+'px',JSON.stringify(layout));
        check(layout.columns===8 && (width>760||layout.hint),'all six selected Pokemon remain reachable',JSON.stringify(layout));
        if (mode==='coverage') check(await client.evaluate("document.getElementById('matchupCoverageField').open=true;[...document.querySelectorAll('#matchupCoverageField select')].every(el=>el.getBoundingClientRect().width>=75&&el.getBoundingClientRect().right<=innerWidth)"),'weather and terrain controls stay readable at '+width+'px');
        report.push({mode,...layout});
        await captureScreenshot(client,'matchup-'+mode+'-'+width);
      }
    }
    await installAxe(client);
    for (const theme of ['light','dark']) {
      await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
      await sleep(300);
      for (const mode of ['defense','coverage']) {
        await client.evaluate(`document.querySelector('[data-matchup-mode=${mode}]').click()`);
        await sleep(300);
        await checkAxe(client,'matchup '+mode+' '+theme);
      }
    }
    await captureScreenshot(client,'matchup-coverage-dark');
    await client.evaluate("document.documentElement.dataset.theme='light';document.querySelector('[data-matchup-mode=defense]').click()");
    check(await client.evaluate("(() => { const row=[...document.querySelectorAll('#matchupBody tr')].find(r=>r.querySelector('.t-Fire'));return row.children[4].innerText.includes('0.5×')&&row.children[4].innerText.includes('두꺼운지방'); })()"),'defense cells show the corrected multiplier and ability together');
    await client.evaluate("document.querySelector('.matchup-slot-clear[data-slot=\"0\"]').click()");
    check(await client.evaluate("matchupSlots[0]===null && matchupCoverageMoves[0].every(x=>x===null) && coverageCountByType('Fire')===0"),'removing a Pokemon clears its moves and counts');
    const exceptions=browserErrors.filter(e=>!/(net::ERR|Failed to load resource|favicon|pokeapi|pokemonshowdown)/i.test(e));
    check(!exceptions.length,'no runtime exceptions',exceptions.join(' | '));
    writeFileSync(path.join(ROOT,'docs/matchup-browser-verification.json'),JSON.stringify(report,null,2)+'\n');
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
