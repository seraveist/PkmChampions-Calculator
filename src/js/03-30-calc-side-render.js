import { RotomUI, uiStatTable } from './01-10-rotom-ui.js';
import { ItemById, MoveById, NATURE_BY_ID, PokemonById, itName, pkName, renderTrustedHTML } from './01-core.js';
import { CALC_STATUS_OPTIONS, applyPokemonToCalcSide, calcAbilityDisplayLabel, calcNatureLabel, hpPercentInputValue, setSideDamageBlockActive, state } from './03-10-calc-state.js';
import { renderToolPokemonSelectSubframe } from './03-11-calc-shared-render.js';
import { wireCalcCombobox } from './03-22-calc-combobox-events.js';
import { applyEntryFieldsFromSide } from './03-40-calc-entry-effects.js';
import { triggerCalc } from './03-50-calc-results.js';

/* Calculator identity, move-slot state and rendering. */
function applyMoveToCalcSlot(sideKey, slot, moveId) {
  const side = state[sideKey];
  if (!side || !Number.isInteger(slot) || slot < 0 || slot > 3 || (moveId && !MoveById[moveId])) return false;
  if (!Array.isArray(side.moves)) side.moves = [];
  side.moves[slot] = moveId || '';
  for (const [key, empty] of Object.entries({ moveBpOverrides: null, moveTypeOverrides: null, moveCriticalOverrides: false, moveHitCounts: null })) {
    if (!Array.isArray(side[key])) side[key] = [empty, empty, empty, empty];
    side[key][slot] = empty;
  }
  return true;
}

function renderSide(sideKey) {
  const side=state[sideKey],p=PokemonById[side.pokemonIdx],container=document.getElementById(`${sideKey}-body`);
  if(!container) return;
  container.dataset.pokemonId=side.pokemonIdx || '';
  const picker=renderToolPokemonSelectSubframe({pokemonId:side.pokemonIdx,types:side.types,value:p ? pkName(p) : '',inputAttrs:{'data-side':sideKey,'data-field':'pokemonIdx','aria-label':`${sideKey==='atk' ? '공격' : '방어'} 포켓몬`},primaryActions:`<button type="button" class="ui-label-action" data-party-import-target="calc:${sideKey}">불러오기</button>`,titleActions:`<div class="participant-actions-end"><button type="button" class="ui-label-action calc-page-jump-button" data-ft-from-side="${sideKey}">세부조정</button><button type="button" class="ui-label-action calc-page-jump-button" data-rc-from-side="${sideKey}">역계산</button>${p ? `<button type="button" class="ui-button icon-button" data-calc-side-settings="${sideKey}" aria-label="${sideKey==='atk' ? '공격' : '방어'} 추가 설정">${RotomUI.icon('settings')}</button>` : ''}</div>`});
  renderTrustedHTML(container,`<div class="side-top"><h3 class="side-label">${sideKey==='atk' ? '공격 / ATTACK' : '방어 / DEFENSE'}</h3><span class="budget">노력치 <strong data-budget="${sideKey}">${Object.values(side.evs).reduce((a,b)=>a+b,0)}</strong> / 66</span></div>${picker}${p ? `
    <div class="attributes">${['ability','item','nature'].map(key=>RotomUI.picker({ability:'특성',item:'도구',nature:'성격'}[key],key==='ability' ? calcAbilityDisplayLabel(sideKey) : key==='item' ? itName(ItemById[side.item]) : calcNatureLabel(NATURE_BY_ID[side.nature]),{'data-side':sideKey,'data-cb-type':key,'data-field':key})).join('')}</div>
    ${uiStatTable(side,{evAttr:'data-calc-ev',rankAttr:'data-calc-rank',base:false,label:`${sideKey==='atk' ? '공격' : '방어'} 능력치`})}
    <div class="hp-row"><label for="hp-${sideKey}">HP</label>${RotomUI.number({id:`hp-${sideKey}`,min:.1,max:100,step:.1,inputmode:'decimal',value:hpPercentInputValue(side),'data-calc-hp':sideKey,'aria-label':`${sideKey==='atk' ? '공격' : '방어'} 현재 HP 퍼센트`})}<span>%</span><span class="ui-meter hp-track" aria-hidden="true"><span class="ui-meter-fill" data-hp-bar="${sideKey}"></span></span><span class="hp-value" data-hp-value="${sideKey}"></span>${RotomUI.select(CALC_STATUS_OPTIONS.map(s=>[s.id,s.id==='none' ? '정상' : s.label]),side.status,{'data-calc-status':sideKey,'aria-label':`${sideKey==='atk' ? '공격' : '방어'} 상태`},'ui-select--compact ui-select--choice status-select')}</div>` : '<div class="empty-state">포켓몬을 선택하세요.</div>'}`);
  wireSide(sideKey);
}

function wireSide(sideKey) {
  document.getElementById(`${sideKey}-body`)?.querySelectorAll('.cb-input').forEach(input=>{
    wireCalcCombobox(input,{onSelect:id=>{
      const field=input.dataset.field,side=state[sideKey];
      if(field==='pokemonIdx') applyPokemonToCalcSide(sideKey,id);
      else if(field==='ability') { side.ability=id || '';setSideDamageBlockActive(side,false);applyEntryFieldsFromSide(sideKey); }
      else if(field==='nature') side.nature=id || 'hardy';
      else if(field==='item') side.item=id || '';
      renderSide(sideKey);triggerCalc();
    }});
  });
}

function applyEvPreset(sideKey, preset) {
  const side = state[sideKey];
  const p = PokemonById[side.pokemonIdx];
  if (!p) return;

  side.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  const presetMap = {
    AS: ['atk', 'spe'],
    CS: ['spa', 'spe'],
    HA: ['hp', 'atk'],
    HC: ['hp', 'spa'],
    HB: ['hp', 'def'],
    HD: ['hp', 'spd'],
  };
  const stats = presetMap[preset];
  if (!stats) return;
  stats.forEach(s => { side.evs[s] = 32; });
}

export { applyMoveToCalcSlot, renderSide, wireSide, applyEvPreset };
