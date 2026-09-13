import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {styleLayerFor,CSS_LAYER_ORDER} from './css-layer-contract.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir=path.join(root,'src/styles');
function files(d,p=''){return readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name),p+e.name+'/'):e.name.endsWith('.css')?[p+e.name]:[]);}
const css=new Map(files(dir).map(f=>[f,readFileSync(path.join(dir,f),'utf8')]));
const all=[...css.values()].join('\n');let failures=0;
function check(ok,label){console[ok?'log':'error'](`[${ok?'PASS':'FAIL'}] ${label}`);if(!ok)failures++;}
const owners={
  'components/00-controls.css':['.ui-control {','.ui-button {','.ui-select-trigger {','.ui-select {','.ui-search {','.ui-icon {','.ui-chevron {','.ui-dialog {','.dialog-heading {'],
  'components/primitives.css':['.ui-panel {','.ui-panel-head {','.ui-panel-body {'],
  'components/participants.css':['.pokemon-select {','.pokemon-sprite-slot {','.stat-table {','.hp-row {','.attributes {'],
  'components/pickers.css':['.combobox {','.picker-dialog {','.ui-option-row,.combobox-option {','.nature-option {','.picker-pokemon-types {'],
};
for(const [file,selectors] of Object.entries(owners)) for(const selector of selectors) check(css.get(file)?.includes(selector),`${selector.split(' {')[0]} belongs to ${file}`);
for(const menu of ['calculator','reverse','finetune','matchup','dex']) {
  const file=`pages/${menu}.css`,source=css.get(file)||'';
  check(!!source&&Buffer.byteLength(source)<16*1024,`${menu} has one compact page stylesheet`);
  check(!/\n\s*\.(?:ui-control|ui-button|ui-select-trigger|ui-icon|ui-chevron|combobox-option|stat-table)\s*\{/.test(source),`${menu} does not redefine shared base elements`);
}
check(!css.has('components/tool-stats.css')&&!css.has('themes.css')&&!css.has('responsive.css'),'obsolete stat editor and late override layers are removed');
check(Buffer.byteLength(all)<100*1024,'total source CSS remains under 100 KiB');
check((all.match(/!important/g)||[]).length===1&&/\[hidden\]\s*\{\s*display:none !important;\s*\}/.test(all),'only the native hidden invariant uses important');
const duplicateMedia=[];
for(const [file,source]of css){const queries=[...source.matchAll(/@media\s*([^\{]+)\{/g)].map(m=>m[1].replace(/\s+/g,''));if(new Set(queries).size!==queries.length)duplicateMedia.push(file);}
check(!duplicateMedia.length,`one media block per condition per owner (${duplicateMedia.join(', ')})`);
const palette=css.get('00-tokens.css');
for(const type of ['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy','stellar']) check(palette.includes(`--type-${type}-bg`)&&palette.includes(`--type-${type}-fg`),`${type} has a central palette`);
check(palette.includes(':root[data-theme="dark"]'),'dark theme is token driven');
check([...css.keys()].every(file=>CSS_LAYER_ORDER.includes(styleLayerFor(file))),'every stylesheet has a deterministic layer');
const generated=readFileSync(path.join(root,'pokemon-champions-calculator-v3.html'),'utf8');
check(generated.includes(`@layer ${CSS_LAYER_ORDER.join(', ')};`),'generated artifact declares the canonical layer order');
process.exitCode=failures?1:0;
