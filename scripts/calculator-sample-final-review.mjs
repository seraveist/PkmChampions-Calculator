// Final review of live HTML references and responsive CSS boundary cases.
export async function reviewCalculatorSampleMarkup({client,setViewport}) {
  const report={structure:[],layouts:[],issues:[]};
  const structure=() => client.evaluate(`(() => {
    const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
    const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
    const references=[];
    document.querySelectorAll('[for],[aria-labelledby],[aria-describedby],[aria-controls]').forEach(el=>{
      for(const attr of ['for','aria-labelledby','aria-describedby','aria-controls']) {
        for(const id of (el.getAttribute(attr)||'').split(/\\s+/).filter(Boolean)) if(!document.getElementById(id)) references.push({tag:el.tagName,attr,id});
      }
    });
    const nested=[...document.querySelectorAll('button button,button input,button select,a button,label label')].map(el=>el.outerHTML.slice(0,120));
    return {kind:document.getElementById('picker').open?document.getElementById('picker').dataset.kind:'main',main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,lang:document.documentElement.lang,duplicates,references,nested,implicitButtons:document.querySelectorAll('button:not([type])').length};
  })()`);
  await client.evaluate(`sampleTheme('light');sampleSetPokemon('atk','garchomp',true);sampleSetPokemon('def','dragonite',true);sampleRenderSides();sampleRefresh({fields:true})`);
  report.structure.push(await structure());
  for(const kind of ['pokemon','move','nature','item','ability']) {
    await client.evaluate(`document.querySelector('[data-pick="${kind}"][data-side="atk"]').click()`);
    report.structure.push(await structure());
    await client.evaluate(`document.getElementById('picker').close()`);
  }
  await client.evaluate(`sampleOpenMoveSettings(0)`);
  report.structure.push({...await structure(),kind:'conditions'});
  await client.evaluate(`document.getElementById('move-settings').close()`);
  const longest=await client.evaluate(`calcDatasetForCombobox('atk','pokemon').map(p=>({id:p.id,name:pkName(p)})).sort((a,b)=>b.name.length-a.name.length)[0]`);
  report.longestName=longest;
  for(const scenario of ['default','long-name']) {
    await client.evaluate(`sampleSetPokemon('atk',${JSON.stringify(scenario==='default'?'garchomp':longest.id)},true);sampleSetPokemon('def','dragonite',true);state.atk.item='lifeorb';state.def.ability='multiscale';sampleRenderSides();sampleRefresh({fields:true})`);
    for(const width of [320,360,361,480,481,700,701,900,901,1024,1440]) {
      await setViewport(client,width,900);
      const layout=await client.evaluate(`(() => {
        const rect=selector=>{const b=document.querySelector(selector).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right};};
        const atk=rect('#side-atk'),def=rect('#side-def'),swap=rect('#swap-sides');
        const status=[...document.querySelectorAll('.status-select select')].map(el=>{const s=getComputedStyle(el);return {value:el.selectedOptions[0].text,textAlign:s.textAlign,textAlignLast:s.textAlignLast,paddingLeft:s.paddingLeft,paddingRight:s.paddingRight};});
        return {width:innerWidth,viewport:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth,atk,def,swap,status};
      })()`);
      report.layouts.push({scenario,...layout});
      if(layout.overflow) report.issues.push({scenario,width,issue:'page overflow'});
      if(Math.abs(layout.swap.x+layout.swap.w/2-layout.viewport/2)>1) report.issues.push({scenario,width,issue:'swap horizontal center'});
      if(width<=700 && Math.abs(layout.swap.y+layout.swap.h/2-(layout.atk.bottom+layout.def.y)/2)>1) report.issues.push({scenario,width,issue:'swap center leaves the gap between unequal cards'});
      if(!layout.status.every(s=>s.textAlign==='center'&&s.textAlignLast==='center'&&s.paddingLeft===s.paddingRight)) report.issues.push({scenario,width,issue:'status centering'});
    }
  }
  for(const entry of report.structure) {
    if(entry.main!==1 || entry.h1!==1 || entry.lang!=='ko' || entry.duplicates.length || entry.references.length || entry.nested.length) report.issues.push({kind:entry.kind,issue:'HTML structure',entry});
  }
  await client.evaluate(`sampleSetPokemon('atk','garchomp',true);sampleSetPokemon('def','dragonite',true);state.atk.evs={hp:2,atk:32,def:0,spa:0,spd:0,spe:32};state.atk.nature='jolly';state.atk.item='lifeorb';state.def.evs={hp:32,atk:32,def:0,spa:0,spd:2,spe:0};state.def.nature='adamant';state.def.ability='multiscale';sampleRenderSides();sampleRefresh({fields:true})`);
  return report;
}
