import { uiClassNames } from './01-20-html-structure.js';
import { AbilityById, ItemById, MoveById, NATURE_BY_ID, PokemonById, STAT_LABEL, TYPE_KO, abName, escapeHTML, itName, mvName, pkName, pokemonSpriteSlot } from './01-core.js';
import { CALC_FIELD_OPTION_SETS, calcAbilityDisplayLabel, calcFieldOptionLabel, calcMoveCategoryLabel, calcNatureLabel, calcPokemonFormLabel, calcPokemonOptionMetaLabel, calcStatusDisplayLabel, manualTypeForSlot, sideTypeId, state } from './03-10-calc-state.js';
import { renderToolTypePills } from './03-11-calc-shared-render.js';

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
  return '<div class="pokemon-option-header" aria-hidden="true"><span>종족값</span><span>HP</span><span>공격</span><span>방어</span><span>특공</span><span>특방</span><span>속도</span><span>합계</span></div>';
}

function calcMoveOptionHeaderHtml() { return ''; }

function calcNatureOptionHeaderHtml() { return ''; }

function calcComboboxHeaderHtml(type) {
  if (type === 'pokemon') return calcPokemonOptionHeaderHtml();
  if (type === 'move') return calcMoveOptionHeaderHtml();
  if (type === 'nature') return calcNatureOptionHeaderHtml();
  return '';
}

function calcRenderPokemonOption(option,currentId) {
  const p = option?.raw || option || {}, id = option?.id || p.id || '', label = option?.label || pkName(p);
  const stats = ['hp','atk','def','spa','spd','spe'], names = ['HP','공격','방어','특공','특방','속도'];
  const selected = String(id) === String(currentId), bs = p.bs || {};
  return `<div class="combobox-option pokemon-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected}"><span class="picker-pokemon-name">${pokemonSpriteSlot(p)}<b>${escapeHTML(label)}</b><span class="picker-pokemon-types">${renderToolTypePills(p.types || [])}</span></span>${stats.map((key,i) => `<span class="picker-stat"><span class="sr-only">${names[i]} </span>${bs[key] || 0}</span>`).join('')}<span class="picker-stat stat-total"><span class="sr-only">합계 </span>${stats.reduce((sum,key) => sum+(bs[key] || 0),0)}</span></div>`;
}

function calcRenderSimplePokemonOption(option,currentId) { return calcRenderPokemonOption(option,currentId); }

function calcRenderSimpleMoveOption(option,currentId) { return calcRenderMoveOption(option,currentId); }

function calcRenderMoveOption(option,currentId) {
  const m = option?.raw || MoveById[option?.id] || option || {}, id = option?.id || '', label = option?.label || (id ? mvName(m) : '기술 비우기');
  const description = m.desc || m.descLong || option.sub || '', selected = String(id) === String(currentId);
  return `<div class="combobox-option move-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" data-category="${escapeHTML(m.cat || '')}" role="option" aria-selected="${selected}" title="${escapeHTML([label,description].filter(Boolean).join(' · '))}"><b>${escapeHTML(label)}</b>${m.type ? `<span class="picker-detail picker-move-detail">${renderToolTypePills([m.type])}<strong class="picker-move-power"><span class="sr-only">위력 </span>${m.bp || '—'}</strong><span class="picker-move-category">${escapeHTML(calcMoveCategoryLabel(m.cat))}</span><span class="picker-description">${escapeHTML(description)}</span></span>` : ''}</div>`;
}

function calcRenderAbilityOption(option,currentId) {
  const a = option?.raw || AbilityById[option?.id] || option;
  return calcRenderDescriptionOption(option.id,option.label || abName(a),a.desc || a.descLong || option.sub || '',currentId,'ability');
}

function calcRenderItemOption(option,currentId) {
  const item = option?.raw || ItemById[option?.id] || option;
  return calcRenderDescriptionOption(option.id,option.label || itName(item),item.desc || item.descLong || option.sub || '',currentId,'item');
}

function calcRenderDescriptionOption(id,label,description,currentId,kind) {
  const selected = String(id || '') === String(currentId);
  return `<div class="combobox-option ${kind}-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id || '')}" role="option" aria-selected="${selected}" title="${escapeHTML([label,description].filter(Boolean).join(' · '))}"><b>${escapeHTML(label)}</b><span class="picker-detail picker-description">${escapeHTML(description)}</span></div>`;
}

function calcRenderNatureOption(option,currentId) {
  const nature = option?.raw || NATURE_BY_ID[option?.id] || option || {}, id = option?.id || '', label = option?.label || calcNatureLabel(nature);
  const selected = String(id) === String(currentId);
  const effect = (stat,dir) => `<span class="ui-tag nature-effect nature-effect--${dir}"><span>${STAT_LABEL[stat]}</span><span aria-hidden="true">${dir === 'up' ? '↑' : '↓'}</span><span class="sr-only">${dir === 'up' ? '상승' : '하락'}</span></span>`;
  return `<div class="combobox-option nature-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected}"><b>${escapeHTML(label)}</b>${nature.up ? effect(nature.up,'up')+effect(nature.down,'down') : '<span class="nature-neutral">보정 없음</span>'}</div>`;
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

export { calcComboboxOptionLabel, calcComboboxOptionSub, calcComboboxAttr, calcPokemonOptionHeaderHtml, calcMoveOptionHeaderHtml, calcNatureOptionHeaderHtml, calcComboboxHeaderHtml, calcRenderPokemonOption, calcRenderSimplePokemonOption, calcRenderSimpleMoveOption, calcRenderMoveOption, calcRenderAbilityOption, calcRenderItemOption, calcRenderDescriptionOption, calcRenderNatureOption, calcRenderStatusOption, calcRenderGenericOption, calcRenderComboboxOption, calcComboboxExtraOptions, calcComboboxCurrentId, calcComboboxDisplayLabel };
