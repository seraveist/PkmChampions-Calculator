import {readFileSync,readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>readFileSync(path.join(root,p),'utf8');
let failures=0;
function check(ok,label){console[ok?'log':'error'](`[${ok?'PASS':'FAIL'}] ${label}`);if(!ok)failures++;}
const html=read('src/calc-template.html');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
check(new Set(ids).size===ids.length,'static IDs are unique');
check((html.match(/<main\b/g)||[]).length===1,'one main landmark');
check(html.includes('href="#appContent"'),'skip link targets main content');
check(!/<button(?![^>]*\btype=)/.test(html),'every static button declares its type');
const buttonClassHosts=[...html.matchAll(/<([a-z][\w-]*)\b[^>]*\bclass="([^"]*)"[^>]*>/g)].filter(m=>m[2].split(/\s+/).includes('ui-button')&&!['button','a'].includes(m[1]));
check(!buttonClassHosts.length,'button component classes do not leak into tables or layout containers');
check(!/fonts\.(?:googleapis|gstatic)\.com/.test(html),'no external font dependency');
check(!/role="heading"/.test(html),'native heading hierarchy');
for(const page of ['calc','revcalc','finetune','matchup','dex']) {
  const block=html.match(new RegExp(`<section id="page-${page}"[^>]*>`))?.[0]||'';
  check(block.includes('role="tabpanel"')&&block.includes(`aria-labelledby="nav-${page}"`),`${page} has a named tab panel`);
  check(html.includes(`aria-controls="page-${page}"`),`${page} navigation points to its panel`);
  check(page==='calc'||/\bhidden\b/.test(block),`${page} initial visibility is explicit`);
}
const unresolved=[];
for(const m of html.matchAll(/\b(?:for|aria-controls|aria-labelledby|aria-describedby)="([^"]+)"/g)) for(const id of m[1].split(/\s+/)) if(!ids.includes(id))unresolved.push(id);
check(!unresolved.length,`static label and control references resolve (${unresolved.join(', ')})`);
check(!html.includes('data-calc-detail-toggle')&&!html.includes('calcMobileSummary'),'accepted calculator has no hidden stat editor or removed result shortcut');
for(const id of ['calc-side-settings','calc-move-settings','dexDetailModal']) check(new RegExp(`<dialog[^>]*id="${id}"[^>]*aria-labelledby=`).test(html),`${id} uses a named native dialog`);
const files=readdirSync(path.join(root,'src/js')).filter(f=>f.endsWith('.js'));
const sources=files.map(f=>read('src/js/'+f)).join('\n');
check(sources.includes('<table class="stat-table"')&&sources.includes('scope="col"')&&sources.includes('scope="row"'),'shared stat editor has real table headers');
check(sources.includes('rankAttr ? row('),'party effort editor can omit battle ranks without a second renderer');
check(sources.includes("document.createElement('dialog')")&&sources.includes("dialog.showModal()"),'all search and party overlays use native modal behavior');
check(sources.includes('function uiWirePickerDialog')&&sources.includes('function uiStatTable'),'selection and stat structures have shared renderers');
check(html.includes('id="reverse-worker-source"'),'reverse worker remains embedded for standalone use');
check(existsSync(path.join(root,'pokemon-champions-calculator-v3.html')),'standalone artifact exists');
process.exitCode=failures?1:0;
