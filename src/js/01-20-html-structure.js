/* Shared HTML structure helpers.
 * Keep these helpers presentation-neutral: they describe hierarchy and state,
 * while existing CSS owns the visual treatment.
 */
function htmlAttrValue(value) {
  return escapeHTML(value).replace(/"/g, '&quot;');
}

function htmlAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([name, value]) => value === true ? name : `${name}="${htmlAttrValue(value)}"`)
    .join(' ');
}

function uiButton(label, attrs = {}) {
  const attrText = htmlAttrs({ type: 'button', ...attrs });
  return `<button ${attrText}>${label}</button>`;
}

function uiClassNames(...values) {
  return values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .join(' ');
}

function uiMergeClass(attrs = {}, className = '') {
  return {
    ...attrs,
    class: uiClassNames(className, attrs.class),
  };
}

const TOOL_STAT_COLUMN_LABELS = {
  name: '능력',
  base: '종족값',
  point: '포인트',
  magic: '매직넘버',
  final: '실수치',
  rank: '랭크',
};

function toolStatColumnClass(column) {
  return `tool-stat-col-${column}`;
}

function renderToolStatHead(columns, options = {}) {
  const labels = { ...TOOL_STAT_COLUMN_LABELS, ...(options.labels || {}) };
  const rowClass = uiClassNames(options.rowClass, 'tool-stat-head-row');
  return `
    <div class="${rowClass}">
      ${columns.map(column => `
        <div class="${uiClassNames(options.cellClass, 'tool-stat-head-cell', toolStatColumnClass(column), 'ui-stat-head')}">${escapeHTML(labels[column] || column)}</div>
      `).join('')}
    </div>
  `;
}

function renderToolStatNatureMark(stat, natureId, options = {}) {
  const nature = NATURE_BY_ID?.[natureId];
  const up = nature?.up === stat;
  const down = nature?.down === stat;
  if (!up && !down && options.empty === false) return '';

  const stateClass = up
    ? uiClassNames(options.upClass, 'tool-stat-nature-up')
    : down
      ? uiClassNames(options.downClass, 'tool-stat-nature-down')
      : uiClassNames(options.emptyClass, 'tool-stat-nature-empty');
  const label = up ? (options.upLabel || '&#9650;') : down ? (options.downLabel || '&#9660;') : '';
  return `<span ${htmlAttrs({
    class: uiClassNames('tool-stat-nature-mark', stateClass),
    'aria-hidden': !up && !down ? 'true' : null,
  })}>${label}</span>`;
}

function renderToolStatPointControl(stat, value, options = {}) {
  const zeroAttrs = typeof options.zeroAttrs === 'function' ? options.zeroAttrs(stat) : (options.zeroAttrs || {});
  const inputAttrs = typeof options.inputAttrs === 'function' ? options.inputAttrs(stat) : (options.inputAttrs || {});
  const maxAttrs = typeof options.maxAttrs === 'function' ? options.maxAttrs(stat) : (options.maxAttrs || {});
  const inputType = options.inputType || 'number';
  return `
    <div class="${uiClassNames(options.className, 'tool-stat-point-stepper', 'tool-stat-col-point', 'ui-stepper')}">
      <button ${htmlAttrs(uiMergeClass({ type: 'button', 'data-tool-stat-point-set': stat, 'data-tool-stat-point-value': '0', ...zeroAttrs }, 'tool-stat-point-button ui-stat-button'))}>0</button>
      <input ${htmlAttrs(uiMergeClass({ type: inputType, min: '0', max: '32', inputmode: 'numeric', value: String(value ?? ''), 'data-tool-stat-point-input': stat, ...inputAttrs }, 'tool-stat-point-input'))}>
      <button ${htmlAttrs(uiMergeClass({ type: 'button', 'data-tool-stat-point-set': stat, 'data-tool-stat-point-value': '32', ...maxAttrs }, 'tool-stat-point-button ui-stat-button'))}>32</button>
    </div>
  `;
}

function renderToolStatRankControl(stat, rank, options = {}) {
  const rankable = options.rankable ?? stat !== 'hp';
  if (!rankable) {
    const tag = options.emptyTag || 'div';
    return `<${tag} ${htmlAttrs({
      class: uiClassNames(options.emptyClass, 'tool-stat-rank-empty', 'tool-stat-col-rank'),
      'aria-hidden': 'true',
    })}></${tag}>`;
  }

  const decAttrs = typeof options.decAttrs === 'function' ? options.decAttrs(stat) : (options.decAttrs || {});
  const incAttrs = typeof options.incAttrs === 'function' ? options.incAttrs(stat) : (options.incAttrs || {});
  const stateClass = rank > 0
    ? (options.positiveClass || 'pos')
    : rank < 0
      ? (options.negativeClass || 'neg')
      : '';
  const label = rank > 0 ? `+${rank}` : rank;
  return `
    <div class="${uiClassNames(options.className, 'tool-stat-rank-stepper', 'tool-stat-col-rank', 'ui-stepper')}">
      <button ${htmlAttrs(uiMergeClass({ type: 'button', 'data-tool-stat-rank': stat, 'data-tool-stat-rank-dir': '-1', ...decAttrs }, 'tool-stat-rank-button ui-stat-button'))}>${options.decLabel || '-'}</button>
      <span ${htmlAttrs({ class: uiClassNames(options.valueClass, 'tool-stat-rank-value', 'ui-stat-value', stateClass), 'data-tool-stat-rank-value': stat })}>${label}</span>
      <button ${htmlAttrs(uiMergeClass({ type: 'button', 'data-tool-stat-rank': stat, 'data-tool-stat-rank-dir': '1', ...incAttrs }, 'tool-stat-rank-button ui-stat-button'))}>${options.incLabel || '+'}</button>
    </div>
  `;
}

function toolStatClampPointValue(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(32, n));
}

function toolStatPointInputDigits(value) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

function toolStatNormalizePointInputValue(value) {
  const raw = String(value ?? '');
  const digits = toolStatPointInputDigits(raw);
  if (!digits) return raw;
  return digits.replace(/^0+(?=\d)/, '');
}

function toolStatShouldCommitPointInput(value, eventType = 'input') {
  if (eventType !== 'input') return true;
  const digits = toolStatNormalizePointInputValue(value);
  return digits.length >= 2;
}

function toolStatApplyPointValue(side, stat, value, options = {}) {
  const stats = options.stats || (typeof STATS !== 'undefined' ? STATS : ['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
  const maxTotal = options.maxTotal ?? 66;
  if (!side?.evs || !stats.includes(stat)) return 0;

  const requested = toolStatClampPointValue(value);
  const otherTotal = stats.reduce((sum, key) => key === stat ? sum : sum + (side.evs[key] || 0), 0);
  const finalValue = Math.min(requested, Math.max(0, maxTotal - otherTotal));
  side.evs[stat] = finalValue;
  return finalValue;
}

function toolStatApplyRankDelta(side, stat, dir) {
  if (!side?.ranks || !stat || stat === 'hp') return 0;
  const delta = parseInt(dir, 10) || 0;
  const next = Math.max(-6, Math.min(6, (side.ranks[stat] || 0) + delta));
  side.ranks[stat] = next;
  return next;
}

function renderToolStatMagicCell(parts = {}, options = {}) {
  if (!parts || options.empty) {
    return `<div class="${uiClassNames(options.className, 'tool-stat-magic', 'tool-stat-col-magic', 'tool-stat-magic-empty', 'empty')}"></div>`;
  }
  const prev = parts.prev != null
    ? `<span ${htmlAttrs({
        class: uiClassNames(options.prevClass, 'tool-stat-magic-prev'),
        title: parts.prevTitle || null,
      })}>${escapeHTML(parts.prevLabel ?? parts.prev)}</span>`
    : `<span class="${uiClassNames(options.prevClass, 'tool-stat-magic-prev', 'tool-stat-magic-empty', 'empty')}"></span>`;
  const current = parts.current != null
    ? `<span ${htmlAttrs({
        class: uiClassNames(options.currentClass, 'tool-stat-magic-current'),
        title: parts.currentTitle || null,
      })}>${escapeHTML(parts.currentLabel ?? parts.current)}</span>`
    : `<span class="${uiClassNames(options.currentClass, 'tool-stat-magic-current', 'tool-stat-magic-empty', 'empty')}"></span>`;
  const next = parts.next != null
    ? `<span ${htmlAttrs({
        class: uiClassNames(options.nextClass, 'tool-stat-magic-next'),
        title: parts.nextTitle || null,
      })}>${escapeHTML(parts.nextLabel ?? parts.next)}</span>`
    : `<span class="${uiClassNames(options.nextClass, 'tool-stat-magic-next', 'tool-stat-magic-empty', 'empty')}"></span>`;
  return `
    <div class="${uiClassNames(options.className, 'tool-stat-magic', 'tool-stat-col-magic')}">
      ${prev}
      <span class="${uiClassNames(options.currentSlotClass, 'tool-stat-magic-current-slot')}">${current}</span>
      ${next}
    </div>
  `;
}

function renderToolStatRow(row, options = {}) {
  const columns = options.columns || ['name', 'base', 'point', 'final', 'rank'];
  const label = row.labelHtml ?? `<span class="${uiClassNames(options.nameTextClass, 'tool-stat-name-text')}">${escapeHTML(row.label || row.stat || '')}</span>`;
  const cells = columns.map(column => {
    if (column === 'name') {
      return `<div class="${uiClassNames(options.nameClass, row.nameClass, 'tool-stat-col-name', 'ui-stat-name')}">${label}${row.natureHtml || ''}</div>`;
    }
    if (column === 'base') {
      return `<div class="${uiClassNames(options.baseClass, row.baseClass, 'tool-stat-col-base', 'ui-stat-readout')}">${escapeHTML(String(row.base ?? '-'))}</div>`;
    }
    if (column === 'point') {
      return row.pointHtml ?? renderToolStatPointControl(row.stat, row.point ?? 0, row.pointOptions || {});
    }
    if (column === 'magic') {
      return row.magicHtml ?? renderToolStatMagicCell(null, { empty: true });
    }
    if (column === 'final') {
      return `<div class="${uiClassNames(options.finalClass, row.finalClass, 'tool-stat-col-final', 'ui-stat-readout')}">${escapeHTML(String(row.final ?? '-'))}</div>`;
    }
    if (column === 'rank') {
      return row.rankHtml ?? renderToolStatRankControl(row.stat, row.rank || 0, row.rankOptions || {});
    }
    return '';
  }).join('');
  return `<div class="${uiClassNames(options.rowClass, row.rowClass, 'tool-stat-row')}">${cells}</div>`;
}

function renderToolStatRows(rows, options = {}) {
  return rows.map(row => renderToolStatRow(row, options)).join('');
}

function renderToolStatBulkStrip(metrics, options = {}) {
  const phys = metrics?.phys ?? 0;
  const spec = metrics?.spec ?? 0;
  const value = (n) => typeof n === 'number' ? n.toLocaleString() : escapeHTML(n);
  return `
    <div class="${uiClassNames(options.className, 'tool-stat-bulk-strip', 'ui-metric-row', 'ui-chip-row')}">
      <div class="${uiClassNames(options.cardClass, options.physClass, 'tool-stat-bulk-card', 'tool-stat-bulk-phys', 'ui-metric-chip')}">
        <span class="${uiClassNames(options.labelClass, 'tool-stat-bulk-label', 'ui-chip-label')}">${escapeHTML(options.physLabel || '물리 내구')}</span>
        <span class="${uiClassNames(options.valueClass, 'tool-stat-bulk-value', 'ui-chip-value')}">${value(phys)}</span>
      </div>
      <div class="${uiClassNames(options.cardClass, options.specClass, 'tool-stat-bulk-card', 'tool-stat-bulk-spec', 'ui-metric-chip')}">
        <span class="${uiClassNames(options.labelClass, 'tool-stat-bulk-label', 'ui-chip-label')}">${escapeHTML(options.specLabel || '특수 내구')}</span>
        <span class="${uiClassNames(options.valueClass, 'tool-stat-bulk-value', 'ui-chip-value')}">${value(spec)}</span>
      </div>
    </div>
  `;
}

const TOOL_MOVE_COLUMNS = ['index', 'name', 'type', 'power', 'readout'];
const TOOL_MOVE_COLUMN_LABELS = {
  index: '',
  name: '',
  type: '',
  power: '',
  readout: '\uACB0\uC815\uB825',
};

function toolMoveColumnClass(column) {
  return `tool-move-col-${column}`;
}

function toolMoveColumnCell(column, html, options = {}) {
  const cellClass = uiClassNames(
    options.cellClass,
    options[`${column}Class`],
    toolMoveColumnClass(column),
  );
  return `<span class="${cellClass}">${html ?? ''}</span>`;
}

function renderToolMoveHead(columns = TOOL_MOVE_COLUMNS, options = {}) {
  const labels = { ...TOOL_MOVE_COLUMN_LABELS, ...(options.labels || {}) };
  const rowClass = uiClassNames(options.rowClass, 'tool-move-head-row', 'ui-table-head-row');
  const cells = columns.map(column => toolMoveColumnCell(
    column,
    escapeHTML(labels[column] || ''),
    { cellClass: options.cellClass },
  )).join('');
  return `<div ${htmlAttrs({ class: rowClass, 'aria-hidden': options.ariaHidden ?? 'true' })}>${cells}</div>`;
}

function renderToolMoveRow(row, options = {}) {
  const columns = options.columns || TOOL_MOVE_COLUMNS;
  const rowClass = uiClassNames(options.rowClass, row.rowClass, 'tool-move-row', 'ui-control-row');
  const cells = columns.map(column => {
    if (column === 'index') {
      return `<span class="${uiClassNames(options.indexClass, row.indexClass, 'tool-move-index', 'ui-index')}">${escapeHTML(String(row.index ?? ''))}</span>`;
    }
    if (column === 'name') return row.nameHtml || row.moveHtml || '';
    if (column === 'type') return row.typeHtml || toolMoveColumnCell(column, '');
    if (column === 'power') return row.powerHtml || toolMoveColumnCell(column, '');
    if (column === 'readout') return row.readoutHtml || toolMoveColumnCell(column, '');
    return row[column] || '';
  }).join('');
  return `<div ${htmlAttrs({ ...(row.attrs || {}), class: rowClass })}>${cells}</div>`;
}

function renderToolMoveList(rows, options = {}) {
  const columns = options.columns || TOOL_MOVE_COLUMNS;
  const listClass = uiClassNames(
    options.className,
    'tool-move-list',
    'ui-control-grid',
    columns.includes('type') ? 'tool-move-has-type' : 'tool-move-no-type',
    columns.includes('power') ? 'tool-move-has-power' : 'tool-move-no-power',
    columns.includes('readout') ? 'tool-move-has-readout' : 'tool-move-no-readout',
  );
  const head = options.head === false ? '' : renderToolMoveHead(columns, {
    rowClass: options.headClass,
    cellClass: options.headCellClass,
    labels: options.labels,
    ariaHidden: options.headAriaHidden,
  });
  const body = rows.map(row => renderToolMoveRow(row, {
    columns,
    rowClass: options.rowClass,
    indexClass: options.indexClass,
  })).join('');
  return `<div ${htmlAttrs({ class: listClass })}>${head}${body}</div>`;
}

function syncUiTabs(buttons, activeButton) {
  buttons.forEach(button => {
    const active = button === activeButton;
    button.classList.toggle('active', active);
    if (button.hasAttribute('aria-selected')) {
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (button.getAttribute('role') === 'tab') {
      button.tabIndex = activeButton ? (active ? 0 : -1) : 0;
    }
  });
}

function syncUiPanels(panels, activePanel) {
  panels.forEach(panel => {
    const active = panel === activePanel;
    panel.classList.toggle('active', active);
    if (panel.hasAttribute('aria-hidden')) {
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    if (panel.getAttribute('role') === 'tabpanel') {
      panel.hidden = !active;
    }
  });
}

function bindUiTabKeyboard(tablist, options = {}) {
  if (!tablist || tablist.dataset.uiTabKeyboard === 'bound') return;
  tablist.dataset.uiTabKeyboard = 'bound';
  const selector = options.selector || '[role="tab"]';

  tablist.addEventListener('keydown', event => {
    const current = event.target.closest(selector);
    if (!current || !tablist.contains(current)) return;

    const tabs = [...tablist.querySelectorAll(selector)].filter(tab => !tab.disabled);
    const currentIndex = tabs.indexOf(current);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = tabs[nextIndex];
    next.focus();
    if (options.activateOnFocus !== false) next.click();
  });
}

const mainPageFeatureLoads = new Map();

function ensureMainPageFeatureLoaded(pageKey) {
  const sourceHolder = document.getElementById('page-feature-assets');
  const source = sourceHolder?.getAttribute(`data-${pageKey}-src`) || '';
  if (!source) return Promise.resolve();
  if (mainPageFeatureLoads.has(pageKey)) return mainPageFeatureLoads.get(pageKey);

  const load = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.dataset.pageFeature = pageKey;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load page feature: ${pageKey}`)), { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    mainPageFeatureLoads.delete(pageKey);
    throw error;
  });
  mainPageFeatureLoads.set(pageKey, load);
  return load;
}

async function activateMainPage(pageKey, options = {}) {
  const tab = document.querySelector(`.nav-tab[data-page="${pageKey}"]`);
  const activePage = document.getElementById(`page-${pageKey}`);
  if (!tab || !activePage) return false;

  await ensureMainPageFeatureLoaded(pageKey);
  if (typeof ensureMainPageInitialized === 'function') ensureMainPageInitialized(pageKey);
  syncUiTabs(document.querySelectorAll('.nav-tab'), tab);
  syncUiPanels(document.querySelectorAll('.page'), activePage);

  if (options.updateHash) {
    history.replaceState(null, '', `#${pageKey}`);
  }
  return true;
}

async function activateMainPageFromHash() {
  const pageKey = decodeURIComponent(location.hash.replace(/^#(?:page-)?/, '')).trim();
  if (!pageKey) return false;
  return activateMainPage(pageKey, { updateHash: false });
}

function bindMainNavigation() {
  const nav = document.querySelector('.main-nav');
  const navTabs = document.querySelectorAll('.nav-tab');
  if (!nav || !navTabs.length) return;

  navTabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      await activateMainPage(tab.dataset.page, { updateHash: true });
    });
  });

  bindUiTabKeyboard(nav);

  const activeTab = document.querySelector('.nav-tab.active') || navTabs[0];
  void (async () => {
    const initialPage = await activateMainPageFromHash()
      || await activateMainPage(activeTab?.dataset.page || 'calc', { updateHash: false });
    if (!initialPage) await activateMainPage('calc', { updateHash: false });
  })();

  window.addEventListener('hashchange', () => { void activateMainPageFromHash(); });
}
