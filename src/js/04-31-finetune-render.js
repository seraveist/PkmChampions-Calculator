import { RotomUI, uiStatTable } from './01-10-rotom-ui.js';
import { toolStatApplyPointValue, toolStatApplyRankDelta, toolStatNormalizePointInputValue, toolStatShouldCommitPointInput } from './01-20-html-structure.js';
import { NATURE_BY_ID, PokemonById, escapeHTML, pkName, renderTrustedHTML } from './01-core.js';
import { cloneCalcValue, state } from './03-10-calc-state.js';
import { renderToolFormCombobox, renderToolPokemonSelectSubframe } from './03-11-calc-shared-render.js';
import { renderSide } from './03-30-calc-side-render.js';
import { setManualCalcField, syncFieldControls } from './03-40-calc-entry-effects.js';
import { triggerCalc } from './03-50-calc-results.js';
import { fineTuneState, ftBuildHpTargets, ftBuildSpeedTable, ftBulkMetrics, ftClampInt, ftComboLabel, ftEvSummary, ftFormatBreakpointDescriptions, ftMySpeed, ftOpponentBaseSpeed, ftRenderMagicCell, ftRenderOppSpeedChipsHtml, ftSetEv, ftStatKeys, ftWireMyComboboxes, ftWireOppComboboxes } from './04-30-finetune.js';
import { ftApplyTarget, ftClearConditions, ftFieldHtml, ftHandlePlannerChange, ftHpTargetHtml, ftPickerHtml, ftSideConditionsHtml, ftSpeedTargetHtml } from './04-32-finetune-planner.js';

/* Fine-tune rendering, DOM events, and calculator handoff. */
function renderFineTuneHp() {
  const container = document.getElementById('ft-hp-body');
  if (!container) return;
  const my = fineTuneState.my, panel = document.getElementById('ft-hp-panel');
  const hasPokemon = !!PokemonById[my.pokemonIdx];
  if (panel) panel.hidden = !hasPokemon;
  if (!hasPokemon) { renderTrustedHTML(container,''); return; }
  const plan = ftBuildHpTargets(my);
  const list = targets => '<div class="ft-breakpoint-list">' + targets.map(target => ftHpTargetHtml(plan.currentHp,target)).join('') + '</div>';
  const current = entries => entries.length ? '<div class="ft-hp-current"><span class="ui-state ui-state--positive">현재 충족</span><span>' + escapeHTML(ftFormatBreakpointDescriptions(entries)) + '</span></div>' : '';
  const disclosure = (label,content,kind) => '<details class="ft-hp-disclosure" data-ft-hp-section="' + kind + '"><summary class="ui-disclosure">' + label + RotomUI.icon('chevron') + '</summary>' + content + '</details>';
  renderTrustedHTML(container,'<div class="section-heading"><span class="muted">현재 HP</span><strong>' + plan.currentHp + '</strong></div>' + current(plan.current) +
    (plan.investment.length ? '<section class="ft-hp-investment" data-ft-hp-section="investment"><div class="section-heading"><h3>추가 투자</h3></div>' + list(plan.investment) + '</section>' : '') +
    (plan.savings.length ? disclosure('노력치 절약',list(plan.savings),'savings') : '') +
    (plan.reference.length || plan.referenceCurrent.length ? disclosure('참고 기준점',current(plan.referenceCurrent) + list(plan.reference),'reference') : ''));

}

function renderFineTuneMy() {
  const container = document.getElementById('ft-my-body');
  if (!container) return;
  const my = fineTuneState.my, p = PokemonById[my.pokemonIdx];
  const picker = renderToolPokemonSelectSubframe({
    pokemonId:my.pokemonIdx, value:p ? pkName(p) : '',
    inputClass:'ft-cb-input',inputAttrs:{'data-ft-pick':'my','aria-label':'내 포켓몬'},
    primaryActions:'<button type="button" class="ui-label-action" data-party-import-target="finetune:my">불러오기</button>',
    titleActions:p ? '<div class="participant-actions-end"><button type="button" class="ui-label-action" data-ft-apply-side="atk">공격측 적용</button><button type="button" class="ui-label-action" data-ft-apply-side="def">방어측 적용</button></div>' : '',
    metaActions:renderToolFormCombobox({pokemonId:my.pokemonIdx,inputClass:'ft-cb-input',pickAttr:'data-ft-pick',pickValue:'myForm'}),
  });
  const ev = ftEvSummary(my), bulk = p ? ftBulkMetrics(my) : null;
  renderTrustedHTML(container,`${picker}${p ? `
    <div class="attributes">${['ability','item','nature'].map(key => RotomUI.picker({ability:'특성',item:'도구',nature:'성격'}[key],ftComboLabel(key,my[key]),{class:'ft-cb-input','data-ft-pick':key})).join('')}</div>
    <div class="section-heading stat-heading"><h3>능력치</h3><span class="budget">노력치 <strong>${ev.total}</strong> / 66</span></div>
    ${uiStatTable(my,{evAttr:'data-ft-ev',rankAttr:'data-ft-rank-select',magic:NATURE_BY_ID[my.nature]?.up ? key => ftRenderMagicCell(my,key,my.evs[key] || 0) : null})}
    ${ftSideConditionsHtml('my')}
    <div class="metric-strip"><span>물리 내구 <strong>${bulk.phys}</strong></span><span>특수 내구 <strong>${bulk.spec}</strong></span></div>
` : '<div class="empty-state">포켓몬을 선택하세요.</div>'}`);
  ftWireMyComboboxes();
}

function renderFineTuneOpp() {
  const container = document.getElementById('ft-opp-body');
  if (!container) return;
  const opp = fineTuneState.opp, p = PokemonById[opp.pokemonIdx];
  const picker = renderToolPokemonSelectSubframe({
    pokemonId:opp.pokemonIdx,value:p ? pkName(p) : '',inputClass:'ft-cb-input',inputAttrs:{'data-ft-pick':'opp','aria-label':'상대 포켓몬'},
    metaActions:renderToolFormCombobox({pokemonId:opp.pokemonIdx,inputClass:'ft-cb-input',pickAttr:'data-ft-pick',pickValue:'oppForm'}),
  });
  renderTrustedHTML(container,`${picker}${p ? `
    <div class="attributes">${ftPickerHtml('특성','oppAbility')}${ftPickerHtml('도구','oppItem')}${ftPickerHtml('성격','oppNature')}</div>
    <div class="form-grid form-grid--three">
      ${RotomUI.field('속도 종족값',RotomUI.number({id:'ftOppBaseSpe',value:ftOpponentBaseSpeed(opp),readonly:true}))}
      ${RotomUI.field('속도 노력치',RotomUI.number({id:'ftOppPoints',min:0,max:32,value:opp.evs.spe || 0}))}
      ${RotomUI.field('속도 랭크',RotomUI.select(Array.from({length:13},(_,i) => [i-6,i>6 ? `+${i-6}` : i-6]),opp.ranks.spe || 0,{id:'ftOppRank'}))}
    </div>${ftSideConditionsHtml('opp')}
    <div class="metric-strip">${ftRenderOppSpeedChipsHtml(opp)}</div>` : ''}${ftFieldHtml()}`);
  ftWireOppComboboxes();
}

function renderFineTuneSpeed() {
  const container = document.getElementById('ft-speed-body');
  if (!container) return;
  const my = fineTuneState.my;
  if (!PokemonById[my.pokemonIdx]) { renderTrustedHTML(container,'<div class="empty-state">내 포켓몬을 선택하세요.</div>'); return; }
  const rows = ftBuildSpeedTable(), margin = ftClampInt(fineTuneState.margin,0,999);
  renderTrustedHTML(container,`<div class="ft-speed-summary"><span>내 속도</span><strong>${ftMySpeed(my)}</strong></div>
    ${rows.length ? `<div class="data-table-scroll" role="region" aria-label="스피드 비교 표" tabindex="0"><table class="ui-data-table data-table ft-speed-table"><thead><tr><th scope="col">상대 배치</th><th scope="col">속도</th><th scope="col">${margin === 0 ? '동속 이상' : '목표'}</th><th scope="col">필요 S</th><th scope="col">적용</th></tr></thead><tbody>${rows.map(row => `<tr class="ft-speed-case ${row.need !== null && !row.shortfall ? 'possible' : 'impossible'}"><th scope="row"><span class="ft-speed-label ${row.kind || ''}">${escapeHTML(row.label)}</span><small>${escapeHTML(row.sub || '')}</small></th><td>${row.oppSpe}</td><td title="${margin === 0 ? '동속 이상' : '+'+margin+' 추월'}">${row.target}</td><td><strong>${row.need === null ? '—' : row.need}</strong></td><td>${ftSpeedTargetHtml(my,row)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">상대 포켓몬 또는 목표 속도를 입력하세요.</div>'}`);
}

function renderFineTuneAll() {
  const active = document.activeElement;
  const stat = active?.dataset?.ftEv || active?.dataset?.toolStatPointInput;
  const selection = stat ? [active.selectionStart, active.selectionEnd] : null;
  renderFineTuneMy();
  renderFineTuneHp();
  renderFineTuneOpp();
  renderFineTuneSpeed();
  const targetInput = document.getElementById('ftTargetSpeed');
  if (targetInput && targetInput !== active) targetInput.value = fineTuneState.targetSpeed;
  if (stat) {
    const input = document.querySelector(`[data-ft-ev="${stat}"]`);
    input?.focus({ preventScroll: true });
    if (input?.setSelectionRange && selection[0] !== null) input.setSelectionRange(...selection);
  }
}








// 양방향 sync — 세부조정 → 계산기
function ftApplyToCalc(targetSide) {
  if (!['atk', 'def'].includes(targetSide) || !PokemonById[fineTuneState.my.pokemonIdx]) return;
  // targetSide: 'atk' | 'def' (내 포켓몬이 들어갈 자리)
  const otherSide = targetSide === 'atk' ? 'def' : 'atk';
  // 내 풀세팅을 deep clone 해서 적용
  state[targetSide] = cloneCalcValue(fineTuneState.my);
  const oppP = PokemonById[fineTuneState.opp.pokemonIdx];
  if (oppP) state[otherSide] = cloneCalcValue(fineTuneState.opp);
  state.field = cloneCalcValue(fineTuneState.field);
  setManualCalcField('weather', state.field.weather);
  setManualCalcField('terrain', state.field.terrain);
  renderSide('atk');
  renderSide('def');
  syncFieldControls(state.field);
  triggerCalc();
  // 계산기 탭으로 이동
  const calcNav = document.querySelector('.nav-tab[data-page="calc"]');
  if (calcNav) calcNav.click();
}


// 양방향 sync — 계산기 → 세부조정
// renderSide 가 만든 패널 헤더에 "🔧 세부조정" 버튼이 추가되어, 클릭 시 이 함수 호출.
function loadSideToFineTune(sideKey) {
  const src = state[sideKey];
  fineTuneState.my = cloneCalcValue(src);
  // 상대 자리는 계산기의 반대편 포켓몬으로
  const otherKey = sideKey === 'atk' ? 'def' : 'atk';
  fineTuneState.opp = cloneCalcValue(state[otherKey]);
  fineTuneState.field = cloneCalcValue(state.field);
  fineTuneState.targetSpeed = '';
  // 세부조정 탭 이동
  const ftNav = document.querySelector('.nav-tab[data-page="finetune"]');
  if (ftNav) ftNav.click();
  renderFineTuneAll();
}

let bind0431FinetuneRenderBound = false;
function bind0431FinetuneRender() {
  if (bind0431FinetuneRenderBound) return;
  bind0431FinetuneRenderBound = true;
  document.getElementById('page-finetune')?.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ftRankSelect) { fineTuneState.my.ranks[t.dataset.ftRankSelect] = ftClampInt(t.value,-6,6); renderFineTuneAll(); return; }
    if (ftHandlePlannerChange(t)) { renderFineTuneAll(); return; }
    if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
    if (t.id === 'ftTargetSpeed') { fineTuneState.targetSpeed = t.value; renderFineTuneSpeed(); return; }
    if (t.id === 'ftOppPoints') { toolStatApplyPointValue(fineTuneState.opp, 'spe', t.value, { stats: ftStatKeys(), maxTotal: 66 }); renderFineTuneAll(); return; }
    if (t.id === 'ftOppRank') { fineTuneState.opp.ranks.spe = ftClampInt(t.value, -6, 6); renderFineTuneAll(); return; }
    const pointInputStat = t.dataset.toolStatPointInput || t.dataset.ftEv;
    if (pointInputStat) {
      const stat = pointInputStat;
      const normalized = toolStatNormalizePointInputValue(t.value);
      if (normalized !== t.value) t.value = normalized;
      ftSetEv(stat, t.value);
      if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
      renderFineTuneAll();
      return;
    }
  });
  document.getElementById('page-finetune')?.addEventListener('input', e => {
    const t = e.target;
    const pointInputStat = t.dataset.toolStatPointInput || t.dataset.ftEv;
    if (pointInputStat) {
      const normalized = toolStatNormalizePointInputValue(t.value);
      if (normalized !== t.value) t.value = normalized;
      ftSetEv(pointInputStat, t.value);
      if (!toolStatShouldCommitPointInput(t.value, e.type)) return;
      renderFineTuneAll();
      return;
    }
    if (t.id === 'ftMargin') { fineTuneState.margin = t.value; renderFineTuneSpeed(); return; }
    if (t.id === 'ftTargetSpeed') { fineTuneState.targetSpeed = t.value; renderFineTuneSpeed(); return; }
  });
  document.getElementById('page-finetune')?.addEventListener('click', e => {
    const t = e.target;
    const targetButton = t.closest?.('[data-ft-target]');
    if (targetButton) { ftApplyTarget(targetButton.dataset.ftTarget, targetButton.dataset.ftPoint); renderFineTuneAll(); return; }
    const clearButton = t.closest?.('[data-ft-clear-conditions]');
    if (clearButton) { ftClearConditions(clearButton.dataset.ftClearConditions); renderFineTuneAll(); return; }
    const applySideButton = t.closest?.('[data-ft-apply-side]');
    if (applySideButton) {
      ftApplyToCalc(applySideButton.dataset.ftApplySide);
      return;
    }
    // EV quick set 버튼 (0/32) — 66 캡 적용
    const pointSetStat = t.dataset.toolStatPointSet || t.dataset.ftEvset;
    if (pointSetStat !== undefined) {
      const stat = pointSetStat;
      ftSetEv(stat, t.dataset.toolStatPointValue ?? t.dataset.ftEvval);
      renderFineTuneAll();
      return;
    }
    // 내 측 랭크
    const rankStat = t.dataset.toolStatRank || t.dataset.ftRank;
    if (rankStat) {
      const stat = rankStat;
      const dir = t.dataset.toolStatRankDir || t.dataset.ftDir;
      if (typeof toolStatApplyRankDelta === 'function') {
        toolStatApplyRankDelta(fineTuneState.my, stat, dir);
      } else {
        const cur = fineTuneState.my.ranks[stat] || 0;
        fineTuneState.my.ranks[stat] = Math.max(-6, Math.min(6, cur + (parseInt(dir, 10) || 0)));
      }
      renderFineTuneAll();
      return;
    }
  });
}

export { renderFineTuneHp, renderFineTuneMy, renderFineTuneOpp, renderFineTuneSpeed, renderFineTuneAll, ftApplyToCalc, loadSideToFineTune, bind0431FinetuneRenderBound, bind0431FinetuneRender };
