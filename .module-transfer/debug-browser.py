from pathlib import Path
p = Path('scripts/ui-remodel-final-browser.mjs')
s = p.read_text()
s = s.replace('      const point=await client.evaluate', '''      await client.evaluate(`globalThis.choiceTrace=[]; for (const type of ['scroll','focusin','pointerdown','pointerup','click','toggle']) document.addEventListener(type,e=>choiceTrace.push({t:performance.now(),type,target:e.target.nodeName+':'+e.target.className,scrollY,open:!!document.querySelector('.ui-choice-menu:popover-open')}),true)`);
      const point=await client.evaluate''', 1)
s = s.replace('      for (let i=0;i<2;i++) {', '''      console.log('POINTER_BEFORE',JSON.stringify(await client.evaluate(`({point:${JSON.stringify(point)},rect:document.querySelector('#atk-body .ui-choice-trigger').getBoundingClientRect().toJSON(),hit:document.elementFromPoint(${point.x},${point.y})?.outerHTML.slice(0,300),trace:choiceTrace})`)));
      for (let i=0;i<2;i++) {''', 1)
s = s.replace('        await sleep(60);', '''        await sleep(60);
        console.log('POINTER_TRACE',JSON.stringify(await client.evaluate(`({i:${i},rect:document.querySelector('#atk-body .ui-choice-trigger').getBoundingClientRect().toJSON(),trace:choiceTrace})`)));''', 1)
s = s.replace('    await client.evaluate("activateMainPage(\'finetune\')",true);', '    return;\n    await client.evaluate("activateMainPage(\'finetune\')",true);', 1)
Path('scripts/_debug-choice.mjs').write_text(s)
