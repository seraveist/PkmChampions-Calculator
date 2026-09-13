/* Fine-tune conditions, baseline comparison and actionable HP targets. */
function ftSaveBaseline() {
  const my = fineTuneState.my;
  fineTuneState.baseline = PokemonById[my.pokemonIdx]
    ? { pokemonIdx: my.pokemonIdx, evs: { ...my.evs }, nature: my.nature } : null;
  fineTuneState.notice = '';
}

function ftRestoreBaseline() {
  const base = fineTuneState.baseline;
  if (!base || base.pokemonIdx !== fineTuneState.my.pokemonIdx) return;
  fineTuneState.my.evs = { ...base.evs };
  fineTuneState.my.nature = base.nature;
  fineTuneState.notice = '기준 배분·성격으로 복원했습니다.';
}

function ftApplyTarget(stat, point) {
  if (!['hp', 'spe'].includes(stat) || !PokemonById[fineTuneState.my.pokemonIdx]) return false;
  const wanted = ftClampInt(point, 0, 32);
  const others = ftStatKeys().reduce((sum, key) => sum + (key === stat ? 0 : fineTuneState.my.evs[key] || 0), 0);
  const shortage = Math.max(0, others + wanted - 66);
  if (shortage) {
    fineTuneState.notice = `다른 능력치에서 ${shortage}포인트를 줄이면 적용할 수 있습니다.`;
    return false;
  }
  ftSetEv(stat, wanted);
  fineTuneState.notice = `${STAT_LABEL[stat]} ${wanted}포인트를 적용했습니다.`;
  return true;
}

function ftSelectHtml(label,options,value,attrs) {
  return RotomUI.field(label,RotomUI.select(options.map(option => [option.id,option.label]),value,attrs));
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
    ${ftSelectHtml('상태', CALC_STATUS_OPTIONS, side.status, { 'data-ft-side': role, 'data-ft-value': 'status' })}
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

function ftConditionLabels(side) {
  const field = fineTuneState.field;
  const labels = [];
  if (side.ability) labels.push(abName(AbilityById[side.ability]) || side.ability);
  if (side.item) labels.push(itName(ItemById[side.item]) || side.item);
  if (side.status && side.status !== 'none') labels.push(CALC_STATUS_BY_ID[side.status]?.label || side.status);
  if (side.tailwind) labels.push('순풍');
  if (side.ranks?.spe) labels.push(`S ${side.ranks.spe > 0 ? '+' : ''}${side.ranks.spe}`);
  if (side.ability === 'unburden' && side.unburdenActive) labels.push('곡예 발동');
  if (side.ability === 'slowstart' && side.slowStartActive) labels.push('슬로스타트 적용');
  if (field.weather !== 'none') labels.push(CALC_WEATHER_OPTIONS.find(row => row.id === field.weather)?.label || field.weather);
  if (field.terrain !== 'none') labels.push(CALC_TERRAIN_OPTIONS.find(row => row.id === field.terrain)?.label || field.terrain);
  return labels.join(' · ') || '추가 조건 없음';
}

function ftComparisonHtml() {
  const my = fineTuneState.my, base = fineTuneState.baseline;
  if (!base || base.pokemonIdx !== my.pokemonIdx) return '';
  const before = ftBulkMetrics({...my,evs:{...base.evs},nature:base.nature}), after = ftBulkMetrics(my);
  const signed = n => n > 0 ? `+${n}` : `${n}`;
  return `<section class="ft-comparison"><div class="section-heading"><h3>기준 배분과 비교</h3><div class="action-row"><button type="button" class="ui-label-action" data-ft-baseline="save">기준 저장</button><button type="button" class="ui-label-action" data-ft-baseline="restore">복원</button></div></div>
    <div class="ft-comparison-grid">${ftStatKeys().map(stat => `<div class="ft-comparison-row"><span>${STAT_LABEL[stat]}</span><b>${before.stats[stat]} → ${after.stats[stat]}</b><span class="${after.stats[stat] > before.stats[stat] ? 'up' : after.stats[stat] < before.stats[stat] ? 'down' : 'muted'}">${signed(after.stats[stat]-before.stats[stat])}</span></div>`).join('')}</div>
    <div class="ft-comparison-metrics">${[
      ['물리 내구',before.phys,after.phys],['특수 내구',before.spec,after.spec],
      ['보정 속도',ftMySpeed({...my,evs:{...base.evs},nature:base.nature}),ftMySpeed(my)],
      ['남은 노력치',66-Object.values(base.evs).reduce((a,b)=>a+b,0),ftEvSummary(my).remaining],
    ].map(([label,a,b])=>`<div class="ft-comparison-row"><span>${label}</span><b>${a} → ${b}</b><span class="muted">${signed(b-a)}</span></div>`).join('')}</div>
  </section>`;
}

function ftHpEffectText(side, rule, hp) {
  const amount = Math.max(1, Math.floor(hp * (rule.fraction || 0)));
  if (rule.kind === 'heal') return `회복 ${amount}`;
  if (rule.kind === 'berry') {
    const data = rule.recovery;
    const { atkAb, defAb } = battleAbilityContext(side, fineTuneState.opp);
    const heal = (data.amount ?? Math.max(1, Math.floor(hp * fractionValue(data.fraction)))) * (atkAb === 'ripen' ? 2 : 1);
    const threshold = Math.floor(hp * (data.trigger === 'quarterHp' && atkAb !== 'gluttony' ? 0.25 : 0.5));
    if (defAb === 'unnerve') return `긴장감으로 열매 발동 불가`;
    return `HP ${threshold} 이하 발동 · 회복 ${heal}`;
  }
  if (rule.kind === 'sub') return `1회 소모 ${Math.floor(hp / 4)} · 4회 후 ${hp - 4 * Math.floor(hp / 4)}`;
  return `1회 소모 ${amount} · ${Math.ceil(hp / amount)}회째 HP 0`;
}

function ftHpTargetHtml(side, group) {
  const currentHp = calcStats(side).hp, info = group.sample;
  const effects = hp => ftUniqueJoin(group.entries.map(entry => ftHpEffectText(side, entry.rule, hp)));
  const targetHtml = hit => {
    if (!hit) return '';
    const delta = hit.ev - (side.evs.hp || 0);
    return `<div class="ft-hp-target"><span>HP ${currentHp} → <b>${hit.hp}</b> · H${hit.ev} (${delta > 0 ? '+' : ''}${delta}pt)<br>${escapeHTML(effects(hit.hp))}</span>
    <button type="button" class="ui-label-action" data-ft-target="hp" data-ft-point="${hit.ev}" ${hit.shortfall ? 'disabled' : ''}>${hit.shortfall ? `${hit.shortfall}pt 부족` : '적용'}</button></div>`;
  };
  return `<div class="ft-hp-effects"><span>현재: ${escapeHTML(effects(currentHp))}</span>${info.current ? '<span>현재 기준점 충족</span>' : ''}${targetHtml(info.prev)}${targetHtml(info.next)}</div>`;
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
  fineTuneState.notice = '';
  return true;
}

function ftClearConditions(role) {
  if (!['my', 'opp'].includes(role)) return;
  const side = fineTuneState[role], defaults = makeSideState(side.pokemonIdx);
  for (const key of ['ranks', 'status', 'tailwind', 'unburdenActive', 'slowStartActive']) side[key] = cloneCalcValue(defaults[key]);
}
