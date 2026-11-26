import assert from 'node:assert/strict';

const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const ev = (points = 0, stat = 'atk') => ({
  ...Object.fromEntries(stats.map((k) => [k, 0])),
  [stat]: points,
});
const modes = { none: '', Rain: 'raindance', Sand: 'sandstorm', Sun: 'sunnyday', Snow: 'snowscape' };
const statuses = { Burn: 'brn', Paralysis: 'par' };
const getRange = (a) => [Math.min(...a), Math.max(...a)];
function side(c, which) {
  const [species, ability] = c[which].split('/');
  return {
    species,
    ability,
    item: c[which + 'Item'] || '',
    level: 50,
    nature: c[which + 'Nature'] || 'hardy',
    evs: ev(c[which + 'Ev'], c[which + 'Invest']),
    moves: [which === 'a' ? c.move : 'protect'],
  };
}
function inCalculator(api, c) {
  const {
    makeSideState,
    makeFieldState,
    state,
    MoveById,
    powerMoveField,
    calculateDamage,
    effectiveSpeed,
    calcStats,
    powerUiCalculateSlot,
    makeCalcState,
  } = api;
  const create = (key) => {
    const [p, ability] = c[key].split('/');
    const s = makeSideState(p);
    s.ability = ability;
    s.item = c[key + 'Item'] || '';
    s.nature = c[key + 'Nature'] || 'hardy';
    s.evs[c[key + 'Invest'] || 'atk'] = c[key + 'Ev'] || 0;
    s.status = c[key + 'Status'] || 'none';
    s.tailwind = !!c[key + 'Wind'];
    Object.assign(s.ranks, c[key + 'Ranks']);
    return s;
  };
  const a = create('a'),
    d = create('d');
  const f = makeFieldState({
    weather: c.weather || 'none',
    terrain: c.terrain || 'none',
    gameType: c.double ? 'Doubles' : 'Singles',
    defReflect: !!c.reflect,
    defLightScreen: !!c.screen,
    isCritical: !!c.crit,
  });
  a.moves = [c.move];
  state.atk = a;
  state.def = d;
  state.field = f;
  const move = MoveById[c.move];
  const field = powerMoveField(a, d, move, f);
  const r = calculateDamage(a, d, move, field);
  const out = {
    damages: r.damages,
    aspe: effectiveSpeed(a, field, d),
    dspe: effectiveSpeed(d, field, a),
    stats: [calcStats(a), calcStats(d)],
    atk: r.atk,
    def: r.def,
    bp: r.bp,
    order: [!!field.atkMovesFirst, !!field.atkMovesSecond],
    mods: r.mods,
  };
  if (c.card) {
    a.moveCriticalOverrides[0] = !!c.crit;
    const built = powerUiCalculateSlot(0, makeCalcState());
    out.card = {
      raw: [built.result.damages[0], built.result.damages[15]],
      label: built.ko.label,
      turns: built.ko.turns,
      p: built.ko.metric.cumulative,
      possible: built.ko.metric.possibleTurn,
      guaranteed: built.ko.metric.guaranteedTurn,
    };
  }
  return out;
}
function reference(Battle, c) {
  const b = new Battle({
    formatid: c.double ? 'gen9championsdoubles' : 'gen9championsou',
    seed: [2, 3, 4, 5],
  });
  try {
    const fill = { species: 'Vaporeon', ability: 'Water Absorb', level: 50, moves: ['protect'] };
    const team = (s) => (c.double ? [s, fill] : [s]);
    b.setPlayer('p1', { name: 'Attacker', team: team(side(c, 'a')) });
    b.setPlayer('p2', { name: 'Defender', team: team(side(c, 'd')) });
    if (b.requestState === 'teampreview')
      b.makeChoices(c.double ? 'team 12' : 'team 1', c.double ? 'team 12' : 'team 1');
    const a = b.p1.active[0],
      d = b.p2.active[0];
    // Explicit starting conditions; entry rank shifts are not part of this formula comparison.
    a.clearBoosts();
    d.clearBoosts();
    Object.assign(a.boosts, c.aRanks);
    Object.assign(d.boosts, c.dRanks);
    if (c.weather && modes[c.weather]) b.field.setWeather(modes[c.weather], a);
    if (c.aWind) b.p1.addSideCondition('tailwind', a);
    if (c.dWind) b.p2.addSideCondition('tailwind', d);
    if (c.reflect) b.p2.addSideCondition('reflect', d);
    if (c.screen) b.p2.addSideCondition('lightscreen', d);
    if (c.aStatus && !a.setStatus(statuses[c.aStatus])) throw Error('invalid attacker status ' + c.a);
    if (c.dStatus && !d.setStatus(statuses[c.dStatus])) throw Error('invalid defender status ' + c.d);
    if (c.terrain) b.field.setTerrain(c.terrain.toLowerCase() + 'terrain', a);
    const speed = [a.getStat('spe'), d.getStat('spe')];
    const damages = [];
    for (let i = 85; i <= 100; i++) {
      const move = b.dex.getActiveMove(c.move);
      move.willCrit = !!c.crit;
      move.hit = 1;
      move.spreadHit = !!c.double && ['allAdjacent', 'allAdjacentFoes'].includes(move.target);
      b.setActiveMove(move, a, d);
      b.randomizer = (raw) => Math.floor((raw * i) / 100);
      const damage = b.actions.getDamage(a, d, move, true);
      damages.push(damage || 0);
      b.clearActiveMove();
    }
    return { damages, speed, defhp: d.maxhp };
  } finally {
    b.destroy();
  }
}
function koReference(rolls, hp, item) {
  // Counts all 16 choices per use, accumulating integer multiplicities through ten uses.
  let states = new Map([[hp * 2, 1n]]);
  let ko = 0n;
  const cumulative = [];
  let possible = null,
    guaranteed = null;
  for (let turn = 1; turn <= 10; turn++) {
    ko *= 16n;
    const next = new Map();
    for (const [key, n] of states)
      for (const v of rolls) {
        const before = Math.floor(key / 2);
        let used = key % 2;
        let rest = before - v;
        if (rest <= 0) {
          ko += n;
          continue;
        }
        if (!used && item === 'sitrusberry' && rest <= Math.floor(hp / 2)) {
          rest = Math.min(hp, rest + Math.floor(hp / 4));
          used = 1;
        }
        if (item === 'leftovers') rest = Math.min(hp, rest + Math.floor(hp / 16));
        const k = 2 * rest + used;
        next.set(k, (next.get(k) || 0n) + n);
      }
    const all = 16n ** BigInt(turn);
    cumulative.push(Number(ko) / Number(all));
    if (ko > 0n && possible === null) possible = turn;
    if (ko === all && !guaranteed) guaranteed = turn;
    states = next;
  }
  return { possible, guaranteed, cumulative };
}
export function checkDamageMatrix(api, Battle) {
  const cases = [];
  const templates = [
    ['garchomp/roughskin', 'snorlax/immunity', 'earthquake'],
    ['garchomp/roughskin', 'snorlax/immunity', 'dragonclaw'],
    ['blastoise/torrent', 'snorlax/immunity', 'surf'],
    ['garchomp/roughskin', 'snorlax/immunity', 'flamethrower'],
    ['garchomp/roughskin', 'aggron/rockhead', 'earthquake'],
    ['garchomp/roughskin', 'leafeon/leafguard', 'earthquake'],
    ['garchomp/roughskin', 'charizard/blaze', 'earthquake'],
    ['clefable/magicguard', 'avalugg/icebody', 'psyshock'],
    ['blastoise/torrent', 'snorlax/immunity', 'bodypress'],
    ['umbreon/synchronize', 'garchomp/roughskin', 'foulplay'],
    ['blastoise/torrent', 'lycanroc/steadfast', 'surf'],
    ['heracross/guts', 'snorlax/immunity', 'closecombat'],
  ];
  for (const [a, d, move] of templates) {
    const physical = api.MoveById[move].cat === 'Physical';
    const usedAtk = move === 'bodypress' ? 'def' : physical ? 'atk' : 'spa',
      usedDef = physical || move === 'psyshock' ? 'def' : 'spd';
    for (let boost = -6; boost <= 6; boost++)
      for (let option = 0; option < 8; option++) {
        const i = boost + 6 + option;
        const c = {
          a,
          d,
          move,
          aRanks: { [usedAtk]: boost },
          dRanks: { [usedDef]: ((boost + 6 + option * 3) % 13) - 6 },
          crit: !!(option & 1),
          aEv: [0, 1, 16, 32][i % 4],
          dEv: [32, 2, 0, 31][i % 4],
          aInvest: usedAtk,
          dInvest: usedDef,
          aNature: ['adamant', 'modest', 'jolly', 'hardy'][i % 4],
          dNature: ['bold', 'calm', 'relaxed', 'hardy'][i % 4],
          aItem: ['', 'lifeorb', physical ? 'muscleband' : 'wiseglasses', 'expertbelt'][option % 4],
          weather: ['none', 'Rain', 'Sun', 'Sand', 'Snow'][i % 5],
          double: !!(option & 2),
          reflect: !!(option & 4),
          screen: !!(option & 4),
        };
        if (physical && option === 5) c.aStatus = 'Burn';
        cases.push({ ...c, group: 'base' });
      }
  }
  for (const move of ['gyroball', 'electroball']) {
    const [a, d] =
      move === 'gyroball' ? ['forretress/sturdy', 'snorlax/immunity'] : ['raichu/static', 'snorlax/immunity'];
    for (const aItem of ['', 'choicescarf', 'ironball'])
      for (const aWind of [false, true])
        for (const dWind of [false, true])
          for (const dStatus of ['', 'Paralysis'])
            for (const spe of [-2, 0, 1])
              for (const dEv of [0, 1, 17, 32]) {
                cases.push({
                  group: 'speed',
                  a,
                  d,
                  move,
                  aItem,
                  aWind,
                  dWind,
                  dStatus,
                  aRanks: { spe },
                  dInvest: 'spe',
                  dEv,
                });
              }
  }

  const terrainCases = [
    ['raichu/static', 'snorlax/immunity', 'thunderbolt'],
    ['leafeon/leafguard', 'snorlax/immunity', 'leafblade'],
    ['garchomp/roughskin', 'snorlax/immunity', 'earthquake'],
    ['clefable/magicguard', 'avalugg/icebody', 'psyshock'],
    ['garchomp/roughskin', 'snorlax/immunity', 'dragonclaw'],
    ['clefable/unaware', 'snorlax/immunity', 'psychic'],
    ['leafeon/leafguard', 'clefable/unaware', 'leafblade'],
    ['umbreon/synchronize', 'garchomp/roughskin', 'foulplay'],
    ['avalugg/owntempo', 'lycanroc/steadfast', 'bodypress'],
    ['heracross/guts', 'aggron/rockhead', 'facade'],
    ['clefable/magicguard', 'lycanroc/steadfast', 'psychic'],
    ['garchomp/roughskin', 'avalugg/icebody', 'earthquake'],
  ];
  for (const [a, d, move] of terrainCases)
    for (const terrain of ['', 'Electric', 'Grassy', 'Misty', 'Psychic'])
      for (const weather of ['none', 'Sand', 'Snow'])
        for (const rank of [-2, 0, 2])
          for (const crit of [false, true]) {
            cases.push({
              group: 'field',
              a,
              d,
              move,
              terrain,
              weather,
              crit,
              reflect: true,
              screen: true,
              aEv: 16,
              dEv: 1,
              aInvest: 'atk',
              dInvest: 'def',
              aRanks: { atk: rank, def: -rank, spa: rank },
              dRanks: { atk: -rank, def: rank, spd: rank },
              aStatus: move === 'facade' ? 'Burn' : '',
            });
          }
  // Compare every KO probability through ten uses for ordinary attacks and recovery.
  for (const [a, d, move] of templates.slice(0, 5))
    for (const dItem of ['', 'leftovers', 'sitrusberry'])
      for (const rank of [-1, 0, 1])
        for (const sp of [0, 16, 32]) {
          cases.push({
            group: 'ko',
            a,
            d,
            move,
            dItem,
            aRanks: { atk: rank, spa: rank },
            dInvest: 'hp',
            dEv: sp,
            card: true,
          });
        }
  let koCount = 0;
  for (const c of cases) {
    const label = JSON.stringify(c);
    assert.ok(api.PokemonById[c.a.split('/')[0]].ls.includes(c.move), label + ' learnset');
    for (const key of ['a', 'd']) {
      const [species, ability] = c[key].split('/');
      assert.ok(
        Object.values(api.PokemonById[species].ab).map(api.toId).includes(ability),
        label + ' holder',
      );
      if (c[key + 'Item']) assert.ok(api.ItemById[c[key + 'Item']], label + ' missing item');
    }
    const ref = reference(Battle, c),
      actual = inCalculator(api, c);
    assert.deepEqual(Array.from(actual.damages), ref.damages, label + ' 16 damage rolls');
    assert.deepEqual([actual.aspe, actual.dspe], ref.speed, label + ' speed');
    if (c.card) {
      koCount++;
      const expected = koReference(ref.damages, ref.defhp, c.dItem);
      assert.deepEqual(actual.card.raw, getRange(ref.damages), label + ' card HP range');
      assert.equal(actual.card.possible, expected.possible, label + ' earliest KO');
      assert.equal(actual.card.guaranteed, expected.guaranteed, label + ' guaranteed KO');
      expected.cumulative.forEach((p, i) => {
        const chance = actual.card.p[i] ?? actual.card.p.at(-1);
        assert.ok(Math.abs(p - chance) < 1e-10, label + ' cumulative KO at use ' + (i + 1));
      });
    }
  }
  console.log(
    `PASS ${cases.length} damage/Speed scenarios, ${cases.length * 16} raw rolls and ${koCount} independent KO distributions.`,
  );
}
