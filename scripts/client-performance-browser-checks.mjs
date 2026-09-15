// Run against a real browser: DOM identity, refresh work and picker behavior.
export async function measureCalculatorRefresh(client) {
  return client.evaluate(`(() => {
    const previous = {atk:state.atk,def:state.def,field:state.field,auto:autoEntryEffects};
    const refresh = powerUiRefresh, calculate = powerUiCalculateSlot, render = renderTrustedHTML, wire = wireCalcCombobox;
    const counts = {refreshes:0,slotCalculations:0,resultBodyReplacements:0,pickerBindings:0};
    try {
      autoEntryEffects=false;
      state.atk=makeSideState('garchomp');state.def=makeSideState('dragonite');state.field=makeFieldState();
      state.atk.moves=['earthquake','dragonclaw','rockslide','firefang'];state.atk.item='lifeorb';state.def.item='leftovers';
      renderSide('atk');renderSide('def');powerUiRefresh();
      const body=document.getElementById('calc-results-body'), rows=[...body.querySelectorAll('.move-row')];
      const controls=[...body.querySelectorAll('.move-select,[data-move-settings]')];
      const input=document.querySelector('#atk-body [data-calc-ev="atk"]');
      const startText=body.textContent;
      input.focus();
      powerUiRefresh=(...args)=>{counts.refreshes++;return refresh(...args);};
      powerUiCalculateSlot=(...args)=>{counts.slotCalculations++;return calculate(...args);};
      renderTrustedHTML=(target,markup)=>{if(target===body)counts.resultBodyReplacements++;return render(target,markup);};
      wireCalcCombobox=(...args)=>{counts.pickerBindings++;return wire(...args);};
      const started=performance.now();
      for(let i=1;i<=20;i++) {
        input.value=String(i);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      const elapsedMs=performance.now()-started;
      return {...counts,elapsedMs,rowsRetained:rows.every((row,i)=>row===body.querySelectorAll('.move-row')[i]),
        controlsRetained:controls.every((control,i)=>control===body.querySelectorAll('.move-select,[data-move-settings]')[i]),
        focusRetained:document.activeElement===input,resultsChanged:body.textContent!==startText,effort:state.atk.evs.atk};
    } finally {
      powerUiRefresh=refresh;powerUiCalculateSlot=calculate;renderTrustedHTML=render;wireCalcCombobox=wire;
      state.atk=previous.atk;state.def=previous.def;state.field=previous.field;autoEntryEffects=previous.auto;
      renderSide('atk');renderSide('def');powerUiRefresh();
    }
  })()`);
}

export async function runClientPerformanceBrowserChecks(client, check, {publicMode=false}={}) {
  const dataNodes=await client.evaluate('document.querySelectorAll(\'script[id^="data-"]\').length');
  check(dataNodes===(publicMode?0:7),'data stays outside the public DOM while standalone retains its offline adapter',String(dataNodes));
  const stats=await measureCalculatorRefresh(client);
  console.log('REFRESH_METRICS '+JSON.stringify(stats));
  check(stats.refreshes===20 && stats.slotCalculations===80,'20 input/change pairs perform only 20 refreshes and 80 slot calculations',JSON.stringify(stats));
  check(stats.resultBodyReplacements===0 && stats.pickerBindings===0,'effort changes never rebuild the result grid or rebind its pickers',JSON.stringify(stats));
  check(stats.rowsRetained && stats.controlsRetained && stats.focusRetained && stats.resultsChanged && stats.effort===20,'partial refresh preserves controls/focus and updates actual results',JSON.stringify(stats));
  const parity=await client.evaluate(`(() => {
    const previous={atk:state.atk,def:state.def,field:state.field,auto:autoEntryEffects};
    const mismatches=[];
    const scenarios=[
      ['garchomp','dragonite',['earthquake','dragonclaw','rockslide','firefang']],
      ['charizard','snorlax',['flamethrower','airslash','protect','']],
      ['machamp','gengar',['closecombat','seismictoss','counter','']],
      ['','',['','','','']],
    ];
    try {
      autoEntryEffects=false;state.field=makeFieldState();
      for(const [atk,def,moves] of scenarios) {
        state.atk=makeSideState(atk);state.def=makeSideState(def);state.atk.moves=Array.isArray(moves)?moves:['','','',''];
        renderSide('atk');renderSide('def');powerUiRefresh();
        const calc=makeCalcState();
        for(let slot=0;slot<4;slot++) {
          const expected=document.createElement('div');expected.innerHTML=powerUiMoveMarkup(slot,calc);
          const actual=document.querySelector('[data-move-row="'+slot+'"]');
          for(const selector of ['.ui-select-content','.move-comparison','.ko','.move-notes']) {
            const a=actual.querySelector(selector),e=expected.querySelector(selector);
            if(a.textContent!==e.textContent) mismatches.push(atk+':'+slot+':'+selector);
          }
          for(const selector of ['.move-select','[data-move-settings]']) {
            const a=actual.querySelector(selector),e=expected.querySelector(selector);
            if(a.disabled!==e.disabled || a.getAttribute('aria-label')!==e.getAttribute('aria-label')) mismatches.push(atk+':'+slot+':'+selector);
          }
        }
      }
      return mismatches;
    } finally {
      Object.assign(state,{atk:previous.atk,def:previous.def,field:previous.field});autoEntryEffects=previous.auto;
      renderSide('atk');renderSide('def');powerUiRefresh();
    }
  })()`);
  check(parity.length===0,'partial rendering matches fresh markup for normal, immune, status, conditional, cleared and empty slots',JSON.stringify(parity));
  const picker=await client.evaluate(`(() => {
    const previous={atk:state.atk,def:state.def};
    try {
      state.atk=makeSideState('garchomp');state.def=makeSideState('snorlax');renderSide('atk');powerUiRefresh();
      const control=document.querySelector('#calc-results-body .move-select');
      control.click();document.querySelector('[data-picker-close]').click();
      state.atk=makeSideState('charizard');state.atk.moves=['flamethrower','','',''];renderSide('atk');powerUiRefresh();
      const retained=control===document.querySelector('#calc-results-body .move-select');
      control.click();
      const dialog=document.querySelector('.picker-dialog[open]'),search=dialog.querySelector('input');
      const exclusive=PokemonById.charizard.ls.find(id=>MoveById[id]&&!PokemonById.garchomp.ls.includes(id));
      const freshList=!!exclusive&&!!dialog.querySelector('[data-id="'+exclusive+'"]');
      search.focus();state.def.evs.hp=10;powerUiRefresh();
      const openPreserved=dialog===document.querySelector('.picker-dialog[open]')&&document.activeElement===search;
      dialog.querySelector('[data-picker-close]').click();
      return {retained,freshList,openPreserved};
    } finally {
      state.atk=previous.atk;state.def=previous.def;renderSide('atk');renderSide('def');powerUiRefresh();
    }
  })()`);
  check(picker.retained && picker.freshList && picker.openPreserved,'retained picker follows Pokemon changes and survives result refresh while open',JSON.stringify(picker));
}

export async function runSlotCacheBrowserChecks(client,check) {
  const metrics=await client.evaluate(`(() => {
    const saved={atk:state.atk,def:state.def,field:state.field,auto:autoEntryEffects};
    const original=powerUiCalculateSlot, structural=powerUiMovePickerMarkup;
    const calls=[];let markup=0;
    try {
      autoEntryEffects=false;state.atk=makeSideState('garchomp');state.def=makeSideState('dragonite');state.field=makeFieldState();
      state.atk.moves=['earthquake','dragonclaw','rockslide','firefang'];
      renderSide('atk');renderSide('def');powerUiRefresh();
      powerUiCalculateSlot=(slot,...args)=>{calls.push(slot);return original(slot,...args);};
      powerUiMovePickerMarkup=(...args)=>{markup++;return structural(...args);};
      powerUiOpenMoveSettings(1);
      const critical=document.querySelector('#calc-move-settings [data-slot="moveCriticalOverrides"]');
      critical.checked=true;critical.dispatchEvent(new Event('change',{bubbles:true}));
      const single=calls.splice(0);
      critical.dispatchEvent(new Event('change',{bubbles:true}));const noop=calls.splice(0);
      document.getElementById('calc-move-settings').close();
      const weather=document.getElementById('weather');weather.value='Rain';weather.dispatchEvent(new Event('change',{bubbles:true}));
      return {single,noop,common:calls,markup};
    } finally {
      powerUiCalculateSlot=original;powerUiMovePickerMarkup=structural;
      Object.assign(state,{atk:saved.atk,def:saved.def,field:saved.field});autoEntryEffects=saved.auto;
      renderSide('atk');renderSide('def');powerUiRefresh();
    }
  })()`);
  console.log('SLOT_CACHE_METRICS '+JSON.stringify(metrics));
  check(JSON.stringify(metrics.single)==='[1]' && metrics.noop.length===0 && JSON.stringify(metrics.common)==='[0,1,2,3]' && metrics.markup===0,
    'real slot setting computes one slot, repeated value computes none, common weather computes four, without structural markup',JSON.stringify(metrics));
}
