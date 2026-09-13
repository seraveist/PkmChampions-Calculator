// Exercise sticky geometry while the scroll surface actually moves, including touch input.
export async function checkDexTableScrolling({client, check, setViewport, captureScreenshot, checkAxe, report}) {
  const frame = () => client.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',true);
  const measure = () => client.evaluate(`(() => {
    const wrap=dexTableWrap(),table=wrap.querySelector('table'),head=table.querySelector('thead th');
    const row=[...table.querySelectorAll('tbody tr[data-dex-id]')].find(row=>{
      const r=row.getBoundingClientRect(),w=wrap.getBoundingClientRect();
      return r.top>=w.top+head.offsetHeight&&r.bottom<=w.top+wrap.clientHeight;
    }) || table.querySelector('tbody tr[data-dex-id]');
    const first=row?.cells[0],second=row?.cells[1],bounds=wrap.getBoundingClientRect();
    const point=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width};};
    return {scrollLeft:wrap.scrollLeft,scrollTop:wrap.scrollTop,
      maxX:wrap.scrollWidth-wrap.clientWidth,maxY:wrap.scrollHeight-wrap.clientHeight,
      edge:{left:bounds.left+wrap.clientLeft,top:bounds.top+wrap.clientTop},
      head:point(head),first:first&&point(first),second:second&&point(second),
      background:first&&getComputedStyle(first).backgroundColor,
      nextBackground:second&&getComputedStyle(second).backgroundColor,
      cornerOnTop:document.elementFromPoint(bounds.left+20,bounds.top+20)?.closest('th')===head,
      pageOverflow:document.documentElement.scrollWidth-innerWidth,
      nonButtonClasses:[...document.querySelectorAll('.ui-button')].filter(el=>!el.matches('button,a,[role=button]')).map(el=>el.tagName+'.'+el.className)};
  })()`);
  await client.evaluate("closeDexDetail();closeDexFullPage();activateMainPage('dex',{updateHash:true})",true);
  for(const width of [650,320,900,1440]) {
    await setViewport(client,width,1000);
    for(const theme of ['light','dark']) {
      await client.evaluate(`document.documentElement.dataset.theme='${theme}'`);
      for(const tab of ['pokemon','moves','abilities','items']) {
        await client.evaluate(`document.querySelector('[data-dex=${tab}]').click();document.getElementById('dexResetFilters').click();dexTableWrap().scrollIntoView({block:'start'});window.scrollBy(0,-20);`);
        await frame();
        const baseline=await measure(),samples=[baseline];
        for(const [x,y] of [[.25,0],[.7,.4],[1,1]]) {
          await client.evaluate(`{const wrap=dexTableWrap();wrap.scrollLeft=(wrap.scrollWidth-wrap.clientWidth)*${x};wrap.scrollTop=(wrap.scrollHeight-wrap.clientHeight)*${y};}`);
          await frame();samples.push(await measure());
        }
        report.push({kind:'table-scroll',width,theme,tab,samples});
        if(tab==='pokemon' && theme==='light' && width===650) await captureScreenshot(client,'dex-table-scroll-650');
        check(samples.every(s=>Math.abs(s.head.left-s.edge.left)<=1&&Math.abs(s.head.top-s.edge.top)<=1&&Math.abs(s.first.left-s.edge.left)<=1),`${tab} header and name column stay flush at ${width}px ${theme}`,JSON.stringify(samples));
        check(samples.every(s=>s.cornerOnTop&&s.background===s.nextBackground&&s.pageOverflow<=1&&!s.nonButtonClasses.length),`${tab} has one row surface and a visible sticky corner at ${width}px ${theme}`,JSON.stringify(samples));
        if(baseline.maxX>0) check(samples.at(-1).scrollLeft>0&&samples.at(-1).second.left<baseline.second.left,`${tab} data columns scroll behind the fixed name at ${width}px ${theme}`);
        if(width===320&&theme==='dark') await checkAxe(client,`${tab} scrolled table in dark theme`);
      }
    }
  }

  await setViewport(client,650,1000);
  await client.evaluate("document.documentElement.dataset.theme='light';document.querySelector('[data-dex=pokemon]').click();document.getElementById('dexResetFilters').click();dexTableWrap().scrollIntoView({block:'start'});window.scrollBy(0,-20)");
  await frame();
  await client.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const origin=await client.evaluate("{const r=dexTableWrap().getBoundingClientRect();({x:r.right-65,y:r.top+310})}");
  const dragSamples=[];
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...origin,id:1}]});
  for(let i=1;i<=10;i++) {
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:origin.x-i*20,y:origin.y-i*8,id:1}]});
    await frame();dragSamples.push(await measure());
  }
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await client.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  check(dragSamples.some(s=>s.scrollLeft>30),'touch drag moves the actual table scroll position');
  check(dragSamples.every(s=>Math.abs(s.head.left-s.edge.left)<=1&&Math.abs(s.head.top-s.edge.top)<=1&&Math.abs(s.first.left-s.edge.left)<=1),'sticky header and name remain aligned throughout touch drag',JSON.stringify(dragSamples));
  report.push({kind:'touch-drag',samples:dragSamples});

  for(const width of [320,650,900,1440]) {
    await setViewport(client,width,1000);
    await client.evaluate('window.scrollTo(0,0)');await frame();
    const nav=await client.evaluate(`(() => {
      const root=document.querySelector('.main-nav'),style=getComputedStyle(root);
      return {gap:parseFloat(style.gap),padding:parseFloat(style.paddingLeft),
        tabs:[...root.children].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};})};
    })()`);
    check(nav.padding===(width<=700?10:width<=900?20:32)&&nav.gap===(width<=700?0:24),`navigation uses the approved sample spacing at ${width}px`,JSON.stringify(nav));
    check(nav.tabs.every(t=>t.left>=0&&t.right<=width&&t.height>=44),'navigation fits without clipping at '+width+'px',JSON.stringify(nav));
    if(width<=700) check(Math.max(...nav.tabs.map(t=>t.width))-Math.min(...nav.tabs.map(t=>t.width))<=1,'mobile navigation has equal-width buttons at '+width+'px',JSON.stringify(nav));
    report.push({kind:'navigation',width,...nav});
    if(width===650||width===320) await captureScreenshot(client,'dex-navigation-'+width);
  }
}
