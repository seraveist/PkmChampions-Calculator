function powerUiRenderField() {
  const target=document.getElementById('calc-field-controls');
  if(!target) return;
  const choices=[['weather','날씨',CALC_WEATHER_OPTIONS.map(s=>[s.id,s.label])],['terrain','필드',CALC_TERRAIN_OPTIONS.map(s=>[s.id,s.label])],['gameType','배틀',[['Singles','싱글'],['Doubles','더블']]]];
  renderTrustedHTML(target,choices.map(([key,label,options])=>RotomUI.field(label,RotomUI.select(options,state.field[key],{id:key,'data-calc-field':key}))).join('')+`<div class="spread-target-field">${RotomUI.field('광역기 대상',RotomUI.select([['auto','여러 대상'],['single','한 대상']],state.field.spreadTargets || 'auto',{'data-power-choice':'spreadTargets'}))}</div>`);
}

// Each entry belongs to a live row, so detached rows do not retain cached views.
const powerUiRowViews = new WeakMap();

function powerUiRenderMoveResults(body, calc) {
  const views = [0,1,2,3].map(slot => powerUiMovePresentation(slot, calc));
  let rows = [0,1,2,3].map(slot => body.querySelector(`[data-move-row="${slot}"]`));
  if (rows.some(row => !row)) {
    renderTrustedHTML(body, views.map((view,slot) => powerUiMoveMarkup(slot,calc,view)).join(''));
    rows = [0,1,2,3].map(slot => body.querySelector(`[data-move-row="${slot}"]`));
    rows.forEach((row,slot) => { if (row) powerUiRowViews.set(row,views[slot]); });
    body.querySelectorAll('.cb-input').forEach(input => wireCalcCombobox(input, {onSelect:id => {
      applyMoveToCalcSlot('atk',Number(input.dataset.field.split('.')[1]),id);
      powerUiRefresh();
    }}));
  }
  rows.forEach((row,slot) => {
    if (!row) return;
    const view=views[slot], previous=powerUiRowViews.get(row);
    const picker=row.querySelector('.move-select');
    {
      if (!previous || previous.pickerContent!==view.pickerContent) renderTrustedHTML(picker.querySelector('.ui-select-content'),view.pickerContent);
      if (!previous || previous.powerMarkup!==view.powerMarkup || previous.damage!==view.damage) {
        renderTrustedHTML(row.querySelector('.move-comparison'),`${view.powerMarkup}<div class="damage-summary">${view.damage}</div>`);
      }
      if (!previous || previous.koMarkup!==view.koMarkup) renderTrustedHTML(row.querySelector('.ko'),view.koMarkup);
      if (!previous || previous.notes!==view.notes) renderTrustedHTML(row.querySelector('.move-notes'),view.notes);
    }
    picker.value=view.moveName;
    picker.title=view.moveName || '기술 선택';
    picker.setAttribute('aria-label',`기술 ${slot+1}: ${view.moveName || '선택'}`);
    picker.disabled=view.pickerDisabled;
    row.querySelector('[data-move-settings]').disabled=view.settingsDisabled;
    row.querySelector('.ko').classList.toggle('ko--random',view.koRandom);
    row.querySelectorAll('[data-damage-width]').forEach(el => {
      const width=`${el.dataset.damageWidth}%`;
      if (el.style.width!==width) el.style.width=width;
    });
    powerUiRowViews.set(row,view);
  });
}

function powerUiRefresh() {
  const calc=makeCalcState(),statsBySide={};
  lastAutoEntry=calc.entryMeta;
  syncFieldControls(calc.field);
  for(const key of ['atk','def']) {
    const side=state[key],root=document.getElementById(`${key}-body`);
    if(root && root.dataset.pokemonId!==(side.pokemonIdx || '')) renderSide(key);
    if(!root?.querySelector('[data-hp-value]') || !PokemonById[side.pokemonIdx]) continue;
    const stats=statsBySide[key]=calcStats(calc[key]),nature=NATURE_BY_ID[side.nature];
    root.querySelector('[data-budget]').textContent=Object.values(side.evs).reduce((a,b)=>a+b,0);
    root.querySelectorAll('.stat-final').forEach((cell,i)=>{
      const stat=powerUiStats[i];
      cell.textContent=stat==='hp' ? stats.hp : applyBoost(stats[stat],calc[key].ranks[stat]);
      cell.classList.toggle('up',nature?.up===stat);cell.classList.toggle('down',nature?.down===stat);
    });
    const hp=sideCurrentHp(stats.hp,side);
    root.querySelector('[data-hp-value]').textContent=`${hp} / ${stats.hp}`;
    root.querySelector('[data-hp-bar]').style.width=`${side.hpPct*100}%`;
    const tailwind=document.querySelector(`[data-calc-tailwind="${key}"]`);
    if(tailwind) tailwind.checked=!!side.tailwind;
  }
  const target=document.getElementById('target-hp'),p=PokemonById[calc.def.pokemonIdx];
  if(target) {
    target.hidden=!p;
    renderTrustedHTML(target,p ? `<span class="target-name">${escapeHTML(pkName(p))}</span><span class="target-health"><span>HP</span><strong>${sideCurrentHp((statsBySide.def || calcStats(calc.def)).hp,calc.def)}</strong></span>` : '');
  }
  renderTrustedHTML(document.getElementById('entry-effects'),calc.entryMeta.logs.map(log=>`<span class="ui-tag">${escapeHTML(log)}</span>`).join(''));
  const f=calc.field,labels=[f.gameType==='Singles' ? '싱글' : '더블'];
  for(const key of ['weather','terrain']) if(f[key]!=='none') labels.push(calcFieldOptionLabel(key,f[key]));
  if(autoEntryEffects) labels.push('등장 특성');
  const summary=document.getElementById('calc-field-summary');
  if(summary) summary.textContent=labels.join(' · ');
  const spread=document.querySelector('.spread-target-field');
  if(spread) spread.hidden=f.gameType!=='Doubles';
  const body=document.getElementById('calc-results-body');
  if(!body) return;
  powerUiRenderMoveResults(body,calc);
  clearTimeout(powerUiStatusTimer);
  powerUiStatusTimer=setTimeout(()=>{
    const status=document.getElementById('calculation-status');
    if(status) status.textContent='피해 계산을 갱신했습니다.';
  },250);
}

function powerUiOpenSideSettings(key) {
  const side=state[key],p=PokemonById[side.pokemonIdx],dialog=document.getElementById('calc-side-settings');
  if(!p || !dialog) return;
  const field=(name,label,values,value)=>RotomUI.field(label,RotomUI.select(values,value,{'data-setting-side':key,'data-setting-field':name}));
  const flag=(name,label)=>RotomUI.check(label,{'data-setting-side':key,'data-setting-field':name,checked:!!side[name]});
  const forms=calcFormGroupForPokemon(p)?.forms || [];
  const types=[['','없음'],...BATTLE_TYPES.map(t=>[t,TYPE_KO[t]])];
  const flags={flashfire:['flashFireActive','타오르는불꽃'],unburden:['unburdenActive','곡예'],slowstart:['slowStartActive','슬로스타트'],stakeout:['stakeoutActive','교체 대상'],plus:['allyPlusMinusActive','아군 플러스·마이너스'],minus:['allyPlusMinusActive','아군 플러스·마이너스']};
  document.getElementById('calc-side-settings-title').textContent=`${pkName(p)} · 설정`;
  let html=`<div class="form-grid">${forms.length>1 ? field('form','폼',forms.map(p=>[p.id,calcPokemonFormLabel(p)]),side.pokemonIdx) : ''}${RotomUI.field('현재 HP',RotomUI.number({'data-setting-side':key,'data-setting-field':'currentHp',min:1,max:calcStats(side).hp,value:sideCurrentHp(calcStats(side).hp,side)}))}</div>`;
  html+=`<div class="form-grid">${[0,1].map(i=>field(`type${i}`,`타입 ${i+1}`,i===0 ? types.slice(1) : types,side.types?.[i] || '')).join('')}</div>`;
  html+=`<div class="action-row"><button type="button" class="ui-label-action" data-setting-side="${key}" data-reset-types>기본 타입</button></div>`;
  if(flags[side.ability]) html+=flag(...flags[side.ability]);
  if(side.ability==='rivalry') html+=field('rivalryGender','투쟁심',[['none','미적용'],['same','동성'],['opposite','이성']],side.rivalryGender || 'none');
  if(AbilityById[side.ability]?.paradoxBoost) html+=flag('paradoxActive','부스트에너지 발동 유지');
  if(AbilityById[side.ability]?.supremeOverlord) html+=RotomUI.field('쓰러진 아군',RotomUI.number({'data-setting-side':key,'data-setting-field':'fallenAllies',min:0,max:battleMaxFallenAllies(state.field),value:side.fallenAllies || 0}));
  html+=`<section><h3>노력치 프리셋</h3><div class="action-row">${['AS','HA','HB','CS','HC','HD'].map(preset=>`<button type="button" class="ui-label-action" data-calc-preset="${preset}" data-setting-side="${key}">${preset}</button>`).join('')}<button type="button" class="ui-label-action" data-calc-preset="reset" data-setting-side="${key}">초기화</button></div></section>`;
  if(key==='def') html+=`<section><h3>보유 기술</h3><div class="form-grid">${[0,1,2,3].map(slot=>RotomUI.picker(`기술 ${slot+1}`,mvName(MoveById[side.moves[slot]]),{'data-cb-type':'move','data-side':key,'data-field':`moves.${slot}`})).join('')}</div></section>`;
  const body=document.getElementById('calc-side-settings-body');
  renderTrustedHTML(body,html);
  body.querySelectorAll('.cb-input').forEach(input=>wireCalcCombobox(input,{onSelect:id=>{
    applyMoveToCalcSlot(key,Number(input.dataset.field.split('.')[1]),id);powerUiRefresh();
  }}));
  dialog.showModal();
}

document.getElementById('page-calc')?.addEventListener('input',event=>{
  const target=event.target,key=target.closest('[data-calc-side]')?.dataset.calcSide;
  if(target.dataset.calcEv && key) {
    const previous=state[key].evs[target.dataset.calcEv] || 0;
    const value=toolStatApplyPointValue(state[key],target.dataset.calcEv,target.value);
    if(target.value!=='' && Number(target.value)!==value) target.value=value;
    if(value!==previous) powerUiRefresh();
  }
});
document.getElementById('page-calc')?.addEventListener('change',event=>{
  const t=event.target,d=t.dataset,key=t.closest('[data-calc-side]')?.dataset.calcSide;
  if(d.calcEv && key) {
    const previous=state[key].evs[d.calcEv] || 0;
    t.value=toolStatApplyPointValue(state[key],d.calcEv,t.value);
    // change still normalizes blanks/leading zeros, but does not repeat input work.
    if(Number(t.value)===previous) return;
  }
  else if(d.calcRank && key) state[key].ranks[d.calcRank]=Number(t.value);
  else if(d.calcHp) { setSideHpPct(state[d.calcHp],Number(t.value)/100);t.value=hpPercentInputValue(state[d.calcHp]); }
  else if(d.calcStatus) state[d.calcStatus].status=t.value;
  else if(d.calcTailwind) state[d.calcTailwind].tailwind=t.checked;
  else if(d.calcField) {
    if(['weather','terrain'].includes(d.calcField)) setManualCalcField(d.calcField,t.value);
    else {
      state.field[d.calcField]=t.value;
      if(d.calcField==='gameType') for(const side of [state.atk,state.def]) side.fallenAllies=Math.min(side.fallenAllies || 0,battleMaxFallenAllies(state.field));
    }
  } else return;
  powerUiRefresh();
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button) return;
  if(button.dataset.calcSideSettings) powerUiOpenSideSettings(button.dataset.calcSideSettings);
  else if(button.hasAttribute('data-move-settings')) powerUiOpenMoveSettings(Number(button.dataset.moveSettings));
  else if(button.hasAttribute('data-close-calc-dialog')) button.closest('dialog').close();
  else if(button.hasAttribute('data-reset-types')) {
    const key=button.dataset.settingSide;
    resetSideTypes(key);renderSide(key);powerUiRefresh();powerUiOpenSideSettings(key);
    document.querySelector('#calc-side-settings [data-reset-types]')?.focus({preventScroll:true});
  }
  else if(button.dataset.calcPreset) {
    const key=button.dataset.settingSide;
    if(button.dataset.calcPreset==='reset') state[key].evs={hp:0,atk:0,def:0,spa:0,spd:0,spe:0};
    else applyEvPreset(key,button.dataset.calcPreset);
    renderSide(key);powerUiRefresh();
  }
});
document.getElementById('calc-side-settings')?.addEventListener('change',event=>{
  const t=event.target,d=t.dataset,key=d.settingSide,side=state[key];
  if(!side) return;
  if(d.settingField==='form') applyPokemonFormToCalcSide(key,t.value);
  else if(d.settingField?.startsWith('type')) setSideType(key,Number(d.settingField.slice(-1)),t.value);
  else if(d.settingField==='currentHp') setSideCurrentHp(side,t.value);
  else if(d.settingField) side[d.settingField]=t.type==='checkbox' ? t.checked : t.type==='number' ? Number(t.value) : t.value;
  renderSide(key);powerUiRefresh();
  if(d.settingField==='form' || d.settingField?.startsWith('type')) {
    const field=d.settingField;
    powerUiOpenSideSettings(key);
    document.querySelector(`#calc-side-settings [data-setting-field="${field || 'type0'}"]`)?.focus({preventScroll:true});
  }
});
