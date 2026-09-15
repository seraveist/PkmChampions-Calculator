// Build test instrumentation into a disposable output, never into dist or the
// committed offline file. The application still executes as its real ESM graph.
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPublic } from './build-public.mjs';
import { buildStandalone, STANDALONE_NAME } from './build-artifacts.mjs';
export async function prepareModuleBrowserFixture({publicMode=false,adFree=false,privateTest=false}={}) {
  const root=mkdtempSync(path.join(os.tmpdir(),'pkm-module-fixture-'));
  const publicRoot=path.join(root,'dist');
  const htmlPath=publicMode ? path.join(publicRoot,'index.html') : path.join(root,STANDALONE_NAME);
  if(publicMode)await buildPublic({dist:publicRoot,adFree,privateTest,testMode:true});
  else await buildStandalone({output:htmlPath,testMode:true});
  // The OS temporary directory is scoped to this run; clean up without touching user output.
  process.once('exit',()=>rmSync(root,{recursive:true,force:true}));
  return {publicRoot,htmlPath};
}
export async function installModuleTestBridge(client) {
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    globalThis.__PKM_TEST_REGISTER__ = descriptors => {
      for(const [name,descriptor] of Object.entries(descriptors)) {
        Object.defineProperty(globalThis,name,{...descriptor,configurable:true});
      }
    };
  `});
}
