import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { refreshKoreanCache, loadTargetIds } from './fetch-ko.mjs';

const targets = loadTargetIds();
assert(targets.pokemon.includes('palafinhero'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkm-ko-'));
const revision = 'a'.repeat(40);
const target = { pokemon: ['garchomp','palafinhero'], moves: ['surf'], abilities: ['drizzle'], items: ['leftovers'] };
const csv = {
  'pokemon_species.csv': 'id,identifier\n1,garchomp',
  'pokemon_species_names.csv': 'pokemon_species_id,local_language_id,name\n1,3,한카리아스',
  'pokemon_forms.csv': 'id,identifier\n2,palafin-hero',
  'pokemon_form_names.csv': 'pokemon_form_id,local_language_id,form_name\n2,9,Hero',
  'version_groups.csv': 'id,order\n1,1',
};
for (const [plural, singular, id] of [['moves','move','surf'],['abilities','ability','drizzle'],['items','item','leftovers']]) {
  csv[plural + '.csv'] = 'id,identifier\n1,' + id;
  csv[singular + '_names.csv'] = singular + '_id,local_language_id,name\n1,3,한국어';
  csv[singular + '_flavor_text.csv'] = singular + '_id,language_id,version_group_id,flavor_text\n1,3,1,설명';
}
let fail;
async function fetchImpl(url) {
  assert(url.includes('/' + revision + '/'));
  const key = url.split('/').pop();
  if (key === fail) throw new Error('simulated interruption');
  assert(Object.hasOwn(csv,key), key);
  return { ok:true, text:async () => csv[key] };
}
try {
  fs.writeFileSync(path.join(dir,'pokemon.manual.json'), JSON.stringify({palafinhero:'돌핀맨 (마이티 폼)'}));
  const opts = {directory:dir, commit:revision, targets:target, fetchImpl};
  await refreshKoreanCache(opts);
  const file=path.join(dir,'auto-cache.json'), before=fs.readFileSync(file,'utf8'), snapshot=JSON.parse(before);
  assert.equal(Object.keys(snapshot.categories).length,7);
  assert.equal(snapshot.commit,revision);
  assert.deepEqual(snapshot.missing.pokemon,[]);
  assert.equal(snapshot.categories['desc-items'].leftovers,'설명');
  csv['pokemon_species_names.csv'] += '\n1,3,새이름';
  fail='item_flavor_text.csv';
  await assert.rejects(refreshKoreanCache(opts),/simulated interruption/);
  assert.equal(fs.readFileSync(file,'utf8'),before);
  console.log('[PASS] pinned translation snapshot includes forms, honors manual names and survives interruption');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
