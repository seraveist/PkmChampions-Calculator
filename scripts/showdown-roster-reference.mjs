import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const refDir = process.argv[2];
if (!refDir) throw new Error('Pass the checkout of the synchronized Showdown reference');
const { Dex } = createRequire(import.meta.url)(path.resolve(refDir, 'dist/sim/dex.js'));
const champions = Dex.mod('champions');
const expected = new Map(champions.species.all()
  .filter(species => species.num > 0 && !champions.data.Pokedex[species.id]?.placeholderFor &&
    !species.isNonstandard && !['Illegal', 'Unreleased'].includes(species.tier))
  .map(({ id, tier }) => [id, tier]));
const html = fs.readFileSync(new URL('../pokemon-champions-calculator-v3.html', import.meta.url), 'utf8');
const embedded = html.match(/<script id="data-pokemon" type="application\/json">([\s\S]*?)<\/script>/);
assert(embedded, 'standalone Pokémon data is missing');
const actual = new Map(JSON.parse(embedded[1]).map(({ id, tier }) => [id, tier]));
assert.deepEqual(actual, expected, 'calculator roster must match the pinned Showdown Champions Dex');
console.log(`[PASS] All ${actual.size} official Champions species and forms match the pinned Showdown Dex`);
