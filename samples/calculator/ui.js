/* Shared UI markup. Callers supply content and state; visual variants live in CSS. */
const SampleUI = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const attributes = values => Object.entries(values).filter(([,value]) => value !== false && value != null)
    .map(([key,value]) => value === true ? ` ${key}` : ` ${key}="${escape(value)}"`).join('');
  const paths = {
    chevron:'<path d="m6 9 6 6 6-6"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    settings:'<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/>',
    swap:'<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',
    down:'<path d="M12 4v16m-5-5 5 5 5-5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    moon:'<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>'
  };
  const icon = name => `<svg class="ui-icon${name === 'chevron' ? ' ui-chevron' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  const options = (values,selected) => values.map(([value,label]) => `<option${attributes({value,selected:String(value) === String(selected)})}>${escape(label)}</option>`).join('');
  const trigger = (content,attrs,className='') => `<button${attributes({...attrs,type:'button',class:`ui-button ui-select-trigger ${className}`})}><span class="ui-select-content">${content}</span>${icon('chevron')}</button>`;
  const select = (values,selected,attrs={},variant='') => `<span class="ui-select ${variant}"><select${attributes({...attrs,class:`ui-control ${attrs.class || ''}`})}>${options(values,selected)}</select>${icon('chevron')}</span>`;
  const number = attrs => `<input${attributes({type:'number',step:1,inputmode:'numeric',...attrs,class:`ui-control ui-number ${attrs.class || ''}`})}>`;
  const field = (label,control) => `<label class="form-field">${escape(label)}${control}</label>`;
  const check = (label,attrs) => `<label class="ui-check check"><input${attributes({...attrs,type:'checkbox',class:'ui-checkbox'})}>${escape(label)}</label>`;
  return {icon,trigger,select,number,field,check};
})();

// Static page icons and dynamically rendered controls use the same icon source.
document.querySelectorAll('[data-ui-icon]').forEach(node => { node.outerHTML = SampleUI.icon(node.dataset.uiIcon); });
