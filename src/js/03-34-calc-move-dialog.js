const powerUiEl=id=>document.getElementById(id);

function powerUiMoveSettingsMarkup(slot) {
  const s = state.atk;
  const m = MoveById[s.moves[slot]];
  if (!m || m.cat === 'Status') return '';
  const select = (key,label,opts,value,scope='condition') => RotomUI.field(label,RotomUI.select(opts,value,{[`data-${scope}`]:key}));
  const number = (key,label,value,min,max,scope='condition') => RotomUI.field(label,RotomUI.number({min,max,[`data-${scope}`]:key,value:value ?? '',placeholder:scope === 'slot' ? '자동' : '입력'}));
  const flag = (key,label,scope='condition',value=s[key]) => RotomUI.check(label,{[`data-${scope}`]:key,checked:!!value});
  let primary = canEditMovePower(m) ? number('moveBpOverrides','위력',s.moveBpOverrides[slot],0,999,'slot') : '';
  primary += select('moveTypeOverrides','타입',[['','자동'],...BATTLE_TYPES.map(t => [t,TYPE_KO[t]])],s.moveTypeOverrides[slot] || '','slot');
  primary += RotomUI.check('급소',{'data-slot':'moveCriticalOverrides',checked:!!m.willCrit || !!s.moveCriticalOverrides[slot],disabled:!!m.willCrit});
  let html = '';
  if (m.mh) {
    const max = Array.isArray(m.mh) ? m.mh[1] : m.mh;
    const min = Array.isArray(m.mh) ? m.mh[0] : m.variableBpKind === 'tripleAxelAverage' ? 1 : max;
    html += select('moveHitCounts','적중 횟수',[['','자동'],...Array.from({length:max-min+1},(_,i) => [min+i,`${min+i}회`])],s.moveHitCounts[slot] || '','slot');
  }
  if (m.fixedDamageKind === 'receivedDamage') html += number('receivedDamage','마지막 타격의 받은 피해',s.receivedDamage,0,calcStats(s).hp-1) + select('receivedDamageCategory','받은 공격',[['Physical','물리'],['Special','특수']],s.receivedDamageCategory);
  if (m.variableBpKind === 'stockpile') html += select('stockpileCount','비축',[0,1,2,3].map(n => [n,`${n}회`]),s.stockpileCount);
  if (m.variableBpKind === 'fickleBeam') html += select('fickleBeamMode','강화',[['auto','확률 반영'],['normal','일반'],['boosted','강화']],s.fickleBeamMode);
  if (m.variableBpKind === 'fallenAllies' || AbilityById[s.ability]?.supremeOverlord) html += number('fallenAllies','쓰러진 아군',s.fallenAllies,0,battleMaxFallenAllies(state.field));
  if (['userMovesFirstDouble','userMovesSecondDouble'].includes(m.variableBpKind) || AbilityById[s.ability]?.bpBoosts?.some(rule => rule.movesSecond)) html += select('moveOrder','행동 순서',[['auto','자동'],['first','선공'],['second','후공']],s.moveOrder);
  if (m.variableBpKind === 'userWasHitDouble') html += flag('wasHit','이번 턴 먼저 피해를 받음');
  if (m.variableBpKind === 'targetWasHitDouble') html += flag('wasHit','상대가 이미 피해를 받음','def-condition',state.def.wasHit);
  if (m.variableBpKind === 'lastMoveFailedDouble') html += flag('lastMoveFailed','직전 기술 실패');
  if (m.variableBpKind === 'beatUpApprox') for (let i=0;i<battleMaxFallenAllies(state.field);i++) html += select(String(i),`참여 동료 ${i+1}`,[['','없음'],...POKEMON.filter(p => !p.mega).map(p => [p.id,pkName(p)])],s.beatUpParty[i] || '','member');
  return `<div class="move-settings-primary">${primary}</div>${html ? `<div class="move-settings-extra">${html}</div>` : ''}`;
}

function powerUiOpenMoveSettings(slot) {
  const html=powerUiMoveSettingsMarkup(slot);
  if(!html) return;
  powerUiMoveSlot=slot;
  powerUiEl('calc-move-settings-title').textContent=`${mvName(MoveById[state.atk.moves[slot]])} · 조건`;
  renderTrustedHTML(powerUiEl('calc-move-settings-body'),html);
  powerUiEl('calc-move-settings').showModal();
}


function powerUiApplyMoveSetting(target) {
  const d=target.dataset;
  if(d.slot) {
    state.atk[d.slot][powerUiMoveSlot]=target.type==='checkbox' ? target.checked : target.value==='' ? null : d.slot==='moveTypeOverrides' ? target.value : Math.max(0,Math.min(Number(target.max) || 999,Number(target.value)));
    if(target.type==='number') target.value=state.atk[d.slot][powerUiMoveSlot] ?? '';
  } else if(d.condition || d.defCondition) {
    const key=d.condition || d.defCondition,side=d.defCondition ? state.def : state.atk;
    side[key]=target.type==='checkbox' ? target.checked : ['receivedDamage','fallenAllies','stockpileCount'].includes(key) ? target.value==='' ? null : Math.max(0,Math.min(Number(target.max) || 999,Number(target.value))) : target.value;
    if(target.type==='number') target.value=side[key] ?? '';
  } else if('member' in d) state.atk.beatUpParty[Number(d.member)]=target.value;
  else return;
  powerUiRefresh();
}
document.getElementById('calc-move-settings')?.addEventListener('change',event=>powerUiApplyMoveSetting(event.target));
document.getElementById('calc-move-settings')?.addEventListener('input',event=>{
  if(event.target.type==='number') powerUiApplyMoveSetting(event.target);
});
