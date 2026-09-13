/* Calculator-specific combobox event wiring. */
function wireCalcCombobox(input, { filterFn = null, onSelect = null } = {}) {
  const list = input.closest('.combobox')?.querySelector('.combobox-options');
  if (!list) return;
  const type = input.dataset.cbType, side = input.dataset.side;
  if (type === 'pokemon') return wirePokemonSelectCombobox(input, {
    getOptions: () => calcDatasetForCombobox(side, 'pokemon'),
    getCurrentId: () => calcComboboxCurrentId(input),
    getDisplayLabel: () => calcComboboxDisplayLabel(input),
    onSelect,
  });
  const filter = filterFn || makeCombobox(side, type);
  const combo = wireSharedComboboxKeyboard(input,list,{
    showOptions: query => {
      const extra = calcComboboxExtraOptions(type).filter(option => !query || calcMatches(query,option.id,option.label,option.sub));
      const matches = [...extra,...filter(query)];
      renderTrustedHTML(list,calcComboboxHeaderHtml(type) + (matches.map(option => calcRenderComboboxOption(type,option,calcComboboxCurrentId(input))).join('') || '<div class="combobox-option empty">검색 결과 없음</div>'));
    },
    onSelect: option => {
      uiSetPickerLabel(input,option.querySelector('b')?.textContent || '없음');
      if (onSelect) onSelect(option.dataset.id || '',option);
    },
  });
  return combo;
}
