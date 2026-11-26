// Exercise the production ES modules, including overlapping requests and failed startup.
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';

globalThis.document = { getElementById: () => ({ textContent: '[]' }) };
const { configurePageFeatures } = await import('../src/runtime/features.js');
const navigation = await import('../src/js/01-20-html-structure.js');

function element(id, page, role) {
  const classes = new Set();
  const attributes = new Map([['role', role], [role === 'tab' ? 'aria-selected' : 'aria-hidden', 'false']]);
  return {
    id, textContent: page || '', dataset: { page }, classes,
    classList: {
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
    },
    addEventListener() {}, hasAttribute: key => attributes.has(key),
    getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
  };
}
const keys = ['calc', 'dex', 'matchup', 'finetune', 'revcalc'];
const tabs = keys.map(key => element('nav-' + key, key, 'tab'));
const panels = keys.map(key => element('page-' + key, key, 'tabpanel'));
tabs[0].classes.add('active');
const nav = element('nav'), status = element('pageLoadStatus');
const byId = new Map([...tabs, ...panels, status].map(el => [el.id, el]));
globalThis.document = {
  getElementById: id => byId.get(id),
  querySelectorAll: selector => selector === '.nav-tab' ? tabs : panels,
  querySelector(selector) {
    if (selector === '.main-nav') return nav;
    if (selector === '.nav-tab.active') return tabs.find(t => t.classes.has('active'));
    if (selector === '.nav-tab.is-error') return tabs.find(t => t.classes.has('is-error'));
    const tab = /^\.nav-tab\[data-page="([\w-]+)"\]$/.exec(selector);
    if (tab) return tabs.find(t => t.dataset.page === tab[1]);
    throw new Error('Unexpected selector ' + selector);
  },
};
globalThis.window = { addEventListener() {} };
globalThis.location = { hash: '#page-dex' };
globalThis.history = { replaceState(_data, _unused, hash) { location.hash = hash; } };
const rendered = [];
let release, failRender = false;
const module = { api: {}, initialize() {} };
configurePageFeatures({ dex: () => new Promise(resolve => { release = () => resolve(module); }) });
function render(key) {
  if (failRender && key === 'finetune') throw new Error('expected render failure');
  rendered.push(key);
}
navigation.bindMainNavigation(render);
assert.equal(nav.getAttribute('aria-busy'), 'true');
await navigation.activateMainPage('matchup', { updateHash: true });
release();
await tick();
assert.deepEqual(rendered, ['matchup']);
assert.equal(location.hash, '#matchup');
assert.equal(nav.getAttribute('aria-busy'), undefined);
console.log('[PASS] Slow initial deep link cannot override a later tab choice');
for (const hash of ['#unknown', '#%22', '#appContent']) {
  location.hash = hash;
  assert.equal(await navigation.activateMainPageFromHash(), false);
  assert(tabs[2].classes.has('active'));
  assert.equal(await navigation.activateMainPageFromHash('calc'), true);
  assert(tabs[0].classes.has('active'));
  await navigation.activateMainPage('matchup');
}
location.hash = '#%';
await navigation.activateMainPageFromHash();
assert(tabs[0].classes.has('active'));
console.log('[PASS] Unknown, encoded, malformed and skip-link fragments');
const errors = [];
const log = console.error;
console.error = error => errors.push(error.message);
try {
  failRender = true;
  assert.equal(await navigation.activateMainPage('finetune', { updateHash: true }), false);
  assert(tabs[0].classes.has('active') && !status.hidden && location.hash === '#%');
  failRender = false;
  assert(await navigation.activateMainPage('finetune', { updateHash: true }));
  assert(tabs[3].classes.has('active') && status.hidden && !tabs[3].classes.has('is-error'));
  console.log('[PASS] Failed render retains the selected panel and a successful retry clears the error');
  location.hash = '#revcalc';
  configurePageFeatures({ revcalc: async () => { throw new Error('expected import failure'); } });
  await navigation.activateMainPage('calc');
  rendered.length = 0;
  navigation.bindMainNavigation(render);
  await tick();
  assert.deepEqual(rendered, ['calc']);
  assert(tabs[0].classes.has('active') && tabs[4].classes.has('is-error') && !status.hidden);
  configurePageFeatures({ revcalc: async () => module });
  assert(await navigation.activateMainPage('revcalc'));
  assert.equal(status.hidden, true);
  assert.equal(errors.length, 2);
  console.log('[PASS] Failed initial import leaves working calculator controls and supports retry');
} finally { console.error = log; }
