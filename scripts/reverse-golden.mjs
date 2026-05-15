import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML_PATH = path.join(ROOT, 'pokemon-champions-calculator-v3.html');

function readJsonScript(html, id) {
  const re = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)<\\/script>`);
  const match = html.match(re);
  if (!match) throw new Error(`Missing JSON script: ${id}`);
  return JSON.parse(match[1]);
}

function fakeElement(id = '') {
  return {
    id,
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    type: '',
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return fakeElement(); },
    closest() { return null; },
    appendChild() {},
    removeChild() {},
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
  };
}

function loadReverseApi() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const data = Object.fromEntries([
    'data-pokemon',
    'data-moves',
    'data-abilities',
    'data-items',
    'data-natures',
    'data-typechart',
    'data-rules',
    'data-meta-threats',
  ].map(id => [id, JSON.stringify(readJsonScript(html, id))]));

  const elements = new Map();
  function elementFor(id) {
    if (data[id]) return { textContent: data[id] };
    if (!elements.has(id)) elements.set(id, fakeElement(id));
    return elements.get(id);
  }

  const windowObject = { innerWidth: 1280 };
  const documentObject = {
    getElementById: elementFor,
    querySelectorAll() { return []; },
    querySelector() { return fakeElement(); },
    createElement() { return fakeElement(); },
    addEventListener() {},
  };

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    window: windowObject,
    document: documentObject,
    __elements: elements,
  });

  windowObject.window = windowObject;
  windowObject.document = documentObject;

  const source = [
    readFileSync(path.join(ROOT, 'src', 'js', '01-core.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '02-engine.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '03-calc-ui.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '04-views.js'), 'utf8'),
    `
      globalThis.__reverseApi = {
        PokemonById, MoveById, revCalcState, makeSideState,
        rcAnalysisField, rcAnalyze, rcStage1Defense, rcStage3OffenseRefine,
        rcApplyMyPokemonSelection, renderRevCalcAll, calcStats, rcCandidateEvParts, rcRoleCompletionInfo,
        __elements
      };
    `,
  ].join('\n');

  vm.runInContext(source, context, { filename: 'reverse-golden.vm.js' });
  return context.__reverseApi;
}

function assertOk(condition, label, detail = '') {
  if (!condition) {
    console.error(`[FAIL] ${label}`);
    if (detail) console.error(detail);
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] ${label}`);
}

const DEFAULT_RC_ITEM_CANDIDATES = ['', 'choicescarf', 'silkscarf', 'charcoal', 'mysticwater', 'magnet', 'miracleseed',
  'nevermeltice', 'blackbelt', 'poisonbarb', 'softsand', 'sharpbeak',
  'twistedspoon', 'silverpowder', 'hardstone', 'spelltag', 'dragonfang',
  'blackglasses', 'metalcoat', 'fairyfeather'];

function configurePrimarinaArchaludon(api, observedMyHp, options = {}) {
  api.revCalcState.my = api.makeSideState('incineroar');
  api.rcApplyMyPokemonSelection('primarina');
  const my = api.revCalcState.my;
  my.evs = { hp: 32, atk: 0, def: 16, spa: 14, spd: 0, spe: 4 };
  my.nature = 'bold';
  my.ability = 'torrent';
  my.item = '';

  api.revCalcState.opp = {
    pokemonIdx: 'archaludon',
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: 'none',
  };
  api.revCalcState.myMove = 'moonblast';
  api.revCalcState.myMoveSet = ['moonblast', '', '', ''];
  api.revCalcState.myMoveBp = '';
  api.revCalcState.observedTheirPct = '35';
  api.revCalcState.oppMove = 'thunderbolt';
  api.revCalcState.predictedOppMove = 'thunderbolt';
  api.revCalcState.oppMoveBp = '';
  api.revCalcState.observedMyHp = String(observedMyHp);
  api.revCalcState.turnOrder = options.turnOrder || 'unknown';
  api.revCalcState.mySpeedOverride = '';
  api.revCalcState.field = {
    weather: 'none',
    terrain: 'none',
    isCritical: false,
    defReflect: false,
    defLightScreen: false,
    gameType: 'Singles',
    isTrickRoom: false,
    isGravity: false,
    ruinSword: false,
    ruinTablet: false,
    ruinBeads: false,
    ruinVessel: false,
    defStealthRock: false,
    defSpikesLayers: 0,
    atkHelpingHand: false,
    defProtect: false,
  };
  api.revCalcState.itemCandidates = options.itemCandidates || [''];
  api.revCalcState.results = null;
}

function configureArchaludonPrimarina(api, observedMyHp, options = {}) {
  api.revCalcState.my = api.makeSideState('archaludon');
  api.rcApplyMyPokemonSelection('archaludon');
  const my = api.revCalcState.my;
  my.evs = { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 };
  my.nature = 'modest';
  my.ability = 'stamina';
  my.item = '';

  api.revCalcState.opp = {
    pokemonIdx: 'primarina',
    ranks: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: 'none',
  };
  api.revCalcState.myMove = 'thunderbolt';
  api.revCalcState.myMoveSet = ['thunderbolt', '', '', ''];
  api.revCalcState.myMoveBp = '';
  api.revCalcState.observedTheirPct = '43';
  api.revCalcState.oppMove = 'moonblast';
  api.revCalcState.predictedOppMove = 'moonblast';
  api.revCalcState.oppMoveBp = '';
  api.revCalcState.observedMyHp = String(observedMyHp);
  api.revCalcState.turnOrder = options.turnOrder || 'my-first';
  api.revCalcState.mySpeedOverride = '';
  api.revCalcState.field = {
    weather: 'none',
    terrain: 'none',
    isCritical: false,
    defReflect: false,
    defLightScreen: false,
    gameType: 'Singles',
    isTrickRoom: false,
    isGravity: false,
    ruinSword: false,
    ruinTablet: false,
    ruinBeads: false,
    ruinVessel: false,
    defStealthRock: false,
    defSpikesLayers: 0,
    atkHelpingHand: false,
    defProtect: false,
  };
  api.revCalcState.itemCandidates = options.itemCandidates || DEFAULT_RC_ITEM_CANDIDATES;
  api.revCalcState.results = null;
}

const api = loadReverseApi();

function assertIncludes(text, needle, label) {
  assertOk(text.includes(needle), label, `missing: ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assertOk(!text.includes(needle), label, `unexpected: ${needle}`);
}

function reverseRenderedHtml() {
  api.renderRevCalcAll();
  return ['rc-my-body', 'rc-opp-body', 'rc-input-body', 'rc-results-body']
    .map(id => api.__elements.get(id)?.innerHTML || '')
    .join('\n');
}

const template = readFileSync(path.join(ROOT, 'src', 'calc-template.html'), 'utf8');
for (const id of ['page-revcalc', 'rc-my-body', 'rc-opp-body', 'rc-input-body', 'rc-results-body', 'rcAnalyze']) {
  assertIncludes(template, id, `Reverse template includes #${id}`);
}

const reverseCss = readFileSync(path.join(ROOT, 'src', 'styles', '02-pages.css'), 'utf8');
for (const className of [
  '.rc-grid',
  '.rc-input-grid',
  '.rc-input-block',
  '.rc-item-grid',
  '.rc-analyze-btn',
  '.rc-results-summary',
  '.rc-result-row',
  '.rc-result-action',
  '.rc-briefing',
  '.rc-followup-grid',
  '.rc-followup-chip',
  '.rc-info-badge',
  '.rc-prediction-panel',
]) {
  assertIncludes(reverseCss, className, `Reverse CSS defines ${className}`);
}

const reverseSource = readFileSync(path.join(ROOT, 'src', 'js', '04-views.js'), 'utf8');
assertNotIncludes(reverseSource, 'observedMyPct', 'Reverse source no longer uses percent name for my raw HP input');
assertNotIncludes(reverseSource, 'RC_DEF_NATURES', 'Reverse source removed stale defensive-only nature list');
assertNotIncludes(reverseSource, 'RC_ATK_NATURES', 'Reverse source removed stale offensive-only nature list');
assertIncludes(reverseSource, 'myMoveSet', 'Reverse source stores four move slots for follow-up damage');
assertIncludes(reverseSource, 'rcAnalyzeMyFollowupMove', 'Reverse source calculates my follow-up move damage');
assertIncludes(reverseSource, 'rcAnalyzeOpponentFollowupMove', 'Reverse source calculates selected opponent follow-up damage');
assertIncludes(reverseSource, '공격축 미확인', 'Reverse source marks unobserved offensive axis');
assertIncludes(reverseSource, '내구 미확인', 'Reverse source marks unobserved defensive axis');
assertIncludes(reverseSource, '속도 미확인', 'Reverse source marks priority-distorted speed observations');

const initialHtml = reverseRenderedHtml();
assertIncludes(initialHtml, 'data-rc-action="observedMyHp"', 'Reverse rendered HTML uses raw HP action name');
for (const stale of ['undefined', 'NaN']) {
  assertNotIncludes(initialHtml, stale, `Reverse initial render does not leak ${stale}`);
}

configurePrimarinaArchaludon(api, 81);

const myMove = api.MoveById.moonblast;
assertOk(
  JSON.stringify(api.revCalcState.my.types) === JSON.stringify(['Water', 'Fairy']),
  'Reverse Pokemon selection refreshes source typing for STAB',
  JSON.stringify(api.revCalcState.my.types),
);

const stage1 = api.rcStage1Defense(
  api.revCalcState.my,
  api.PokemonById.archaludon,
  myMove,
  35,
  api.rcAnalysisField(),
  'spd',
);

assertOk(stage1.length > 0, 'Primarina Moonblast remaining 35% produces defensive candidates', `stage1=${stage1.length}`);
assertOk(
  stage1.some(c => c.nature === 'modest' && c.hpEv === 2 && c.defEv === 0),
  'Defensive stage keeps Modest H2 D0 Archaludon as a legal candidate',
);

const result81 = api.rcAnalyze();
assertOk(result81.debug.stage1 > 0, 'Full reverse keeps nonzero stage1 count for remaining HP 81', JSON.stringify(result81.debug));
assertOk(result81.debug.refined > 0, 'Full reverse finds candidates when my remaining HP is a real roll value', JSON.stringify(result81.debug));

configurePrimarinaArchaludon(api, 81, { itemCandidates: DEFAULT_RC_ITEM_CANDIDATES, turnOrder: 'opp-first' });
const rankedResult = api.rcAnalyze();
api.revCalcState.results = rankedResult;
const top = rankedResult.results[0];
assertOk(top.nature === 'modest', 'Ranking prefers relevant non-speed-dropping offensive nature', JSON.stringify(top));
assertOk((top.atkEvMax ?? top.atkEv) === 32, 'Ranking keeps the highest matching offensive investment in grouped ranges', JSON.stringify(top));
assertOk((top.speEvMin ?? top.speEv) === 0 && (top.speEvMax ?? top.speEv) > 0, 'Speed observation is rendered as a possible range, not exact S0', JSON.stringify(top));
assertOk(top.groupCount > 1, 'Reverse results compress near-identical random-roll candidates into one group', JSON.stringify(top));
assertOk(top.completionMinTotal <= 66 && top.completionMaxTotal >= 66, 'Top reverse group can be completed to the full 66 point budget', JSON.stringify(top));
assertOk(rankedResult.results.length <= 5, 'Reverse results are limited to five visible candidate groups', JSON.stringify(rankedResult.results.length));

const rankedHtml = reverseRenderedHtml();
assertIncludes(rankedHtml, '관측 투자 범위', 'Reverse briefing explains observed investment ranges');
assertIncludes(rankedHtml, '완성 66', 'Reverse rows show full 66 point completion assumption');
assertIncludes(rankedHtml, '내 다음 기술 대미지', 'Reverse rows show my follow-up damage section');
assertIncludes(rankedHtml, 'rc-followup-chip', 'Reverse rows render follow-up damage chips');
assertIncludes(rankedHtml, 'rc-followup-damage', 'Reverse rows color follow-up damage predictions');
assertNotIncludes(rankedHtml, 'class="rc-results-summary"', 'Reverse rendered results omit the old mode summary panel');
assertNotIncludes(rankedHtml, 'rc-result-stars', 'Reverse rendered results omit internal match score column');
assertIncludes(rankedHtml, '상대 예상 기술', 'Reverse selected row renders opponent prediction selector');
assertNotIncludes(rankedHtml, '추가 관측', 'Reverse briefing omits the old extra-observation wording');

const stage1ForExpected = api.rcStage1Defense(
  api.revCalcState.my,
  api.PokemonById.archaludon,
  api.MoveById.moonblast,
  35,
  api.rcAnalysisField(),
  'spd',
);
const refinedForExpected = api.rcStage3OffenseRefine(
  stage1ForExpected,
  api.revCalcState.my,
  api.PokemonById.archaludon,
  api.MoveById.thunderbolt,
  81,
  api.rcAnalysisField(),
  'spa',
);
assertOk(
  refinedForExpected.some(c => c.nature === 'modest' && c.hpEv === 2 && c.defEv === 0 && c.atkEv === 32 && c.item === ''),
  'Expected Modest H2 C32 no-item Archaludon remains in the legal candidate set',
);

configurePrimarinaArchaludon(api, 80);
const result80 = api.rcAnalyze();
assertOk(result80.debug.stage1 > 0, 'Impossible received HP still reports defensive candidates', JSON.stringify(result80.debug));
assertOk(result80.debug.refined === 0, 'My remaining HP 80 is rejected because no Thunderbolt roll leaves exactly 80 HP', JSON.stringify(result80.debug));

configureArchaludonPrimarina(api, 55, { itemCandidates: DEFAULT_RC_ITEM_CANDIDATES, turnOrder: 'my-first' });
const hpPriorityResult = api.rcAnalyze();
assertOk(
  hpPriorityResult.debug.stage1Trimmed === hpPriorityResult.debug.stage1,
  'Reverse analysis no longer truncates defensive candidates through the old Stage 1 slice',
  JSON.stringify(hpPriorityResult.debug),
);
const hpPriorityRows = hpPriorityResult.results.map(c => api.rcCandidateEvParts(c, hpPriorityResult.speedActive));
assertOk(
  hpPriorityRows.every(parts => {
    const hasSpdInvestment = parts.some(part => /^D[1-9]/.test(part));
    if (!hasSpdInvestment) return true;
    return parts.includes('H32');
  }),
  'Reverse HP priority only displays special-defense investment after H32',
  JSON.stringify(hpPriorityRows),
);

configureArchaludonPrimarina(api, 59, { itemCandidates: DEFAULT_RC_ITEM_CANDIDATES, turnOrder: 'my-first' });
const roleScoredResult = api.rcAnalyze();
assertOk(
  roleScoredResult.results[0]?.item !== 'choicescarf',
  'Reverse practical role scoring demotes awkward low-speed scarf candidates',
  JSON.stringify(roleScoredResult.results[0]),
);
const topRoleCompletion = api.rcRoleCompletionInfo(roleScoredResult.results[0], roleScoredResult.speedActive);
assertOk(
  topRoleCompletion.label.includes('막이') && topRoleCompletion.parts.some(part => /^B[1-9]/.test(part)),
  'Reverse role completion projects defensive natures into bulk-first spreads',
  JSON.stringify(topRoleCompletion),
);
assertOk(
  roleScoredResult.results[0]?.groupCount > 1,
  'Reverse practical role scoring keeps compressed result groups',
  JSON.stringify(roleScoredResult.results[0]),
);

if (process.exitCode) process.exit(process.exitCode);
