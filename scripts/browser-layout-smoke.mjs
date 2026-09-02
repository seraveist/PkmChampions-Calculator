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
      if (entry?.level === 'error') browserErrors.push(entry.text);
    });
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Log.enable');
    await client.send('Page.navigate', { url });
    await sleep(200);
    await waitFor(() => client.evaluate(`document.readyState === 'complete'`));
    const appReady = await waitFor(
      () => client.evaluate(`typeof applyPokemonToCalcSide === 'function'`),
      3000,
    ).catch(() => false);
    check(appReady, `${PUBLIC_MODE ? 'public' : 'standalone'} app runtime initializes`, browserErrors.join(' | '));
    if (PUBLIC_MODE && AD_FREE) {
      const advertisingRailCount = await client.evaluate(`document.querySelectorAll('.ad-rail, .side-rail').length`);
      check(advertisingRailCount === 0, 'ad-free public runtime contains no advertising rails', String(advertisingRailCount));
    }
    await installAxe(client);
    const initialFeatureRequests = await client.evaluate(`performance.getEntriesByType('resource').filter(entry => /feature-(?:dex|matchup|finetune|revcalc)\./.test(entry.name)).length`);
    check(initialFeatureRequests === 0, 'page feature bundles are not requested during calculator startup', String(initialFeatureRequests));
    const pageLoadUi = await client.evaluate(`(() => {
      const dexTab = document.getElementById('nav-dex');
      const calcTab = document.getElementById('nav-calc');
      const status = document.getElementById('pageLoadStatus');
      setMainPageLoadState(dexTab, 'loading', '도감 화면을 불러오는 중입니다.');
      const pending = {
        busy: dexTab?.getAttribute('aria-busy') || '',
        loading: dexTab?.classList.contains('is-loading') || false,
        statusVisible: !status?.hidden,
        live: status?.getAttribute('aria-live') || '',
      };
      setMainPageLoadState(calcTab);
      return {
        pending,
        cleared: !dexTab?.classList.contains('is-loading') && !!status?.hidden,
      };
    })()`);
    check(pageLoadUi.pending.busy === 'true' && pageLoadUi.pending.loading && pageLoadUi.pending.statusVisible && pageLoadUi.pending.live === 'polite', 'lazy page navigation exposes an accessible loading state', JSON.stringify(pageLoadUi));
    check(pageLoadUi.cleared, 'switching navigation clears a stale page loading state', JSON.stringify(pageLoadUi));

    await setViewport(client, 1440, 1000);
    const desktop = await client.evaluate(`(() => {
      applyPokemonToCalcSide('atk', 'charizard');
      applyPokemonToCalcSide('def', 'venusaur');
      state.atk.moves[0] = 'flamethrower';
      renderSide('atk');
      renderSide('def');
      triggerCalc();
      const page = document.getElementById('page-calc');
      const moveList = page.querySelector('#atk-body .tool-move-list--critical');
      const moveHeaders = [...moveList.querySelectorAll('.tool-move-head-row > span')]
        .map(cell => cell.textContent.trim());
      const moveReadout = moveList.querySelector('.tool-move-row .tool-move-power-readout');
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        headings: page.querySelectorAll('h2.ui-panel-title').length,
        resultCards: page.querySelectorAll('.calc-result-card').length,
        summaryHidden: document.getElementById('calcMobileSummary').hidden,
        detailToggleDisplay: getComputedStyle(document.querySelector('[data-calc-detail-toggle="atk"]')).display,
        moveLayout: {
          headers: moveHeaders,
          readoutWidth: moveReadout?.getBoundingClientRect().width || 0,
          readoutClipped: !!moveReadout && moveReadout.scrollWidth > moveReadout.clientWidth + 1,
          criticalVisible: getComputedStyle(moveList.querySelector('.calc-move-critical-input')).display !== 'none',
        },
      };
    })()`);
    check(desktop.overflow <= 1, 'desktop has no horizontal page overflow', String(desktop.overflow));
    check(desktop.headings >= 4, 'calculator uses semantic panel headings', String(desktop.headings));
    check(desktop.resultCards >= 1, 'calculator renders a damage result card');
    check(desktop.detailToggleDisplay === 'none', 'desktop hides the mobile detail toggle', desktop.detailToggleDisplay);
    check(
      desktop.moveLayout.headers.at(-2) === '급소' && desktop.moveLayout.headers.at(-1) === '결정력',
      'calculator move headers keep critical and power labels in the correct columns',
      JSON.stringify(desktop.moveLayout),
    );
    check(
      desktop.moveLayout.readoutWidth >= 90 && !desktop.moveLayout.readoutClipped && desktop.moveLayout.criticalVisible,
      'calculator reserves readable power output beside the critical checkbox',
      JSON.stringify(desktop.moveLayout),
    );
    const moveOptionPoint = await client.evaluate(`(async () => {
      const input = document.querySelector('#atk-body [data-cb-type="move"]');
      input?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const list = document.querySelector('.combobox-options-portal.open')
        || input?.closest('.combobox')?.querySelector('.combobox-options.open');
      const option = [...(list?.querySelectorAll('.combobox-option:not(.empty)') || [])]
        .find(candidate => {
          const candidateRect = candidate.getBoundingClientRect();
          const candidateX = candidateRect.left + candidateRect.width / 2;
          const candidateY = candidateRect.top + candidateRect.height / 2;
          const hitOption = document.elementFromPoint(candidateX, candidateY)?.closest('.combobox-option');
          return candidate.dataset.id
            && candidate.dataset.id !== state.atk.moves[0]
            && candidateRect.top >= 0
            && candidateRect.bottom <= window.innerHeight
            && hitOption === candidate;
        });
      const header = list?.querySelector('.move-option-header');
      const columnDelta = header && option
        ? Math.max(...[...header.children].map((cell, index) => {
            const headerRect = cell.getBoundingClientRect();
            const optionRect = option.children[index]?.getBoundingClientRect();
            return optionRect ? Math.max(Math.abs(headerRect.left - optionRect.left), Math.abs(headerRect.right - optionRect.right)) : 999;
          }))
        : 999;
      const rect = option?.getBoundingClientRect();
      if (!rect) return null;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        inputId: input?.id || '',
        optionId: option.dataset.id || '',
        selectedBefore: state.atk.moves[0] || '',
        hitClass: hit?.className || '',
        columnDelta,
        headerLayout: header ? {
          left: header.getBoundingClientRect().left,
          width: header.getBoundingClientRect().width,
          display: getComputedStyle(header).display,
          columns: getComputedStyle(header).gridTemplateColumns,
          padding: getComputedStyle(header).padding,
          borderLeft: getComputedStyle(header).borderLeftWidth,
          cells: [...header.children].map(cell => [cell.getBoundingClientRect().left, cell.getBoundingClientRect().right]),
        } : null,
        optionLayout: option ? {
          left: option.getBoundingClientRect().left,
          width: option.getBoundingClientRect().width,
          display: getComputedStyle(option).display,
          columns: getComputedStyle(option).gridTemplateColumns,
          padding: getComputedStyle(option).padding,
          borderLeft: getComputedStyle(option).borderLeftWidth,
          cells: [...option.children].map(cell => [cell.getBoundingClientRect().left, cell.getBoundingClientRect().right]),
        } : null,
      };
    })()`, true);
    check(!!moveOptionPoint, 'calculator exposes a selectable move option', JSON.stringify(moveOptionPoint));
    check(moveOptionPoint?.columnDelta <= 1, 'move dropdown header and option columns align', JSON.stringify(moveOptionPoint));
    if (moveOptionPoint) {
      const { x, y } = moveOptionPoint;
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
      await sleep(80);
      const comboboxAfterSelection = await client.evaluate(`(() => ({
        openLists: document.querySelectorAll('.combobox-options.open, .combobox-options-portal.open').length,
        expandedControls: document.querySelectorAll('.cb-input[aria-expanded="true"]').length,
        expandedIds: [...document.querySelectorAll('.cb-input[aria-expanded="true"]')].map(control => control.id || control.dataset.cbType || control.className),
        openOwners: [...document.querySelectorAll('.combobox-options.open, .combobox-options-portal.open')].map(list => list.dataset.portalOwner || list.closest('.combobox')?.dataset.cb || list.className),
        selectedAfter: state.atk.moves[0] || '',
      }))()`);
      check(
        comboboxAfterSelection.openLists === 0 && comboboxAfterSelection.expandedControls === 0,
        'move option click closes without opening a control behind the dropdown',
        JSON.stringify({ ...moveOptionPoint, ...comboboxAfterSelection }),
      );
    }
    const natureColumnDelta = await client.evaluate(`(async () => {
      const input = document.querySelector('#atk-body [data-cb-type="nature"]');
      input?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const list = document.querySelector('.combobox-options-portal.open')
        || input?.closest('.combobox')?.querySelector('.combobox-options.open');
      const header = list?.querySelector('.nature-option-header');
      const option = list?.querySelector('.combobox-option.nature-option:not(.empty)');
      const delta = header && option
        ? Math.max(...[...header.children].map((cell, index) => {
            const headerRect = cell.getBoundingClientRect();
            const optionRect = option.children[index]?.getBoundingClientRect();
            return optionRect ? Math.max(Math.abs(headerRect.left - optionRect.left), Math.abs(headerRect.right - optionRect.right)) : 999;
          }))
        : 999;
      option?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return delta;
    })()`, true);
    check(natureColumnDelta <= 1, 'nature dropdown header and option columns align', String(natureColumnDelta));
    const calculatorControlContract = await client.evaluate(`(() => {
      const typeControl = document.querySelector('#atk-body .tool-pokemon-meta-actions .type-pill-combobox:not(.type-none)');
      const typeInput = typeControl?.querySelector(':scope > .cb-input');
      const typeName = [...(typeControl?.classList || [])].find(name => name.startsWith('t-'))?.slice(2) || '';
      const typeProbe = document.createElement('span');
      typeProbe.className = typeName ? 't-' + typeName : '';
      typeProbe.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(typeProbe);
      const typeStyle = typeControl ? getComputedStyle(typeControl) : null;
      const inputStyle = typeInput ? getComputedStyle(typeInput) : null;
      const probeStyle = getComputedStyle(typeProbe);
      const powerControl = document.querySelector('#atk-body .tool-move-power-control');
      const powerInput = powerControl?.querySelector('.tool-move-power-input');
      const powerControlStyle = powerControl ? getComputedStyle(powerControl) : null;
      const powerInputStyle = powerInput ? getComputedStyle(powerInput) : null;
      const result = {
        typeName,
        typeControlBg: typeStyle?.backgroundColor || '',
        typeControlFg: typeStyle?.color || '',
        typeInputBg: inputStyle?.backgroundColor || '',
        typeInputFg: inputStyle?.color || '',
        typeProbeBg: probeStyle.backgroundColor,
        typeProbeFg: probeStyle.color,
        powerControlBorder: powerControlStyle?.borderTopWidth || '',
        powerInputBorder: powerInputStyle?.borderTopWidth || '',
        powerInputBg: powerInputStyle?.backgroundColor || '',
        powerInputShadow: powerInputStyle?.boxShadow || '',
      };
      typeProbe.remove();
      return result;
    })()`);
    check(
      !!calculatorControlContract.typeName
        && calculatorControlContract.typeControlBg === calculatorControlContract.typeProbeBg
        && calculatorControlContract.typeControlFg === calculatorControlContract.typeProbeFg
        && calculatorControlContract.typeInputBg === 'rgba(0, 0, 0, 0)'
        && calculatorControlContract.typeInputFg === calculatorControlContract.typeProbeFg,
      'selected Pokemon type controls retain their type palette',
      JSON.stringify(calculatorControlContract),
    );
    check(
      calculatorControlContract.powerControlBorder !== '0px'
        && calculatorControlContract.powerInputBorder === '0px'
        && calculatorControlContract.powerInputBg === 'rgba(0, 0, 0, 0)'
        && calculatorControlContract.powerInputShadow === 'none',
      'move power input renders as a single framed control',
      JSON.stringify(calculatorControlContract),
    );
    const fontContract = await client.evaluate(`(async () => {
      let loadStatus = 'loaded';
      try {
        await document.fonts.load('14px "Noto Sans KR"');
      } catch (error) {
        loadStatus = error?.name || 'unavailable';
      }
      const selectors = ['body', '.brand-sub', '.ui-stat-readout', 'input', 'button'];
      return {
        loadStatus,
        available: document.fonts.check('14px "Noto Sans KR"'),
        families: selectors.map(selector => [selector, getComputedStyle(document.querySelector(selector)).fontFamily]),
      };
    })()`, true);
    check(fontContract.families.every(([, family]) => family.includes('Noto Sans KR') && !/Fira Code|JetBrains Mono/.test(family)), 'all UI font roles declare Noto Sans KR', JSON.stringify(fontContract));
    const typeContracts = await client.evaluate(`(() => {
      const types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(probe);
      const contracts = Object.fromEntries(types.map(type => {
        const card = document.createElement('span');
        card.className = 't-' + type;
        const filter = document.createElement('button');
        filter.className = 'type-filter-btn type-pill-mini active';
        filter.dataset.filterType = type;
        document.getElementById('page-dex').appendChild(filter);
        probe.appendChild(card);
        const palette = partyPresetMoveTypePalette(type, {});
        const swatch = document.createElement('span');
        swatch.style.color = palette.bg;
        probe.appendChild(swatch);
        const cardStyle = getComputedStyle(card);
        const filterStyle = getComputedStyle(filter);
        const result = {
          cardBg: cardStyle.backgroundColor,
          cardFg: cardStyle.color,
          filterBg: filterStyle.backgroundColor,
          filterFg: filterStyle.color,
          exportBg: getComputedStyle(swatch).color,
          exportFg: palette.fg,
          filterAttr: filter.getAttribute('data-filter-type') || '',
          filterMatchesTypeRule: filter.matches('#page-dex .type-filter-btn.type-pill-mini:not([data-filter-type=""]).active'),
          filterTokenBg: filterStyle.getPropertyValue('--dex-filter-bg').trim(),
        };
        filter.remove();
        return [type, result];
      }));
      probe.remove();
      return contracts;
    })()`);
    const brightTypeNames = ['Electric', 'Ice', 'Ground', 'Flying', 'Bug', 'Steel', 'Fairy'];
    const defaultTypeNames = ['Normal', 'Fire', 'Water', 'Grass', 'Fighting', 'Poison', 'Psychic', 'Rock', 'Ghost', 'Dragon', 'Dark'];
    check(
      defaultTypeNames.every(type => typeContracts[type].cardFg === 'rgb(255, 255, 255)')
        && brightTypeNames.every(type => typeContracts[type].cardFg === 'rgb(26, 26, 26)'),
      'type cards use white text with dark text reserved for bright colors',
      JSON.stringify(typeContracts),
    );
    check(
      Object.values(typeContracts).every(type => type.cardBg === type.filterBg && type.cardBg === type.exportBg),
      'type cards, Dex filters, and party image exports share one background palette',
      JSON.stringify(typeContracts),
    );
    check(
      Object.values(typeContracts).every(type => type.cardFg === type.filterFg && type.cardFg === type.exportFg.replace('#ffffff', 'rgb(255, 255, 255)').replace('#1a1a1a', 'rgb(26, 26, 26)')),
      'type cards, Dex filters, and party image exports share one foreground palette',
      JSON.stringify(typeContracts),
    );
    const themeTokens = await client.evaluate(`(() => {
      const root = document.documentElement;
      const panel = document.querySelector('#page-calc .ui-panel');
      delete root.dataset.theme;
      const light = {
        canvas: getComputedStyle(root).getPropertyValue('--color-surface-canvas').trim(),
        body: getComputedStyle(document.body).backgroundColor,
        panel: getComputedStyle(panel).backgroundColor,
      };
      root.dataset.theme = 'dark';
      const dark = {
        canvas: getComputedStyle(root).getPropertyValue('--color-surface-canvas').trim(),
        body: getComputedStyle(document.body).backgroundColor,
        panel: getComputedStyle(panel).backgroundColor,
      };
      delete root.dataset.theme;
      return { light, dark };
    })()`);
    check(
      themeTokens.light.canvas && themeTokens.dark.canvas && themeTokens.light.canvas !== themeTokens.dark.canvas,
      'semantic surface tokens switch with the theme',
      JSON.stringify(themeTokens)
    );
    check(
      themeTokens.light.body !== themeTokens.dark.body && themeTokens.light.panel !== themeTokens.dark.panel,
      'legacy UI aliases resolve through semantic theme tokens',
      JSON.stringify(themeTokens)
    );
    await checkAxe(client, 'calculator');
    await captureScreenshot(client, 'calculator-desktop-1440');

    await setViewport(client, 375, 812);
    const mobile = await client.evaluate(`(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const body = document.getElementById('atk-body');
      const statPanel = body.querySelector('.calc-stat-panel');
      const compact = body.querySelector('.calc-compact-stats');
      const toggle = document.querySelector('[data-calc-detail-toggle="atk"]');
      const collapsed = {
        statDisplay: getComputedStyle(statPanel).display,
        compactDisplay: getComputedStyle(compact).display,
      };
      toggle.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const expanded = {
        statDisplay: getComputedStyle(statPanel).display,
        ariaExpanded: toggle.getAttribute('aria-expanded'),
      };
      const input = body.querySelector('[data-cb-type="pokemon"]');
      input.focus();
      input.click();
      await new Promise(resolve => setTimeout(resolve, 80));
      const options = document.querySelector('.combobox-options-portal.open') || input.closest('.combobox').querySelector('.combobox-options.open');
      const rect = options?.getBoundingClientRect();
      const header = options?.querySelector('.pokemon-option-header');
      const option = options?.querySelector('.combobox-option.pokemon-option:not(.empty)');
      const pokemonColumnDelta = header && option
        ? Math.max(...[...header.children].map((cell, index) => {
            const headerRect = cell.getBoundingClientRect();
            const optionRect = option.children[index]?.getBoundingClientRect();
            return optionRect ? Math.max(Math.abs(headerRect.left - optionRect.left), Math.abs(headerRect.right - optionRect.right)) : 999;
          }))
        : 999;
      const pokemonColumnWidths = option
        ? [...option.children].map(cell => Math.round(cell.getBoundingClientRect().width * 10) / 10)
        : [];
      input?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const moveInput = document.querySelector('#atk-body [data-cb-type="move"]');
      moveInput?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const moveOptions = document.querySelector('.tool-move-options-portal.open')
        || moveInput?.closest('.combobox')?.querySelector('.combobox-options.open');
      const moveOption = moveOptions?.querySelector('.combobox-option.move-option:not(.empty)');
      const moveColumnWidths = moveOption
        ? [...moveOption.children].map(cell => Math.round(cell.getBoundingClientRect().width * 10) / 10)
        : [];
      moveInput?.click();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        collapsed,
        expanded,
        dropdown: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
        pokemonColumnDelta,
        pokemonColumnWidths,
        moveColumnWidths,
        summaryVisible: !document.getElementById('calcMobileSummary').hidden,
      };
    })()`, true);
    check(mobile.overflow <= 1, 'mobile has no horizontal page overflow', String(mobile.overflow));
    check(mobile.collapsed.statDisplay === 'none' && mobile.collapsed.compactDisplay !== 'none', 'mobile starts with compact stat summary');
    check(mobile.expanded.statDisplay !== 'none' && mobile.expanded.ariaExpanded === 'true', 'mobile detail toggle reveals stat controls');
    check(mobile.dropdown && mobile.dropdown.left >= 0 && mobile.dropdown.right <= 375, 'mobile Pokemon dropdown stays inside viewport', JSON.stringify(mobile.dropdown));
    check(mobile.pokemonColumnDelta <= 1, 'Pokemon dropdown header and option columns align', JSON.stringify(mobile));
    check(
      mobile.pokemonColumnWidths.length === 8
        && mobile.pokemonColumnWidths.slice(2).every(width => width <= 22),
      'mobile Pokemon portal uses compact stat columns',
      JSON.stringify(mobile.pokemonColumnWidths),
    );
    check(
      mobile.moveColumnWidths.length === 4
        && mobile.moveColumnWidths.slice(1).every(width => width <= 32),
      'mobile move portal uses compact category, type, and power columns',
      JSON.stringify(mobile.moveColumnWidths),
    );
    check(mobile.summaryVisible, 'mobile recommendation summary is visible after calculation');
    await client.evaluate(`
      document.activeElement?.blur();
      document.querySelectorAll('.combobox-options.open').forEach(element => element.classList.remove('open'));
      document.querySelector('[data-calc-detail-toggle="atk"]')?.click();
    `);
    await captureScreenshot(client, 'calculator-mobile-375');

    const partyModalFocus = await client.evaluate(`(async () => {
      const trigger = document.getElementById('partyPresetOpen');
      const originalName = partyPresetData.parties[0].name;
      const hostileName = '\" autofocus onfocus=\"x';
      partyPresetData.parties[0].name = hostileName;
      trigger.focus();
      trigger.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const nameInput = document.querySelector('[data-party-name-index="0"]');
      const attributeEscaping = {
        valuePreserved: nameInput?.value === hostileName,
        autofocusInjected: nameInput?.hasAttribute('autofocus') || false,
        handlerInjected: nameInput?.hasAttribute('onfocus') || false,
        dataInjected: nameInput?.getAttribute('data-injected') || '',
      };
      partyPresetData.parties[0].name = originalName;
      const backdrop = document.querySelector('.party-preset-modal-backdrop');
      const modal = document.querySelector('.party-preset-modal');
      const backdropStyle = backdrop ? getComputedStyle(backdrop) : null;
      const backdropRect = backdrop?.getBoundingClientRect();
      const modalRect = modal?.getBoundingClientRect();
      const modalHead = modal?.querySelector('.party-preset-modal-head');
      const evInput = document.createElement('input');
      evInput.className = 'party-preset-ev-input';
      evInput.style.position = 'fixed';
      evInput.style.left = '-9999px';
      modal?.appendChild(evInput);
      const modalHeadStyle = modalHead ? getComputedStyle(modalHead) : null;
      const evInputRect = evInput?.getBoundingClientRect();
      evInput.remove();
      return {
        activeId: document.activeElement?.id || '',
        attributeEscaping,
        backdropOverflow: backdrop ? backdrop.scrollWidth - backdrop.clientWidth : 0,
        modalOverflow: modal ? modal.scrollWidth - modal.clientWidth : 0,
        backdropBox: backdropStyle ? {
          boxSizing: backdropStyle.boxSizing,
          width: backdropStyle.width,
          paddingLeft: backdropStyle.paddingLeft,
          paddingRight: backdropStyle.paddingRight,
          left: backdropRect?.left,
          right: backdropRect?.right,
        } : null,
        modalBox: modalRect ? { left: modalRect.left, right: modalRect.right, width: modalRect.width } : null,
        responsiveLayout: {
          headDirection: modalHeadStyle?.flexDirection || '',
          evWidth: evInputRect?.width || 0,
          evHeight: evInputRect?.height || 0,
        },
      };
    })()`, true);
    check(partyModalFocus.activeId === 'partyPresetClose', 'party preset modal receives initial focus', JSON.stringify(partyModalFocus));
    check(
      partyModalFocus.attributeEscaping?.valuePreserved
        && !partyModalFocus.attributeEscaping?.autofocusInjected
        && !partyModalFocus.attributeEscaping?.handlerInjected
        && !partyModalFocus.attributeEscaping?.dataInjected,
      'party preset names remain inert inside HTML attributes',
      JSON.stringify(partyModalFocus.attributeEscaping),
    );
    check(partyModalFocus.backdropOverflow <= 1 && partyModalFocus.modalOverflow <= 1, 'party preset modal fits the mobile viewport', JSON.stringify(partyModalFocus));
    check(
      partyModalFocus.responsiveLayout?.headDirection === 'column'
        && partyModalFocus.responsiveLayout.evWidth <= 34.5
        && partyModalFocus.responsiveLayout.evHeight === 32,
      'party preset mobile geometry wins over desktop defaults',
      JSON.stringify(partyModalFocus.responsiveLayout),
    );
    await checkAxe(client, 'party preset modal');
    const partyModalReturnFocus = await client.evaluate(`(async () => {
      document.getElementById('partyPresetClose')?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return document.activeElement?.id || '';
    })()`, true);
    check(partyModalReturnFocus === 'partyPresetOpen', 'party preset modal restores trigger focus', partyModalReturnFocus);

    const dex = await client.evaluate(`(async () => {
      await activateMainPage('dex', { updateHash: true });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const firstPageRows = [...document.querySelectorAll('#dexBodyPokemon tr[data-dex-id]')];
      const firstId = firstPageRows[0]?.dataset.dexId || '';
      const nextButton = document.querySelector('#dexPagination-pokemon [data-dex-page="2"]');
      nextButton?.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const secondPageRows = [...document.querySelectorAll('#dexBodyPokemon tr[data-dex-id]')];
      const controlHead = document.querySelector('#page-dex .dex-control-head');
      const tableWrap = document.querySelector('#dex-pokemon .dex-table-wrap');
      const firstCardRect = secondPageRows[0]?.getBoundingClientRect();
      const bstCell = secondPageRows[0]?.querySelector('.dex-bst');
      const bstRect = bstCell?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        firstCount: firstPageRows.length,
        secondCount: secondPageRows.length,
        firstId,
        secondId: secondPageRows[0]?.dataset.dexId || '',
        pageLabel: document.querySelector('#dexPagination-pokemon .dex-page-current')?.textContent?.trim() || '',
        cardDisplay: getComputedStyle(secondPageRows[0]).display,
        labeledStats: secondPageRows[0]?.querySelectorAll('td.num[data-label]').length || 0,
        controlOverflowY: controlHead ? getComputedStyle(controlHead).overflowY : '',
        tableOverflowY: tableWrap ? getComputedStyle(tableWrap).overflowY : '',
        tableMaxHeight: tableWrap ? getComputedStyle(tableWrap).maxHeight : '',
        bstLayout: bstRect && firstCardRect ? {
          cardLeft: firstCardRect.left,
          cardRight: firstCardRect.right,
          left: bstRect.left,
          right: bstRect.right,
          width: bstRect.width,
          gridColumn: getComputedStyle(bstCell).gridColumn,
        } : null,
        featureResources: performance.getEntriesByType('resource')
          .filter(entry => /feature-(?:dex|matchup|finetune|revcalc)\./.test(entry.name))
          .map(entry => entry.name.split('/').pop()),
      };
    })()`, true);
    check(dex.overflow <= 1, 'mobile dex has no horizontal page overflow', String(dex.overflow));
    check(dex.firstCount > 0 && dex.firstCount <= 24, 'dex limits the initial Pokemon DOM to 24 rows', JSON.stringify(dex));
    check(dex.secondCount > 0 && dex.secondCount <= 24 && dex.secondId !== dex.firstId, 'dex pagination renders the next Pokemon slice', JSON.stringify(dex));
    check(dex.pageLabel.startsWith('2 / '), 'dex pagination exposes the current page', dex.pageLabel);
    check(dex.cardDisplay === 'grid' && dex.labeledStats === 7, 'mobile dex renders labeled information cards', JSON.stringify(dex));
    check(dex.bstLayout && dex.bstLayout.left >= dex.bstLayout.cardLeft && dex.bstLayout.right <= dex.bstLayout.cardRight && dex.bstLayout.width > 120, 'mobile dex total stat stays inside the full card row', JSON.stringify(dex.bstLayout));
    check(dex.controlOverflowY === 'hidden' && dex.tableOverflowY === 'visible' && dex.tableMaxHeight === 'none', 'mobile dex uses one document scroll instead of nested vertical scrollers', JSON.stringify(dex));
    check(dex.featureResources.length <= 1 && (!dex.featureResources.length || dex.featureResources[0].startsWith('feature-dex.')), 'dex entry requests only its page feature bundle', JSON.stringify(dex.featureResources));
    const dexKeyboard = await client.evaluate(`(() => {
      const sortButton = document.querySelector('#dexTablePokemon th[data-sort="hp"] .dex-sort-button');
      sortButton.focus();
      sortButton.click();
      const header = sortButton.closest('th');
      const rowButton = document.querySelector('#dexBodyPokemon .dex-row-open');
      return {
        activeTag: document.activeElement?.tagName || '',
        ariaSort: header?.getAttribute('aria-sort') || '',
        rowButtonTag: rowButton?.tagName || '',
        rowButtonLabel: rowButton?.getAttribute('aria-label') || '',
      };
    })()`);
    check(dexKeyboard.activeTag === 'BUTTON' && ['ascending', 'descending'].includes(dexKeyboard.ariaSort), 'dex sorting exposes keyboard and aria-sort state', JSON.stringify(dexKeyboard));
    check(dexKeyboard.rowButtonTag === 'BUTTON' && dexKeyboard.rowButtonLabel.endsWith('상세 보기'), 'dex rows expose a keyboard detail action', JSON.stringify(dexKeyboard));
    await checkAxe(client, 'dex');

    await setViewport(client, 1440, 1000);
    const reverseDesktopStats = await client.evaluate(`(async () => {
      await activateMainPage('revcalc', { updateHash: false });
      revCalcState.my = makeSideState('charizard');
      renderRevCalcAll();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const grid = document.querySelector('#page-revcalc .rc-stats-grid');
      const headerCells = [...(grid?.querySelectorAll('.rc-stat-head-row > *') || [])];
      const rows = [...(grid?.querySelectorAll('.rc-stat-row') || [])];
      const firstCells = [...(rows[0]?.children || [])];
      const columnDelta = headerCells.length === firstCells.length && headerCells.length
        ? Math.max(...headerCells.map((cell, index) => {
            const headerRect = cell.getBoundingClientRect();
            const rowRect = firstCells[index].getBoundingClientRect();
            return Math.max(Math.abs(headerRect.left - rowRect.left), Math.abs(headerRect.right - rowRect.right));
          }))
        : 999;
      const myPanel = document.querySelector('#page-revcalc .rc-my')?.getBoundingClientRect();
      const oppPanel = document.querySelector('#page-revcalc .rc-opp')?.getBoundingClientRect();
      const guide = document.querySelector('#rc-input-body .ui-empty--compact')?.getBoundingClientRect();
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
        headerCells: headerCells.length,
        rowCells: rows.map(row => row.children.length),
        columnDelta,
        overflow: grid.scrollWidth - grid.clientWidth,
        panelTopDelta: myPanel && oppPanel ? Math.abs(myPanel.top - oppPanel.top) : 999,
        myPanelHeight: myPanel?.height || 0,
        oppPanelHeight: oppPanel?.height || 0,
        inputStage: document.getElementById('rc-input-panel')?.dataset.stageState || '',
        resultStage: document.getElementById('rc-results-panel')?.dataset.stageState || '',
        guideHeight: guide?.height || 999,
      };
    })()`, true);
    check(
      reverseDesktopStats.columns === 5
        && reverseDesktopStats.headerCells === 5
        && reverseDesktopStats.rowCells.every(count => count === 5)
        && reverseDesktopStats.columnDelta <= 1
        && reverseDesktopStats.overflow <= 1,
      'desktop reverse stat headers and five data columns align',
      JSON.stringify(reverseDesktopStats),
    );
    check(
      reverseDesktopStats.panelTopDelta <= 1
        && reverseDesktopStats.oppPanelHeight < reverseDesktopStats.myPanelHeight
        && reverseDesktopStats.inputStage === 'locked'
        && reverseDesktopStats.resultStage === 'locked'
        && reverseDesktopStats.guideHeight <= 80,
      'reverse panels align to the top and locked stages remain compact',
      JSON.stringify(reverseDesktopStats),
    );
    await captureScreenshot(client, 'reverse-desktop-1440');

    const breakpointLayouts = {};
    for (const width of [761, 760, 681, 680]) {
      await setViewport(client, width, 900);
      breakpointLayouts[width] = await client.evaluate(`(async () => {
        await activateMainPage('calc', { updateHash: false });
        const calcMovePanel = document.querySelector('#page-calc .tool-move-panel');
        const calcIndexWidth = getComputedStyle(calcMovePanel).getPropertyValue('--tool-move-index-width').trim();
        const calcOverflow = document.documentElement.scrollWidth - window.innerWidth;

        await activateMainPage('revcalc', { updateHash: false });
        revCalcState.my = makeSideState('primarina');
        revCalcState.opp = { pokemonIdx: 'archaludon', ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, status: 'none' };
        renderRevCalcAll();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const toggles = document.querySelector('#page-revcalc .rc-toggle-grid');
        return {
          calcIndexWidth,
          calcOverflow,
          reverseToggleColumns: getComputedStyle(toggles).gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
          reverseOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      })()`, true);
    }
    check(
      Object.values(breakpointLayouts).every(layout => layout.calcOverflow <= 1 && layout.reverseOverflow <= 1)
        && breakpointLayouts[681].calcIndexWidth === '20px'
        && breakpointLayouts[680].calcIndexWidth === '18px'
        && breakpointLayouts[761].reverseToggleColumns > 1
        && breakpointLayouts[760].reverseToggleColumns === 1,
      'calculator and reverse layouts switch cleanly at 680px and 760px boundaries',
      JSON.stringify(breakpointLayouts),
    );
    await setViewport(client, 375, 812);

    const stagedTools = await client.evaluate(`(async () => {
      await activateMainPage('finetune', { updateHash: false });
      fineTuneState.my = makeSideState('primarina');
      renderFineTuneAll();
      const fineTuneFrame = document.querySelector('#page-finetune .ft-stats-column');
      const fineTuneMobile = {
        rowDisplay: getComputedStyle(document.querySelector('#page-finetune .ft-stat-row')).display,
        overflow: fineTuneFrame.scrollWidth - fineTuneFrame.clientWidth,
      };

      await activateMainPage('revcalc', { updateHash: false });
      revCalcState.my = makeSideState('primarina');
      revCalcState.opp = { pokemonIdx: 'archaludon', ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, status: 'none' };
      revCalcState.nextRankOpen = true;
      renderRevCalcAll();
      const reverseFrames = [...document.querySelectorAll('#page-revcalc .tool-stat-table-frame')];
      const nextRankProbe = document.createElement('div');
      nextRankProbe.innerHTML = rcRenderNextRankPanel();
      document.getElementById('page-revcalc').appendChild(nextRankProbe);
      const reverseMobile = {
        rowDisplay: getComputedStyle(document.querySelector('#page-revcalc .rc-stat-row')).display,
        maxOverflow: Math.max(0, ...reverseFrames.map(frame => frame.scrollWidth - frame.clientWidth)),
        nextRankDisplay: getComputedStyle(nextRankProbe.querySelector('.rc-next-rank-row')).display,
        inputStage: document.getElementById('rc-input-panel')?.dataset.stageState || '',
        resultStage: document.getElementById('rc-results-panel')?.dataset.stageState || '',
      };
      nextRankProbe.remove();

      revCalcState.my = makeSideState('');
      revCalcState.opp = { pokemonIdx: '', ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, status: 'none' };
      revCalcState.results = null;
      revCalcState.nextRankOpen = false;
      renderRevCalcAll();
      const reverse = {
        gated: !!document.querySelector('#rc-input-body .rc-prerequisite'),
        hasObservation: !!document.querySelector('#rc-input-body [data-rc-action="observedMyHp"]'),
        analyzeDisabled: document.getElementById('rcAnalyze').disabled,
        inputStage: document.getElementById('rc-input-panel')?.dataset.stageState || '',
        resultStage: document.getElementById('rc-results-panel')?.dataset.stageState || '',
        compactGuide: document.querySelector('#rc-input-body .ui-empty--compact')?.getBoundingClientRect().height || 999,
      };
      fineTuneState.my = makeSideState('');
      renderFineTuneAll();
      const hpPanel = document.getElementById('ft-hp-panel');
      const finetune = {
        hidden: hpPanel.hidden,
        display: getComputedStyle(hpPanel).display,
        hasHpColumn: document.getElementById('ft-layout').classList.contains('has-hp-results'),
      };
      return { reverse, finetune, fineTuneMobile, reverseMobile };
    })()`, true);
    check(stagedTools.reverse.gated && !stagedTools.reverse.hasObservation && stagedTools.reverse.analyzeDisabled && stagedTools.reverse.inputStage === 'locked' && stagedTools.reverse.resultStage === 'locked' && stagedTools.reverse.compactGuide <= 80, 'reverse observations wait for both participants in compact locked stages', JSON.stringify(stagedTools.reverse));
    check(stagedTools.finetune.hidden && stagedTools.finetune.display === 'none' && !stagedTools.finetune.hasHpColumn, 'fine-tune hides empty HP results on mobile', JSON.stringify(stagedTools.finetune));
    check(stagedTools.fineTuneMobile.rowDisplay === 'grid' && stagedTools.fineTuneMobile.overflow <= 1, 'mobile fine-tune stats use non-scrolling cards', JSON.stringify(stagedTools.fineTuneMobile));
    check(stagedTools.reverseMobile.rowDisplay === 'grid' && stagedTools.reverseMobile.maxOverflow <= 1 && stagedTools.reverseMobile.nextRankDisplay === 'grid' && stagedTools.reverseMobile.inputStage === 'ready' && stagedTools.reverseMobile.resultStage === 'ready', 'mobile reverse stats, next ranks, and ready stages use non-scrolling cards', JSON.stringify(stagedTools.reverseMobile));

    const matchup = await client.evaluate(`(async () => {
      await activateMainPage('matchup', { updateHash: true });
      matchupSlots.fill(null);
      matchupAbilities.fill('');
      matchupSetSlotPokemon(0, 'charizard');
      renderMatchupSlots();
      renderMatchupTable();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const slot = document.querySelector('#matchupSlots .matchup-slot');
      const centers = ['.matchup-slot-num', '.matchup-cb-input', '.matchup-slot-types', '.matchup-slot-clear']
        .map(selector => slot.querySelector(selector)?.getBoundingClientRect())
        .filter(Boolean)
        .map(rect => Math.round(rect.top + (rect.height / 2)));
      const hint = document.getElementById('matchupScrollHint');
      const compactHeaders = document.querySelectorAll('#matchupHead th').length;
      const compact = document.getElementById('matchupTable').classList.contains('matchup-table-compact');
      const compactHintVisible = !hint.hidden && getComputedStyle(hint).display !== 'none';
      ['charizard', 'blastoise', 'venusaur', 'pikachu', 'gengar', 'dragonite'].forEach((id, index) => {
        matchupSetSlotPokemon(index, id);
      });
      renderMatchupTable();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const fullHeaders = document.querySelectorAll('#matchupHead th').length;
      const fullHintVisible = !hint.hidden && getComputedStyle(hint).display !== 'none';
      matchupSlots.fill(null);
      matchupAbilities.fill('');
      matchupSetSlotPokemon(0, 'delphoxmega', { abilityId: 'levitate' });
      matchupSetSlotPokemon(1, 'vaporeon', { abilityId: 'waterabsorb' });
      matchupSetSlotPokemon(2, 'gengar');
      renderMatchupSlots();
      renderMatchupTable();
      const cellText = (type, index) => {
        const row = [...document.querySelectorAll('#matchupBody tr')]
          .find(candidate => candidate.querySelector('.matchup-table-type')?.classList.contains('t-' + type));
        return row?.querySelectorAll('td')[index]?.textContent.trim() || '';
      };
      const levitateLabel = cellText('Ground', 1);
      const waterAbsorbLabel = cellText('Water', 2);
      matchupSetSlotPokemon(0, 'delphox');
      renderMatchupTable();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        slotHeight: slot.getBoundingClientRect().height,
        centerSpread: Math.max(...centers) - Math.min(...centers),
        spriteDisplay: getComputedStyle(slot.querySelector('.matchup-slot-sprite')).display,
        compactHeaders,
        compact,
        compactHintVisible,
        fullHeaders,
        fullHintVisible,
        levitateLabel,
        waterAbsorbLabel,
        baseDelphoxGround: cellText('Ground', 1),
      };
    })()`, true);
    check(matchup.overflow <= 1, 'mobile matchup has no horizontal page overflow', String(matchup.overflow));
    check(matchup.slotHeight <= 92 && matchup.centerSpread <= 4 && matchup.spriteDisplay === 'none', 'mobile matchup keeps compact party slots with form controls', JSON.stringify(matchup));
    check(matchup.compact && matchup.compactHeaders === 3 && !matchup.compactHintVisible, 'mobile matchup omits empty comparison columns', JSON.stringify(matchup));
    check(matchup.fullHeaders === 8 && matchup.fullHintVisible, 'mobile matchup announces scrolling only for a full comparison', JSON.stringify(matchup));
    check(matchup.levitateLabel === '부유' && matchup.waterAbsorbLabel === '저수' && matchup.baseDelphoxGround !== '부유', 'matchup displays concise ability immunity labels by selected form and ability', JSON.stringify(matchup));
    await checkAxe(client, 'matchup');

    const reverse = await client.evaluate(`(async () => {
      revCalcState.my = makeSideState('primarina');
      revCalcState.opp = { pokemonIdx: 'archaludon', ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, status: 'none' };
      revCalcState.myMove = 'moonblast';
      revCalcState.observedTheirPct = '35';
      revCalcState.oppMove = '';
      revCalcState.observedMyHp = '';
      revCalcState.turnOrder = 'unknown';
      revCalcState.itemCandidates = [];
      let heartbeats = 0;
      const heartbeat = setInterval(() => { heartbeats++; }, 16);
      const started = performance.now();
      const result = await rcAnalyzeCachedAsync();
      const elapsed = performance.now() - started;
      clearInterval(heartbeat);
      return { heartbeats, elapsed, error: result?.error || '', total: result?.total || 0 };
    })()`, true);
    check(!reverse.error && reverse.total > 0, 'reverse Worker returns candidate results', JSON.stringify(reverse));
    check(reverse.heartbeats >= 2, 'reverse Worker keeps the main thread responsive', JSON.stringify(reverse));

    await setViewport(client, 320, 720);
    await client.evaluate(`document.documentElement.dataset.theme = 'dark'`);
    for (const pageKey of ['calc', 'revcalc', 'finetune', 'matchup', 'dex']) {
      const narrowDark = await client.evaluate(`(async () => {
        await activateMainPage(${JSON.stringify(pageKey)}, { updateHash: false });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const partyButton = document.getElementById('partyPresetOpen');
        const partyStyle = partyButton ? getComputedStyle(partyButton) : null;
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          active: document.getElementById(${JSON.stringify(`page-${pageKey}`)})?.classList.contains('active') || false,
          partyButton: partyStyle ? {
            color: partyStyle.color,
            background: partyStyle.backgroundColor,
            opacity: partyStyle.opacity,
            hovered: partyButton.matches(':hover'),
            disabled: partyButton.disabled,
          } : null,
        };
      })()`, true);
      check(narrowDark.active && narrowDark.overflow <= 1, `${pageKey} reflows at 320px in dark theme`, JSON.stringify(narrowDark));
      if (pageKey === 'calc') {
        check(
          narrowDark.partyButton?.color === 'rgb(237, 243, 250)' && narrowDark.partyButton?.opacity === '1',
          'dark mobile header actions retain full-contrast text',
          JSON.stringify(narrowDark.partyButton),
        );
      }
      await checkAxe(client, `${pageKey} dark 320px`);
    }
    await captureScreenshot(client, 'dex-dark-320');
    await client.evaluate(`delete document.documentElement.dataset.theme`);
    check(browserErrors.length === 0, 'browser runtime reports no uncaught errors', browserErrors.join(' | '));
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
