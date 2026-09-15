// Black-box checks against production bundles, using disposable browser storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export async function checkPartyStorageBrowser({evaluate,send,waitFor,pass}) {
  const key='pkmChampions.partyPresets.v1';
  const payload=name=>({format:'pokechamps-lab-party-presets',version:1,parties:[{name,members:[{pokemon:'garchomp',ability:'roughskin',nature:'jolly',moves:['dragonclaw'],evs:{hp:2,atk:32,spe:32}}]}]});
  const stored=()=>evaluate(`localStorage.getItem(${JSON.stringify(key)})`);
  const currentName=()=>evaluate(`document.querySelector('[data-party-name-index="0"]').value`);
  async function importFile(value) {
    await evaluate(`(() => {document.getElementById('partyPresetImport').focus();const input=document.getElementById('partyPresetImportFile'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'party-test.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  const confirmOpen=()=>waitFor(()=>evaluate(`!!document.querySelector('#partyPresetConfirm[open]')`));
  async function accept() {await evaluate(`document.querySelector('[data-party-confirm-apply]').click()`);await waitFor(()=>evaluate(`!document.getElementById('partyPresetConfirm') && !document.getElementById('partyPresetImport').disabled`));}
  async function screenshot(name) {
    if(!process.env.UI_SMOKE_SCREENSHOT_DIR)return;
    const dir=path.join(process.env.UI_SMOKE_SCREENSHOT_DIR,'party-safety');fs.mkdirSync(dir,{recursive:true});
    const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(image.data,'base64'));
  }
  await evaluate(`document.getElementById('partyPresetOpen').click()`);
  await importFile(payload('Safety original'));await confirmOpen();
  assert.equal(await evaluate(`document.activeElement.hasAttribute('data-party-confirm-cancel')`),true);
  for(const width of [1440,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
    assert.equal(await evaluate(`(()=>{const r=document.getElementById('partyPresetConfirm').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth+1})()`),true);
    await screenshot('confirm-'+width);
  }
  await accept();assert.equal(await currentName(),'Safety original');pass('native import confirmation defaults to Cancel and fits desktop/mobile');
  const original=await stored();
  for(const data of [{parties:[]},{parties:['invalid']},{...payload('Wrong'),version:99}]) {
    await importFile(data);await waitFor(()=>evaluate(`document.getElementById('partyPresetStatus').dataset.tone==='error' && !document.getElementById('partyPresetImport').disabled`));
    assert.equal(await stored(),original);assert.equal(await currentName(),'Safety original');
    assert.equal(await evaluate(`!!document.getElementById('partyPresetConfirm')`),false);
  }
  pass('malformed/empty/future JSON cannot replace existing production data');
  await importFile(payload('Cancelled'));await confirmOpen();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor(()=>evaluate(`!document.getElementById('partyPresetConfirm') && !document.getElementById('partyPresetImport').disabled`));
  assert.equal(await stored(),original);assert.equal(await currentName(),'Safety original');
  pass('Escape cancels JSON replacement without changing saved parties');
  await importFile(payload('Replacement'));await confirmOpen();await accept();
  assert.equal(JSON.parse(await stored()).previousImport.parties[0].name,'Safety original');
  await send('Page.reload');await waitFor(()=>evaluate(`document.querySelectorAll('.move-row').length===4`));
  await evaluate(`document.getElementById('partyPresetOpen').click()`);
  assert.equal(await currentName(),'Replacement');assert.equal(await evaluate(`document.getElementById('partyPresetUndoImport').disabled`),false);
  await evaluate(`document.getElementById('partyPresetUndoImport').click()`);await confirmOpen();await accept();
  assert.equal(await currentName(),'Safety original');assert.equal(await evaluate(`document.getElementById('partyPresetUndoImport').disabled`),true);
  assert(!JSON.parse(await stored()).previousImport);
  pass('one-step restore survives a real reload and is consumed after undo');
  const durable=await stored();
  await evaluate(`window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===${JSON.stringify(key)})throw new DOMException('Simulated quota','QuotaExceededError');return window.__storageSet.call(this,k,v);}`);
  try {
    await importFile(payload('Session only'));await confirmOpen();await accept();
    assert.equal(await currentName(),'Session only');assert.equal(await stored(),durable);
    assert.equal(await evaluate(`document.getElementById('partyPresetStorageWarning').hidden`),false);
    assert.equal(await evaluate(`document.getElementById('partyPresetStatus').dataset.tone`),'warning');
    await evaluate(`document.getElementById('partyPresetClose').click();document.getElementById('partyPresetOpen').click()`);
    assert.equal(await evaluate(`document.getElementById('partyPresetStorageWarning').hidden`),false);
    await screenshot('storage-warning');
  } finally {await evaluate(`Storage.prototype.setItem=window.__storageSet;delete window.__storageSet;`);}
  await evaluate(`(()=>{const input=document.querySelector('[data-party-name-index="0"]');input.value='Saved after retry';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(JSON.parse(await stored()).parties[0].name,'Saved after retry');
  assert.equal(await evaluate(`document.getElementById('partyPresetStorageWarning').hidden`),true);
  pass('quota failure preserves durable data and a persistent warning until save recovery');
  await evaluate(`document.querySelector('[data-party-showdown-import="0"]').click();document.getElementById('partyPresetTextArea').value=${JSON.stringify('Garchomp\nAbility: Rough Skin\nJolly Nature\n- Dragon Claw')};document.getElementById('partyPresetTextApply').click()`);
  await confirmOpen();await accept();await waitFor(()=>evaluate(`!document.getElementById('partyPresetTextDialog').open`));
  assert.equal(JSON.parse(await stored()).parties[0].members[0].evs.atk,0);
  assert.equal(JSON.parse(await stored()).previousImport.parties[0].members[0].evs.atk,32);
  pass('Showdown replacement uses the same confirmation and undo path');
  await evaluate(`document.getElementById('partyPresetClose').click()`);
  const footer=await evaluate(`(()=>{const el=document.querySelector('footer.site-footer');return {text:el.textContent,links:[...el.querySelectorAll('a')].map(a=>a.textContent.trim()),date:el.querySelector('time').dateTime}})()`);
  assert.deepEqual(footer.links,['계산 기준','데이터 출처 · Pokémon Showdown','오류 제보']);
  assert.equal(footer.date,'2026-09-09');assert.match(footer.text,/비공식 팬 도구/);
  assert.equal(await evaluate(`document.body.textContent.includes('결정력은 공격측 화력 지수입니다.')`),false);
  for(const width of [320,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
    await evaluate(`document.querySelector('footer').scrollIntoView({block:'end',behavior:'instant'})`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true);await screenshot('footer-'+width);
  }
  await evaluate(`window.scrollTo({top:0,behavior:'instant'});location.hash='%'`);
  await waitFor(()=>evaluate(`document.querySelector('.nav-tab.active')?.dataset.page==='calc'`));
  pass('compact footer, reference links and malformed hash fallback work without the declined explanation');
}
