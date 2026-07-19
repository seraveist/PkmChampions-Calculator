import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML_PATH = path.join(ROOT, 'pokemon-champions-calculator-v3.html');

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
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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

async function main() {
  check(existsSync(HTML_PATH), 'generated HTML exists');
  const chrome = findChrome();
  if (!chrome) {
    console.log('[SKIP] Chrome/Edge executable was not found; browser layout smoke did not run.');
    return;
  }

  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'pkmchampions-ui-'));
  const activePortFile = path.join(userDataDir, 'DevToolsActivePort');
  const url = `${pathToFileURL(HTML_PATH).href}#calc`;
  const browser = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    url,
  ], { stdio: 'ignore', windowsHide: true });

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
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitFor(() => client.evaluate(`document.readyState === 'complete'`));

    await setViewport(client, 1440, 1000);
    const desktop = await client.evaluate(`(() => {
      applyPokemonToCalcSide('atk', 'charizard');
      applyPokemonToCalcSide('def', 'venusaur');
      state.atk.moves[0] = 'flamethrower';
      renderSide('atk');
      renderSide('def');
      triggerCalc();
      const page = document.getElementById('page-calc');
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        headings: page.querySelectorAll('h2.ui-panel-title').length,
        resultCards: page.querySelectorAll('.calc-result-card').length,
        summaryHidden: document.getElementById('calcMobileSummary').hidden,
        detailToggleDisplay: getComputedStyle(document.querySelector('[data-calc-detail-toggle="atk"]')).display,
      };
    })()`);
    check(desktop.overflow <= 1, 'desktop has no horizontal page overflow', String(desktop.overflow));
    check(desktop.headings >= 4, 'calculator uses semantic panel headings', String(desktop.headings));
    check(desktop.resultCards >= 1, 'calculator renders a damage result card');
    check(desktop.detailToggleDisplay === 'none', 'desktop hides the mobile detail toggle', desktop.detailToggleDisplay);
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
      };
    })()`, true);
    check(dex.overflow <= 1, 'mobile dex has no horizontal page overflow', String(dex.overflow));
    check(dex.firstCount > 0 && dex.firstCount <= 50, 'dex limits the initial Pokemon DOM to 50 rows', JSON.stringify(dex));
    check(dex.secondCount > 0 && dex.secondCount <= 50 && dex.secondId !== dex.firstId, 'dex pagination renders the next Pokemon slice', JSON.stringify(dex));
    check(dex.pageLabel.startsWith('2 / '), 'dex pagination exposes the current page', dex.pageLabel);

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
  }
}

main().catch(error => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});
