/* Fine-tune conditions and actionable HP/speed targets. */
function ftApplyTarget(stat, point) {
  if (!['hp', 'spe'].includes(stat) || !PokemonById[fineTuneState.my.pokemonIdx]) return false;
  const wanted = ftClampInt(point, 0, 32);
  const others = ftStatKeys().reduce((sum, key) => sum + (key === stat ? 0 : fineTuneState.my.evs[key] || 0), 0);
  const shortage = Math.max(0, others + wanted - 66);
  if (shortage) return false;
  ftSetEv(stat, wanted);
  return true;
}

function ftSelectHtml(label,options,value,attrs,variant='') {
  return RotomUI.field(label,RotomUI.select(options.map(option => [option.id,option.label]),value,{'aria-label':label,...attrs},variant));
}

function ftPickerHtml(label,target) {
  return RotomUI.picker(label,ftComboLabel(target,ftCurrentComboId(target)),{class:'ft-cb-input','data-ft-pick':target});
}

function ftCheckHtml(label,checked,attrs) {
  return RotomUI.check(label,{...attrs,checked});
}

function ftSideConditionsHtml(role) {
  const side = fineTuneState[role];
  if (!PokemonById[side.pokemonIdx]) return '';
  const prefix = '';
  const check = (label, key) => ftCheckHtml(label, side[key], { 'data-ft-side': role, 'data-ft-flag': key });
  return `<div class="ft-planner-controls">
    ${ftSelectHtml('상태', CALC_STATUS_OPTIONS, side.status, { 'data-ft-side': role, 'data-ft-value': 'status' }, 'ui-select--choice')}
    ${check('순풍', 'tailwind')}
    ${side.ability === 'unburden' ? check('곡예 발동', 'unburdenActive') : ''}
    ${side.ability === 'slowstart' ? check('슬로스타트 적용', 'slowStartActive') : ''}
    <button type="button" class="ui-label-action" data-ft-clear-conditions="${role}">랭크·상태 초기화</button>
  </div>`;
}

function ftFieldHtml() {
  const field = fineTuneState.field;
  return `<details class="field-panel ui-surface"><summary class="ui-disclosure"><span class="field-label">${RotomUI.icon('settings')}필드 설정</span>${RotomUI.icon('chevron')}</summary><div class="field-controls">
    ${ftSelectHtml('날씨',CALC_WEATHER_OPTIONS,field.weather,{'data-ft-field':'weather'})}
    ${ftSelectHtml('필드',CALC_TERRAIN_OPTIONS,field.terrain,{'data-ft-field':'terrain'})}
    ${ftCheckHtml('중력',field.isGravity,{'data-ft-field':'isGravity'})}
  </div></details>`;
}

function ftHpTargetHtml(currentHp, target) {
  const delta = (target.delta > 0 ? '+' : '') + target.delta;
  const action = target.shortfall
    ? '<span class="ui-state ui-state--warning">' + target.shortfall + 'pt 부족</span>'
    : '<button type="button" class="ui-label-action ui-action--apply" data-ft-target="hp" data-ft-point="' + target.ev + '" aria-label="HP ' + target.hp + ', 노력치 ' + target.ev + ' 적용">적용</button>';
  return '<div class="ui-frame ft-hp-target" data-ft-target-hp="' + target.hp + '"><div class="ft-hp-target-head"><div class="ft-hp-target-values"><span class="ft-hp-target-hp">HP <strong>' + currentHp + ' → ' + target.hp + '</strong></span><span>H<strong>' + target.ev + ' (' + delta + ')</strong></span></div>' + action + '</div>' +
    '<div class="ft-breakpoint-description">' + escapeHTML(ftFormatBreakpointDescriptions(target.entries)) + '</div><div class="ft-hp-formulas">' + escapeHTML(ftUniqueJoin(target.entries.map(info => info.rule.rule))) + '</div></div>';
}

function ftSpeedTargetHtml(side, row) {
  const status = (label,kind) => '<span class="ui-state ui-state--' + kind + ' ft-speed-outcome">' + label + '</span>';
  let content;
  if (row.need === null) content = status('도달 불가','negative');
  else if (row.shortfall) content = status(row.shortfall + 'pt 부족','warning');
  else {
    content = row.achieved ? status('현재 달성','positive') : '';
    if (row.need !== (side.evs.spe || 0)) content += '<button type="button" class="ui-label-action ui-action--apply ft-speed-outcome" data-ft-target="spe" data-ft-point="' + row.need + '">' + (row.achieved ? 'S' + row.need + ' 적용' : '적용') + '</button>';
  }
  return '<div class="ft-speed-actions">' + content + '</div>';
}

function ftHandlePlannerChange(target) {
  const role = target.dataset.ftSide;
  if (target.dataset.ftField) {
    const key = target.dataset.ftField;
    if (['weather', 'terrain', 'isGravity'].includes(key)) fineTuneState.field[key] = target.type === 'checkbox' ? target.checked : target.value;
  } else if (role && ['my', 'opp'].includes(role) && target.dataset.ftFlag) {
    const key = target.dataset.ftFlag;
    if (['tailwind', 'unburdenActive', 'slowStartActive'].includes(key)) fineTuneState[role][key] = target.checked;
  } else if (role && ['my', 'opp'].includes(role) && target.dataset.ftValue === 'status') {
    fineTuneState[role].status = target.value;
  } else return false;
  return true;
}

function ftClearConditions(role) {
  if (!['my', 'opp'].includes(role)) return;
  const side = fineTuneState[role], defaults = makeSideState(side.pokemonIdx);
  for (const key of ['ranks', 'status', 'tailwind', 'unburdenActive', 'slowStartActive']) side[key] = cloneCalcValue(defaults[key]);
}
