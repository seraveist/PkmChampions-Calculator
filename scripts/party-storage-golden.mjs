// Failure-path regression tests. Only synthetic in-memory storage is touched.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSourceFileSync } from './source-utils.mjs';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KEY='pkmChampions.partyPresets.v1';
const clone=value=>JSON.parse(JSON.stringify(value));
let passed=0;
async function test(name,run){await run();passed++;console.log('[PASS] '+name);}
function fixture({raw=null,readFails=false}={}) {
  const storage=new Map(raw===null?[]:[[KEY,raw]]),elements=new Map();
  const env={failWrite:false,readFails,confirm:true,prompts:[],writes:0,renders:0};
  for(const id of ['partyPresetStorageWarning','partyPresetUndoImport','partyPresetImport','partyPresetStatus'])elements.set(id,{hidden:true,textContent:'',dataset:{},disabled:false});
  const pokemon={id:'testmon',name:'Testmon',koName:'테스트몬',types:['Normal'],ab:{0:'Test Ability'},ls:['testmove']};
  const ability={id:'testability',name:'Test Ability'},move={id:'testmove',name:'Test Move',cat:'Physical'},nature={id:'hardy',name:'Hardy'};
  const context=vm.createContext({console,STATS:['hp','atk','def','spa','spd','spe'],PokemonById:{testmon:pokemon},POKEMON:[pokemon],AbilityById:{testability:ability},ABILITIES:[ability],ItemById:{},ITEMS:[],MoveById:{testmove:move},MOVES:[move],NATURE_BY_ID:{hardy:nature},NATURES:[nature],
    document:{getElementById:id=>elements.get(id)||null},
    localStorage:{getItem(k){if(env.readFails)throw new Error('blocked');return storage.get(k)??null;},setItem(k,v){env.writes++;if(env.failWrite)throw new Error('quota');storage.set(k,v);}},
    renderPartyPresetModal(){env.renders++;},
    async confirmPartyPresetReplacement(options){env.prompts.push(options);return typeof env.confirm==='function'?env.confirm():env.confirm;},
    toId:v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,''),defaultPokemonAbilityId:()=>ability.id,defaultPokemonItemId:()=>'',defaultPokemonTypes:()=>['Normal'],setSideDamageBlockActive(){},
  });
  const sources=['04-00-party-presets-state.js','04-02-party-presets-integration.js'].map(file=>readSourceFileSync(path.join(ROOT,'src/js',file),'utf8')).join('\n');
  vm.runInContext(sources+`\nglobalThis.api={parsePartyPresetBackup,importPartyPresetJsonFile,undoPartyPresetImport,savePartyPresetData,partyPresetExportPayload,importPartyPresetShowdownText,setPartyPresetStatus,updatePartyPresetBackupControls, getData:()=>partyPresetData,setData:setPartyPresetData,getUndo:()=>partyPresetPreviousImport};`,context);
  const api=context.api;
  const read=()=>clone(api.getData());
  const load=async value=>api.importPartyPresetJsonFile({size:100,text:async()=>typeof value==='string'?value:JSON.stringify(value)});
  return {api,env,elements,storage,read,load};
}
const backup=(name='New')=>({format:'pokechamps-lab-party-presets',version:1,parties:[{name,members:[{pokemon:'testmon',ability:'testability',nature:'hardy',moves:['testmove'],evs:{hp:32,atk:32,def:2}}]}]});
const seeded=()=>fixture({raw:JSON.stringify(backup('Existing'))});
await test('v1 export round-trips all party data without private undo metadata',async()=>{const f=seeded();const b=f.api.partyPresetExportPayload();assert.deepEqual(clone(f.api.parsePartyPresetBackup(b)),f.read());assert(!('previousImport' in b));});
for(const [name,value] of [['legacy record',{parties:backup().parties}],['legacy wrapped record',{data:{version:1,parties:backup().parties}}],['UTF-8 BOM','\uFEFF'+JSON.stringify(backup())]])await test(name+' remains importable',async()=>{const f=seeded();assert(await f.load(value));assert.equal(f.read().parties[0].name,'New');});
const invalid=[
 ['empty party array',{parties:[]}],['nonobject party',{parties:['bad']}],['missing members',{parties:[{}]}],['null member',{parties:[{members:[null]}]}],['missing Pokemon ID',{parties:[{members:[{}]}]}],
 ['wrong format',{...backup(),format:'unrelated'}],['future version',{...backup(),version:2}],['wrong wrapper version',{version:2,data:backup()}],['wrong nested format',{data:{...backup(),format:'unrelated'}}],
 ['too many parties',{parties:Array(11).fill(backup().parties[0])}],['too many members',{parties:[{members:Array(7).fill({pokemon:'testmon'})}]}],
 ['invalid moves',{parties:[{members:[{pokemon:'testmon',moves:'testmove'}]}]}],['too many moves',{parties:[{members:[{pokemon:'testmon',moves:Array(5).fill('testmove')}]}]}],
 ['invalid effort',{parties:[{members:[{pokemon:'testmon',evs:{hp:{}}}]}]}],['unknown ID',{parties:[{members:[{pokemon:'unknown'}]}]}],['prototype ID',{parties:[{members:[{pokemon:'__proto__'}]}]}],['malformed JSON','{not JSON'],
];
for(const [name,value] of invalid)await test(name+' cannot change memory, disk or undo',async()=>{const f=seeded(),before=f.read(),disk=f.storage.get(KEY);assert.equal(await f.load(value),false);assert.deepEqual(f.read(),before);assert.equal(f.storage.get(KEY),disk);assert.equal(f.env.prompts.length,0);assert.equal(f.env.writes,0);assert.equal(f.api.getUndo(),null);});
await test('oversized file is rejected before reading',async()=>{const f=seeded();let read=false;assert.equal(await f.api.importPartyPresetJsonFile({size:1048577,text:async()=>{read=true;return '{}';}}),false);assert.equal(read,false);assert.equal(f.env.writes,0);});
await test('unreadable file is non-destructive',async()=>{const f=seeded();assert.equal(await f.api.importPartyPresetJsonFile({size:100,text:async()=>{throw new Error('read failure');}}),false);assert.equal(f.env.writes,0);assert.equal(f.read().parties[0].name,'Existing');});
await test('cancelled replacement changes neither memory nor storage',async()=>{const f=seeded();f.env.confirm=false;const before=f.read(),disk=f.storage.get(KEY);assert.equal(await f.load(backup()),false);assert.deepEqual(f.read(),before);assert.equal(f.storage.get(KEY),disk);assert.equal(f.api.getUndo(),null);});
await test('explicitly blank valid backup requires the empty-data warning',async()=>{const f=seeded();f.env.confirm=false;await f.load({version:1,parties:[{name:'Empty',members:[]}]});assert.match(f.env.prompts[0].message,/빈 백업/);assert.equal(f.read().parties[0].name,'Existing');});
await test('accepted restore stores current and previous parties in one write',async()=>{const f=seeded();assert(await f.load(backup()));assert.equal(f.env.writes,1);const stored=JSON.parse(f.storage.get(KEY));assert.equal(stored.parties[0].name,'New');assert.equal(stored.previousImport.parties[0].name,'Existing');assert.equal(f.elements.get('partyPresetUndoImport').disabled,false);});
await test('one-step undo survives reload and restores even after editing imported data',async()=>{const first=seeded();await first.load(backup());const f=fixture({raw:first.storage.get(KEY)});f.api.getData().parties[0].name='Edited';f.api.savePartyPresetData();assert(await f.api.undoPartyPresetImport());assert.equal(f.read().parties[0].name,'Existing');assert(!('previousImport' in JSON.parse(f.storage.get(KEY))));assert.equal(await f.api.undoPartyPresetImport(),false);});
await test('cancelled undo retains the imported data and undo snapshot',async()=>{const f=seeded();await f.load(backup());f.env.confirm=false;assert.equal(await f.api.undoPartyPresetImport(),false);assert.equal(f.read().parties[0].name,'New');assert.equal(f.api.getUndo().parties[0].name,'Existing');});
await test('latest import keeps only its immediate predecessor',async()=>{const f=seeded();await f.load(backup('B'));await f.load(backup('C'));assert.equal(f.api.getUndo().parties[0].name,'B');assert.equal(f.api.getUndo().previousImport,undefined);await f.api.undoPartyPresetImport();assert.equal(f.read().parties[0].name,'B');});
await test('failed save does not show success or overwrite durable data',async()=>{const f=seeded(),disk=f.storage.get(KEY);f.env.failWrite=true;assert(await f.load(backup()));assert.equal(f.read().parties[0].name,'New');assert.equal(f.storage.get(KEY),disk);assert.equal(f.elements.get('partyPresetStatus').dataset.tone,'warning');assert.equal(f.elements.get('partyPresetStorageWarning').hidden,false);f.api.setPartyPresetStatus('JSON 내보내기 완료','success');assert.match(f.elements.get('partyPresetStorageWarning').textContent,/저장하지 못/);f.env.failWrite=false;assert.equal(f.api.savePartyPresetData(),true);assert.equal(f.elements.get('partyPresetStorageWarning').hidden,true);});
for(const [name,raw,readFails] of [['corrupt stored JSON','{bad',false],['future stored version',JSON.stringify({...backup(),version:3}),false],['unreadable storage',JSON.stringify(backup()),true]])await test(name+' is not silently overwritten by ordinary edits',async()=>{const f=fixture({raw,readFails});f.api.getData().parties[0].name='Session';assert.equal(f.api.savePartyPresetData(),false);assert.equal(f.storage.get(KEY),raw);assert.equal(f.env.writes,0);assert(!f.elements.get('partyPresetStorageWarning').hidden);});
await test('explicit confirmed import can recover from unreadable/corrupt stored data',async()=>{const f=fixture({raw:'{bad'});assert(await f.load(backup()));assert.equal(JSON.parse(f.storage.get(KEY)).parties[0].name,'New');assert.match(f.env.prompts[0].message,/기존 저장 기록/);});
await test('concurrent file read cannot trigger a second destructive import',async()=>{const f=seeded();let finish;const first=f.api.importPartyPresetJsonFile({size:10,text:()=>new Promise(resolve=>{finish=resolve;})});assert.equal(await f.load(backup('Stale')),false);finish(JSON.stringify(backup('First')));assert(await first);assert.equal(f.env.prompts.length,1);assert.equal(f.read().parties[0].name,'First');});
await test('Showdown import only replaces its target party and supports undo',async()=>{const f=seeded();f.api.getData().parties[1].name='Untouched';f.env.confirm=false;assert.equal(await f.api.importPartyPresetShowdownText(0,'Testmon\nAbility: Test Ability\n- Test Move'),false);f.env.confirm=true;assert(await f.api.importPartyPresetShowdownText(0,'Testmon\nAbility: Test Ability\n- Test Move'));assert.equal(f.read().parties[1].name,'Untouched');assert.equal(f.read().parties[0].members[0].evs.hp,0);await f.api.undoPartyPresetImport();assert.equal(f.read().parties[0].members[0].evs.hp,32);});
await test('invalid Showdown input leaves all parties and previous undo intact',async()=>{const f=seeded();await f.load(backup());const before=f.read(),undo=clone(f.api.getUndo());assert.equal(await f.api.importPartyPresetShowdownText(0,'nothing recognizable'),false);assert.deepEqual(f.read(),before);assert.deepEqual(clone(f.api.getUndo()),undo);});
await test('malformed URL hash falls back to the calculator',async()=>{const source=readSourceFileSync(path.join(ROOT,'src/js/01-20-html-structure.js'),'utf8').match(/async function activateMainPageFromHash\(\) \{[\s\S]*?\n\}/)[0];let page;const context=vm.createContext({location:{hash:'#%'},activateMainPage:key=>{page=key;return true;}});vm.runInContext(source,context);await vm.runInContext('activateMainPageFromHash()',context);assert.equal(page,'calc');});
console.log(`Party storage safety: ${passed} checks passed.`);
