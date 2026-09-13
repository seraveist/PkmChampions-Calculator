/* Shared UI markup. Callers supply content and state; visual variants live in CSS. */
const RotomUI = (() => {
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
  const picker = (label,value,attrs={},variant='') => `<div class="combobox ui-picker ${variant}">${trigger(`<span class="ui-select-label">${escape(label)}</span><strong class="ui-select-value">${escape(value || '선택')}</strong>`,{...attrs,value,'aria-label':label,'aria-expanded':'false'},`cb-input cb-trigger ui-select-trigger--compact attribute ${attrs.class || ''}`)}<div class="combobox-options" role="listbox"></div></div>`;
  return {icon,trigger,select,number,field,check,picker};
})();

// Static page icons and dynamically rendered controls use the same icon source.
function mountRotomIcons() {
  document.querySelectorAll('[data-ui-icon]').forEach(node => { node.outerHTML = RotomUI.icon(node.dataset.uiIcon); });
}

function uiSetPickerLabel(control, label) {
  control.value = label;
  if (control.tagName !== 'BUTTON') return;
  const text = control.querySelector('.ui-select-value, .picker-label');
  if (text) text.textContent = label;
  else renderTrustedHTML(control, `<span class="ui-select-content picker-label">${escapeHTML(label)}</span>${RotomUI.icon('chevron')}`);
}

function uiStatTable(side, { evAttr, evAttrs = {}, rankAttr, magic = null, base = true, label = '능력치' } = {}) {
  const keys = ['hp','atk','def','spa','spd','spe'];
  const names = ['HP','공격','방어','특공','특방','속도'];
  const p = PokemonById[side.pokemonIdx];
  if (!p) return '';
  const stats = calcStats(side), nature = NATURE_BY_ID[side.nature];
  const row = (title, content) => `<tr><th scope="row">${title}</th>${keys.map((key,i) => `<td>${content(key,i)}</td>`).join('')}</tr>`;
  return `<table class="stat-table" aria-label="${escapeHTML(label)}"><colgroup><col>${keys.map(() => '<col>').join('')}</colgroup><thead><tr><th scope="col"><span class="sr-only">구분</span></th>${keys.map((key,i) => `<th scope="col" class="${nature?.up === key ? 'up' : nature?.down === key ? 'down' : ''}">${names[i]}</th>`).join('')}</tr></thead><tbody>
    ${base ? row('종족값', key => `<span class="stat-base">${p.bs[key]}</span>`) : ''}
    ${row('노력치', (key,i) => RotomUI.number({...evAttrs,value:side.evs[key] || 0,min:0,max:32,[evAttr]:key,'aria-label':`${names[i]} 노력치`}))}
    ${rankAttr ? row('랭크', (key,i) => key === 'hp' ? '—' : RotomUI.select(Array.from({length:13},(_,j) => [j-6,j>6 ? `+${j-6}` : j-6]),side.ranks?.[key] || 0,{[rankAttr]:key,'aria-label':`${names[i]} 랭크`},'ui-select--rank')) : ''}
    ${row('실수치', key => `<strong class="stat-final">${stats[key]}</strong>`)}
    ${magic ? row('매직', key => magic(key)) : ''}
  </tbody></table>`;
}
