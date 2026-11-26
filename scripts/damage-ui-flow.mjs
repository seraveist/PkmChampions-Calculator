import assert from 'node:assert/strict';

// This function also runs inside the browser. Only its public DOM is used.
export async function readDamageUiFlow() {
  const query = selector => document.querySelector(selector);
  const change = (control, value) => {
    control.value = String(value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const select = (side, field, name, id) => {
    query(`[data-side="${side}"][data-field="${field}"]`).click();
    const picker = query('dialog.picker-dialog[open]');
    const input = picker.querySelector('input');
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    picker.querySelector(`[data-id="${id}"]`).click();
  };
  const card = () => {
    const row = query('[data-move-row="0"]');
    return { hp:row.querySelector('.damage-raw')?.textContent, ko:row.querySelector('.ko')?.textContent,
      notes:row.querySelector('.move-notes')?.textContent, basis:row.querySelector('.damage-basis')?.textContent || '' };
  };
  const result = {};
  const editEv = (side, stat, value) => change(query(`[data-calc-side="${side}"] [data-calc-ev="${stat}"]`),value);
  const toggleMoveSetting = selector => {
    query('[data-move-settings="0"]').click();
    query('#calc-move-settings '+selector).click();
    query('#calc-move-settings').close();
  };
  select('atk','pokemonIdx','거대코뿌리','rhyperior');
  select('def','pokemonIdx','잠만보','snorlax');
  select('atk','moves.0','분함의발구르기','stompingtantrum');
  editEv('atk','atk',12); editEv('def','def',32);
  toggleMoveSetting('[data-condition="lastMoveFailed"]');
  result.afterFailure = card();
  toggleMoveSetting('[data-condition="lastMoveFailed"]');
  result.ordinaryUse = card();
  editEv('atk','atk',0); editEv('def','def',0);
  select('atk','pokemonIdx','쥬피썬더','jolteon');
  select('def','pokemonIdx','갑주무사','golisopod');
  select('atk','moves.0','10만볼트','thunderbolt');
  result.withReserve = card();
  toggleMoveSetting('[data-def-condition="noReserve"]');
  result.noReserve = card();
  toggleMoveSetting('[data-def-condition="noReserve"]');
  const hand = query('#atkHelpingHand'), format = query('#gameType');
  const readHand = () => ({ checked:hand.checked, disabled:hand.disabled, card:card(),
    power:query('[data-move-row="0"] .move-power-value').textContent });
  result.handInitial = readHand();
  change(format,'Doubles'); hand.click(); result.handDoubles = readHand();
  change(format,'Singles'); result.handSingles = readHand();
  change(format,'Doubles'); result.handRestored = readHand();
  hand.click(); change(format,'Singles');
  select('atk','pokemonIdx','드래펄트','dragapult');
  select('def','pokemonIdx','잠만보','snorlax');
  select('atk','moves.0','드래곤애로','dragondarts');
  result.singlesFresh = card();
  change(query('#gameType'), 'Doubles');
  result.doublesAuto = card();
  query('[data-move-settings="0"]').click();
  change(query('#calc-move-settings [data-slot="moveHitCounts"]'), 1);
  query('#calc-move-settings').close();
  result.doublesOne = card();
  change(query('#gameType'), 'Singles');
  result.singlesRestored = card();

  query('[data-calc-side-settings="def"]').click();
  const dialog = query('#calc-side-settings');
  const hp = dialog.querySelector('[data-setting-field="currentHp"]');
  const readHp = () => ({value:hp.value, max:hp.max, header:query('#target-hp strong').textContent});
  result.hpInitial = readHp();
  dialog.querySelector('[data-calc-preset="HB"]').click();
  result.hpPreset = readHp();
  change(hp, 999);
  result.hpClamped = readHp();
  dialog.close();
  const percent = query('[data-calc-hp="def"]');
  change(percent,999);
  result.overPercent = percent.value;
  change(percent,0);
  result.minHp = query('#target-hp strong').textContent;
  change(percent,100);

  select('atk','pokemonIdx','한카리아스','garchomp');
  select('atk','moves.0','땅고르기','bulldoze');
  select('def','pokemonIdx','저리더프','eelektross');
  result.immune = card();
  query('#gravity').click();
  result.gravity = card();
  query('#defReflect').click();
  query('[data-rc-from-side="atk"]').click();
  // The public build loads the reverse-calculator module on navigation.
  for (let n = 0; !query('[data-rc-field="isGravity"]') && n < 100; n++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  result.reverseGravity = query('[data-rc-field="isGravity"]')?.checked;
  result.reflectDealt = query('[data-rc-observed-field="dealt"][data-rc-field-key="defReflect"]')?.checked;
  result.reflectReceived = query('[data-rc-observed-field="received"][data-rc-field-key="defReflect"]')?.checked;
  result.opponentAbility = query('[data-rc-action="oppAbilityKnown"]')?.value;
  // Confirm an observed hit, open its candidate and apply the starting conditions.
  change(query('[data-rc-action="oppAbilityKnown"]'), 'levitate');
  const item = query('[data-rc-opp-item="known"]');
  item.click();
  const picker = query('dialog.picker-dialog[open]') || item.closest('.combobox');
  const option = picker.querySelector('[data-id=""]');
  option.click();
  change(query('[data-rc-action="observedTheirPct"]'), 70);
  query('#rcAnalyze').click();
  for (let n=0; !query('[data-rc-toggle-result]') && n<500; n++)
    await new Promise(resolve => setTimeout(resolve,20));
  const row = query('[data-rc-toggle-result]');
  if (!row) throw new Error(document.querySelector('#rc-results-body').textContent);
  if (row.getAttribute('aria-expanded') !== 'true') row.click();
  query('[data-rc-applyresult="0"]').click();
  for (let n=0; query('#nav-calc').getAttribute('aria-selected') !== 'true' && n<100; n++)
    await new Promise(resolve => setTimeout(resolve,20));
  result.returnedToCalc = query('#nav-calc').getAttribute('aria-selected') === 'true';
  result.returnedGravity = query('#gravity').checked;
  result.returnedReflect = query('#defReflect').checked;
  result.returnedAutoEntry = query('#autoEntry').checked;
  result.returnedCard = card();
  return result;
}

export function checkDamageUiFlow(r) {
  assert.equal(r.afterFailure.hp,'126–148 HP');
  assert.equal(r.afterFailure.ko,'확정 3타');
  assert.equal(r.ordinaryUse.hp,'63–75 HP');
  assert.equal(r.ordinaryUse.ko,'확정 4타');
  assert.equal(r.withReserve.hp,'120–144 HP');
  assert.equal(r.withReserve.ko,'교체로 대면 종료');
  assert.ok(r.withReserve.notes.includes('교체할 포켓몬이 없으면 확정 2타'));
  assert.equal(r.noReserve.ko,'확정 2타');
  assert.equal(r.noReserve.hp,r.withReserve.hp);
  assert.ok(r.handInitial.disabled && !r.handInitial.checked);
  assert.deepEqual(r.handSingles,r.handInitial);
  assert.deepEqual(r.handRestored,r.handDoubles);
  assert.ok(!r.handDoubles.disabled && r.handDoubles.checked);
  assert.equal(r.handDoubles.card.hp,'182–216 HP');
  assert.equal(r.handDoubles.card.ko,'확정 1타');
  assert.ok(Number(r.handDoubles.power.replaceAll(',','')) > Number(r.handInitial.power.replaceAll(',','')));
  assert.equal(r.singlesFresh.hp, '96–114 HP');
  assert.equal(r.singlesFresh.ko, '확정 3타');
  assert.deepEqual(r.singlesRestored, r.singlesFresh);
  assert.equal(r.doublesAuto.hp, '분산 48–57 HP / 집중 96–114 HP');
  assert.ok(!r.doublesAuto.notes.includes('2회 적중'));
  assert.equal(r.doublesOne.hp, '48–57 HP');
  assert.equal(r.doublesOne.ko, '확정 5타');
  assert.deepEqual(r.hpInitial, {value:'235',max:'235',header:'235'});
  assert.deepEqual(r.hpPreset, {value:'267',max:'267',header:'267'});
  assert.deepEqual(r.hpClamped, r.hpPreset);
  assert.equal(r.overPercent,'100');
  assert.equal(r.minHp,'1');
  assert.equal(r.immune.basis, '일반 피해');
  assert.equal(r.immune.ko, '무효');
  assert.ok(r.immune.notes.includes('부유'));
  assert.equal(r.immune.hp, r.gravity.hp);
  assert.ok(r.gravity.ko.includes('타'));
  assert.equal(r.reverseGravity, true);
  assert.equal(r.reflectDealt, true);
  assert.equal(r.reflectReceived, false);
  assert.equal(r.opponentAbility, 'unknown');
  assert.equal(r.returnedToCalc, true);
  assert.equal(r.returnedGravity, true);
  assert.equal(r.returnedReflect, true);
  assert.equal(r.returnedAutoEntry, false);
  assert.ok(r.returnedCard.ko.includes('타'));
}
