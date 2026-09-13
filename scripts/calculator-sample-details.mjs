// Focus, presentation and mechanic checks for the isolated calculator sample.
// Uses the existing browser session so these checks exercise real DOM events.
export async function verifyCalculatorSampleDetails({client,check,setViewport,captureScreenshot,checkAxe,sleep}) {
  const report = {abilities:[],focus:[],typography:[]};
  const press = async key => {
    const codes = {Enter:13,Escape:27,Tab:9,ArrowDown:40};
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:codes[key],...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:codes[key]});
    await sleep(40);
  };
  const click = async selector => {
    const point = await client.evaluate(`(() => {
      const el=document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Missing pointer target');
      el.scrollIntoView({block:'center'});
      const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`);
    await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    await sleep(40);
  };

  for (const [pokemon,ability,move] of [['cinderace','libero','highjumpkick'],['greninja','protean','icebeam']]) {
    const data = await client.evaluate(`(() => {
      state.field=makeFieldState();resetAutoEntryFieldState();
      sampleSetPokemon('atk','${pokemon}');sampleSetPokemon('def','blastoise');
      state.atk.ability='${ability}';state.def.ability='';state.atk.moves=['${move}'];
      sampleRenderSides();sampleRefresh({fields:true});
      const active=sampleCalculateSlot(0),s=active.calc;
      const f=powerMoveField(s.atk,s.def,active.move,s.field);
      const plain=calculatePowerDamage({...s.atk,ability:''},s.def,active.move,f);
      const natural=calculatePowerDamage({...s.atk,ability:'',types:[active.result.moveType]},s.def,active.move,f);
      const text=document.querySelector('[data-move-row="0"]').textContent;
      state.def.ability='neutralizinggas';sampleRefresh();
      const gas=sampleCalculateSlot(0);
      const suppressedText=document.querySelector('[data-move-row="0"]').textContent;
      state.def.ability='';sampleRefresh();
      return {pokemon:'${pokemon}',ability:abName(AbilityById['${ability}']),active:active.result.damages,plain:plain.damages,natural:natural.damages,suppressed:gas.result.damages,text,suppressedText};
    })()`);
    check(JSON.stringify(data.active)===JSON.stringify(data.natural) && data.active.at(-1)>data.plain.at(-1),data.ability+' applies the same 1.5x STAB step as a matching native type');
    check(data.text.includes(data.ability+' 자속 ×1.5'),data.ability+' is explicitly shown on the damage card');
    check(JSON.stringify(data.suppressed)===JSON.stringify(data.plain) && !data.suppressedText.includes(data.ability+' 자속'),data.ability+' boost and tag both disappear under Neutralizing Gas');
    report.abilities.push(data);
  }
  const related = await client.evaluate(`(() => {
    const cases=[];
    for (const [pokemon,ability,move] of [['lucariomega','adaptability','closecombat'],['gardevoirmega','pixilate','hypervoice'],['salamencemega','aerilate','doubleedge']]) {
      if (!PokemonById[pokemon] || !MoveById[move]) throw new Error('Missing mechanic fixture: '+pokemon+' / '+move);
      sampleSetPokemon('atk',pokemon);state.atk.ability=ability;state.atk.moves=[move];
      sampleRenderSides();sampleRefresh();
      const out=sampleCalculateSlot(0);
      cases.push({pokemon,ability,type:out.result.moveType,stab:getStabMod(out.calc.atk,out.result.moveType,out.result.koContext.atkAbility),text:document.querySelector('[data-move-row="0"]').textContent});
    }
    return cases;
  })()`);
  check(related[0].stab===8192 && related[0].text.includes('적응력 자속 ×2') && !related[0].text.includes('테라'),'Adaptability uses its own name instead of a Tera label',JSON.stringify(related[0]));
  check(related[1].type==='Fairy' && related[1].stab===6144 && related[1].text.includes('페어리스킨'),'Pixilate changes the move type and keeps STAB');
  check(related[2].type==='Flying' && related[2].stab===6144 && related[2].text.includes('스카이스킨'),'Aerilate changes the move type and keeps STAB');
  report.abilities.push(...related);
  await client.evaluate(`sampleSetPokemon('atk','greninja');state.atk.ability='protean';state.atk.moves=['nightshade','protect','icebeam'];sampleRenderSides();sampleRefresh()`);
  check(await client.evaluate(`!document.querySelector('[data-move-row="0"] .move-notes').textContent.includes('자속') && document.querySelector('[data-move-settings="1"]').disabled`),'fixed damage and status moves do not advertise an inapplicable STAB or critical setting');

  await setViewport(client,700,900);
  for (const mode of ['keyboard','pointer']) {
    await client.evaluate(`sampleSetPokemon('atk','greninja');state.atk.moves=['icebeam'];sampleRenderSides();sampleRefresh({fields:true})`);
    for (const [kind,id] of [['pokemon','cinderace'],['ability','libero'],['item','lifeorb'],['nature','jolly'],['move','highjumpkick']]) {
      const selector=`[data-pick="${kind}"][data-side="atk"]${kind==='move'?'[data-slot="0"]':''}`;
      await click(selector);
      await client.send('Input.insertText',{text:id});
      if (mode==='keyboard') await press('Enter');
      else await click(`[data-choice="${id}"]`);
      const focus=await client.evaluate(`(() => {
        const el=document.activeElement,c=getComputedStyle(el);
        return {mode:'${mode}',kind:'${kind}',pickerClosed:!document.getElementById('picker').open,restored:el.matches(${JSON.stringify(selector)}),visible:el.matches(':focus-visible'),outline:c.outlineWidth,outlineStyle:c.outlineStyle,offset:c.outlineOffset};
      })()`);
      check(focus.pickerClosed && focus.restored && focus.visible===(mode==='keyboard'),mode+' selection restores the correct focus treatment for '+kind,JSON.stringify(focus));
      report.focus.push(focus);
      if(kind==='pokemon') await captureScreenshot(client,'calculator-sample-focus-'+mode);
    }
  }
  await click('[data-pick="pokemon"][data-side="atk"]');
  await client.send('Input.insertText',{text:'pikachu'});
  await client.evaluate(`document.getElementById('picker-search').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}))`);
  check(await client.evaluate(`document.getElementById('picker').open && state.atk.pokemonIdx==='cinderace'`),'IME confirmation does not prematurely select a Pokemon');
  await press('Enter');
  check(await client.evaluate(`state.atk.pokemonIdx==='pikachu' && document.activeElement.dataset.pick==='pokemon'`),'a subsequent Enter confirms the completed search');
  await press('Tab');
  check(await client.evaluate(`document.activeElement.dataset.pick==='ability'`),'Tab continues to ability after selecting a Pokemon');
  await press('Enter');
  check(await client.evaluate(`document.querySelector('.picker-option[aria-current="true"]')?.dataset.choice===state.atk.ability`),'the current choice is identified when reopening the list');
  await press('Escape');
  check(await client.evaluate(`!document.getElementById('picker').open && document.activeElement.dataset.pick==='ability'`),'Escape returns focus without changing the selection');
  await client.evaluate(`document.getElementById('field-panel').open=true;document.getElementById('auto-entry').focus()`);
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  check(await client.evaluate(`document.activeElement.id==='auto-entry'`),'rebuilding field controls preserves keyboard focus');

  await client.evaluate(`sampleSetPokemon('atk','cinderace');state.atk.ability='libero';state.atk.moves=['highjumpkick'];sampleRenderSides();sampleRefresh();let hp=document.getElementById('hp-atk');hp.value='0.1';hp.dispatchEvent(new Event('change',{bubbles:true}));`);
  check(await client.evaluate(`sideCurrentHp(calcStats(state.atk).hp,state.atk)===1 && document.getElementById('hp-atk').value==='0.1'`),'less than 1% HP can represent a surviving 1 HP Pokemon');
  await client.evaluate(`sampleOpenMoveSettings(0);let bp=document.querySelector('[data-slot="moveBpOverrides"]');bp.value='9999';bp.dispatchEvent(new Event('change',{bubbles:true}))`);
  check(await client.evaluate(`document.querySelector('[data-slot="moveBpOverrides"]').value==='999' && state.atk.moveBpOverrides[0]===999`),'out-of-range power input displays the same clamped value used by the engine');
  await press('Escape');
  await client.evaluate(`state.atk.hpPct=1;state.atk.moveBpOverrides[0]=null;sampleRenderSides();sampleRefresh()`);
  for(const width of [1440,700,375,320]) {
    await setViewport(client,width,900);
    await client.evaluate(`document.getElementById('field-panel').open=false;scrollTo(0,0)`);
    const font = await client.evaluate(`(() => {
      const font=selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
      return {width:innerWidth,page:font('h1'),pokemon:font('.pokemon-name'),result:font('.damage-amount'),section:font('#results-title'),move:font('.move-name'),value:font('.attribute strong'),label:font('.attribute small'),note:font('.move-notes'),overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    check(!font.overflow && font.section>font.move && font.move>font.value && font.value>font.label && font.note>=11,width+'px preserves title, value and supporting-text hierarchy',JSON.stringify(font));
    report.typography.push(font);
    await captureScreenshot(client,'calculator-sample-detail-'+width);
  }
  await setViewport(client,667,375);
  await client.evaluate(`sampleOpenMoveSettings(0)`);
  const donePoint=await client.evaluate(`(() => { const r=document.querySelector('#move-settings .done-button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...donePoint});
  await checkAxe(client,'landscape move settings');
  await captureScreenshot(client,'calculator-sample-settings-landscape');
  await click('#move-settings .done-button');
  check(await client.evaluate(`!document.getElementById('move-settings').open && document.activeElement.dataset.moveSettings==='0'`),'the hovered Done button remains usable and restores focus');
  await client.evaluate(`document.querySelector('[data-pick="move"][data-slot="0"]').click();sampleTheme('dark')`);
  await checkAxe(client,'landscape dark picker');
  await captureScreenshot(client,'calculator-sample-picker-landscape-dark');
  await press('Escape');
  return report;
}
