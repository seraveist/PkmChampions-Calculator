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
    readFileSync(path.join(ROOT, 'src', 'js', '02-engine.js'), 'utf8'),
    `
      globalThis.__calcApi = {
        PokemonById, MoveById, AbilityById, ItemById, RULES,
        calculateDamage, calcStats, effectiveTypes, isTeraActive
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
  return name.toLowerCase().replace(/[\s'\-()]/g, '');
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
    pinch: false,
    fullHP: true,
    moves: [],
  };

  return {
    ...base,
    ...overrides,
    evs: { ...base.evs, ...(overrides.evs || {}) },
    ranks: { ...base.ranks, ...(overrides.ranks || {}) },
  };
}

function field(overrides = {}) {
  return {
    weather: 'none',
    terrain: 'none',
    gameType: 'Singles',
    isCritical: false,
    isTrickRoom: false,
    isGravity: false,
    defReflect: false,
    defLightScreen: false,
    atkHelpingHand: false,
    defProtect: false,
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

const atkIncineroar = side('incineroar', {
  evs: { atk: 32, spd: 2, spe: 32 },
  nature: 'adamant',
  item: 'charcoal',
});
const defVenusaur = side('venusaur', {
  evs: { hp: 32, def: 32, spd: 2 },
  nature: 'bold',
});

const atkTaurosSheerForce = side('tauros', {
  ability: 'sheerforce',
  evs: { atk: 32 },
  nature: 'adamant',
});
const atkEmboarReckless = side('emboar', {
  ability: 'reckless',
  evs: { atk: 32 },
  nature: 'adamant',
});
const atkGarchomp = side('garchomp', {
  evs: { atk: 32 },
  nature: 'adamant',
});
const atkVenusaurSpecial = side('venusaur', {
  evs: { spa: 32 },
  nature: 'modest',
});
const atkToucannonSkillLink = side('toucannon', {
  ability: 'skilllink',
  evs: { atk: 32 },
  nature: 'adamant',
});
const defCharizard = side('charizard', {
  evs: { hp: 32 },
  nature: 'hardy',
});
const defGarchomp = side('garchomp', {
  evs: { hp: 32 },
  nature: 'hardy',
});
const defTyranitarPhysical = side('tyranitar', {
  evs: { hp: 32, def: 32 },
  nature: 'impish',
});
const atkPikachuSpecial = side('pikachu', {
  evs: { spa: 32 },
  nature: 'modest',
});
const defTyranitarSpecial = side('tyranitar', {
  evs: { hp: 32, spd: 32 },
  nature: 'careful',
});

const cases = [
  {
    name: 'charcoal flare blitz baseline',
    move: 'flareblitz',
    atk: atkIncineroar,
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [204, 204, 206, 210, 212, 216, 216, 218, 222, 224, 228, 228, 230, 234, 236, 240],
      minPct: 109.1,
      maxPct: 128.3,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'charcoal flare blitz in sun',
    move: 'flareblitz',
    atk: atkIncineroar,
    def: defVenusaur,
    field: field({ weather: 'Sun' }),
    expected: {
      damages: [306, 308, 312, 314, 318, 324, 326, 330, 332, 336, 342, 344, 348, 350, 354, 360],
      minPct: 163.6,
      maxPct: 192.5,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'manual move power overrides base power',
    move: 'flareblitz',
    moveOverride: { bp: 100, manualBp: true },
    atk: atkIncineroar,
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [168, 170, 174, 174, 176, 180, 180, 182, 186, 186, 188, 192, 192, 194, 198, 200],
      minPct: 89.8,
      maxPct: 107,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 120,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'ruin sword uses field argument',
    move: 'flareblitz',
    atk: atkIncineroar,
    def: defVenusaur,
    field: field({ ruinSword: true }),
    expected: {
      damages: [270, 272, 276, 278, 282, 284, 288, 290, 294, 296, 300, 302, 306, 308, 312, 318],
      minPct: 144.4,
      maxPct: 170.1,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 183,
      def: 111,
      defHP: 187,
    },
  },
  {
    name: 'thunderbolt ignores tera type while champions tera is disabled',
    move: 'thunderbolt',
    atk: side('pikachu', {
      evs: { spa: 32, spe: 32 },
      nature: 'hardy',
      tera: true,
      teraType: 'Water',
    }),
    def: side('venusaur', { evs: { hp: 32 }, nature: 'hardy' }),
    field: field(),
    expected: {
      damages: [21, 22, 22, 22, 23, 23, 23, 24, 24, 24, 24, 24, 24, 25, 25, 26],
      minPct: 11.2,
      maxPct: 13.9,
      effectiveness: 0.5,
      moveType: 'Electric',
      category: 'Special',
      bp: 90,
      atk: 102,
      def: 120,
      defHP: 187,
    },
  },
  {
    name: 'sheer force body slam uses secondary flag',
    move: 'bodyslam',
    atk: atkTaurosSheerForce,
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [72, 73, 73, 75, 75, 76, 76, 78, 79, 79, 81, 81, 82, 82, 84, 85],
      minPct: 38.5,
      maxPct: 45.5,
      effectiveness: 1,
      moveType: 'Normal',
      category: 'Physical',
      bp: 111,
      atk: 167,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'reckless flare blitz uses recoil flag',
    move: 'flareblitz',
    atk: atkEmboarReckless,
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [212, 216, 218, 218, 222, 224, 228, 230, 234, 234, 236, 240, 242, 246, 248, 252],
      minPct: 113.4,
      maxPct: 134.8,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 192,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'earthquake singles target baseline',
    move: 'earthquake',
    atk: atkGarchomp,
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [76, 78, 79, 79, 81, 81, 82, 84, 84, 85, 85, 87, 88, 88, 90, 91],
      minPct: 40.6,
      maxPct: 48.7,
      effectiveness: 1,
      moveType: 'Ground',
      category: 'Physical',
      bp: 100,
      atk: 200,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'earthquake doubles applies spread target penalty',
    move: 'earthquake',
    atk: atkGarchomp,
    def: defVenusaur,
    field: field({ gameType: 'Doubles' }),
    expected: {
      damages: [58, 58, 60, 60, 60, 61, 61, 63, 63, 64, 64, 66, 66, 67, 67, 69],
      minPct: 31,
      maxPct: 36.9,
      effectiveness: 1,
      moveType: 'Ground',
      category: 'Physical',
      bp: 100,
      atk: 200,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'terrain pulse electric changes type and doubles base power',
    move: 'terrainpulse',
    atk: atkVenusaurSpecial,
    def: defCharizard,
    field: field({ terrain: 'Electric' }),
    expected: {
      damages: [156, 158, 160, 160, 162, 164, 166, 168, 170, 172, 174, 176, 178, 180, 182, 184],
      minPct: 84.3,
      maxPct: 99.5,
      effectiveness: 2,
      moveType: 'Electric',
      category: 'Special',
      bp: 130,
      atk: 167,
      def: 105,
      defHP: 185,
    },
  },
  {
    name: 'weather ball snow changes type and doubles base power',
    move: 'weatherball',
    atk: atkVenusaurSpecial,
    def: defGarchomp,
    field: field({ weather: 'Snow' }),
    expected: {
      damages: [240, 244, 244, 248, 252, 252, 256, 260, 264, 264, 268, 272, 272, 276, 280, 284],
      minPct: 111.6,
      maxPct: 132.1,
      effectiveness: 4,
      moveType: 'Ice',
      category: 'Special',
      bp: 100,
      atk: 167,
      def: 105,
      defHP: 215,
    },
  },
  {
    name: 'skill link bullet seed uses multihit data',
    move: 'bulletseed',
    atk: atkToucannonSkillLink,
    def: defTyranitarPhysical,
    field: field(),
    expected: {
      damages: [110, 110, 110, 110, 110, 110, 110, 110, 120, 120, 120, 120, 120, 120, 120, 130],
      minPct: 53.1,
      maxPct: 62.8,
      effectiveness: 2,
      moveType: 'Grass',
      category: 'Physical',
      bp: 25,
      atk: 189,
      def: 178,
      defHP: 207,
      rawDamages: [22, 22, 22, 22, 22, 22, 22, 22, 24, 24, 24, 24, 24, 24, 24, 26],
      multihitCount: [2, 5],
    },
  },
  {
    name: 'sand boosts rock special defense',
    move: 'thunderbolt',
    atk: atkPikachuSpecial,
    def: defTyranitarSpecial,
    field: field({ weather: 'Sand' }),
    expected: {
      damages: [24, 24, 24, 24, 24, 25, 25, 25, 25, 25, 27, 27, 27, 27, 27, 28],
      minPct: 11.6,
      maxPct: 13.5,
      effectiveness: 1,
      moveType: 'Electric',
      category: 'Special',
      bp: 90,
      atk: 112,
      def: 250,
      defHP: 207,
    },
  },
  {
    name: 'occa berry halves super-effective fire',
    move: 'flareblitz',
    atk: atkIncineroar,
    def: side('venusaur', {
      evs: { hp: 32, def: 32, spd: 2 },
      nature: 'bold',
      item: 'occaberry',
    }),
    field: field(),
    expected: {
      damages: [102, 102, 103, 105, 106, 108, 108, 109, 111, 112, 114, 114, 115, 117, 118, 120],
      minPct: 54.5,
      maxPct: 64.2,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'unnerve blocks occa berry',
    move: 'flareblitz',
    atk: side('incineroar', {
      ability: 'unnerve',
      evs: { atk: 32, spd: 2, spe: 32 },
      nature: 'adamant',
      item: 'charcoal',
    }),
    def: side('venusaur', {
      evs: { hp: 32, def: 32, spd: 2 },
      nature: 'bold',
      item: 'occaberry',
    }),
    field: field(),
    expected: {
      damages: [204, 204, 206, 210, 212, 216, 216, 218, 222, 224, 228, 228, 230, 234, 236, 240],
      minPct: 109.1,
      maxPct: 128.3,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'cloud nine suppresses sun damage',
    move: 'flareblitz',
    atk: atkIncineroar,
    def: side('venusaur', {
      ability: 'cloudnine',
      evs: { hp: 32, def: 32, spd: 2 },
      nature: 'bold',
    }),
    field: field({ weather: 'Sun' }),
    expected: {
      damages: [204, 204, 206, 210, 212, 216, 216, 218, 222, 224, 228, 228, 230, 234, 236, 240],
      minPct: 109.1,
      maxPct: 128.3,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 144,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'psyshock uses physical defense',
    move: 'psyshock',
    atk: atkVenusaurSpecial,
    def: side('venusaur', {
      evs: { hp: 32, def: 32, spd: 32 },
      nature: 'calm',
    }),
    field: field(),
    expected: {
      damages: [76, 76, 78, 78, 80, 80, 80, 82, 82, 84, 84, 86, 86, 88, 88, 90],
      minPct: 40.6,
      maxPct: 48.1,
      effectiveness: 2,
      moveType: 'Psychic',
      category: 'Special',
      bp: 80,
      atk: 167,
      def: 135,
      defHP: 187,
    },
  },
  {
    name: 'foul play uses target attack rank',
    move: 'foulplay',
    atk: side('venusaur', {
      evs: { atk: 0 },
      nature: 'modest',
    }),
    def: side('garchomp', {
      evs: { hp: 32, atk: 32 },
      nature: 'adamant',
      ranks: { atk: 2 },
    }),
    field: field(),
    expected: {
      damages: [124, 126, 127, 129, 130, 132, 133, 135, 136, 138, 139, 141, 142, 144, 145, 147],
      minPct: 57.7,
      maxPct: 68.4,
      effectiveness: 1,
      moveType: 'Dark',
      category: 'Physical',
      bp: 95,
      atk: 400,
      def: 115,
      defHP: 215,
    },
  },
  {
    name: 'body press uses attacker defense rank',
    move: 'bodypress',
    atk: side('kommoo', {
      evs: { atk: 0, def: 32 },
      nature: 'bold',
      ranks: { atk: 2, def: 2 },
    }),
    def: side('tyranitar', {
      evs: { hp: 32, def: 32 },
      nature: 'impish',
    }),
    field: field(),
    expected: {
      damages: [396, 400, 400, 408, 412, 420, 420, 424, 432, 436, 444, 444, 448, 456, 460, 468],
      minPct: 191.3,
      maxPct: 226.1,
      effectiveness: 4,
      moveType: 'Fighting',
      category: 'Physical',
      bp: 80,
      atk: 388,
      def: 178,
      defHP: 207,
    },
  },
  {
    name: 'water bubble doubles water offense',
    move: 'liquidation',
    atk: side('araquanid', {
      ability: 'waterbubble',
      evs: { atk: 32 },
      nature: 'adamant',
    }),
    def: side('garchomp', {
      evs: { hp: 32, def: 32 },
      nature: 'impish',
    }),
    field: field(),
    expected: {
      damages: [81, 82, 82, 84, 84, 85, 87, 87, 88, 90, 90, 91, 93, 93, 94, 96],
      minPct: 37.7,
      maxPct: 44.7,
      effectiveness: 1,
      moveType: 'Water',
      category: 'Physical',
      bp: 85,
      atk: 268,
      def: 161,
      defHP: 215,
    },
  },
  {
    name: 'purifying salt halves ghost damage',
    move: 'shadowball',
    atk: atkVenusaurSpecial,
    def: side('garganacl', {
      ability: 'purifyingsalt',
      evs: { hp: 32, spd: 32 },
      nature: 'careful',
    }),
    field: field(),
    expected: {
      damages: [17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 19, 19, 19, 19, 19, 20],
      minPct: 8.2,
      maxPct: 9.7,
      effectiveness: 1,
      moveType: 'Ghost',
      category: 'Special',
      bp: 80,
      atk: 83,
      def: 156,
      defHP: 207,
    },
  },
  {
    name: 'shell armor blocks critical hit',
    move: 'thunderbolt',
    atk: atkPikachuSpecial,
    def: side('torkoal', {
      ability: 'shellarmor',
      evs: { hp: 32, spd: 32 },
      nature: 'careful',
    }),
    field: field({ isCritical: true }),
    expected: {
      damages: [43, 45, 45, 45, 46, 46, 46, 48, 48, 48, 49, 49, 49, 51, 51, 52],
      minPct: 24.3,
      maxPct: 29.4,
      effectiveness: 1,
      moveType: 'Electric',
      category: 'Special',
      bp: 90,
      atk: 112,
      def: 134,
      defHP: 177,
    },
  },
  {
    name: 'night shade fixed damage',
    move: 'nightshade',
    atk: side('gengar', {
      evs: { spa: 32 },
      nature: 'modest',
    }),
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
      minPct: 26.7,
      maxPct: 26.7,
      effectiveness: 1,
      moveType: 'Ghost',
      category: 'Special',
      bp: 0,
      atk: 0,
      def: 0,
      defHP: 187,
    },
  },
  {
    name: 'klutz ignores attack item',
    move: 'flareblitz',
    atk: side('incineroar', {
      ability: 'klutz',
      evs: { atk: 32, spd: 2, spe: 32 },
      nature: 'adamant',
      item: 'charcoal',
    }),
    def: defVenusaur,
    field: field(),
    expected: {
      damages: [168, 170, 174, 174, 176, 180, 180, 182, 186, 186, 188, 192, 192, 194, 198, 200],
      minPct: 89.8,
      maxPct: 107,
      effectiveness: 2,
      moveType: 'Fire',
      category: 'Physical',
      bp: 120,
      atk: 183,
      def: 148,
      defHP: 187,
    },
  },
  {
    name: 'mold breaker ignores levitate immunity',
    move: 'earthquake',
    atk: side('garchomp', {
      ability: 'moldbreaker',
      evs: { atk: 32 },
      nature: 'adamant',
    }),
    def: side('hydreigon', {
      ability: 'levitate',
      evs: { hp: 32, def: 32 },
      nature: 'bold',
    }),
    field: field(),
    expected: {
      damages: [73, 73, 75, 76, 76, 78, 78, 79, 79, 81, 82, 82, 84, 84, 85, 87],
      minPct: 36.7,
      maxPct: 43.7,
      effectiveness: 1,
      moveType: 'Ground',
      category: 'Physical',
      bp: 100,
      atk: 200,
      def: 156,
      defHP: 199,
    },
  },
  {
    name: 'neutralizing gas suppresses water absorb',
    move: 'liquidation',
    atk: side('araquanid', {
      ability: 'neutralizinggas',
      evs: { atk: 32 },
      nature: 'adamant',
    }),
    def: side('vaporeon', {
      ability: 'waterabsorb',
      evs: { hp: 32, def: 32 },
      nature: 'bold',
    }),
    field: field(),
    expected: {
      damages: [26, 27, 27, 27, 27, 27, 28, 28, 29, 29, 29, 30, 30, 30, 30, 31],
      minPct: 11,
      maxPct: 13.1,
      effectiveness: 0.5,
      moveType: 'Water',
      category: 'Physical',
      bp: 85,
      atk: 134,
      def: 123,
      defHP: 237,
    },
  },
];

if (api.RULES.teraDisabled !== true) {
  console.error('[FAIL] expected Champions rules to keep tera disabled');
  process.exitCode = 1;
}

assertMoveFields('bodyslam', { sec: true, tgt: 'normal' });
assertMoveFields('flareblitz', { sec: true, recoil: [33, 100], tgt: 'normal' });
assertMoveFields('earthquake', { tgt: 'allAdjacent' });
assertMoveFields('bulletseed', { mh: [2, 5], tgt: 'normal' });
assertMoveFields('bodypress', { overrideOffensiveStat: 'def' });
assertMoveFields('foulplay', { overrideOffensivePokemon: 'target' });
assertMoveFields('psyshock', { overrideDefensiveStat: 'def' });
assertMoveFields('nightshade', { damage: 'level' });
assertMoveFields('superfang', { fixedDamageKind: 'targetHalfHp' });
assertMoveFields('finalgambit', { fixedDamageKind: 'sourceCurrentHp' });
assertMoveFields('endeavor', { fixedDamageKind: 'targetMinusSourceHp' });
assertMoveFields('sheercold', { ohko: 'Ice' });
assertMoveFields('feint', { breaksProtect: true });
assertMoveFields('highjumpkick', { hasCrashDamage: true });
assertMoveFields('freezedry', { effectivenessKind: 'freezeDry' });
assertMoveFields('flyingpress', { effectivenessKind: 'flyingPress' });
assertMoveFields('facade', { burnBypass: true });
assertMoveFields('earthquake', { weakenedByGrassyTerrain: true });
assertMoveFields('gyroball', { variableBpKind: 'gyroBall' });
assertMoveFields('heatcrash', { variableBpKind: 'weightRatio' });
assertMoveFields('lowkick', { variableBpKind: 'targetWeight' });
assertMoveFields('weatherball', { variableBpKind: 'weatherBall' });
assertMoveFields('terrainpulse', { variableBpKind: 'terrainPulse' });
assertMoveFields('storedpower', { variableBpKind: 'positiveBoostCount' });
assertMoveFields('lastrespects', { variableBpKind: 'fallenAllies' });
assertMoveFields('weatherball', { typeChangeKind: 'weatherBall' });
assertMoveFields('terrainpulse', { typeChangeKind: 'terrainPulse' });
assertOptionalMoveFields('terablast', { typeChangeKind: 'teraBlast', categoryChangeKind: 'higherOffense' });
assertOptionalMoveFields('terastarstorm', { typeChangeKind: 'teraStarstorm' });
assertOptionalMoveFields('photongeyser', { categoryChangeKind: 'higherOffense' });
assertItemFields('charcoal', { typeBoostType: 'Fire' });
assertOptionalItemFields('flameplate', { typeBoostType: 'Fire' });
assertOptionalItemFields('muscleband', { powerBoostKind: 'physical', powerBoostMod: 'x1_1' });
assertOptionalItemFields('punchingglove', { powerBoostKind: 'punch', powerBoostMod: 'x1_1g' });
assertItemFields('occaberry', { resistBerryType: 'Fire' });
assertOptionalItemFields('chilanberry', { resistBerryType: 'Normal', resistBerryRequiresWeakness: false });
assertOptionalItemFields('choiceband', { attackStatBoost: { stat: 'atk', mod: 'x1_5' } });
assertOptionalItemFields('lifeorb', { finalDamageBoost: { kind: 'always', mod: 5324 } });
assertOptionalItemFields('deepseatooth', { attackStatBoost: { pokemon: ['clamperl'], stat: 'spa', mod: 'x2_0' } });
assertOptionalItemFields('metalpowder', { defenseStatBoost: { pokemon: ['ditto'], stat: 'def', mod: 'x2_0' } });
assertOptionalItemFields('boosterenergy', { paradoxActivation: true });
assertOptionalItemFields('loadeddice', { multiHitModifier: 'loadedDice' });
assertOptionalItemFields('focussash', { koSurvival: 'fullHpNoHazards' });
assertOptionalItemFields('sitrusberry', { hpRecovery: { kind: 'sitrus', trigger: 'halfHp', fraction: [1, 4] } });
assertOptionalItemFields('leftovers', { residualRecovery: { kind: 'endTurn', fraction: [1, 16] } });
assertOptionalItemFields('choicescarf', { speedStatBoost: { stat: 'spe', mod: 'x1_5' } });
assertOptionalItemFields('ironball', { speedStatBoost: { stat: 'spe', mod: 'x0_5' }, grounded: true });
assertOptionalItemFields('airballoon', { grounded: false, groundImmunity: true });
assertOptionalItemFields('utilityumbrella', { ignoresWeatherDamageModifiers: true });
assertOptionalItemFields('quickpowder', { speedStatBoost: { pokemon: ['ditto'], stat: 'spe', mod: 'x2_0' } });
assertAbilityFields('sheerforce', { bpBoosts: [{ secondary: true, mod: 'x1_3' }] });
assertAbilityFields('waterbubble', {
  attackStatBoosts: [{ types: ['Water'], mod: 'x2_0' }],
  defensiveAttackMods: [{ types: ['Fire'], mod: 'x0_5' }],
});
assertAbilityFields('furcoat', { defenseStatBoosts: [{ stat: 'def', mod: 'x2_0' }] });
assertAbilityFields('multiscale', { defensiveFinalMods: [{ fullHP: true, mod: 'x0_5' }] });
assertAbilityFields('sniper', { finalDamageBoosts: [{ critical: true, mod: 'x1_5' }] });
assertAbilityFields('levitate', { moldBreakerIgnored: true, grounded: false, immunities: [{ types: ['Ground'] }] });
assertAbilityFields('moldbreaker', { ignoresTargetAbility: true });
assertAbilityFields('cloudnine', { suppressesWeather: true });
assertAbilityFields('sturdy', { moldBreakerIgnored: true, ohkoBlock: true, koSurvival: 'fullHpNoHazards' });
assertAbilityFields('battlearmor', { moldBreakerIgnored: true, blocksCritical: true });
assertAbilityFields('skilllink', { multiHitModifier: 'max' });
assertAbilityFields('poisonheal', { residualRecovery: { fraction: [1, 8] } });
assertAbilityFields('adaptability', { stabBoost: 'adaptability' });
assertAbilityFields('protean', { volatileStab: true });
assertAbilityFields('heavymetal', { moldBreakerIgnored: true, weightModifier: 'double' });
assertAbilityFields('quickfeet', { ignoresParalysisSpeedDrop: true });
assertAbilityFields('ripen', { resistBerryMod: 'x0_25' });
assertAbilityFields('infiltrator', { ignoresScreens: true });
assertAbilityFields('protosynthesis', { paradoxBoost: { weather: ['Sun'], itemActivation: true, mod: 'x1_3' } });
assertAbilityFields('quarkdrive', { paradoxBoost: { terrain: 'Electric', itemActivation: true, mod: 'x1_3' } });
assertAbilityFields('megasol', { weatherDamageOverride: 'Sun', ignoreWeatherDamagePenalty: true });
assertAbilityFields('klutz', { suppressesItem: true });
assertAbilityFields('stickyhold', { moldBreakerIgnored: true, blocksItemRemoval: true });
assertAbilityFields('tabletsofruin', { ruinExemption: 'ruinTablet' });
assertAbilityFields('vesselofruin', { ruinExemption: 'ruinVessel' });
assertAbilityFields('swordofruin', { ruinExemption: 'ruinSword' });
assertAbilityFields('beadsofruin', { ruinExemption: 'ruinBeads' });

for (const testCase of cases) {
  const actual = runCase(testCase);
  if (testCase.expected === null) {
    console.log(`[SNAPSHOT] ${testCase.name}`);
    console.log(JSON.stringify(actual));
  } else {
    assertDeepEqual(actual, testCase.expected, testCase.name);
  }
}
