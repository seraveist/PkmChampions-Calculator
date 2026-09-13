/* UI-only shared participant markup, excluded from the analysis worker. */
function renderToolFormCombobox({
  pokemonId,
  inputClass,
  pickAttr,
  pickValue,
  ariaLabel = '폼 선택',
  comboboxClass = '',
  comboboxAttrs = {},
  buttonAttrs = {},
} = {}) {
  const group = calcFormGroupForPokemon(PokemonById[pokemonId]);
  if (!group || !inputClass || !pickAttr || !pickValue) return '';
  const currentForm = PokemonById[pokemonId];
  const currentLabel = calcPokemonFormLabel(currentForm);
  const { class: buttonClass = '', ...extraButtonAttrs } = buttonAttrs;
  const attrs = {
    class: toolClassNames('cb-input cb-trigger form-switch-btn', inputClass, buttonClass),
    'data-cb-type': 'form',
    'aria-label': ariaLabel,
    'aria-expanded': 'false',
    ...extraButtonAttrs,
  };
  attrs[pickAttr] = pickValue;
  return `
    <div ${htmlAttrs({
      class: toolClassNames('combobox tool-form-combobox', comboboxClass),
      ...comboboxAttrs,
    })}>
      ${RotomUI.trigger(`<span class="picker-label">${escapeHTML(currentLabel)}</span>`,attrs,attrs.class)}
      <div class="combobox-options" role="listbox"></div>
    </div>
  `;
}

function toolClassNames(...parts) {
  return parts.flat(Infinity)
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

function renderToolTypePills(types, extraClass = '') {
  return (types || [])
    .filter(Boolean)
    .map(type => `<span class="${toolClassNames('type-pill tool-pokemon-type-pill', extraClass, `t-${type}`)}">${TYPE_KO[type] || type}</span>`)
    .join('');
}

function renderToolPokemonTypeStrip({ types, html, className = '', ariaLabel = '타입', empty = false } = {}) {
  const content = html ?? renderToolTypePills(types);
  const isEmpty = empty || !content;
  return `<div ${htmlAttrs({
    class: toolClassNames('tool-pokemon-type-strip', className, isEmpty && 'empty'),
    'aria-label': isEmpty ? null : ariaLabel,
    'aria-hidden': isEmpty ? 'true' : null,
  })}>${isEmpty ? '' : content}</div>`;
}

function renderToolPokemonSelectSubframe({
  primaryActions = '', titleActions = '', metaActions = '', toolbarActions = '',
  inputClass = '', inputAttrs = {}, value = '', pokemonId = '', types = null,
} = {}) {
  const p = PokemonById[pokemonId] || POKEMON.find(row => pkName(row) === value);
  return `<div class="participant-picker">
    <div class="participant-actions">${primaryActions}${titleActions}</div>
    <div class="combobox tool-pokemon-combobox">${RotomUI.trigger(`${p ? pokemonSpriteSlot(p) : '<span class="pokemon-sprite-slot is-empty" data-fallback-label="?"></span>'}<span class="pokemon-heading"><strong class="pokemon-name picker-label">${escapeHTML(value || '포켓몬 선택')}</strong><span class="type-list">${p ? renderToolTypePills(types || p.types) : ''}</span></span>`,{...inputAttrs,value,'data-cb-type':'pokemon','aria-label':inputAttrs['aria-label'] || '포켓몬 선택','aria-expanded':'false'},`pokemon-select cb-input cb-trigger tool-pokemon-input ${inputClass}`)}<div class="combobox-options" role="listbox"></div></div>
    ${metaActions || toolbarActions ? `<div class="participant-meta">${metaActions}${toolbarActions}</div>` : ''}
  </div>`;
}

function renderManualDamageBlockToggle(sideKey, side) {
  // 무효 효과는 결과 카드에서 안내한다. 토글로 HP나 순수 피해를 바꾸지 않는다.
  return '';
}

function renderTypeControls(sideKey, side) {
  const type1 = sideTypeId(side, 0);
  const type2 = sideTypeId(side, 1);
  return `
    <div class="type-edit-row ui-chip-row">
      <div class="combobox type-combobox type-pill-combobox t-${type1 || 'Normal'}" data-cb="${sideKey}-type-1">
        <button type="button" class="cb-input cb-trigger" data-cb-type="type1" data-side="${sideKey}" data-field="types.0" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 타입1 선택" aria-expanded="false">${escapeHTML(TYPE_KO[type1] || type1)}</button>
        <div class="combobox-options" role="listbox"></div>
      </div>
      <div class="combobox type-combobox type-pill-combobox ${type2 ? `t-${type2}` : 'type-none'}" data-cb="${sideKey}-type-2">
        <button type="button" class="cb-input cb-trigger" data-cb-type="type2" data-side="${sideKey}" data-field="types.1" aria-label="${sideKey === 'atk' ? '공격측' : '방어측'} 타입2 선택" aria-expanded="false">${escapeHTML(type2 ? (TYPE_KO[type2] || type2) : '없음')}</button>
        <div class="combobox-options" role="listbox"></div>
      </div>
      <button type="button" class="type-reset-btn" data-action="typeReset" data-side="${sideKey}" title="포켓몬 기본 타입으로 복구">초기화</button>
    </div>
  `;
}

function renderFormSwitchControls(sideKey, side) {
  const group = calcFormGroupForSide(side);
  if (!group) return '';
  const trigger = group.trigger ? ` · ${group.trigger}` : '';
  const sideLabel = sideKey === 'atk' ? '공격측' : '방어측';
  const formControl = renderToolFormCombobox({
    pokemonId: side?.pokemonIdx,
    inputClass: 'calc-cb-input',
    pickAttr: 'data-field',
    pickValue: 'formIdx',
    ariaLabel: `${sideLabel} ${group.label} 선택`,
    comboboxAttrs: { 'data-cb': `${sideKey}-form` },
    buttonAttrs: {
      'data-side': sideKey,
    },
  });
  return `
    <div class="form-switch-row ui-chip-row" aria-label="${escapeHTML(group.label + trigger)}">
      ${formControl}
    </div>
  `;
}
