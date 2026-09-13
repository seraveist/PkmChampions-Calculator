// Exercise the shared component boundary, including a global style change and real input.
export async function verifyCalculatorSampleComponents({client,check,setViewport,captureScreenshot,checkAxe,sleep}) {
  const report = {layouts:[],interaction:[]};
  const press = async (key,code) => {
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
    await sleep(40);
  };
  const clickArrow = async selector => {
    const point = await client.evaluate(`(() => {
      const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});
      const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`);
    await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    await sleep(40);
  };
  await client.evaluate(`sampleTheme('light');sampleSetPokemon('atk','garchomp',true);sampleSetPokemon('def','dragonite',true);state.atk.item='lifeorb';state.def.ability='multiscale';sampleRenderSides();sampleRefresh({fields:true});document.getElementById('field-panel').open=true`);
  for (const width of [1440,768,375,320]) {
    await setViewport(client,width,900);
    const layout=await client.evaluate(`(() => {
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
      const triggers=[...document.querySelectorAll('[data-pick]')].map(el=>({kind:el.dataset.pick,box:rect(el),arrow:rect(el.querySelector('.ui-chevron')),content:rect(el.querySelector('.ui-select-content')),style:getComputedStyle(el.querySelector('.ui-chevron')).strokeWidth}));
      const native=[...document.querySelectorAll('main select')].map(el=>({label:el.getAttribute('aria-label')||el.closest('label')?.textContent,box:rect(el),arrow:rect(el.nextElementSibling)}));
      const attrs=[...document.querySelectorAll('.attribute strong')].map(el=>({text:el.textContent,width:el.clientWidth,scroll:el.scrollWidth}));
      const rows=[...document.querySelectorAll('.move-row')].map(el=>({selection:rect(el.querySelector('.move-select')),arrow:rect(el.querySelector('.ui-chevron')),ko:rect(el.querySelector('.ko')),settings:rect(el.querySelector('.move-settings-button')),weights:[...el.querySelectorAll('.move-meta>span:not(.type-chip)')].map(el=>getComputedStyle(el).fontWeight),nameWeight:getComputedStyle(el.querySelector('.move-name')).fontWeight}));
      return {width:innerWidth,triggers,native,attrs,rows,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    const primary=layout.triggers.filter(x=>['pokemon','move'].includes(x.kind));
    check(!layout.overflow && primary.every(x=>x.arrow.w===20 && x.arrow.h===20 && Math.abs(x.arrow.y+x.arrow.h/2-x.box.y-x.box.h/2)<1 && x.arrow.right<=x.box.right),width+'px Pokemon and move arrows share size and vertical alignment',JSON.stringify(primary));
    check(layout.native.every(x=>x.arrow.x>=x.box.x && x.arrow.right<=x.box.right && Math.abs(x.arrow.y+x.arrow.h/2-x.box.y-x.box.h/2)<1),width+'px native field, status and rank arrows remain inside their controls');
    check(layout.attrs.every(x=>x.scroll<=x.width),width+'px compact arrows leave the default ability, item and nature names readable',JSON.stringify(layout.attrs));
    check(layout.rows.every(row=>['selection','arrow','ko','settings'].every(key=>Math.abs(row[key].x-layout.rows[0][key].x)<1 && Math.abs(row[key].w-layout.rows[0][key].w)<1) && row.weights.every(weight=>weight===layout.rows[0].weights[0] && Number(weight)<Number(row.nameWeight))),width+'px result rows align selection, arrow, KO and settings columns with consistent secondary-text weight',JSON.stringify(layout.rows));
    report.layouts.push(layout);
    await client.evaluate('scrollTo(0,0)');
    await captureScreenshot(client,'calculator-sample-components-'+width);
  }
  await client.evaluate('sampleOpenMoveSettings(0)');
  const inheritance=await client.evaluate(`(() => {
    const root=document.documentElement,arrows=[...document.querySelectorAll('.ui-chevron')];
    const before=arrows.map(el=>getComputedStyle(el).strokeWidth);
    root.style.setProperty('--ui-chevron-stroke','3.5');
    const after=arrows.map(el=>getComputedStyle(el).strokeWidth);
    root.style.removeProperty('--ui-chevron-stroke');
    const restored=arrows.map(el=>getComputedStyle(el).strokeWidth);
    const missing=[...document.querySelectorAll('button,input,select,summary,dialog')].filter(el=>!el.matches('.ui-button,.ui-control,.ui-checkbox,.ui-disclosure,.ui-dialog')).map(el=>el.outerHTML.slice(0,160));
    return {count:arrows.length,before,after,restored,missing};
  })()`);
  check(inheritance.count>=29 && inheritance.before.every(n=>n==='2.2px') && inheritance.after.every(n=>n==='3.5px') && JSON.stringify(inheritance.before)===JSON.stringify(inheritance.restored),'one shared arrow token updates and restores every picker, native select and disclosure, including the popup',JSON.stringify(inheritance));
  check(!inheritance.missing.length,'all main-page and condition-popup controls use the shared component hierarchy',JSON.stringify(inheritance.missing));
  report.inheritance=inheritance;
  await checkAxe(client,'shared components at 320px');
  await press('Escape',27);
  for (const kind of ['pokemon','ability','item','nature','move']) {
    await clickArrow(`[data-pick="${kind}"][data-side="atk"] .ui-chevron`);
    const result=await client.evaluate(`({kind:document.getElementById('picker').dataset.kind,open:document.getElementById('picker').open,allButtonsShared:[...document.querySelectorAll('#picker button')].every(el=>el.classList.contains('ui-button'))})`);
    check(result.open && result.kind===kind && result.allButtonsShared,kind+' arrow click opens its own picker with shared list/filter buttons');
    report.interaction.push(result);
    await press('Escape',27);
  }
  await clickArrow('#field-panel summary>.ui-chevron');
  check(await client.evaluate(`!document.getElementById('field-panel').open`),'the shared disclosure arrow toggles the field panel');
  await client.evaluate(`(() => { const rank=document.querySelector('[data-side="atk"][data-rank="atk"]');rank.value='0';rank.focus(); })()`);
  await press('ArrowDown',40);
  check(await client.evaluate(`state.atk.ranks.atk===1`),'the styled native rank select retains keyboard selection and damage-state updates');
  await client.evaluate('sampleTheme("dark");scrollTo(0,0)');
  await captureScreenshot(client,'calculator-sample-components-320-dark');
  await checkAxe(client,'shared components in dark mode');
  return report;
}
