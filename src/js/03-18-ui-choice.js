/* Anchored choices keep the native value/change contract shared by all menus. */
(() => {
  let active = null, uid = 0;
  const sync = select => {
    const trigger = select.parentElement?.querySelector('.ui-choice-trigger');
    const label = select.selectedOptions[0]?.textContent || '';
    if (trigger) {
      trigger.querySelector('.ui-select-content').textContent = label;
      trigger.setAttribute('aria-label', `${select.getAttribute('aria-label') || '선택'}: ${label}`);
    }
  };
  const close = (restore = false) => {
    if (!active) return;
    const {menu,trigger} = active;
    active = null;
    trigger.setAttribute('aria-expanded','false');
    trigger.removeAttribute('aria-controls');
    trigger.removeAttribute('popovertarget');
    if (menu.matches(':popover-open')) menu.hidePopover();
    menu.remove();
    if (restore) trigger.focus({preventScroll:true});
  };
  const open = trigger => {
    if (active?.trigger === trigger) return;
    close();
    const select = trigger.parentElement.querySelector('select');
    if (select.disabled) return;
    const menu = document.createElement('div');
    menu.id = `ui-choice-${++uid}`;
    menu.className = 'ui-choice-menu';
    menu.setAttribute('popover','auto');
    menu.setAttribute('role','listbox');
    menu.setAttribute('aria-label',select.getAttribute('aria-label') || '선택');
    for (const option of select.options) {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'ui-button ui-choice-option';
      row.setAttribute('role','option'); row.setAttribute('aria-selected',String(option.selected));
      row.tabIndex = -1; row.value = option.value; row.textContent = option.textContent;
      row.disabled = option.disabled;
      menu.append(row);
    }
    (trigger.closest('main') || document.body).append(menu);
    const rect = trigger.getBoundingClientRect(), width = Math.max(96,rect.width);
    const below = innerHeight-rect.bottom-8, above = rect.top-8;
    const down = below >= Math.min(menu.children.length*40+10,280) || below >= above;
    menu.style.width = `${Math.min(width,innerWidth-16)}px`;
    menu.style.maxHeight = `${Math.max(40,down ? below : above)}px`;
    menu.style.left = `${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px`;
    if (down) menu.style.top = `${rect.bottom+4}px`;
    else menu.style.bottom = `${innerHeight-rect.top+4}px`;
    active = {menu,trigger};
    trigger.setAttribute('aria-controls',menu.id); trigger.setAttribute('aria-expanded','true');
    // Native invocation keeps repeated clicks and outside-click dismissal consistent.
    trigger.setAttribute('popovertarget',menu.id);
    menu.addEventListener('toggle',event=>{
      if (active?.menu!==menu) return;
      if (event.newState==='closed') close();
      else (menu.querySelector('[aria-selected=true]:not(:disabled)') || menu.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
    });
    menu.addEventListener('click',event=>{
      const row = event.target.closest('.ui-choice-option');
      if (!row || row.disabled) return;
      // Menu renders may replace the trigger. Restore focus through its stable data attributes.
      const identity = [...select.attributes].filter(a=>a.name.startsWith('data-')).map(a=>`[${a.name}="${CSS.escape(a.value)}"]`).join('');
      select.value = row.value; sync(select); close();
      select.dispatchEvent(new Event('change',{bubbles:true}));
      const next = trigger.isConnected ? trigger : identity ? document.querySelector(`select${identity}`)?.parentElement.querySelector('.ui-choice-trigger') : null;
      next?.focus({preventScroll:true});
    });
    menu.addEventListener('keydown',event=>{
      if (event.isComposing) return;
      if (event.key==='Escape') { event.preventDefault(); close(true); }
      else if (event.key==='Tab') close(true);
      else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const rows = [...menu.querySelectorAll('button:not(:disabled)')];
        const index = rows.indexOf(document.activeElement);
        const next = event.key==='Home' ? 0 : event.key==='End' ? rows.length-1 : (index+(event.key==='ArrowDown' ? 1 : -1)+rows.length)%rows.length;
        rows[next]?.focus();
      }
    });
  };
  document.addEventListener('click',event=>{
    const trigger = event.target.closest('.ui-choice-trigger');
    if (trigger) open(trigger);
  });
  document.addEventListener('keydown',event=>{
    const trigger = event.target.closest('.ui-choice-trigger');
    if (trigger && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); trigger.click(); }
  });
  document.addEventListener('change',event=>{ if (event.target.matches('.ui-select--choice>select')) sync(event.target); });
  window.addEventListener?.('resize',()=>close());
  document.addEventListener('scroll',event=>{ if (active && !active.menu.contains(event.target)) close(); },true);
})();
