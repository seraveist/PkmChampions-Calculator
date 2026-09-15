import { RotomUI } from './01-10-rotom-ui.js';
import { escapeHTML, renderTrustedHTML } from './01-core.js';
import { calcSharedComboboxUid, setCalcSharedComboboxUid } from './03-20-calc-combobox.js';

/* One modal search/list interaction for every menu. State remains with each caller. */
function uiPickerKind(control) {
  const explicit = control.dataset.cbType;
  if (explicit) return explicit;
  const key = control.dataset.ftPick || control.dataset.rcPick || '';
  if (/form/i.test(key)) return 'form';
  if (/ability/i.test(key)) return 'ability';
  if (/nature/i.test(key)) return 'nature';
  if (/item/i.test(key) || control.hasAttribute('data-rc-opp-item')) return 'item';
  if (control.classList.contains('tool-pokemon-input') || ['my','opp','mypokemon','opppokemon'].includes(key)) return 'pokemon';
  if (control.classList.contains('rc-move-input')) return 'move';
  return 'choice';
}

function uiPickerSize(list) {
  list.style.maxHeight = '';
  const heading = list.querySelector('.pokemon-option-header');
  const headerHeight = heading?.getBoundingClientRect().height || 0;
  list.style.setProperty('--picker-header-height', `${headerHeight}px`);
  const row = [...list.querySelectorAll('.combobox-option')].find(el => !el.hidden);
  if (!row) return;
  const height = row.getBoundingClientRect().height;
  if (!height) return;
  const scrollbar = list.offsetHeight - list.clientHeight;
  const count = Math.max(1,Math.floor((list.clientHeight - headerHeight + .5) / height));
  list.style.maxHeight = `${headerHeight + count * height + scrollbar}px`;
}

function uiWirePickerDialog(control, list, {showOptions,onSelect,onClose} = {}) {
  if (!control || !list) return null;
  const kind = uiPickerKind(control);
  const uid = `ui-picker-${setCalcSharedComboboxUid(calcSharedComboboxUid + 1)}`;
  const home = list.parentNode;
  let dialog = null, search = null, activeIndex = -1, category = '';
  control.setAttribute('aria-haspopup','dialog');
  control.setAttribute('aria-expanded','false');
  control.removeAttribute('role');
  control.removeAttribute('aria-autocomplete');
  const options = () => [...list.querySelectorAll('.combobox-option:not(.empty)')].filter(el => !el.hidden);
  const locator = () => {
    const attrs = [...control.attributes].filter(attr => attr.name.startsWith('data-') && !/wired/i.test(attr.name) && attr.name !== 'data-value');
    return attrs.length ? `button${attrs.map(attr => `[${attr.name}="${CSS.escape(attr.value)}"]`).join('')}` : control.id ? `#${CSS.escape(control.id)}` : '';
  };
  const focusControl = selector => {
    const target = control.isConnected ? control : selector ? document.querySelector(selector) : null;
    target?.focus({preventScroll:true});
  };
  const close = ({restoreFocus = true} = {}) => {
    if (!dialog) return;
    const old = dialog, selector = locator();
    dialog = null;
    control.setAttribute('aria-expanded','false');
    control.removeAttribute('aria-controls');
    list.classList.remove('open');
    home?.append(list);
    old.close();
    old.remove();
    if (typeof onClose === 'function') onClose();
    if (restoreFocus) requestAnimationFrame(() => focusControl(selector));
  };
  const setActive = index => {
    const rows = options();
    activeIndex = rows.length ? Math.max(0,Math.min(index,rows.length - 1)) : -1;
    list.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
    const row = rows[activeIndex];
    search?.removeAttribute('aria-activedescendant');
    if (!row) return;
    row.classList.add('active');
    search?.setAttribute('aria-activedescendant',row.id);
    const bounds = list.getBoundingClientRect(), box = row.getBoundingClientRect();
    const top = bounds.top + (list.querySelector('.pokemon-option-header')?.getBoundingClientRect().height || 0);
    const bottom = bounds.bottom - (list.offsetHeight-list.clientHeight);
    if (box.top < top) list.scrollTop += box.top - top;
    else if (box.bottom > bottom) list.scrollTop += box.bottom - bottom;
  };
  const refresh = () => {
    if (!dialog) return;
    showOptions(search.value);
    list.classList.add('open');
    list.style.left = ''; list.style.right = '';
    list.querySelectorAll('.combobox-option').forEach((el,i) => {
      el.id = `${uid}-option-${i}`;
      el.hidden = !!(category && el.dataset.category && el.dataset.category !== category);
    });
    list.scrollTop = 0; list.scrollLeft = 0;
    activeIndex = -1;
    search.removeAttribute('aria-activedescendant');
    uiPickerSize(list);
  };
  const select = option => {
    if (!dialog || !option || option.classList.contains('empty')) return;
    const selector = locator();
    close({restoreFocus:false});
    if (typeof onSelect === 'function') onSelect(option);
    requestAnimationFrame(() => focusControl(selector));
  };
  const open = (query = '') => {
    if (dialog) return;
    category = '';
    dialog = document.createElement('dialog');
    dialog.className = 'ui-surface ui-dialog picker-dialog';
    dialog.dataset.kind = kind;
    dialog.id = uid;
    const title = ({pokemon:'포켓몬',move:'기술',item:'도구',ability:'특성',nature:'성격',form:'폼',weather:'날씨',terrain:'필드',gameType:'배틀'})[kind] || control.getAttribute('aria-label') || '항목';
    dialog.setAttribute('aria-labelledby',`${uid}-title`);
    renderTrustedHTML(dialog, `<div class="dialog-heading"><h2 id="${uid}-title">${escapeHTML(title)} 선택</h2><button type="button" class="ui-button icon-button" data-picker-close aria-label="닫기">${RotomUI.icon('close')}</button></div><label class="ui-search picker-search">${RotomUI.icon('search')}<input class="ui-control" type="search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="${uid}-list" aria-label="이름 검색" placeholder="이름 검색" autocomplete="off"></label>${kind === 'move' ? `<div class="picker-filters">${[['','전체'],['Physical','물리'],['Special','특수'],['Status','변화']].map(([key,label]) => `<button type="button" class="ui-button ui-button--filter" data-picker-category="${key}" aria-pressed="${key === ''}">${label}</button>`).join('')}</div>` : ''}`);
    list.id = `${uid}-list`;
    list.setAttribute('role','listbox');
    list.setAttribute('aria-label',`${title} 목록`);
    dialog.append(list);
    document.body.append(dialog);
    search = dialog.querySelector('input');
    search.value = query;
    control.setAttribute('aria-controls',uid);
    control.setAttribute('aria-expanded','true');
    dialog.querySelector('[data-picker-close]').addEventListener('click',() => close());
    dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
    dialog.addEventListener('click',event => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
      }
      const filter = event.target.closest('[data-picker-category]');
      if (!filter) return;
      category = filter.dataset.pickerCategory;
      dialog.querySelectorAll('[data-picker-category]').forEach(el => el.setAttribute('aria-pressed',String(el === filter)));
      refresh();
    });
    search.addEventListener('input',refresh);
    search.addEventListener('keydown',event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const rows = options();
        setActive(event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : rows.length - 1) : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        select(options()[activeIndex < 0 ? 0 : activeIndex]);
      }
    });
    dialog.showModal();
    refresh();
    search.focus({preventScroll:true});
  };
  // Capture avoids older menu-specific mouse/blur handlers committing twice.
  list.addEventListener('click',event => {
    const option = event.target.closest('.combobox-option:not(.empty)');
    if (!option || !dialog) return;
    event.preventDefault(); event.stopImmediatePropagation(); select(option);
  },true);
  list.addEventListener('mousedown',event => { if (dialog) { event.preventDefault(); event.stopImmediatePropagation(); } },true);
  control.addEventListener('keydown',event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(''); }
  });
  control.addEventListener('click',() => open(''));
  return {open,close,select,commitTyped:()=>false,commitExact:()=>false,commitActive:()=>select(options()[Math.max(0,activeIndex)])};
}

export { uiPickerKind, uiPickerSize, uiWirePickerDialog };
