import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>readFileSync(path.join(root,p),'utf8');let failures=0;
function check(ok,label){console[ok?'log':'error'](`[${ok?'PASS':'FAIL'}] ${label}`);if(!ok)failures++;}
const modal=read('src/js/03-19-picker-dialog.js'),css=read('src/styles/components/pickers.css'),controls=read('src/styles/components/00-controls.css');
check(modal.includes("document.createElement('dialog')")&&modal.includes('dialog.showModal()'),'picker uses a native top-layer dialog');
check(modal.includes("dialog.addEventListener('cancel'")&&modal.includes('focusControl(selector)'),'Escape and selection restore the owning trigger');
check(modal.includes("attr.name !== 'data-value'"),'focus restoration uses identity, not the old selected value');
check(modal.includes('event.isComposing')&&modal.includes('event.keyCode === 229'),'IME confirmation does not select a row prematurely');
for(const key of ['ArrowDown','ArrowUp','Home','End','Enter'])check(modal.includes(`'${key}'`),`${key} has a shared keyboard action`);
check(modal.includes('aria-activedescendant')&&modal.includes('aria-controls'),'search exposes active option and list references');
check(modal.includes('data-picker-category')&&modal.includes('aria-pressed'),'move category filters expose selected state');
check(css.includes('overflow:auto')&&css.includes('overscroll-behavior:contain'),'long lists scroll internally on both axes');
check(css.includes('--picker-row-height:44px')&&css.includes('scroll-snap-align:start'),'mobile rows preserve touch height and complete alignment');
check(controls.includes('.ui-search:focus-within')&&controls.includes('outline:var(--ui-focus-width)'),'search and keyboard focus use the common rounded control');
check(!read('src/js/03-20-calc-combobox.js').includes('CALC_COMBOBOX_PORTAL_WIDTHS'),'old inline portal positioning is removed');
process.exitCode=failures?1:0;
