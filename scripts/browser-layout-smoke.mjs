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
      .filter(violation => violation.impact === 'critical' || violation.impact === 'serious')
      .map(violation => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.slice(0, 3).map(node => ({
          target: node.target.join(' '),
          summary: node.failureSummary,
        })),
      }))
  ))`, true);
  check(violations.length === 0, `${label} has no critical or serious accessibility violations`, JSON.stringify(violations));
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
    await installAxe(client);

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
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        collapsed,
        expanded,
        dropdown: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
        summaryVisible: !document.getElementById('calcMobileSummary').hidden,
      };
    })()`, true);
    check(mobile.overflow <= 1, 'mobile has no horizontal page overflow', String(mobile.overflow));
    check(mobile.collapsed.statDisplay === 'none' && mobile.collapsed.compactDisplay !== 'none', 'mobile starts with compact stat summary');
    check(mobile.expanded.statDisplay !== 'none' && mobile.expanded.ariaExpanded === 'true', 'mobile detail toggle reveals stat controls');
    check(mobile.dropdown && mobile.dropdown.left >= 0 && mobile.dropdown.right <= 375, 'mobile Pokemon dropdown stays inside viewport', JSON.stringify(mobile.dropdown));
    check(mobile.summaryVisible, 'mobile recommendation summary is visible after calculation');
    await client.evaluate(`
      document.activeElement?.blur();
      document.querySelectorAll('.combobox-options.open').forEach(element => element.classList.remove('open'));
      document.querySelector('[data-calc-detail-toggle="atk"]')?.click();
    `);
    await captureScreenshot(client, 'calculator-mobile-375');

    const partyModalFocus = await client.evaluate(`(async () => {
      const trigger = document.getElementById('partyPresetOpen');
      trigger.focus();
      trigger.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return document.activeElement?.id || '';
    })()`, true);
    check(partyModalFocus === 'partyPresetClose', 'party preset modal receives initial focus', partyModalFocus);
    await checkAxe(client, 'party preset modal');
    const partyModalReturnFocus = await client.evaluate(`(async () => {
      document.getElementById('partyPresetClose')?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return document.activeElement?.id || '';
    })()`, true);
    check(partyModalReturnFocus === 'partyPresetOpen', 'party preset modal restores trigger focus', partyModalReturnFocus);

    const dex = await client.evaluate(`(async () => {
      document.querySelector('.nav-tab[data-page="dex"]')?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const firstPageRows = [...document.querySelectorAll('#dexBodyPokemon tr[data-dex-id]')];
      const firstId = firstPageRows[0]?.dataset.dexId || '';
      const nextButton = document.querySelector('#dexPagination-pokemon [data-dex-page="2"]');
      nextButton?.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const secondPageRows = [...document.querySelectorAll('#dexBodyPokemon tr[data-dex-id]')];
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        firstCount: firstPageRows.length,
        secondCount: secondPageRows.length,
        firstId,
        secondId: secondPageRows[0]?.dataset.dexId || '',
        pageLabel: document.querySelector('#dexPagination-pokemon .dex-page-current')?.textContent?.trim() || '',
        cardDisplay: getComputedStyle(secondPageRows[0]).display,
        labeledStats: secondPageRows[0]?.querySelectorAll('td.num[data-label]').length || 0,
      };
    })()`, true);
    check(dex.overflow <= 1, 'mobile dex has no horizontal page overflow', String(dex.overflow));
    check(dex.firstCount > 0 && dex.firstCount <= 50, 'dex limits the initial Pokemon DOM to 50 rows', JSON.stringify(dex));
    check(dex.secondCount > 0 && dex.secondCount <= 50 && dex.secondId !== dex.firstId, 'dex pagination renders the next Pokemon slice', JSON.stringify(dex));
    check(dex.pageLabel.startsWith('2 / '), 'dex pagination exposes the current page', dex.pageLabel);
    check(dex.cardDisplay === 'grid' && dex.labeledStats === 7, 'mobile dex renders labeled information cards', JSON.stringify(dex));
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

    const stagedTools = await client.evaluate(`(() => {
      revCalcState.my = makeSideState('');
      revCalcState.opp = { pokemonIdx: '', ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, status: 'none' };
      revCalcState.results = null;
      renderRevCalcAll();
      const reverse = {
        gated: !!document.querySelector('#rc-input-body .rc-prerequisite'),
        hasObservation: !!document.querySelector('#rc-input-body [data-rc-action="observedMyHp"]'),
        analyzeDisabled: document.getElementById('rcAnalyze').disabled,
      };
      fineTuneState.my = makeSideState('');
      renderFineTuneAll();
      const hpPanel = document.getElementById('ft-hp-panel');
      const finetune = {
        hidden: hpPanel.hidden,
        display: getComputedStyle(hpPanel).display,
        hasHpColumn: document.getElementById('ft-layout').classList.contains('has-hp-results'),
      };
      return { reverse, finetune };
    })()`);
    check(stagedTools.reverse.gated && !stagedTools.reverse.hasObservation && stagedTools.reverse.analyzeDisabled, 'reverse observations wait for both participants', JSON.stringify(stagedTools.reverse));
    check(stagedTools.finetune.hidden && stagedTools.finetune.display === 'none' && !stagedTools.finetune.hasHpColumn, 'fine-tune hides empty HP results on mobile', JSON.stringify(stagedTools.finetune));

    const matchup = await client.evaluate(`(async () => {
      document.querySelector('.nav-tab[data-page="matchup"]')?.click();
      matchupSlots.fill(null);
      matchupSlots[0] = 'charizard';
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
        matchupSlots[index] = id;
      });
      renderMatchupTable();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        slotHeight: slot.getBoundingClientRect().height,
        centerSpread: Math.max(...centers) - Math.min(...centers),
        spriteDisplay: getComputedStyle(slot.querySelector('.matchup-slot-sprite')).display,
        compactHeaders,
        compact,
        compactHintVisible,
        fullHeaders: document.querySelectorAll('#matchupHead th').length,
        fullHintVisible: !hint.hidden && getComputedStyle(hint).display !== 'none',
      };
    })()`, true);
    check(matchup.overflow <= 1, 'mobile matchup has no horizontal page overflow', String(matchup.overflow));
    check(matchup.slotHeight <= 60 && matchup.centerSpread <= 4 && matchup.spriteDisplay === 'none', 'mobile matchup uses compact single-row party slots', JSON.stringify(matchup));
    check(matchup.compact && matchup.compactHeaders === 3 && !matchup.compactHintVisible, 'mobile matchup omits empty comparison columns', JSON.stringify(matchup));
    check(matchup.fullHeaders === 8 && matchup.fullHintVisible, 'mobile matchup announces scrolling only for a full comparison', JSON.stringify(matchup));
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
