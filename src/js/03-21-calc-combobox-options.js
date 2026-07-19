/* Calculator combobox option labels, rows, and tooltips. */
function calcComboboxOptionLabel(type, option) {
  if (option?.label) return option.label;
  if (type === 'pokemon') return pkName(option);
  if (type === 'move') return mvName(option);
  if (type === 'ability') return abName(option);
  if (type === 'type1' || type === 'type2' || type === 'moveType') return option?.label || TYPE_KO[option?.id] || option?.id || '';
  if (type === 'form') return option?.label || calcPokemonFormLabel(option?.raw || option);
  if (type === 'nature') return calcNatureLabel(option);
  if (type === 'status') return option?.label || '';
  if (CALC_FIELD_OPTION_SETS[type]) return option?.label || '';
  return itName(option);
}

function calcComboboxOptionSub(type, option) {
  if (type === 'form') return '';
  if (type === 'type1' || type === 'type2' || type === 'moveType') return '';
  if (option?.sub) return option.sub;
  if (option?.label && !option.type && !option.ab && !option.up) return '';
  if (type === 'move') return `${TYPE_KO[option.type] || option.type} ${calcMoveCategoryLabel(option.cat)} ${option.bp || '??'}`;
  if (type === 'pokemon') return calcPokemonOptionMetaLabel(option);
  if (type === 'ability') return `${(option.desc || option.descLong || '').slice(0, 48)}`;
  if (type === 'item') return `${(option.desc || option.descLong || '').slice(0, 60)}`;
  if (type === 'nature') return option.up ? `${STAT_LABEL[option.up]} 상승 / ${STAT_LABEL[option.down]} 하락` : '능력 보정 없음';
  if (type === 'status') return option.sub || '';
  if (CALC_FIELD_OPTION_SETS[type]) return option.sub || '';
  return '';
}

function calcComboboxAttr(str) {
  return escapeHTML(str).replace(/"/g, '&quot;');
}

function calcPokemonOptionHeaderHtml() {
  return `
    <div class="pokemon-option-header" aria-hidden="true">
      <span>이름</span>
      <span>타입</span>
      <span>체력</span>
      <span>공격</span>
      <span>방어</span>
      <span>특공</span>
      <span>특방</span>
      <span>속도</span>
    </div>
  `;
}

function calcMoveOptionHeaderHtml() {
  return `
    <div class="move-option-header" aria-hidden="true">
      <span>기술명</span>
      <span>분류</span>
      <span>타입</span>
      <span>위력</span>
    </div>
  `;
}

function calcNatureOptionHeaderHtml() {
  return `
    <div class="nature-option-header" aria-hidden="true">
      <span>성격</span>
      <span>상승</span>
      <span>하락</span>
    </div>
  `;
}

function calcComboboxHeaderHtml(type) {
  if (type === 'pokemon') return calcPokemonOptionHeaderHtml();
  if (type === 'move') return calcMoveOptionHeaderHtml();
  if (type === 'nature') return calcNatureOptionHeaderHtml();
  return '';
}

function calcRenderPokemonOption(option, currentId) {
  const pokemon = option?.raw || option || {};
  const id = option?.id || pokemon.id || '';
  const label = option?.label || pkName(pokemon);
  const typeBadges = (pokemon.types || option?.types || []).map(type => (
    `<span class="badge-mini pokemon-option-type-badge t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`
  )).join('');
  const bs = pokemon.bs || option?.bs || {};
  const selected = String(id) === String(currentId);
  return `
    <div class="combobox-option pokemon-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="pokemon-option-name">${escapeHTML(label)}</b>
      <span class="pokemon-option-types">${typeBadges}</span>
      <span class="pokemon-option-stat">${bs.hp || 0}</span>
      <span class="pokemon-option-stat">${bs.atk || 0}</span>
      <span class="pokemon-option-stat">${bs.def || 0}</span>
      <span class="pokemon-option-stat">${bs.spa || 0}</span>
      <span class="pokemon-option-stat">${bs.spd || 0}</span>
      <span class="pokemon-option-stat">${bs.spe || 0}</span>
    </div>
  `;
}

function calcRenderSimplePokemonOption(option, currentId) {
  const pokemon = option?.raw || option || {};
  const id = option?.id || pokemon.id || '';
  const label = option?.label || pkName(pokemon);
  const types = pokemon.types || option?.types || [];
  const typeBadges = types.map(type => (
    `<span class="type-pill pokemon-simple-type-pill t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`
  )).join('');
  const selected = String(id) === String(currentId);
  const optionClass = ['combobox-option', 'ui-option', 'pokemon-simple-option', 'matchup-option', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <div class="${optionClass}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="pokemon-simple-option-name matchup-option-name">${escapeHTML(label)}</b>
      <small class="pokemon-simple-option-types matchup-option-types">${typeBadges}</small>
    </div>
  `;
}

function calcRenderSimpleMoveOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || option?.koName || (id ? mvName(option) : '없음');
  const selected = String(id) === String(currentId);
  const optionClass = ['combobox-option', 'ui-option', 'move-simple-option', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <div class="${optionClass}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b>${escapeHTML(label)}</b>
    </div>
  `;
}

function calcRenderMoveOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || option?.koName || (id ? mvName(option) : '없음');
  const selected = String(id) === String(currentId);
  const category = option?.cat ? calcMoveCategoryLabel(option.cat) : '';
  const categoryClass = option?.cat === 'Physical' ? 'cat-phys' : option?.cat === 'Special' ? 'cat-spec' : 'cat-stat';
  const typeBadge = option?.type
    ? `<span class="badge-mini move-option-type-badge t-${escapeHTML(option.type)}">${escapeHTML(TYPE_KO[option.type] || option.type)}</span>`
    : '';
  const power = option?.cat === 'Status' ? '' : (option?.bp || '');
  return `
    <div class="combobox-option move-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b class="move-option-name">${escapeHTML(label)}</b>
      <span class="move-option-category">${category ? `<span class="cat-badge ${categoryClass}">${escapeHTML(category)}</span>` : ''}</span>
      <span class="move-option-type">${typeBadge}</span>
      <span class="move-option-power">${escapeHTML(power)}</span>
    </div>
  `;
}

function calcRenderAbilityOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || abName(option);
  const sub = option?.sub || calcComboboxOptionSub('ability', option);
  const selected = String(id) === String(currentId);
  const tooltip = sub ? ` data-tooltip="${calcComboboxAttr(sub)}" aria-label="${calcComboboxAttr(`${label}: ${sub}`)}"` : '';
  return `<div class="combobox-option ability-option tooltip-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"${tooltip}><b>${escapeHTML(label)}</b></div>`;
}

function calcRenderItemOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || itName(option);
  const selected = String(id) === String(currentId);
  return `<div class="combobox-option item-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b></div>`;
}

function calcRenderNatureOption(option, currentId) {
  const id = option?.id || '';
  const nature = option?.raw || option || {};
  const label = option?.label || calcNatureLabel(nature);
  const up = nature.up ? (STAT_LABEL[nature.up] || nature.up) : '없음';
  const down = nature.down ? (STAT_LABEL[nature.down] || nature.down) : '없음';
  const selected = String(id) === String(currentId);
  return `
    <div class="combobox-option nature-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}">
      <b>${escapeHTML(label)}</b>
      <span>${escapeHTML(up)}</span>
      <span>${escapeHTML(down)}</span>
    </div>
  `;
}

function calcRenderStatusOption(option, currentId) {
  const id = option?.id || '';
  const label = option?.label || '';
  const sub = option?.sub || '';
  const selected = String(id) === String(currentId);
  const subHtml = sub ? `<small>${escapeHTML(sub)}</small>` : '<small></small>';
  return `<div class="combobox-option status-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${subHtml}</div>`;
}

function calcRenderGenericOption(type, option, currentId) {
  const id = option?.id || '';
  const label = calcComboboxOptionLabel(type, option);
  const sub = calcComboboxOptionSub(type, option);
  const selected = String(id) === String(currentId);
  const subHtml = sub ? `<small>${escapeHTML(sub)}</small>` : '';
  const typeClass = type ? `${type}-option` : '';
  return `<div class="${uiClassNames('combobox-option ui-option', typeClass, selected ? 'selected' : '')}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${subHtml}</div>`;
}

function calcRenderComboboxOption(type, option, currentId) {
  if (type === 'pokemon') return calcRenderPokemonOption(option, currentId);
  if (type === 'move') return calcRenderMoveOption(option, currentId);
  if (type === 'ability') return calcRenderAbilityOption(option, currentId);
  if (type === 'item') return calcRenderItemOption(option, currentId);
  if (type === 'nature') return calcRenderNatureOption(option, currentId);
  if (type === 'status') return calcRenderStatusOption(option, currentId);
  return calcRenderGenericOption(type, option, currentId);
}

function calcComboboxExtraOptions(type) {
  if (type === 'item') return [{ id: '', label: '없음' }];
  if (type === 'move') return [{ id: '', label: '\uC5C6\uC74C' }];
  if (type === 'ability') return [{ id: '', label: '없음', sub: '특성 효과를 적용하지 않음' }];
  return [];
}

function calcComboboxCurrentId(input) {
  const type = input.dataset.cbType;
  const sideKey = input.dataset.side;
  const field = input.dataset.field || '';
  if (CALC_FIELD_OPTION_SETS[type]) return input.dataset.value || '';
  const side = sideKey ? state[sideKey] : null;
  if (!side) return '';
  if (field === 'pokemonIdx') return side.pokemonIdx || '';
  if (field === 'ability') return side.ability || '';
  if (field === 'item') return side.item || '';
  if (field === 'types.0') return sideTypeId(side, 0);
  if (field === 'types.1') return sideTypeId(side, 1);
  if (field === 'formIdx') return side.pokemonIdx || '';
  if (field.startsWith('moveTypes.')) {
    const idx = parseInt(field.split('.')[1], 10);
    const move = MoveById[side.moves?.[idx]];
    return move ? manualTypeForSlot(side, idx, move) : '';
  }
  if (field === 'nature') return side.nature || 'hardy';
  if (field === 'status') return side.status || 'none';
  if (field.startsWith('moves.')) {
    const idx = parseInt(field.split('.')[1], 10);
    return side.moves?.[idx] || '';
  }
  return '';
}

function calcComboboxDisplayLabel(input) {
  const type = input.dataset.cbType;
  const id = calcComboboxCurrentId(input);
  const sideKey = input.dataset.side;
  if (CALC_FIELD_OPTION_SETS[type]) return calcFieldOptionLabel(type, input.dataset.value);
  if (type === 'pokemon') return PokemonById[id] ? pkName(PokemonById[id]) : '';
  if (type === 'move') return id && MoveById[id] ? mvName(MoveById[id]) : '';
  if (type === 'ability') return calcAbilityDisplayLabel(sideKey);
  if (type === 'moveType') return id ? (TYPE_KO[id] || id) : '';
  if (type === 'type1' || type === 'type2') return id ? (TYPE_KO[id] || id) : '없음';
  if (type === 'form') return PokemonById[id] ? calcPokemonFormLabel(PokemonById[id]) : '';
  if (type === 'item') return id && ItemById[id] ? itName(ItemById[id]) : '없음';
  if (type === 'nature') return calcNatureLabel(NATURE_BY_ID[id]);
  if (type === 'status') return calcStatusDisplayLabel(id);
  return id || '';
}

function calcOptionTooltipEl() {
  let el = document.getElementById('calc-combobox-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'calc-combobox-tooltip';
    el.className = 'calc-combobox-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function calcPositionOptionTooltip(option, el) {
  if (typeof window === 'undefined' || typeof option?.getBoundingClientRect !== 'function') return;
  const rect = option.getBoundingClientRect();
  const margin = 12;
  const box = el.getBoundingClientRect();
  const width = box.width || Math.min(280, window.innerWidth - margin * 2);
  const height = box.height || 44;
  const anchorX = rect.left + rect.width * 0.7;
  const anchorY = rect.top + rect.height / 2 - height / 2;
  const left = Math.max(margin, Math.min(anchorX, window.innerWidth - width - margin));
  const top = Math.max(margin, Math.min(anchorY, window.innerHeight - height - margin));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function calcShowOptionTooltip(option) {
  const text = option?.dataset?.tooltip || '';
  if (!text) return;
  const el = calcOptionTooltipEl();
  const anchorId = option.id || option.dataset.id || '';
  if (el.classList.contains('visible') && el.dataset.anchorId === anchorId && el.textContent === text) return;
  el.classList.remove('visible');
  el.textContent = text;
  el.dataset.anchorId = anchorId;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 320;
  el.style.width = `${Math.max(120, Math.min(280, viewportWidth - 24))}px`;
  calcPositionOptionTooltip(option, el);
  el.classList.add('visible');
}

function calcHideOptionTooltip() {
  const el = document.getElementById('calc-combobox-tooltip');
  if (el) {
    el.classList.remove('visible');
    delete el.dataset.anchorId;
  }
}
