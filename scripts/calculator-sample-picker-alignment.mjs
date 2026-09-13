// Inspect complete row geometry as well as the portion visible at scroll boundaries.
export async function verifyCalculatorSamplePickerAlignment({client,check,setViewport,captureScreenshot,sleep}) {
  const report = {layouts:[],states:[],scroll:[]};
  const press = async (key,code) => {
    await client.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
    await client.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
    await sleep(60);
  };
  const snapshot = () => client.evaluate(`(() => {
    const list=document.getElementById('picker-options'),box=list.getBoundingClientRect();
    const head=list.querySelector('.picker-stats-head');
    const top=box.top+(head?.getBoundingClientRect().height||0),bottom=box.bottom-(list.offsetHeight-list.clientHeight);
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
    const rows=[...list.querySelectorAll('.picker-option')].map(el=>{
      const r=el.getBoundingClientRect(),center=r.top+r.height/2;
      const children=[...el.children].filter(e=>!e.classList.contains('sr-only'));
      const offsets=children.map(e=>{const b=e.getBoundingClientRect();return b.top+b.height/2-center;});
      const visibleTop=Math.max(top,r.top),visibleBottom=Math.min(bottom,r.bottom);
      return {id:el.dataset.choice,box:rect(el),offset:Math.max(...offsets.map(Math.abs)),visible:visibleBottom>visibleTop,clipped:r.top<top-.5||r.bottom>bottom+.5,visibleOffset:Math.abs(center-(visibleTop+visibleBottom)/2),selected:el.matches('[aria-current="true"]'),hover:el.matches(':hover'),focus:el===document.activeElement,children:children.map(rect)};
    });
    return {width:innerWidth,height:innerHeight,kind:document.getElementById('picker').dataset.kind,theme:document.documentElement.dataset.theme,list:{top,bottom,left:list.scrollLeft,scrollTop:list.scrollTop},rows,pageOverflow:document.documentElement.scrollWidth>innerWidth,dialogScroll:document.getElementById('picker').scrollTop};
  })()`);
  await client.evaluate(`sampleSetPokemon('atk','garchomp',true);state.atk.nature='lonely';state.atk.item='lifeorb';sampleRenderSides();sampleRefresh({fields:true})`);
  for (const [width,height] of [[1440,900],[700,900],[375,900],[320,900],[667,375]]) {
    await setViewport(client,width,height);
    for (const kind of ['pokemon','nature','item','ability','move']) {
      await client.evaluate(`document.querySelector('[data-pick="${kind}"][data-side="atk"]').click()`);
      const layout=await snapshot();
      report.layouts.push({width,height,kind,count:layout.rows.length,heights:[...new Set(layout.rows.map(row=>row.box.h))],maxCenterOffset:Math.max(...layout.rows.map(row=>row.offset)),visible:layout.rows.filter(row=>row.visible).map(({id,clipped})=>({id,clipped}))});
      check(!layout.pageOverflow && layout.rows.every(row=>row.offset<1),width+'x'+height+' '+kind+' all option contents share their row center');
      check(layout.rows.every(row=>row.box.h===(width<=480?44:48)) && layout.rows.filter(row=>row.visible).every(row=>!row.clipped),width+'x'+height+' '+kind+' uses uniform, fully visible rows',JSON.stringify({list:layout.list,heights:[...new Set(layout.rows.map(row=>row.box.h))],clipped:layout.rows.filter(row=>row.visible&&row.clipped)}));
      await client.evaluate(`document.getElementById('picker-search').focus()`);
      const keyboard=[];
      for (const [key,code] of [['ArrowDown',40],['End',35],['ArrowUp',38],['Home',36]]) {
        await press(key,code);
        const focused=await snapshot();
        keyboard.push({key,list:focused.list,row:focused.rows.find(row=>row.focus)});
      }
      report.scroll.push({width,height,kind,action:'keyboard navigation',keyboard});
      check(keyboard.every(step=>step.row && !step.row.clipped && step.list.left===0),width+'x'+height+' '+kind+' keyboard navigation keeps the active row visible below its heading');
      await client.evaluate(`document.getElementById('picker').close()`);
    }
  }
  await setViewport(client,700,900);
  for (const theme of ['light','dark']) {
    for (const kind of ['pokemon','nature','item','ability','move']) {
      if (kind==='nature') await client.evaluate(`state.atk.nature='lonely';sampleRenderSides();sampleRefresh()`);
      await client.evaluate(`sampleTheme('${theme}');document.querySelector('[data-pick="${kind}"][data-side="atk"]').click()`);
      const point=await client.evaluate(`(() => {
        const list=document.getElementById('picker-options');
        const el=list.querySelector('[aria-current="true"]')||list.querySelector('button');
        el.scrollIntoView({block:'center'});
        const b=el.getBoundingClientRect();return {id:el.dataset.choice,x:b.x+30,y:b.y+b.height/2};
      })()`);
      const normal=await snapshot();
      await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
      const hovered=await snapshot();
      await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
      const active=await snapshot();
      const samples=[normal,hovered,active].map(state=>state.rows.find(row=>row.id===point.id));
      const dialogScroll=[normal,hovered,active].map(state=>state.dialogScroll);
      report.states.push({theme,kind,id:point.id,samples,dialogScroll});
      check(dialogScroll.every(offset=>offset===0) && samples.every(row=>row.offset<1 && !row.clipped && JSON.stringify(row.box)===JSON.stringify(samples[0].box)),theme+' '+kind+' selected, hover and pressed states preserve row alignment and the fixed popup heading');
      await captureScreenshot(client,'calculator-sample-'+kind+'-selected-'+theme);
      await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
      await client.evaluate(`document.getElementById('picker').close()`);
    }
  }
  await client.evaluate(`sampleTheme('light');state.atk.nature='lonely';sampleRenderSides();sampleRefresh();document.querySelector('[data-pick=nature][data-side=atk]').click();(() => {
    const list=document.getElementById('picker-options'),row=list.querySelector('[data-choice=lonely]');
    list.scrollTop=row.getBoundingClientRect().top-list.getBoundingClientRect().top+list.scrollTop+10;
  })()`);
  await sleep(200);
  const edge=await snapshot();
  const lonely=edge.rows.find(row=>row.id==='lonely');
  await client.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:lonely.box.x+30,y:Math.max(lonely.box.y,edge.list.top)+8});
  const settled=await snapshot();
  const settledRow=settled.rows.find(row=>row.id==='lonely');
  report.scroll.push({width:700,height:900,kind:'nature',action:'partial row scroll settles',list:settled.list,row:settledRow});
  check(settledRow.selected && settledRow.hover && !settledRow.clipped && settledRow.visibleOffset<1,'the reported Lonely nature hover keeps its full background and text vertically centered');
  await captureScreenshot(client,'calculator-sample-nature-scroll-edge');
  for (const [width,height] of [[375,900],[667,375],[700,900]]) {
    await setViewport(client,width,height);
    const resized=await snapshot();
    report.scroll.push({width,height,kind:'nature',action:'resize while open',list:resized.list,visible:resized.rows.filter(row=>row.visible)});
    check(!resized.dialogScroll && resized.rows.filter(row=>row.visible).every(row=>!row.clipped),width+'x'+height+' resizing an open picker keeps whole rows');
  }
  await client.evaluate(`document.getElementById('picker').close();sampleTheme('light')`);
  for (const [width,height,source] of [[1440,900,'mouse'],[320,900,'touch']]) {
    await setViewport(client,width,height);
    for (const kind of ['pokemon','nature','item','ability','move']) {
      await client.evaluate(`document.querySelector('[data-pick="${kind}"][data-side="atk"]').click()`);
      const point=await client.evaluate(`(() => { const r=document.getElementById('picker-options').getBoundingClientRect();return {x:r.x+50,y:r.y+r.height/2}; })()`);
      await client.send('Input.synthesizeScrollGesture',{...point,yDistance:-123,gestureSourceType:source,speed:600});
      await sleep(250);
      const scrolled=await snapshot();
      report.scroll.push({width,height,kind,action:source+' scroll',list:scrolled.list,visible:scrolled.rows.filter(row=>row.visible)});
      check(!scrolled.dialogScroll && scrolled.rows.filter(row=>row.visible).every(row=>!row.clipped),source+' '+kind+' scrolling settles without partial rows at either edge');
      await client.evaluate(`(() => { document.getElementById('picker-options').scrollLeft=999;const input=document.getElementById('picker-search');input.value='검색결과없음xyz';input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      const empty=await client.evaluate(`!!document.querySelector('.no-options') && document.getElementById('picker-options').scrollLeft===0`);
      await client.evaluate(`(() => { const input=document.getElementById('picker-search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      const restored=await snapshot();
      check(empty && restored.list.left===0 && restored.list.scrollTop===0 && restored.rows.filter(row=>row.visible).every(row=>!row.clipped),source+' '+kind+' filtering resets both scroll axes and restores complete rows');
      await client.evaluate(`document.getElementById('picker').close()`);
    }
  }
  return report;
}
