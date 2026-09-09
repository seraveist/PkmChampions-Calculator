/* Only show move-specific inputs when a selected move uses them. */
function renderCalcMoveConditions(sideKey, side) {
  const moves = side.moves.map(id => MoveById[id]).filter(Boolean);
  const controls = [];
  const seedStats = { electricseed: '방어', grassyseed: '방어', psychicseed: '특수방어', mistyseed: '특수방어' };
  if (seedStats[side.item]) controls.push(`<span class="ui-meta-row">${escapeHTML(displayName(ItemById[side.item]))} 발동 후에는 도구를 ‘없음’으로 바꾸고 ${seedStats[side.item]} +1을 랭크에 입력하세요. 시드 발동은 자동 적용하지 않습니다.</span>`);
  if (side.item === 'leek') controls.push('<span class="ui-meta-row">대파의 급소 확률은 KO 확률에 합산하지 않습니다. 급소 피해는 ‘급소’ 조건을 선택해 확인하세요.</span>');
  const select = (label, attrs, options, value) => `<label class="ui-field">${escapeHTML(label)}<select ${attrs} data-side="${sideKey}">${options.map(([id, name]) => `<option value="${escapeHTML(String(id))}" ${String(value) === String(id) ? 'selected' : ''}>${escapeHTML(name)}</option>`).join('')}</select></label>`;
  controls.push(`<label class="checkbox-label ui-check"><input type="checkbox" data-action="conditionFlag" data-side="${sideKey}" data-field="tailwind" ${side.tailwind ? 'checked' : ''}>${sideKey === 'atk' ? '공격측' : '수비측'} 순풍</label>`);
  if (moves.some(m => m.variableBpKind === 'fickleBeam')) controls.push(select('변덕레이저 강화 조건', 'data-action="conditionMode" data-field="fickleBeamMode"', [['auto', '확률 반영 · 일반 70% / 강화 30%'], ['normal', '일반 위력 80 고정'], ['boosted', '강화 위력 160 고정']], side.fickleBeamMode || 'auto'));
  if (moves.some(m => m.fixedDamageKind === 'receivedDamage')) {
    controls.push(`<label class="ui-field">이번 턴 마지막으로 받은 HP 피해량<input type="number" min="0" max="${calcStats(side).hp - 1}" step="1" inputmode="numeric" data-action="receivedDamage" data-side="${sideKey}" value="${side.receivedDamage ?? ''}" placeholder="미입력"></label>`);
    controls.push(select('받은 공격 분류', 'data-action="conditionMode" data-field="receivedDamageCategory"', [['Physical', '물리'], ['Special', '특수']], side.receivedDamageCategory || 'Physical'));
    controls.push('<span class="ui-meta-row">공격을 받고 생존한 조건입니다. 연속기는 마지막 1회의 HP 피해만 입력하세요. 0은 피격했지만 HP 피해가 없었던 경우입니다.</span>');
  }
  if (moves.some(m => m.variableBpKind === 'stockpile')) controls.push(select('토해내기 · 비축 횟수', 'data-action="conditionMode" data-field="stockpileCount"', [[0, '비축 없음 · 사용 불가'], [1, '1회 · 위력 100'], [2, '2회 · 위력 200'], [3, '3회 · 위력 300']], side.stockpileCount || 0));
  if (moves.some(m => m.variableBpKind === 'fling')) {
    const item = flingItemForMove(side, state[sideKey === 'atk' ? 'def' : 'atk']);
    controls.push(`<span class="ui-meta-row">내던지기: ${item ? `${escapeHTML(displayName(item))} · 위력 ${item.flingBp}` : '던질 수 있는 도구를 선택하세요.'}</span>`);
  }
  if (moves.some(m => m.variableBpKind === 'fallenAllies') || AbilityById[side.ability]?.supremeOverlord) {
    controls.push(select('쓰러진 아군 수', 'data-action="fallenAllies"', Array.from({ length: maxFallenAllies() + 1 }, (_, i) => [i, `${i}마리`]), clampFallenAllies(side.fallenAllies)));
  }
  if (moves.some(m => ['userMovesFirstDouble', 'userMovesSecondDouble'].includes(m.variableBpKind)) || AbilityById[side.ability]?.bpBoosts?.some(rule => rule.movesSecond)) {
    controls.push(select('행동 순서 (자동: 같은 우선도 가정)', 'data-action="conditionMode" data-field="moveOrder"', [['auto', '스피드·트릭룸으로 판단'], ['first', '선공'], ['second', '후공']], side.moveOrder || 'auto'));
  }
  for (const [kind, field, label] of [['userWasHitDouble', 'wasHit', '이번 턴 먼저 피해를 받음'], ['lastMoveFailedDouble', 'lastMoveFailed', '직전 기술 실패']]) {
    if (moves.some(m => m.variableBpKind === kind)) controls.push(`<label class="checkbox-label ui-check"><input type="checkbox" data-action="conditionFlag" data-side="${sideKey}" data-field="${field}" ${side[field] ? 'checked' : ''}>${label}</label>`);
  }
  const opponent = state[sideKey === 'atk' ? 'def' : 'atk'];
  if (opponent.moves.some(id => MoveById[id]?.variableBpKind === 'targetWasHitDouble')) controls.push(`<label class="checkbox-label ui-check"><input type="checkbox" data-action="conditionFlag" data-side="${sideKey}" data-field="wasHit" ${side.wasHit ? 'checked' : ''}>이번 턴 이미 피해를 받음 (상대 기술 조건)</label>`);
  side.moves.forEach((id, slot) => {
    const move = MoveById[id];
    if (!move?.mh) return;
    const max = Array.isArray(move.mh) ? move.mh[1] : move.mh;
    const min = Array.isArray(move.mh) ? move.mh[0] : move.variableBpKind === 'tripleAxelAverage' ? 1 : max;
    const options = [['', '자동 (특성·도구 반영)'], ...Array.from({ length: max - min + 1 }, (_, i) => [i + min, `${i + min}회 적중`])];
    controls.push(select(`${slot + 1}. ${mvName(move)} 적중 횟수`, `data-action="hitCount" data-slot="${slot}"`, options, side.moveHitCounts?.[slot] || ''));
  });
  if (moves.some(m => m.variableBpKind === 'beatUpApprox')) {
    const options = [['', '참여 동료 없음'], ...POKEMON.filter(p => !p.mega).map(p => [p.id, pkName(p)])];
    controls.push('<span class="ui-meta-row">집단구타: 상태이상이 없고 쓰러지지 않은 동료만 선택합니다. 사용자도 1회 참여합니다.</span>');
    for (let i = 0; i < battleMaxFallenAllies(state.field); i++) controls.push(select(`참여 동료 ${i + 1}`, `data-action="beatUpMember" data-slot="${i}"`, options, side.beatUpParty?.[i] || ''));
  }
  return controls.length ? `<div class="calc-move-conditions ui-control-frame ui-subframe ui-subframe-stack">${controls.join('')}</div>` : '';
}

function specialCalcConditionLabel(move, side, opponent) {
  if (move.variableBpKind === 'fickleBeam') return side.fickleBeamMode === 'normal' ? '변덕레이저 일반 조건 고정 · 강화 확률 제외'
    : side.fickleBeamMode === 'boosted' ? '변덕레이저 강화 조건 고정 · 발생 확률 30%는 KO 확률에 미합산'
    : '변덕레이저 일반 70%·강화 30%를 피해와 KO 확률에 반영';
  if (move.fixedDamageKind === 'receivedDamage') return `받은 ${side.receivedDamageCategory === 'Special' ? '특수' : '물리'} 피해 ${side.receivedDamage} × ${move.receivedDamageMultiplier} · 반복 시 매회 같은 피해를 받고 생존한 조건`;
  if (move.variableBpKind === 'stockpile') return `비축 ${side.stockpileCount}회 · 반복 시 매회 같은 횟수로 재비축한 조건`;
  if (move.variableBpKind === 'fling') return `${displayName(flingItemForMove(side, opponent))} 내던지기 · 반복 시 매회 같은 도구를 다시 보유한 조건 · 도구의 상태·랭크 부가 효과 제외`;
  return '';
}
