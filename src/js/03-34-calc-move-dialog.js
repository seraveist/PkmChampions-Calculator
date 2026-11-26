import { RotomUI } from './01-10-rotom-ui.js';
import { validMoveHitCount, moveHitCountRange, AbilityById, BATTLE_TYPES, MoveById, POKEMON, TYPE_KO, calcStats, mvName, pkName, renderTrustedHTML } from './01-core.js';
import { battleMaxFallenAllies } from './02-engine.js';
import { canEditMovePower, state } from './03-10-calc-state.js';
import { powerUiMoveSlot, setPowerUiMoveSlot } from './03-32-calc-ui.js';
import { powerUiRefresh } from './03-33-calc-ui-events.js';

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
    const [min, max] = moveHitCountRange(m, state.field);
    html += select('moveHitCounts',m.id === 'dragondarts' && state.field.gameType === 'Doubles' ? '이 대상 적중 횟수' : '적중 횟수',[['','자동'],...Array.from({length:max-min+1},(_,i) => [min+i,`${min+i}회`])],validMoveHitCount(m, s.moveHitCounts[slot], state.field) ?? '','slot');
  }
  if (m.id === 'ragefist') html += number('timesAttacked','등장 후 맞은 횟수 (6회 이상은 6)',s.timesAttacked || 0,0,6);
  if (['uturn','voltswitch','flipturn','dragontail','circlethrow'].includes(m.id) || ['redcard','ejectbutton'].includes(state.def.item))
    html += flag('preventSwitch','대기 포켓몬이 없거나 교체할 수 없음');
  if (AbilityById[s.ability]?.switchAtHalfHp) html += flag('noReserve','공격측 교체할 포켓몬 없음');
  if (AbilityById[state.def.ability]?.switchAtHalfHp) html += flag('noReserve','방어측 교체할 포켓몬 없음','def-condition',state.def.noReserve);
  if (m.id === 'upperhand') html += flag('targetPriorityAttack','상대가 선제 공격기를 준비 중');
  if (m.id === 'lastresort') html += flag('usedOtherMoves','다른 보유 기술을 모두 사용함');
  if (m.id === 'belch') html += flag('ateBerry','이전에 열매를 먹음');
  if (['suckerpunch','thunderclap'].includes(m.id)) html += flag('targetAttacking','상대가 공격을 준비 중');
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
  setPowerUiMoveSlot(slot);
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
    side[key]=target.type==='checkbox' ? target.checked : ['receivedDamage','fallenAllies','stockpileCount','timesAttacked'].includes(key) ? target.value==='' ? null : Math.max(0,Math.min(Number(target.max) || 999,Number(target.value))) : target.value;
    if(target.type==='number') target.value=side[key] ?? '';
  } else if('member' in d) state.atk.beatUpParty[Number(d.member)]=target.value;
  else return;
  powerUiRefresh();
}



let bind0334CalcMoveDialogBound = false;
function bind0334CalcMoveDialog() {
  if (bind0334CalcMoveDialogBound) return;
  bind0334CalcMoveDialogBound = true;
  document.getElementById('calc-move-settings')?.addEventListener('change',event=>powerUiApplyMoveSetting(event.target));
  document.getElementById('calc-move-settings')?.addEventListener('input',event=>{
    if(event.target.type==='number') powerUiApplyMoveSetting(event.target);
  });
}

export { powerUiEl, powerUiMoveSettingsMarkup, powerUiOpenMoveSettings, powerUiApplyMoveSetting, bind0334CalcMoveDialogBound, bind0334CalcMoveDialog };
