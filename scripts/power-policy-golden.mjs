import { readSourceFileSync as readFileSync } from './source-utils.mjs';
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

function loadCalcApi() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const data = {
    'data-pokemon': JSON.stringify(readJsonScript(html, 'data-pokemon')),
    'data-moves': JSON.stringify(readJsonScript(html, 'data-moves')),
    'data-abilities': JSON.stringify(readJsonScript(html, 'data-abilities')),
    'data-items': JSON.stringify(readJsonScript(html, 'data-items')),
    'data-natures': JSON.stringify(readJsonScript(html, 'data-natures')),
    'data-typechart': JSON.stringify(readJsonScript(html, 'data-typechart')),
    'data-rules': JSON.stringify(readJsonScript(html, 'data-rules')),
  };

  const elements = new Map();
  function elementFor(id) {
    if (data[id]) return { textContent: data[id] };
    if (!elements.has(id)) {
      elements.set(id, {
        textContent: '',
        innerHTML: '',
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
      });
    }
    return elements.get(id);
  }

  const context = vm.createContext({
    console,
    document: { getElementById: elementFor },
  });

  const source = [
    readFileSync(path.join(ROOT, 'src', 'js', '01-core.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '01-10-rotom-ui.js'), 'utf8'),
    readFileSync(path.join(ROOT, 'src', 'js', '02-engine.js'), 'utf8'),
    `
      globalThis.__calcApi = {
        PokemonById, MoveById, AbilityById, ItemById, RULES,
        calculateDamage, calculatePowerDamage, effectiveSpeed, hkoLabel, simulateMoveKoDistribution, getMoveEffectiveness,
        calcStats, effectiveTypes, isTeraActive
      };
    `,
  ].join('\n');

  vm.runInContext(source, context, { filename: 'damage-engine.vm.js' });
  return context.__calcApi;
}

const api = loadCalcApi();

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const EMPTY_EVS = Object.fromEntries(STATS.map(stat => [stat, 0]));
const EMPTY_RANKS = Object.fromEntries(STATS.filter(stat => stat !== 'hp').map(stat => [stat, 0]));

function normalizeId(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeHpPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const raw = n > 1 ? n / 100 : n;
  return Math.max(0.01, Math.min(1, raw));
}

function defaultAbility(pokemon) {
  const abilityName = pokemon?.ab?.['0'] || pokemon?.ab?.H || '';
  return normalizeId(abilityName);
}

function side(pokemonIdx, overrides = {}) {
  const pokemon = api.PokemonById[pokemonIdx];
  if (!pokemon) throw new Error(`Unknown pokemon: ${pokemonIdx}`);

  const base = {
    pokemonIdx,
    evs: { ...EMPTY_EVS },
    nature: 'hardy',
    ranks: { ...EMPTY_RANKS },
    status: 'none',
    ability: defaultAbility(pokemon),
    item: '',
    tera: false,
    teraType: pokemon.types[0] || 'Normal',
    hpPct: 1,
    pinch: false,
    fullHP: true,
    boosterEnergyState: 'auto',
    moves: [],
  };

  const next = {
    ...base,
    ...overrides,
    evs: { ...base.evs, ...(overrides.evs || {}) },
    ranks: { ...base.ranks, ...(overrides.ranks || {}) },
  };
  next.hpPct = normalizeHpPct(next.hpPct);
  next.fullHP = next.hpPct >= 1;
  next.pinch = next.hpPct <= (1 / 3);
  return next;
}

function field(overrides = {}) {
  return {
    weather: 'none',
    terrain: 'none',
    gameType: 'Singles',
    isCritical: false,
    isGravity: false,
    defReflect: false,
    defLightScreen: false,
    atkHelpingHand: false,
    ruinSword: false,
    ruinTablet: false,
    ruinBeads: false,
    ruinVessel: false,
    defStealthRock: false,
    defSpikesLayers: 0,
    ...overrides,
  };
}

function resultSummary(result) {
  if (!result) return null;
  const summary = {
    damages: result.damages,
    minPct: Number(result.minPct.toFixed(1)),
    maxPct: Number(result.maxPct.toFixed(1)),
    effectiveness: result.effectiveness,
    moveType: result.moveType,
    category: result.category,
    bp: result.bp,
    atk: result.atk,
    def: result.def,
    defHP: result.defHP,
  };
  if (result.multihitCount) {
    summary.rawDamages = result.rawDamages;
    summary.multihitCount = result.multihitCount;
  }
  return summary;
}

function runCase(testCase) {
  const baseMove = api.MoveById[testCase.move];
  const move = testCase.moveOverride ? { ...baseMove, ...testCase.moveOverride } : baseMove;
  const result = api.calculateDamage(
    testCase.atk,
    testCase.def,
    move,
    testCase.field,
  );
  return resultSummary(result);
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    console.error(`\n[FAIL] ${label}`);
    console.error('expected:', expectedJson);
    console.error('actual:  ', actualJson);
    process.exitCode = 1;
    return;
  }
  console.log(`[PASS] ${label}`);
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

function assertMoveFields(moveId, expected) {
  const move = api.MoveById[moveId];
  if (!move) {
    console.error(`[FAIL] move data ${moveId} exists`);
    process.exitCode = 1;
    return;
  }
  const actual = Object.fromEntries(Object.keys(expected).map(key => [key, move[key]]));
  assertDeepEqual(actual, expected, `move data ${moveId} fields`);
}

function assertOptionalMoveFields(moveId, expected) {
  if (!api.MoveById[moveId]) {
    console.log(`[SKIP] move data ${moveId} is not in Champions data`);
    return;
  }
  assertMoveFields(moveId, expected);
}

function assertItemFields(itemId, expected) {
  const item = api.ItemById[itemId];
  if (!item) {
    console.error(`[FAIL] item data ${itemId} exists`);
    process.exitCode = 1;
    return;
  }
  const actual = Object.fromEntries(Object.keys(expected).map(key => [key, item[key]]));
  assertDeepEqual(actual, expected, `item data ${itemId} fields`);
}

function assertOptionalItemFields(itemId, expected) {
  if (!api.ItemById[itemId]) {
    console.log(`[SKIP] item data ${itemId} is not in Champions data`);
    return;
  }
  assertItemFields(itemId, expected);
}

function assertAbilityFields(abilityId, expected) {
  const ability = api.AbilityById[abilityId];
  if (!ability) {
    console.error(`[FAIL] ability data ${abilityId} exists`);
    process.exitCode = 1;
    return;
  }
  const actual = Object.fromEntries(Object.keys(expected).map(key => [key, ability[key]]));
  assertDeepEqual(actual, expected, `ability data ${abilityId} fields`);
}


const move = (type, extra = {}) => ({ id: 'policytest', name: 'test', bp: 80, cat: 'Special', type, flags: {}, ...extra });
const neutral = overrides => side('venusaur', { ability: '', types: ['Normal'], ...overrides });
const power = (a, d, m, f = field()) => api.calculatePowerDamage(a, d, m, f);
const rolls = (n) => Array(16).fill(n);
function ko(values, item = '', ability = '', context = null) {
  return api.hkoLabel(values, 100, neutral({ item, ability }), field(), context);
}
const randomTwo = ko([45, 55]);
assertDeepEqual([randomTwo.label, randomTwo.turns, randomTwo.pct, randomTwo.metric.guaranteedTurn], ['난수', '2타', '75.0%', 3], 'independent two-hit rolls: 45+45 fails, other three combinations KO');
assertDeepEqual([ko([50,55]).label, ko([50,55]).turns], ['확정','2타'], 'minimum 50 against HP100 guarantees two hits');
assertDeepEqual([ko([50], 'leftovers').label, ko([50], 'leftovers').turns], ['확정','3타'], 'leftovers heals six between 50-damage attacks');
assertDeepEqual([ko([56], 'leftovers').label, ko([56], 'leftovers').turns], ['확정','2타'], 'leftovers still allows guaranteed two hits at 56 damage');
assertDeepEqual(ko([100], 'sitrusberry').turns, '1타', 'OHKO precedes Sitrus recovery');
assertDeepEqual(ko([100], 'leftovers').turns, '1타', 'OHKO precedes Leftovers recovery');
assertDeepEqual(ko([60], 'sitrusberry').turns, '3타', 'Sitrus adds 25 once: 100 to 65 to 5 to KO');
assertDeepEqual(ko([63], 'sitrusberry').turns, '2타', 'Sitrus does not prevent two hits at 63');
assertDeepEqual(ko([50], 'oranberry').turns, '3타', 'Oran adds fixed 10 once');
assertDeepEqual(ko([50], 'sitrusberry', '', {defItem:'sitrusberry',defAbility:'',atkAbility:'unnerve'}).turns, '2타', 'Unnerve suppresses healing berries');
assertDeepEqual(ko([70], 'sitrusberry', 'ripen').turns, '3타', 'Ripen doubles Sitrus recovery');
assertDeepEqual(ko([40], 'sitrusberry', 'klutz').turns, '3타', 'Klutz suppresses recovery');
assertDeepEqual(ko([100], 'focussash').turns, '1타', 'Sash cannot prevent power OHKO');
assertDeepEqual(ko([100], '', 'sturdy').turns, '1타', 'Sturdy cannot prevent power OHKO');
assertDeepEqual(ko([100], 'focusband').turns, '1타', 'Focus Band cannot prevent power OHKO');
const recovery = api.simulateMoveKoDistribution({ variants:[{weight:1,hitDamages:[[45,55]]}] },100,100,{residualRecovery:{kind:'endTurn',fraction:[1,16]}});
assertDeepEqual([recovery.cumulative[1], recovery.guaranteedTurn], [0.25,3], 'Leftovers random two-hit chance uses all independent combinations');
const oneBerry = api.simulateMoveKoDistribution({ variants:[{weight:1,hitDamages:[[40]]}] },100,100,{hpRecovery:{trigger:'halfHp',fraction:[1,4]}});
assertDeepEqual(oneBerry.guaranteedTurn, 4, 'Sitrus is consumed once across repeated attacks');
// Every type-chart immunity blocks HP damage; ability/item immunity remains informational.
let typeCases = 0;
for (const attackType of ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']) {
  for (const defenseType of ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']) {
    const d = neutral({types:[defenseType]});
    const standard = api.calculateDamage(neutral(),d,move(attackType),field());
    if (standard.effectiveness !== 0) continue;
    const r = power(neutral(),d,move(attackType));
    assertOk(r.damages.every(damage => damage === 0) && r.immunityNotes.length > 0 && r.koContext.typeImmune, attackType+' vs '+defenseType+' type immunity blocks damage');
    typeCases++;
  }
}
assertOk(typeCases >= 8, 'all elemental immunity pairs traversed');
for (const ability of Object.values(api.AbilityById)) {
  for (const rule of ability.immunities || []) {
    const type = rule.types?.[0] || 'Normal';
    const m = move(type, {flags: rule.flag ? {[rule.flag]:1} : {}});
    const d = neutral({ability:ability.id});
    const observed = api.calculateDamage(neutral(),d,m,field());
    const r = power(neutral(),d,m);
    assertOk(observed.damages.every(v => v === 0) && r.damages[0] > 0 && r.immunityNotes.length, ability.id+' immunity policy');
  }
}
for (const id of ['focussash','focusband']) assertOk(power(neutral(),neutral({item:id}),move('Normal')).survivalNotes.length, id+' survival badge');
const disguise = power(neutral(),side('mimikyu',{ability:'disguise',damageBlockActive:true}),move('Steel'));
assertOk(disguise.damages[0] > 0 && disguise.immunityNotes.length, 'Disguise bypassed and annotated');
// Current roster does not include Air Balloon; exercise its retained mechanics with an explicit fixture.
api.ItemById.airballoon ||= {id:'airballoon',name:'Air Balloon',groundImmunity:true,grounded:false};
const balloon = power(neutral(),neutral({item:'airballoon'}),move('Ground'));
assertOk(balloon.damages[0] > 0 && balloon.immunityNotes.length, 'Air Balloon bypassed and annotated');
const wonder = power(neutral(),neutral({ability:'wonderguard'}),move('Normal'));
assertOk(wonder.damages[0] > 0 && wonder.immunityNotes.length,'Wonder Guard bypassed and annotated');
const gravity = power(neutral(),neutral({types:['Flying'],ability:'levitate'}),move('Ground'),field({isGravity:true}));
assertOk(gravity.damages[0] > 0 && gravity.immunityNotes.length === 0,'Gravity removes Ground immunity rather than reporting a false immunity');
const a = neutral();
const d = neutral({types:['Grass'],ability:'multiscale'});
const reduced = power(a,d,move('Fire'));
const plain = power(a,{...d,ability:''},move('Fire'));
assertOk(reduced.damages[0] < plain.damages[0] && reduced.mods.some(v => v.includes('멀티스케일')), 'Multiscale applied and traced');
assertDeepEqual(reduced.koContext.damageAtHp(reduced.defHP-1,true,0,0), plain.damages, 'Multiscale disappears after HP loss');
const berry = power(a,neutral({types:['Grass'],item:'occaberry'}),move('Fire'));
assertOk(berry.damages[0] < plain.damages[0] && berry.mods.some(v=>v.includes('열매')), 'resist berry applied and traced');
assertDeepEqual(berry.koContext.damageAtHp(berry.defHP-1,true,0,0),plain.damages,'resist berry consumed after first hit');
const gas = power(neutral({ability:'adaptability'}),neutral({ability:'neutralizinggas'}),move('Normal'));
assertDeepEqual(gas.damages,power(neutral(),neutral(),move('Normal')).damages,'Neutralizing Gas suppresses Adaptability STAB');
for (const [ability, weather, terrain] of [['swiftswim','Rain','none'],['swiftswim','Heavy Rain','none'],['chlorophyll','Sun','none'],['sandrush','Sand','none'],['slushrush','Snow','none'],['surgesurfer','none','Electric']]) {
  const s = side('qwilfish',{ability});
  assertDeepEqual(api.effectiveSpeed(s,field({weather,terrain})),api.calcStats(s).spe*2,ability+' active speed');
}
const swim = side('qwilfish',{ability:'swiftswim'});
assertDeepEqual(api.effectiveSpeed(swim,field({weather:'Rain'}),neutral({ability:'cloudnine'})),api.calcStats(swim).spe,'Cloud Nine suppresses Swift Swim');
assertDeepEqual(api.effectiveSpeed(swim,field({weather:'Rain'}),neutral({ability:'neutralizinggas'})),api.calcStats(swim).spe,'Neutralizing Gas suppresses Swift Swim');
assertDeepEqual(api.effectiveSpeed(side('qwilfish',{ability:'klutz',item:'choicescarf'}),field()),api.calcStats(swim).spe,'Klutz suppresses Choice Scarf speed');
const fast = side('gengar',{ability:'protosynthesis',evs:{spe:32},nature:'timid'});
assertDeepEqual(api.effectiveSpeed(fast,field({weather:'Sun'})),Math.floor(api.calcStats(fast).spe*1.5),'Paradox highest Speed gets 1.5');
console.log('[AUDIT] type immunity cases: '+typeCases);
const physical = move('Normal',{cat:'Physical'});
const normalDamage = power(neutral(),neutral(),physical).damages[0];
assertOk(power(neutral({ability:'defeatist',hpPct:0.5}),neutral(),physical).damages[0] < normalDamage, 'Defeatist activates at half HP');
assertDeepEqual(power(neutral({ability:'defeatist',hpPct:0.51}),neutral(),physical).damages[0],normalDamage,'Defeatist inactive above half HP');
assertOk(power(neutral({ability:'slowstart',slowStartActive:true}),neutral(),physical).damages[0] < normalDamage,'Slow Start active Attack penalty');
assertDeepEqual(power(neutral({ability:'slowstart',slowStartActive:false}),neutral(),physical).damages[0],normalDamage,'Slow Start inactive has no penalty');
assertOk(power(neutral({ability:'stakeout',stakeoutActive:true}),neutral(),physical).damages[0] > normalDamage,'Stakeout conditional offensive boost');
assertOk(power(neutral({ability:'rivalry',rivalryGender:'same'}),neutral(),physical).damages[0] > normalDamage,'Rivalry same-gender boost');
assertOk(power(neutral({ability:'rivalry',rivalryGender:'opposite'}),neutral(),physical).damages[0] < normalDamage,'Rivalry opposite-gender penalty');
const fireBase = power(neutral(),neutral(),move('Fire')).damages[0];
assertOk(power(neutral({ability:'firemane'}),neutral(),move('Fire')).damages[0] > fireBase,'Fire Mane offensive modifier');
const psy = api.MoveById.psyshock;
assertOk(power(neutral(),neutral({ability:'icescales'}),psy).damages[0] < power(neutral(),neutral(),psy).damages[0], 'Ice Scales halves special Psyshock despite physical defense use');
const mold = neutral({ability:'moldbreaker'});
assertOk(power(mold,neutral({ability:'shadowshield'}),physical).damages[0] < power(mold,neutral(),physical).damages[0],'Mold Breaker does not bypass Shadow Shield');
for (const ab of ['orichalcumpulse','hadronengine']) assertDeepEqual(power(neutral({ability:ab}),neutral(),ab==='hadronengine'?move('Normal'):physical).damages,power(neutral(),neutral(),ab==='hadronengine'?move('Normal'):physical).damages,ab+' requires its weather or terrain');
const special = move('Normal');
assertOk(power(neutral(),neutral(),special,field({gameType:'Doubles',allyBattery:true})).damages[0] > power(neutral(),neutral(),special,field({gameType:'Doubles'})).damages[0],'ally Battery special damage boost');
assertDeepEqual(power(neutral(),neutral(),special,field({allyBattery:true})).damages,power(neutral(),neutral(),special).damages,'ally Battery ignored in Singles');
assertOk(power(neutral(),neutral(),special,field({gameType:'Doubles',allyFriendGuard:true})).damages[0] < power(neutral(),neutral(),special,field({gameType:'Doubles'})).damages[0],'defender ally Friend Guard damage reduction');
